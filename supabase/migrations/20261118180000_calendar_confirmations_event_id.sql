-- The live table was created earlier with the key column google_event_id,
-- so 20261113160000 (create table if not exists … event_id) never applied
-- its shape and every save from Agenda da Nay (É pessoal, picking the
-- student, Confirmou/Remarcar on Google events) failed. Align the column
-- with the app. The table was still empty.
do $$ begin
  if exists (select 1 from information_schema.columns where table_schema = 'public'
             and table_name = 'calendar_event_confirmations' and column_name = 'google_event_id') then
    alter table public.calendar_event_confirmations rename column google_event_id to event_id;
  end if;
end $$;

-- "Confirmado por": "Assistente (Tami)" reads as "Tami", not "Assistente".
create or replace function private.calendar_confirmation_name()
returns trigger language plpgsql security definer set search_path = '' as $$
declare fn text;
begin
  new.updated_at := now();
  new.confirmed_by := auth.uid();
  select coalesce(full_name, '') into fn from public.profiles where id = auth.uid();
  new.confirmed_by_name := coalesce(
    nullif(btrim(substring(fn from '^\s*Assistente\s*\((.*?)\)')), ''),
    nullif(btrim(regexp_replace(fn, '\(.*?\)', '', 'g')), ''));
  return new;
end $$;
