-- Final order confirmed by Tami: E2 stays "Posicionamento e Metas" (as set on
-- 16 Oct) and E4 is "Comunicação e Vendas". Undoes 20261028120000 and renames
-- E4 from "Comunicação"; descriptions swap back with their names.
update public.encounter_defs d set
  name = case d.number when 2 then 'Posicionamento e Metas' else 'Comunicação e Vendas' end,
  purpose = (select o.purpose from public.encounter_defs o where o.number = case d.number when 2 then 4 else 2 end)
where d.number in (2, 4);
