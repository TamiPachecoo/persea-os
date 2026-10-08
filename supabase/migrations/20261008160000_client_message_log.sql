-- Messages the team sends a client from her page (Mensagens tab):
-- welcome, meeting scheduled / reminder, financial. The message itself goes
-- out through WhatsApp or e-mail on the sender's own device; this keeps the
-- record of what was sent, when and by whom, so Nay and the assistant don't
-- repeat each other. Staff-only (client_activity_log is visible to the
-- client, so it is not used for this).
create table if not exists public.client_message_log (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  kind text not null,
  channel text not null check (channel in ('whatsapp', 'email', 'copy')),
  body text not null,
  sent_by uuid references public.profiles(id) on delete set null,
  sent_by_name text,
  created_at timestamptz not null default now()
);
create index if not exists client_message_log_client_idx on public.client_message_log (client_id, created_at desc);
alter table public.client_message_log enable row level security;
create policy client_message_log_staff_all on public.client_message_log
  for all using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role in ('admin', 'assistant')))
  with check (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role in ('admin', 'assistant')));
