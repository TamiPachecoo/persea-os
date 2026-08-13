import { MockDB, TIER_PHASES, MOOD_SCALE, ONBOARDING_STAGE_LABEL, AGENDA_TYPES, AGENDA_TYPE_LABEL, AGENDA_STATUSES, AGENDA_STATUS_LABEL } from '../shared/mock-db.js';
import { renderShell, card, statusBadge, formatDateTime, formatDate, toast, openModal } from '../shared/ui.js';

const AGENDA_TYPE_ICON = {
  class: '🎓', individual_meeting: '👤', group_meeting: '👥',
  online_event: '🌐', admin_task: '🗂️', deadline: '⏰',
};

const TIER_LABEL = { premium: 'Premium', essential: 'Essential' };
const REQUEST_STATUS_LABEL = {
  pending: ['Aguardando triagem', 'badge-locked'],
  assigned: ['Agendada', 'badge-progress'],
  done: ['Concluída', 'badge-completed'],
};
const ASSIGNEE_LABEL = { nay: 'Nay', assistant: 'Assistente' };

document.body.innerHTML = renderShell({ role: 'admin', active: 'dashboard.html', title: 'Painel Admin' });
const content = document.getElementById('app-content');

const AGENDA_BUCKETS = [
  ['hoje', 'Hoje'],
  ['proximosDias', 'Próximos Dias'],
  ['estaSemana', 'Esta Semana'],
  ['pendencias', 'Pendências'],
];

function agendaItemRow(it) {
  const who = it.relatedStudentId ? (MockDB.getClient(it.relatedStudentId)?.fullName || '') : (it.relatedGroupLabel || '');
  return `
    <button type="button" data-agenda-item="${it.id}" class="w-full text-left py-2.5 border-b border-white/5 last:border-0 hover:bg-white/5 -mx-1 px-1 rounded transition-colors">
      <p class="text-xs" style="color:var(--terracotta);">${AGENDA_TYPE_ICON[it.type] || ''} ${AGENDA_TYPE_LABEL[it.type]}</p>
      <p class="text-sm font-medium mt-0.5">${it.title}</p>
      <p class="text-xs mt-0.5 text-white/30">${who ? who + ' · ' : ''}${formatDateTime(it.date)}</p>
    </button>
  `;
}

// Keeps the dashboard card itself compact (title/type/who/when only, per the
// spec) — everything else (topic, notes, link, status) lives in the modal
// opened by clicking a row.
function renderAgendaSection() {
  const buckets = MockDB.getAgendaBuckets();
  return card(`
    <div class="flex items-center justify-between mb-5">
      <p class="text-sm text-white/50">Agenda da Semana</p>
      <button id="new-agenda-item" class="btn-ghost">+ Novo Item</button>
    </div>
    <div class="grid md:grid-cols-4 gap-6">
      ${AGENDA_BUCKETS.map(([key, label]) => `
        <div>
          <p class="text-xs uppercase mb-3" style="color:var(--muted); letter-spacing:.12em;">${label} <span style="opacity:.6;">(${buckets[key].length})</span></p>
          <div>
            ${buckets[key].length ? buckets[key].map(agendaItemRow).join('') : '<p class="text-xs text-white/20">Nada por aqui.</p>'}
          </div>
        </div>
      `).join('')}
    </div>
  `, 'mb-8');
}

function openAgendaModal(itemId) {
  const item = itemId ? MockDB.getAgendaItem(itemId) : null;
  const isNew = !item;
  const data = item || {
    type: 'admin_task', title: '', date: new Date().toISOString(), status: 'upcoming',
    relatedStudentId: null, relatedGroupLabel: '', topic: '', prepNotes: '',
    generalNotes: '', onlineLink: '', followUpNotes: '',
  };
  const clients = MockDB.listClients();

  const { el, close } = openModal({
    title: isNew ? 'Novo Item da Agenda' : 'Editar Item da Agenda',
    bodyHtml: `
      <form id="agenda-form" class="space-y-4">
        <div class="grid sm:grid-cols-2 gap-4">
          <div>
            <label class="text-xs text-white/40 block mb-1">Título</label>
            <input name="title" class="field" value="${data.title}" required />
          </div>
          <div>
            <label class="text-xs text-white/40 block mb-1">Tipo</label>
            <select name="type" class="field">
              ${AGENDA_TYPES.map((t) => `<option value="${t}" ${data.type === t ? 'selected' : ''}>${AGENDA_TYPE_LABEL[t]}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="grid sm:grid-cols-2 gap-4">
          <div>
            <label class="text-xs text-white/40 block mb-1">Data e Hora</label>
            <input name="date" type="datetime-local" class="field" value="${(data.date || '').slice(0, 16)}" required />
          </div>
          <div>
            <label class="text-xs text-white/40 block mb-1">Status</label>
            <select name="status" class="field">
              ${AGENDA_STATUSES.map((s) => `<option value="${s}" ${data.status === s ? 'selected' : ''}>${AGENDA_STATUS_LABEL[s]}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="grid sm:grid-cols-2 gap-4">
          <div>
            <label class="text-xs text-white/40 block mb-1">Cliente Relacionada</label>
            <select name="relatedStudentId" class="field">
              <option value="">— Nenhuma —</option>
              ${clients.map((c) => `<option value="${c.id}" ${data.relatedStudentId === c.id ? 'selected' : ''}>${c.fullName}</option>`).join('')}
            </select>
          </div>
          <div>
            <label class="text-xs text-white/40 block mb-1">Grupo / Turma</label>
            <input name="relatedGroupLabel" class="field" value="${data.relatedGroupLabel || ''}" placeholder="Ex.: Q&amp;A Mensal" />
          </div>
        </div>
        <div>
          <label class="text-xs text-white/40 block mb-1">Tópico</label>
          <input name="topic" class="field" value="${data.topic || ''}" />
        </div>
        <div>
          <label class="text-xs text-white/40 block mb-1">Link da Reunião Online</label>
          <input name="onlineLink" class="field" value="${data.onlineLink || ''}" placeholder="https://..." />
        </div>
        <div>
          <label class="text-xs text-white/40 block mb-1">Notas de Preparação</label>
          <textarea name="prepNotes" rows="2" class="field">${data.prepNotes || ''}</textarea>
        </div>
        <div>
          <label class="text-xs text-white/40 block mb-1">Notas Gerais</label>
          <textarea name="generalNotes" rows="2" class="field">${data.generalNotes || ''}</textarea>
        </div>
        <div>
          <label class="text-xs text-white/40 block mb-1">Notas de Follow-up</label>
          <textarea name="followUpNotes" rows="2" class="field">${data.followUpNotes || ''}</textarea>
        </div>
        <div class="flex justify-end pt-2">
          <button type="submit" class="btn-primary" style="padding:9px 18px;font-size:12.5px;">${isNew ? 'Criar Item' : 'Salvar Alterações'}</button>
        </div>
      </form>
    `,
  });

  el.querySelector('#agenda-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const payload = {
      title: fd.get('title'), type: fd.get('type'), date: fd.get('date'), status: fd.get('status'),
      relatedStudentId: fd.get('relatedStudentId') || null, relatedGroupLabel: fd.get('relatedGroupLabel') || null,
      topic: fd.get('topic'), onlineLink: fd.get('onlineLink'), prepNotes: fd.get('prepNotes'),
      generalNotes: fd.get('generalNotes'), followUpNotes: fd.get('followUpNotes'),
    };
    if (isNew) MockDB.createAgendaItem(payload);
    else MockDB.updateAgendaItem(item.id, payload);
    close();
    toast(isNew ? 'Item adicionado à agenda.' : 'Alterações salvas.');
    render();
  });
}

function renderRequestsCard() {
  const requests = MockDB.listAllMeetingRequests();
  const pending = requests.filter((r) => r.status !== 'done');
  return card(`
    <div class="flex items-center justify-between mb-4">
      <p class="text-sm text-white/50">Solicitações de Reunião</p>
      <span class="text-xs" style="color:var(--muted);">${pending.length} em aberto</span>
    </div>
    ${pending.length ? `
      <div class="space-y-4">
        ${pending.map((r) => `
          <div class="py-3 border-b border-white/5 last:border-0">
            <div class="flex items-start justify-between gap-4">
              <div>
                <p class="font-medium text-sm">${r.clientName}</p>
                <p class="text-sm mt-1">${r.reason}</p>
                <p class="text-xs mt-1" style="color:var(--muted);">${formatDate(r.createdAt)}</p>
              </div>
              <span class="badge ${REQUEST_STATUS_LABEL[r.status][1]}">${REQUEST_STATUS_LABEL[r.status][0]}</span>
            </div>
            <div class="flex items-center gap-2 mt-3">
              ${r.status === 'pending' ? `
                <button data-assign="${r.clientId}:${r.id}:nay" class="btn-ghost">Atribuir à Nay</button>
                <button data-assign="${r.clientId}:${r.id}:assistant" class="btn-ghost">Atribuir à Assistente</button>
              ` : `
                <span class="text-xs" style="color:var(--muted);">Com ${ASSIGNEE_LABEL[r.assignedTo]}</span>
                <button data-resolve="${r.clientId}:${r.id}" class="btn-text">Marcar como concluída</button>
              `}
            </div>
          </div>
        `).join('')}
      </div>
    ` : '<p class="text-sm" style="color:var(--muted);">Nenhuma solicitação em aberto.</p>'}
  `, 'mb-8');
}

function renderOnboardingSummaryCard() {
  const s = MockDB.getOnboardingSummary();
  if (!s.stillOnboarding && !s.readyForPhase1) return '';
  return card(`
    <div class="flex items-center justify-between mb-4">
      <p class="text-sm text-white/50">Onboarding de Clientes</p>
      <span class="text-xs" style="color:var(--muted);">${s.stillOnboarding} em andamento</span>
    </div>
    <div class="grid sm:grid-cols-3 gap-4 text-sm">
      <div><p class="text-2xl font-serif">${s.awaitingContractPrep}</p><p class="text-white/40 text-xs mt-1">Aguardando Contrato</p></div>
      <div><p class="text-2xl font-serif">${s.awaitingSignature}</p><p class="text-white/40 text-xs mt-1">Aguardando Assinatura</p></div>
      <div><p class="text-2xl font-serif">${s.readyForPhase1}</p><p class="text-white/40 text-xs mt-1">Prontas para a Fase 1</p></div>
    </div>
  `, 'mb-8');
}

function renderMoodCard() {
  const stats = MockDB.getGlobalMoodStats();
  if (!stats.count) return card(`<p class="text-sm" style="color:var(--muted);">Ainda sem registros de sentimento dos clientes.</p>`, 'mb-8');
  const avgEmoji = MOOD_SCALE.find((m) => m.value === Math.round(stats.avg))?.emoji || '😐';
  return card(`
    <div class="flex items-center justify-between mb-4">
      <p class="text-sm text-white/50">Sentimento dos Clientes</p>
      <span class="text-xs" style="color:var(--muted);">${stats.count} registro${stats.count === 1 ? '' : 's'}</span>
    </div>
    <div class="flex items-center gap-4 mb-5">
      <span style="font-size:2.2rem;">${avgEmoji}</span>
      <div>
        <p class="text-2xl font-serif">${stats.avg.toFixed(1)} / 5</p>
        <p class="text-xs" style="color:var(--muted);">Média geral entre todos os clientes</p>
      </div>
    </div>
    <div class="space-y-2">
      ${MOOD_SCALE.map((m) => {
        const n = stats.distribution[m.value] || 0;
        const pct = stats.count ? Math.round((n / stats.count) * 100) : 0;
        return `
          <div class="flex items-center gap-3">
            <span style="width:22px;">${m.emoji}</span>
            <div class="progress-track flex-1"><div class="progress-fill" style="width:${pct}%;"></div></div>
            <span class="text-xs w-10 text-right" style="color:var(--muted);">${n}</span>
          </div>
        `;
      }).join('')}
    </div>
  `, 'mb-8');
}

function render() {
  const clients = MockDB.listClients();

  const needsAttention = clients.filter((c) => {
    const pb = MockDB.getPlaybook(c.id);
    const latest = pb.versions[pb.versions.length - 1];
    return latest && latest.status === 'draft';
  });

  const nextMeeting = clients
    .map((c) => ({ client: c, meeting: MockDB.getJourney(c.id).upcomingMeeting }))
    .sort((a, b) => new Date(a.meeting.date) - new Date(b.meeting.date))[0];

  const pendingRequests = MockDB.listAllMeetingRequests().filter((r) => r.status === 'pending');

  content.innerHTML = `
    <div class="grid md:grid-cols-3 gap-6 mb-8">
      ${card(`
        <p class="text-sm text-white/50 mb-2">Clientes</p>
        <p class="text-3xl font-serif mb-1">${clients.length}</p>
        <p class="text-xs text-white/30">${clients.filter((c) => c.status === 'active').length} ativos</p>
      `)}
      ${card(`
        <p class="text-sm text-white/50 mb-2">Próxima Reunião</p>
        <p class="text-lg font-medium">${nextMeeting.meeting.title}</p>
        <p class="text-xs text-white/30 mt-1">${formatDateTime(nextMeeting.meeting.date)} · ${nextMeeting.client.fullName}</p>
      `)}
      ${card(`
        <p class="text-sm text-white/50 mb-2">Requer Atenção</p>
        <p class="text-lg font-medium">${needsAttention.length + pendingRequests.length} pendência${needsAttention.length + pendingRequests.length === 1 ? '' : 's'}</p>
        <p class="text-xs text-white/30 mt-1">${needsAttention.length} playbook(s) em rascunho · ${pendingRequests.length} solicitação(ões) de reunião</p>
      `)}
    </div>

    ${renderAgendaSection()}
    ${renderOnboardingSummaryCard()}
    ${renderRequestsCard()}
    ${renderMoodCard()}

    ${card(`
      <p class="text-sm text-white/50 mb-4">Clientes</p>
      <div class="divide-y" style="border-color:var(--line);">
        ${clients.map((c) => {
          const metaLine = c.status === 'onboarding'
            ? `Onboarding: ${ONBOARDING_STAGE_LABEL[c.onboardingStage]}`
            : `${TIER_LABEL[c.tier] || c.tier} · Fase: ${TIER_PHASES[c.tier][c.phaseIndex]}`;
          return `
          <a href="client-detail.html?id=${c.id}" class="flex items-center justify-between py-3 hover:bg-white/5 -mx-2 px-2 rounded-lg transition-colors">
            <div>
              <p class="font-medium">${c.fullName}</p>
              <p class="text-xs text-white/30">${c.email} · ${metaLine}</p>
            </div>
            <div class="flex items-center gap-4">
              ${c.status === 'onboarding' ? '' : `<span class="text-xs text-white/40">Jornada ${c.journeyPct}% · Tarefas ${c.homeworkPct}%</span>`}
              ${statusBadge(c.status)}
            </div>
          </a>
        `;
        }).join('')}
      </div>
    `)}
  `;

  content.querySelector('#new-agenda-item')?.addEventListener('click', () => openAgendaModal(null));
  content.querySelectorAll('[data-agenda-item]').forEach((btn) => {
    btn.addEventListener('click', () => openAgendaModal(btn.dataset.agendaItem));
  });
  content.querySelectorAll('[data-assign]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const [clientId, requestId, assignee] = btn.dataset.assign.split(':');
      MockDB.assignMeetingRequest(clientId, requestId, assignee);
      toast(`Reunião atribuída a ${ASSIGNEE_LABEL[assignee]}.`);
      render();
    });
  });
  content.querySelectorAll('[data-resolve]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const [clientId, requestId] = btn.dataset.resolve.split(':');
      MockDB.resolveMeetingRequest(clientId, requestId);
      toast('Solicitação marcada como concluída.');
      render();
    });
  });
}

render();
