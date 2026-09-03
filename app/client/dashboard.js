// Painel — the client's home/overview, answering "o que preciso saber ou
// fazer agora?". Not a second copy of the Program Hub: progress/activities
// live in program.js, this page only surfaces a summary + the one thing to
// do next. Both read the exact same MockDB.getProgramActivities/
// getProgramProgress, so they can never disagree with each other.
import { MockDB } from '../shared/mock-db.js';
import { getCurrentClientContext } from '../shared/client-context.js';
import {
  renderShell, card, formatDateTime, formatDate, toast,
  initClientSwitcher, externalLinkAttrs, isValidHttpUrl,
  initScrollReveal, enableTilt, renderPhaseTracker, wirePhaseTrackerNav,
  renderEncounterRequestsCard, wireEncounterRequestForms,
} from '../shared/ui.js';

const MEETING_STATUS_LABEL = {
  pending: ['Aguardando triagem', 'badge-locked'],
  assigned: ['Reunião agendada', 'badge-progress'],
  done: ['Concluída', 'badge-completed'],
};

let showRequestForm = false;
const __clientCtx = await getCurrentClientContext();
if (!__clientCtx) throw new Error('not authorized');
const activeClientId = __clientCtx.clientId;
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
// Same interactive, pulsing tracker as Seu Programa (see renderPhaseTracker
// in ui.js) — brought onto the Painel too so "what phase am I in" is
// visually obvious the moment she lands, not just once she clicks through.
function renderJourneyTracker() {
  if (onboardingIncomplete) return '';
  return `<div class="reveal">${renderPhaseTracker(MockDB.getPhaseProgress(activeClientId))}</div>`;
}

// --- Próxima Ação — the one headline next step, nothing else. The full
// task-by-task breakdown already lives on Minha Jornada (current-phase
// activity cards) — repeating that list here was pure duplication, so this
// stays a single card, and disappears entirely once there's nothing
// pending in her current phase (no "tudo em dia" filler either).
function renderNextAction() {
  if (onboardingIncomplete) return '';
  const next = MockDB.getNextAction(activeClientId);
  if (!next) return '';
  return `
    <div class="reveal mb-8">${card(`
      <div class="flex items-center justify-between flex-wrap gap-4">
        <div>
          <p class="text-sm text-white/50 mb-1">Próxima Ação</p>
          <p class="text-xl font-serif">${next.title}</p>
        </div>
        <a href="${next.route || 'program.html'}" class="btn-primary" style="padding:10px 20px;font-size:13px;">${next.label}</a>
      </div>
    `)}</div>
  `;
}

// --- Scheduled meetings — anything Nay's already confirmed on the Agenda,
// same agendaItems Encontros reads, never a separate schedule of its own.
function renderNextMeeting() {
  if (onboardingIncomplete) return '';
  const meeting = MockDB.getUpcomingMeetingForClient(activeClientId);
  if (!meeting) return '';
  const linkOk = isValidHttpUrl(meeting.onlineLink) && meeting.status === 'upcoming';
  return card(`
    <div class="flex items-center justify-between mb-3">
      <p class="text-sm text-white/50">Próximo Encontro</p>
      <a href="encontros.html" class="btn-text">Ver todos</a>
    </div>
    <p class="text-lg font-serif mb-1">${meeting.title}</p>
    <p class="text-sm text-white/40 mb-1">${formatDateTime(meeting.date)} · com Nay</p>
    ${meeting.topic ? `<p class="text-xs text-white/30 mb-4">${meeting.topic}</p>` : '<div class="mb-4"></div>'}
    ${linkOk ? `<a ${externalLinkAttrs(meeting.onlineLink)} class="btn-primary inline-block" style="padding:9px 18px;font-size:12.5px;">Entrar na Reunião ↗</a>` : ''}
  `, 'mb-8');
}

content.innerHTML = `
  ${onboardingIncomplete ? renderOnboardingBanner() : ''}
  <div class="mb-10 reveal" style="animation-delay:.02s;">
    <p class="text-white/40 text-sm mb-1">Bem-vinda de volta,</p>
    <h1 class="text-3xl font-serif">${client.fullName}</h1>
  </div>

  ${renderJourneyTracker()}
  ${renderNextAction()}
  ${renderNextMeeting()}

  ${renderEncounterRequestsCard(activeClientId)}
  <div class="reveal-scroll mt-2" id="meeting-request-card"></div>
`;

renderMeetingRequestCard();
initScrollReveal();
enableTilt();
wirePhaseTrackerNav(content, { hrefBase: 'program.html' });
wireEncounterRequestForms(content, () => location.reload());

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

// --- Invitation-based access (Nova Persea item 8) — a freshly-activated
// client (see MockDB.activateLead) lands here once, before ever seeing the
// real Painel content above. No password is generated or shown; "Criar meu
// acesso" just clears the flag (see createClientAccess) — the real
// Supabase invite/magic-link flow this stands in for isn't connected in
// this prototype (see delivery report), so this is intentionally the
// smallest honest placeholder for it, not a fake success message.
if (client.accessStatus === 'pending') {
  content.innerHTML = `
    <div class="min-h-[60vh] flex items-center justify-center">
      <div class="max-w-md w-full text-center">
        <p class="eyebrow mb-4">Persea</p>
        <h1 class="font-serif text-3xl mb-4">Bem-vinda ao Persea</h1>
        <p class="text-sm mb-8" style="color:var(--muted); line-height:1.7;">Seu espaço está pronto. Crie seu acesso para começar sua jornada.</p>
        <button id="create-access" class="btn-primary" style="padding:12px 28px;font-size:13.5px;">Criar meu acesso</button>
      </div>
    </div>
  `;
  document.getElementById('create-access').addEventListener('click', () => {
    MockDB.createClientAccess(activeClientId);
    location.reload();
  });
}
