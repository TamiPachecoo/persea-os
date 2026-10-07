-- Results survey for PERSEA mentees (naymurta.com/resultados): revenue
-- generated, time to first sale, before/after scores for confidence,
-- visibility and perceived value, new opportunities and the main change.
-- Independent of leads/clients on purpose (only a name identifies her).
-- Staff-only table: the public form writes through the mentee-results
-- Edge Function; staff read and delete from the CRM's Eventos tab.
create table if not exists public.mentee_results (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  revenue_cents bigint not null check (revenue_cents >= 0),
  first_sale text not null,
  confidence_before smallint not null check (confidence_before between 0 and 10),
  confidence_after smallint not null check (confidence_after between 0 and 10),
  visibility_before smallint not null check (visibility_before between 0 and 10),
  visibility_after smallint not null check (visibility_after between 0 and 10),
  opportunities text,
  value_before smallint not null check (value_before between 0 and 10),
  value_after smallint not null check (value_after between 0 and 10),
  transformation text not null,
  created_at timestamptz not null default now()
);
alter table public.mentee_results enable row level security;
create policy mentee_results_staff_all on public.mentee_results
  for all using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role in ('admin', 'assistant')))
  with check (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role in ('admin', 'assistant')));
