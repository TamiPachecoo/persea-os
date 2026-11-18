-- Assinatura de cada pessoa da equipe nas mensagens do sistema (WhatsApp /
-- e-mail): como ela se apresenta ("Aqui é a Tami, do departamento de
-- tecnologia e inovação da Nay") e o bloco final (nome completo, área,
-- PERSEA ⚜️). Cada uma edita a sua; a Nay edita todas.
create table if not exists public.staff_signatures (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  display_name text,
  intro text,
  title text,
  updated_at timestamptz not null default now()
);
alter table public.staff_signatures enable row level security;

drop policy if exists staff_signatures_read on public.staff_signatures;
create policy staff_signatures_read on public.staff_signatures for select to authenticated
  using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role in ('admin', 'assistant')));
drop policy if exists staff_signatures_write on public.staff_signatures;
create policy staff_signatures_write on public.staff_signatures for all to authenticated
  using (profile_id = (select auth.uid()) or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'))
  with check ((profile_id = (select auth.uid()) and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role in ('admin', 'assistant')))
              or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'));

insert into public.staff_signatures (profile_id, display_name, intro, title)
select id, 'Tami Pacheco', 'do departamento de tecnologia e inovação da Nay', 'Tech • Inovação'
from public.profiles where id = 'b22e63e3-938f-46ce-8e0b-bab517e4b6ab'
on conflict (profile_id) do nothing;
