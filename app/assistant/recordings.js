// Gravações (assistente) — only the meetings assigned to her, same status
// vocabulary Nay sees, none of the admin-only sync/OAuth internals. See
// admin/recordings.js for the full (Nay-facing) version of this list and
// mock-db.js's "Meeting recordings & transcripts" section for the data.
import {
  MockDB, RECORDING_STATUS_LABEL, RECORDING_STATUS_BADGE_CLASS,
  TRANSCRIPT_STATUS_LABEL, TRANSCRIPT_STATUS_BADGE_CLASS,
  MEETING_LIFECYCLE_LABEL, MEETING_LIFECYCLE_BADGE_CLASS,
} from '../shared/mock-db.js';
import { renderShell, card, toast, badgeFromMaps, initialsAvatar, formatDateTime, isValidHttpUrl, externalLinkAttrs, functionErrorMessage } from '../shared/ui.js';
import { getCurrentProfile, requireProfile } from '../shared/supabase-auth.js';
import { supabase } from '../shared/supabase-client.js';
import { loadDriveArtifacts, linkSessionToClient, sessionKeyFor, unlinkArtifact } from '../shared/drive-artifacts-model.js';

if (!(await requireProfile('assistant'))) throw new Error('not authorized');
document.body.innerHTML = renderShell({ role: 'assistant', active: 'agenda.html', title: 'Recomendações de Conteúdo' });
const content = document.getElementById('app-content');

// Real client list for the "vincular a..." dropdown — every client, not
// just non-demo, since most of today's roster is still flagged is_demo
// and this feature needs to be testable against what actually exists.
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
// Quick search (no fields) always checks the last 30 days. "Busca
// avançada" covers what that can't: something older, or found by typing
// part of the client/session name instead of scanning a list — both are
// real filters on Google's own side (see google-drive-meet-files), not
// cosmetic.
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
    <p class="text-xs text-white/20 mb-3 max-w-2xl">Gravações e transcrições que o Google Meet salva automaticamente no Drive conectado. Confirmar em qualquer uma vincula a gravação, a transcrição e a pasta da mesma sessão juntas.</p>
    ${error ? `<p class="text-sm" style="color:var(--terracotta);">Não foi possível carregar: ${error}</p>`
      : artifacts.length ? artifacts.map((a) => driveArtifactRow(a, clients)).join('')
      : '<p class="text-sm" style="color:var(--gold);">Nada descoberto ainda. Clique em "Buscar Gravações" ou use a busca avançada.</p>'}
  `, 'mb-6');
}

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

async function render() {
  const all = MockDB.getMeetingsOverview({ assignedTo: 'assistant' });
  const filtered = activeFilter ? all.filter((m) => m.filterBucket === activeFilter) : all;
  const [driveArtifacts, clientOptions] = await Promise.all([loadDriveArtifacts(), loadClientOptions()]);

  content.innerHTML = `
    <a href="agenda.html" class="btn-text mb-6 inline-block">&larr; Agenda</a>
    <div class="mb-8">
      <p class="text-white/40 text-sm mb-1">Recomendações de Conteúdo</p>
      <h1 class="text-3xl font-serif">Gravações para Revisar</h1>
      <p class="text-sm text-white/40 mt-2 max-w-2xl">Reuniões atribuídas a você — status da gravação, da transcrição, e o que ainda falta fazer antes de preparar algo para a cliente.</p>
    </div>

    ${renderDriveArtifactsCard(driveArtifacts, clientOptions)}
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
