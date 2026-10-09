-- Visits and clicks on Nay's public sites (naymurta.com and
-- perseaexperience.naymurta.com), counted by our own tracker instead of a
-- third-party analytics service. The sites post to the site-track Edge
-- Function, which derives the site from the request's Origin and the
-- device type from the user agent; nothing that identifies a person is
-- kept (no IP, no user agent, no cookie — session_id is a random value
-- that lives only for one browser tab). Staff read it through
-- site_stats() on Relatórios → Site.
create table if not exists public.site_events (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  site text not null check (site in ('naymurta', 'experience')),
  kind text not null check (kind in ('view', 'click')),
  path text not null default '/',
  label text,
  device text check (device in ('mobile', 'tablet', 'desktop')),
  referrer text,
  utm_source text,
  session_id text
);
create index if not exists site_events_created_idx on public.site_events (created_at);
alter table public.site_events enable row level security;
create policy site_events_staff_read on public.site_events
  for select using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role in ('admin', 'assistant')));

-- One call returns everything Relatórios → Site shows for a period.
-- Security invoker: the staff-only RLS above still applies.
create or replace function public.site_stats(p_from timestamptz, p_to timestamptz)
returns jsonb language sql stable security invoker set search_path = public as $$
  with e as (select * from site_events where created_at >= p_from and created_at < p_to)
  select jsonb_build_object(
    'totals', coalesce((select jsonb_agg(t) from (
      select site, count(*) filter (where kind = 'view') as views,
             count(distinct session_id) filter (where kind = 'view') as visits,
             count(*) filter (where kind = 'click') as clicks
      from e group by site) t), '[]'::jsonb),
    'by_day', coalesce((select jsonb_agg(t order by day) from (
      select (created_at at time zone 'America/Sao_Paulo')::date as day, site,
             count(distinct session_id) filter (where kind = 'view') as visits,
             count(*) filter (where kind = 'click') as clicks
      from e group by 1, 2) t), '[]'::jsonb),
    'clicks', coalesce((select jsonb_agg(t order by n desc) from (
      select site, label, count(*) as n from e where kind = 'click' group by 1, 2 order by 3 desc limit 40) t), '[]'::jsonb),
    'pages', coalesce((select jsonb_agg(t order by n desc) from (
      select site, path, count(*) as n from e where kind = 'view' group by 1, 2 order by 3 desc limit 20) t), '[]'::jsonb),
    'devices', coalesce((select jsonb_agg(t) from (
      select coalesce(device, 'desktop') as device, count(distinct session_id) as visits from e where kind = 'view' group by 1) t), '[]'::jsonb),
    'sources', coalesce((select jsonb_agg(t order by n desc) from (
      select coalesce(nullif(utm_source, ''), nullif(referrer, ''), 'direto') as source, count(distinct session_id) as n
      from e where kind = 'view' group by 1 order by 2 desc limit 15) t), '[]'::jsonb)
  );
$$;
revoke all on function public.site_stats(timestamptz, timestamptz) from public, anon;
grant execute on function public.site_stats(timestamptz, timestamptz) to authenticated;
