-- Names stay (E2 Posicionamento e Metas, E4 Comunicação e Vendas); only the
-- two descriptions swap, as Tami asked.
update public.encounter_defs d set
  purpose = (select o.purpose from public.encounter_defs o where o.number = case d.number when 2 then 4 else 2 end)
where d.number in (2, 4);
