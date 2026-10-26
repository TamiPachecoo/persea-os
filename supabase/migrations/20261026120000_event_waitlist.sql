-- Waiting list for the next PERSEA Experience (naymurta.com/listadeespera, via the
-- event-waitlist Edge Function). Staff-only; listed in the CRM's Eventos tab under
-- the edition it belongs to.
create table public.event_waitlist (
  id uuid primary key default gen_random_uuid(),
  edition text not null default '2027',
  full_name text not null,
  phone text not null,
  email text,
  instagram text,
  attended_before boolean,
  contacted boolean not null default false,
  created_at timestamptz not null default now()
);
create index event_waitlist_edition_idx on public.event_waitlist (edition, created_at desc);
alter table public.event_waitlist enable row level security;
create policy event_waitlist_staff_all on public.event_waitlist for all
  using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role in ('admin', 'assistant')))
  with check (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role in ('admin', 'assistant')));
create trigger a_neutralize_untrusted_text before insert or update on public.event_waitlist
  for each row execute function private.neutralize_untrusted_text();
create trigger b_limit_public_form_flood before insert on public.event_waitlist
  for each row execute function private.limit_public_form_flood(80);
