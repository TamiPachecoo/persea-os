// Direção da Marca — student-facing view of what the admin fills in on the
// "Direção da Marca" tab of client-detail.js. Read-only for the student
// (per the spec: "Students should only be able to view their own Brand
// Direction"). The Pinterest board is embedded via Pinterest's own official
// widget script when a URL is configured, with a graceful fallback card if
// the embed doesn't render.
import { MockDB, getActiveClientId } from '../shared/mock-db.js';
import { renderShell, card, initClientSwitcher, externalLinkAttrs, isValidHttpUrl } from '../shared/ui.js';

const activeClientId = getActiveClientId();
document.body.innerHTML = renderShell({ role: 'client', active: 'brand-direction.html', title: 'Direção da Marca' });
initClientSwitcher();

const bd = MockDB.getBrandDirection(activeClientId);
const content = document.getElementById('app-content');

const hasAnyContent = Boolean(
  bd.positioningSummary || bd.tone || bd.guidance ||
  (bd.keywords || []).length || (bd.references || []).length ||
  (bd.belongs || []).length || (bd.doesntBelong || []).length
);

function mountPinterestEmbed(mount, url) {
  mount.innerHTML = `<a data-pin-do="embedBoard" data-pin-board-width="800" data-pin-scale-height="360" data-pin-scale-width="80" href="${url}"></a>`;
  const script = document.createElement('script');
  script.async = true;
  script.defer = true;
  script.src = 'https://assets.pinterest.com/js/pinit.js';
  script.onerror = () => showPinterestFallback(mount, url);
  document.body.appendChild(script);
  // Pinterest's widget replaces the <a> above with a real <iframe> once it
  // loads successfully. If that hasn't happened after a few seconds
  // (blocked embed, network issue, invalid board), fall back gracefully
  // instead of leaving an empty/broken space.
  setTimeout(() => {
    if (!mount.querySelector('iframe')) showPinterestFallback(mount, url);
  }, 3500);
}

function showPinterestFallback(mount, url) {
  mount.innerHTML = `
    <div style="text-align:center; padding:36px 20px;">
      <p class="font-serif" style="font-size:1.3rem;">Referências visuais no Pinterest</p>
      <p class="text-xs text-white/40 mt-3 max-w-md mx-auto">O mural não pôde ser exibido diretamente aqui, mas você pode abri-lo no Pinterest a qualquer momento.</p>
      <a ${externalLinkAttrs(url)} class="btn-primary inline-block mt-5" style="padding:11px 22px;font-size:13px;">Abrir no Pinterest</a>
    </div>
  `;
}

function renderPinterestSection() {
  if (bd.pinterestUrl && isValidHttpUrl(bd.pinterestUrl)) {
    return card(`
      <div class="flex items-center justify-between mb-4">
        <p class="text-sm text-white/50">Mural de Inspiração</p>
        <a ${externalLinkAttrs(bd.pinterestUrl)} class="btn-ghost">Abrir no Pinterest</a>
      </div>
      <div id="pinterest-embed"></div>
    `, 'mb-6');
  }
  return card(`
    <p class="text-sm text-white/50 mb-2">Mural de Inspiração</p>
    <p class="text-xs text-white/30">Sua consultora ainda não adicionou o mural do Pinterest — em breve ele aparece aqui.</p>
  `, 'mb-6');
}

if (!hasAnyContent) {
  content.innerHTML = `
    <div class="mb-8">
      <p class="text-white/40 text-sm mb-1">Direção da Marca</p>
    </div>
    ${card(`
      <div style="text-align:center; padding:52px 24px;">
        <p class="font-serif" style="font-size:1.7rem;">Sua Direção de Marca está a caminho</p>
        <p class="text-sm text-white/40 mt-3 max-w-md mx-auto">Assim que sua consultora definir seu posicionamento, palavras-chave e referências visuais, tudo aparece aqui.</p>
      </div>
    `)}
  `;
} else {
  content.innerHTML = `
    <div class="mb-8">
      <p class="text-white/40 text-sm mb-1">A direção que guia sua marca</p>
      <h1 class="text-3xl font-serif">Direção da Marca</h1>
    </div>

    ${bd.positioningSummary ? card(`
      <p class="text-sm text-white/50 mb-2">Posicionamento</p>
      <p class="font-serif" style="font-size:1.3rem; line-height:1.45;">${bd.positioningSummary}</p>
    `, 'mb-6') : ''}

    <div class="grid md:grid-cols-2 gap-6 mb-6">
      ${(bd.keywords || []).length ? card(`
        <p class="text-sm text-white/50 mb-3">Palavras-Chave</p>
        <div class="flex flex-wrap gap-2">${bd.keywords.map((k) => `<span class="badge badge-progress">${k}</span>`).join('')}</div>
      `) : ''}
      ${bd.tone ? card(`
        <p class="text-sm text-white/50 mb-3">Tom de Comunicação</p>
        <p class="text-sm">${bd.tone}</p>
      `) : ''}
    </div>

    ${(bd.references || []).length ? card(`
      <p class="text-sm text-white/50 mb-3">Referências Visuais e de Conteúdo</p>
      <ul class="list-disc list-inside space-y-1 text-sm">${bd.references.map((r) => `<li>${r}</li>`).join('')}</ul>
    `, 'mb-6') : ''}

    ${bd.guidance ? card(`
      <p class="text-sm text-white/50 mb-3">Orientações da Nay</p>
      <p class="text-sm">${bd.guidance}</p>
    `, 'mb-6') : ''}

    <div class="grid md:grid-cols-2 gap-6 mb-6">
      ${(bd.belongs || []).length ? card(`
        <p class="text-sm text-white/50 mb-3">O que pertence a esta marca</p>
        <ul class="list-disc list-inside space-y-1 text-sm">${bd.belongs.map((b) => `<li>${b}</li>`).join('')}</ul>
      `) : ''}
      ${(bd.doesntBelong || []).length ? card(`
        <p class="text-sm text-white/50 mb-3">O que não pertence a esta marca</p>
        <ul class="list-disc list-inside space-y-1 text-sm">${bd.doesntBelong.map((b) => `<li>${b}</li>`).join('')}</ul>
      `) : ''}
    </div>

    ${renderPinterestSection()}
  `;

  if (bd.pinterestUrl && isValidHttpUrl(bd.pinterestUrl)) {
    mountPinterestEmbed(document.getElementById('pinterest-embed'), bd.pinterestUrl);
  }
}
