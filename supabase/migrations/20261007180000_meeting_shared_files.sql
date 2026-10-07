-- Photos and documents Nay shares with a student about one meeting
-- ("Combinados do encontro"), next to agenda_items.shared_notes/links.
-- Private bucket; files live under <client_id>/<agenda_item_id>/...
-- Staff (admin/assistant) upload, read and delete; a student can only read
-- files in her own client folder. The list shown on each meeting is kept
-- in agenda_items.shared_files.
insert into storage.buckets (id, name, public, file_size_limit)
values ('client-shared-files', 'client-shared-files', false, 26214400)
on conflict (id) do nothing;

create policy client_shared_files_staff_all on storage.objects
  for all to authenticated
  using (bucket_id = 'client-shared-files' and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role in ('admin', 'assistant')))
  with check (bucket_id = 'client-shared-files' and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role in ('admin', 'assistant')));

create policy client_shared_files_client_read on storage.objects
  for select to authenticated
  using (bucket_id = 'client-shared-files' and exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = 'client' and p.client_id::text = (storage.foldername(name))[1]));

-- [{ path, name, type, size }]
alter table public.agenda_items
  add column if not exists shared_files jsonb not null default '[]'::jsonb;
