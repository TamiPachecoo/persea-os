-- Assistentes também conversam entre si pelo sistema (Tarefas/Perguntas),
-- não só com a Nay. A assistente não pode ler a tabela profiles inteira,
-- então: team_members() devolve só nome e papel da equipe (para a lista
-- "Para quem"), e cada tarefa guarda o nome de quem recebe
-- (assigned_to_name), preenchido pelo próprio banco.
alter table public.team_tasks add column if not exists assigned_to_name text;

create or replace function public.team_members()
returns table (id uuid, full_name text, role text)
language sql stable security definer set search_path = '' as $$
  select p.id, nullif(btrim(regexp_replace(coalesce(p.full_name, ''), '\(.*?\)', '', 'g')), ''), p.role::text
  from public.profiles p
  where p.role in ('admin', 'assistant')
    and exists (select 1 from public.profiles me where me.id = (select auth.uid()) and me.role in ('admin', 'assistant'))
  order by p.role, p.full_name;
$$;
revoke all on function public.team_members() from public, anon;
grant execute on function public.team_members() to authenticated;

create or replace function private.team_task_assignee_name()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.assigned_to is null then
    new.assigned_to_name := null;
  elsif tg_op = 'INSERT' or new.assigned_to is distinct from old.assigned_to or new.assigned_to_name is null then
    select nullif(btrim(regexp_replace(coalesce(full_name, ''), '\(.*?\)', '', 'g')), '') into new.assigned_to_name
    from public.profiles where id = new.assigned_to;
  end if;
  return new;
end $$;
drop trigger if exists trg_team_task_assignee_name on public.team_tasks;
create trigger trg_team_task_assignee_name before insert or update on public.team_tasks
  for each row execute function private.team_task_assignee_name();

update public.team_tasks t set assigned_to_name = nullif(btrim(regexp_replace(coalesce(p.full_name, ''), '\(.*?\)', '', 'g')), '')
from public.profiles p where p.id = t.assigned_to and t.assigned_to_name is null;
