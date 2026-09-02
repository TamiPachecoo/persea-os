# Persea OS — Supabase (Postgres) Schema Plan

**Status: design document only.** No DDL has been run against any Supabase project. This is a full normalization proposal for a human (Nay/dev) to review before any migration is written. Source of truth for this plan: `app/shared/mock-db.js` (~5,392 lines) and `app/shared/value-analysis-schema.js` (~401 lines), read in full.

Conventions used throughout:
- All synthetic primary keys are `uuid default gen_random_uuid()` unless noted.
- Every table gets a `legacy_id text` column (unique, nullable) to carry over the mock's existing string ids (`'client-1'`, `'ag6'`, `'rev1'`, …) for migration traceability and debugging — not used as the real PK/FK in the new schema, except where explicitly noted as a natural key.
- `created_at timestamptz not null default now()` / `updated_at timestamptz not null default now()` are added even where the mock didn't track them, for auditability — noted only when they map to a real mock field.
- Free text that is genuinely prose (notes, descriptions, justifications, transcript summaries) stays `text`. Anything that is a discrete fact, even if currently a string in the mock, gets its own typed column.
- Enum-like fields use `check (col in (...))` constraints mirroring the mock's exported `*_STATUSES` / vocabulary arrays exactly (values are the internal keys, not the Portuguese labels — labels belong in application i18n, not the DB, except where noted).
- Role notes describe read/write for **admin** (Nay), **assistant** (Ju/Nath — one person, two personas), **client**. These inform RLS policy design later; no policies are written here.

---

## Migration order

Create in this order so every foreign key resolves at creation time:

1. **Tenant & config** — `tenants`, `program_defs`, `encounter_defs`, `encounter_prep_checklist_items`, `program_phases`, `program_phase_activities`, `program_phase_deliverables`, `program_activities`, `program_activity_access`, `business_survey_questions`, `archetype_defs`, `archetype_quiz_questions`, `template_categories`, `template_category_groups`, `template_items`, `content_categories`, `contract_duration_pricing`, `program_pricing`
2. **Identity** — `users` (Supabase `auth.users` + `profiles`), tenant-scoped role assignment
3. **Leads / pipeline** (pre-client) — `leads`, `lead_social_links`, `lead_interactions`, `lead_commercial_terms`, `lead_registration_info`, `lead_history`
4. **Clients core** — `clients`, `client_social_links`, `client_onboarding`, `client_program_history`
5. **Contracts & Financial** — `contracts`, `payments`, `payment_invoices`, `expenses`
6. **Agenda & Encounters** — `agenda_items`, `meeting_recordings`, `encounter_requests`, `encounter_request_checklist_items`, `encounter_request_proposed_times`, `meeting_requests`
7. **Client journey & activities** — `questionnaires`, `questionnaire_questions`, `questionnaire_analyses`, `meetings`, `transcript_analyses`, `business_surveys`, `business_survey_responses`, `homework_tasks`, `homework_submissions`, `client_activity_log`, `mood_log`, `client_profile_summaries`, `client_notes`, `whatsapp_notes`, `photo_reminders`, `images`, `content_activities`
8. **Archetype quiz** — `archetype_quiz_attempts`, `archetype_quiz_responses`, `client_archetype_settings`
9. **Playbook / pitches / brand direction** — `playbooks`, `playbook_versions`, `playbook_sections`, `playbook_experiences`, `playbook_quiz_results`, `pitches`, `brand_directions`, `brand_direction_keywords`, `brand_direction_references`, `brand_direction_belongs`, `brand_direction_doesnt_belong`, `brand_ideas`, `books`, `book_chapters`, `book_chapter_paragraphs`, `book_chapter_list_items`
10. **Image guides & digital kit** — `image_guides`, `digital_kits`, `content_reviews`
11. **Business Value Assessment** — `value_assessments`, `value_assessment_answers_s1`, `value_assessment_answers_s2`, `value_assessment_answers_s3`, `value_assessment_answers_s4`, `value_assessment_answers_s5`, `value_assessment_answers_s6`, `value_offers`, `value_fixed_costs`, `value_variable_costs`, `value_references`, `value_assessment_review_status`, `value_assessment_scenarios`, `value_recommendations`, `value_published_deliverables`, `price_history`, `premium_upgrade_interests`
12. **Content & templates (runtime)** — `resources`, `resource_assignments`
13. **Reviews / cross-cutting queues** — (content_reviews already above; also) `pending_reviews` if kept generic rather than split — see note in that section
14. **Group dynamics & messaging** — `group_dynamics`, `assistant_messages`
15. **Google sync (prototype)** — `google_sync_status` (tenant-level, singleton)

---

## Identity & Roles

Supabase Auth (`auth.users`) is the base. The mock has no real auth — `profile.accessStatus` ('created' | 'pending') stands in for "has this client claimed her invite yet."

### `profiles`
One row per authenticated person (admin, assistant, and — once client login exists — client), 1:1 with `auth.users`.

| Column | Type | Null | Default | Maps to |
|---|---|---|---|---|
| id | uuid PK | no | — | `auth.users.id` (FK) |
| role | text | no | — | implicit (admin/assistant/client) |
| full_name | text | no | — | n/a (new) |
| assistant_persona | text | yes | null | `ASSISTANT_PERSONAS` ('ju'\|'nath') — only set when role='assistant' |
| client_id | uuid FK -> clients.id | yes | null | set when role='client' |
| created_at | timestamptz | no | now() | n/a |

Check: `role in ('admin','assistant','client')`. Check: `assistant_persona in ('ju','nath')` or null.

Role notes: admin manages all profiles; assistant reads own profile; client reads own profile only.

---

## Tenant Config

### `tenants`
Singleton row (one tenant today, modeled as a table for future multi-tenant).

| Column | Type | Null | Default | Maps to |
|---|---|---|---|---|
| id | uuid PK | no | gen_random_uuid() | n/a |
| name | text | no | — | `tenant.name` |
| brand_color | text | no | — | `tenant.brandColor` |
| hubla_all_content_url | text | yes | null | `tenant.hublaAllContentUrl` |
| activity_guide_pdf_url | text | yes | null | `tenant.activityGuide.pdfUrl` |
| activity_guide_version | integer | no | 1 | `tenant.activityGuide.version` |
| activity_guide_published_at | timestamptz | yes | null | `tenant.activityGuide.publishedAt` |
| created_at, updated_at | timestamptz | no | now() | n/a |

Role notes: admin read/write; assistant read-only; client reads only `activity_guide_*` and `hubla_all_content_url` via a view.

### `activity_guide_pages`
Ordered page images for the flip-book rendering of the activity guide.

| Column | Type | Null | Default | Maps to |
|---|---|---|---|---|
| id | uuid PK | no | gen_random_uuid() | n/a |
| tenant_id | uuid FK -> tenants.id | no | — | n/a |
| page_number | integer | no | — | index into `tenant.activityGuide.pages` |
| image_url | text | no | — | array element |

Unique (tenant_id, page_number). Role notes: admin write; assistant/client read.

### `google_sync_status`
Tenant-level singleton for the Google Meet/Drive prototype panel.

| Column | Type | Null | Default | Maps to |
|---|---|---|---|---|
| id | uuid PK | no | gen_random_uuid() | n/a |
| tenant_id | uuid FK -> tenants.id | no | — | n/a |
| connected_account | text | yes | null | `tenant.googleSync.connectedAccount` |
| sync_status | text | no | 'ativo' | `tenant.googleSync.syncStatus` |
| last_checked_at | timestamptz | yes | null | `.lastCheckedAt` |
| next_check_at | timestamptz | yes | null | `.nextCheckAt` |
| attempts | integer | no | 0 | `.attempts` |

Check: `sync_status in ('ativo','pausado','erro')`. Role notes: admin only (prototype panel is admin-only per comment).

---

## Program / Methodology Definitions (reference data, tenant-configurable but not per-client)

These back `PROGRAM_DEFS`, `ENCOUNTER_DEFS`, `PROGRAM_PHASES`, `PROGRAM_ACTIVITIES`, `PROGRAM_ACTIVITY_ACCESS`, `ARCHETYPE_DEFS`, `ARCHETYPE_QUIZ_QUESTIONS`, `BUSINESS_SURVEY_QUESTIONS`. They are "fixed taxonomy" today (hardcoded in JS) but normalizing them lets Nay eventually edit methodology text without a deploy — flagged as an option, not a requirement; a simpler alternative is to keep these as application constants and only normalize per-client instance data. This plan normalizes them since the user asked for full normalization; the team can choose to keep this subset as app-level constants instead.

### `program_defs`
| Column | Type | Null | Default | Maps to |
|---|---|---|---|---|
| id | uuid PK | no | gen_random_uuid() | n/a |
| slug | text | no | — (unique) | `PROGRAM_DEFS[].slug` |
| name | text | no | — | `.name` |
| duration_months | integer | yes | null | `.durationMonths` (explicitly null for ascensao-imagem — never invent) |
| display_order | integer | no | — | `.displayOrder` |
| description | text | no | — | `.description` |
| positioning | text | yes | null | `.positioning` |
| supporting_statement | text | yes | null | `.supportingStatement` |

Role notes: admin write; assistant/client read.

### `encounter_defs`
| Column | Type | Null | Default | Maps to |
|---|---|---|---|---|
| id | uuid PK | no | gen_random_uuid() | n/a |
| number | integer | no | — (unique) | `ENCOUNTER_DEFS[].number` (1-8) |
| slug | text | no | — (unique) | `.slug` ('e1'..'e8') |
| name | text | no | — | `.name` |
| phase | integer | no | — | `.phase` (0-3, FK-like to program_phases.id conceptually) |
| purpose | text | no | — | `.purpose` |
| premium_only | boolean | no | — | `.premiumOnly` |

Role notes: admin/assistant read; not client-facing directly (surfaced via derived journey views).

### `encounter_prep_checklist_items`
Normalizes `ENCOUNTER_PREP_CHECKLIST` (encounter number -> array of checklist line strings).

| Column | Type | Null | Default | Maps to |
|---|---|---|---|---|
| id | uuid PK | no | gen_random_uuid() | n/a |
| encounter_number | integer FK -> encounter_defs.number | no | — | key |
| sort_order | integer | no | — | array index |
| label | text | no | — | array item |

Role notes: admin read/write (editable per request per comment); assistant read.

### `program_phases`
| Column | Type | Null | Default | Maps to |
|---|---|---|---|---|
| id | integer PK | no | — | `PROGRAM_PHASES[].id` (0-3, natural key) |
| description | text | no | — | `.description` |

### `program_phase_activities`
Join table normalizing `clientActivitySlugs`.

| Column | Type | Null | Default | Maps to |
|---|---|---|---|---|
| id | uuid PK | no | gen_random_uuid() | n/a |
| phase_id | integer FK -> program_phases.id | no | — | key |
| activity_slug | text FK -> program_activities.slug | no | — | array item |
| sort_order | integer | no | — | array index |

Unique (phase_id, activity_slug).

### `program_phase_deliverables`
Normalizing `mentorDeliverableKeys`.

| Column | Type | Null | Default | Maps to |
|---|---|---|---|---|
| id | uuid PK | no | gen_random_uuid() | n/a |
| phase_id | integer FK -> program_phases.id | no | — | key |
| deliverable_key | text | no | — | array item (also see `MENTOR_DELIVERABLE_LABEL` keys) |
| sort_order | integer | no | — | array index |

Check: `deliverable_key in ('extraction_analysis','archetype_reading','materials_analysis','image_project','image_guides','mood_photo','positioning_direction','pitch_feedback','content_feedback','value_reading','digital_kit')`.

### `program_activities`
| Column | Type | Null | Default | Maps to |
|---|---|---|---|---|
| slug | text PK | no | — | `PROGRAM_ACTIVITIES[].slug` (natural key) |
| title | text | no | — | `.title` |
| activity_type | text | no | — | `.activityType` |
| display_order | integer | no | — | `.displayOrder` |
| description | text | no | — | `.description` |
| premium_description | text | yes | null | `.premiumDescription` |
| route | text | no | — | `.route` |

Check: `activity_type in ('questionnaire','archetype_quiz','survey','document','upload','workspace','generator')`.

### `program_activity_access`
Normalizes the `PROGRAM_ACTIVITY_ACCESS` matrix (program_slug × activity_slug -> access level).

| Column | Type | Null | Default | Maps to |
|---|---|---|---|---|
| id | uuid PK | no | gen_random_uuid() | n/a |
| program_slug | text FK -> program_defs.slug | no | — | outer key |
| activity_slug | text FK -> program_activities.slug | no | — | inner key |
| access | text | no | — | value |

Unique (program_slug, activity_slug). Check: `access in ('included','premium_preview','unavailable')`.

### `business_survey_questions`
| Column | Type | Null | Default | Maps to |
|---|---|---|---|---|
| key | text PK | no | — | `BUSINESS_SURVEY_QUESTIONS[].key` |
| label | text | no | — | `.label` |
| question_type | text | no | — | `.type` |
| placeholder | text | yes | null | `.placeholder` |
| sort_order | integer | no | — | array index |

### `archetype_defs`
| Column | Type | Null | Default | Maps to |
|---|---|---|---|---|
| slug | text PK | no | — | `ARCHETYPE_DEFS[].slug` (12 rows) |
| name | text | no | — | `.name` |
| display_order | integer | no | — | `.displayOrder` |
| central_desire | text | no | — | `.centralDesire` |
| potentials | text | no | — | `.potentials` |
| caution | text | no | — | `.caution` |
| visual_direction | text | no | — | `.visualDirection` |
| female_image_url | text | yes | null | `.femaleImage` |
| male_image_url | text | yes | null | `.maleImage` |

### `archetype_quiz_questions`
| Column | Type | Null | Default | Maps to |
|---|---|---|---|---|
| number | integer PK | no | — | `ARCHETYPE_QUIZ_QUESTIONS[].number` (1-48, natural key) |
| text | text | no | — | `.text` |
| archetype_slug | text FK -> archetype_defs.slug | no | — | derived from `ARCHETYPE_QUESTION_MAP` (reverse lookup) |
| section_index | integer | no | — | derived: `ceil(number/8)` (1-6) |

Note: `ARCHETYPE_QUIZ_VERSION` (currently 1) becomes a plain integer column referenced by attempts (see Archetype Quiz section) rather than its own table, since it's a single version counter, not a real "questionnaire version history" — flag if that changes.

### Template Library

### `template_categories`
| Column | Type | Null | Default | Maps to |
|---|---|---|---|---|
| key | text PK | no | — | `TEMPLATE_CATEGORIES[].key` |
| label | text | no | — | `.label` |
| description | text | no | — | `.description` |
| is_single | boolean | no | false | `.single` |

### `template_category_groups`
| Column | Type | Null | Default | Maps to |
|---|---|---|---|---|
| id | uuid PK | no | gen_random_uuid() | n/a |
| category_key | text FK -> template_categories.key | no | — | outer key |
| group_label | text | yes | null | `.groupLabel` |
| sort_order | integer | no | — | array index |

### `template_items`
Leaves of `TEMPLATE_CATEGORIES[].groups[].items[]`, joined with the actual editable link from `templateLibrary` seed.

| Column | Type | Null | Default | Maps to |
|---|---|---|---|---|
| id | uuid PK | no | gen_random_uuid() | n/a |
| group_id | uuid FK -> template_category_groups.id | no | — | parent |
| item_key | text | no | — | `.itemKey` |
| item_label | text | no | — | `.itemLabel` |
| url | text | yes | null | `templateLibrary[categoryKey][itemKey]` |
| sort_order | integer | no | — | array index |

Unique (group_id, item_key). Role notes: admin read/write (`admin/templates.js`); assistant read-only (`assistant/templates.js`).

### `color_seasons` / `color_season_variants` (optional sub-normalization)
Since `COLOR_SEASONS`/`COLOR_SEASON_VARIANTS`/`COLOR_VARIANT_LABEL` only exist to generate `template_items` rows for `cartelaCores`, they don't need their own runtime tables — they're a one-time seeding recipe, not queried independently. Documented here so the seed script for `template_items` has a source, but **no table** is proposed for these three consts.

### Contract & Pricing config

### `contract_duration_pricing`
Normalizes `CONTRACT_DURATIONS` + `CONTRACT_DURATION_VALUE`.

| Column | Type | Null | Default | Maps to |
|---|---|---|---|---|
| duration | text PK | no | — | `CONTRACT_DURATIONS` ('semestral'\|'anual') |
| value_cents | integer | no | — | `CONTRACT_DURATION_VALUE[duration]` (store cents to avoid float issues; mock stores whole reais, e.g. 18000 = R$18.000) |

Role notes: admin read/write (tenant pricing, per comment "not client data").

### `program_pricing`
Normalizes `PROGRAMS` + `PROGRAM_VALUE` (only ascensao_imagem has a fixed price today).

| Column | Type | Null | Default | Maps to |
|---|---|---|---|---|
| program | text PK | no | — | `PROGRAMS` ('ascensao_imagem'\|'persea') |
| value_cents | integer | yes | null | `PROGRAM_VALUE[program]` |

### Content Center gateway

### `content_categories`
| Column | Type | Null | Default | Maps to |
|---|---|---|---|---|
| id | uuid PK | no | gen_random_uuid() | `contentCategories[].id` (legacy_id) |
| title | text | no | — | `.title` |
| description | text | no | — | `.description` |
| cover_image_url | text | yes | null | `.coverImage` |
| cover_tone | integer | no | — | `.coverTone` (0..CONTENT_CATEGORY_TONES-1) |
| hubla_url | text | yes | '' | `.hublaUrl` |
| display_order | integer | no | — | `.displayOrder` |
| is_visible | boolean | no | true | `.isVisible` |
| created_at, updated_at | timestamptz | no | now() | `.createdAt/.updatedAt` |

Role notes: admin read/write; assistant/client read (client sees only `is_visible=true`).

---

## Leads & CRM Pipeline

### `leads`
| Column | Type | Null | Default | Maps to |
|---|---|---|---|---|
| id | uuid PK | no | gen_random_uuid() | `leads[].id` (legacy_id) |
| full_name | text | no | — | `.fullName` |
| email | text | yes | null | `.email` |
| phone | text | yes | null | `.phone` |
| source | text | no | — | `.source` |
| vip_group_status | text | no | — | `.vipGroupStatus` |
| stage | text | no | 'novo' | `.stage` |
| interested_program | text | yes | null | `.interestedProgram` (legacy 'persea'/'ascensao_imagem' vocabulary, distinct from `program` below) |
| notes | text | yes | '' | `.notes` |
| converted_to_client_id | uuid FK -> clients.id | yes | null | `.convertedToClientId` |
| converted_at | timestamptz | yes | null | `.convertedAt` |
| program | text | yes | null | `.program` (post-sale program slug, e.g. 'persea-essential') |
| onboarding_status | text | yes | null | `.onboardingStatus` |
| registration_token | text | yes | null (unique) | `.registrationToken` |
| registration_sent_at | timestamptz | yes | null | `.registrationSentAt` |
| registration_completed_at | timestamptz | yes | null | `.registrationCompletedAt` |
| contract_status | text | yes | null | `.contractStatus` |
| signed_file_name | text | yes | null | `.signedFileName` |
| created_at, updated_at | timestamptz | no | now() | `.createdAt/.updatedAt` |

Check: `source in ('vip_group','referral','organic','other')`. Check: `vip_group_status in ('not_in_group','in_group','left_group')`. Check: `stage in ('novo','engajado','em_conversa','proposta_enviada','convertido','perdido')`. Check: `onboarding_status in ('sale_agreed','registration_sent','registration_completed','in_contract','ready_for_activation','client_active')` or null. Check: `contract_status in ('info_pending','info_received','contract_prepared','sent_for_signature','awaiting_signature','signed','completed')` or null (reuses `ONBOARDING_STAGES` vocabulary verbatim, per the mock's own comment that this is deliberate, not a duplicate enum).

Role notes: admin read/write full; assistant read/write (contract-prep + activation fields) once `registration_completed_at` is set; client never reads this table directly (client-facing registration goes through `getLeadByToken`, which should become a `security definer` RPC or public view exposing only `full_name`/`program`/`registration_info`/`already_submitted`, never full row access).

### `lead_social_links`
1:1 with leads, same shape as `client_social_links` (see below) — split out because leads and clients both use `BLANK_SOCIAL_LINKS`.

| Column | Type | Null | Default | Maps to |
|---|---|---|---|---|
| lead_id | uuid PK, FK -> leads.id | no | — | key |
| platform | text | no | — | `SOCIAL_PLATFORMS` |
| url | text | yes | '' | value |

Composite PK (lead_id, platform). Check: `platform in ('instagram','tiktok','linkedin','facebook')`.

### `lead_interactions`
| Column | Type | Null | Default | Maps to |
|---|---|---|---|---|
| id | uuid PK | no | gen_random_uuid() | `lead.interactions[].id` |
| lead_id | uuid FK -> leads.id | no | — | parent |
| occurred_at | timestamptz | no | — | `.date` |
| summary | text | no | — | `.summary` |

Role notes: admin/assistant read/write.

### `lead_commercial_terms`
1:1 with lead (the terms agreed at `agreeSale`).

| Column | Type | Null | Default | Maps to |
|---|---|---|---|---|
| lead_id | uuid PK, FK -> leads.id | no | — | parent |
| payment_method | text | yes | null | `.commercialTerms.paymentMethod` (first of array) |
| installments | integer | yes | null | `.installments` |
| agreed_amount_cents | integer | yes | null | `.agreedAmount` |
| first_due_date | date | yes | null | `.firstDueDate` |
| commercial_notes | text | yes | '' | `.commercialNotes` |
| responsible_id | uuid FK -> profiles.id | yes | null | `.responsibleId` |
| sale_agreed_at | timestamptz | yes | null | `.saleAgreedAt` |

### `lead_commercial_payment_methods`
Normalizes the `paymentMethods` array (a lead can pay via more than one method).

| Column | Type | Null | Default | Maps to |
|---|---|---|---|---|
| lead_id | uuid FK -> leads.id | no | — | parent |
| payment_method | text | no | — | array item |

Composite PK (lead_id, payment_method). Check: `payment_method in ('cartao_credito','boleto','pix','transferencia')`.

### `lead_registration_info`
1:1 with lead — the Nova Persea registration form (`blankRegistrationInfo` shape).

| Column | Type | Null | Default | Maps to |
|---|---|---|---|---|
| lead_id | uuid PK, FK -> leads.id | no | — | parent |
| submitted | boolean | no | false | `.submitted` |
| full_name | text | yes | '' | `.fullName` |
| social_name | text | yes | '' | `.socialName` |
| birth_date | date | yes | null | `.birthDate` |
| party_type | text | no | 'PF' | `.partyType` |
| cpf | text | yes | '' | `.cpf` |
| rg | text | yes | '' | `.rg` |
| profession | text | yes | '' | `.profession` |
| nationality | text | yes | '' | `.nationality` |
| marital_status | text | yes | '' | `.maritalStatus` |
| cnpj | text | yes | null | `.cnpj` |
| company_name | text | yes | null | `.companyName` |
| email | text | yes | '' | `.email` |
| whatsapp | text | yes | '' | `.whatsapp` |
| cep | text | yes | '' | `.cep` |
| street | text | yes | '' | `.street` |
| number | text | yes | '' | `.number` |
| complement | text | yes | '' | `.complement` |
| neighborhood | text | yes | '' | `.neighborhood` |
| city | text | yes | '' | `.city` |
| state | text | yes | '' | `.state` |

Check: `party_type in ('PF','PJ')`. Role notes: client (public, token-gated) writes via RPC only; admin/assistant read.

### `lead_history`
Append-only timeline (`lead.history[]`).

| Column | Type | Null | Default | Maps to |
|---|---|---|---|---|
| id | uuid PK | no | gen_random_uuid() | n/a |
| lead_id | uuid FK -> leads.id | no | — | parent |
| event_type | text | no | — | `.type` |
| text | text | no | — | `.text` |
| occurred_at | timestamptz | no | — | `.at` |

Role notes: admin/assistant read (system-written via `logLeadHistory`, never user-edited).

---

## Clients & Leads Core

### `clients`
The heart of the schema — one row per active/onboarding client.

| Column | Type | Null | Default | Maps to |
|---|---|---|---|---|
| id | uuid PK | no | gen_random_uuid() | `profile.id` (legacy_id, e.g. 'client-1') |
| full_name | text | no | — | `profile.fullName` |
| email | text | yes | null | `profile.email` |
| status | text | no | — | `profile.status` |
| tier | text | no | — | `profile.tier` |
| phase_index | integer | no | 0 | `profile.phaseIndex` |
| program_slug | text FK -> program_defs.slug | no | — | `profile.programSlug` |
| gender | text | yes | null | `profile.gender` |
| access_status | text | no | 'created' | `profile.accessStatus` |
| photo_url | text | yes | null | `c.photoUrl` |
| notes | text | yes | '' | `c.notes` (Nay's private notepad) |
| brand_ideas | text | yes | '' | `c.brandIdeas` ("Minhas Ideias") |
| guide_acknowledged | boolean | no | false | `c.guideAcknowledged` |
| image_project_status | text | no | 'not_started' | `c.imageProjectStatus` |
| images_status | text | no | 'aguardando_envio' | `c.imagesStatus` |
| images_note | text | yes | '' | `c.imagesNote` |
| personal_playbook_url | text | yes | null | `c.personalPlaybookUrl` |
| personal_playbook_delivered_at | timestamptz | yes | null | `c.personalPlaybookDeliveredAt` |
| business_playbook_url | text | yes | null | `c.businessPlaybookUrl` |
| business_playbook_delivered_at | timestamptz | yes | null | `c.businessPlaybookDeliveredAt` |
| hubla_access_status | text | no | 'not_granted' | `c.hublaAccess.status` |
| hubla_access_granted_at | timestamptz | yes | null | `c.hublaAccess.grantedAt` |
| created_at, updated_at | timestamptz | no | now() | n/a |

Check: `status in ('active','onboarding')` (values observed; extend as needed). Check: `tier in ('premium','essential')`. Check: `gender in ('feminino','masculino')` or null. Check: `access_status in ('created','pending')`. Check: `image_project_status in ('not_started','created')`. Check: `images_status in ('aguardando_envio','envio_iniciado','enviado','em_analise','novas_solicitadas','aprovado')` (`IMAGE_STATUSES`).

Role notes: admin full read/write; assistant read all, write onboarding/operational fields (not `notes` — Nay's private notepad per comment "never shown to assistant" is implied by UI separation, confirm before finalizing RLS); client reads own row only (subset of columns — never `notes`).

### `client_social_links`
Same shape as `lead_social_links`.

| Column | Type | Null | Default | Maps to |
|---|---|---|---|---|
| client_id | uuid FK -> clients.id | no | — | key |
| platform | text | no | — | `SOCIAL_PLATFORMS` |
| url | text | yes | '' | value |

Composite PK (client_id, platform). Check: `platform in ('instagram','tiktok','linkedin','facebook')`.

### `client_program_history`
Append-only (`programHistory[]`).

| Column | Type | Null | Default | Maps to |
|---|---|---|---|---|
| id | uuid PK | no | gen_random_uuid() | n/a |
| client_id | uuid FK -> clients.id | no | — | parent |
| program_slug | text FK -> program_defs.slug | no | — | `.programSlug` |
| changed_at | timestamptz | yes | null | `.changedAt` |
| changed_by | text | no | — | `.changedBy` ('seed'\|'nay'\|'lead_conversion') |

Role notes: admin write (via `upgradeClientProgram`); admin/assistant read; drives `getSuccessMetrics` upsell reporting.

### `photo_reminders`
1:1 with client.

| Column | Type | Null | Default | Maps to |
|---|---|---|---|---|
| client_id | uuid PK, FK -> clients.id | no | — | parent |
| sent_at | timestamptz | yes | null | `.sentAt` |
| note | text | yes | '' | `.note` |

Role notes: assistant write; client read (banner).

### `whatsapp_notes`
Internal assistant log per client, never client-visible.

| Column | Type | Null | Default | Maps to |
|---|---|---|---|---|
| id | uuid PK | no | gen_random_uuid() | `.id` |
| client_id | uuid FK -> clients.id | no | — | parent |
| text | text | no | — | `.text` |
| created_at | timestamptz | no | — | `.at` |

Role notes: admin/assistant read/write; client: no access.

### `client_profile_summaries`
1:1 — the WHO/WHAT/WHY/HOW filled in by Nay from E1/E2.

| Column | Type | Null | Default | Maps to |
|---|---|---|---|---|
| client_id | uuid PK, FK -> clients.id | no | — | parent |
| who | text | yes | '' | `summary.who` |
| what | text | yes | '' | `summary.what` |
| why | text | yes | '' | `summary.why` |
| how | text | yes | '' | `summary.how` |

Role notes: admin write; assistant/client read.

---

## Onboarding & Contracts

### `client_onboarding`
1:1 with client — the pre-Phase-1 workflow state (`onboarding.clientInfo` + `onboarding.whatsappGroup`; `onboarding.contract` is split into `contracts` below since it's really a distinct entity with its own lifecycle and payment plan).

| Column | Type | Null | Default | Maps to |
|---|---|---|---|---|
| client_id | uuid PK, FK -> clients.id | no | — | parent |
| info_submitted | boolean | no | false | `clientInfo.submitted` |
| full_name | text | yes | '' | `clientInfo.fullName` |
| party_type | text | no | 'PF' | `clientInfo.partyType` |
| cpf | text | yes | '' | `clientInfo.cpf` |
| cnpj | text | yes | null | `clientInfo.cnpj` |
| company_name | text | yes | null | `clientInfo.companyName` |
| address | text | yes | '' | `clientInfo.address` |
| email | text | yes | '' | `clientInfo.email` |
| whatsapp | text | yes | '' | `clientInfo.whatsapp` |
| whatsapp_group_status | text | no | 'not_added' | `whatsappGroup.status` |

Check: `party_type in ('PF','PJ')`. Check: `whatsapp_group_status in ('not_added','pending','added')` (`WHATSAPP_STATUSES`).

Role notes: client writes `clientInfo.*` once (via `saveClientInfo`); admin/assistant read/write all; assistant flips `whatsapp_group_status`.

Note: the mock's `clientInfo` fields largely duplicate `lead_registration_info` structurally (a known convergence the mock comments call out explicitly — "same field names… nothing downstream breaks"). Kept as two tables since a lead and a client are different lifecycle stages with different access rules, but flagging the duplication for awareness.

### `contracts`
Splits `onboarding.contract` into its own entity — a client's one active contract (the mock only ever has one per client, but modeling it as its own table makes the 1:1 relationship explicit and leaves room for contract history/renewal later).

| Column | Type | Null | Default | Maps to |
|---|---|---|---|---|
| id | uuid PK | no | gen_random_uuid() | n/a |
| client_id | uuid FK -> clients.id | no | — (unique) | parent |
| program | text | yes | null | `contract.program` ('ascensao_imagem'\|'persea') |
| duration | text | yes | null | `contract.duration` |
| status | text | no | 'info_pending' | `contract.status` |
| value_cents | integer | yes | null | `contract.value` |
| signed_file_name | text | yes | null | `contract.signedFileName` |
| notes | text | yes | '' | `contract.notes` |
| payment_method | text | yes | null | `contract.paymentMethod` |
| installments | integer | yes | null | `contract.installments` |
| created_at, updated_at | timestamptz | no | now() | n/a |

Check: `program in ('ascensao_imagem','persea')` or null. Check: `duration in ('semestral','anual')` or null. Check: `status in ('info_pending','info_received','contract_prepared','sent_for_signature','awaiting_signature','signed','completed')` (`ONBOARDING_STAGES`). Check: `payment_method in ('cartao_credito','boleto','pix','transferencia')` or null.

### `contract_payment_methods`
Normalizes the `paymentMethods` array carried onto the contract at activation (`activateLead`).

| Column | Type | Null | Default | Maps to |
|---|---|---|---|---|
| contract_id | uuid FK -> contracts.id | no | — | parent |
| payment_method | text | no | — | array item |

Composite PK (contract_id, payment_method).

Role notes for contracts: admin read/write full lifecycle; assistant advances `status` and uploads signed file; client sees status label + can trigger `uploadSignedContract` flow if self-serve is ever enabled (currently admin/assistant-only per the app).

---

## Financial

### `payments`
| Column | Type | Null | Default | Maps to |
|---|---|---|---|---|
| id | uuid PK | no | gen_random_uuid() | `payments[].id` (legacy_id, e.g. 'p1-1') |
| client_id | uuid FK -> clients.id | no | — | parent |
| due_date | date | no | — | `.dueDate` |
| amount_cents | integer | no | — | `.amount` |
| status | text | no | 'pending' | `.status` |
| paid_at | timestamptz | yes | null | `.paidAt` |
| sumup_link_url | text | yes | null | `.sumupLinkUrl` |
| link_sent_at | timestamptz | yes | null | `.linkSentAt` |
| reported_paid_at | timestamptz | yes | null | `.reportedPaidAt` |

Check: `status in ('paid','pending','overdue')` (`PAYMENT_STATUSES`).

Role notes: admin marks paid (`markPaymentPaid` — the one authoritative action); assistant sends links + reports receipt (two-step confirmation is deliberate per comment, never auto-paid); client sees own payments + pays externally.

### `payment_invoices` (Nota Fiscal)
1:1 with payment — split out since it's a distinct sub-entity with its own status lifecycle (`payment.nf`), not because the mock treats it as separate storage (it doesn't — comment explicitly says "same source-of-truth-per-fact convention," i.e. lives on the payment). Modeled as its own table here purely for normalization (avoiding embedding a second status/date/file triple as loose columns on `payments`); a 1:1 table is equivalent to embedding but keeps `payments` narrower.

| Column | Type | Null | Default | Maps to |
|---|---|---|---|---|
| payment_id | uuid PK, FK -> payments.id | no | — | parent |
| status | text | no | 'not_requested' | `nf.status` |
| requested_at | timestamptz | yes | null | `nf.requestedAt` |
| issued_at | timestamptz | yes | null | `nf.issuedAt` |
| file_name | text | yes | null | `nf.fileName` |
| file_url | text | yes | null | `nf.fileUrl` |

Check: `status in ('not_requested','requested','issued')` (`NF_STATUSES`).

Role notes: client requests (`requestInvoice`); assistant/admin issue.

### `expenses`
Business-wide, not client-attributable.

| Column | Type | Null | Default | Maps to |
|---|---|---|---|---|
| id | uuid PK | no | gen_random_uuid() | `.id` (legacy_id) |
| expense_date | date | no | — | `.date` |
| category | text | no | — | `.category` |
| description | text | no | — | `.description` |
| amount_cents | integer | no | — | `.amount` |

Check: `category in ('ferramentas','marketing','equipe','outros')` (`EXPENSE_CATEGORIES`).

Role notes: admin only.

---

## Agenda & Encounters

### `agenda_items`
Nay's operational calendar — tenant-level, not strictly per-client (group/class items have `related_student_id` null).

| Column | Type | Null | Default | Maps to |
|---|---|---|---|---|
| id | uuid PK | no | gen_random_uuid() | `.id` (legacy_id, e.g. 'ag6') |
| type | text | no | — | `.type` |
| title | text | no | — | `.title` |
| item_date | timestamptz | no | — | `.date` |
| status | text | no | 'upcoming' | `.status` |
| related_student_id | uuid FK -> clients.id | yes | null | `.relatedStudentId` |
| related_group_label | text | yes | null | `.relatedGroupLabel` |
| topic | text | yes | '' | `.topic` |
| prep_notes | text | yes | '' | `.prepNotes` |
| general_notes | text | yes | '' | `.generalNotes` |
| online_link | text | yes | '' | `.onlineLink` |
| follow_up_notes | text | yes | '' | `.followUpNotes` |
| duration_minutes | integer | yes | null | `.durationMinutes` |
| assigned_to | text | yes | null | `.assignedTo` ('nay'\|'assistant') |
| assistant_persona | text | yes | null | `.assistantPersona` |
| source_key | text | yes | null (unique) | `.sourceKey` (dedupe key for system-generated items) |
| assignee_notes | text | yes | null | `.assigneeNotes` |
| created_at, updated_at | timestamptz | no | now() | `.createdAt/.updatedAt` |

Check: `type in ('class','individual_meeting','checkpoint','group_meeting','online_event','admin_task','deadline','photo_review')` (`AGENDA_TYPES`). Check: `status in ('upcoming','completed','rescheduled','cancelled')` (`AGENDA_STATUSES`). Check: `assigned_to in ('nay','assistant')` or null. Check: `assistant_persona in ('ju','nath')` or null.

Role notes: admin full read/write; assistant reads all, writes items `assigned_to='assistant'` plus creates admin_task items; client reads only own (`related_student_id = self`) individual meetings/checkpoints, read-only.

### `meeting_recordings`
1:1 with an `agenda_items` row of type `individual_meeting` (`item.recording`). Prototype-only per comment, no real Google integration yet.

| Column | Type | Null | Default | Maps to |
|---|---|---|---|---|
| agenda_item_id | uuid PK, FK -> agenda_items.id | no | — | parent |
| recording_status | text | no | 'aguardando' | `.recordingStatus` |
| transcript_status | text | no | 'nao_aplicavel' | `.transcriptStatus` |
| recording_url | text | yes | null | `.recordingUrl` |
| transcript_url | text | yes | null | `.transcriptUrl` |
| requires_attention | boolean | no | false | `.requiresAttention` |
| attention_note | text | yes | '' | `.attentionNote` |
| sync_last_checked_at | timestamptz | yes | null | `.sync.lastCheckedAt` |
| sync_next_check_at | timestamptz | yes | null | `.sync.nextCheckAt` |
| sync_google_account | text | yes | null | `.sync.googleAccount` |
| sync_status | text | no | 'aguardando' | `.sync.syncStatus` |
| sync_attempts | integer | no | 0 | `.sync.attempts` |

Check: `recording_status in ('aguardando','processando','disponivel','sem_gravacao','erro')` (`RECORDING_STATUSES`). Check: `transcript_status in ('aguardando','disponivel','nao_aplicavel','erro')` (`TRANSCRIPT_STATUSES`).

Role notes: admin/assistant write (assistant limited to `flagMeetingForAttention`); client reads own meeting's recording/transcript URLs once available.

### `encounter_requests`
Nay's E1-E8 scheduling proposal/negotiation flow, distinct from the confirmed `agenda_items` row it eventually produces.

| Column | Type | Null | Default | Maps to |
|---|---|---|---|---|
| id | uuid PK | no | gen_random_uuid() | `.id` (legacy_id) |
| client_id | uuid FK -> clients.id | no | — | `.clientId` |
| encounter_number | integer FK -> encounter_defs.number | no | — | `.encounterNumber` |
| status | text | no | 'awaiting_client_response' | `.status` |
| selected_time | timestamptz | yes | null | `.selectedTime` |
| client_note | text | yes | null | `.clientNote` |
| requested_at | timestamptz | no | — | `.requestedAt` |
| responded_at | timestamptz | yes | null | `.respondedAt` |
| confirmed_agenda_item_id | uuid FK -> agenda_items.id | yes | null | `.confirmedAgendaItemId` |

Check: `status in ('awaiting_client_response','awaiting_nay_confirmation','client_unavailable','confirmed','cancelled')`.

Role notes: admin creates/confirms; client selects a time or declines; assistant read-only (visibility, not action, per current app).

### `encounter_request_checklist_items`
Normalizes the per-request editable checklist (`checklist: [{label, done}]`).

| Column | Type | Null | Default | Maps to |
|---|---|---|---|---|
| id | uuid PK | no | gen_random_uuid() | n/a |
| encounter_request_id | uuid FK -> encounter_requests.id | no | — | parent |
| label | text | no | — | `.label` |
| done | boolean | no | false | `.done` |
| sort_order | integer | no | — | array index |

### `encounter_request_proposed_times`
Normalizes `proposedTimes: string[]` (an array of ISO candidate times, replaced wholesale on re-propose).

| Column | Type | Null | Default | Maps to |
|---|---|---|---|---|
| id | uuid PK | no | gen_random_uuid() | n/a |
| encounter_request_id | uuid FK -> encounter_requests.id | no | — | parent |
| proposed_time | timestamptz | no | — | array item |
| sort_order | integer | no | — | array index |

### `meeting_requests`
Client-initiated "I need to talk to someone" ad-hoc requests — distinct from `encounter_requests` (which are Nay-initiated E1-E8 scheduling).

| Column | Type | Null | Default | Maps to |
|---|---|---|---|---|
| id | uuid PK | no | gen_random_uuid() | `.id` (legacy_id) |
| client_id | uuid FK -> clients.id | no | — | parent |
| reason | text | no | — | `.reason` |
| status | text | no | 'pending' | `.status` |
| assigned_to | text | yes | null | `.assignedTo` |
| created_at | timestamptz | no | — | `.createdAt` |

Check: `status in ('pending','assigned','done')`. Check: `assigned_to in ('nay','assistant')` or null.

Role notes: client creates; admin/assistant read/assign/resolve.

---

## Client Journey & Activities

### `questionnaires`
The "Extração de Marca" instance per client (title/status are per-client but questions are shared text seeded per client — modeled as an instance with its own questions, since answers are per-client and questions in the mock are literally duplicated per client rather than referencing a shared question bank; a future pass could add a `questionnaire_templates` layer).

| Column | Type | Null | Default | Maps to |
|---|---|---|---|---|
| id | uuid PK | no | gen_random_uuid() | n/a |
| client_id | uuid FK -> clients.id | no | — (unique) | parent |
| title | text | no | 'Extração de Marca' | `.title` |
| status | text | no | 'not_started' | `.status` |

Check: `status in ('not_started','in_progress','submitted')`.

### `questionnaire_questions`
| Column | Type | Null | Default | Maps to |
|---|---|---|---|---|
| id | uuid PK | no | gen_random_uuid() | `.id` (legacy_id, e.g. 'q1') |
| questionnaire_id | uuid FK -> questionnaires.id | no | — | parent |
| question_text | text | no | — | `.text` |
| question_type | text | no | — | `.type` |
| answer | text | yes | '' | `.answer` |
| sort_order | integer | no | — | array index |

Check: `question_type in ('long_text','scale')`.

Role notes: client writes own answers + submits; admin/assistant read.

### `questionnaire_analyses`
AI-generated (in the prototype, canned) analysis — versioned in place (mock increments `version` on regenerate rather than keeping history; modeled as append-only here for auditability, with a `is_current` flag, since "AI regenerated this" is exactly the kind of thing worth keeping history of even though the mock doesn't).

| Column | Type | Null | Default | Maps to |
|---|---|---|---|---|
| id | uuid PK | no | gen_random_uuid() | n/a |
| client_id | uuid FK -> clients.id | no | — | parent |
| version | integer | no | — | `.version` |
| generated_at | timestamptz | yes | null | `.generatedAt` |
| executive_summary | text | no | — | `.executiveSummary` |
| business_maturity | text | yes | '—' | `.businessMaturity` |
| is_current | boolean | no | true | derived (latest version) |

### `questionnaire_analysis_items`
Normalizes the four parallel string arrays (`strengths`, `goals`, `painPoints`, `opportunities`, `suggestedQuestions`) into one typed table.

| Column | Type | Null | Default | Maps to |
|---|---|---|---|---|
| id | uuid PK | no | gen_random_uuid() | n/a |
| analysis_id | uuid FK -> questionnaire_analyses.id | no | — | parent |
| item_kind | text | no | — | which array it came from |
| text | text | no | — | array item |
| sort_order | integer | no | — | array index |

Check: `item_kind in ('strength','goal','pain_point','opportunity','suggested_question')`.

Role notes for both: system-generated (admin can trigger `regenerateQuestionnaireAnalysis`); admin/assistant read; client: no access (internal analysis, per app structure — confirm before RLS).

### `meetings`
The "current/most relevant meeting" legacy stub (`c.meeting` — title/transcriptUploaded/status). Distinct from `agenda_items` (which is the real calendar) — the mock keeps this as a separate, simpler field for the transcript-upload flow tied to `analyzeTranscript`. Kept as its own table but flagged: this looks like it should eventually just be `agenda_items` + `transcript_analyses` joined by `agenda_item_id`, since the "meeting" here really is one of the individual_meeting agenda items. Recommend collapsing at migration time by adding an optional `agenda_item_id` FK; modeled minimally below to match current mock shape.

| Column | Type | Null | Default | Maps to |
|---|---|---|---|---|
| id | uuid PK | no | gen_random_uuid() | n/a |
| client_id | uuid FK -> clients.id | no | — (unique) | parent |
| title | text | no | — | `.title` |
| transcript_uploaded | boolean | no | false | `.transcriptUploaded` |
| status | text | no | 'scheduled' | `.status` |

Check: `status in ('scheduled','transcript_uploaded','analyzed')`.

### `transcript_analyses`
1:1 with `meetings` (mirrors `questionnaire_analyses` shape).

| Column | Type | Null | Default | Maps to |
|---|---|---|---|---|
| id | uuid PK | no | gen_random_uuid() | n/a |
| meeting_id | uuid FK -> meetings.id | no | — (unique) | parent |
| version | integer | no | 1 | `.version` |
| summary | text | no | — | `.summary` |

### `transcript_analysis_items`
Normalizes `goals`, `challenges`, `actionItems`, `homework`, `keyInsights` arrays.

| Column | Type | Null | Default | Maps to |
|---|---|---|---|---|
| id | uuid PK | no | gen_random_uuid() | n/a |
| analysis_id | uuid FK -> transcript_analyses.id | no | — | parent |
| item_kind | text | no | — | which array |
| text | text | no | — | array item |
| sort_order | integer | no | — | array index |

Check: `item_kind in ('goal','challenge','action_item','homework','key_insight')`.

Role notes (meetings/transcript_analyses): admin triggers upload/analyze; admin/assistant read; client: no access (internal).

### `business_surveys`
E2's short pricing survey (`c.businessSurvey`).

| Column | Type | Null | Default | Maps to |
|---|---|---|---|---|
| client_id | uuid PK, FK -> clients.id | no | — | parent |
| status | text | no | 'not_started' | `.status` |
| submitted_at | timestamptz | yes | null | `.submittedAt` |

Check: `status in ('not_started','submitted')`.

### `business_survey_responses`
| Column | Type | Null | Default | Maps to |
|---|---|---|---|---|
| client_id | uuid FK -> business_surveys.client_id | no | — | parent |
| question_key | text FK -> business_survey_questions.key | no | — | key |
| response | text | yes | null | value |

Composite PK (client_id, question_key). Role notes: client writes/submits; admin/assistant read.

### `homework_tasks`
| Column | Type | Null | Default | Maps to |
|---|---|---|---|---|
| id | uuid PK | no | gen_random_uuid() | `.id` (legacy_id, e.g. 'h1') |
| client_id | uuid FK -> clients.id | no | — | parent |
| title | text | no | — | `.title` |
| task_type | text | no | — | `.type` |
| status | text | no | 'pending' | `.status` |
| submission_text | text | yes | '' | `.submission` (for `text_submission` type) |
| sort_order | integer | no | — | seed order |

Check: `task_type in ('boolean','media_upload','text_submission')`. Check: `status in ('pending','completed')`.

### `homework_submissions`
Media submissions for `media_upload` tasks (pitch practice recordings).

| Column | Type | Null | Default | Maps to |
|---|---|---|---|---|
| id | uuid PK | no | gen_random_uuid() | `.id` (legacy_id, e.g. 'm1') |
| homework_task_id | uuid FK -> homework_tasks.id | no | — | parent |
| kind | text | no | — | `.kind` |
| file_name | text | no | — | `.name` |
| file_url | text | yes | null | `.url` (Supabase Storage URL in real build) |
| uploaded_at | timestamptz | no | — | `.uploadedAt` |

Check: `kind in ('audio','video')`.

Role notes (homework): client writes own; admin/assistant read (used in client-context bundle).

### `client_activity_log`
Append-only feed (`c.activity[]`) — every client screen's "recent activity."

| Column | Type | Null | Default | Maps to |
|---|---|---|---|---|
| id | uuid PK | no | gen_random_uuid() | n/a |
| client_id | uuid FK -> clients.id | no | — | parent |
| event_type | text | no | — | `.type` |
| text | text | no | — | `.text` |
| occurred_at | timestamptz | no | — | `.at` |

Role notes: system-written (via `logActivity`, called from dozens of mutations); admin/assistant/client all read (client sees own, filtered to a curated allowlist per `getRecentProgressTimeline` for the Painel — full log stays on `activity.html`).

### `mood_log`
| Column | Type | Null | Default | Maps to |
|---|---|---|---|---|
| id | uuid PK | no | gen_random_uuid() | n/a |
| client_id | uuid FK -> clients.id | no | — | parent |
| context | text | no | — | `.context` |
| mood | smallint | no | — | `.mood` (1-5) |
| occurred_at | timestamptz | no | — | `.at` |

Check: `mood between 1 and 5`. Role notes: system-written on key client actions; admin reads aggregate stats only (`getGlobalMoodStats`/`getMoodStats`) — never expected to be a per-entry admin UI per current app, but no technical restriction needed beyond RLS scoping to admin/assistant read, client: own only.

### `content_activities`
1:1 with client — the in-program "Conteúdo" workspace activity (distinct from the Content Center/`resources` gateway).

| Column | Type | Null | Default | Maps to |
|---|---|---|---|---|
| client_id | uuid PK, FK -> clients.id | no | — | parent |
| status | text | no | 'not_started' | `.status` |
| submission | text | yes | '' | `.submission` |
| feedback | text | yes | '' | `.feedback` |
| updated_at | timestamptz | yes | null | `.updatedAt` |

Check: `status in ('not_started','in_progress','submitted','feedback_available','completed')`.

Role notes: client writes `submission`; admin/assistant write `feedback`.

### `images`
Client-uploaded photos for the initial images / wardrobe / facial analysis flow.

| Column | Type | Null | Default | Maps to |
|---|---|---|---|---|
| id | uuid PK | no | gen_random_uuid() | `.id` (legacy_id) |
| client_id | uuid FK -> clients.id | no | — | parent |
| file_name | text | yes | null | `.fileName` |
| file_url | text | yes | null | `.dataUrl` (becomes a real Storage URL) |
| uploaded_at | timestamptz | no | — | `.uploadedAt` |

Role notes: client writes/deletes own; admin/assistant read + drive `images_status` transitions on `clients`.

---

## Archetype Quiz

### `archetype_quiz_attempts`
| Column | Type | Null | Default | Maps to |
|---|---|---|---|---|
| id | uuid PK | no | gen_random_uuid() | `.id` (legacy_id, e.g. 'aq1') |
| client_id | uuid FK -> clients.id | no | — | parent |
| quiz_version | integer | no | 1 | `.quizVersion` |
| status | text | no | 'in_progress' | `.status` |
| started_at | timestamptz | no | — | `.startedAt` |
| completed_at | timestamptz | yes | null | `.completedAt` |
| activity_logged | boolean | no | false | `.activityLogged` |

Check: `status in ('not_started','in_progress','completed')` (`ARCHETYPE_ATTEMPT_STATUSES`).

### `archetype_quiz_responses`
Normalizes the `responses: {questionNumber: score}` map.

| Column | Type | Null | Default | Maps to |
|---|---|---|---|---|
| attempt_id | uuid FK -> archetype_quiz_attempts.id | no | — | parent |
| question_number | integer FK -> archetype_quiz_questions.number | no | — | key |
| score | smallint | no | — | value |

Composite PK (attempt_id, question_number). Check: `score between 1 and 5` (validated server-side per mock comment — "the actual trust boundary").

### `client_archetype_settings`
1:1 with client — visual set + Nay's interpretive notes, independent of any one attempt.

| Column | Type | Null | Default | Maps to |
|---|---|---|---|---|
| client_id | uuid PK, FK -> clients.id | no | — | parent |
| visual_set | text | yes | null | `archetypeQuiz.visualSet` |
| notes | text | yes | '' | `archetypeQuiz.notes` |

Check: `visual_set in ('female','male')` or null (`ARCHETYPE_VISUAL_SETS`).

Role notes (all three archetype tables): client writes own responses + starts/submits attempts; admin writes `notes`/`visual_set` and unlocks retakes; scores themselves are **never stored** — always computed live from responses (`calcArchetypeScores`) — so there is intentionally no `archetype_scores` table; keep that computation in application/DB view logic, not a persisted column, to match the mock's explicit "never trust a persisted result" design.

---

## Playbook

### `playbooks`
1:1 with client (a thin wrapper; versions carry the real content).

| Column | Type | Null | Default | Maps to |
|---|---|---|---|---|
| client_id | uuid PK, FK -> clients.id | no | — | parent |

### `playbook_versions`
| Column | Type | Null | Default | Maps to |
|---|---|---|---|---|
| id | uuid PK | no | gen_random_uuid() | n/a |
| client_id | uuid FK -> playbooks.client_id | no | — | parent |
| version | integer | no | — | `.version` |
| status | text | no | 'draft' | `.status` |
| created_at | timestamptz | no | — | `.createdAt` |
| published_at | timestamptz | yes | null | `.publishedAt` |

Check: `status in ('draft','published','archived')`. Unique (client_id, version).

### `playbook_sections`
Normalizes the 13 fixed section keys (`identity`, `mission`, `vision`, `core_story`, `golden_circle`, `target_audience`, `value_proposition`, `positioning`, `brand_voice`, `communication_style`, `goals`, `pitch_30s`, `action_plan`) per version, instead of a JSON blob.

| Column | Type | Null | Default | Maps to |
|---|---|---|---|---|
| id | uuid PK | no | gen_random_uuid() | n/a |
| playbook_version_id | uuid FK -> playbook_versions.id | no | — | parent |
| section_key | text | no | — | key |
| content | text | no | — | value (long-form prose — stays text, per the "genuinely free-form" exception) |

Check: `section_key in ('identity','mission','vision','core_story','golden_circle','target_audience','value_proposition','positioning','brand_voice','communication_style','goals','pitch_30s','action_plan')`. Unique (playbook_version_id, section_key).

Role notes: admin generates draft + edits + publishes; client reads only the published version (`getPublishedPlaybook`).

### `playbook_experiences`
1:1 — how the client consumed her playbook (podcast/video/audiobook).

| Column | Type | Null | Default | Maps to |
|---|---|---|---|---|
| client_id | uuid PK, FK -> clients.id | no | — | parent |
| format | text | yes | null | `.format` |
| completed_at | timestamptz | yes | null | `.completedAt` |

### `playbook_quiz_results`
1:1 — the short comprehension quiz after the playbook experience.

| Column | Type | Null | Default | Maps to |
|---|---|---|---|---|
| client_id | uuid PK, FK -> clients.id | no | — | parent |
| score | integer | yes | null | `.score` |
| total | integer | yes | null | `.total` |
| completed_at | timestamptz | yes | null | `.completedAt` |

Role notes (both): client writes; admin/assistant read.

### `pitches`
1:1 with client — generated pitch variations.

| Column | Type | Null | Default | Maps to |
|---|---|---|---|---|
| client_id | uuid PK, FK -> clients.id | no | — | parent |
| version | integer | no | 1 | `.version` |
| pitch_10s | text | no | — | `.pitch_10s` |
| pitch_30s | text | no | — | `.pitch_30s` |
| pitch_60s | text | no | — | `.pitch_60s` |
| pitch_networking | text | no | — | `.pitch_networking` |
| instagram_bio | text | no | — | `.instagram_bio` |
| linkedin_summary | text | no | — | `.linkedin_summary` |

Role notes: admin generates; client reads; both can view under Programa/Pitch tabs.

### `brand_directions`
1:1 — "Direção da Marca" mood board content (admin-authored; client reads + adds own ideas separately via `brand_ideas` on `clients`).

| Column | Type | Null | Default | Maps to |
|---|---|---|---|---|
| client_id | uuid PK, FK -> clients.id | no | — | parent |
| pinterest_url | text | yes | null | `.pinterestUrl` |
| mood_board_intro | text | yes | '' | `.moodBoardIntro` |
| positioning_summary | text | yes | '' | `.positioningSummary` |
| tone | text | yes | '' | `.tone` |
| guidance | text | yes | '' | `.guidance` |
| updated_at | timestamptz | yes | null | `.updatedAt` |

### `brand_direction_keywords`
| Column | Type | Null | Default | Maps to |
|---|---|---|---|---|
| client_id | uuid FK -> brand_directions.client_id | no | — | parent |
| keyword | text | no | — | array item |
| sort_order | integer | no | — | array index |

### `brand_direction_references`
| Column | Type | Null | Default | Maps to |
|---|---|---|---|---|
| client_id | uuid FK -> brand_directions.client_id | no | — | parent |
| reference | text | no | — | array item (`.references[]`) |
| sort_order | integer | no | — | array index |

### `brand_direction_belongs` / `brand_direction_doesnt_belong`
Two tables (or one with a `polarity` discriminator column — using a discriminator to avoid near-duplicate tables):

### `brand_direction_style_notes`
| Column | Type | Null | Default | Maps to |
|---|---|---|---|---|
| id | uuid PK | no | gen_random_uuid() | n/a |
| client_id | uuid FK -> brand_directions.client_id | no | — | parent |
| polarity | text | no | — | 'belongs' or 'doesnt_belong' |
| text | text | no | — | array item |
| sort_order | integer | no | — | array index |

Check: `polarity in ('belongs','doesnt_belong')`.

Role notes (brand direction tables): admin write; client read + writes only `clients.brand_ideas` (a structurally separate write path per the mock's explicit comment).

### `books`
The "Guia Imagético" static content — currently identical across all clients in the seed (same title/author/chapters), so this may really be **tenant-level content, not per-client**, despite living under each client object in the mock. Flagged as an open question below. Modeled here as per-client to match the mock's current storage shape exactly; recommend collapsing to a single tenant-level `book` + `book_chapters` (no `client_id`) once confirmed with Nay that content never actually varies by client.

| Column | Type | Null | Default | Maps to |
|---|---|---|---|---|
| id | uuid PK | no | gen_random_uuid() | n/a |
| client_id | uuid FK -> clients.id | no | — (unique) | parent (see note above) |
| title | text | no | — | `.title` |
| subtitle | text | yes | null | `.subtitle` |
| author | text | no | — | `.author` |
| cover_image_url | text | yes | null | `.coverImage` |
| epigraph_text | text | yes | null | `.epigraph.text` |
| epigraph_cite | text | yes | null | `.epigraph.cite` |
| back_matter_studio | text | yes | null | `.backMatter.studio` |
| back_matter_handle | text | yes | null | `.backMatter.handle` |
| back_matter_email | text | yes | null | `.backMatter.email` |

### `book_chapters`
| Column | Type | Null | Default | Maps to |
|---|---|---|---|---|
| id | uuid PK | no | gen_random_uuid() | n/a |
| book_id | uuid FK -> books.id | no | — | parent |
| chapter_key | text | no | — | `.key` |
| number | integer | no | — | `.number` |
| title | text | no | — | `.title` |
| eyebrow | text | yes | null | `.eyebrow` |

Unique (book_id, chapter_key).

### `book_chapter_paragraphs`
| Column | Type | Null | Default | Maps to |
|---|---|---|---|---|
| id | uuid PK | no | gen_random_uuid() | n/a |
| chapter_id | uuid FK -> book_chapters.id | no | — | parent |
| text | text | no | — | array item (`.paragraphs[]`) |
| sort_order | integer | no | — | array index |

### `book_chapter_list_items`
| Column | Type | Null | Default | Maps to |
|---|---|---|---|---|
| id | uuid PK | no | gen_random_uuid() | n/a |
| chapter_id | uuid FK -> book_chapters.id | no | — | parent |
| text | text | no | — | array item (`.list[]`) |
| sort_order | integer | no | — | array index |

Role notes (book tables): admin writes (rarely — it's static onboarding content); client reads.

---

## Content & Templates (runtime deliverables)

### `image_guides`
One row per (client, guide slug) — always exactly 4 rows per client (`IMAGE_GUIDE_SLUGS`).

| Column | Type | Null | Default | Maps to |
|---|---|---|---|---|
| id | uuid PK | no | gen_random_uuid() | n/a |
| client_id | uuid FK -> clients.id | no | — | parent |
| slug | text | no | — | `.slug` |
| file_url | text | yes | null | `.fileUrl` |
| note | text | yes | '' | `.note` |
| summary | text | yes | '' | `.summary` |
| canva_url | text | yes | '' | `.canvaUrl` |
| delivered_at | timestamptz | yes | null | `.deliveredAt` |

Check: `slug in ('paleta_cores','estilo','moodboard_ensaio','guia_looks_mensal')` (`IMAGE_GUIDE_SLUGS`). Unique (client_id, slug). Status (`not_started`/`in_review`/`delivered`) is **derived**, not stored (per `getImageGuides`'s "derive, don't duplicate" rule) — computed as: `delivered` if `file_url` set, else `in_review` if an open `content_reviews` row exists, else `not_started`. No status column here by design.

### `digital_kits`
1:1 with client. Same derive-don't-duplicate status rule as image guides.

| Column | Type | Null | Default | Maps to |
|---|---|---|---|---|
| client_id | uuid PK, FK -> clients.id | no | — | parent |
| file_url | text | yes | null | `.fileUrl` |
| summary | text | yes | '' | `.summary` |
| canva_url | text | yes | '' | `.canvaUrl` |
| delivered_at | timestamptz | yes | null | `.deliveredAt` |

### `content_reviews`
The generic "assistant prepared this, Nay needs to review before it reaches the client" queue (`pendingReviews[]`) — deliberately generic by `type`/`ref_slug` per the mock's own comment, so it also covers any future assistant-authored deliverable, not just image guides/digital kit.

| Column | Type | Null | Default | Maps to |
|---|---|---|---|---|
| id | uuid PK | no | gen_random_uuid() | `.id` (legacy_id, e.g. 'rev1') |
| client_id | uuid FK -> clients.id | no | — | parent |
| review_type | text | no | — | `.type` |
| ref_slug | text | yes | null | `.refSlug` |
| title | text | no | — | `.title` |
| note | text | yes | '' | `.note` |
| file_url | text | yes | null | `.fileUrl` |
| summary | text | yes | '' | `.summary` |
| canva_url | text | yes | '' | `.canvaUrl` |
| status | text | no | 'pending' | `.status` |
| created_at | timestamptz | no | — | `.createdAt` |
| resolved_at | timestamptz | yes | null | `.resolvedAt` |
| nay_note | text | yes | '' | `.nayNote` |

Check: `review_type in ('image_guide','digital_kit')` (extend as new types are added). Check: `status in ('pending','approved','changes_requested')` (`CONTENT_REVIEW_STATUSES`).

Role notes: assistant creates (`submitForReview`); admin approves/requests changes; client never sees this table (only the resulting `image_guides`/`digital_kits` row once approved).

### `resources`
Content Center library (Hubla-hosted classes), tenant-level.

| Column | Type | Null | Default | Maps to |
|---|---|---|---|---|
| id | uuid PK | no | gen_random_uuid() | `.id` (legacy_id) |
| title | text | no | '' | `.title` |
| description | text | no | '' | `.description` |
| track | text | no | — | `.track` |
| phase_key | text | yes | null | `.phaseKey` (free text phase name, not FK — mock stores the phase's display name, not id) |
| duration | text | yes | null | `.duration` |
| hubla_url | text | no | '' | `.hublaUrl` |
| recommendation | text | yes | null | `.recommendation` |
| general_audience | boolean | no | true | `.generalAudience` |
| created_at, updated_at | timestamptz | no | now() | `.createdAt/.updatedAt` |

Check: `track in ('posicionamento','conteudo_autenticidade','comunicacao','vendas')` (`CONTENT_TRACKS`).

Role notes: admin write; assistant/client read (`generalAudience=true` ones visible to all; others only via assignment).

### `resource_assignments`
Per-student recommendation layered on top of the general library.

| Column | Type | Null | Default | Maps to |
|---|---|---|---|---|
| id | uuid PK | no | gen_random_uuid() | `.id` (legacy_id, e.g. 'ra1') |
| resource_id | uuid FK -> resources.id | no | — | `.resourceId` |
| client_id | uuid FK -> clients.id | no | — | `.studentId` |
| reason | text | yes | '' | `.reason` |
| deadline | date | yes | null | `.deadline` |
| related_phase_or_meeting | text | yes | null | `.relatedPhaseOrMeeting` |
| assigned_at | timestamptz | no | — | `.assignedAt` |
| completed | boolean | no | false | `.completed` |

Role notes: admin/assistant create; client marks complete; both read (drives `getAdherenceReport`).

---

## Business Value Assessment ("Leitura Estratégica de Valor")

Source: `value-analysis-schema.js` + `mock-db.js`'s `businessValueAssessments`. Premium-only. Every nested `answers.s1`..`s6` group gets its own table; the four repeatable groups (`offers`, `fixedCosts`, `variableCosts`, `references`) each get their own table (they already are arrays of structured records in the mock, so this is the most natural normalization in the whole file).

### `value_assessments`
The parent record — 1:1 with client (only created for premium clients, lazily on first access).

| Column | Type | Null | Default | Maps to |
|---|---|---|---|---|
| id | uuid PK | no | gen_random_uuid() | `.id` (legacy_id, e.g. 'bva1') |
| client_id | uuid FK -> clients.id | no | — (unique) | `.clientId` |
| status | text | no | 'available' | `.status` |
| questionnaire_version | integer | no | 1 | `.questionnaireVersion` |
| started_at | timestamptz | yes | null | `.startedAt` |
| submitted_at | timestamptz | yes | null | `.submittedAt` |
| analysis_started_at | timestamptz | yes | null | `.analysisStartedAt` |
| published_at | timestamptz | yes | null | `.publishedAt` |
| updated_at | timestamptz | no | now() | `.updatedAt` |

Check: `status in ('locked_plan','upcoming','available','in_progress','submitted','in_analysis','published')` (`VALUE_ASSESSMENT_STATUSES` — note `locked_plan`/`upcoming` are computed access states, not actually persisted statuses; only `available` through `published` are ever stored on a real record — flagged so the check constraint isn't over-broad if the team wants to tighten it to just the 5 persisted values).

### `value_assessment_answers_s1`
"Seu negócio hoje" — non-repeatable fields.

| Column | Type | Null | Default | Maps to |
|---|---|---|---|---|
| assessment_id | uuid PK, FK -> value_assessments.id | no | — | parent |
| profession | text | yes | '' | `s1.profession` |
| specialty | text | yes | '' | `s1.specialty` |
| region | text | yes | '' | `s1.region` |
| service_mode | text | yes | '' | `s1.serviceMode` |
| business_model | text | yes | '' | `s1.businessModel` |
| business_model_other | text | yes | '' | `s1.businessModelOther` |
| primary_offer_name | text | yes | '' | `s1.primaryOfferName` |
| primary_offer_description | text | yes | '' | `s1.primaryOfferDescription` |
| target_audience | text | yes | '' | `s1.targetAudience` |
| sales_channels_other | text | yes | '' | `s1.salesChannelsOther` |
| main_problem | text | yes | '' | `s1.mainProblem` |
| desired_outcome | text | yes | '' | `s1.desiredOutcome` |

Check: `service_mode in ('Presencial','Online','Híbrido','Outro')` or ''. Check: `business_model in ('Serviços individuais','Serviços em grupo','Projetos','Produtos físicos','Produtos digitais','Assinatura ou recorrência','Combinação de modelos','Outro')` or ''.

### `value_assessment_sales_channels`
Normalizes the `salesChannels: string[]` multiselect.

| Column | Type | Null | Default | Maps to |
|---|---|---|---|---|
| assessment_id | uuid FK -> value_assessment_answers_s1.assessment_id | no | — | parent |
| channel | text | no | — | array item |

Composite PK (assessment_id, channel). Check: `channel in ('Indicações','WhatsApp','Instagram','Site','Equipe comercial','Anúncios','Parcerias','Eventos','Outro')`.

### `value_assessment_answers_s2`
"Oferta e preço atual" — aggregate fields (per-offer detail is in `value_offers`).

| Column | Type | Null | Default | Maps to |
|---|---|---|---|---|
| assessment_id | uuid PK, FK -> value_assessments.id | no | — | parent |
| monthly_revenue_cents | integer | yes | null | `s2.monthlyRevenue` |
| monthly_revenue_precision | text | yes | '' | `s2.monthlyRevenuePrecision` |
| monthly_clients | integer | yes | null | `s2.monthlyClients` |
| capacity_utilization | text | yes | '' | `s2.capacityUtilization` |

Check: `monthly_revenue_precision in ('Exato','Aproximado','Não sei informar')` or ''. Check: `capacity_utilization in ('Até 25% ocupada','Entre 26% e 50%','Entre 51% e 75%','Entre 76% e 90%','Acima de 90%','Não sei')` or ''.

### `value_offers`
Repeatable group tied to section 2 (`answers.offers[]`).

| Column | Type | Null | Default | Maps to |
|---|---|---|---|---|
| id | uuid PK | no | gen_random_uuid() | `.id` (legacy_id, e.g. 'off-marina-1') |
| assessment_id | uuid FK -> value_assessments.id | no | — | parent |
| name | text | yes | '' | `.name` |
| current_price_cents | integer | yes | null | `.currentPrice` |
| delivery_type | text | yes | '' | `.deliveryType` |
| delivery_type_other | text | yes | '' | `.deliveryTypeOther` |
| delivery_minutes | integer | yes | null | `.deliveryMinutes` |
| delivery_unit | text | no | 'sessao' | `.deliveryUnit` |
| requires_post_work | text | yes | '' | `.requiresPostWork` |
| post_work_hours | numeric | yes | null | `.postWorkHours` |
| avg_monthly_sales | numeric | yes | null | `.avgMonthlySales` |
| has_capacity_limit | text | yes | '' | `.hasCapacityLimit` |
| capacity_limit | integer | yes | null | `.capacityLimit` |
| payment_method | text | yes | '' | `.paymentMethod` |
| payment_method_other | text | yes | '' | `.paymentMethodOther` |
| installments | integer | yes | null | `.installments` |
| offers_discount | text | yes | '' | `.offersDiscount` |
| discount_notes | text | yes | '' | `.discountNotes` |
| pays_commission | text | yes | '' | `.paysCommission` |
| commission_notes | text | yes | '' | `.commissionNotes` |
| direct_cost_per_sale_cents | integer | yes | null | `.directCostPerSale` |
| price_assessment | text | yes | '' | `.priceAssessment` |
| price_last_changed_at | text | yes | '' | `.priceLastChangedAt` (free text, e.g. "Há 1 ano" — not a real date) |
| price_change_reason | text | yes | '' | `.priceChangeReason` |

Check: `delivery_type in ('Individual','Grupo','Presencial','Online','Híbrida','Produto físico','Produto digital','Outro')` or ''. Check: `requires_post_work in ('Sim','Não')` or ''. Check: `has_capacity_limit in ('Sim','Não')` or ''. Check: `payment_method in ('À vista','Parcelado','Recorrente','Entrada + saldo','Outro')` or ''. Check: `price_assessment in ('Muito baixo','Um pouco baixo','Adequado','Um pouco alto','Não sei avaliar')` or ''.

### `value_assessment_answers_s3`
"Custos da operação" — narrative fields (fixed/variable cost line items live in their own tables below).

| Column | Type | Null | Default | Maps to |
|---|---|---|---|---|
| assessment_id | uuid PK, FK -> value_assessments.id | no | — | parent |
| separates_finances | text | yes | '' | `s3.separatesFinances` |
| tracks_monthly | text | yes | '' | `s3.tracksMonthly` |
| variable_cost_notes | text | yes | '' | `s3.variableCostNotes` |
| seasonal_notes | text | yes | '' | `s3.seasonalNotes` |

Check: `separates_finances in ('Sim','Não','Em parte')` or ''. Check: `tracks_monthly in ('Sim','Não','Às vezes')` or ''.

### `value_fixed_costs`
| Column | Type | Null | Default | Maps to |
|---|---|---|---|---|
| id | uuid PK | no | gen_random_uuid() | `.id` (legacy_id) |
| assessment_id | uuid FK -> value_assessments.id | no | — | parent |
| category | text | yes | '' | `.category` |
| description | text | yes | '' | `.description` |
| monthly_amount_cents | integer | yes | null | `.monthlyAmount` |
| is_estimate | boolean | no | true | `.isEstimate` |

Check: `category in ('Aluguel ou espaço','Equipe, assistentes e prestadores recorrentes','Softwares e plataformas','Contabilidade','Marketing e anúncios','Telefone e internet','Energia e estrutura','Seguros','Mensalidades profissionais','Outros custos fixos')` or ''.

### `value_variable_costs`
| Column | Type | Null | Default | Maps to |
|---|---|---|---|---|
| id | uuid PK | no | gen_random_uuid() | `.id` (legacy_id) |
| assessment_id | uuid FK -> value_assessments.id | no | — | parent |
| category | text | yes | '' | `.category` |
| calculation_type | text | no | 'monthly_estimate' | `.calculationType` |
| description | text | yes | '' | `.description` |
| amount_cents | integer | yes | null | `.amount` |
| percentage | numeric | yes | null | `.percentage` |
| is_estimate | boolean | no | true | `.isEstimate` |

Check: `category in ('Impostos','Taxas de cartão','Comissões','Materiais e insumos','Embalagem','Entrega ou frete','Deslocamento','Terceirização por serviço','Outros custos variáveis')` or ''. Check: `calculation_type in ('fixed_per_sale','percentage','monthly_estimate')` (`VARIABLE_COST_CALC_TYPES`).

### `value_assessment_answers_s4`
"Tempo e capacidade" — all non-repeatable.

| Column | Type | Null | Default | Maps to |
|---|---|---|---|---|
| assessment_id | uuid PK, FK -> value_assessments.id | no | — | parent |
| desired_weekly_hours | numeric | yes | null | `s4.desiredWeeklyHours` |
| admin_hours | numeric | yes | null | `s4.adminHours` |
| sales_hours | numeric | yes | null | `s4.salesHours` |
| marketing_hours | numeric | yes | null | `s4.marketingHours` |
| planning_hours | numeric | yes | null | `s4.planningHours` |
| delivery_hours_available | numeric | yes | null | `s4.deliveryHoursAvailable` |
| work_days_per_week | integer | yes | null | `s4.workDaysPerWeek` |
| workload_preference | text | yes | '' | `s4.workloadPreference` |
| deliverable_volume_capacity | integer | yes | null | `s4.deliverableVolumeCapacity` |
| max_volume_achieved | integer | yes | null | `s4.maxVolumeAchieved` |
| was_sustainable | text | yes | '' | `s4.wasSustainable` |
| capacity_limiters_other | text | yes | '' | `s4.capacityLimitersOther` |
| demand_double_scenario | text | yes | '' | `s4.demandDoubleScenario` |
| capacity_increase_ideas | text | yes | '' | `s4.capacityIncreaseIdeas` |

Check: `workload_preference in ('Sim','Gostaria de trabalhar menos','Poderia trabalhar mais temporariamente','Não sei')` or ''. Check: `was_sustainable in ('Sim','Não','Em parte')` or ''.

### `value_capacity_limiters`
Normalizes `s4.capacityLimiters: string[]`.

| Column | Type | Null | Default | Maps to |
|---|---|---|---|---|
| assessment_id | uuid FK -> value_assessment_answers_s4.assessment_id | no | — | parent |
| limiter | text | no | — | array item |

Composite PK (assessment_id, limiter). Check: `limiter in ('Tempo','Agenda','Equipe','Espaço físico','Produção','Energia pessoal','Demanda insuficiente','Processo comercial','Outro')`.

### `value_assessment_answers_s5`
"Metas e remuneração" — all non-repeatable, includes 5 reserve sub-amounts (each is a distinct fact, not an array, so each gets its own column per the "every nested field gets its own column" instruction).

| Column | Type | Null | Default | Maps to |
|---|---|---|---|---|
| assessment_id | uuid PK, FK -> value_assessments.id | no | — | parent |
| desired_monthly_revenue_cents | integer | yes | null | `s5.desiredMonthlyRevenue` |
| desired_revenue_timeframe | text | yes | '' | `s5.desiredRevenueTimeframe` |
| desired_pro_labore_cents | integer | yes | null | `s5.desiredProLabore` |
| min_personal_expenses_cents | integer | yes | null | `s5.minPersonalExpenses` |
| reserve_emergency_cents | integer | yes | null | `s5.reserveEmergency` |
| reserve_reinvestment_cents | integer | yes | null | `s5.reserveReinvestment` |
| reserve_growth_cents | integer | yes | null | `s5.reserveGrowth` |
| reserve_vacation_cents | integer | yes | null | `s5.reserveVacation` |
| reserve_other_cents | integer | yes | null | `s5.reserveOther` |
| business_debt | text | yes | '' | `s5.businessDebt` |
| expansion_goal | text | yes | '' | `s5.expansionGoal` |
| safety_margin_pct | numeric | yes | null | `s5.safetyMargin` |
| can_cover_costs_today | text | yes | '' | `s5.canCoverCostsToday` |
| current_priority | text | yes | '' | `s5.currentPriority` |

Check: `can_cover_costs_today in ('Sim','Parcialmente','Não','Não sei')` or ''. Check: `current_priority in ('Aumentar faturamento','Aumentar margem','Trabalhar menos','Aumentar volume','Elevar posicionamento','Criar recorrência','Reestruturar a oferta','Outra')` or ''.

### `value_assessment_answers_s6`
"Mercado, posicionamento e percepção de valor" — narrative fields (`references[]` is its own table below).

| Column | Type | Null | Default | Maps to |
|---|---|---|---|---|
| assessment_id | uuid PK, FK -> value_assessments.id | no | — | parent |
| experience_level | text | yes | '' | `s6.experienceLevel` |
| years_in_field | text | yes | '' | `s6.yearsInField` |
| qualifications | text | yes | '' | `s6.qualifications` |
| differentiator | text | yes | '' | `s6.differentiator` |
| why_best_clients_choose | text | yes | '' | `s6.whyBestClientsChoose` |
| transformation_delivered | text | yes | '' | `s6.transformationDelivered` |
| extras_included | text | yes | '' | `s6.extrasIncluded` |
| common_objections | text | yes | '' | `s6.commonObjections` |
| price_questioned | text | yes | '' | `s6.priceQuestioned` |
| loss_reason | text | yes | '' | `s6.lossReason` |
| references_intro | text | yes | '' | `s6.referencesIntro` |
| knows_reference_prices | text | yes | '' | `s6.knowsReferencePrices` |
| desired_perception | text | yes | '' | `s6.desiredPerception` |
| price_matches_positioning | text | yes | '' | `s6.priceMatchesPositioning` |
| price_matches_positioning_why | text | yes | '' | `s6.priceMatchesPositioningWhy` |
| demand_level | text | yes | '' | `s6.demandLevel` |
| waitlist_exists | text | yes | '' | `s6.waitlistExists` |
| lost_sales_due_to_capacity | text | yes | '' | `s6.lostSalesDueToCapacity` |
| believes_could_sustain_higher_price | text | yes | '' | `s6.believesCouldSustainHigherPrice` |
| price_increase_doubts | text | yes | '' | `s6.priceIncreaseDoubts` |

Check: `experience_level in ('Iniciante','Intermediária','Experiente','Referência no mercado')` or ''. Check: `price_questioned in ('Frequentemente','Às vezes','Raramente','Nunca')` or ''. Check: `knows_reference_prices in ('Sim','Não','Em parte')` or ''. Check: `price_matches_positioning in ('Sim','Não','Em parte')` or ''. Check: `demand_level in ('Muito abaixo da capacidade','Abaixo da capacidade','Próxima da capacidade','Acima da capacidade','Não sei')` or ''. Check: `waitlist_exists in ('Sim','Não')` or ''. Check: `lost_sales_due_to_capacity in ('Sim','Não','Não sei')` or ''. Check: `believes_could_sustain_higher_price in ('Sim','Não','Talvez')` or ''.

### `value_references`
Repeatable group tied to section 6 (`s6.references[]`).

| Column | Type | Null | Default | Maps to |
|---|---|---|---|---|
| id | uuid PK | no | gen_random_uuid() | `.id` (legacy_id) |
| assessment_id | uuid FK -> value_assessments.id | no | — | parent |
| name | text | yes | '' | `.name` |
| product | text | yes | '' | `.product` |
| known_price | text | yes | '' | `.knownPrice` (free text, e.g. "R$ 5.000 a R$ 7.000" — a range, not a number) |
| source | text | yes | '' | `.source` |

### `value_assessment_review_status`
Normalizes `reviewStatus: {fieldPath: status}` and `internalNotes: {fieldPath: note}` (Nay's per-field admin annotations) into rows instead of two parallel path-keyed objects.

| Column | Type | Null | Default | Maps to |
|---|---|---|---|---|
| id | uuid PK | no | gen_random_uuid() | n/a |
| assessment_id | uuid FK -> value_assessments.id | no | — | parent |
| field_path | text | no | — | key (e.g. 's1.profession', 'offers.off-marina-1.currentPrice') |
| review_status | text | yes | null | `reviewStatus[path]` |
| internal_note | text | yes | null | `internalNotes[path]` |

Unique (assessment_id, field_path). Check: `review_status in ('confirmado','estimado','precisa_esclarecer','nao_aplicavel')` (`REVIEW_STATUSES`) or null.

Note: `field_path` referencing a dotted answer path is a pragmatic compromise — it's the one place in this schema that keeps a string "pointer" rather than a real FK, because the mock's own review-status map is keyed generically across every question field, offer, and cost line, including future ones a schema change might add. A stricter alternative (separate review-status columns/rows per concrete field) would balloon this section 5-10x for marginal benefit; flagging this as the one deliberate exception to "every nested field gets a normalized column."

### `value_assessment_scenarios`
Append-only-ish list of pricing scenarios Nay models (`scenarios[]`).

| Column | Type | Null | Default | Maps to |
|---|---|---|---|---|
| id | uuid PK | no | gen_random_uuid() | `.id` (legacy_id, e.g. 'sc...') |
| assessment_id | uuid FK -> value_assessments.id | no | — | parent |
| is_recommended | boolean | no | false | `.isRecommended` |
| created_by | text | no | 'nay' | `.createdBy` |
| created_at | timestamptz | no | — | `.createdAt` |
| price_cents | integer | yes | null | `.price` (scenario input fields — mock stores whatever `scenario` object shape `addValueScenario` is called with; exact field list isn't fixed in the mock beyond `projectScenario`'s inputs) |
| monthly_volume | numeric | yes | null | `.monthlyVolume` |
| variable_cost_pct | numeric | yes | null | `.variableCostPct` |
| direct_cost_per_sale_cents | integer | yes | null | `.directCostPerSale` |
| label | text | yes | null | `.label` |
| notes | text | yes | null | `.notes` |

Note: the mock's `addValueScenario`/`updateValueScenario` accept an arbitrary patch object (no fixed shape enforced in code beyond `projectScenario`'s calculation inputs) — the columns above are inferred from `projectScenario({ price, monthlyVolume, variableCostPct, directCostPerSale })` plus `isRecommended`/`createdBy`/`createdAt`. **Flag for the team**: confirm the actual scenario field set used in `admin/client-detail.js` or wherever scenarios are edited before finalizing this table — it may need `label`/`notes` removed or other fields added.

### `value_recommendations`
1:1 with assessment — Nay's strategic pricing recommendation.

| Column | Type | Null | Default | Maps to |
|---|---|---|---|---|
| assessment_id | uuid PK, FK -> value_assessments.id | no | — | parent |
| offer_id | uuid FK -> value_offers.id | yes | null | `.offerId` |
| status | text | no | 'draft' | `.status` |
| strategic_price_cents | integer | yes | null | `.strategicPrice` |
| mathematical_minimum_cents | integer | yes | null | `.mathematicalMinimum` |
| effective_date | date | yes | null | `.effectiveDate` |
| review_date | date | yes | null | `.reviewDate` |
| strategic_justification | text | yes | null | `.strategicJustification` |
| risks | text | yes | null | `.risks` |
| created_by | text | no | 'nay' | `.createdBy` |
| created_at | timestamptz | no | — | `.createdAt` |
| updated_at | timestamptz | yes | null | `.updatedAt` |

### `value_recommendation_factors`
Normalizes `factorsConsidered: string[]`.

| Column | Type | Null | Default | Maps to |
|---|---|---|---|---|
| assessment_id | uuid FK -> value_recommendations.assessment_id | no | — | parent |
| factor | text | no | — | array item |

Composite PK (assessment_id, factor).

### `value_published_deliverables`
1:1 — the client-facing published version (a curated subset of the recommendation, per `publishValueDeliverable`).

| Column | Type | Null | Default | Maps to |
|---|---|---|---|---|
| assessment_id | uuid PK, FK -> value_assessments.id | no | — | parent |
| strategic_price_cents | integer | yes | null | `.strategicPrice` |
| explanation | text | yes | null | `.explanation` |
| recommendation_date | date | yes | null | `.recommendationDate` |
| review_date | date | yes | null | `.reviewDate` |
| mathematical_minimum_cents | integer | yes | null | `.mathematicalMinimum` |
| published_at | timestamptz | no | — | `.publishedAt` |

Role notes (all value_assessment_* tables): client writes own answers through `submitted`; admin reviews (`review_status`), builds scenarios/recommendation, and is the only one who can publish; assistant: no access observed in the mock (this is explicitly a Nay-only workspace per file comments) — confirm before RLS.

### `price_history`
Append-only, tenant-wide — never edited, only superseded (per explicit mock comment).

| Column | Type | Null | Default | Maps to |
|---|---|---|---|---|
| id | uuid PK | no | gen_random_uuid() | `.id` (legacy_id, e.g. 'ph1') |
| client_id | uuid FK -> clients.id | no | — | `.clientId` |
| offer_id | uuid FK -> value_offers.id | yes | null | `.offerId` |
| offer_name | text | no | — | `.offerName` (denormalized snapshot — kept because the offer's name may change after the fact; this is intentional historical denormalization, not an oversight) |
| recommendation_id | uuid FK -> value_assessments.id | yes | null | `.recommendationId` |
| previous_price_cents | integer | yes | null | `.previousPrice` |
| new_price_cents | integer | no | — | `.newPrice` |
| reason | text | yes | '' | `.reason` |
| effective_date | date | yes | null | `.effectiveDate` |
| review_date | date | yes | null | `.reviewDate` |
| created_by | text | no | 'nay' | `.createdBy` |
| created_at | timestamptz | no | — | `.createdAt` |

Role notes: system-written only (via `publishValueDeliverable`); admin/client read own; drives `getSuccessMetrics` pricing-impact reporting.

### `premium_upgrade_interests`
Non-premium clients' interest signals sourced from the locked preview CTA.

| Column | Type | Null | Default | Maps to |
|---|---|---|---|---|
| id | uuid PK | no | gen_random_uuid() | `.id` (legacy_id) |
| client_id | uuid FK -> clients.id | no | — | `.clientId` |
| source_activity_slug | text FK -> program_activities.slug | no | 'business' | `.sourceActivitySlug` |
| current_program_slug | text | yes | null | `.currentProgramSlug` (snapshot at creation time) |
| status | text | no | 'novo' | `.status` |
| created_at | timestamptz | no | — | `.createdAt` |
| reviewed_at | timestamptz | yes | null | `.reviewedAt` |
| reviewed_by | text | yes | null | `.reviewedBy` |

Check: `status in ('novo','em_conversa','convertido','nao_seguira')` (`UPGRADE_INTEREST_STATUSES`).

Role notes: system-created on client interaction; admin manages status; client: no read access (internal sales signal).

---

## Group Dynamics & Messaging

### `group_dynamics`
VIP WhatsApp group engagement experiments Nay runs.

| Column | Type | Null | Default | Maps to |
|---|---|---|---|---|
| id | uuid PK | no | gen_random_uuid() | `.id` (legacy_id) |
| title | text | no | '' | `.title` |
| dynamic_date | date | no | — | `.date` |
| description | text | no | '' | `.description` |
| metric_label | text | yes | '' | `.metricLabel` |
| before_count | integer | no | 0 | `.beforeCount` |
| after_count | integer | no | 0 | `.afterCount` |

Role notes: admin only.

### `assistant_messages`
Flat Nay <-> Assistant inbox feed.

| Column | Type | Null | Default | Maps to |
|---|---|---|---|---|
| id | uuid PK | no | gen_random_uuid() | `.id` (legacy_id) |
| from_role | text | no | — | `.from` |
| client_id | uuid FK -> clients.id | yes | null | `.clientId` (optional context, not a scoping filter — every message shows to both parties regardless) |
| text | text | no | — | `.text` |
| route | text | yes | null | `.route` |
| sent_at | timestamptz | no | — | `.at` |
| read | boolean | no | false | `.read` |

Check: `from_role in ('nay','assistant')`.

Role notes: admin and assistant both read/write all rows (shared inbox, not per-recipient scoped); client: no access.

---

## Cross-cutting notes on things intentionally NOT tables

- **Archetype scores** — never persisted in the mock (`calcArchetypeScores` always recomputes from `archetype_quiz_responses`); do not add a `scores` table. Recreate as a SQL view or application-layer computation if a materialized version is ever needed for performance.
- **Derived "status" fields** on `program_activities` instances, `image_guides`, `digital_kits`, `meeting_recordings` lifecycle, etc. — the mock is explicit and repeated ("derive, don't duplicate") that these are computed from other tables' state, never stored redundantly. This schema follows that: no `program_activity_instances.status` column exists; that status is a query/view over `clients` + the relevant feature table, exactly mirroring `deriveActivityStatus`/`getProgramActivities`.
- **`journey.upcomingMeeting`** — the mock's own comment flags this as a known duplication of what `agenda_items` should already answer ("a later pass should make this a computed read"). This plan does **not** create a table for it; `getUpcomingMeetingForClient`'s query (next upcoming `agenda_items` row for the client) should be the only source once migrated. Flagged as a fix-during-migration, not a field to carry forward.
- **`ARCHETYPE_QUIZ_VERSION` / questionnaire versioning** — modeled as a plain integer snapshot on the attempt/analysis row, not a separate "quiz versions" history table, since the mock only ever has one live version at a time (bumped in source, not through an admin UI).

---

## Open questions / flags for the user

1. **`book` (Guia Imagético) looks tenant-level, stored per-client.** Every seeded client that has one has identical content. Recommend confirming with Nay whether this ever actually varies by client; if not, collapse `books`/`book_chapters`/etc. to a single tenant-level record instead of one per client.
2. **`value_assessment_scenarios` field shape is inferred, not explicit in the mock.** `addValueScenario`/`updateValueScenario` accept a free-form patch object; the mock never seeds a populated `scenarios[]` example. Columns proposed here are a best guess from `projectScenario`'s inputs — verify against the actual admin UI (`client-detail.js` or wherever scenarios are built) before writing DDL.
3. **Known data inconsistency the mock's own comments flag**: client-6 has `tier: 'premium'` but her real contract product is Ascensão de Imagem — `programSlug` is authoritative, `tier` is stale/cosmetic. The new schema keeps both columns (mirroring the mock) but this plan recommends deciding whether `clients.tier` should be dropped/computed once `program_slug` is the single source of truth, rather than migrating a known-inconsistent field forward silently.
4. **`clients.notes` vs. assistant visibility** — the mock doesn't enforce that Nay's private notepad is assistant-invisible at the data-access layer (`getNotes`/`saveNotes` are plain MockDB methods anyone could call); the app's screens simply never expose a UI for the assistant to read it. RLS should decide explicitly whether to lock this down at the database level now that it's a real boundary, rather than continuing to rely on "no screen calls this."
5. **`client_onboarding` vs. `lead_registration_info` field overlap** — flagged inline above; these two tables carry nearly identical PF/PJ/address fields by deliberate mock design (so nothing downstream breaks when a lead becomes a client). Worth deciding whether the real schema should instead have one `party_info` table referenced by both `leads` and `clients`, since `activateLead` today just copies values across.
6. **Program/methodology reference tables (`program_defs`, `encounter_defs`, `program_phases`, `program_activities`, `archetype_defs`, `archetype_quiz_questions`, `business_survey_questions`, `template_categories`, etc.) are currently hardcoded JS constants, not admin-editable data.** Normalizing them into tables (as this plan does, per "full normalization") makes them technically editable via Supabase, but nothing in the current app UI expects to edit them — confirm whether Nay actually wants these editable, or whether the team prefers to keep this subset as versioned application constants (a `const` file, like today) and reserve real tables only for per-client/per-tenant instance data. Either is defensible; this plan picked full normalization per your instruction, but it's the single biggest schema-size driver (~15 extra tables) and worth a deliberate yes/no.
7. **Money is currently stored as whole reais floats/integers in the mock** (e.g. `18000` = R$18.000,00, no decimals seen anywhere). This plan proposes `_cents` integer columns throughout for correctness; confirm the real values are always whole reais (no seeded cents anywhere in the file, so likely safe) before assuming a straight `×100` migration works without surprises.
8. **`meetings`/`transcript_analyses` vs. `agenda_items`/`meeting_recordings`** — flagged inline above as likely the same real-world entity modeled twice in the mock (an artifact of incremental feature growth, not a deliberate design). Recommend the migration take the opportunity to merge these rather than carrying the duplication forward, but this plan models both as they exist today since collapsing them changes behavior, not just storage.

---

## Table count summary

Roughly **95 tables** across all sections (including small join/normalization tables for arrays like `keywords`, `sales_channels`, `capacity_limiters`, `factors_considered`, checklist items, proposed times, etc.). The Business Value Assessment domain alone accounts for ~20 tables due to its 6-section/4-repeatable-group structure. See the "Open questions" section for where the team may reasonably choose to collapse some of this back down (methodology reference tables, book, meetings/agenda duplication) before writing DDL.
