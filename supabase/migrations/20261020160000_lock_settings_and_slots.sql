-- Security audit Step 5 (low-risk clean-ups):
-- 1) tenant_settings holds the event payment links and the direct sign-up
--    code. Students only ever need the Hubla content link from it, so they
--    get that one value through client_hubla_content_url() and the table
--    itself becomes staff-only.
-- 2) Proposed meeting times: each student sees only the slots offered to
--    her own requests (the assistant still sees all).
create or replace function public.client_hubla_content_url()
returns text language sql stable security definer set search_path = '' as $$
  select hubla_all_content_url from public.tenant_settings limit 1
$$;
revoke execute on function public.client_hubla_content_url() from public, anon;
grant execute on function public.client_hubla_content_url() to authenticated;

alter policy tenant_settings_read on public.tenant_settings
  using ((select private.current_user_role()) in ('admin', 'assistant'));

alter policy encounter_request_proposed_times_read on public.encounter_request_proposed_times
  using (
    (select private.current_user_role()) = 'assistant'
    or exists (
      select 1 from public.encounter_requests r
      join public.profiles p on p.id = (select auth.uid())
      where r.id = encounter_request_proposed_times.encounter_request_id
        and p.role = 'client' and p.client_id = r.client_id
    )
  );
