-- Follows 20261016120000_swap_e2_e4: Nay asked for the E2/E4 prep
-- checklists to swap along with the descriptions.
update public.encounter_prep_checklist_items
set encounter_number = case encounter_number when 2 then 4 else 2 end
where encounter_number in (2, 4);
