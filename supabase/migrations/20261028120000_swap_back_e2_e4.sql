-- Back to the original order, as Nay confirmed: E2 is "Comunicação e Vendas"
-- and E4 is "Posicionamento e Metas" (undoes 20261016120000_swap_e2_e4).
-- The two descriptions (purpose) swap back with their names.
update public.encounter_defs d set
  name = case d.number when 2 then 'Comunicação e Vendas' else 'Posicionamento e Metas' end,
  purpose = (select o.purpose from public.encounter_defs o where o.number = case d.number when 2 then 4 else 2 end)
where d.number in (2, 4);
