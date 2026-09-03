// Gravações (assistente) — only the meetings assigned to her, same status
// vocabulary Nay sees, none of the admin-only sync/OAuth internals. See
// admin/recordings.js for the full (Nay-facing) version of this list and
// mock-db.js's "Meeting recordings & transcripts" section for the data.
import {
  MockDB, RECORDING_STATUS_LABEL, RECORDING_STATUS_BADGE_CLASS,
  TRANSCRIPT_STATUS_LABEL, TRANSCRIPT_STATUS_BADGE_CLASS,
  MEETING_LIFECYCLE_LABEL, MEETING_LIFECYCLE_BADGE_CLASS,
} from '../shared/mock-db.js';
import { renderShell, card, toast, badgeFromMaps, initialsAvatar, formatDateTime, isValidHttpUrl, externalLinkAttrs } from '../shared/ui.js';
import { requireProfile } from '../shared/supabase-auth.js';

if (!(await requireProfile('assistant'))) throw new Error('not authorized');
document.body.innerHTML = renderShell({ role: 'assistant', active: 'agenda.html', title: 'Recomendações de Conteúdo' });
const content = document.getElementById('app-content');

const FILTERS = [
  ['', 'Todas'],
  ['proximas', 'Próximas'],
  ['aguardando_gravacao', 'Aguardando gravação'],
  ['disponiveis', 'Disponíveis'],
  ['requer_atencao', 'Requer atenção'],
];
let activeFilter = '';

// A plain <div> here, not an <a> — see admin/recordings.js's meetingRow for
// why (nested anchors are invalid HTML and were producing stray line
// fragments in the layout).
function meetingRow(m) {
  const meetLinkOk = isValidHttpUrl(m.onlineLink);
  return `
    <div data-open-meeting="${m.id}" class="block py-4 border-b border-white/5 last:border-0 hover:bg-white/5 -mx-2 px-2 rounded-lg transition-colors cursor-pointer">
      <div class="flex items-start gap-3 flex-wrap">
        ${initialsAvatar(m.clientName)}
        <div class="flex-1 min-w-[220px]">
          <div class="flex items-center gap-2 flex-wrap">
            <p class="font-medium text-sm">${m.clientName}</p>
            <span class="badge badge-locked" style="font-size:9px;">${m.programLabel}</span>
          </div>
          <p class="text-sm font-serif mt-1">${m.title}</p>
          <p class="text-xs text-white/30 mt-0.5">${formatDateTime(m.date)}${meetLinkOk ? ` · <a ${externalLinkAttrs(m.onlineLink)} data-stop-row-click class="btn-text" style="display:inline;">Meet ↗</a>` : ''}</p>
        </div>
        <div class="flex flex-wrap items-center gap-2 justify-end" style="min-width:280px;">
          ${badgeFromMaps(m.lifecycleStatus, MEETING_LIFECYCLE_LABEL, MEETING_LIFECYCLE_BADGE_CLASS)}
          ${badgeFromMaps(m.recording.recordingStatus, RECORDING_STATUS_LABEL, RECORDING_STATUS_BADGE_CLASS)}
          ${m.recording.transcriptStatus !== 'nao_aplicavel' && m.recording.recordingStatus !== 'erro' ? badgeFromMaps(m.recording.transcriptStatus, TRANSCRIPT_STATUS_LABEL, TRANSCRIPT_STATUS_BADGE_CLASS) : ''}
        </div>
      </div>
      <p class="text-xs mt-2" style="color:${m.filterBucket === 'requer_atencao' ? 'var(--terracotta)' : 'var(--muted)'};">${m.nextAction}</p>
    </div>
  `;
}

// Nay's written notes/asks for the assistant — bidirectional, real replies
// (see getAssistantMessages/sendAssistantMessage/markAssistantMessageRead).
// This used to live on assistant/queue.js (the Painel, since removed) —
// ported here since this page's own title, "Recomendações de Conteúdo",
// always meant both halves (Nay's notes + recordings needing review), even
// though only the recordings half was actually implemented here before.
function messageRow(m) {
  const clientName = m.clientId ? (MockDB.getClient(m.clientId)?.fullName || '') : '';
  const fromNay = m.from === 'nay';
  return `
    <div class="py-3 border-b border-white/5 last:border-0">
      <div class="flex items-center justify-between gap-2 mb-1">
        <p class="text-xs" style="color:${fromNay ? 'var(--gold)' : 'var(--terracotta)'};">💬 ${fromNay ? 'Nay' : 'Você'}${clientName ? ` · sobre ${clientName}` : ''}</p>
        <span class="text-xs text-white/20">${formatDateTime(m.at)}</span>
      </div>
      <p class="text-sm text-white/70">${m.text}</p>
      <div class="flex items-center gap-3 mt-2">
        ${m.route ? `<a href="${m.route}" class="btn-text">Abrir →</a>` : ''}
        ${fromNay && !m.read ? `<button data-mark-read="${m.id}" class="btn-text">Marcar como lida</button>` : ''}
        ${fromNay ? `<button data-reply-to="${m.id}" class="btn-text">Responder</button>` : ''}
      </div>
      <div class="hidden mt-2" data-reply-form="${m.id}">
        <form data-reply-submit="${m.id}" class="flex items-start gap-2">
          <textarea name="text" rows="2" class="field" placeholder="Sua resposta para a Nay..." required></textarea>
          <button type="submit" class="btn-ghost" style="white-space:nowrap;">Enviar</button>
        </form>
      </div>
    </div>
  `;
}
function renderMessagesCard() {
  const messages = MockDB.getAssistantMessages();
  if (!messages.length) return '';
  const unread = messages.filter((m) => m.from === 'nay' && !m.read).length;
  return card(`
    <div class="flex items-center justify-between mb-3">
      <p class="text-sm text-white/50">Notas da Nay</p>
      ${unread ? `<span class="badge badge-progress">${unread} não lida${unread === 1 ? '' : 's'}</span>` : ''}
    </div>
    ${messages.slice(0, 8).map(messageRow).join('')}
  `, 'mb-6');
}

function render() {
  const all = MockDB.getMeetingsOverview({ assignedTo: 'assistant' });
  const filtered = activeFilter ? all.filter((m) => m.filterBucket === activeFilter) : all;

  content.innerHTML = `
    <a href="agenda.html" class="btn-text mb-6 inline-block">&larr; Agenda</a>
    <div class="mb-8">
      <p class="text-white/40 text-sm mb-1">Recomendações de Conteúdo</p>
      <h1 class="text-3xl font-serif">Gravações para Revisar</h1>
      <p class="text-sm text-white/40 mt-2 max-w-2xl">Reuniões atribuídas a você — status da gravação, da transcrição, e o que ainda falta fazer antes de preparar algo para a cliente.</p>
    </div>

    ${renderMessagesCard()}
    ${card(`
      <div class="flex flex-wrap gap-2 mb-2">
        ${FILTERS.map(([key, label]) => `
          <button type="button" data-filter="${key}" class="btn-ghost" style="padding:7px 14px;font-size:12px; ${activeFilter === key ? 'background:rgba(184,134,58,.18); border-color:var(--terracotta); color:var(--cream);' : ''}">${label}</button>
        `).join('')}
      </div>
    `, 'mb-6')}

    ${card(`
      <div class="flex items-center justify-between mb-2">
        <p class="text-sm text-white/50">${filtered.length} ${filtered.length === 1 ? 'reunião' : 'reuniões'}</p>
      </div>
      ${filtered.length ? filtered.map(meetingRow).join('') : '<p class="text-sm text-white/20 py-6">Nenhuma reunião nesse filtro.</p>'}
    `)}
  `;

  content.querySelectorAll('[data-filter]').forEach((btn) => {
    btn.addEventListener('click', () => { activeFilter = btn.dataset.filter; render(); });
  });
  content.querySelectorAll('[data-open-meeting]').forEach((row) => {
    row.addEventListener('click', (e) => {
      if (e.target.closest('[data-stop-row-click]')) return;
      location.href = `recording-detail.html?id=${row.dataset.openMeeting}`;
    });
  });
  content.querySelectorAll('[data-mark-read]').forEach((btn) => {
    btn.addEventListener('click', () => { MockDB.markAssistantMessageRead(btn.dataset.markRead); render(); });
  });
  content.querySelectorAll('[data-reply-to]').forEach((btn) => {
    btn.addEventListener('click', () => {
      content.querySelector(`[data-reply-form="${btn.dataset.replyTo}"]`).classList.toggle('hidden');
    });
  });
  content.querySelectorAll('[data-reply-submit]').forEach((form) => {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const text = new FormData(e.target).get('text');
      if (!text || !text.trim()) return;
      const original = MockDB.getAssistantMessages().find((m) => m.id === form.dataset.replySubmit);
      MockDB.sendAssistantMessage({ from: 'assistant', clientId: original ? original.clientId : null, text: text.trim() });
      toast('Resposta enviada para a Nay.');
      render();
    });
  });
}

render();
