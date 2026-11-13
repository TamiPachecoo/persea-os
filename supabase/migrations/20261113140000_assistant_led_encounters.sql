-- Assistentes na linha dos encontros:
--   1. movem as clientes (ordem e encontro atual em client_encounter_plans);
--   2. editam os encontros que elas conduzem — o E3 (Imagem e Estratégia) é
--      conduzido pela assistente (Nath): texto do encontro, lição de casa e
--      checklist de preparação. A Nay continua editando todos.
-- encounter_defs.led_by_role diz quem conduz ('admin' = Nay, 'assistant').
alter table public.encounter_defs add column if not exists led_by_role text not null default 'admin'
  check (led_by_role in ('admin', 'assistant'));
update public.encounter_defs set led_by_role = 'assistant' where number = 3;

create or replace function private.is_staff_role(p_role text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role::text = p_role);
$$;
create or replace function private.encounter_led_by_assistant(p_number integer)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.encounter_defs d where d.number = p_number and d.led_by_role = 'assistant');
$$;

-- 1. Plans: assistants read AND write.
drop policy if exists client_encounter_plans_assistant_write on public.client_encounter_plans;
create policy client_encounter_plans_assistant_write on public.client_encounter_plans
  for all using (private.is_staff_role('assistant')) with check (private.is_staff_role('assistant'));

-- 2. Encounter content for assistant-led encounters.
drop policy if exists encounter_defs_assistant_update on public.encounter_defs;
create policy encounter_defs_assistant_update on public.encounter_defs
  for update using (private.is_staff_role('assistant') and led_by_role = 'assistant')
  with check (private.is_staff_role('assistant') and led_by_role = 'assistant');
drop policy if exists encounter_defs_admin_update on public.encounter_defs;
create policy encounter_defs_admin_update on public.encounter_defs
  for update using (private.is_staff_role('admin')) with check (private.is_staff_role('admin'));

-- An assistant can change the text of an encounter she leads, never who
-- leads it, its number, phase or premium flag.
create or replace function private.encounter_defs_assistant_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if private.is_staff_role('assistant') and (
       new.led_by_role is distinct from old.led_by_role or new.number is distinct from old.number
    or new.premium_only is distinct from old.premium_only) then
    raise exception 'Só a Nay muda quem conduz o encontro, o número ou se é Premium.';
  end if;
  return new;
end $$;
drop trigger if exists trg_encounter_defs_assistant_guard on public.encounter_defs;
create trigger trg_encounter_defs_assistant_guard before update on public.encounter_defs
  for each row execute function private.encounter_defs_assistant_guard();

drop policy if exists encounter_homework_defs_assistant_write on public.encounter_homework_defs;
create policy encounter_homework_defs_assistant_write on public.encounter_homework_defs
  for all using (private.is_staff_role('assistant') and private.encounter_led_by_assistant(encounter_number))
  with check (private.is_staff_role('assistant') and private.encounter_led_by_assistant(encounter_number));

drop policy if exists encounter_prep_items_admin_write on public.encounter_prep_checklist_items;
create policy encounter_prep_items_admin_write on public.encounter_prep_checklist_items
  for all using (private.is_staff_role('admin')) with check (private.is_staff_role('admin'));
drop policy if exists encounter_prep_items_assistant_write on public.encounter_prep_checklist_items;
create policy encounter_prep_items_assistant_write on public.encounter_prep_checklist_items
  for all using (private.is_staff_role('assistant') and private.encounter_led_by_assistant(encounter_number))
  with check (private.is_staff_role('assistant') and private.encounter_led_by_assistant(encounter_number));

-- 3. Meetings of encounters the assistant leads (titles "E3 — …"), even when
--    booked on Nay's agenda: the assistant updates them too (combinados,
--    links, files shared with the student).
drop policy if exists agenda_items_assistant_led_update on public.agenda_items;
create policy agenda_items_assistant_led_update on public.agenda_items
  for update using (private.is_staff_role('assistant')
    and private.encounter_led_by_assistant(nullif(substring(title from '^\s*[Ee](\d+)'), '')::integer))
  with check (private.is_staff_role('assistant')
    and private.encounter_led_by_assistant(nullif(substring(title from '^\s*[Ee](\d+)'), '')::integer));
