# PERSEA Operating System — Architecture (Phase 1 / MVP)

## 1. Core Principle

PERSEA is not an app for one consultant — it is a **multi-tenant Consulting Operating System**. Nay Murta's business ("PERSEA") is tenant #1. Every table, engine, and screen must work if a second, unrelated coach signs up tomorrow with a completely different methodology.

Two codebases, conceptually:

- **`agency-framework/`** — the reusable OS. No mention of "Nay," "Identity," "Playbook wording," or any PERSEA-specific copy. Only generic concepts: Programs, Phases, Steps, Questionnaires, Meetings, AI Documents, Assessments, Homework, Notifications.
- **`persea/`** — configuration data that instantiates the framework for this one tenant: the actual Phase 1 "Identity" program definition, the questionnaire questions, the playbook section templates, the AI prompts, the brand (colors/logo/voice).

Nothing tenant-specific is hardcoded in framework code. If it can be configured, it lives in `persea/` as data (JSON/YAML/DB rows), not in framework logic.

## 2. High-Level System Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        Browser (Vanilla JS SPA-ish MPA)          │
│  HTML + TailwindCSS + JS modules, per-screen entry points        │
│  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────────┐    │
│  │  Admin App │ │ Client App │ │ Auth Pages │ │ Shared UI Kit │    │
│  └───────────┘ └───────────┘ └───────────┘ └───────────────┘    │
└───────────────────────────┬───────────────────────────────────┘
                             │ supabase-js
┌───────────────────────────▼───────────────────────────────────┐
│                          Supabase                               │
│  ┌────────────┐ ┌────────────┐ ┌───────────┐ ┌───────────────┐ │
│  │    Auth     │ │  Postgres   │ │  Storage  │ │ Edge Functions │ │
│  │ (email/pwd, │ │ + RLS       │ │(transcripts│ │  (AI calls,    │ │
│  │  invite)    │ │             │ │ ,assets)  │ │ webhooks, PDF) │ │
│  └────────────┘ └────────────┘ └───────────┘ └───────────────┘ │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ Realtime (task/status updates, notification badges)         │ │
│  └────────────────────────────────────────────────────────────┘ │
└───────────────────────────┬───────────────────────────────────┘
                             │
                    ┌────────▼────────┐
                    │  Anthropic API   │
                    │  (Claude) via    │
                    │  Edge Function   │
                    └──────────────────┘
```

## 3. Engines (Reusable, in `agency-framework/`)

Each "Required Module" from the brief maps to an engine. Engines are logic + schema contracts; they know nothing about PERSEA's specific wording.

| Engine | Responsibility |
|---|---|
| **Auth** | Supabase Auth wrapper: invite flow, sign in, role resolution (admin/client/team_member), session guard per page. |
| **CRM** | Client/lead records, contact info, tags, notes, lifecycle status. Tenant-scoped. |
| **Journey Engine** | Generic state machine: a `program` has ordered `phases`, each phase has ordered `steps` of typed `step_type` (questionnaire, meeting, ai_generation, review, assessment, publish, homework_set). Drives "what happens next" for both admin and client. |
| **Meetings** | Meeting records, transcript upload, linkage to AI analysis. |
| **AI Workspace** | Generic wrapper around Edge Function → Claude. Every AI call is logged as an `ai_generation` with input refs, prompt template used, output, version, editable flag. Nothing here knows what a "Playbook" is — it just generates/stores structured documents from a template + context. |
| **Playbook Engine** | A specialization of "Document Engine": versioned, sectioned documents generated from AI + edited by admin + published to client, with full version history. Section schema itself is configurable per program (PERSEA defines the 13 sections; another tenant could define different ones). |
| **Homework Engine** | Configurable task templates attached to a journey step; tracks per-client completion % and per-task status. |
| **Notifications** | In-app (and later email) notifications triggered by journey events (playbook published, homework assigned, meeting scheduled). |
| **Resources** | Tenant-configurable library of shareable assets/links (e.g., archetype test URL) attached to journey steps. |
| **Activity Timeline** | Append-only event log per client, powering both the client "progress" view and the admin "meeting prep dashboard." |

## 4. Tenant Configuration Layer (`persea/`)

- `persea/config/tenant.json` — tenant id, name, feature flags.
- `persea/branding/` — Tailwind theme tokens (colors, fonts), logo assets.
- `persea/methodology/phase-1-identity.json` — the actual Program → Phases → Steps definition described in the brief (Steps 1–12), referencing generic step_types.
- `persea/methodology/questionnaire-identity.json` — question definitions for the Identity Questionnaire.
- `persea/methodology/playbook-sections.json` — the 13 Playbook sections (Identity, Mission, Vision, Core Story, Golden Circle, Target Audience, Value Proposition, Positioning, Brand Voice, Communication Style, Goals, 30 Second Pitch, Action Plan).
- `persea/prompts/` — versioned prompt templates: questionnaire-analysis, transcript-analysis, playbook-generator, pitch-generator. Stored as text/markdown with `{{variables}}`, loaded by the AI Workspace engine and logged verbatim per generation (per the "Store prompt" requirement).
- `persea/rules/` — business rules that are PERSEA-specific but not hardcoded in engine code (e.g., which step unlocks which, homework task list wording).

This separation means adding "Consultant #2" later = new folder under a `tenants/` structure with its own config, zero changes to `agency-framework/`. For the MVP we ship one tenant, but the code path already resolves tenant config from `persea/`, never from inline constants.

## 5. AI Architecture

- All AI calls go through **one Edge Function**: `ai-generate`, parameterized by `{ generation_type, context_refs, prompt_template_id }`.
- The Edge Function: loads the prompt template (from `ai_prompt_templates` table, seeded from `persea/prompts/`), interpolates context (questionnaire answers, transcript text, prior playbook version, etc.), calls Claude, writes an immutable `ai_generations` row (prompt used, raw output, timestamp, input refs), and returns the result to the client for review.
- **Regeneration** creates a new `ai_generations` row (never overwrites); the UI always shows current + lets admin browse history.
- **Editability**: AI output is copied into an editable target (e.g., `playbook_versions.sections`) — admin edits live on the editable copy, the AI generation record stays pristine as provenance.
- Transcript upload MVP: file → Supabase Storage → text extracted client-side or via Edge Function → stored in `meetings.transcript_text` → fed to `ai-generate`. Architecture leaves a clean slot for swapping in an auto-transcription provider later (just changes how `transcript_text` gets populated).

## 6. Multi-Tenancy & Security Model

- Every business table carries `tenant_id` (UUID) even though MVP has one tenant — future-proofing per the brief.
- Supabase **Row Level Security** enforces:
  - Admins: full read/write within their `tenant_id`.
  - Clients: read/write only their own `client_id` rows, read-only on published content (playbooks, resources), and only within their `tenant_id`.
  - Team members: role-scoped, same tenant boundary (Phase 1 stub role, permissions refined later).
- Auth roles stored in a `profiles` table (`role`: admin | client | team_member) linked 1:1 to `auth.users`.

## 7. Frontend Architecture

- No SPA framework (per stack constraint) — a lightweight **multi-page app** with shared JS modules imported via `<script type="module">`.
- `agency-framework/ui/` holds a small design-system: buttons, cards, progress bars, modals, toasts, form controls — all Tailwind + vanilla JS, framework-agnostic (usable by any future tenant).
- Each screen = one HTML file + one JS controller module. Controllers call a thin **data-access layer** (`agency-framework/*-engine/api.js`) that wraps `supabase-js` calls — screens never call `supabase-js` directly, so swapping data sources later doesn't touch UI code.
- State that must persist across screens (current user/session, tenant config) lives in a small `session.js` singleton, hydrated on load from Supabase Auth + a `persea/config` fetch.

## 8. Why This Scales to Future Phases / Future Tenants

- New consulting phases (beyond "Identity") = new rows in `programs`/`phases`/`steps`, not new tables or new code paths — the Journey Engine is phase-agnostic.
- New tenants = new `persea/`-like config folder + new `tenant_id`, RLS already isolates data.
- New AI outputs = new prompt template + new `generation_type`, reusing the same Edge Function and versioning table.
