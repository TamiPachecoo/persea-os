// Conteúdos — premium visual gateway to Hubla, NOT a replacement for it.
// Hubla stays responsible for lessons/videos/progress/completion; this page
// only helps a client find the right topic and hands her off in a new tab.
// Deliberately shows no locked/unlocked state, no progress bar, no
// completion %, no "next lesson", no watched status — Persea OS has no way
// of knowing what happened inside Hubla, and the UI must not imply it does.
import { MockDB } from '../shared/mock-db.js';
import { getCurrentClientContext } from '../shared/client-context.js';
import {
  renderShell, card, initClientSwitcher, externalLinkAttrs, isValidHttpUrl,
  contentCardInner, lockedStateCard,
} from '../shared/ui.js';

const __clientCtx = await getCurrentClientContext();
if (!__clientCtx) throw new Error('not authorized');
const activeClientId = __clientCtx.clientId;
document.body.innerHTML = renderShell({ role: 'client', active: 'content.html', title: 'Conteúdos' });
initClientSwitcher();

const content = document.getElementById('app-content');

function heroCta(url) {
  return isValidHttpUrl(url)
    ? `<a ${externalLinkAttrs(url)} class="btn-primary inline-block">Abrir todos os conteúdos na Hubla</a>`
    : `<button type="button" class="btn-ghost" disabled title="Link geral ainda não configurado">Abrir todos os conteúdos na Hubla</button>`;
}

function categoryCard(cat) {
  const linkOk = isValidHttpUrl(cat.hublaUrl);
  const label = `Acessar ${cat.title} na Hubla${linkOk ? ' (abre em nova aba)' : ''}`;
  return linkOk
    ? `<a ${externalLinkAttrs(cat.hublaUrl)} class="content-card" aria-label="${label}">${contentCardInner(cat)}</a>`
    : `<div class="content-card content-card-disabled" role="group" aria-label="${cat.title} — link em breve">${contentCardInner(cat)}</div>`;
}

// Recommendations Nay has attached to this client's own resources/tasks —
// a separate Persea workflow layered on top of the gateway above (see
// admin/content.js), not a Hubla-lesson tracker. Kept as a plain link-out,
// with no completion checkbox here — that belongs to Tarefas, not this page.
function recommendedSection() {
  const assignments = MockDB.getAssignmentsForClient(activeClientId).filter((a) => !a.completed);
  if (!assignments.length) return '';
  return `
    <div class="mb-10">
      <p class="text-sm text-white/50 mb-4">Recomendado para você</p>
      <div class="grid md:grid-cols-2 gap-4">
        ${assignments.map((a) => card(`
          <p class="font-medium text-sm mb-1">${a.resource.title}</p>
          ${a.reason ? `<p class="text-xs text-white/40 mb-3">${a.reason}</p>` : ''}
          ${isValidHttpUrl(a.resource.hublaUrl)
            ? `<a ${externalLinkAttrs(a.resource.hublaUrl)} class="btn-ghost inline-block" style="padding:8px 14px; font-size:12px;">Abrir na Hubla ↗</a>`
            : '<span class="text-xs text-white/30">Link em breve</span>'}
        `)).join('')}
      </div>
    </div>
  `;
}

function render() {
  if (MockDB.needsOnboardingCompletion(activeClientId)) {
    content.innerHTML = lockedStateCard('Conteúdos');
    return;
  }

  const categories = MockDB.getContentCategories();
  const tenant = MockDB.getTenant();

  content.innerHTML = `
    <div class="mb-10">
      <p class="text-white/40 text-sm mb-1">Central de Conteúdos</p>
      <h1 class="text-3xl font-serif">Conteúdos da Metodologia PERSEA</h1>
      <p class="text-sm text-white/40 mt-2 mb-5 max-w-xl">Acesse suas aulas e materiais disponíveis na Hubla.</p>
      ${heroCta(tenant.hublaAllContentUrl)}
    </div>

    ${recommendedSection()}

    ${categories.length ? `
      <div class="content-grid">${categories.map(categoryCard).join('')}</div>
    ` : card('<p class="text-sm text-white/30">Ainda não há conteúdos disponíveis — volte em breve.</p>')}
  `;
}

render();
