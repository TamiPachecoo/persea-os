// Seus Encontros — every meeting/class scheduled with this client, upcoming
// and past, reading the same agendaItems Nay schedules from her Agenda (see
// admin/agenda.js) — not a separate meetings list of its own. Individual
// meetings additionally carry a Google Meet recording/transcript bundle
// (PROTOTYPE — see docs/google-meet-integration.md); only ever this
// client's own, via MockDB.getClientMeetingsWithRecording's clientId filter.
import { MockDB, AGENDA_TYPE_LABEL, AGENDA_STATUS_LABEL } from '../shared/mock-db.js';
import { getCurrentClientContext } from '../shared/client-context.js';
import { renderShell, card, formatDateTime, formatDate, toast, initClientSwitcher, isValidHttpUrl, externalLinkAttrs, renderClientRecordingBlock, renderEncounterRequestsCard, wireEncounterRequestForms } from '../shared/ui.js';

const AGENDA_TYPE_ICON = {
  class: '🎓', individual_meeting: '👤', checkpoint: '☎️', group_meeting: '👥', online_event: '🌐', photo_review: '📸',
};
const AGENDA_STATUS_BADGE = { upcoming: 'badge-progress', completed: 'badge-completed', rescheduled: 'badge-locked', cancelled: 'badge-locked' };
// Client Painel removal: this free-form "Precisa tirar uma dúvida?" request
// (MockDB.requestMeeting/getMeetingRequests) used to live on the Painel —
// ported here verbatim since Encontros is now where every meeting-related
// action lives, alongside the structured encounter-time-picking card above
// (renderEncounterRequestsCard, a separate flow/data model already shared
// with this page). See admin/dashboard.js's renderRequestsCard and
// assistant/queue.js for how Nay/the assistant triage these.
const MEETING_STATUS_LABEL = {
  pending: ['Aguardando triagem', 'badge-locked'],
  assigned: ['Reunião agendada', 'badge-progress'],
  done: ['Concluída', 'badge-completed'],
};
let showRequestForm = false;

const __clientCtx = await getCurrentClientContext();
if (!__clientCtx) throw new Error('not authorized');
const clientId = __clientCtx.clientId;
document.body.innerHTML = renderShell({ role: 'client', active: 'encontros.html', title: 'Encontros' });
initClientSwitcher();
const content = document.getElementById('app-content');

// Only meeting-like types belong here — admin_task/deadline are Nay's
// internal operational items, never meant for the client to see.
const MEETING_TYPES = new Set(['class', 'individual_meeting', 'checkpoint', 'group_meeting', 'online_event', 'photo_review']);

// "How many of these did we actually do" — same numbers Nay sees on her
// side (see MockDB.getMeetingsUsage), so there's one answer to that
// question, not a client-side guess from scrolling the list below.
function usageSummary() {
  const usage = MockDB.getMeetingsUsage(clientId);
  if (!usage) return '';
  return card(`
    <p class="text-sm text-white/50 mb-4">Seus Encontros na Jornada</p>
    <div class="grid sm:grid-cols-3 gap-6">
      <div>
        <p class="text-xs text-white/30 mb-1">Encontros Individuais</p>
        <p class="text-2xl font-serif">${usage.encounters.completed} <span class="text-sm text-white/30">de ${usage.encounters.total}</span></p>
      </div>
      ${usage.checkpoints ? `
        <div>
          <p class="text-xs text-white/30 mb-1">Check-ins (30min)</p>
          <p class="text-2xl font-serif">${usage.checkpoints.completed} <span class="text-sm text-white/30">de ${usage.checkpoints.total}</span></p>
          ${usage.checkpoints.upcoming ? `<p class="text-xs mt-1" style="color:var(--gold);">${usage.checkpoints.upcoming} agendado${usage.checkpoints.upcoming === 1 ? '' : 's'}</p>` : ''}
        </div>
      ` : ''}
      <div>
        <p class="text-xs text-white/30 mb-1">Encontros em Grupo</p>
        <p class="text-2xl font-serif">${usage.groupMeetings.completed} <span class="text-sm text-white/30">realizados</span></p>
        <p class="text-xs text-white/20 mt-1">Ilimitados durante o programa</p>
      </div>
    </div>
  `, 'mb-8');
}

function meetingCard(it, recordingByMeetingId) {
  const linkOk = it.status === 'upcoming' && isValidHttpUrl(it.onlineLink);
  const enriched = recordingByMeetingId.get(it.id);
  return card(`
    <div class="flex items-start justify-between gap-4 mb-2">
      <div>
        <p class="text-xs" style="color:var(--terracotta);">${AGENDA_TYPE_ICON[it.type] || ''} ${AGENDA_TYPE_LABEL[it.type]}</p>
        <p class="text-lg font-serif mt-1">${it.title}</p>
      </div>
      <span class="badge ${AGENDA_STATUS_BADGE[it.status] || 'badge-locked'}">${AGENDA_STATUS_LABEL[it.status]}</span>
    </div>
    <p class="text-sm text-white/40 mb-1">${formatDateTime(it.date)}</p>
    ${it.topic ? `<p class="text-sm text-white/50 mb-4 max-w-xl">${it.topic}</p>` : '<div class="mb-4"></div>'}
    ${linkOk ? `<a ${externalLinkAttrs(it.onlineLink)} class="btn-primary inline-block" style="padding:9px 18px;font-size:12.5px;">Entrar na Reunião ↗</a>` : ''}
    ${enriched ? `<div class="mt-4 pt-4" style="border-top:1px solid var(--line);">${renderClientRecordingBlock(enriched)}</div>` : ''}
  `, 'mb-5');
}

function renderMeetingRequestCard() {
  const mount = document.getElementById('meeting-request-card');
  const requests = MockDB.getMeetingRequests(clientId);

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
    MockDB.requestMeeting(clientId, text);
    showRequestForm = false;
    toast('Solicitação enviada! Nay ou a assistente vão entrar em contato.');
    renderMeetingRequestCard();
  });
}

function render() {
  const items = MockDB.getAgendaItemsForClient(clientId).filter((it) => MEETING_TYPES.has(it.type));
  const recordingByMeetingId = new Map(MockDB.getClientMeetingsWithRecording(clientId).map((m) => [m.id, m]));
  const now = new Date();
  const upcoming = items.filter((it) => it.status === 'upcoming' && new Date(it.date) >= now).sort((a, b) => new Date(a.date) - new Date(b.date));
  const past = items.filter((it) => it.status !== 'upcoming' || new Date(it.date) < now).sort((a, b) => new Date(b.date) - new Date(a.date));

  content.innerHTML = `
    <div class="mb-8">
      <p class="text-white/40 text-sm mb-1">Encontros</p>
      <h1 class="text-3xl font-serif">Seus Encontros</h1>
    </div>
    ${renderEncounterRequestsCard(clientId)}
    <div id="meeting-request-card" class="mb-8"></div>
    ${usageSummary()}
    <p class="text-xs uppercase mb-4" style="color:var(--muted); letter-spacing:.12em;">Próximos</p>
    ${upcoming.length ? upcoming.map((it) => meetingCard(it, recordingByMeetingId)).join('') : card('<p class="text-sm" style="color:var(--muted);">Nenhum encontro agendado no momento — Nay avisa por aqui assim que marcar o próximo.</p>', 'mb-5')}

    ${past.length ? `
      <p class="text-xs uppercase mb-4 mt-10" style="color:var(--muted); letter-spacing:.12em;">Anteriores</p>
      ${past.map((it) => meetingCard(it, recordingByMeetingId)).join('')}
    ` : ''}
  `;

  wireEncounterRequestForms(content, render);
  renderMeetingRequestCard();
}

render();
