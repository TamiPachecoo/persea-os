-- PERSEA Experience: direct sign-up link for attendees who never went
-- through the event page checkout (paid outside the system, guests of the
-- house...). The link is perseaexperience.naymurta.com/preparacao.html?c=<code>:
-- she fills in her details first, which creates her registration
-- (status 'confirmada', provider 'cadastro_direto', amount 0), then the
-- usual preparation form. Staff copy or rotate the code from Eventos.
alter table public.tenant_settings
  add column if not exists event_direct_signup_code text;

update public.tenant_settings
set event_direct_signup_code = substr(replace(gen_random_uuid()::text, '-', ''), 1, 16)
where id = 1 and event_direct_signup_code is null;
