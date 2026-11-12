-- Confirmação dos eventos do Google Calendar da Nay (que não existem em
-- agenda_items). A assistente vê a agenda Google da Nay pela Edge Function
-- nay-calendar-events e registra aqui a confirmação feita pelo WhatsApp.
-- client_id: a aluna do evento (descoberta automaticamente ou escolhida
-- pela assistente), para achar o WhatsApp dela.
create table if not exists public.calendar_event_confirmations (
  google_event_id text primary key,
  event_start timestamptz,
  event_title text,
  client_id uuid references public.clients(id) on delete set null,
  status text check (status in ('message_sent', 'confirmed', 'reschedule')),
  confirmed_by uuid references public.profiles(id) on delete set null default auth.uid(),
  confirmed_by_name text,
  updated_at timestamptz not null default now()
);
alter table public.calendar_event_confirmations enable row level security;
create policy calendar_event_confirmations_staff_all on public.calendar_event_confirmations for all
  using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role in ('admin', 'assistant')))
  with check (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role in ('admin', 'assistant')));

create or replace function private.calendar_confirmation_name()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  new.updated_at := now();
  new.confirmed_by := auth.uid();
  select nullif(btrim(regexp_replace(coalesce(full_name, ''), '\(.*?\)', '', 'g')), '') into new.confirmed_by_name
    from public.profiles where id = auth.uid();
  return new;
end $$;
create trigger trg_calendar_confirmation_name before insert or update on public.calendar_event_confirmations
  for each row execute function private.calendar_confirmation_name();
