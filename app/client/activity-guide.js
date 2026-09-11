// Production Data Migration — Batch 3: converted off MockDB onto the real
// `activity_guide_versions` (tenant-level, is_current flags the published
// one) + `activity_guide_pages` (page_number/image_url — the flipbook
// source). Both readable by any authenticated user (shared reference
// content, not per-client). Acknowledgement (clients.guide_acknowledged)
// has no client-self-write policy in this schema — same situation as
// images.js's note field — shown read-only rather than granting a new
// broad write to `clients` for one boolean.
import { getCurrentClientContext } from '../shared/client-context.js';
import { supabase } from '../shared/supabase-client.js';
import { renderShell, card, initClientSwitcher, isValidAssetSrc, assetLinkAttrs, formatDate } from '../shared/ui.js';

const __clientCtx = await getCurrentClientContext('../login.html', { page: 'activity-guide' });
if (!__clientCtx) throw new Error('not authorized');
const clientId = __clientCtx.clientId;
const client = __clientCtx.client;
document.body.innerHTML = renderShell({ role: 'client', active: 'program.html', title: 'Guia de Atividades' });
initClientSwitcher();
const content = document.getElementById('app-content');

function flipbookMarkup(pages) {
  return `
    <div class="book-wrap">
      <div class="book-stage" id="book-stage" tabindex="0" aria-label="Guia de Atividades — use as setas para virar as páginas">
        <div class="book-page book-page-under"><img src="${pages[0]}" alt="" /></div>
        <div class="book-page book-page-flip" id="book-flip"><img src="${pages[0]}" alt="Página 1 do Guia de Atividades" /></div>
        <div class="book-edge book-edge-right" aria-hidden="true"></div>
        <button type="button" class="book-nav book-prev" id="book-prev" aria-label="Página anterior"><span>&lsaquo;</span></button>
        <button type="button" class="book-nav book-next" id="book-next" aria-label="Próxima página"><span>&rsaquo;</span></button>
      </div>
      <span class="book-counter" id="book-counter">Página 1 de ${pages.length}</span>
      <div class="book-thumbs">
        ${pages.map((src, i) => `
          <button type="button" class="book-thumb${i === 0 ? ' active' : ''}" data-i="${i}" aria-label="Ir para a página ${i + 1}">
            <img src="${src}" alt="" loading="lazy" />
          </button>
        `).join('')}
      </div>
    </div>
  `;
}

// Double-buffered CSS 3D page turn: a top "flip" layer carries the outgoing
// page and rotates about its left (next) or right (prev) edge while a
// static layer underneath already shows the incoming page, so the flip
// reveals it rather than swapping images mid-animation.
function initFlipbook(pages) {
  const stage = document.getElementById('book-stage');
  const underImg = stage.querySelector('.book-page-under img');
  const flip = document.getElementById('book-flip');
  const flipImg = flip.querySelector('img');
  const counter = document.getElementById('book-counter');
  const prevBtn = document.getElementById('book-prev');
  const nextBtn = document.getElementById('book-next');
  const thumbs = content.querySelectorAll('.book-thumb');

  let index = 0;
  let animating = false;

  function paintStatic() {
    underImg.src = pages[index];
    flipImg.src = pages[index];
    flipImg.alt = `Página ${index + 1} do Guia de Atividades`;
    flip.style.transition = 'none';
    flip.classList.remove('origin-right');
    flip.style.transform = 'rotateY(0deg)';
    void flip.offsetWidth; // force reflow before re-enabling the transition
    flip.style.transition = '';
    counter.textContent = `Página ${index + 1} de ${pages.length}`;
    prevBtn.disabled = index === 0;
    nextBtn.disabled = index === pages.length - 1;
    thumbs.forEach((t, i) => t.classList.toggle('active', i === index));
  }

  function jumpTo(target) {
    if (animating || target === index || target < 0 || target >= pages.length) return;
    index = target;
    paintStatic();
  }

  function turn(direction) {
    if (animating) return;
    const target = index + direction;
    if (target < 0 || target >= pages.length) return;
    animating = true;

    underImg.src = pages[target];
    flipImg.src = pages[index];
    flip.classList.toggle('origin-right', direction < 0);
    flip.style.transition = 'none';
    flip.style.transform = 'rotateY(0deg)';
    void flip.offsetWidth;
    flip.style.transition = '';
    requestAnimationFrame(() => {
      flip.style.transform = direction > 0 ? 'rotateY(-176deg)' : 'rotateY(176deg)';
    });

    const finish = () => {
      flip.removeEventListener('transitionend', finish);
      index = target;
      paintStatic();
      animating = false;
    };
    flip.addEventListener('transitionend', finish);
  }

  prevBtn.addEventListener('click', () => turn(-1));
  nextBtn.addEventListener('click', () => turn(1));
  thumbs.forEach((t) => t.addEventListener('click', () => jumpTo(Number(t.dataset.i))));
  stage.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') turn(1);
    if (e.key === 'ArrowLeft') turn(-1);
  });

  let touchStartX = null;
  stage.addEventListener('touchstart', (e) => { touchStartX = e.touches[0].clientX; }, { passive: true });
  stage.addEventListener('touchend', (e) => {
    if (touchStartX === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX;
    if (Math.abs(dx) > 40) turn(dx < 0 ? 1 : -1);
    touchStartX = null;
  }, { passive: true });

  paintStatic();
}

async function render() {
  const { data: version } = await supabase.from('activity_guide_versions').select('*').eq('is_current', true).maybeSingle();
  const { data: pageRows } = version
    ? await supabase.from('activity_guide_pages').select('*').eq('guide_version_id', version.id).order('page_number')
    : { data: [] };
  const pages = (pageRows || []).map((p) => p.image_url).filter(Boolean);
  const acknowledged = !!client.guide_acknowledged;
  const hasPages = pages.length > 0;
  const pdfOk = isValidAssetSrc(version?.pdf_url);

  content.innerHTML = `
    <a href="program.html" class="btn-text mb-6 inline-block">&larr; Seu Programa</a>
    <p class="text-sm text-white/40 max-w-xl mb-8">Veja como preparar e fotografar as imagens que serão analisadas pela equipe.</p>

    ${card(`
      ${hasPages ? flipbookMarkup(pages) : pdfOk ? `
        <div class="mb-5" style="border:1px solid var(--line); border-radius:4px; overflow:hidden;">
          <embed src="${version.pdf_url}" type="application/pdf" style="width:100%; height:520px;" />
        </div>
      ` : `
        <p class="text-sm" style="color:var(--muted);">O guia em PDF ainda não foi publicado pela equipe — ele aparecerá aqui assim que estiver pronto.</p>
      `}
      ${hasPages || pdfOk ? `
        <div class="flex flex-wrap items-center justify-center gap-3 mt-6">
          ${pdfOk ? `
            <a ${assetLinkAttrs(version.pdf_url)} class="btn-primary" style="padding:9px 18px;font-size:12.5px;">Ver PDF completo ↗</a>
            <a href="${version.pdf_url}" download class="btn-ghost">Baixar PDF</a>
          ` : ''}
        </div>
        <p class="text-xs text-white/20 mt-4 text-center">Versão ${version.version}${version.published_at ? ` · publicada em ${formatDate(version.published_at)}` : ''}</p>
      ` : ''}
    `, 'mb-6')}

    <label class="flex items-center gap-3 text-sm" style="color:${acknowledged ? 'var(--gold)' : 'var(--cream)'};">
      <input type="checkbox" id="ack-guide" ${acknowledged ? 'checked' : ''} disabled style="accent-color:var(--terracotta);" />
      Já consultei o guia
    </label>
  `;

  if (hasPages) initFlipbook(pages);
}

render();
