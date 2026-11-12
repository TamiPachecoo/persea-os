-- Tarefas da equipe — delegação entre a Nay (admin) e a assistente, dentro
-- do sistema (em vez de mensagens soltas no WhatsApp).
--   kind 'task'     — algo para fazer, com prazo
--   kind 'question' — uma pergunta/pedido de decisão (ex.: assistente → Nay)
-- assigned_role diz para quem é (admin = Nay, assistant = equipe);
-- assigned_to opcional aponta uma pessoa específica da equipe.
-- Cada tarefa tem uma conversa (team_task_comments) para respostas.
-- source 'auto' = criada sozinha pelo sistema (ex.: cadastro recebido →
-- preparar contrato); auto_key evita duplicar e permite fechar sozinha
-- quando o passo acontece no sistema.

create table if not exists public.team_tasks (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'task' check (kind in ('task', 'question')),
  title text not null check (length(btrim(title)) > 0),
  notes text,
  client_id uuid references public.clients(id) on delete cascade,
  assigned_role text not null check (assigned_role in ('admin', 'assistant')),
  assigned_to uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  created_by_name text,
  due_at timestamptz,
  status text not null default 'open' check (status in ('open', 'in_progress', 'done')),
  completed_at timestamptz,
  completed_by uuid references public.profiles(id) on delete set null,
  completed_by_name text,
  source text not null default 'manual' check (source in ('manual', 'auto')),
  auto_key text unique,
  notified_soon_at timestamptz,
  notified_overdue_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists team_tasks_open_idx on public.team_tasks (status, due_at);
create index if not exists team_tasks_client_idx on public.team_tasks (client_id);

create table if not exists public.team_task_comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.team_tasks(id) on delete cascade,
  author_id uuid references public.profiles(id) on delete set null default auth.uid(),
  author_name text,
  author_role text,
  body text not null check (length(btrim(body)) > 0),
  created_at timestamptz not null default now()
);
create index if not exists team_task_comments_task_idx on public.team_task_comments (task_id, created_at);

alter table public.team_tasks enable row level security;
alter table public.team_task_comments enable row level security;

-- Staff (admin + assistente) veem e atualizam todas as tarefas — é uma
-- equipe pequena e a Nay acompanha tudo. Apagar: só a Nay ou quem criou.
create policy team_tasks_staff_read on public.team_tasks for select
  using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role in ('admin', 'assistant')));
create policy team_tasks_staff_insert on public.team_tasks for insert
  with check (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role in ('admin', 'assistant'))
              and created_by = (select auth.uid()) and source = 'manual' and auto_key is null);
create policy team_tasks_staff_update on public.team_tasks for update
  using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role in ('admin', 'assistant')))
  with check (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role in ('admin', 'assistant')));
create policy team_tasks_delete on public.team_tasks for delete
  using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and (p.role = 'admin' or (p.role = 'assistant' and team_tasks.created_by = p.id))));

create policy team_task_comments_staff_read on public.team_task_comments for select
  using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role in ('admin', 'assistant')));
create policy team_task_comments_staff_insert on public.team_task_comments for insert
  with check (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role in ('admin', 'assistant'))
              and author_id = (select auth.uid()));
create policy team_task_comments_own_delete on public.team_task_comments for delete
  using (author_id = (select auth.uid()));

-- Bookkeeping: names (the assistant can't read other profiles), updated_at,
-- who/when completed, and re-arming the deadline alerts when due_at moves.
create or replace function private.team_task_bookkeeping()
returns trigger language plpgsql security definer set search_path = '' as $$
declare me record;
begin
  select id, full_name, role into me from public.profiles where id = auth.uid();
  if tg_op = 'INSERT' then
    if new.created_by_name is null and me.id is not null then
      new.created_by_name := nullif(btrim(regexp_replace(coalesce(me.full_name, ''), '\(.*?\)', '', 'g')), '');
    end if;
  else
    new.updated_at := now();
    if new.due_at is distinct from old.due_at then
      new.notified_soon_at := null; new.notified_overdue_at := null;
    end if;
  end if;
  if new.status = 'done' and (tg_op = 'INSERT' or old.status <> 'done') then
    new.completed_at := now();
    new.completed_by := coalesce(new.completed_by, me.id);
    new.completed_by_name := coalesce(new.completed_by_name, nullif(btrim(regexp_replace(coalesce(me.full_name, ''), '\(.*?\)', '', 'g')), ''), 'Sistema');
  elsif new.status <> 'done' then
    new.completed_at := null; new.completed_by := null; new.completed_by_name := null;
  end if;
  return new;
end $$;
create trigger trg_team_task_bookkeeping before insert or update on public.team_tasks
  for each row execute function private.team_task_bookkeeping();

create or replace function private.team_task_comment_author()
returns trigger language plpgsql security definer set search_path = '' as $$
declare me record;
begin
  select full_name, role::text as role into me from public.profiles where id = auth.uid();
  new.author_name := coalesce(new.author_name, nullif(btrim(regexp_replace(coalesce(me.full_name, ''), '\(.*?\)', '', 'g')), ''));
  new.author_role := coalesce(new.author_role, me.role);
  -- A reply reopens a finished question so the other side sees it.
  update public.team_tasks set updated_at = now() where id = new.task_id;
  return new;
end $$;
create trigger trg_team_task_comment_author before insert on public.team_task_comments
  for each row execute function private.team_task_comment_author();

-- --- Tarefas automáticas -------------------------------------------------
-- Never allowed to break the write that triggered them: every body is
-- wrapped so a failure here only logs a warning.
create or replace function private.upsert_auto_task(p_key text, p_client uuid, p_role text, p_title text, p_notes text, p_due timestamptz)
returns void language plpgsql security definer set search_path = '' as $$
begin
  insert into public.team_tasks (auto_key, source, client_id, assigned_role, title, notes, due_at, created_by, created_by_name)
  values (p_key, 'auto', p_client, p_role, p_title, p_notes, p_due, null, 'Sistema')
  on conflict (auto_key) do nothing;
end $$;
create or replace function private.complete_auto_task(p_key text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.team_tasks set status = 'done', completed_by_name = coalesce(completed_by_name, 'Sistema')
  where auto_key = p_key and status <> 'done';
end $$;

-- Cadastro recebido → preparar o contrato (assistente, 1 dia).
create or replace function private.auto_tasks_from_cadastro()
returns trigger language plpgsql security definer set search_path = '' as $$
declare nm text;
begin
  begin
    if new.client_id is null or not new.submitted or (tg_op = 'UPDATE' and old.submitted) then return new; end if;
    select full_name into nm from public.clients where id = new.client_id;
    nm := coalesce(nullif(new.full_name, ''), nm, 'nova aluna');
    -- Only when no contract is already on its way.
    if not exists (select 1 from public.contracts c where c.client_id = new.client_id
                   and (c.sent_for_signature_at is not null or c.autentique_document_id is not null or c.status in ('signed', 'completed'))) then
      perform private.upsert_auto_task('contract:' || new.client_id, new.client_id, 'assistant',
        'Preparar o contrato — ' || nm,
        'O cadastro chegou. Prepare o contrato na página da aluna (aba Financeiro) e deixe para a Nay revisar.',
        now() + interval '1 day');
    end if;
  exception when others then raise warning 'auto_tasks_from_cadastro: %', sqlerrm;
  end;
  return new;
end $$;
create trigger trg_auto_tasks_from_cadastro after insert or update of submitted on public.party_info
  for each row execute function private.auto_tasks_from_cadastro();

-- Contrato: pronto para revisar → tarefa da Nay; revisado → fecha;
-- enviado para assinatura → fecha "preparar"; assinado → convite de acesso.
create or replace function private.auto_tasks_from_contract()
returns trigger language plpgsql security definer set search_path = '' as $$
declare nm text;
begin
  begin
    select full_name into nm from public.clients where id = new.client_id;
    nm := coalesce(nm, 'aluna');
    if new.body_text is not null and new.admin_reviewed_at is null and new.autentique_document_id is null
       and new.sent_for_signature_at is null and new.status not in ('signed', 'completed') then
      perform private.upsert_auto_task('review:' || new.id, new.client_id, 'admin',
        'Revisar o contrato — ' || nm,
        'O contrato está preparado e aguarda a sua revisão antes de ir para assinatura.',
        now() + interval '1 day');
      perform private.complete_auto_task('contract:' || new.client_id);
    end if;
    if new.admin_reviewed_at is not null then
      perform private.complete_auto_task('review:' || new.id);
    end if;
    if new.sent_for_signature_at is not null or new.autentique_document_id is not null or new.status in ('signed', 'completed') then
      perform private.complete_auto_task('contract:' || new.client_id);
      perform private.complete_auto_task('review:' || new.id);
    end if;
    if new.status in ('signed', 'completed') and (tg_op = 'INSERT' or old.status not in ('signed', 'completed'))
       and not exists (select 1 from public.clients c where c.id = new.client_id and c.access_status in ('created', 'active')) then
      perform private.upsert_auto_task('invite:' || new.client_id, new.client_id, 'assistant',
        'Enviar o convite de acesso ao app — ' || nm,
        'O contrato foi assinado. Envie o convite de acesso (aba Financeiro → Acesso), por e-mail ou WhatsApp.',
        now() + interval '1 day');
    end if;
  exception when others then raise warning 'auto_tasks_from_contract: %', sqlerrm;
  end;
  return new;
end $$;
create trigger trg_auto_tasks_from_contract after insert or update on public.contracts
  for each row execute function private.auto_tasks_from_contract();

-- Acesso criado → fecha "enviar convite".
create or replace function private.auto_tasks_from_access()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  begin
    if new.access_status in ('created', 'active') and old.access_status is distinct from new.access_status then
      perform private.complete_auto_task('invite:' || new.id);
    end if;
  exception when others then raise warning 'auto_tasks_from_access: %', sqlerrm;
  end;
  return new;
end $$;
create trigger trg_auto_tasks_from_access after update of access_status on public.clients
  for each row execute function private.auto_tasks_from_access();

revoke all on function private.upsert_auto_task(text, uuid, text, text, text, timestamptz) from public, anon, authenticated;
revoke all on function private.complete_auto_task(text) from public, anon, authenticated;
