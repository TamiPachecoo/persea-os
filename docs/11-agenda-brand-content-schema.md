# Future Supabase Schema — Agenda, Brand Direction, Content Center

This documents the recommended Supabase schema for the three features added in this pass (weekly agenda, Direção da Marca, Content Center). **Nothing here is implemented yet.** Per instruction, this pass does not configure Supabase, create a live database, add credentials, or require environment variables — everything currently runs on the existing localStorage-backed `MockDB` layer in `app/shared/mock-db.js`, extended in place using the same pattern as every other feature in that file (see its header comment: "screens only ever call functions here, never touch storage directly... swapping to Supabase later = rewriting this file's internals, screens stay untouched").

**Read this alongside `docs/02-database-schema.md`**, which already covers the core schema (`tenants`, `profiles`, `clients`, journey/questionnaire/meetings/playbook/etc.) these new tables extend. Table/RLS conventions below match that doc exactly — `tenant_id` on every table, RLS enabled everywhere, the same two-policy pattern (`tenant_admin_all` / `client_own_rows`).

## ⚠️ Security note — read before connecting Supabase

The current prototype's admin/client separation is a **UI-only convention** (which HTML pages exist, which nav items show, which mock-data getter a screen calls) — it is **not a real security boundary**. Nothing today stops a client-side script from calling `MockDB.getBrandDirection('client-3')` for a student who isn't the active one; the "active client" is just a localStorage value the browser fully controls. Real student-to-student data isolation **only exists once Supabase Auth + the RLS policies below are actually connected** — this pass demonstrates the intended experience, it does not yet secure it.

## New tables

```sql
-- Weekly Agenda (Feature 1) ------------------------------------------------
agenda_items (
  id uuid pk,
  tenant_id uuid references tenants(id),
  type text check (type in (
    'class','individual_meeting','group_meeting','online_event','admin_task','deadline'
  )),
  title text,
  date timestamptz,
  status text check (status in ('upcoming','completed','rescheduled','cancelled')),
  related_student_id uuid references clients(id),   -- null for group/class/institutional items
  related_group_label text,                          -- e.g. "Q&A Mensal PERSEA" — free text, not a full groups table (see Non-Goals)
  topic text,
  prep_notes text,
  general_notes text,
  online_link text,
  follow_up_notes text,
  created_by uuid references profiles(id),
  created_at timestamptz,
  updated_at timestamptz
)
```
Mirrors `mock-db.js`'s `agendaItems` shape exactly. `related_student_id` nullable because classes/group meetings/institutional events aren't tied to one client.

**Known duplication to resolve during migration:** `clients.journey` (via the existing `client_journey_progress`/`journey_steps` concept in `02-database-schema.md`) already has a notion of "next meeting" that this prototype pass left untouched rather than refactoring every read site. When this becomes real, `journey`'s "next meeting" display should become a *query* against `agenda_items` (`where related_student_id = X and type = 'individual_meeting' order by date limit 1`), not a separately-stored field — one source of truth instead of two.

```sql
-- Direção da Marca (Feature 2) ---------------------------------------------
brand_directions (
  id uuid pk,
  tenant_id uuid references tenants(id),
  client_id uuid references clients(id) unique,   -- one row per client
  pinterest_url text,
  mood_board_intro text,                           -- Nay's message explaining how the board should guide the client
  positioning_summary text,
  keywords text[],
  tone text,
  "references" text[],                             -- quoted: reserved word in Postgres
  guidance text,
  belongs text[],
  doesnt_belong text[],
  updated_by uuid references profiles(id),
  updated_at timestamptz
)

-- Deliberately its OWN table, not a column on brand_directions — this is
-- the one field on this page a client may write, and keeping it in a
-- separate table with its own RLS UPDATE policy makes that a schema-level
-- guarantee, not just an application-layer convention.
brand_ideas (
  id uuid pk,
  tenant_id uuid references tenants(id),
  client_id uuid references clients(id) unique,   -- one row per client
  content text,
  updated_at timestamptz
)
```
One row per client (`client_id unique`) for both tables, matching how `mock-db.js` nests `brandDirection`/`brandIdeas` directly on each client record. Array columns (`keywords`, `references`, `belongs`, `doesnt_belong`) map 1:1 to the prototype's newline-separated textarea inputs — the UI layer splits/joins, the schema stores the array directly rather than a delimited string.

```sql
-- Content Center (Feature 3) ------------------------------------------------
content_resources (
  id uuid pk,
  tenant_id uuid references tenants(id),
  title text,
  description text,
  track text check (track in (
    'posicionamento','conteudo_autenticidade','comunicacao','vendas'
  )),
  phase_key text,                        -- free-text label today (e.g. "Identidade"); could FK to a
                                          -- real `programs`/`program_phases` row once those are seeded
  duration text,                         -- kept as display text ("32 min"), not an interval — matches
                                          -- how Hubla surfaces it, no real duration computation needed
  hubla_url text,                        -- NEVER seed with a real Hubla URL — admin-entered only
  recommendation text,
  general_audience boolean default true, -- true = visible to every client in the tenant
  created_at timestamptz,
  updated_at timestamptz
)

resource_assignments (
  id uuid pk,
  tenant_id uuid references tenants(id),
  resource_id uuid references content_resources(id),
  student_id uuid references clients(id),
  reason text,
  deadline date,
  related_phase_or_meeting text,
  completed boolean default false,       -- client-toggleable; the only field a client may write here
  assigned_by uuid references profiles(id),
  assigned_at timestamptz
)
```
`content_resources.track` is a fixed 4-value enum (matches `CONTENT_TRACKS` in `mock-db.js`) rather than a separate lookup table — the taxonomy is tenant methodology, not something that needs per-tenant rows in the MVP. A `resource_assignments` row layers a personal recommendation on top of a resource that may *also* be `general_audience = true` — both are independently true, matching the prototype's "general AND assigned" behavior.

## Auth roles (existing `profiles.role`, no new roles needed)

- **admin / team_member** — full read/write on all four tables, scoped to `tenant_id` (same pattern as every other table in `02-database-schema.md`).
- **client** — read-only on `agenda_items` where `related_student_id = auth.uid()`'s client row *or* `related_student_id is null` (group/class/institutional items are visible to every client in the tenant, per Feature 1's "Group meetings" and "Online events" types); read-only on their own `brand_directions` row; full read/write on their own `brand_ideas` row ("Minhas Ideias" — the one part of the Brand Direction page a client edits); read on `content_resources` where `general_audience = true` **or** a matching `resource_assignments` row exists for them; on `resource_assignments`, read their own rows and **update only the `completed` column** of their own rows — nothing else.

## RLS policies

```sql
-- agenda_items
create policy tenant_admin_all on agenda_items
  using (tenant_id = (select tenant_id from profiles where id = auth.uid())
         and (select role from profiles where id = auth.uid()) in ('admin','team_member'));

create policy client_own_or_group_agenda on agenda_items
  for select
  using (
    tenant_id = (select tenant_id from profiles where id = auth.uid())
    and (
      related_student_id in (select id from clients where profile_id = auth.uid())
      or related_student_id is null
    )
  );

-- brand_directions
create policy tenant_admin_all on brand_directions
  using (tenant_id = (select tenant_id from profiles where id = auth.uid())
         and (select role from profiles where id = auth.uid()) in ('admin','team_member'));

create policy client_own_brand_direction on brand_directions
  for select
  using (client_id in (select id from clients where profile_id = auth.uid()));

-- brand_ideas — the only client-writable table on this page
create policy tenant_admin_all on brand_ideas
  using (tenant_id = (select tenant_id from profiles where id = auth.uid())
         and (select role from profiles where id = auth.uid()) in ('admin','team_member'));

create policy client_own_ideas on brand_ideas
  for select using (client_id in (select id from clients where profile_id = auth.uid()));

create policy client_write_own_ideas on brand_ideas
  for insert with check (client_id in (select id from clients where profile_id = auth.uid()));

create policy client_update_own_ideas on brand_ideas
  for update
  using (client_id in (select id from clients where profile_id = auth.uid()))
  with check (client_id in (select id from clients where profile_id = auth.uid()));

-- content_resources
create policy tenant_admin_all on content_resources
  using (tenant_id = (select tenant_id from profiles where id = auth.uid())
         and (select role from profiles where id = auth.uid()) in ('admin','team_member'));

create policy client_read_general_or_assigned on content_resources
  for select
  using (
    tenant_id = (select tenant_id from profiles where id = auth.uid())
    and (
      general_audience = true
      or id in (
        select resource_id from resource_assignments
        where student_id in (select id from clients where profile_id = auth.uid())
      )
    )
  );

-- resource_assignments
create policy tenant_admin_all on resource_assignments
  using (tenant_id = (select tenant_id from profiles where id = auth.uid())
         and (select role from profiles where id = auth.uid()) in ('admin','team_member'));

create policy client_read_own_assignments on resource_assignments
  for select
  using (student_id in (select id from clients where profile_id = auth.uid()));

create policy client_update_own_completion on resource_assignments
  for update
  using (student_id in (select id from clients where profile_id = auth.uid()))
  with check (student_id in (select id from clients where profile_id = auth.uid()));
  -- Application layer (or a column-level grant/trigger) must further
  -- restrict this UPDATE to the `completed` column only — Postgres RLS
  -- alone doesn't do column-level enforcement.
```

## Non-goals for this schema pass (matches the app-layer non-goals)

- No dedicated `groups`/`classes` table — `agenda_items.related_group_label` and `content_resources.track`/`phase_key` stay free text/enum for now, same scope boundary the prototype itself uses.
- No Pinterest or Hubla API integration tables (webhooks, OAuth tokens, sync status) — both remain externally-hosted with Persea OS storing only the URL.
- No `journey.upcoming_meeting` refactor — flagged above as known future work, not done here.
- No migration scripts or `supabase/migrations/*.sql` files written — this document is the plan, not the implementation.
