// Seus Encontros — every meeting/class scheduled with this client, upcoming
// and past. Production Data Migration — Batch 1: this page is fully
// converted off MockDB onto real Supabase tables (see
// shared/client-context.js's PRODUCTION_READY_PAGES). Real tables used:
// agenda_items (the meetings themselves, related_student_id = this client),
// meeting_recordings + google_meet_drive_artifacts (recording/transcript,
// both already RLS-scoped to her own client_id), meeting_requests
// (free-form "Precisa tirar uma dúvida?"), encounter_requests +
// encounter_request_proposed_times (the structured E1-E8 time-picking
// flow). AGENDA_TYPE_LABEL/AGENDA_STATUS_LABEL below are static
// presentation-only dictionaries (identical in demo and production, not
// per-client data) — kept as plain JS constants rather than an extra
// round-trip; encounter_defs is queried for the labels that do vary
// (name/purpose) instead of duplicating that content.
import { AGENDA_TYPE_LABEL, AGENDA_STATUS_LABEL } from '../shared/mock-db.js';
import { getCurrentClientContext } from '../shared/client-context.js';
import { supabase } from '../shared/supabase-client.js';
import { renderShell, card, formatDateTime, formatDate, toast, initClientSwitcher, isValidHttpUrl, externalLinkAttrs, renderClientRecordingBlock } from '../shared/ui.js';

const AGENDA_TYPE_ICON = {
  class: '🎓', individual_meeting: '👤', checkpoint: '☎️', group_meeting: '👥', online_event: '🌐', photo_review: '📸',
};
const AGENDA_STATUS_BADGE = { upcoming: 'badge-progress', completed: 'badge-completed', rescheduled: 'badge-locked', cancelled: 'badge-locked' };
const MEETING_STATUS_LABEL = {
  pending: ['Aguardando triagem', 'badge-locked'],
  assigned: ['Reunião agendada', 'badge-progress'],
  done: ['Concluída', 'badge-completed'],
};
// Only meeting-like types belong here — admin_task/deadline are Nay's
// internal operational items, never meant for the client to see.
const MEETING_TYPES = new Set(['class', 'individual_meeting', 'checkpoint', 'group_meeting', 'online_event', 'photo_review']);

let showRequestForm = false;

const __clientCtx = await getCurrentClientContext('../login.html', { page: 'encontros' });
if (!__clientCtx) throw new Error('not authorized');
const clientId = __clientCtx.clientId;
document.body.innerHTML = renderShell({ role: 'client', active: 'encontros.html', title: 'Encontros' });
initClientSwitcher();
const content = document.getElementById('app-content');

function usageSummary(items) {
  const encounters = items.filter((it) => it.type === 'individual_meeting');
  const checkpoints = items.filter((it) => it.type === 'checkpoint');
  const groupMeetings = items.filter((it) => it.type === 'group_meeting');
  if (!encounters.length && !checkpoints.length && !groupMeetings.length) return '';
  const completed = (arr) => arr.filter((it) => it.status === 'completed').length;
  const upcomingCount = checkpoints.filter((it) => it.status === 'upcoming').length;
  return card(`
    <p class="text-sm text-white/50 mb-4">Seus Encontros na Jornada</p>
    <div class="grid sm:grid-cols-3 gap-6">
      <div>
        <p class="text-xs text-white/30 mb-1">Encontros Individuais</p>
        <p class="text-2xl font-serif">${completed(encounters)} <span class="text-sm text-white/30">de ${encounters.length}</span></p>
      </div>
      ${checkpoints.length ? `
        <div>
          <p class="text-xs text-white/30 mb-1">Check-ins (30min)</p>
          <p class="text-2xl font-serif">${completed(checkpoints)} <span class="text-sm text-white/30">de ${checkpoints.length}</span></p>
          ${upcomingCount ? `<p class="text-xs mt-1" style="color:var(--gold);">${upcomingCount} agendado${upcomingCount === 1 ? '' : 's'}</p>` : ''}
        </div>
      ` : ''}
      <div>
        <p class="text-xs text-white/30 mb-1">Encontros em Grupo</p>
        <p class="text-2xl font-serif">${completed(groupMeetings)} <span class="text-sm text-white/30">realizados</span></p>
        <p class="text-xs text-white/20 mt-1">Ilimitados durante o programa</p>
      </div>
    </div>
  `, 'mb-8');
}

function recordingShapeFor(it, recordingRow, driveArtifacts) {
  // renderClientRecordingBlock expects {recording, lifecycleStatus}. A
  // completed meeting with either a real meeting_recordings row (Meet
  // auto-sync) or a manually-linked google_meet_drive_artifacts file
  // counts as having a recording; anything else shows the calm
  // "sem gravação" / "sendo preparada" copy that function already has.
  const lifecycleStatus = it.status === 'completed' ? 'finalizada' : 'em_andamento';
  if (recordingRow) {
    return {
      lifecycleStatus,
      recording: {
        recordingStatus: recordingRow.recording_status,
        transcriptStatus: recordingRow.transcript_status,
        recordingUrl: recordingRow.recording_url,
        transcriptUrl: recordingRow.transcript_url,
      },
    };
  }
  const linked = driveArtifacts.filter((a) => a.agenda_item_id === it.id);
  const video = linked.find((a) => a.artifact_type === 'recording');
  const doc = linked.find((a) => a.artifact_type === 'transcript');
  if (video || doc) {
    return {
      lifecycleStatus,
      recording: {
        recordingStatus: video ? 'disponivel' : 'sem_gravacao',
        transcriptStatus: doc ? 'disponivel' : 'nao_disponivel',
        recordingUrl: video?.web_view_link,
        transcriptUrl: doc?.web_view_link,
      },
    };
  }
  return { lifecycleStatus, recording: lifecycleStatus === 'finalizada' ? { recordingStatus: 'sem_gravacao' } : null };
}

function meetingCard(it, recordingByAgendaId, driveArtifacts) {
  const linkOk = it.status === 'upcoming' && isValidHttpUrl(it.online_link);
  const meetingShape = recordingShapeFor(it, recordingByAgendaId.get(it.id), driveArtifacts);
  return card(`
    <div class="flex items-start justify-between gap-4 mb-2">
      <div>
        <p class="text-xs" style="color:var(--terracotta);">${AGENDA_TYPE_ICON[it.type] || ''} ${AGENDA_TYPE_LABEL[it.type] || it.type}</p>
        <p class="text-lg font-serif mt-1">${it.title}</p>
      </div>
      <span class="badge ${AGENDA_STATUS_BADGE[it.status] || 'badge-locked'}">${AGENDA_STATUS_LABEL[it.status] || it.status}</span>
    </div>
    <p class="text-sm text-white/40 mb-1">${formatDateTime(it.item_date)}</p>
    ${it.topic ? `<p class="text-sm text-white/50 mb-4 max-w-xl">${it.topic}</p>` : '<div class="mb-4"></div>'}
    ${linkOk ? `<a ${externalLinkAttrs(it.online_link)} class="btn-primary inline-block" style="padding:9px 18px;font-size:12.5px;">Entrar na Reunião ↗</a>` : ''}
    ${meetingShape.recording ? `<div class="mt-4 pt-4" style="border-top:1px solid var(--line);">${renderClientRecordingBlock(meetingShape)}</div>` : ''}
  `, 'mb-5');
}

async function loadMeetingRequests() {
  const { data } = await supabase.from('meeting_requests').select('*').eq('client_id', clientId).order('created_at', { ascending: false });
  return data || [];
}

async function renderMeetingRequestCard() {
  const mount = document.getElementById('meeting-request-card');
  const requests = await loadMeetingRequests();

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
          const [label, badgeClass] = MEETING_STATUS_LABEL[r.status] || ['—', 'badge-locked'];
          const who = r.assigned_to === 'nay' ? ' · com a Nay' : r.assigned_to === 'assistant' ? ' · com a assistente' : '';
          return `
            <div class="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
              <div>
                <p class="text-sm">${r.reason}</p>
                <p class="text-xs" style="color:var(--muted);">${formatDate(r.created_at)}${who}</p>
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
  document.getElementById('send-request')?.addEventListener('click', async () => {
    const text = document.getElementById('request-reason').value.trim();
    if (!text) { toast('Escreva um breve motivo antes de enviar.', { tone: 'error' }); return; }
    const { error } = await supabase.from('meeting_requests').insert({ client_id: clientId, reason: text });
    if (error) { toast('Não foi possível enviar sua solicitação agora.', { tone: 'error' }); return; }
    showRequestForm = false;
    toast('Solicitação enviada! Nay ou a assistente vão entrar em contato.');
    renderMeetingRequestCard();
  });
}

// ---- structured E1-E8 encounter-scheduling requests (encounter_requests) ----
async function loadEncounterRequests() {
  const { data: requests } = await supabase.from('encounter_requests').select('*')
    .eq('client_id', clientId).not('status', 'in', '(confirmed,cancelled)');
  if (!requests || !requests.length) return [];

  const ids = requests.map((r) => r.id);
  const [{ data: times }, { data: defs }] = await Promise.all([
    supabase.from('encounter_request_proposed_times').select('*').in('encounter_request_id', ids).order('sort_order'),
    supabase.from('encounter_defs').select('number, name').in('number', requests.map((r) => r.encounter_number)),
  ]);
  const timesByRequest = new Map();
  (times || []).forEach((t) => {
    if (!timesByRequest.has(t.encounter_request_id)) timesByRequest.set(t.encounter_request_id, []);
    timesByRequest.get(t.encounter_request_id).push(t.proposed_time);
  });
  const nameByNumber = new Map((defs || []).map((d) => [d.number, d.name]));

  return requests.map((r) => ({ ...r, proposedTimes: timesByRequest.get(r.id) || [], encounterName: nameByNumber.get(r.encounter_number) || `Encontro ${r.encounter_number}` }));
}

async function renderEncounterRequestsCardReal() {
  const requests = await loadEncounterRequests();
  if (!requests.length) return '';
  return card(`
    <p class="text-sm mb-1" style="color:var(--gold);">Solicitações de Agendamento</p>
    <div class="divide-y mt-3" style="border-color:var(--line);">
      ${requests.map((r) => {
        const label = `E${r.encounter_number} — ${r.encounterName}`;
        if (r.status === 'awaiting_nay_confirmation') {
          return `
            <div class="py-4">
              <p class="text-sm font-medium mb-1">${label}</p>
              <p class="text-xs text-white/30">Horário escolhido: ${formatDateTime(r.selected_time)} — aguardando confirmação.</p>
            </div>
          `;
        }
        if (r.status === 'client_unavailable') {
          return `
            <div class="py-4">
              <p class="text-sm font-medium mb-1">${label}</p>
              <p class="text-xs text-white/30">Observação enviada — aguardando novas opções de horário.</p>
            </div>
          `;
        }
        return `
          <div class="py-4">
            <p class="text-sm font-medium mb-2">${label}</p>
            <div class="space-y-2 mb-3">
              ${r.proposedTimes.map((t) => `
                <label class="flex items-center gap-2 text-sm">
                  <input type="radio" name="time-${r.id}" value="${t}" />
                  ${formatDateTime(t)}
                </label>
              `).join('')}
            </div>
            <div class="flex items-center gap-3 flex-wrap mb-3">
              <button type="button" data-select-time="${r.id}" class="btn-primary" style="padding:8px 16px;font-size:12.5px;">Confirmar Horário</button>
              <button type="button" data-toggle-decline="${r.id}" class="btn-text">Nenhum horário funciona</button>
            </div>
            <div class="hidden" data-decline-form="${r.id}">
              <textarea data-decline-note="${r.id}" rows="2" class="field text-sm" placeholder="Quando você costuma estar disponível?"></textarea>
              <button type="button" data-send-decline="${r.id}" class="btn-ghost mt-2">Enviar Observação</button>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `, 'mb-8');
}

function wireEncounterRequestFormsReal(root, onDone) {
  root.querySelectorAll('[data-select-time]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.selectTime;
      const picked = root.querySelector(`input[name="time-${id}"]:checked`);
      if (!picked) { toast('Escolha um horário antes de confirmar.', { tone: 'error' }); return; }
      const { error } = await supabase.from('encounter_requests').update({
        status: 'awaiting_nay_confirmation', selected_time: picked.value, responded_at: new Date().toISOString(),
      }).eq('id', id);
      if (error) { toast('Não foi possível enviar agora.', { tone: 'error' }); return; }
      toast('Horário enviado — aguardando confirmação.');
      onDone();
    });
  });
  root.querySelectorAll('[data-toggle-decline]').forEach((btn) => {
    btn.addEventListener('click', () => {
      root.querySelector(`[data-decline-form="${btn.dataset.toggleDecline}"]`)?.classList.toggle('hidden');
    });
  });
  root.querySelectorAll('[data-send-decline]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.sendDecline;
      const note = root.querySelector(`[data-decline-note="${id}"]`)?.value || '';
      const { error } = await supabase.from('encounter_requests').update({
        status: 'client_unavailable', client_note: note.trim(), responded_at: new Date().toISOString(),
      }).eq('id', id);
      if (error) { toast('Não foi possível enviar agora.', { tone: 'error' }); return; }
      toast('Observação enviada.');
      onDone();
    });
  });
}

async function render() {
  const { data: itemsRaw } = await supabase.from('agenda_items').select('*').eq('related_student_id', clientId).order('item_date');
  const items = (itemsRaw || []).filter((it) => MEETING_TYPES.has(it.type));
  const ids = items.map((it) => it.id);

  const [{ data: recordingRows }, { data: driveArtifactsRaw }, encounterRequestsHtml] = await Promise.all([
    ids.length ? supabase.from('meeting_recordings').select('*').in('agenda_item_id', ids) : Promise.resolve({ data: [] }),
    ids.length ? supabase.from('google_meet_drive_artifacts').select('*').in('agenda_item_id', ids) : Promise.resolve({ data: [] }),
    renderEncounterRequestsCardReal(),
  ]);
  const recordingByAgendaId = new Map((recordingRows || []).map((r) => [r.agenda_item_id, r]));
  const driveArtifacts = driveArtifactsRaw || [];

  const now = new Date();
  const upcoming = items.filter((it) => it.status === 'upcoming' && new Date(it.item_date) >= now).sort((a, b) => new Date(a.item_date) - new Date(b.item_date));
  const past = items.filter((it) => it.status !== 'upcoming' || new Date(it.item_date) < now).sort((a, b) => new Date(b.item_date) - new Date(a.item_date));

  content.innerHTML = `
    <div class="mb-8">
      <p class="text-white/40 text-sm mb-1">Encontros</p>
      <h1 class="text-3xl font-serif">Seus Encontros</h1>
    </div>
    ${encounterRequestsHtml}
    <div id="meeting-request-card" class="mb-8"></div>
    ${usageSummary(items)}
    <p class="text-xs uppercase mb-4" style="color:var(--muted); letter-spacing:.12em;">Próximos</p>
    ${upcoming.length ? upcoming.map((it) => meetingCard(it, recordingByAgendaId, driveArtifacts)).join('') : card('<p class="text-sm" style="color:var(--muted);">Nenhum encontro agendado no momento — Nay avisa por aqui assim que marcar o próximo.</p>', 'mb-5')}

    ${past.length ? `
      <p class="text-xs uppercase mb-4 mt-10" style="color:var(--muted); letter-spacing:.12em;">Anteriores</p>
      ${past.map((it) => meetingCard(it, recordingByAgendaId, driveArtifacts)).join('')}
    ` : ''}
  `;

  wireEncounterRequestFormsReal(content, render);
  renderMeetingRequestCard();
}

render();
