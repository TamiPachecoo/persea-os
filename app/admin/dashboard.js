import { MockDB } from '../shared/mock-db.js';
import { renderShell, card, statusBadge, formatDateTime } from '../shared/ui.js';

document.body.innerHTML = renderShell({ role: 'admin', active: 'dashboard.html', title: 'Painel Admin' });

const client = MockDB.getClient();
const journey = MockDB.getJourney();
const homeworkPct = MockDB.homeworkCompletionPct();
const playbook = MockDB.getPlaybook();

document.getElementById('app-content').innerHTML = `
  <div class="grid md:grid-cols-3 gap-6 mb-8">
    ${card(`
      <p class="text-sm text-white/50 mb-2">Clientes</p>
      <p class="text-3xl font-serif mb-1">1</p>
      <p class="text-xs text-white/30">1 ativo</p>
    `)}
    ${card(`
      <p class="text-sm text-white/50 mb-2">Próxima Reunião</p>
      <p class="text-lg font-medium">${journey.upcomingMeeting.title}</p>
      <p class="text-xs text-white/30 mt-1">${formatDateTime(journey.upcomingMeeting.date)} · ${client.fullName}</p>
    `)}
    ${card(`
      <p class="text-sm text-white/50 mb-2">Requer Atenção</p>
      <p class="text-lg font-medium">${playbook.status === 'draft' ? '1 cliente' : '0 clientes'}</p>
      <p class="text-xs text-white/30 mt-1">${playbook.status === 'draft' ? 'Rascunho de playbook aguardando publicação' : 'Tudo em dia'}</p>
    `)}
  </div>

  ${card(`
    <p class="text-sm text-white/50 mb-4">Clientes</p>
    <a href="client-detail.html" class="flex items-center justify-between py-3 border-b border-white/5 hover:bg-white/5 -mx-2 px-2 rounded-lg transition-colors">
      <div>
        <p class="font-medium">${client.fullName}</p>
        <p class="text-xs text-white/30">${client.email}</p>
      </div>
      <div class="flex items-center gap-4">
        <span class="text-xs text-white/40">Tarefas ${homeworkPct}%</span>
        ${statusBadge(client.status)}
      </div>
    </a>
  `)}
`;
