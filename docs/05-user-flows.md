# PERSEA Operating System — User Flows

## Flow 1 — Client Onboarding

1. Admin creates client record in CRM → triggers `client_invites` row + email (or manual link share in MVP).
2. Client opens invite link → `accept-invite.html` → sets password → Supabase Auth account created → `profiles` row created with `role='client'` → linked to existing `clients.profile_id`.
3. Redirect to Client Dashboard. `client_journey_progress` initialized to first step of Program "Identity".

## Flow 2 — Identity Questionnaire

1. Client Dashboard shows "Outstanding Task: Complete Identity Questionnaire" (from `journey_steps` step_type='questionnaire').
2. Client → Questionnaire page → `FormStepper` renders questions from `questionnaire_questions`, saves answers incrementally (`questionnaire_answers` upsert per question) so nothing is lost on refresh.
3. On submit → `questionnaire_responses.status='submitted'`, `submitted_at` set → `activity_events` row created → `client_step_status` for this step → `completed` → next step unlocked.
4. Admin gets a notification ("Client X completed Identity Questionnaire").

## Flow 3 — AI Questionnaire Analysis

1. Admin opens Client Detail → Questionnaire Review tab → clicks "Generate Analysis".
2. Frontend calls `ai-engine/api.js` → Edge Function `ai-generate` with `generation_type='questionnaire_analysis'`, `input_refs={questionnaire_response_id}`.
3. Edge Function loads active `ai_prompt_templates` for that type, interpolates questionnaire answers, calls Claude, inserts `ai_generations` row, returns result.
4. `AIGenerationPanel` renders: Executive Summary, Strengths, Goals, Pain Points, Opportunities, Suggested Questions, Business Maturity.
5. Admin may click "Regenerate" (new `ai_generations` row, prior marked superseded) or proceed as-is — this analysis is reference material for Meeting 1, not directly client-facing in MVP.

## Flow 4 — Meeting 1 + Transcript Analysis

1. Admin → Meetings tab → creates `meetings` row, uploads transcript file → stored in Supabase Storage, `transcript_text` populated (MVP: paste/upload text; architecture leaves room for auto-transcription later).
2. `meetings.status='transcript_uploaded'`.
3. Admin clicks "Analyze Transcript" → `ai-generate` with `generation_type='transcript_analysis'`, context = transcript_text (+ optionally questionnaire analysis for continuity).
4. Output rendered: Meeting Summary, Goals, Challenges, Action Items, Homework, Key Insights → stored in `ai_generations`; `meetings.status='analyzed'`.

## Flow 5 — Playbook Generation & Publish

1. Admin → Playbook Editor tab → "Generate Playbook v1".
2. `ai-generate` with `generation_type='playbook_generation'`, context = questionnaire + questionnaire analysis + transcript + transcript analysis, prompt from `persea/prompts/playbook-generator.md`.
3. Output mapped into the 13 `playbook_section_definitions` → new `playbook_versions` row (`status='draft'`, `source_ai_generation_id` set).
4. Admin edits sections inline (SectionEditor) → saves update the same draft version (not a new version — edits before publish don't fork history).
5. Admin clicks "Publish" → confirm modal → `playbooks.current_version_id` set to this version, `playbook_versions.status='published'`, `published_at` set → `notifications` row created for client → `activity_events` logged.
6. Client Dashboard shows "New Playbook Available" → Playbook page renders published version only. Prior/future edits create new versions; full history stays queryable by admin (`VersionHistoryDrawer`).

## Flow 6 — Archetype Assessment

1. Admin configures `assessment_definitions` (title/description/external_url) once, at tenant setup.
2. Client Dashboard/journey shows assessment step → external link opens in new tab.
3. Client (or admin, in MVP, since it's an external tool) marks it complete → `client_assessments.status='completed'`.

## Flow 7 — Pitch Generation

1. Admin → Pitch Editor tab (unlocked after Playbook published) → "Generate Pitches".
2. `ai-generate` with `generation_type='pitch_generation'`, context = published playbook version.
3. Output populates `pitches` row: 10s/30s/60s/networking/IG bio/LinkedIn summary.
4. Admin edits/approves → visible to client on Pitch page once playbook is published (pitches inherit playbook's publish gate — no separate publish step needed for MVP).

## Flow 8 — Homework

1. Homework tasks seeded from `homework_task_templates` (Read Playbook, Practice Pitch, Reflection Questions, Submit Questions) tied to the post-playbook journey step.
2. Client Homework page shows checklist; boolean tasks toggle complete, text tasks require `submission_text`.
3. Completion % (view `client_homework_progress`) shown on both Client Dashboard and Admin Meeting Prep Dashboard.

## Flow 9 — Meeting Preparation Dashboard (pre–Meeting 2)

1. Admin opens Client Detail → Meeting Prep tab.
2. Aggregates: questionnaire completed?, homework completion %, playbook viewed (tracked via an `activity_events` 'playbook_viewed' event fired on client Playbook page load), questions submitted (homework task 'submit_questions' status), latest AI summary, and a computed "Areas Requiring Attention" list (e.g., incomplete homework items, unanswered reflection questions).
3. This is a read-only rollup — no new writes, purely aggregating existing engine data, proving the "no new hardcoded logic" principle.

## Flow 10 — Notifications (cross-cutting)

Triggered at: invite sent, questionnaire submitted (→ admin), playbook published (→ client), meeting analyzed (informational, admin-only in MVP), homework assigned (→ client). Realtime subscription updates the bell badge without page refresh.
