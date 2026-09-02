
-- ============================================================
-- clients
-- ============================================================
insert into clients (legacy_id, full_name, email, status, tier, phase_index, program_slug, gender, access_status, photo_url, notes, brand_ideas, guide_acknowledged, image_project_status, images_status, images_note, personal_playbook_url, personal_playbook_delivered_at, business_playbook_url, business_playbook_delivered_at, hubla_access_status, hubla_access_granted_at) values ('client-1', 'Marina Alves', 'marina@example.com', 'active', 'premium', 1, 'persea-premium', 'feminino', 'created', NULL, 'Lembrar de perguntar sobre precificação na próxima reunião.', '', false, 'created', 'aguardando_envio', '', NULL, NULL, NULL, NULL, 'granted', '2026-07-20T10:00:00');
insert into clients (legacy_id, full_name, email, status, tier, phase_index, program_slug, gender, access_status, photo_url, notes, brand_ideas, guide_acknowledged, image_project_status, images_status, images_note, personal_playbook_url, personal_playbook_delivered_at, business_playbook_url, business_playbook_delivered_at, hubla_access_status, hubla_access_granted_at) values ('client-2', 'Júlia Ferreira', 'julia@example.com', 'active', 'essential', 0, 'persea-essential', 'feminino', 'created', NULL, '', '', false, 'created', 'aguardando_envio', '', NULL, NULL, NULL, NULL, 'granted', '2026-07-20T10:00:00');
insert into clients (legacy_id, full_name, email, status, tier, phase_index, program_slug, gender, access_status, photo_url, notes, brand_ideas, guide_acknowledged, image_project_status, images_status, images_note, personal_playbook_url, personal_playbook_delivered_at, business_playbook_url, business_playbook_delivered_at, hubla_access_status, hubla_access_granted_at) values ('client-3', 'Renata Costa', 'renata@example.com', 'active', 'premium', 0, 'persea-premium', 'feminino', 'created', NULL, 'Verificar com a Nay se posso usar o playbook em uma proposta comercial antes da publicação.', '', false, 'created', 'aguardando_envio', '', NULL, NULL, NULL, NULL, 'granted', '2026-07-20T10:00:00');
insert into clients (legacy_id, full_name, email, status, tier, phase_index, program_slug, gender, access_status, photo_url, notes, brand_ideas, guide_acknowledged, image_project_status, images_status, images_note, personal_playbook_url, personal_playbook_delivered_at, business_playbook_url, business_playbook_delivered_at, hubla_access_status, hubla_access_granted_at) values ('client-4', 'Bianca Souza', 'bianca@example.com', 'onboarding', 'essential', 0, 'persea-essential', 'feminino', 'created', NULL, '', '', false, 'not_started', 'aguardando_envio', '', NULL, NULL, NULL, NULL, 'not_granted', NULL);
insert into clients (legacy_id, full_name, email, status, tier, phase_index, program_slug, gender, access_status, photo_url, notes, brand_ideas, guide_acknowledged, image_project_status, images_status, images_note, personal_playbook_url, personal_playbook_delivered_at, business_playbook_url, business_playbook_delivered_at, hubla_access_status, hubla_access_granted_at) values ('client-5', 'Camila Rocha', 'camila@example.com', 'onboarding', 'essential', 0, 'persea-essential', 'feminino', 'created', NULL, '', '', false, 'not_started', 'aguardando_envio', '', NULL, NULL, NULL, NULL, 'not_granted', NULL);
insert into clients (legacy_id, full_name, email, status, tier, phase_index, program_slug, gender, access_status, photo_url, notes, brand_ideas, guide_acknowledged, image_project_status, images_status, images_note, personal_playbook_url, personal_playbook_delivered_at, business_playbook_url, business_playbook_delivered_at, hubla_access_status, hubla_access_granted_at) values ('client-6', 'Débora Lima', 'debora@example.com', 'onboarding', 'premium', 0, 'ascensao-imagem', 'feminino', 'created', NULL, '', '', false, 'created', 'aguardando_envio', '', NULL, NULL, NULL, NULL, 'not_granted', NULL);
insert into clients (legacy_id, full_name, email, status, tier, phase_index, program_slug, gender, access_status, photo_url, notes, brand_ideas, guide_acknowledged, image_project_status, images_status, images_note, personal_playbook_url, personal_playbook_delivered_at, business_playbook_url, business_playbook_delivered_at, hubla_access_status, hubla_access_granted_at) values ('client-7', 'Fernanda Lima', 'fernanda@example.com', 'onboarding', 'essential', 0, 'persea-essential', NULL, 'created', NULL, '', '', false, 'not_started', 'aguardando_envio', '', NULL, NULL, NULL, NULL, 'not_granted', NULL);

-- ============================================================
-- client_onboarding (merged: only client_id + whatsapp_group_status)
-- ============================================================
insert into client_onboarding (client_id, whatsapp_group_status) values ((select id from clients where legacy_id = 'client-1'), 'added');
insert into client_onboarding (client_id, whatsapp_group_status) values ((select id from clients where legacy_id = 'client-2'), 'added');
insert into client_onboarding (client_id, whatsapp_group_status) values ((select id from clients where legacy_id = 'client-3'), 'added');
insert into client_onboarding (client_id, whatsapp_group_status) values ((select id from clients where legacy_id = 'client-4'), 'not_added');
insert into client_onboarding (client_id, whatsapp_group_status) values ((select id from clients where legacy_id = 'client-5'), 'pending');
insert into client_onboarding (client_id, whatsapp_group_status) values ((select id from clients where legacy_id = 'client-6'), 'added');
insert into client_onboarding (client_id, whatsapp_group_status) values ((select id from clients where legacy_id = 'client-7'), 'not_added');

-- ============================================================
-- party_info (merged client_onboarding.clientInfo rows, client_id side)
-- ============================================================
insert into party_info (client_id, submitted, full_name, party_type, cpf, cnpj, company_name, email, whatsapp, address) values ((select id from clients where legacy_id = 'client-1'), true, 'Marina Alves', 'PF', '123.456.789-00', NULL, NULL, 'marina@example.com', '(31) 90000-0001', 'Rua Exemplo, 100, Savassi, Belo Horizonte/MG');
insert into party_info (client_id, submitted, full_name, party_type, cpf, cnpj, company_name, email, whatsapp, address) values ((select id from clients where legacy_id = 'client-2'), true, 'Júlia Ferreira', 'PF', '234.567.890-11', NULL, NULL, 'julia@example.com', '(31) 90000-0002', 'Av. Exemplo, 200, Centro, Sete Lagoas/MG');
insert into party_info (client_id, submitted, full_name, party_type, cpf, cnpj, company_name, email, whatsapp, address) values ((select id from clients where legacy_id = 'client-3'), true, 'Renata Costa', 'PJ', '345.678.901-22', '12.345.678/0001-90', 'Renata Costa Consultoria', 'renata@example.com', '(31) 90000-0003', 'Rua Exemplo, 300, Lourdes, Belo Horizonte/MG');
insert into party_info (client_id, submitted, full_name, party_type, cpf, cnpj, company_name, email, whatsapp, address) values ((select id from clients where legacy_id = 'client-4'), true, 'Bianca Souza', 'PF', '456.789.012-33', NULL, NULL, 'bianca@example.com', '(31) 90000-0004', 'Rua Exemplo, 400, Centro, Contagem/MG');
insert into party_info (client_id, submitted, full_name, party_type, cpf, cnpj, company_name, email, whatsapp, address) values ((select id from clients where legacy_id = 'client-5'), true, 'Camila Rocha', 'PF', '567.890.123-44', NULL, NULL, 'camila@example.com', '(31) 90000-0005', 'Rua Exemplo, 500, Centro, Betim/MG');
insert into party_info (client_id, submitted, full_name, party_type, cpf, cnpj, company_name, email, whatsapp, address) values ((select id from clients where legacy_id = 'client-6'), true, 'Débora Lima', 'PJ', '678.901.234-55', '23.456.789/0001-01', 'Débora Lima Imagem', 'debora@example.com', '(31) 90000-0006', 'Rua Exemplo, 600, Buritis, Belo Horizonte/MG');
insert into party_info (client_id, submitted, full_name, party_type, cpf, cnpj, company_name, email, whatsapp, address) values ((select id from clients where legacy_id = 'client-7'), false, 'Fernanda Lima', 'PF', '', NULL, NULL, 'fernanda@example.com', '(31) 90000-0007', '');

-- ============================================================
-- contracts
-- ============================================================
insert into contracts (client_id, program, duration, status, value_cents, signed_file_name, notes, payment_method, installments) values ((select id from clients where legacy_id = 'client-1'), 'persea', 'anual', 'completed', 3200000, 'contrato-client-1-assinado.pdf', 'Fechou no call de encerramento do onboarding — pediu para começar a Fase 1 já na semana seguinte.', 'cartao_credito', 12);
insert into contracts (client_id, program, duration, status, value_cents, signed_file_name, notes, payment_method, installments) values ((select id from clients where legacy_id = 'client-2'), 'persea', 'semestral', 'completed', 1800000, 'contrato-client-2-assinado.pdf', '', NULL, NULL);
insert into contracts (client_id, program, duration, status, value_cents, signed_file_name, notes, payment_method, installments) values ((select id from clients where legacy_id = 'client-3'), 'persea', 'anual', 'completed', 3200000, 'contrato-client-3-assinado.pdf', '', NULL, NULL);
insert into contracts (client_id, program, duration, status, value_cents, signed_file_name, notes, payment_method, installments) values ((select id from clients where legacy_id = 'client-4'), NULL, NULL, 'info_received', NULL, NULL, '', NULL, NULL);
insert into contracts (client_id, program, duration, status, value_cents, signed_file_name, notes, payment_method, installments) values ((select id from clients where legacy_id = 'client-5'), 'persea', 'semestral', 'awaiting_signature', 1800000, NULL, '', NULL, NULL);
insert into contracts (client_id, program, duration, status, value_cents, signed_file_name, notes, payment_method, installments) values ((select id from clients where legacy_id = 'client-6'), 'ascensao_imagem', NULL, 'completed', 600000, 'contrato-client-6-assinado.pdf', '', 'pix', 1);
insert into contracts (client_id, program, duration, status, value_cents, signed_file_name, notes, payment_method, installments) values ((select id from clients where legacy_id = 'client-7'), NULL, NULL, 'info_pending', NULL, NULL, 'Convertida de lead — aguardando preenchimento das informações para preparar o contrato.', NULL, NULL);

-- ============================================================
-- client_program_history
-- ============================================================
insert into client_program_history (client_id, program_slug, changed_at, changed_by) values ((select id from clients where legacy_id = 'client-1'), 'persea-essential', '2026-06-14T10:00:00', 'seed');
insert into client_program_history (client_id, program_slug, changed_at, changed_by) values ((select id from clients where legacy_id = 'client-1'), 'persea-premium', '2026-07-15T14:00:00', 'nay');
insert into client_program_history (client_id, program_slug, changed_at, changed_by) values ((select id from clients where legacy_id = 'client-2'), 'persea-essential', NULL, 'seed');
insert into client_program_history (client_id, program_slug, changed_at, changed_by) values ((select id from clients where legacy_id = 'client-3'), 'persea-premium', NULL, 'seed');
insert into client_program_history (client_id, program_slug, changed_at, changed_by) values ((select id from clients where legacy_id = 'client-4'), 'persea-essential', NULL, 'seed');
insert into client_program_history (client_id, program_slug, changed_at, changed_by) values ((select id from clients where legacy_id = 'client-5'), 'persea-essential', NULL, 'seed');
insert into client_program_history (client_id, program_slug, changed_at, changed_by) values ((select id from clients where legacy_id = 'client-6'), 'ascensao-imagem', NULL, 'seed');
insert into client_program_history (client_id, program_slug, changed_at, changed_by) values ((select id from clients where legacy_id = 'client-7'), 'persea-essential', NULL, 'seed');

-- ============================================================
-- photo_reminders (1:1)
-- ============================================================
insert into photo_reminders (client_id, sent_at, note) values ((select id from clients where legacy_id = 'client-1'), NULL, '');
insert into photo_reminders (client_id, sent_at, note) values ((select id from clients where legacy_id = 'client-2'), NULL, '');
insert into photo_reminders (client_id, sent_at, note) values ((select id from clients where legacy_id = 'client-3'), NULL, '');
insert into photo_reminders (client_id, sent_at, note) values ((select id from clients where legacy_id = 'client-4'), NULL, '');
insert into photo_reminders (client_id, sent_at, note) values ((select id from clients where legacy_id = 'client-5'), NULL, '');
insert into photo_reminders (client_id, sent_at, note) values ((select id from clients where legacy_id = 'client-6'), NULL, '');
insert into photo_reminders (client_id, sent_at, note) values ((select id from clients where legacy_id = 'client-7'), NULL, '');

-- ============================================================
-- client_profile_summaries (only clients with a seeded summary)
-- ============================================================
insert into client_profile_summaries (client_id, who, what, why, how) values ((select id from clients where legacy_id = 'client-1'), 'Consultora de posicionamento para especialistas de alto nível — profissionais tecnicamente excelentes, mas com pouca visibilidade de marca.', 'Mentorias e consultorias de posicionamento de marca pessoal para consultores e coaches já estabelecidos.', 'Fechar a lacuna entre a real competência dos clientes e como o mercado os percebe, transformando autoridade invisível em autoridade reconhecida.', 'Mentorias 1:1 e conteúdo estratégico nas redes — Mago e o trio Exploradora/Amante/Governante aparecem com força na comunicação dela.');
insert into client_profile_summaries (client_id, who, what, why, how) values ((select id from clients where legacy_id = 'client-2'), 'Educadora financeira ainda no início da construção da sua autoridade pública — tecnicamente segura, mas evita se expor.', 'Consultoria e conteúdo educativo sobre finanças pessoais para mulheres autônomas.', 'Ser vista como referência em finanças para mulheres autônomas, ajudando-as a sair da confusão financeira para a clareza e o controle.', 'Hoje se comunica principalmente por conteúdo escrito — ainda evita vídeos e lives; o objetivo é migrar aos poucos conforme ganha confiança.');
insert into client_profile_summaries (client_id, who, what, why, how) values ((select id from clients where legacy_id = 'client-3'), 'Estrategista de marca e consultora de negócios, com um perfil racional e estruturado (Sábio, Governante e Criador em destaque).', 'Consultoria de organização operacional e estratégica para negócios que cresceram rápido.', 'Ajudar negócios que expandiram rápido demais a organizarem a operação antes que o crescimento desorganizado vire prejuízo.', 'Diagnóstico de negócio, plano de ação estruturado e acompanhamento próximo — nomear a própria metodologia é um dos focos atuais.');

-- ============================================================
-- whatsapp_notes
-- ============================================================

-- ============================================================
-- images
-- ============================================================

-- ============================================================
-- leads
-- ============================================================
insert into leads (legacy_id, full_name, email, phone, source, vip_group_status, stage, interested_program, notes, converted_to_client_id, converted_at, program, onboarding_status, registration_token, registration_sent_at, registration_completed_at, contract_status, signed_file_name, created_at, updated_at) values ('lead1', 'Patrícia Nogueira', 'patricia.n@example.com', '(31) 90000-1001', 'vip_group', 'in_group', 'em_conversa', 'persea', 'Muito ativa no grupo, sempre comenta nas dinâmicas. Trabalha com consultoria financeira.', NULL, NULL, 'persea-essential', 'registration_sent', 'lead1-demo1234abcd5678', '2026-08-18T16:00:00', NULL, 'info_pending', NULL, '2026-07-15T09:00:00', '2026-08-18T16:00:00');
insert into leads (legacy_id, full_name, email, phone, source, vip_group_status, stage, interested_program, notes, converted_to_client_id, converted_at, program, onboarding_status, registration_token, registration_sent_at, registration_completed_at, contract_status, signed_file_name, created_at, updated_at) values ('lead2', 'Vanessa Tavares', 'vanessa.tavares@example.com', '(31) 90000-1002', 'vip_group', 'in_group', 'engajado', NULL, 'Entrou no grupo após a aula de oratória. Preencheu a ficha de interesse mas ainda não teve conversa direta.', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-07-21T10:00:00', '2026-07-21T10:00:00');
insert into leads (legacy_id, full_name, email, phone, source, vip_group_status, stage, interested_program, notes, converted_to_client_id, converted_at, program, onboarding_status, registration_token, registration_sent_at, registration_completed_at, contract_status, signed_file_name, created_at, updated_at) values ('lead3', 'Fernanda Buono', 'fernanda.buono@example.com', '(31) 90000-1003', 'referral', 'not_in_group', 'proposta_enviada', 'ascensao_imagem', 'Indicada pela Renata Costa. Já teve reunião de diagnóstico, proposta do Ascensão de Imagem enviada por email.', NULL, NULL, 'ascensao-imagem', 'ready_for_activation', 'lead3-demo9876zyxw4321', '2026-08-12T11:00:00', '2026-08-14T19:20:00', 'completed', 'contrato-fernanda-buono-assinado.pdf', '2026-07-28T09:00:00', '2026-08-19T09:00:00');
insert into leads (legacy_id, full_name, email, phone, source, vip_group_status, stage, interested_program, notes, converted_to_client_id, converted_at, program, onboarding_status, registration_token, registration_sent_at, registration_completed_at, contract_status, signed_file_name, created_at, updated_at) values ('lead4', 'Isabela Prado', 'isabela.prado@example.com', '(31) 90000-1004', 'vip_group', 'left_group', 'perdido', NULL, 'Saiu do grupo sem engajar em nenhuma dinâmica. Provavelmente não é o momento certo.', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-06-10T09:00:00', '2026-07-01T09:00:00');
insert into leads (legacy_id, full_name, email, phone, source, vip_group_status, stage, interested_program, notes, converted_to_client_id, converted_at, program, onboarding_status, registration_token, registration_sent_at, registration_completed_at, contract_status, signed_file_name, created_at, updated_at) values ('lead5', 'Fernanda Lima', 'fernanda@example.com', '(31) 90000-0007', 'referral', 'not_in_group', 'convertido', 'persea', 'Indicada pela Marina Alves. Fechou o Persea Essencial — convertida em cliente (client-7).', (select id from clients where legacy_id = 'client-7'), '2026-08-17T09:00:00', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-08-01T09:00:00', '2026-08-17T09:00:00');

-- ============================================================
-- lead_social_links
-- ============================================================
insert into lead_social_links (lead_id, platform, url) values ((select id from leads where legacy_id = 'lead1'), 'instagram', 'https://instagram.com/patricianogueira');
insert into lead_social_links (lead_id, platform, url) values ((select id from leads where legacy_id = 'lead1'), 'tiktok', '');
insert into lead_social_links (lead_id, platform, url) values ((select id from leads where legacy_id = 'lead1'), 'linkedin', 'https://linkedin.com/in/patricianogueira');
insert into lead_social_links (lead_id, platform, url) values ((select id from leads where legacy_id = 'lead1'), 'facebook', '');
insert into lead_social_links (lead_id, platform, url) values ((select id from leads where legacy_id = 'lead2'), 'instagram', 'https://instagram.com/vanessatavares');
insert into lead_social_links (lead_id, platform, url) values ((select id from leads where legacy_id = 'lead2'), 'tiktok', 'https://tiktok.com/@vanessatavares');
insert into lead_social_links (lead_id, platform, url) values ((select id from leads where legacy_id = 'lead2'), 'linkedin', '');
insert into lead_social_links (lead_id, platform, url) values ((select id from leads where legacy_id = 'lead2'), 'facebook', '');
insert into lead_social_links (lead_id, platform, url) values ((select id from leads where legacy_id = 'lead3'), 'instagram', 'https://instagram.com/fernandabuono');
insert into lead_social_links (lead_id, platform, url) values ((select id from leads where legacy_id = 'lead3'), 'tiktok', '');
insert into lead_social_links (lead_id, platform, url) values ((select id from leads where legacy_id = 'lead3'), 'linkedin', '');
insert into lead_social_links (lead_id, platform, url) values ((select id from leads where legacy_id = 'lead3'), 'facebook', '');
insert into lead_social_links (lead_id, platform, url) values ((select id from leads where legacy_id = 'lead4'), 'instagram', '');
insert into lead_social_links (lead_id, platform, url) values ((select id from leads where legacy_id = 'lead4'), 'tiktok', '');
insert into lead_social_links (lead_id, platform, url) values ((select id from leads where legacy_id = 'lead4'), 'linkedin', '');
insert into lead_social_links (lead_id, platform, url) values ((select id from leads where legacy_id = 'lead4'), 'facebook', '');
insert into lead_social_links (lead_id, platform, url) values ((select id from leads where legacy_id = 'lead5'), 'instagram', '');
insert into lead_social_links (lead_id, platform, url) values ((select id from leads where legacy_id = 'lead5'), 'tiktok', '');
insert into lead_social_links (lead_id, platform, url) values ((select id from leads where legacy_id = 'lead5'), 'linkedin', '');
insert into lead_social_links (lead_id, platform, url) values ((select id from leads where legacy_id = 'lead5'), 'facebook', '');

-- ============================================================
-- lead_interactions
-- ============================================================
insert into lead_interactions (lead_id, occurred_at, summary) values ((select id from leads where legacy_id = 'lead1'), '2026-08-10T14:00:00', 'Ligação rápida — perguntou sobre o formato do programa Persea (6 ou 12 meses) e como funciona o acompanhamento.');
insert into lead_interactions (lead_id, occurred_at, summary) values ((select id from leads where legacy_id = 'lead3'), '2026-08-05T11:00:00', 'Reunião de diagnóstico — quer resolver a imagem pessoal antes de aumentar a exposição em palestras.');
insert into lead_interactions (lead_id, occurred_at, summary) values ((select id from leads where legacy_id = 'lead3'), '2026-08-08T16:30:00', 'Proposta comercial enviada por email, aguardando retorno.');
insert into lead_interactions (lead_id, occurred_at, summary) values ((select id from leads where legacy_id = 'lead5'), '2026-08-16T10:00:00', 'Reunião de diagnóstico — decidiu fechar o Persea Essencial.');

-- ============================================================
-- lead_commercial_terms + lead_commercial_payment_methods
-- ============================================================
insert into lead_commercial_terms (lead_id, payment_method, installments, agreed_amount_cents, first_due_date, commercial_notes, responsible_id, sale_agreed_at) values ((select id from leads where legacy_id = 'lead1'), 'cartao_credito', 6, 1800000, '2026-09-05', 'Fechou no plano semestral: entrada via Pix + saldo parcelado no cartão em 6x.', NULL, '2026-08-18T15:00:00');
insert into lead_commercial_payment_methods (lead_id, payment_method) values ((select id from leads where legacy_id = 'lead1'), 'cartao_credito');
insert into lead_commercial_payment_methods (lead_id, payment_method) values ((select id from leads where legacy_id = 'lead1'), 'pix');
insert into lead_commercial_terms (lead_id, payment_method, installments, agreed_amount_cents, first_due_date, commercial_notes, responsible_id, sale_agreed_at) values ((select id from leads where legacy_id = 'lead3'), 'pix', 1, 600000, '2026-08-20', 'Pagamento único via Pix, à vista com 5% de desconto já aplicado.', NULL, '2026-08-12T10:00:00');
insert into lead_commercial_payment_methods (lead_id, payment_method) values ((select id from leads where legacy_id = 'lead3'), 'pix');

-- ============================================================
-- party_info (lead_registration_info rows, lead_id side)
-- ============================================================
insert into party_info (lead_id, submitted, full_name, social_name, birth_date, party_type, cpf, rg, profession, nationality, marital_status, cnpj, company_name, email, whatsapp, cep, street, number, complement, neighborhood, city, state) values ((select id from leads where legacy_id = 'lead3'), true, 'Fernanda Buono', '', '1990-04-22', 'PF', '345.678.901-22', 'MG-19.887.223', 'Palestrante', 'Brasileira', 'Solteira', NULL, NULL, 'fernanda.buono@example.com', '(31) 90000-1003', '30140-071', 'Rua Pium-í', '255', 'Apto 302', 'Serra', 'Belo Horizonte', 'MG');

-- ============================================================
-- lead_history
-- ============================================================
insert into lead_history (lead_id, event_type, text, occurred_at) values ((select id from leads where legacy_id = 'lead1'), 'registration_sent', 'Formulário de cadastro enviado à cliente.', '2026-08-18T16:00:00');
insert into lead_history (lead_id, event_type, text, occurred_at) values ((select id from leads where legacy_id = 'lead1'), 'sale_agreed', 'Condições comerciais registradas.', '2026-08-18T15:00:00');
insert into lead_history (lead_id, event_type, text, occurred_at) values ((select id from leads where legacy_id = 'lead3'), 'contract_signed', 'Contrato assinado enviado — pronta para ativação.', '2026-08-19T09:00:00');
insert into lead_history (lead_id, event_type, text, occurred_at) values ((select id from leads where legacy_id = 'lead3'), 'contract_status_changed', 'Status do contrato: Aguardando Assinatura', '2026-08-16T10:00:00');
insert into lead_history (lead_id, event_type, text, occurred_at) values ((select id from leads where legacy_id = 'lead3'), 'contract_status_changed', 'Status do contrato: Contrato Preparado', '2026-08-15T10:00:00');
insert into lead_history (lead_id, event_type, text, occurred_at) values ((select id from leads where legacy_id = 'lead3'), 'registration_completed', 'Cadastro recebido da cliente.', '2026-08-14T19:20:00');
insert into lead_history (lead_id, event_type, text, occurred_at) values ((select id from leads where legacy_id = 'lead3'), 'registration_sent', 'Formulário de cadastro enviado à cliente.', '2026-08-12T11:00:00');
insert into lead_history (lead_id, event_type, text, occurred_at) values ((select id from leads where legacy_id = 'lead3'), 'sale_agreed', 'Condições comerciais registradas.', '2026-08-12T10:00:00');
