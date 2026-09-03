// Reunião (assistente) — deliberately narrower than the admin version
// (admin/recording-detail.js): meeting info, recording/transcript status
// and links, a manual-links editor, and a way to flag Nay's attention.
// No sync/OAuth panel, no dev simulation controls, no technical logs —
// those stay admin-only by design.
import {
  MockDB, RECORDING_STATUS_LABEL, RECORDING_STATUS_BADGE_CLASS,
  TRANSCRIPT_STATUS_LABEL, TRANSCRIPT_STATUS_BADGE_CLASS,
  MEETING_LIFECYCLE_LABEL, MEETING_LIFECYCLE_BADGE_CLASS,
} from '../shared/mock-db.js';
import {
  renderShell, card, toast, badgeFromMaps, formatDateTime, isValidHttpUrl, externalLinkAttrs,
  renderRecordingBlock, wireCopyLinkButtons, openRecordingLinksModal, openModal,
} from '../shared/ui.js';
import { requireProfile } from '../shared/supabase-auth.js';

if (!(await requireProfile('assistant'))) throw new Error('not authorized');
const meetingId = new URLSearchParams(location.search).get('id');
document.body.innerHTML = renderShell({ role: 'assistant', active: 'agenda.html' });
const content = document.getElementById('app-content');

function openFlagModal(m) {
  const { el, close } = openModal({
    title: 'Sinalizar para a Nay',
    bodyHtml: `
      <form id="flag-form" class="space-y-4">
        <div>
          <label class="text-xs text-white/40 block mb-1">O que a Nay precisa saber?</label>
          <textarea name="note" rows="3" class="field" placeholder="Ex.: a cliente perguntou pela gravação e não encontrei o link." required></textarea>
        </div>
        <button type="submit" class="btn-primary" style="padding:9px 18px;font-size:12.5px;">Sinalizar</button>
      </form>
    `,
  });
  el.querySelector('#flag-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const note = new FormData(e.target).get('note');
    MockDB.flagMeetingForAttention(m.id, note);
    close();
    toast('Sinalizado para a Nay.');
    render();
  });
}

function render() {
  const m = MockDB.getMeetingDetail(meetingId);
  if (!m) {
    content.innerHTML = card('<p class="text-sm" style="color:var(--muted);">Reunião não encontrada.</p>');
    return;
  }
  const meetLinkOk = isValidHttpUrl(m.onlineLink);

  content.innerHTML = `
    <a href="recordings.html" class="btn-text mb-6 inline-block">&larr; Recomendações de Conteúdo</a>
    <div class="mb-8">
      <p class="text-white/40 text-sm mb-1">${m.programLabel} · <a href="client-workspace.html?id=${m.relatedStudentId}" class="btn-text" style="display:inline;">${m.clientName}</a></p>
      <h1 class="text-3xl font-serif">${m.title}</h1>
    </div>

    ${m.recording.requiresAttention ? `
      <div class="mb-6" style="border-left:3px solid var(--terracotta); border-radius:4px;">${card(`
        <p class="text-sm" style="color:var(--terracotta);">⚠ Já sinalizado para a Nay</p>
        ${m.recording.attentionNote ? `<p class="text-sm text-white/50 mt-1">${m.recording.attentionNote}</p>` : ''}
      `)}</div>
    ` : ''}

    ${card(`
      <p class="text-sm text-white/50 mb-4">Informações da Reunião</p>
      <div class="grid sm:grid-cols-2 gap-4 text-sm mb-4">
        <div><p class="text-xs text-white/30 mb-1">Cliente</p><p>${m.clientName}</p></div>
        <div><p class="text-xs text-white/30 mb-1">Programa</p><p>${m.programLabel}</p></div>
        <div><p class="text-xs text-white/30 mb-1">Data e duração</p><p>${formatDateTime(m.date)} · ${m.durationMinutes || 60} min</p></div>
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
      <div class="flex flex-wrap items-center gap-3 pt-4 mt-4" style="border-top:1px solid var(--line);">
        <button type="button" id="edit-links" class="btn-ghost">Adicionar link manualmente</button>
        ${!m.recording.requiresAttention ? '<button type="button" id="flag-attention" class="btn-text">Sinalizar para a Nay</button>' : ''}
      </div>
    `)}
  `;

  wireCopyLinkButtons(content.querySelector('#recording-block'));
  content.querySelector('#edit-links')?.addEventListener('click', () => openRecordingLinksModal(m, { onSaved: render }));
  content.querySelector('#flag-attention')?.addEventListener('click', () => openFlagModal(m));
}

render();
