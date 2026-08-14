// Direção da Marca — redesigned as an inspiration workspace: the Pinterest
// mood board rendered large and prominent (not a link card), with "Minhas
// Ideias" beside it so the page becomes a place inspiration turns into
// actual content ideas, not just something the client looks at.
//
// Read-only except for "Minhas Ideias" (brandIdeas) — everything else here
// (positioning, keywords, tone, references, guidance, belongs/doesn't
// belong, the mood-board intro, the Pinterest URL itself) is admin-owned,
// edited on client-detail.js's Brand Direction tab. MockDB enforces this by
// construction: saveBrandIdeas() only ever touches the brandIdeas field —
// there is no client-callable path into saveBrandDirection().
import { MockDB, getActiveClientId } from '../shared/mock-db.js';
import { renderShell, card, initClientSwitcher, externalLinkAttrs, isValidHttpUrl } from '../shared/ui.js';

const activeClientId = getActiveClientId();
document.body.innerHTML = renderShell({ role: 'client', active: 'brand-direction.html', title: 'Direção da Marca' });
initClientSwitcher();

const bd = MockDB.getBrandDirection(activeClientId);
const ideas = MockDB.getBrandIdeas(activeClientId);
const content = document.getElementById('app-content');

const hasAnyContent = Boolean(
  bd.pinterestUrl || bd.moodBoardIntro || bd.positioningSummary || bd.tone || bd.guidance ||
  (bd.keywords || []).length || (bd.references || []).length ||
  (bd.belongs || []).length || (bd.doesntBelong || []).length
);

// --- Board area states (loading / empty / error), rendered as HTML strings
// so each state fully replaces the last — never a half-updated DOM. ---
function boardEmptyState() {
  return `
    <div class="board-state">
      <p class="font-serif" style="font-size:1.3rem;">O mural ainda não foi adicionado</p>
      <p class="text-xs text-white/40 max-w-sm">Assim que sua consultora adicionar o board do Pinterest, ele aparece bem aqui — no centro do seu espaço de inspiração.</p>
    </div>
  `;
}
function boardLoadingState() {
  return `
    <div class="board-skeleton"></div>
    <div class="board-state" style="position:relative;">
      <p class="text-xs text-white/30">Carregando mural…</p>
    </div>
  `;
}
function boardErrorState(url, reason) {
  return `
    <div class="board-state">
      <p class="font-serif" style="font-size:1.3rem;">Não foi possível exibir o mural aqui</p>
      <p class="text-xs text-white/40 max-w-sm">${reason}</p>
      <a ${externalLinkAttrs(url)} class="btn-primary" style="padding:11px 22px;font-size:13px;">Abrir no Pinterest</a>
    </div>
  `;
}

// Mounts the real embed target in normal document flow from the start —
// Pinterest's widget appears to skip/never-render elements that are
// positioned off-screen (an earlier version parked it at left:-9999px to
// avoid a flash of raw markup, which likely reads to Pinterest's own
// lazy-load/visibility check as "not visible" and never renders). A
// loading overlay sits on top instead, covering the unprocessed <a> until
// Pinterest replaces it with a real <iframe> — same "never show anything
// broken" guarantee, without hiding the target from Pinterest itself.
// Falls back to a polished card if the board is private, invalid, removed,
// or Pinterest doesn't respond in time.
function mountBoard(container, url) {
  container.innerHTML = `
    <div class="pin-embed-wrap" id="pin-embed-target">
      <a data-pin-do="embedBoard" data-pin-board-width="900" data-pin-scale-height="420" data-pin-scale-width="100" href="${url}"></a>
    </div>
    <div class="board-loading-overlay" id="board-loading-overlay">${boardLoadingState()}</div>
  `;
  const target = document.getElementById('pin-embed-target');

  const script = document.createElement('script');
  script.async = true;
  script.src = 'https://assets.pinterest.com/js/pinit.js';
  script.onerror = () => {
    container.innerHTML = boardErrorState(url, 'Não conseguimos carregar o Pinterest no momento. Tente novamente mais tarde.');
  };
  document.body.appendChild(script);

  setTimeout(() => {
    if (target.querySelector('iframe')) {
      document.getElementById('board-loading-overlay')?.remove();
    } else {
      console.warn('[Persea] Pinterest board did not render within the timeout — showing fallback.', url);
      container.innerHTML = boardErrorState(url, 'O board pode estar privado, ter sido removido, ou o Pinterest não respondeu a tempo. Verifique se ele está configurado como público.');
    }
  }, 5000);
}

function renderWorkspace() {
  const linkOk = bd.pinterestUrl && isValidHttpUrl(bd.pinterestUrl);
  return `
    <div class="mb-6">
      <p class="eyebrow mb-2">Mural de Inspiração</p>
      ${bd.moodBoardIntro ? `<p class="text-sm text-white/60 max-w-2xl leading-relaxed">${bd.moodBoardIntro}</p>` : '<p class="text-sm text-white/40 max-w-2xl leading-relaxed">Estas são as referências visuais que guiam sua marca — volte aqui sempre que estiver criando algo novo.</p>'}
    </div>
    <div class="grid md:grid-cols-3 gap-6 mb-10">
      <div class="md:col-span-2">
        <div class="board-area" id="board-area">${linkOk ? '' : boardEmptyState()}</div>
        <div class="flex items-center justify-between mt-4 flex-wrap gap-3">
          <div class="flex items-center gap-2 flex-wrap">
            ${(bd.keywords || []).map((k) => `<span class="badge badge-progress">${k}</span>`).join('')}
          </div>
          ${linkOk ? `<a ${externalLinkAttrs(bd.pinterestUrl)} class="btn-ghost">Abrir no Pinterest</a>` : ''}
        </div>
      </div>
      <div>
        <div class="card" style="height:100%; display:flex; flex-direction:column;">
          <p class="text-sm text-white/50 mb-1">Minhas Ideias</p>
          <p class="text-xs text-white/30 mb-3">O que este mural te inspira? Anote frases, ideias de conteúdo ou referências que vêm à mente.</p>
          <textarea id="brand-ideas-field" class="field" style="flex:1; min-height:260px; resize:vertical; line-height:1.6;" placeholder="Escreva livremente...">${ideas}</textarea>
          <p id="ideas-save-status" class="text-xs mt-2" style="color:var(--muted);">&nbsp;</p>
        </div>
      </div>
    </div>
  `;
}

function renderSupportingSections() {
  return `
    <div class="grid md:grid-cols-2 gap-6 mb-6">
      ${bd.tone ? card(`
        <p class="text-sm text-white/50 mb-3">Tom de Comunicação</p>
        <p class="text-sm">${bd.tone}</p>
      `) : ''}
      ${(bd.references || []).length ? card(`
        <p class="text-sm text-white/50 mb-3">Direção Visual</p>
        <ul class="list-disc list-inside space-y-1 text-sm">${bd.references.map((r) => `<li>${r}</li>`).join('')}</ul>
      `) : ''}
    </div>
    ${bd.positioningSummary ? card(`
      <p class="text-sm text-white/50 mb-2">Posicionamento</p>
      <p class="font-serif" style="font-size:1.2rem; line-height:1.45;">${bd.positioningSummary}</p>
    `, 'mb-6') : ''}
    ${bd.guidance ? card(`
      <p class="text-sm text-white/50 mb-3">Orientações da Nay</p>
      <p class="text-sm">${bd.guidance}</p>
    `, 'mb-6') : ''}
    <div class="grid md:grid-cols-2 gap-6">
      ${(bd.belongs || []).length ? card(`
        <p class="text-sm text-white/50 mb-3">O que pertence a esta marca</p>
        <ul class="list-disc list-inside space-y-1 text-sm">${bd.belongs.map((b) => `<li>${b}</li>`).join('')}</ul>
      `) : ''}
      ${(bd.doesntBelong || []).length ? card(`
        <p class="text-sm text-white/50 mb-3">O que não pertence a esta marca</p>
        <ul class="list-disc list-inside space-y-1 text-sm">${bd.doesntBelong.map((b) => `<li>${b}</li>`).join('')}</ul>
      `) : ''}
    </div>
  `;
}

if (!hasAnyContent) {
  content.innerHTML = `
    <div class="mb-8">
      <p class="text-white/40 text-sm mb-1">Direção da Marca</p>
    </div>
    ${card(`
      <div style="text-align:center; padding:52px 24px;">
        <p class="font-serif" style="font-size:1.7rem;">Sua Direção de Marca está a caminho</p>
        <p class="text-sm text-white/40 mt-3 max-w-md mx-auto">Assim que sua consultora definir seu mural de inspiração, posicionamento e referências, tudo aparece aqui.</p>
      </div>
    `)}
  `;
} else {
  content.innerHTML = `
    <div class="mb-8">
      <p class="text-white/40 text-sm mb-1">Seu espaço de inspiração e criação</p>
      <h1 class="text-3xl font-serif">Direção da Marca</h1>
    </div>
    ${renderWorkspace()}
    ${renderSupportingSections()}
  `;

  if (bd.pinterestUrl && isValidHttpUrl(bd.pinterestUrl)) {
    mountBoard(document.getElementById('board-area'), bd.pinterestUrl);
  }

  const ideasField = document.getElementById('brand-ideas-field');
  const ideasStatus = document.getElementById('ideas-save-status');
  let saveTimer = null;
  ideasField.addEventListener('input', () => {
    ideasStatus.textContent = 'Salvando…';
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      MockDB.saveBrandIdeas(activeClientId, ideasField.value);
      ideasStatus.textContent = 'Salvo.';
    }, 500);
  });
}
