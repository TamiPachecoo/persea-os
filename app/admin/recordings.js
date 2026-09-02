// Gravações — Nay's overview of every 1:1 meeting's Google Meet recording
// and transcript, across all clients. PROTOTYPE ONLY: nothing here talks to
// a real Google or Supabase integration — see docs/google-meet-integration.md
// for where that connects later. All data comes from MockDB's meeting
// methods (see mock-db.js "Meeting recordings & transcripts" section); this
// file is presentation only.
import {
  MockDB, RECORDING_STATUS_LABEL, RECORDING_STATUS_BADGE_CLASS,
  TRANSCRIPT_STATUS_LABEL, TRANSCRIPT_STATUS_BADGE_CLASS,
  MEETING_LIFECYCLE_LABEL, MEETING_LIFECYCLE_BADGE_CLASS, ASSIGNEE_LABEL,
} from '../shared/mock-db.js';
import { renderShell, card, badgeFromMaps, initialsAvatar, formatDateTime, isValidHttpUrl, externalLinkAttrs } from '../shared/ui.js';
import { requireProfile } from '../shared/supabase-auth.js';

if (!(await requireProfile('admin'))) throw new Error('not authorized');
document.body.innerHTML = renderShell({ role: 'admin', active: 'agenda.html', title: 'Gravações' });
const content = document.getElementById('app-content');

const FILTERS = [
  ['', 'Todas'],
  ['proximas', 'Próximas'],
  ['aguardando_gravacao', 'Aguardando gravação'],
  ['disponiveis', 'Disponíveis'],
  ['requer_atencao', 'Requer atenção'],
];
let activeFilter = '';

function renderSyncSummary() {
  const s = MockDB.getGoogleSyncStatus();
  return card(`
    <div class="flex items-center justify-between mb-3">
      <p class="text-sm text-white/50">Sincronização com Google</p>
      <span class="text-xs" style="color:var(--muted);">Demonstração — integração ainda não conectada</span>
    </div>
    <div class="grid sm:grid-cols-4 gap-4 text-sm">
      <div><p class="text-xs text-white/30 mb-1">Conta conectada</p><p>${s.connectedAccount}</p></div>
      <div><p class="text-xs text-white/30 mb-1">Última verificação</p><p>${s.lastCheckedAt ? formatDateTime(s.lastCheckedAt) : '—'}</p></div>
      <div><p class="text-xs text-white/30 mb-1">Próxima verificação</p><p>${s.nextCheckAt ? formatDateTime(s.nextCheckAt) : '—'}</p></div>
      <div><p class="text-xs text-white/30 mb-1">Status</p><p class="capitalize">${s.syncStatus.replace('_', ' ')} · ${s.attempts} tentativas</p></div>
    </div>
  `, 'mb-8');
}

// A plain <div> here, not an <a> — the row needs to both navigate to the
// detail page *and* contain a real nested link ("Meet ↗"), and nested
// anchors are invalid HTML (the browser silently splits the outer one,
// which is what was producing the stray line fragments). The inner Meet
// link carries data-stop-row-click so the delegated row-click handler
// below skips navigating when that's what was actually clicked.
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
          <p class="text-xs text-white/30 mt-0.5">${formatDateTime(m.date)} · ${ASSIGNEE_LABEL[m.assignedTo] || '—'}${meetLinkOk ? ` · <a ${externalLinkAttrs(m.onlineLink)} data-stop-row-click class="btn-text" style="display:inline;">Meet ↗</a>` : ''}</p>
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

function render() {
  const all = MockDB.getMeetingsOverview();
  const filtered = activeFilter ? all.filter((m) => m.filterBucket === activeFilter) : all;

  content.innerHTML = `
    <div class="mb-8">
      <p class="text-white/40 text-sm mb-1">Gravações</p>
      <h1 class="text-3xl font-serif">Reuniões, Gravações e Transcrições</h1>
      <p class="text-sm text-white/40 mt-2 max-w-2xl">Uma visão de todas as reuniões individuais, o status da gravação e da transcrição de cada uma, e o que ainda precisa de ação.</p>
    </div>

    ${renderSyncSummary()}

    ${card(`
      <div class="flex flex-wrap gap-2 mb-2">
        ${FILTERS.map(([key, label]) => `
          <button type="button" data-filter="${key}" class="btn-ghost ${activeFilter === key ? 'active' : ''}" style="padding:7px 14px;font-size:12px; ${activeFilter === key ? 'background:rgba(184,134,58,.18); border-color:var(--terracotta); color:var(--cream);' : ''}">${label}</button>
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
}

render();
