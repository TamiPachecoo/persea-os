# PERSEA Operating System

A reusable Consulting Operating System, first instantiated for PERSEA (Nay Murta's methodology). See [`docs/`](docs/) for the complete Phase 1 / MVP plan before any implementation begins:

1. [Architecture](docs/01-architecture.md)
2. [Database Schema](docs/02-database-schema.md)
3. [Folder Structure](docs/03-folder-structure.md)
4. [Component Hierarchy](docs/04-component-hierarchy.md)
5. [User Flows](docs/05-user-flows.md)
6. [Screen List](docs/06-screen-list.md)
7. [Development Roadmap](docs/07-roadmap.md)

## Stack

- Frontend: HTML, TailwindCSS, vanilla JavaScript
- Backend: Supabase (Auth, Postgres + RLS, Storage, Edge Functions, Realtime)
- AI: Claude via a single Edge Function (`supabase/functions/ai-generate`)

## Structure at a glance

- `agency-framework/` — reusable engines and UI kit, no tenant-specific logic or copy.
- `persea/` — PERSEA's configuration: branding, methodology, prompts, business rules.
- `app/` — actual screens (admin + client), composed from the framework.
- `supabase/` — migrations, edge functions, seed data.

Status: **planning complete, implementation not yet started.** Next step: Milestone 0 in [the roadmap](docs/07-roadmap.md).
