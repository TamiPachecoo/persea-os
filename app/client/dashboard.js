// Painel — the client's home/overview, answering "o que preciso saber ou
// fazer agora?". Not a second copy of the Program Hub: progress/activities
// live in program.js, this page only surfaces a summary + the one thing to
// do next. Both read the exact same MockDB.getProgramActivities/
// getProgramProgress, so they can never disagree with each other.
import { MockDB, getActiveClientId } from '../shared/mock-db.js';
import {
  renderShell, card, progressBar, formatDateTime, formatDate, toast,
  initClientSwitcher, externalLinkAttrs, isValidHttpUrl, contentCardInner,
  animateCount, initScrollReveal, enableTilt,
} from '../shared/ui.js';

const MEETING_STATUS_LABEL = {
  pending: ['Aguardando triagem', 'badge-locked'],
  assigned: ['Reunião agendada', 'badge-progress'],
  done: ['Concluída', 'badge-completed'],
};

let showRequestForm = false;
const activeClientId = getActiveClientId();

document.body.innerHTML = renderShell({ role: 'client', active: 'dashboard.html' });
initClientSwitcher();

const client = MockDB.getClient(activeClientId);
const onboarding = MockDB.getOnboarding(activeClientId);
const onboardingIncomplete = onboarding.whatsappGroup.status !== 'added';

const content = document.getElementById('app-content');

// --- Onboarding banner — staged by how far along she actually is, not one
// generic "finish onboarding" message the whole time. Info-not-submitted is
// the most urgent state (nothing else can move until it's done), so it gets
// distinct, harder-to-miss styling — matches the same urgency treatment used
// on Nay's side (see getClientsAwaitingInfo and everywhere it's surfaced).
function renderOnboardingBanner() {
  if (!onboarding.clientInfo.submitted) {
    return `
      <div class="mb-8 reveal" style="border-left:3px solid var(--terracotta); border-radius:4px;">${card(`
        <div class="flex items-center justify-between flex-wrap gap-4">
          <div>
            <p class="text-sm mb-1" style="color:var(--terracotta);">⚠ Ação necessária</p>
            <p class="text-lg font-serif mb-1">Complete suas informações</p>
            <p class="text-xs text-white/40">Sua consultora não consegue preparar seu contrato até você preencher seus dados de cadastro.</p>
          </div>
          <a href="onboarding.html" class="btn-primary" style="padding:9px 18px;font-size:12.5px;">Completar Agora</a>
        </div>
      `, '')}</div>
    `;
  }
  if (onboarding.contract.status !== 'completed') {
    return `
      <div class="mb-8 reveal">${card(`
        <div class="flex items-center justify-between flex-wrap gap-4">
          <div>
            <p class="text-sm text-white/50 mb-1">Seu contrato está a caminho</p>
            <p class="text-xs text-white/30">Acompanhe o status da preparação e assinatura na página de Onboarding.</p>
          </div>
          <a href="onboarding.html" class="btn-primary" style="padding:9px 18px;font-size:12.5px;">Ver Status</a>
        </div>
      `)}</div>
    `;
  }
  // Contract's done — the two activities that don't need the rest of
  // onboarding (WhatsApp group, resources) to be finished are already
  // unlocked (see deriveActivityStatus). Prompt her straight to them.
  return `
    <div class="mb-8 reveal">${card(`
      <div class="flex items-center justify-between flex-wrap gap-4">
        <div>
          <p class="text-sm mb-1" style="color:var(--gold);">Contrato concluído ✓</p>
          <p class="text-lg font-serif mb-1">Próximo passo: Extração de Marca e Teste de Arquétipos</p>
          <p class="text-xs text-white/40">Enquanto o restante do onboarding é finalizado, você já pode começar por aqui.</p>
        </div>
        <a href="program.html" class="btn-primary" style="padding:9px 18px;font-size:12.5px;">Começar Agora</a>
      </div>
    `)}</div>
  `;
}

// --- Program summary --------------------------------------------------
function renderProgramSummary() {
  if (onboardingIncomplete) return '';
  const program = MockDB.getClientProgram(activeClientId);
  const progress = MockDB.getProgramProgress(activeClientId);
  const phaseProgress = MockDB.getPhaseProgress(activeClientId);
  return `
    <div class="grid md:grid-cols-3 gap-6 mb-8">
      <div class="reveal-scroll tilt-card">${card(`
        <p class="text-xs text-white/30 mb-2">Seu programa</p>
        <p class="text-xl font-serif mb-1">${program.name}</p>
        <p class="text-xs text-white/30">${program.durationMonths ? `${program.durationMonths} meses` : 'Duração a confirmar'}</p>
      `)}</div>
      <div class="reveal-scroll tilt-card">${card(`
        <p class="text-xs text-white/30 mb-2">Momento atual</p>
        <p class="text-xl font-serif mb-1">${phaseProgress.phases[phaseProgress.currentIndex]}</p>
        <p class="text-xs text-white/30">Fase ${phaseProgress.currentIndex + 1} de ${phaseProgress.phases.length}</p>
      `)}</div>
      <div class="reveal-scroll tilt-card">${card(`
        <p class="text-xs text-white/30 mb-2">Progresso geral</p>
        <p class="text-3xl font-serif mb-3"><span id="program-pct-counter">0</span>%</p>
        ${progressBar(progress.pct)}
      `)}</div>
    </div>
  `;
}

// --- Next action + Outras pendências -----------------------------------
function renderNextAction() {
  if (onboardingIncomplete) return '';
  const next = MockDB.getNextAction(activeClientId);
  const others = MockDB.getOtherPendingItems(activeClientId);

  const primary = next ? `
    <div class="flex items-center justify-between flex-wrap gap-4">
      <div>
        <p class="text-sm text-white/50 mb-1">Próxima ação</p>
        <p class="text-xl font-serif">${next.title}</p>
      </div>
      ${next.route ? `<a href="${next.route}" class="btn-primary" style="padding:10px 20px;font-size:13px;">${next.label}</a>`
        : `<a href="program.html" class="btn-primary" style="padding:10px 20px;font-size:13px;">${next.label}</a>`}
    </div>
  ` : `
    <p class="text-sm" style="color:var(--muted);">Tudo em dia! Nenhuma ação pendente da sua parte agora — Nay avisa por aqui assim que houver algo novo.</p>
  `;

  return `
    <div class="reveal mb-6">${card(primary)}</div>
    ${others.length ? `
      <div class="reveal-scroll mb-8">
        <p class="text-xs uppercase mb-3" style="color:var(--muted); letter-spacing:.12em;">Outras pendências</p>
        <div class="divide-y" style="border-color:var(--line);">
          ${others.map((o) => `
            <a href="${o.route}" class="flex items-center justify-between py-2.5 hover:bg-white/5 -mx-2 px-2 rounded transition-colors">
              <span class="text-sm">${o.title}</span>
              <span class="text-xs text-white/30">${o.label}</span>
            </a>
          `).join('')}
        </div>
      </div>
    ` : ''}
  `;
}

// --- Next meeting/class --------------------------------------------------
function renderNextMeeting() {
  const meeting = MockDB.getUpcomingMeetingForClient(activeClientId);
  if (!meeting) {
    return card(`
      <p class="text-sm text-white/50 mb-2">Próximo encontro</p>
      <p class="text-sm" style="color:var(--muted);">Nenhum encontro agendado no momento — assim que Nay marcar algo novo, aparece por aqui.</p>
      <a href="encontros.html" class="btn-text mt-3 inline-block">Ver Encontros</a>
    `, 'mb-8');
  }
  const linkOk = isValidHttpUrl(meeting.onlineLink) && meeting.status === 'upcoming';
  return card(`
    <div class="flex items-center justify-between mb-3">
      <p class="text-sm text-white/50">Próximo encontro</p>
      <a href="encontros.html" class="btn-text">Ver todos</a>
    </div>
    <p class="text-lg font-serif mb-1">${meeting.title}</p>
    <p class="text-sm text-white/40 mb-1">${formatDateTime(meeting.date)} · com Nay</p>
    ${meeting.topic ? `<p class="text-xs text-white/30 mb-4">${meeting.topic}</p>` : '<div class="mb-4"></div>'}
    ${linkOk ? `<a ${externalLinkAttrs(meeting.onlineLink)} class="btn-primary inline-block" style="padding:9px 18px;font-size:12.5px;">Entrar na Reunião ↗</a>` : ''}
  `, 'mb-8');
}

// --- Recommended + available content --------------------------------------
// Suppressed while the onboarding gate is up (see content.js/program.js) —
// otherwise this widget would dangle direct Hubla links that route around
// the very block the "Ver Conteúdos" button above them respects.
function renderContentSections() {
  if (MockDB.needsOnboardingCompletion(activeClientId)) return '';
  const assignments = MockDB.getAssignmentsForClient(activeClientId).filter((a) => !a.completed).slice(0, 2);
  const categories = MockDB.getContentCategories();
  const shown = new Set();
  const recommended = categories.slice(0, 3);
  recommended.forEach((c) => shown.add(c.id));
  const rest = categories.filter((c) => !shown.has(c.id));

  return `
    <div class="reveal-scroll mb-8">
      <div class="flex items-center justify-between mb-4">
        <p class="text-sm text-white/50">Conteúdo recomendado</p>
        <a href="content.html" class="btn-text">Ver Conteúdos</a>
      </div>
      ${assignments.length ? `
        <div class="grid md:grid-cols-2 gap-4 mb-5">
          ${assignments.map((a) => card(`
            <p class="text-xs" style="color:var(--gold);">Recomendado por Nay</p>
            <p class="font-medium text-sm mt-1 mb-2">${a.resource.title}</p>
            ${isValidHttpUrl(a.resource.hublaUrl) ? `<a ${externalLinkAttrs(a.resource.hublaUrl)} class="btn-ghost inline-block" style="padding:6px 12px; font-size:12px;">Abrir na Hubla ↗</a>` : ''}
          `)).join('')}
        </div>
      ` : ''}
      ${recommended.length ? `<div class="content-grid mb-3">${recommended.map((c) => `
        <a ${externalLinkAttrs(c.hublaUrl)} class="content-card">${contentCardInner(c)}</a>
      `).join('')}</div>` : ''}
      <p class="text-xs text-white/20">Conteúdos abrem na Hubla, em uma nova aba.</p>
    </div>
    ${rest.length ? `
      <div class="reveal-scroll mb-8">
        <p class="text-sm text-white/50 mb-3">Também disponível</p>
        <div class="flex flex-wrap gap-2">
          ${rest.map((c) => `<a href="content.html" class="btn-ghost" style="padding:7px 14px; font-size:12px;">${c.title}</a>`).join('')}
        </div>
      </div>
    ` : ''}
  `;
}

// --- Recent progress -------------------------------------------------------
function renderRecentProgress() {
  const timeline = MockDB.getRecentProgressTimeline(activeClientId, 5);
  if (!timeline.length) return '';
  return `
    <div class="reveal-scroll mb-8">
      <p class="text-sm text-white/50 mb-4">Progresso recente</p>
      <div class="space-y-3">
        ${timeline.map((e) => `
          <div class="flex items-start gap-3">
            <div class="w-1.5 h-1.5 mt-2 rounded-full shrink-0" style="background:var(--terracotta);"></div>
            <div>
              <p class="text-sm">${e.text}</p>
              <p class="text-xs text-white/20">${formatDateTime(e.at)}</p>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

content.innerHTML = `
  ${onboardingIncomplete ? renderOnboardingBanner() : ''}
  <div class="mb-10 reveal" style="animation-delay:.02s;">
    <p class="text-white/40 text-sm mb-1">Bem-vinda de volta,</p>
    <h1 class="text-3xl font-serif">${client.fullName}</h1>
  </div>

  ${renderProgramSummary()}
  ${renderNextAction()}
  ${renderNextMeeting()}
  ${renderContentSections()}
  ${renderRecentProgress()}

  <div class="reveal-scroll mt-2" id="meeting-request-card"></div>
`;

renderMeetingRequestCard();
initScrollReveal();
enableTilt();
const counterEl = document.getElementById('program-pct-counter');
if (counterEl) animateCount(counterEl, MockDB.getProgramProgress(activeClientId).pct);

function renderMeetingRequestCard() {
  const mount = document.getElementById('meeting-request-card');
  const requests = MockDB.getMeetingRequests(activeClientId);

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
    MockDB.requestMeeting(activeClientId, text);
    showRequestForm = false;
    toast('Solicitação enviada! Nay ou a assistente vão entrar em contato.');
    renderMeetingRequestCard();
  });
}
