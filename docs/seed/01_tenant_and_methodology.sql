
-- ============================================================
-- tenants
-- ============================================================
insert into tenants (name, brand_color, hubla_all_content_url, activity_guide_pdf_url, activity_guide_version, activity_guide_published_at) values ('PERSEA', '#b8863a', 'https://pay.hubla.com.br/PLACEHOLDER-todos-os-conteudos', '../shared/assets/guia-atividades.pdf', 1, '2026-08-18T14:23:00');

-- ============================================================
-- activity_guide_pages
-- ============================================================
insert into activity_guide_pages (tenant_id, page_number, image_url) values ((select id from tenants limit 1), 1, '../shared/assets/guia-atividades-pages/page-01.jpg');
insert into activity_guide_pages (tenant_id, page_number, image_url) values ((select id from tenants limit 1), 2, '../shared/assets/guia-atividades-pages/page-02.jpg');
insert into activity_guide_pages (tenant_id, page_number, image_url) values ((select id from tenants limit 1), 3, '../shared/assets/guia-atividades-pages/page-03.jpg');
insert into activity_guide_pages (tenant_id, page_number, image_url) values ((select id from tenants limit 1), 4, '../shared/assets/guia-atividades-pages/page-04.jpg');
insert into activity_guide_pages (tenant_id, page_number, image_url) values ((select id from tenants limit 1), 5, '../shared/assets/guia-atividades-pages/page-05.jpg');
insert into activity_guide_pages (tenant_id, page_number, image_url) values ((select id from tenants limit 1), 6, '../shared/assets/guia-atividades-pages/page-06.jpg');
insert into activity_guide_pages (tenant_id, page_number, image_url) values ((select id from tenants limit 1), 7, '../shared/assets/guia-atividades-pages/page-07.jpg');
insert into activity_guide_pages (tenant_id, page_number, image_url) values ((select id from tenants limit 1), 8, '../shared/assets/guia-atividades-pages/page-08.jpg');
insert into activity_guide_pages (tenant_id, page_number, image_url) values ((select id from tenants limit 1), 9, '../shared/assets/guia-atividades-pages/page-09.jpg');
insert into activity_guide_pages (tenant_id, page_number, image_url) values ((select id from tenants limit 1), 10, '../shared/assets/guia-atividades-pages/page-10.jpg');
insert into activity_guide_pages (tenant_id, page_number, image_url) values ((select id from tenants limit 1), 11, '../shared/assets/guia-atividades-pages/page-11.jpg');
insert into activity_guide_pages (tenant_id, page_number, image_url) values ((select id from tenants limit 1), 12, '../shared/assets/guia-atividades-pages/page-12.jpg');
insert into activity_guide_pages (tenant_id, page_number, image_url) values ((select id from tenants limit 1), 13, '../shared/assets/guia-atividades-pages/page-13.jpg');

-- ============================================================
-- google_sync_status
-- ============================================================
insert into google_sync_status (tenant_id, connected_account, sync_status, last_checked_at, next_check_at, attempts) values ((select id from tenants limit 1), 'nay@persea.com.br', 'ativo', '2026-08-18T08:00:00', '2026-08-18T20:00:00', 128);

-- ============================================================
-- program_defs
-- ============================================================
insert into program_defs (slug, name, duration_months, display_order, description, positioning, supporting_statement) values ('persea-essential', 'Persea Essencial', 6, 1, 'Sua jornada de mentoria em marca pessoal, da extração da sua essência até uma comunicação pronta para o mercado.', 'Ensinar + Apoiar', 'Cliente executa com autonomia.');
insert into program_defs (slug, name, duration_months, display_order, description, positioning, supporting_statement) values ('persea-premium', 'Persea Premium', 12, 2, 'A jornada completa da Persea, incluindo o acompanhamento estratégico e comercial aprofundado do módulo Business.', 'Ensinar + Guiar', 'Nay acompanha decisões e aplicações.');
insert into program_defs (slug, name, duration_months, display_order, description, positioning, supporting_statement) values ('ascensao-imagem', 'Ascensão de Imagem', NULL, 3, 'Um programa focado em imagem pessoal, da extração de marca ao pitch, com prévias das experiências Premium.', NULL, NULL);

-- ============================================================
-- encounter_defs
-- ============================================================
insert into encounter_defs (number, slug, name, phase, purpose, premium_only) values (1, 'e1', 'Extração e Essência', 0, 'Ouvir e entender QUEM a cliente é e POR QUE ela vende o que vende — Nay chega preparada a partir da Extração de Marca e do Teste de Arquétipos. Depois deste encontro, Nay monta o mural de inspiração (Direção da Marca).', false);
insert into encounter_defs (number, slug, name, phase, purpose, premium_only) values (2, 'e2', 'Comunicação e Vendas', 0, 'A cliente já respondeu a pesquisa de precificação (O QUE e COMO ela vende hoje) — Nay entra direcionando o encontro para as vendas dela: pitch para praticar, conteúdo recomendado, e onde ela pode se inspirar na Direção da Marca.', false);
insert into encounter_defs (number, slug, name, phase, purpose, premium_only) values (3, 'e3', 'Imagem e Estratégia', 1, 'A imagem a serviço do QUE e do COMO vender. A assistente já preparou e Nay já aprovou a Cartela de Cores, o Guia de Produções, o Planejamento de Imagem e as Ferramentas para Nova Imagem — apresentados juntos à cliente nesta chamada de 1h.', false);
insert into encounter_defs (number, slug, name, phase, purpose, premium_only) values (4, 'e4', 'Posicionamento e Metas', 2, 'COMO e ONDE vender — cliente já fez o ensaio fotográfico profissional. Nay apresenta o novo Kit Digital e o Playbook de Marca Pessoal, alinhando posicionamento, metas tangíveis e precificação. Encerramento formal da Persea Essencial.', false);
insert into encounter_defs (number, slug, name, phase, purpose, premium_only) values (5, 'e5', 'Vendas e Comunicação', 3, 'A cliente já preencheu a Análise de Negócio (pré-requisito obrigatório). Nay aprofunda o COMO e ONDE vender, apresenta a nova estratégia de precificação e encoraja a cliente — recomendando apoio extra (ex.: oratória) quando fizer sentido.', true);
insert into encounter_defs (number, slug, name, phase, purpose, premium_only) values (6, 'e6', 'Negócio e Aquisição', 3, 'Validar o que está sendo implementado e discutir os próximos passos. Nay apresenta o Business Playbook (análise de negócio + pontos de foco para a cliente perseguir).', true);
insert into encounter_defs (number, slug, name, phase, purpose, premium_only) values (7, 'e7', 'Encontro Adaptativo', 3, 'Usado onde a cliente precisar de mais apoio — vendas, comunicação, oferta, posicionamento, aquisição ou implementação, a critério da Nay.', true);
insert into encounter_defs (number, slug, name, phase, purpose, premium_only) values (8, 'e8', 'Encontro Adaptativo', 3, 'Usado onde puder gerar mais valor — revisar decisões, reforçar implementação ou consolidar próximos passos, a critério da Nay.', true);

-- ============================================================
-- encounter_prep_checklist_items
-- ============================================================
insert into encounter_prep_checklist_items (encounter_number, sort_order, label) values (1, 0, 'Resultados do Teste de Arquétipos e da Extração de Marca revisados');
insert into encounter_prep_checklist_items (encounter_number, sort_order, label) values (1, 1, 'Notas prontas para explorar QUEM ela é, O QUE e POR QUE vende');
insert into encounter_prep_checklist_items (encounter_number, sort_order, label) values (2, 0, 'Pesquisa de Precificação respondida');
insert into encounter_prep_checklist_items (encounter_number, sort_order, label) values (2, 1, 'Pitch e conteúdos para recomendar já escolhidos');
insert into encounter_prep_checklist_items (encounter_number, sort_order, label) values (3, 0, 'Cartela de Cores e Guia de Produções aprovados');
insert into encounter_prep_checklist_items (encounter_number, sort_order, label) values (3, 1, 'Planejamento de Imagem e Ferramentas para Nova Imagem prontos');
insert into encounter_prep_checklist_items (encounter_number, sort_order, label) values (4, 0, 'Ensaio fotográfico profissional realizado');
insert into encounter_prep_checklist_items (encounter_number, sort_order, label) values (4, 1, 'Kit Digital pronto');
insert into encounter_prep_checklist_items (encounter_number, sort_order, label) values (4, 2, 'Playbook de Marca Pessoal pronto (link salvo)');
insert into encounter_prep_checklist_items (encounter_number, sort_order, label) values (5, 0, 'Análise de Negócio preenchida pela cliente');
insert into encounter_prep_checklist_items (encounter_number, sort_order, label) values (5, 1, 'Nova estratégia de precificação definida');
insert into encounter_prep_checklist_items (encounter_number, sort_order, label) values (6, 0, 'Business Playbook pronto (link salvo)');
insert into encounter_prep_checklist_items (encounter_number, sort_order, label) values (6, 1, 'Pontos de implementação para validar com a cliente');
insert into encounter_prep_checklist_items (encounter_number, sort_order, label) values (7, 0, 'Necessidade específica da cliente identificada para este encontro');
insert into encounter_prep_checklist_items (encounter_number, sort_order, label) values (8, 0, 'Necessidade específica da cliente identificada para este encontro');

-- ============================================================
-- program_phases
-- ============================================================
insert into program_phases (id, description) values (0, 'Entender o que você vende e por que vende — sua essência, sua história, e o que já apareceu no Teste de Arquétipos e na Extração de Marca.');
insert into program_phases (id, description) values (1, 'Conectar sua imagem pessoal à sua estratégia e à percepção da sua marca.');
insert into program_phases (id, description) values (2, 'Esclarecer para quem, onde e por que você deve se posicionar — e aplicar isso na prática, na sua comunicação e no seu conteúdo.');
insert into program_phases (id, description) values (3, 'Aprofundar sua oferta, seus números e sua estratégia comercial — a etapa mais estratégica da jornada Premium.');

-- ============================================================
-- program_phase_activities
-- ============================================================
insert into program_phase_activities (phase_id, activity_slug, sort_order) values (0, 'brand-extraction', 0);
insert into program_phase_activities (phase_id, activity_slug, sort_order) values (0, 'archetype-test', 1);
insert into program_phase_activities (phase_id, activity_slug, sort_order) values (0, 'business-survey', 2);
insert into program_phase_activities (phase_id, activity_slug, sort_order) values (0, 'activity-guide', 3);
insert into program_phase_activities (phase_id, activity_slug, sort_order) values (0, 'initial-images', 4);
insert into program_phase_activities (phase_id, activity_slug, sort_order) values (1, 'brand-direction', 0);
insert into program_phase_activities (phase_id, activity_slug, sort_order) values (2, 'pitch', 0);
insert into program_phase_activities (phase_id, activity_slug, sort_order) values (2, 'content', 1);
insert into program_phase_activities (phase_id, activity_slug, sort_order) values (3, 'business', 0);

-- ============================================================
-- program_phase_deliverables
-- ============================================================
insert into program_phase_deliverables (phase_id, deliverable_key, sort_order) values (0, 'extraction_analysis', 0);
insert into program_phase_deliverables (phase_id, deliverable_key, sort_order) values (0, 'archetype_reading', 1);
insert into program_phase_deliverables (phase_id, deliverable_key, sort_order) values (0, 'materials_analysis', 2);
insert into program_phase_deliverables (phase_id, deliverable_key, sort_order) values (1, 'image_project', 0);
insert into program_phase_deliverables (phase_id, deliverable_key, sort_order) values (1, 'image_guides', 1);
insert into program_phase_deliverables (phase_id, deliverable_key, sort_order) values (1, 'mood_photo', 2);
insert into program_phase_deliverables (phase_id, deliverable_key, sort_order) values (1, 'positioning_direction', 3);
insert into program_phase_deliverables (phase_id, deliverable_key, sort_order) values (2, 'pitch_feedback', 0);
insert into program_phase_deliverables (phase_id, deliverable_key, sort_order) values (2, 'content_feedback', 1);
insert into program_phase_deliverables (phase_id, deliverable_key, sort_order) values (3, 'value_reading', 0);
insert into program_phase_deliverables (phase_id, deliverable_key, sort_order) values (3, 'digital_kit', 1);

-- ============================================================
-- program_activities
-- ============================================================
insert into program_activities (slug, title, activity_type, display_order, description, premium_description, route) values ('brand-extraction', 'Extração de Marca', 'questionnaire', 1, 'Uma investigação guiada sobre sua essência, história, valores, diferenciais e percepção de marca.', NULL, 'questionnaire.html');
insert into program_activities (slug, title, activity_type, display_order, description, premium_description, route) values ('archetype-test', 'Teste de Arquétipos', 'archetype_quiz', 2, 'Descubra quais energias aparecem com mais força na sua imagem, comunicação e posicionamento.', NULL, 'arquetipos.html');
insert into program_activities (slug, title, activity_type, display_order, description, premium_description, route) values ('business-survey', 'Pesquisa de Precificação', 'survey', 3, 'Perguntas rápidas sobre como você cobra hoje e o que gostaria de estar cobrando — direciona o seu Encontro 2.', NULL, 'business-survey.html');
insert into program_activities (slug, title, activity_type, display_order, description, premium_description, route) values ('activity-guide', 'Guia de Atividades', 'document', 4, 'Veja como preparar e fotografar as imagens que serão analisadas pela equipe.', NULL, 'activity-guide.html');
insert into program_activities (slug, title, activity_type, display_order, description, premium_description, route) values ('initial-images', 'Imagens', 'upload', 5, 'Envie as imagens solicitadas para que a equipe possa iniciar sua análise.', NULL, 'images.html');
insert into program_activities (slug, title, activity_type, display_order, description, premium_description, route) values ('brand-direction', 'Direção da Marca', 'workspace', 6, 'Organize os direcionamentos estratégicos que irão orientar sua imagem, sua comunicação e suas decisões de marca.', NULL, 'brand-direction.html');
insert into program_activities (slug, title, activity_type, display_order, description, premium_description, route) values ('pitch', 'Pitch', 'generator', 6, 'Construa uma apresentação clara, segura e coerente sobre quem você é e o valor que entrega.', NULL, 'pitch.html');
insert into program_activities (slug, title, activity_type, display_order, description, premium_description, route) values ('content', 'Conteúdo', 'workspace', 7, 'Transforme seu posicionamento em uma comunicação consistente e aplicável aos seus canais.', NULL, 'content-activity.html');
insert into program_activities (slug, title, activity_type, display_order, description, premium_description, route) values ('business', 'Business', 'workspace', 8, 'Aprofunde sua oferta, seus números, sua capacidade, suas vendas e sua precificação para tomar decisões comerciais mais conscientes.', 'Aprofunde sua oferta, seus números, sua capacidade, suas vendas e sua precificação para tomar decisões comerciais mais conscientes.', 'value-analysis.html');

-- ============================================================
-- program_activity_access
-- ============================================================
insert into program_activity_access (program_slug, activity_slug, access) values ('persea-essential', 'brand-extraction', 'included');
insert into program_activity_access (program_slug, activity_slug, access) values ('persea-essential', 'archetype-test', 'included');
insert into program_activity_access (program_slug, activity_slug, access) values ('persea-essential', 'business-survey', 'included');
insert into program_activity_access (program_slug, activity_slug, access) values ('persea-essential', 'activity-guide', 'included');
insert into program_activity_access (program_slug, activity_slug, access) values ('persea-essential', 'initial-images', 'included');
insert into program_activity_access (program_slug, activity_slug, access) values ('persea-essential', 'brand-direction', 'included');
insert into program_activity_access (program_slug, activity_slug, access) values ('persea-essential', 'pitch', 'included');
insert into program_activity_access (program_slug, activity_slug, access) values ('persea-essential', 'content', 'included');
insert into program_activity_access (program_slug, activity_slug, access) values ('persea-essential', 'business', 'premium_preview');
insert into program_activity_access (program_slug, activity_slug, access) values ('persea-premium', 'brand-extraction', 'included');
insert into program_activity_access (program_slug, activity_slug, access) values ('persea-premium', 'archetype-test', 'included');
insert into program_activity_access (program_slug, activity_slug, access) values ('persea-premium', 'business-survey', 'included');
insert into program_activity_access (program_slug, activity_slug, access) values ('persea-premium', 'activity-guide', 'included');
insert into program_activity_access (program_slug, activity_slug, access) values ('persea-premium', 'initial-images', 'included');
insert into program_activity_access (program_slug, activity_slug, access) values ('persea-premium', 'brand-direction', 'included');
insert into program_activity_access (program_slug, activity_slug, access) values ('persea-premium', 'pitch', 'included');
insert into program_activity_access (program_slug, activity_slug, access) values ('persea-premium', 'content', 'included');
insert into program_activity_access (program_slug, activity_slug, access) values ('persea-premium', 'business', 'included');
insert into program_activity_access (program_slug, activity_slug, access) values ('ascensao-imagem', 'brand-extraction', 'included');
insert into program_activity_access (program_slug, activity_slug, access) values ('ascensao-imagem', 'archetype-test', 'included');
insert into program_activity_access (program_slug, activity_slug, access) values ('ascensao-imagem', 'business-survey', 'included');
insert into program_activity_access (program_slug, activity_slug, access) values ('ascensao-imagem', 'activity-guide', 'included');
insert into program_activity_access (program_slug, activity_slug, access) values ('ascensao-imagem', 'initial-images', 'included');
insert into program_activity_access (program_slug, activity_slug, access) values ('ascensao-imagem', 'brand-direction', 'premium_preview');
insert into program_activity_access (program_slug, activity_slug, access) values ('ascensao-imagem', 'pitch', 'included');
insert into program_activity_access (program_slug, activity_slug, access) values ('ascensao-imagem', 'content', 'included');
insert into program_activity_access (program_slug, activity_slug, access) values ('ascensao-imagem', 'business', 'premium_preview');

-- ============================================================
-- business_survey_questions
-- ============================================================
insert into business_survey_questions (key, label, question_type, placeholder, sort_order) values ('currentPricing', 'Como você cobra hoje pelos seus serviços?', 'text', 'Ex.: R$ 300 por sessão', 0);
insert into business_survey_questions (key, label, question_type, placeholder, sort_order) values ('timePerDelivery', 'Quanto tempo você gasta, em média, por entrega ou atendimento?', 'text', 'Ex.: 3 horas', 1);
insert into business_survey_questions (key, label, question_type, placeholder, sort_order) values ('goalPricing', 'Quanto você gostaria de estar cobrando?', 'text', 'Ex.: R$ 500 por sessão', 2);
insert into business_survey_questions (key, label, question_type, placeholder, sort_order) values ('biggestChallenge', 'Qual é o maior desafio que você sente hoje para vender?', 'textarea', '', 3);

-- ============================================================
-- archetype_defs
-- ============================================================
insert into archetype_defs (slug, name, display_order, central_desire, potentials, caution, visual_direction, female_image_url, male_image_url) values ('everyperson', 'Cara Comum', 1, 'Pertencer e se conectar genuinamente com as pessoas — ser vista como alguém acessível, de confiança, sem pose.', 'Constrói confiança rápido, gera identificação e comunica com simplicidade e humildade.', 'Pode se diluir por medo de se destacar, ou soar genérica demais para atrair o público certo.', 'Estética próxima e natural, sem excesso de produção — roupas confortáveis, ambientes reais, linguagem simples.', '../assets/archetypes/female/everyperson.webp', '../assets/archetypes/male/everyperson.webp');
insert into archetype_defs (slug, name, display_order, central_desire, potentials, caution, visual_direction, female_image_url, male_image_url) values ('innocent', 'Inocente', 2, 'Viver com segurança, otimismo e simplicidade, confiando que as coisas vão dar certo.', 'Transmite leveza, honestidade e confiança; inspira esperança em quem a segue.', 'Pode evitar posicionamentos mais firmes por medo de parecer negativa ou conflituosa.', 'Cores claras, luz natural, composições limpas e comunicação positiva e direta.', '../assets/archetypes/female/innocent.webp', '../assets/archetypes/male/innocent.webp');
insert into archetype_defs (slug, name, display_order, central_desire, potentials, caution, visual_direction, female_image_url, male_image_url) values ('hero', 'Herói', 3, 'Provar seu valor através de ações corajosas e superar desafios.', 'Inspira coragem, disciplina e superação; motiva outras pessoas a agir.', 'Pode se cobrar demais ou parecer competitiva se não equilibrar força com empatia.', 'Composições dinâmicas, cores fortes e linguagem de conquista e movimento.', '../assets/archetypes/female/hero.webp', '../assets/archetypes/male/hero.webp');
insert into archetype_defs (slug, name, display_order, central_desire, potentials, caution, visual_direction, female_image_url, male_image_url) values ('caregiver', 'Cuidador', 4, 'Cuidar e proteger as pessoas ao seu redor.', 'Gera confiança profunda, empatia genuína e senso de comunidade.', 'Pode se esquecer de si mesma ou ter dificuldade de cobrar pelo próprio valor.', 'Tons acolhedores, ambientes próximos e comunicação calorosa e generosa.', '../assets/archetypes/female/caregiver.webp', '../assets/archetypes/male/caregiver.webp');
insert into archetype_defs (slug, name, display_order, central_desire, potentials, caution, visual_direction, female_image_url, male_image_url) values ('explorer', 'Explorador', 5, 'Ter liberdade para descobrir o mundo e a si mesma através de novas experiências.', 'Inspira autenticidade, independência e coragem para sair do óbvio.', 'Pode ter dificuldade com rotina, compromisso ou processos mais estruturados.', 'Cenários abertos, movimento, texturas naturais e comunicação sobre jornada e descoberta.', '../assets/archetypes/female/explorer.webp', '../assets/archetypes/male/explorer.webp');
insert into archetype_defs (slug, name, display_order, central_desire, potentials, caution, visual_direction, female_image_url, male_image_url) values ('lover', 'Amante', 6, 'Criar conexões profundas, sentir e despertar paixão, prazer e beleza.', 'Comunica com sensibilidade, cria experiências memoráveis e constrói vínculos fortes.', 'Pode depender demais da aprovação externa ou perder limites profissionais nas relações.', 'Estética sensorial e cuidada, cores quentes e comunicação próxima e emocional.', '../assets/archetypes/female/lover.webp', '../assets/archetypes/male/lover.webp');
insert into archetype_defs (slug, name, display_order, central_desire, potentials, caution, visual_direction, female_image_url, male_image_url) values ('outlaw', 'Fora da Lei', 7, 'Romper regras que não fazem mais sentido e provocar mudança real.', 'Traz coragem para desafiar o status quo e atrai quem busca autenticidade sem filtro.', 'Pode gerar resistência ou desconforto se a provocação não vier acompanhada de propósito claro.', 'Contrastes fortes, estética não-convencional e comunicação direta, sem rodeios.', '../assets/archetypes/female/outlaw.webp', '../assets/archetypes/male/outlaw.webp');
insert into archetype_defs (slug, name, display_order, central_desire, potentials, caution, visual_direction, female_image_url, male_image_url) values ('creator', 'Criador', 8, 'Criar algo novo e de valor duradouro, dar forma a uma visão.', 'Traz originalidade, visão estética forte e capacidade de inovar.', 'Pode buscar perfeccionismo excessivo e travar na hora de lançar ou publicar.', 'Estética autoral, composições cuidadas e comunicação sobre o processo criativo.', '../assets/archetypes/female/creator.webp', '../assets/archetypes/male/creator.webp');
insert into archetype_defs (slug, name, display_order, central_desire, potentials, caution, visual_direction, female_image_url, male_image_url) values ('magician', 'Mago', 9, 'Compreender as leis fundamentais de como o mundo funciona e transformar realidades.', 'Inspira transformação, tem visão estratégica e conecta pontos que outros não veem.', 'Pode prometer transformações grandes demais ou parecer distante da realidade prática.', 'Estética com profundidade, elementos simbólicos e comunicação sobre transformação e visão.', '../assets/archetypes/female/magician.webp', '../assets/archetypes/male/magician.webp');
insert into archetype_defs (slug, name, display_order, central_desire, potentials, caution, visual_direction, female_image_url, male_image_url) values ('ruler', 'Governante', 10, 'Criar ordem, prosperidade e liderar com responsabilidade.', 'Transmite autoridade natural, visão estratégica e capacidade de organizar e liderar.', 'Pode parecer controladora ou distante se não equilibrar autoridade com acessibilidade.', 'Estética sofisticada, composições estruturadas e comunicação de autoridade e clareza.', '../assets/archetypes/female/ruler.webp', '../assets/archetypes/male/ruler.webp');
insert into archetype_defs (slug, name, display_order, central_desire, potentials, caution, visual_direction, female_image_url, male_image_url) values ('sage', 'Sábio', 11, 'Buscar a verdade através do conhecimento e ajudar outras pessoas a entenderem o mundo.', 'Transmite clareza, profundidade analítica e credibilidade através do conteúdo.', 'Pode se perder em excesso de informação ou parecer distante e teórica demais.', 'Estética limpa e intelectual, comunicação baseada em dados, clareza e ensino.', '../assets/archetypes/female/sage.webp', '../assets/archetypes/male/sage.webp');
insert into archetype_defs (slug, name, display_order, central_desire, potentials, caution, visual_direction, female_image_url, male_image_url) values ('jester', 'Bobo', 12, 'Viver o momento presente com alegria e leveza, sem se levar tão a sério.', 'Cria conexão através do humor e torna mensagens difíceis mais leves e acessíveis.', 'Pode ser vista como pouco séria em contextos que exigem mais formalidade.', 'Cores vibrantes, composições espontâneas e comunicação leve e bem-humorada.', '../assets/archetypes/female/jester.webp', '../assets/archetypes/male/jester.webp');

-- ============================================================
-- archetype_quiz_questions
-- ============================================================
insert into archetype_quiz_questions (number, text, archetype_slug, section_index) values (1, 'O mundo é um lugar seguro.', 'innocent', 1);
insert into archetype_quiz_questions (number, text, archetype_slug, section_index) values (2, 'Tento sempre superar meus próprios limites.', 'hero', 1);
insert into archetype_quiz_questions (number, text, archetype_slug, section_index) values (3, 'Ponho as necessidades dos outros na frente das minhas.', 'caregiver', 1);
insert into archetype_quiz_questions (number, text, archetype_slug, section_index) values (4, 'Estou procurando melhorar a minha vida.', 'explorer', 1);
insert into archetype_quiz_questions (number, text, archetype_slug, section_index) values (5, 'Procuro sempre me aperfeiçoar.', 'explorer', 1);
insert into archetype_quiz_questions (number, text, archetype_slug, section_index) values (6, 'Gosto da sensualidade.', 'lover', 1);
insert into archetype_quiz_questions (number, text, archetype_slug, section_index) values (7, 'Sinto-me mais à vontade em minha própria casa.', 'everyperson', 1);
insert into archetype_quiz_questions (number, text, archetype_slug, section_index) values (8, 'Estou disposto(a) a correr riscos pessoais para defender as ideias nas quais acredito.', 'hero', 1);
insert into archetype_quiz_questions (number, text, archetype_slug, section_index) values (9, 'Converso de modo coloquial e não gosto de elitismo.', 'everyperson', 2);
insert into archetype_quiz_questions (number, text, archetype_slug, section_index) values (10, 'Gosto mais de dar que de receber.', 'caregiver', 2);
insert into archetype_quiz_questions (number, text, archetype_slug, section_index) values (11, 'Sinto certa inquietação.', 'explorer', 2);
insert into archetype_quiz_questions (number, text, archetype_slug, section_index) values (12, 'Vivo a vida plenamente.', 'lover', 2);
insert into archetype_quiz_questions (number, text, archetype_slug, section_index) values (13, 'Acredito que as pessoas não querem realmente magoar as outras.', 'innocent', 2);
insert into archetype_quiz_questions (number, text, archetype_slug, section_index) values (14, 'Concordo com a seguinte afirmação: "É melhor ter amado e perdido o objeto desse amor do que nunca ter amado".', 'lover', 2);
insert into archetype_quiz_questions (number, text, archetype_slug, section_index) values (15, 'Encontro satisfação nos meus relacionamentos.', 'lover', 2);
insert into archetype_quiz_questions (number, text, archetype_slug, section_index) values (16, 'Amo a liberdade.', 'outlaw', 2);
insert into archetype_quiz_questions (number, text, archetype_slug, section_index) values (17, 'Se não estou de acordo, não entro em conformidade.', 'outlaw', 3);
insert into archetype_quiz_questions (number, text, archetype_slug, section_index) values (18, 'Nunca estou satisfeito(a) totalmente.', 'creator', 3);
insert into archetype_quiz_questions (number, text, archetype_slug, section_index) values (19, 'Eu me esforço por ser objetivo(a).', 'sage', 3);
insert into archetype_quiz_questions (number, text, archetype_slug, section_index) values (20, 'Quando conheço uma pessoa, acredito que ela seja digna de confiança.', 'innocent', 3);
insert into archetype_quiz_questions (number, text, archetype_slug, section_index) values (21, 'A manutenção da minha independência é fundamental para mim.', 'explorer', 3);
insert into archetype_quiz_questions (number, text, archetype_slug, section_index) values (22, 'A ajuda espiritual é responsável pela minha eficiência.', 'magician', 3);
insert into archetype_quiz_questions (number, text, archetype_slug, section_index) values (23, 'A modificação de meus pensamentos altera a minha vida.', 'magician', 3);
insert into archetype_quiz_questions (number, text, archetype_slug, section_index) values (24, 'Tenho capacidade de liderança.', 'ruler', 3);
insert into archetype_quiz_questions (number, text, archetype_slug, section_index) values (25, 'As pessoas me procuram em busca de orientação.', 'ruler', 4);
insert into archetype_quiz_questions (number, text, archetype_slug, section_index) values (26, 'Mantenho um senso de perspectiva, procurando ter uma visão de longo alcance.', 'sage', 4);
insert into archetype_quiz_questions (number, text, archetype_slug, section_index) values (27, 'Os outros me acham divertido(a).', 'jester', 4);
insert into archetype_quiz_questions (number, text, archetype_slug, section_index) values (28, 'Gosto de fazer as pessoas rirem.', 'jester', 4);
insert into archetype_quiz_questions (number, text, archetype_slug, section_index) values (29, 'Gosto de momentos simples e familiares.', 'everyperson', 4);
insert into archetype_quiz_questions (number, text, archetype_slug, section_index) values (30, 'Acho mais fácil fazer as coisas para os outros do que para mim mesmo(a).', 'caregiver', 4);
insert into archetype_quiz_questions (number, text, archetype_slug, section_index) values (31, 'Estou empenhado(a) no processo de criar a minha própria vida.', 'creator', 4);
insert into archetype_quiz_questions (number, text, archetype_slug, section_index) values (32, 'Deixo o medo de lado e faço o que precisa ser feito.', 'hero', 4);
insert into archetype_quiz_questions (number, text, archetype_slug, section_index) values (33, 'Eu choco os outros.', 'outlaw', 5);
insert into archetype_quiz_questions (number, text, archetype_slug, section_index) values (34, 'A inspiração vem facilmente para mim.', 'creator', 5);
insert into archetype_quiz_questions (number, text, archetype_slug, section_index) values (35, 'Acredito que uma mesma coisa pode ser considerada a partir de diferentes ângulos.', 'sage', 5);
insert into archetype_quiz_questions (number, text, archetype_slug, section_index) values (36, 'Não levo as regras muito a sério.', 'jester', 5);
insert into archetype_quiz_questions (number, text, archetype_slug, section_index) values (37, 'Um pouco de bagunça é bom para a alma.', 'jester', 5);
insert into archetype_quiz_questions (number, text, archetype_slug, section_index) values (38, 'Acredito na capacidade humana para aprender e crescer.', 'sage', 5);
insert into archetype_quiz_questions (number, text, archetype_slug, section_index) values (39, 'Posso contar com outras pessoas para cuidarem de mim.', 'innocent', 5);
insert into archetype_quiz_questions (number, text, archetype_slug, section_index) values (40, 'Minha presença muitas vezes atua como um catalisador para a realização de mudanças.', 'magician', 5);
insert into archetype_quiz_questions (number, text, archetype_slug, section_index) values (41, 'Prefiro estar no comando das situações.', 'ruler', 6);
insert into archetype_quiz_questions (number, text, archetype_slug, section_index) values (42, 'Sou grandioso(a).', 'ruler', 6);
insert into archetype_quiz_questions (number, text, archetype_slug, section_index) values (43, 'Acredito que todas as pessoas e todas as coisas do mundo estão interligadas.', 'magician', 6);
insert into archetype_quiz_questions (number, text, archetype_slug, section_index) values (44, 'A criatividade é um dos meus maiores dons.', 'creator', 6);
insert into archetype_quiz_questions (number, text, archetype_slug, section_index) values (45, 'Eu sigo minhas próprias leis.', 'outlaw', 6);
insert into archetype_quiz_questions (number, text, archetype_slug, section_index) values (46, 'Tenho prazer em cuidar das outras pessoas.', 'caregiver', 6);
insert into archetype_quiz_questions (number, text, archetype_slug, section_index) values (47, 'Tenho disciplina para alcançar as minhas metas.', 'hero', 6);
insert into archetype_quiz_questions (number, text, archetype_slug, section_index) values (48, 'A palavra "verdadeiro" é uma das que melhor me define.', 'everyperson', 6);

-- ============================================================
-- template_categories, template_category_groups, template_items
-- ============================================================
insert into template_categories (key, label, description, is_single) values ('cartelaCores', 'Cartela de Cores', 'Um modelo por subtipo de estação (análise sazonal de 12 tons) — 12 no total.', false);
insert into template_category_groups (category_key, group_label, sort_order) values ('cartelaCores', 'Primavera', 0);
insert into template_items (group_id, item_key, item_label, url, sort_order) values ((select id from template_category_groups where category_key = 'cartelaCores' and sort_order = 0), 'primavera_brilhante', 'Brilhante', 'https://www.canva.com/design/PLACEHOLDER-cartela-primavera-brilhante/view', 0);
insert into template_items (group_id, item_key, item_label, url, sort_order) values ((select id from template_category_groups where category_key = 'cartelaCores' and sort_order = 0), 'primavera_quente', 'Quente', 'https://www.canva.com/design/PLACEHOLDER-cartela-primavera-quente/view', 1);
insert into template_items (group_id, item_key, item_label, url, sort_order) values ((select id from template_category_groups where category_key = 'cartelaCores' and sort_order = 0), 'primavera_clara', 'Clara', 'https://www.canva.com/design/PLACEHOLDER-cartela-primavera-clara/view', 2);
insert into template_category_groups (category_key, group_label, sort_order) values ('cartelaCores', 'Verão', 1);
insert into template_items (group_id, item_key, item_label, url, sort_order) values ((select id from template_category_groups where category_key = 'cartelaCores' and sort_order = 1), 'verao_claro', 'Claro', 'https://www.canva.com/design/PLACEHOLDER-cartela-verao-claro/view', 0);
insert into template_items (group_id, item_key, item_label, url, sort_order) values ((select id from template_category_groups where category_key = 'cartelaCores' and sort_order = 1), 'verao_frio', 'Frio', 'https://www.canva.com/design/PLACEHOLDER-cartela-verao-frio/view', 1);
insert into template_items (group_id, item_key, item_label, url, sort_order) values ((select id from template_category_groups where category_key = 'cartelaCores' and sort_order = 1), 'verao_suave', 'Suave', 'https://www.canva.com/design/PLACEHOLDER-cartela-verao-suave/view', 2);
insert into template_category_groups (category_key, group_label, sort_order) values ('cartelaCores', 'Outono', 2);
insert into template_items (group_id, item_key, item_label, url, sort_order) values ((select id from template_category_groups where category_key = 'cartelaCores' and sort_order = 2), 'outono_suave', 'Suave', 'https://www.canva.com/design/PLACEHOLDER-cartela-outono-suave/view', 0);
insert into template_items (group_id, item_key, item_label, url, sort_order) values ((select id from template_category_groups where category_key = 'cartelaCores' and sort_order = 2), 'outono_quente', 'Quente', 'https://www.canva.com/design/PLACEHOLDER-cartela-outono-quente/view', 1);
insert into template_items (group_id, item_key, item_label, url, sort_order) values ((select id from template_category_groups where category_key = 'cartelaCores' and sort_order = 2), 'outono_escuro', 'Escuro', 'https://www.canva.com/design/PLACEHOLDER-cartela-outono-escuro/view', 2);
insert into template_category_groups (category_key, group_label, sort_order) values ('cartelaCores', 'Inverno', 3);
insert into template_items (group_id, item_key, item_label, url, sort_order) values ((select id from template_category_groups where category_key = 'cartelaCores' and sort_order = 3), 'inverno_brilhante', 'Brilhante', 'https://www.canva.com/design/PLACEHOLDER-cartela-inverno-brilhante/view', 0);
insert into template_items (group_id, item_key, item_label, url, sort_order) values ((select id from template_category_groups where category_key = 'cartelaCores' and sort_order = 3), 'inverno_frio', 'Frio', 'https://www.canva.com/design/PLACEHOLDER-cartela-inverno-frio/view', 1);
insert into template_items (group_id, item_key, item_label, url, sort_order) values ((select id from template_category_groups where category_key = 'cartelaCores' and sort_order = 3), 'inverno_escuro', 'Escuro', 'https://www.canva.com/design/PLACEHOLDER-cartela-inverno-escuro/view', 2);
insert into template_categories (key, label, description, is_single) values ('guiaProducoes', 'Guia de Produções', 'Um modelo completo e um modelo mensal — o mensal também pode ser enviado direto para a cliente.', false);
insert into template_category_groups (category_key, group_label, sort_order) values ('guiaProducoes', NULL, 0);
insert into template_items (group_id, item_key, item_label, url, sort_order) values ((select id from template_category_groups where category_key = 'guiaProducoes' and sort_order = 0), 'completo', 'Guia Completo', 'https://www.canva.com/design/PLACEHOLDER-guia-producoes-completo/view', 0);
insert into template_items (group_id, item_key, item_label, url, sort_order) values ((select id from template_category_groups where category_key = 'guiaProducoes' and sort_order = 0), 'mensal', 'Guia Mensal', 'https://www.canva.com/design/PLACEHOLDER-guia-producoes-mensal/view', 1);
insert into template_categories (key, label, description, is_single) values ('kitDigital', 'Kit Digital', 'Modelo único usado para montar o Kit Digital de cada cliente.', true);
insert into template_category_groups (category_key, group_label, sort_order) values ('kitDigital', NULL, 0);
insert into template_items (group_id, item_key, item_label, url, sort_order) values ((select id from template_category_groups where category_key = 'kitDigital' and sort_order = 0), 'padrao', 'Modelo', 'https://www.canva.com/design/PLACEHOLDER-kit-digital/view', 0);
insert into template_categories (key, label, description, is_single) values ('planejamentoImagem', 'Planejamento de Imagem', 'Modelo único.', true);
insert into template_category_groups (category_key, group_label, sort_order) values ('planejamentoImagem', NULL, 0);
insert into template_items (group_id, item_key, item_label, url, sort_order) values ((select id from template_category_groups where category_key = 'planejamentoImagem' and sort_order = 0), 'padrao', 'Modelo', 'https://www.canva.com/design/PLACEHOLDER-planejamento-imagem/view', 0);
insert into template_categories (key, label, description, is_single) values ('ferramentasNovaImagem', 'Ferramentas para Nova Imagem', 'Modelo único.', true);
insert into template_category_groups (category_key, group_label, sort_order) values ('ferramentasNovaImagem', NULL, 0);
insert into template_items (group_id, item_key, item_label, url, sort_order) values ((select id from template_category_groups where category_key = 'ferramentasNovaImagem' and sort_order = 0), 'padrao', 'Modelo', 'https://www.canva.com/design/PLACEHOLDER-ferramentas-nova-imagem/view', 0);

-- ============================================================
-- content_categories
-- ============================================================
insert into content_categories (legacy_id, title, description, cover_image_url, cover_tone, hubla_url, display_order, is_visible) values ('cc1', 'Marca Pessoal', 'Como construir uma marca pessoal autêntica e consistente.', '../shared/assets/content/marca-pessoal.jpg', 0, 'https://pay.hubla.com.br/PLACEHOLDER-marca-pessoal', 1, true);
insert into content_categories (legacy_id, title, description, cover_image_url, cover_tone, hubla_url, display_order, is_visible) values ('cc2', 'Oratória', 'Técnicas para falar em público com confiança e clareza.', '../shared/assets/content/oratoria.jpg', 1, 'https://pay.hubla.com.br/PLACEHOLDER-oratoria', 2, true);
insert into content_categories (legacy_id, title, description, cover_image_url, cover_tone, hubla_url, display_order, is_visible) values ('cc3', 'Imagem Pessoal', 'Estilo, styling e comunicação não-verbal alinhados à sua marca.', '../shared/assets/content/imagem-pessoal.jpg', 2, 'https://pay.hubla.com.br/PLACEHOLDER-imagem-pessoal', 3, true);
insert into content_categories (legacy_id, title, description, cover_image_url, cover_tone, hubla_url, display_order, is_visible) values ('cc4', 'Presença e Postura', 'Presença de palco, postura corporal e linguagem corporal.', '../shared/assets/content/presenca-postura.jpg', 3, 'https://pay.hubla.com.br/PLACEHOLDER-presenca-postura', 4, true);

-- ============================================================
-- contract_duration_pricing
-- ============================================================
insert into contract_duration_pricing (duration, value_cents) values ('semestral', 1800000);
insert into contract_duration_pricing (duration, value_cents) values ('anual', 3200000);

-- ============================================================
-- program_pricing
-- ============================================================
insert into program_pricing (program, value_cents) values ('ascensao_imagem', 600000);
insert into program_pricing (program, value_cents) values ('persea', NULL);
