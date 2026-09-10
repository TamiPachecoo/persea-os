// Assistente — everything that's the assistant's work merged under one
// tab (previously two separate nav items): Templates, the source material
// Nay curates for her to build from, and Revisões, what she's built and is
// waiting on Nay to approve before it reaches a client. Same before/after
// of the assistant's actual work, now in one place instead of two.
import { MockDB, TEMPLATE_CATEGORIES, CONTENT_REVIEW_STATUS_LABEL, IMAGE_GUIDE_LABEL } from '../shared/mock-db.js';
import { renderShell, card, toast, isValidHttpUrl, externalLinkAttrs, formatDateTime, openModal, isValidAssetSrc, assetLinkAttrs } from '../shared/ui.js';
import { requireProfile } from '../shared/supabase-auth.js';
import { loadHublaPendingClients, markHublaAccessGranted } from '../shared/hubla-model.js';

if (!(await requireProfile('admin'))) throw new Error('not authorized');
document.body.innerHTML = renderShell({ role: 'admin', active: 'assistente.html', title: 'Assistente' });
const content = document.getElementById('app-content');

const SECTIONS = ['revisoes', 'templates', 'hubla'];
let section = SECTIONS.includes(new URLSearchParams(location.search).get('section')) ? new URLSearchParams(location.search).get('section') : 'revisoes';

// --- Templates ---------------------------------------------------------
function itemTile(catKey, item, links, label) {
  const url = links[item.itemKey] || '';
  const ok = isValidHttpUrl(url);
  return `
    <div class="action-box">
      <p class="ctx-box-label">${label || item.itemLabel}</p>
      <input type="url" class="field text-sm" data-template-input="${catKey}:${item.itemKey}" value="${url}" placeholder="https://www.canva.com/design/..." />
      <div class="flex items-center gap-3">
        <button data-template-save="${catKey}:${item.itemKey}" class="btn-ghost">Salvar</button>
        ${ok ? `<a ${externalLinkAttrs(url)} class="btn-text">Abrir ↗</a>` : ''}
      </div>
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
      <div class="action-grid">${g.items.map((item) => itemTile(cat.key, item, links)).join('')}</div>
    `).join('')}
  `, 'mb-6');
}
// The single-link categories (Kit Digital, Planejamento de Imagem,
// Ferramentas para Nova Imagem) share one row instead of three near-empty
// cards — each tile takes the category's own label since there's only the
// one "padrao" item per category to name.
function singleLinksCard(cats, library) {
  return card(`
    <div class="action-grid">
      ${cats.map((cat) => itemTile(cat.key, cat.groups[0].items[0], library[cat.key] || {}, cat.label)).join('')}
    </div>
  `, 'mb-6');
}
function renderTemplatesSection() {
  const library = MockDB.getTemplateLibrary();
  const grouped = TEMPLATE_CATEGORIES.filter((c) => !c.single);
  const single = TEMPLATE_CATEGORIES.filter((c) => c.single);
  return `
    <p class="text-sm text-white/40 mb-6 max-w-2xl">Cole aqui o link do template (Canva ou outro) que a assistente deve usar para cada entrega. A assistente vê exatamente esta lista na própria página dela, sem poder editar.</p>
    ${grouped.map((cat) => categoryCard(cat, library)).join('')}
    ${singleLinksCard(single, library)}
  `;
}

// --- Revisões ------------------------------------------------------------
const REVIEW_TYPE_LABEL = { image_guide: 'Guia de Imagem', digital_kit: 'Kit Digital' };
const REVIEW_STATUS_CLASS = { pending: 'badge-progress', approved: 'badge-completed', changes_requested: 'badge-locked' };

function reviewRow(r) {
  return `
    <div class="py-4 border-b border-white/5 last:border-0">
      <div class="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p class="text-sm font-medium">${r.clientName} — ${r.title}</p>
          <p class="text-xs text-white/30 mt-0.5">${REVIEW_TYPE_LABEL[r.type] || r.type}${r.refSlug ? ` · ${IMAGE_GUIDE_LABEL[r.refSlug] || r.refSlug}` : ''} · enviado em ${formatDateTime(r.createdAt)}</p>
        </div>
        <span class="badge ${REVIEW_STATUS_CLASS[r.status]}">${CONTENT_REVIEW_STATUS_LABEL[r.status]}</span>
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
function renderReviewsSection() {
  const all = MockDB.getPendingReviews();
  const pending = all.filter((r) => r.status === 'pending');
  const resolved = all.filter((r) => r.status !== 'pending').slice(0, 15);
  return `
    <p class="text-sm text-white/40 mb-6 max-w-2xl">Guias de imagem e Kit Digital passam por aqui antes de chegar até a cliente.</p>
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

// --- Hubla -----------------------------------------------------------
// Hubla exposes no API to grant access (checked directly against their
// docs) — only a manual "Adicionar membro(s)" action inside Hubla itself.
// This can't automate that step, but it removes the part that was actually
// eating Nay/Ju's time: knowing who's waiting. Once the grant happens in
// Hubla, hubla-webhook's own customer.member_added handling flips this
// status automatically — "Marcar como concedido" below is a manual
// fallback for confirming a grant that predates the webhook, or that this
// rule wasn't scoped to catch.
function hublaPendingRow(c) {
  return `
    <div class="flex items-center justify-between py-3 border-b border-white/5 last:border-0 flex-wrap gap-2">
      <div>
        <p class="text-sm font-medium">${c.full_name}</p>
        <p class="text-xs text-white/30">${c.email}</p>
      </div>
      <div class="flex items-center gap-3">
        <button type="button" data-copy-hubla-email="${c.email}" class="btn-ghost" style="padding:6px 12px; font-size:12px;">Copiar e-mail</button>
        <button type="button" data-mark-hubla-granted="${c.id}" class="btn-text">Marcar como concedido</button>
      </div>
    </div>
  `;
}
const HUBLA_DASHBOARD_URL = 'https://app.hub.la/dashboard';

function renderHublaSection({ clients, error }) {
  return `
    <div class="flex items-center justify-between mb-6 flex-wrap gap-3">
      <p class="text-sm text-white/40 max-w-2xl">Clientes ativas sem acesso ao Hubla ainda. A Hubla não tem uma forma de conceder acesso por API, então copie o e-mail, abra a Hubla e adicione em Produto → Membros → Adicionar membro(s) gratuito(s). O status aqui atualiza sozinho assim que a Hubla confirmar o acesso.</p>
      <a ${externalLinkAttrs(HUBLA_DASHBOARD_URL)} class="btn-ghost" style="white-space:nowrap;">Abrir Hubla ↗</a>
    </div>
    ${card(`
      <div class="flex items-center justify-between mb-2">
        <p class="text-sm text-white/50">Acessos Pendentes</p>
        ${clients.length ? `<span class="text-xs" style="color:var(--muted);">${clients.length}</span>` : ''}
      </div>
      ${error ? `<p class="text-sm" style="color:var(--terracotta);">Não foi possível carregar: ${error}</p>`
        : clients.length ? clients.map(hublaPendingRow).join('')
        : '<p class="text-sm" style="color:var(--gold);">Nenhuma pendência. Todo mundo ativa já tem acesso.</p>'}
    `)}
  `;
}

async function render() {
  const hublaPending = section === 'hubla' ? await loadHublaPendingClients() : null;
  content.innerHTML = `
    <div class="mb-8">
      <p class="text-white/40 text-sm mb-1">Assistente</p>
      <h1 class="text-3xl font-serif">Templates &amp; Revisões</h1>
    </div>
    <div class="flex gap-1 mb-8 border-b border-white/10">
      <button data-section="revisoes" class="tab-btn ${section === 'revisoes' ? 'active' : ''}">Revisões</button>
      <button data-section="templates" class="tab-btn ${section === 'templates' ? 'active' : ''}">Templates</button>
      <button data-section="hubla" class="tab-btn ${section === 'hubla' ? 'active' : ''}">Hubla</button>
    </div>
    ${section === 'templates' ? renderTemplatesSection() : section === 'hubla' ? renderHublaSection(hublaPending) : renderReviewsSection()}
  `;

  content.querySelectorAll('[data-section]').forEach((btn) => {
    btn.addEventListener('click', () => {
      section = btn.dataset.section;
      history.replaceState(null, '', `assistente.html?section=${section}`);
      render();
    });
  });

  if (section === 'templates') {
    content.querySelectorAll('[data-template-save]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const [catKey, itemKey] = btn.dataset.templateSave.split(':');
        const input = content.querySelector(`[data-template-input="${catKey}:${itemKey}"]`);
        MockDB.setTemplateLink(catKey, itemKey, input.value);
        toast('Link do modelo salvo.');
        render();
      });
    });
  } else if (section === 'hubla') {
    content.querySelectorAll('[data-copy-hubla-email]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(btn.dataset.copyHublaEmail);
          toast('E-mail copiado.');
        } catch {
          toast('Não foi possível copiar automaticamente. Selecione o e-mail manualmente.', { tone: 'error' });
        }
      });
    });
    content.querySelectorAll('[data-mark-hubla-granted]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const { error } = await markHublaAccessGranted(btn.dataset.markHublaGranted);
        if (error) { toast('Erro ao atualizar o status.', { tone: 'error' }); return; }
        toast('Acesso Hubla marcado como concedido.');
        render();
      });
    });
  } else {
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
}

render();
