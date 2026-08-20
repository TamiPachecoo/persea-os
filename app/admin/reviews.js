// Revisões — everything the assistant has prepared and is waiting on Nay
// to look at before it goes to a client (image guides, Digital Kit, and
// whatever else future work routes through submitForReview). Keeps Nay and
// the assistant on the same page: nothing client-facing ships without
// landing here first.
import { MockDB, CONTENT_REVIEW_STATUS_LABEL, IMAGE_GUIDE_LABEL } from '../shared/mock-db.js';
import { renderShell, card, toast, formatDateTime, openModal, isValidAssetSrc, assetLinkAttrs } from '../shared/ui.js';

document.body.innerHTML = renderShell({ role: 'admin', active: 'reviews.html', title: 'Revisões' });
const content = document.getElementById('app-content');

const TYPE_LABEL = { image_guide: 'Guia de Imagem', digital_kit: 'Kit Digital' };
const STATUS_CLASS = { pending: 'badge-progress', approved: 'badge-completed', changes_requested: 'badge-locked' };

function reviewRow(r) {
  return `
    <div class="py-4 border-b border-white/5 last:border-0">
      <div class="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p class="text-sm font-medium">${r.clientName} — ${r.title}</p>
          <p class="text-xs text-white/30 mt-0.5">${TYPE_LABEL[r.type] || r.type}${r.refSlug ? ` · ${IMAGE_GUIDE_LABEL[r.refSlug] || r.refSlug}` : ''} · enviado em ${formatDateTime(r.createdAt)}</p>
        </div>
        <span class="badge ${STATUS_CLASS[r.status]}">${CONTENT_REVIEW_STATUS_LABEL[r.status]}</span>
      </div>
      ${r.note ? `<p class="text-sm text-white/50 mt-2">${r.note}</p>` : ''}
      ${r.summary ? `<p class="text-xs text-white/30 mt-1">Resumo: ${r.summary}</p>` : ''}
      <div class="flex items-center gap-3 mt-2">
        ${isValidAssetSrc(r.fileUrl) ? `<a ${assetLinkAttrs(r.fileUrl)} class="btn-text inline-block">Ver arquivo ↗</a>` : ''}
        ${r.canvaUrl ? `<a ${assetLinkAttrs(r.canvaUrl)} class="btn-text inline-block">Abrir no Canva ↗</a>` : ''}
      </div>
      ${r.nayNote ? `<p class="text-xs mt-2" style="color:var(--terracotta);">Sua observação: ${r.nayNote}</p>` : ''}
      ${r.status === 'pending' ? `
        <div class="flex items-center gap-3 mt-3">
          <button data-approve="${r.id}" class="btn-primary" style="padding:8px 16px;font-size:12px;">Aprovar e liberar</button>
          <button data-request-changes="${r.id}" class="btn-ghost">Pedir ajustes</button>
        </div>
      ` : ''}
    </div>
  `;
}

function openChangesModal(reviewId) {
  const { el, close } = openModal({
    title: 'Pedir ajustes',
    bodyHtml: `
      <form id="changes-form" class="space-y-4">
        <div>
          <label class="text-xs text-white/40 block mb-1">O que precisa mudar?</label>
          <textarea name="note" rows="3" class="field" required></textarea>
        </div>
        <button type="submit" class="btn-primary" style="padding:9px 18px;font-size:12.5px;">Enviar</button>
      </form>
    `,
  });
  el.querySelector('#changes-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const note = new FormData(e.target).get('note');
    MockDB.requestReviewChanges(reviewId, note);
    close();
    toast('Ajustes solicitados — a assistente foi notificada.');
    render();
  });
}

function render() {
  const all = MockDB.getPendingReviews();
  const pending = all.filter((r) => r.status === 'pending');
  const resolved = all.filter((r) => r.status !== 'pending').slice(0, 15);

  content.innerHTML = `
    <div class="mb-8">
      <p class="text-white/40 text-sm mb-1">Revisões</p>
      <h1 class="text-3xl font-serif">O Que a Equipe Preparou</h1>
      <p class="text-sm text-white/40 mt-2 max-w-2xl">Guias de imagem e Kit Digital passam por aqui antes de chegar até a cliente.</p>
    </div>
    ${card(`
      <div class="flex items-center justify-between mb-4">
        <p class="text-sm text-white/50">Aguardando sua revisão</p>
        <span class="text-xs" style="color:var(--muted);">${pending.length}</span>
      </div>
      ${pending.length ? pending.map(reviewRow).join('') : '<p class="text-sm" style="color:var(--gold);">Nada pendente agora.</p>'}
    `, 'mb-8')}
    ${resolved.length ? card(`
      <p class="text-sm text-white/50 mb-4">Histórico Recente</p>
      ${resolved.map(reviewRow).join('')}
    `) : ''}
  `;

  content.querySelectorAll('[data-approve]').forEach((btn) => {
    btn.addEventListener('click', () => {
      MockDB.approveReview(btn.dataset.approve);
      toast('Aprovado — já está disponível para a cliente.');
      render();
    });
  });
  content.querySelectorAll('[data-request-changes]').forEach((btn) => {
    btn.addEventListener('click', () => openChangesModal(btn.dataset.requestChanges));
  });
}

render();
