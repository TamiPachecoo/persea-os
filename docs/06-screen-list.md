# PERSEA Operating System — Screen List (Phase 1 / MVP)

## Auth

| Screen | Path | Notes |
|---|---|---|
| Sign In | `/auth/sign-in.html` | Email/password, Supabase Auth |
| Accept Invite | `/auth/accept-invite.html?token=` | Set password, creates profile+client link |
| Forgot Password | `/auth/forgot-password.html` | Supabase reset flow |

## Client App

| Screen | Path | Purpose |
|---|---|---|
| Client Dashboard | `/client/dashboard.html` | Welcome, progress, current phase, outstanding tasks, upcoming meeting |
| Identity Questionnaire | `/client/questionnaire.html` | Multi-step form, save-as-you-go |
| Playbook | `/client/playbook.html` | Read published playbook, 13 sections, jump nav |
| Pitch | `/client/pitch.html` | View/copy all pitch variants |
| Archetype Assessment | `/client/assessment.html` | External link + completion status |
| Homework | `/client/homework.html` | Task checklist + reflection submissions, completion % |
| Activity | `/client/activity.html` | Personal activity timeline |

## Admin App

| Screen | Path | Purpose |
|---|---|---|
| Admin Dashboard | `/admin/dashboard.html` | Clients overview, upcoming meetings, attention-needed clients |
| Clients List (CRM) | `/admin/clients-list.html` | All clients, status, tags, search/filter |
| Client Detail | `/admin/client-detail.html?id=` | Tabbed: Journey / Questionnaire / Meetings / Playbook / Pitch / Assessment / Homework / Activity |
| Questionnaire Review | (tab within Client Detail) | View answers + AI analysis, regenerate |
| Meeting Upload & Analysis | (tab within Client Detail) | Upload transcript, view/regenerate AI analysis |
| Playbook Editor | (tab within Client Detail) | Generate v1, edit sections, version history, publish |
| Pitch Editor | (tab within Client Detail) | Generate/edit pitch variants |
| Meeting Preparation Dashboard | (tab within Client Detail, or `/admin/meeting-prep.html?id=`) | Pre-Meeting-2 rollup view |
| Settings | `/admin/settings.html` | Tenant branding, prompt template management (view/edit active templates), assessment config |

## Shared

| Screen | Path | Purpose |
|---|---|---|
| 403 / Not Authorized | `/errors/403.html` | Role mismatch |
| 404 | `/errors/404.html` | Not found |

**Total MVP screens: ~20** (several are tabs within one Client Detail page rather than separate files, per the "one HTML file + one JS controller per screen" rule in the folder structure — tabs are sub-views within `client-detail.js`, not separate pages, since they share state and navigation context).
