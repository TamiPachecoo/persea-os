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
    programName: 'Identity',
    steps: [
      { key: 'questionnaire', title: 'Identity Questionnaire', status: 'completed' },
      { key: 'meeting_1', title: 'Meeting 1', status: 'completed' },
      { key: 'playbook_review', title: 'Personal Brand Playbook', status: 'in_progress' },
      { key: 'assessment', title: 'Archetype Assessment', status: 'available' },
      { key: 'pitch', title: 'Pitch Generator', status: 'locked' },
      { key: 'homework', title: 'Homework', status: 'locked' },
    ],
    upcomingMeeting: { title: 'Meeting 2 — Positioning Deep Dive', date: '2026-07-22T15:00:00' },
  },
  questionnaire: {
    title: 'Identity Questionnaire',
    questions: [
      { id: 'q1', text: 'What do you want to be known for in 3 years?', type: 'long_text', answer: 'Being the go-to strategist for premium personal brands in Latin America.' },
      { id: 'q2', text: 'What feels most true about who you are right now?', type: 'long_text', answer: 'Precise, warm, and allergic to fluff.' },
      { id: 'q3', text: 'What is the transformation you help people make?', type: 'long_text', answer: 'From invisible expert to recognized authority.' },
      { id: 'q4', text: 'Rate your current confidence in your personal brand (1-10)', type: 'scale', answer: '5' },
    ],
    status: 'submitted',
  },
  questionnaireAnalysis: {
    version: 1,
    generatedAt: '2026-07-01T10:00:00',
    executiveSummary: 'Marina is a high-competence operator whose external positioning has not caught up with her actual expertise. She under-claims authority in writing but over-delivers in practice.',
    strengths: ['Deep subject-matter credibility', 'Clear point of view once prompted', 'Strong client empathy'],
    goals: ['Be recognized as a category authority, not a generalist', 'Raise price point via perceived positioning'],
    painPoints: ['Describes herself in vague, safe language', 'No consistent narrative across platforms'],
    opportunities: ['A sharp point-of-view content pillar', 'A signature framework she already uses informally'],
    suggestedQuestions: ['What have you stopped explaining because people should "just get it"?', 'Who do you secretly think is doing this worse than you?'],
    businessMaturity: 'Established practitioner, pre-brand — strong delivery, weak narrative.',
  },
  meeting: {
    title: 'Meeting 1',
    transcriptUploaded: true,
    status: 'analyzed',
  },
  transcriptAnalysis: {
    version: 1,
    summary: 'Marina described a pattern of winning clients through referral but struggling to convert cold audiences, tracing back to generic self-description.',
    goals: ['Land 3 speaking engagements this year', 'Raise rates 30% without losing conversion'],
    challenges: ['Imposter feelings around "picking a lane"', 'Fear of alienating past clients by narrowing focus'],
    actionItems: ['Draft one clear positioning statement', 'Audit last 10 pieces of content for consistency'],
    homework: ['Read Playbook v1', 'Practice 30-second pitch out loud 5x', 'Answer reflection questions'],
    keyInsights: ['The "generalist" framing is a safety behavior, not a strategic choice.'],
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
          identity: 'A precision-minded brand strategist who turns quiet expertise into visible authority.',
          mission: 'Help accomplished experts stop under-selling themselves in public.',
          vision: 'A world where competence and perception are never mismatched.',
          core_story: 'Started as the person clients called after their first consultant failed them — realized the gap was never skill, it was story.',
          golden_circle: 'Why: mismatched competence and perception is a solvable problem. How: precision positioning + confident narrative. What: brand strategy for experts.',
          target_audience: 'Established consultants and coaches with strong delivery but weak public narrative.',
          value_proposition: 'We make your positioning as sharp as your actual expertise.',
          positioning: 'The strategist for experts who are tired of sounding like everyone else.',
          brand_voice: 'Precise, warm, no fluff, quietly confident.',
          communication_style: 'Direct, short sentences, concrete examples over abstractions.',
          goals: 'Book 3 speaking engagements. Raise rates 30%. Build one signature framework.',
          pitch_30s: 'I help accomplished experts turn quiet expertise into a brand people actually notice — without sounding like everyone else in their category.',
          action_plan: '1) Publish positioning statement. 2) Rebuild bio across platforms. 3) Pitch 3 speaking slots this quarter.',
        },
      },
    ],
  },
  assessment: {
    title: 'Archetype Assessment',
    description: 'A short external assessment to identify your dominant brand archetype.',
    externalUrl: 'https://example.com/archetype-test',
    status: 'not_started',
  },
  pitches: null, // generated later
  homework: [
    { id: 'h1', title: 'Read Playbook', type: 'boolean', status: 'pending' },
    { id: 'h2', title: 'Practice Pitch (5x out loud)', type: 'boolean', status: 'pending' },
    { id: 'h3', title: 'Reflection Questions', type: 'text_submission', status: 'pending', submission: '' },
  ],
  activity: [
    { type: 'questionnaire_submitted', text: 'Completed Identity Questionnaire', at: '2026-07-01T09:40:00' },
    { type: 'meeting_analyzed', text: 'Meeting 1 transcript analyzed', at: '2026-07-04T16:10:00' },
    { type: 'playbook_draft_created', text: 'Playbook v1 draft generated', at: '2026-07-05T09:00:00' },
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
    this.logActivity('questionnaire_submitted', 'Completed Identity Questionnaire');
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
      executiveSummary: db.questionnaireAnalysis.executiveSummary + ' (regenerated — sample content, no live model call in this prototype)',
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
    this.logActivity('meeting_analyzed', 'Meeting transcript analyzed');
    return db.transcriptAnalysis;
  },

  // --- Playbook ---
  getPlaybook() {
    return load().playbook;
  },
  getSectionDefs() {
    return [
      ['identity', 'Identity'], ['mission', 'Mission'], ['vision', 'Vision'],
      ['core_story', 'Core Story'], ['golden_circle', 'Golden Circle'],
      ['target_audience', 'Target Audience'], ['value_proposition', 'Value Proposition'],
      ['positioning', 'Positioning'], ['brand_voice', 'Brand Voice'],
      ['communication_style', 'Communication Style'], ['goals', 'Goals'],
      ['pitch_30s', '30 Second Pitch'], ['action_plan', 'Action Plan'],
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
    this.logActivity('playbook_draft_created', `Playbook v${newVersion.version} draft generated`);
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
    this.logActivity('playbook_published', `Playbook v${version} published`);
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
    this.logActivity('assessment_completed', 'Archetype Assessment completed');
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
      pitch_10s: 'I turn overlooked experts into recognized authorities.',
      pitch_30s: 'I help accomplished experts turn quiet expertise into a brand people actually notice — without sounding like everyone else in their category.',
      pitch_60s: 'Most experts I meet are better than their reputation suggests. I help them close that gap — sharpening their positioning, their story, and their pitch — so the way they\'re perceived finally matches the level they actually operate at.',
      pitch_networking: 'I work with experts who are great at what they do but forgettable in how they describe it — I fix the describing part.',
      instagram_bio: 'Brand strategist for experts ✨ Turning quiet expertise into visible authority.',
      linkedin_summary: 'I help established consultants and coaches close the gap between their real expertise and how they\'re perceived — through sharper positioning, a clearer story, and a pitch that actually lands.',
    };
    save(db);
    this.logActivity('pitches_generated', 'Pitch variants generated');
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
