-- Answers from the public mentoria application form (naymurta.com/aplicacao),
-- stored on the lead so the CRM shows them next to her contact details.
alter table public.leads
  add column if not exists instagram text,
  add column if not exists application jsonb,
  add column if not exists application_submitted_at timestamptz;
