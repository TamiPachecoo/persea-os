# PERSEA Operating System — Database Schema (Phase 1 / MVP)

All tables live in Postgres (Supabase). All business tables include `tenant_id uuid not null` for future multi-tenancy, even though MVP seeds exactly one tenant row. All tables have `created_at timestamptz default now()`; mutable tables also have `updated_at` maintained via trigger. RLS is enabled on every table; policies scope by `tenant_id` + role, described inline.

## Core / Tenancy

```sql
tenants (
  id uuid pk,
  name text,                    -- "PERSEA"
  slug text unique,
  branding jsonb,                -- colors, logo url, fonts
  created_at timestamptz
)

profiles (                       -- 1:1 with auth.users
  id uuid pk references auth.users(id),
  tenant_id uuid references tenants(id),
  role text check (role in ('admin','client','team_member')),
  full_name text,
  avatar_url text,
  phone text,
  created_at timestamptz
)
```

## CRM / Clients

```sql
clients (
  id uuid pk,
  tenant_id uuid references tenants(id),
  profile_id uuid references profiles(id),   -- null until account created
  full_name text,
  email text,
  status text check (status in ('invited','active','paused','completed','churned')),
  tags text[],
  notes text,
  created_by uuid references profiles(id),
  created_at timestamptz,
  updated_at timestamptz
)

client_invites (
  id uuid pk,
  tenant_id uuid references tenants(id),
  client_id uuid references clients(id),
  email text,
  token text unique,
  status text check (status in ('pending','accepted','expired')),
  expires_at timestamptz,
  created_at timestamptz
)
```

## Journey Engine (generic, reusable)

```sql
programs (                        -- e.g. "Identity" (Phase 1)
  id uuid pk,
  tenant_id uuid references tenants(id),
  key text,                       -- 'identity'
  name text,
  description text,
  order_index int,
  is_active boolean default true
)

program_phases (                  -- sub-stages within a program (future-proofing;
  id uuid pk,                     -- Phase 1 MVP may have just one phase = "Identity")
  program_id uuid references programs(id),
  name text,
  order_index int
)

journey_steps (                   -- ordered, typed steps within a phase
  id uuid pk,
  phase_id uuid references program_phases(id),
  key text,                       -- 'questionnaire', 'meeting_1', 'playbook_review', etc.
  step_type text check (step_type in (
     'questionnaire','meeting','ai_generation','assessment',
     'review_publish','homework','pitch_generation','info'
  )),
  title text,
  description text,
  order_index int,
  config jsonb                    -- step-specific config (e.g. which questionnaire_id)
)

client_journey_progress (
  id uuid pk,
  tenant_id uuid references tenants(id),
  client_id uuid references clients(id),
  program_id uuid references programs(id),
  current_step_id uuid references journey_steps(id),
  status text check (status in ('not_started','in_progress','completed')),
  updated_at timestamptz
)

client_step_status (              -- per-step completion tracking
  id uuid pk,
  client_id uuid references clients(id),
  step_id uuid references journey_steps(id),
  status text check (status in ('locked','available','in_progress','completed')),
  completed_at timestamptz
)
```

## Questionnaire Module

```sql
questionnaires (
  id uuid pk,
  tenant_id uuid references tenants(id),
  key text,                       -- 'identity_questionnaire'
  title text,
  description text
)

questionnaire_questions (
  id uuid pk,
  questionnaire_id uuid references questionnaires(id),
  order_index int,
  question_text text,
  input_type text check (input_type in ('short_text','long_text','single_choice','multi_choice','scale')),
  options jsonb,                  -- for choice/scale types
  is_required boolean default true
)

questionnaire_responses (
  id uuid pk,
  tenant_id uuid references tenants(id),
  client_id uuid references clients(id),
  questionnaire_id uuid references questionnaires(id),
  status text check (status in ('in_progress','submitted')),
  submitted_at timestamptz,
  created_at timestamptz
)

questionnaire_answers (
  id uuid pk,
  response_id uuid references questionnaire_responses(id),
  question_id uuid references questionnaire_questions(id),
  answer_value jsonb              -- text or array, normalized
)
```

## Meetings

```sql
meetings (
  id uuid pk,
  tenant_id uuid references tenants(id),
  client_id uuid references clients(id),
  step_id uuid references journey_steps(id),
  title text,                     -- 'Meeting 1'
  scheduled_at timestamptz,
  transcript_text text,
  transcript_file_url text,       -- Supabase Storage path
  status text check (status in ('scheduled','transcript_uploaded','analyzed')),
  created_by uuid references profiles(id),
  created_at timestamptz
)
```

## AI Workspace (generic generation + versioning)

```sql
ai_prompt_templates (
  id uuid pk,
  tenant_id uuid references tenants(id),
  key text,                       -- 'questionnaire_analysis_v1'
  generation_type text,           -- 'questionnaire_analysis','transcript_analysis','playbook_generation','pitch_generation'
  version int,
  prompt_text text,
  is_active boolean default true,
  created_at timestamptz
)

ai_generations (
  id uuid pk,
  tenant_id uuid references tenants(id),
  client_id uuid references clients(id),
  generation_type text,
  prompt_template_id uuid references ai_prompt_templates(id),
  prompt_used text,               -- exact interpolated prompt sent, immutable
  input_refs jsonb,               -- {questionnaire_response_id, meeting_id, ...}
  output jsonb,                   -- raw structured AI output
  model text,                     -- e.g. 'claude-sonnet-5'
  version int,                    -- increments per (client, generation_type)
  status text check (status in ('generated','superseded')),
  created_by uuid references profiles(id),
  created_at timestamptz
)
```
Never updated after insert — regeneration always inserts a new row with `version = max+1` and marks prior `superseded`.

## Playbook Engine (specialized Document Engine)

```sql
playbook_section_definitions (   -- configurable per program/tenant
  id uuid pk,
  tenant_id uuid references tenants(id),
  key text,                      -- 'mission', 'golden_circle', ...
  title text,
  order_index int
)

playbooks (
  id uuid pk,
  tenant_id uuid references tenants(id),
  client_id uuid references clients(id),
  program_id uuid references programs(id),
  current_version_id uuid,        -- fk added after playbook_versions exists
  status text check (status in ('draft','published')),
  created_at timestamptz
)

playbook_versions (
  id uuid pk,
  playbook_id uuid references playbooks(id),
  version_number int,
  sections jsonb,                 -- { section_key: { title, content } }
  source_ai_generation_id uuid references ai_generations(id),
  edited_by uuid references profiles(id),
  status text check (status in ('draft','published','archived')),
  published_at timestamptz,
  created_at timestamptz
)
```
`playbooks.current_version_id` always points at the latest **published** version; clients only ever see that. Admins can browse all `playbook_versions` (full history preserved, never deleted).

## Pitch Generator

```sql
pitches (
  id uuid pk,
  tenant_id uuid references tenants(id),
  client_id uuid references clients(id),
  playbook_version_id uuid references playbook_versions(id),
  pitch_10s text,
  pitch_30s text,
  pitch_60s text,
  pitch_networking text,
  instagram_bio text,
  linkedin_summary text,
  source_ai_generation_id uuid references ai_generations(id),
  version int,
  created_at timestamptz
)
```

## Assessment Module (configurable, e.g. Archetype Test)

```sql
assessment_definitions (
  id uuid pk,
  tenant_id uuid references tenants(id),
  key text,                      -- 'archetype_test'
  title text,
  description text,
  external_url text
)

client_assessments (
  id uuid pk,
  client_id uuid references clients(id),
  assessment_definition_id uuid references assessment_definitions(id),
  status text check (status in ('not_started','completed')),
  completed_at timestamptz
)
```

## Homework Engine

```sql
homework_task_templates (        -- configurable per journey step
  id uuid pk,
  tenant_id uuid references tenants(id),
  step_id uuid references journey_steps(id),
  key text,                      -- 'read_playbook','practice_pitch','reflection_questions'
  title text,
  description text,
  task_type text check (task_type in ('boolean','text_submission')),
  order_index int
)

client_homework_tasks (
  id uuid pk,
  client_id uuid references clients(id),
  template_id uuid references homework_task_templates(id),
  status text check (status in ('pending','completed')),
  submission_text text,           -- for reflection/question submissions
  completed_at timestamptz
)
```
Completion % computed as `completed / total` per client per step — a view, not a stored column:
```sql
create view client_homework_progress as
select client_id,
       count(*) filter (where status='completed')::float / count(*) as completion_pct
from client_homework_tasks group by client_id;
```

## Notifications

```sql
notifications (
  id uuid pk,
  tenant_id uuid references tenants(id),
  profile_id uuid references profiles(id),   -- recipient
  type text,                      -- 'playbook_published','homework_assigned','meeting_scheduled'
  title text,
  body text,
  link_url text,
  read_at timestamptz,
  created_at timestamptz
)
```

## Resources

```sql
resources (
  id uuid pk,
  tenant_id uuid references tenants(id),
  step_id uuid references journey_steps(id),  -- nullable, can be general
  title text,
  description text,
  url text,
  resource_type text check (resource_type in ('link','file','video')),
  created_at timestamptz
)
```

## Activity Timeline

```sql
activity_events (
  id uuid pk,
  tenant_id uuid references tenants(id),
  client_id uuid references clients(id),
  actor_id uuid references profiles(id),
  event_type text,               -- 'questionnaire_submitted','playbook_published', etc.
  metadata jsonb,
  created_at timestamptz
)
```
Populated via lightweight triggers or app-layer inserts on key state transitions; powers both the client Activity Timeline UI and the admin Meeting Preparation Dashboard.

## RLS Policy Pattern (applied consistently)

```sql
-- Admin/team_member: full access within tenant
create policy tenant_admin_all on <table>
  using (tenant_id = (select tenant_id from profiles where id = auth.uid())
         and (select role from profiles where id = auth.uid()) in ('admin','team_member'));

-- Client: only their own rows
create policy client_own_rows on <table>
  using (client_id in (select id from clients where profile_id = auth.uid()));
```
Published-only tables (e.g. `playbook_versions` where `status='published'`) get an additional client read policy filtered on status.
