// Real payment automation (SumUp) — Nova Cobrança, list, detail,
// reconciliation. Standalone page for now (not yet wired into the mock
// admin nav, same status as contract.html), reached via a link from the
// existing Financeiro tab/page. See supabase/functions/sumup-* for the
// actual SumUp API calls (never made from the browser).
import { supabase } from '../shared/supabase-client.js';
import { getCurrentProfile, signOut } from '../shared/supabase-auth.js';
import { card, toast, openModal, formatDate, formatDateTime } from '../shared/ui.js';
import { deriveEffectiveStatus } from '../shared/date-utils.js';

const content = document.getElementById('app-content');

const STATUS_LABEL = {
  draft: 'Rascunho', pending: 'Aguardando pagamento', paid: 'Pago', overdue: 'Em atraso',
  failed: 'Falhou', cancelled: 'Cancelado', expired: 'Expirado', refunded: 'Reembolsado',
};
const STATUS_CLASS = {
  draft: 'badge-locked', pending: 'badge-progress', paid: 'badge-completed', overdue: 'badge-locked',
  failed: 'badge-locked', cancelled: 'badge-locked', expired: 'badge-locked', refunded: 'badge-locked',
};
const CURRENCIES = ['BRL', 'EUR', 'USD', 'GBP'];

const profile = await getCurrentProfile();
if (!profile || !['admin', 'assistant'].includes(profile.role)) {
  // Sign out before redirecting — see supabase-auth.js's requireProfile for
  // why: this stops a stale/racing session from bouncing us right back.
  await signOut();
  location.href = `../login.html?next=${encodeURIComponent(location.pathname + location.search)}`;
  throw new Error('not authorized');
}

// Optionally scoped to one client, linked in from her Financeiro tab (which
// only knows her legacy mock id — resolve it here, same pattern as contract.js).
const params = new URLSearchParams(location.search);
let filterClientId = params.get('client_id');
const legacyId = params.get('legacy_id');
if (!filterClientId && legacyId) {
  const { data: resolved } = await supabase.from('clients').select('id').eq('legacy_id', legacyId).maybeSingle();
  filterClientId = resolved?.id || null;
}

// A specific installment can be handed in from elsewhere (e.g. the CRM's
// Financeiro tab, which still tracks its own payment-plan installments in
// mock data) via ?prefill_amount=&prefill_due=&prefill_desc= — takes
// precedence over the generic "oldest pending charge" guess below, since
// it names the exact installment Nay clicked. ?open=charge auto-opens the
// Nova Cobrança modal with it, once, so the click really does land her
// straight on a pre-filled form instead of just the page.
const prefillAmount = params.get('prefill_amount');
const urlPrefill = prefillAmount ? {
  amount_cents: Math.round(parseFloat(prefillAmount) * 100),
  currency: 'BRL',
  description: params.get('prefill_desc') || '',
  due_date: params.get('prefill_due') || '',
} : null;
const autoOpenCharge = params.get('open') === 'charge';
if (urlPrefill || autoOpenCharge) {
  // Clean the URL so a refresh/close doesn't keep re-triggering it.
  params.delete('prefill_amount'); params.delete('prefill_desc'); params.delete('prefill_due'); params.delete('open');
  const clean = params.toString();
  history.replaceState(null, '', location.pathname + (clean ? `?${clean}` : ''));
}
let autoOpened = false;

const brl = (cents, currency = 'BRL') => (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency });

async function loadPayments() {
  let query = supabase.from('payments').select('*, clients(id, full_name, program_slug, is_demo)').order('created_at', { ascending: false });
  if (filterClientId) query = query.eq('client_id', filterClientId);
  const { data, error } = await query;
  if (error) { toast(error.message, { tone: 'error' }); return []; }
  // Production Audit Remediation Pass (Medium — real "Em Atraso"): derived
  // at read time, same rule as MockDB's getPayments — the stored status
  // stays 'pending' until actually paid; overdue is only ever a computed
  // view, recalculated on every load, never a manually-set flag.
  return (data || []).map((p) => ({ ...p, status: deriveEffectiveStatus(p.status, p.due_date) }));
}

async function loadClients() {
  const { data } = await supabase.from('clients').select('id, full_name').order('full_name');
  return data || [];
}

function computeKPIs(payments) {
  // Mock rows AND any is_demo client's rows are excluded from real
  // financial totals by design — they exist purely to test the flow, never
  // to be confused with real revenue. Checking is_demo too (not just
  // provider==='sumup') is a second safety net: a seeded/demo row can end
  // up tagged provider='sumup' from old test data without ever having gone
  // through a real checkout — this catches that case even if it recurs.
  const real = payments.filter((p) => p.provider === 'sumup' && !p.clients?.is_demo);
  const recebido = real.filter((p) => p.status === 'paid').reduce((s, p) => s + p.amount_cents, 0);
  const aReceber = real.filter((p) => ['pending', 'overdue'].includes(p.status)).reduce((s, p) => s + p.amount_cents, 0);
  return { recebido, aReceber };
}

function renderKPIs(payments) {
  const { recebido, aReceber } = computeKPIs(payments);
  const mockCount = payments.filter((p) => p.provider === 'mock').length;
  return `
    <div class="grid sm:grid-cols-2 gap-4 mb-6">
      ${card(`<p class="text-2xl font-serif">${brl(recebido)}</p><p class="text-white/40 text-xs mt-1">Valor Recebido</p>`)}
      ${card(`<p class="text-2xl font-serif">${brl(aReceber)}</p><p class="text-white/40 text-xs mt-1">A Receber</p>`)}
    </div>
    ${mockCount ? `<p class="text-xs mb-6" style="color:var(--muted);">${mockCount} cobrança${mockCount === 1 ? '' : 's'} em modo de teste (não contam nos totais acima) — SumUp ainda não conectado com credenciais reais.</p>` : ''}
  `;
}

// A payment can already exist (seeded installment plan, manually-tracked
// charge) without ever having a real SumUp link yet — this is the normal
// starting state for most of the payment history already in the system,
// not an edge case.
const needsLink = (p) => ['pending', 'overdue'].includes(p.status) && !p.sumup_checkout_id;

function paymentRow(p) {
  const client = p.clients;
  const isMock = p.provider === 'mock';
  return `
    <div class="flex items-center justify-between gap-4 py-3 border-b border-white/5 last:border-0 flex-wrap">
      <div>
        <p class="text-sm font-medium">${client?.full_name || '—'} ${isMock ? '<span class="badge badge-locked" style="font-size:9px;">TESTE</span>' : ''}</p>
        <p class="text-xs text-white/30 mt-0.5">${p.description || '—'} · ${brl(p.amount_cents, p.currency)} · vence ${formatDate(p.due_date)}</p>
      </div>
      <div class="flex items-center gap-3">
        <span class="badge ${STATUS_CLASS[p.status] || 'badge-locked'}">${STATUS_LABEL[p.status] || p.status}</span>
        ${needsLink(p) ? `<button data-gen-link="${p.id}" class="btn-ghost">Gerar Link</button>` : ''}
        <button data-detail="${p.id}" class="btn-text">Ver detalhes</button>
      </div>
    </div>
  `;
}

// Shown after a checkout is successfully created — a copy-link step, not an
// auto-close, since the whole point of generating the link is to then hand
// it to the client (WhatsApp, e-mail, etc.), and that has to happen before
// the URL disappears from view.
function showLinkModal(hostedUrl, isMock) {
  const { el, close } = openModal({
    title: 'Link de Pagamento Gerado',
    bodyHtml: `
      ${isMock ? `<p class="text-xs mb-3" style="color:var(--terracotta);">⚠ Modo de teste — SumUp não conectado, este link não é real.</p>` : ''}
      <p class="text-sm text-white/50 mb-2">Copie o link abaixo e envie para a cliente.</p>
      <input type="text" readonly class="field mb-4" value="${hostedUrl}" onclick="this.select()" />
      <div class="flex items-center gap-3">
        <button id="copy-link-modal" class="btn-primary">Copiar Link</button>
        <a href="${hostedUrl}" target="_blank" rel="noopener" class="btn-ghost">Abrir link ↗</a>
        <button id="close-link-modal" class="btn-text ml-auto">Fechar</button>
      </div>
    `,
  });
  el.querySelector('#copy-link-modal').addEventListener('click', () => {
    navigator.clipboard.writeText(hostedUrl);
    toast('Link copiado.');
  });
  el.querySelector('#close-link-modal').addEventListener('click', close);
}

async function generateLinkForExisting(paymentId, onDone, btn) {
  if (btn) { btn.disabled = true; btn.textContent = 'Gerando...'; }
  const { data, error } = await supabase.functions.invoke('sumup-create-checkout', { body: { payment_id: paymentId } });
  if (error || data?.error) { toast(data?.error || error.message, { tone: 'error' }); if (btn) { btn.disabled = false; btn.textContent = 'Gerar Link'; } return; }
  onDone();
  showLinkModal(data.hosted_url, data.mock);
}

async function openNewChargeModal(clients, prefill, onDone) {
  const amountReais = prefill ? (prefill.amount_cents / 100).toFixed(2) : '';
  const { el, close } = openModal({
    title: 'Nova Cobrança',
    bodyHtml: `
      <form id="new-charge-form" class="space-y-4">
        ${prefill ? `<p class="text-xs" style="color:var(--muted);">Valores sugeridos a partir da próxima cobrança pendente já registrada.</p>` : ''}
        <div>
          <label class="text-xs text-white/40 block mb-1">Cliente</label>
          <select name="client_id" required class="field">
            <option value="">Selecione...</option>
            ${clients.map((c) => `<option value="${c.id}" ${c.id === filterClientId ? 'selected' : ''}>${c.full_name}</option>`).join('')}
          </select>
        </div>
        <div id="program-hint" class="text-xs" style="color:var(--muted);"></div>
        <div>
          <label class="text-xs text-white/40 block mb-1">Descrição</label>
          <input name="description" class="field" placeholder="Ex.: Parcela 2 — Persea Premium" value="${prefill?.description || ''}" />
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="text-xs text-white/40 block mb-1">Valor</label>
            <input name="amount" type="number" min="0.01" step="0.01" required class="field" placeholder="0,00" value="${amountReais}" />
          </div>
          <div>
            <label class="text-xs text-white/40 block mb-1">Moeda</label>
            <select name="currency" class="field">${CURRENCIES.map((c) => `<option value="${c}" ${c === (prefill?.currency || 'BRL') ? 'selected' : ''}>${c}</option>`).join('')}</select>
          </div>
        </div>
        <div>
          <label class="text-xs text-white/40 block mb-1">Vencimento</label>
          <input name="due_date" type="date" class="field" value="${prefill?.due_date || new Date().toISOString().slice(0, 10)}" />
        </div>
        <div>
          <label class="text-xs text-white/40 block mb-1">Nota interna (opcional)</label>
          <textarea name="internal_note" rows="2" class="field"></textarea>
        </div>
        <button type="submit" class="btn-primary block w-full text-center" style="padding-top:10px;padding-bottom:10px;">Gerar link de pagamento</button>
      </form>
    `,
  });

  el.querySelector('[name="client_id"]').addEventListener('change', async (e) => {
    const hint = el.querySelector('#program-hint');
    hint.textContent = '';
    if (!e.target.value) return;
    const { data: contract } = await supabase.from('contracts').select('program, duration, value_cents').eq('client_id', e.target.value).maybeSingle();
    if (contract?.program) {
      hint.textContent = `Programa: ${contract.program}${contract.duration ? ' / ' + contract.duration : ''}${contract.value_cents ? ' · Valor do contrato: ' + brl(contract.value_cents) : ''}`;
    }
  });

  el.querySelector('#new-charge-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const clientId = fd.get('client_id');
    if (!clientId) { toast('Selecione uma cliente.', { tone: 'error' }); return; }
    const amountCents = Math.round(parseFloat(fd.get('amount')) * 100);
    if (!amountCents || amountCents <= 0) { toast('Informe um valor válido.', { tone: 'error' }); return; }

    const { data: contract } = await supabase.from('contracts').select('id').eq('client_id', clientId).maybeSingle();
    const submitBtn = e.target.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Gerando...';

    const { data, error } = await supabase.functions.invoke('sumup-create-checkout', {
      body: {
        client_id: clientId, contract_id: contract?.id || null, description: fd.get('description') || null,
        amount_cents: amountCents, currency: fd.get('currency'), due_date: fd.get('due_date') || null,
        internal_note: fd.get('internal_note') || null,
      },
    });
    if (error || data?.error) { toast(data?.error || error.message, { tone: 'error' }); submitBtn.disabled = false; submitBtn.textContent = 'Gerar link de pagamento'; return; }
    close();
    onDone();
    showLinkModal(data.hosted_url, data.mock);
  });
}

function openDetailModal(payment, onDone) {
  const client = payment.clients;
  const isMock = payment.provider === 'mock';
  const isPending = ['pending', 'overdue'].includes(payment.status);
  const { el } = openModal({
    title: 'Detalhes da Cobrança',
    bodyHtml: `
      <div class="space-y-2 text-sm mb-4">
        <p><span class="text-white/40">Cliente:</span> ${client?.full_name || '—'}</p>
        <p><span class="text-white/40">Descrição:</span> ${payment.description || '—'}</p>
        <p><span class="text-white/40">Valor:</span> ${brl(payment.amount_cents, payment.currency)}</p>
        <p><span class="text-white/40">Vencimento:</span> ${formatDate(payment.due_date)}</p>
        <p><span class="text-white/40">Criada em:</span> ${formatDateTime(payment.created_at)}</p>
        <p><span class="text-white/40">Status:</span> <span class="badge ${STATUS_CLASS[payment.status]}">${STATUS_LABEL[payment.status]}</span></p>
        ${payment.status === 'paid' ? `<p style="color:var(--gold);">✓ Pagamento confirmado${payment.paid_at ? ' em ' + formatDateTime(payment.paid_at) : ''}</p>` : ''}
        ${payment.sumup_transaction_id ? `<p><span class="text-white/40">Referência SumUp:</span> ${payment.sumup_transaction_id}</p>` : ''}
        ${payment.internal_note ? `<p><span class="text-white/40">Nota interna:</span> ${payment.internal_note}</p>` : ''}
        ${isMock ? `<p style="color:var(--terracotta);">⚠ Cobrança em modo de teste — não é um pagamento real.</p>` : ''}
      </div>
      <div class="flex flex-wrap items-center gap-3" id="detail-actions"></div>
    `,
  });

  const actions = el.querySelector('#detail-actions');
  if (isPending && !isMock && payment.sumup_link_url) {
    actions.innerHTML += `<button id="copy-link" class="btn-ghost">Copiar link</button><a href="${payment.sumup_link_url}" target="_blank" rel="noopener" class="btn-ghost">Abrir link ↗</a>`;
    actions.querySelector('#copy-link').addEventListener('click', () => {
      navigator.clipboard.writeText(payment.sumup_link_url);
      toast('Link copiado.');
    });
  }
  if (!isMock) {
    const verifyBtn = document.createElement('button');
    verifyBtn.className = 'btn-primary';
    verifyBtn.textContent = 'Verificar no SumUp';
    verifyBtn.addEventListener('click', async () => {
      verifyBtn.disabled = true; verifyBtn.textContent = 'Verificando...';
      const { data, error } = await supabase.functions.invoke('sumup-verify', { body: { payment_id: payment.id } });
      if (error || data?.error) { toast(data?.error || error.message, { tone: 'error' }); verifyBtn.disabled = false; verifyBtn.textContent = 'Verificar no SumUp'; return; }
      toast(data.already_processed ? 'Sem novidades — status já está atualizado.' : `Status atualizado: ${STATUS_LABEL[data.status] || data.status}`);
      onDone();
    });
    actions.appendChild(verifyBtn);
  } else if (isPending) {
    ['pay', 'fail', 'refund'].forEach((action) => {
      const btn = document.createElement('button');
      btn.className = 'btn-ghost';
      btn.textContent = { pay: 'Simular Pago', fail: 'Simular Falha', refund: 'Simular Reembolso' }[action];
      btn.addEventListener('click', async () => {
        const { data, error } = await supabase.functions.invoke('sumup-verify', { body: { payment_id: payment.id, mock_action: action } });
        if (error || data?.error) { toast(data?.error || error.message, { tone: 'error' }); return; }
        toast(`Simulado: ${STATUS_LABEL[data.status] || data.status}`);
        onDone();
      });
      actions.appendChild(btn);
    });
  }
}

async function render() {
  const [payments, clients] = await Promise.all([loadPayments(), loadClients()]);
  const scopedClient = filterClientId ? clients.find((c) => c.id === filterClientId) : null;

  // Opening a client's scoped view should answer "what do I charge her
  // next" at a glance, sourced from history already in the system —
  // rather than making Nay figure out the amount from scratch each time.
  const nextPending = scopedClient
    ? payments.filter(needsLink).sort((a, b) => (a.due_date || '').localeCompare(b.due_date || ''))[0]
    : null;
  const effectivePrefill = urlPrefill || nextPending;

  content.innerHTML = `
    <div class="mb-8 flex items-center justify-between flex-wrap gap-4">
      <div>
        <p class="text-white/40 text-sm mb-1">Financeiro</p>
        <h1 class="text-3xl font-serif">${scopedClient ? `Pagamentos — ${scopedClient.full_name}` : 'Pagamentos'}</h1>
        ${scopedClient ? `<a href="payments.html" class="btn-text">Ver todas as clientes →</a>` : ''}
      </div>
      <button id="new-charge" class="btn-primary">+ Nova Cobrança</button>
    </div>
    ${nextPending ? card(`
      <p class="text-sm text-white/50 mb-2">Próxima cobrança pendente</p>
      <div class="flex items-center justify-between flex-wrap gap-4">
        <div>
          <p class="text-xl font-serif">${brl(nextPending.amount_cents, nextPending.currency)}</p>
          <p class="text-xs text-white/30 mt-0.5">${nextPending.description || '—'} · vence ${formatDate(nextPending.due_date)}</p>
        </div>
        <button data-gen-link="${nextPending.id}" class="btn-primary">Gerar Link de Pagamento</button>
      </div>
    `, 'mb-6') : ''}
    ${renderKPIs(payments)}
    ${card(`
      <p class="text-sm text-white/50 mb-4">Histórico de Pagamentos${scopedClient ? '' : ' — Todas as Clientes'}</p>
      ${payments.length ? payments.map(paymentRow).join('') : '<p class="text-sm text-white/50">Nenhuma cobrança ainda.</p>'}
    `)}
  `;

  document.getElementById('new-charge').addEventListener('click', () => openNewChargeModal(clients, effectivePrefill, render));
  content.querySelectorAll('[data-detail]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const payment = payments.find((p) => p.id === btn.dataset.detail);
      openDetailModal(payment, render);
    });
  });
  content.querySelectorAll('[data-gen-link]').forEach((btn) => {
    btn.addEventListener('click', () => generateLinkForExisting(btn.dataset.genLink, render, btn));
  });

  if (autoOpenCharge && !autoOpened) {
    autoOpened = true;
    openNewChargeModal(clients, effectivePrefill, render);
  }
}

render();
