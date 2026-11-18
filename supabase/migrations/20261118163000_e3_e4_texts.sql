-- Texts follow the new split: E3 = what Nay chose (Cartela de Cores + Guia
-- de Produções by default; no more Ferramentas para Nova Imagem); the
-- Ensaio Fotográfico moodboard moves to E4 (the assistant can prepare it).
update public.encounter_defs set purpose = 'A imagem a serviço do QUE e do COMO vender. A assistente já preparou e Nay já aprovou os materiais de imagem escolhidos para a cliente (Cartela de Cores e Guia de Produções) — apresentados juntos nesta chamada de 1h.'
where number = 3;
update public.encounter_defs set purpose = 'COMO e ONDE vender — cliente já fez o ensaio fotográfico profissional. Nay apresenta o novo Kit Digital, o Ensaio Fotográfico e o Playbook de Marca Pessoal, alinhando posicionamento, metas tangíveis e precificação.'
where number = 4;
update public.encounter_prep_checklist_items set label = 'Planejamento de Imagem pronto'
where encounter_number = 3 and label = 'Planejamento de Imagem e Ferramentas para Nova Imagem prontos';
insert into public.encounter_prep_checklist_items (encounter_number, label, sort_order)
select 4, 'Moodboard do Ensaio Fotográfico pronto (Pinterest, Canva ou PDF)', coalesce(max(sort_order), 0) + 1
from public.encounter_prep_checklist_items where encounter_number = 4
having not exists (select 1 from public.encounter_prep_checklist_items where encounter_number = 4 and label like 'Moodboard do Ensaio%');
