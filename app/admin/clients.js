// Clientes — the real CRM entry point. Previously the "Clientes" nav tab
// pointed at client-detail.html (a single hardcoded client) and its "Todos
// os clientes" link pointed back at the dashboard, so there was no actual
// list. This page is that list — every client, searchable/filterable,
// linking into the existing client-detail.html?id= page.
import { MockDB, TIER_PHASES, PROGRAMS, PROGRAM_LABEL, ONBOARDING_STAGE_LABEL } from '../shared/mock-db.js';
import { renderShell, card, statusBadge } from '../shared/ui.js';

const TIER_LABEL = { premium: 'Premium', essential: 'Essential' };

document.body.innerHTML = renderShell({ role: 'admin', active: 'clients.html', title: 'Clientes' });
const content = document.getElementById('app-content');

let search = '';
let programFilter = '';

function clientRow(c) {
  const metaLine = c.status === 'onboarding'
    ? `Onboarding: ${ONBOARDING_STAGE_LABEL[c.onboardingStage]}`
    : `${TIER_LABEL[c.tier] || c.tier} · Fase: ${TIER_PHASES[c.tier][c.phaseIndex]}`;
  return `
    <a href="client-detail.html?id=${c.id}" class="flex items-center justify-between py-3 hover:bg-white/5 -mx-2 px-2 rounded-lg transition-colors" ${!c.infoSubmitted ? 'style="border-left:3px solid var(--terracotta); padding-left:9px;"' : ''}>
      <div>
        <p class="font-medium">${c.fullName}</p>
        <p class="text-xs text-white/30">${c.email} · ${metaLine}</p>
      </div>
      <div class="flex items-center gap-4">
        ${!c.infoSubmitted ? '<span class="badge" style="background:rgba(196,90,60,.15); color:var(--terracotta); border-color:var(--terracotta);">⚠ Aguardando Informações</span>' : ''}
        <span class="badge ${c.program ? 'badge-progress' : 'badge-locked'}">${c.program ? PROGRAM_LABEL[c.program] : 'Sem programa'}</span>
        ${c.status === 'onboarding' ? '' : `<span class="text-xs text-white/40">Jornada ${c.journeyPct}% · Tarefas ${c.homeworkPct}%</span>`}
        ${statusBadge(c.status)}
      </div>
    </a>
  `;
}

function render() {
  const all = MockDB.listClients();
  const filtered = all.filter((c) => {
    const matchesSearch = !search || c.fullName.toLowerCase().includes(search.toLowerCase()) || c.email.toLowerCase().includes(search.toLowerCase());
    const matchesProgram = !programFilter || c.program === programFilter;
    return matchesSearch && matchesProgram;
  });

  content.innerHTML = `
    <div class="grid md:grid-cols-3 gap-6 mb-8">
      ${card(`<p class="text-sm text-white/50 mb-2">Total de Clientes</p><p class="text-3xl font-serif">${all.length}</p>`)}
      ${PROGRAMS.map((p) => card(`
        <p class="text-sm text-white/50 mb-2">${PROGRAM_LABEL[p]}</p>
        <p class="text-3xl font-serif">${all.filter((c) => c.program === p).length}</p>
      `)).join('')}
    </div>
    ${card(`
      <div class="flex flex-wrap items-center gap-3 mb-4">
        <input id="client-search" class="field text-sm" style="max-width:260px;" placeholder="Buscar por nome ou email..." value="${search}" />
        <select id="program-filter" class="field text-sm" style="max-width:220px;">
          <option value="">Todos os programas</option>
          ${PROGRAMS.map((p) => `<option value="${p}" ${programFilter === p ? 'selected' : ''}>${PROGRAM_LABEL[p]}</option>`).join('')}
        </select>
        <span class="text-xs text-white/30">${filtered.length} de ${all.length}</span>
      </div>
      <div class="divide-y" style="border-color:var(--line);">
        ${filtered.length ? filtered.map(clientRow).join('') : '<p class="text-sm text-white/20 py-6">Nenhum cliente encontrado.</p>'}
      </div>
    `)}
  `;

  const searchEl = content.querySelector('#client-search');
  searchEl.addEventListener('input', (e) => { search = e.target.value; render(); });
  content.querySelector('#program-filter').addEventListener('change', (e) => { programFilter = e.target.value; render(); });
  // render() rebuilds the whole subtree on every keystroke, which would
  // otherwise drop focus/cursor position out of the search field.
  searchEl.focus();
  searchEl.setSelectionRange(search.length, search.length);
}

render();
