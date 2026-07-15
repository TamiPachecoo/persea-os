# PERSEA Operating System — Platform Architecture Review

Recommendation-by-recommendation audit of the approved architecture against the ten-engine platform vision, followed by an updated platform architecture, schema, folder structure, dependency graph, and roadmap. No implementation in this pass.

**Verdict:** the pipeline design generalizes cleanly — the gap is that it was scoped as an application, not yet wired as a platform module.

> Note: this review was drafted against the generic "Presentation Studio" spec before this repo's actual `agency-framework/` vs `persea/` split (see [03-folder-structure.md](03-folder-structure.md)) was cross-checked in detail. The repo already implements much of the framework/tenant boundary described below (e.g. `journey-engine/`, `ai-engine/`, `document-engine/` already exist as separate framework modules). Treat engine names here as the target shape to reconcile against the existing `agency-framework/` layout, not a from-scratch proposal.

---

## Part A — Recommendation Review

### 1. AI Engine

Nothing should call Claude or OpenAI directly — every AI feature goes through one internal engine.

- **Supported today?** Partially. A provider-agnostic `ai-engine/api.js` already exists in `agency-framework/`, which gives provider swapping, but it has no prompt versioning, no context assembly, no routing logic, no cost ledger as separate concerns.
- **How to incorporate.** Expand `ai-engine/` internals into distinct responsibilities:
  - **Prompt Manager** — loads a named, versioned prompt from the Prompt Library rather than a literal string in caller code.
  - **Context Builder** — assembles the actual payload sent to the model: prompt template + content excerpts + brand voice tokens + tenant overrides. Currently missing — callers build context ad hoc.
  - **Model Router** — chooses a model/provider per job type and cost tier.
  - **Provider Abstraction Layer** — one interface (`generate(request): AIResponse`), adapters per provider; callers never import an SDK directly.
  - **Response Validator** — validates AI output against the expected schema before persisting; rejects/retries malformed output.
  - **Version History** — every generation records which prompt version + model produced it.
  - **Cost Tracking / AI Logs** — every call logged with token counts, cost, latency, caller module.
- **Impact.** *Scalability*: new engines get AI for free instead of re-solving provider integration. *Maintainability*: a provider outage or pricing change is a one-file fix. *Reusability*: cost tracking and prompt versioning become platform-wide data from day one.
- **Database changes.** `ai_generations` gains `prompt_id`, `prompt_version`, `provider`, `model`, `input_tokens`, `output_tokens`, `cost_usd`, `caller_module`. New table `ai_logs` for raw request/response pairs (short retention).
- **Folder changes.** `ai-engine/` gains `prompt-manager/`, `context-builder/`, `model-router/`, `providers/`, `response-validator/`, `cost-tracking/` as internal submodules instead of one flat `api.js`.
- **Placement.** Core Platform (`agency-framework/`).

### 2. Business Configuration Layer

Program → Modules → Sessions → Tasks → Deliverables → Milestones → Resources → Automations → Completion Rules, as data, not code.

- **Supported today?** Partially. `journey-engine/` already models Programs/Phases/Steps with a generic state machine — real groundwork. Missing: Deliverables, Milestones, Resources, Automations, and Completion Rules as distinct first-class entities (currently folded informally into Steps).
- **How to incorporate.** Extend the existing `journey-engine/` schema rather than building a parallel module — add `deliverables`, `milestones`, `resources`, `automations`, `completion_rules` tables, all keyed to a `methodology_id`/`program_id`. PERSEA's Phase 1 "Identity" program (already in `persea/methodology/`) becomes one instance of this schema, not schema itself.
- **Impact.** *Scalability*: lets a second consultant define a wholly different methodology without a deploy. *Maintainability*: methodology changes become data edits, not code changes. *Reusability*: this is what turns the repo from "an app built for PERSEA" into "a framework PERSEA happens to configure."
- **Database changes.** New tables: `deliverables`, `milestones`, `resources`, `automations`, `completion_rules`, all carrying the owning `program_id`/`phase_id`/`step_id`.
- **Folder changes.** `journey-engine/` gains `deliverables.js`, `milestones.js`, `automations.js` alongside the existing `state-machine.js`.
- **Placement.** Core Platform (mechanism) + Client Configuration (`persea/methodology/` — PERSEA's actual program content).

### 3. Brand Engine

Every generated artifact should inherit a client's visual and verbal identity automatically.

- **Supported today?** Partially. `persea/branding/theme.js` covers Tailwind token overrides and logo — real groundwork, but scoped as a single tenant's override file rather than a reusable schema, and has no photography/illustration style or voice & tone.
- **How to incorporate.** Formalize a `BrandProfile` schema in `agency-framework/` that `persea/branding/theme.js` becomes one instance of. Add a `voiceTone` block that the AI Engine's Context Builder pulls into every generation prompt automatically — this is what makes "inherit brand automatically" true rather than something each caller has to remember to apply.
- **Impact.** *Scalability*: onboarding a new tenant becomes "fill in one Brand Profile." *Maintainability*: a brand update propagates everywhere at once. *Reusability*: lets the platform look bespoke per client while sharing all rendering code.
- **Database changes.** New `brand_profiles` table: `tenant_id`, `colors jsonb`, `typography jsonb`, `spacing jsonb`, `logo_asset_id`, `photography_style jsonb`, `illustration_style jsonb`, `voice_tone jsonb`.
- **Folder changes.** New `agency-framework/brand-engine/` (schema + defaults); `persea/branding/` becomes the tenant's data feeding it, not a standalone override file.
- **Placement.** Core Platform (engine) + Client Configuration (`persea/branding/` values).

### 4. Presentation Engine

Not yet built in this repo — the prior "Presentation Studio" design (source-agnostic ingest, extract, analyze, compose, render) applies directly here as a new sibling engine.

- **Supported today?** No, but the existing `document-engine/` (generic versioned/sectioned document engine underlying `playbook-engine/`) is architecturally the right precedent to extend from, rather than building presentations from scratch.
- **How to incorporate.** New `agency-framework/presentation-engine/`, following the five-stage pipeline (ingest → extract → analyze → compose → render) from the prior review, with `layout-packs/` and `animation-packs/` as swappable bundles. Shares `ai-engine/` and the new `asset-engine/` (below) rather than owning its own.
- **Impact.** *Scalability*: new input formats (DOCX, PPTX, Markdown) are new adapters, not pipeline rewrites. *Reusability*: layout/animation packs let a new client get a distinct visual feel via configuration.
- **Database changes.** New tables: `presentation_projects`, `slide_decks`, `slides`, `interactive_elements`.
- **Folder changes.** New top-level module under `agency-framework/presentation-engine/`.
- **Placement.** Core Platform.

### 5. Document Engine

Playbooks, reports, homework, summaries, proposals — already the closest thing this repo has to a platform-grade engine.

- **Supported today?** Yes, substantially. `document-engine/` already exists as a generic versioned/sectioned engine with `playbook-engine/` as a thin specialization — exactly the right shape.
- **How to incorporate.** Extend `document-engine/` with additional specializations (`report-engine/`, `proposal-engine/`) following the `playbook-engine/` pattern, rather than building new document logic per type. `homework-engine/` (already present) is the model for how new document types should be added: thin specialization, not new pipeline.
- **Impact.** *Scalability*: every future document type is a thin specialization file, not a new pipeline. *Maintainability*: keeps section-editing and versioning logic in one place.
- **Database changes.** Confirm `document_bodies`/`document_sections` (or equivalent existing tables) can reference `content_graphs` if/when Presentation Engine's extraction stage is shared with Document Engine for PDF-sourced documents.
- **Folder changes.** None required beyond adding new specialization folders alongside `playbook-engine/` and `homework-engine/`.
- **Placement.** Core Platform.

### 6. Prompt Library

AI prompts should never be hardcoded inside application logic.

- **Supported today?** Partially. `persea/prompts/` already exists as markdown files, separated from code — a good instinct — but they're not versioned, categorized, or resolvable at runtime from a DB-backed library; they're static files a tenant edits directly.
- **How to incorporate.** Move prompt *content* into the database, owned by `ai-engine/`'s Prompt Manager. `persea/prompts/*.md` becomes the seed data loaded into `prompt_versions` on tenant setup, not the runtime source of truth. Code keeps only call sites (`promptManager.get("playbook-generator", { version: "latest" })`).
- **Impact.** *Scalability*: new prompt categories are data, addable without a deploy. *Maintainability*: prompt regressions become revertible data changes with a diff. *Reusability*: a new tenant can tune prompt voice the same way they configure branding.
- **Database changes.** New tables `prompts` (`id`, `category`, `key`, `tenant_id` nullable), `prompt_versions` (`prompt_id`, `version`, `template`, `variables_schema jsonb`, `is_active`).
- **Folder changes.** `persea/prompts/*.md` → seed data under `agency-framework/ai-engine/prompt-manager/seed-prompts/`, loaded per tenant.
- **Placement.** Core Platform (mechanism) + Client Configuration (`persea/prompts/` content as seed data).

### 7. Asset Management

One asset library, referenced everywhere, never duplicated.

- **Supported today?** No dedicated module yet — assets (transcripts, logo, uploaded files) appear to be handled ad hoc per feature (Supabase Storage per `01-architecture.md`) rather than through a shared library with reuse tracking.
- **How to incorporate.** New `agency-framework/asset-engine/`: tenant-scoped (not per-project) asset storage with a join table tracking where each asset is used, so a logo or icon uploaded once is referenced everywhere rather than re-uploaded.
- **Impact.** *Scalability*: storage cost and asset sprawl stay flat as project count grows. *Maintainability*: one place to replace a stale asset. *Reusability*: consistent asset identity across every artifact type generated for a tenant.
- **Database changes.** New `assets` (`tenant_id`, `kind`, `storage_path`) and `asset_usages` (`asset_id`, `used_by_type`, `used_by_id`) tables.
- **Folder changes.** New top-level `agency-framework/asset-engine/`.
- **Placement.** Core Platform.

### 8. Analytics Engine

Track usage, adoption, progress, engagement, AI cost — feeding future dashboards.

- **Supported today?** No. `activity-timeline/` exists but is a display feature, not an events/analytics layer other engines can emit into.
- **How to incorporate.** New `agency-framework/analytics-engine/` as a thin, append-only event layer — every engine emits typed events (`playbook.viewed`, `homework.completed`, `milestone.reached`, `ai.generation.completed`) via one `track()` call. `activity-timeline/` becomes a consumer/view over these events rather than a separate write path.
- **Impact.** *Scalability*: append-only events scale independently and can move to a warehouse later. *Maintainability*: one tracking call shape platform-wide. *Reusability*: client-progress and adoption data becomes a sellable insight layer for every future tenant.
- **Database changes.** New `events` table: `id`, `tenant_id`, `user_id`, `event_type`, `subject_type`, `subject_id`, `payload jsonb`, `occurred_at`.
- **Folder changes.** New `agency-framework/analytics-engine/` with `track.js`, `event-types.js`.
- **Placement.** Core Platform.

### 9. Experience Engine

Orchestrates the client journey — unlocks, milestones, reminders — rather than just storing information.

- **Supported today?** Partially. `journey-engine/state-machine.js` already implements generic step unlock/complete logic — this is the right foundation. Missing: achievements/celebrations, reminders, and expressing unlock conditions as declarative data rather than logic embedded in the state machine.
- **How to incorporate.** Extend `journey-engine/` with an `unlock_condition` field on steps/milestones (e.g. `milestone:"E1_complete"`), evaluated by a rules evaluator subscribed to the new `events` table (§8) — this is what makes "Meeting 2 unlocks after Meeting 1" configuration, not conditional code in `state-machine.js`. Add `achievements` and `reminders` tables, with reminder/celebration delivery routed through `notifications/`.
- **Impact.** *Scalability*: a second methodology with a different unlock shape needs zero framework code changes. *Maintainability*: journey logic lives in one evaluator instead of scattered conditionals. *Reusability*: delivers "orchestrate the client journey" as a platform capability, not a PERSEA feature.
- **Database changes.** New `achievements`, `reminders` tables; `automations`/`completion_rules` (§2) gain `unlock_condition`.
- **Folder changes.** `journey-engine/` gains `rules-evaluator.js`; existing `notifications/api.js` becomes the delivery layer it calls into.
- **Placement.** Core Platform (evaluator) + Client Configuration (PERSEA's specific unlock rules as data).

### 10. Modular Platform

The platform is a set of engines every client reuses; business behavior is configuration on top.

- **Supported today?** Largely, structurally — the `agency-framework/` vs `persea/` boundary (`03-folder-structure.md`) already encodes this principle better than the generic review assumed. What's missing is the additional engines above (Brand, Asset, Analytics, formalized Prompt Library, Presentation) and enforcement that nothing tenant-specific leaks into `agency-framework/`.
- **How to incorporate.** Treat §1–9 as the concrete gap list against the boundary already established in this repo, not a redesign of the boundary itself.
- **Placement.** Core Platform.

---

## Part B — Final Deliverables

### 1. Architecture Evaluation

- **What holds up:** the `agency-framework/` vs `persea/` boundary, and `journey-engine/`'s generic state machine — both are exactly the pattern a multi-tenant platform needs and require extension, not rework.
- **What was scoped too narrowly:** AI Engine, Prompt Library, and Branding were each built as a single working mechanism without being generalized into a reusable, versioned schema — the fix is formalizing what already works, not replacing it.
- **What was genuinely absent:** Asset Management and Analytics Engine as distinct modules; Deliverables/Milestones/Automations/Completion Rules as first-class entities in the journey model.

### 2. Updated Platform Architecture

```
Client-facing engines
  presentation-engine · document-engine (+ playbook/homework/report specializations)
  journey-engine · crm-engine
        │ consume
        ▼
Foundation engines
  ai-engine · brand-engine · asset-engine · notifications · analytics-engine
        │ governed by
        ▼
Configuration layer (per tenant)
  journey-engine data (programs/phases/steps/deliverables/milestones)
  prompt-manager overrides · brand-engine profile
        │ secured by
        ▼
Platform bedrock
  auth · multi-tenant Postgres (Supabase, RLS by tenant_id)
```

Rule this encodes: client-facing engines never talk to external providers directly — `presentation-engine` never imports an AI SDK, `document-engine` never touches Storage directly. Everything routes through the foundation layer, so a provider swap or storage migration is a one-module change.

### 3. Updated Database Design

| Group | Tables |
|---|---|
| Bedrock | `tenants`, `users`, `tenant_members` |
| AI Engine | `ai_generations` (+cost/version columns), `ai_logs`, `prompts`, `prompt_versions` |
| Journey/Business Config | `programs`, `phases`, `steps`, `deliverables`, `milestones`, `resources`, `automations`, `completion_rules` |
| Brand Engine | `brand_profiles` |
| Presentation/Document | `presentation_projects`, `slide_decks`, `slides`, `document_bodies`, `document_sections` |
| Asset Engine | `assets`, `asset_usages` |
| Analytics/Experience | `events`, `achievements`, `reminders` |

Every table carries `tenant_id` (directly or via FK chain); RLS enforces isolation at the database layer — already the plan per `03-folder-structure.md`, applied uniformly as new engines land.

### 4. Updated Folder Structure

```
persea-os/
├── docs/
├── agency-framework/
│   ├── ai-engine/
│   │   ├── prompt-manager/seed-prompts/
│   │   ├── context-builder/
│   │   ├── model-router/
│   │   ├── providers/
│   │   ├── response-validator/
│   │   └── cost-tracking/
│   ├── brand-engine/                  # new
│   ├── asset-engine/                  # new
│   ├── analytics-engine/              # new
│   ├── auth/  crm-engine/
│   ├── journey-engine/
│   │   ├── api.js  state-machine.js
│   │   ├── deliverables.js  milestones.js  automations.js   # new
│   │   └── rules-evaluator.js                                # new
│   ├── meetings/
│   ├── document-engine/
│   │   ├── api.js  editor.js
│   │   └── playbook-engine/  homework-engine/  assessment-engine/
│   ├── presentation-engine/            # new
│   │   ├── ingest/ extract/ analyze/ compose/ render/
│   │   └── packs/layout-packs/  packs/animation-packs/
│   ├── notifications/  resources/  activity-timeline/
│   └── ui/
│
├── persea/                             # tenant configuration only
│   ├── config/  branding/  methodology/  prompts/  rules/
│
├── app/
├── supabase/
├── .env.example  package.json  README.md
```

### 5. Dependency Graph

| Engine | Depends on |
|---|---|
| presentation-engine | ai-engine, brand-engine, asset-engine, analytics-engine, journey-engine (deliverable linkage) |
| document-engine | ai-engine, brand-engine, asset-engine, analytics-engine, journey-engine |
| journey-engine | notifications, analytics-engine (reads events) |
| crm-engine | notifications, analytics-engine |
| ai-engine | none (leaf) — wraps external providers |
| brand-engine | asset-engine (logo/photography refs) |
| asset-engine | none (leaf) — Supabase Storage only |
| analytics-engine | none (leaf) |
| journey-engine (config) | none (leaf) — pure schema/data |

Everything client-facing sits at the top of the graph; nothing else depends on it — this is what lets any one of them be rebuilt without a ripple effect.

### 6. Reusable Platform Modules

AI Engine, Brand Engine, Asset Engine, Analytics Engine, Notifications, Journey Engine (mechanism), Document Engine + specializations, Presentation Engine, Auth, CRM Engine — everything under `agency-framework/`.

### 7. PERSEA-Specific Modules

Everything under `persea/`: `config/tenant.json`, `branding/`, `methodology/` (Phase 1 Identity program content, questionnaire), `prompts/` (as seed data), `rules/homework-templates.json`.

**Scope-creep test:** any PR adding tenant-specific logic or copy outside `persea/` is a boundary violation — already stated as Rule 1 in `03-folder-structure.md`; this review doesn't change that rule, only adds engines that must obey it.

### 8. Implementation Roadmap

1. **AI Engine formalization** — Prompt Manager, Context Builder, Model Router, Cost Tracking, backed by `prompts`/`prompt_versions`.
2. **Brand Engine + Asset Engine** — `brand_profiles`, `assets`/`asset_usages`, migrating `persea/branding/` to be tenant data feeding the schema.
3. **Journey Engine extension** — Deliverables/Milestones/Automations/Completion Rules tables, `unlock_condition` support.
4. **Analytics Engine** — `events` table, `track()` wired into existing engines first (Document/Journey, which already have real usage).
5. **Experience layer** — rules evaluator, achievements, reminders, wired to journey-engine's `unlock_condition`s.
6. **Presentation Engine** — new five-stage pipeline sibling to `document-engine/`, built against the now-formalized AI/Brand/Asset engines from step 1–2 (no throwaway work).
7. **Document Engine specializations** — report/proposal engines following the `playbook-engine/` pattern.
8. **Hardening** — audit for tenant-specific logic outside `persea/` per the §7 test.

---

*Platform Architecture Review — prepared for approval before further implementation. Builds on the existing `agency-framework/` vs `persea/` boundary established in [03-folder-structure.md](03-folder-structure.md).*
