// Mock data layer — stands in for agency-framework/*-engine/api.js + Supabase.
// Same shape/intent as the real engines: screens only ever call functions here,
// never touch storage directly. Swapping to Supabase later = rewriting this
// file's internals; screens stay untouched.
//
// Keyed by clientId throughout (client_id is a real FK in the schema — see
// docs/02-database-schema.md) so the admin side can hold several clients at
// once, each progressing through the journey independently.

import { blankAssessmentAnswers, blankOffer, blankFixedCost, blankVariableCost, blankReference } from './value-analysis-schema.js';
import { deriveEffectiveStatus } from './date-utils.js';
import { isProductionEnvironment } from './environment.js';

const STORAGE_KEY = 'persea_mock_db_v38';
export const DEFAULT_CLIENT_ID = 'client-1';

// Which client the "client" side of the prototype is currently acting as —
// there's no real auth here, so this stands in for a logged-in session.
// Separate localStorage key from the seeded DB so switching clients never
// touches/resets their data.
const ACTIVE_CLIENT_KEY = 'persea_active_client';
export function getActiveClientId() {
  return localStorage.getItem(ACTIVE_CLIENT_KEY) || DEFAULT_CLIENT_ID;
}
export function setActiveClientId(id) {
  localStorage.setItem(ACTIVE_CLIENT_KEY, id);
}

// Mentoring program phases — both tiers show all 4 names (Fase 1-4, see
// ENCOUNTER_DEFS below for which encounters land in each), but Fase 4
// ("Negócio e Aquisição") is Premium-only content: an Essencial client sees
// it on her tracker and journey as a locked/Premium-teaser card (see
// PREMIUM_ONLY_PHASE_INDEX below and its use in ui.js's renderPhaseTracker
// + getClientJourney), never something she can actually enter. That's why
// her real advancement cap is separate — see TIER_MAX_PHASE_INDEX.
export const TIER_PHASES = {
  premium: ['Essência, Comunicação e Vendas', 'Imagem e Estratégia', 'Posicionamento e Metas', 'Negócio e Aquisição'],
  essential: ['Essência, Comunicação e Vendas', 'Imagem e Estratégia', 'Posicionamento e Metas', 'Negócio e Aquisição'],
};
// The one phase every non-Premium tier can see but never actually enter —
// matches E5-E8 (premiumOnly) all living in this same phase.
export const PREMIUM_ONLY_PHASE_INDEX = 3;
// How far setClientPhase will actually let a client advance, per tier —
// distinct from TIER_PHASES.length, which is display-only (see above).
// Premium can reach every phase; Essencial's real ceiling is Fase 3.
export const TIER_MAX_PHASE_INDEX = { premium: 3, essential: 2 };

// --- Program Hub ------------------------------------------------------------
// The real enrollment model, replacing the old tier(premium/essential) +
// onboarding.contract.program duality with one explicit field:
// profile.programSlug, the sole authority for program identity/access
// everywhere in this file. `tier` is kept on the client record only for
// the pre-existing phase-ladder widget (TIER_PHASES above) — it no longer
// gates anything real (getClientJourney's premiumLocked check used to read
// tier instead of programSlug; fixed per the Production Audit Remediation
// Pass, which also removed the one client record whose tier/programSlug
// had drifted apart — see High 8).
export const PROGRAM_DEFS = [
  {
    slug: 'persea-essential', name: 'Persea Essencial', durationMonths: 6, displayOrder: 1,
    description: 'Sua jornada de mentoria em marca pessoal, da extração da sua essência até uma comunicação pronta para o mercado.',
    positioning: 'Ensinar + Apoiar', supportingStatement: 'Cliente executa com autonomia.',
  },
  {
    slug: 'persea-premium', name: 'Persea Premium', durationMonths: 12, displayOrder: 2,
    description: 'A jornada completa da Persea, incluindo o acompanhamento estratégico e comercial aprofundado do módulo Business.',
    positioning: 'Ensinar + Guiar', supportingStatement: 'Nay acompanha decisões e aplicações.',
  },
  // Ascensão de Imagem removed (Production Audit Remediation Pass, High 8) —
  // business decision: it is no longer part of the system. The two current
  // products are Persea Essencial and Persea Premium only.
];
export const PROGRAM_LABEL_BY_SLUG = Object.fromEntries(PROGRAM_DEFS.map((p) => [p.slug, p.name]));

// --- Nova Persea methodology: the E1-E8 encounter journey ------------------
// Single source of truth for encounter numbers/names/phases, so nothing
// else in the app hard-codes an encounter name. Encounters are still plain
// agendaItems underneath (see agendaItems seed + getEncounterJourney below)
// — this is metadata describing the canonical journey, not a new storage
// table. E1-E4 are Persea Essencial's whole journey; Premium continues
// through E8. E7/E8 are deliberately generic ("Encontro Adaptativo") — Nay
// decides their focus per client, so no fixed topic is invented here.
export const ENCOUNTER_DEFS = [
  {
    number: 1, slug: 'e1', name: 'Extração e Essência', phase: 0,
    purpose: 'Ouvir e entender QUEM a cliente é e POR QUE ela vende o que vende — Nay chega preparada a partir da Extração de Marca e do Teste de Arquétipos. Depois deste encontro, Nay monta o mural de inspiração (Direção da Marca).',
    premiumOnly: false,
  },
  {
    number: 2, slug: 'e2', name: 'Comunicação e Vendas', phase: 0,
    purpose: 'A cliente já respondeu a pesquisa de precificação (O QUE e COMO ela vende hoje) — Nay entra direcionando o encontro para as vendas dela: pitch para praticar, conteúdo recomendado, e onde ela pode se inspirar na Direção da Marca.',
    premiumOnly: false,
  },
  {
    number: 3, slug: 'e3', name: 'Imagem e Estratégia', phase: 1,
    purpose: 'A imagem a serviço do QUE e do COMO vender. A assistente já preparou e Nay já aprovou a Cartela de Cores, o Guia de Produções, o Planejamento de Imagem e as Ferramentas para Nova Imagem — apresentados juntos à cliente nesta chamada de 1h.',
    premiumOnly: false,
  },
  {
    number: 4, slug: 'e4', name: 'Posicionamento e Metas', phase: 2,
    purpose: 'COMO e ONDE vender — cliente já fez o ensaio fotográfico profissional. Nay apresenta o novo Kit Digital e o Playbook de Marca Pessoal, alinhando posicionamento, metas tangíveis e precificação. Encerramento formal da Persea Essencial.',
    premiumOnly: false,
  },
  {
    number: 5, slug: 'e5', name: 'Vendas e Comunicação', phase: 3,
    purpose: 'A cliente já preencheu a Análise de Negócio (pré-requisito obrigatório). Nay aprofunda o COMO e ONDE vender, apresenta a nova estratégia de precificação e encoraja a cliente — recomendando apoio extra (ex.: oratória) quando fizer sentido.',
    premiumOnly: true,
  },
  {
    number: 6, slug: 'e6', name: 'Negócio e Aquisição', phase: 3,
    purpose: 'Validar o que está sendo implementado e discutir os próximos passos. Nay apresenta o Business Playbook (análise de negócio + pontos de foco para a cliente perseguir).',
    premiumOnly: true,
  },
  {
    number: 7, slug: 'e7', name: 'Encontro Adaptativo', phase: 3,
    purpose: 'Usado onde a cliente precisar de mais apoio — vendas, comunicação, oferta, posicionamento, aquisição ou implementação, a critério da Nay.',
    premiumOnly: true,
  },
  {
    number: 8, slug: 'e8', name: 'Encontro Adaptativo', phase: 3,
    purpose: 'Usado onde puder gerar mais valor — revisar decisões, reforçar implementação ou consolidar próximos passos, a critério da Nay.',
    premiumOnly: true,
  },
];
export const ENCOUNTER_LABEL = Object.fromEntries(ENCOUNTER_DEFS.map((e) => [e.slug, `E${e.number} — ${e.name}`]));

// What Nay is confirming she has ready *before* requesting a time for each
// encontro — prefills the checklist on her "Solicitar Agendamento" request
// (see requestEncounterMeeting). Editable per request (she can add/remove
// lines when she opens the form), this is just the sensible starting point.
export const ENCOUNTER_PREP_CHECKLIST = {
  1: ['Resultados do Teste de Arquétipos e da Extração de Marca revisados', 'Notas prontas para explorar QUEM ela é, O QUE e POR QUE vende'],
  2: ['Pesquisa de Precificação respondida', 'Pitch e conteúdos para recomendar já escolhidos'],
  3: ['Cartela de Cores e Guia de Produções aprovados', 'Planejamento de Imagem e Ferramentas para Nova Imagem prontos'],
  4: ['Ensaio fotográfico profissional realizado', 'Kit Digital pronto', 'Playbook de Marca Pessoal pronto (link salvo)'],
  5: ['Análise de Negócio preenchida pela cliente', 'Nova estratégia de precificação definida'],
  6: ['Business Playbook pronto (link salvo)', 'Pontos de implementação para validar com a cliente'],
  7: ['Necessidade específica da cliente identificada para este encontro'],
  8: ['Necessidade específica da cliente identificada para este encontro'],
};

// --- Client Journey — single source of truth for "Program -> Phase ->
// Encounter -> Client activities -> Mentor deliverables", consumed by both
// the client's guided journey view (client/program.js) and, so names/
// statuses can never drift apart, admin's own broader view. Phase id/name
// here is exactly TIER_PHASES (index-matched) — this config only adds which
// existing PROGRAM_ACTIVITIES slugs and mentor-deliverable keys belong to
// each phase; it does not introduce a second phase-naming scheme.
// clientActivitySlugs must already exist in PROGRAM_ACTIVITIES — nothing
// new is invented here, only grouped. See getClientJourney/mentorDeliverable.
export const PROGRAM_PHASES = [
  {
    id: 0,
    description: 'Entender o que você vende e por que vende — sua essência, sua história, e o que já apareceu no Teste de Arquétipos e na Extração de Marca.',
    clientActivitySlugs: ['brand-extraction', 'archetype-test', 'business-survey', 'activity-guide', 'initial-images'],
    mentorDeliverableKeys: ['extraction_analysis', 'archetype_reading', 'materials_analysis'],
  },
  {
    id: 1,
    description: 'Conectar sua imagem pessoal à sua estratégia e à percepção da sua marca.',
    clientActivitySlugs: ['brand-direction'],
    mentorDeliverableKeys: ['image_project', 'image_guides', 'mood_photo', 'positioning_direction'],
  },
  {
    id: 2,
    description: 'Esclarecer para quem, onde e por que você deve se posicionar — e aplicar isso na prática, na sua comunicação e no seu conteúdo.',
    clientActivitySlugs: ['pitch', 'content'],
    mentorDeliverableKeys: ['pitch_feedback', 'content_feedback'],
  },
  {
    id: 3,
    description: 'Aprofundar sua oferta, seus números e sua estratégia comercial — a etapa mais estratégica da jornada Premium.',
    clientActivitySlugs: ['business'],
    mentorDeliverableKeys: ['value_reading', 'digital_kit'],
  },
];
export const MENTOR_DELIVERABLE_LABEL = {
  extraction_analysis: 'Análise da Extração de Marca', archetype_reading: 'Leitura dos Arquétipos',
  materials_analysis: 'Análise dos Materiais Enviados',
  image_project: 'Projeto de Imagem', image_guides: 'Guias de Imagem', mood_photo: 'Mood Fotográfico',
  positioning_direction: 'Direção de Comunicação e Posicionamento',
  pitch_feedback: 'Devolutiva do Pitch', content_feedback: 'Devolutiva de Conteúdo',
  value_reading: 'Leitura Estratégica de Valor', digital_kit: 'Kit Digital',
};
export const MENTOR_DELIVERABLE_STATUS_LABEL = { em_preparacao: 'Em preparação', pronto: 'Pronto', entregue: 'Entregue' };
export const MENTOR_DELIVERABLE_STATUS_BADGE_CLASS = { em_preparacao: 'badge-progress', pronto: 'badge-progress', entregue: 'badge-completed' };

// The 8 canonical activities every program is built from — order here is
// the journey order shown in the Program Hub.
export const PROGRAM_ACTIVITIES = [
  {
    slug: 'brand-extraction', title: 'Extração de Marca', activityType: 'questionnaire', displayOrder: 1,
    description: 'Uma investigação guiada sobre sua essência, história, valores, diferenciais e percepção de marca.', route: 'questionnaire.html',
  },
  {
    slug: 'archetype-test', title: 'Teste de Arquétipos', activityType: 'archetype_quiz', displayOrder: 2,
    description: 'Descubra quais energias aparecem com mais força na sua imagem, comunicação e posicionamento.', route: 'arquetipos.html',
  },
  // Ahead of E2 — surface-level, never overwhelming (see BUSINESS_SURVEY_QUESTIONS):
  // how she charges today, how long each delivery takes, and what she'd
  // like to be charging. Gives Nay clarity before that encounter, not a
  // full business diagnostic (that's the Business/Ficha de Valor activity).
  {
    slug: 'business-survey', title: 'Pesquisa de Precificação', activityType: 'survey', displayOrder: 3,
    description: 'Perguntas rápidas sobre como você cobra hoje e o que gostaria de estar cobrando — direciona o seu Encontro 2.', route: 'business-survey.html',
  },
  {
    slug: 'activity-guide', title: 'Guia de Atividades', activityType: 'document', displayOrder: 4,
    description: 'Veja como preparar e fotografar as imagens que serão analisadas pela equipe.', route: 'activity-guide.html',
  },
  {
    slug: 'initial-images', title: 'Imagens', activityType: 'upload', displayOrder: 5,
    description: 'Envie as imagens solicitadas para que a equipe possa iniciar sua análise.', route: 'images.html',
  },
  {
    slug: 'brand-direction', title: 'Direção da Marca', activityType: 'workspace', displayOrder: 6,
    description: 'Organize os direcionamentos estratégicos que irão orientar sua imagem, sua comunicação e suas decisões de marca.', route: 'brand-direction.html',
  },
  {
    slug: 'pitch', title: 'Pitch', activityType: 'generator', displayOrder: 6,
    description: 'Construa uma apresentação clara, segura e coerente sobre quem você é e o valor que entrega.', route: 'pitch.html',
  },
  {
    slug: 'content', title: 'Conteúdo', activityType: 'workspace', displayOrder: 7,
    description: 'Transforme seu posicionamento em uma comunicação consistente e aplicável aos seus canais.', route: 'content-activity.html',
  },
  {
    slug: 'business', title: 'Business', activityType: 'workspace', displayOrder: 8,
    description: 'Aprofunde sua oferta, seus números, sua capacidade, suas vendas e sua precificação para tomar decisões comerciais mais conscientes.',
    premiumDescription: 'Aprofunde sua oferta, seus números, sua capacidade, suas vendas e sua precificação para tomar decisões comerciais mais conscientes.',
    route: 'value-analysis.html',
  },
];
export const PROGRAM_ACTIVITY_LABEL = Object.fromEntries(PROGRAM_ACTIVITIES.map((a) => [a.slug, a.title]));

// Source-of-truth access matrix from the Program Hub spec.
export const PROGRAM_ACTIVITY_ACCESS = {
  'persea-essential': {
    'brand-extraction': 'included', 'archetype-test': 'included', 'business-survey': 'included', 'activity-guide': 'included', 'initial-images': 'included',
    'brand-direction': 'included', pitch: 'included', content: 'included', business: 'premium_preview',
  },
  'persea-premium': {
    'brand-extraction': 'included', 'archetype-test': 'included', 'business-survey': 'included', 'activity-guide': 'included', 'initial-images': 'included',
    'brand-direction': 'included', pitch: 'included', content: 'included', business: 'included',
  },
  // Ascensão de Imagem removed (Production Audit Remediation Pass, High 8).
};

// E2's short pricing survey — deliberately surface-level (4 short
// questions, no follow-ups), so Nay walks into E2 already knowing how the
// cliente prices herself today without this feeling like homework. See
// deriveActivityStatus's 'business-survey' case + getBusinessSurvey/
// submitBusinessSurvey below.
export const BUSINESS_SURVEY_QUESTIONS = [
  { key: 'currentPricing', label: 'Como você cobra hoje pelos seus serviços?', type: 'text', placeholder: 'Ex.: R$ 300 por sessão' },
  { key: 'timePerDelivery', label: 'Quanto tempo você gasta, em média, por entrega ou atendimento?', type: 'text', placeholder: 'Ex.: 3 horas' },
  { key: 'goalPricing', label: 'Quanto você gostaria de estar cobrando?', type: 'text', placeholder: 'Ex.: R$ 500 por sessão' },
  { key: 'biggestChallenge', label: 'Qual é o maior desafio que você sente hoje para vender?', type: 'textarea', placeholder: '' },
];

// Client-friendly status vocabulary for program activities — technical
// status strings (see getProgramActivities) stay internal.
export const PROGRAM_ACTIVITY_STATUS_LABEL = {
  locked: 'Próxima etapa', not_started: 'Disponível', in_progress: 'Em andamento', submitted: 'Enviada',
  in_analysis: 'Em análise', feedback_available: 'Devolutiva disponível', completed: 'Concluída', premium_preview: 'Exclusivo Premium',
};
export const PROGRAM_ACTIVITY_STATUS_BADGE_CLASS = {
  locked: 'badge-locked', not_started: 'badge-progress', in_progress: 'badge-progress', submitted: 'badge-progress',
  in_analysis: 'badge-progress', feedback_available: 'badge-completed', completed: 'badge-completed', premium_preview: 'badge-locked',
};
// --- Teste de Arquétipos (Persea Archetype Quiz) ----------------------------
// One quiz, one scoring system, for every client regardless of gender — only
// the portrait set shown alongside the result changes (archetypeVisualSet).
// Source of truth for the 48 statements and the question→archetype scoring
// map: Nay's own workbook (Teste_de_Arquetipos_Persea.pdf) — transcribed
// verbatim below and verified against the workbook's own worked example
// (see the seeded client-1 attempt, whose 48 raw answers are that exact
// example and reproduce its published per-archetype totals exactly).
// The four interpretive fields per archetype (central_desire/potentials/
// caution/visual_direction) are NOT in that workbook — these are placeholder
// copy grounded in the standard, publicly-documented 12-brand-archetype
// framework, clearly editable in one place (below) once Nay provides her
// own refined wording. Portrait image paths start null — see
// docs/13-archetype-quiz.md for the expected asset drop-in location.
export const ARCHETYPE_QUIZ_VERSION = 1;
export const ARCHETYPE_VISUAL_SETS = ['female', 'male'];
export const ARCHETYPE_VISUAL_SET_LABEL = { female: 'Feminina', male: 'Masculina' };
export const ARCHETYPE_ATTEMPT_STATUSES = ['not_started', 'in_progress', 'completed'];
export const ARCHETYPE_ATTEMPT_STATUS_LABEL = { not_started: 'Não iniciado', in_progress: 'Em andamento', completed: 'Concluído' };
export const ARCHETYPE_ATTEMPT_STATUS_BADGE_CLASS = { not_started: 'badge-locked', in_progress: 'badge-progress', completed: 'badge-completed' };

export const ARCHETYPE_DEFS = [
  {
    slug: 'everyperson', name: 'Cara Comum', displayOrder: 1,
    centralDesire: 'Pertencer e se conectar genuinamente com as pessoas — ser vista como alguém acessível, de confiança, sem pose.',
    potentials: 'Constrói confiança rápido, gera identificação e comunica com simplicidade e humildade.',
    caution: 'Pode se diluir por medo de se destacar, ou soar genérica demais para atrair o público certo.',
    visualDirection: 'Estética próxima e natural, sem excesso de produção — roupas confortáveis, ambientes reais, linguagem simples.',
    femaleImage: '../assets/archetypes/female/everyperson.webp', maleImage: '../assets/archetypes/male/everyperson.webp',
  },
  {
    slug: 'innocent', name: 'Inocente', displayOrder: 2,
    centralDesire: 'Viver com segurança, otimismo e simplicidade, confiando que as coisas vão dar certo.',
    potentials: 'Transmite leveza, honestidade e confiança; inspira esperança em quem a segue.',
    caution: 'Pode evitar posicionamentos mais firmes por medo de parecer negativa ou conflituosa.',
    visualDirection: 'Cores claras, luz natural, composições limpas e comunicação positiva e direta.',
    femaleImage: '../assets/archetypes/female/innocent.webp', maleImage: '../assets/archetypes/male/innocent.webp',
  },
  {
    slug: 'hero', name: 'Herói', displayOrder: 3,
    centralDesire: 'Provar seu valor através de ações corajosas e superar desafios.',
    potentials: 'Inspira coragem, disciplina e superação; motiva outras pessoas a agir.',
    caution: 'Pode se cobrar demais ou parecer competitiva se não equilibrar força com empatia.',
    visualDirection: 'Composições dinâmicas, cores fortes e linguagem de conquista e movimento.',
    femaleImage: '../assets/archetypes/female/hero.webp', maleImage: '../assets/archetypes/male/hero.webp',
  },
  {
    slug: 'caregiver', name: 'Cuidador', displayOrder: 4,
    centralDesire: 'Cuidar e proteger as pessoas ao seu redor.',
    potentials: 'Gera confiança profunda, empatia genuína e senso de comunidade.',
    caution: 'Pode se esquecer de si mesma ou ter dificuldade de cobrar pelo próprio valor.',
    visualDirection: 'Tons acolhedores, ambientes próximos e comunicação calorosa e generosa.',
    femaleImage: '../assets/archetypes/female/caregiver.webp', maleImage: '../assets/archetypes/male/caregiver.webp',
  },
  {
    slug: 'explorer', name: 'Explorador', displayOrder: 5,
    centralDesire: 'Ter liberdade para descobrir o mundo e a si mesma através de novas experiências.',
    potentials: 'Inspira autenticidade, independência e coragem para sair do óbvio.',
    caution: 'Pode ter dificuldade com rotina, compromisso ou processos mais estruturados.',
    visualDirection: 'Cenários abertos, movimento, texturas naturais e comunicação sobre jornada e descoberta.',
    femaleImage: '../assets/archetypes/female/explorer.webp', maleImage: '../assets/archetypes/male/explorer.webp',
  },
  {
    slug: 'lover', name: 'Amante', displayOrder: 6,
    centralDesire: 'Criar conexões profundas, sentir e despertar paixão, prazer e beleza.',
    potentials: 'Comunica com sensibilidade, cria experiências memoráveis e constrói vínculos fortes.',
    caution: 'Pode depender demais da aprovação externa ou perder limites profissionais nas relações.',
    visualDirection: 'Estética sensorial e cuidada, cores quentes e comunicação próxima e emocional.',
    femaleImage: '../assets/archetypes/female/lover.webp', maleImage: '../assets/archetypes/male/lover.webp',
  },
  {
    slug: 'outlaw', name: 'Fora da Lei', displayOrder: 7,
    centralDesire: 'Romper regras que não fazem mais sentido e provocar mudança real.',
    potentials: 'Traz coragem para desafiar o status quo e atrai quem busca autenticidade sem filtro.',
    caution: 'Pode gerar resistência ou desconforto se a provocação não vier acompanhada de propósito claro.',
    visualDirection: 'Contrastes fortes, estética não-convencional e comunicação direta, sem rodeios.',
    femaleImage: '../assets/archetypes/female/outlaw.webp', maleImage: '../assets/archetypes/male/outlaw.webp',
  },
  {
    slug: 'creator', name: 'Criador', displayOrder: 8,
    centralDesire: 'Criar algo novo e de valor duradouro, dar forma a uma visão.',
    potentials: 'Traz originalidade, visão estética forte e capacidade de inovar.',
    caution: 'Pode buscar perfeccionismo excessivo e travar na hora de lançar ou publicar.',
    visualDirection: 'Estética autoral, composições cuidadas e comunicação sobre o processo criativo.',
    femaleImage: '../assets/archetypes/female/creator.webp', maleImage: '../assets/archetypes/male/creator.webp',
  },
  {
    slug: 'magician', name: 'Mago', displayOrder: 9,
    centralDesire: 'Compreender as leis fundamentais de como o mundo funciona e transformar realidades.',
    potentials: 'Inspira transformação, tem visão estratégica e conecta pontos que outros não veem.',
    caution: 'Pode prometer transformações grandes demais ou parecer distante da realidade prática.',
    visualDirection: 'Estética com profundidade, elementos simbólicos e comunicação sobre transformação e visão.',
    femaleImage: '../assets/archetypes/female/magician.webp', maleImage: '../assets/archetypes/male/magician.webp',
  },
  {
    slug: 'ruler', name: 'Governante', displayOrder: 10,
    centralDesire: 'Criar ordem, prosperidade e liderar com responsabilidade.',
    potentials: 'Transmite autoridade natural, visão estratégica e capacidade de organizar e liderar.',
    caution: 'Pode parecer controladora ou distante se não equilibrar autoridade com acessibilidade.',
    visualDirection: 'Estética sofisticada, composições estruturadas e comunicação de autoridade e clareza.',
    femaleImage: '../assets/archetypes/female/ruler.webp', maleImage: '../assets/archetypes/male/ruler.webp',
  },
  {
    slug: 'sage', name: 'Sábio', displayOrder: 11,
    centralDesire: 'Buscar a verdade através do conhecimento e ajudar outras pessoas a entenderem o mundo.',
    potentials: 'Transmite clareza, profundidade analítica e credibilidade através do conteúdo.',
    caution: 'Pode se perder em excesso de informação ou parecer distante e teórica demais.',
    visualDirection: 'Estética limpa e intelectual, comunicação baseada em dados, clareza e ensino.',
    femaleImage: '../assets/archetypes/female/sage.webp', maleImage: '../assets/archetypes/male/sage.webp',
  },
  {
    slug: 'jester', name: 'Bobo', displayOrder: 12,
    centralDesire: 'Viver o momento presente com alegria e leveza, sem se levar tão a sério.',
    potentials: 'Cria conexão através do humor e torna mensagens difíceis mais leves e acessíveis.',
    caution: 'Pode ser vista como pouco séria em contextos que exigem mais formalidade.',
    visualDirection: 'Cores vibrantes, composições espontâneas e comunicação leve e bem-humorada.',
    femaleImage: '../assets/archetypes/female/jester.webp', maleImage: '../assets/archetypes/male/jester.webp',
  },
];
export const ARCHETYPE_LABEL_BY_SLUG = Object.fromEntries(ARCHETYPE_DEFS.map((a) => [a.slug, a.name]));

// question_number -> archetype slug, transcribed exactly from the workbook's
// scoring table (page 4). Every one of the 48 questions maps to exactly one
// archetype, and every archetype gets exactly 4 questions — verified in the
// dynamic-import smoke test, not just asserted here.
export const ARCHETYPE_QUESTION_MAP = {
  everyperson: [7, 9, 29, 48],
  innocent: [1, 13, 20, 39],
  hero: [2, 8, 32, 47],
  caregiver: [3, 10, 30, 46],
  explorer: [4, 5, 11, 21],
  lover: [6, 12, 14, 15],
  outlaw: [16, 17, 33, 45],
  creator: [18, 31, 34, 44],
  magician: [22, 23, 40, 43],
  ruler: [24, 25, 41, 42],
  sage: [19, 26, 35, 38],
  jester: [27, 28, 36, 37],
};
// Reverse lookup, question_number -> archetype slug — built once here so
// the scoring engine never has to search ARCHETYPE_QUESTION_MAP per answer.
export const ARCHETYPE_BY_QUESTION = Object.fromEntries(
  Object.entries(ARCHETYPE_QUESTION_MAP).flatMap(([slug, qs]) => qs.map((q) => [q, slug])),
);

// The 48 statements, verbatim from the workbook (Teste_de_Arquetipos_Persea.pdf,
// pages 2-3), in their original numbered order — never reordered or grouped
// by archetype, so the sequence itself never reveals the scoring map (per
// the "do not reveal which statement belongs to which archetype" rule).
export const ARCHETYPE_QUIZ_QUESTIONS = [
  { number: 1, text: 'O mundo é um lugar seguro.' },
  { number: 2, text: 'Tento sempre superar meus próprios limites.' },
  { number: 3, text: 'Ponho as necessidades dos outros na frente das minhas.' },
  { number: 4, text: 'Estou procurando melhorar a minha vida.' },
  { number: 5, text: 'Procuro sempre me aperfeiçoar.' },
  { number: 6, text: 'Gosto da sensualidade.' },
  { number: 7, text: 'Sinto-me mais à vontade em minha própria casa.' },
  { number: 8, text: 'Estou disposto(a) a correr riscos pessoais para defender as ideias nas quais acredito.' },
  { number: 9, text: 'Converso de modo coloquial e não gosto de elitismo.' },
  { number: 10, text: 'Gosto mais de dar que de receber.' },
  { number: 11, text: 'Sinto certa inquietação.' },
  { number: 12, text: 'Vivo a vida plenamente.' },
  { number: 13, text: 'Acredito que as pessoas não querem realmente magoar as outras.' },
  { number: 14, text: 'Concordo com a seguinte afirmação: "É melhor ter amado e perdido o objeto desse amor do que nunca ter amado".' },
  { number: 15, text: 'Encontro satisfação nos meus relacionamentos.' },
  { number: 16, text: 'Amo a liberdade.' },
  { number: 17, text: 'Se não estou de acordo, não entro em conformidade.' },
  { number: 18, text: 'Nunca estou satisfeito(a) totalmente.' },
  { number: 19, text: 'Eu me esforço por ser objetivo(a).' },
  { number: 20, text: 'Quando conheço uma pessoa, acredito que ela seja digna de confiança.' },
  { number: 21, text: 'A manutenção da minha independência é fundamental para mim.' },
  { number: 22, text: 'A ajuda espiritual é responsável pela minha eficiência.' },
  { number: 23, text: 'A modificação de meus pensamentos altera a minha vida.' },
  { number: 24, text: 'Tenho capacidade de liderança.' },
  { number: 25, text: 'As pessoas me procuram em busca de orientação.' },
  { number: 26, text: 'Mantenho um senso de perspectiva, procurando ter uma visão de longo alcance.' },
  { number: 27, text: 'Os outros me acham divertido(a).' },
  { number: 28, text: 'Gosto de fazer as pessoas rirem.' },
  { number: 29, text: 'Gosto de momentos simples e familiares.' },
  { number: 30, text: 'Acho mais fácil fazer as coisas para os outros do que para mim mesmo(a).' },
  { number: 31, text: 'Estou empenhado(a) no processo de criar a minha própria vida.' },
  { number: 32, text: 'Deixo o medo de lado e faço o que precisa ser feito.' },
  { number: 33, text: 'Eu choco os outros.' },
  { number: 34, text: 'A inspiração vem facilmente para mim.' },
  { number: 35, text: 'Acredito que uma mesma coisa pode ser considerada a partir de diferentes ângulos.' },
  { number: 36, text: 'Não levo as regras muito a sério.' },
  { number: 37, text: 'Um pouco de bagunça é bom para a alma.' },
  { number: 38, text: 'Acredito na capacidade humana para aprender e crescer.' },
  { number: 39, text: 'Posso contar com outras pessoas para cuidarem de mim.' },
  { number: 40, text: 'Minha presença muitas vezes atua como um catalisador para a realização de mudanças.' },
  { number: 41, text: 'Prefiro estar no comando das situações.' },
  { number: 42, text: 'Sou grandioso(a).' },
  { number: 43, text: 'Acredito que todas as pessoas e todas as coisas do mundo estão interligadas.' },
  { number: 44, text: 'A criatividade é um dos meus maiores dons.' },
  { number: 45, text: 'Eu sigo minhas próprias leis.' },
  { number: 46, text: 'Tenho prazer em cuidar das outras pessoas.' },
  { number: 47, text: 'Tenho disciplina para alcançar as minhas metas.' },
  { number: 48, text: 'A palavra "verdadeiro" é uma das que melhor me define.' },
];
// Six sections of 8 statements each, in the original numeric order — see
// ARCHETYPE_QUIZ_QUESTIONS' header comment for why the order itself is
// never touched.
export const ARCHETYPE_QUIZ_SECTIONS = Array.from({ length: 6 }, (_, i) => ({
  index: i + 1,
  questions: ARCHETYPE_QUIZ_QUESTIONS.slice(i * 8, i * 8 + 8),
}));
export const ARCHETYPE_SCALE_LABELS = {
  1: 'Pouco verdadeiro para mim', 2: 'Raramente verdadeiro', 3: 'Parcialmente verdadeiro',
  4: 'Bastante verdadeiro', 5: 'Muito verdadeiro para mim',
};

export const IMAGE_STATUSES = ['aguardando_envio', 'envio_iniciado', 'enviado', 'em_analise', 'novas_solicitadas', 'aprovado'];
export const IMAGE_STATUS_LABEL = {
  aguardando_envio: 'Aguardando envio', envio_iniciado: 'Envio iniciado', enviado: 'Enviado', em_analise: 'Em análise',
  novas_solicitadas: 'Novas imagens solicitadas', aprovado: 'Aprovado',
};
export const UPGRADE_INTEREST_STATUSES = ['novo', 'em_conversa', 'convertido', 'nao_seguira'];
export const UPGRADE_INTEREST_STATUS_LABEL = { novo: 'Novo', em_conversa: 'Em conversa', convertido: 'Convertido', nao_seguira: 'Não seguirá' };

// Client onboarding — precedes Phase 1, per docs/PERSEA_METHODOLOGY.md §2.
// Conceptual contract-status vocabulary (§2.2), not final — see that doc for
// the full workflow this drives (client info -> contract -> signature ->
// WhatsApp milestone -> resources unlock -> Phase 1).
export const ONBOARDING_STAGES = [
  'info_pending', 'info_received', 'contract_prepared',
  'sent_for_signature', 'awaiting_signature', 'signed', 'completed',
];
export const ONBOARDING_STAGE_LABEL = {
  info_pending: 'Informações Pendentes',
  info_received: 'Informações Recebidas',
  contract_prepared: 'Contrato Preparado',
  sent_for_signature: 'Enviado para Assinatura',
  awaiting_signature: 'Aguardando Assinatura',
  signed: 'Assinado',
  completed: 'Contrato Concluído',
};

// Contract template selection — two independent axes confirmed from real
// PERSEA contracts (docs/PERSEA_METHODOLOGY.md §2.2): duration/tier here,
// party type (PF/PJ) captured per-client below. Values are tenant pricing,
// not client data — persea/config/tenant.json territory in the real build.
export const CONTRACT_DURATIONS = ['semestral', 'anual'];
export const CONTRACT_DURATION_LABEL = { semestral: 'Semestral', anual: 'Anual' };
export const CONTRACT_DURATION_VALUE = { semestral: 18000, anual: 32000 };

// One real product line (Persea) — Ascensão de Imagem removed (Production
// Audit Remediation Pass, High 8; business decision — no longer part of
// the system). Fixed list, not tenant-configurable, per this pass's scope.
export const PROGRAMS = ['persea'];
export const PROGRAM_LABEL = { persea: 'Persea' };

export const PAYMENT_STATUSES = ['paid', 'pending', 'overdue'];
export const PAYMENT_STATUS_LABEL = { paid: 'Pago', pending: 'Pendente', overdue: 'Em Atraso' };

// How the client is actually paying — captured at closing, drives the
// generated installment schedule below.
export const PAYMENT_METHODS = ['cartao_credito', 'boleto', 'pix', 'transferencia'];
export const PAYMENT_METHOD_LABEL = { cartao_credito: 'Cartão de Crédito', boleto: 'Boleto', pix: 'Pix', transferencia: 'Transferência' };

export const EXPENSE_CATEGORIES = ['ferramentas', 'marketing', 'equipe', 'outros'];
export const EXPENSE_CATEGORY_LABEL = { ferramentas: 'Ferramentas', marketing: 'Marketing', equipe: 'Equipe', outros: 'Outros' };

// Nota Fiscal — client requests one per payment; assistant/Nay issue it.
// Lives on the payment record itself (payment.nf), not a separate table,
// same "one source of truth per fact" convention as everything else here.
export const NF_STATUSES = ['not_requested', 'requested', 'issued'];
export const NF_STATUS_LABEL = { not_requested: 'Não solicitada', requested: 'Solicitada', issued: 'Emitida' };

// SumUp payment links — assistant sends one per unpaid installment once Nay
// has approved the payment plan; the client pays externally, the assistant
// reports it back, and Nay confirms receipt (via the existing markPaymentPaid)
// before it counts toward the financial projections. Deliberately two steps
// (report -> confirm), not one, per Nay's explicit "always on the same page"
// requirement — a payment can't silently become "paid" without her sign-off.
export const HUBLA_STATUSES = ['not_granted', 'granted'];
export const HUBLA_STATUS_LABEL = { not_granted: 'Sem acesso', granted: 'Acesso liberado' };

// The four recurring image-guide deliverables the assistant prepares for
// every client, plus the Digital Kit — both go through the same Nay-review
// gate (see pendingReviews below) before landing on the client's Imagens page.
export const IMAGE_GUIDE_SLUGS = ['paleta_cores', 'estilo', 'moodboard_ensaio', 'guia_looks_mensal'];
export const IMAGE_GUIDE_LABEL = {
  paleta_cores: 'Paleta de Cores', estilo: 'Guia de Estilo', moodboard_ensaio: 'Mood Board do Ensaio de Fotos',
  guia_looks_mensal: 'Guia de Looks do Mês',
};
export const GUIDE_STATUSES = ['not_started', 'in_review', 'delivered'];
export const GUIDE_STATUS_LABEL = { not_started: 'Não iniciado', in_review: 'Em revisão com a Nay', delivered: 'Entregue' };
export const DIGITAL_KIT_STATUS_LABEL = GUIDE_STATUS_LABEL;

// --- Template Library — Nay-curated source templates (Canva links, etc.)
// the assistant works from when building each client's actual deliverable.
// Not the same thing as IMAGE_GUIDE_SLUGS above: those are the per-client
// *delivered* guides; this is the shared starting-point material behind
// them, one config both admin/templates.js (editable) and
// assistant/templates.js (read-only) render from, so the two views can
// never drift — same "single source of truth" rule as everywhere else here.
// The standard 12-tone seasonal color analysis — each season's 3 sub-types
// are their own named variants (not one shared Escuro/Frio/Brilhante set
// reused across all four): a sub-type name like "Brilhante" or "Quente"
// shows up under two neighboring seasons, never all four.
export const COLOR_SEASONS = ['primavera', 'verao', 'outono', 'inverno'];
export const COLOR_SEASON_LABEL = { primavera: 'Primavera', verao: 'Verão', outono: 'Outono', inverno: 'Inverno' };
export const COLOR_SEASON_VARIANTS = {
  primavera: ['brilhante', 'quente', 'clara'],
  verao: ['claro', 'frio', 'suave'],
  outono: ['suave', 'quente', 'escuro'],
  inverno: ['brilhante', 'frio', 'escuro'],
};
export const COLOR_VARIANT_LABEL = {
  brilhante: 'Brilhante', quente: 'Quente', clara: 'Clara', claro: 'Claro', frio: 'Frio', suave: 'Suave', escuro: 'Escuro',
};

export const TEMPLATE_CATEGORIES = [
  {
    key: 'cartelaCores', label: 'Cartela de Cores',
    description: 'Um modelo por subtipo de estação (análise sazonal de 12 tons) — 12 no total.',
    groups: COLOR_SEASONS.map((season) => ({
      groupLabel: COLOR_SEASON_LABEL[season],
      items: COLOR_SEASON_VARIANTS[season].map((variant) => ({ itemKey: `${season}_${variant}`, itemLabel: COLOR_VARIANT_LABEL[variant] })),
    })),
  },
  {
    key: 'guiaProducoes', label: 'Guia de Produções',
    description: 'Um modelo completo e um modelo mensal — o mensal também pode ser enviado direto para a cliente.',
    groups: [{ groupLabel: null, items: [
      { itemKey: 'completo', itemLabel: 'Guia Completo' },
      { itemKey: 'mensal', itemLabel: 'Guia Mensal' },
    ] }],
  },
  // These three are each a single link — grouped together on one row in
  // both templates.js pages instead of three near-empty cards stacked on
  // top of each other (see `single: true`, checked by the renderers).
  {
    key: 'kitDigital', label: 'Kit Digital', single: true,
    description: 'Modelo único usado para montar o Kit Digital de cada cliente.',
    groups: [{ groupLabel: null, items: [{ itemKey: 'padrao', itemLabel: 'Modelo' }] }],
  },
  {
    key: 'planejamentoImagem', label: 'Planejamento de Imagem', single: true,
    description: 'Modelo único.',
    groups: [{ groupLabel: null, items: [{ itemKey: 'padrao', itemLabel: 'Modelo' }] }],
  },
  {
    key: 'ferramentasNovaImagem', label: 'Ferramentas para Nova Imagem', single: true,
    description: 'Modelo único.',
    groups: [{ groupLabel: null, items: [{ itemKey: 'padrao', itemLabel: 'Modelo' }] }],
  },
];

// Generic "send this to the client only after Nay reviews it" queue — used
// today by image guides and the Digital Kit, built generically (type/refSlug)
// so future assistant-authored deliverables can reuse it without a new table.
export const CONTENT_REVIEW_STATUSES = ['pending', 'approved', 'changes_requested'];
export const CONTENT_REVIEW_STATUS_LABEL = { pending: 'Aguardando revisão da Nay', approved: 'Aprovado', changes_requested: 'Ajustes solicitados' };

export const WHATSAPP_STATUSES = ['not_added', 'pending', 'added'];
export const WHATSAPP_STATUS_LABEL = {
  not_added: 'Não Adicionada',
  pending: 'Pendente',
  added: 'Adicionada',
};

// Weekly agenda — Nay's operational calendar. Tenant-level (not per-client):
// group meetings, classes, and admin tasks aren't tied to a single student.
// Extends, rather than replaces, the existing per-client `journey.upcomingMeeting`
// field (kept in sync by hand in seed data for this pass — see the note above
// `getAgendaItems()` for why a full merge is left to a later pass).
// 'checkpoint' is the Premium-only 30min check-in — distinct from an
// individual_meeting so it never gets swept into the E1-E8 encounter count
// (see getEncounterJourney, which only ever looks at individual_meeting)
// while still being a real scheduled thing Nay and the client can both see
// and tally against the 12-checkpoint allowance (see getMeetingsUsage).
export const AGENDA_TYPES = ['class', 'individual_meeting', 'checkpoint', 'group_meeting', 'online_event', 'admin_task', 'deadline', 'photo_review'];
export const AGENDA_TYPE_LABEL = {
  class: 'Aula',
  individual_meeting: 'Reunião Individual',
  checkpoint: 'Check-in (30min)',
  group_meeting: 'Reunião em Grupo',
  online_event: 'Evento Online',
  admin_task: 'Tarefa Administrativa',
  deadline: 'Prazo / Follow-up',
  photo_review: 'Revisão de Fotos',
};
// Encontro allowances per the Nova Persea methodology — Essencial gets the
// first 4 encontros (E1-E4) and no checkpoints; Premium gets all 8 encontros
// plus 12 ad-hoc checkpoints. Group encontros are unlimited for both, so
// they're tallied (see getMeetingsUsage) but never capped against a total.
export const CHECKPOINT_ALLOWANCE = 12;
export const AGENDA_STATUSES = ['upcoming', 'completed', 'rescheduled', 'cancelled'];
export const AGENDA_STATUS_LABEL = {
  upcoming: 'Agendado',
  completed: 'Concluído',
  rescheduled: 'Remarcado',
  cancelled: 'Cancelado',
};

// --- Meeting recordings & transcripts (Google Meet/Drive/Docs prototype) ---
// PROTOTYPE ONLY — no real Google or Supabase integration exists yet (see
// docs/google-meet-integration.md for where that will eventually connect).
// Lives on the individual_meeting agendaItem itself (`recording: {...}`),
// not a separate table — a recording only ever belongs to the one meeting
// that produced it, same "one source of truth, keyed by the thing it
// describes" rule as everything else in this file.
//
// Shape (documented here since this file has no build step / TS checker):
// @typedef {Object} MeetingRecording
// @property {'aguardando'|'processando'|'disponivel'|'sem_gravacao'|'erro'} recordingStatus
// @property {'aguardando'|'disponivel'|'nao_aplicavel'|'erro'} transcriptStatus
// @property {string|null} recordingUrl
// @property {string|null} transcriptUrl
// @property {boolean} requiresAttention
// @property {string} attentionNote
// @property {{lastCheckedAt:string|null, nextCheckAt:string|null, googleAccount:string|null, syncStatus:string, attempts:number}} sync
export const RECORDING_STATUSES = ['aguardando', 'processando', 'disponivel', 'sem_gravacao', 'erro'];
export const RECORDING_STATUS_LABEL = {
  aguardando: 'Aguardando gravação',
  processando: 'Gravação sendo processada',
  disponivel: 'Gravação disponível',
  sem_gravacao: 'Sem gravação',
  erro: 'Requer atenção',
};
export const RECORDING_STATUS_BADGE_CLASS = {
  aguardando: 'badge-locked', processando: 'badge-progress', disponivel: 'badge-completed',
  sem_gravacao: 'badge-locked', erro: 'badge-locked',
};
export const TRANSCRIPT_STATUSES = ['aguardando', 'disponivel', 'nao_aplicavel', 'erro'];
export const TRANSCRIPT_STATUS_LABEL = {
  aguardando: 'Transcrição pendente',
  disponivel: 'Transcrição disponível',
  nao_aplicavel: 'Não aplicável',
  erro: 'Requer atenção',
};
export const TRANSCRIPT_STATUS_BADGE_CLASS = {
  aguardando: 'badge-progress', disponivel: 'badge-completed', nao_aplicavel: 'badge-locked', erro: 'badge-locked',
};
// The meeting's own lifecycle (separate from recording/transcript) —
// derived from the existing agendaItem status/date, never stored twice.
export const MEETING_LIFECYCLE_LABEL = { agendada: 'Agendada', em_andamento: 'Em andamento', finalizada: 'Finalizada' };
export const MEETING_LIFECYCLE_BADGE_CLASS = { agendada: 'badge-progress', em_andamento: 'badge-progress', finalizada: 'badge-completed' };

// Ju and Nath are the same person (Nay's assistant) presented under two
// names depending on the hat she's wearing for that task — administrative
// (Ju) vs. image/photo review (Nath). Not two accounts/roles: one
// "assistant" assignee (see agendaItems.assignedTo), with `assistantPersona`
// purely a display label so both Nay and the assistant herself can tell at
// a glance which context a task belongs to.
export const ASSISTANT_PERSONAS = ['ju', 'nath'];
export const ASSISTANT_PERSONA_LABEL = { ju: 'Ju', nath: 'Nath' };
export const ASSIGNEE_LABEL = { nay: 'Nay', assistant: 'Assistente' };

// --- Leads / pipeline (pre-client) — most leads come from the "VIP" WhatsApp
// group Nay runs, where she posts dynamics (classes, Q&As, challenges) to
// keep engagement flowing. Converting a lead creates a real client record
// (see convertLeadToClient) so the pipeline hands off directly into the
// same onboarding flow used everywhere else in this app.
export const LEAD_STAGES = ['novo', 'engajado', 'em_conversa', 'proposta_enviada', 'convertido', 'perdido'];
export const LEAD_STAGE_LABEL = {
  novo: 'Novo',
  engajado: 'Engajado no Grupo',
  em_conversa: 'Em Conversa Direta',
  proposta_enviada: 'Proposta Enviada',
  convertido: 'Convertido em Cliente',
  perdido: 'Perdido',
};
// --- Post-sale onboarding (Nova Persea acquisition flow) — lives ON the
// lead record itself: sale -> registration -> contract -> activation, all
// before any db.clients row exists. This is deliberately a coarse status
// (bookends only) — the contract stretch in the middle reuses the *existing*
// ONBOARDING_STAGES/ONBOARDING_STAGE_LABEL vocabulary (see leadPipelineLabel
// below) instead of inventing parallel contract words, so "Aguardando
// Assinatura" etc. mean exactly one thing everywhere in the app.
export const LEAD_ONBOARDING_STATUSES = ['sale_agreed', 'registration_sent', 'registration_completed', 'in_contract', 'ready_for_activation', 'client_active'];
export const LEAD_ONBOARDING_STATUS_LABEL = {
  sale_agreed: 'Condições Registradas', registration_sent: 'Cadastro Enviado', registration_completed: 'Cadastro Recebido',
  in_contract: 'Contrato em Andamento', ready_for_activation: 'Pronta para Ativação', client_active: 'Cliente Ativa',
};
export const LEAD_ONBOARDING_STATUS_BADGE_CLASS = {
  sale_agreed: 'badge-progress', registration_sent: 'badge-progress', registration_completed: 'badge-progress',
  in_contract: 'badge-progress', ready_for_activation: 'badge-completed', client_active: 'badge-completed',
};
export const LEAD_SOURCES = ['vip_group', 'referral', 'organic', 'other'];
export const LEAD_SOURCE_LABEL = {
  vip_group: 'Grupo VIP (WhatsApp)',
  referral: 'Indicação',
  organic: 'Orgânico / Redes Sociais',
  other: 'Outro',
};
export const VIP_GROUP_STATUSES = ['not_in_group', 'in_group', 'left_group'];
export const VIP_GROUP_STATUS_LABEL = {
  not_in_group: 'Fora do Grupo',
  in_group: 'No Grupo VIP',
  left_group: 'Saiu do Grupo',
};

// Social links — shared shape for both leads and clients, so the same
// editor/display component works for either.
export const SOCIAL_PLATFORMS = ['instagram', 'tiktok', 'linkedin', 'facebook'];
export const SOCIAL_PLATFORM_LABEL = { instagram: 'Instagram', tiktok: 'TikTok', linkedin: 'LinkedIn', facebook: 'Facebook' };
export const BLANK_SOCIAL_LINKS = { instagram: '', tiktok: '', linkedin: '', facebook: '' };

// Content Center — learning tracks are a fixed taxonomy (tenant config,
// persea/methodology/ territory in the real build), not per-client data.
export const CONTENT_TRACKS = ['posicionamento', 'conteudo_autenticidade', 'comunicacao', 'vendas'];
export const CONTENT_TRACK_LABEL = {
  posicionamento: 'Posicionamento',
  conteudo_autenticidade: 'Conteúdo & Autenticidade',
  comunicacao: 'Comunicação',
  vendas: 'Vendas',
};

// Conteúdos gateway — a small, fixed set of premium "category" cards that
// send clients to Hubla (real lessons/progress/completion all stay there;
// see docs note above resources/CONTENT_TRACKS). Deliberately a different,
// coarser concept than resources/CONTENT_TRACKS above: this is the visual
// front door, not the lesson library — Nay manages it separately from the
// per-lesson Content Center. coverImage points at the real capa photos
// bundled in shared/assets/content/; coverTone is only a fallback gradient
// (see ui.js) for a category that ends up without a photo.
export const CONTENT_CATEGORY_TONES = 4;

const SEED = {
  tenant: {
    name: 'PERSEA',
    brandColor: '#b8863a',
    // The primary "see everything" CTA on the Conteúdos gateway — a real
    // Hubla member-area/product URL, editable by Nay in "Gerenciar conteúdos".
    hublaAllContentUrl: 'https://pay.hubla.com.br/PLACEHOLDER-todos-os-conteudos',
    // Guia de Atividades — a single tenant-level PDF (how to prepare/take
    // the initial photos), versioned so clients can tell when it changed.
    // Bundled as a local asset (see shared/assets/guia-atividades.pdf), same
    // pattern as the content-category cover photos. `pages` are the same
    // guide pre-rasterized one image per page (shared/assets/
    // guia-atividades-pages/) so the client page can render it as an actual
    // page-turning book instead of a flat PDF embed — see activity-guide.js.
    activityGuide: {
      pdfUrl: '../shared/assets/guia-atividades.pdf', version: 1, publishedAt: '2026-08-18T14:23:00',
      pages: Array.from({ length: 13 }, (_, i) => `../shared/assets/guia-atividades-pages/page-${String(i + 1).padStart(2, '0')}.jpg`),
    },
    // Google Meet/Drive/Docs sync — prototype only, see "Sincronização com
    // Google" (admin-only). Nothing here is real; it exists purely so Nay
    // can see what the future automation's own status panel will look
    // like. Tenant-level (one Google account, not per-client/per-meeting).
    googleSync: {
      connectedAccount: 'nay@persea.com.br',
      syncStatus: 'ativo', // 'ativo' | 'pausado' | 'erro'
      lastCheckedAt: '2026-08-18T08:00:00',
      nextCheckAt: '2026-08-18T20:00:00',
      attempts: 128,
    },
  },
  // Template Library — see TEMPLATE_CATEGORIES above for the shape this
  // must match (one entry per itemKey, nested under its category key).
  // Seeded with placeholder Canva links, same "PLACEHOLDER" convention as
  // tenant.hublaAllContentUrl above, so the admin page opens already
  // populated rather than as 17 blank inputs — Nay swaps in the real ones.
  templateLibrary: {
    cartelaCores: {
      primavera_brilhante: 'https://www.canva.com/design/PLACEHOLDER-cartela-primavera-brilhante/view',
      primavera_quente: 'https://www.canva.com/design/PLACEHOLDER-cartela-primavera-quente/view',
      primavera_clara: 'https://www.canva.com/design/PLACEHOLDER-cartela-primavera-clara/view',
      verao_claro: 'https://www.canva.com/design/PLACEHOLDER-cartela-verao-claro/view',
      verao_frio: 'https://www.canva.com/design/PLACEHOLDER-cartela-verao-frio/view',
      verao_suave: 'https://www.canva.com/design/PLACEHOLDER-cartela-verao-suave/view',
      outono_suave: 'https://www.canva.com/design/PLACEHOLDER-cartela-outono-suave/view',
      outono_quente: 'https://www.canva.com/design/PLACEHOLDER-cartela-outono-quente/view',
      outono_escuro: 'https://www.canva.com/design/PLACEHOLDER-cartela-outono-escuro/view',
      inverno_brilhante: 'https://www.canva.com/design/PLACEHOLDER-cartela-inverno-brilhante/view',
      inverno_frio: 'https://www.canva.com/design/PLACEHOLDER-cartela-inverno-frio/view',
      inverno_escuro: 'https://www.canva.com/design/PLACEHOLDER-cartela-inverno-escuro/view',
    },
    guiaProducoes: {
      completo: 'https://www.canva.com/design/PLACEHOLDER-guia-producoes-completo/view',
      mensal: 'https://www.canva.com/design/PLACEHOLDER-guia-producoes-mensal/view',
    },
    kitDigital: { padrao: 'https://www.canva.com/design/PLACEHOLDER-kit-digital/view' },
    planejamentoImagem: { padrao: 'https://www.canva.com/design/PLACEHOLDER-planejamento-imagem/view' },
    ferramentasNovaImagem: { padrao: 'https://www.canva.com/design/PLACEHOLDER-ferramentas-nova-imagem/view' },
  },
  // Conteúdos gateway cards (see CONTENT_CATEGORY_TONES note above).
  contentCategories: [
    {
      id: 'cc1', title: 'Marca Pessoal', description: 'Como construir uma marca pessoal autêntica e consistente.',
      coverImage: '../shared/assets/content/marca-pessoal.jpg', coverTone: 0, hublaUrl: 'https://pay.hubla.com.br/PLACEHOLDER-marca-pessoal',
      displayOrder: 1, isVisible: true,
    },
    {
      id: 'cc2', title: 'Oratória', description: 'Técnicas para falar em público com confiança e clareza.',
      coverImage: '../shared/assets/content/oratoria.jpg', coverTone: 1, hublaUrl: 'https://pay.hubla.com.br/PLACEHOLDER-oratoria',
      displayOrder: 2, isVisible: true,
    },
    {
      id: 'cc3', title: 'Imagem Pessoal', description: 'Estilo, styling e comunicação não-verbal alinhados à sua marca.',
      coverImage: '../shared/assets/content/imagem-pessoal.jpg', coverTone: 2, hublaUrl: 'https://pay.hubla.com.br/PLACEHOLDER-imagem-pessoal',
      displayOrder: 3, isVisible: true,
    },
    {
      id: 'cc4', title: 'Presença e Postura', description: 'Presença de palco, postura corporal e linguagem corporal.',
      coverImage: '../shared/assets/content/presenca-postura.jpg', coverTone: 3, hublaUrl: 'https://pay.hubla.com.br/PLACEHOLDER-presenca-postura',
      displayOrder: 4, isVisible: true,
    },
  ],
  // Leitura Estratégica de Valor — the premium business/sales/pricing
  // assessment. Keyed by clientId, only ever populated for premium clients
  // (see getValueAssessment's tier gate — that gate is the real enforcement
  // point in this architecture, not any UI hiding). Seeded for two of the
  // three premium clients to demo both an in-progress and a submitted state
  // without needing the dev preview switcher; the third premium client
  // (still onboarding) and all essential clients intentionally have no
  // record — their state is derived (upcoming / locked_plan).
  businessValueAssessments: {
    'client-1': {
      id: 'bva1', clientId: 'client-1', status: 'in_progress', questionnaireVersion: 1,
      startedAt: '2026-08-10T09:00:00', submittedAt: null, analysisStartedAt: null, publishedAt: null,
      updatedAt: '2026-08-12T11:00:00',
      answers: {
        ...blankAssessmentAnswers(),
        s1: {
          profession: 'Consultora de Comunicação e Marca Pessoal', specialty: 'Posicionamento para especialistas visíveis',
          region: 'Belo Horizonte, MG (atende todo o Brasil online)', serviceMode: 'Híbrido', businessModel: 'Serviços individuais', businessModelOther: '',
          primaryOfferName: 'Mentoria de Posicionamento Individual', primaryOfferDescription: 'Mentoria 1:1 de 3 meses para especialistas que querem se tornar referência.',
          targetAudience: 'Consultoras e terapeutas entre 30-45 anos, já com clientes, mas sem posicionamento claro.',
          salesChannels: ['Indicações', 'Instagram', 'WhatsApp'], salesChannelsOther: '',
          mainProblem: 'Sinto que cobro pouco pelo tempo que dedico e não sei se meu preço está alinhado ao mercado.',
          desiredOutcome: 'Ter clareza se posso aumentar o preço e como estruturar isso sem perder clientes.',
        },
        offers: [{
          ...blankOffer(), id: 'off-marina-1', name: 'Mentoria de Posicionamento Individual (3 meses)', currentPrice: 4800,
          deliveryType: 'Online', deliveryMinutes: 90, deliveryUnit: 'sessao', requiresPostWork: 'Sim', postWorkHours: 1,
          avgMonthlySales: 4, hasCapacityLimit: 'Sim', capacityLimit: 6,
          paymentMethod: 'Parcelado', installments: 3, offersDiscount: 'Só à vista, 5%.', directCostPerSale: 120,
          priceAssessment: 'Um pouco baixo', priceLastChangedAt: 'Há cerca de 8 meses', priceChangeReason: 'Reajuste simples de inflação.',
        }],
      },
      reviewStatus: {}, internalNotes: {}, scenarios: [], recommendation: null, publishedDeliverable: null,
    },
    'client-3': {
      id: 'bva3', clientId: 'client-3', status: 'published', questionnaireVersion: 1,
      startedAt: '2026-08-01T10:00:00', submittedAt: '2026-08-15T16:40:00', analysisStartedAt: '2026-08-16T09:00:00', publishedAt: '2026-08-20T10:00:00',
      updatedAt: '2026-08-20T10:00:00',
      answers: {
        s1: {
          profession: 'Estrategista de Marca e Consultora de Negócios', specialty: 'Estratégia comercial para pequenos negócios de serviço',
          region: 'São Paulo, SP (atende online)', serviceMode: 'Online', businessModel: 'Combinação de modelos', businessModelOther: '',
          primaryOfferName: 'Consultoria de Estratégia Comercial', primaryOfferDescription: 'Projeto de 6 semanas para reestruturar oferta e precificação.',
          targetAudience: 'Donas de pequenos negócios de serviço faturando entre R$10 mil e R$30 mil/mês.',
          salesChannels: ['Indicações', 'Instagram', 'Anúncios'], salesChannelsOther: '',
          mainProblem: 'Não sei se meu preço cobre meus custos reais — nunca calculei isso com precisão.',
          desiredOutcome: 'Sair com um preço que eu confie para negociar sem insegurança.',
        },
        offers: [
          {
            ...blankOffer(), id: 'off-renata-1', name: 'Consultoria de Estratégia Comercial (projeto 6 semanas)', currentPrice: 6500,
            deliveryType: 'Online', deliveryMinutes: 120, deliveryUnit: 'sessao', requiresPostWork: 'Sim', postWorkHours: 3,
            avgMonthlySales: 3, hasCapacityLimit: 'Sim', capacityLimit: 4,
            paymentMethod: 'Entrada + saldo', installments: 2, offersDiscount: 'Não', paysCommission: 'Não',
            directCostPerSale: 200, priceAssessment: 'Não sei avaliar', priceLastChangedAt: 'Nunca alterado', priceChangeReason: '',
          },
          {
            ...blankOffer(), id: 'off-renata-2', name: 'Diagnóstico Express (sessão única)', currentPrice: 900,
            deliveryType: 'Online', deliveryMinutes: 60, deliveryUnit: 'sessao', requiresPostWork: 'Não', postWorkHours: null,
            avgMonthlySales: 5, hasCapacityLimit: 'Não', capacityLimit: null,
            paymentMethod: 'À vista', installments: null, offersDiscount: 'Não', paysCommission: 'Não',
            directCostPerSale: 30, priceAssessment: 'Um pouco baixo', priceLastChangedAt: 'Há 1 ano', priceChangeReason: 'Nunca revisado.',
          },
        ],
        s2: { monthlyRevenue: 22000, monthlyRevenuePrecision: 'Aproximado', monthlyClients: 8, capacityUtilization: 'Entre 76% e 90%' },
        fixedCosts: [
          { ...blankFixedCost('Softwares e plataformas'), id: 'fc-r1', description: 'CRM, agenda online e e-mail marketing', monthlyAmount: 280, isEstimate: false },
          { ...blankFixedCost('Contabilidade'), id: 'fc-r2', description: 'Contador mensal', monthlyAmount: 350, isEstimate: false },
          { ...blankFixedCost('Marketing e anúncios'), id: 'fc-r3', description: 'Anúncios Instagram/Google', monthlyAmount: 900, isEstimate: true },
          { ...blankFixedCost('Equipe, assistentes e prestadores recorrentes'), id: 'fc-r4', description: 'Assistente virtual (10h/semana)', monthlyAmount: 1200, isEstimate: false },
        ],
        variableCosts: [
          { ...blankVariableCost('Impostos'), id: 'vc-r1', description: 'Simples Nacional', calculationType: 'percentage', percentage: 6, isEstimate: false },
          { ...blankVariableCost('Taxas de cartão'), id: 'vc-r2', description: 'Taxa de parcelamento', calculationType: 'percentage', percentage: 3.5, isEstimate: true },
        ],
        s3: { separatesFinances: 'Sim', tracksMonthly: 'Às vezes', variableCostNotes: 'Anúncios variam bastante mês a mês.', seasonalNotes: 'Dezembro e janeiro sempre mais fracos.' },
        s4: {
          desiredWeeklyHours: 30, adminHours: 6, salesHours: 5, marketingHours: 5, planningHours: 3,
          deliveryHoursAvailable: null, workDaysPerWeek: 5, workloadPreference: 'Sim',
          deliverableVolumeCapacity: 6, maxVolumeAchieved: 8, wasSustainable: 'Não', capacityLimiters: ['Tempo', 'Processo comercial'], capacityLimitersOther: '',
          demandDoubleScenario: 'Eu não conseguiria atender com a qualidade que tenho hoje.',
          capacityIncreaseIdeas: 'Contratar uma segunda assistente para tirar tarefas administrativas de mim.',
        },
        s5: {
          desiredMonthlyRevenue: 30000, desiredRevenueTimeframe: '6 meses', desiredProLabore: 12000, minPersonalExpenses: 8000,
          reserveEmergency: 1000, reserveReinvestment: 1500, reserveGrowth: 1000, reserveVacation: 500, reserveOther: null,
          businessDebt: 'Não', expansionGoal: 'Quero contratar uma segunda assistente em até 6 meses.',
          safetyMargin: '15', canCoverCostsToday: 'Parcialmente', currentPriority: 'Aumentar margem',
        },
        s6: {
          experienceLevel: 'Experiente', yearsInField: '7 anos', qualifications: 'MBA em Gestão, 7 anos de mercado, cases publicados.',
          differentiator: 'Combino estratégia comercial com posicionamento de marca — a maioria só faz um dos dois.',
          whyBestClientsChoose: 'Porque entrego um plano prático, não só teoria.', transformationDelivered: 'Sair de "não sei cobrar" para uma oferta estruturada com preço defensável.',
          extrasIncluded: 'Modelo de proposta comercial pronto e 30 dias de suporte por WhatsApp.',
          commonObjections: '"Está caro" e "preciso pensar".', priceQuestioned: 'Às vezes', lossReason: 'Achar que consegue resolver sozinha.',
          referencesIntro: 'Duas outras consultorias de estratégia comercial que atuam com o mesmo público.', knowsReferencePrices: 'Em parte',
          references: [
            { ...blankReference(), id: 'ref-r1', name: 'Consultoria concorrente A', product: 'Projeto similar de 6 semanas', knownPrice: 'R$ 5.000 a R$ 7.000', source: 'Site público' },
            { ...blankReference(), id: 'ref-r2', name: 'Consultoria concorrente B', product: 'Mentoria em grupo', knownPrice: 'R$ 2.500', source: 'Indicação de cliente' },
          ],
          desiredPerception: 'Estrategista sênior, não "mais uma consultora".', priceMatchesPositioning: 'Não', priceMatchesPositioningWhy: 'Meu preço está abaixo do que minha experiência sustenta.',
          demandLevel: 'Acima da capacidade', waitlistExists: 'Sim', lostSalesDueToCapacity: 'Sim',
          believesCouldSustainHigherPrice: 'Sim', priceIncreaseDoubts: 'Medo de perder as clientes mais antigas que pagam o preço atual.',
        },
      },
      reviewStatus: {}, internalNotes: {}, scenarios: [], recommendation: {
        offerId: 'off-renata-1', factorsConsidered: ['Necessidade operacional', 'Referências de mercado', 'Nível de experiência'],
        strategicPrice: 9500, mathematicalMinimum: 7200,
        effectiveDate: '2026-08-20', reviewDate: '2027-02-20',
        strategicJustification: 'O preço atual (R$ 6.500) fica abaixo da necessidade operacional bruta considerando a capacidade realista, e das referências de mercado (R$5.000–7.000). Com 7 anos de experiência e demanda acima da capacidade, R$ 9.500 é sustentável sem perder o posicionamento.',
        risks: 'Pode gerar objeção pontual de clientes recorrentes acostumadas ao preço antigo — comunicar com antecedência.',
      }, publishedDeliverable: {
        strategicPrice: 9500, explanation: 'Seu preço atual está abaixo do que sua experiência e a demanda atual sustentam. Recomendamos R$ 9.500 para o projeto de Consultoria de Estratégia Comercial, com vigência a partir de 20/08/2026.',
        recommendationDate: '2026-08-20', reviewDate: '2027-02-20', mathematicalMinimum: 7200,
        publishedAt: '2026-08-20T10:00:00',
      },
    },
  },
  // Append-only — a past recommendation is never overwritten, only
  // superseded by a new dated entry (see publishValueDeliverable).
  priceHistory: [
    {
      id: 'ph1', clientId: 'client-3', offerId: 'off-renata-1', offerName: 'Consultoria de Estratégia Comercial (projeto 6 semanas)',
      recommendationId: 'bva3', previousPrice: 6500, newPrice: 9500,
      reason: 'O preço atual fica abaixo da necessidade operacional bruta e das referências de mercado; experiência e demanda sustentam o novo preço.',
      effectiveDate: '2026-08-20', reviewDate: '2027-02-20', createdBy: 'nay', createdAt: '2026-08-20T10:00:00',
    },
  ],
  // Non-Premium clients expressing interest in upgrading, sourced from the
  // Leitura Estratégica de Valor locked preview's CTA. One open record per
  // client+source (see createPremiumUpgradeInterest's dedupe).
  premiumUpgradeInterests: [],
  // General business expenses — not tied to any client. Placeholder amounts,
  // same convention as the rest of this seed (never invented as real figures).
  expenses: [
    { id: 'e1', date: '2026-07-05', category: 'ferramentas', description: 'Assinaturas (Notion, Canva, Hubla)', amount: 180 },
    { id: 'e2', date: '2026-07-10', category: 'marketing', description: 'Anúncios Instagram', amount: 450 },
    { id: 'e3', date: '2026-08-01', category: 'equipe', description: 'Assistente administrativa (mensal)', amount: 1200 },
    { id: 'e4', date: '2026-08-05', category: 'outros', description: 'Contabilidade', amount: 300 },
  ],
  // Leads — mostly sourced from the VIP WhatsApp group. Not yet clients;
  // convertLeadToClient() is what promotes one into db.clients.
  // Cleared per request — all demo/seed leads removed; a real one will be
  // created fresh through the normal CRM flow.
  leads: [],
  // Dynamics Nay runs inside the VIP group (classes, Q&As, challenges) to
  // keep engagement flowing, each with a before/after count on whatever she
  // was actually measuring — this is what backs the "did this dynamic
  // actually move the needle" decision-making she asked for.
  groupDynamics: [
    {
      id: 'gd1', title: 'Aula de Oratória ao Vivo', date: '2026-07-20',
      description: 'Aula gratuita sobre comunicação em público no grupo VIP, encerrada com convite para preencher a ficha de interesse na mentoria.',
      metricLabel: 'Preenchimento da Ficha de Interesse', beforeCount: 15, afterCount: 18,
    },
    {
      id: 'gd2', title: 'Q&A Semanal no Grupo VIP', date: '2026-08-05',
      description: 'Sessão de perguntas e respostas ao vivo sobre posicionamento pessoal.',
      metricLabel: 'Novas Solicitações de Reunião', beforeCount: 4, afterCount: 7,
    },
  ],
  // Content Center — classes/resources, hosted on Hubla (not migrated into
  // Persea OS — see docs note). Tenant-level library, organized by learning
  // track; `generalAudience: true` resources show to every client, others
  // surface only via an explicit assignment (resourceAssignments below).
  // r1's hublaUrl is a real class link the client supplied directly, kept
  // as a working demo; the rest stay clearly-marked placeholders — never
  // invent a real Hubla URL. Nay fills these in for real via the admin
  // Content screen.
  resources: [
    { id: 'r1', title: 'Boas-vindas à Mentoria PERSEA', description: 'Vídeo de abertura explicando como funciona a jornada PERSEA.', track: 'posicionamento', phaseKey: null, duration: '8 min', hublaUrl: 'https://app.hub.la/m/8GhxpUirbFpF6c1tRrrC/s/5hh0gSean9Hf', recommendation: null, generalAudience: true },
    { id: 'r2', title: 'Guia de Primeiros Passos', description: 'Documento de apoio para organizar as primeiras semanas de mentoria.', track: 'posicionamento', phaseKey: 'Essência, Comunicação e Vendas', duration: null, hublaUrl: 'https://pay.hubla.com.br/PLACEHOLDER-primeiros-passos', recommendation: null, generalAudience: true },
    { id: 'r3', title: 'N Time Class — Tendências de Imagem', description: 'Aula mensal ao vivo sobre o universo de imagem e marca pessoal.', track: 'posicionamento', phaseKey: 'Imagem e Estratégia', duration: '45 min', hublaUrl: 'https://pay.hubla.com.br/PLACEHOLDER-n-time-class', recommendation: null, generalAudience: true },
    { id: 'r4', title: 'Como Criar Conteúdo Sem Perder Autenticidade', description: 'Aula sobre alinhar a produção de conteúdo à sua Voz da Marca.', track: 'conteudo_autenticidade', phaseKey: 'Imagem e Estratégia', duration: '32 min', hublaUrl: 'https://pay.hubla.com.br/PLACEHOLDER-conteudo-autentico', recommendation: null, generalAudience: true },
    { id: 'r5', title: 'Bastidores: Do Rascunho ao Post', description: 'Estudo de caso real de produção de conteúdo, do zero até publicar.', track: 'conteudo_autenticidade', phaseKey: null, duration: '20 min', hublaUrl: 'https://pay.hubla.com.br/PLACEHOLDER-bastidores', recommendation: null, generalAudience: false },
    { id: 'r6', title: 'Comunicação Não-Violenta Aplicada a Vendas', description: 'Aula sobre comunicação clara e segura em conversas comerciais.', track: 'comunicacao', phaseKey: 'Essência, Comunicação e Vendas', duration: '38 min', hublaUrl: 'https://pay.hubla.com.br/PLACEHOLDER-comunicacao-nvc', recommendation: null, generalAudience: true },
    { id: 'r7', title: 'Sua Voz em Público: Podcasts e Lives', description: 'Preparação prática para aparições ao vivo com confiança.', track: 'comunicacao', phaseKey: 'Posicionamento e Metas', duration: '27 min', hublaUrl: 'https://pay.hubla.com.br/PLACEHOLDER-voz-publico', recommendation: null, generalAudience: false },
    { id: 'r8', title: 'Precificação com Confiança', description: 'Como comunicar valor e sustentar preços com segurança.', track: 'vendas', phaseKey: 'Negócio e Aquisição', duration: '41 min', hublaUrl: 'https://pay.hubla.com.br/PLACEHOLDER-precificacao', recommendation: null, generalAudience: true },
    { id: 'r9', title: 'Do Diagnóstico à Proposta', description: 'Estrutura de proposta comercial baseada em diagnóstico, não em improviso.', track: 'vendas', phaseKey: null, duration: '35 min', hublaUrl: 'https://pay.hubla.com.br/PLACEHOLDER-proposta', recommendation: null, generalAudience: false },
  ],
  // Per-student recommendations layered on top of the general library above —
  // same resource can be both generally available and separately assigned
  // (with its own reason/deadline) to a specific client.
  resourceAssignments: [
    { id: 'ra1', resourceId: 'r5', studentId: 'client-1', reason: 'Você já publica bastante — este case ajuda a manter a autenticidade enquanto acelera o ritmo.', deadline: '2026-08-24', relatedPhaseOrMeeting: 'E3 — Imagem e Estratégia', assignedAt: '2026-08-10T09:00:00', completed: false },
    { id: 'ra2', resourceId: 'r7', studentId: 'client-3', reason: 'Sua próxima etapa envolve aparecer mais — essa aula prepara você para isso com segurança.', deadline: '2026-08-27', relatedPhaseOrMeeting: null, assignedAt: '2026-08-09T09:00:00', completed: false },
    // A mixed spread of past-deadline assignments, for the Relatórios ->
    // Adesão às Tarefas report to have something to show beyond "still
    // pending" (the two above both have future deadlines).
    { id: 'ra3', resourceId: 'r6', studentId: 'client-2', reason: 'Reforça a comunicação segura antes da próxima conversa comercial.', deadline: '2026-07-25', relatedPhaseOrMeeting: null, assignedAt: '2026-07-10T09:00:00', completed: true },
    { id: 'ra4', resourceId: 'r8', studentId: 'client-1', reason: 'Prática de precificação antes de revisar valores com clientes atuais.', deadline: '2026-07-20', relatedPhaseOrMeeting: null, assignedAt: '2026-07-05T09:00:00', completed: false },
    { id: 'ra5', resourceId: 'r9', studentId: 'client-3', reason: 'Estrutura de proposta para o próximo diagnóstico comercial.', deadline: '2026-08-05', relatedPhaseOrMeeting: null, assignedAt: '2026-07-20T09:00:00', completed: true },
  ],
  // Weekly agenda seed — spans a few days before/after "today" in this
  // prototype's timeline so Hoje/Próximos dias/Esta semana/Pendências all
  // have real examples. Individual-meeting entries mirror the matching
  // client's journey.upcomingMeeting (see the duplication note above
  // getAgendaItems()).
  // Trimmed to a handful of examples on purpose (Nay: the old seed — 21
  // demo items covering every type/status combo — made the Agenda feel
  // overwhelming rather than useful). Keep only enough to show each real
  // type once or twice; add real events as they actually happen.
  agendaItems: [
    { id: 'ag1', type: 'admin_task', title: 'Preparar contrato da Juliana Paes', date: '2026-08-13T11:00:00', status: 'upcoming', relatedStudentId: 'client-4', relatedGroupLabel: null, topic: 'Preparar contrato a partir das informações recebidas', prepNotes: '', generalNotes: '', onlineLink: '', followUpNotes: '', createdAt: '2026-08-10T09:00:00', updatedAt: '2026-08-10T09:00:00' },
    { id: 'ag3', type: 'class', title: 'N Time Class — Tendências de Imagem 2026', date: '2026-08-13T20:00:00', status: 'upcoming', relatedStudentId: null, relatedGroupLabel: 'N Time Class', topic: 'Aula mensal ao vivo sobre tendências de imagem', prepNotes: 'Revisar slides da aula anterior.', generalNotes: '', onlineLink: 'https://meet.google.com/exemplo-ntime', followUpNotes: '', createdAt: '2026-08-01T09:00:00', updatedAt: '2026-08-01T09:00:00' },
    { id: 'ag4', type: 'group_meeting', title: 'Q&A Mensal — Turma Geral', date: '2026-08-14T19:00:00', status: 'upcoming', relatedStudentId: null, relatedGroupLabel: 'Q&A Mensal PERSEA', topic: 'Perguntas e respostas ao vivo com todas as mentoradas', prepNotes: 'Revisar dúvidas enviadas durante a semana.', generalNotes: '', onlineLink: 'https://meet.google.com/exemplo-qna', followUpNotes: '', createdAt: '2026-08-01T09:00:00', updatedAt: '2026-08-01T09:00:00' },
    { id: 'ag6', type: 'individual_meeting', title: 'E2 — Comunicação e Vendas', date: '2026-08-15T10:00:00', status: 'upcoming', relatedStudentId: 'client-2', relatedGroupLabel: null, topic: 'Dificuldades de venda, comunicação, posicionamento e pitch', prepNotes: 'Revisar respostas do questionário antes da reunião.', generalNotes: '', onlineLink: 'https://meet.google.com/exemplo-julia', followUpNotes: '', createdAt: '2026-07-11T09:00:00', updatedAt: '2026-07-11T09:00:00', durationMinutes: 60, assignedTo: 'nay', assistantPersona: null,
      recording: { recordingStatus: 'aguardando', transcriptStatus: 'nao_aplicavel', recordingUrl: null, transcriptUrl: null, requiresAttention: false, attentionNote: '', sync: { lastCheckedAt: null, nextCheckAt: null, googleAccount: 'nay@persea.com.br', syncStatus: 'aguardando', attempts: 0 } } },
    // One completed meeting kept to show the "requires attention" recording
    // state (see docs/google-meet-integration.md) — the rest of that demo
    // set was cut for being more than anyone needs to see at once.
    { id: 'ag15', type: 'individual_meeting', title: 'E1 — Extração e Essência', date: '2026-08-09T10:00:00', status: 'completed', relatedStudentId: 'client-2', relatedGroupLabel: null, topic: 'Extração de marca e essência', prepNotes: '', generalNotes: '', onlineLink: 'https://meet.google.com/persea-julia-e1', followUpNotes: '', createdAt: '2026-08-02T09:00:00', updatedAt: '2026-08-09T18:00:00', durationMinutes: 60, assignedTo: 'nay', assistantPersona: null,
      recording: { recordingStatus: 'erro', transcriptStatus: 'erro', recordingUrl: null, transcriptUrl: null, requiresAttention: true, attentionNote: 'O Google não retornou o link da gravação depois de várias tentativas — verifique manualmente no Drive e cole o link abaixo.', sync: { lastCheckedAt: '2026-08-12T09:00:00', nextCheckAt: null, googleAccount: 'nay@persea.com.br', syncStatus: 'erro', attempts: 6 } } },
    // Premium checkpoints (see CHECKPOINT_ALLOWANCE) — one done, one
    // upcoming, enough to show the 30min ad-hoc check-in on Bruna's tally.
    { id: 'ag18', type: 'checkpoint', title: 'Check-in — Dúvidas de Precificação', date: '2026-07-20T09:30:00', status: 'completed', relatedStudentId: 'client-1', relatedGroupLabel: null, topic: 'Ajuste rápido na tabela de preços antes do lançamento', prepNotes: '', generalNotes: 'Alinhado — Bruna vai testar o novo valor no próximo lote de clientes.', onlineLink: 'https://meet.google.com/persea-marina-checkin1', followUpNotes: '', createdAt: '2026-07-18T09:00:00', updatedAt: '2026-07-20T10:00:00', durationMinutes: 30, assignedTo: 'nay', assistantPersona: null },
    { id: 'ag21', type: 'checkpoint', title: 'Check-in — Feedback de Proposta', date: '2026-08-25T14:00:00', status: 'upcoming', relatedStudentId: 'client-1', relatedGroupLabel: null, topic: 'Ler uma proposta comercial antes de enviar', prepNotes: '', generalNotes: '', onlineLink: 'https://meet.google.com/persea-marina-checkin4', followUpNotes: '', createdAt: '2026-08-19T09:00:00', updatedAt: '2026-08-19T09:00:00', durationMinutes: 30, assignedTo: 'nay', assistantPersona: null },
  ],
  // Encontro scheduling requests — Nay starts one from a client's E{n} tab
  // with candidate date/times (plus the prep checklist she's confirming for
  // herself); the client either picks one or sends back an observation
  // about her availability. Only once Nay confirms a final time does it
  // become a real agendaItem (see requestEncounterMeeting and friends
  // below). Nothing here duplicates the agenda — a confirmed request just
  // points at the agendaItem it created.
  encounterRequests: [],
  // Generic "assistant prepared this, Nay needs to look before it goes to the
  // client" queue — see CONTENT_REVIEW_STATUSES above. type+refSlug identify
  // what's under review; approving applies its effect on that source record
  // (see approveReview) rather than duplicating the deliverable's status here.
  pendingReviews: [
    {
      id: 'rev1', clientId: 'client-1', type: 'image_guide', refSlug: 'guia_looks_mensal',
      title: 'Guia de Looks do Mês — Agosto', note: 'Baseado nas fotos de guarda-roupa enviadas em julho.', fileUrl: 'https://example.com/guides/guia-looks-marina-ago.pdf',
      status: 'pending', createdAt: '2026-08-16T14:00:00', resolvedAt: null, nayNote: '',
    },
    {
      id: 'rev2', clientId: 'client-2', type: 'image_guide', refSlug: 'estilo',
      title: 'Guia de Estilo — Adriana', note: 'Primeira versão a partir da Direção da Marca.', fileUrl: 'https://example.com/guides/guia-estilo-julia.pdf',
      status: 'pending', createdAt: '2026-08-15T11:00:00', resolvedAt: null, nayNote: '',
    },
    // rev3 (client-6 / Débora Lima) removed with her demo client record —
    // see Production Audit Remediation Pass, High 8.
  ],
  // Nay <-> Assistant inbox — a flat, timestamped feed rather than threaded
  // chat, matching the "one running log" convention used elsewhere (activity
  // log, whatsappNotes). clientId is optional context ("watch this client's
  // recording before prepping her guide"), not a scoping filter — every
  // message shows on the assistant's Painel regardless. See
  // getAssistantMessages/sendAssistantMessage/markAssistantMessageRead.
  assistantMessages: [
    // am1/am3 (client-6 / Débora Lima) removed with her demo client record —
    // see Production Audit Remediation Pass, High 8.
    // am2 (client-5 / Camila Rocha) removed — Camila eliminated per request.
  ],
  clients: {
    // --- Client 1: Bruna — farthest along, playbook published, pitches ready ---
    'client-1': {
      profile: { id: 'client-1', fullName: 'Bruna Marquezine', email: 'bruna@example.com', status: 'active', tier: 'premium', phaseIndex: 1, programSlug: 'persea-premium', gender: 'feminino' },
      onboarding: {
        clientInfo: {
          submitted: true, fullName: 'Bruna Marquezine', partyType: 'PF', cpf: '123.456.789-00', cnpj: null, companyName: null,
          address: 'Rua Exemplo, 100, Savassi, Belo Horizonte/MG', email: 'bruna@example.com', whatsapp: '(31) 90000-0001',
        },
        contract: { program: 'persea', duration: 'anual', status: 'completed', value: 32000, signedFileName: 'contrato-client-1-assinado.pdf', notes: 'Fechou no call de encerramento do onboarding — pediu para começar a Fase 1 já na semana seguinte.', paymentMethod: 'cartao_credito', installments: 12 },
        whatsappGroup: { status: 'added' },
      },
      payments: [
        { id: 'p1-1', dueDate: '2026-06-14', amount: 2667, status: 'paid', paidAt: '2026-06-13T10:00:00' , sumupLinkUrl: 'https://pay.sumup.com/b2c/persea-marina-1', linkSentAt: '2026-06-10T14:00:00', reportedPaidAt: '2026-06-13T09:50:00', nf: { status: 'issued', requestedAt: '2026-06-13T11:00:00', issuedAt: '2026-06-14T09:00:00', fileName: 'nf-client-1-p1.pdf' } },
        { id: 'p1-2', dueDate: '2026-07-14', amount: 2667, status: 'paid', paidAt: '2026-07-14T09:30:00' , sumupLinkUrl: 'https://pay.sumup.com/b2c/persea-marina-2', linkSentAt: '2026-07-10T14:00:00', reportedPaidAt: '2026-07-14T09:20:00', nf: { status: 'requested', requestedAt: '2026-08-01T10:00:00', issuedAt: null, fileName: null } },
        { id: 'p1-3', dueDate: '2026-08-14', amount: 2667, status: 'pending', paidAt: null , sumupLinkUrl: 'https://pay.sumup.com/b2c/persea-marina-3', linkSentAt: '2026-08-10T11:00:00', reportedPaidAt: null, nf: { status: 'not_requested', requestedAt: null, issuedAt: null, fileName: null } },
        { id: 'p1-4', dueDate: '2026-09-14', amount: 2667, status: 'pending', paidAt: null , sumupLinkUrl: null, linkSentAt: null, reportedPaidAt: null, nf: { status: 'not_requested', requestedAt: null, issuedAt: null, fileName: null } },
      ],
      // Direção da Marca — pinterestUrl below is a real board the client
      // supplied directly (not invented here) so the embed/fallback path
      // could be demonstrated with real data. Nay edits it via the admin
      // Brand Direction tab like any other client's.
      brandDirection: {
        pinterestUrl: 'https://www.pinterest.com/pachecootami/tatech-saas/',
        moodBoardIntro: 'Este mural reúne as referências visuais que guiam sua marca — cores, composições e sensações que suas fotos, posts e vídeos devem evocar. Volte aqui sempre que estiver planejando um conteúdo novo ou em dúvida se algo "combina" com você.',
        positioningSummary: 'Estrategista de precisão para especialistas que já entregam alto nível, mas ainda soam genéricos em público.',
        keywords: ['Precisa', 'Calorosa', 'Autoridade silenciosa', 'Sem enrolação'],
        tone: 'Direto, confiante, frases curtas — nunca informal demais nem excessivamente formal.',
        references: ['Editoriais de moda em tons terrosos', 'Fotografia com luz natural, pouco contraste'],
        guidance: 'Evitar linguagem motivacional genérica — Bruna conquista pela precisão, não pelo entusiasmo.',
        belongs: ['Tons terrosos e neutros', 'Frases curtas e diretas', 'Bastidores reais do trabalho com clientes'],
        doesntBelong: ['Frases de efeito genéricas', 'Cores vibrantes/neon', 'Conteúdo puramente motivacional sem substância'],
        updatedAt: '2026-08-01T10:00:00',
      },
      // "Minhas Ideias" — client's own notes inspired by the mood board.
      // Deliberately a separate top-level field with its own get/save
      // methods (not nested in brandDirection) so the write path is
      // structurally client-only, mirroring the existing private `notes`
      // pattern rather than sharing brandDirection's admin-only save method.
      brandIdeas: '',
      guideAcknowledged: false,
      images: [],
      imagesStatus: 'aguardando_envio',
      imagesNote: '',
      photoReminder: { sentAt: null, note: '' },
      whatsappNotes: [],
      contentActivity: { status: 'not_started', submission: '', feedback: '', updatedAt: null },
      imageProjectStatus: 'created',
      imageGuides: [
        { slug: 'paleta_cores', fileUrl: 'https://example.com/guides/paleta_cores.pdf', note: '', summary: 'Outono profundo — terrosos, vinho e dourado envelhecido; evita pastéis e preto puro perto do rosto.', canvaUrl: 'https://www.canva.com/design/PLACEHOLDER-paleta-marina/edit', deliveredAt: '2026-07-05T10:00:00' },
        { slug: 'estilo', fileUrl: 'https://example.com/guides/estilo.pdf', note: '', summary: 'Elegante-contemporâneo com toque autoral — alfaiataria solta, tecidos com textura, acessórios statement únicos.', canvaUrl: 'https://www.canva.com/design/PLACEHOLDER-estilo-marina/edit', deliveredAt: '2026-07-12T10:00:00' },
        { slug: 'moodboard_ensaio', fileUrl: 'https://example.com/guides/moodboard_ensaio.pdf', note: '', summary: 'Referências para o ensaio: luz dourada de fim de tarde, fundo neutro texturizado, poses de mãos em movimento (marca registrada dela em vídeo).', canvaUrl: 'https://www.canva.com/design/PLACEHOLDER-mood-marina/edit', deliveredAt: '2026-06-28T10:00:00' },
        { slug: 'guia_looks_mensal', fileUrl: null, note: '', summary: '', canvaUrl: '', deliveredAt: null },
      ],
      digitalKit: { fileUrl: 'https://example.com/kits/digital-kit.pdf', summary: 'Template de feed + stories no tom terracota/dourado da marca, com variações para lançamento e bastidores.', canvaUrl: 'https://www.canva.com/design/PLACEHOLDER-kit-marina/edit', deliveredAt: '2026-07-20T10:00:00' },
      hublaAccess: { status: 'granted', grantedAt: '2026-07-20T10:00:00' },
      // Real upsell example: Bruna started on Persea Essencial and Nay
      // upgraded her to Premium a month in — this is what getSuccessMetrics'
      // upsell count/list is built from (changedBy: 'nay', not 'seed').
      programHistory: [
        { programSlug: 'persea-essential', changedAt: '2026-06-14T10:00:00', changedBy: 'seed' },
        { programSlug: 'persea-premium', changedAt: '2026-07-15T14:00:00', changedBy: 'nay' },
      ],
      journey: {
        programName: 'Identidade',
        steps: [
          { key: 'questionnaire', title: 'Extração de Marca', status: 'completed' },
          { key: 'meeting_1', title: 'E1 — Extração e Essência', status: 'completed' },
          { key: 'playbook_review', title: 'Playbook de Marca Pessoal', status: 'completed' },
          { key: 'assessment', title: 'Teste de Arquétipos', status: 'available' },
          { key: 'pitch', title: 'Gerador de Pitch', status: 'completed' },
          { key: 'homework', title: 'Tarefas', status: 'in_progress' },
        ],
        upcomingMeeting: { title: 'E3 — Imagem e Estratégia', date: '2026-08-19T15:00:00' },
      },
      questionnaire: {
        title: 'Extração de Marca',
        questions: [
          { id: 'q1', text: 'Pelo que você quer ser conhecida daqui a 3 anos?', type: 'long_text', answer: 'Ser a estrategista de referência para marcas pessoais premium na América Latina.' },
          { id: 'q2', text: 'O que parece mais verdadeiro sobre quem você é agora?', type: 'long_text', answer: 'Precisa, calorosa e alérgica a enrolação.' },
          { id: 'q3', text: 'Qual é a transformação que você ajuda as pessoas a fazerem?', type: 'long_text', answer: 'De especialista invisível a autoridade reconhecida.' },
          { id: 'q4', text: 'Avalie sua confiança atual na sua marca pessoal (1-10)', type: 'scale', answer: '5' },
        ],
        status: 'submitted',
      },
      questionnaireAnalysis: {
        version: 1,
        generatedAt: '2026-07-01T10:00:00',
        executiveSummary: 'Bruna é uma profissional de alta competência cujo posicionamento externo ainda não acompanhou sua real expertise. Ela subestima sua autoridade por escrito, mas entrega além na prática.',
        strengths: ['Credibilidade técnica profunda', 'Ponto de vista claro quando provocada', 'Forte empatia com clientes'],
        goals: ['Ser reconhecida como autoridade de categoria, não generalista', 'Elevar o valor cobrado por meio de posicionamento percebido'],
        painPoints: ['Descreve-se com linguagem vaga e segura', 'Sem narrativa consistente entre plataformas'],
        opportunities: ['Um pilar de conteúdo com ponto de vista afiado', 'Uma metodologia própria que já usa informalmente'],
        suggestedQuestions: ['O que você parou de explicar porque acha que as pessoas "já deveriam entender"?', 'Quem você secretamente acha que faz isso pior do que você?'],
        businessMaturity: 'Profissional estabelecida, pré-marca — entrega forte, narrativa fraca.',
      },
      meeting: { title: 'E1 — Extração e Essência', transcriptUploaded: true, status: 'analyzed' },
      transcriptAnalysis: {
        version: 1,
        summary: 'Bruna descreveu um padrão de conquistar clientes por indicação, mas com dificuldade de converter públicos frios — o que remete a uma autodescrição genérica.',
        goals: ['Conseguir 3 palestras este ano', 'Aumentar os valores em 30% sem perder conversão'],
        challenges: ['Sensação de impostora ao "escolher um nicho"', 'Medo de afastar clientes antigos ao se especializar'],
        actionItems: ['Redigir uma declaração de posicionamento clara', 'Auditar os últimos 10 conteúdos quanto à consistência'],
        homework: ['Ler o Playbook v1', 'Gravar o pitch de 30 segundos em áudio ou vídeo', 'Responder às perguntas de reflexão'],
        keyInsights: ['O rótulo de "generalista" é um comportamento de segurança, não uma escolha estratégica.'],
      },
      playbook: {
        versions: [
          {
            version: 1,
            status: 'published',
            createdAt: '2026-07-05T09:00:00',
            publishedAt: '2026-07-06T11:00:00',
            sections: {
              identity: 'Uma estrategista de marca focada em precisão, que transforma expertise silenciosa em autoridade visível.',
              mission: 'Ajudar especialistas de alto nível a pararem de se subestimar em público.',
              vision: 'Um mundo onde competência e percepção nunca estão desalinhadas.',
              core_story: 'Começou como a pessoa a quem os clientes recorriam depois que o primeiro consultor falhava — percebeu que a lacuna nunca foi de habilidade, e sim de narrativa.',
              golden_circle: 'Por quê: o desalinhamento entre competência e percepção é um problema solucionável. Como: posicionamento de precisão + narrativa confiante. O quê: estratégia de marca para especialistas.',
              target_audience: 'Consultores e coaches estabelecidos, com forte entrega mas narrativa pública fraca.',
              value_proposition: 'Tornamos seu posicionamento tão afiado quanto sua real expertise.',
              positioning: 'A estrategista para especialistas cansados de soar como todo mundo.',
              brand_voice: 'Precisa, calorosa, sem enrolação, discretamente confiante.',
              communication_style: 'Direto, frases curtas, exemplos concretos em vez de abstrações.',
              goals: 'Conquistar 3 palestras. Aumentar os valores em 30%. Construir uma metodologia própria.',
              pitch_30s: 'Ajudo especialistas de alto nível a transformarem sua expertise silenciosa em uma marca que as pessoas realmente notam — sem soar como todo mundo na categoria.',
              action_plan: '1) Publicar a declaração de posicionamento. 2) Reconstruir a bio em todas as plataformas. 3) Buscar 3 oportunidades de palestra neste trimestre.',
            },
          },
        ],
      },
      assessment: {
        title: 'Teste de Arquétipos',
        description: 'Uma breve avaliação externa para identificar seu arquétipo de marca dominante.',
        externalUrl: 'https://example.com/archetype-test',
        status: 'not_started',
      },
      // Completed attempt — the exact worked example from the source workbook
      // itself (Teste_de_Arquetipos_Persea.pdf), reused verbatim rather than
      // invented, and it happens to demonstrate a real 3-way tie for the
      // "featured" spotlight (Explorador/Amante/Governante all score 18,
      // just behind Mago's 20) — see the tie-handling UI.
      archetypeQuiz: {
        visualSet: 'female',
        notes: 'Combinação forte de Mago + trio de Exploradora/Amante/Governante — conversar sobre como isso aparece na comunicação dela nas redes.',
        attempts: [
          {
            id: 'aq1', quizVersion: ARCHETYPE_QUIZ_VERSION, status: 'completed',
            startedAt: '2026-08-05T19:00:00', completedAt: '2026-08-05T19:22:00',
            responses: { 1: 4, 2: 4, 3: 4, 4: 5, 5: 5, 6: 3, 7: 4, 8: 4, 9: 3, 10: 4, 11: 4, 12: 5, 13: 3, 14: 5, 15: 5, 16: 4, 17: 2, 18: 3, 19: 2, 20: 4, 21: 4, 22: 5, 23: 5, 24: 4, 25: 5, 26: 5, 27: 4, 28: 4, 29: 5, 30: 4, 31: 5, 32: 5, 33: 2, 34: 4, 35: 4, 36: 1, 37: 3, 38: 5, 39: 4, 40: 5, 41: 5, 42: 4, 43: 5, 44: 3, 45: 3, 46: 5, 47: 3, 48: 5 },
            activityLogged: true,
          },
        ],
      },
      pitches: {
        version: 1,
        pitch_10s: 'Transformo especialistas invisíveis em autoridades reconhecidas.',
        pitch_30s: 'Ajudo especialistas de alto nível a transformarem sua expertise silenciosa em uma marca que as pessoas realmente notam — sem soar como todo mundo na categoria.',
        pitch_60s: 'A maioria dos especialistas que conheço é melhor do que sua reputação sugere. Eu ajudo a fechar essa lacuna — afiando o posicionamento, a história e o discurso — para que a percepção finalmente corresponda ao nível em que realmente atuam.',
        pitch_networking: 'Trabalho com especialistas que são ótimos no que fazem, mas esquecíveis em como se descrevem — eu resolvo a parte da descrição.',
        instagram_bio: 'Estrategista de marca para especialistas ✨ Transformando expertise silenciosa em autoridade visível.',
        linkedin_summary: 'Ajudo consultores e coaches estabelecidos a fecharem a lacuna entre sua real expertise e como são percebidos — com posicionamento mais afiado, uma história mais clara e um discurso que realmente convence.',
      },
      homework: [
        { id: 'h1', title: 'Ler o Playbook', type: 'boolean', status: 'completed' },
        { id: 'h2', title: 'Gravação do Pitch (áudio ou vídeo)', type: 'media_upload', status: 'completed', submissions: [
          { id: 'm1', kind: 'audio', name: 'pitch-treino-1.mp3', url: null, uploadedAt: '2026-07-07T10:00:00' },
        ] },
        { id: 'h3', title: 'Perguntas de Reflexão', type: 'text_submission', status: 'pending', submission: '' },
      ],
      activity: [
        { type: 'pitches_generated', text: 'Variações de pitch geradas', at: '2026-07-08T14:20:00' },
        { type: 'playbook_published', text: 'Playbook v1 publicado', at: '2026-07-06T11:00:00' },
        { type: 'playbook_draft_created', text: 'Rascunho do Playbook v1 gerado', at: '2026-07-05T09:00:00' },
        { type: 'meeting_analyzed', text: 'Transcrição da E1 analisada', at: '2026-07-04T16:10:00' },
        { type: 'questionnaire_submitted', text: 'Extração de Marca concluída', at: '2026-07-01T09:40:00' },
      ],
      playbookExperience: { format: 'podcast', completedAt: '2026-07-06T19:30:00' },
      quiz: { score: 4, total: 4, completedAt: '2026-07-06T19:45:00' },
      meetingRequests: [
        { id: 'mr1', reason: 'Tenho dúvida sobre como aplicar a Voz da Marca nas redes sociais.', status: 'assigned', assignedTo: 'nay', createdAt: '2026-07-09T10:00:00' },
      ],
      notes: 'Lembrar de perguntar sobre precificação na próxima reunião.',
      // Filled in by Nay from E1/E2 — see admin/client-detail.js's Programa tab.
      summary: {
        who: 'Consultora de posicionamento para especialistas de alto nível — profissionais tecnicamente excelentes, mas com pouca visibilidade de marca.',
        what: 'Mentorias e consultorias de posicionamento de marca pessoal para consultores e coaches já estabelecidos.',
        why: 'Fechar a lacuna entre a real competência dos clientes e como o mercado os percebe, transformando autoridade invisível em autoridade reconhecida.',
        how: 'Mentorias 1:1 e conteúdo estratégico nas redes — Mago e o trio Exploradora/Amante/Governante aparecem com força na comunicação dela.',
      },
      moodLog: [
        { context: 'questionnaire_submitted', mood: 4, at: '2026-07-01T09:41:00' },
        { context: 'playbook_experience', mood: 5, at: '2026-07-06T19:31:00' },
        { context: 'quiz_completed', mood: 5, at: '2026-07-06T19:46:00' },
      ],
      book: {
        title: 'Guia Imagético',
        subtitle: 'Mentoria PERSEA',
        author: 'NAY MURTA | FATOR N',
        coverImage: '../shared/assets/nay-cover.jpg',
        epigraph: {
          text: 'Porque ser admirável nunca é por acaso. É construção.',
          cite: 'Nay Murta — Mentoria PERSEA',
        },
        chapters: [
          {
            key: 'registro',
            number: 1,
            title: 'Registro Imagético Diário',
            eyebrow: 'Envio via WhatsApp',
            paragraphs: [
              'Para iniciarmos uma construção estratégica, funcional e inteligente, precisamos entender seu ponto de partida.',
              'Durante 10 dias, registre suas produções (ou faça simulações) e, junto à foto, conte para onde ia, como se sentiu ao se olhar no espelho e se foi fácil ou difícil escolher a roupa.',
              'Esse será o nosso raio-x inicial para criarmos juntas uma imagem que traduza sua essência e eleve sua percepção de valor.',
            ],
          },
          {
            key: 'sou-nunca-gostaria',
            number: 2,
            title: 'Sou, Nunca e Gostaria',
            eyebrow: 'Envio via WhatsApp',
            paragraphs: [
              'Selecione e envie referências visuais que representem:',
            ],
            list: [
              'Como eu sou e me visto hoje: escolha 5 imagens que traduzam a comunicação atual. Importante: olhe de fora, como se estivesse descrevendo outra pessoa. Não envie fotos suas.',
              'Como eu gostaria de ser: escolha 5 imagens que representem a mudança que você deseja alcançar.',
              'Como eu nunca seria: escolha 5 imagens que mostrem o que não tem nada a ver com você ou que jamais usaria.',
            ],
          },
          {
            key: 'estrutura-corporal',
            number: 3,
            title: 'Estrutura Corporal',
            eyebrow: 'Nem tudo que gostamos nos veste bem',
            paragraphs: [
              'Envie fotos de frente, costas e perfis, em postura ereta, usando lingerie ou biquíni, para validação da sua morfologia corporal.',
              'Peça para outra pessoa fazer o registro, com o celular na horizontal, na altura da linha do corpo, evitando ângulos inclinados (de cima para baixo ou de baixo para cima).',
            ],
          },
          {
            key: 'analise-facial',
            number: 4,
            title: 'Análise Facial',
            eyebrow: 'Visagismo e coloração pessoal',
            paragraphs: [
              'A seguir, as orientações detalhadas para o envio das fotos do seu rosto, que serão utilizadas como base para o seu projeto visagista e para a análise de coloração pessoal.',
              '4.1 — Visagismo: precisaremos de três fotos suas, todas feitas com a câmera traseira, em posição frontal, como uma foto 3x4 — cabelos soltos para frente dos ombros, cabelos soltos para trás dos ombros, e cabelos presos. As fotos devem ser novas, com boa distância da câmera, cabelo bem penteado e partido ao meio (de preferência), usando top ou blusa branca de alça/manga, encostada em uma parede clara.',
              'Como tirar as fotos: esteja sem maquiagem e sem acessórios; iluminação natural, feita durante o dia, evitando luz direta do sol e sem flash; peça para outra pessoa tirar a foto com a câmera traseira, a 1,5m de distância; confira se as duas orelhas estão visíveis na foto de frente.',
              '4.2 — Coloração Pessoal: a foto deve ser tirada bem de frente, com proximidade do rosto e colo totalmente à mostra, em ambiente iluminado naturalmente, numa janela sem entrada direta de sol, entre 11h e 14h, com o rosto completamente limpo, sem produto, maquiagem ou acessórios.',
            ],
            list: [
              'Posicione-se de frente para a janela para que o rosto receba iluminação uniforme.',
              'Não fique de lado para a janela — isso deixa um lado do rosto iluminado e o outro sombreado.',
              'Não deixe a janela ao fundo — isso cria sombras no rosto.',
              'Posicione o celular na altura do pescoço, evitando deixá-lo muito acima ou abaixo da cabeça.',
            ],
          },
          {
            key: 'complementares',
            number: 5,
            title: 'Informações Complementares',
            eyebrow: 'Mapeamento facial',
            paragraphs: [
              'Um formulário exclusivo para o seu mapeamento facial estará disponível na plataforma assim que sua consultora liberar esta etapa.',
            ],
          },
        ],
        backMatter: { studio: 'PERSEA', handle: '@naymutra', email: 'naymurta@fatorn.com.br' },
      },
    },

    // --- Client 2: Adriana — just starting out, nothing analyzed yet ---
    'client-2': {
      profile: { id: 'client-2', fullName: 'Adriana Lima', email: 'adriana@example.com', status: 'active', tier: 'essential', phaseIndex: 0, programSlug: 'persea-essential', gender: 'feminino' },
      onboarding: {
        clientInfo: {
          submitted: true, fullName: 'Adriana Lima', partyType: 'PF', cpf: '234.567.890-11', cnpj: null, companyName: null,
          address: 'Av. Exemplo, 200, Centro, Sete Lagoas/MG', email: 'adriana@example.com', whatsapp: '(31) 90000-0002',
        },
        contract: { program: 'persea', duration: 'semestral', status: 'completed', value: 18000, signedFileName: 'contrato-client-2-assinado.pdf', notes: '', paymentMethod: null, installments: null },
        whatsappGroup: { status: 'added' },
      },
      payments: [
        { id: 'p2-1', dueDate: '2026-07-15', amount: 3000, status: 'paid', paidAt: '2026-07-15T08:00:00' , sumupLinkUrl: null, linkSentAt: null, reportedPaidAt: null, nf: { status: 'not_requested', requestedAt: null, issuedAt: null, fileName: null } },
        { id: 'p2-2', dueDate: '2026-08-01', amount: 3000, status: 'overdue', paidAt: null , sumupLinkUrl: 'https://pay.sumup.com/b2c/persea-julia-2', linkSentAt: '2026-07-28T09:00:00', reportedPaidAt: null, nf: { status: 'not_requested', requestedAt: null, issuedAt: null, fileName: null } },
        { id: 'p2-3', dueDate: '2026-09-01', amount: 3000, status: 'pending', paidAt: null , sumupLinkUrl: null, linkSentAt: null, reportedPaidAt: null, nf: { status: 'not_requested', requestedAt: null, issuedAt: null, fileName: null } },
      ],
      brandDirection: {
        pinterestUrl: null, moodBoardIntro: '', positioningSummary: '', keywords: [], tone: '', references: [],
        guidance: '', belongs: [], doesntBelong: [], updatedAt: null,
      },
      brandIdeas: '',
      guideAcknowledged: false,
      images: [],
      imagesStatus: 'aguardando_envio',
      imagesNote: '',
      photoReminder: { sentAt: null, note: '' },
      whatsappNotes: [],
      contentActivity: { status: 'not_started', submission: '', feedback: '', updatedAt: null },
      imageProjectStatus: 'created',
      imageGuides: [
        { slug: 'paleta_cores', fileUrl: 'https://example.com/guides/paleta_cores.pdf', note: '', summary: 'Primavera clara — cores leves e luminosas (coral, verde-água, amarelo manteiga); metáis dourados favorecem mais que prateados.', canvaUrl: 'https://www.canva.com/design/PLACEHOLDER-paleta-julia/edit', deliveredAt: '2026-07-18T10:00:00' },
        { slug: 'estilo', fileUrl: null, note: '', summary: '', canvaUrl: '', deliveredAt: null },
        { slug: 'moodboard_ensaio', fileUrl: null, note: '', summary: '', canvaUrl: '', deliveredAt: null },
        { slug: 'guia_looks_mensal', fileUrl: null, note: '', summary: '', canvaUrl: '', deliveredAt: null },
      ],
      digitalKit: { fileUrl: null },
      hublaAccess: { status: 'granted', grantedAt: '2026-07-20T10:00:00' },
      programHistory: [{ programSlug: 'persea-essential', changedAt: null, changedBy: 'seed' }],
      journey: {
        programName: 'Identidade',
        steps: [
          { key: 'questionnaire', title: 'Extração de Marca', status: 'completed' },
          { key: 'meeting_1', title: 'E1 — Extração e Essência', status: 'available' },
          { key: 'playbook_review', title: 'Playbook de Marca Pessoal', status: 'locked' },
          { key: 'assessment', title: 'Teste de Arquétipos', status: 'available' },
          { key: 'pitch', title: 'Gerador de Pitch', status: 'locked' },
          { key: 'homework', title: 'Tarefas', status: 'locked' },
        ],
        upcomingMeeting: { title: 'E2 — Comunicação e Vendas', date: '2026-08-15T10:00:00' },
      },
      questionnaire: {
        title: 'Extração de Marca',
        questions: [
          { id: 'q1', text: 'Pelo que você quer ser conhecida daqui a 3 anos?', type: 'long_text', answer: 'Ser vista como referência em finanças para mulheres autônomas.' },
          { id: 'q2', text: 'O que parece mais verdadeiro sobre quem você é agora?', type: 'long_text', answer: 'Organizada, didática, mas ainda insegura para aparecer.' },
          { id: 'q3', text: 'Qual é a transformação que você ajuda as pessoas a fazerem?', type: 'long_text', answer: 'De confusão financeira para clareza e controle.' },
          { id: 'q4', text: 'Avalie sua confiança atual na sua marca pessoal (1-10)', type: 'scale', answer: '3' },
        ],
        status: 'submitted',
      },
      questionnaireAnalysis: {
        version: 1,
        generatedAt: '2026-07-10T09:15:00',
        executiveSummary: 'Adriana tem clareza técnica mas evita visibilidade — o principal obstáculo é exposição, não competência.',
        strengths: ['Didática natural', 'Organização impecável de conteúdo', 'Empatia com o público iniciante'],
        goals: ['Perder o medo de aparecer', 'Construir autoridade em finanças pessoais'],
        painPoints: ['Evita gravar vídeos e fazer lives', 'Se compara constantemente a outras referências do nicho'],
        opportunities: ['Formato de conteúdo escrito como porta de entrada antes do vídeo', 'Comunidade de clientes como prova social'],
        suggestedQuestions: ['O que aconteceria se você postasse mesmo com medo?', 'Quem você imagina te vendo pela primeira vez?'],
        businessMaturity: 'Início de carreira como autoridade — competência real, visibilidade ainda não construída.',
      },
      meeting: { title: 'E2 — Comunicação e Vendas', transcriptUploaded: false, status: 'scheduled' },
      transcriptAnalysis: null,
      playbook: { versions: [] },
      assessment: {
        title: 'Teste de Arquétipos',
        description: 'Uma breve avaliação externa para identificar seu arquétipo de marca dominante.',
        externalUrl: 'https://example.com/archetype-test',
        status: 'not_started',
      },
      // Completed attempt — clean top 3 (Sábio 19 / Governante 18 / Criador 17),
      // no tie, for contrast with Bruna's tied example above.
      // In-progress attempt — 20 of 48 answered, demonstrates save-and-resume.
      archetypeQuiz: {
        visualSet: null,
        notes: '',
        attempts: [
          {
            id: 'aq2', quizVersion: ARCHETYPE_QUIZ_VERSION, status: 'in_progress',
            startedAt: '2026-08-17T20:00:00', completedAt: null,
            responses: { 1: 4, 2: 4, 3: 4, 4: 5, 5: 5, 6: 3, 7: 4, 8: 4, 9: 3, 10: 4, 11: 4, 12: 5, 13: 3, 14: 5, 15: 5, 16: 4, 17: 2, 18: 3, 19: 2, 20: 4 },
            activityLogged: false,
          },
        ],
      },
      pitches: null,
      homework: [
        { id: 'h1', title: 'Ler o Playbook', type: 'boolean', status: 'pending' },
        { id: 'h2', title: 'Gravação do Pitch (áudio ou vídeo)', type: 'media_upload', status: 'pending', submissions: [] },
        { id: 'h3', title: 'Perguntas de Reflexão', type: 'text_submission', status: 'pending', submission: '' },
      ],
      activity: [
        { type: 'questionnaire_submitted', text: 'Extração de Marca concluída', at: '2026-07-10T09:00:00' },
      ],
      playbookExperience: { format: null, completedAt: null },
      quiz: { score: null, total: null, completedAt: null },
      meetingRequests: [
        { id: 'mr2', reason: 'Fiquei perdida em uma pergunta do questionário, queria confirmar se respondi certo.', status: 'pending', assignedTo: null, createdAt: '2026-07-11T14:00:00' },
      ],
      notes: '',
      // Filled in by Nay from E1/E2 — see admin/client-detail.js's Programa tab.
      summary: {
        who: 'Educadora financeira ainda no início da construção da sua autoridade pública — tecnicamente segura, mas evita se expor.',
        what: 'Consultoria e conteúdo educativo sobre finanças pessoais para mulheres autônomas.',
        why: 'Ser vista como referência em finanças para mulheres autônomas, ajudando-as a sair da confusão financeira para a clareza e o controle.',
        how: 'Hoje se comunica principalmente por conteúdo escrito — ainda evita vídeos e lives; o objetivo é migrar aos poucos conforme ganha confiança.',
      },
      moodLog: [
        { context: 'questionnaire_submitted', mood: 3, at: '2026-07-10T09:01:00' },
      ],
    },

    // --- Client 3: Anitta — mid-journey, playbook drafted but not published ---
    'client-3': {
      profile: { id: 'client-3', fullName: 'Anitta', email: 'anitta@example.com', status: 'active', tier: 'premium', phaseIndex: 0, programSlug: 'persea-premium', gender: 'feminino' },
      onboarding: {
        clientInfo: {
          submitted: true, fullName: 'Anitta', partyType: 'PJ', cpf: '345.678.901-22', cnpj: '12.345.678/0001-90', companyName: 'Anitta Consultoria',
          address: 'Rua Exemplo, 300, Lourdes, Belo Horizonte/MG', email: 'anitta@example.com', whatsapp: '(31) 90000-0003',
        },
        contract: { program: 'persea', duration: 'anual', status: 'completed', value: 32000, signedFileName: 'contrato-client-3-assinado.pdf', notes: '', paymentMethod: null, installments: null },
        whatsappGroup: { status: 'added' },
      },
      payments: [
        { id: 'p3-1', dueDate: '2026-06-01', amount: 2667, status: 'paid', paidAt: '2026-06-01T09:00:00' , sumupLinkUrl: null, linkSentAt: null, reportedPaidAt: null, nf: { status: 'not_requested', requestedAt: null, issuedAt: null, fileName: null } },
        { id: 'p3-2', dueDate: '2026-07-01', amount: 2667, status: 'paid', paidAt: '2026-07-02T09:00:00' , sumupLinkUrl: null, linkSentAt: null, reportedPaidAt: null, nf: { status: 'not_requested', requestedAt: null, issuedAt: null, fileName: null } },
        { id: 'p3-3', dueDate: '2026-08-01', amount: 2667, status: 'pending', paidAt: null , sumupLinkUrl: 'https://pay.sumup.com/b2c/persea-renata-3', linkSentAt: '2026-07-25T09:00:00', reportedPaidAt: '2026-08-05T16:40:00', nf: { status: 'not_requested', requestedAt: null, issuedAt: null, fileName: null } },
      ],
      brandDirection: {
        pinterestUrl: null, moodBoardIntro: '', positioningSummary: '', keywords: [], tone: '', references: [],
        guidance: '', belongs: [], doesntBelong: [], updatedAt: null,
      },
      brandIdeas: '',
      guideAcknowledged: false,
      images: [],
      imagesStatus: 'aguardando_envio',
      imagesNote: '',
      photoReminder: { sentAt: null, note: '' },
      whatsappNotes: [],
      contentActivity: { status: 'not_started', submission: '', feedback: '', updatedAt: null },
      imageProjectStatus: 'created',
      imageGuides: [
        { slug: 'paleta_cores', fileUrl: 'https://example.com/guides/paleta_cores.pdf', note: '', summary: 'Inverno clássico — contraste alto, cores puras e frias (azul-marinho, cereja, branco); evita tons terrosos/quebrados.', canvaUrl: 'https://www.canva.com/design/PLACEHOLDER-paleta-renata/edit', deliveredAt: '2026-06-20T10:00:00' },
        { slug: 'estilo', fileUrl: null, note: '', summary: '', canvaUrl: '', deliveredAt: null },
        { slug: 'moodboard_ensaio', fileUrl: null, note: '', summary: '', canvaUrl: '', deliveredAt: null },
        { slug: 'guia_looks_mensal', fileUrl: null, note: '', summary: '', canvaUrl: '', deliveredAt: null },
      ],
      digitalKit: { fileUrl: null },
      hublaAccess: { status: 'granted', grantedAt: '2026-07-20T10:00:00' },
      programHistory: [{ programSlug: 'persea-premium', changedAt: null, changedBy: 'seed' }],
      journey: {
        programName: 'Identidade',
        steps: [
          { key: 'questionnaire', title: 'Extração de Marca', status: 'completed' },
          { key: 'meeting_1', title: 'E1 — Extração e Essência', status: 'completed' },
          { key: 'playbook_review', title: 'Playbook de Marca Pessoal', status: 'in_progress' },
          { key: 'assessment', title: 'Teste de Arquétipos', status: 'completed' },
          { key: 'pitch', title: 'Gerador de Pitch', status: 'locked' },
          { key: 'homework', title: 'Tarefas', status: 'in_progress' },
        ],
        upcomingMeeting: { title: 'E4 — Posicionamento e Metas', date: '2026-08-17T13:30:00' },
      },
      questionnaire: {
        title: 'Extração de Marca',
        questions: [
          { id: 'q1', text: 'Pelo que você quer ser conhecida daqui a 3 anos?', type: 'long_text', answer: 'Pela consultora que resolve o "caos operacional" de pequenos negócios.' },
          { id: 'q2', text: 'O que parece mais verdadeiro sobre quem você é agora?', type: 'long_text', answer: 'Prática, direta, sem paciência para teoria sem aplicação.' },
          { id: 'q3', text: 'Qual é a transformação que você ajuda as pessoas a fazerem?', type: 'long_text', answer: 'De operação bagunçada para processo replicável.' },
          { id: 'q4', text: 'Avalie sua confiança atual na sua marca pessoal (1-10)', type: 'scale', answer: '6' },
        ],
        status: 'submitted',
      },
      questionnaireAnalysis: {
        version: 1,
        generatedAt: '2026-06-28T11:00:00',
        executiveSummary: 'Anitta já entrega resultado operacional forte, mas se posiciona como "faz-tudo" — o que dilui o valor percebido do seu trabalho mais estratégico.',
        strengths: ['Execução comprovada', 'Linguagem direta e confiável', 'Cases fortes de antes/depois'],
        goals: ['Ser vista como estrategista, não só executora', 'Cobrar por diagnóstico, não só por implementação'],
        painPoints: ['Aceita qualquer tipo de projeto', 'Portfólio comunica serviço, não transformação'],
        opportunities: ['Metodologia própria de diagnóstico operacional', 'Reposicionar cases como estudos de transformação'],
        suggestedQuestions: ['Que tipo de projeto você teria que recusar para subir de nível?', 'O que você faz que parece básico pra você mas é ouro pro cliente?'],
        businessMaturity: 'Operadora experiente, migrando para posicionamento estratégico.',
      },
      meeting: { title: 'E3 — Imagem e Estratégia', transcriptUploaded: true, status: 'analyzed' },
      transcriptAnalysis: {
        version: 1,
        summary: 'Anitta relatou cansaço de aceitar projetos fora do seu foco só para manter a agenda cheia, e dificuldade de precificar diagnóstico como etapa separada da execução.',
        goals: ['Criar uma oferta de diagnóstico paga', 'Recusar 30% dos projetos fora do foco'],
        challenges: ['Medo de perder receita ao dizer não', 'Dificuldade de nomear a própria metodologia'],
        actionItems: ['Nomear a metodologia de diagnóstico', 'Criar página de portfólio por transformação, não por serviço'],
        homework: ['Ler o Playbook v1', 'Gravar o pitch de 30 segundos em áudio ou vídeo', 'Responder às perguntas de reflexão'],
        keyInsights: ['Aceitar tudo é o principal fator que mantém Anitta no nível "executora".'],
      },
      playbook: {
        versions: [
          {
            version: 1,
            status: 'draft',
            createdAt: '2026-07-02T10:00:00',
            sections: {
              identity: 'Uma consultora operacional que transforma caos administrativo em processo replicável.',
              mission: 'Tirar pequenos negócios do improviso permanente.',
              vision: 'Um mercado onde operação forte é tão valorizada quanto estratégia de marca.',
              core_story: 'Começou organizando o próprio negócio da família — hoje aplica o mesmo método em dezenas de operações.',
              golden_circle: 'Por quê: negócios crescem e a operação não acompanha. Como: diagnóstico + processo replicável. O quê: consultoria operacional.',
              target_audience: 'Donos de pequenos negócios em crescimento rápido, sem processos definidos.',
              value_proposition: 'Transformamos operação improvisada em processo que funciona sem você por perto.',
              positioning: 'A consultora para quem já cresceu rápido demais para o próprio caos.',
              brand_voice: 'Direta, prática, sem rodeios.',
              communication_style: 'Frases curtas, exemplos concretos, pouca teoria.',
              goals: 'Lançar oferta de diagnóstico. Recusar 30% dos projetos fora de foco.',
              pitch_30s: 'Ajudo negócios que cresceram rápido demais a organizarem a operação antes que o caos vire prejuízo.',
              action_plan: '1) Nomear a metodologia. 2) Lançar oferta de diagnóstico paga. 3) Reposicionar portfólio por transformação.',
            },
          },
        ],
      },
      assessment: {
        title: 'Teste de Arquétipos',
        description: 'Uma breve avaliação externa para identificar seu arquétipo de marca dominante.',
        externalUrl: 'https://example.com/archetype-test',
        status: 'completed',
      },
      // Completed attempt — clean top 3 (Sábio 19 / Governante 18 / Criador 17),
      // no tie, fits her established "Estrategista de Marca e Consultora de
      // Negócios" narrative and contrasts with Bruna's tied example.
      archetypeQuiz: {
        visualSet: 'female',
        notes: '',
        attempts: [
          {
            id: 'aq3', quizVersion: ARCHETYPE_QUIZ_VERSION, status: 'completed',
            startedAt: '2026-08-16T09:00:00', completedAt: '2026-08-16T09:19:00',
            responses: { 1: 2, 2: 4, 3: 3, 4: 3, 5: 3, 6: 2, 7: 2, 8: 3, 9: 3, 10: 3, 11: 3, 12: 2, 13: 2, 14: 2, 15: 2, 16: 2, 17: 1, 18: 4, 19: 5, 20: 3, 21: 2, 22: 3, 23: 4, 24: 4, 25: 5, 26: 5, 27: 1, 28: 2, 29: 3, 30: 3, 31: 4, 32: 3, 33: 2, 34: 5, 35: 4, 36: 1, 37: 2, 38: 5, 39: 2, 40: 3, 41: 5, 42: 4, 43: 4, 44: 4, 45: 2, 46: 3, 47: 3, 48: 2 },
            activityLogged: true,
          },
        ],
      },
      pitches: null,
      homework: [
        { id: 'h1', title: 'Ler o Playbook', type: 'boolean', status: 'completed' },
        { id: 'h2', title: 'Gravação do Pitch (áudio ou vídeo)', type: 'media_upload', status: 'pending', submissions: [] },
        { id: 'h3', title: 'Perguntas de Reflexão', type: 'text_submission', status: 'completed', submission: 'Os projetos que eu preciso recusar são os de organização de estoque pontual — não é o meu diagnóstico de fundo.' },
      ],
      activity: [
        { type: 'playbook_draft_created', text: 'Rascunho do Playbook v1 gerado', at: '2026-07-02T10:00:00' },
        { type: 'assessment_completed', text: 'Teste de Arquétipos concluído', at: '2026-06-30T15:00:00' },
        { type: 'meeting_analyzed', text: 'Transcrição da E3 analisada', at: '2026-06-29T16:00:00' },
        { type: 'questionnaire_submitted', text: 'Extração de Marca concluída', at: '2026-06-28T10:40:00' },
      ],
      playbookExperience: { format: null, completedAt: null },
      quiz: { score: null, total: null, completedAt: null },
      meetingRequests: [],
      notes: 'Verificar com a Nay se posso usar o playbook em uma proposta comercial antes da publicação.',
      // Filled in by Nay from E1/E2 — see admin/client-detail.js's Programa tab.
      summary: {
        who: 'Estrategista de marca e consultora de negócios, com um perfil racional e estruturado (Sábio, Governante e Criador em destaque).',
        what: 'Consultoria de organização operacional e estratégica para negócios que cresceram rápido.',
        why: 'Ajudar negócios que expandiram rápido demais a organizarem a operação antes que o crescimento desorganizado vire prejuízo.',
        how: 'Diagnóstico de negócio, plano de ação estruturado e acompanhamento próximo — nomear a própria metodologia é um dos focos atuais.',
      },
      moodLog: [
        { context: 'questionnaire_submitted', mood: 4, at: '2026-06-28T10:41:00' },
        { context: 'homework_task', mood: 3, at: '2026-07-03T09:00:00' },
      ],
    },

    // --- Clients 4-6: onboarding-stage — Phase 1 not started yet, demonstrate
    // the pre-mentorship workflow from docs/PERSEA_METHODOLOGY.md §2. ---
    'client-4': {
      profile: { id: 'client-4', fullName: 'Juliana Paes', email: 'juliana@example.com', status: 'onboarding', tier: 'essential', phaseIndex: 0, programSlug: 'persea-essential', gender: 'feminino' },
      onboarding: {
        clientInfo: {
          submitted: true, fullName: 'Juliana Paes', partyType: 'PF', cpf: '456.789.012-33', cnpj: null, companyName: null,
          address: 'Rua Exemplo, 400, Centro, Contagem/MG', email: 'juliana@example.com', whatsapp: '(31) 90000-0004',
        },
        contract: { program: null, duration: null, status: 'info_received', value: null, signedFileName: null, notes: '', paymentMethod: null, installments: null },
        whatsappGroup: { status: 'not_added' },
      },
      payments: [],
      brandDirection: {
        pinterestUrl: null, moodBoardIntro: '', positioningSummary: '', keywords: [], tone: '', references: [],
        guidance: '', belongs: [], doesntBelong: [], updatedAt: null,
      },
      brandIdeas: '',
      guideAcknowledged: false,
      images: [],
      imagesStatus: 'aguardando_envio',
      imagesNote: '',
      photoReminder: { sentAt: null, note: '' },
      whatsappNotes: [],
      contentActivity: { status: 'not_started', submission: '', feedback: '', updatedAt: null },
      imageProjectStatus: 'not_started',
      imageGuides: [{ slug: 'paleta_cores', fileUrl: null, note: '' }, { slug: 'estilo', fileUrl: null, note: '' }, { slug: 'moodboard_ensaio', fileUrl: null, note: '' }, { slug: 'guia_looks_mensal', fileUrl: null, note: '' }],
      digitalKit: { fileUrl: null },
      hublaAccess: { status: 'not_granted', grantedAt: null },
      programHistory: [{ programSlug: 'persea-essential', changedAt: null, changedBy: 'seed' }],
      journey: {
        programName: 'Identidade',
        steps: [
          { key: 'questionnaire', title: 'Extração de Marca', status: 'locked' },
          { key: 'meeting_1', title: 'E1 — Extração e Essência', status: 'locked' },
          { key: 'playbook_review', title: 'Playbook de Marca Pessoal', status: 'locked' },
          { key: 'assessment', title: 'Teste de Arquétipos', status: 'locked' },
          { key: 'pitch', title: 'Gerador de Pitch', status: 'locked' },
          { key: 'homework', title: 'Tarefas', status: 'locked' },
        ],
        upcomingMeeting: { title: 'E1 — Extração e Essência — a agendar após onboarding', date: '2026-08-25T10:00:00' },
      },
      questionnaire: {
        title: 'Extração de Marca',
        questions: [
          { id: 'q1', text: 'Pelo que você quer ser conhecida daqui a 3 anos?', type: 'long_text', answer: '' },
          { id: 'q2', text: 'O que parece mais verdadeiro sobre quem você é agora?', type: 'long_text', answer: '' },
          { id: 'q3', text: 'Qual é a transformação que você ajuda as pessoas a fazerem?', type: 'long_text', answer: '' },
          { id: 'q4', text: 'Avalie sua confiança atual na sua marca pessoal (1-10)', type: 'scale', answer: '' },
        ],
        status: 'in_progress',
      },
      questionnaireAnalysis: {
        version: 0, generatedAt: null, executiveSummary: 'Ainda não gerada — disponível após o envio do questionário.',
        strengths: [], goals: [], painPoints: [], opportunities: [], suggestedQuestions: [], businessMaturity: '—',
      },
      meeting: { title: 'E1 — Extração e Essência', transcriptUploaded: false, status: 'scheduled' },
      transcriptAnalysis: null,
      playbook: { versions: [] },
      assessment: { title: 'Teste de Arquétipos', description: 'Uma breve avaliação externa para identificar seu arquétipo de marca dominante.', externalUrl: 'https://example.com/archetype-test', status: 'not_started' },
      // In-progress attempt — 20 of 48 answered, demonstrates save-and-resume.
      archetypeQuiz: { visualSet: null, notes: '', attempts: [] },
      pitches: null,
      homework: [
        { id: 'h1', title: 'Ler o Playbook', type: 'boolean', status: 'pending' },
        { id: 'h2', title: 'Gravação do Pitch (áudio ou vídeo)', type: 'media_upload', status: 'pending', submissions: [] },
        { id: 'h3', title: 'Perguntas de Reflexão', type: 'text_submission', status: 'pending', submission: '' },
      ],
      activity: [
        { type: 'onboarding_info_submitted', text: 'Informações de cadastro enviadas para o contrato', at: '2026-08-10T09:00:00' },
      ],
      playbookExperience: { format: null, completedAt: null },
      quiz: { score: null, total: null, completedAt: null },
      meetingRequests: [],
      notes: '',
      moodLog: [],
    },

    // client-5 (Camila Rocha) removed per request — eliminated, no
    // dependent records left (her only reference, assistantMessages am2,
    // was removed above).

    // client-6 (Débora Lima) removed — confirmed seeded/demo data
    // representing the retired Ascensão de Imagem program (never went
    // through real Autentique: autentique_document_id was null; her only
    // "payment" was a seeded mock row, not a real SumUp transaction).
    // Removed together with her dependent pendingReviews (rev3) and
    // assistantMessages (am1, am3) entries above.
    // See Production Audit Remediation Pass, High 8.
    // --- Client 7: Fernanda — just converted from a lead, hasn't filled out
    // her onboarding info yet. This is the "very visible" blocker case: her
    // contract can't even be prepared until she submits it — see
    // getClientsAwaitingInfo() and everywhere it's surfaced.
    'client-7': {
      profile: { id: 'client-7', fullName: 'Fernanda Lima', email: 'fernanda@example.com', status: 'onboarding', tier: 'essential', phaseIndex: 0, programSlug: 'persea-essential', gender: null },
      onboarding: {
        clientInfo: {
          submitted: false, fullName: 'Fernanda Lima', partyType: 'PF', cpf: '', cnpj: null, companyName: null,
          address: '', email: 'fernanda@example.com', whatsapp: '(31) 90000-0007',
        },
        contract: { program: null, duration: null, status: 'info_pending', value: null, signedFileName: null, notes: 'Convertida de lead — aguardando preenchimento das informações para preparar o contrato.', paymentMethod: null, installments: null },
        whatsappGroup: { status: 'not_added' },
      },
      payments: [],
      brandDirection: {
        pinterestUrl: null, moodBoardIntro: '', positioningSummary: '', keywords: [], tone: '', references: [],
        guidance: '', belongs: [], doesntBelong: [], updatedAt: null,
      },
      brandIdeas: '',
      guideAcknowledged: false,
      images: [],
      imagesStatus: 'aguardando_envio',
      imagesNote: '',
      photoReminder: { sentAt: null, note: '' },
      whatsappNotes: [],
      contentActivity: { status: 'not_started', submission: '', feedback: '', updatedAt: null },
      imageProjectStatus: 'not_started',
      imageGuides: [{ slug: 'paleta_cores', fileUrl: null, note: '' }, { slug: 'estilo', fileUrl: null, note: '' }, { slug: 'moodboard_ensaio', fileUrl: null, note: '' }, { slug: 'guia_looks_mensal', fileUrl: null, note: '' }],
      digitalKit: { fileUrl: null },
      hublaAccess: { status: 'not_granted', grantedAt: null },
      programHistory: [{ programSlug: 'persea-essential', changedAt: null, changedBy: 'seed' }],
      journey: {
        programName: 'Identidade',
        steps: [
          { key: 'questionnaire', title: 'Extração de Marca', status: 'locked' },
          { key: 'meeting_1', title: 'E1 — Extração e Essência', status: 'locked' },
          { key: 'playbook_review', title: 'Playbook de Marca Pessoal', status: 'locked' },
          { key: 'assessment', title: 'Teste de Arquétipos', status: 'locked' },
          { key: 'pitch', title: 'Gerador de Pitch', status: 'locked' },
          { key: 'homework', title: 'Tarefas', status: 'locked' },
        ],
        upcomingMeeting: { title: 'E1 — Extração e Essência — a agendar após onboarding', date: '2026-08-27T10:00:00' },
      },
      questionnaire: {
        title: 'Extração de Marca',
        questions: [
          { id: 'q1', text: 'Pelo que você quer ser conhecida daqui a 3 anos?', type: 'long_text', answer: '' },
          { id: 'q2', text: 'O que parece mais verdadeiro sobre quem você é agora?', type: 'long_text', answer: '' },
          { id: 'q3', text: 'Qual é a transformação que você ajuda as pessoas a fazerem?', type: 'long_text', answer: '' },
          { id: 'q4', text: 'Avalie sua confiança atual na sua marca pessoal (1-10)', type: 'scale', answer: '' },
        ],
        status: 'not_started',
      },
      questionnaireAnalysis: {
        version: 0, generatedAt: null, executiveSummary: 'Ainda não gerada — disponível após o envio do questionário.',
        strengths: [], goals: [], painPoints: [], opportunities: [], suggestedQuestions: [], businessMaturity: '—',
      },
      meeting: { title: 'E1 — Extração e Essência', transcriptUploaded: false, status: 'scheduled' },
      transcriptAnalysis: null,
      playbook: { versions: [] },
      assessment: { title: 'Teste de Arquétipos', description: 'Uma breve avaliação externa para identificar seu arquétipo de marca dominante.', externalUrl: 'https://example.com/archetype-test', status: 'not_started' },
      archetypeQuiz: { visualSet: null, notes: '', attempts: [] },
      pitches: null,
      homework: [
        { id: 'h1', title: 'Ler o Playbook', type: 'boolean', status: 'pending' },
        { id: 'h2', title: 'Gravação do Pitch (áudio ou vídeo)', type: 'media_upload', status: 'pending', submissions: [] },
        { id: 'h3', title: 'Perguntas de Reflexão', type: 'text_submission', status: 'pending', submission: '' },
      ],
      activity: [{ type: 'lead_converted', text: 'Convertida de lead para cliente', at: '2026-08-17T09:00:00' }],
      playbookExperience: { format: null, completedAt: null },
      quiz: { score: null, total: null, completedAt: null },
      meetingRequests: [],
      notes: '',
      moodLog: [],
    },
  },
};

// Frozen snapshot of every individual_meeting's original seeded
// {status, recording} by id, captured once here before anything in a
// session can mutate it — what "Restaurar demonstração" resets back to.
const RECORDING_SEED_SNAPSHOT = Object.fromEntries(
  SEED.agendaItems
    .filter((a) => a.type === 'individual_meeting' && a.recording)
    .map((a) => [a.id, structuredClone({ status: a.status, recording: a.recording })]),
);

// Production Audit — Final Production-Readiness Pass, section 3/20:
// production must start clean, never falling back to the rich demo fixture
// set. Keeps genuine shared business configuration (tenant settings,
// template library, content categories, the shared resource library —
// none of that is client/lead-specific demo data) and empties every
// per-lead/per-client/per-transaction collection, so an admin page on
// app.naymurta.com genuinely shows zero clients/leads rather than Bruna,
// Adriana, etc. — same codebase, same seed shape, just started empty.
//
// Known, deliberately out-of-scope-for-this-pass limitation: the
// client-facing pages (dashboard, program, financial, questionnaire...)
// identify "which client is this" purely via getActiveClientId()'s
// localStorage convenience, with zero binding to the real logged-in
// Supabase profile — there is currently no path that puts a real activated
// client into MockDB.clients at all (the real activation flow writes to
// Supabase via ensureRealClientForLead, not here). Emptying clients here is
// still correct — it stops fake demo clients from ever appearing as if
// real — but it means those client-facing pages have no working path for
// an actual production client yet either; that is a real, separate
// architecture gap, not something this seed change can fix, and is
// reported as a launch risk rather than silently left to crash confusingly.
function productionEmptySeed() {
  return {
    ...structuredClone(SEED),
    businessValueAssessments: {}, priceHistory: [], premiumUpgradeInterests: [],
    expenses: [], leads: [], groupDynamics: [], resourceAssignments: [],
    agendaItems: [], encounterRequests: [], pendingReviews: [], assistantMessages: [],
    clients: {},
  };
}

function load() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    const seeded = isProductionEnvironment() ? productionEmptySeed() : structuredClone(SEED);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
    return seeded;
  }
  return JSON.parse(raw);
}

function save(db) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
}

function delay(ms = 500) {
  return new Promise((r) => setTimeout(r, ms));
}

function client(db, id) {
  return db.clients[id];
}

// The Nova Persea registration form's shape — a superset of the older
// onboarding.clientInfo (same fullName/partyType/cpf/cnpj/companyName/
// email/whatsapp field names, so nothing downstream that already reads
// clientInfo breaks), plus the structured personal/address fields the new
// contract-prep step needs. See activateLead for how this merges into a
// client's real onboarding.clientInfo once she's activated.
function blankRegistrationInfo() {
  return {
    submitted: false, fullName: '', socialName: '', birthDate: '', partyType: 'PF', cpf: '', rg: '',
    profession: '', nationality: '', maritalStatus: '', cnpj: null, companyName: null,
    email: '', whatsapp: '',
    cep: '', street: '', number: '', complement: '', neighborhood: '', city: '', state: '',
  };
}

// --- Leitura Estratégica de Valor private helpers ---------------------------
// --- Program Hub private helpers -------------------------------------------
// Client-friendly primary-action copy per activity+status — the Painel's
// "one primary next action" and each Hub card's button both read from here.
const PROGRAM_ACTIVITY_PRIMARY_ACTION = {
  'brand-extraction': { not_started: 'Iniciar Extração de Marca', in_progress: 'Continuar Extração de Marca', completed: 'Ver Extração de Marca' },
  'archetype-test': { not_started: 'Iniciar teste', in_progress: 'Continuar teste', completed: 'Ver meu resultado' },
  'business-survey': { not_started: 'Responder pesquisa', completed: 'Ver minhas respostas' },
  'activity-guide': { not_started: 'Ver Guia de Atividades', completed: 'Ver Guia de Atividades' },
  'initial-images': {
    not_started: 'Enviar imagens', in_progress: 'Continuar envio de imagens', submitted: 'Ver imagens enviadas',
    in_analysis: 'Ver imagens enviadas', novas_solicitadas: 'Enviar novas imagens', completed: 'Ver imagens aprovadas',
  },
  'brand-direction': { not_started: 'Ver Direção da Marca', in_progress: 'Revisar Direção da Marca', completed: 'Revisar Direção da Marca' },
  pitch: { not_started: 'Preparar Pitch', in_progress: 'Continuar Pitch', completed: 'Ver Pitch' },
  content: { not_started: 'Iniciar Conteúdo', in_progress: 'Continuar Conteúdo', submitted: 'Ver envio', feedback_available: 'Ver devolutiva', completed: 'Ver Conteúdo' },
  business: {
    not_started: 'Iniciar Business', in_progress: 'Continuar Business', submitted: 'Ver status do Business',
    in_analysis: 'Ver status do Business', feedback_available: 'Ver devolutiva do Business',
  },
};
function activityPrimaryActionLabel(slug, status) {
  return (PROGRAM_ACTIVITY_PRIMARY_ACTION[slug] || {})[status] || `Abrir ${PROGRAM_ACTIVITY_LABEL[slug] || slug}`;
}
// The archetype quiz's client-facing status — same "derive from the real
// record, never a separate flag" rule as everything else here. The latest
// attempt (there's at most one non-completed attempt at a time; see
// getOrCreateActiveArchetypeAttempt) decides it.
function archetypeQuizStatusFor(c) {
  const attempts = (c.archetypeQuiz && c.archetypeQuiz.attempts) || [];
  if (!attempts.length) return 'not_started';
  const latest = attempts[attempts.length - 1];
  if (latest.status === 'completed') return 'completed';
  if (latest.status === 'in_progress') return 'in_progress';
  return 'not_started';
}

// Derives a program activity's client-facing status from the *existing*
// underlying feature it wraps — never a separate/duplicated progress row —
// so the Painel and the Program Hub, which both call this, can never drift
// out of sync with each other or with the feature's own page.
function deriveActivityStatus(c, slug) {
  // Teste de Arquétipos is available to every client, on every program,
  // from the moment her contract is signed — never gated behind a program
  // tier (see PROGRAM_ACTIVITY_ACCESS: 'archetype-test' is 'included'
  // everywhere) or behind reaching a later phase. Checked before the
  // onboarding/active branches below so a legacy `journey.steps`
  // "assessment" entry seeded 'locked' can never override this — the
  // contract being signed is the one real prerequisite, same as Extração
  // de Marca.
  if (slug === 'archetype-test') {
    return c.onboarding.contract.status === 'completed' ? archetypeQuizStatusFor(c) : 'locked';
  }
  // Pesquisa de Precificação (see BUSINESS_SURVEY_QUESTIONS) — same rule as
  // the archetype quiz: available the moment the contract's signed, never
  // gated behind a later phase.
  if (slug === 'business-survey') {
    if (c.onboarding.contract.status !== 'completed') return 'locked';
    return (c.businessSurvey && c.businessSurvey.status === 'submitted') ? 'completed' : 'not_started';
  }
  // Extração de Marca is the other activity a client can (and should) start
  // *during* onboarding — as soon as her contract is signed and filed, not
  // only after the full onboarding sequence (WhatsApp group, resources)
  // finishes. Everything else stays locked until she's fully active.
  // Bypasses the legacy per-step `journey.steps` lock below (which only
  // starts advancing post-onboarding), since a freshly-signed client's
  // journey steps are still seeded 'locked'.
  if (c.profile.status === 'onboarding') {
    if (slug !== 'brand-extraction') return 'locked';
    if (c.onboarding.contract.status !== 'completed') return 'locked';
    return c.questionnaire.status === 'submitted' ? 'completed' : 'in_progress';
  }
  const stepMap = { 'brand-extraction': 'questionnaire', pitch: 'pitch' };
  if (stepMap[slug]) {
    const step = (c.journey.steps || []).find((s) => s.key === stepMap[slug]);
    const base = step ? step.status : 'locked';
    if (base === 'locked') return 'locked';
    if (slug === 'brand-extraction') return c.questionnaire.status === 'submitted' ? 'completed' : 'in_progress';
    if (slug === 'pitch') return c.pitches ? 'completed' : (base === 'available' ? 'not_started' : base);
  }
  if (slug === 'activity-guide') return c.guideAcknowledged ? 'completed' : 'not_started';
  if (slug === 'initial-images') {
    const map = {
      aguardando_envio: 'not_started', envio_iniciado: 'in_progress', enviado: 'submitted',
      em_analise: 'in_analysis', novas_solicitadas: 'novas_solicitadas', aprovado: 'completed',
    };
    return map[c.imagesStatus] || 'not_started';
  }
  if (slug === 'brand-direction') {
    const bd = c.brandDirection;
    const hasContent = Boolean(bd.pinterestUrl || bd.positioningSummary || bd.tone || bd.guidance || (bd.keywords || []).length);
    if (!hasContent) return 'not_started';
    return c.brandIdeas ? 'completed' : 'in_progress';
  }
  if (slug === 'content') return c.contentActivity.status;
  return 'locked';
}

// A "mentor deliverable" — client-friendly framing over an existing,
// already-tracked fact (never a new stored status), so it can't drift from
// what admin/assistant already see. Client language only: em_preparacao /
// pronto / entregue, per the "she should never think she needs to complete
// this herself" requirement — see MENTOR_DELIVERABLE_STATUS_LABEL.
function mentorDeliverable(db, c, key) {
  const base = { key, label: MENTOR_DELIVERABLE_LABEL[key] };
  switch (key) {
    case 'extraction_analysis':
      return { ...base, description: 'Nay está lendo suas respostas para entender sua essência e seus objetivos.',
        status: (c.questionnaireAnalysis && c.questionnaireAnalysis.generatedAt) ? 'entregue' : 'em_preparacao' };
    case 'archetype_reading':
      return { ...base, description: 'Nay está conectando os arquétipos que mais apareceram à sua imagem e ao seu posicionamento.',
        status: c.archetypeQuiz.notes ? 'entregue' : 'em_preparacao' };
    case 'materials_analysis':
      return { ...base, description: 'A equipe está analisando as fotos que você enviou.',
        status: c.imagesStatus === 'aprovado' ? 'entregue' : 'em_preparacao' };
    case 'image_project':
      return { ...base, description: 'Seu projeto de imagem, organizado pela equipe a partir das suas fotos.',
        status: c.imageProjectStatus === 'created' ? 'pronto' : 'em_preparacao' };
    case 'image_guides': {
      const guides = (c.imageGuides || []).filter((g) => g.slug === 'paleta_cores' || g.slug === 'estilo');
      const delivered = guides.filter((g) => g.fileUrl).length;
      return { ...base, description: 'Sua paleta de cores e guia de estilo.',
        status: delivered && delivered === guides.length ? 'entregue' : (delivered ? 'pronto' : 'em_preparacao') };
    }
    case 'mood_photo': {
      const g = (c.imageGuides || []).find((g) => g.slug === 'moodboard_ensaio');
      return { ...base, description: 'Mood fotográfico para orientar seu próximo ensaio.', status: g && g.fileUrl ? 'entregue' : 'em_preparacao' };
    }
    case 'positioning_direction':
      return { ...base, description: 'Direção de comunicação e posicionamento de marca.',
        status: c.brandDirection.guidance ? 'entregue' : 'em_preparacao' };
    case 'pitch_feedback':
      return { ...base, description: 'Devolutiva sobre sua apresentação/pitch.', status: c.pitches ? 'entregue' : 'em_preparacao' };
    case 'content_feedback':
      return { ...base, description: 'Devolutiva sobre o conteúdo que você produziu.', status: c.contentActivity.status === 'feedback_available' ? 'entregue' : 'em_preparacao' };
    case 'value_reading': {
      const isPremium = c.profile.programSlug === 'persea-premium';
      const rec = db.businessValueAssessments[c.profile.id];
      const status = !isPremium ? null : (rec && rec.status === 'published' ? 'entregue' : (rec ? 'em_preparacao' : 'em_preparacao'));
      return { ...base, description: 'Leitura estratégica do seu negócio, sua oferta e sua precificação.', status, premiumOnly: !isPremium };
    }
    case 'digital_kit':
      return { ...base, description: 'Template editável para suas redes sociais.', status: c.digitalKit && c.digitalKit.fileUrl ? 'entregue' : 'em_preparacao' };
    default:
      return { ...base, description: '', status: 'em_preparacao' };
  }
}

// Blank recording/transcript bundle for a freshly-created individual
// meeting — nothing has happened yet, so both statuses sit at their
// "not there yet" resting state until the meeting actually finishes.
function blankMeetingRecording() {
  return {
    recordingStatus: 'aguardando', transcriptStatus: 'nao_aplicavel',
    recordingUrl: null, transcriptUrl: null,
    requiresAttention: false, attentionNote: '',
    sync: { lastCheckedAt: null, nextCheckAt: null, googleAccount: 'nay@persea.com.br', syncStatus: 'aguardando', attempts: 0 },
  };
}

function newValueAssessmentRecord(clientId) {
  const now = new Date().toISOString();
  return {
    id: `bva${Date.now()}`, clientId, status: 'available', questionnaireVersion: 1,
    startedAt: null, submittedAt: null, analysisStartedAt: null, publishedAt: null, updatedAt: now,
    answers: blankAssessmentAnswers(),
    reviewStatus: {}, internalNotes: {}, scenarios: [], recommendation: null, publishedDeliverable: null,
  };
}
// Sets a dotted path ('s1.profession') on the assessment's answers object —
// every simple (non-repeatable) field goes through this, repeatable groups
// (offers/fixedCosts/variableCosts/references) have their own item CRUD.
function setAnswerPath(answers, path, value) {
  const parts = path.split('.');
  let obj = answers;
  for (let i = 0; i < parts.length - 1; i++) obj = obj[parts[i]];
  obj[parts[parts.length - 1]] = value;
}
function resolveValueGroup(rec, groupKey) {
  if (groupKey === 'offers') return rec.answers.offers;
  if (groupKey === 'fixedCosts') return rec.answers.fixedCosts;
  if (groupKey === 'variableCosts') return rec.answers.variableCosts;
  if (groupKey === 'references') return rec.answers.s6.references;
  return null;
}
const VALUE_GROUP_BLANK = { offers: blankOffer, fixedCosts: blankFixedCost, variableCosts: blankVariableCost, references: blankReference };

export const MockDB = {
  reset() {
    localStorage.removeItem(STORAGE_KEY);
    return load();
  },
  get() {
    return load();
  },

  logActivity(id, type, text) {
    const db = load();
    client(db, id).activity.unshift({ type, text, at: new Date().toISOString() });
    save(db);
  },

  // --- Clients / CRM ---
  listClients() {
    const db = load();
    return Object.values(db.clients).map((c) => {
      const completedSteps = c.journey.steps.filter((s) => s.status === 'completed').length;
      const journeyPct = Math.round((completedSteps / c.journey.steps.length) * 100);
      const homeworkPct = Math.round((c.homework.filter((t) => t.status === 'completed').length / c.homework.length) * 100);
      return {
        ...c.profile, journeyPct, homeworkPct,
        onboardingStage: c.onboarding.contract.status, whatsappStatus: c.onboarding.whatsappGroup.status,
        program: c.onboarding.contract.program || null, infoSubmitted: c.onboarding.clientInfo.submitted,
      };
    });
  },
  getClient(id = DEFAULT_CLIENT_ID) {
    // accessStatus defaults to 'created' (full access, no interstitial) for
    // every pre-existing/legacy client — only activateLead explicitly sets
    // 'pending' on a freshly-activated one, so this stays invisible unless
    // a client actually goes through the new invitation step.
    return { accessStatus: 'created', ...load().clients[id].profile };
  },
  getTenant() {
    return load().tenant;
  },
  // Stand-in for accepting a real Supabase invite/magic-link — there is no
  // real auth in this prototype (see delivery report), so this just marks
  // the interstitial as done. No password is ever generated or stored;
  // wiring this to a real invite flow later only needs this one function's
  // body replaced, nothing that calls it.
  createClientAccess(id) {
    const db = load();
    const c = client(db, id);
    if (!c) return null;
    c.profile.accessStatus = 'created';
    save(db);
    this.logActivity(id, 'access_created', 'Acesso ao Persea OS criado pela cliente');
    return c.profile;
  },
  setTenantHublaAllContentUrl(url) {
    const db = load();
    db.tenant.hublaAllContentUrl = url;
    save(db);
    return db.tenant;
  },
  // Template Library — see TEMPLATE_CATEGORIES for the editable shape.
  // admin/templates.js writes here; assistant/templates.js only ever reads.
  getTemplateLibrary() {
    return load().templateLibrary;
  },
  setTemplateLink(categoryKey, itemKey, url) {
    const db = load();
    db.templateLibrary[categoryKey] = db.templateLibrary[categoryKey] || {};
    db.templateLibrary[categoryKey][itemKey] = (url || '').trim();
    save(db);
    return db.templateLibrary;
  },
  getPhaseProgress(id = DEFAULT_CLIENT_ID) {
    const p = client(load(), id).profile;
    return { tier: p.tier, phases: TIER_PHASES[p.tier], currentIndex: p.phaseIndex };
  },
  // The client's guided journey — Program -> Phase -> Encounter -> Client
  // activities -> Mentor deliverables, per PROGRAM_PHASES above. Reads only
  // already-existing per-client facts (getProgramActivities, encounter
  // journey, brandDirection, imageGuides, etc.) — nothing stored here can
  // disagree with what those same facts show elsewhere (Program Hub,
  // Painel, admin). currentIndex reuses profile.phaseIndex, the exact same
  // manually-advanced field the phase tracker already uses — phase
  // progression stays a deliberate/Nay-driven action, not auto-computed
  // from "all tasks checked," per the "don't over-engineer" instruction.
  getClientJourney(id = DEFAULT_CLIENT_ID) {
    const db = load();
    const c = db.clients[id];
    if (!c) return null;
    const currentIndex = c.profile.phaseIndex || 0;
    const activityBySlug = Object.fromEntries(this.getProgramActivities(id).map((a) => [a.slug, a]));
    const encountersByPhase = {};
    this.getEncounterJourney(id).forEach((e) => { (encountersByPhase[e.phase] = encountersByPhase[e.phase] || []).push(e); });
    const phaseNames = TIER_PHASES[c.profile.tier] || TIER_PHASES.essential;
    const phases = PROGRAM_PHASES.map((p) => {
      const activities = p.clientActivitySlugs.map((slug) => activityBySlug[slug]).filter(Boolean);
      const includedActivities = activities.filter((a) => a.access === 'included');
      const doneCount = includedActivities.filter((a) => ['completed', 'feedback_available'].includes(a.status)).length;
      const mentorDeliverables = p.mentorDeliverableKeys.map((key) => mentorDeliverable(db, c, key)).filter((d) => d.status !== null);
      // Essencial sees Fase 4 too, just locked as a Premium teaser — never
      // filtered out entirely (see PREMIUM_ONLY_PHASE_INDEX). Gated on
      // programSlug, not tier — programSlug is the documented sole
      // authority for program identity/access everywhere else in this file
      // (getProgramActivities, getEncounterJourney, etc.); this was the one
      // place still reading the cosmetic `tier` field for a real gating
      // decision, flagged by the Production Audit as an inconsistency
      // (Débora Lima/client-6 had tier:'premium' with a non-Premium program,
      // which made this line disagree with every other Premium check in
      // the app). Fixed per the Remediation Pass's "normalize program
      // gating to one canonical source" requirement.
      const premiumLocked = p.id === PREMIUM_ONLY_PHASE_INDEX && c.profile.programSlug !== 'persea-premium';
      return {
        id: p.id, name: phaseNames[p.id] || `Fase ${p.id + 1}`, description: p.description, premiumLocked,
        status: p.id < currentIndex ? 'completed' : p.id === currentIndex ? 'current' : 'upcoming',
        activities, mentorDeliverables, encounters: encountersByPhase[p.id] || [],
        progress: { completed: doneCount, total: includedActivities.length, pct: includedActivities.length ? Math.round((doneCount / includedActivities.length) * 100) : 0 },
      };
    });
    return { phases, currentIndex, tier: c.profile.tier, programSlug: c.profile.programSlug };
  },

  // --- Program Hub ---
  // programSlug is the sole authority for program identity/access (see the
  // note above PROGRAM_DEFS) — `tier` only still drives the phase-ladder
  // widget above and is otherwise cosmetic.
  getClientProgram(id = DEFAULT_CLIENT_ID) {
    const c = client(load(), id);
    if (!c) return null;
    const slug = c.profile.programSlug || 'persea-essential';
    return PROGRAM_DEFS.find((p) => p.slug === slug) || PROGRAM_DEFS[0];
  },
  // The complete, ordered activity set for this client's enrolled program,
  // each with an access type (included/premium_preview) and a status
  // computed live from the real underlying feature — never a stored
  // duplicate, so this can never drift from what those pages show.
  getProgramActivities(id = DEFAULT_CLIENT_ID) {
    const db = load();
    const c = db.clients[id];
    if (!c) return [];
    const programSlug = c.profile.programSlug || 'persea-essential';
    const accessMap = PROGRAM_ACTIVITY_ACCESS[programSlug] || {};
    return PROGRAM_ACTIVITIES.map((def) => {
      const access = accessMap[def.slug] || 'unavailable';
      let status;
      if (access === 'premium_preview') {
        status = 'premium_preview';
      } else if (def.slug === 'business') {
        const va = this.getValueAnalysisAccess(id);
        const map = { locked_plan: 'locked', upcoming: 'locked', available: 'not_started', in_progress: 'in_progress', submitted: 'submitted', in_analysis: 'in_analysis', published: 'feedback_available' };
        status = map[va && va.status] || 'locked';
      } else {
        status = deriveActivityStatus(c, def.slug);
      }
      return {
        ...def, access, status,
        statusLabel: PROGRAM_ACTIVITY_STATUS_LABEL[status] || status,
        badgeClass: PROGRAM_ACTIVITY_STATUS_BADGE_CLASS[status] || 'badge-locked',
        primaryActionLabel: access === 'premium_preview' ? null : activityPrimaryActionLabel(def.slug, status),
      };
    });
  },
  // Progress counts only activities actually included in this client's
  // program — Premium-preview activities never reduce a non-Premium
  // client's percentage (per spec's explicit requirement).
  getProgramProgress(id = DEFAULT_CLIENT_ID) {
    const c = client(load(), id);
    const activities = this.getProgramActivities(id);
    const included = activities.filter((a) => a.access === 'included');
    const completed = included.filter((a) => ['completed', 'feedback_available'].includes(a.status));
    const pct = included.length ? Math.round((completed.length / included.length) * 100) : 0;
    // "Next" must be something she can actually act on right now — never a
    // still-locked activity (nothing to click yet) or a premium preview
    // (not hers to open) — AND it has to belong to her *current* phase.
    // Some activities can technically read as "not_started" ahead of her
    // real phase (deriveActivityStatus unlocks by feature-completion chains,
    // independent of profile.phaseIndex) — she shouldn't be nudged to act on
    // something from a phase Nay hasn't actually moved her into yet.
    const currentPhaseSlugs = new Set((PROGRAM_PHASES[(c && c.profile.phaseIndex) || 0] || {}).clientActivitySlugs || []);
    const nextActivity = included.find((a) => currentPhaseSlugs.has(a.slug) && !['completed', 'feedback_available', 'locked', 'premium_preview'].includes(a.status)) || null;
    return { totalIncluded: included.length, completedCount: completed.length, pct, nextActivity };
  },
  // The Painel's one primary next action.
  getNextAction(id = DEFAULT_CLIENT_ID) {
    const progress = this.getProgramProgress(id);
    if (!progress.nextActivity) return null;
    const a = progress.nextActivity;
    return { activitySlug: a.slug, title: a.title, label: a.primaryActionLabel, route: a.route };
  },
  // Everything actionable besides the one primary next action — the
  // Painel's "Outras pendências". Scoped to her current phase only, same
  // reasoning as getProgramProgress's nextActivity above: a pendência is
  // only ever something missing *for the phase she's actually in* — nothing
  // from a phase she hasn't reached, and nothing already behind her once
  // Nay's moved her forward (that's just history now, browsable on Minha
  // Jornada, never a nag on the Painel). Homework stays unscoped since it
  // isn't part of the phase system at all (see note below).
  getOtherPendingItems(id = DEFAULT_CLIENT_ID) {
    const db = load();
    const c = db.clients[id];
    if (!c) return [];
    const progress = this.getProgramProgress(id);
    const currentPhaseSlugs = new Set((PROGRAM_PHASES[c.profile.phaseIndex || 0] || {}).clientActivitySlugs || []);
    const activities = this.getProgramActivities(id).filter((a) => a.access === 'included' && currentPhaseSlugs.has(a.slug));
    const items = activities
      .filter((a) => !['completed', 'feedback_available', 'locked'].includes(a.status) && a.slug !== (progress.nextActivity && progress.nextActivity.slug))
      .map((a) => ({ kind: 'activity', key: a.slug, title: a.title, label: a.primaryActionLabel, route: a.route }));
    // Homework isn't part of the activity matrix/phase system (no
    // clientActivitySlugs entry) — it's a separate, ongoing responsibility,
    // so it's never phase-scoped the way activities above are.
    (c.homework || []).filter((t) => t.status !== 'completed').forEach((t) => {
      items.push({ kind: 'homework', key: t.id, title: t.title, label: 'Abrir Tarefas', route: 'homework.html' });
    });
    return items;
  },
  // Curated, non-technical timeline for the Painel — a small allowlist of
  // meaningful event types, not the full activity log (that stays on
  // activity.html, reachable but off the main nav).
  getRecentProgressTimeline(id = DEFAULT_CLIENT_ID, limit = 5) {
    const MEANINGFUL = new Set([
      'questionnaire_submitted', 'assessment_completed', 'images_uploaded', 'direction_approved',
      'meeting_analyzed', 'playbook_published', 'pitches_generated', 'material_published',
    ]);
    return this.getActivity(id).filter((e) => MEANINGFUL.has(e.type)).slice(0, limit);
  },

  // --- Activity Guide (tenant-level PDF, same admin-editable-URL pattern
  // as the Conteúdos gateway's Hubla link) ---
  getActivityGuide() {
    return load().tenant.activityGuide;
  },
  // Note: MockDB.getClient() returns only the .profile slice, not this
  // sibling field — use this accessor instead of reading .guideAcknowledged
  // off getClient()'s result.
  isGuideAcknowledged(id = DEFAULT_CLIENT_ID) {
    return Boolean(client(load(), id).guideAcknowledged);
  },
  setActivityGuidePdf(url) {
    const db = load();
    db.tenant.activityGuide.pdfUrl = url;
    db.tenant.activityGuide.version += 1;
    db.tenant.activityGuide.publishedAt = new Date().toISOString();
    save(db);
    return db.tenant.activityGuide;
  },
  acknowledgeActivityGuide(id = DEFAULT_CLIENT_ID) {
    const db = load();
    client(db, id).guideAcknowledged = true;
    save(db);
  },

  // --- Imagens (initial images upload) ---
  // dataUrl-based mock upload (no real storage backend) — clearly a
  // prototype convention, same as homework.js's media submissions.
  getClientImages(id = DEFAULT_CLIENT_ID) {
    const c = client(load(), id);
    return { images: c.images, status: c.imagesStatus, note: c.imagesNote };
  },
  addClientImage(id, { dataUrl, fileName }) {
    const db = load();
    const c = client(db, id);
    const img = { id: `img${Date.now()}${Math.random().toString(36).slice(2, 6)}`, dataUrl, fileName, uploadedAt: new Date().toISOString() };
    c.images.push(img);
    if (c.imagesStatus === 'aguardando_envio' || c.imagesStatus === 'novas_solicitadas' || c.imagesStatus === 'envio_iniciado') c.imagesStatus = 'enviado';
    // Uploading is the client's answer to a pending reminder — clear it so
    // the banner in images.js doesn't keep nagging after she's responded.
    c.photoReminder = { sentAt: null, note: '' };
    save(db);
    this.logActivity(id, 'images_uploaded', `${c.images.length} imagem${c.images.length === 1 ? '' : 'ns'} enviada${c.images.length === 1 ? '' : 's'}`);
    return img;
  },
  // Assistant-triggered nudge — used when Projeto de Imagem/Guia de
  // Produções/Mood Fotográfico are blocked on the client's own photos (see
  // assistant/client-workspace.js). Shows as a banner on images.html until
  // she uploads (addClientImage clears it) or the assistant clears it.
  getPhotoReminder(id = DEFAULT_CLIENT_ID) {
    return client(load(), id).photoReminder;
  },
  sendPhotoReminder(id, note = '') {
    const db = load();
    const c = client(db, id);
    c.photoReminder = { sentAt: new Date().toISOString(), note };
    save(db);
    this.logActivity(id, 'photo_reminder_sent', 'Lembrete de envio de fotos enviado à cliente');
    return c.photoReminder;
  },
  removeClientImage(id, imageId) {
    const db = load();
    const c = client(db, id);
    c.images = c.images.filter((i) => i.id !== imageId);
    save(db);
  },
  setClientImagesNote(id, note) {
    const db = load();
    client(db, id).imagesNote = note;
    save(db);
  },
  // Admin-only status transitions (review, request replacement, approve).
  setClientImagesStatus(id, status, { note } = {}) {
    const db = load();
    const c = client(db, id);
    c.imagesStatus = status;
    if (note !== undefined) c.imagesNote = note;
    save(db);
    if (status === 'aprovado') this.logActivity(id, 'direction_approved', 'Imagens aprovadas pela equipe');
    return c;
  },

  // --- Conteúdo (practical content activity — distinct from the Conteúdos
  // gateway/Hubla page; this is the client's in-program content work) ---
  getContentActivity(id = DEFAULT_CLIENT_ID) {
    return client(load(), id).contentActivity;
  },
  saveContentActivitySubmission(id, text) {
    const db = load();
    const c = client(db, id);
    c.contentActivity.submission = text;
    c.contentActivity.status = text ? 'submitted' : 'not_started';
    c.contentActivity.updatedAt = new Date().toISOString();
    save(db);
  },
  saveContentActivityFeedback(id, feedback) {
    const db = load();
    const c = client(db, id);
    c.contentActivity.feedback = feedback;
    c.contentActivity.status = 'feedback_available';
    c.contentActivity.updatedAt = new Date().toISOString();
    save(db);
    this.logActivity(id, 'material_published', 'Devolutiva de Conteúdo publicada');
  },
  setContentActivityStatus(id, status) {
    const db = load();
    const c = client(db, id);
    c.contentActivity.status = status;
    c.contentActivity.updatedAt = new Date().toISOString();
    save(db);
  },

  // --- Program enrollment changes (admin) ---
  // Preserves all progress by construction: since progress is computed live
  // from the underlying features (never a duplicated table), nothing needs
  // migrating — switching programSlug just changes which activities count.
  upgradeClientProgram(id, newProgramSlug) {
    const db = load();
    const c = client(db, id);
    const now = new Date().toISOString();
    c.profile.programSlug = newProgramSlug;
    if (newProgramSlug === 'persea-premium') c.profile.tier = 'premium';
    (c.programHistory || (c.programHistory = [])).push({ programSlug: newProgramSlug, changedAt: now, changedBy: 'nay' });
    save(db);
    return c.profile;
  },
  getProgramHistory(id = DEFAULT_CLIENT_ID) {
    return client(load(), id).programHistory || [];
  },

  // --- Journey ---
  getJourney(id = DEFAULT_CLIENT_ID) {
    return client(load(), id).journey;
  },

  // --- Questionnaire ---
  getQuestionnaire(id = DEFAULT_CLIENT_ID) {
    return client(load(), id).questionnaire;
  },
  saveAnswer(id, questionId, value) {
    const db = load();
    const q = client(db, id).questionnaire.questions.find((q) => q.id === questionId);
    if (q) q.answer = value;
    save(db);
  },
  submitQuestionnaire(id) {
    const db = load();
    client(db, id).questionnaire.status = 'submitted';
    save(db);
    this.logActivity(id, 'questionnaire_submitted', 'Extração de Marca concluída');
  },

  // --- AI: Questionnaire Analysis ---
  getQuestionnaireAnalysis(id = DEFAULT_CLIENT_ID) {
    return client(load(), id).questionnaireAnalysis;
  },
  async regenerateQuestionnaireAnalysis(id) {
    await delay(1200);
    const db = load();
    const c = client(db, id);
    c.questionnaireAnalysis = {
      ...c.questionnaireAnalysis,
      version: c.questionnaireAnalysis.version + 1,
      generatedAt: new Date().toISOString(),
      executiveSummary: c.questionnaireAnalysis.executiveSummary + ' (regenerado — conteúdo de exemplo, sem chamada real ao modelo neste protótipo)',
    };
    save(db);
    return c.questionnaireAnalysis;
  },

  // --- Meeting / Transcript ---
  getMeeting(id = DEFAULT_CLIENT_ID) {
    return client(load(), id).meeting;
  },
  getTranscriptAnalysis(id = DEFAULT_CLIENT_ID) {
    return client(load(), id).transcriptAnalysis;
  },
  async uploadTranscript(id) {
    await delay(800);
    const db = load();
    const c = client(db, id);
    c.meeting.transcriptUploaded = true;
    c.meeting.status = 'transcript_uploaded';
    save(db);
  },
  async analyzeTranscript(id) {
    await delay(1200);
    const db = load();
    const c = client(db, id);
    c.meeting.status = 'analyzed';
    if (!c.transcriptAnalysis) {
      c.transcriptAnalysis = {
        version: 1,
        summary: 'Resumo gerado a partir da transcrição enviada (conteúdo de exemplo — sem chamada real ao modelo neste protótipo).',
        goals: ['Objetivo identificado na conversa 1', 'Objetivo identificado na conversa 2'],
        challenges: ['Desafio mencionado pela cliente'],
        actionItems: ['Ação combinada em reunião'],
        homework: ['Ler o Playbook', 'Gravar o pitch'],
        keyInsights: ['Insight-chave extraído da conversa.'],
      };
    }
    save(db);
    this.logActivity(id, 'meeting_analyzed', 'Transcrição da reunião analisada');
    return c.transcriptAnalysis;
  },

  // --- Playbook ---
  getPlaybook(id = DEFAULT_CLIENT_ID) {
    return client(load(), id).playbook;
  },
  getSectionDefs() {
    return [
      ['identity', 'Identidade'], ['mission', 'Missão'], ['vision', 'Visão'],
      ['core_story', 'História Central'], ['golden_circle', 'Círculo Dourado'],
      ['target_audience', 'Público-Alvo'], ['value_proposition', 'Proposta de Valor'],
      ['positioning', 'Posicionamento'], ['brand_voice', 'Voz da Marca'],
      ['communication_style', 'Estilo de Comunicação'], ['goals', 'Objetivos'],
      ['pitch_30s', 'Pitch de 30 Segundos'], ['action_plan', 'Plano de Ação'],
    ];
  },
  async generatePlaybookDraft(id) {
    await delay(1500);
    const db = load();
    const c = client(db, id);
    const prior = c.playbook.versions[c.playbook.versions.length - 1];
    const newVersion = {
      version: prior ? prior.version + 1 : 1,
      status: 'draft',
      createdAt: new Date().toISOString(),
      sections: prior ? { ...prior.sections } : Object.fromEntries(this.getSectionDefs().map(([key]) => [key, 'Conteúdo de exemplo gerado pela IA — edite antes de publicar.'])),
    };
    c.playbook.versions.push(newVersion);
    save(db);
    this.logActivity(id, 'playbook_draft_created', `Rascunho do Playbook v${newVersion.version} gerado`);
    return newVersion;
  },
  saveSectionEdit(id, version, sectionKey, content) {
    const db = load();
    const v = client(db, id).playbook.versions.find((v) => v.version === version);
    if (v) v.sections[sectionKey] = content;
    save(db);
  },
  publishPlaybook(id, version) {
    const db = load();
    const c = client(db, id);
    c.playbook.versions.forEach((v) => {
      if (v.version === version) { v.status = 'published'; v.publishedAt = new Date().toISOString(); }
      else if (v.status === 'published') { v.status = 'archived'; }
    });
    save(db);
    this.logActivity(id, 'playbook_published', `Playbook v${version} publicado`);
  },
  getPublishedPlaybook(id = DEFAULT_CLIENT_ID) {
    const c = client(load(), id);
    return c.playbook.versions.find((v) => v.status === 'published') || null;
  },
  getBook(id = DEFAULT_CLIENT_ID) {
    return client(load(), id).book || null;
  },

  // --- Assessment (legacy external-link stub — superseded by the real,
  // in-house Teste de Arquétipos below; kept only so nothing that still
  // reads it breaks. Not used for gating the archetype-test activity
  // anymore — see archetypeQuizStatusFor.) ---
  getAssessment(id = DEFAULT_CLIENT_ID) {
    return client(load(), id).assessment;
  },
  markAssessmentComplete(id) {
    const db = load();
    client(db, id).assessment.status = 'completed';
    save(db);
    this.logActivity(id, 'assessment_completed', 'Teste de Arquétipos concluído');
  },

  // --- Teste de Arquétipos (Persea Archetype Quiz) -----------------------
  // One quiz, one scoring system for every client — see ARCHETYPE_* consts
  // above for the statements/scoring map (transcribed from Nay's workbook)
  // and archetypeQuizStatusFor for how this feeds the Program Hub activity
  // system. Scores are always computed live from stored 1-5 responses
  // (calcArchetypeScores) — never trusted from anywhere else, never stored
  // pre-computed — so there's nothing for a client to tamper with beyond
  // her own answers, and no risk of a persisted result drifting from what
  // the responses actually say.
  getClientArchetypeQuiz(id = DEFAULT_CLIENT_ID) {
    const c = client(load(), id);
    return c.archetypeQuiz || { visualSet: null, notes: '', attempts: [] };
  },
  // The one attempt currently open (not_started slot or in_progress) — a
  // client only ever has at most one non-completed attempt; completed ones
  // are historical and untouchable (see submitArchetypeQuiz/unlockArchetypeRetake).
  getOrCreateActiveArchetypeAttempt(id = DEFAULT_CLIENT_ID) {
    const db = load();
    const c = client(db, id);
    if (!c.archetypeQuiz) c.archetypeQuiz = { visualSet: null, notes: '', attempts: [] };
    const attempts = c.archetypeQuiz.attempts;
    const last = attempts[attempts.length - 1];
    if (last && last.status !== 'completed') return last;
    const attempt = {
      id: `aq${Date.now()}`, quizVersion: ARCHETYPE_QUIZ_VERSION, status: 'in_progress',
      startedAt: new Date().toISOString(), completedAt: null, responses: {}, activityLogged: false,
    };
    attempts.push(attempt);
    save(db);
    return attempt;
  },
  getArchetypeAttempt(id, attemptId) {
    return this.getClientArchetypeQuiz(id).attempts.find((a) => a.id === attemptId) || null;
  },
  getArchetypeAttemptProgress(attempt) {
    const answered = Object.keys(attempt.responses).length;
    return { answered, total: ARCHETYPE_QUIZ_QUESTIONS.length, pct: Math.round((answered / ARCHETYPE_QUIZ_QUESTIONS.length) * 100) };
  },
  // Autosave — one statement at a time, no separate "Save" step. Validates
  // the score server-side (1-5 integer) regardless of what the UI already
  // enforces, per "do not trust client-provided data" — this is the actual
  // trust boundary in this architecture (see the file header comment).
  saveArchetypeResponse(id, attemptId, questionNumber, score) {
    const db = load();
    const c = client(db, id);
    const attempt = (c.archetypeQuiz?.attempts || []).find((a) => a.id === attemptId);
    if (!attempt || attempt.status === 'completed') return null;
    const n = Number(score);
    if (!Number.isInteger(n) || n < 1 || n > 5) return null;
    if (!ARCHETYPE_BY_QUESTION[questionNumber]) return null;
    attempt.responses[questionNumber] = n;
    save(db);
    return attempt;
  },
  // Pure calculation — sum of each archetype's 4 mapped responses (4-20),
  // percentage of the 20-point max, and rank with explicit tie handling:
  // equal raw scores share the same rank (1,1,3-style, standard competition
  // ranking), never arbitrarily broken. Returns all 12, always — no
  // archetype is ever hidden, per "everyone carries all 12."
  calcArchetypeScores(responses) {
    const scored = ARCHETYPE_DEFS.map((def) => {
      const questions = ARCHETYPE_QUESTION_MAP[def.slug];
      const rawScore = questions.reduce((sum, q) => sum + (Number(responses[q]) || 0), 0);
      return { slug: def.slug, name: def.name, rawScore, percentage: Math.round((rawScore / 20) * 100) };
    });
    scored.sort((a, b) => b.rawScore - a.rawScore);
    let rank = 0; let prevScore = null;
    scored.forEach((s, i) => {
      if (s.rawScore !== prevScore) rank = i + 1;
      s.rank = rank;
      prevScore = s.rawScore;
    });
    return scored;
  },
  // Transparent tie detection at the "featured top 3" boundary — if a 4th+
  // archetype ties the 3rd-place score, all of them stay part of the
  // featured group rather than one being arbitrarily dropped.
  getArchetypeFeaturedGroup(scored) {
    const thirdRank = scored[2] ? scored[2].rank : null;
    const featured = thirdRank === null ? scored : scored.filter((s) => s.rank <= thirdRank);
    return { featured, hasTie: featured.length > 3 };
  },
  // Validates every one of the 48 questions is answered before allowing
  // submission — the UI already prevents this, but the trust boundary is
  // here, not there.
  submitArchetypeQuiz(id, attemptId) {
    const db = load();
    const c = client(db, id);
    const attempt = (c.archetypeQuiz?.attempts || []).find((a) => a.id === attemptId);
    if (!attempt) return { ok: false, error: 'not_found' };
    if (attempt.status === 'completed') return { ok: true, attempt }; // idempotent — already done
    const unanswered = ARCHETYPE_QUIZ_QUESTIONS.filter((q) => !(q.number in attempt.responses));
    if (unanswered.length) return { ok: false, error: 'incomplete', missing: unanswered.map((q) => q.number) };
    attempt.status = 'completed';
    attempt.completedAt = new Date().toISOString();
    // Determine visual set now if we already know it (from profile) so the
    // results page never has to ask what it already knows.
    if (!c.archetypeQuiz.visualSet) {
      if (c.profile.gender === 'feminino') c.archetypeQuiz.visualSet = 'female';
      else if (c.profile.gender === 'masculino') c.archetypeQuiz.visualSet = 'male';
    }
    // Idempotent follow-up guard, decided and flagged *before* this save —
    // every mutation on this `db` reference has to happen before its one
    // save() call, since createAgendaItem/logActivity below each load and
    // save their own fresh copy; saving this stale local `db` again after
    // them would silently wipe out whatever they just persisted.
    const sourceKey = `archetype-quiz-review-${attempt.id}`;
    const alreadyTasked = db.agendaItems.some((a) => a.sourceKey === sourceKey);
    const needsFollowUp = !attempt.activityLogged && !alreadyTasked;
    attempt.activityLogged = true;
    save(db);
    this.logActivity(id, 'archetype_quiz_completed', 'Teste de Arquétipos concluído');
    if (needsFollowUp) {
      this.createAgendaItem({
        type: 'admin_task', title: `Revisar resultado do Teste de Arquétipos — ${c.profile.fullName}`,
        date: new Date().toISOString(), status: 'upcoming', relatedStudentId: id,
        topic: 'Cliente concluiu o Teste de Arquétipos — revisar o resultado antes do próximo encontro.',
        assignedTo: 'nay', sourceKey,
      });
    }
    return { ok: true, attempt };
  },
  // The latest completed attempt — "current" per the retake rule (never
  // overwritten, always additive; see unlockArchetypeRetake).
  getLatestCompletedArchetypeAttempt(id) {
    const attempts = this.getClientArchetypeQuiz(id).attempts;
    return attempts.filter((a) => a.status === 'completed').slice(-1)[0] || null;
  },
  // Full results bundle for display — scores, featured/tie group, and the
  // gender-appropriate portrait set. Returns null if nothing's completed
  // yet (screens should check getClientArchetypeQuiz status before calling).
  getArchetypeResults(id) {
    const quiz = this.getClientArchetypeQuiz(id);
    const attempt = this.getLatestCompletedArchetypeAttempt(id);
    if (!attempt) return null;
    const scored = this.calcArchetypeScores(attempt.responses);
    const { featured, hasTie } = this.getArchetypeFeaturedGroup(scored);
    const visualSet = quiz.visualSet || (client(load(), id).profile.gender === 'masculino' ? 'male' : 'female');
    const withDetail = scored.map((s) => {
      const def = ARCHETYPE_DEFS.find((d) => d.slug === s.slug);
      return {
        ...s,
        centralDesire: def.centralDesire, potentials: def.potentials, caution: def.caution, visualDirection: def.visualDirection,
        image: visualSet === 'male' ? def.maleImage : def.femaleImage,
      };
    });
    return {
      attemptId: attempt.id, completedAt: attempt.completedAt, visualSet,
      scores: withDetail, featured: withDetail.filter((s) => featured.some((f) => f.slug === s.slug)), hasTie,
      notes: quiz.notes || '',
    };
  },
  // Whether the one-time visual-set question still needs asking — true only
  // when neither the profile nor a prior answer/correction has settled it.
  needsArchetypeVisualSetPrompt(id) {
    const c = client(load(), id);
    if (c.archetypeQuiz?.visualSet) return false;
    return !c.profile.gender;
  },
  setArchetypeVisualSet(id, visualSet) {
    const db = load();
    const c = client(db, id);
    if (!c.archetypeQuiz) c.archetypeQuiz = { visualSet: null, notes: '', attempts: [] };
    c.archetypeQuiz.visualSet = visualSet;
    save(db);
    this.logActivity(id, 'archetype_visual_set_changed', `Coleção visual do resultado: ${ARCHETYPE_VISUAL_SET_LABEL[visualSet]}`);
    return c.archetypeQuiz;
  },
  saveArchetypeNotes(id, text) {
    const db = load();
    const c = client(db, id);
    if (!c.archetypeQuiz) c.archetypeQuiz = { visualSet: null, notes: '', attempts: [] };
    c.archetypeQuiz.notes = text;
    save(db);
  },
  // Nay-only: opens a fresh attempt slot without touching any previous
  // completed one — see the module header comment on retakes.
  unlockArchetypeRetake(id) {
    const db = load();
    const c = client(db, id);
    if (!c.archetypeQuiz) c.archetypeQuiz = { visualSet: null, notes: '', attempts: [] };
    const last = c.archetypeQuiz.attempts[c.archetypeQuiz.attempts.length - 1];
    if (last && last.status !== 'completed') return last; // already has an open slot
    const attempt = {
      id: `aq${Date.now()}`, quizVersion: ARCHETYPE_QUIZ_VERSION, status: 'in_progress',
      startedAt: new Date().toISOString(), completedAt: null, responses: {}, activityLogged: false,
    };
    c.archetypeQuiz.attempts.push(attempt);
    save(db);
    this.logActivity(id, 'archetype_retake_unlocked', 'Nay liberou um novo teste de arquétipos');
    return attempt;
  },

  // --- Dev-only archetype quiz simulation — see the "Controles da
  // demonstração" panel on the quiz/results pages. Removable wholesale
  // once real auth/profiles are connected; nothing here is read by any
  // production code path.
  devSetArchetypeGender(id, gender) {
    const db = load();
    const c = client(db, id);
    c.profile.gender = gender;
    if (c.archetypeQuiz) c.archetypeQuiz.visualSet = null; // let it re-resolve from the new gender
    save(db);
  },
  devSimulateArchetypeInProgress(id) {
    const db = load();
    const c = client(db, id);
    if (!c.archetypeQuiz) c.archetypeQuiz = { visualSet: null, notes: '', attempts: [] };
    const responses = {};
    for (let i = 1; i <= 24; i++) responses[i] = ((i * 3) % 5) + 1;
    c.archetypeQuiz.attempts.push({
      id: `aq${Date.now()}`, quizVersion: ARCHETYPE_QUIZ_VERSION, status: 'in_progress',
      startedAt: new Date().toISOString(), completedAt: null, responses, activityLogged: false,
    });
    save(db);
  },
  // withTie=true deliberately produces two archetypes tied for 3rd place,
  // for previewing the tie-transparency UI without hand-crafting answers.
  devSimulateArchetypeCompleted(id, { withTie = false } = {}) {
    const db = load();
    const c = client(db, id);
    if (!c.archetypeQuiz) c.archetypeQuiz = { visualSet: null, notes: '', attempts: [] };
    const responses = {};
    for (let i = 1; i <= 48; i++) responses[i] = ((i * 7) % 5) + 1;
    if (withTie) {
      // Force sage and ruler (2nd/3rd) to the same score as creator (4th),
      // producing a clean 3-way tie right at the featured-group boundary.
      ARCHETYPE_QUESTION_MAP.creator.forEach((q, i) => { responses[q] = [5, 5, 4, 4][i]; });
      ARCHETYPE_QUESTION_MAP.ruler.forEach((q, i) => { responses[q] = [5, 5, 4, 4][i]; });
      ARCHETYPE_QUESTION_MAP.sage.forEach((q, i) => { responses[q] = [5, 5, 4, 4][i]; });
    }
    c.archetypeQuiz.attempts.push({
      id: `aq${Date.now()}`, quizVersion: ARCHETYPE_QUIZ_VERSION, status: 'completed',
      startedAt: new Date().toISOString(), completedAt: new Date().toISOString(), responses, activityLogged: true,
    });
    save(db);
  },
  devResetArchetypeQuiz(id) {
    const db = load();
    const c = client(db, id);
    c.archetypeQuiz = { visualSet: null, notes: '', attempts: [] };
    save(db);
  },

  // --- Pitch ---
  getPitches(id = DEFAULT_CLIENT_ID) {
    return client(load(), id).pitches;
  },
  async generatePitches(id) {
    await delay(1200);
    const db = load();
    const c = client(db, id);
    c.pitches = {
      version: 1,
      pitch_10s: 'Transformo especialistas invisíveis em autoridades reconhecidas.',
      pitch_30s: 'Ajudo especialistas de alto nível a transformarem sua expertise silenciosa em uma marca que as pessoas realmente notam — sem soar como todo mundo na categoria.',
      pitch_60s: 'A maioria dos especialistas que conheço é melhor do que sua reputação sugere. Eu ajudo a fechar essa lacuna — afiando o posicionamento, a história e o discurso — para que a percepção finalmente corresponda ao nível em que realmente atuam.',
      pitch_networking: 'Trabalho com especialistas que são ótimos no que fazem, mas esquecíveis em como se descrevem — eu resolvo a parte da descrição.',
      instagram_bio: 'Estrategista de marca para especialistas ✨ Transformando expertise silenciosa em autoridade visível.',
      linkedin_summary: 'Ajudo consultores e coaches estabelecidos a fecharem a lacuna entre sua real expertise e como são percebidos — com posicionamento mais afiado, uma história mais clara e um discurso que realmente convence.',
    };
    save(db);
    this.logActivity(id, 'pitches_generated', 'Variações de pitch geradas');
    return c.pitches;
  },

  // --- Homework ---
  getHomework(id = DEFAULT_CLIENT_ID) {
    return client(load(), id).homework;
  },
  toggleHomework(id, taskId) {
    const db = load();
    const t = client(db, id).homework.find((t) => t.id === taskId);
    if (t) t.status = t.status === 'completed' ? 'pending' : 'completed';
    save(db);
  },
  submitHomeworkText(id, taskId, text) {
    const db = load();
    const t = client(db, id).homework.find((t) => t.id === taskId);
    if (t) { t.submission = text; t.status = text.trim() ? 'completed' : 'pending'; }
    save(db);
  },
  homeworkCompletionPct(id = DEFAULT_CLIENT_ID) {
    const hw = client(load(), id).homework;
    return Math.round((hw.filter((t) => t.status === 'completed').length / hw.length) * 100);
  },

  // --- Pitch practice recordings ---
  // Uses object URLs (blob:...) so they play back within this browser tab/session.
  // A real build stores these in Supabase Storage instead; the URL only needs to
  // survive the session here, matching how far this prototype goes without a backend.
  addHomeworkMedia(id, taskId, file) {
    const db = load();
    const t = client(db, id).homework.find((t) => t.id === taskId);
    if (!t) return;
    if (!t.submissions) t.submissions = [];
    t.submissions.push({
      id: `m${Date.now()}`,
      kind: file.type.startsWith('video') ? 'video' : 'audio',
      name: file.name,
      url: URL.createObjectURL(file),
      uploadedAt: new Date().toISOString(),
    });
    t.status = 'completed';
    save(db);
    this.logActivity(id, 'pitch_recording_uploaded', 'Nova gravação de prática do pitch enviada');
  },
  removeHomeworkMedia(id, taskId, submissionId) {
    const db = load();
    const t = client(db, id).homework.find((t) => t.id === taskId);
    if (!t) return;
    t.submissions = (t.submissions || []).filter((s) => s.id !== submissionId);
    if (t.submissions.length === 0) t.status = 'pending';
    save(db);
  },

  // --- Playbook experience (podcast / video / audiobook) ---
  getPlaybookExperience(id = DEFAULT_CLIENT_ID) {
    return client(load(), id).playbookExperience;
  },
  completePlaybookExperience(id, format) {
    const db = load();
    client(db, id).playbookExperience = { format, completedAt: new Date().toISOString() };
    save(db);
    this.logActivity(id, 'playbook_experienced', `Playbook vivenciado em formato ${format}`);
  },

  // --- Quiz: short, fun check on what the client just learned ---
  getQuiz(id = DEFAULT_CLIENT_ID) {
    return client(load(), id).quiz;
  },
  buildQuizQuestions(id = DEFAULT_CLIENT_ID) {
    const published = this.getPublishedPlaybook(id);
    if (!published) return [];
    const s = published.sections;
    const DECOYS = {
      positioning: ['A opção mais barata do mercado para qualquer perfil de cliente.', 'Alguém que atende qualquer segmento, sem distinção.'],
      mission: ['Vender o máximo de serviços possível, independente do encaixe.', 'Ser conhecida por estar em todas as redes sociais ao mesmo tempo.'],
      target_audience: ['Qualquer pessoa disposta a pagar, sem critério de encaixe.', 'Apenas grandes empresas com equipes de marketing próprias.'],
      pitch_30s: ['Um resumo técnico do currículo, sem conexão com o cliente.', 'Uma lista de certificados e ferramentas dominadas.'],
    };
    const bank = [
      ['positioning', 'Qual é o seu posicionamento?'],
      ['mission', 'Qual é a sua missão?'],
      ['target_audience', 'Quem é o seu público-alvo?'],
      ['pitch_30s', 'Qual é o seu pitch de 30 segundos?'],
    ];
    return bank
      .filter(([key]) => s[key])
      .map(([key, question]) => {
        const options = shuffle([s[key], ...DECOYS[key]]);
        return { key, question, options, correct: s[key] };
      });
  },
  submitQuiz(id, score, total) {
    const db = load();
    client(db, id).quiz = { score, total, completedAt: new Date().toISOString() };
    save(db);
    this.logActivity(id, 'quiz_completed', `Quiz do playbook concluído (${score}/${total})`);
  },

  // --- Activity ---
  getActivity(id = DEFAULT_CLIENT_ID) {
    return client(load(), id).activity;
  },

  // --- Meeting requests ---
  getMeetingRequests(id = DEFAULT_CLIENT_ID) {
    return client(load(), id).meetingRequests;
  },
  requestMeeting(id, reason) {
    const db = load();
    const req = { id: `mr${Date.now()}`, reason, status: 'pending', assignedTo: null, createdAt: new Date().toISOString() };
    client(db, id).meetingRequests.unshift(req);
    save(db);
    this.logActivity(id, 'meeting_requested', 'Solicitou uma reunião para tirar dúvidas');
    return req;
  },
  listAllMeetingRequests() {
    const db = load();
    const all = [];
    Object.entries(db.clients).forEach(([id, c]) => {
      c.meetingRequests.forEach((r) => all.push({ ...r, clientId: id, clientName: c.profile.fullName }));
    });
    return all.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  },
  assignMeetingRequest(clientId, requestId, assignee) {
    const db = load();
    const r = client(db, clientId).meetingRequests.find((r) => r.id === requestId);
    if (r) { r.status = 'assigned'; r.assignedTo = assignee; }
    save(db);
  },
  resolveMeetingRequest(clientId, requestId) {
    const db = load();
    const r = client(db, clientId).meetingRequests.find((r) => r.id === requestId);
    if (r) r.status = 'done';
    save(db);
  },

  // --- Private client notepad ---
  getNotes(id = DEFAULT_CLIENT_ID) {
    return client(load(), id).notes;
  },
  saveNotes(id, text) {
    const db = load();
    client(db, id).notes = text;
    save(db);
  },

  // --- E2's short pricing survey (see BUSINESS_SURVEY_QUESTIONS) ---
  getBusinessSurvey(id = DEFAULT_CLIENT_ID) {
    const c = client(load(), id);
    return (c && c.businessSurvey) || { status: 'not_started', responses: {}, submittedAt: null };
  },
  submitBusinessSurvey(id, responses) {
    const db = load();
    const c = client(db, id);
    if (!c) return null;
    c.businessSurvey = { status: 'submitted', responses, submittedAt: new Date().toISOString() };
    save(db);
    this.logActivity(id, 'business_survey_submitted', 'Pesquisa de precificação enviada.');
    return c.businessSurvey;
  },

  // --- Programa tab profile — photo + the WHO/WHAT/WHY/HOW summary Nay
  // fills in from E1/E2, so this reads as "who is this client" at a glance
  // instead of scrolling activity statuses to piece it together. ---
  getClientProfileSummary(id = DEFAULT_CLIENT_ID) {
    const c = client(load(), id);
    return {
      photoUrl: (c && c.photoUrl) || null,
      who: (c && c.summary && c.summary.who) || '',
      what: (c && c.summary && c.summary.what) || '',
      why: (c && c.summary && c.summary.why) || '',
      how: (c && c.summary && c.summary.how) || '',
    };
  },
  setClientProfileSummary(id, { photoUrl, who, what, why, how }) {
    const db = load();
    const c = client(db, id);
    if (!c) return null;
    if (photoUrl !== undefined) c.photoUrl = photoUrl || null;
    c.summary = { who: who || '', what: what || '', why: why || '', how: how || '' };
    save(db);
    return this.getClientProfileSummary(id);
  },

  // --- Playbooks — split in two (Nova Persea): the Personal Brand Playbook
  // (presented at E4) and the Business Playbook (presented at E6). Both are
  // links Nay builds externally and pastes in herself — no in-system
  // generator for either, so this is never something the client sees as
  // "ready" before Nay actually decided it was.
  getPlaybookLinks(id = DEFAULT_CLIENT_ID) {
    const c = client(load(), id);
    return {
      personalPlaybookUrl: (c && c.personalPlaybookUrl) || null, personalPlaybookDeliveredAt: (c && c.personalPlaybookDeliveredAt) || null,
      businessPlaybookUrl: (c && c.businessPlaybookUrl) || null, businessPlaybookDeliveredAt: (c && c.businessPlaybookDeliveredAt) || null,
    };
  },
  setPersonalPlaybookUrl(id, url) {
    const db = load();
    const c = client(db, id);
    if (!c) return null;
    c.personalPlaybookUrl = url || null;
    c.personalPlaybookDeliveredAt = url ? new Date().toISOString() : null;
    save(db);
    if (url) this.logActivity(id, 'playbook_published', 'Playbook de Marca Pessoal enviado.');
    return this.getPlaybookLinks(id);
  },
  setBusinessPlaybookUrl(id, url) {
    const db = load();
    const c = client(db, id);
    if (!c) return null;
    c.businessPlaybookUrl = url || null;
    c.businessPlaybookDeliveredAt = url ? new Date().toISOString() : null;
    save(db);
    if (url) this.logActivity(id, 'material_published', 'Business Playbook enviado.');
    return this.getPlaybookLinks(id);
  },

  // --- Mood check-ins (for later satisfaction/experience metrics) ---
  logMood(id, context, mood) {
    const db = load();
    client(db, id).moodLog.push({ context, mood, at: new Date().toISOString() });
    save(db);
  },
  getMoodLog(id = DEFAULT_CLIENT_ID) {
    return client(load(), id).moodLog;
  },
  getMoodStats(id = DEFAULT_CLIENT_ID) {
    return moodStatsFor(client(load(), id).moodLog);
  },
  getGlobalMoodStats() {
    const db = load();
    const all = Object.values(db.clients).flatMap((c) => c.moodLog);
    return moodStatsFor(all);
  },

  // --- Onboarding (pre-Phase-1) — docs/PERSEA_METHODOLOGY.md §2 ---
  getOnboarding(id = DEFAULT_CLIENT_ID) {
    return client(load(), id).onboarding;
  },
  // The one gate that blocks Seu Programa/Conteúdos and shows a prompt
  // everywhere else in the client's view (see renderShell in ui.js): the
  // signed contract isn't archived yet. Mirrors the "done" flag already
  // used by the onboarding checklist (getOnboardingChecklist's 'contract'
  // item) so there's exactly one definition of "onboarding complete."
  needsOnboardingCompletion(id = DEFAULT_CLIENT_ID) {
    return this.getOnboarding(id).contract.status !== 'completed';
  },
  saveClientInfo(id, info) {
    const db = load();
    const c = client(db, id);
    c.onboarding.clientInfo = { ...c.onboarding.clientInfo, ...info, submitted: true };
    if (c.onboarding.contract.status === 'info_pending') c.onboarding.contract.status = 'info_received';
    save(db);
    this.logActivity(id, 'onboarding_info_submitted', 'Informações de cadastro enviadas para o contrato');
  },
  setContractDuration(id, duration) {
    const db = load();
    const c = client(db, id);
    c.onboarding.contract.duration = duration || null;
    c.onboarding.contract.value = duration ? CONTRACT_DURATION_VALUE[duration] : null;
    save(db);
  },
  setContractProgram(id, program) {
    const db = load();
    const c = client(db, id);
    c.onboarding.contract.program = program || null;
    if (program === 'persea') {
      // Duration/value stay whatever they were (or null, until picked via setContractDuration).
      if (!CONTRACT_DURATIONS.includes(c.onboarding.contract.duration)) {
        c.onboarding.contract.duration = null;
        c.onboarding.contract.value = null;
      }
    } else {
      c.onboarding.contract.duration = null;
      c.onboarding.contract.value = null;
    }
    save(db);
  },
  // Real negotiated deals don't always land on a catalog price (custom
  // discount, bundled extra, etc.) — this lets Nay record what was actually
  // agreed on the closing call, independent of program/duration selection
  // above.
  //
  // Production Audit Remediation Pass (Medium — "Valor Total Acordado"):
  // this used to write straight into contract.value, the exact same field
  // setPaymentLines/renegotiatePaymentPlan silently overwrite with the sum
  // of the plan's lines — whichever ran more recently won, with no warning
  // if they disagreed. Now agreedValue is its own field: the explicit
  // number Nay typed here, never touched by the line-sum calculators.
  // contract.value stays what it always was — the calculated total from
  // the actual payment lines. See renderContractValueSection for how a
  // mismatch between the two is surfaced rather than silently resolved.
  setContractValue(id, value) {
    const db = load();
    const c = client(db, id);
    c.onboarding.contract.agreedValue = value || null;
    save(db);
  },
  advanceContractStatus(id, status) {
    const db = load();
    client(db, id).onboarding.contract.status = status;
    save(db);
    this.logActivity(id, 'contract_status_changed', `Status do contrato: ${ONBOARDING_STAGE_LABEL[status]}`);
  },
  async uploadSignedContract(id, fileName) {
    await delay(800);
    const db = load();
    const c = client(db, id);
    c.onboarding.contract.signedFileName = fileName;
    c.onboarding.contract.status = 'completed';
    save(db);
    this.logActivity(id, 'signed_contract_uploaded', 'Contrato assinado enviado para o perfil da cliente');
  },
  saveContractNotes(id, text) {
    const db = load();
    client(db, id).onboarding.contract.notes = text;
    save(db);
  },
  // Builds the actual installment schedule from what was agreed on the
  // closing call, replacing whatever payments array the client had before
  // (placeholder or a prior plan). Real deals are rarely one flat method
  // across every parcela — a down payment taken by Pix/transfer up front,
  // then the balance on card, are common — so the down payment and the
  // remaining installments each carry their own amount + payment method;
  // any individual row can still be fine-tuned afterward via updatePayment.
  // Monthly cadence: down payment on startDate, remaining installments one
  // per month starting the following month.
  // Replaces the whole payment schedule with a free-form, ordered list of
  // lines — no assumption that it's "entrada + N equal installments": an
  // extra deposit between card installments, uneven amounts, a mix of
  // methods in any order all just work, since each line is independent.
  // Matches the same model used for the real contract's payment clause
  // (see admin/contract.js's Condições Comerciais). Lines that carry the id
  // of a payment that already existed keep its paid/pending status and
  // paidAt — regenerating the plan never silently un-pays something that
  // was already collected; a line with no matching id is a brand-new entry.
  // Production Audit Remediation Pass (High 7): once the contract is signed
  // (onboarding.contract.status === 'completed'), the agreed plan is a
  // contractual baseline and must never be silently rewritten in place —
  // that includes changing an already-paid line's amount and removing
  // lines wholesale, not just typing new numbers over old ones. From that
  // point on, the only door for changing the plan is renegotiatePaymentPlan
  // below, which versions instead of overwriting. Before signing (still
  // 'info_pending'/'info_received'/'contract_prepared'/etc.), this keeps
  // behaving exactly as before — the plan hasn't been agreed to yet, so
  // free editing is correct.
  setPaymentLines(id, lines) {
    const db = load();
    const c = client(db, id);
    const contract = c.onboarding.contract;
    if (contract.status === 'completed') return { ok: false, error: 'plan_frozen' };
    const existingById = new Map((c.payments || []).map((p) => [p.id, p]));
    const cleaned = (lines || []).filter((l) => l.amount > 0);
    if (!cleaned.length) return null;
    c.payments = cleaned.map((l, i) => {
      const existing = l.id && existingById.get(l.id);
      return {
        id: existing ? existing.id : `p${id}-${Date.now()}-${i}`,
        dueDate: l.dueDate || new Date().toISOString().slice(0, 10),
        amount: Number(l.amount) || 0,
        method: l.method || null,
        label: l.label || null,
        status: existing ? existing.status : 'pending',
        paidAt: existing ? existing.paidAt : null,
      };
    });
    contract.value = cleaned.reduce((s, l) => s + (Number(l.amount) || 0), 0);
    contract.installments = cleaned.length;
    // Kept in sync so the existing "sold on card" NF-automation checks
    // elsewhere (assistant/financial.js, assistant/client-workspace.js),
    // which still read these flat fields, see the real methods in use.
    const methods = [...new Set(cleaned.map((l) => l.method).filter(Boolean))];
    contract.paymentMethods = methods;
    contract.paymentMethod = methods[0] || null;
    save(db);
    this.logActivity(id, 'payment_plan_set', `Plano de pagamento definido: ${cleaned.length} pagamento(s), total ${contract.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`);
    return c.payments;
  },
  // Returns the frozen version history for a signed client's payment plan —
  // empty until the first renegotiation. Version numbering starts at 1 for
  // the originally-signed plan (captured the first time
  // renegotiatePaymentPlan runs), so "Version 2" is always the first actual
  // renegotiation, matching the spec's wording.
  getPaymentPlanVersions(id) {
    const c = client(load(), id);
    return c.onboarding.paymentPlanVersions || [];
  },
  // Production Audit Remediation Pass (High 7): the ONLY way to change a
  // signed client's payment plan. Admin-only (assistant is blocked — see
  // authorization matrix: assistant never gets contractual/payment-plan
  // renegotiation). Never overwrites the original in place — snapshots the
  // current plan as the next version in history first (so "Version 1" is
  // always recoverable), then applies the new lines the same way
  // setPaymentLines does (preserving paid/pending status + paidAt for any
  // line whose id is reused). aditivoNeeded is optional and purely
  // informational for now, per the spec's "can remain optional for Admin
  // to decide later" — no addendum document is generated automatically.
  renegotiatePaymentPlan(id, lines, { reason = '', actorRole = 'admin', actorName = 'Nay', aditivoNeeded = false } = {}) {
    if (actorRole !== 'admin') return { ok: false, error: 'not_authorized' };
    const db = load();
    const c = client(db, id);
    const contract = c.onboarding.contract;
    if (contract.status !== 'completed') return { ok: false, error: 'no_signed_plan_yet' };
    const cleaned = (lines || []).filter((l) => l.amount > 0);
    if (!cleaned.length) return { ok: false, error: 'empty_plan' };

    if (!c.onboarding.paymentPlanVersions) c.onboarding.paymentPlanVersions = [];
    const now = new Date().toISOString();
    const nextVersion = c.onboarding.paymentPlanVersions.length + 1; // 1 = the plan as originally signed
    c.onboarding.paymentPlanVersions.push({
      version: nextVersion, lines: (c.payments || []).map((p) => ({ ...p })),
      totalValue: contract.value, changedAt: now, changedBy: actorName, reason, aditivoNeeded,
    });

    const existingById = new Map((c.payments || []).map((p) => [p.id, p]));
    c.payments = cleaned.map((l, i) => {
      const existing = l.id && existingById.get(l.id);
      return {
        id: existing ? existing.id : `p${id}-${Date.now()}-${i}`,
        dueDate: l.dueDate || new Date().toISOString().slice(0, 10),
        amount: Number(l.amount) || 0,
        method: l.method || null,
        label: l.label || null,
        status: existing ? existing.status : 'pending',
        paidAt: existing ? existing.paidAt : null,
      };
    });
    contract.value = cleaned.reduce((s, l) => s + (Number(l.amount) || 0), 0);
    contract.installments = cleaned.length;
    save(db);
    this.logActivity(id, 'payment_plan_renegotiated', `Plano de pagamento renegociado (versão ${nextVersion + 1}) por ${actorName}${reason ? ' — ' + reason : ''}.`);
    return { ok: true, payments: c.payments, version: nextVersion + 1 };
  },
  // Manual, one-off control over the schedule — for cases the generator
  // above doesn't cover (uneven amounts, an extra ad-hoc charge, fixing a
  // typo'd date).
  addPayment(id, { dueDate, amount, method }) {
    const db = load();
    const c = client(db, id);
    if (!c.payments) c.payments = [];
    const payment = { id: `p${id}-${Date.now()}`, dueDate, amount: Number(amount) || 0, method: method || null, status: 'pending', paidAt: null };
    c.payments.push(payment);
    c.payments.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
    save(db);
    this.logActivity(id, 'payment_added', `Parcela avulsa adicionada: ${payment.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} em ${dueDate}`);
    return payment;
  },
  removePayment(id, paymentId) {
    const db = load();
    const c = client(db, id);
    c.payments = (c.payments || []).filter((p) => p.id !== paymentId);
    save(db);
  },
  // Edits a single installment's date/amount in place — for correcting a
  // typo'd date or renegotiating one parcela without regenerating the
  // whole plan via setPaymentPlan.
  updatePayment(id, paymentId, patch) {
    const db = load();
    const p = (client(db, id).payments || []).find((p) => p.id === paymentId);
    if (p) Object.assign(p, patch);
    save(db);
    return p;
  },
  setWhatsappStatus(id, status) {
    const db = load();
    const c = client(db, id);
    c.onboarding.whatsappGroup.status = status;
    // The real (non-dev) activation trigger: WhatsApp added is the last
    // onboarding milestone, so this is where a client actually becomes
    // 'active' and the rest of the Program Hub unlocks. Previously only the
    // dev preview panel ever flipped this, so a real client who finished
    // onboarding through the normal admin flow would stay stuck 'locked'
    // out of everything except Extração de Marca/Teste de Arquétipos.
    if (status === 'added') c.profile.status = 'active';
    save(db);
    this.logActivity(id, 'whatsapp_status_changed', `Status do grupo de WhatsApp: ${WHATSAPP_STATUS_LABEL[status]}`);
  },
  // Acompanhamento de WhatsApp — a running internal log the assistant keeps
  // of anything worth Nay knowing from the client's WhatsApp thread (never
  // shown to the client). Newest first, same shape as activity log entries.
  getWhatsappNotes(id = DEFAULT_CLIENT_ID) {
    return client(load(), id).whatsappNotes;
  },
  addWhatsappNote(id, text) {
    const db = load();
    const c = client(db, id);
    c.whatsappNotes = [{ id: `wn${Date.now()}`, text, at: new Date().toISOString() }, ...c.whatsappNotes];
    save(db);
    this.logActivity(id, 'whatsapp_note_added', 'Nota de acompanhamento de WhatsApp registrada');
    return c.whatsappNotes;
  },
  getOnboardingSummary() {
    const db = load();
    const clients = Object.values(db.clients);
    const summary = { total: clients.length, stillOnboarding: 0, awaitingContractPrep: 0, awaitingSignature: 0, readyForPhase1: 0 };
    clients.forEach((c) => {
      const o = c.onboarding;
      if (o.contract.status !== 'completed') {
        summary.stillOnboarding++;
        if (['info_pending', 'info_received'].includes(o.contract.status)) summary.awaitingContractPrep++;
        if (['sent_for_signature', 'awaiting_signature'].includes(o.contract.status)) summary.awaitingSignature++;
      } else {
        const journeyStarted = c.journey.steps.some((s) => s.status !== 'locked');
        if (o.whatsappGroup.status === 'added' && !journeyStarted) summary.readyForPhase1++;
      }
    });
    return summary;
  },
  // The single most urgent onboarding blocker: a client whose own info was
  // never submitted, so her contract can't even be prepared yet. Surfaced
  // "everywhere" per Nay's request — admin dashboard, Clientes list,
  // client-detail banner, and the assistant's own checklist all read this
  // same list so it can never show up in one place and not another.
  getClientsAwaitingInfo() {
    const db = load();
    return Object.values(db.clients)
      .filter((c) => !c.onboarding.clientInfo.submitted)
      .map((c) => ({ id: c.profile.id, fullName: c.profile.fullName, email: c.profile.email }));
  },

  // --- Weekly Agenda (Nay's operational calendar) ---
  // NOTE: `journey.upcomingMeeting` (read directly by client/admin dashboard
  // "next meeting" cards) is intentionally left alone here, not derived from
  // agendaItems — several existing screens read it directly and changing
  // that is out of scope for this pass. The two are kept in sync by hand in
  // seed data. A later pass should make journey.upcomingMeeting a computed
  // read from agendaItems so there's one source of truth.
  getAgendaItems() {
    return load().agendaItems;
  },
  getAgendaItem(id) {
    return load().agendaItems.find((a) => a.id === id) || null;
  },
  createAgendaItem(data) {
    const db = load();
    const now = new Date().toISOString();
    const item = {
      id: `ag${Date.now()}`, type: 'admin_task', title: '', date: now, status: 'upcoming',
      relatedStudentId: null, relatedGroupLabel: null, topic: '', prepNotes: '', generalNotes: '',
      onlineLink: '', followUpNotes: '', createdAt: now, updatedAt: now, ...data,
    };
    // Every individual meeting gets a recording/transcript bundle so the
    // Gravações views never have to special-case "meeting has no bundle
    // yet" — see blankMeetingRecording.
    if (item.type === 'individual_meeting') {
      if (!item.recording) item.recording = blankMeetingRecording();
      if (item.durationMinutes === undefined) item.durationMinutes = 60;
    }
    db.agendaItems.push(item);
    save(db);
    return item;
  },
  // --- Encontro scheduling requests. Nay proposes one or more candidate
  // times (see ENCOUNTER_PREP_CHECKLIST for her prep checklist) -> client
  // either picks one or, if none work, sends back an observation about her
  // availability instead -> Nay confirms a final time -> real agendaItem.
  // States: awaiting_client_response -> (client_selected_time |
  // client_unavailable) -> ... -> confirmed | cancelled. A decline loops
  // back to awaiting_client_response once Nay proposes new times, so the
  // same request keeps its full history instead of spawning a new one.
  getEncounterRequests(clientId) {
    return load().encounterRequests.filter((r) => r.clientId === clientId);
  },
  listAllEncounterRequests() {
    return load().encounterRequests;
  },
  // checklist: [{ label, done }]; proposedTimes: array of ISO strings.
  requestEncounterMeeting(clientId, encounterNumber, checklist, proposedTimes) {
    const db = load();
    const req = {
      id: `encreq${Date.now()}`, clientId, encounterNumber, checklist,
      status: 'awaiting_client_response', proposedTimes: proposedTimes || [],
      selectedTime: null, clientNote: null,
      requestedAt: new Date().toISOString(), respondedAt: null, confirmedAgendaItemId: null,
    };
    db.encounterRequests.push(req);
    save(db);
    return req;
  },
  // Client picks one of Nay's suggested times.
  selectEncounterMeetingTime(requestId, iso) {
    const db = load();
    const r = db.encounterRequests.find((r) => r.id === requestId);
    if (!r) return null;
    r.selectedTime = iso;
    r.status = 'awaiting_nay_confirmation';
    r.respondedAt = new Date().toISOString();
    save(db);
    return r;
  },
  // None of the suggested times work — client sends an observation about
  // her real availability instead of a specific slot. Nay reads it and
  // either proposes new times or confirms one directly.
  declineEncounterMeetingTimes(requestId, note) {
    const db = load();
    const r = db.encounterRequests.find((r) => r.id === requestId);
    if (!r) return null;
    r.status = 'client_unavailable';
    r.clientNote = note || '';
    r.respondedAt = new Date().toISOString();
    save(db);
    return r;
  },
  // Nay re-proposes after a decline — keeps the same request (and the
  // client's note, for context) rather than starting a new one.
  proposeNewEncounterMeetingTimes(requestId, proposedTimes) {
    const db = load();
    const r = db.encounterRequests.find((r) => r.id === requestId);
    if (!r) return null;
    r.proposedTimes = proposedTimes || [];
    r.selectedTime = null;
    r.status = 'awaiting_client_response';
    save(db);
    return r;
  },
  // The one door into a real agendaItem for one of these requests — same
  // "derive, don't duplicate" rule as everywhere else: once confirmed, the
  // request just points at the agendaItem it created (confirmedAgendaItemId)
  // rather than keeping its own separate copy of the schedule. isoOverride
  // lets Nay confirm a time she picked herself (e.g. after reading a
  // client_unavailable note) instead of the client's selectedTime.
  confirmEncounterMeeting(requestId, isoOverride) {
    const db = load();
    const r = db.encounterRequests.find((r) => r.id === requestId);
    const iso = isoOverride || (r && r.selectedTime);
    if (!r || !iso) return null;
    const def = ENCOUNTER_DEFS[r.encounterNumber - 1];
    const assignedTo = r.encounterNumber === 3 ? 'assistant' : 'nay';
    const item = this.createAgendaItem({
      type: 'individual_meeting', title: `E${def.number} — ${def.name}`, date: iso,
      relatedStudentId: r.clientId, topic: def.purpose, assignedTo, assistantPersona: assignedTo === 'assistant' ? 'ju' : null,
    });
    r.status = 'confirmed';
    r.selectedTime = iso;
    r.confirmedAgendaItemId = item.id;
    save(db);
    this.logActivity(r.clientId, 'encounter_scheduled', `${ENCOUNTER_LABEL[def.slug]} agendado para ${new Date(iso).toLocaleString('pt-BR')}.`);
    return { request: r, agendaItem: item };
  },
  cancelEncounterRequest(requestId) {
    const db = load();
    const r = db.encounterRequests.find((r) => r.id === requestId);
    if (!r) return null;
    r.status = 'cancelled';
    r.respondedAt = new Date().toISOString();
    save(db);
    return r;
  },
  updateAgendaItem(id, patch) {
    const db = load();
    const item = db.agendaItems.find((a) => a.id === id);
    if (!item) return null;
    Object.assign(item, patch, { updatedAt: new Date().toISOString() });
    save(db);
    return item;
  },
  // Buckets the live (status: 'upcoming') agenda into Hoje / Próximos dias
  // (days 1-3) / Esta semana (days 4-7) / Pendências (any unresolved item
  // whose date has already passed). Completed/rescheduled/cancelled items
  // are excluded from the live view but stay in getAgendaItems() for history.
  // `filter` narrows which agenda items get bucketed at all — used as-is
  // (no filter) for Nay's full-agenda dashboard, and with an
  // assignedTo==='assistant' filter for the assistant's own queue view.
  getAgendaBuckets(filter) {
    const items = load().agendaItems.filter((it) => (filter ? filter(it) : true));
    const now = new Date();
    const d0 = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const d1 = new Date(d0); d1.setDate(d1.getDate() + 1);
    const d4 = new Date(d0); d4.setDate(d4.getDate() + 4);
    const d8 = new Date(d0); d8.setDate(d8.getDate() + 8);
    const buckets = { hoje: [], proximosDias: [], estaSemana: [], maisAdiante: [], pendencias: [] };
    items.forEach((it) => {
      if (it.status !== 'upcoming') return;
      const when = new Date(it.date);
      if (when < d0) { buckets.pendencias.push(it); return; }
      if (when < d1) buckets.hoje.push(it);
      else if (when < d4) buckets.proximosDias.push(it);
      else if (when < d8) buckets.estaSemana.push(it);
      else buckets.maisAdiante.push(it);
    });
    Object.values(buckets).forEach((arr) => arr.sort((a, b) => new Date(a.date) - new Date(b.date)));
    return buckets;
  },
  getAgendaItemsForClient(clientId) {
    return load().agendaItems
      .filter((a) => a.relatedStudentId === clientId)
      .sort((a, b) => new Date(a.date) - new Date(b.date));
  },
  // The E1-E8 encounter journey for one client (see ENCOUNTER_DEFS) — each
  // canonical encounter matched against her real agendaItems by title
  // prefix ("E3 — ..."), never a separate table, so this can never drift
  // from what's actually on the calendar. An encounter with no match yet is
  // simply "not_scheduled" — nothing forces Nay to pre-create all 8.
  getEncounterJourney(clientId) {
    const items = this.getAgendaItemsForClient(clientId);
    return ENCOUNTER_DEFS.map((e) => {
      const match = items.find((it) => it.title.startsWith(`E${e.number} —`) || it.title.startsWith(`E${e.number} -`));
      return {
        ...e,
        agendaItemId: match ? match.id : null,
        status: match ? match.status : 'not_scheduled',
        date: match ? match.date : null,
        assignedTo: match ? match.assignedTo : null,
        assistantPersona: match ? match.assistantPersona : null,
        onlineLink: match ? match.onlineLink : null,
        topic: match ? match.topic : null,
      };
    });
  },
  // One definitive tally of every meeting type her tier allows — the E1-E8
  // encontros (reusing getEncounterJourney, never a second count), Premium's
  // 12 ad-hoc checkpoints, and the unlimited group encontros — so "how many
  // did we actually do" reads identically on her Encontros page and on
  // Nay's client profile. Nothing stored here that isn't already true of
  // her agendaItems.
  getMeetingsUsage(id = DEFAULT_CLIENT_ID) {
    const db = load();
    const c = client(db, id);
    if (!c) return null;
    const isPremium = c.profile.programSlug === 'persea-premium';
    const items = db.agendaItems.filter((a) => a.relatedStudentId === id);
    const tally = (type) => ({
      completed: items.filter((a) => a.type === type && a.status === 'completed').length,
      upcoming: items.filter((a) => a.type === type && a.status === 'upcoming').length,
    });
    const encounters = this.getEncounterJourney(id).filter((e) => !e.premiumOnly || isPremium);
    return {
      encounters: { completed: encounters.filter((e) => e.status === 'completed').length, total: encounters.length },
      checkpoints: isPremium ? { ...tally('checkpoint'), total: CHECKPOINT_ALLOWANCE } : null,
      groupMeetings: tally('group_meeting'),
    };
  },
  // The real next meeting for this client, straight from the calendar Nay
  // actually schedules on (agenda.html) — this is what a client's own
  // "Próxima Reunião" tile should read, in preference to the legacy
  // hand-kept journey.upcomingMeeting field (see note above getAgendaItems).
  getUpcomingMeetingForClient(clientId) {
    const now = new Date();
    return load().agendaItems
      .filter((a) => a.relatedStudentId === clientId && a.status === 'upcoming' && new Date(a.date) >= now)
      .sort((a, b) => new Date(a.date) - new Date(b.date))[0] || null;
  },
  // Assistant-assigned items whose date has already passed and are still
  // unresolved — the only assistant-queue detail that should surface on
  // Nay's own dashboard (an exception, not routine queue noise).
  getOverdueAssistantTasks() {
    const now = new Date();
    return load().agendaItems
      .filter((a) => a.assignedTo === 'assistant' && a.status === 'upcoming' && new Date(a.date) < now)
      .map((a) => ({ ...a, clientName: a.relatedStudentId ? (this.getClient(a.relatedStudentId)?.fullName || '') : null }))
      .sort((a, b) => new Date(a.date) - new Date(b.date));
  },

  // --- Meeting recordings & transcripts (Google Meet prototype) ---------
  // PROTOTYPE — no real Google/Supabase integration; see
  // docs/google-meet-integration.md for where that connects later. Every
  // method below reads/writes the `recording` bundle already living on the
  // relevant individual_meeting agendaItem (see blankMeetingRecording) —
  // there's no separate meetings table to keep in sync with the agenda.

  // The meeting's own lifecycle — separate from recording/transcript status
  // — derived from the agendaItem's existing status/date, never stored
  // twice. "Em andamento" is a narrow window (the meeting's nominal hour)
  // so it only shows while something could plausibly be happening live.
  getMeetingLifecycleStatus(item) {
    if (item.status === 'completed') return 'finalizada';
    if (item.status === 'upcoming') {
      const start = new Date(item.date);
      const end = new Date(start.getTime() + 60 * 60 * 1000);
      const now = new Date();
      if (now >= start && now <= end) return 'em_andamento';
    }
    return 'agendada';
  },
  // The one thing Nay (or her assistant) should do next for this meeting —
  // computed from the same lifecycle/recording/transcript facts the status
  // badges already show, never a separately-maintained field.
  getNextRequiredAction(item) {
    const lifecycle = this.getMeetingLifecycleStatus(item);
    const r = item.recording;
    if (!r) return 'Nenhuma ação necessária.';
    if (r.requiresAttention || r.recordingStatus === 'erro' || r.transcriptStatus === 'erro') {
      return 'Verificar manualmente e adicionar o link.';
    }
    if (lifecycle !== 'finalizada') return 'Nenhuma ação necessária — reunião ainda não aconteceu.';
    if (r.recordingStatus === 'sem_gravacao') return 'Nenhuma ação — reunião marcada sem gravação.';
    if (r.recordingStatus === 'aguardando') return 'Aguardar o Google gerar a gravação.';
    if (r.recordingStatus === 'processando') return 'Aguardar o processamento da gravação.';
    if (r.recordingStatus === 'disponivel' && r.transcriptStatus === 'aguardando') return 'Aguardar a transcrição.';
    if (r.recordingStatus === 'disponivel' && r.transcriptStatus === 'disponivel') return 'Nenhuma ação — disponível para a cliente.';
    return 'Nenhuma ação necessária.';
  },
  // Which of the admin/assistant list filters this meeting belongs to —
  // computed here once so the list page and any other consumer agree.
  getMeetingFilterBucket(item) {
    const lifecycle = this.getMeetingLifecycleStatus(item);
    const r = item.recording;
    if (r && (r.requiresAttention || r.recordingStatus === 'erro' || r.transcriptStatus === 'erro')) return 'requer_atencao';
    if (lifecycle !== 'finalizada') return 'proximas';
    if (r && (r.recordingStatus === 'aguardando' || r.recordingStatus === 'processando')) return 'aguardando_gravacao';
    if (r && r.recordingStatus === 'disponivel') return 'disponiveis';
    return 'outras';
  },
  getMeetingRecording(meetingId) {
    const item = load().agendaItems.find((a) => a.id === meetingId);
    return item ? item.recording || null : null;
  },
  // Every individual_meeting, joined with client name/program/avatar
  // initials — the shape the admin Gravações list and its filters read
  // directly. `role`/`assigneeId` narrow it for the assistant's own view
  // (only meetings assigned to her) without duplicating this method.
  getMeetingsOverview({ assignedTo } = {}) {
    const db = load();
    return db.agendaItems
      .filter((a) => a.type === 'individual_meeting' && a.recording)
      .filter((a) => !assignedTo || a.assignedTo === assignedTo)
      .map((a) => {
        const c = db.clients[a.relatedStudentId];
        return {
          ...a,
          clientName: c ? c.profile.fullName : '—',
          programSlug: c ? c.profile.programSlug : null,
          programLabel: c && c.profile.programSlug ? PROGRAM_LABEL_BY_SLUG[c.profile.programSlug] : '—',
          lifecycleStatus: this.getMeetingLifecycleStatus(a),
          nextAction: this.getNextRequiredAction(a),
          filterBucket: this.getMeetingFilterBucket(a),
        };
      })
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  },
  getMeetingDetail(meetingId) {
    const all = this.getMeetingsOverview();
    return all.find((m) => m.id === meetingId) || null;
  },
  // Client-facing: only this client's own meetings, oldest concern first —
  // never another client's, since it filters by relatedStudentId same as
  // getAgendaItemsForClient elsewhere in this file.
  getClientMeetingsWithRecording(clientId) {
    return this.getMeetingsOverview().filter((m) => m.relatedStudentId === clientId);
  },

  // --- Manual fallback — Nay or the assistant pasting links by hand -----
  setRecordingLinks(meetingId, { recordingUrl, transcriptUrl }) {
    const db = load();
    const item = db.agendaItems.find((a) => a.id === meetingId);
    if (!item || !item.recording) return null;
    const r = item.recording;
    if (recordingUrl !== undefined) {
      r.recordingUrl = recordingUrl || null;
      r.recordingStatus = recordingUrl ? 'disponivel' : r.recordingStatus;
    }
    if (transcriptUrl !== undefined) {
      r.transcriptUrl = transcriptUrl || null;
      r.transcriptStatus = transcriptUrl ? 'disponivel' : (r.recordingStatus === 'disponivel' ? 'aguardando' : r.transcriptStatus);
    }
    if (recordingUrl || transcriptUrl) { r.requiresAttention = false; r.attentionNote = ''; }
    item.updatedAt = new Date().toISOString();
    save(db);
    this.logActivity(item.relatedStudentId, 'recording_links_updated', `Links de gravação/transcrição atualizados — ${item.title}`);
    return r;
  },
  removeRecordingLink(meetingId, kind) {
    const db = load();
    const item = db.agendaItems.find((a) => a.id === meetingId);
    if (!item || !item.recording) return null;
    const r = item.recording;
    if (kind === 'recording') { r.recordingUrl = null; r.recordingStatus = 'aguardando'; }
    if (kind === 'transcript') { r.transcriptUrl = null; r.transcriptStatus = 'aguardando'; }
    item.updatedAt = new Date().toISOString();
    save(db);
    return r;
  },
  markMeetingNoRecording(meetingId) {
    const db = load();
    const item = db.agendaItems.find((a) => a.id === meetingId);
    if (!item || !item.recording) return null;
    Object.assign(item.recording, {
      recordingStatus: 'sem_gravacao', transcriptStatus: 'nao_aplicavel',
      recordingUrl: null, transcriptUrl: null, requiresAttention: false, attentionNote: '',
    });
    item.updatedAt = new Date().toISOString();
    save(db);
    return item.recording;
  },
  // The assistant's one path to raise a flag for Nay without touching
  // sync internals — the only "attention" trigger she's allowed to pull.
  flagMeetingForAttention(meetingId, note) {
    const db = load();
    const item = db.agendaItems.find((a) => a.id === meetingId);
    if (!item || !item.recording) return null;
    item.recording.requiresAttention = true;
    item.recording.attentionNote = note || 'Sinalizado pela assistente para revisão da Nay.';
    item.updatedAt = new Date().toISOString();
    save(db);
    this.logActivity(item.relatedStudentId, 'meeting_flagged', `Reunião sinalizada para a Nay — ${item.title}`);
    return item.recording;
  },
  clearMeetingAttention(meetingId) {
    const db = load();
    const item = db.agendaItems.find((a) => a.id === meetingId);
    if (!item || !item.recording) return null;
    item.recording.requiresAttention = false;
    item.recording.attentionNote = '';
    save(db);
    return item.recording;
  },

  // --- Sincronização com Google (admin-only demo panel) ------------------
  getGoogleSyncStatus() {
    return load().tenant.googleSync;
  },

  // --- Dev-only lifecycle simulation — see the "Controles da demonstração"
  // panel. Mutates one meeting's recording bundle to preview a state
  // without waiting on (nonexistent) real Google processing. Removable
  // wholesale once the real integration lands — nothing here is read by
  // any production code path.
  devSimulateMeetingFinished(meetingId) {
    const db = load();
    const item = db.agendaItems.find((a) => a.id === meetingId);
    if (!item) return null;
    item.status = 'completed';
    if (item.recording) item.recording.recordingStatus = 'aguardando';
    save(db);
    return item;
  },
  devSimulateProcessing(meetingId) {
    const db = load();
    const item = db.agendaItems.find((a) => a.id === meetingId);
    if (!item || !item.recording) return null;
    item.status = 'completed';
    Object.assign(item.recording, { recordingStatus: 'processando', transcriptStatus: 'aguardando', requiresAttention: false, attentionNote: '' });
    item.recording.sync.attempts += 1;
    item.recording.sync.lastCheckedAt = new Date().toISOString();
    save(db);
    return item.recording;
  },
  devSimulateRecordingAvailable(meetingId) {
    const db = load();
    const item = db.agendaItems.find((a) => a.id === meetingId);
    if (!item || !item.recording) return null;
    item.status = 'completed';
    Object.assign(item.recording, {
      recordingStatus: 'disponivel', requiresAttention: false, attentionNote: '',
      recordingUrl: item.recording.recordingUrl || `https://drive.google.com/file/d/mock-${meetingId}-gravacao/view`,
    });
    if (item.recording.transcriptStatus === 'nao_aplicavel') item.recording.transcriptStatus = 'aguardando';
    item.recording.sync.attempts += 1;
    item.recording.sync.lastCheckedAt = new Date().toISOString();
    save(db);
    return item.recording;
  },
  devSimulateTranscriptAvailable(meetingId) {
    const db = load();
    const item = db.agendaItems.find((a) => a.id === meetingId);
    if (!item || !item.recording) return null;
    item.recording.transcriptStatus = 'disponivel';
    item.recording.transcriptUrl = item.recording.transcriptUrl || `https://docs.google.com/document/d/mock-${meetingId}-transcricao/edit`;
    item.recording.sync.attempts += 1;
    item.recording.sync.lastCheckedAt = new Date().toISOString();
    save(db);
    return item.recording;
  },
  devSimulateSyncError(meetingId) {
    const db = load();
    const item = db.agendaItems.find((a) => a.id === meetingId);
    if (!item || !item.recording) return null;
    item.recording.recordingStatus = 'erro';
    item.recording.transcriptStatus = 'erro';
    item.recording.requiresAttention = true;
    item.recording.attentionNote = 'Simulação: o Google retornou um erro ao tentar localizar os arquivos desta reunião.';
    item.recording.sync.attempts += 1;
    item.recording.sync.syncStatus = 'erro';
    item.recording.sync.lastCheckedAt = new Date().toISOString();
    save(db);
    return item.recording;
  },
  // Resets one meeting back to its original seeded recording state —
  // captured once at module load, before anything in this session could
  // have mutated it (see RECORDING_SEED_SNAPSHOT below).
  devRestoreMeetingRecording(meetingId) {
    const db = load();
    const item = db.agendaItems.find((a) => a.id === meetingId);
    const original = RECORDING_SEED_SNAPSHOT[meetingId];
    if (!item || !original) return null;
    item.status = original.status;
    item.recording = structuredClone(original.recording);
    save(db);
    return item;
  },
  devRestoreAllMeetingRecordings() {
    const db = load();
    Object.entries(RECORDING_SEED_SNAPSHOT).forEach(([id, original]) => {
      const item = db.agendaItems.find((a) => a.id === id);
      if (!item) return;
      item.status = original.status;
      item.recording = structuredClone(original.recording);
    });
    save(db);
  },

  // --- Direção da Marca (Brand Direction) ---
  getBrandDirection(id = DEFAULT_CLIENT_ID) {
    return client(load(), id).brandDirection;
  },
  saveBrandDirection(id, patch) {
    const db = load();
    const c = client(db, id);
    c.brandDirection = { ...c.brandDirection, ...patch, updatedAt: new Date().toISOString() };
    save(db);
    this.logActivity(id, 'brand_direction_updated', 'Direção da Marca atualizada');
    return c.brandDirection;
  },
  // "Minhas Ideias" — separate from saveBrandDirection on purpose: this is
  // the only Brand Direction write path a client screen should ever call.
  getBrandIdeas(id = DEFAULT_CLIENT_ID) {
    return client(load(), id).brandIdeas;
  },
  saveBrandIdeas(id, text) {
    const db = load();
    client(db, id).brandIdeas = text;
    save(db);
  },

  // --- Content Center (Hubla-hosted classes, organized by learning track) ---
  // Hubla continues hosting the classes themselves — Persea OS only stores
  // metadata + the Hubla URL to open in a new tab. Nothing here embeds or
  // proxies Hubla video content.
  getResources() {
    return load().resources;
  },
  getResource(id) {
    return load().resources.find((r) => r.id === id) || null;
  },
  saveResource(data) {
    const db = load();
    if (data.id) {
      const existing = db.resources.find((r) => r.id === data.id);
      if (existing) { Object.assign(existing, data, { updatedAt: new Date().toISOString() }); save(db); return existing; }
    }
    const now = new Date().toISOString();
    const resource = {
      id: `r${Date.now()}`, title: '', description: '', track: CONTENT_TRACKS[0], phaseKey: null,
      duration: null, hublaUrl: '', recommendation: null, generalAudience: true, createdAt: now, updatedAt: now, ...data,
    };
    db.resources.push(resource);
    save(db);
    return resource;
  },
  getGeneralResources() {
    return load().resources.filter((r) => r.generalAudience);
  },
  getResourcesByTrack() {
    const resources = load().resources;
    const byTrack = {};
    CONTENT_TRACKS.forEach((t) => { byTrack[t] = []; });
    resources.forEach((r) => { (byTrack[r.track] || (byTrack[r.track] = [])).push(r); });
    return byTrack;
  },
  getAssignmentsForClient(clientId) {
    const db = load();
    return db.resourceAssignments
      .filter((a) => a.studentId === clientId)
      .map((a) => ({ ...a, resource: db.resources.find((r) => r.id === a.resourceId) || null }))
      .filter((a) => a.resource);
  },
  getAllAssignments() {
    const db = load();
    return db.resourceAssignments.map((a) => ({
      ...a,
      resource: db.resources.find((r) => r.id === a.resourceId) || null,
      clientName: db.clients[a.studentId] ? db.clients[a.studentId].profile.fullName : a.studentId,
    }));
  },
  assignResourceToClient(resourceId, clientId, { reason = '', deadline = null, relatedPhaseOrMeeting = null } = {}) {
    const db = load();
    const assignment = {
      id: `ra${Date.now()}`, resourceId, studentId: clientId, reason, deadline, relatedPhaseOrMeeting,
      assignedAt: new Date().toISOString(), completed: false,
    };
    db.resourceAssignments.push(assignment);
    save(db);
    const title = db.resources.find((r) => r.id === resourceId);
    this.logActivity(clientId, 'resource_assigned', `Novo conteúdo recomendado: ${title ? title.title : ''}`);
    return assignment;
  },
  toggleAssignmentCompletion(assignmentId) {
    const db = load();
    const a = db.resourceAssignments.find((a) => a.id === assignmentId);
    if (a) a.completed = !a.completed;
    save(db);
    return a;
  },

  // --- Conteúdos gateway cards (see CONTENT_CATEGORY_TONES note near the
  // seed) — a small, ordered, show/hide-able set of premium cards that link
  // out to Hubla. Deliberately separate from resources/CONTENT_TRACKS above:
  // this never tracks lesson completion, only "here's where the topic lives".
  getContentCategories({ includeHidden = false } = {}) {
    const cats = load().contentCategories.slice().sort((a, b) => a.displayOrder - b.displayOrder);
    return includeHidden ? cats : cats.filter((c) => c.isVisible);
  },
  getContentCategory(id) {
    return load().contentCategories.find((c) => c.id === id) || null;
  },
  saveContentCategory(data) {
    const db = load();
    if (data.id) {
      const existing = db.contentCategories.find((c) => c.id === data.id);
      if (existing) { Object.assign(existing, data, { updatedAt: new Date().toISOString() }); save(db); return existing; }
    }
    const now = new Date().toISOString();
    const maxOrder = db.contentCategories.reduce((m, c) => Math.max(m, c.displayOrder || 0), 0);
    const category = {
      id: `cc${Date.now()}`, title: '', description: '', coverImage: null,
      coverTone: db.contentCategories.length % CONTENT_CATEGORY_TONES,
      hublaUrl: '', displayOrder: maxOrder + 1, isVisible: true, createdAt: now, updatedAt: now, ...data,
    };
    db.contentCategories.push(category);
    save(db);
    return category;
  },
  deleteContentCategory(id) {
    const db = load();
    db.contentCategories = db.contentCategories.filter((c) => c.id !== id);
    save(db);
  },
  toggleContentCategoryVisibility(id) {
    const db = load();
    const c = db.contentCategories.find((c) => c.id === id);
    if (c) { c.isVisible = !c.isVisible; save(db); }
    return c;
  },
  moveContentCategory(id, direction) {
    const db = load();
    const ordered = db.contentCategories.slice().sort((a, b) => a.displayOrder - b.displayOrder);
    const idx = ordered.findIndex((c) => c.id === id);
    const swapIdx = idx + direction;
    if (idx === -1 || swapIdx < 0 || swapIdx >= ordered.length) return;
    const tmp = ordered[idx].displayOrder;
    ordered[idx].displayOrder = ordered[swapIdx].displayOrder;
    ordered[swapIdx].displayOrder = tmp;
    save(db);
  },

  // --- Payments (per-client billing) ---
  // Both getters apply deriveEffectiveStatus on every read (Production
  // Audit Remediation Pass, Medium — real "Em Atraso" derivation): the
  // stored status stays 'pending' until actually paid — overdue is a
  // computed view recalculated fresh every time, so it can never go stale
  // or need a manual "mark overdue" step, and a due-today payment is never
  // prematurely flagged. Only 'pending' is ever elevated to 'overdue'; paid
  // rows pass through untouched, as does an already-'overdue' row.
  getPayments(id = DEFAULT_CLIENT_ID) {
    return (client(load(), id).payments || []).map((p) => ({ ...p, status: deriveEffectiveStatus(p.status, p.dueDate) }));
  },
  getAllPayments({ program } = {}) {
    const db = load();
    const all = [];
    Object.entries(db.clients).forEach(([id, c]) => {
      if (program && c.onboarding.contract.program !== program) return;
      (c.payments || []).forEach((p) => all.push({
        ...p, status: deriveEffectiveStatus(p.status, p.dueDate),
        clientId: id, clientName: c.profile.fullName, program: c.onboarding.contract.program,
      }));
    });
    return all.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
  },
  markPaymentPaid(clientId, paymentId) {
    const db = load();
    const c = client(db, clientId);
    const p = (c.payments || []).find((p) => p.id === paymentId);
    if (p) { p.status = 'paid'; p.paidAt = new Date().toISOString(); }
    save(db);
    this.logActivity(clientId, 'payment_marked_paid', 'Pagamento registrado como pago');
    // Payment confirmed -> the next administrative action (issuing the
    // invoice/receipt) lands directly in Ju's queue, no manual hand-off.
    if (p) {
      this.createAgendaItem({
        type: 'admin_task',
        title: `Emitir recibo — ${c.profile.fullName}`,
        date: new Date().toISOString(),
        status: 'upcoming',
        relatedStudentId: clientId,
        topic: `Pagamento de ${p.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} confirmado`,
        assignedTo: 'assistant',
        assistantPersona: 'ju',
        assigneeNotes: `Parcela de ${p.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} (vencimento ${p.dueDate}) foi confirmada — emitir nota fiscal/recibo para a cliente.`,
      });
    }
    return p;
  },

  // --- Expenses (business-wide) ---
  getExpenses() {
    return load().expenses;
  },
  addExpense(data) {
    const db = load();
    const expense = { id: `e${Date.now()}`, date: new Date().toISOString().slice(0, 10), category: EXPENSE_CATEGORIES[0], description: '', amount: 0, ...data };
    db.expenses.push(expense);
    save(db);
    return expense;
  },
  deleteExpense(id) {
    const db = load();
    db.expenses = db.expenses.filter((e) => e.id !== id);
    save(db);
  },

  // --- Payment links (SumUp, mocked) & Nota Fiscal ---
  // Two-step confirmation by design: the assistant sends the link and, once
  // the client pays externally, reports it back — but the payment only
  // counts as 'paid' (and enters the financial projections) once Nay
  // confirms via the existing markPaymentPaid. Keeps Nay and the assistant
  // from ever disagreeing about what's actually been collected.
  sendPaymentLink(clientId, paymentId, url) {
    const db = load();
    const c = client(db, clientId);
    const p = (c.payments || []).find((p) => p.id === paymentId);
    if (!p) return null;
    p.sumupLinkUrl = url;
    p.linkSentAt = new Date().toISOString();
    save(db);
    this.logActivity(clientId, 'payment_link_sent', `Link de pagamento enviado — ${p.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`);
    return p;
  },
  reportPaymentReceived(clientId, paymentId) {
    const db = load();
    const c = client(db, clientId);
    const p = (c.payments || []).find((p) => p.id === paymentId);
    if (!p || p.status === 'paid') return p || null;
    p.reportedPaidAt = new Date().toISOString();
    save(db);
    this.logActivity(clientId, 'payment_reported', `Pagamento reportado como recebido — aguardando confirmação da Nay`);
    return p;
  },
  requestInvoice(clientId, paymentId) {
    const db = load();
    const p = (client(db, clientId).payments || []).find((p) => p.id === paymentId);
    if (!p || p.nf.status === 'issued') return p || null;
    p.nf = { ...p.nf, status: 'requested', requestedAt: new Date().toISOString() };
    save(db);
    this.logActivity(clientId, 'invoice_requested', 'Nota fiscal solicitada');
    return p;
  },
  // `fileName` accepts either a plain string (legacy callers) or
  // { fileName, fileUrl } — fileUrl is a real uploaded file (data URL), so
  // the client's Financeiro page can actually open it instead of a toast
  // placeholder. See assistant/financial.js for the upload flow.
  issueInvoice(clientId, paymentId, fileName) {
    const db = load();
    const c = client(db, clientId);
    const p = (c.payments || []).find((p) => p.id === paymentId);
    if (!p) return null;
    const { fileName: name, fileUrl } = typeof fileName === 'object' && fileName !== null ? fileName : { fileName, fileUrl: null };
    p.nf = {
      status: 'issued', requestedAt: p.nf.requestedAt || new Date().toISOString(), issuedAt: new Date().toISOString(),
      fileName: name || `nf-${clientId}-${paymentId}.pdf`, fileUrl: fileUrl || null,
    };
    save(db);
    this.logActivity(clientId, 'invoice_issued', 'Nota fiscal emitida e disponibilizada para a cliente');
    return p;
  },

  // --- Hubla access ---
  getHublaAccess(clientId) {
    return client(load(), clientId).hublaAccess;
  },
  setHublaAccess(clientId, status) {
    const db = load();
    const c = client(db, clientId);
    c.hublaAccess = { status, grantedAt: status === 'granted' ? new Date().toISOString() : null };
    save(db);
    this.logActivity(clientId, 'hubla_access_changed', status === 'granted' ? 'Acesso à Hubla liberado' : 'Acesso à Hubla revogado');
    return c.hublaAccess;
  },

  // --- Image project (kicked off by the assistant once wardrobe photos are in) ---
  setImageProjectStatus(clientId, status) {
    const db = load();
    client(db, clientId).imageProjectStatus = status;
    save(db);
    if (status === 'created') this.logActivity(clientId, 'image_project_created', 'Projeto de imagens criado pela equipe');
  },

  // --- Nay-review gate: image guides & Digital Kit are prepared by the
  // assistant, submitted here, and only reach the client after Nay approves.
  // Deliberately generic (type/refSlug) rather than one table per deliverable
  // type — image guides and the Digital Kit already share this shape, and it
  // extends to future assistant-authored deliverables without a new table.
  // Status is never stored on the guide/kit record itself — it's derived
  // live from (fileUrl present -> delivered) + (an open review exists ->
  // in_review), same "derive, don't duplicate" rule as getProgramActivities.
  getImageGuides(clientId) {
    const c = client(load(), clientId);
    const openReviews = this.getPendingReviews({ clientId }).filter((r) => r.type === 'image_guide' && r.status !== 'approved');
    return c.imageGuides.map((g) => {
      const review = openReviews.find((r) => r.refSlug === g.slug);
      const status = g.fileUrl ? 'delivered' : review ? 'in_review' : 'not_started';
      return { ...g, label: IMAGE_GUIDE_LABEL[g.slug], status, review: review || null };
    });
  },
  getDigitalKit(clientId) {
    const c = client(load(), clientId);
    const review = this.getPendingReviews({ clientId }).find((r) => r.type === 'digital_kit' && r.status !== 'approved');
    const status = c.digitalKit.fileUrl ? 'delivered' : review ? 'in_review' : 'not_started';
    return { ...c.digitalKit, status, review: review || null };
  },
  // `summary` (what this deliverable is/why, for future reference against a
  // similar client) and `canvaUrl` (the editable source) ride along on the
  // review and land on the guide/kit record once Nay approves — see
  // approveReview and getProjectsLibrary.
  submitForReview(clientId, { type, refSlug = null, title, note = '', fileUrl, summary = '', canvaUrl = '' }) {
    const db = load();
    if (!client(db, clientId)) return null;
    const review = {
      id: `rev${Date.now()}`, clientId, type, refSlug, title, note, fileUrl, summary, canvaUrl,
      status: 'pending', createdAt: new Date().toISOString(), resolvedAt: null, nayNote: '',
    };
    db.pendingReviews.unshift(review);
    save(db);
    this.logActivity(clientId, 'submitted_for_review', `Enviado para revisão da Nay: ${title}`);
    return review;
  },
  getPendingReviews({ clientId, status } = {}) {
    let reviews = load().pendingReviews.map((r) => ({ ...r, clientName: this.getClient(r.clientId)?.fullName || r.clientId }));
    if (clientId) reviews = reviews.filter((r) => r.clientId === clientId);
    if (status) reviews = reviews.filter((r) => r.status === status);
    return reviews.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  },
  approveReview(reviewId, nayNote = '') {
    const db = load();
    const review = db.pendingReviews.find((r) => r.id === reviewId);
    if (!review) return null;
    review.status = 'approved';
    review.resolvedAt = new Date().toISOString();
    review.nayNote = nayNote;
    const c = client(db, review.clientId);
    if (review.type === 'image_guide') {
      const g = c.imageGuides.find((g) => g.slug === review.refSlug);
      if (g) {
        g.fileUrl = review.fileUrl; g.summary = review.summary || ''; g.canvaUrl = review.canvaUrl || '';
        g.deliveredAt = review.resolvedAt;
      }
    } else if (review.type === 'digital_kit') {
      c.digitalKit.fileUrl = review.fileUrl;
      c.digitalKit.summary = review.summary || ''; c.digitalKit.canvaUrl = review.canvaUrl || '';
      c.digitalKit.deliveredAt = review.resolvedAt;
    }
    save(db);
    this.logActivity(review.clientId, 'review_approved', `Nay aprovou: ${review.title}`);
    return review;
  },
  requestReviewChanges(reviewId, nayNote) {
    const db = load();
    const review = db.pendingReviews.find((r) => r.id === reviewId);
    if (!review) return null;
    review.status = 'changes_requested';
    review.resolvedAt = new Date().toISOString();
    review.nayNote = nayNote || '';
    save(db);
    this.logActivity(review.clientId, 'review_changes_requested', `Nay pediu ajustes em: ${review.title}`);
    return review;
  },

  // --- Assistant checklist — live-computed from the same underlying fields
  // Nay's own admin views read, exactly like getProgramActivities: one set
  // of facts, never a separate progress table to fall out of sync.
  getAssistantChecklist(clientId) {
    const c = client(load(), clientId);
    const o = c.onboarding;
    const payments = c.payments || [];
    const needsLink = payments.filter((p) => p.status !== 'paid' && !p.linkSentAt);
    const needsConfirmation = payments.filter((p) => p.status !== 'paid' && p.reportedPaidAt);
    const guides = this.getImageGuides(clientId);
    const kit = this.getDigitalKit(clientId);
    return [
      { key: 'client_info', label: 'Informações da cliente preenchidas', done: o.clientInfo.submitted, detail: o.clientInfo.submitted ? 'Preenchidas' : 'Pendente — contrato não pode ser preparado ainda', urgent: !o.clientInfo.submitted },
      { key: 'contract', label: 'Contrato assinado e arquivado', done: o.contract.status === 'completed', detail: ONBOARDING_STAGE_LABEL[o.contract.status] },
      { key: 'payment_link', label: 'Links de pagamento enviados', done: needsLink.length === 0, detail: needsLink.length ? `${needsLink.length} parcela(s) sem link` : 'Em dia' },
      { key: 'payment_confirmation', label: 'Pagamentos aguardando confirmação da Nay', done: needsConfirmation.length === 0, detail: needsConfirmation.length ? `${needsConfirmation.length} aguardando` : 'Nada pendente' },
      { key: 'hubla', label: 'Acesso à Hubla liberado', done: c.hublaAccess.status === 'granted', detail: HUBLA_STATUS_LABEL[c.hublaAccess.status] },
      { key: 'whatsapp', label: 'Grupo de WhatsApp criado', done: o.whatsappGroup.status === 'added', detail: WHATSAPP_STATUS_LABEL[o.whatsappGroup.status] },
      { key: 'image_project', label: 'Projeto de imagens criado', done: c.imageProjectStatus === 'created', detail: c.imageProjectStatus === 'created' ? 'Criado' : 'Não iniciado' },
      { key: 'image_guides', label: 'Guias de imagem entregues', done: guides.every((g) => g.status === 'delivered'), detail: `${guides.filter((g) => g.status === 'delivered').length}/${guides.length} entregues` },
      { key: 'digital_kit', label: 'Kit Digital entregue', done: kit.status === 'delivered', detail: GUIDE_STATUS_LABEL[kit.status] },
    ];
  },

  // --- Client context bundle — everything the assistant needs to actually
  // know this client before answering her or preparing anything for her:
  // the first meeting notes, her inspiration mood board, her archetype
  // result, and Nay's private notes. Read-only aggregation of data that
  // already lives elsewhere — no new fields, no risk of disagreeing with
  // the screens Nay herself uses.
  getClientContextBundle(clientId) {
    const c = client(load(), clientId);
    const firstMeeting = load().agendaItems
      .filter((a) => a.type === 'individual_meeting' && a.relatedStudentId === clientId)
      .sort((a, b) => new Date(a.date) - new Date(b.date))[0] || null;
    return {
      clientInfo: c.onboarding.clientInfo,
      firstMeeting,
      brandDirection: c.brandDirection,
      // Real archetype-quiz status, not the legacy external-link stub —
      // status only (not_started/in_progress/completed), never scores or
      // interpretation: this bundle backs the assistant's context view,
      // which per the permission model only ever sees completion status.
      archetypeAssessment: { status: archetypeQuizStatusFor(c) },
      privateNotes: c.notes,
      // The photos she uploaded for the Projeto de Imagem/Guia de Produções/
      // Mood Fotográfico work — same source images.html reads, so the
      // assistant is never looking at a stale copy.
      images: c.images, imagesStatus: c.imagesStatus,
    };
  },

  // --- Nay <-> Assistant inbox (see assistantMessages seed note) ---
  getAssistantMessages() {
    return [...load().assistantMessages].sort((a, b) => new Date(b.at) - new Date(a.at));
  },
  sendAssistantMessage({ from, clientId = null, text, route = null }) {
    const db = load();
    const msg = { id: `am${Date.now()}`, from, clientId, text, route, at: new Date().toISOString(), read: from === 'assistant' };
    db.assistantMessages = [msg, ...db.assistantMessages];
    save(db);
    return msg;
  },
  markAssistantMessageRead(id) {
    const db = load();
    const msg = db.assistantMessages.find((m) => m.id === id);
    if (msg) { msg.read = true; save(db); }
    return msg;
  },

  // --- New clients (Painel) — onboarding-tier clients, the ones the
  // assistant most needs to keep moving before they can start Phase 1. ---
  getNewClientsForAssistant() {
    return this.listClients().filter((c) => c.status === 'onboarding');
  },

  // --- Projetos / Guia de Produções reference library — every delivered
  // image guide + Digital Kit, across every client, flattened into one
  // browsable list so the assistant can reuse a past deliverable's approach
  // for a new client with a similar profile. Read-only aggregation (same
  // "derive, don't duplicate" rule as getImageGuides/getDigitalKit) — the
  // real record still lives on the client, this just collects them.
  getProjectsLibrary({ slug } = {}) {
    const db = load();
    const rows = [];
    Object.values(db.clients).forEach((c) => {
      const clientName = c.profile.fullName;
      const clientId = c.profile.id;
      (c.imageGuides || []).forEach((g) => {
        if (!g.fileUrl) return;
        if (slug && g.slug !== slug) return;
        rows.push({
          kind: 'image_guide', slug: g.slug, label: IMAGE_GUIDE_LABEL[g.slug], clientId, clientName,
          fileUrl: g.fileUrl, canvaUrl: g.canvaUrl || '', summary: g.summary || '', deliveredAt: g.deliveredAt || null,
        });
      });
      if (c.digitalKit && c.digitalKit.fileUrl && !slug) {
        rows.push({
          kind: 'digital_kit', slug: 'digital_kit', label: 'Kit Digital', clientId, clientName,
          fileUrl: c.digitalKit.fileUrl, canvaUrl: c.digitalKit.canvaUrl || '', summary: c.digitalKit.summary || '', deliveredAt: c.digitalKit.deliveredAt || null,
        });
      }
    });
    return rows.sort((a, b) => new Date(b.deliveredAt || 0) - new Date(a.deliveredAt || 0));
  },

  // --- Leitura Estratégica de Valor (premium business/sales/pricing assessment) ---
  // getValueAssessment() is the real access-control boundary in this
  // architecture: MockDB is the only thing any screen is allowed to read
  // storage through (see file header), so refusing to construct/return the
  // record here for a non-premium client is the equivalent of a backend/RLS
  // check — it holds even if a screen were coded wrong or a URL guessed.
  // getValueAnalysisAccess() is the separate, safe, no-data-leak call every
  // screen should use just to decide which UI to show.
  getValueAnalysisAccess(clientId) {
    const db = load();
    const c = db.clients[clientId];
    if (!c) return null;
    const isPremium = c.profile.programSlug === 'persea-premium';
    if (!isPremium) return { isPremium: false, status: 'locked_plan', label: 'Exclusivo do Programa Premium' };
    if (c.profile.status === 'onboarding') return { isPremium: true, status: 'upcoming' };
    const rec = db.businessValueAssessments[clientId];
    return { isPremium: true, status: rec ? rec.status : 'available', recordExists: !!rec };
  },
  // Hard prerequisite for E5 (Nova Persea) — the Análise de Negócio has to
  // be at least submitted before that encounter can happen; reuses the
  // exact same access/status this client's Business activity already
  // shows, never a second "is she ready" flag to keep in sync.
  canScheduleE5(clientId) {
    const va = this.getValueAnalysisAccess(clientId);
    return { ready: !!va && ['submitted', 'in_analysis', 'published'].includes(va.status), status: va ? va.status : null };
  },
  // Nay has to authorize (approve) what the assistant built before E3 can
  // be set up — Cartela de Cores and Guia de Produções are the two
  // per-client deliverables with a review workflow today; Planejamento de
  // Imagem and Ferramentas para Nova Imagem are shared templates only (see
  // admin/templates.js), not yet per-client outputs with their own review.
  canScheduleE3(clientId) {
    const required = this.getImageGuides(clientId).filter((g) => ['paleta_cores', 'guia_looks_mensal'].includes(g.slug));
    return { ready: required.length > 0 && required.every((g) => g.status === 'delivered'), guides: required };
  },
  getValueAssessment(clientId) {
    const db = load();
    const c = db.clients[clientId];
    if (!c || c.profile.programSlug !== 'persea-premium' || c.profile.status === 'onboarding') return null;
    let rec = db.businessValueAssessments[clientId];
    if (!rec) {
      rec = newValueAssessmentRecord(clientId);
      db.businessValueAssessments[clientId] = rec;
      save(db);
    }
    return rec;
  },
  startValueAssessment(clientId) {
    const db = load();
    const c = db.clients[clientId];
    if (!c || c.profile.programSlug !== 'persea-premium') return null;
    let rec = db.businessValueAssessments[clientId];
    if (!rec) { rec = newValueAssessmentRecord(clientId); db.businessValueAssessments[clientId] = rec; }
    if (rec.status === 'available') { rec.status = 'in_progress'; rec.startedAt = rec.startedAt || new Date().toISOString(); }
    rec.updatedAt = new Date().toISOString();
    save(db);
    return rec;
  },
  saveValueAssessmentField(clientId, path, value) {
    const db = load();
    const c = db.clients[clientId];
    if (!c || c.profile.programSlug !== 'persea-premium') return null;
    let rec = db.businessValueAssessments[clientId];
    if (!rec) { rec = newValueAssessmentRecord(clientId); db.businessValueAssessments[clientId] = rec; }
    setAnswerPath(rec.answers, path, value);
    if (rec.status === 'available') { rec.status = 'in_progress'; rec.startedAt = rec.startedAt || new Date().toISOString(); }
    rec.updatedAt = new Date().toISOString();
    save(db);
    return rec;
  },
  addValueAssessmentItem(clientId, groupKey, itemPatch = {}) {
    const db = load();
    const c = db.clients[clientId];
    if (!c || c.profile.programSlug !== 'persea-premium') return null;
    let rec = db.businessValueAssessments[clientId];
    if (!rec) { rec = newValueAssessmentRecord(clientId); db.businessValueAssessments[clientId] = rec; }
    const arr = resolveValueGroup(rec, groupKey);
    const item = { ...VALUE_GROUP_BLANK[groupKey](), ...itemPatch };
    arr.push(item);
    if (rec.status === 'available') { rec.status = 'in_progress'; rec.startedAt = rec.startedAt || new Date().toISOString(); }
    rec.updatedAt = new Date().toISOString();
    save(db);
    return item;
  },
  updateValueAssessmentItem(clientId, groupKey, itemId, patch) {
    const db = load();
    const rec = db.businessValueAssessments[clientId];
    if (!rec) return null;
    const arr = resolveValueGroup(rec, groupKey);
    const item = arr.find((i) => i.id === itemId);
    if (item) Object.assign(item, patch);
    rec.updatedAt = new Date().toISOString();
    save(db);
    return item;
  },
  removeValueAssessmentItem(clientId, groupKey, itemId) {
    const db = load();
    const rec = db.businessValueAssessments[clientId];
    if (!rec) return;
    const arr = resolveValueGroup(rec, groupKey);
    const idx = arr.findIndex((i) => i.id === itemId);
    if (idx !== -1) arr.splice(idx, 1);
    rec.updatedAt = new Date().toISOString();
    save(db);
  },
  // Idempotent: safe to call repeatedly (e.g. a client double-clicking
  // submit) — status only ever advances forward, and the internal task
  // below is deduped by sourceKey regardless of how many times this runs.
  submitValueAssessment(clientId) {
    const db = load();
    const c = db.clients[clientId];
    const rec = db.businessValueAssessments[clientId];
    if (!c || !rec || c.profile.programSlug !== 'persea-premium') return null;
    const now = new Date().toISOString();
    if (rec.status === 'available' || rec.status === 'in_progress') {
      rec.status = 'submitted';
      rec.submittedAt = rec.submittedAt || now;
    }
    rec.updatedAt = now;
    save(db);

    const sourceKey = `value_assessment_submitted:${rec.id}`;
    const alreadyTasked = load().agendaItems.some((a) => a.sourceKey === sourceKey);
    if (!alreadyTasked) {
      this.createAgendaItem({
        type: 'admin_task', title: `Analisar Leitura Estratégica de Valor — ${c.profile.fullName}`,
        date: now, status: 'upcoming', relatedStudentId: clientId,
        topic: 'Cliente enviou a Leitura Estratégica de Valor — iniciar análise.',
        assignedTo: 'nay', sourceKey,
      });
    }
    return rec;
  },
  startValueAnalysis(clientId) {
    const db = load();
    const rec = db.businessValueAssessments[clientId];
    if (!rec) return null;
    if (rec.status === 'submitted') { rec.status = 'in_analysis'; rec.analysisStartedAt = new Date().toISOString(); }
    rec.updatedAt = new Date().toISOString();
    save(db);
    return rec;
  },
  setValueAssessmentReview(clientId, path, reviewStatus, internalNote) {
    const db = load();
    const rec = db.businessValueAssessments[clientId];
    if (!rec) return null;
    rec.reviewStatus[path] = reviewStatus;
    if (internalNote !== undefined) rec.internalNotes[path] = internalNote;
    rec.updatedAt = new Date().toISOString();
    save(db);
    return rec;
  },
  addValueScenario(clientId, scenario) {
    const db = load();
    const rec = db.businessValueAssessments[clientId];
    if (!rec) return null;
    const item = { id: `sc${Date.now()}`, isRecommended: false, createdBy: 'nay', createdAt: new Date().toISOString(), ...scenario };
    rec.scenarios.push(item);
    save(db);
    return item;
  },
  updateValueScenario(clientId, scenarioId, patch) {
    const db = load();
    const rec = db.businessValueAssessments[clientId];
    if (!rec) return null;
    const item = rec.scenarios.find((s) => s.id === scenarioId);
    if (item) Object.assign(item, patch);
    save(db);
    return item;
  },
  removeValueScenario(clientId, scenarioId) {
    const db = load();
    const rec = db.businessValueAssessments[clientId];
    if (!rec) return;
    rec.scenarios = rec.scenarios.filter((s) => s.id !== scenarioId);
    save(db);
  },
  setRecommendedValueScenario(clientId, scenarioId) {
    const db = load();
    const rec = db.businessValueAssessments[clientId];
    if (!rec) return;
    rec.scenarios.forEach((s) => { s.isRecommended = s.id === scenarioId; });
    save(db);
  },
  saveValueRecommendation(clientId, patch) {
    const db = load();
    const rec = db.businessValueAssessments[clientId];
    if (!rec) return null;
    const now = new Date().toISOString();
    if (!rec.recommendation) rec.recommendation = { status: 'draft', createdBy: 'nay', createdAt: now };
    Object.assign(rec.recommendation, patch, { updatedAt: now });
    save(db);
    return rec.recommendation;
  },
  // Publishing is the one explicitly deliberate, Nay-only action that makes
  // a deliverable visible to the client — nothing else in this flow does
  // that. Also the only place price history gets written, append-only:
  // a past recommendation is never edited or overwritten, only superseded.
  publishValueDeliverable(clientId, deliverable) {
    const db = load();
    const rec = db.businessValueAssessments[clientId];
    if (!rec) return null;
    const now = new Date().toISOString();
    rec.publishedDeliverable = { ...deliverable, publishedAt: now };
    rec.status = 'published';
    rec.publishedAt = now;
    rec.updatedAt = now;

    const r = rec.recommendation;
    if (r && r.offerId && r.strategicPrice != null && r.strategicPrice !== '') {
      const offer = rec.answers.offers.find((o) => o.id === r.offerId);
      const priorHistory = db.priceHistory
        .filter((h) => h.clientId === clientId && h.offerId === r.offerId)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
      const previousPrice = priorHistory ? priorHistory.newPrice : (offer ? offer.currentPrice : null);
      const newPrice = Number(r.strategicPrice);
      if (previousPrice !== newPrice) {
        db.priceHistory.push({
          id: `ph${Date.now()}`, clientId, offerId: r.offerId, offerName: offer ? offer.name : '',
          recommendationId: rec.id, previousPrice, newPrice,
          reason: r.strategicJustification || '', effectiveDate: r.effectiveDate || null, reviewDate: r.reviewDate || null,
          createdBy: 'nay', createdAt: now,
        });
      }
    }
    save(db);
    return rec;
  },
  getPriceHistory(clientId) {
    return load().priceHistory.filter((h) => h.clientId === clientId).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  },
  // Dedupe key = clientId + sourceActivitySlug: repeated clicks / re-visits
  // across any Premium-preview activity never create a second active
  // interest record for that same activity. "Active" = novo/em_conversa —
  // once Nay resolves one (convertido/não seguirá), clicking again opens a
  // fresh one, which is correct (a new signal worth her attention).
  createPremiumUpgradeInterest(clientId, sourceActivitySlug = 'business') {
    const db = load();
    const c = db.clients[clientId];
    const existing = db.premiumUpgradeInterests.find((i) => (
      i.clientId === clientId && i.sourceActivitySlug === sourceActivitySlug && ['novo', 'em_conversa'].includes(i.status)
    ));
    if (existing) return existing;
    const item = {
      id: `pui${Date.now()}`, clientId, sourceActivitySlug, currentProgramSlug: c ? c.profile.programSlug : null,
      status: 'novo', createdAt: new Date().toISOString(), reviewedAt: null, reviewedBy: null,
    };
    db.premiumUpgradeInterests.push(item);
    save(db);
    return item;
  },
  getPremiumUpgradeInterests() {
    const db = load();
    return db.premiumUpgradeInterests.map((i) => {
      const c = db.clients[i.clientId];
      return {
        ...i,
        clientName: c ? c.profile.fullName : i.clientId,
        activityTitle: PROGRAM_ACTIVITY_LABEL[i.sourceActivitySlug] || i.sourceActivitySlug,
        currentProgramName: PROGRAM_LABEL_BY_SLUG[i.currentProgramSlug] || i.currentProgramSlug,
        currentPhase: c ? (TIER_PHASES[c.profile.tier] || [])[c.profile.phaseIndex] || null : null,
      };
    }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  },
  setUpgradeInterestStatus(id, status) {
    const db = load();
    const item = db.premiumUpgradeInterests.find((i) => i.id === id);
    if (!item) return null;
    item.status = status;
    item.reviewedAt = new Date().toISOString();
    item.reviewedBy = 'nay';
    save(db);
    return item;
  },
  getOwnerValueAnalysisOverview() {
    const db = load();
    const overview = {
      awaitingClientAnswers: 0, inProgress: 0, submittedAwaitingAnalysis: 0,
      inAnalysis: 0, clarificationsRequired: 0, readyToPublish: 0, publishedNeedingReview: 0,
      upgradeInterest: db.premiumUpgradeInterests.filter((i) => ['novo', 'em_conversa'].includes(i.status)).length,
    };
    const now = new Date();
    Object.values(db.clients).forEach((c) => {
      if (c.profile.programSlug !== 'persea-premium' || c.profile.status === 'onboarding') return;
      const rec = db.businessValueAssessments[c.profile.id];
      const status = rec ? rec.status : 'available';
      if (status === 'available') overview.awaitingClientAnswers++;
      if (status === 'in_progress') { overview.awaitingClientAnswers++; overview.inProgress++; }
      if (status === 'submitted') overview.submittedAwaitingAnalysis++;
      if (status === 'in_analysis') {
        overview.inAnalysis++;
        if (rec.recommendation && rec.recommendation.strategicPrice != null && rec.recommendation.strategicPrice !== '') overview.readyToPublish++;
      }
      if (rec && Object.values(rec.reviewStatus).includes('precisa_esclarecer') && status !== 'published') overview.clarificationsRequired++;
      if (status === 'published' && rec.recommendation?.reviewDate && new Date(rec.recommendation.reviewDate) <= now) overview.publishedNeedingReview++;
    });
    return overview;
  },
  // Dev-only: bypasses normal status transitions to jump straight to any of
  // the states the feature needs to be previewable in. Never called from
  // production-shaped flows — only the removable dev preview panel.
  // Dev-only: the Program Hub's preview panel. Forces the client active
  // (bypassing onboarding) so any program can be previewed with real
  // activity states regardless of the seeded client's actual status.
  devSetProgram(clientId, programSlug) {
    const db = load();
    const c = db.clients[clientId];
    if (!c) return null;
    c.profile.programSlug = programSlug;
    c.profile.status = 'active';
    if (programSlug === 'persea-premium') c.profile.tier = 'premium';
    save(db);
    return c.profile;
  },
  // Nay-driven, manual phase advancement — deliberately not automatic (see
  // item 10's "don't over-engineer automatic unlocking" note in
  // getClientJourney: finishing every activity in a phase doesn't unlock
  // the next one by itself). This is the one real door into
  // profile.phaseIndex; see admin/client-detail.js for the "Avançar Fase"
  // control that calls it, and getEncounterJourney/getClientJourney for
  // everywhere the resulting phase shows up for both her and the client.
  // Production Audit Remediation Pass (Critical 3): phase progression is
  // Admin-only per the authorization matrix — an assistant must not be able
  // to change it, including by calling this function directly (console,
  // another future caller), not just by the UI button being hidden. MockDB
  // is a pure client-side/localStorage layer with no server session to
  // check against, so actorRole is the caller's own honesty, same as any
  // other client-only code — it stops accidental/UI-bypass calls from
  // legitimate app code, though it cannot stop someone editing their own
  // browser's JS. The equivalent real-Supabase column (clients.phase_index)
  // has a genuine DB-level guard: see migration enforce_admin_only_phase_index.
  setClientPhase(clientId, index, actorRole = 'admin') {
    if (actorRole !== 'admin') return null;
    const db = load();
    const c = db.clients[clientId];
    if (!c) return null;
    const phases = TIER_PHASES[c.profile.tier] || TIER_PHASES.essential;
    const maxIndex = TIER_MAX_PHASE_INDEX[c.profile.tier] ?? (phases.length - 1);
    const clamped = Math.max(0, Math.min(index, maxIndex));
    const prevIndex = c.profile.phaseIndex;
    c.profile.phaseIndex = clamped;
    c.profile.status = 'active';
    save(db);
    if (clamped !== prevIndex) this.logActivity(clientId, 'phase_changed', `Fase avançada para "${phases[clamped]}" por Nay.`);
    return c.profile;
  },
  // Dev-only: nudges nearly every included activity to "completed" so the
  // "program nearly completed" preview state doesn't require hand-filling
  // every underlying feature (questionnaire, assessment, pitch...).
  devFastForwardProgress(clientId) {
    const db = load();
    const c = db.clients[clientId];
    if (!c) return null;
    c.profile.status = 'active';
    c.questionnaire.status = 'submitted';
    const qStep = c.journey.steps.find((s) => s.key === 'questionnaire');
    if (qStep) qStep.status = 'completed';
    c.assessment.status = 'completed';
    const aStep = c.journey.steps.find((s) => s.key === 'assessment');
    if (aStep) aStep.status = 'completed';
    if (!c.pitches) c.pitches = { pitch_10s: '—', pitch_30s: '—', pitch_60s: '—', pitch_networking: '—', instagram_bio: '—', linkedin_summary: '—' };
    const pStep = c.journey.steps.find((s) => s.key === 'pitch');
    if (pStep) pStep.status = 'completed';
    c.guideAcknowledged = true;
    c.imagesStatus = 'aprovado';
    if (!c.brandDirection.positioningSummary) c.brandDirection.positioningSummary = 'Definido pela equipe.';
    c.brandIdeas = c.brandIdeas || 'Ideias registradas.';
    c.contentActivity = { status: 'feedback_available', submission: 'Envio de exemplo.', feedback: 'Ótimo trabalho — siga assim.', updatedAt: new Date().toISOString() };
    save(db);
    return true;
  },
  devSetValueAssessmentState(clientId, { tier, programSlug, status } = {}) {
    const db = load();
    const c = db.clients[clientId];
    if (!c) return null;
    if (tier) c.profile.tier = tier;
    if (programSlug) c.profile.programSlug = programSlug;
    if (status) {
      // Any non-upcoming/non-locked state implies she's past onboarding —
      // force it so the dev panel works on any seeded client, including
      // ones seeded mid-onboarding.
      c.profile.status = 'active';
      let rec = db.businessValueAssessments[clientId];
      if (!rec) { rec = newValueAssessmentRecord(clientId); db.businessValueAssessments[clientId] = rec; }
      rec.status = status;
      const now = new Date().toISOString();
      if (status === 'in_progress' && !rec.startedAt) rec.startedAt = now;
      if (status === 'submitted' && !rec.submittedAt) rec.submittedAt = now;
      if (status === 'in_analysis' && !rec.analysisStartedAt) rec.analysisStartedAt = now;
      if (status === 'published') {
        rec.publishedAt = rec.publishedAt || now;
        if (!rec.publishedDeliverable) {
          rec.publishedDeliverable = {
            situationSummary: 'Resumo de exemplo gerado pela pré-visualização de desenvolvimento.',
            mainFinding: 'Sua capacidade atual não sustenta a meta de faturamento desejada.',
            mathematicalMinimum: 5200, strategicPrice: 6200,
            explanation: 'Este é um exemplo — publique uma devolutiva real pela Ficha de Valor e Precificação.',
            offerChanges: '', nextActions: '', recommendationDate: now.slice(0, 10), reviewDate: '', publishedAt: now,
          };
        }
      }
      rec.updatedAt = now;
    }
    save(db);
    return { client: c, rec: db.businessValueAssessments[clientId] };
  },

  // --- Financial summary & forecast ---
  // Deliberately simple: sums of already-recorded/scheduled data, not a
  // statistical model — same honesty level as the rest of this prototype's
  // "AI" outputs (see regenerateQuestionnaireAnalysis).
  // `program` scopes revenue to one program's clients. Expenses are always
  // business-wide (not attributable to a single client/program), so they're
  // never filtered — the UI should make that clear when a program filter is active.
  getFinancialSummary({ program } = {}) {
    const payments = this.getAllPayments({ program });
    const expenses = this.getExpenses();
    const totalPaid = payments.filter((p) => p.status === 'paid').reduce((s, p) => s + p.amount, 0);
    const totalPending = payments.filter((p) => p.status === 'pending').reduce((s, p) => s + p.amount, 0);
    const totalOverdue = payments.filter((p) => p.status === 'overdue').reduce((s, p) => s + p.amount, 0);
    const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);
    const byProgram = {};
    PROGRAMS.forEach((prog) => { byProgram[prog] = 0; });
    payments.filter((p) => p.status === 'paid').forEach((p) => {
      if (p.program) byProgram[p.program] = (byProgram[p.program] || 0) + p.amount;
    });
    return { totalPaid, totalPending, totalOverdue, totalExpenses, net: totalPaid - totalExpenses, byProgram };
  },
  getFinancialForecast(months = 3, { program } = {}) {
    const payments = this.getAllPayments({ program }).filter((p) => p.status !== 'paid');
    const now = new Date();
    const buckets = [];
    for (let i = 0; i < months; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      buckets.push({ year: d.getFullYear(), month: d.getMonth(), label: d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }), total: 0 });
    }
    payments.forEach((p) => {
      const due = new Date(p.dueDate);
      const b = buckets.find((b) => b.year === due.getFullYear() && b.month === due.getMonth());
      if (b) b.total += p.amount;
    });
    return buckets;
  },

  // --- Reports ---
  getAdherenceReport({ program } = {}) {
    const db = load();
    let assignments = this.getAllAssignments();
    if (program) assignments = assignments.filter((a) => db.clients[a.studentId]?.onboarding.contract.program === program);
    const now = new Date();
    const withStatus = assignments.map((a) => {
      const overdue = !a.completed && a.deadline && new Date(a.deadline) < now;
      const status = a.completed ? 'completed' : overdue ? 'overdue' : 'pending';
      return { ...a, adherenceStatus: status };
    });
    const total = withStatus.length;
    const completed = withStatus.filter((a) => a.adherenceStatus === 'completed').length;
    const overdue = withStatus.filter((a) => a.adherenceStatus === 'overdue').length;
    const pending = withStatus.filter((a) => a.adherenceStatus === 'pending').length;
    const byClient = {};
    withStatus.forEach((a) => {
      if (!byClient[a.studentId]) byClient[a.studentId] = { clientId: a.studentId, clientName: a.clientName, total: 0, completed: 0, overdue: 0 };
      byClient[a.studentId].total++;
      if (a.adherenceStatus === 'completed') byClient[a.studentId].completed++;
      if (a.adherenceStatus === 'overdue') byClient[a.studentId].overdue++;
    });
    return {
      total, completed, overdue, pending,
      completedPct: total ? Math.round((completed / total) * 100) : null,
      byClient: Object.values(byClient),
    };
  },
  getEngagementReport(thresholdDays = 14, { program } = {}) {
    const db = load();
    const now = new Date();
    const clients = Object.values(db.clients)
      .filter((c) => !program || c.onboarding.contract.program === program)
      .map((c) => {
        const lastAt = c.activity.length ? c.activity.reduce((max, e) => (new Date(e.at) > new Date(max) ? e.at : max), c.activity[0].at) : null;
        const daysSince = lastAt ? Math.floor((now - new Date(lastAt)) / 86400000) : null;
        return { clientId: c.profile.id, clientName: c.profile.fullName, lastActivityAt: lastAt, daysSinceActivity: daysSince, inactive: daysSince === null || daysSince > thresholdDays };
      })
      .sort((a, b) => (b.daysSinceActivity ?? Infinity) - (a.daysSinceActivity ?? Infinity));
    return { thresholdDays, clients, inactiveCount: clients.filter((c) => c.inactive).length };
  },

  // --- Success metrics — the proof-of-impact numbers Nay actually cares
  // about, per her explicit request: revenue growth, lead conversion,
  // upsells among existing clients, and the pricing-strategy lift she
  // delivers through the Leitura Estratégica de Valor. Every number here is
  // derived from data that already exists elsewhere (payments, leads,
  // programHistory, priceHistory) — nothing new to seed or keep in sync.
  getSuccessMetrics(months = 6) {
    const db = load();

    // Revenue growth — paid revenue by month, oldest to newest.
    const now = new Date();
    const buckets = [];
    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      buckets.push({ year: d.getFullYear(), month: d.getMonth(), label: d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }), total: 0 });
    }
    this.getAllPayments().filter((p) => p.status === 'paid' && p.paidAt).forEach((p) => {
      const paid = new Date(p.paidAt);
      const b = buckets.find((b) => b.year === paid.getFullYear() && b.month === paid.getMonth());
      if (b) b.total += p.amount;
    });
    const populated = buckets.filter((b) => b.total > 0);
    const revenueGrowthPct = populated.length >= 2
      ? Math.round(((populated[populated.length - 1].total - populated[0].total) / populated[0].total) * 100)
      : null;

    // Lead conversion — reuse the existing summary, framed as a success metric.
    const leadConversion = this.getLeadsSummary();

    // Upsells — real (non-seed) program upgrades among existing clients.
    const upsells = [];
    Object.values(db.clients).forEach((c) => {
      const history = c.programHistory || [];
      history.forEach((h, i) => {
        if (h.changedBy !== 'nay') return;
        const from = history[i - 1];
        upsells.push({
          clientId: c.profile.id, clientName: c.profile.fullName,
          fromLabel: from ? PROGRAM_LABEL_BY_SLUG[from.programSlug] : '—',
          toLabel: PROGRAM_LABEL_BY_SLUG[h.programSlug], changedAt: h.changedAt,
        });
      });
    });
    upsells.sort((a, b) => new Date(b.changedAt) - new Date(a.changedAt));

    // Pricing-strategy impact — every published strategic price recommendation,
    // with the multiplier over the client's previous price and, where the
    // underlying offer's own sales volume is known, the monthly revenue lift
    // that price change represents for her.
    const pricingImpact = db.priceHistory.map((h) => {
      const c = db.clients[h.clientId];
      const rec = db.businessValueAssessments[h.clientId];
      const matchedOffer = rec?.answers?.offers?.find((o) => o.id === h.offerId) || null;
      const monthlySales = matchedOffer ? Number(matchedOffer.avgMonthlySales) || null : null;
      return {
        clientId: h.clientId, clientName: c ? c.profile.fullName : h.clientId, offerName: h.offerName,
        previousPrice: h.previousPrice, newPrice: h.newPrice,
        multiplier: h.previousPrice ? h.newPrice / h.previousPrice : null,
        monthlyLift: monthlySales ? (h.newPrice - h.previousPrice) * monthlySales : null,
        createdAt: h.createdAt,
      };
    }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const avgMultiplier = pricingImpact.length
      ? pricingImpact.reduce((s, p) => s + (p.multiplier || 1), 0) / pricingImpact.length
      : null;
    const totalMonthlyLift = pricingImpact.reduce((s, p) => s + (p.monthlyLift || 0), 0);

    return {
      revenueGrowth: { months: buckets, growthPct: revenueGrowthPct },
      leadConversion,
      upsells: { count: upsells.length, entries: upsells },
      pricingImpact: { count: pricingImpact.length, avgMultiplier, totalMonthlyLift, entries: pricingImpact },
    };
  },

  // --- Leads / pipeline ---
  getLeads() {
    return load().leads;
  },
  getLead(id) {
    return load().leads.find((l) => l.id === id) || null;
  },
  createLead(data) {
    const db = load();
    const now = new Date().toISOString();
    const lead = {
      id: `lead${Date.now()}`, fullName: '', email: '', phone: '',
      source: 'vip_group', vipGroupStatus: 'in_group', stage: 'novo', interestedProgram: null,
      socialLinks: { ...BLANK_SOCIAL_LINKS }, notes: '', interactions: [],
      convertedToClientId: null, convertedAt: null,
      // Post-sale onboarding fields (see LEAD_ONBOARDING_STATUSES) — null
      // until agreeSale() starts the new flow for this lead.
      program: null, onboardingStatus: null, commercialTerms: null,
      registrationToken: null, registrationInfo: null, registrationSentAt: null, registrationCompletedAt: null,
      contractStatus: null, signedFileName: null, history: [],
      createdAt: now, updatedAt: now, ...data,
    };
    db.leads.push(lead);
    save(db);
    return lead;
  },
  updateLead(id, patch) {
    const db = load();
    const lead = db.leads.find((l) => l.id === id);
    if (lead) Object.assign(lead, patch, { updatedAt: new Date().toISOString() });
    save(db);
    return lead;
  },
  deleteLead(id) {
    const db = load();
    db.leads = db.leads.filter((l) => l.id !== id);
    save(db);
  },
  addLeadInteraction(id, { date, summary }) {
    const db = load();
    const lead = db.leads.find((l) => l.id === id);
    if (!lead) return null;
    const interaction = { id: `li${Date.now()}`, date: date || new Date().toISOString(), summary };
    lead.interactions.unshift(interaction);
    lead.updatedAt = new Date().toISOString();
    save(db);
    return interaction;
  },
  getLeadsSummary() {
    const leads = load().leads;
    const total = leads.length;
    const inGroup = leads.filter((l) => l.vipGroupStatus === 'in_group').length;
    const converted = leads.filter((l) => l.stage === 'convertido').length;
    return { total, inGroup, converted, conversionRatePct: total ? Math.round((converted / total) * 100) : 0 };
  },

  // --- Post-sale onboarding (see LEAD_ONBOARDING_STATUSES note above) ---
  // The precise, Nay-facing label for wherever a lead actually is —
  // reuses ONBOARDING_STAGE_LABEL for the contract stretch instead of a
  // second vocabulary. Falls back to the old top-of-funnel LEAD_STAGE_LABEL
  // for anything that never had a sale agreed yet.
  getLeadPipelineLabel(lead) {
    if (!lead.onboardingStatus) return LEAD_STAGE_LABEL[lead.stage] || lead.stage;
    if (lead.onboardingStatus === 'registration_completed' && (!lead.contractStatus || lead.contractStatus === 'info_pending')) {
      return 'Cadastro Recebido — Contrato Pendente';
    }
    if (lead.onboardingStatus === 'in_contract' && lead.contractStatus) {
      return ONBOARDING_STAGE_LABEL[lead.contractStatus] || LEAD_ONBOARDING_STATUS_LABEL.in_contract;
    }
    return LEAD_ONBOARDING_STATUS_LABEL[lead.onboardingStatus] || lead.onboardingStatus;
  },
  // Every lead with a commercial agreement in flight, regardless of how far
  // along — the "Onboarding" admin view's source list (see admin/leads.js).
  // Ordered so whatever most needs Nay/the assistant's attention floats up:
  // ready to activate first, then in-contract, then earlier stages.
  getOnboardingPipeline() {
    const weight = { ready_for_activation: 0, in_contract: 1, registration_completed: 2, registration_sent: 3, sale_agreed: 4 };
    return load().leads
      .filter((l) => l.onboardingStatus && l.onboardingStatus !== 'client_active')
      .map((l) => ({ ...l, pipelineLabel: this.getLeadPipelineLabel(l) }))
      .sort((a, b) => (weight[a.onboardingStatus] ?? 9) - (weight[b.onboardingStatus] ?? 9));
  },
  // The assistant's slice of the same pipeline — only from the point her
  // job actually starts (cadastro received) onward, since contract prep and
  // "Ativar Cliente" are her actions, not Nay's (see assistant/leads.js).
  // Sorted so whoever is one click from activation floats to the top —
  // same "crucial thing near the top" ordering used in getAssistantChecklist.
  getAssistantOnboardingQueue() {
    const weight = { ready_for_activation: 0, in_contract: 1, registration_completed: 2 };
    return load().leads
      .filter((l) => l.registrationCompletedAt && l.onboardingStatus !== 'client_active')
      .map((l) => ({ ...l, pipelineLabel: this.getLeadPipelineLabel(l) }))
      .sort((a, b) => (weight[a.onboardingStatus] ?? 9) - (weight[b.onboardingStatus] ?? 9));
  },
  // Nay/assistant enter what was agreed on the sales call — the client
  // never sees or edits these terms from her registration form. The
  // registration link is generated right here, same click as closing the
  // sale — Nay is usually still on the call/WhatsApp with the client at
  // this exact moment, so there's no separate "now generate the link" step
  // to come back for; the link is just already there, ready to copy.
  // paymentMethods is always an array — clients often combine more than one
  // (part on card, part on Pix), so this was never really a single-select
  // fact. paymentMethod (singular) is kept alongside as the first entry,
  // purely so existing single-method checks elsewhere (e.g. the "sold on
  // card triggers NF automatically" rule) don't need to know about the
  // array — see activateLead, which carries both onto the real contract.
  // paymentLines is the same free-form model used everywhere else payment
  // terms get entered (client onboarding, real contract) — any number of
  // lines, each its own amount/method/optional date, in any combination or
  // order. agreedAmount/installments/paymentMethod(s)/firstDueDate are kept
  // as derived summary fields (sum, count, distinct methods, earliest date)
  // purely so existing displays elsewhere (crm.js's pipeline card) don't
  // need to know about the line list — never hand-entered directly anymore.
  agreeSale(id, { program, paymentLines, commercialNotes, responsibleId }) {
    const db = load();
    const lead = db.leads.find((l) => l.id === id);
    if (!lead) return null;
    const lines = (paymentLines || []).filter((l) => l.amount > 0);
    const methods = [...new Set(lines.map((l) => l.method).filter(Boolean))];
    const dates = lines.map((l) => l.dueDate).filter(Boolean).sort();
    lead.program = program || lead.program || null;
    lead.commercialTerms = {
      paymentLines: lines, paymentMethods: methods, paymentMethod: methods[0] || null,
      installments: lines.length || null, agreedAmount: lines.reduce((s, l) => s + (Number(l.amount) || 0), 0) || null,
      firstDueDate: dates[0] || null, commercialNotes: commercialNotes || '', responsibleId: responsibleId || null,
      saleAgreedAt: new Date().toISOString(),
    };
    lead.onboardingStatus = 'sale_agreed';
    if (!lead.registrationToken) lead.registrationToken = `${id}-${Math.random().toString(36).slice(2, 10)}${Math.random().toString(36).slice(2, 10)}`;
    lead.updatedAt = new Date().toISOString();
    save(db);
    this.logLeadHistory(id, 'sale_agreed', 'Condições comerciais registradas.');
    return lead;
  },
  // Idempotent — calling it again just returns the same link rather than
  // invalidating whatever the client may already have open.
  generateRegistrationLink(id) {
    const db = load();
    const lead = db.leads.find((l) => l.id === id);
    if (!lead) return null;
    if (!lead.registrationToken) {
      lead.registrationToken = `${id}-${Math.random().toString(36).slice(2, 10)}${Math.random().toString(36).slice(2, 10)}`;
      save(db);
    }
    return lead.registrationToken;
  },
  markRegistrationSent(id) {
    const db = load();
    const lead = db.leads.find((l) => l.id === id);
    if (!lead) return null;
    lead.registrationSentAt = new Date().toISOString();
    if (lead.onboardingStatus === 'sale_agreed') lead.onboardingStatus = 'registration_sent';
    save(db);
    this.logLeadHistory(id, 'registration_sent', 'Formulário de cadastro enviado à cliente.');
    return lead;
  },
  // Public-safe lookup for the registration page (see client/registration.js)
  // — the only entry point an unauthenticated visitor has into any lead
  // data, and deliberately returns just what the form needs to render,
  // never commercial notes/responsible/internal fields. A wrong or made-up
  // token returns null, same as one that belonged to a since-finalized
  // onboarding (see below) — no signal either way about whether it ever
  // existed. Real cross-account isolation still requires a real backend;
  // see the report note on this.
  getLeadByToken(token) {
    if (!token) return null;
    const lead = load().leads.find((l) => l.registrationToken === token);
    if (!lead) return null;
    return {
      id: lead.id, fullName: lead.fullName, program: lead.program,
      registrationInfo: lead.registrationInfo || blankRegistrationInfo(),
      alreadySubmitted: !!lead.registrationCompletedAt,
    };
  },
  submitRegistration(token, info) {
    const db = load();
    const lead = db.leads.find((l) => l.registrationToken === token);
    if (!lead) return { ok: false, error: 'invalid_token' };
    lead.registrationInfo = { ...blankRegistrationInfo(), ...info, submitted: true };
    lead.registrationCompletedAt = new Date().toISOString();
    lead.onboardingStatus = 'registration_completed';
    lead.updatedAt = new Date().toISOString();
    save(db);
    this.logLeadHistory(lead.id, 'registration_completed', 'Cadastro recebido da cliente.');
    return { ok: true };
  },
  // Reuses ONBOARDING_STAGES verbatim (see const above) — same contract
  // sub-lifecycle a client already progresses through post-activation.
  advanceLeadContractStatus(id, status) {
    const db = load();
    const lead = db.leads.find((l) => l.id === id);
    if (!lead) return null;
    lead.contractStatus = status;
    if (lead.onboardingStatus === 'registration_completed' || lead.onboardingStatus === 'sale_agreed') lead.onboardingStatus = 'in_contract';
    if (status === 'completed') lead.onboardingStatus = 'ready_for_activation';
    lead.updatedAt = new Date().toISOString();
    save(db);
    this.logLeadHistory(id, 'contract_status_changed', `Status do contrato: ${ONBOARDING_STAGE_LABEL[status] || status}`);
    return lead;
  },
  async uploadLeadSignedContract(id, fileName) {
    await delay(600);
    const db = load();
    const lead = db.leads.find((l) => l.id === id);
    if (!lead) return null;
    lead.signedFileName = fileName;
    lead.contractStatus = 'completed';
    lead.onboardingStatus = 'ready_for_activation';
    lead.updatedAt = new Date().toISOString();
    save(db);
    this.logLeadHistory(id, 'contract_signed', 'Contrato assinado enviado — pronta para ativação.');
    return lead;
  },
  // Same "one running log" convention as whatsappNotes/activity elsewhere —
  // guards against a duplicate entry if an action is retried (e.g. clicking
  // "marcar como enviado" twice), per the "avoid duplicate history" ask.
  logLeadHistory(id, type, text) {
    const db = load();
    const lead = db.leads.find((l) => l.id === id);
    if (!lead) return;
    lead.history = lead.history || [];
    const last = lead.history[0];
    if (last && last.type === type && last.text === text) return;
    lead.history.unshift({ type, text, at: new Date().toISOString() });
    save(db);
  },
  // The only door into db.clients for a post-sale lead — gated on exactly
  // "contract signed + onboarding ready" per the methodology, so a client
  // row (and therefore any OS access) cannot exist before that. Internally
  // reuses convertLeadToClient (the pre-existing, still-available quick
  // path) and folds in everything collected since: her registration answers
  // and Nay's commercial terms, so nothing already typed is asked for again.
  activateLead(id) {
    const lead = this.getLead(id);
    if (!lead) return { ok: false, error: 'not_found' };
    if (lead.convertedToClientId) return { ok: true, clientId: lead.convertedToClientId }; // no duplicate client rows on retry
    if (lead.onboardingStatus !== 'ready_for_activation') return { ok: false, error: 'not_ready' };
    const tier = lead.program === 'persea-premium' ? 'premium' : 'essential';
    const clientId = this.convertLeadToClient(id, { tier, programSlug: lead.program || 'persea-essential' });
    if (!clientId) return { ok: false, error: 'convert_failed' };
    const db = load();
    const c = db.clients[clientId];
    const reg = lead.registrationInfo || {};
    const ct = lead.commercialTerms || {};
    c.profile.status = 'active'; // she already paid + signed — never "onboarding" from her own side
    // Invitation-based access (see item 8): she gets a "create your access"
    // interstitial the first time the client side loads for her, instead of
    // a visible password. See shared/client-context.js's
    // renderAccessPendingGate + createClientAccess below.
    c.profile.accessStatus = 'pending';
    c.onboarding.clientInfo = {
      ...c.onboarding.clientInfo, ...reg, submitted: true,
      address: reg.street
        ? `${reg.street}, ${reg.number || 's/n'}${reg.complement ? ' - ' + reg.complement : ''} - ${reg.neighborhood || ''}, ${reg.city || ''} - ${reg.state || ''}`.trim()
        : c.onboarding.clientInfo.address,
    };
    c.onboarding.contract = {
      ...c.onboarding.contract, program: lead.program || null, value: ct.agreedAmount ?? null,
      paymentMethod: ct.paymentMethod || null, paymentMethods: ct.paymentMethods || [], installments: ct.installments || null,
      status: 'completed', signedFileName: lead.signedFileName || null,
      notes: ct.commercialNotes || c.onboarding.contract.notes,
    };
    // Carries the exact payment lines agreed at the sale straight onto the
    // client's own Plano de Pagamento (client-detail.js's Onboarding tab) —
    // the whole point of capturing them as structured lines up front is
    // that nobody has to re-type this schedule after activation.
    if (ct.paymentLines?.length) {
      c.payments = ct.paymentLines.map((l, i) => ({
        id: `p${clientId}-${Date.now()}-${i}`, dueDate: l.dueDate || new Date().toISOString().slice(0, 10),
        amount: Number(l.amount) || 0, method: l.method || null, label: l.label || null,
        status: 'pending', paidAt: null,
      }));
    }
    c.activity.unshift({ type: 'lead_activated', text: 'Cliente ativada — onboarding comercial concluído.', at: new Date().toISOString() });
    save(db);
    const db2 = load();
    const leadAfter = db2.leads.find((l) => l.id === id);
    leadAfter.onboardingStatus = 'client_active';
    save(db2);
    this.logLeadHistory(id, 'client_activated', 'Cliente ativada — acesso ao Persea OS liberado.');
    return { ok: true, clientId };
  },

  // Promotes a lead into a real client record — same shape/defaults as a
  // fresh onboarding-stage client elsewhere in this seed (locked journey
  // steps, blank questionnaire, no playbook yet), so it drops straight into
  // the existing Clientes/Onboarding pipeline with no special-casing needed
  // anywhere else in the app.
  //
  // Production Audit Remediation Pass (Critical 1): this used to be
  // directly callable — via a now-removed admin UI shortcut, or from
  // anywhere else — with no precondition, so a lead could become a client
  // (and get real OS access) before cadastro/contrato existed. The only
  // sanctioned caller today is activateLead, which already checks this same
  // precondition before calling in. The check is duplicated here, not just
  // there, so that fact stays true even if a future caller forgets to check
  // first, is added elsewhere, or this is invoked directly (console,
  // another button, anything) — "impossible to execute" outside the real
  // flow, not merely hidden from the UI.
  convertLeadToClient(id, { tier = 'essential', programSlug = 'persea-essential' } = {}) {
    const db = load();
    const lead = db.leads.find((l) => l.id === id);
    if (!lead) return null;
    if (lead.convertedToClientId) return lead.convertedToClientId; // idempotent — never a second client row
    if (lead.onboardingStatus !== 'ready_for_activation') return null; // contract+onboarding must be done first
    const clientId = `client-${Date.now()}`;
    const now = new Date().toISOString();
    const nextWeek = new Date(); nextWeek.setDate(nextWeek.getDate() + 7);
    db.clients[clientId] = {
      profile: { id: clientId, fullName: lead.fullName, email: lead.email, status: 'onboarding', tier, phaseIndex: 0, programSlug, gender: null },
      socialLinks: { ...lead.socialLinks },
      onboarding: {
        clientInfo: {
          submitted: false, fullName: lead.fullName, partyType: 'PF', cpf: '', cnpj: null, companyName: null,
          address: '', email: lead.email, whatsapp: lead.phone || '',
        },
        contract: {
          program: null, duration: null, status: 'info_pending', value: null, signedFileName: null,
          notes: `Convertida de lead — origem: ${LEAD_SOURCE_LABEL[lead.source] || lead.source}.`,
          paymentMethod: null, installments: null,
        },
        whatsappGroup: { status: lead.vipGroupStatus === 'in_group' ? 'added' : 'not_added' },
      },
      payments: [],
      brandDirection: {
        pinterestUrl: null, moodBoardIntro: '', positioningSummary: '', keywords: [], tone: '', references: [],
        guidance: '', belongs: [], doesntBelong: [], updatedAt: null,
      },
      brandIdeas: '',
      journey: {
        programName: 'Identidade',
        steps: [
          { key: 'questionnaire', title: 'Extração de Marca', status: 'locked' },
          { key: 'meeting_1', title: 'E1 — Extração e Essência', status: 'locked' },
          { key: 'playbook_review', title: 'Playbook de Marca Pessoal', status: 'locked' },
          { key: 'assessment', title: 'Teste de Arquétipos', status: 'locked' },
          { key: 'pitch', title: 'Gerador de Pitch', status: 'locked' },
          { key: 'homework', title: 'Tarefas', status: 'locked' },
        ],
        upcomingMeeting: { title: 'E1 — Extração e Essência — a agendar após onboarding', date: nextWeek.toISOString() },
      },
      questionnaire: {
        title: 'Extração de Marca',
        questions: [
          { id: 'q1', text: 'Pelo que você quer ser conhecida daqui a 3 anos?', type: 'long_text', answer: '' },
          { id: 'q2', text: 'O que parece mais verdadeiro sobre quem você é agora?', type: 'long_text', answer: '' },
          { id: 'q3', text: 'Qual é a transformação que você ajuda as pessoas a fazerem?', type: 'long_text', answer: '' },
          { id: 'q4', text: 'Avalie sua confiança atual na sua marca pessoal (1-10)', type: 'scale', answer: '' },
        ],
        status: 'in_progress',
      },
      questionnaireAnalysis: {
        version: 0, generatedAt: null, executiveSummary: 'Ainda não gerada — disponível após o envio do questionário.',
        strengths: [], goals: [], painPoints: [], opportunities: [], suggestedQuestions: [], businessMaturity: '—',
      },
      meeting: { title: 'E1 — Extração e Essência', transcriptUploaded: false, status: 'scheduled' },
      transcriptAnalysis: null,
      playbook: { versions: [] },
      assessment: { title: 'Teste de Arquétipos', description: 'Uma breve avaliação externa para identificar seu arquétipo de marca dominante.', externalUrl: 'https://example.com/archetype-test', status: 'not_started' },
      archetypeQuiz: { visualSet: null, notes: '', attempts: [] },
      pitches: null,
      homework: [
        { id: 'h1', title: 'Ler o Playbook', type: 'boolean', status: 'pending' },
        { id: 'h2', title: 'Gravação do Pitch (áudio ou vídeo)', type: 'media_upload', status: 'pending', submissions: [] },
        { id: 'h3', title: 'Perguntas de Reflexão', type: 'text_submission', status: 'pending', submission: '' },
      ],
      activity: [{ type: 'lead_converted', text: 'Convertida de lead para cliente', at: now }],
      playbookExperience: { format: null, completedAt: null },
      quiz: { score: null, total: null, completedAt: null },
      meetingRequests: [],
      notes: '',
      moodLog: [],
      guideAcknowledged: false,
      images: [],
      imagesStatus: 'aguardando_envio',
      imagesNote: '',
      photoReminder: { sentAt: null, note: '' },
      whatsappNotes: [],
      contentActivity: { status: 'not_started', submission: '', feedback: '', updatedAt: null },
      imageProjectStatus: 'not_started',
      imageGuides: [{ slug: 'paleta_cores', fileUrl: null, note: '' }, { slug: 'estilo', fileUrl: null, note: '' }, { slug: 'moodboard_ensaio', fileUrl: null, note: '' }, { slug: 'guia_looks_mensal', fileUrl: null, note: '' }],
      digitalKit: { fileUrl: null },
      hublaAccess: { status: 'not_granted', grantedAt: null },
      programHistory: [{ programSlug, changedAt: now, changedBy: 'lead_conversion' }],
    };
    lead.stage = 'convertido';
    lead.convertedToClientId = clientId;
    lead.convertedAt = now;
    lead.updatedAt = now;
    save(db);
    return clientId;
  },

  // --- VIP group dynamics — the numbers behind "did this dynamic move the needle" ---
  getGroupDynamics() {
    return load().groupDynamics.slice().sort((a, b) => new Date(b.date) - new Date(a.date));
  },
  addGroupDynamic(data) {
    const db = load();
    const dynamic = {
      id: `gd${Date.now()}`, title: '', date: new Date().toISOString().slice(0, 10), description: '',
      metricLabel: '', beforeCount: 0, afterCount: 0, ...data,
    };
    db.groupDynamics.push(dynamic);
    save(db);
    return dynamic;
  },
  deleteGroupDynamic(id) {
    const db = load();
    db.groupDynamics = db.groupDynamics.filter((d) => d.id !== id);
    save(db);
  },

  // --- Social links (clients) — leads carry theirs directly on the lead object ---
  getSocialLinks(id = DEFAULT_CLIENT_ID) {
    return client(load(), id).socialLinks || { ...BLANK_SOCIAL_LINKS };
  },
  saveSocialLinks(id, links) {
    const db = load();
    client(db, id).socialLinks = links;
    save(db);
  },
};

export const MOOD_SCALE = [
  { value: 1, emoji: '😞', label: 'Muito mal' },
  { value: 2, emoji: '😕', label: 'Mal' },
  { value: 3, emoji: '😐', label: 'Neutro' },
  { value: 4, emoji: '🙂', label: 'Bem' },
  { value: 5, emoji: '😄', label: 'Ótimo' },
];

function moodStatsFor(entries) {
  const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  entries.forEach((e) => { distribution[e.mood] = (distribution[e.mood] || 0) + 1; });
  const count = entries.length;
  const avg = count ? entries.reduce((sum, e) => sum + e.mood, 0) / count : null;
  return { count, avg, distribution };
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
