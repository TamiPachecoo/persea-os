import { MockDB, TIER_PHASES, MOOD_SCALE } from '../shared/mock-db.js';
import { renderShell, card, statusBadge, formatDateTime, formatDate, toast } from '../shared/ui.js';

const TIER_LABEL = { premium: 'Premium', essential: 'Essential' };
const REQUEST_STATUS_LABEL = {
  pending: ['Aguardando triagem', 'badge-locked'],
  assigned: ['Agendada', 'badge-progress'],
  done: ['Concluída', 'badge-completed'],
};
const ASSIGNEE_LABEL = { nay: 'Nay', assistant: 'Assistente' };

document.body.innerHTML = renderShell({ role: 'admin', active: 'dashboard.html', title: 'Painel Admin' });
const content = document.getElementById('app-content');

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

    ${renderRequestsCard()}
    ${renderMoodCard()}

    ${card(`
      <p class="text-sm text-white/50 mb-4">Clientes</p>
      <div class="divide-y" style="border-color:var(--line);">
        ${clients.map((c) => `
          <a href="client-detail.html?id=${c.id}" class="flex items-center justify-between py-3 hover:bg-white/5 -mx-2 px-2 rounded-lg transition-colors">
            <div>
              <p class="font-medium">${c.fullName}</p>
              <p class="text-xs text-white/30">${c.email} · ${TIER_LABEL[c.tier] || c.tier} · Fase: ${TIER_PHASES[c.tier][c.phaseIndex]}</p>
            </div>
            <div class="flex items-center gap-4">
              <span class="text-xs text-white/40">Jornada ${c.journeyPct}% · Tarefas ${c.homeworkPct}%</span>
              ${statusBadge(c.status)}
            </div>
          </a>
        `).join('')}
      </div>
    `)}
  `;

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
