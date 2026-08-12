# PERSEA Operating System — Architecture (Phase 1 / MVP)

## 1. Core Principle

PERSEA is not an app for one consultant — it is a **multi-tenant Consulting Operating System**. Nay Murta's business ("PERSEA") is tenant #1. Every table, engine, and screen must work if a second, unrelated coach signs up tomorrow with a completely different methodology.

Two codebases, conceptually:

- **`agency-framework/`** — the reusable OS. No mention of "Nay," "Identity," "Playbook wording," or any PERSEA-specific copy. Only generic concepts: Programs, Phases, Steps, Questionnaires, Meetings, AI Documents, Assessments, Homework, Notifications.
- **`persea/`** — configuration data that instantiates the framework for this one tenant: the actual Phase 1 "Identity" program definition, the questionnaire questions, the playbook section templates, the AI prompts, the brand (colors/logo/voice).

Nothing tenant-specific is hardcoded in framework code. If it can be configured, it lives in `persea/` as data (JSON/YAML/DB rows), not in framework logic.

**The client lifecycle does not begin at Phase 1.** It begins the moment a lead becomes a client: **Lead → Client → Onboarding → Mentorship Access → Phase 1 → Phase 2 → Phase 3 → Phase 4 → Ongoing Support.** See §9 below for how the onboarding stage maps onto the engines in §3, and [`PERSEA_METHODOLOGY.md`](PERSEA_METHODOLOGY.md) for the full onboarding workflow. (Note: this document's own title, "Phase 1 / MVP," refers to a *delivery milestone* of the software build — an unrelated overload of "Phase 1" from the Identity methodology phase referenced throughout the rest of this doc and in §9.)

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

## 9. Client Onboarding Workflow — Engine Mapping (Pre-Mentorship)

Onboarding precedes Phase 1 (see the addendum to §1 above). The full narrative workflow — client-information fields, the conceptual contract-status vocabulary, the external-signature sequence, WhatsApp milestone tracking, and classes/resources — lives in [`PERSEA_METHODOLOGY.md`](PERSEA_METHODOLOGY.md). This section only maps those six onboarding steps onto the engines already described in §3, per the same "extend, don't invent" principle already stated above: nothing here is a new engine.

### 9.1 Step → Engine Mapping

| Onboarding Step | Extends Engine(s) | What "extending" would mean |
|---|---|---|
| 1. Client Information Collection | CRM Engine | New fields on `clients` (party type PF/PJ, CPF/CNPJ, company name, address, phone/WhatsApp) — exact fields not finalized. This is regulated PII flowing through the CRM Engine; RLS/tenant isolation (§6) applies to it like any other client data. |
| 2. Contract Preparation | Document Engine + CRM Engine | A future thin specialization (e.g. `contract-engine/`), the same shape as `playbook-engine/`: template + editable fields + version/status tracking. Status surfaced on the client record. |
| 3. External Contract Signature | Document Engine (status field only) | No signing logic — just a status value moving through the conceptual vocabulary in `PERSEA_METHODOLOGY.md` §2.2. See the non-integration callout in §9.3. |
| 4. Signed Contract Access | Document Engine | Admin-uploaded file on the client record, client-readable — the same client-visibility pattern already used for published Playbooks. |
| 5. WhatsApp Community/Group | CRM Engine (milestone flag) + Notifications | Not a new engine — a flag/milestone on the client record. See the non-integration callout in §9.3. |
| 6. Online Classes/Initial Resources | Resources engine (+ Journey Engine, if formalized as a phase) | The existing `resources` table already has a nullable `step_id` ("can be general" per its schema comment) — a plausible home without deciding hosting location. |

### 9.2 Onboarding as a Journey Engine Program/Phase

The cleanest mechanism for formalizing "Onboarding" — whenever it's actually built — is to model it as a `program` (or phase) with an `order_index` before "Identity" in `programs`, reusing `program_phases`/`journey_steps`/`client_journey_progress`/`client_step_status` exactly as they already exist. §8 above already licenses this: *"New consulting phases (beyond 'Identity') = new rows in `programs`/`phases`/`steps`, not new tables or new code paths."* That sentence already covers Onboarding as a phase — no new engine is required.

The client-facing progression bar described in `PERSEA_METHODOLOGY.md` §3 would naturally be driven by the Experience Engine concept in `10-platform-architecture-review.md` §9 (`unlock_condition`s, milestones, reminders) once that's built — not being built now.

### 9.3 Non-Integration Callouts

Following the same idiom already used in §5 for transcript upload ("architecture leaves a clean slot for swapping in an auto-transcription provider later"):

- **No e-signature platform integration now** — leaves a clean slot for a future signature-provider API to write into the same contract-status field later.
- **No WhatsApp API integration now** — leaves a clean slot for a future WhatsApp Business API/bot to set the group-membership flag automatically later.
- **No LMS/classes-hosting decision now** — the generic Resources engine (`link`/`file`/`video` types) leaves room for classes to live inside Persea OS or externally without committing yet.

### 9.4 Follow-Up Passes Required (Not Done This Pass)

- `docs/05-user-flows.md` needs a new or amended flow for the concrete onboarding steps. Note that its existing "Flow 1 — Client Onboarding" currently means account activation only (invite → password → dashboard) and will need renaming or reconciling against this broader usage.
- `docs/02-database-schema.md` needs concrete field/table additions (client legal fields, a contract-status enum, a WhatsApp-milestone flag) once the open questions in `PERSEA_METHODOLOGY.md` §5 are resolved.
- See [`REDESIGN_NOTES.md`](REDESIGN_NOTES.md) (2026-08-12 entry) for the full audit trail behind this section.
