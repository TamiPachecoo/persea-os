// Assistant's client list — one row per client with a quick read on what's
// still open in her checklist (see getAssistantChecklist in mock-db.js),
// linking into the per-client workspace where she actually does the work
// (that page orders the same checklist by priority — see client-workspace.js).
import { MockDB, PROGRAM_LABEL } from '../shared/mock-db.js';
import { renderShell, card } from '../shared/ui.js';

document.body.innerHTML = renderShell({ role: 'assistant', active: 'clients.html', title: 'Clientes' });
const content = document.getElementById('app-content');

function clientRow(c) {
  const checklist = MockDB.getAssistantChecklist(c.id);
  const openCount = checklist.filter((i) => !i.done).length;
  const urgent = checklist.some((i) => i.urgent);
  return `
    <a href="client-workspace.html?id=${c.id}" class="flex items-center justify-between py-3 hover:bg-white/5 -mx-2 px-2 rounded-lg transition-colors" ${urgent ? 'style="border-left:3px solid var(--terracotta); padding-left:9px;"' : ''}>
      <div>
        <p class="font-medium">${c.fullName}</p>
        <p class="text-xs text-white/30">${c.email} · ${c.program ? PROGRAM_LABEL[c.program] : 'Sem programa'}</p>
      </div>
      ${urgent
        ? '<span class="badge" style="background:rgba(196,90,60,.15); color:var(--terracotta); border-color:var(--terracotta);">⚠ Aguardando Informações</span>'
        : `<span class="badge ${openCount ? 'badge-progress' : 'badge-completed'}">${openCount ? `${openCount} pendência${openCount === 1 ? '' : 's'}` : 'Tudo em dia'}</span>`}
    </a>
  `;
}

function render() {
  const all = MockDB.listClients();
  content.innerHTML = `
    <div class="mb-8">
      <p class="text-white/40 text-sm mb-1">Clientes</p>
      <h1 class="text-3xl font-serif">Suas Clientes</h1>
      <p class="text-sm text-white/40 mt-2 max-w-2xl">Contrato, links de pagamento, WhatsApp, projeto de imagens, guias, Kit Digital e acesso à Hubla — tudo o que falta fazer para cada cliente, e o contexto para fazer bem.</p>
    </div>
    ${card(`<div class="divide-y" style="border-color:var(--line);">${all.map(clientRow).join('')}</div>`)}
  `;
}

render();
