// Financeiro — the client's ongoing view of her contract and payments.
// Onboarding (onboarding.js) still captures the info that feeds the
// contract once, at the start; this page is where she comes back anytime
// to check what she owes, what's already paid, and to request a Nota
// Fiscal — separate from onboarding because it's needed for the life of
// the contract, not just once at signup.
import {
  MockDB, getActiveClientId, PROGRAM_LABEL, CONTRACT_DURATION_LABEL,
  ONBOARDING_STAGE_LABEL, PAYMENT_STATUS_LABEL, NF_STATUS_LABEL,
} from '../shared/mock-db.js';
import {
  renderShell, card, toast, formatDate, initClientSwitcher, isValidHttpUrl, externalLinkAttrs,
  isValidAssetSrc, assetLinkAttrs,
} from '../shared/ui.js';

const clientId = getActiveClientId();
document.body.innerHTML = renderShell({ role: 'client', active: 'financial.html', title: 'Financeiro' });
initClientSwitcher();
const content = document.getElementById('app-content');

const PAYMENT_STATUS_CLASS = { paid: 'badge-completed', pending: 'badge-progress', overdue: 'badge-locked' };
const NF_STATUS_CLASS = { not_requested: 'badge-locked', requested: 'badge-progress', issued: 'badge-completed' };
const paymentBadge = (s) => `<span class="badge ${PAYMENT_STATUS_CLASS[s] || 'badge-locked'}">${PAYMENT_STATUS_LABEL[s] || s}</span>`;
const nfBadge = (s) => `<span class="badge ${NF_STATUS_CLASS[s] || 'badge-locked'}">${NF_STATUS_LABEL[s] || s}</span>`;
const brl = (n) => `R$ ${n.toLocaleString('pt-BR')}`;

function paymentRow(p) {
  const canPay = p.status !== 'paid' && isValidHttpUrl(p.sumupLinkUrl);
  return `
    <div class="py-4 border-b border-white/5 last:border-0">
      <div class="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p class="text-sm">${brl(p.amount)}</p>
          <p class="text-xs text-white/30 mt-0.5">Vencimento ${formatDate(p.dueDate)}${p.paidAt ? ` · Pago em ${formatDate(p.paidAt)}` : p.reportedPaidAt ? ' · Pagamento reportado, aguardando confirmação' : ''}</p>
        </div>
        <div class="flex items-center gap-3">
          ${paymentBadge(p.status)}
          ${canPay ? `<a ${externalLinkAttrs(p.sumupLinkUrl)} class="btn-primary" style="padding:8px 16px;font-size:12px;">Pagar agora ↗</a>` : p.status !== 'paid' ? '<span class="text-xs text-white/20">Aguardando link de pagamento</span>' : ''}
        </div>
      </div>
      <div class="flex items-center justify-between flex-wrap gap-3 mt-3 pt-3" style="border-top:1px dashed var(--line);">
        <p class="text-xs text-white/30">Nota Fiscal ${nfBadge(p.nf.status)}</p>
        ${p.nf.status === 'not_requested'
          ? `<button data-request-nf="${p.id}" class="btn-text">Solicitar Nota Fiscal</button>`
          : p.nf.status === 'requested'
            ? '<span class="text-xs text-white/20">Solicitada — a equipe vai emitir em breve</span>'
            : isValidAssetSrc(p.nf.fileUrl)
              ? `<a ${assetLinkAttrs(p.nf.fileUrl)} class="btn-text">Ver Nota Fiscal</a>`
              : `<button data-view-nf="${p.id}" class="btn-text">Ver Nota Fiscal</button>`}
      </div>
    </div>
  `;
}

function render() {
  const o = MockDB.getOnboarding(clientId);
  const c = o.contract;
  const payments = MockDB.getPayments(clientId);
  const paid = payments.filter((p) => p.status === 'paid').reduce((s, p) => s + p.amount, 0);
  const pending = payments.filter((p) => p.status !== 'paid').reduce((s, p) => s + p.amount, 0);

  content.innerHTML = `
    <div class="mb-8">
      <p class="text-white/40 text-sm mb-1">Financeiro</p>
      <h1 class="text-3xl font-serif">Seu Contrato e Pagamentos</h1>
    </div>

    ${!c.program ? card(`
      <p class="text-sm" style="color:var(--muted);">Seu contrato ainda está sendo preparado pela equipe. Assim que estiver pronto, ele aparece aqui — acompanhe o status na etapa de <a href="onboarding.html" class="btn-text">Onboarding</a>.</p>
    `) : `
      ${card(`
        <p class="text-sm text-white/50 mb-4">Programa &amp; Contrato</p>
        <div class="grid sm:grid-cols-3 gap-4 text-sm mb-4">
          <div><p class="text-white/40 text-xs mb-1">Programa</p><p>${PROGRAM_LABEL[c.program] || '—'}</p></div>
          <div><p class="text-white/40 text-xs mb-1">Modelo</p><p>${c.program === 'ascensao_imagem' ? 'Pagamento único' : (c.duration ? CONTRACT_DURATION_LABEL[c.duration] : '—')}</p></div>
          <div><p class="text-white/40 text-xs mb-1">Valor Total</p><p>${c.value ? brl(c.value) : '—'}</p></div>
        </div>
        <div class="flex items-center justify-between">
          <span class="badge ${c.status === 'completed' ? 'badge-completed' : 'badge-progress'}">${ONBOARDING_STAGE_LABEL[c.status]}</span>
          ${c.status === 'completed' ? '<span class="text-xs text-white/20">Contrato assinado e arquivado pela equipe</span>' : ''}
        </div>
      `, 'mb-6')}
      ${card(`
        <div class="flex items-center justify-between mb-2">
          <p class="text-sm text-white/50">Parcelas</p>
          <span class="text-xs text-white/30">Pago ${brl(paid)} · A pagar ${brl(pending)}</span>
        </div>
        ${payments.length ? payments.map(paymentRow).join('') : '<p class="text-sm mt-3" style="color:var(--muted);">Nenhuma parcela registrada ainda.</p>'}
      `)}
    `}
  `;

  content.querySelectorAll('[data-request-nf]').forEach((btn) => {
    btn.addEventListener('click', () => {
      MockDB.requestInvoice(clientId, btn.dataset.requestNf);
      toast('Nota fiscal solicitada — a equipe vai emitir em breve.');
      render();
    });
  });
  content.querySelectorAll('[data-view-nf]').forEach((btn) => {
    btn.addEventListener('click', () => toast('Simulando abertura da Nota Fiscal — sem arquivo real neste protótipo.'));
  });
}

render();
