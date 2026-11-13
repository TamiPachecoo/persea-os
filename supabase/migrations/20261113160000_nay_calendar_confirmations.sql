-- Agenda da Nay para as assistentes: os encontros da Nay vivem no Google
-- Calendar dela (não em agenda_items), então a assistente lê esses eventos
-- pela edge function google-calendar-list-events com { owner: 'nay' } e
-- marca a confirmação de cada um aqui (por id do evento do Google).
create table if not exists public.calendar_event_confirmations (
  event_id text primary key,
  client_id uuid references public.clients(id) on delete set null,
  event_start timestamptz,
  status text check (status in ('message_sent', 'confirmed', 'reschedule')),  -- null = aluna escolhida, ainda sem confirmação
  confirmed_by uuid references public.profiles(id) on delete set null,
  confirmed_by_name text,
  updated_at timestamptz not null default now()
);
alter table public.calendar_event_confirmations enable row level security;

drop policy if exists calendar_event_confirmations_staff on public.calendar_event_confirmations;
create policy calendar_event_confirmations_staff on public.calendar_event_confirmations
  for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role in ('admin', 'assistant')))
  with check (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role in ('admin', 'assistant')));

create or replace function private.calendar_event_confirmation_stamp()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  new.confirmed_by := (select auth.uid());
  select nullif(btrim(regexp_replace(coalesce(full_name, ''), '\(.*?\)', '', 'g')), '') into new.confirmed_by_name
  from public.profiles where id = new.confirmed_by;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists trg_calendar_event_confirmation_stamp on public.calendar_event_confirmations;
create trigger trg_calendar_event_confirmation_stamp before insert or update on public.calendar_event_confirmations
  for each row execute function private.calendar_event_confirmation_stamp();
