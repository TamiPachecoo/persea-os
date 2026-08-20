// Mock data layer — stands in for agency-framework/*-engine/api.js + Supabase.
// Same shape/intent as the real engines: screens only ever call functions here,
// never touch storage directly. Swapping to Supabase later = rewriting this
// file's internals; screens stay untouched.
//
// Keyed by clientId throughout (client_id is a real FK in the schema — see
// docs/02-database-schema.md) so the admin side can hold several clients at
// once, each progressing through the journey independently.

import { blankAssessmentAnswers, blankOffer, blankFixedCost, blankVariableCost, blankReference } from './value-analysis-schema.js';

const STORAGE_KEY = 'persea_mock_db_v26';
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

// Mentoring program phases per tier — tenant-level config (persea/methodology/
// in the real build), not per-client. A client's progress is just an index
// into their tier's phase list. Aligned with the Nova Persea methodology's
// Fase 1-4 groupings (see ENCOUNTER_DEFS below for which encounters land in
// each phase) — same phase *count* per tier as before this alignment pass,
// just renamed; renderPhaseTracker (ui.js) is index/label-agnostic so this
// is a pure data rename, no component change needed.
export const TIER_PHASES = {
  premium: ['Essência, Comunicação e Vendas', 'Imagem e Estratégia', 'Posicionamento e Metas', 'Negócio e Aquisição'],
  essential: ['Essência, Comunicação e Vendas', 'Imagem e Estratégia', 'Posicionamento e Metas'],
};

// --- Program Hub ------------------------------------------------------------
// The real enrollment model, replacing the old tier(premium/essential) +
// onboarding.contract.program(persea/ascensao_imagem) duality with one
// explicit field: profile.programSlug. `tier` is kept on the client record
// only for the pre-existing phase-ladder widget (TIER_PHASES above) — it no
// longer gates anything (see getProgramActivityAccess). One known data
// inconsistency this surfaced: client-6 has tier:'premium' but her real
// contract product is Ascensão de Imagem — programSlug (derived from her
// actual contract) is authoritative, so she correctly sees Business as a
// Premium preview despite the stale tier value. Flagged, not silently fixed.
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
  {
    // Duration intentionally null — never invented. Set it via
    // MockDB.setProgramDuration once Nay confirms a real value.
    slug: 'ascensao-imagem', name: 'Ascensão de Imagem', durationMonths: null, displayOrder: 3,
    description: 'Um programa focado em imagem pessoal, da extração de marca ao pitch, com prévias das experiências Premium.',
    // Not part of the Nova Persea E1-E8 methodology — a separate, simpler
    // product, so it deliberately has no positioning tagline here.
    positioning: null, supportingStatement: null,
  },
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
    purpose: 'Entender o que a cliente vende e por que vende — considerando o onboarding, o Teste de Arquétipos e a Extração de Marca.',
    premiumOnly: false,
  },
  {
    number: 2, slug: 'e2', name: 'Comunicação e Vendas', phase: 0,
    purpose: 'Entender as dificuldades de venda da cliente, trabalhar comunicação, posicionamento e pitch, e definir o que ela precisa praticar.',
    premiumOnly: false,
  },
  {
    number: 3, slug: 'e3', name: 'Imagem e Estratégia', phase: 1,
    purpose: 'Conectar imagem pessoal à estratégia e percepção do negócio — revisar estilo e coordenar os entregáveis de imagem.',
    premiumOnly: false,
  },
  {
    number: 4, slug: 'e4', name: 'Posicionamento e Metas', phase: 2,
    purpose: 'Esclarecer para quem, onde e por que a cliente deve se posicionar, e estabelecer metas tangíveis. Encerramento formal da Persea Essencial.',
    premiumOnly: false,
  },
  {
    number: 5, slug: 'e5', name: 'Vendas e Comunicação', phase: 3,
    purpose: 'Aprofundar as sete etapas do pitch de vendas, ouvir as barreiras comerciais da cliente e refinar comunicação e valor percebido.',
    premiumOnly: true,
  },
  {
    number: 6, slug: 'e6', name: 'Negócio e Aquisição', phase: 3,
    purpose: 'Analisar nicho, mercado e números do negócio, avaliar oferta e precificação, e definir indicadores mensuráveis de ROI.',
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
  {
    slug: 'activity-guide', title: 'Guia de Atividades', activityType: 'document', displayOrder: 3,
    description: 'Veja como preparar e fotografar as imagens que serão analisadas pela equipe.', route: 'activity-guide.html',
  },
  {
    slug: 'initial-images', title: 'Imagens', activityType: 'upload', displayOrder: 4,
    description: 'Envie as imagens solicitadas para que a equipe possa iniciar sua análise.', route: 'images.html',
  },
  {
    slug: 'brand-direction', title: 'Direção da Marca', activityType: 'workspace', displayOrder: 5,
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
    'brand-extraction': 'included', 'archetype-test': 'included', 'activity-guide': 'included', 'initial-images': 'included',
    'brand-direction': 'included', pitch: 'included', content: 'included', business: 'premium_preview',
  },
  'persea-premium': {
    'brand-extraction': 'included', 'archetype-test': 'included', 'activity-guide': 'included', 'initial-images': 'included',
    'brand-direction': 'included', pitch: 'included', content: 'included', business: 'included',
  },
  'ascensao-imagem': {
    'brand-extraction': 'included', 'archetype-test': 'included', 'activity-guide': 'included', 'initial-images': 'included',
    'brand-direction': 'premium_preview', pitch: 'included', content: 'included', business: 'premium_preview',
  },
};

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

// Two real products (confirmed by Nay) — Persea keeps the duration-based
// pricing above; Ascensão de Imagem is a simpler single, one-time product.
// Fixed list, not tenant-configurable, per this pass's scope.
export const PROGRAMS = ['ascensao_imagem', 'persea'];
export const PROGRAM_LABEL = { ascensao_imagem: 'Ascensão de Imagem', persea: 'Persea' };
export const PROGRAM_VALUE = { ascensao_imagem: 6000 }; // placeholder pricing, same convention as CONTRACT_DURATION_VALUE

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
export const AGENDA_TYPES = ['class', 'individual_meeting', 'group_meeting', 'online_event', 'admin_task', 'deadline', 'photo_review'];
export const AGENDA_TYPE_LABEL = {
  class: 'Aula',
  individual_meeting: 'Reunião Individual',
  group_meeting: 'Reunião em Grupo',
  online_event: 'Evento Online',
  admin_task: 'Tarefa Administrativa',
  deadline: 'Prazo / Follow-up',
  photo_review: 'Revisão de Fotos',
};
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
  leads: [
    {
      id: 'lead1', fullName: 'Patrícia Nogueira', email: 'patricia.n@example.com', phone: '(31) 90000-1001',
      source: 'vip_group', vipGroupStatus: 'in_group', stage: 'em_conversa', interestedProgram: 'persea',
      socialLinks: { instagram: 'https://instagram.com/patricianogueira', tiktok: '', linkedin: 'https://linkedin.com/in/patricianogueira', facebook: '' },
      notes: 'Muito ativa no grupo, sempre comenta nas dinâmicas. Trabalha com consultoria financeira.',
      interactions: [
        { id: 'li1', date: '2026-08-10T14:00:00', summary: 'Ligação rápida — perguntou sobre o formato do programa Persea (6 ou 12 meses) e como funciona o acompanhamento.' },
      ],
      convertedToClientId: null, convertedAt: null,
      createdAt: '2026-07-15T09:00:00', updatedAt: '2026-08-10T14:00:00',
    },
    {
      id: 'lead2', fullName: 'Vanessa Tavares', email: 'vanessa.tavares@example.com', phone: '(31) 90000-1002',
      source: 'vip_group', vipGroupStatus: 'in_group', stage: 'engajado', interestedProgram: null,
      socialLinks: { instagram: 'https://instagram.com/vanessatavares', tiktok: 'https://tiktok.com/@vanessatavares', linkedin: '', facebook: '' },
      notes: 'Entrou no grupo após a aula de oratória. Preencheu a ficha de interesse mas ainda não teve conversa direta.',
      interactions: [],
      convertedToClientId: null, convertedAt: null,
      createdAt: '2026-07-21T10:00:00', updatedAt: '2026-07-21T10:00:00',
    },
    {
      id: 'lead3', fullName: 'Fernanda Buono', email: 'fernanda.buono@example.com', phone: '(31) 90000-1003',
      source: 'referral', vipGroupStatus: 'not_in_group', stage: 'proposta_enviada', interestedProgram: 'ascensao_imagem',
      socialLinks: { instagram: 'https://instagram.com/fernandabuono', tiktok: '', linkedin: '', facebook: '' },
      notes: 'Indicada pela Renata Costa. Já teve reunião de diagnóstico, proposta do Ascensão de Imagem enviada por email.',
      interactions: [
        { id: 'li2', date: '2026-08-05T11:00:00', summary: 'Reunião de diagnóstico — quer resolver a imagem pessoal antes de aumentar a exposição em palestras.' },
        { id: 'li3', date: '2026-08-08T16:30:00', summary: 'Proposta comercial enviada por email, aguardando retorno.' },
      ],
      convertedToClientId: null, convertedAt: null,
      createdAt: '2026-07-28T09:00:00', updatedAt: '2026-08-08T16:30:00',
    },
    {
      id: 'lead4', fullName: 'Isabela Prado', email: 'isabela.prado@example.com', phone: '(31) 90000-1004',
      source: 'vip_group', vipGroupStatus: 'left_group', stage: 'perdido', interestedProgram: null,
      socialLinks: { instagram: '', tiktok: '', linkedin: '', facebook: '' },
      notes: 'Saiu do grupo sem engajar em nenhuma dinâmica. Provavelmente não é o momento certo.',
      interactions: [],
      convertedToClientId: null, convertedAt: null,
      createdAt: '2026-06-10T09:00:00', updatedAt: '2026-07-01T09:00:00',
    },
    {
      id: 'lead5', fullName: 'Fernanda Lima', email: 'fernanda@example.com', phone: '(31) 90000-0007',
      source: 'referral', vipGroupStatus: 'not_in_group', stage: 'convertido', interestedProgram: 'persea',
      socialLinks: { instagram: '', tiktok: '', linkedin: '', facebook: '' },
      notes: 'Indicada pela Marina Alves. Fechou o Persea Essencial — convertida em cliente (client-7).',
      interactions: [
        { id: 'li4', date: '2026-08-16T10:00:00', summary: 'Reunião de diagnóstico — decidiu fechar o Persea Essencial.' },
      ],
      convertedToClientId: 'client-7', convertedAt: '2026-08-17T09:00:00',
      createdAt: '2026-08-01T09:00:00', updatedAt: '2026-08-17T09:00:00',
    },
  ],
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
  agendaItems: [
    { id: 'ag1', type: 'admin_task', title: 'Preparar contrato da Bianca Souza', date: '2026-08-13T11:00:00', status: 'upcoming', relatedStudentId: 'client-4', relatedGroupLabel: null, topic: 'Preparar contrato a partir das informações recebidas', prepNotes: '', generalNotes: '', onlineLink: '', followUpNotes: '', createdAt: '2026-08-10T09:00:00', updatedAt: '2026-08-10T09:00:00' },
    { id: 'ag2', type: 'deadline', title: 'Responder solicitação da Marina', date: '2026-08-13T17:00:00', status: 'upcoming', relatedStudentId: 'client-1', relatedGroupLabel: null, topic: 'Dúvida sobre como aplicar a Voz da Marca nas redes', prepNotes: '', generalNotes: '', onlineLink: '', followUpNotes: '', createdAt: '2026-07-09T10:00:00', updatedAt: '2026-07-09T10:00:00' },
    { id: 'ag3', type: 'class', title: 'N Time Class — Tendências de Imagem 2026', date: '2026-08-13T20:00:00', status: 'upcoming', relatedStudentId: null, relatedGroupLabel: 'N Time Class', topic: 'Aula mensal ao vivo sobre tendências de imagem', prepNotes: 'Revisar slides da aula anterior.', generalNotes: '', onlineLink: 'https://meet.google.com/exemplo-ntime', followUpNotes: '', createdAt: '2026-08-01T09:00:00', updatedAt: '2026-08-01T09:00:00' },
    { id: 'ag4', type: 'group_meeting', title: 'Q&A Mensal — Turma Geral', date: '2026-08-14T19:00:00', status: 'upcoming', relatedStudentId: null, relatedGroupLabel: 'Q&A Mensal PERSEA', topic: 'Perguntas e respostas ao vivo com todas as mentoradas', prepNotes: 'Revisar dúvidas enviadas durante a semana.', generalNotes: '', onlineLink: 'https://meet.google.com/exemplo-qna', followUpNotes: '', createdAt: '2026-08-01T09:00:00', updatedAt: '2026-08-01T09:00:00' },
    { id: 'ag5', type: 'admin_task', title: 'Fechar contrato da Camila Rocha', date: '2026-08-14T09:00:00', status: 'upcoming', relatedStudentId: 'client-5', relatedGroupLabel: null, topic: 'Confirmar assinatura do contrato Semestral', prepNotes: '', generalNotes: 'Contrato já está na plataforma externa, aguardando confirmação.', onlineLink: '', followUpNotes: '', createdAt: '2026-08-05T09:00:00', updatedAt: '2026-08-05T09:00:00' },
    { id: 'ag6', type: 'individual_meeting', title: 'E2 — Comunicação e Vendas', date: '2026-08-15T10:00:00', status: 'upcoming', relatedStudentId: 'client-2', relatedGroupLabel: null, topic: 'Dificuldades de venda, comunicação, posicionamento e pitch', prepNotes: 'Revisar respostas do questionário antes da reunião.', generalNotes: '', onlineLink: 'https://meet.google.com/exemplo-julia', followUpNotes: '', createdAt: '2026-07-11T09:00:00', updatedAt: '2026-07-11T09:00:00', durationMinutes: 60, assignedTo: 'nay', assistantPersona: null,
      recording: { recordingStatus: 'aguardando', transcriptStatus: 'nao_aplicavel', recordingUrl: null, transcriptUrl: null, requiresAttention: false, attentionNote: '', sync: { lastCheckedAt: null, nextCheckAt: null, googleAccount: 'nay@persea.com.br', syncStatus: 'aguardando', attempts: 0 } } },
    { id: 'ag7', type: 'online_event', title: 'Live Instagram — Bastidores da Mentoria', date: '2026-08-16T18:00:00', status: 'upcoming', relatedStudentId: null, relatedGroupLabel: null, topic: 'Conteúdo institucional para redes sociais', prepNotes: 'Definir roteiro da live.', generalNotes: '', onlineLink: 'https://instagram.com/naymurta', followUpNotes: '', createdAt: '2026-08-01T09:00:00', updatedAt: '2026-08-01T09:00:00' },
    { id: 'ag8', type: 'individual_meeting', title: 'E4 — Posicionamento e Metas', date: '2026-08-17T13:30:00', status: 'upcoming', relatedStudentId: 'client-3', relatedGroupLabel: null, topic: 'Para quem, onde e por que se posicionar — metas tangíveis', prepNotes: 'Levar comentários sobre o posicionamento como estrategista.', generalNotes: '', onlineLink: 'https://meet.google.com/exemplo-renata', followUpNotes: '', createdAt: '2026-07-02T09:00:00', updatedAt: '2026-07-02T09:00:00', durationMinutes: 60, assignedTo: 'assistant', assistantPersona: 'ju',
      recording: { recordingStatus: 'aguardando', transcriptStatus: 'nao_aplicavel', recordingUrl: null, transcriptUrl: null, requiresAttention: false, attentionNote: '', sync: { lastCheckedAt: null, nextCheckAt: null, googleAccount: 'nay@persea.com.br', syncStatus: 'aguardando', attempts: 0 } } },
    { id: 'ag9', type: 'individual_meeting', title: 'E3 — Imagem e Estratégia', date: '2026-08-19T15:00:00', status: 'upcoming', relatedStudentId: 'client-1', relatedGroupLabel: null, topic: 'Imagem pessoal conectada à estratégia e percepção do negócio', prepNotes: 'Preparar exemplos de conteúdo alinhado à Voz da Marca.', generalNotes: '', onlineLink: 'https://meet.google.com/exemplo-marina', followUpNotes: '', createdAt: '2026-07-09T09:00:00', updatedAt: '2026-07-09T09:00:00', durationMinutes: 60, assignedTo: 'nay', assistantPersona: null,
      recording: { recordingStatus: 'aguardando', transcriptStatus: 'nao_aplicavel', recordingUrl: null, transcriptUrl: null, requiresAttention: false, attentionNote: '', sync: { lastCheckedAt: null, nextCheckAt: null, googleAccount: 'nay@persea.com.br', syncStatus: 'aguardando', attempts: 0 } } },
    { id: 'ag10', type: 'deadline', title: 'Revisar Playbook em rascunho da Renata', date: '2026-08-12T00:00:00', status: 'upcoming', relatedStudentId: 'client-3', relatedGroupLabel: null, topic: 'Revisão final antes de publicar', prepNotes: '', generalNotes: '', onlineLink: '', followUpNotes: '', createdAt: '2026-07-02T10:00:00', updatedAt: '2026-07-02T10:00:00' },
    { id: 'ag11', type: 'admin_task', title: 'Follow-up — Bianca sem grupo de WhatsApp', date: '2026-08-11T00:00:00', status: 'upcoming', relatedStudentId: 'client-4', relatedGroupLabel: null, topic: 'Adicionar ao grupo após conclusão do onboarding', prepNotes: '', generalNotes: '', onlineLink: '', followUpNotes: '', createdAt: '2026-08-10T09:00:00', updatedAt: '2026-08-10T09:00:00' },
    // client-6's pre-onboarding diagnostic call had no Google Meet link on
    // file — no recording could ever have been captured, so this is the
    // "sem gravação" demo case rather than a failure state.
    { id: 'ag12', type: 'individual_meeting', title: 'Diagnóstico Inicial', date: '2026-08-05T10:00:00', status: 'completed', relatedStudentId: 'client-6', relatedGroupLabel: null, topic: 'Diagnóstico inicial pré-onboarding', prepNotes: '', generalNotes: 'Reunião realizada, cliente segue para assinatura de contrato.', onlineLink: '', followUpNotes: 'Nenhum follow-up necessário.', createdAt: '2026-08-05T11:00:00', updatedAt: '2026-08-05T11:00:00', durationMinutes: 60, assignedTo: 'nay', assistantPersona: null,
      recording: { recordingStatus: 'sem_gravacao', transcriptStatus: 'nao_aplicavel', recordingUrl: null, transcriptUrl: null, requiresAttention: false, attentionNote: '', sync: { lastCheckedAt: '2026-08-05T20:00:00', nextCheckAt: null, googleAccount: 'nay@persea.com.br', syncStatus: 'concluido', attempts: 1 } } },
    // --- Meeting-recording prototype demo set (see docs/google-meet-integration.md) ---
    { id: 'ag13', type: 'individual_meeting', title: 'E2 — Comunicação e Vendas', date: '2026-08-16T14:00:00', status: 'completed', relatedStudentId: 'client-1', relatedGroupLabel: null, topic: 'Aprofundamento de posicionamento comercial', prepNotes: '', generalNotes: 'Reunião realizada — aguardando o Google processar a gravação.', onlineLink: 'https://meet.google.com/persea-marina-e2', followUpNotes: '', createdAt: '2026-08-09T09:00:00', updatedAt: '2026-08-16T14:50:00', durationMinutes: 60, assignedTo: 'nay', assistantPersona: null,
      recording: { recordingStatus: 'processando', transcriptStatus: 'aguardando', recordingUrl: null, transcriptUrl: null, requiresAttention: false, attentionNote: '', sync: { lastCheckedAt: '2026-08-16T15:10:00', nextCheckAt: '2026-08-16T21:10:00', googleAccount: 'nay@persea.com.br', syncStatus: 'em_andamento', attempts: 2 } } },
    { id: 'ag14', type: 'individual_meeting', title: 'E3 — Imagem e Estratégia', date: '2026-08-10T10:00:00', status: 'completed', relatedStudentId: 'client-3', relatedGroupLabel: null, topic: 'Diagnóstico de imagem pessoal e estilo', prepNotes: '', generalNotes: 'Gravação disponível — transcrição ainda não retornou do Google Docs.', onlineLink: 'https://meet.google.com/persea-renata-e3', followUpNotes: '', createdAt: '2026-08-03T09:00:00', updatedAt: '2026-08-10T11:00:00', durationMinutes: 60, assignedTo: 'nay', assistantPersona: null,
      recording: { recordingStatus: 'disponivel', transcriptStatus: 'aguardando', recordingUrl: 'https://drive.google.com/file/d/persea-renata-e3-gravacao/view', transcriptUrl: null, requiresAttention: false, attentionNote: '', sync: { lastCheckedAt: '2026-08-10T14:00:00', nextCheckAt: '2026-08-10T20:00:00', googleAccount: 'nay@persea.com.br', syncStatus: 'em_andamento', attempts: 4 } } },
    { id: 'ag15', type: 'individual_meeting', title: 'E1 — Extração e Essência', date: '2026-08-09T10:00:00', status: 'completed', relatedStudentId: 'client-2', relatedGroupLabel: null, topic: 'Extração de marca e essência', prepNotes: '', generalNotes: '', onlineLink: 'https://meet.google.com/persea-julia-e1', followUpNotes: '', createdAt: '2026-08-02T09:00:00', updatedAt: '2026-08-09T18:00:00', durationMinutes: 60, assignedTo: 'nay', assistantPersona: null,
      recording: { recordingStatus: 'erro', transcriptStatus: 'erro', recordingUrl: null, transcriptUrl: null, requiresAttention: true, attentionNote: 'O Google não retornou o link da gravação depois de várias tentativas — verifique manualmente no Drive e cole o link abaixo.', sync: { lastCheckedAt: '2026-08-12T09:00:00', nextCheckAt: null, googleAccount: 'nay@persea.com.br', syncStatus: 'erro', attempts: 6 } } },
    { id: 'ag16', type: 'individual_meeting', title: 'Diagnóstico Inicial', date: '2026-08-06T10:00:00', status: 'completed', relatedStudentId: 'client-4', relatedGroupLabel: null, topic: 'Diagnóstico inicial pré-onboarding', prepNotes: '', generalNotes: 'Reunião realizada, cliente segue para preenchimento das informações.', onlineLink: 'https://meet.google.com/persea-bianca-diag', followUpNotes: '', createdAt: '2026-08-06T09:00:00', updatedAt: '2026-08-06T12:00:00', durationMinutes: 60, assignedTo: 'assistant', assistantPersona: 'ju',
      recording: { recordingStatus: 'disponivel', transcriptStatus: 'disponivel', recordingUrl: 'https://drive.google.com/file/d/persea-bianca-diagnostico-gravacao/view', transcriptUrl: 'https://docs.google.com/document/d/persea-bianca-diagnostico-transcricao/edit', requiresAttention: false, attentionNote: '', sync: { lastCheckedAt: '2026-08-06T15:00:00', nextCheckAt: '2026-09-06T15:00:00', googleAccount: 'nay@persea.com.br', syncStatus: 'concluido', attempts: 3 } } },
    { id: 'ag17', type: 'individual_meeting', title: 'Reunião de Fechamento — Assinatura do Contrato', date: '2026-08-22T11:00:00', status: 'upcoming', relatedStudentId: 'client-5', relatedGroupLabel: null, topic: 'Confirmar assinatura e alinhar início da Fase 1', prepNotes: '', generalNotes: '', onlineLink: 'https://meet.google.com/persea-camila-fechamento', followUpNotes: '', createdAt: '2026-08-14T09:00:00', updatedAt: '2026-08-14T09:00:00', durationMinutes: 60, assignedTo: 'nay', assistantPersona: null,
      recording: { recordingStatus: 'aguardando', transcriptStatus: 'nao_aplicavel', recordingUrl: null, transcriptUrl: null, requiresAttention: false, attentionNote: '', sync: { lastCheckedAt: null, nextCheckAt: null, googleAccount: 'nay@persea.com.br', syncStatus: 'aguardando', attempts: 0 } } },
  ],
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
      title: 'Guia de Estilo — Júlia', note: 'Primeira versão a partir da Direção da Marca.', fileUrl: 'https://example.com/guides/guia-estilo-julia.pdf',
      status: 'pending', createdAt: '2026-08-15T11:00:00', resolvedAt: null, nayNote: '',
    },
    {
      id: 'rev3', clientId: 'client-6', type: 'image_guide', refSlug: 'paleta_cores',
      title: 'Paleta de Cores — Débora', note: '', fileUrl: 'https://example.com/guides/paleta-debora.pdf',
      status: 'pending', createdAt: '2026-08-17T10:00:00', resolvedAt: null, nayNote: '',
    },
  ],
  // Nay <-> Assistant inbox — a flat, timestamped feed rather than threaded
  // chat, matching the "one running log" convention used elsewhere (activity
  // log, whatsappNotes). clientId is optional context ("watch this client's
  // recording before prepping her guide"), not a scoping filter — every
  // message shows on the assistant's Painel regardless. See
  // getAssistantMessages/sendAssistantMessage/markAssistantMessageRead.
  assistantMessages: [
    {
      id: 'am1', from: 'nay', clientId: 'client-6', text: 'Antes de montar o Guia de Looks da Débora, dá uma olhada na gravação do diagnóstico inicial dela (Agenda, 05/08) — ela foi bem específica sobre não gostar de estampas.',
      route: 'agenda.html', at: '2026-08-17T09:10:00', read: false,
    },
    {
      id: 'am2', from: 'nay', clientId: 'client-5', text: 'Camila confirmou a reunião de fechamento pra dia 22 — se ela assinar lá, já pode subir o contrato autenticado no mesmo dia.',
      route: 'client-workspace.html?id=client-5', at: '2026-08-15T16:40:00', read: true,
    },
    {
      id: 'am3', from: 'assistant', clientId: 'client-6', text: 'Feito — assisti a gravação e já ajustei o briefing do guia para evitar estampas. Devo ter a primeira versão pronta até quinta.',
      route: null, at: '2026-08-17T09:45:00', read: true,
    },
  ],
  clients: {
    // --- Client 1: Marina — farthest along, playbook published, pitches ready ---
    'client-1': {
      profile: { id: 'client-1', fullName: 'Marina Alves', email: 'marina@example.com', status: 'active', tier: 'premium', phaseIndex: 1, programSlug: 'persea-premium', gender: 'feminino' },
      onboarding: {
        clientInfo: {
          submitted: true, fullName: 'Marina Alves', partyType: 'PF', cpf: '123.456.789-00', cnpj: null, companyName: null,
          address: 'Rua Exemplo, 100, Savassi, Belo Horizonte/MG', email: 'marina@example.com', whatsapp: '(31) 90000-0001',
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
        guidance: 'Evitar linguagem motivacional genérica — Marina conquista pela precisão, não pelo entusiasmo.',
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
      // Real upsell example: Marina started on Persea Essencial and Nay
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
        executiveSummary: 'Marina é uma profissional de alta competência cujo posicionamento externo ainda não acompanhou sua real expertise. Ela subestima sua autoridade por escrito, mas entrega além na prática.',
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
        summary: 'Marina descreveu um padrão de conquistar clientes por indicação, mas com dificuldade de converter públicos frios — o que remete a uma autodescrição genérica.',
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

    // --- Client 2: Júlia — just starting out, nothing analyzed yet ---
    'client-2': {
      profile: { id: 'client-2', fullName: 'Júlia Ferreira', email: 'julia@example.com', status: 'active', tier: 'essential', phaseIndex: 0, programSlug: 'persea-essential', gender: 'feminino' },
      onboarding: {
        clientInfo: {
          submitted: true, fullName: 'Júlia Ferreira', partyType: 'PF', cpf: '234.567.890-11', cnpj: null, companyName: null,
          address: 'Av. Exemplo, 200, Centro, Sete Lagoas/MG', email: 'julia@example.com', whatsapp: '(31) 90000-0002',
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
          { key: 'assessment', title: 'Teste de Arquétipos', status: 'locked' },
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
        executiveSummary: 'Júlia tem clareza técnica mas evita visibilidade — o principal obstáculo é exposição, não competência.',
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
      // no tie, for contrast with Marina's tied example above.
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
      moodLog: [
        { context: 'questionnaire_submitted', mood: 3, at: '2026-07-10T09:01:00' },
      ],
    },

    // --- Client 3: Renata — mid-journey, playbook drafted but not published ---
    'client-3': {
      profile: { id: 'client-3', fullName: 'Renata Costa', email: 'renata@example.com', status: 'active', tier: 'premium', phaseIndex: 0, programSlug: 'persea-premium', gender: 'feminino' },
      onboarding: {
        clientInfo: {
          submitted: true, fullName: 'Renata Costa', partyType: 'PJ', cpf: '345.678.901-22', cnpj: '12.345.678/0001-90', companyName: 'Renata Costa Consultoria',
          address: 'Rua Exemplo, 300, Lourdes, Belo Horizonte/MG', email: 'renata@example.com', whatsapp: '(31) 90000-0003',
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
        executiveSummary: 'Renata já entrega resultado operacional forte, mas se posiciona como "faz-tudo" — o que dilui o valor percebido do seu trabalho mais estratégico.',
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
        summary: 'Renata relatou cansaço de aceitar projetos fora do seu foco só para manter a agenda cheia, e dificuldade de precificar diagnóstico como etapa separada da execução.',
        goals: ['Criar uma oferta de diagnóstico paga', 'Recusar 30% dos projetos fora do foco'],
        challenges: ['Medo de perder receita ao dizer não', 'Dificuldade de nomear a própria metodologia'],
        actionItems: ['Nomear a metodologia de diagnóstico', 'Criar página de portfólio por transformação, não por serviço'],
        homework: ['Ler o Playbook v1', 'Gravar o pitch de 30 segundos em áudio ou vídeo', 'Responder às perguntas de reflexão'],
        keyInsights: ['Aceitar tudo é o principal fator que mantém Renata no nível "executora".'],
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
      // Negócios" narrative and contrasts with Marina's tied example.
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
      moodLog: [
        { context: 'questionnaire_submitted', mood: 4, at: '2026-06-28T10:41:00' },
        { context: 'homework_task', mood: 3, at: '2026-07-03T09:00:00' },
      ],
    },

    // --- Clients 4-6: onboarding-stage — Phase 1 not started yet, demonstrate
    // the pre-mentorship workflow from docs/PERSEA_METHODOLOGY.md §2. ---
    'client-4': {
      profile: { id: 'client-4', fullName: 'Bianca Souza', email: 'bianca@example.com', status: 'onboarding', tier: 'essential', phaseIndex: 0, programSlug: 'persea-essential', gender: 'feminino' },
      onboarding: {
        clientInfo: {
          submitted: true, fullName: 'Bianca Souza', partyType: 'PF', cpf: '456.789.012-33', cnpj: null, companyName: null,
          address: 'Rua Exemplo, 400, Centro, Contagem/MG', email: 'bianca@example.com', whatsapp: '(31) 90000-0004',
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

    'client-5': {
      profile: { id: 'client-5', fullName: 'Camila Rocha', email: 'camila@example.com', status: 'onboarding', tier: 'essential', phaseIndex: 0, programSlug: 'persea-essential', gender: 'feminino' },
      onboarding: {
        clientInfo: {
          submitted: true, fullName: 'Camila Rocha', partyType: 'PF', cpf: '567.890.123-44', cnpj: null, companyName: null,
          address: 'Rua Exemplo, 500, Centro, Betim/MG', email: 'camila@example.com', whatsapp: '(31) 90000-0005',
        },
        contract: { program: 'persea', duration: 'semestral', status: 'awaiting_signature', value: 18000, signedFileName: null, notes: '', paymentMethod: null, installments: null },
        whatsappGroup: { status: 'pending' },
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
        upcomingMeeting: { title: 'E1 — Extração e Essência — a agendar após onboarding', date: '2026-08-28T10:00:00' },
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
      activity: [
        { type: 'onboarding_info_submitted', text: 'Informações de cadastro enviadas para o contrato', at: '2026-08-05T09:00:00' },
      ],
      playbookExperience: { format: null, completedAt: null },
      quiz: { score: null, total: null, completedAt: null },
      meetingRequests: [],
      notes: '',
      moodLog: [],
    },

    'client-6': {
      profile: { id: 'client-6', fullName: 'Débora Lima', email: 'debora@example.com', status: 'onboarding', tier: 'premium', phaseIndex: 0, programSlug: 'ascensao-imagem', gender: 'feminino' },
      onboarding: {
        clientInfo: {
          submitted: true, fullName: 'Débora Lima', partyType: 'PJ', cpf: '678.901.234-55', cnpj: '23.456.789/0001-01', companyName: 'Débora Lima Imagem',
          address: 'Rua Exemplo, 600, Buritis, Belo Horizonte/MG', email: 'debora@example.com', whatsapp: '(31) 90000-0006',
        },
        contract: { program: 'ascensao_imagem', duration: null, status: 'completed', value: 6000, signedFileName: 'contrato-client-6-assinado.pdf', notes: '', paymentMethod: 'pix', installments: 1 },
        whatsappGroup: { status: 'added' },
      },
      payments: [
        { id: 'p6-1', dueDate: '2026-08-05', amount: 6000, status: 'paid', paidAt: '2026-08-05T10:00:00' , sumupLinkUrl: 'https://pay.sumup.com/b2c/persea-debora-1', linkSentAt: '2026-08-02T10:00:00', reportedPaidAt: '2026-08-05T09:45:00', nf: { status: 'issued', requestedAt: '2026-08-05T10:30:00', issuedAt: '2026-08-06T09:00:00', fileName: 'nf-client-6-p1.pdf' } },
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
      imageGuides: [{ slug: 'paleta_cores', fileUrl: null, note: '' }, { slug: 'estilo', fileUrl: null, note: '' }, { slug: 'moodboard_ensaio', fileUrl: null, note: '' }, { slug: 'guia_looks_mensal', fileUrl: null, note: '' }],
      digitalKit: { fileUrl: null },
      hublaAccess: { status: 'not_granted', grantedAt: null },
      programHistory: [{ programSlug: 'ascensao-imagem', changedAt: null, changedBy: 'seed' }],
      journey: {
        programName: 'Identidade',
        steps: [
          { key: 'questionnaire', title: 'Extração de Marca', status: 'locked' },
          { key: 'meeting_1', title: 'Reunião 1', status: 'locked' },
          { key: 'playbook_review', title: 'Playbook de Marca Pessoal', status: 'locked' },
          { key: 'assessment', title: 'Teste de Arquétipos', status: 'locked' },
          { key: 'pitch', title: 'Gerador de Pitch', status: 'locked' },
          { key: 'homework', title: 'Tarefas', status: 'locked' },
        ],
        upcomingMeeting: { title: 'Reunião 1 — a agendar', date: '2026-08-19T10:00:00' },
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
      meeting: { title: 'Reunião 1', transcriptUploaded: false, status: 'scheduled' },
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
      activity: [
        { type: 'whatsapp_status_changed', text: 'Adicionada ao grupo de WhatsApp', at: '2026-08-11T09:00:00' },
        { type: 'signed_contract_uploaded', text: 'Contrato assinado enviado para o perfil da cliente', at: '2026-08-10T09:00:00' },
      ],
      playbookExperience: { format: null, completedAt: null },
      quiz: { score: null, total: null, completedAt: null },
      meetingRequests: [],
      notes: '',
      moodLog: [],
    },
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

function load() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    const seeded = structuredClone(SEED);
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

// --- Leitura Estratégica de Valor private helpers ---------------------------
// --- Program Hub private helpers -------------------------------------------
// Client-friendly primary-action copy per activity+status — the Painel's
// "one primary next action" and each Hub card's button both read from here.
const PROGRAM_ACTIVITY_PRIMARY_ACTION = {
  'brand-extraction': { not_started: 'Iniciar Extração de Marca', in_progress: 'Continuar Extração de Marca', completed: 'Ver Extração de Marca' },
  'archetype-test': { not_started: 'Iniciar teste', in_progress: 'Continuar teste', completed: 'Ver meu resultado' },
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
  // Extração de Marca and Teste de Arquétipos are the two activities a
  // client can (and should) start *during* onboarding — as soon as her
  // contract is signed and filed, not only after the full onboarding
  // sequence (WhatsApp group, resources) finishes. Everything else stays
  // locked until she's fully active. Bypasses the legacy per-step
  // `journey.steps` lock below (which only starts advancing post-onboarding)
  // for exactly these two, since a freshly-signed client's journey steps
  // are still seeded 'locked'.
  if (c.profile.status === 'onboarding') {
    const preOnboardingUnlockable = slug === 'brand-extraction' || slug === 'archetype-test';
    if (!preOnboardingUnlockable) return 'locked';
    if (c.onboarding.contract.status !== 'completed') return 'locked';
    if (slug === 'brand-extraction') return c.questionnaire.status === 'submitted' ? 'completed' : 'in_progress';
    if (slug === 'archetype-test') return archetypeQuizStatusFor(c);
  }
  const stepMap = { 'brand-extraction': 'questionnaire', 'archetype-test': 'assessment', pitch: 'pitch' };
  if (stepMap[slug]) {
    const step = (c.journey.steps || []).find((s) => s.key === stepMap[slug]);
    const base = step ? step.status : 'locked';
    if (base === 'locked') return 'locked';
    if (slug === 'brand-extraction') return c.questionnaire.status === 'submitted' ? 'completed' : 'in_progress';
    if (slug === 'archetype-test') {
      const qStatus = archetypeQuizStatusFor(c);
      return qStatus === 'not_started' && base === 'completed' ? 'completed' : qStatus;
    }
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
    return load().clients[id].profile;
  },
  getTenant() {
    return load().tenant;
  },
  setTenantHublaAllContentUrl(url) {
    const db = load();
    db.tenant.hublaAllContentUrl = url;
    save(db);
    return db.tenant;
  },
  getPhaseProgress(id = DEFAULT_CLIENT_ID) {
    const p = client(load(), id).profile;
    return { tier: p.tier, phases: TIER_PHASES[p.tier], currentIndex: p.phaseIndex };
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
    const activities = this.getProgramActivities(id);
    const included = activities.filter((a) => a.access === 'included');
    const completed = included.filter((a) => ['completed', 'feedback_available'].includes(a.status));
    const pct = included.length ? Math.round((completed.length / included.length) * 100) : 0;
    // "Next" must be something she can actually act on right now — never a
    // still-locked activity (nothing to click yet) or a premium preview
    // (not hers to open).
    const nextActivity = included.find((a) => !['completed', 'feedback_available', 'locked', 'premium_preview'].includes(a.status)) || null;
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
  // Painel's "Outras pendências". Deliberately small: included activities
  // still open (minus the one already surfaced as the next action) plus any
  // outstanding homework items (homework isn't part of the activity matrix,
  // but per spec still needs a visible, non-buried home for its actions).
  getOtherPendingItems(id = DEFAULT_CLIENT_ID) {
    const db = load();
    const c = db.clients[id];
    if (!c) return [];
    const progress = this.getProgramProgress(id);
    const activities = this.getProgramActivities(id).filter((a) => a.access === 'included');
    const items = activities
      .filter((a) => !['completed', 'feedback_available', 'locked'].includes(a.status) && a.slug !== (progress.nextActivity && progress.nextActivity.slug))
      .map((a) => ({ kind: 'activity', key: a.slug, title: a.title, label: a.primaryActionLabel, route: a.route }));
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
    if (program === 'ascensao_imagem') {
      c.onboarding.contract.duration = null;
      c.onboarding.contract.value = PROGRAM_VALUE.ascensao_imagem;
    } else if (program === 'persea') {
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
  // closing call (method, number of installments, first due date),
  // replacing whatever payments array the client had before (placeholder
  // or a prior plan). Monthly cadence from startDate.
  setPaymentPlan(id, { method, installments, startDate }) {
    const db = load();
    const c = client(db, id);
    const contract = c.onboarding.contract;
    if (!contract.value || !installments || installments < 1) return null;
    contract.paymentMethod = method || null;
    contract.installments = installments;
    const perInstallment = Math.round(contract.value / installments);
    const start = startDate ? new Date(`${startDate}T00:00:00`) : new Date();
    c.payments = Array.from({ length: installments }, (_, i) => {
      const due = new Date(start.getFullYear(), start.getMonth() + i, start.getDate());
      // Last installment absorbs any rounding remainder so the schedule sums to the contract value exactly.
      const amount = i === installments - 1 ? contract.value - perInstallment * (installments - 1) : perInstallment;
      return { id: `p${id}-${Date.now()}-${i}`, dueDate: due.toISOString().slice(0, 10), amount, status: 'pending', paidAt: null };
    });
    save(db);
    this.logActivity(id, 'payment_plan_set', `Plano de pagamento definido: ${installments}x via ${PAYMENT_METHOD_LABEL[method] || method}`);
    return c.payments;
  },
  // Manual, one-off control over the schedule — for cases the even-split
  // generator above doesn't cover (uneven amounts, an extra ad-hoc charge,
  // fixing a typo'd date).
  addPayment(id, { dueDate, amount }) {
    const db = load();
    const c = client(db, id);
    if (!c.payments) c.payments = [];
    const payment = { id: `p${id}-${Date.now()}`, dueDate, amount: Number(amount) || 0, status: 'pending', paidAt: null };
    c.payments.push(payment);
    c.payments.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
    save(db);
    this.logActivity(id, 'payment_added', `Parcela avulsa adicionada: R$ ${payment.amount.toLocaleString('pt-BR')} em ${dueDate}`);
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
  getPayments(id = DEFAULT_CLIENT_ID) {
    return client(load(), id).payments || [];
  },
  getAllPayments({ program } = {}) {
    const db = load();
    const all = [];
    Object.entries(db.clients).forEach(([id, c]) => {
      if (program && c.onboarding.contract.program !== program) return;
      (c.payments || []).forEach((p) => all.push({ ...p, clientId: id, clientName: c.profile.fullName, program: c.onboarding.contract.program }));
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
        topic: `Pagamento de R$ ${p.amount.toLocaleString('pt-BR')} confirmado`,
        assignedTo: 'assistant',
        assistantPersona: 'ju',
        assigneeNotes: `Parcela de R$ ${p.amount.toLocaleString('pt-BR')} (vencimento ${p.dueDate}) foi confirmada — emitir nota fiscal/recibo para a cliente.`,
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
    this.logActivity(clientId, 'payment_link_sent', `Link de pagamento enviado — R$ ${p.amount.toLocaleString('pt-BR')}`);
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
  // Promotes a lead into a real client record — same shape/defaults as a
  // fresh onboarding-stage client elsewhere in this seed (locked journey
  // steps, blank questionnaire, no playbook yet), so it drops straight into
  // the existing Clientes/Onboarding pipeline with no special-casing needed
  // anywhere else in the app.
  convertLeadToClient(id, { tier = 'essential', programSlug = 'persea-essential' } = {}) {
    const db = load();
    const lead = db.leads.find((l) => l.id === id);
    if (!lead) return null;
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
