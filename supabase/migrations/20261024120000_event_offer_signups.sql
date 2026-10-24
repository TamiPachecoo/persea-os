-- Sign-ups taken during the PERSEA Experience pitch (pagamento page, via the
-- event-offer-signup Edge Function). Staff-only; listed in the CRM's Eventos tab.
create table public.event_offer_signups (
  id uuid primary key default gen_random_uuid(),
  event_slug text not null default 'persea-experience',
  full_name text not null,
  phone text not null,
  instagram text,
  payment_choice text check (payment_choice in ('pix', 'cartao')),
  followed_up boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.event_offer_signups enable row level security;
create policy event_offer_signups_staff_all on public.event_offer_signups for all
  using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role in ('admin', 'assistant')))
  with check (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role in ('admin', 'assistant')));
create trigger a_neutralize_untrusted_text before insert or update on public.event_offer_signups
  for each row execute function private.neutralize_untrusted_text();
create trigger b_limit_public_form_flood before insert on public.event_offer_signups
  for each row execute function private.limit_public_form_flood(80);
