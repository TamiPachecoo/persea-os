// Gravações — Nay's overview of every 1:1 meeting's Google Meet recording
// and transcript, across all clients. The meeting-by-meeting list below
// (renderSyncSummary's fake status card, meetingRow, FILTERS) is still
// PROTOTYPE ONLY — MockDB data, no real Google/Supabase behind it (see
// docs/12-google-meet-integration.md). The "Descobertos no Google Drive"
// card above it is real: google-drive-meet-files' actual discovery
// results, straight from Supabase.
import {
  MockDB, RECORDING_STATUS_LABEL, RECORDING_STATUS_BADGE_CLASS,
  TRANSCRIPT_STATUS_LABEL, TRANSCRIPT_STATUS_BADGE_CLASS,
  MEETING_LIFECYCLE_LABEL, MEETING_LIFECYCLE_BADGE_CLASS, ASSIGNEE_LABEL,
} from '../shared/mock-db.js';
import { renderShell, card, toast, badgeFromMaps, initialsAvatar, formatDateTime, isValidHttpUrl, externalLinkAttrs, functionErrorMessage } from '../shared/ui.js';
import { getCurrentProfile, requireProfile } from '../shared/supabase-auth.js';
import { supabase } from '../shared/supabase-client.js';
import { loadDriveArtifacts, linkSessionToClient, sessionKeyFor, unlinkArtifact } from '../shared/drive-artifacts-model.js';

if (!(await requireProfile('admin'))) throw new Error('not authorized');
document.body.innerHTML = renderShell({ role: 'admin', active: 'agenda.html', title: 'Gravações' });
const content = document.getElementById('app-content');

// Real client list for the "vincular a..." dropdown — every client, not
// just non-demo, since most of today's roster is still flagged is_demo
// (see clients_is_demo_flag) and this feature needs to be testable against
// what actually exists right now, not just the one real client.
async function loadClientOptions() {
  const { data } = await supabase.from('clients').select('id, full_name').order('full_name');
  return data || [];
}

const ARTIFACT_TYPE_ICON = { recording: '🎥', transcript: '📝', unknown: '📁' };

const ARTIFACT_TYPE_TEXT_LABEL = { recording: 'Gravação', transcript: 'Transcrição', unknown: 'Pasta da sessão' };
const ENCOUNTER_SLOT_LABEL = { e1: 'E1', e2: 'E2', e3: 'E3', e4: 'E4', e5: 'E5', e6: 'E6', e7: 'E7', e8: 'E8' };
function slotOptionsHtml() {
  return `
    <option value="">Sem encontro específico</option>
    ${Object.entries(ENCOUNTER_SLOT_LABEL).map(([slug, label]) => `<option value="${slug}">${label}</option>`).join('')}
    <option value="checkpoint">Checkpoint (avulso)</option>
  `;
}
function slotLabelFor(a) {
  if (a.is_checkpoint) return 'Checkpoint';
  if (a.encounter_slug) return ENCOUNTER_SLOT_LABEL[a.encounter_slug] || a.encounter_slug;
  return null;
}

// Confirming a link applies it to every currently-unmatched file sharing
// this session's key (recording + transcript + folder), not just the one
// row clicked — see linkSessionToClient. Surfacing the type label plainly
// (rather than relying on the icon/raw filename alone) is the direct fix
// for a real reported confusion: linking "the folder" row looked like
// linking "the meeting," while the actual recording/transcript rows sat
// right below it still showing "sem cliente vinculada."
function driveArtifactRow(a, clients) {
  const isMatched = !!a.client_id;
  return `
    <div class="flex items-center justify-between flex-wrap gap-3 py-3 border-b border-white/5 last:border-0">
      <div class="flex-1 min-w-[240px]">
        <p class="text-sm font-medium">${ARTIFACT_TYPE_ICON[a.artifact_type] || '📁'} ${ARTIFACT_TYPE_TEXT_LABEL[a.artifact_type] || 'Arquivo'} <span class="text-white/30 font-normal">· ${a.name}</span></p>
        <p class="text-xs text-white/30 mt-0.5">
          ${formatDateTime(a.discovered_at)} descoberto
          ${isMatched ? ` · vinculado a ${a.clients?.full_name || '—'}${slotLabelFor(a) ? ` · ${slotLabelFor(a)}` : ''}${a.match_confidence === 'manual' ? ' (manual)' : ' (automático)'}` : ' · sem cliente vinculada'}
        </p>
      </div>
      <div class="flex items-center gap-2 flex-wrap">
        <a ${externalLinkAttrs(a.web_view_link)} class="btn-text">Abrir no Drive ↗</a>
        ${isMatched ? `
          <button type="button" data-unlink-artifact="${a.id}" class="btn-text">Desvincular</button>
        ` : `
          <select data-link-client-select="${a.id}" class="field text-sm" style="width:auto;">
            <option value="">Vincular a...</option>
            ${clients.map((c) => `<option value="${c.id}">${c.full_name}</option>`).join('')}
          </select>
          <select data-link-slot-select="${a.id}" class="field text-sm" style="width:auto;">${slotOptionsHtml()}</select>
          <button type="button" data-link-artifact="${a.id}" data-session-key="${sessionKeyFor(a.name)}" class="btn-ghost" style="padding:6px 12px;font-size:12px;">Confirmar</button>
        `}
      </div>
    </div>
  `;
}
// Quick search (no fields) always checks the last 30 days — the common
// case, since most links happen soon after a session. "Busca avançada"
// exists specifically for the exception this page couldn't handle at all
// before: something older than 30 days, or found by typing part of the
// client/session name instead of scanning a list. Both date_from/date_to
// and keyword are real filters on Google's own side (see
// google-drive-meet-files), not just cosmetic — a wider date range or a
// keyword actually changes what Drive returns, up to 25 results per search.
function renderDriveArtifactsCard({ artifacts, error }, clients) {
  return card(`
    <div class="flex items-center justify-between mb-2 flex-wrap gap-2">
      <div class="flex items-center gap-2">
        <p class="text-sm text-white/50">Descobertos no Google Drive</p>
        ${artifacts.length ? `<span class="text-xs" style="color:var(--muted);">${artifacts.length}</span>` : ''}
      </div>
      <div class="flex items-center gap-2">
        <button type="button" id="search-drive-artifacts" class="btn-ghost" style="padding:6px 12px;font-size:12px;">Buscar Gravações (30 dias)</button>
        <button type="button" id="toggle-drive-search" class="btn-text">Busca avançada</button>
      </div>
    </div>
    <div class="hidden mb-4" id="drive-search-form" style="padding:14px; border:1px solid var(--line); border-radius:8px;">
      <p class="text-xs text-white/30 mb-3">Procure algo mais antigo que 30 dias, ou por uma palavra do nome do arquivo (ex.: nome da cliente).</p>
      <div class="grid sm:grid-cols-3 gap-3 items-end">
        <div>
          <label class="text-xs text-white/40 block mb-1">De</label>
          <input type="date" id="drive-search-from" class="field text-sm" />
        </div>
        <div>
          <label class="text-xs text-white/40 block mb-1">Até</label>
          <input type="date" id="drive-search-to" class="field text-sm" />
        </div>
        <div>
          <label class="text-xs text-white/40 block mb-1">Palavra-chave</label>
          <input type="text" id="drive-search-keyword" class="field text-sm" placeholder="Ex.: nome da cliente" />
        </div>
      </div>
      <button type="button" id="run-drive-search" class="btn-primary mt-3" style="padding:8px 18px;font-size:12.5px;">Buscar</button>
    </div>
    <p class="text-xs text-white/20 mb-3 max-w-2xl">Gravações e transcrições que o Google Meet salva automaticamente no Drive conectado. Confirmar em qualquer uma vincula a gravação, a transcrição e a pasta da mesma sessão juntas, nunca atribuídas sozinhas sem certeza.</p>
    ${error ? `<p class="text-sm" style="color:var(--terracotta);">Não foi possível carregar: ${error}</p>`
      : artifacts.length ? artifacts.map((a) => driveArtifactRow(a, clients)).join('')
      : '<p class="text-sm" style="color:var(--gold);">Nada descoberto ainda. Clique em "Buscar Gravações" ou use a busca avançada.</p>'}
  `, 'mb-8');
}

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
    <div class="grid sm:grid-cols-4 gap-4 text-sm mb-6">
      <div><p class="text-xs text-white/30 mb-1">Conta conectada</p><p>${s.connectedAccount}</p></div>
      <div><p class="text-xs text-white/30 mb-1">Última verificação</p><p>${s.lastCheckedAt ? formatDateTime(s.lastCheckedAt) : '—'}</p></div>
      <div><p class="text-xs text-white/30 mb-1">Próxima verificação</p><p>${s.nextCheckAt ? formatDateTime(s.nextCheckAt) : '—'}</p></div>
      <div><p class="text-xs text-white/30 mb-1">Status</p><p class="capitalize">${s.syncStatus.replace('_', ' ')} · ${s.attempts} tentativas</p></div>
    </div>
    <div class="pt-4" style="border-top:1px solid var(--line);">
      <p class="text-xs uppercase mb-3" style="color:var(--muted); letter-spacing:.1em;">✓ Decidido: forma de compartilhamento</p>
      <p class="text-xs text-white/30">Link público ("qualquer pessoa com o link pode assistir"). Na prática já é como o Google Meet compartilha tudo que salva na pasta de gravações da Nay por padrão, então não muda nada do lado dela. Verificação manual (Nay/assistente confirma cada gravação vinculando-a à cliente certa, na seção "Descobertos no Google Drive" acima) continua sendo o que impede uma gravação de ser atribuída à pessoa errada. O link ser público não significa que o sistema atribui ela sozinho.</p>
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

async function render() {
  const all = MockDB.getMeetingsOverview();
  const filtered = activeFilter ? all.filter((m) => m.filterBucket === activeFilter) : all;
  const [driveArtifacts, clientOptions] = await Promise.all([loadDriveArtifacts(), loadClientOptions()]);

  content.innerHTML = `
    <div class="mb-8">
      <p class="text-white/40 text-sm mb-1">Gravações</p>
      <h1 class="text-3xl font-serif">Reuniões, Gravações e Transcrições</h1>
      <p class="text-sm text-white/40 mt-2 max-w-2xl">Uma visão de todas as reuniões individuais, o status da gravação e da transcrição de cada uma, e o que ainda precisa de ação.</p>
    </div>

    ${renderDriveArtifactsCard(driveArtifacts, clientOptions)}

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

  async function runDriveSearch(btn, defaultLabel, body) {
    btn.disabled = true; btn.textContent = 'Buscando...';
    const { data, error } = await supabase.functions.invoke('google-drive-meet-files', { body });
    if (error || data?.error) {
      toast(await functionErrorMessage(data, error), { tone: 'error' });
      btn.disabled = false; btn.textContent = defaultLabel;
      return;
    }
    const found = (data.matched?.length || 0) + (data.unmatched?.length || 0);
    toast(found ? `${found} arquivo${found === 1 ? '' : 's'} encontrado${found === 1 ? '' : 's'}.` : 'Nenhum arquivo encontrado nesse período/busca.');
    render();
  }
  content.querySelector('#search-drive-artifacts')?.addEventListener('click', (e) => {
    runDriveSearch(e.target, 'Buscar Gravações (30 dias)', {});
  });
  content.querySelector('#toggle-drive-search')?.addEventListener('click', () => {
    content.querySelector('#drive-search-form').classList.toggle('hidden');
  });
  content.querySelector('#run-drive-search')?.addEventListener('click', (e) => {
    const from = content.querySelector('#drive-search-from').value;
    const to = content.querySelector('#drive-search-to').value;
    const keyword = content.querySelector('#drive-search-keyword').value.trim();
    if ((from && !to) || (!from && to)) {
      toast('Preencha as duas datas, ou nenhuma.', { tone: 'error' });
      return;
    }
    const body = {};
    if (from && to) { body.date_from = new Date(from + 'T00:00:00').toISOString(); body.date_to = new Date(to + 'T23:59:59').toISOString(); }
    if (keyword) body.keyword = keyword;
    if (!body.date_from && !body.keyword) {
      toast('Preencha um período ou uma palavra-chave.', { tone: 'error' });
      return;
    }
    runDriveSearch(e.target, 'Buscar', body);
  });
  content.querySelectorAll('[data-link-artifact]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const select = content.querySelector(`[data-link-client-select="${btn.dataset.linkArtifact}"]`);
      if (!select.value) { toast('Selecione uma cliente primeiro.', { tone: 'error' }); return; }
      const slotValue = content.querySelector(`[data-link-slot-select="${btn.dataset.linkArtifact}"]`).value;
      const profile = await getCurrentProfile();
      const { error } = await linkSessionToClient(btn.dataset.sessionKey, select.value, profile.id, {
        encounterSlug: slotValue && slotValue !== 'checkpoint' ? slotValue : null,
        isCheckpoint: slotValue === 'checkpoint',
      });
      if (error) { toast('Erro ao vincular.', { tone: 'error' }); return; }
      toast('Sessão (gravação, transcrição e pasta) vinculada à cliente.');
      render();
    });
  });
  content.querySelectorAll('[data-unlink-artifact]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const { error } = await unlinkArtifact(btn.dataset.unlinkArtifact);
      if (error) { toast('Erro ao desvincular.', { tone: 'error' }); return; }
      toast('Vínculo removido.');
      render();
    });
  });
}

render();
