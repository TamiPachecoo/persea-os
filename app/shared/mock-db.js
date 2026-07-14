// Mock data layer — stands in for agency-framework/*-engine/api.js + Supabase.
// Same shape/intent as the real engines: screens only ever call functions here,
// never touch storage directly. Swapping to Supabase later = rewriting this
// file's internals; screens stay untouched.

const STORAGE_KEY = 'persea_mock_db_v1';

const SEED = {
  tenant: {
    name: 'PERSEA',
    brandColor: '#7c5c3e', // warm bronze, "premium consulting" feel
  },
  client: {
    id: 'client-1',
    fullName: 'Marina Alves',
    email: 'marina@example.com',
    status: 'active',
  },
  journey: {
    programName: 'Identidade',
    steps: [
      { key: 'questionnaire', title: 'Questionário de Identidade', status: 'completed' },
      { key: 'meeting_1', title: 'Reunião 1', status: 'completed' },
      { key: 'playbook_review', title: 'Playbook de Marca Pessoal', status: 'in_progress' },
      { key: 'assessment', title: 'Teste de Arquétipo', status: 'available' },
      { key: 'pitch', title: 'Gerador de Discurso', status: 'locked' },
      { key: 'homework', title: 'Tarefas', status: 'locked' },
    ],
    upcomingMeeting: { title: 'Reunião 2 — Aprofundamento de Posicionamento', date: '2026-07-22T15:00:00' },
  },
  questionnaire: {
    title: 'Questionário de Identidade',
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
  meeting: {
    title: 'Reunião 1',
    transcriptUploaded: true,
    status: 'analyzed',
  },
  transcriptAnalysis: {
    version: 1,
    summary: 'Marina descreveu um padrão de conquistar clientes por indicação, mas com dificuldade de converter públicos frios — o que remete a uma autodescrição genérica.',
    goals: ['Conseguir 3 palestras este ano', 'Aumentar os valores em 30% sem perder conversão'],
    challenges: ['Sensação de impostora ao "escolher um nicho"', 'Medo de afastar clientes antigos ao se especializar'],
    actionItems: ['Redigir uma declaração de posicionamento clara', 'Auditar os últimos 10 conteúdos quanto à consistência'],
    homework: ['Ler o Playbook v1', 'Praticar o discurso de 30 segundos em voz alta 5x', 'Responder às perguntas de reflexão'],
    keyInsights: ['O rótulo de "generalista" é um comportamento de segurança, não uma escolha estratégica.'],
  },
  playbook: {
    status: 'draft', // draft | published
    currentVersion: 1,
    versions: [
      {
        version: 1,
        status: 'draft',
        createdAt: '2026-07-05T09:00:00',
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
    title: 'Teste de Arquétipo',
    description: 'Uma breve avaliação externa para identificar seu arquétipo de marca dominante.',
    externalUrl: 'https://example.com/archetype-test',
    status: 'not_started',
  },
  pitches: null, // gerado depois
  homework: [
    { id: 'h1', title: 'Ler o Playbook', type: 'boolean', status: 'pending' },
    { id: 'h2', title: 'Praticar o Discurso (5x em voz alta)', type: 'boolean', status: 'pending' },
    { id: 'h3', title: 'Perguntas de Reflexão', type: 'text_submission', status: 'pending', submission: '' },
  ],
  activity: [
    { type: 'questionnaire_submitted', text: 'Questionário de Identidade concluído', at: '2026-07-01T09:40:00' },
    { type: 'meeting_analyzed', text: 'Transcrição da Reunião 1 analisada', at: '2026-07-04T16:10:00' },
    { type: 'playbook_draft_created', text: 'Rascunho do Playbook v1 gerado', at: '2026-07-05T09:00:00' },
  ],
};

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

export const MockDB = {
  reset() {
    localStorage.removeItem(STORAGE_KEY);
    return load();
  },
  get() {
    return load();
  },

  logActivity(type, text) {
    const db = load();
    db.activity.unshift({ type, text, at: new Date().toISOString() });
    save(db);
  },

  // --- Journey ---
  getJourney() {
    return load().journey;
  },

  // --- Questionnaire ---
  getQuestionnaire() {
    return load().questionnaire;
  },
  saveAnswer(questionId, value) {
    const db = load();
    const q = db.questionnaire.questions.find((q) => q.id === questionId);
    if (q) q.answer = value;
    save(db);
  },
  submitQuestionnaire() {
    const db = load();
    db.questionnaire.status = 'submitted';
    save(db);
    this.logActivity('questionnaire_submitted', 'Questionário de Identidade concluído');
  },

  // --- AI: Questionnaire Analysis ---
  getQuestionnaireAnalysis() {
    return load().questionnaireAnalysis;
  },
  async regenerateQuestionnaireAnalysis() {
    await delay(1200);
    const db = load();
    db.questionnaireAnalysis = {
      ...db.questionnaireAnalysis,
      version: db.questionnaireAnalysis.version + 1,
      generatedAt: new Date().toISOString(),
      executiveSummary: db.questionnaireAnalysis.executiveSummary + ' (regenerado — conteúdo de exemplo, sem chamada real ao modelo neste protótipo)',
    };
    save(db);
    return db.questionnaireAnalysis;
  },

  // --- Meeting / Transcript ---
  getMeeting() {
    return load().meeting;
  },
  getTranscriptAnalysis() {
    return load().transcriptAnalysis;
  },
  async uploadTranscript() {
    await delay(800);
    const db = load();
    db.meeting.transcriptUploaded = true;
    db.meeting.status = 'transcript_uploaded';
    save(db);
  },
  async analyzeTranscript() {
    await delay(1200);
    const db = load();
    db.meeting.status = 'analyzed';
    save(db);
    this.logActivity('meeting_analyzed', 'Transcrição da reunião analisada');
    return db.transcriptAnalysis;
  },

  // --- Playbook ---
  getPlaybook() {
    return load().playbook;
  },
  getSectionDefs() {
    return [
      ['identity', 'Identidade'], ['mission', 'Missão'], ['vision', 'Visão'],
      ['core_story', 'História Central'], ['golden_circle', 'Círculo Dourado'],
      ['target_audience', 'Público-Alvo'], ['value_proposition', 'Proposta de Valor'],
      ['positioning', 'Posicionamento'], ['brand_voice', 'Voz da Marca'],
      ['communication_style', 'Estilo de Comunicação'], ['goals', 'Objetivos'],
      ['pitch_30s', 'Discurso de 30 Segundos'], ['action_plan', 'Plano de Ação'],
    ];
  },
  async generatePlaybookDraft() {
    await delay(1500);
    const db = load();
    const latest = db.playbook.versions[db.playbook.versions.length - 1];
    const newVersion = {
      version: latest.version + 1,
      status: 'draft',
      createdAt: new Date().toISOString(),
      sections: { ...latest.sections },
    };
    db.playbook.versions.push(newVersion);
    db.playbook.currentVersion = newVersion.version;
    save(db);
    this.logActivity('playbook_draft_created', `Rascunho do Playbook v${newVersion.version} gerado`);
    return newVersion;
  },
  saveSectionEdit(version, sectionKey, content) {
    const db = load();
    const v = db.playbook.versions.find((v) => v.version === version);
    if (v) v.sections[sectionKey] = content;
    save(db);
  },
  publishPlaybook(version) {
    const db = load();
    db.playbook.versions.forEach((v) => {
      if (v.version === version) { v.status = 'published'; }
      else if (v.status === 'published') { v.status = 'archived'; }
    });
    db.playbook.status = 'published';
    db.playbook.currentVersion = version;
    save(db);
    this.logActivity('playbook_published', `Playbook v${version} publicado`);
  },
  getPublishedPlaybook() {
    const db = load();
    return db.playbook.versions.find((v) => v.status === 'published') || null;
  },

  // --- Assessment ---
  getAssessment() {
    return load().assessment;
  },
  markAssessmentComplete() {
    const db = load();
    db.assessment.status = 'completed';
    save(db);
    this.logActivity('assessment_completed', 'Teste de Arquétipo concluído');
  },

  // --- Pitch ---
  getPitches() {
    return load().pitches;
  },
  async generatePitches() {
    await delay(1200);
    const db = load();
    db.pitches = {
      version: 1,
      pitch_10s: 'Transformo especialistas invisíveis em autoridades reconhecidas.',
      pitch_30s: 'Ajudo especialistas de alto nível a transformarem sua expertise silenciosa em uma marca que as pessoas realmente notam — sem soar como todo mundo na categoria.',
      pitch_60s: 'A maioria dos especialistas que conheço é melhor do que sua reputação sugere. Eu ajudo a fechar essa lacuna — afiando o posicionamento, a história e o discurso — para que a percepção finalmente corresponda ao nível em que realmente atuam.',
      pitch_networking: 'Trabalho com especialistas que são ótimos no que fazem, mas esquecíveis em como se descrevem — eu resolvo a parte da descrição.',
      instagram_bio: 'Estrategista de marca para especialistas ✨ Transformando expertise silenciosa em autoridade visível.',
      linkedin_summary: 'Ajudo consultores e coaches estabelecidos a fecharem a lacuna entre sua real expertise e como são percebidos — com posicionamento mais afiado, uma história mais clara e um discurso que realmente convence.',
    };
    save(db);
    this.logActivity('pitches_generated', 'Variações de discurso geradas');
    return db.pitches;
  },
  saveePitchEdit() {}, // reserved

  // --- Homework ---
  getHomework() {
    return load().homework;
  },
  toggleHomework(id) {
    const db = load();
    const t = db.homework.find((t) => t.id === id);
    if (t) t.status = t.status === 'completed' ? 'pending' : 'completed';
    save(db);
  },
  submitHomeworkText(id, text) {
    const db = load();
    const t = db.homework.find((t) => t.id === id);
    if (t) { t.submission = text; t.status = text.trim() ? 'completed' : 'pending'; }
    save(db);
  },
  homeworkCompletionPct() {
    const hw = load().homework;
    return Math.round((hw.filter((t) => t.status === 'completed').length / hw.length) * 100);
  },

  // --- Activity ---
  getActivity() {
    return load().activity;
  },

  // --- Client / tenant ---
  getClient() {
    return load().client;
  },
  getTenant() {
    return load().tenant;
  },
};
