// Financeiro (assistant) — narrower than Nay's business-wide Financeiro
// (admin/financial.js has revenue/forecast/by-program; that's Nay's money
// view). This is the one duty that's actually the assistant's: upload the
// Nota Fiscal for a payment and have it land on the client's own profile —
// see MockDB.issueInvoice, which now accepts a real uploaded file.
import { MockDB, NF_STATUS_LABEL, PAYMENT_METHOD_LABEL, PAYMENT_STATUS_LABEL } from '../shared/mock-db.js';
import { renderShell, card, toast, formatDate, isValidAssetSrc, assetLinkAttrs, brl } from '../shared/ui.js';
import { requireProfile } from '../shared/supabase-auth.js';
import { loadHublaPendingClients, markHublaAccessGranted } from '../shared/hubla-model.js';

if (!(await requireProfile('assistant'))) throw new Error('not authorized');
document.body.innerHTML = renderShell({ role: 'assistant', active: 'financial.html', title: 'Financeiro' });
const content = document.getElementById('app-content');

const NF_BADGE_CLASS = { not_requested: 'badge-locked', requested: 'badge-progress', issued: 'badge-completed' };
const PAYMENT_BADGE_CLASS = { paid: 'badge-completed', pending: 'badge-progress', overdue: 'badge-locked' };

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// A client can pay through more than one method at once (part card, part
// Pix) — NF is still owed automatically if card is any part of that mix.
function soldOnCard(contract) {
  return (contract.paymentMethods && contract.paymentMethods.length ? contract.paymentMethods : [contract.paymentMethod]).includes('cartao_credito');
}

function rowsAcrossClients() {
  return MockDB.listClients().flatMap((c) => {
    const contract = MockDB.getOnboarding(c.id).contract;
    return MockDB.getPayments(c.id).map((p) => ({ client: c, contract, payment: p }));
  });
}

function paymentRow({ client, contract, payment: p }) {
  const owed = p.nf.status !== 'issued' && (p.nf.status === 'requested' || soldOnCard(contract));
  const fileOk = isValidAssetSrc(p.nf.fileUrl);
  const methods = contract.paymentMethods && contract.paymentMethods.length ? contract.paymentMethods : (contract.paymentMethod ? [contract.paymentMethod] : []);
  return `
    <div class="flex items-center justify-between flex-wrap gap-3 py-3 border-b border-white/5 last:border-0">
      <div>
        <a href="client-workspace.html?id=${client.id}" class="text-sm font-medium hover:underline">${client.fullName}</a>
        <p class="text-xs text-white/30 mt-0.5">
          ${brl(p.amount)} · vencimento ${formatDate(p.dueDate)}
          ${methods.length ? ` · ${methods.map((m) => PAYMENT_METHOD_LABEL[m]).join(' + ')}` : ''}
          <span class="badge ${PAYMENT_BADGE_CLASS[p.status]}" style="font-size:9px; margin-left:6px;">${PAYMENT_STATUS_LABEL[p.status]}</span>
        </p>
      </div>
      <div class="flex items-center gap-3">
        <span class="badge ${NF_BADGE_CLASS[p.nf.status]}">${NF_STATUS_LABEL[p.nf.status]}</span>
        ${fileOk ? `<a ${assetLinkAttrs(p.nf.fileUrl)} class="btn-text">Ver arquivo</a>` : ''}
        ${owed ? `
          <label class="btn-ghost" style="padding:7px 14px;font-size:12px;cursor:pointer;">
            Enviar Nota Fiscal
            <input type="file" accept="application/pdf,image/*" data-nf-upload="${client.id}:${p.id}" class="hidden" />
          </label>
        ` : ''}
      </div>
    </div>
  `;
}

// Hubla exposes no API to grant access (checked directly against their
// docs) — only a manual "Adicionar membro(s)" action inside Hubla itself.
// This can't automate that step, but it removes the part that was actually
// eating your time: knowing who's waiting. Once the grant happens in
// Hubla, hubla-webhook's own customer.member_added handling flips this
// status automatically — "Marcar como concedido" below is a manual
// fallback for confirming a grant that predates the webhook.
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
function renderHublaPendingCard({ clients, error }) {
  // Always visible — even (especially) when the queue is empty. A card
  // that only appears once there's a pendency has no fixed home to check
  // back on; showing an explicit "tudo em dia" state is what makes this
  // feature findable at all on a normal day.
  return card(`
    <div class="flex items-center justify-between mb-2">
      <p class="text-sm text-white/50">Acessos Hubla Pendentes</p>
      ${clients.length ? `<span class="text-xs" style="color:var(--muted);">${clients.length}</span>` : ''}
    </div>
    <p class="text-xs text-white/20 mb-3 max-w-2xl">Clientes ativas sem acesso ao Hubla ainda. Copie o e-mail e adicione em Hubla → Produto → Membros → Adicionar membro(s) gratuito(s). O status aqui atualiza sozinho assim que a Hubla confirmar o acesso.</p>
    ${error ? `<p class="text-sm" style="color:var(--terracotta);">Não foi possível carregar: ${error}</p>`
      : clients.length ? clients.map(hublaPendingRow).join('')
      : '<p class="text-sm" style="color:var(--gold);">Nenhuma pendência — todo mundo ativa já tem acesso.</p>'}
  `, 'mb-6');
}

async function render() {
  const rows = rowsAcrossClients();
  const owed = rows.filter(({ contract, payment: p }) => p.nf.status !== 'issued' && (p.nf.status === 'requested' || soldOnCard(contract)));
  const rest = rows.filter((r) => !owed.includes(r));
  const hublaPending = await loadHublaPendingClients();

  content.innerHTML = `
    <div class="mb-8">
      <p class="text-white/40 text-sm mb-1">Financeiro</p>
      <h1 class="text-3xl font-serif mb-3">Notas Fiscais</h1>
      <p class="text-sm text-white/40 max-w-2xl">Emita sempre que a cliente solicitar, ou automaticamente quando a venda foi no cartão de crédito. O arquivo enviado aqui fica disponível para a cliente no Financeiro dela.</p>
    </div>
    ${renderHublaPendingCard(hublaPending)}
    ${card(`
      <p class="text-sm text-white/50 mb-1">Pendentes de Emissão</p>
      <p class="text-xs text-white/20 mb-2">${owed.length} pendência${owed.length === 1 ? '' : 's'}</p>
      ${owed.length ? owed.map(paymentRow).join('') : '<p class="text-sm mt-3" style="color:var(--gold);">Nada pendente de emissão.</p>'}
    `, 'mb-6')}
    ${rest.length ? card(`
      <p class="text-sm text-white/50 mb-1">Todos os Pagamentos</p>
      <div class="mt-2">${rest.map(paymentRow).join('')}</div>
    `) : ''}
  `;

  content.querySelectorAll('[data-nf-upload]').forEach((input) => {
    input.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      if (file.size > 8 * 1024 * 1024) { toast('Arquivo passa de 8MB.', { tone: 'error' }); e.target.value = ''; return; }
      const [clientId, paymentId] = input.dataset.nfUpload.split(':');
      const dataUrl = await fileToDataUrl(file);
      MockDB.issueInvoice(clientId, paymentId, { fileName: file.name, fileUrl: dataUrl });
      toast('Nota fiscal enviada — disponível no Financeiro da cliente.');
      render();
    });
  });
  content.querySelectorAll('[data-copy-hubla-email]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(btn.dataset.copyHublaEmail);
        toast('E-mail copiado.');
      } catch {
        toast('Não foi possível copiar automaticamente — selecione o e-mail manualmente.', { tone: 'error' });
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
}

render();
