// Lead detail — single lead's profile, contact/interaction log, and the
// Nova Persea post-sale onboarding flow: Condições Comerciais -> Cadastro ->
// Contrato -> Ativar Cliente. All of it lives ON this lead record until
// activation actually creates a client row (see MockDB.activateLead) — no
// OS access exists before that. The original "Converter em Cliente" quick
// path is preserved further down (existing functionality, still available
// for edge cases), just no longer the primary action.
import {
  MockDB, LEAD_STAGES, LEAD_STAGE_LABEL, LEAD_SOURCES, LEAD_SOURCE_LABEL,
  VIP_GROUP_STATUSES, VIP_GROUP_STATUS_LABEL, PROGRAMS, PROGRAM_LABEL, SOCIAL_PLATFORMS, SOCIAL_PLATFORM_LABEL,
  PROGRAM_DEFS, PAYMENT_METHODS, PAYMENT_METHOD_LABEL, ONBOARDING_STAGE_LABEL,
  LEAD_ONBOARDING_STATUS_LABEL, LEAD_ONBOARDING_STATUS_BADGE_CLASS,
} from '../shared/mock-db.js';
import { renderShell, card, toast, formatDate, formatDateTime, openModal, renderSocialLinks, buildRegistrationLink } from '../shared/ui.js';
import { requireProfile } from '../shared/supabase-auth.js';

if (!(await requireProfile('admin'))) throw new Error('not authorized');
document.body.innerHTML = renderShell({ role: 'admin', active: 'crm.html' });
const content = document.getElementById('app-content');

const leadId = new URLSearchParams(location.search).get('id');
const STAGE_CLASS = {
  novo: 'badge-locked', engajado: 'badge-progress', em_conversa: 'badge-progress',
  proposta_enviada: 'badge-progress', convertido: 'badge-completed', perdido: 'badge-locked',
};
const stageBadge = (stage) => `<span class="badge ${STAGE_CLASS[stage] || 'badge-locked'}">${LEAD_STAGE_LABEL[stage] || stage}</span>`;
const brl = (n) => (n || n === 0) ? `R$ ${Number(n).toLocaleString('pt-BR')}` : '—';

function renderHeader(lead) {
  const pipelineBadge = lead.onboardingStatus
    ? `<span class="badge ${LEAD_ONBOARDING_STATUS_BADGE_CLASS[lead.onboardingStatus] || 'badge-locked'}">${MockDB.getLeadPipelineLabel(lead)}</span>`
    : stageBadge(lead.stage);
  return `
    <a href="crm.html?section=leads" class="btn-text mb-4 inline-block">&larr; Todos os leads</a>
    <div class="mb-6 flex items-start justify-between flex-wrap gap-3">
      <div>
        <h1 class="text-2xl font-serif">${lead.fullName || '(sem nome)'}</h1>
        <p class="text-white/40 text-sm">${lead.email || 'sem email'} · ${lead.phone || 'sem telefone'}</p>
      </div>
      ${pipelineBadge}
    </div>
    ${card(renderSocialLinks(lead.socialLinks, { emptyText: 'Nenhuma rede social cadastrada ainda — adicione abaixo.' }), 'mb-6')}
  `;
}

// --- 1. Condições Comerciais — Nay/team enter what was agreed on the call.
// The client never sees or edits this from her registration form. Payment
// terms are a free-form, ordered list of lines (same model used everywhere
// else this gets entered — client onboarding, real contract): any number
// of payments, each its own amount/method/optional date, in any
// combination — an entrada, a Pix deposit mid-plan, card installments,
// whatever was actually agreed. These lines carry straight onto the
// client's own Plano de Pagamento the moment she's activated (see
// MockDB.activateLead), so nobody re-types the schedule after this. -------
function commercialLineRowHtml(l = {}) {
  return `
    <div class="flex items-center gap-2 py-2 flex-wrap commercial-line-row">
      <input type="number" min="0" step="0.01" class="field text-sm" style="width:110px;" data-line-amount placeholder="Valor R$" value="${l.amount ?? ''}" />
      <select class="field text-sm" style="width:160px;" data-line-method>
        <option value="">Forma —</option>
        ${PAYMENT_METHODS.map((m) => `<option value="${m}" ${l.method === m ? 'selected' : ''}>${PAYMENT_METHOD_LABEL[m]}</option>`).join('')}
      </select>
      <input type="date" class="field text-sm" style="width:150px;" data-line-date value="${l.dueDate || ''}" />
      <input type="text" class="field text-sm" style="flex:1; min-width:110px;" data-line-label placeholder="Nota (opcional — ex.: Entrada)" value="${l.label || ''}" />
      <button type="button" class="btn-text" data-remove-line>Remover</button>
    </div>
  `;
}

function renderCommercialCard(lead) {
  const ct = lead.commercialTerms || {};
  const lines = ct.paymentLines?.length ? ct.paymentLines : [{}];
  return card(`
    <div class="flex items-center justify-between mb-1">
      <p class="text-sm text-white/50">Condições Comerciais</p>
      ${lead.onboardingStatus ? `<span class="text-xs" style="color:var(--gold);">Condições registradas${ct.saleAgreedAt ? ` em ${formatDate(ct.saleAgreedAt)}` : ''}</span>` : ''}
    </div>
    <p class="text-xs text-white/20 mb-4">Preenchido por quem conduziu a conversa — a cliente não escolhe nem edita essas condições no formulário dela. O negócio só é considerado fechado quando a primeira parcela é paga.</p>
    <form id="commercial-form" class="space-y-4">
      <div>
        <label class="text-xs text-white/40 block mb-1">Programa Acordado</label>
        <select name="program" class="field text-sm" required>
          <option value="">Selecione</option>
          ${PROGRAM_DEFS.map((p) => `<option value="${p.slug}" ${lead.program === p.slug ? 'selected' : ''}>${p.name}</option>`).join('')}
        </select>
      </div>
      <div class="pt-2" style="border-top:1px solid var(--line);">
        <div class="flex items-center justify-between mb-2">
          <p class="text-xs text-white/40">Pagamentos Acordados <span class="text-white/20">(entrada, depósitos, parcelas — qualquer combinação e ordem)</span></p>
          <p class="text-xs text-white/30">Total: <strong id="commercial-lines-total" style="color:var(--gold);">R$ 0,00</strong></p>
        </div>
        <div id="commercial-lines">${lines.map((l) => commercialLineRowHtml(l)).join('')}</div>
        <button type="button" id="add-commercial-line" class="btn-text mt-1">+ Adicionar Pagamento</button>
      </div>
      <div>
        <label class="text-xs text-white/40 block mb-1">Detalhes do Acordo <span class="text-white/20">(condições especiais, contexto da negociação)</span></label>
        <textarea name="commercialNotes" rows="2" class="field text-sm" placeholder="Ex.: desconto de 10% por indicação.">${ct.commercialNotes || ''}</textarea>
      </div>
      <div class="flex justify-end">
        <button type="submit" class="btn-primary" style="padding:9px 18px;font-size:12.5px;">${lead.onboardingStatus ? 'Atualizar Condições' : 'Concluir'}</button>
      </div>
    </form>
  `, 'mb-6');
}

function wireCommercialLines(root) {
  const linesEl = root.querySelector('#commercial-lines');
  const totalEl = root.querySelector('#commercial-lines-total');
  if (!linesEl) return;
  function recalcTotal() {
    let cents = 0;
    linesEl.querySelectorAll('[data-line-amount]').forEach((input) => { cents += Math.round((parseFloat(input.value) || 0) * 100); });
    totalEl.textContent = (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }
  linesEl.addEventListener('input', (e) => { if (e.target.matches('[data-line-amount]')) recalcTotal(); });
  linesEl.addEventListener('click', (e) => {
    if (!e.target.matches('[data-remove-line]')) return;
    const row = e.target.closest('.commercial-line-row');
    if (linesEl.children.length > 1) row.remove();
    else row.querySelectorAll('input, select').forEach((el) => { el.value = ''; });
    recalcTotal();
  });
  root.querySelector('#add-commercial-line')?.addEventListener('click', () => {
    linesEl.insertAdjacentHTML('beforeend', commercialLineRowHtml());
  });
  recalcTotal();
}

function readCommercialLines(root) {
  return [...root.querySelectorAll('.commercial-line-row')].map((row) => ({
    amount: Math.round((parseFloat(row.querySelector('[data-line-amount]').value) || 0) * 100) / 100,
    method: row.querySelector('[data-line-method]').value || null,
    dueDate: row.querySelector('[data-line-date]').value || null,
    label: row.querySelector('[data-line-label]').value.trim() || null,
  })).filter((l) => l.amount > 0);
}

// --- 2. Cadastro — one link, one button. Nay is usually still on the call
// or in WhatsApp with the client right now, so this needs to be copy-and-
// send in a single click, not generate-then-copy-then-mark-sent. -----------
function registrationSummary(info) {
  if (!info || !info.submitted) return '<p class="text-sm" style="color:var(--muted);">Ainda não preenchido.</p>';
  const rows = [
    ['Nome completo', info.fullName], ['Nome social', info.socialName], ['Nascimento', info.birthDate && formatDate(info.birthDate)],
    ['CPF', info.cpf], ['RG', info.rg], ['Profissão', info.profession], ['Nacionalidade', info.nationality], ['Estado civil', info.maritalStatus],
    ['Email', info.email], ['WhatsApp', info.whatsapp],
    ['Endereço', [info.street && `${info.street}, ${info.number || 's/n'}`, info.complement, info.neighborhood, info.city && info.state && `${info.city} - ${info.state}`, info.cep].filter(Boolean).join(' · ')],
  ].filter(([, v]) => v);
  return `<div class="grid sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">${rows.map(([l, v]) => `<div><p class="text-xs text-white/30">${l}</p><p>${v}</p></div>`).join('')}</div>`;
}
function renderRegistrationCard(lead) {
  if (!lead.onboardingStatus || !lead.registrationToken) return '';
  // buildRegistrationLink (shared/ui.js) handles the localhost-HTTPS fix —
  // see its own comment. Production Audit Remediation Pass, Low: this used
  // to be duplicated inline here and reimplemented (without the fix)
  // separately in admin/crm.js; now both call the one shared helper.
  const link = buildRegistrationLink(lead.registrationToken, location.pathname);
  return card(`
    <p class="text-sm text-white/50 mb-1">Cadastro</p>
    <p class="text-xs text-white/20 mb-4">Link pronto assim que a venda é fechada — copie e mande direto no WhatsApp com o cliente.</p>
    <div class="flex items-center gap-2 mb-4">
      <input readonly class="field text-sm" style="flex:1;" value="${link}" onclick="this.select()" />
      <button id="copy-link" class="btn-primary" style="padding:9px 18px;font-size:12.5px; white-space:nowrap;">${lead.registrationSentAt ? 'Copiar de Novo' : 'Copiar Link'}</button>
    </div>
    ${lead.registrationSentAt ? `<p class="text-xs mb-4" style="color:var(--gold);">Enviado em ${formatDateTime(lead.registrationSentAt)}</p>` : ''}
    <div class="pt-4" style="border-top:1px solid var(--line);">
      <p class="text-xs uppercase mb-3" style="color:var(--muted); letter-spacing:.1em;">${lead.registrationCompletedAt ? `Cadastro recebido em ${formatDate(lead.registrationCompletedAt)} — agora com a assistente` : 'Aguardando preenchimento'}</p>
      ${registrationSummary(lead.registrationInfo)}
    </div>
  `, 'mb-6');
}

// --- 3/4. Contrato + Ativação — read-only here. Once o cadastro chega, o
// upload do contrato e o "Ativar Cliente" são ações da assistente (ver
// assistant/leads.html) — essa página só mostra pra Nay onde as coisas
// estão, sem duplicar os botões de ação em dois lugares. -------------------
function renderContractCard(lead) {
  if (!lead.registrationCompletedAt) return '';
  const status = lead.contractStatus || 'info_pending';
  return card(`
    <p class="text-sm text-white/50 mb-1">Contrato</p>
    <p class="text-xs text-white/20 mb-4">Upload do contrato assinado é feito pela assistente.</p>
    <p class="text-sm">${ONBOARDING_STAGE_LABEL[status] || status}${status === 'completed' ? ` — ${lead.signedFileName || 'contrato-assinado.pdf'}` : ''}</p>
  `, 'mb-6');
}
function renderActivationCard(lead) {
  if (lead.convertedToClientId) {
    return card(`
      <p class="text-sm text-white/50 mb-3">Cliente Ativa</p>
      <p class="text-sm mb-4">Ativada em ${formatDate(lead.convertedAt)} — acesso ao Persea OS liberado.</p>
      <a href="client-detail.html?id=${lead.convertedToClientId}" class="btn-primary" style="padding:9px 18px;font-size:12.5px;">Ver Perfil de Cliente</a>
    `, 'mb-6');
  }
  if (lead.onboardingStatus !== 'ready_for_activation') return '';
  return card(`
    <p class="text-sm mb-1" style="color:var(--gold);">Pronta para ativação</p>
    <p class="text-xs text-white/20">Cadastro recebido e contrato assinado — a assistente ativa o acesso dela no painel de Cadastros.</p>
  `, 'mb-6');
}

// --- 5. Histórico ----------------------------------------------------------
function renderHistoryCard(lead) {
  if (!lead.history || !lead.history.length) return '';
  return card(`
    <p class="text-sm text-white/50 mb-4">Histórico do Onboarding</p>
    <div class="space-y-2">
      ${lead.history.map((h) => `<p class="text-xs text-white/40">${formatDateTime(h.at)} — ${h.text}</p>`).join('')}
    </div>
  `, 'mb-6');
}

// --- Legacy quick-path — REMOVED from production (Audit Remediation Pass,
// Step 1 / Critical 1). This used to render a "Converter em Cliente
// diretamente" shortcut that skipped cadastro/contrato entirely, calling
// MockDB.convertLeadToClient directly with no state gate. The only
// production path into db.clients is now MockDB.activateLead (see
// renderActivationCard below), which requires onboardingStatus ===
// 'ready_for_activation' (contract signed + onboarding complete) and is
// idempotent. convertLeadToClient itself now enforces that same
// precondition internally (see mock-db.js), so even a direct call from
// anywhere else can no longer create a client outside the real flow. The
// function body is intentionally left removed rather than hidden — there
// is no UI element left that can trigger it.

function renderInfoForm(lead) {
  return card(`
    <p class="text-sm text-white/50 mb-4">Informações do Lead</p>
    <form id="lead-info-form" class="space-y-4">
      <div class="grid sm:grid-cols-2 gap-4">
        <div>
          <label class="text-xs text-white/40 block mb-1">Nome Completo</label>
          <input name="fullName" class="field" value="${lead.fullName}" required />
        </div>
        <div>
          <label class="text-xs text-white/40 block mb-1">Programa de Interesse</label>
          <select name="interestedProgram" class="field">
            <option value="">Ainda não sabe</option>
            ${PROGRAMS.map((p) => `<option value="${p}" ${lead.interestedProgram === p ? 'selected' : ''}>${PROGRAM_LABEL[p]}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="grid sm:grid-cols-2 gap-4">
        <div>
          <label class="text-xs text-white/40 block mb-1">Email</label>
          <input name="email" type="email" class="field" value="${lead.email}" />
        </div>
        <div>
          <label class="text-xs text-white/40 block mb-1">WhatsApp</label>
          <input name="phone" class="field" value="${lead.phone}" />
        </div>
      </div>
      <div class="grid sm:grid-cols-3 gap-4">
        <div>
          <label class="text-xs text-white/40 block mb-1">Origem</label>
          <select name="source" class="field">
            ${LEAD_SOURCES.map((s) => `<option value="${s}" ${lead.source === s ? 'selected' : ''}>${LEAD_SOURCE_LABEL[s]}</option>`).join('')}
          </select>
        </div>
        <div>
          <label class="text-xs text-white/40 block mb-1">Status no Grupo VIP</label>
          <select name="vipGroupStatus" class="field">
            ${VIP_GROUP_STATUSES.map((s) => `<option value="${s}" ${lead.vipGroupStatus === s ? 'selected' : ''}>${VIP_GROUP_STATUS_LABEL[s]}</option>`).join('')}
          </select>
        </div>
        <div>
          <label class="text-xs text-white/40 block mb-1">Estágio</label>
          <select name="stage" class="field">
            ${LEAD_STAGES.map((s) => `<option value="${s}" ${lead.stage === s ? 'selected' : ''}>${LEAD_STAGE_LABEL[s]}</option>`).join('')}
          </select>
        </div>
      </div>
      <p class="text-xs uppercase mt-2" style="color:var(--muted); letter-spacing:.12em;">Redes Sociais</p>
      <div class="grid sm:grid-cols-2 gap-4">
        ${SOCIAL_PLATFORMS.map((p) => `
          <div>
            <label class="text-xs text-white/40 block mb-1">${SOCIAL_PLATFORM_LABEL[p]}</label>
            <input name="social_${p}" class="field" value="${lead.socialLinks?.[p] || ''}" placeholder="https://..." />
          </div>
        `).join('')}
      </div>
      <div>
        <label class="text-xs text-white/40 block mb-1">Notas</label>
        <textarea name="notes" rows="3" class="field">${lead.notes || ''}</textarea>
      </div>
      <div class="flex justify-end pt-1">
        <button type="submit" class="btn-primary" style="padding:9px 18px;font-size:12.5px;">Salvar</button>
      </div>
    </form>
  `, 'mb-6');
}

function renderInteractions(lead) {
  return card(`
    <div class="flex items-center justify-between mb-4">
      <p class="text-sm text-white/50">Contatos Diretos</p>
      <button id="new-interaction" class="btn-ghost">+ Registrar Contato</button>
    </div>
    <p class="text-xs text-white/20 mb-4">Assim que houver contato mais direto com essa lead, registre aqui o que foi conversado.</p>
    ${lead.interactions.length ? `
      <div class="space-y-4">
        ${lead.interactions.map((i) => `
          <div class="pb-4 border-b border-white/5 last:border-0 last:pb-0">
            <p class="text-xs" style="color:var(--muted);">${formatDateTime(i.date)}</p>
            <p class="text-sm mt-1">${i.summary}</p>
          </div>
        `).join('')}
      </div>
    ` : '<p class="text-sm" style="color:var(--muted);">Nenhum contato direto registrado ainda.</p>'}
  `);
}

function openInteractionModal() {
  const { el, close } = openModal({
    title: 'Registrar Contato Direto',
    bodyHtml: `
      <form id="interaction-form" class="space-y-4">
        <div>
          <label class="text-xs text-white/40 block mb-1">Data e Hora</label>
          <input name="date" type="datetime-local" class="field" value="${new Date().toISOString().slice(0, 16)}" required />
        </div>
        <div>
          <label class="text-xs text-white/40 block mb-1">O Que Foi Conversado</label>
          <textarea name="summary" rows="3" class="field" required></textarea>
        </div>
        <div class="flex justify-end pt-2">
          <button type="submit" class="btn-primary" style="padding:9px 18px;font-size:12.5px;">Registrar</button>
        </div>
      </form>
    `,
  });
  el.querySelector('#interaction-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    MockDB.addLeadInteraction(leadId, { date: fd.get('date'), summary: fd.get('summary') });
    close();
    toast('Contato registrado.');
    render();
  });
}

function render() {
  const lead = MockDB.getLead(leadId);
  if (!lead) {
    content.innerHTML = `<a href="crm.html?section=leads" class="btn-text">&larr; Todos os leads</a><p class="mt-6 text-sm" style="color:var(--muted);">Lead não encontrada.</p>`;
    return;
  }

  content.innerHTML = `
    ${renderHeader(lead)}
    ${renderCommercialCard(lead)}
    ${renderRegistrationCard(lead)}
    ${renderContractCard(lead)}
    ${renderActivationCard(lead)}
    ${renderHistoryCard(lead)}
    ${renderInfoForm(lead)}
    ${renderInteractions(lead)}
  `;

  wireCommercialLines(content);
  content.querySelector('#commercial-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const paymentLines = readCommercialLines(content);
    if (!paymentLines.length) { toast('Adicione ao menos um pagamento com valor.', { tone: 'error' }); return; }
    MockDB.agreeSale(leadId, {
      program: fd.get('program'), paymentLines, commercialNotes: fd.get('commercialNotes'), responsibleId: 'nay',
    });
    toast('Condições comerciais registradas.');
    render();
  });

  content.querySelector('#copy-link')?.addEventListener('click', async () => {
    const link = content.querySelector('#copy-link').previousElementSibling.value;
    try { await navigator.clipboard.writeText(link); toast('Link copiado — cole no WhatsApp da cliente.'); }
    catch { toast('Não foi possível copiar automaticamente — selecione e copie manualmente.', { tone: 'error' }); }
    MockDB.markRegistrationSent(leadId);
    render();
  });

  content.querySelector('#lead-info-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const socialLinks = Object.fromEntries(SOCIAL_PLATFORMS.map((p) => [p, fd.get(`social_${p}`) || '']));
    MockDB.updateLead(leadId, {
      fullName: fd.get('fullName'), email: fd.get('email'), phone: fd.get('phone'),
      interestedProgram: fd.get('interestedProgram') || null, source: fd.get('source'),
      vipGroupStatus: fd.get('vipGroupStatus'), stage: fd.get('stage'), notes: fd.get('notes'), socialLinks,
    });
    toast('Lead atualizada.');
    render();
  });

  content.querySelector('#new-interaction')?.addEventListener('click', openInteractionModal);
}

render();
