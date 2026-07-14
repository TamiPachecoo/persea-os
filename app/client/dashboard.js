import { MockDB, DEFAULT_CLIENT_ID } from '../shared/mock-db.js';
import { renderShell, card, progressBar, statusBadge, formatDateTime, formatDate, renderPhaseTracker, toast } from '../shared/ui.js';

const MEETING_STATUS_LABEL = {
  pending: ['Aguardando triagem', 'badge-locked'],
  assigned: ['Reunião agendada', 'badge-progress'],
  done: ['Concluída', 'badge-completed'],
};

document.body.innerHTML = renderShell({ role: 'client', active: 'dashboard.html' });

const client = MockDB.getClient(DEFAULT_CLIENT_ID);
const journey = MockDB.getJourney(DEFAULT_CLIENT_ID);
const phaseProgress = MockDB.getPhaseProgress(DEFAULT_CLIENT_ID);
const assessment = MockDB.getAssessment(DEFAULT_CLIENT_ID);
const completedSteps = journey.steps.filter((s) => s.status === 'completed').length;
const journeyPct = Math.round((completedSteps / journey.steps.length) * 100);
const outstanding = journey.steps.filter((s) => s.status === 'available' || s.status === 'in_progress');

// Where each journey step's artifact actually lives — lets the client click
// back into anything they've already done, instead of the list being a dead end.
const STEP_LINKS = {
  questionnaire: 'questionnaire.html',
  playbook_review: 'playbook.html',
  pitch: 'pitch.html',
  homework: 'homework.html',
  assessment: assessment.externalUrl,
};
const CLICKABLE_STATUSES = new Set(['completed', 'available', 'in_progress']);

function stepRow(s) {
  const href = STEP_LINKS[s.key];
  const clickable = href && CLICKABLE_STATUSES.has(s.status);
  const inner = `
    <span class="${s.status === 'locked' ? 'text-white/30' : ''}">${s.title}</span>
    ${statusBadge(s.status)}
  `;
  if (clickable) {
    const external = s.key === 'assessment';
    return `<a href="${href}" ${external ? 'target="_blank"' : ''} class="flex items-center justify-between py-2 border-b border-white/5 last:border-0 hover:bg-white/5 -mx-2 px-2 rounded transition-colors">${inner}</a>`;
  }
  return `<div class="flex items-center justify-between py-2 border-b border-white/5 last:border-0">${inner}</div>`;
}

const content = document.getElementById('app-content');
content.innerHTML = `
  <div class="mb-10 reveal" style="animation-delay:.02s;">
    <p class="text-white/40 text-sm mb-1">Bem-vinda de volta,</p>
    <h1 class="text-3xl font-serif">${client.fullName}</h1>
  </div>

  <div class="reveal" style="animation-delay:.1s;">${renderPhaseTracker(phaseProgress)}</div>

  <div class="grid md:grid-cols-3 gap-6 mb-8">
    <div class="reveal" style="animation-delay:.18s;">${card(`
      <p class="text-sm text-white/50 mb-3">Progresso da Etapa — ${phaseProgress.phases[phaseProgress.currentIndex]}</p>
      <p class="text-3xl font-serif mb-4">${journeyPct}%</p>
      ${progressBar(journeyPct)}
    `)}</div>
    <div class="reveal" style="animation-delay:.26s;">${card(`
      <p class="text-sm text-white/50 mb-3">Etapa Atual</p>
      <p class="text-xl font-serif mb-2">${phaseProgress.phases[phaseProgress.currentIndex]}</p>
      <p class="text-sm text-white/40">Passo ${completedSteps + 1} de ${journey.steps.length}</p>
    `)}</div>
    <div class="reveal" style="animation-delay:.34s;">${card(`
      <p class="text-sm text-white/50 mb-3">Próxima Reunião</p>
      <p class="text-lg font-medium mb-1">${journey.upcomingMeeting.title}</p>
      <p class="text-sm text-white/40">${formatDateTime(journey.upcomingMeeting.date)}</p>
    `)}</div>
  </div>

  <div class="grid md:grid-cols-2 gap-6">
    <div class="reveal" style="animation-delay:.42s;">${card(`
      <p class="text-sm text-white/50 mb-4">Tarefas Pendentes</p>
      <div class="space-y-3">
        ${outstanding.length ? outstanding.map(stepRow).join('') : '<p class="text-white/30 text-sm">Nada pendente no momento.</p>'}
      </div>
    `)}</div>
    <div class="reveal" id="journey-detail" style="animation-delay:.5s;">${card(`
      <p class="text-sm text-white/50 mb-4">Jornada Completa</p>
      <p class="text-xs text-white/30 mb-3">Clique em qualquer etapa concluída para revisitá-la.</p>
      <div class="space-y-1">
        ${journey.steps.map(stepRow).join('')}
      </div>
    `)}</div>
  </div>

  <div class="reveal mt-6" style="animation-delay:.58s;" id="meeting-request-card"></div>
`;

renderMeetingRequestCard();

document.querySelectorAll('[data-phase-index]').forEach((btn) => {
  btn.addEventListener('click', () => {
    const state = btn.dataset.phaseState;
    const label = phaseProgress.phases[Number(btn.dataset.phaseIndex)];
    if (state === 'locked') {
      toast('Esta fase ainda não foi liberada pela sua consultora.', { tone: 'error' });
      return;
    }
    if (label === 'Identidade') {
      document.getElementById('journey-detail').scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      toast(`Conteúdo da fase "${label}" chega em breve.`);
    }
  });
});

let showRequestForm = false;

function renderMeetingRequestCard() {
  const mount = document.getElementById('meeting-request-card');
  const requests = MockDB.getMeetingRequests(DEFAULT_CLIENT_ID);

  mount.innerHTML = card(`
    <div class="flex items-center justify-between mb-1">
      <p class="text-sm text-white/50">Precisa tirar uma dúvida?</p>
      ${!showRequestForm ? `<button id="toggle-request" class="btn-ghost">Solicitar Reunião</button>` : ''}
    </div>
    ${showRequestForm ? `
      <div class="mt-4">
        <textarea id="request-reason" rows="3" class="field" placeholder="Conte rapidamente o que você gostaria de discutir..."></textarea>
        <div class="flex items-center gap-3 mt-3">
          <button id="send-request" class="btn-primary" style="padding:9px 18px;font-size:12.5px;">Enviar Solicitação</button>
          <button id="cancel-request" class="btn-text">Cancelar</button>
        </div>
      </div>
    ` : ''}
    ${requests.length ? `
      <div class="mt-5 space-y-2">
        ${requests.map((r) => {
          const [label, badgeClass] = MEETING_STATUS_LABEL[r.status];
          const who = r.assignedTo === 'nay' ? ' · com a Nay' : r.assignedTo === 'assistant' ? ' · com a assistente' : '';
          return `
            <div class="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
              <div>
                <p class="text-sm">${r.reason}</p>
                <p class="text-xs" style="color:var(--muted);">${formatDate(r.createdAt)}${who}</p>
              </div>
              <span class="badge ${badgeClass}">${label}</span>
            </div>
          `;
        }).join('')}
      </div>
    ` : ''}
  `);

  document.getElementById('toggle-request')?.addEventListener('click', () => {
    showRequestForm = true;
    renderMeetingRequestCard();
  });
  document.getElementById('cancel-request')?.addEventListener('click', () => {
    showRequestForm = false;
    renderMeetingRequestCard();
  });
  document.getElementById('send-request')?.addEventListener('click', () => {
    const text = document.getElementById('request-reason').value.trim();
    if (!text) { toast('Escreva um breve motivo antes de enviar.', { tone: 'error' }); return; }
    MockDB.requestMeeting(DEFAULT_CLIENT_ID, text);
    showRequestForm = false;
    toast('Solicitação enviada! Nay ou a assistente vão entrar em contato.');
    renderMeetingRequestCard();
  });
}
