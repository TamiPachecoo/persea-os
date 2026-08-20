# Future Integration — Teste de Arquétipos (Persea Archetype Quiz)

This documents where the real Supabase backend will connect once this prototype is approved. **Nothing here is implemented.** Per instruction, this pass does not connect Supabase, create migrations, or add credentials — everything currently runs on the existing localStorage-backed `MockDB` layer in `app/shared/mock-db.js`, extended in place with the same pattern as every other feature in that file.

**Read this alongside `docs/02-database-schema.md`** for the core schema conventions this extends.

## Source of truth for content

- **The 48 statements and the question→archetype scoring map** are transcribed verbatim from Nay's own workbook (`Teste_de_Arquetipos_Persea.pdf`) into `ARCHETYPE_QUIZ_QUESTIONS`/`ARCHETYPE_QUESTION_MAP` in `mock-db.js`. Verified against the workbook's own worked example — see the seeded `client-1` (Marina) attempt, whose 48 raw answers are that exact example and reproduce its published per-archetype totals exactly (checked in the dynamic-import smoke test, not just by eye).
- **The four interpretive fields per archetype** (`centralDesire`/`potentials`/`caution`/`visualDirection`, in `ARCHETYPE_DEFS`) are **not** in that workbook. They're placeholder copy grounded in the standard, publicly-documented 12-brand-archetype framework, written for Persea's personal-branding context. Nay should review and replace this wording — it's the single array to edit, nothing else references archetype copy directly.
- **Portrait images** (`femaleImage`/`maleImage` on `ARCHETYPE_DEFS`) start `null`. See `app/assets/archetypes/README.md` for the expected 24-file drop-in location and filenames; `archetypePortrait()` in `shared/ui.js` renders the real image the instant a path is set, falling back to a graceful placeholder until then.

## ⚠️ Security note — read before connecting anything

Same caveat as every other doc in this series: today's admin/assistant/client separation is a **UI-only convention**, not a real security boundary. `MockDB.saveArchetypeResponse(clientId, ...)` takes whatever `clientId` the caller passes — nothing stops a client-side script from calling it for a different client. Real per-client isolation, and real enforcement of who can see raw scores vs. completion-status-only, **only exist once Supabase Auth + RLS are actually connected**.

## What's simulated today

- Score calculation (`calcArchetypeScores`) already treats client-submitted *answers* (1-5 integers) as the only untrusted input, and validates them server-side-equivalent (`saveArchetypeResponse` rejects anything outside 1-5 or non-integer) — the *scores themselves* are always recomputed from stored responses, never trusted from anywhere else. This is the right shape for the real backend; it just needs to move from a browser-trusted function to an actual server/Edge Function boundary.
- The idempotent follow-up task (`submitArchetypeQuiz`'s `sourceKey`-guarded `createAgendaItem` call) simulates what a database `UNIQUE` constraint + upsert would guarantee for real.
- The dev-only `devSimulate*`/`devSetArchetypeGender`/`devResetArchetypeQuiz` methods and every "Controles da demonstração" panel exist purely to preview states without a real backend — delete all of them wholesale when the real integration lands.

## Proposed schema extension

```sql
archetype_quizzes (
  id uuid pk, tenant_id uuid references tenants(id),
  title text, version int, is_active boolean,
  created_at timestamptz, updated_at timestamptz
)

archetype_quiz_questions (
  id uuid pk, quiz_id uuid references archetype_quizzes(id),
  question_number int, statement text, display_order int, is_active boolean
)

archetypes (
  id uuid pk, tenant_id uuid references tenants(id),
  slug text unique, name text,
  central_desire text, potentials text, caution text, visual_direction text,
  female_image_url text, male_image_url text, display_order int
)
-- Recommended slugs (matches ARCHETYPE_DEFS exactly): everyperson, innocent,
-- hero, caregiver, explorer, lover, outlaw, creator, magician, ruler, sage, jester.

archetype_question_scoring (
  question_id uuid references archetype_quiz_questions(id),
  archetype_id uuid references archetypes(id),
  primary key (question_id, archetype_id)
)

archetype_quiz_attempts (
  id uuid pk, tenant_id uuid references tenants(id),
  client_id uuid references clients(id),
  quiz_id uuid references archetype_quizzes(id), quiz_version int,
  status text check (status in ('not_started','in_progress','completed')),
  visual_set text check (visual_set in ('female','male')),
  started_at timestamptz, completed_at timestamptz,
  created_at timestamptz, updated_at timestamptz
)

archetype_quiz_responses (
  id uuid pk, attempt_id uuid references archetype_quiz_attempts(id),
  question_id uuid references archetype_quiz_questions(id),
  score int check (score between 1 and 5),
  created_at timestamptz, updated_at timestamptz,
  unique (attempt_id, question_id)
)

-- Optional — see note below. Only add if NOT computing scores dynamically.
archetype_quiz_results (
  id uuid pk, attempt_id uuid references archetype_quiz_attempts(id),
  archetype_id uuid references archetypes(id),
  raw_score int, percentage numeric, rank int,
  created_at timestamptz
)
```

**On the optional results table:** this prototype deliberately does *not* persist computed results — `calcArchetypeScores` derives them fresh from `responses` every time (see `getArchetypeResults` in `mock-db.js`), same "derive, don't duplicate" rule the rest of this codebase follows. Recommend keeping that approach in the real backend too (a view or a `SECURITY DEFINER` function over `archetype_quiz_responses`, not a materialized table) — it's one less place for a stored result to drift from what the responses actually say. Only add `archetype_quiz_results` if there's a real performance reason to precompute.

RLS follows the standard two-policy pattern:
- `tenant_admin_all` — Nay's admin role reads/writes everything for her tenant.
- `client_own_rows` — a client can `select`/`insert`/`update` only `archetype_quiz_attempts`/`archetype_quiz_responses` rows whose `client_id` is her own (via the Supabase Auth session, not a passed parameter). She should never be able to `select` another client's rows regardless of what id she passes client-side.
- **Assistant role**: per the spec's Ju/Nath distinction — this prototype only has one shared assistant login, so it implements the more conservative default (completion status only, via `getClientContextBundle`). If Nath genuinely needs the fuller interpretation view, that requires adding persona-level sub-roles to the real auth model — a real gap, not something papered over here. A `client_archetype_completion_status` view (client_id, status, started_at, completed_at only — no scores) is the natural real-backend equivalent of what the assistant currently sees.

## Where the real automation connects

1. **Score calculation** should move server-side (a Postgres function or Edge Function) so a client can never submit a pre-computed result — matches the "do not trust client-provided final result" instruction. The client only ever sends individual 1-5 answers; the server computes and returns scores.
2. **Swap-in point in the code**: every screen calls `MockDB.getClientArchetypeQuiz()`, `saveArchetypeResponse()`, `submitArchetypeQuiz()`, `getArchetypeResults()`, etc. — never touches `localStorage` directly. Replacing the mock layer's internals with real Supabase queries means no UI file in `app/client`, `app/admin`, or `app/assistant` should need to change.
3. **Idempotency**: `submitArchetypeQuiz`'s `activityLogged` flag + `sourceKey`-guarded agenda task simulates what a real `UNIQUE(source_key)` constraint + `ON CONFLICT DO NOTHING` would guarantee — carry that same guard into the real Edge Function that processes quiz completion.
4. **What to delete**: every `devSimulate*`/`devSetArchetypeGender`/`devResetArchetypeQuiz` method in `mock-db.js`, and every "Controles da demonstração" block on the quiz/results pages — all explicitly commented as dev-only/removable.

## Non-goals (explicitly out of scope for this pass)

- Custom, per-combination interpretation text for specific archetype pairings/trios (the "Sua combinação de destaque" section uses a generic, template-based explanation built from the three featured archetypes' own stored fields — see the instruction to avoid "exaggerated psychological claims" until real custom copy exists).
- A configurable/multi-version quiz editor for Nay. `quiz_version` is tracked on every attempt so future question changes never alter historical results, but authoring a new version is a data change, not a UI feature, in this pass.
- Separate Ju/Nath login accounts (see the RLS note above).
