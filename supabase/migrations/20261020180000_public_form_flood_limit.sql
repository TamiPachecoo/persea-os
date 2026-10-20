-- Security audit Step 5: the public forms had no limit on repeated
-- submissions, so a script could flood fake sign-ups or fake results
-- (distorting "Faturamento somado"). Limits per hour, for inserts that
-- don't come from staff. They sit far above real use (busiest real hour so
-- far: 5 event sign-ups), so a real person is never stopped:
--   per table: event_registrations 60, leads 60, value_perception_diagnostics 40, mentee_results 20
--   same e-mail (or name, where there's no e-mail): 5
create or replace function private.limit_public_form_flood()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  cap int := tg_argv[0]::int;
  n int;
  who_col text := case when tg_table_name in ('event_registrations', 'leads') then 'email' else 'full_name' end;
  who text := lower(trim(to_jsonb(new) ->> who_col));
begin
  if (select private.current_user_role()) in ('admin', 'assistant') then return new; end if;
  execute format('select count(*) from public.%I where created_at > now() - interval ''1 hour''', tg_table_name) into n;
  if n >= cap then
    raise exception 'Muitos envios em pouco tempo. Tente novamente mais tarde.' using errcode = 'P0001';
  end if;
  if who is not null and who <> '' then
    execute format('select count(*) from public.%I where created_at > now() - interval ''1 hour'' and lower(trim(%I)) = $1', tg_table_name, who_col)
      into n using who;
    if n >= 5 then
      raise exception 'Muitos envios em pouco tempo. Tente novamente mais tarde.' using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;

create trigger b_limit_public_form_flood before insert on public.event_registrations
  for each row execute function private.limit_public_form_flood('60');
create trigger b_limit_public_form_flood before insert on public.leads
  for each row execute function private.limit_public_form_flood('60');
create trigger b_limit_public_form_flood before insert on public.value_perception_diagnostics
  for each row execute function private.limit_public_form_flood('40');
create trigger b_limit_public_form_flood before insert on public.mentee_results
  for each row execute function private.limit_public_form_flood('20');
