// Templates — read-only for the assistant: exactly what Nay curated on her
// own Templates page (admin/templates.js), same TEMPLATE_CATEGORIES config,
// so this can never show something different from what she set. This is
// the "what and how to send each deliverable" reference the duty list
// implied but never actually had a home for — she opens the right
// template, duplicates it in Canva, and uploads what she builds straight
// onto that client's own profile (see client-workspace.js's review queue).
import { MockDB, TEMPLATE_CATEGORIES } from '../shared/mock-db.js';
import { renderShell, card, isValidHttpUrl, externalLinkAttrs } from '../shared/ui.js';
import { requireProfile } from '../shared/supabase-auth.js';

if (!(await requireProfile('assistant'))) throw new Error('not authorized');
document.body.innerHTML = renderShell({ role: 'assistant', active: 'templates.html', title: 'Templates' });
const content = document.getElementById('app-content');

function itemTile(item, links, label) {
  const url = links[item.itemKey] || '';
  const ok = isValidHttpUrl(url);
  return `
    <div class="action-box">
      <p class="ctx-box-label">${label || item.itemLabel}</p>
      ${ok
        ? `<a ${externalLinkAttrs(url)} class="btn-primary" style="padding:8px 14px;font-size:12px;">Abrir Template ↗</a>`
        : '<span class="text-xs text-white/20">Ainda não definido pela Nay</span>'}
    </div>
  `;
}

function categoryCard(cat, library) {
  const links = library[cat.key] || {};
  return card(`
    <p class="text-sm text-white/50 mb-1">${cat.label}</p>
    <p class="text-xs text-white/20 mb-4">${cat.description}</p>
    ${cat.groups.map((g) => `
      ${g.groupLabel ? `<p class="text-xs uppercase mt-4 mb-2" style="color:var(--muted); letter-spacing:.1em;">${g.groupLabel}</p>` : ''}
      <div class="action-grid">${g.items.map((item) => itemTile(item, links)).join('')}</div>
    `).join('')}
  `, 'mb-6');
}

// Same single-link row as the admin page — Kit Digital, Planejamento de
// Imagem, Ferramentas para Nova Imagem share one line instead of three
// near-empty cards.
function singleLinksCard(cats, library) {
  return card(`
    <div class="action-grid">
      ${cats.map((cat) => itemTile(cat.groups[0].items[0], library[cat.key] || {}, cat.label)).join('')}
    </div>
  `, 'mb-6');
}

function render() {
  const library = MockDB.getTemplateLibrary();
  const grouped = TEMPLATE_CATEGORIES.filter((c) => !c.single);
  const single = TEMPLATE_CATEGORIES.filter((c) => c.single);
  content.innerHTML = `
    <div class="mb-8">
      <p class="text-white/40 text-sm mb-1">Templates</p>
      <h1 class="text-3xl font-serif mb-3">Templates para Entregas</h1>
      <p class="text-sm text-white/40 max-w-2xl">O template certo para cada entrega — escolha pela estação e variação da cliente na Cartela de Cores, ou pelo tipo de guia nos demais. Abra, duplique no Canva e adapte para ela.</p>
    </div>
    ${grouped.map((cat) => categoryCard(cat, library)).join('')}
    ${singleLinksCard(single, library)}
  `;
}

render();
