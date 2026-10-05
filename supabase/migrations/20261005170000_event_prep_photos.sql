-- Childhood photo and photos of special people for a PERSEA Experience
-- dynamic, uploaded from the preparation form. Private bucket: the public
-- form only gets per-file signed upload URLs from event-prep (scoped to the
-- registration's own folder); staff read them from the CRM.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('event-prep-photos', 'event-prep-photos', false, 15728640, array['image/jpeg','image/png','image/webp','image/heic','image/heif'])
on conflict (id) do nothing;

create policy event_prep_photos_staff_read on storage.objects
  for select to authenticated
  using (bucket_id = 'event-prep-photos' and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role in ('admin', 'assistant')));

-- [{ path }] — path is "<registration id>/<kind>-<uuid>.<ext>"
alter table public.event_registrations
  add column if not exists prep_child_photos jsonb not null default '[]'::jsonb,
  add column if not exists prep_special_photos jsonb not null default '[]'::jsonb;
