-- The assistant now has the Eventos tab (assistant/events.html). She
-- already reads registrations; she also marks payments, edits notes and
-- removes unpaid duplicates, like Nay. Paid registrations can't be
-- deleted by her. tenant_settings (payment links, direct sign-up code)
-- stays admin-only.
create policy event_registrations_assistant_update on public.event_registrations
  for update using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'assistant'))
  with check (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'assistant'));
create policy event_registrations_assistant_delete on public.event_registrations
  for delete using (status <> 'pago' and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'assistant'));
