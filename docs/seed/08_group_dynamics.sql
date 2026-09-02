
-- ============================================================
-- group_dynamics
-- ============================================================
insert into group_dynamics (legacy_id, title, dynamic_date, description, metric_label, before_count, after_count) values ('gd1', 'Aula de Oratória ao Vivo', '2026-07-20', 'Aula gratuita sobre comunicação em público no grupo VIP, encerrada com convite para preencher a ficha de interesse na mentoria.', 'Preenchimento da Ficha de Interesse', 15, 18);
insert into group_dynamics (legacy_id, title, dynamic_date, description, metric_label, before_count, after_count) values ('gd2', 'Q&A Semanal no Grupo VIP', '2026-08-05', 'Sessão de perguntas e respostas ao vivo sobre posicionamento pessoal.', 'Novas Solicitações de Reunião', 4, 7);

-- ============================================================
-- assistant_messages
-- ============================================================
insert into assistant_messages (legacy_id, from_role, client_id, text, route, sent_at, read) values ('am1', 'nay', (select id from clients where legacy_id = 'client-6'), 'Antes de montar o Guia de Looks da Débora, dá uma olhada na gravação do diagnóstico inicial dela (Agenda, 05/08) — ela foi bem específica sobre não gostar de estampas.', 'agenda.html', '2026-08-17T09:10:00', false);
insert into assistant_messages (legacy_id, from_role, client_id, text, route, sent_at, read) values ('am2', 'nay', (select id from clients where legacy_id = 'client-5'), 'Camila confirmou a reunião de fechamento pra dia 22 — se ela assinar lá, já pode subir o contrato autenticado no mesmo dia.', 'client-workspace.html?id=client-5', '2026-08-15T16:40:00', true);
insert into assistant_messages (legacy_id, from_role, client_id, text, route, sent_at, read) values ('am3', 'assistant', (select id from clients where legacy_id = 'client-6'), 'Feito — assisti a gravação e já ajustei o briefing do guia para evitar estampas. Devo ter a primeira versão pronta até quinta.', NULL, '2026-08-17T09:45:00', true);
