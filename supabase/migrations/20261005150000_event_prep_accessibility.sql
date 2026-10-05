-- Accessibility needs on the PERSEA Experience preparation form, so the
-- venue can be adapted ahead of the event.
alter table public.event_registrations
  add column if not exists prep_accessibility text[],
  add column if not exists prep_accessibility_note text;
