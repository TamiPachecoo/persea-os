import { MockDB, DEFAULT_CLIENT_ID } from '../shared/mock-db.js';
import { renderShell, card, statusBadge, toast, formatDateTime, formatDate, renderPhaseTracker } from '../shared/ui.js';

document.body.innerHTML = renderShell({ role: 'admin', active: 'client-detail.html' });

const clientId = new URLSearchParams(location.search).get('id') || DEFAULT_CLIENT_ID;
const client = MockDB.getClient(clientId);
const phaseProgress = MockDB.getPhaseProgress(clientId);
const TIER_LABEL = { premium: 'Premium', essential: 'Essential' };
const TABS = [
  ['questionnaire', 'Questionário'],
  ['meeting', 'Reunião e Transcrição'],
  ['playbook', 'Editor de Playbook'],
  ['pitch', 'Editor de Pitch'],
  ['assessment', 'Avaliação'],
  ['homework', 'Tarefas'],
  ['meeting-prep', 'Preparação de Reunião'],
  ['activity', 'Atividade'],
];

let activeTab = 'questionnaire';
const content = document.getElementById('app-content');

function shell(inner) {
  return `
    <a href="dashboard.html" class="btn-text mb-4 inline-block">&larr; Todos os clientes</a>
    <div class="mb-8 flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-serif">${client.fullName}</h1>
        <p class="text-white/40 text-sm">${client.email} · ${TIER_LABEL[client.tier] || client.tier}</p>
      </div>
      ${statusBadge(client.status)}
    </div>

    ${renderPhaseTracker(phaseProgress)}

    <div class="flex gap-1 mb-8 border-b border-white/10 overflow-x-auto">
      ${TABS.map(([key, label]) => `
        <button data-tab="${key}" class="tab-btn ${activeTab === key ? 'active' : ''}">${label}</button>
      `).join('')}
    </div>
    <div id="tab-content">${inner}</div>
  `;
}

function renderQuestionnaireTab() {
  const q = MockDB.getQuestionnaire(clientId);
  const a = MockDB.getQuestionnaireAnalysis(clientId);
  return `
    ${card(`
      <p class="text-sm text-white/50 mb-4">Respostas da Cliente</p>
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
        <p class="text-sm text-white/50">Análise de IA <span class="text-white/30">· v${a.version}</span></p>
        <button id="regen-qa" class="btn-ghost">Regenerar</button>
      </div>
      <div id="qa-body" class="space-y-4 text-sm">
        ${renderQABody(a)}
      </div>
    `)}
  `;
}

function renderQABody(a) {
  return `
    <div><p class="text-white/40 mb-1">Resumo Executivo</p><p>${a.executiveSummary}</p></div>
    <div><p class="text-white/40 mb-1">Pontos Fortes</p><ul class="list-disc list-inside space-y-1">${a.strengths.map((s) => `<li>${s}</li>`).join('')}</ul></div>
    <div><p class="text-white/40 mb-1">Objetivos</p><ul class="list-disc list-inside space-y-1">${a.goals.map((s) => `<li>${s}</li>`).join('')}</ul></div>
    <div><p class="text-white/40 mb-1">Pontos de Dor</p><ul class="list-disc list-inside space-y-1">${a.painPoints.map((s) => `<li>${s}</li>`).join('')}</ul></div>
    <div><p class="text-white/40 mb-1">Oportunidades</p><ul class="list-disc list-inside space-y-1">${a.opportunities.map((s) => `<li>${s}</li>`).join('')}</ul></div>
    <div><p class="text-white/40 mb-1">Perguntas Sugeridas</p><ul class="list-disc list-inside space-y-1">${a.suggestedQuestions.map((s) => `<li>${s}</li>`).join('')}</ul></div>
    <div><p class="text-white/40 mb-1">Maturidade do Negócio</p><p>${a.businessMaturity}</p></div>
  `;
}

function renderMeetingTab() {
  const meeting = MockDB.getMeeting(clientId);
  const ta = MockDB.getTranscriptAnalysis(clientId);
  return `
    ${card(`
      <div class="flex items-center justify-between mb-4">
        <p class="text-sm text-white/50">${meeting.title}</p>
        ${statusBadge(meeting.status)}
      </div>
      <p class="text-sm text-white/40 mb-4">Transcrição ${meeting.transcriptUploaded ? 'enviada' : 'não enviada'}. Este protótipo simula o upload/análise — nenhuma leitura real de arquivo ou chamada ao modelo acontece.</p>
      <div class="flex gap-3">
        <button id="upload-btn" class="btn-ghost" ${meeting.transcriptUploaded ? 'disabled' : ''}>Simular Envio de Transcrição</button>
        <button id="analyze-btn" class="btn-ghost" ${!meeting.transcriptUploaded ? 'disabled' : ''}>Analisar Transcrição</button>
      </div>
    `, 'mb-6')}
    ${card(`
      <p class="text-sm text-white/50 mb-4">Análise da Transcrição</p>
      <div id="ta-body" class="space-y-4 text-sm">${ta ? renderTABody(ta) : '<p class="text-white/30 text-sm">Ainda não analisada — envie e analise a transcrição acima.</p>'}</div>
    `)}
  `;
}

function renderTABody(ta) {
  return `
    <div><p class="text-white/40 mb-1">Resumo da Reunião</p><p>${ta.summary}</p></div>
    <div><p class="text-white/40 mb-1">Objetivos</p><ul class="list-disc list-inside space-y-1">${ta.goals.map((s) => `<li>${s}</li>`).join('')}</ul></div>
    <div><p class="text-white/40 mb-1">Desafios</p><ul class="list-disc list-inside space-y-1">${ta.challenges.map((s) => `<li>${s}</li>`).join('')}</ul></div>
    <div><p class="text-white/40 mb-1">Itens de Ação</p><ul class="list-disc list-inside space-y-1">${ta.actionItems.map((s) => `<li>${s}</li>`).join('')}</ul></div>
    <div><p class="text-white/40 mb-1">Tarefas</p><ul class="list-disc list-inside space-y-1">${ta.homework.map((s) => `<li>${s}</li>`).join('')}</ul></div>
    <div><p class="text-white/40 mb-1">Principais Insights</p><ul class="list-disc list-inside space-y-1">${ta.keyInsights.map((s) => `<li>${s}</li>`).join('')}</ul></div>
  `;
}

function renderPlaybookTab() {
  const pb = MockDB.getPlaybook(clientId);
  const latest = pb.versions[pb.versions.length - 1];
  const sectionDefs = MockDB.getSectionDefs();

  if (!latest) {
    return card(`
      <div class="flex items-center justify-between mb-2">
        <p class="text-sm text-white/50">Nenhuma versão gerada ainda</p>
        <button id="generate-pb" class="btn-ghost">Gerar Primeira Versão</button>
      </div>
      <p class="text-xs text-white/30">Requer questionário e transcrição analisados.</p>
    `);
  }

  return `
    <div class="flex items-center justify-between mb-4">
      <p class="text-sm text-white/50">Versão ${latest.version} ${statusBadge(latest.status)}</p>
      <div class="flex gap-3">
        <button id="generate-pb" class="btn-ghost">Gerar Nova Versão</button>
        <button id="publish-pb" class="btn-primary" style="padding:9px 18px;font-size:12.5px;" ${latest.status === 'published' ? 'disabled' : ''}>Publicar</button>
      </div>
    </div>
    <p class="text-xs text-white/30 mb-6">${pb.versions.length} versão(ões) no total — histórico completo preservado.</p>
    <div class="space-y-4">
      ${sectionDefs.map(([key, title]) => `
        <div class="card">
          <p class="text-xs uppercase tracking-wider text-white/40 mb-2">${title}</p>
          <textarea data-section="${key}" rows="2" class="field text-sm">${latest.sections[key]}</textarea>
        </div>
      `).join('')}
    </div>
  `;
}

function renderPitchTab() {
  const pitches = MockDB.getPitches(clientId);
  return `
    ${card(`
      <div class="flex items-center justify-between mb-4">
        <p class="text-sm text-white/50">Variações de Pitch</p>
        <button id="generate-pitch" class="btn-ghost">${pitches ? 'Regenerar' : 'Gerar'}</button>
      </div>
      <div id="pitch-body">
        ${pitches ? Object.entries(pitches).filter(([k]) => k !== 'version').map(([k, v]) => `
          <div class="mb-4 last:mb-0"><p class="text-xs text-white/40 mb-1 capitalize">${k.replace(/_/g, ' ')}</p><p class="text-sm">${v}</p></div>
        `).join('') : '<p class="text-white/30 text-sm">Ainda não gerado.</p>'}
      </div>
    `)}
  `;
}

function renderAssessmentTab() {
  const a = MockDB.getAssessment(clientId);
  return card(`
    <div class="flex items-center justify-between mb-3">
      <p class="font-medium">${a.title}</p>
      ${statusBadge(a.status)}
    </div>
    <p class="text-sm text-white/50 mb-4">${a.description}</p>
    <div class="flex items-center gap-3">
      <a href="${a.externalUrl}" target="_blank" class="btn-ghost">Abrir Teste Externo</a>
      <button id="mark-complete" class="btn-ghost" ${a.status === 'completed' ? 'disabled' : ''}>Marcar como Concluído</button>
    </div>
  `);
}

function renderHomeworkTab() {
  const tasks = MockDB.getHomework(clientId);
  const pct = MockDB.homeworkCompletionPct(clientId);
  return card(`
    <p class="text-sm text-white/50 mb-4">Conclusão: ${pct}%</p>
    <div class="space-y-3">
      ${tasks.map((t) => `
        <div class="py-3 border-b border-white/5 last:border-0">
          <div class="flex items-center justify-between">
            <span>${t.title}</span>
            ${statusBadge(t.status)}
          </div>
          ${t.type === 'media_upload' && (t.submissions || []).length ? `
            <div class="mt-3 space-y-2">
              ${t.submissions.map((s) => `
                <div class="rounded border p-3" style="border-color:var(--line);">
                  <p class="text-xs mb-2" style="color:var(--muted);">${s.name} · ${formatDateTime(s.uploadedAt)}</p>
                  ${s.url
                    ? (s.kind === 'video'
                        ? `<video src="${s.url}" controls class="w-full rounded" style="max-height:220px;"></video>`
                        : `<audio src="${s.url}" controls class="w-full"></audio>`)
                    : `<p class="text-xs italic" style="color:var(--muted);">Gravação de sessão anterior — não reproduzível neste protótipo.</p>`}
                </div>
              `).join('')}
            </div>
          ` : ''}
        </div>
      `).join('')}
    </div>
  `);
}

function renderMeetingPrepTab() {
  const q = MockDB.getQuestionnaire(clientId);
  const pct = MockDB.homeworkCompletionPct(clientId);
  const pb = MockDB.getPublishedPlaybook(clientId);
  const hw = MockDB.getHomework(clientId);
  const questionsSubmitted = hw.find((t) => t.id === 'h3')?.status === 'completed';
  const experience = MockDB.getPlaybookExperience(clientId);
  const quiz = MockDB.getQuiz(clientId);
  const attention = [];
  if (!pb) attention.push('Playbook ainda não publicado para a cliente');
  if (pct < 100) attention.push('Tarefas não totalmente concluídas');
  if (!questionsSubmitted) attention.push('Perguntas de reflexão não enviadas');
  if (pb && !experience.completedAt) attention.push('Cliente ainda não vivenciou o playbook (podcast/vídeo/audiobook)');
  if (pb && experience.completedAt && !quiz.completedAt) attention.push('Quiz do playbook ainda não feito');

  return `
    ${card(`
      <p class="text-sm text-white/50 mb-4">Checklist Pré-Reunião 2</p>
      <div class="grid md:grid-cols-2 gap-4 text-sm">
        <div class="flex justify-between py-2 border-b border-white/5"><span>Questionário</span>${statusBadge(q.status === 'submitted' ? 'completed' : 'pending')}</div>
        <div class="flex justify-between py-2 border-b border-white/5"><span>Tarefas</span><span>${pct}%</span></div>
        <div class="flex justify-between py-2 border-b border-white/5"><span>Playbook Publicado</span>${statusBadge(pb ? 'published' : 'draft')}</div>
        <div class="flex justify-between py-2 border-b border-white/5"><span>Perguntas Enviadas</span>${statusBadge(questionsSubmitted ? 'completed' : 'pending')}</div>
        <div class="flex justify-between py-2 border-b border-white/5"><span>Experiência do Playbook</span>${statusBadge(experience.completedAt ? 'completed' : 'pending')}</div>
        <div class="flex justify-between py-2 border-b border-white/5"><span>Quiz</span>${quiz.completedAt ? `<span class="text-xs">${quiz.score}/${quiz.total}</span>` : statusBadge('pending')}</div>
      </div>
    `, 'mb-6')}
    ${card(`
      <p class="text-sm text-white/50 mb-3">Áreas que Requerem Atenção</p>
      ${attention.length ? `<ul class="list-disc list-inside space-y-1 text-sm" style="color:var(--gold);">${attention.map((a) => `<li>${a}</li>`).join('')}</ul>` : '<p class="text-sm" style="color:var(--gold);">Tudo em dia.</p>'}
    `)}
  `;
}

function renderActivityTab() {
  const events = MockDB.getActivity(clientId);
  return card(`
    <div class="space-y-4">
      ${events.map((e) => `
        <div class="flex items-start gap-4 py-3 border-b border-white/5 last:border-0">
          <div class="w-2 h-2 mt-2 rounded-full shrink-0" style="background:var(--terracotta);"></div>
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
    e.target.disabled = true; e.target.textContent = 'Gerando…';
    const a = await MockDB.regenerateQuestionnaireAnalysis(clientId);
    document.getElementById('qa-body').innerHTML = renderQABody(a);
    toast('Análise regenerada.');
    render();
  });

  tc.querySelector('#upload-btn')?.addEventListener('click', async (e) => {
    e.target.disabled = true; e.target.textContent = 'Enviando…';
    await MockDB.uploadTranscript(clientId);
    toast('Transcrição enviada.');
    render();
  });
  tc.querySelector('#analyze-btn')?.addEventListener('click', async (e) => {
    e.target.disabled = true; e.target.textContent = 'Analisando…';
    await MockDB.analyzeTranscript(clientId);
    toast('Transcrição analisada.');
    render();
  });

  tc.querySelector('#generate-pb')?.addEventListener('click', async (e) => {
    e.target.disabled = true; e.target.textContent = 'Gerando…';
    await MockDB.generatePlaybookDraft(clientId);
    toast('Novo rascunho de playbook gerado.');
    render();
  });
  tc.querySelector('#publish-pb')?.addEventListener('click', () => {
    const pb = MockDB.getPlaybook(clientId);
    const latest = pb.versions[pb.versions.length - 1];
    MockDB.publishPlaybook(clientId, latest.version);
    toast('Playbook publicado — cliente notificada.');
    render();
  });
  tc.querySelectorAll('[data-section]').forEach((el) => {
    el.addEventListener('blur', () => {
      const pb = MockDB.getPlaybook(clientId);
      const latest = pb.versions[pb.versions.length - 1];
      MockDB.saveSectionEdit(clientId, latest.version, el.dataset.section, el.value);
    });
  });

  tc.querySelector('#generate-pitch')?.addEventListener('click', async (e) => {
    e.target.disabled = true; e.target.textContent = 'Gerando…';
    await MockDB.generatePitches(clientId);
    toast('Pitches gerados.');
    render();
  });

  tc.querySelector('#mark-complete')?.addEventListener('click', () => {
    MockDB.markAssessmentComplete(clientId);
    toast('Avaliação marcada como concluída.');
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
