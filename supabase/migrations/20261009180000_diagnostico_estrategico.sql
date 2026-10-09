-- "Extração de Marca" becomes "Diagnóstico Estratégico de Entrada"
-- (app/shared/diagnostic-template.js): 14 questions in 5 sections, each
-- with a help line, and three 0–10 ratings with labels at both ends.
-- Questions are stored per client, so they get columns for that.
-- Questionnaires already created keep their questions and answers.
alter table public.questionnaire_questions
  add column if not exists section text,
  add column if not exists help text,
  add column if not exists min_label text,
  add column if not exists max_label text;

update public.program_activities
  set title = 'Diagnóstico Estratégico de Entrada',
      description = 'O ponto de partida da nossa jornada: quem você é, o momento atual do seu negócio, seus diferenciais e o que deseja conquistar.'
  where slug = 'brand-extraction';
update public.program_phases
  set description = replace(description, 'na Extração de Marca', 'no Diagnóstico Estratégico de Entrada')
  where description like '%Extração de Marca%';
update public.encounter_defs
  set purpose = replace(purpose, 'da Extração de Marca', 'do Diagnóstico Estratégico de Entrada')
  where purpose like '%Extração de Marca%';
update public.encounter_prep_checklist_items
  set label = replace(label, 'da Extração de Marca', 'do Diagnóstico Estratégico de Entrada')
  where label like '%Extração de Marca%';
