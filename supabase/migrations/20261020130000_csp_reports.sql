-- Security audit Step 2: the app's Content-Security-Policy starts in
-- report-only mode. Browsers POST what it *would* have blocked to the
-- csp-report edge function, which stores one row here (staff-only read).
-- Once a few days of real use show nothing legitimate is reported, the
-- header switches to enforcing.
create table if not exists public.csp_reports (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  page text,
  directive text,
  blocked text,
  source text,
  sample text
);
alter table public.csp_reports enable row level security;
create policy csp_reports_staff_read on public.csp_reports
  for select using ((select private.current_user_role()) in ('admin', 'assistant'));
