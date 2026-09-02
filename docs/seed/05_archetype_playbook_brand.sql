
-- ============================================================
-- archetype_quiz_attempts + archetype_quiz_responses
-- ============================================================
insert into archetype_quiz_attempts (legacy_id, client_id, quiz_version, status, started_at, completed_at, activity_logged) values ('aq1', (select id from clients where legacy_id = 'client-1'), 1, 'completed', '2026-08-05T19:00:00', '2026-08-05T19:22:00', true);
insert into archetype_quiz_responses (attempt_id, question_number, score) values ((select id from archetype_quiz_attempts where legacy_id = 'aq1'), 1, 4);
insert into archetype_quiz_responses (attempt_id, question_number, score) values ((select id from archetype_quiz_attempts where legacy_id = 'aq1'), 2, 4);
insert into archetype_quiz_responses (attempt_id, question_number, score) values ((select id from archetype_quiz_attempts where legacy_id = 'aq1'), 3, 4);
insert into archetype_quiz_responses (attempt_id, question_number, score) values ((select id from archetype_quiz_attempts where legacy_id = 'aq1'), 4, 5);
insert into archetype_quiz_responses (attempt_id, question_number, score) values ((select id from archetype_quiz_attempts where legacy_id = 'aq1'), 5, 5);
insert into archetype_quiz_responses (attempt_id, question_number, score) values ((select id from archetype_quiz_attempts where legacy_id = 'aq1'), 6, 3);
insert into archetype_quiz_responses (attempt_id, question_number, score) values ((select id from archetype_quiz_attempts where legacy_id = 'aq1'), 7, 4);
insert into archetype_quiz_responses (attempt_id, question_number, score) values ((select id from archetype_quiz_attempts where legacy_id = 'aq1'), 8, 4);
insert into archetype_quiz_responses (attempt_id, question_number, score) values ((select id from archetype_quiz_attempts where legacy_id = 'aq1'), 9, 3);
insert into archetype_quiz_responses (attempt_id, question_number, score) values ((select id from archetype_quiz_attempts where legacy_id = 'aq1'), 10, 4);
insert into archetype_quiz_responses (attempt_id, question_number, score) values ((select id from archetype_quiz_attempts where legacy_id = 'aq1'), 11, 4);
insert into archetype_quiz_responses (attempt_id, question_number, score) values ((select id from archetype_quiz_attempts where legacy_id = 'aq1'), 12, 5);
insert into archetype_quiz_responses (attempt_id, question_number, score) values ((select id from archetype_quiz_attempts where legacy_id = 'aq1'), 13, 3);
insert into archetype_quiz_responses (attempt_id, question_number, score) values ((select id from archetype_quiz_attempts where legacy_id = 'aq1'), 14, 5);
insert into archetype_quiz_responses (attempt_id, question_number, score) values ((select id from archetype_quiz_attempts where legacy_id = 'aq1'), 15, 5);
insert into archetype_quiz_responses (attempt_id, question_number, score) values ((select id from archetype_quiz_attempts where legacy_id = 'aq1'), 16, 4);
insert into archetype_quiz_responses (attempt_id, question_number, score) values ((select id from archetype_quiz_attempts where legacy_id = 'aq1'), 17, 2);
insert into archetype_quiz_responses (attempt_id, question_number, score) values ((select id from archetype_quiz_attempts where legacy_id = 'aq1'), 18, 3);
insert into archetype_quiz_responses (attempt_id, question_number, score) values ((select id from archetype_quiz_attempts where legacy_id = 'aq1'), 19, 2);
insert into archetype_quiz_responses (attempt_id, question_number, score) values ((select id from archetype_quiz_attempts where legacy_id = 'aq1'), 20, 4);
insert into archetype_quiz_responses (attempt_id, question_number, score) values ((select id from archetype_quiz_attempts where legacy_id = 'aq1'), 21, 4);
insert into archetype_quiz_responses (attempt_id, question_number, score) values ((select id from archetype_quiz_attempts where legacy_id = 'aq1'), 22, 5);
insert into archetype_quiz_responses (attempt_id, question_number, score) values ((select id from archetype_quiz_attempts where legacy_id = 'aq1'), 23, 5);
insert into archetype_quiz_responses (attempt_id, question_number, score) values ((select id from archetype_quiz_attempts where legacy_id = 'aq1'), 24, 4);
insert into archetype_quiz_responses (attempt_id, question_number, score) values ((select id from archetype_quiz_attempts where legacy_id = 'aq1'), 25, 5);
insert into archetype_quiz_responses (attempt_id, question_number, score) values ((select id from archetype_quiz_attempts where legacy_id = 'aq1'), 26, 5);
insert into archetype_quiz_responses (attempt_id, question_number, score) values ((select id from archetype_quiz_attempts where legacy_id = 'aq1'), 27, 4);
insert into archetype_quiz_responses (attempt_id, question_number, score) values ((select id from archetype_quiz_attempts where legacy_id = 'aq1'), 28, 4);
insert into archetype_quiz_responses (attempt_id, question_number, score) values ((select id from archetype_quiz_attempts where legacy_id = 'aq1'), 29, 5);
insert into archetype_quiz_responses (attempt_id, question_number, score) values ((select id from archetype_quiz_attempts where legacy_id = 'aq1'), 30, 4);
insert into archetype_quiz_responses (attempt_id, question_number, score) values ((select id from archetype_quiz_attempts where legacy_id = 'aq1'), 31, 5);
insert into archetype_quiz_responses (attempt_id, question_number, score) values ((select id from archetype_quiz_attempts where legacy_id = 'aq1'), 32, 5);
insert into archetype_quiz_responses (attempt_id, question_number, score) values ((select id from archetype_quiz_attempts where legacy_id = 'aq1'), 33, 2);
insert into archetype_quiz_responses (attempt_id, question_number, score) values ((select id from archetype_quiz_attempts where legacy_id = 'aq1'), 34, 4);
insert into archetype_quiz_responses (attempt_id, question_number, score) values ((select id from archetype_quiz_attempts where legacy_id = 'aq1'), 35, 4);
insert into archetype_quiz_responses (attempt_id, question_number, score) values ((select id from archetype_quiz_attempts where legacy_id = 'aq1'), 36, 1);
insert into archetype_quiz_responses (attempt_id, question_number, score) values ((select id from archetype_quiz_attempts where legacy_id = 'aq1'), 37, 3);
insert into archetype_quiz_responses (attempt_id, question_number, score) values ((select id from archetype_quiz_attempts where legacy_id = 'aq1'), 38, 5);
insert into archetype_quiz_responses (attempt_id, question_number, score) values ((select id from archetype_quiz_attempts where legacy_id = 'aq1'), 39, 4);
insert into archetype_quiz_responses (attempt_id, question_number, score) values ((select id from archetype_quiz_attempts where legacy_id = 'aq1'), 40, 5);
insert into archetype_quiz_responses (attempt_id, question_number, score) values ((select id from archetype_quiz_attempts where legacy_id = 'aq1'), 41, 5);
insert into archetype_quiz_responses (attempt_id, question_number, score) values ((select id from archetype_quiz_attempts where legacy_id = 'aq1'), 42, 4);
insert into archetype_quiz_responses (attempt_id, question_number, score) values ((select id from archetype_quiz_attempts where legacy_id = 'aq1'), 43, 5);
insert into archetype_quiz_responses (attempt_id, question_number, score) values ((select id from archetype_quiz_attempts where legacy_id = 'aq1'), 44, 3);
insert into archetype_quiz_responses (attempt_id, question_number, score) values ((select id from archetype_quiz_attempts where legacy_id = 'aq1'), 45, 3);
insert into archetype_quiz_responses (attempt_id, question_number, score) values ((select id from archetype_quiz_attempts where legacy_id = 'aq1'), 46, 5);
insert into archetype_quiz_responses (attempt_id, question_number, score) values ((select id from archetype_quiz_attempts where legacy_id = 'aq1'), 47, 3);
insert into archetype_quiz_responses (attempt_id, question_number, score) values ((select id from archetype_quiz_attempts where legacy_id = 'aq1'), 48, 5);
insert into archetype_quiz_attempts (legacy_id, client_id, quiz_version, status, started_at, completed_at, activity_logged) values ('aq2', (select id from clients where legacy_id = 'client-2'), 1, 'in_progress', '2026-08-17T20:00:00', NULL, false);
insert into archetype_quiz_responses (attempt_id, question_number, score) values ((select id from archetype_quiz_attempts where legacy_id = 'aq2'), 1, 4);
insert into archetype_quiz_responses (attempt_id, question_number, score) values ((select id from archetype_quiz_attempts where legacy_id = 'aq2'), 2, 4);
insert into archetype_quiz_responses (attempt_id, question_number, score) values ((select id from archetype_quiz_attempts where legacy_id = 'aq2'), 3, 4);
insert into archetype_quiz_responses (attempt_id, question_number, score) values ((select id from archetype_quiz_attempts where legacy_id = 'aq2'), 4, 5);
insert into archetype_quiz_responses (attempt_id, question_number, score) values ((select id from archetype_quiz_attempts where legacy_id = 'aq2'), 5, 5);
insert into archetype_quiz_responses (attempt_id, question_number, score) values ((select id from archetype_quiz_attempts where legacy_id = 'aq2'), 6, 3);
insert into archetype_quiz_responses (attempt_id, question_number, score) values ((select id from archetype_quiz_attempts where legacy_id = 'aq2'), 7, 4);
insert into archetype_quiz_responses (attempt_id, question_number, score) values ((select id from archetype_quiz_attempts where legacy_id = 'aq2'), 8, 4);
insert into archetype_quiz_responses (attempt_id, question_number, score) values ((select id from archetype_quiz_attempts where legacy_id = 'aq2'), 9, 3);
insert into archetype_quiz_responses (attempt_id, question_number, score) values ((select id from archetype_quiz_attempts where legacy_id = 'aq2'), 10, 4);
insert into archetype_quiz_responses (attempt_id, question_number, score) values ((select id from archetype_quiz_attempts where legacy_id = 'aq2'), 11, 4);
insert into archetype_quiz_responses (attempt_id, question_number, score) values ((select id from archetype_quiz_attempts where legacy_id = 'aq2'), 12, 5);
insert into archetype_quiz_responses (attempt_id, question_number, score) values ((select id from archetype_quiz_attempts where legacy_id = 'aq2'), 13, 3);
insert into archetype_quiz_responses (attempt_id, question_number, score) values ((select id from archetype_quiz_attempts where legacy_id = 'aq2'), 14, 5);
insert into archetype_quiz_responses (attempt_id, question_number, score) values ((select id from archetype_quiz_attempts where legacy_id = 'aq2'), 15, 5);
insert into archetype_quiz_responses (attempt_id, question_number, score) values ((select id from archetype_quiz_attempts where legacy_id = 'aq2'), 16, 4);
insert into archetype_quiz_responses (attempt_id, question_number, score) values ((select id from archetype_quiz_attempts where legacy_id = 'aq2'), 17, 2);
insert into archetype_quiz_responses (attempt_id, question_number, score) values ((select id from archetype_quiz_attempts where legacy_id = 'aq2'), 18, 3);
insert into archetype_quiz_responses (attempt_id, question_number, score) values ((select id from archetype_quiz_attempts where legacy_id = 'aq2'), 19, 2);
insert into archetype_quiz_responses (attempt_id, question_number, score) values ((select id from archetype_quiz_attempts where legacy_id = 'aq2'), 20, 4);
insert into archetype_quiz_attempts (legacy_id, client_id, quiz_version, status, started_at, completed_at, activity_logged) values ('aq3', (select id from clients where legacy_id = 'client-3'), 1, 'completed', '2026-08-16T09:00:00', '2026-08-16T09:19:00', true);
insert into archetype_quiz_responses (attempt_id, question_number, score) values ((select id from archetype_quiz_attempts where legacy_id = 'aq3'), 1, 2);
insert into archetype_quiz_responses (attempt_id, question_number, score) values ((select id from archetype_quiz_attempts where legacy_id = 'aq3'), 2, 4);
insert into archetype_quiz_responses (attempt_id, question_number, score) values ((select id from archetype_quiz_attempts where legacy_id = 'aq3'), 3, 3);
insert into archetype_quiz_responses (attempt_id, question_number, score) values ((select id from archetype_quiz_attempts where legacy_id = 'aq3'), 4, 3);
insert into archetype_quiz_responses (attempt_id, question_number, score) values ((select id from archetype_quiz_attempts where legacy_id = 'aq3'), 5, 3);
insert into archetype_quiz_responses (attempt_id, question_number, score) values ((select id from archetype_quiz_attempts where legacy_id = 'aq3'), 6, 2);
insert into archetype_quiz_responses (attempt_id, question_number, score) values ((select id from archetype_quiz_attempts where legacy_id = 'aq3'), 7, 2);
insert into archetype_quiz_responses (attempt_id, question_number, score) values ((select id from archetype_quiz_attempts where legacy_id = 'aq3'), 8, 3);
insert into archetype_quiz_responses (attempt_id, question_number, score) values ((select id from archetype_quiz_attempts where legacy_id = 'aq3'), 9, 3);
insert into archetype_quiz_responses (attempt_id, question_number, score) values ((select id from archetype_quiz_attempts where legacy_id = 'aq3'), 10, 3);
insert into archetype_quiz_responses (attempt_id, question_number, score) values ((select id from archetype_quiz_attempts where legacy_id = 'aq3'), 11, 3);
insert into archetype_quiz_responses (attempt_id, question_number, score) values ((select id from archetype_quiz_attempts where legacy_id = 'aq3'), 12, 2);
insert into archetype_quiz_responses (attempt_id, question_number, score) values ((select id from archetype_quiz_attempts where legacy_id = 'aq3'), 13, 2);
insert into archetype_quiz_responses (attempt_id, question_number, score) values ((select id from archetype_quiz_attempts where legacy_id = 'aq3'), 14, 2);
insert into archetype_quiz_responses (attempt_id, question_number, score) values ((select id from archetype_quiz_attempts where legacy_id = 'aq3'), 15, 2);
insert into archetype_quiz_responses (attempt_id, question_number, score) values ((select id from archetype_quiz_attempts where legacy_id = 'aq3'), 16, 2);
insert into archetype_quiz_responses (attempt_id, question_number, score) values ((select id from archetype_quiz_attempts where legacy_id = 'aq3'), 17, 1);
insert into archetype_quiz_responses (attempt_id, question_number, score) values ((select id from archetype_quiz_attempts where legacy_id = 'aq3'), 18, 4);
insert into archetype_quiz_responses (attempt_id, question_number, score) values ((select id from archetype_quiz_attempts where legacy_id = 'aq3'), 19, 5);
insert into archetype_quiz_responses (attempt_id, question_number, score) values ((select id from archetype_quiz_attempts where legacy_id = 'aq3'), 20, 3);
insert into archetype_quiz_responses (attempt_id, question_number, score) values ((select id from archetype_quiz_attempts where legacy_id = 'aq3'), 21, 2);
insert into archetype_quiz_responses (attempt_id, question_number, score) values ((select id from archetype_quiz_attempts where legacy_id = 'aq3'), 22, 3);
insert into archetype_quiz_responses (attempt_id, question_number, score) values ((select id from archetype_quiz_attempts where legacy_id = 'aq3'), 23, 4);
insert into archetype_quiz_responses (attempt_id, question_number, score) values ((select id from archetype_quiz_attempts where legacy_id = 'aq3'), 24, 4);
insert into archetype_quiz_responses (attempt_id, question_number, score) values ((select id from archetype_quiz_attempts where legacy_id = 'aq3'), 25, 5);
insert into archetype_quiz_responses (attempt_id, question_number, score) values ((select id from archetype_quiz_attempts where legacy_id = 'aq3'), 26, 5);
insert into archetype_quiz_responses (attempt_id, question_number, score) values ((select id from archetype_quiz_attempts where legacy_id = 'aq3'), 27, 1);
insert into archetype_quiz_responses (attempt_id, question_number, score) values ((select id from archetype_quiz_attempts where legacy_id = 'aq3'), 28, 2);
insert into archetype_quiz_responses (attempt_id, question_number, score) values ((select id from archetype_quiz_attempts where legacy_id = 'aq3'), 29, 3);
insert into archetype_quiz_responses (attempt_id, question_number, score) values ((select id from archetype_quiz_attempts where legacy_id = 'aq3'), 30, 3);
insert into archetype_quiz_responses (attempt_id, question_number, score) values ((select id from archetype_quiz_attempts where legacy_id = 'aq3'), 31, 4);
insert into archetype_quiz_responses (attempt_id, question_number, score) values ((select id from archetype_quiz_attempts where legacy_id = 'aq3'), 32, 3);
insert into archetype_quiz_responses (attempt_id, question_number, score) values ((select id from archetype_quiz_attempts where legacy_id = 'aq3'), 33, 2);
insert into archetype_quiz_responses (attempt_id, question_number, score) values ((select id from archetype_quiz_attempts where legacy_id = 'aq3'), 34, 5);
insert into archetype_quiz_responses (attempt_id, question_number, score) values ((select id from archetype_quiz_attempts where legacy_id = 'aq3'), 35, 4);
insert into archetype_quiz_responses (attempt_id, question_number, score) values ((select id from archetype_quiz_attempts where legacy_id = 'aq3'), 36, 1);
insert into archetype_quiz_responses (attempt_id, question_number, score) values ((select id from archetype_quiz_attempts where legacy_id = 'aq3'), 37, 2);
insert into archetype_quiz_responses (attempt_id, question_number, score) values ((select id from archetype_quiz_attempts where legacy_id = 'aq3'), 38, 5);
insert into archetype_quiz_responses (attempt_id, question_number, score) values ((select id from archetype_quiz_attempts where legacy_id = 'aq3'), 39, 2);
insert into archetype_quiz_responses (attempt_id, question_number, score) values ((select id from archetype_quiz_attempts where legacy_id = 'aq3'), 40, 3);
insert into archetype_quiz_responses (attempt_id, question_number, score) values ((select id from archetype_quiz_attempts where legacy_id = 'aq3'), 41, 5);
insert into archetype_quiz_responses (attempt_id, question_number, score) values ((select id from archetype_quiz_attempts where legacy_id = 'aq3'), 42, 4);
insert into archetype_quiz_responses (attempt_id, question_number, score) values ((select id from archetype_quiz_attempts where legacy_id = 'aq3'), 43, 4);
insert into archetype_quiz_responses (attempt_id, question_number, score) values ((select id from archetype_quiz_attempts where legacy_id = 'aq3'), 44, 4);
insert into archetype_quiz_responses (attempt_id, question_number, score) values ((select id from archetype_quiz_attempts where legacy_id = 'aq3'), 45, 2);
insert into archetype_quiz_responses (attempt_id, question_number, score) values ((select id from archetype_quiz_attempts where legacy_id = 'aq3'), 46, 3);
insert into archetype_quiz_responses (attempt_id, question_number, score) values ((select id from archetype_quiz_attempts where legacy_id = 'aq3'), 47, 3);
insert into archetype_quiz_responses (attempt_id, question_number, score) values ((select id from archetype_quiz_attempts where legacy_id = 'aq3'), 48, 2);

-- ============================================================
-- client_archetype_settings (1:1)
-- ============================================================
insert into client_archetype_settings (client_id, visual_set, notes) values ((select id from clients where legacy_id = 'client-1'), 'female', 'Combinação forte de Mago + trio de Exploradora/Amante/Governante — conversar sobre como isso aparece na comunicação dela nas redes.');
insert into client_archetype_settings (client_id, visual_set, notes) values ((select id from clients where legacy_id = 'client-2'), NULL, '');
insert into client_archetype_settings (client_id, visual_set, notes) values ((select id from clients where legacy_id = 'client-3'), 'female', '');
insert into client_archetype_settings (client_id, visual_set, notes) values ((select id from clients where legacy_id = 'client-4'), NULL, '');
insert into client_archetype_settings (client_id, visual_set, notes) values ((select id from clients where legacy_id = 'client-5'), NULL, '');
insert into client_archetype_settings (client_id, visual_set, notes) values ((select id from clients where legacy_id = 'client-6'), NULL, '');
insert into client_archetype_settings (client_id, visual_set, notes) values ((select id from clients where legacy_id = 'client-7'), NULL, '');

-- ============================================================
-- playbooks + playbook_versions + playbook_sections
-- ============================================================
insert into playbooks (client_id) values ((select id from clients where legacy_id = 'client-1'));
insert into playbook_versions (client_id, version, status, created_at, published_at) values ((select id from clients where legacy_id = 'client-1'), 1, 'published', '2026-07-05T09:00:00', '2026-07-06T11:00:00');
insert into playbook_sections (playbook_version_id, section_key, content) values ((select id from playbook_versions where client_id = (select id from clients where legacy_id = 'client-1') and version = 1), 'identity', 'Uma estrategista de marca focada em precisão, que transforma expertise silenciosa em autoridade visível.');
insert into playbook_sections (playbook_version_id, section_key, content) values ((select id from playbook_versions where client_id = (select id from clients where legacy_id = 'client-1') and version = 1), 'mission', 'Ajudar especialistas de alto nível a pararem de se subestimar em público.');
insert into playbook_sections (playbook_version_id, section_key, content) values ((select id from playbook_versions where client_id = (select id from clients where legacy_id = 'client-1') and version = 1), 'vision', 'Um mundo onde competência e percepção nunca estão desalinhadas.');
insert into playbook_sections (playbook_version_id, section_key, content) values ((select id from playbook_versions where client_id = (select id from clients where legacy_id = 'client-1') and version = 1), 'core_story', 'Começou como a pessoa a quem os clientes recorriam depois que o primeiro consultor falhava — percebeu que a lacuna nunca foi de habilidade, e sim de narrativa.');
insert into playbook_sections (playbook_version_id, section_key, content) values ((select id from playbook_versions where client_id = (select id from clients where legacy_id = 'client-1') and version = 1), 'golden_circle', 'Por quê: o desalinhamento entre competência e percepção é um problema solucionável. Como: posicionamento de precisão + narrativa confiante. O quê: estratégia de marca para especialistas.');
insert into playbook_sections (playbook_version_id, section_key, content) values ((select id from playbook_versions where client_id = (select id from clients where legacy_id = 'client-1') and version = 1), 'target_audience', 'Consultores e coaches estabelecidos, com forte entrega mas narrativa pública fraca.');
insert into playbook_sections (playbook_version_id, section_key, content) values ((select id from playbook_versions where client_id = (select id from clients where legacy_id = 'client-1') and version = 1), 'value_proposition', 'Tornamos seu posicionamento tão afiado quanto sua real expertise.');
insert into playbook_sections (playbook_version_id, section_key, content) values ((select id from playbook_versions where client_id = (select id from clients where legacy_id = 'client-1') and version = 1), 'positioning', 'A estrategista para especialistas cansados de soar como todo mundo.');
insert into playbook_sections (playbook_version_id, section_key, content) values ((select id from playbook_versions where client_id = (select id from clients where legacy_id = 'client-1') and version = 1), 'brand_voice', 'Precisa, calorosa, sem enrolação, discretamente confiante.');
insert into playbook_sections (playbook_version_id, section_key, content) values ((select id from playbook_versions where client_id = (select id from clients where legacy_id = 'client-1') and version = 1), 'communication_style', 'Direto, frases curtas, exemplos concretos em vez de abstrações.');
insert into playbook_sections (playbook_version_id, section_key, content) values ((select id from playbook_versions where client_id = (select id from clients where legacy_id = 'client-1') and version = 1), 'goals', 'Conquistar 3 palestras. Aumentar os valores em 30%. Construir uma metodologia própria.');
insert into playbook_sections (playbook_version_id, section_key, content) values ((select id from playbook_versions where client_id = (select id from clients where legacy_id = 'client-1') and version = 1), 'pitch_30s', 'Ajudo especialistas de alto nível a transformarem sua expertise silenciosa em uma marca que as pessoas realmente notam — sem soar como todo mundo na categoria.');
insert into playbook_sections (playbook_version_id, section_key, content) values ((select id from playbook_versions where client_id = (select id from clients where legacy_id = 'client-1') and version = 1), 'action_plan', '1) Publicar a declaração de posicionamento. 2) Reconstruir a bio em todas as plataformas. 3) Buscar 3 oportunidades de palestra neste trimestre.');
insert into playbooks (client_id) values ((select id from clients where legacy_id = 'client-2'));
insert into playbooks (client_id) values ((select id from clients where legacy_id = 'client-3'));
insert into playbook_versions (client_id, version, status, created_at, published_at) values ((select id from clients where legacy_id = 'client-3'), 1, 'draft', '2026-07-02T10:00:00', NULL);
insert into playbook_sections (playbook_version_id, section_key, content) values ((select id from playbook_versions where client_id = (select id from clients where legacy_id = 'client-3') and version = 1), 'identity', 'Uma consultora operacional que transforma caos administrativo em processo replicável.');
insert into playbook_sections (playbook_version_id, section_key, content) values ((select id from playbook_versions where client_id = (select id from clients where legacy_id = 'client-3') and version = 1), 'mission', 'Tirar pequenos negócios do improviso permanente.');
insert into playbook_sections (playbook_version_id, section_key, content) values ((select id from playbook_versions where client_id = (select id from clients where legacy_id = 'client-3') and version = 1), 'vision', 'Um mercado onde operação forte é tão valorizada quanto estratégia de marca.');
insert into playbook_sections (playbook_version_id, section_key, content) values ((select id from playbook_versions where client_id = (select id from clients where legacy_id = 'client-3') and version = 1), 'core_story', 'Começou organizando o próprio negócio da família — hoje aplica o mesmo método em dezenas de operações.');
insert into playbook_sections (playbook_version_id, section_key, content) values ((select id from playbook_versions where client_id = (select id from clients where legacy_id = 'client-3') and version = 1), 'golden_circle', 'Por quê: negócios crescem e a operação não acompanha. Como: diagnóstico + processo replicável. O quê: consultoria operacional.');
insert into playbook_sections (playbook_version_id, section_key, content) values ((select id from playbook_versions where client_id = (select id from clients where legacy_id = 'client-3') and version = 1), 'target_audience', 'Donos de pequenos negócios em crescimento rápido, sem processos definidos.');
insert into playbook_sections (playbook_version_id, section_key, content) values ((select id from playbook_versions where client_id = (select id from clients where legacy_id = 'client-3') and version = 1), 'value_proposition', 'Transformamos operação improvisada em processo que funciona sem você por perto.');
insert into playbook_sections (playbook_version_id, section_key, content) values ((select id from playbook_versions where client_id = (select id from clients where legacy_id = 'client-3') and version = 1), 'positioning', 'A consultora para quem já cresceu rápido demais para o próprio caos.');
insert into playbook_sections (playbook_version_id, section_key, content) values ((select id from playbook_versions where client_id = (select id from clients where legacy_id = 'client-3') and version = 1), 'brand_voice', 'Direta, prática, sem rodeios.');
insert into playbook_sections (playbook_version_id, section_key, content) values ((select id from playbook_versions where client_id = (select id from clients where legacy_id = 'client-3') and version = 1), 'communication_style', 'Frases curtas, exemplos concretos, pouca teoria.');
insert into playbook_sections (playbook_version_id, section_key, content) values ((select id from playbook_versions where client_id = (select id from clients where legacy_id = 'client-3') and version = 1), 'goals', 'Lançar oferta de diagnóstico. Recusar 30% dos projetos fora de foco.');
insert into playbook_sections (playbook_version_id, section_key, content) values ((select id from playbook_versions where client_id = (select id from clients where legacy_id = 'client-3') and version = 1), 'pitch_30s', 'Ajudo negócios que cresceram rápido demais a organizarem a operação antes que o caos vire prejuízo.');
insert into playbook_sections (playbook_version_id, section_key, content) values ((select id from playbook_versions where client_id = (select id from clients where legacy_id = 'client-3') and version = 1), 'action_plan', '1) Nomear a metodologia. 2) Lançar oferta de diagnóstico paga. 3) Reposicionar portfólio por transformação.');
insert into playbooks (client_id) values ((select id from clients where legacy_id = 'client-4'));
insert into playbooks (client_id) values ((select id from clients where legacy_id = 'client-5'));
insert into playbooks (client_id) values ((select id from clients where legacy_id = 'client-6'));
insert into playbooks (client_id) values ((select id from clients where legacy_id = 'client-7'));

-- ============================================================
-- playbook_experiences + playbook_quiz_results (1:1)
-- ============================================================
insert into playbook_experiences (client_id, format, completed_at) values ((select id from clients where legacy_id = 'client-1'), 'podcast', '2026-07-06T19:30:00');
insert into playbook_quiz_results (client_id, score, total, completed_at) values ((select id from clients where legacy_id = 'client-1'), 4, 4, '2026-07-06T19:45:00');
insert into playbook_experiences (client_id, format, completed_at) values ((select id from clients where legacy_id = 'client-2'), NULL, NULL);
insert into playbook_quiz_results (client_id, score, total, completed_at) values ((select id from clients where legacy_id = 'client-2'), NULL, NULL, NULL);
insert into playbook_experiences (client_id, format, completed_at) values ((select id from clients where legacy_id = 'client-3'), NULL, NULL);
insert into playbook_quiz_results (client_id, score, total, completed_at) values ((select id from clients where legacy_id = 'client-3'), NULL, NULL, NULL);
insert into playbook_experiences (client_id, format, completed_at) values ((select id from clients where legacy_id = 'client-4'), NULL, NULL);
insert into playbook_quiz_results (client_id, score, total, completed_at) values ((select id from clients where legacy_id = 'client-4'), NULL, NULL, NULL);
insert into playbook_experiences (client_id, format, completed_at) values ((select id from clients where legacy_id = 'client-5'), NULL, NULL);
insert into playbook_quiz_results (client_id, score, total, completed_at) values ((select id from clients where legacy_id = 'client-5'), NULL, NULL, NULL);
insert into playbook_experiences (client_id, format, completed_at) values ((select id from clients where legacy_id = 'client-6'), NULL, NULL);
insert into playbook_quiz_results (client_id, score, total, completed_at) values ((select id from clients where legacy_id = 'client-6'), NULL, NULL, NULL);
insert into playbook_experiences (client_id, format, completed_at) values ((select id from clients where legacy_id = 'client-7'), NULL, NULL);
insert into playbook_quiz_results (client_id, score, total, completed_at) values ((select id from clients where legacy_id = 'client-7'), NULL, NULL, NULL);

-- ============================================================
-- pitches (1:1, only clients with a populated pitches object)
-- ============================================================
insert into pitches (client_id, version, pitch_10s, pitch_30s, pitch_60s, pitch_networking, instagram_bio, linkedin_summary) values ((select id from clients where legacy_id = 'client-1'), 1, 'Transformo especialistas invisíveis em autoridades reconhecidas.', 'Ajudo especialistas de alto nível a transformarem sua expertise silenciosa em uma marca que as pessoas realmente notam — sem soar como todo mundo na categoria.', 'A maioria dos especialistas que conheço é melhor do que sua reputação sugere. Eu ajudo a fechar essa lacuna — afiando o posicionamento, a história e o discurso — para que a percepção finalmente corresponda ao nível em que realmente atuam.', 'Trabalho com especialistas que são ótimos no que fazem, mas esquecíveis em como se descrevem — eu resolvo a parte da descrição.', 'Estrategista de marca para especialistas ✨ Transformando expertise silenciosa em autoridade visível.', 'Ajudo consultores e coaches estabelecidos a fecharem a lacuna entre sua real expertise e como são percebidos — com posicionamento mais afiado, uma história mais clara e um discurso que realmente convence.');

-- ============================================================
-- brand_directions + brand_direction_keywords + brand_direction_references + brand_direction_style_notes
-- ============================================================
insert into brand_directions (client_id, pinterest_url, mood_board_intro, positioning_summary, tone, guidance, updated_at) values ((select id from clients where legacy_id = 'client-1'), 'https://www.pinterest.com/pachecootami/tatech-saas/', 'Este mural reúne as referências visuais que guiam sua marca — cores, composições e sensações que suas fotos, posts e vídeos devem evocar. Volte aqui sempre que estiver planejando um conteúdo novo ou em dúvida se algo "combina" com você.', 'Estrategista de precisão para especialistas que já entregam alto nível, mas ainda soam genéricos em público.', 'Direto, confiante, frases curtas — nunca informal demais nem excessivamente formal.', 'Evitar linguagem motivacional genérica — Marina conquista pela precisão, não pelo entusiasmo.', '2026-08-01T10:00:00');
insert into brand_direction_keywords (client_id, keyword, sort_order) values ((select id from brand_directions where client_id = (select id from clients where legacy_id = 'client-1')), 'Precisa', 0);
insert into brand_direction_keywords (client_id, keyword, sort_order) values ((select id from brand_directions where client_id = (select id from clients where legacy_id = 'client-1')), 'Calorosa', 1);
insert into brand_direction_keywords (client_id, keyword, sort_order) values ((select id from brand_directions where client_id = (select id from clients where legacy_id = 'client-1')), 'Autoridade silenciosa', 2);
insert into brand_direction_keywords (client_id, keyword, sort_order) values ((select id from brand_directions where client_id = (select id from clients where legacy_id = 'client-1')), 'Sem enrolação', 3);
insert into brand_direction_references (client_id, reference, sort_order) values ((select id from brand_directions where client_id = (select id from clients where legacy_id = 'client-1')), 'Editoriais de moda em tons terrosos', 0);
insert into brand_direction_references (client_id, reference, sort_order) values ((select id from brand_directions where client_id = (select id from clients where legacy_id = 'client-1')), 'Fotografia com luz natural, pouco contraste', 1);
insert into brand_direction_style_notes (client_id, polarity, text, sort_order) values ((select id from brand_directions where client_id = (select id from clients where legacy_id = 'client-1')), 'belongs', 'Tons terrosos e neutros', 0);
insert into brand_direction_style_notes (client_id, polarity, text, sort_order) values ((select id from brand_directions where client_id = (select id from clients where legacy_id = 'client-1')), 'belongs', 'Frases curtas e diretas', 1);
insert into brand_direction_style_notes (client_id, polarity, text, sort_order) values ((select id from brand_directions where client_id = (select id from clients where legacy_id = 'client-1')), 'belongs', 'Bastidores reais do trabalho com clientes', 2);
insert into brand_direction_style_notes (client_id, polarity, text, sort_order) values ((select id from brand_directions where client_id = (select id from clients where legacy_id = 'client-1')), 'doesnt_belong', 'Frases de efeito genéricas', 0);
insert into brand_direction_style_notes (client_id, polarity, text, sort_order) values ((select id from brand_directions where client_id = (select id from clients where legacy_id = 'client-1')), 'doesnt_belong', 'Cores vibrantes/neon', 1);
insert into brand_direction_style_notes (client_id, polarity, text, sort_order) values ((select id from brand_directions where client_id = (select id from clients where legacy_id = 'client-1')), 'doesnt_belong', 'Conteúdo puramente motivacional sem substância', 2);
insert into brand_directions (client_id, pinterest_url, mood_board_intro, positioning_summary, tone, guidance, updated_at) values ((select id from clients where legacy_id = 'client-2'), NULL, '', '', '', '', NULL);
insert into brand_directions (client_id, pinterest_url, mood_board_intro, positioning_summary, tone, guidance, updated_at) values ((select id from clients where legacy_id = 'client-3'), NULL, '', '', '', '', NULL);
insert into brand_directions (client_id, pinterest_url, mood_board_intro, positioning_summary, tone, guidance, updated_at) values ((select id from clients where legacy_id = 'client-4'), NULL, '', '', '', '', NULL);
insert into brand_directions (client_id, pinterest_url, mood_board_intro, positioning_summary, tone, guidance, updated_at) values ((select id from clients where legacy_id = 'client-5'), NULL, '', '', '', '', NULL);
insert into brand_directions (client_id, pinterest_url, mood_board_intro, positioning_summary, tone, guidance, updated_at) values ((select id from clients where legacy_id = 'client-6'), NULL, '', '', '', '', NULL);
insert into brand_directions (client_id, pinterest_url, mood_board_intro, positioning_summary, tone, guidance, updated_at) values ((select id from clients where legacy_id = 'client-7'), NULL, '', '', '', '', NULL);

-- ============================================================
-- books + book_chapters + book_chapter_paragraphs + book_chapter_list_items
-- ============================================================
insert into books (client_id, title, subtitle, author, cover_image_url, epigraph_text, epigraph_cite, back_matter_studio, back_matter_handle, back_matter_email) values ((select id from clients where legacy_id = 'client-1'), 'Guia Imagético', 'Mentoria PERSEA', 'NAY MURTA | FATOR N', '../shared/assets/nay-cover.jpg', 'Porque ser admirável nunca é por acaso. É construção.', 'Nay Murta — Mentoria PERSEA', 'PERSEA', '@naymutra', 'naymurta@fatorn.com.br');
insert into book_chapters (book_id, chapter_key, number, title, eyebrow) values ((select id from books where client_id = (select id from clients where legacy_id = 'client-1')), 'registro', 1, 'Registro Imagético Diário', 'Envio via WhatsApp');
insert into book_chapter_paragraphs (chapter_id, text, sort_order) values ((select id from book_chapters where book_id = (select id from books where client_id = (select id from clients where legacy_id = 'client-1')) and chapter_key = 'registro'), 'Para iniciarmos uma construção estratégica, funcional e inteligente, precisamos entender seu ponto de partida.', 0);
insert into book_chapter_paragraphs (chapter_id, text, sort_order) values ((select id from book_chapters where book_id = (select id from books where client_id = (select id from clients where legacy_id = 'client-1')) and chapter_key = 'registro'), 'Durante 10 dias, registre suas produções (ou faça simulações) e, junto à foto, conte para onde ia, como se sentiu ao se olhar no espelho e se foi fácil ou difícil escolher a roupa.', 1);
insert into book_chapter_paragraphs (chapter_id, text, sort_order) values ((select id from book_chapters where book_id = (select id from books where client_id = (select id from clients where legacy_id = 'client-1')) and chapter_key = 'registro'), 'Esse será o nosso raio-x inicial para criarmos juntas uma imagem que traduza sua essência e eleve sua percepção de valor.', 2);
insert into book_chapters (book_id, chapter_key, number, title, eyebrow) values ((select id from books where client_id = (select id from clients where legacy_id = 'client-1')), 'sou-nunca-gostaria', 2, 'Sou, Nunca e Gostaria', 'Envio via WhatsApp');
insert into book_chapter_paragraphs (chapter_id, text, sort_order) values ((select id from book_chapters where book_id = (select id from books where client_id = (select id from clients where legacy_id = 'client-1')) and chapter_key = 'sou-nunca-gostaria'), 'Selecione e envie referências visuais que representem:', 0);
insert into book_chapter_list_items (chapter_id, text, sort_order) values ((select id from book_chapters where book_id = (select id from books where client_id = (select id from clients where legacy_id = 'client-1')) and chapter_key = 'sou-nunca-gostaria'), 'Como eu sou e me visto hoje: escolha 5 imagens que traduzam a comunicação atual. Importante: olhe de fora, como se estivesse descrevendo outra pessoa. Não envie fotos suas.', 0);
insert into book_chapter_list_items (chapter_id, text, sort_order) values ((select id from book_chapters where book_id = (select id from books where client_id = (select id from clients where legacy_id = 'client-1')) and chapter_key = 'sou-nunca-gostaria'), 'Como eu gostaria de ser: escolha 5 imagens que representem a mudança que você deseja alcançar.', 1);
insert into book_chapter_list_items (chapter_id, text, sort_order) values ((select id from book_chapters where book_id = (select id from books where client_id = (select id from clients where legacy_id = 'client-1')) and chapter_key = 'sou-nunca-gostaria'), 'Como eu nunca seria: escolha 5 imagens que mostrem o que não tem nada a ver com você ou que jamais usaria.', 2);
insert into book_chapters (book_id, chapter_key, number, title, eyebrow) values ((select id from books where client_id = (select id from clients where legacy_id = 'client-1')), 'estrutura-corporal', 3, 'Estrutura Corporal', 'Nem tudo que gostamos nos veste bem');
insert into book_chapter_paragraphs (chapter_id, text, sort_order) values ((select id from book_chapters where book_id = (select id from books where client_id = (select id from clients where legacy_id = 'client-1')) and chapter_key = 'estrutura-corporal'), 'Envie fotos de frente, costas e perfis, em postura ereta, usando lingerie ou biquíni, para validação da sua morfologia corporal.', 0);
insert into book_chapter_paragraphs (chapter_id, text, sort_order) values ((select id from book_chapters where book_id = (select id from books where client_id = (select id from clients where legacy_id = 'client-1')) and chapter_key = 'estrutura-corporal'), 'Peça para outra pessoa fazer o registro, com o celular na horizontal, na altura da linha do corpo, evitando ângulos inclinados (de cima para baixo ou de baixo para cima).', 1);
insert into book_chapters (book_id, chapter_key, number, title, eyebrow) values ((select id from books where client_id = (select id from clients where legacy_id = 'client-1')), 'analise-facial', 4, 'Análise Facial', 'Visagismo e coloração pessoal');
insert into book_chapter_paragraphs (chapter_id, text, sort_order) values ((select id from book_chapters where book_id = (select id from books where client_id = (select id from clients where legacy_id = 'client-1')) and chapter_key = 'analise-facial'), 'A seguir, as orientações detalhadas para o envio das fotos do seu rosto, que serão utilizadas como base para o seu projeto visagista e para a análise de coloração pessoal.', 0);
insert into book_chapter_paragraphs (chapter_id, text, sort_order) values ((select id from book_chapters where book_id = (select id from books where client_id = (select id from clients where legacy_id = 'client-1')) and chapter_key = 'analise-facial'), '4.1 — Visagismo: precisaremos de três fotos suas, todas feitas com a câmera traseira, em posição frontal, como uma foto 3x4 — cabelos soltos para frente dos ombros, cabelos soltos para trás dos ombros, e cabelos presos. As fotos devem ser novas, com boa distância da câmera, cabelo bem penteado e partido ao meio (de preferência), usando top ou blusa branca de alça/manga, encostada em uma parede clara.', 1);
insert into book_chapter_paragraphs (chapter_id, text, sort_order) values ((select id from book_chapters where book_id = (select id from books where client_id = (select id from clients where legacy_id = 'client-1')) and chapter_key = 'analise-facial'), 'Como tirar as fotos: esteja sem maquiagem e sem acessórios; iluminação natural, feita durante o dia, evitando luz direta do sol e sem flash; peça para outra pessoa tirar a foto com a câmera traseira, a 1,5m de distância; confira se as duas orelhas estão visíveis na foto de frente.', 2);
insert into book_chapter_paragraphs (chapter_id, text, sort_order) values ((select id from book_chapters where book_id = (select id from books where client_id = (select id from clients where legacy_id = 'client-1')) and chapter_key = 'analise-facial'), '4.2 — Coloração Pessoal: a foto deve ser tirada bem de frente, com proximidade do rosto e colo totalmente à mostra, em ambiente iluminado naturalmente, numa janela sem entrada direta de sol, entre 11h e 14h, com o rosto completamente limpo, sem produto, maquiagem ou acessórios.', 3);
insert into book_chapter_list_items (chapter_id, text, sort_order) values ((select id from book_chapters where book_id = (select id from books where client_id = (select id from clients where legacy_id = 'client-1')) and chapter_key = 'analise-facial'), 'Posicione-se de frente para a janela para que o rosto receba iluminação uniforme.', 0);
insert into book_chapter_list_items (chapter_id, text, sort_order) values ((select id from book_chapters where book_id = (select id from books where client_id = (select id from clients where legacy_id = 'client-1')) and chapter_key = 'analise-facial'), 'Não fique de lado para a janela — isso deixa um lado do rosto iluminado e o outro sombreado.', 1);
insert into book_chapter_list_items (chapter_id, text, sort_order) values ((select id from book_chapters where book_id = (select id from books where client_id = (select id from clients where legacy_id = 'client-1')) and chapter_key = 'analise-facial'), 'Não deixe a janela ao fundo — isso cria sombras no rosto.', 2);
insert into book_chapter_list_items (chapter_id, text, sort_order) values ((select id from book_chapters where book_id = (select id from books where client_id = (select id from clients where legacy_id = 'client-1')) and chapter_key = 'analise-facial'), 'Posicione o celular na altura do pescoço, evitando deixá-lo muito acima ou abaixo da cabeça.', 3);
insert into book_chapters (book_id, chapter_key, number, title, eyebrow) values ((select id from books where client_id = (select id from clients where legacy_id = 'client-1')), 'complementares', 5, 'Informações Complementares', 'Mapeamento facial');
insert into book_chapter_paragraphs (chapter_id, text, sort_order) values ((select id from book_chapters where book_id = (select id from books where client_id = (select id from clients where legacy_id = 'client-1')) and chapter_key = 'complementares'), 'Um formulário exclusivo para o seu mapeamento facial estará disponível na plataforma assim que sua consultora liberar esta etapa.', 0);
