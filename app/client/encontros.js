// Seus Encontros — every meeting/class scheduled with this client, upcoming
// and past, reading the same agendaItems Nay schedules from her Agenda (see
// admin/agenda.js) — not a separate meetings list of its own. Individual
// meetings additionally carry a Google Meet recording/transcript bundle
// (PROTOTYPE — see docs/google-meet-integration.md); only ever this
// client's own, via MockDB.getClientMeetingsWithRecording's clientId filter.
import { MockDB, getActiveClientId, AGENDA_TYPE_LABEL, AGENDA_STATUS_LABEL } from '../shared/mock-db.js';
import { renderShell, card, formatDateTime, initClientSwitcher, isValidHttpUrl, externalLinkAttrs, renderClientRecordingBlock } from '../shared/ui.js';

const AGENDA_TYPE_ICON = {
  class: '🎓', individual_meeting: '👤', group_meeting: '👥', online_event: '🌐', photo_review: '📸',
};
const AGENDA_STATUS_BADGE = { upcoming: 'badge-progress', completed: 'badge-completed', rescheduled: 'badge-locked', cancelled: 'badge-locked' };

const clientId = getActiveClientId();
document.body.innerHTML = renderShell({ role: 'client', active: 'encontros.html', title: 'Encontros' });
initClientSwitcher();
const content = document.getElementById('app-content');

// Only meeting-like types belong here — admin_task/deadline are Nay's
// internal operational items, never meant for the client to see.
const MEETING_TYPES = new Set(['class', 'individual_meeting', 'group_meeting', 'online_event', 'photo_review']);

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
    <p class="text-xs uppercase mb-4" style="color:var(--muted); letter-spacing:.12em;">Próximos</p>
    ${upcoming.length ? upcoming.map((it) => meetingCard(it, recordingByMeetingId)).join('') : card('<p class="text-sm" style="color:var(--muted);">Nenhum encontro agendado no momento — Nay avisa por aqui assim que marcar o próximo.</p>', 'mb-5')}

    ${past.length ? `
      <p class="text-xs uppercase mb-4 mt-10" style="color:var(--muted); letter-spacing:.12em;">Anteriores</p>
      ${past.map((it) => meetingCard(it, recordingByMeetingId)).join('')}
    ` : ''}
  `;
}

render();
