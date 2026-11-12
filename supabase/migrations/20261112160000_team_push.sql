-- Notificações push (app instalado / navegador) para a equipe.
-- Quem recebe: Nay e assistente, nos aparelhos onde tocaram em
-- "Ativar notificações" (push_subscriptions). O envio é feito pela Edge
-- Function team-push; o banco a chama (pg_net) quando:
--   - uma tarefa/pergunta é criada (avisa quem recebeu)
--   - alguém responde numa tarefa (avisa o outro lado)
--   - uma tarefa é concluída por outra pessoa (avisa quem pediu)
--   - a cada 15 min (pg_cron): prazo nas próximas 24h e tarefa atrasada.
--
-- Segredos ficam no Vault e nunca passam por este arquivo nem por pessoas:
--   team_push_internal_token — gerado aqui mesmo (aleatório)
--   team_push_vapid_public/private — gerados pela própria Edge Function
--     na primeira execução (team_push_store_vapid).
-- Só a Edge Function (service_role) lê, via public.team_push_config();
-- o app lê só a chave pública (team_push_public_key).

create extension if not exists pg_net;
create extension if not exists pg_cron;

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  last_success_at timestamptz
);
alter table public.push_subscriptions enable row level security;
create policy push_subscriptions_own on public.push_subscriptions for all
  using (profile_id = (select auth.uid()))
  with check (profile_id = (select auth.uid())
              and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role in ('admin', 'assistant')));

create or replace function public.team_push_config()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'vapid_public', (select decrypted_secret from vault.decrypted_secrets where name = 'team_push_vapid_public'),
    'vapid_private', (select decrypted_secret from vault.decrypted_secrets where name = 'team_push_vapid_private'),
    'internal_token', (select decrypted_secret from vault.decrypted_secrets where name = 'team_push_internal_token')
  );
$$;
revoke all on function public.team_push_config() from public, anon, authenticated;
grant execute on function public.team_push_config() to service_role;

create or replace function public.team_push_store_vapid(p_public text, p_private text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from vault.secrets where name = 'team_push_vapid_private') then return; end if;
  perform vault.create_secret(p_public, 'team_push_vapid_public');
  perform vault.create_secret(p_private, 'team_push_vapid_private');
end $$;
revoke all on function public.team_push_store_vapid(text, text) from public, anon, authenticated;
grant execute on function public.team_push_store_vapid(text, text) to service_role;

-- Public half only, for the app to subscribe (staff only).
create or replace function public.team_push_public_key()
returns text language sql stable security definer set search_path = '' as $$
  select decrypted_secret from vault.decrypted_secrets
  where name = 'team_push_vapid_public'
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'assistant'));
$$;
revoke all on function public.team_push_public_key() from public, anon;
grant execute on function public.team_push_public_key() to authenticated;

do $$ begin
  if not exists (select 1 from vault.secrets where name = 'team_push_internal_token') then
    perform vault.create_secret(replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''), 'team_push_internal_token');
  end if;
end $$;

-- Fire-and-forget call to team-push. Never blocks or fails the write.
create or replace function private.call_team_push(payload jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare tok text;
begin
  begin
    select decrypted_secret into tok from vault.decrypted_secrets where name = 'team_push_internal_token';
    if tok is null then return; end if;
    perform net.http_post(
      url := 'https://bletlyuptkppacjcbcvw.supabase.co/functions/v1/team-push',
      body := payload,
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-internal-token', tok),
      timeout_milliseconds := 8000
    );
  exception when others then raise warning 'call_team_push: %', sqlerrm;
  end;
end $$;
revoke all on function private.call_team_push(jsonb) from public, anon, authenticated;

create or replace function private.team_task_push_events()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    perform private.call_team_push(jsonb_build_object('event', 'task_created', 'task_id', new.id));
  elsif new.status = 'done' and old.status <> 'done' and new.source = 'manual' then
    perform private.call_team_push(jsonb_build_object('event', 'task_done', 'task_id', new.id));
  end if;
  return null;
end $$;
create trigger trg_team_task_push after insert or update of status on public.team_tasks
  for each row execute function private.team_task_push_events();

create or replace function private.team_comment_push_events()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform private.call_team_push(jsonb_build_object('event', 'comment', 'comment_id', new.id));
  return null;
end $$;
create trigger trg_team_comment_push after insert on public.team_task_comments
  for each row execute function private.team_comment_push_events();

-- Prazos: a cada 15 minutos.
select cron.schedule('team-push-deadlines', '*/15 * * * *', $$select private.call_team_push('{"event":"sweep"}'::jsonb)$$);
