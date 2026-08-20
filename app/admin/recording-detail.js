// Reunião — Nay's detail view of one meeting's recording/transcript
// lifecycle. PROTOTYPE ONLY — see docs/google-meet-integration.md for
// where the real Google/Supabase integration connects later. The
// "Controles da demonstração" panel at the bottom exists purely to preview
// every state without a real backend; it's meant to be deleted wholesale
// once the real integration lands (see mock-db.js's devSimulate* methods).
import {
  MockDB, RECORDING_STATUS_LABEL, RECORDING_STATUS_BADGE_CLASS,
  TRANSCRIPT_STATUS_LABEL, TRANSCRIPT_STATUS_BADGE_CLASS,
  MEETING_LIFECYCLE_LABEL, MEETING_LIFECYCLE_BADGE_CLASS, ASSIGNEE_LABEL, ASSISTANT_PERSONA_LABEL,
} from '../shared/mock-db.js';
import {
  renderShell, card, toast, badgeFromMaps, formatDateTime, isValidHttpUrl, externalLinkAttrs,
  renderRecordingBlock, wireCopyLinkButtons, openRecordingLinksModal,
} from '../shared/ui.js';

const meetingId = new URLSearchParams(location.search).get('id');
document.body.innerHTML = renderShell({ role: 'admin', active: 'agenda.html' });
const content = document.getElementById('app-content');

function responsibleLabel(m) {
  const who = ASSIGNEE_LABEL[m.assignedTo] || '—';
  return m.assistantPersona ? `${who} (${ASSISTANT_PERSONA_LABEL[m.assistantPersona]})` : who;
}

function renderSyncPanel(m) {
  const s = m.recording.sync;
  return card(`
    <div class="flex items-center justify-between mb-3">
      <p class="text-sm text-white/50">Sincronização com Google</p>
      <span class="text-xs" style="color:var(--muted);">Demonstração — integração ainda não conectada</span>
    </div>
    <div class="grid sm:grid-cols-2 gap-4 text-sm">
      <div><p class="text-xs text-white/30 mb-1">Conta Google conectada</p><p>${s.googleAccount || '—'}</p></div>
      <div><p class="text-xs text-white/30 mb-1">Status da sincronização</p><p class="capitalize">${(s.syncStatus || '—').replace('_', ' ')}</p></div>
      <div><p class="text-xs text-white/30 mb-1">Última verificação</p><p>${s.lastCheckedAt ? formatDateTime(s.lastCheckedAt) : '—'}</p></div>
      <div><p class="text-xs text-white/30 mb-1">Próxima verificação</p><p>${s.nextCheckAt ? formatDateTime(s.nextCheckAt) : '—'}</p></div>
      <div><p class="text-xs text-white/30 mb-1">Tentativas</p><p>${s.attempts}</p></div>
    </div>
  `, 'mb-6');
}

function renderDevControls(m) {
  return `
    <div class="dev-preview-panel">
      <p class="text-xs uppercase tracking-[.12em] mb-3" style="color:var(--muted);">🧪 Controles da demonstração (dev, removível)</p>
      <div class="flex flex-wrap gap-2">
        <button type="button" data-sim="finished" class="btn-ghost" style="padding:6px 12px;font-size:11.5px;">Simular reunião finalizada</button>
        <button type="button" data-sim="processing" class="btn-ghost" style="padding:6px 12px;font-size:11.5px;">Simular processamento</button>
        <button type="button" data-sim="recording" class="btn-ghost" style="padding:6px 12px;font-size:11.5px;">Simular gravação disponível</button>
        <button type="button" data-sim="transcript" class="btn-ghost" style="padding:6px 12px;font-size:11.5px;">Simular transcrição disponível</button>
        <button type="button" data-sim="error" class="btn-ghost" style="padding:6px 12px;font-size:11.5px;">Simular erro de sincronização</button>
        <button type="button" data-sim="restore" class="btn-ghost" style="padding:6px 12px;font-size:11.5px;">Restaurar demonstração</button>
      </div>
    </div>
  `;
}

function render() {
  const m = MockDB.getMeetingDetail(meetingId);
  if (!m) {
    content.innerHTML = card('<p class="text-sm" style="color:var(--muted);">Reunião não encontrada.</p>');
    return;
  }
  const meetLinkOk = isValidHttpUrl(m.onlineLink);

  content.innerHTML = `
    <a href="recordings.html" class="btn-text mb-6 inline-block">&larr; Gravações</a>
    <div class="mb-8">
      <p class="text-white/40 text-sm mb-1">${m.programLabel} · <a href="client-detail.html?id=${m.relatedStudentId}" class="btn-text" style="display:inline;">${m.clientName}</a></p>
      <h1 class="text-3xl font-serif">${m.title}</h1>
    </div>

    ${m.recording.requiresAttention ? `
      <div class="mb-6" style="border-left:3px solid var(--terracotta); border-radius:4px;">${card(`
        <div class="flex items-center justify-between flex-wrap gap-3">
          <div>
            <p class="text-sm mb-1" style="color:var(--terracotta);">⚠ Requer atenção</p>
            <p class="text-sm text-white/50">${m.recording.attentionNote || 'Não foi possível localizar os arquivos automaticamente.'}</p>
          </div>
          <button type="button" id="resolve-attention" class="btn-ghost">Marcar como resolvido</button>
        </div>
      `)}</div>
    ` : ''}

    ${card(`
      <p class="text-sm text-white/50 mb-4">Informações da Reunião</p>
      <div class="grid sm:grid-cols-2 gap-4 text-sm mb-4">
        <div><p class="text-xs text-white/30 mb-1">Cliente</p><p>${m.clientName}</p></div>
        <div><p class="text-xs text-white/30 mb-1">Programa</p><p>${m.programLabel}</p></div>
        <div><p class="text-xs text-white/30 mb-1">Data e duração</p><p>${formatDateTime(m.date)} · ${m.durationMinutes || 60} min</p></div>
        <div><p class="text-xs text-white/30 mb-1">Responsável</p><p>${responsibleLabel(m)}</p></div>
      </div>
      <div class="flex items-center justify-between pt-3" style="border-top:1px solid var(--line);">
        <p class="text-xs text-white/30">Link do Google Meet</p>
        ${meetLinkOk ? `<a ${externalLinkAttrs(m.onlineLink)} class="btn-text">Abrir Meet ↗</a>` : '<span class="text-xs text-white/20">Sem link registrado</span>'}
      </div>
    `, 'mb-6')}

    ${card(`
      <div class="flex items-center justify-between mb-4 flex-wrap gap-3">
        <p class="text-sm text-white/50">Gravação e Transcrição</p>
        <div class="flex items-center gap-2">
          ${badgeFromMaps(m.lifecycleStatus, MEETING_LIFECYCLE_LABEL, MEETING_LIFECYCLE_BADGE_CLASS)}
          ${badgeFromMaps(m.recording.recordingStatus, RECORDING_STATUS_LABEL, RECORDING_STATUS_BADGE_CLASS)}
          ${m.recording.transcriptStatus !== 'nao_aplicavel' && m.recording.recordingStatus !== 'erro' ? badgeFromMaps(m.recording.transcriptStatus, TRANSCRIPT_STATUS_LABEL, TRANSCRIPT_STATUS_BADGE_CLASS) : ''}
        </div>
      </div>
      <div id="recording-block">${renderRecordingBlock(m, { showCopyLink: true })}</div>
      <div class="pt-4 mt-4" style="border-top:1px solid var(--line);">
        <button type="button" id="edit-links" class="btn-ghost">Editar Links (manual)</button>
      </div>
    `, 'mb-6')}

    ${renderSyncPanel(m)}
    ${renderDevControls(m)}
  `;

  wireCopyLinkButtons(content.querySelector('#recording-block'));

  content.querySelector('#edit-links')?.addEventListener('click', () => {
    openRecordingLinksModal(m, { onSaved: render });
  });
  content.querySelector('#resolve-attention')?.addEventListener('click', () => {
    MockDB.clearMeetingAttention(m.id);
    toast('Marcado como resolvido.');
    render();
  });

  content.querySelectorAll('[data-sim]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const action = btn.dataset.sim;
      if (action === 'finished') MockDB.devSimulateMeetingFinished(m.id);
      if (action === 'processing') MockDB.devSimulateProcessing(m.id);
      if (action === 'recording') MockDB.devSimulateRecordingAvailable(m.id);
      if (action === 'transcript') MockDB.devSimulateTranscriptAvailable(m.id);
      if (action === 'error') MockDB.devSimulateSyncError(m.id);
      if (action === 'restore') MockDB.devRestoreMeetingRecording(m.id);
      toast('Estado da demonstração atualizado.');
      render();
    });
  });
}

render();
