-- PERSEA Experience: personal invite codes (discounted guest checkout) and the
-- post-payment preparation form, both stored with each registration.

-- Invite codes: one personal code per inviting participant, N guest uses each.
create table if not exists public.event_invite_codes (
  id uuid primary key default gen_random_uuid(),
  event_slug text not null default 'persea-experience',
  code text not null unique,
  inviter_registration_id uuid references public.event_registrations(id) on delete cascade,
  max_uses integer not null default 2 check (max_uses >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.event_invite_codes enable row level security;
create policy event_invite_codes_staff_all on public.event_invite_codes
  for all using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role in ('admin', 'assistant')))
  with check (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role in ('admin', 'assistant')));

-- Which code a registration used, who invited her, and her preparation answers.
alter table public.event_registrations
  add column if not exists invite_code text,
  add column if not exists invited_by_registration_id uuid references public.event_registrations(id) on delete set null,
  add column if not exists prep_token uuid not null default gen_random_uuid(),
  add column if not exists prep_submitted_at timestamptz,
  add column if not exists prep_expectations text[],
  add column if not exists prep_expectations_note text,
  add column if not exists prep_food_restrictions text[],
  add column if not exists prep_food_note text,
  add column if not exists prep_allergies text,
  add column if not exists prep_revenue_current text,
  add column if not exists prep_revenue_goal text;
create unique index if not exists event_registrations_prep_token_key on public.event_registrations (prep_token);
create index if not exists event_registrations_invite_code_idx on public.event_registrations (invite_code);

-- Discounted SumUp link guests are sent to once their code is validated.
alter table public.tenant_settings add column if not exists event_invite_payment_link_url text;
