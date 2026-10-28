-- E2 is no longer the last Essencial encounter: drop "Encerramento formal da
-- Persea Essencial." from its description.
update public.encounter_defs
set purpose = trim(replace(purpose, ' Encerramento formal da Persea Essencial.', ''))
where number = 2;
