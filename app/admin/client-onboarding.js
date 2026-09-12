// Real client onboarding action panel — Production Migration Batch 5.
// Reached from admin/crm.js's real Clientes list (production only).
// Every action here reuses existing, already-real infrastructure — no
// second invitation/contract/token system:
//   - registration link: generate-registration-link Edge Function (new
//     this batch, narrow: only (re)issues a token for a client that
//     already exists — client creation itself stays in
//     create-client-registration).
//   - contract: the existing admin/contract.js (real, already handles
//     Autentique send/status) — this page only creates the initial empty
//     `contracts` row if one doesn't exist yet (the old MockDB-lead-
//     conversion flow used to do this; a client created directly via
//     "Novo Cliente" has no lead to convert from), then hands off.
//   - invite: the existing invite-client Edge Function, unchanged.
// Available to both admin and assistant — every action here (client read,
// token issuance, contract-row creation, invite) is already permitted to
// both roles at the RLS/Edge-Function level; this page doesn't add a new
// restriction beyond what already exists (see the delivery report for the
// one real boundary found: `profiles` is admin-only readable, which is why
// activation state is derived from clients.access_status instead, already
// readable by both roles).
import { getCurrentProfile, signOut } from '../shared/supabase-auth.js';
import { supabase } from '../shared/supabase-client.js';
import { renderShell, card, toast, openModal, formatDateTime } from '../shared/ui.js';
import { deriveClientStatus, NEXT_ACTION_LABEL } from '../shared/client-status.js';

const clientId = new URLSearchParams(location.search).get('id');

const profile = await getCurrentProfile();
if (!profile || !['admin', 'assistant'].includes(profile.role)) {
  await signOut();
  location.href = `../login.html?next=${encodeURIComponent(location.pathname + location.search)}`;
  throw new Error('not authorized');
}
document.body.innerHTML = renderShell({ role: profile.role, active: profile.role === 'assistant' ? 'leads.html' : 'crm.html', title: 'Onboarding' });
const content = document.getElementById('app-content');

if (!clientId) {
  content.innerHTML = card('<p class="text-sm" style="color:var(--terracotta);">Falta o parâmetro ?id= na URL.</p>');
  throw new Error('missing client id');
}

const TIER_LABEL = { premium: 'Premium', essential: 'Essential' };
const CONTRACT_STATUS_LABEL = {
  info_pending: 'Aguardando informações comerciais', info_received: 'Informações recebidas',
  contract_prepared: 'Contrato preparado', sent_for_signature: 'Enviado para assinatura externa',
  awaiting_signature: 'Aguardando assinatura', signed: 'Assinado', completed: 'Concluído',
};

async function loadAll() {
  const [{ data: client }, { data: partyInfo }, { data: contract }, { data: tokens }] = await Promise.all([
    supabase.from('clients').select('*').eq('id', clientId).maybeSingle(),
    supabase.from('party_info').select('*').eq('client_id', clientId).maybeSingle(),
    supabase.from('contracts').select('*').eq('client_id', clientId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('client_registration_tokens').select('id, expires_at, consumed_at, created_at').eq('client_id', clientId).order('created_at', { ascending: false }).limit(1),
  ]);
  const latestToken = tokens?.[0] || null;
  const tokenActive = latestToken && !latestToken.consumed_at && new Date(latestToken.expires_at).getTime() > Date.now();
  return { client, partyInfo, contract, latestToken, tokenActive };
}

function openLinkModal(url, expiresAt) {
  const { el } = openModal({
    title: 'Link de cadastro',
    bodyHtml: `
      <p class="text-sm text-white/50 mb-4">Envie este link para a cliente concluir o cadastro. Expira em ${formatDateTime(expiresAt)} e só pode ser usado uma vez.</p>
      <div class="flex items-center gap-2">
        <input class="field text-sm" readonly value="${url}" />
        <button type="button" id="copy-reg-link" class="btn-ghost shrink-0">Copiar</button>
      </div>
    `,
  });
  el.querySelector('#copy-reg-link').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(url); toast('Link copiado.'); } catch { toast('Não foi possível copiar.', { tone: 'error' }); }
  });
}

let generatingLink = false;
async function generateLink(e) {
  // Same double-click guard as admin/crm.js's "Criar Cliente" — this
  // function always revokes any existing active token before issuing a
  // new one (that's its whole job), so firing it twice in a row would
  // silently burn a link the admin had just generated and not yet copied.
  if (generatingLink) return;
  generatingLink = true;
  const btn = e?.target;
  if (btn) btn.disabled = true;
  try {
    const { data, error } = await supabase.functions.invoke('generate-registration-link', { body: { client_id: clientId } });
    if (error || data?.error) { toast(data?.error || 'Não foi possível gerar o link agora.', { tone: 'error' }); return; }
    openLinkModal(data.registration_url, data.expires_at);
    render();
  } finally {
    generatingLink = false;
    if (btn) btn.disabled = false;
  }
}

async function prepareContract(client) {
  const { error } = await supabase.from('contracts').insert({ client_id: clientId, status: 'info_pending' });
  if (error) { toast('Não foi possível preparar o contrato agora.', { tone: 'error' }); return; }
  location.href = `contract.html?client_id=${clientId}`;
}

async function sendInvite() {
  if (!confirm('Isto envia um convite real de acesso por e-mail para a cliente. Confirmar?')) return;
  const { data, error } = await supabase.functions.invoke('invite-client', { body: { client_id: clientId } });
  if (error || data?.error) { toast(data?.error || 'Não foi possível enviar o convite agora.', { tone: 'error' }); return; }
  toast('Convite enviado.');
  render();
}

function partyInfoSummary(info) {
  if (!info) return '';
  const isPJ = info.party_type === 'PJ';
  const rows = [
    ['Nome', info.full_name], ['Tipo', isPJ ? 'Pessoa Jurídica' : 'Pessoa Física'],
    [isPJ ? 'CNPJ' : 'CPF', isPJ ? info.cnpj : info.cpf], ['Email', info.email], ['WhatsApp', info.whatsapp],
    ['Endereço', [info.street, info.number, info.neighborhood, info.city, info.state].filter(Boolean).join(', ') || null],
  ].filter(([, v]) => v);
  return card(`
    <p class="text-sm text-white/50 mb-3">Informações do Cadastro</p>
    <div class="grid sm:grid-cols-2 gap-3">
      ${rows.map(([label, value]) => `<div><p class="text-xs text-white/30">${label}</p><p class="text-sm">${value}</p></div>`).join('')}
    </div>
  `, 'mb-6');
}

function registrationLinkCard({ tokenActive, latestToken }) {
  if (tokenActive) {
    return card(`
      <div class="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p class="text-sm text-white/50 mb-1">Link de Cadastro</p>
          <p class="text-xs" style="color:var(--muted);">Ativo — expira em ${formatDateTime(latestToken.expires_at)}. Por segurança, o link em si só é exibido no momento em que é gerado.</p>
        </div>
        <button id="regenerate-link" class="btn-ghost">Gerar novo link</button>
      </div>
    `, 'mb-6');
  }
  return card(`
    <div class="flex items-center justify-between flex-wrap gap-3">
      <p class="text-sm text-white/50">Nenhum link de cadastro ativo${latestToken ? ' — o anterior expirou ou já foi utilizado' : ''}.</p>
      <button id="generate-link" class="btn-primary" style="padding:9px 18px;font-size:12.5px;">Gerar link de cadastro</button>
    </div>
  `, 'mb-6');
}

function nextActionCard(nextAction) {
  if (!nextAction) return '';
  const label = NEXT_ACTION_LABEL[nextAction];
  return card(`
    <p class="text-xs uppercase mb-2" style="color:var(--gold); letter-spacing:.12em;">Próxima Ação</p>
    <p class="text-lg font-serif">${label}</p>
  `, 'mb-6');
}

// Admin-only, matching delete-client's own role check — this is more
// destructive than anything else on this page (real login, contrato,
// pagamentos, cadastro, tudo) so it gets a tighter bar than the
// admin/assistant-shared actions above.
function dangerZoneCard() {
  if (profile.role !== 'admin') return '';
  return card(`
    <div class="flex items-center justify-between flex-wrap gap-3">
      <div>
        <p class="text-sm" style="color:var(--terracotta);">Zona de Risco</p>
        <p class="text-xs mt-1" style="color:var(--muted);">Exclui permanentemente esta cliente e todos os dados relacionados (contrato, pagamentos, cadastro, acesso, questionários, tarefas, imagens, direção de marca, análise de valor). Não pode ser desfeito.</p>
      </div>
      <button id="delete-client" class="btn-ghost" style="border-color:var(--error); color:var(--error);">Excluir Cliente</button>
    </div>
  `, 'mb-6');
}

function openDeleteClientModal(client) {
  const { el, close } = openModal({
    title: 'Excluir Cliente — Ação Irreversível',
    bodyHtml: `
      <p class="text-sm text-white/70 mb-3">Você está prestes a excluir <strong>${client.full_name}</strong> permanentemente.</p>
      <p class="text-sm text-white/50 mb-4">Isto remove definitivamente: contrato, pagamentos, cadastro, acesso de login (se existir), questionários, tarefas, imagens, direção de marca, análise de valor e todo o restante ligado a esta cliente. Não há como desfazer esta ação.</p>
      <label class="text-xs text-white/40 block mb-1">Digite <strong>DELETE</strong> para confirmar</label>
      <input id="delete-confirm-input" class="field" autocomplete="off" />
      <div class="flex justify-end gap-3 pt-4">
        <button type="button" id="cancel-delete" class="btn-ghost">Cancelar</button>
        <button type="button" id="confirm-delete" class="btn-primary" style="background:var(--error); border-color:var(--error);" disabled>Excluir Permanentemente</button>
      </div>
    `,
  });
  const input = el.querySelector('#delete-confirm-input');
  const confirmBtn = el.querySelector('#confirm-delete');
  input.addEventListener('input', () => { confirmBtn.disabled = input.value !== 'DELETE'; });
  el.querySelector('#cancel-delete').addEventListener('click', close);
  confirmBtn.addEventListener('click', async () => {
    if (input.value !== 'DELETE') return;
    confirmBtn.disabled = true;
    confirmBtn.textContent = 'Excluindo…';
    const { data, error } = await supabase.functions.invoke('delete-client', { body: { client_id: clientId, confirm: 'DELETE' } });
    if (error || data?.error) {
      toast(data?.error || 'Não foi possível excluir agora.', { tone: 'error' });
      confirmBtn.disabled = false;
      confirmBtn.textContent = 'Excluir Permanentemente';
      return;
    }
    close();
    toast(`${data.deleted_full_name} foi excluída permanentemente.`);
    location.href = 'crm.html';
  });
}

async function render() {
  const { client, partyInfo, contract, latestToken, tokenActive } = await loadAll();
  if (!client) { content.innerHTML = card('<p class="text-sm" style="color:var(--terracotta);">Cliente não encontrada.</p>'); return; }

  const status = deriveClientStatus({
    accessStatus: client.access_status,
    partyInfoSubmitted: !!partyInfo?.submitted,
    contractStatus: contract?.status || null,
  });

  content.innerHTML = `
    <div class="mb-8">
      <p class="text-white/40 text-sm mb-1">Onboarding</p>
      <div class="flex items-center gap-3 flex-wrap mb-1">
        <h1 class="text-3xl font-serif">${client.full_name}</h1>
        <span class="badge ${status.badgeClass}">${status.label}</span>
      </div>
      <p class="text-sm text-white/40">${client.email || 'sem e-mail'} · ${TIER_LABEL[client.tier] || client.tier}</p>
    </div>

    ${nextActionCard(status.nextAction)}

    ${!partyInfo?.submitted ? registrationLinkCard({ tokenActive, latestToken }) : ''}

    ${partyInfo?.submitted ? partyInfoSummary(partyInfo) : ''}

    ${partyInfo?.submitted ? card(`
      <div class="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p class="text-sm text-white/50 mb-1">Contrato</p>
          <p class="text-xs" style="color:var(--muted);">${contract ? (CONTRACT_STATUS_LABEL[contract.status] || contract.status) : 'Nenhum contrato preparado ainda.'}</p>
        </div>
        ${!contract
          ? `<button id="prepare-contract" class="btn-primary" style="padding:9px 18px;font-size:12.5px;">Preparar contrato</button>`
          : `<a href="contract.html?client_id=${clientId}" class="btn-ghost">${['signed', 'completed'].includes(contract.status) ? 'Ver contrato' : 'Acompanhar contrato'}</a>`}
      </div>
    `, 'mb-6') : ''}

    ${status.nextAction === 'send_invite' ? card(`
      <div class="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p class="text-sm text-white/50 mb-1">Acesso</p>
          <p class="text-xs" style="color:var(--muted);">Contrato assinado — envie o convite de acesso real para a cliente entrar em app.naymurta.com.</p>
        </div>
        <button id="send-invite" class="btn-primary" style="padding:9px 18px;font-size:12.5px;">Enviar convite de acesso</button>
      </div>
    `, 'mb-6') : ''}

    ${dangerZoneCard()}
  `;

  content.querySelector('#generate-link')?.addEventListener('click', generateLink);
  content.querySelector('#regenerate-link')?.addEventListener('click', generateLink);
  content.querySelector('#prepare-contract')?.addEventListener('click', () => prepareContract(client));
  content.querySelector('#send-invite')?.addEventListener('click', sendInvite);
  content.querySelector('#delete-client')?.addEventListener('click', () => openDeleteClientModal(client));
}

render();
