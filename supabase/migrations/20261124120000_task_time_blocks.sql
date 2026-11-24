-- A tarefa can reserve time on the agenda of whoever does it (Nay's own
-- tarefas first of all): block_start + block_minutes, and the agenda item
-- created for it (type admin_task). Finishing the tarefa completes that
-- agenda item; deleting the tarefa removes it.
alter table public.team_tasks add column if not exists block_start timestamptz;
alter table public.team_tasks add column if not exists block_minutes integer;
alter table public.team_tasks add column if not exists agenda_item_id uuid references public.agenda_items(id) on delete set null;

create or replace function private.team_task_agenda_sync()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    if old.agenda_item_id is not null then
      delete from public.agenda_items where id = old.agenda_item_id and type = 'admin_task';
    end if;
    return old;
  end if;
  if new.agenda_item_id is not null and new.status is distinct from old.status then
    update public.agenda_items
      set status = case when new.status = 'done' then 'completed' else 'upcoming' end, updated_at = now()
      where id = new.agenda_item_id and type = 'admin_task';
  end if;
  return new;
end $$;
drop trigger if exists trg_team_task_agenda_sync on public.team_tasks;
create trigger trg_team_task_agenda_sync after update or delete on public.team_tasks
  for each row execute function private.team_task_agenda_sync();
