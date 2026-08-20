// Guia de Produções — same reference-library feel as Projetos (projects.js),
// scoped to just the one deliverable: guia_looks_mensal. Its own page
// because it's the duty Nay calls out by name, not because the underlying
// data is any different from the rest of the image-guides library.
import { MockDB } from '../shared/mock-db.js';
import { renderShell, projectCard, card } from '../shared/ui.js';

document.body.innerHTML = renderShell({ role: 'assistant', active: 'production-guides.html', title: 'Guia de Produções' });
const content = document.getElementById('app-content');

function render() {
  const rows = MockDB.getProjectsLibrary({ slug: 'guia_looks_mensal' });

  content.innerHTML = `
    <div class="mb-8">
      <p class="text-white/40 text-sm mb-1">Guia de Produções</p>
      <h1 class="text-3xl font-serif mb-3">Guias de Looks do Mês Entregues</h1>
      <p class="text-sm text-white/40 max-w-2xl">Depende das fotos que cada cliente envia (ver Clientes → Projeto de Imagem). Cada card aqui é um guia já entregue, com o resumo do que foi montado.</p>
    </div>
    ${rows.length ? `
      <div class="grid md:grid-cols-2 gap-5">${rows.map(projectCard).join('')}</div>
    ` : card('<p class="text-sm" style="color:var(--muted);">Nenhum Guia de Produções entregue ainda — envie um para revisão a partir do workspace da cliente.</p>')}
  `;
}

render();
