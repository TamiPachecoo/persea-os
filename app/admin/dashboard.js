import { MockDB, TIER_PHASES } from '../shared/mock-db.js';
import { renderShell, card, statusBadge, formatDateTime } from '../shared/ui.js';

const TIER_LABEL = { premium: 'Premium', essential: 'Essential' };

document.body.innerHTML = renderShell({ role: 'admin', active: 'dashboard.html', title: 'Painel Admin' });

const clients = MockDB.listClients();

const needsAttention = clients.filter((c) => {
  const pb = MockDB.getPlaybook(c.id);
  const latest = pb.versions[pb.versions.length - 1];
  return latest && latest.status === 'draft';
});

const nextMeeting = clients
  .map((c) => ({ client: c, meeting: MockDB.getJourney(c.id).upcomingMeeting }))
  .sort((a, b) => new Date(a.meeting.date) - new Date(b.meeting.date))[0];

document.getElementById('app-content').innerHTML = `
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
      <p class="text-lg font-medium">${needsAttention.length} cliente${needsAttention.length === 1 ? '' : 's'}</p>
      <p class="text-xs text-white/30 mt-1">${needsAttention.length ? 'Rascunho de playbook aguardando publicação' : 'Tudo em dia'}</p>
    `)}
  </div>

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
