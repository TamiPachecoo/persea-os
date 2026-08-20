// Projetos — the assistant's reference library: every delivered image guide
// and Digital Kit, across every client, in one browsable place. The point
// isn't just "see what shipped" (that's the per-client workspace) — it's
// "a new client looks like Marina, what did I build for her?" so nothing
// gets reinvented from scratch and nothing drifts client to client.
import { MockDB, IMAGE_GUIDE_SLUGS, IMAGE_GUIDE_LABEL } from '../shared/mock-db.js';
import { renderShell, projectCard } from '../shared/ui.js';

document.body.innerHTML = renderShell({ role: 'assistant', active: 'projects.html', title: 'Projetos' });
const content = document.getElementById('app-content');

const FILTERS = [['', 'Todos'], ...IMAGE_GUIDE_SLUGS.map((s) => [s, IMAGE_GUIDE_LABEL[s]]), ['digital_kit', 'Kit Digital']];
let activeFilter = '';

function render() {
  const rows = MockDB.getProjectsLibrary().filter((p) => !activeFilter || p.slug === activeFilter);

  content.innerHTML = `
    <div class="mb-8">
      <p class="text-white/40 text-sm mb-1">Projetos</p>
      <h1 class="text-3xl font-serif mb-3">Biblioteca de Projetos Entregues</h1>
      <p class="text-sm text-white/40 max-w-2xl">Cada guia, mood board e Kit Digital já entregue, com o resumo do que foi feito e por quê — use como ponto de partida para uma cliente com perfil parecido.</p>
    </div>
    <div class="flex flex-wrap gap-2 mb-8">
      ${FILTERS.map(([slug, label]) => `
        <button type="button" data-filter="${slug}" class="tab-btn ${activeFilter === slug ? 'active' : ''}">${label}</button>
      `).join('')}
    </div>
    ${rows.length ? `
      <div class="grid md:grid-cols-2 gap-5">${rows.map(projectCard).join('')}</div>
    ` : '<p class="text-sm" style="color:var(--muted);">Nenhum projeto entregue ainda nesta categoria.</p>'}
  `;

  content.querySelectorAll('[data-filter]').forEach((btn) => {
    btn.addEventListener('click', () => { activeFilter = btn.dataset.filter; render(); });
  });
}

render();
