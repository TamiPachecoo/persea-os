# PERSEA Operating System — Component Hierarchy

Vanilla-JS "components" here are DOM-rendering functions/classes in `agency-framework/ui/components/`, not a framework's component tree — but they compose the same way.

## Shared UI Kit (`agency-framework/ui/components/`)

- **Layout**
  - `AppShell` — sidebar/topbar wrapper, role-aware nav (admin vs client), used by every `app/` page
    - `SidebarNav` — nav items driven by config (admin nav vs client nav)
    - `TopBar` — user menu, notifications bell, tenant logo
  - `PageHeader` — title + breadcrumb + primary action slot
  - `Card` — generic content container (used everywhere: dashboard tiles, playbook sections)
  - `Modal` — confirm dialogs, upload dialogs, publish confirmation
  - `Toast` — success/error feedback

- **Data display**
  - `ProgressBar` / `ProgressRing` — used for journey progress, homework completion %
  - `StatusBadge` — locked/available/in_progress/completed, draft/published
  - `Timeline` — activity timeline list (event icon + text + timestamp)
  - `EmptyState` — "no meetings yet" etc.

- **Forms**
  - `TextInput`, `TextArea`, `SingleChoice`, `MultiChoice`, `ScaleInput` — driven by `questionnaire_questions.input_type`
  - `FileUpload` — transcript upload, drag/drop
  - `FormStepper` — multi-question questionnaire flow with save-as-you-go

- **AI-specific**
  - `AIGenerationPanel` — shows current AI output, "Regenerate" button, edit toggle
  - `VersionHistoryDrawer` — lists prior `ai_generations`/`playbook_versions`, diff/view
  - `PromptDebugView` (admin-only) — shows stored prompt for a generation (transparency/debug)

## Admin App Composition (`app/admin/`)

```
AdminAppShell
├── AdminDashboard
│   ├── ClientsOverviewCard (counts by status)
│   ├── UpcomingMeetingsCard
│   └── AttentionNeededCard (stalled clients)
│
├── ClientsList
│   └── ClientRow[] (status badge, journey progress ring)
│
├── ClientDetail
│   ├── ClientHeader (profile, status, invite controls)
│   ├── JourneyProgressTracker (steps 1–12 as a stepper)
│   ├── QuestionnaireReviewTab
│   │   └── AIGenerationPanel (questionnaire analysis)
│   ├── MeetingsTab
│   │   ├── MeetingUploadForm
│   │   └── AIGenerationPanel (transcript analysis)
│   ├── PlaybookEditorTab
│   │   ├── SectionEditor[] (13 sections, editable rich text)
│   │   ├── VersionHistoryDrawer
│   │   └── PublishButton (+ ConfirmModal)
│   ├── PitchEditorTab
│   │   └── PitchVariantEditor[] (10s/30s/60s/networking/IG bio/LinkedIn)
│   ├── AssessmentTab (external URL + completion toggle)
│   ├── HomeworkTab (task templates + per-client completion)
│   └── ActivityTab (Timeline)
│
└── MeetingPrepDashboard (per client, pre-Meeting-2 view)
    ├── ChecklistCard (questionnaire done / homework % / playbook viewed / questions submitted)
    ├── AISummaryCard
    └── AreasNeedingAttentionCard
```

## Client App Composition (`app/client/`)

```
ClientAppShell
├── ClientDashboard
│   ├── WelcomeHeader
│   ├── ProgressRing (overall journey %)
│   ├── CurrentPhaseCard
│   ├── OutstandingTasksCard (links to questionnaire/homework)
│   └── UpcomingMeetingCard
│
├── QuestionnairePage
│   └── FormStepper (question-by-question, save-as-you-go, submit)
│
├── PlaybookPage
│   ├── SectionNav (13 sections, jump links)
│   ├── SectionView[] (read-only rendered content)
│   └── VersionBadge (subtle "v2" indicator, admin-published only)
│
├── PitchPage
│   └── PitchVariantCard[] (copy-to-clipboard per variant)
│
├── AssessmentPage
│   └── ExternalAssessmentCard (title, description, "Take Test" link, completion toggle)
│
├── HomeworkPage
│   ├── TaskList (checkbox + text submission types)
│   └── ProgressBar (completion %)
│
└── ActivityPage
    └── Timeline
```

## Cross-cutting

- `NotificationBell` (in `TopBar`) — realtime subscription to `notifications` table, unread count badge.
- `RoleGuard` wraps every page controller: redirects unauthenticated → sign-in, wrong-role → their own dashboard.
- `SessionProvider` (singleton `session.js`) — hydrates current user, role, tenant branding once per page load; all components read from it rather than re-fetching.
