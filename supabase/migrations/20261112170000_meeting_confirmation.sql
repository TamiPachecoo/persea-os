-- Confirmação de encontros pela assistente. Ela vê a agenda da Nay
-- (agenda_items_assistant_read já permite ler tudo) e, pelo WhatsApp,
-- confirma com a aluna; aqui fica registrado o resultado.
-- A assistente NÃO ganha permissão de editar os encontros da Nay: ela só
-- muda estes três campos, pela função set_meeting_confirmation.
alter table public.agenda_items
  add column if not exists confirmation_status text check (confirmation_status in ('message_sent', 'confirmed', 'reschedule')),
  add column if not exists confirmation_at timestamptz,
  add column if not exists confirmation_by_name text;

create or replace function public.set_meeting_confirmation(p_item uuid, p_status text)
returns void language plpgsql security definer set search_path = '' as $$
declare me record;
begin
  select id, full_name, role into me from public.profiles where id = auth.uid();
  if me.id is null or me.role not in ('admin', 'assistant') then raise exception 'not allowed'; end if;
  if p_status is not null and p_status not in ('message_sent', 'confirmed', 'reschedule') then raise exception 'invalid status'; end if;
  update public.agenda_items
     set confirmation_status = p_status,
         confirmation_at = case when p_status is null then null else now() end,
         confirmation_by_name = case when p_status is null then null else nullif(btrim(regexp_replace(coalesce(me.full_name, ''), '\(.*?\)', '', 'g')), '') end
   where id = p_item;
end $$;
revoke all on function public.set_meeting_confirmation(uuid, text) from public, anon;
grant execute on function public.set_meeting_confirmation(uuid, text) to authenticated;
