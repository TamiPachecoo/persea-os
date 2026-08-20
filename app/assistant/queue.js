// Painel — the assistant's overall view, same idea as Nay's own Painel:
// what's new (clients who just started onboarding), what Nay needs from her
// specifically (notes/recommendations, two-way), and her prioritized queue
// of everything else assigned to her.
import { MockDB, AGENDA_TYPE_LABEL, ASSISTANT_PERSONA_LABEL, PROGRAM_LABEL } from '../shared/mock-db.js';
import { renderShell, card, formatDateTime, toast, openModal } from '../shared/ui.js';

const AGENDA_TYPE_ICON = {
  class: '🎓', individual_meeting: '👤', group_meeting: '👥',
  online_event: '🌐', admin_task: '🗂️', deadline: '⏰', photo_review: '📸',
};

document.body.innerHTML = renderShell({ role: 'assistant', active: 'queue.html', title: 'Painel' });
const content = document.getElementById('app-content');

function newClientRow(c) {
  return `
    <a href="client-workspace.html?id=${c.id}" class="flex items-center justify-between py-2.5 hover:bg-white/5 -mx-2 px-2 rounded-lg transition-colors">
      <div>
        <p class="text-sm font-medium">${c.fullName}</p>
        <p class="text-xs text-white/30">${c.program ? PROGRAM_LABEL[c.program] : 'Sem programa definido'} · ${c.infoSubmitted ? 'Informações recebidas' : 'Aguardando informações'}</p>
      </div>
      <span class="badge badge-progress">Onboarding</span>
    </a>
  `;
}
function renderNewClients() {
  const clients = MockDB.getNewClientsForAssistant();
  if (!clients.length) return '';
  return card(`
    <div class="flex items-center justify-between mb-3">
      <p class="text-sm text-white/50">Novos Clientes</p>
      <span class="text-xs" style="color:var(--muted);">${clients.length}</span>
    </div>
    <div class="divide-y" style="border-color:var(--line);">${clients.map(newClientRow).join('')}</div>
  `, 'mb-8');
}

// Recomendações de Conteúdo da Nay — one unified feed of everything Nay
// wants her to look at: written notes/asks (bidirectional — a reply is a
// real reply, see getAssistantMessages) plus meeting recordings that need
// review before she can prep something for that client. Replaces the old
// standalone "Gravações e Transcrições" link — same underlying data
// (getMeetingsOverview, scoped to her own assignments), just surfaced as
// what it actually is: content Nay is pointing her at.
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
function recordingRow(m) {
  return `
    <a href="recording-detail.html?id=${m.id}" class="block py-3 border-b border-white/5 last:border-0 hover:bg-white/5 -mx-2 px-2 rounded-lg transition-colors">
      <div class="flex items-center justify-between gap-2 mb-1">
        <p class="text-xs" style="color:var(--gold);">🎥 Gravação · ${m.clientName}</p>
        <span class="text-xs text-white/20">${formatDateTime(m.date)}</span>
      </div>
      <p class="text-sm text-white/70">${m.title}</p>
      <p class="text-xs mt-1" style="color:var(--terracotta);">${m.nextAction}</p>
    </a>
  `;
}
function renderContentRecommendations() {
  const messages = MockDB.getAssistantMessages();
  const unread = messages.filter((m) => m.from === 'nay' && !m.read).length;
  const recordings = MockDB.getMeetingsOverview({ assignedTo: 'assistant' }).filter((m) => m.filterBucket === 'requer_atencao').slice(0, 3);
  if (!messages.length && !recordings.length) {
    return card(`
      <p class="text-sm text-white/50 mb-3">Recomendações de Conteúdo da Nay</p>
      <p class="text-xs text-white/20">Nada por aqui ainda.</p>
    `, 'mb-8');
  }
  return card(`
    <div class="flex items-center justify-between mb-3">
      <p class="text-sm text-white/50">Recomendações de Conteúdo da Nay</p>
      ${unread ? `<span class="badge badge-progress">${unread} não lida${unread === 1 ? '' : 's'}</span>` : ''}
    </div>
    ${recordings.map(recordingRow).join('')}
    ${messages.slice(0, 8).map(messageRow).join('')}
  `, 'mb-8');
}

const BUCKETS = [
  ['hoje', 'Hoje'],
  ['proximosDias', 'Próximos Dias'],
  ['estaSemana', 'Esta Semana'],
  ['pendencias', 'Pendências'],
];

function itemRow(it) {
  const who = it.relatedStudentId ? (MockDB.getClient(it.relatedStudentId)?.fullName || '') : (it.relatedGroupLabel || '');
  return `
    <button type="button" data-item="${it.id}" class="w-full text-left py-2.5 border-b border-white/5 last:border-0 hover:bg-white/5 -mx-1 px-1 rounded transition-colors">
      <div class="flex items-center justify-between gap-2">
        <p class="text-xs" style="color:var(--terracotta);">${AGENDA_TYPE_ICON[it.type] || ''} ${AGENDA_TYPE_LABEL[it.type]}</p>
        ${it.assistantPersona ? `<span class="badge badge-progress" style="font-size:9px;">${ASSISTANT_PERSONA_LABEL[it.assistantPersona]}</span>` : ''}
      </div>
      <p class="text-sm font-medium mt-0.5">${it.title}</p>
      <p class="text-xs mt-0.5 text-white/30">${who ? who + ' · ' : ''}${formatDateTime(it.date)}</p>
    </button>
  `;
}

function meetingRequestRow(r) {
  return `
    <div class="py-3 border-b border-white/5 last:border-0">
      <p class="font-medium text-sm">${r.clientName}</p>
      <p class="text-sm mt-1">${r.reason}</p>
      <div class="flex items-center gap-2 mt-3">
        <button data-resolve-request="${r.clientId}:${r.id}" class="btn-text">Marcar como concluída</button>
      </div>
    </div>
  `;
}

function openItemModal(id) {
  const it = MockDB.getAgendaItem(id);
  if (!it) return;
  const clientName = it.relatedStudentId ? (MockDB.getClient(it.relatedStudentId)?.fullName || '') : (it.relatedGroupLabel || '');
  const { el, close } = openModal({
    title: it.title,
    bodyHtml: `
      <div class="space-y-4 text-sm">
        <div><p class="text-white/40 text-xs mb-1">Quando</p><p>${formatDateTime(it.date)}</p></div>
        ${clientName ? `<div><p class="text-white/40 text-xs mb-1">Cliente / Turma</p><p>${clientName}</p></div>` : ''}
        ${it.topic ? `<div><p class="text-white/40 text-xs mb-1">Tópico</p><p>${it.topic}</p></div>` : ''}
        ${it.assigneeNotes ? `<div><p class="text-white/40 text-xs mb-1">Notas da Nay para Você</p><p>${it.assigneeNotes}</p></div>` : ''}
        ${it.onlineLink ? `<div><p class="text-white/40 text-xs mb-1">Link</p><a href="${it.onlineLink}" target="_blank" rel="noopener noreferrer" class="btn-text">${it.onlineLink}</a></div>` : ''}
        <div class="flex items-center gap-3 pt-2" style="border-top:1px solid var(--line);">
          <button id="complete-item" class="btn-primary" style="padding:9px 18px;font-size:12.5px;">Marcar como Concluído</button>
          <button id="handoff-item" class="btn-ghost">Encaminhar para a Nay</button>
        </div>
      </div>
    `,
  });
  el.querySelector('#complete-item').addEventListener('click', () => {
    MockDB.updateAgendaItem(it.id, { status: 'completed' });
    close();
    toast('Marcado como concluído.');
    render();
  });
  el.querySelector('#handoff-item').addEventListener('click', () => {
    MockDB.updateAgendaItem(it.id, { assignedTo: 'nay', assistantPersona: null });
    close();
    toast('Encaminhado para a Nay.');
    render();
  });
}

function render() {
  const buckets = MockDB.getAgendaBuckets((it) => it.assignedTo === 'assistant');
  const requests = MockDB.listAllMeetingRequests().filter((r) => r.assignedTo === 'assistant' && r.status !== 'done');
  const totalUpcoming = Object.values(buckets).reduce((s, arr) => s + arr.length, 0);

  content.innerHTML = `
    <div class="mb-6">
      <p class="text-white/40 text-sm mb-1">Painel</p>
      <h1 class="text-3xl font-serif">Sua Visão Geral</h1>
    </div>
    ${renderNewClients()}
    ${renderContentRecommendations()}
    ${card(`
      <div class="flex items-center justify-between mb-5">
        <p class="text-sm text-white/50">Suas Pendências</p>
        <span class="text-xs" style="color:var(--muted);">${totalUpcoming} pendência${totalUpcoming === 1 ? '' : 's'}</span>
      </div>
      ${totalUpcoming ? `
        <div class="grid md:grid-cols-4 gap-6">
          ${BUCKETS.map(([key, label]) => `
            <div>
              <p class="text-xs uppercase mb-3" style="color:var(--muted); letter-spacing:.12em;">${label} <span style="opacity:.6;">(${buckets[key].length})</span></p>
              <div>${buckets[key].length ? buckets[key].map(itemRow).join('') : '<p class="text-xs text-white/20">Nada por aqui.</p>'}</div>
            </div>
          `).join('')}
        </div>
      ` : '<p class="text-sm" style="color:var(--gold);">Nada pendente atribuído a você agora.</p>'}
    `, 'mb-8')}
    ${requests.length ? card(`
      <p class="text-sm text-white/50 mb-4">Solicitações de Reunião</p>
      ${requests.map(meetingRequestRow).join('')}
    `, 'mb-8') : ''}
  `;

  content.querySelectorAll('[data-item]').forEach((btn) => {
    btn.addEventListener('click', () => openItemModal(btn.dataset.item));
  });
  content.querySelectorAll('[data-resolve-request]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const [clientId, requestId] = btn.dataset.resolveRequest.split(':');
      MockDB.resolveMeetingRequest(clientId, requestId);
      toast('Solicitação marcada como concluída.');
      render();
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
