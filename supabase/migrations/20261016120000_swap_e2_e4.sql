-- Nay's new encounter order: E2 is now "Posicionamento e Metas" and E4
-- "Comunicação". Names set as asked; the two descriptions (purpose) are
-- swapped so each follows its content. Prep checklists left as they were.
update public.encounter_defs d set
  name = case d.number when 2 then 'Posicionamento e Metas' else 'Comunicação' end,
  purpose = (select o.purpose from public.encounter_defs o where o.number = case d.number when 2 then 4 else 2 end)
where d.number in (2, 4);
