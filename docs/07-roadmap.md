# PERSEA Operating System — Development Roadmap (Phase 1 / MVP)

Module-by-module build order. Each module ends in a runnable, demoable state before moving on.

## Milestone 0 — Foundation
- Supabase project setup, `.env` config, `supabase-js` client init.
- Core schema: `tenants`, `profiles`, migrations tooling, RLS scaffolding pattern.
- `agency-framework/ui/` base kit: AppShell, Card, Button, Modal, Toast, form controls, Tailwind theme wired to `persea/branding`.
- Auth engine: sign-in, invite-accept, session guard, role-based redirect.
- **Demo:** sign in as seeded admin, land on empty dashboard shell.

## Milestone 1 — CRM + Journey Engine
- `clients`, `client_invites` tables + Admin Clients List + Client Detail shell.
- `programs`/`program_phases`/`journey_steps`/`client_journey_progress`/`client_step_status` tables.
- Seed PERSEA's Phase 1 "Identity" program from `persea/methodology/phase-1-identity.json`.
- Client Dashboard: welcome, progress ring, current phase, outstanding tasks (wired to real journey state).
- **Demo:** admin invites a client, client signs in, sees dashboard reflecting seeded journey.

## Milestone 2 — Questionnaire Module
- `questionnaires`/`questionnaire_questions`/`questionnaire_responses`/`questionnaire_answers`.
- Seed Identity Questionnaire from `persea/methodology/questionnaire-identity.json`.
- Client Questionnaire page (FormStepper, save-as-you-go, submit).
- Admin Questionnaire Review tab (read answers).
- Journey step auto-completes on submit.
- **Demo:** client completes questionnaire end-to-end; admin sees submitted answers.

## Milestone 3 — AI Workspace + Questionnaire Analysis
- `ai_prompt_templates`, `ai_generations` tables.
- Edge Function `ai-generate` (Claude call, prompt interpolation, versioned insert).
- Seed `questionnaire-analysis` prompt template from `persea/prompts/`.
- Admin "Generate Analysis" button + `AIGenerationPanel` + `VersionHistoryDrawer` (regeneration).
- **Demo:** admin generates, views, and regenerates a questionnaire analysis with visible version history.

## Milestone 4 — Meetings + Transcript Analysis
- `meetings` table, Storage bucket for transcripts, upload UI.
- `transcript_analysis` prompt template + `ai-generate` reuse.
- Admin Meetings tab: upload → analyze → view structured output.
- **Demo:** admin uploads a transcript, gets AI-generated summary/goals/action items/homework/insights.

## Milestone 5 — Document Engine + Playbook Engine
- `playbook_section_definitions`, `playbooks`, `playbook_versions` tables.
- Generic Document Engine (`agency-framework/document-engine/`) + Playbook Engine specialization.
- `playbook_generator` prompt template combining questionnaire + transcript + both analyses.
- Admin Playbook Editor: generate v1, section-by-section edit, save draft.
- Client Playbook page (read-only, hidden until published).
- **Demo:** admin generates and edits a full 13-section playbook draft.

## Milestone 6 — Publish Flow + Notifications
- `notifications` table + realtime subscription + `NotificationBell`.
- Publish Edge Function/flow: version cut, `current_version_id` update, client notification, `activity_events` log.
- **Demo:** admin publishes, client instantly sees "New Playbook Available" and can read it; version history preserved and browsable by admin.

## Milestone 7 — Assessment + Pitch Generator
- `assessment_definitions`/`client_assessments` (configurable, PERSEA's Archetype Test as seeded data).
- `pitches` table + `pitch_generator` prompt template + Pitch Editor/Page.
- **Demo:** admin marks archetype test complete; generates and edits all pitch variants; client views them.

## Milestone 8 — Homework Engine
- `homework_task_templates`/`client_homework_tasks` + completion % view.
- Client Homework page, Admin Homework tab, dashboard completion indicators.
- **Demo:** client checks off tasks and submits reflection text; completion % updates live on both sides.

## Milestone 9 — Activity Timeline + Meeting Preparation Dashboard
- `activity_events` table + event emission wired into all prior milestones (retrofit lightweight logging calls).
- Client Activity page.
- Admin Meeting Preparation Dashboard: aggregate rollup (questionnaire/homework/playbook-viewed/questions submitted/AI summary/attention areas).
- **Demo:** full pre-Meeting-2 admin view populated from real client activity.

## Milestone 10 — Resources, Polish, Hardening
- `resources` table + simple resource list UI (used sparingly in MVP — mainly plumbing for later phases).
- RLS audit across all tables (verify client can't read other clients' rows, verify tenant isolation even with one tenant).
- Empty states, loading states, error toasts across all screens.
- Responsive/accessibility pass (keyboard nav, contrast, focus states) per "premium SaaS" bar.
- Seed script consolidation (`supabase/seed/seed-persea-tenant.sql`) so a fresh environment stands up PERSEA in one command.

## Explicit Non-Goals for MVP (documented so future phases aren't blocked by wrong assumptions)
- No automatic transcription (manual upload only; architecture leaves the slot open).
- No email delivery integration (in-app notifications only; `notifications` table is provider-agnostic for later email/SMS fanout).
- No team-member permission granularity beyond the role stub.
- No second tenant — but zero framework code should need to change to add one.
