// Financeiro — Production Migration Batch 6: converted off MockDB onto the
// real financial architecture. Reuses shared/financial-model.js's
// loadActiveObligations/summarizeObligations (the SAME calculation admin
// already uses for tenant-wide KPIs) for "A pagar"/"Em atraso" — never a
// second, differently-shaped formula. "Recebido" uses the same definition
// admin/financial.js already uses (sum of payments.status='paid'), not a
// second money-received formula either.
//
// Kept deliberately simple per spec: shows the CURRENT payment_plan_versions
// (status='active') installments only — a renegotiated/superseded plan's
// old lines are not shown as if still owed, though money already paid
// against them still counts toward "Recebido" (it's real money, it doesn't
// un-happen when a plan is renegotiated).
import { getCurrentClientContext } from '../shared/client-context.js';
import { supabase } from '../shared/supabase-client.js';
import { loadActiveObligations, summarizeObligations } from '../shared/financial-model.js';
import {
  renderShell, card, toast, formatDate, initClientSwitcher, isValidHttpUrl, externalLinkAttrs, brl,
} from '../shared/ui.js';

const __clientCtx = await getCurrentClientContext('../login.html', { page: 'financial' });
if (!__clientCtx) throw new Error('not authorized');
const clientId = __clientCtx.clientId;
document.body.innerHTML = renderShell({ role: 'client', active: 'financial.html', title: 'Financeiro' });
initClientSwitcher();
const content = document.getElementById('app-content');

const INSTALLMENT_STATUS_LABEL = {
  paid: 'Pago', pending: 'A vencer', overdue: 'Em atraso', partially_paid: 'Parcialmente pago', partially_paid_overdue: 'Parcialmente pago — em atraso',
};
const INSTALLMENT_BADGE_CLASS = {
  paid: 'badge-completed', pending: 'badge-progress', overdue: 'badge-locked', partially_paid: 'badge-progress', partially_paid_overdue: 'badge-locked',
};
const NF_STATUS_LABEL = { not_requested: 'Não solicitada', requested: 'Solicitada', issued: 'Emitida' };
const NF_BADGE_CLASS = { not_requested: 'badge-locked', requested: 'badge-progress', issued: 'badge-completed' };

function installmentRow(line) {
  return `
    <div class="py-4 border-b border-white/5 last:border-0">
      <div class="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p class="text-sm">${brl(line.amount_cents / 100)}${line.label ? ` · ${line.label}` : ''}</p>
          <p class="text-xs text-white/30 mt-0.5">Vencimento ${formatDate(line.due_date)}${line.allocated_cents > 0 && line.effective_status !== 'paid' ? ` · ${brl(line.allocated_cents / 100)} já alocado` : ''}</p>
        </div>
        <span class="badge ${INSTALLMENT_BADGE_CLASS[line.effective_status] || 'badge-locked'}">${INSTALLMENT_STATUS_LABEL[line.effective_status] || line.effective_status}</span>
      </div>
    </div>
  `;
}

function paymentHistoryRow(p) {
  const canPay = p.status !== 'paid' && isValidHttpUrl(p.sumup_link_url);
  const nfStatus = p.invoice?.status || 'not_requested';
  return `
    <div class="py-4 border-b border-white/5 last:border-0">
      <div class="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p class="text-sm">${brl(p.amount_cents / 100)}</p>
          <p class="text-xs text-white/30 mt-0.5">Vencimento ${formatDate(p.due_date)}${p.paid_at ? ` · Pago em ${formatDate(p.paid_at)}` : ''}</p>
        </div>
        <div class="flex items-center gap-3">
          <span class="badge ${INSTALLMENT_BADGE_CLASS[p.status] || 'badge-locked'}">${p.status === 'paid' ? 'Pago' : p.status === 'overdue' ? 'Em atraso' : 'Pendente'}</span>
          ${canPay ? `<a ${externalLinkAttrs(p.sumup_link_url)} class="btn-primary" style="padding:8px 16px;font-size:12px;">Pagar agora ↗</a>` : ''}
        </div>
      </div>
      <div class="flex items-center justify-between flex-wrap gap-3 mt-3 pt-3" style="border-top:1px dashed var(--line);">
        <p class="text-xs text-white/30">Nota Fiscal <span class="badge ${NF_BADGE_CLASS[nfStatus]}">${NF_STATUS_LABEL[nfStatus]}</span></p>
        ${nfStatus === 'not_requested'
          ? `<button data-request-nf="${p.id}" class="btn-text">Solicitar Nota Fiscal</button>`
          : nfStatus === 'requested'
            ? '<span class="text-xs text-white/20">Solicitada — a equipe vai emitir em breve</span>'
            : isValidHttpUrl(p.invoice?.signedUrl)
              ? `<a ${externalLinkAttrs(p.invoice.signedUrl)} class="btn-text">Ver Nota Fiscal</a>`
              : ''}
      </div>
    </div>
  `;
}

async function render() {
  const { data: contract } = await supabase.from('contracts').select('*').eq('client_id', clientId).order('created_at', { ascending: false }).limit(1).maybeSingle();

  if (!contract) {
    content.innerHTML = `
      <div class="mb-8">
        <p class="text-white/40 text-sm mb-1">Financeiro</p>
        <h1 class="text-3xl font-serif">Seu Contrato e Pagamentos</h1>
      </div>
      ${card('<p class="text-sm" style="color:var(--muted);">Seu plano financeiro ainda não está disponível — ele aparece aqui assim que seu contrato for preparado.</p>')}
    `;
    return;
  }

  const [{ lines, error: linesErr }, { data: payments }] = await Promise.all([
    loadActiveObligations({ contractId: contract.id }),
    supabase.from('payments').select('*, invoice:payment_invoices(*)').eq('client_id', clientId).order('due_date', { ascending: false }),
  ]);
  // invoice.file_url is a private Storage path (client-uploads bucket) —
  // resolve a short-lived signed URL per row before rendering, same
  // reasoning as client/images.js/homework.js.
  await Promise.all((payments || []).map(async (p) => {
    if (!p.invoice?.file_url) return;
    const { data } = await supabase.storage.from('client-uploads').createSignedUrl(p.invoice.file_url, 3600);
    if (data?.signedUrl) p.invoice.signedUrl = data.signedUrl;
  }));

  const { aReceberCents, emAtrasoCents } = summarizeObligations(lines || []);
  const recebidoCents = (payments || []).filter((p) => p.status === 'paid').reduce((s, p) => s + p.amount_cents, 0);
  const nextDue = (lines || []).filter((l) => l.effective_status !== 'paid').sort((a, b) => new Date(a.due_date) - new Date(b.due_date))[0];

  content.innerHTML = `
    <div class="mb-8">
      <p class="text-white/40 text-sm mb-1">Financeiro</p>
      <h1 class="text-3xl font-serif">Seu Contrato e Pagamentos</h1>
    </div>

    ${card(`
      <p class="text-sm text-white/50 mb-4">Resumo</p>
      <div class="grid sm:grid-cols-2 gap-4 text-sm">
        <div><p class="text-white/40 text-xs mb-1">Valor Contratado</p><p class="text-xl font-serif">${contract.value_cents != null ? brl(contract.value_cents / 100) : '—'}</p></div>
        <div><p class="text-white/40 text-xs mb-1">Já Pago</p><p class="text-xl font-serif">${brl(recebidoCents / 100)}</p></div>
        <div><p class="text-white/40 text-xs mb-1">Falta Pagar</p><p class="text-xl font-serif">${brl(aReceberCents / 100)}</p></div>
        <div>
          <p class="text-white/40 text-xs mb-1">Próximo Vencimento</p>
          <p class="text-xl font-serif">${nextDue ? formatDate(nextDue.due_date) : 'Tudo em dia ✦'}</p>
        </div>
      </div>
      ${emAtrasoCents > 0 ? `<p class="text-sm mt-4" style="color:var(--terracotta);">⚠ ${brl(emAtrasoCents / 100)} em atraso</p>` : ''}
    `, 'mb-8')}

    ${linesErr ? '' : card(`
      <p class="text-sm text-white/50 mb-1">Parcelas do Plano Atual</p>
      ${lines && lines.length ? lines.sort((a, b) => new Date(a.due_date) - new Date(b.due_date)).map(installmentRow).join('') : '<p class="text-sm mt-3" style="color:var(--muted);">Nenhuma parcela registrada ainda.</p>'}
    `, 'mb-8')}

    ${card(`
      <p class="text-sm text-white/50 mb-1">Histórico de Pagamentos</p>
      ${payments && payments.length ? payments.map(paymentHistoryRow).join('') : '<p class="text-sm mt-3" style="color:var(--muted);">Nenhum pagamento registrado ainda.</p>'}
    `)}
  `;

  content.querySelectorAll('[data-request-nf]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const { error } = await supabase.from('payment_invoices').insert({ payment_id: btn.dataset.requestNf, status: 'requested' });
      if (error) { toast('Não foi possível solicitar agora.', { tone: 'error' }); return; }
      toast('Nota fiscal solicitada — a equipe vai emitir em breve.');
      render();
    });
  });
}

render();
