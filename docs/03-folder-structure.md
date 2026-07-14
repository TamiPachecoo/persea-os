# PERSEA Operating System — Folder Structure

```
persea-os/
├── docs/                              # planning deliverables (this set of docs)
│
├── agency-framework/                  # REUSABLE — no PERSEA-specific copy/logic
│   ├── ui/                            # design-system: framework-agnostic components
│   │   ├── components/
│   │   │   ├── button.js
│   │   │   ├── card.js
│   │   │   ├── modal.js
│   │   │   ├── progress-bar.js
│   │   │   ├── toast.js
│   │   │   ├── form-controls.js
│   │   │   └── nav.js
│   │   ├── styles/
│   │   │   ├── tailwind.config.js
│   │   │   └── base.css
│   │   └── icons/
│   │
│   ├── auth/
│   │   ├── api.js                     # supabase-js wrapper: sign in, invite accept, session
│   │   └── guard.js                   # page-level auth/role guard
│   │
│   ├── crm-engine/
│   │   └── api.js                     # clients CRUD, invites
│   │
│   ├── journey-engine/
│   │   ├── api.js                     # programs/phases/steps, progress read/write
│   │   └── state-machine.js           # generic step unlock/complete logic
│   │
│   ├── meetings/
│   │   └── api.js                     # meeting CRUD, transcript upload
│   │
│   ai-engine/
│   │   ├── api.js                     # calls ai-generate edge function, reads ai_generations
│   │   └── version-view.js            # generic version history UI logic
│   │
│   ├── document-engine/               # generic versioned/sectioned doc engine
│   │   ├── api.js                     # underlies Playbook Engine
│   │   └── editor.js                  # section editor UI logic
│   │
│   ├── playbook-engine/
│   │   └── api.js                     # thin specialization of document-engine
│   │
│   ├── homework-engine/
│   │   └── api.js
│   │
│   ├── assessment-engine/
│   │   └── api.js
│   │
│   ├── notifications/
│   │   └── api.js
│   │
│   ├── resources/
│   │   └── api.js
│   │
│   └── activity-timeline/
│       └── api.js
│
├── persea/                            # TENANT CONFIGURATION — PERSEA-specific data
│   ├── config/
│   │   └── tenant.json
│   ├── branding/
│   │   ├── theme.js                   # Tailwind token overrides
│   │   └── logo.svg
│   ├── methodology/
│   │   ├── phase-1-identity.json      # program/phases/steps definition
│   │   ├── questionnaire-identity.json
│   │   └── playbook-sections.json
│   ├── prompts/
│   │   ├── questionnaire-analysis.md
│   │   ├── transcript-analysis.md
│   │   ├── playbook-generator.md
│   │   └── pitch-generator.md
│   └── rules/
│       └── homework-templates.json
│
├── app/                                # actual screens (HTML + per-page JS controllers)
│   ├── auth/
│   │   ├── sign-in.html / sign-in.js
│   │   └── accept-invite.html / accept-invite.js
│   ├── client/
│   │   ├── dashboard.html / dashboard.js
│   │   ├── questionnaire.html / questionnaire.js
│   │   ├── playbook.html / playbook.js
│   │   ├── pitch.html / pitch.js
│   │   ├── assessment.html / assessment.js
│   │   ├── homework.html / homework.js
│   │   └── activity.html / activity.js
│   └── admin/
│       ├── dashboard.html / dashboard.js
│       ├── clients-list.html / clients-list.js
│       ├── client-detail.html / client-detail.js
│       ├── questionnaire-review.html / questionnaire-review.js
│       ├── meeting-upload.html / meeting-upload.js
│       ├── transcript-analysis.html / transcript-analysis.js
│       ├── playbook-editor.html / playbook-editor.js
│       ├── pitch-editor.html / pitch-editor.js
│       ├── meeting-prep.html / meeting-prep.js
│       └── settings.html / settings.js
│
├── supabase/
│   ├── migrations/                     # SQL migration files, timestamped
│   ├── functions/
│   │   ├── ai-generate/                # Edge Function: prompt interpolation + Claude call
│   │   ├── send-notification/
│   │   └── publish-playbook/           # Edge Function: version cut + notification trigger
│   └── seed/
│       └── seed-persea-tenant.sql      # seeds tenant + programs + questionnaire from persea/ json
│
├── .env.example
├── package.json                        # dev tooling only (Tailwind CLI, supabase CLI scripts)
└── README.md
```

## Rules of the boundary

1. Nothing under `agency-framework/` may import from `persea/`. Framework code receives config as data at runtime (fetched from DB, seeded from `persea/`), never imports the JSON directly.
2. `app/` screens may import both `agency-framework/ui` (components) and call `agency-framework/*-engine/api.js` (data), and read tenant-specific copy from DB (seeded from `persea/`) — never hardcode PERSEA wording in `app/` JS beyond generic labels.
3. `persea/` is pure configuration/content — no executable business logic beyond simple JSON.
4. A second tenant, in the future, adds `tenants/<name>/` next to `persea/` with the same shape; `app/` and `agency-framework/` are untouched.
