-- "Combinados do encontro": what Nay and the student agreed in a meeting,
-- plus links/materials mentioned, written by staff in the client workspace
-- (Encontros tab) and shown to the student on her Encontros page.
-- On agenda_items itself: the student already reads her own meetings via
-- agenda_items_client_read (related_student_id = her client_id), staff
-- write via the existing admin/assistant policies — no new access paths.
alter table public.agenda_items
  add column if not exists shared_notes text,
  add column if not exists shared_links jsonb not null default '[]'::jsonb, -- [{ label, url }]
  add column if not exists shared_updated_at timestamptz;
