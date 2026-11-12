// Assistant's client list — one row per client with a quick read on what's
// still open in her checklist (see getAssistantChecklist in mock-db.js),
// linking into the per-client workspace where she actually does the work
// (that page orders the same checklist by priority — see client-workspace.js).
//
// Real E2E test found: this whole file was 100% MockDB, no environment
// branch at all — a real, activated client (is_demo=false, access_status
// ='created') never appeared here regardless of her real state, while she'd
// correctly stopped appearing in the real branch of assistant/leads.js's
// Cadastros (see that file) the moment she activated. Fixed with a real
// production path below: same access_status='created' criterion
// deriveClientStatus uses for "Ativa" (shared/client-status.js) and
// Cadastros' real branch excludes — so a real client falls into exactly one
// of the two tabs, never both, never neither. Staging/demo below this
// branch is unchanged — still the full MockDB client list.
import { MockDB, PROGRAM_LABEL, PROGRAM_LABEL_BY_SLUG } from '../shared/mock-db.js';
import { renderShell, card, formatDate, isProductionEnvironment } from '../shared/ui.js';
import { requireProfile } from '../shared/supabase-auth.js';
import { supabase } from '../shared/supabase-client.js';
import { loadRealClients, engagementPanel, clientsByPhase } from '../shared/clients-overview.js';
import { mountEncounterBoard } from '../admin/encounter-board.js';

if (!(await requireProfile('assistant'))) throw new Error('not authorized');
document.body.innerHTML = renderShell({ role: 'assistant', active: 'clients.html', title: 'Clientes' });
const content = document.getElementById('app-content');

// Same overview Nay has on her Clientes page (shared/clients-overview.js +
// the E1–E8 timeline), view-only: everything opens the student's page,
// where the assistant keeps her usual (non-admin) permissions.
async function renderProductionClientes() {
  const clients = await loadRealClients();
  content.innerHTML = `
    <div class="mb-8">
      <p class="text-white/40 text-sm mb-1">Clientes</p>
      <h1 class="text-3xl font-serif">Clientes</h1>
      <p class="text-sm text-white/40 mt-2 max-w-2xl">A mesma visão geral da Nay: onde cada aluna está na jornada, o engajamento e o próximo passo da equipe. Clique em uma aluna para abrir a página dela.</p>
    </div>
    ${card(`<p class="text-sm text-white/50">${clients.length} cliente${clients.length === 1 ? '' : 's'}</p>`, 'mb-6')}
    ${clients.length
      ? '<div id="encounter-board"></div>' + engagementPanel(clients) + clientsByPhase(clients)
      : card('<p class="text-sm" style="color:var(--muted);">Nenhuma cliente ainda.</p>')}
  `;
  if (clients.length) mountEncounterBoard(content.querySelector('#encounter-board'), clients);
}

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
      <p class="text-sm text-white/40 mt-2 max-w-2xl">Contrato, links de pagamento, WhatsApp, projeto de imagens, guias, Kit Digital e acesso à Hubla — tudo o que falta fazer em cada caso, e o contexto para fazer bem.</p>
    </div>
    ${card(`<div class="divide-y" style="border-color:var(--line);">${all.map(clientRow).join('')}</div>`)}
  `;
}

if (isProductionEnvironment()) {
  renderProductionClientes();
} else {
  render();
}
