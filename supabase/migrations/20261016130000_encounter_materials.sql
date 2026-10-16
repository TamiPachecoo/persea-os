-- Encounter materials Nay uploads ahead of time and releases during the
-- encounter: Guia de Posicionamento (E2) and Kit Digital (E4).
-- Kit Digital keeps its existing record (digital_kits, until now link-only)
-- and gains an uploaded file; the Guia gets the same shape. Files live in
-- the private client-shared-files bucket under <client>/materials/.
-- delivered_at = "Liberado para a cliente": only admin can set or clear it
-- (same enforce_admin_only_delivery trigger), and the student only reads
-- the row once it's released.
alter table public.digital_kits
  add column if not exists file_path text,
  add column if not exists file_name text;

create table if not exists public.positioning_guides (
  client_id uuid primary key references public.clients(id) on delete cascade,
  file_path text,
  file_name text,
  file_url text,
  summary text,
  delivered_at timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.positioning_guides enable row level security;
create policy positioning_guides_staff_all on public.positioning_guides
  for all using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role in ('admin', 'assistant')))
  with check (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role in ('admin', 'assistant')));
create policy positioning_guides_client_read on public.positioning_guides
  using (delivered_at is not null and exists (
    select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'client' and p.client_id = positioning_guides.client_id));
create trigger trg_positioning_guides_admin_only_delivery
  before update on public.positioning_guides
  for each row execute function public.enforce_admin_only_delivery();

-- The student only reads her Kit Digital once Nay releases it (her page
-- already showed it only then; now the row itself stays hidden too).
alter policy digital_kits_client_read on public.digital_kits
  using (delivered_at is not null and exists (
    select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'client' and p.client_id = digital_kits.client_id));
