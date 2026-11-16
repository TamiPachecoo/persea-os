-- Agenda da Nay: a assistente marca um evento do Google como "Pessoal"
-- (tempo pessoal da Nay, nada a confirmar). Para um evento que se repete,
-- a linha event_id = 'series:<recurringEventId>' marca todas as repetições.
alter table public.calendar_event_confirmations drop constraint if exists calendar_event_confirmations_status_check;
alter table public.calendar_event_confirmations add constraint calendar_event_confirmations_status_check
  check (status in ('message_sent', 'confirmed', 'reschedule', 'personal'));
