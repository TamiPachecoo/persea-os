import { MockDB } from '../shared/mock-db.js';
import { renderShell, card, statusBadge, toast, formatDateTime, formatDate } from '../shared/ui.js';

document.body.innerHTML = renderShell({ role: 'admin', active: 'client-detail.html' });

const client = MockDB.getClient();
const TABS = [
  ['questionnaire', 'Questionnaire'],
  ['meeting', 'Meeting & Transcript'],
  ['playbook', 'Playbook Editor'],
  ['pitch', 'Pitch Editor'],
  ['assessment', 'Assessment'],
  ['homework', 'Homework'],
  ['meeting-prep', 'Meeting Prep'],
  ['activity', 'Activity'],
];

let activeTab = 'questionnaire';
const content = document.getElementById('app-content');

function shell(inner) {
  return `
    <div class="mb-8 flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-serif">${client.fullName}</h1>
        <p class="text-white/40 text-sm">${client.email}</p>
      </div>
      ${statusBadge(client.status)}
    </div>
    <div class="flex gap-1 mb-8 border-b border-white/10 overflow-x-auto">
      ${TABS.map(([key, label]) => `
        <button data-tab="${key}" class="px-4 py-3 text-sm whitespace-nowrap border-b-2 transition-colors ${activeTab === key ? 'border-[#e8c99b] text-white' : 'border-transparent text-white/40 hover:text-white/70'}">${label}</button>
      `).join('')}
    </div>
    <div id="tab-content">${inner}</div>
  `;
}

function renderQuestionnaireTab() {
  const q = MockDB.getQuestionnaire();
  const a = MockDB.getQuestionnaireAnalysis();
  return `
    ${card(`
      <p class="text-sm text-white/50 mb-4">Client Answers</p>
      <div class="space-y-4">
        ${q.questions.map((qu) => `
          <div class="pb-4 border-b border-white/5 last:border-0 last:pb-0">
            <p class="text-sm text-white/40 mb-1">${qu.text}</p>
            <p>${qu.answer}</p>
          </div>
        `).join('')}
      </div>
    `, 'mb-6')}
    ${card(`
      <div class="flex items-center justify-between mb-4">
        <p class="text-sm text-white/50">AI Analysis <span class="text-white/30">· v${a.version}</span></p>
        <button id="regen-qa" class="text-xs px-3 py-1.5 rounded-lg border border-white/15 hover:bg-white/5">Regenerate</button>
      </div>
      <div id="qa-body" class="space-y-4 text-sm">
        ${renderQABody(a)}
      </div>
    `)}
  `;
}

function renderQABody(a) {
  return `
    <div><p class="text-white/40 mb-1">Executive Summary</p><p>${a.executiveSummary}</p></div>
    <div><p class="text-white/40 mb-1">Strengths</p><ul class="list-disc list-inside space-y-1">${a.strengths.map((s) => `<li>${s}</li>`).join('')}</ul></div>
    <div><p class="text-white/40 mb-1">Goals</p><ul class="list-disc list-inside space-y-1">${a.goals.map((s) => `<li>${s}</li>`).join('')}</ul></div>
    <div><p class="text-white/40 mb-1">Pain Points</p><ul class="list-disc list-inside space-y-1">${a.painPoints.map((s) => `<li>${s}</li>`).join('')}</ul></div>
    <div><p class="text-white/40 mb-1">Opportunities</p><ul class="list-disc list-inside space-y-1">${a.opportunities.map((s) => `<li>${s}</li>`).join('')}</ul></div>
    <div><p class="text-white/40 mb-1">Suggested Questions</p><ul class="list-disc list-inside space-y-1">${a.suggestedQuestions.map((s) => `<li>${s}</li>`).join('')}</ul></div>
    <div><p class="text-white/40 mb-1">Business Maturity</p><p>${a.businessMaturity}</p></div>
  `;
}

function renderMeetingTab() {
  const meeting = MockDB.getMeeting();
  const ta = MockDB.getTranscriptAnalysis();
  return `
    ${card(`
      <div class="flex items-center justify-between mb-4">
        <p class="text-sm text-white/50">${meeting.title}</p>
        ${statusBadge(meeting.status)}
      </div>
      <p class="text-sm text-white/40 mb-4">Transcript ${meeting.transcriptUploaded ? 'uploaded' : 'not uploaded'}. This prototype simulates upload/analysis — no real file parsing or model call happens.</p>
      <div class="flex gap-3">
        <button id="upload-btn" class="text-xs px-3 py-1.5 rounded-lg border border-white/15 hover:bg-white/5">Simulate Transcript Upload</button>
        <button id="analyze-btn" class="text-xs px-3 py-1.5 rounded-lg border border-white/15 hover:bg-white/5">Analyze Transcript</button>
      </div>
    `, 'mb-6')}
    ${card(`
      <p class="text-sm text-white/50 mb-4">Transcript Analysis</p>
      <div id="ta-body" class="space-y-4 text-sm">${renderTABody(ta)}</div>
    `)}
  `;
}

function renderTABody(ta) {
  return `
    <div><p class="text-white/40 mb-1">Meeting Summary</p><p>${ta.summary}</p></div>
    <div><p class="text-white/40 mb-1">Goals</p><ul class="list-disc list-inside space-y-1">${ta.goals.map((s) => `<li>${s}</li>`).join('')}</ul></div>
    <div><p class="text-white/40 mb-1">Challenges</p><ul class="list-disc list-inside space-y-1">${ta.challenges.map((s) => `<li>${s}</li>`).join('')}</ul></div>
    <div><p class="text-white/40 mb-1">Action Items</p><ul class="list-disc list-inside space-y-1">${ta.actionItems.map((s) => `<li>${s}</li>`).join('')}</ul></div>
    <div><p class="text-white/40 mb-1">Homework</p><ul class="list-disc list-inside space-y-1">${ta.homework.map((s) => `<li>${s}</li>`).join('')}</ul></div>
    <div><p class="text-white/40 mb-1">Key Insights</p><ul class="list-disc list-inside space-y-1">${ta.keyInsights.map((s) => `<li>${s}</li>`).join('')}</ul></div>
  `;
}

function renderPlaybookTab() {
  const pb = MockDB.getPlaybook();
  const latest = pb.versions[pb.versions.length - 1];
  const sectionDefs = MockDB.getSectionDefs();
  return `
    <div class="flex items-center justify-between mb-4">
      <p class="text-sm text-white/50">Version ${latest.version} ${statusBadge(latest.status)}</p>
      <div class="flex gap-3">
        <button id="generate-pb" class="text-xs px-3 py-1.5 rounded-lg border border-white/15 hover:bg-white/5">Generate New Version</button>
        <button id="publish-pb" class="text-xs px-3 py-1.5 rounded-lg bg-white text-black font-medium hover:bg-white/90 ${latest.status === 'published' ? 'opacity-40 pointer-events-none' : ''}">Publish</button>
      </div>
    </div>
    <p class="text-xs text-white/30 mb-6">${pb.versions.length} version(s) total — full history preserved.</p>
    <div class="space-y-4">
      ${sectionDefs.map(([key, title]) => `
        <div class="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          <p class="text-xs uppercase tracking-wider text-white/40 mb-2">${title}</p>
          <textarea data-section="${key}" rows="2" class="w-full border border-white/10 rounded-lg px-3 py-2 focus:outline-none focus:border-white/40 text-sm">${latest.sections[key]}</textarea>
        </div>
      `).join('')}
    </div>
  `;
}

function renderPitchTab() {
  const pitches = MockDB.getPitches();
  return `
    ${card(`
      <div class="flex items-center justify-between mb-4">
        <p class="text-sm text-white/50">Pitch Variants</p>
        <button id="generate-pitch" class="text-xs px-3 py-1.5 rounded-lg border border-white/15 hover:bg-white/5">${pitches ? 'Regenerate' : 'Generate'}</button>
      </div>
      <div id="pitch-body">
        ${pitches ? Object.entries(pitches).filter(([k]) => k !== 'version').map(([k, v]) => `
          <div class="mb-4 last:mb-0"><p class="text-xs text-white/40 mb-1 capitalize">${k.replace(/_/g, ' ')}</p><p class="text-sm">${v}</p></div>
        `).join('') : '<p class="text-white/30 text-sm">Not generated yet.</p>'}
      </div>
    `)}
  `;
}

function renderAssessmentTab() {
  const a = MockDB.getAssessment();
  return card(`
    <div class="flex items-center justify-between mb-3">
      <p class="font-medium">${a.title}</p>
      ${statusBadge(a.status)}
    </div>
    <p class="text-sm text-white/50 mb-4">${a.description}</p>
    <div class="flex items-center gap-3">
      <a href="${a.externalUrl}" target="_blank" class="text-xs px-3 py-1.5 rounded-lg border border-white/15 hover:bg-white/5">Open External Test</a>
      <button id="mark-complete" class="text-xs px-3 py-1.5 rounded-lg border border-white/15 hover:bg-white/5 ${a.status === 'completed' ? 'opacity-40 pointer-events-none' : ''}">Mark Complete</button>
    </div>
  `);
}

function renderHomeworkTab() {
  const tasks = MockDB.getHomework();
  const pct = MockDB.homeworkCompletionPct();
  return card(`
    <p class="text-sm text-white/50 mb-4">Completion: ${pct}%</p>
    <div class="space-y-3">
      ${tasks.map((t) => `
        <div class="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
          <span>${t.title}</span>
          ${statusBadge(t.status)}
        </div>
      `).join('')}
    </div>
  `);
}

function renderMeetingPrepTab() {
  const q = MockDB.getQuestionnaire();
  const pct = MockDB.homeworkCompletionPct();
  const pb = MockDB.getPublishedPlaybook();
  const hw = MockDB.getHomework();
  const questionsSubmitted = hw.find((t) => t.id === 'h3')?.status === 'completed';
  const attention = [];
  if (!pb) attention.push('Playbook not yet published to client');
  if (pct < 100) attention.push('Homework not fully complete');
  if (!questionsSubmitted) attention.push('Reflection questions not submitted');

  return `
    ${card(`
      <p class="text-sm text-white/50 mb-4">Pre-Meeting-2 Checklist</p>
      <div class="grid md:grid-cols-2 gap-4 text-sm">
        <div class="flex justify-between py-2 border-b border-white/5"><span>Questionnaire</span>${statusBadge(q.status === 'submitted' ? 'completed' : 'pending')}</div>
        <div class="flex justify-between py-2 border-b border-white/5"><span>Homework</span><span>${pct}%</span></div>
        <div class="flex justify-between py-2 border-b border-white/5"><span>Playbook Published</span>${statusBadge(pb ? 'published' : 'draft')}</div>
        <div class="flex justify-between py-2 border-b border-white/5"><span>Questions Submitted</span>${statusBadge(questionsSubmitted ? 'completed' : 'pending')}</div>
      </div>
    `, 'mb-6')}
    ${card(`
      <p class="text-sm text-white/50 mb-3">Areas Requiring Attention</p>
      ${attention.length ? `<ul class="list-disc list-inside space-y-1 text-sm text-amber-300">${attention.map((a) => `<li>${a}</li>`).join('')}</ul>` : '<p class="text-emerald-300 text-sm">All caught up.</p>'}
    `)}
  `;
}

function renderActivityTab() {
  const events = MockDB.getActivity();
  return card(`
    <div class="space-y-4">
      ${events.map((e) => `
        <div class="flex items-start gap-4 py-3 border-b border-white/5 last:border-0">
          <div class="w-2 h-2 mt-2 rounded-full bg-[#e8c99b] shrink-0"></div>
          <div><p>${e.text}</p><p class="text-xs text-white/30 mt-1">${formatDateTime(e.at)}</p></div>
        </div>
      `).join('')}
    </div>
  `);
}

const RENDERERS = {
  questionnaire: renderQuestionnaireTab,
  meeting: renderMeetingTab,
  playbook: renderPlaybookTab,
  pitch: renderPitchTab,
  assessment: renderAssessmentTab,
  homework: renderHomeworkTab,
  'meeting-prep': renderMeetingPrepTab,
  activity: renderActivityTab,
};

function wireTabEvents() {
  const tc = document.getElementById('tab-content');

  tc.querySelector('#regen-qa')?.addEventListener('click', async (e) => {
    e.target.disabled = true; e.target.textContent = 'Generating…';
    const a = await MockDB.regenerateQuestionnaireAnalysis();
    document.getElementById('qa-body').innerHTML = renderQABody(a);
    toast('Analysis regenerated.');
    render();
  });

  tc.querySelector('#upload-btn')?.addEventListener('click', async (e) => {
    e.target.disabled = true; e.target.textContent = 'Uploading…';
    await MockDB.uploadTranscript();
    toast('Transcript uploaded.');
    render();
  });
  tc.querySelector('#analyze-btn')?.addEventListener('click', async (e) => {
    e.target.disabled = true; e.target.textContent = 'Analyzing…';
    await MockDB.analyzeTranscript();
    toast('Transcript analyzed.');
    render();
  });

  tc.querySelector('#generate-pb')?.addEventListener('click', async (e) => {
    e.target.disabled = true; e.target.textContent = 'Generating…';
    await MockDB.generatePlaybookDraft();
    toast('New playbook draft generated.');
    render();
  });
  tc.querySelector('#publish-pb')?.addEventListener('click', () => {
    const pb = MockDB.getPlaybook();
    const latest = pb.versions[pb.versions.length - 1];
    MockDB.publishPlaybook(latest.version);
    toast('Playbook published — client notified.');
    render();
  });
  tc.querySelectorAll('[data-section]').forEach((el) => {
    el.addEventListener('blur', () => {
      const pb = MockDB.getPlaybook();
      const latest = pb.versions[pb.versions.length - 1];
      MockDB.saveSectionEdit(latest.version, el.dataset.section, el.value);
    });
  });

  tc.querySelector('#generate-pitch')?.addEventListener('click', async (e) => {
    e.target.disabled = true; e.target.textContent = 'Generating…';
    await MockDB.generatePitches();
    toast('Pitches generated.');
    render();
  });

  tc.querySelector('#mark-complete')?.addEventListener('click', () => {
    MockDB.markAssessmentComplete();
    toast('Assessment marked complete.');
    render();
  });
}

function render() {
  content.innerHTML = shell(RENDERERS[activeTab]());
  content.querySelectorAll('[data-tab]').forEach((btn) => {
    btn.addEventListener('click', () => { activeTab = btn.dataset.tab; render(); });
  });
  wireTabEvents();
}

render();
