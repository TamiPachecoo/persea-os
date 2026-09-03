import { MockDB, setActiveClientId, DEFAULT_CLIENT_ID, MOOD_SCALE, ONBOARDING_STAGES, ONBOARDING_STAGE_LABEL, WHATSAPP_STATUSES, WHATSAPP_STATUS_LABEL, CONTRACT_DURATIONS, CONTRACT_DURATION_LABEL, CONTRACT_DURATION_VALUE, PROGRAMS, PROGRAM_LABEL, PAYMENT_STATUS_LABEL, PAYMENT_METHODS, PAYMENT_METHOD_LABEL, SOCIAL_PLATFORMS, SOCIAL_PLATFORM_LABEL, PROGRAM_DEFS, UPGRADE_INTEREST_STATUSES, UPGRADE_INTEREST_STATUS_LABEL, NF_STATUS_LABEL, ARCHETYPE_ATTEMPT_STATUS_LABEL, ARCHETYPE_ATTEMPT_STATUS_BADGE_CLASS, ARCHETYPE_VISUAL_SETS, ARCHETYPE_VISUAL_SET_LABEL, ASSISTANT_PERSONA_LABEL, AGENDA_STATUS_LABEL, AGENDA_TYPE_LABEL, TIER_MAX_PHASE_INDEX, PREMIUM_ONLY_PHASE_INDEX, MENTOR_DELIVERABLE_STATUS_LABEL, MENTOR_DELIVERABLE_STATUS_BADGE_CLASS, ENCOUNTER_DEFS, BUSINESS_SURVEY_QUESTIONS, GUIDE_STATUS_LABEL, ENCOUNTER_PREP_CHECKLIST } from '../shared/mock-db.js';
import { renderShell, card, statusBadge, toast, formatDateTime, formatDate, renderPhaseTracker, isValidHttpUrl, externalLinkAttrs, boardEmptyState, mountPinterestBoard, renderSocialLinks, renderArchetypeRadar, archetypePortrait, openModal, renderRecordingBlock, brl } from '../shared/ui.js';
import { requireProfile } from '../shared/supabase-auth.js';
import { supabase } from '../shared/supabase-client.js';
import { loadActiveObligations, summarizeObligations } from '../shared/financial-model.js';
import {
  SECTIONS, OFFER_FIELDS, FIXED_COST_FIELDS, VARIABLE_COST_FIELDS, REFERENCE_FIELDS,
  REVIEW_STATUSES, REVIEW_STATUS_LABEL, VALUE_ASSESSMENT_STATUS_LABEL, VALUE_ASSESSMENT_STATUS_BADGE_CLASS,
  fmtBRL, fmtPct, calcFixedCostsTotal, calcVariableCostsSummary, calcCapacity, calcOfferCapacity,
  calcOperatingRequirement, calcPricingIndicators, projectScenario,
} from '../shared/value-analysis-schema.js';

const MOOD_EMOJI = Object.fromEntries(MOOD_SCALE.map((m) => [m.value, m.emoji]));
const CONTRACT_STATUS_CLASS = {
  info_pending: 'badge-locked', info_received: 'badge-progress', contract_prepared: 'badge-progress',
  sent_for_signature: 'badge-progress', awaiting_signature: 'badge-progress', signed: 'badge-progress', completed: 'badge-completed',
};
const WHATSAPP_STATUS_CLASS = { not_added: 'badge-locked', pending: 'badge-progress', added: 'badge-completed' };
const onboardingBadge = (status) => `<span class="badge ${CONTRACT_STATUS_CLASS[status] || 'badge-locked'}">${ONBOARDING_STAGE_LABEL[status] || status}</span>`;
const whatsappBadge = (status) => `<span class="badge ${WHATSAPP_STATUS_CLASS[status] || 'badge-locked'}">${WHATSAPP_STATUS_LABEL[status] || status}</span>`;
const PAYMENT_STATUS_CLASS = { paid: 'badge-completed', pending: 'badge-progress', overdue: 'badge-locked' };
const paymentBadge = (status) => `<span class="badge ${PAYMENT_STATUS_CLASS[status] || 'badge-locked'}">${PAYMENT_STATUS_LABEL[status] || status}</span>`;

// Same file, two doors: admin/client-detail.html and assistant/client-
// workspace.html both load this exact script (the assistant page's own
// client-workspace.js — checklist-style, no real visual structure — is
// retired in favor of this, per the redesign request: same layout Nay
// already has, not a second, differently-organized page to maintain).
// Detected from the URL rather than threaded through as a parameter, since
// nothing else about how this script is invoked differs between the two.
const role = location.pathname.includes('/assistant/') ? 'assistant' : 'admin';
const isAssistant = role === 'assistant';
if (!(await requireProfile(role))) throw new Error('not authorized');
document.body.innerHTML = renderShell({ role, active: isAssistant ? 'clients.html' : 'crm.html' });

const clientId = new URLSearchParams(location.search).get('id') || DEFAULT_CLIENT_ID;
const client = MockDB.getClient(clientId);
const phaseProgress = MockDB.getPhaseProgress(clientId);
const TIER_LABEL = { premium: 'Premium', essential: 'Essential' };
// The visible tab row — Programa (client overview), one tab per encontro
// (E1-E8, always all 8, same "get familiar with the names regardless of
// tier" reasoning as the old flat encounter list), and Financeiro. Every
// other old tab (Direção da Marca, Questionário, Editor de Pitch, Ficha de
// Valor, Tarefas, etc.) still exists and still works — see RENDERERS below
// — just reached from *inside* the relevant encontro brief now instead of
// competing for space in the top row. Onboarding is the one exception:
// still shown in the row while she's not yet fully onboarded (see
// visibleTabs below), same as before.
const TABS = [
  ['program', 'Programa'],
  ['e1', 'E1'], ['e2', 'E2'], ['e3', 'E3'], ['e4', 'E4'],
  ['e5', 'E5'], ['e6', 'E6'], ['e7', 'E7'], ['e8', 'E8'],
  ['financial', 'Financeiro'],
];

// Onboarding (contract, payment plan, closing notes, WhatsApp group setup)
// is only the client's current step while she's being onboarded — once her
// contract is completed it's a settled, rarely-revisited record, so it
// drops out of the main tab row and moves behind a small settings link
// instead of permanently occupying the front-row real estate every other,
// ongoing tab competes for.
function isOnboardingDone() {
  return MockDB.getOnboarding(clientId).contract.status === 'completed';
}

let activeTab = isOnboardingDone() ? 'program' : 'onboarding';
const content = document.getElementById('app-content');

// The one real control over profile.phaseIndex (see MockDB.setClientPhase)
// — phase advancement is deliberately manual, not something finishing all
// of a phase's activities triggers automatically, so Nay needs an actual
// button for it, not just a read-only tracker above.
function renderPhaseControl() {
  const phases = phaseProgress.phases;
  const maxIndex = TIER_MAX_PHASE_INDEX[phaseProgress.tier] ?? (phases.length - 1);
  const atLast = phaseProgress.currentIndex >= maxIndex;
  return card(`
    <div class="flex items-center justify-between flex-wrap gap-3">
      <p class="text-sm">Fase atual: <strong>${phaseProgress.currentIndex + 1} de ${phases.length} — ${phases[phaseProgress.currentIndex]}</strong></p>
      <div class="flex items-center gap-2">
        <select id="phase-select" class="field text-sm">
          ${phases.map((name, i) => `<option value="${i}" ${i === phaseProgress.currentIndex ? 'selected' : ''} ${i > maxIndex ? 'disabled' : ''}>Fase ${i + 1} — ${name}${i === PREMIUM_ONLY_PHASE_INDEX && i > maxIndex ? ' (Premium)' : ''}</option>`).join('')}
        </select>
        <button id="set-phase" class="btn-ghost">Definir</button>
        ${!atLast ? `<button id="advance-phase" class="btn-primary" style="padding:9px 18px;font-size:12.5px;">Avançar para a Próxima Fase →</button>` : ''}
      </div>
    </div>
  `, 'mb-8');
}

// The context sidebar the assistant workspace already had — meetings,
// upcoming encounters, Nay's private notes — kept front-and-center exactly
// where it was liked, just now alongside the same tab structure Nay uses
// instead of the old checklist-style main area. Admin doesn't get this
// sidebar: her Programa tab and the "Recomendar algo" box above already
// cover the same ground for her.
function renderAssistantContextSidebar() {
  const b = MockDB.getClientContextBundle(clientId);
  const upcoming = MockDB.getAgendaItemsForClient(clientId).filter((a) => a.status === 'upcoming');
  return card(`
    <p class="text-sm text-white/50 mb-4">Contexto da Cliente</p>
    <div class="space-y-4 text-sm">
      <div>
        <p class="text-white/40 text-xs mb-1">Primeira Reunião</p>
        ${b.firstMeeting
          ? `<p>${formatDateTime(b.firstMeeting.date)} — ${b.firstMeeting.topic || b.firstMeeting.title}</p>`
          : '<p class="text-white/20">Ainda não realizada.</p>'}
      </div>
      <div>
        <p class="text-white/40 text-xs mb-1.5">Próximos Encontros</p>
        ${upcoming.length
          ? upcoming.slice(0, 3).map((a) => `<a href="agenda.html?item=${a.id}" class="block hover:underline">${AGENDA_TYPE_LABEL[a.type]} — ${formatDateTime(a.date)}</a>`).join('')
          : '<p class="text-white/20">Nenhum encontro agendado.</p>'}
      </div>
      <div class="pt-3" style="border-top:1px solid var(--line);">
        <p class="text-white/40 text-xs mb-1.5">Notas da Nay</p>
        <p class="${b.privateNotes ? '' : 'text-white/20'}">${b.privateNotes || 'Nenhuma nota registrada.'}</p>
      </div>
    </div>
  `, 'mb-6');
}

// System-Wide UX Simplification Pass — Client Detail (Admin/Assistant):
// answers "where is this client and what needs to happen next" at a
// glance, before any tab is even opened. Reuses data every tab already
// reads (getEncounterJourney, getNextAction, getPayments,
// getEncounterRequests) — no new state, just surfaced earlier. Renders
// nothing (not an empty strip) when there's genuinely nothing to show.
function renderClientAttentionStrip() {
  const enc = MockDB.getEncounterJourney(clientId).find((e) => e.status === 'upcoming');
  const nextAction = MockDB.getNextAction(clientId);
  const overdue = MockDB.getPayments(clientId).filter((p) => p.status === 'overdue').length;
  const openRequests = MockDB.getEncounterRequests(clientId).filter((r) => r.status === 'awaiting_nay_confirmation').length;
  const attention = overdue + openRequests;
  const items = [
    enc ? { label: 'Próximo encontro', value: `E${enc.number} — ${enc.name} · ${formatDate(enc.date)}` } : null,
    nextAction ? { label: 'Próxima ação', value: nextAction.title } : null,
    attention ? { label: 'Atenção', value: `${attention} pendência${attention === 1 ? '' : 's'}`, tone: 'var(--terracotta)' } : null,
  ].filter(Boolean);
  if (!items.length) return '';
  return `
    <div class="flex flex-wrap items-start gap-x-10 gap-y-3 mb-8 pb-6" style="border-bottom:1px solid var(--line);">
      ${items.map((it) => `
        <div>
          <p class="text-xs" style="color:var(--muted);">${it.label}</p>
          <p class="text-sm mt-0.5" style="${it.tone ? `color:${it.tone};` : ''}">${it.value}</p>
        </div>
      `).join('')}
    </div>
  `;
}

function shell(inner) {
  const done = isOnboardingDone();
  const visibleTabs = done ? TABS : [['onboarding', 'Onboarding'], ...TABS];
  const mainContent = isAssistant
    ? `<div class="workspace-layout"><div class="workspace-sidebar">${renderAssistantContextSidebar()}</div><div class="workspace-main"><div id="tab-content">${inner}</div></div></div>`
    : `<div id="tab-content">${inner}</div>`;
  return `
    <a href="${isAssistant ? 'clients.html' : 'crm.html'}" class="btn-text mb-4 inline-block">&larr; ${isAssistant ? 'Clientes' : 'Todos os clientes'}</a>
    <div class="mb-8 flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-serif">${client.fullName}</h1>
        <p class="text-white/40 text-sm">${client.email} · ${TIER_LABEL[client.tier] || client.tier}</p>
      </div>
      <div class="flex items-center gap-4">
        ${done ? `<button type="button" data-tab="onboarding" class="btn-text">⚙ Configurações do Cliente</button>` : ''}
        ${statusBadge(client.status)}
      </div>
    </div>
    ${renderClientAttentionStrip()}
    ${!MockDB.getOnboarding(clientId).clientInfo.submitted ? `
      <div class="mb-8" style="border-left:3px solid var(--terracotta); border-radius:4px;">${card(`
        <p class="text-sm" style="color:var(--terracotta);">⚠ Esta cliente ainda não preencheu as informações de cadastro — o contrato não pode ser preparado até isso acontecer.</p>
      `)}</div>
    ` : ''}
    ${!isAssistant ? `
    <details class="mb-8">
      <summary class="text-sm cursor-pointer" style="color:var(--muted); list-style:none;">💬 Recomendar algo para a Assistente sobre ${client.fullName}</summary>
      <div class="mt-3">${card(`
        <form id="recommend-form" class="flex items-start gap-2">
          <textarea name="text" rows="2" class="field" placeholder="Ex.: assista a gravação do E1 antes de preparar o guia de looks dela." required></textarea>
          <button type="submit" class="btn-ghost" style="white-space:nowrap;">Enviar</button>
        </form>
      `)}</div>
    </details>
    ` : ''}
    <div class="mb-8">${renderSocialLinks(MockDB.getSocialLinks(clientId))}</div>

    ${renderPhaseTracker(phaseProgress)}
    ${!isAssistant ? renderPhaseControl() : ''}

    <div class="flex gap-1 mb-8 border-b border-white/10 overflow-x-auto">
      ${visibleTabs.map(([key, label]) => `
        <button data-tab="${key}" class="tab-btn ${activeTab === key ? 'active' : ''}">${label}</button>
      `).join('')}
    </div>
    ${mainContent}
  `;
}

// Free-form payment-plan line editor — same model as the real contract's
// Condições Comerciais builder (admin/contract.js), so both places behave
// the same way: any number of lines, any amount/method/date combination,
// no assumption of "entrada + equal installments." A blank row's status is
// omitted (nothing to show yet); an existing row's status badge is
// read-only here — marking paid happens in the Financeiro tab, not here.
function paymentPlanLineRowHtml(p = {}) {
  return `
    <div class="flex items-center gap-2 py-2.5 flex-wrap plan-line-row" data-existing-id="${p.id || ''}">
      <input type="number" min="0" step="0.01" class="field text-sm" style="width:110px;" data-line-amount placeholder="Valor R$" value="${p.amount ?? ''}" />
      <select class="field text-sm" style="width:160px;" data-line-method>
        <option value="">Forma —</option>
        ${PAYMENT_METHODS.map((m) => `<option value="${m}" ${p.method === m ? 'selected' : ''}>${PAYMENT_METHOD_LABEL[m]}</option>`).join('')}
      </select>
      <input type="date" class="field text-sm" style="width:150px;" data-line-date value="${p.dueDate || ''}" />
      <input type="text" class="field text-sm" style="flex:1; min-width:110px;" data-line-label placeholder="Nota (opcional — ex.: Entrada)" value="${p.label || ''}" />
      <div class="flex items-center gap-2 ml-auto">
        ${p.status ? paymentBadge(p.status) : ''}
        <button type="button" class="btn-text" data-remove-line>Remover</button>
      </div>
    </div>
  `;
}

function wirePaymentPlanLines(tc, clientId, render) {
  const linesEl = tc.querySelector('#plan-lines');
  if (!linesEl) return;
  const totalEl = tc.querySelector('#plan-lines-total');

  function recalcTotal() {
    let cents = 0;
    linesEl.querySelectorAll('[data-line-amount]').forEach((input) => { cents += Math.round((parseFloat(input.value) || 0) * 100); });
    totalEl.textContent = (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }
  linesEl.addEventListener('input', (e) => { if (e.target.matches('[data-line-amount]')) recalcTotal(); });
  linesEl.addEventListener('click', (e) => {
    if (!e.target.matches('[data-remove-line]')) return;
    const row = e.target.closest('.plan-line-row');
    if (linesEl.children.length > 1) row.remove();
    else row.querySelectorAll('input, select').forEach((el) => { el.value = ''; });
    recalcTotal();
  });
  tc.querySelector('#add-plan-line')?.addEventListener('click', () => {
    linesEl.insertAdjacentHTML('beforeend', paymentPlanLineRowHtml());
  });
  recalcTotal();

  tc.querySelector('#save-plan-lines')?.addEventListener('click', () => {
    const lines = [...linesEl.querySelectorAll('.plan-line-row')].map((row) => ({
      id: row.dataset.existingId || null,
      amount: Math.round((parseFloat(row.querySelector('[data-line-amount]').value) || 0) * 100) / 100,
      method: row.querySelector('[data-line-method]').value || null,
      dueDate: row.querySelector('[data-line-date]').value || null,
      label: row.querySelector('[data-line-label]').value.trim() || null,
    })).filter((l) => l.amount > 0);
    if (!lines.length) { toast('Adicione ao menos um pagamento com valor.', { tone: 'error' }); return; }
    const hasPaid = MockDB.getPayments(clientId).some((p) => p.status === 'paid');
    const removesAPaidLine = hasPaid && MockDB.getPayments(clientId).some((p) => p.status === 'paid' && !lines.some((l) => l.id === p.id));
    if (removesAPaidLine && !confirm('Uma ou mais parcelas já pagas seriam removidas do plano ao salvar. Continuar mesmo assim?')) return;
    const result = MockDB.setPaymentLines(clientId, lines);
    if (result?.error === 'plan_frozen') {
      toast('Plano já assinado — use "Renegociar Plano" para alterá-lo.', { tone: 'error' });
      return;
    }
    toast('Plano de pagamento salvo.');
    render();
  });
}

// Production Audit Remediation Pass (High 7/8): once signed, the plan is a
// contractual baseline — read-only here (no inputs at all, so there's
// nothing to accidentally edit-and-save), with the one sanctioned way to
// change it being the admin-only "Renegociar Plano" action, which versions
// instead of overwriting (see MockDB.renegotiatePaymentPlan). Assistant
// never sees the renegotiate button, even though 'onboarding' is one of
// her editable tabs for everything else — this one action is carved out
// admin-only regardless of tab-level lockdown.
// Production Audit Remediation Pass (Medium — "Valor Total Acordado"): if
// Nay's explicit agreed total and the plan's calculated line sum disagree,
// surface it plainly instead of silently letting one win. Never auto-
// resolves — Admin sees both numbers and the exact difference and decides
// which one is right (fix the plan, or update the agreed value).
function renderAgreedValueDiscrepancy(c, payments) {
  if (c.agreedValue == null) return '';
  const planTotal = payments.reduce((s, p) => s + p.amount, 0);
  if (Math.abs(planTotal - c.agreedValue) < 0.01) return '';
  const diff = planTotal - c.agreedValue;
  return card(`
    <p class="text-sm mb-1" style="color:var(--terracotta);">⚠ Valor acordado e plano de pagamento não batem</p>
    <p class="text-xs text-white/40">Valor acordado: ${brl(c.agreedValue)} · Plano atual soma: ${brl(planTotal)} · Diferença: R$ ${Math.abs(diff).toLocaleString('pt-BR')} ${diff > 0 ? '(plano acima do acordado)' : '(plano abaixo do acordado)'}</p>
  `, 'mb-4');
}

function renderSignedPaymentPlan(payments) {
  const versions = MockDB.getPaymentPlanVersions(clientId);
  const total = payments.reduce((s, p) => s + p.amount, 0);
  return card(`
    <div class="flex items-center justify-between mb-1">
      <p class="text-sm text-white/50">Plano de Pagamento — Assinado</p>
      <p class="text-xs text-white/30">Total: <strong style="color:var(--gold);">${brl(total)}</strong></p>
    </div>
    <p class="text-xs text-white/20 mb-4">Este plano faz parte do contrato assinado e não pode ser editado diretamente — só renegociado, o que preserva a versão original.${versions.length ? ` Versão atual: ${versions.length + 1}.` : ''}</p>
    <div class="divide-y mb-4" style="border-color:var(--line);">
      ${payments.map((p) => `
        <div class="flex items-center justify-between py-2.5 text-sm">
          <div>
            <p>${brl(p.amount)}${p.label ? ` — ${p.label}` : ''}</p>
            <p class="text-xs text-white/30 mt-0.5">Vencimento ${formatDate(p.dueDate)}${p.method ? ` · ${PAYMENT_METHOD_LABEL[p.method] || p.method}` : ''}</p>
          </div>
          ${paymentBadge(p.status)}
        </div>
      `).join('')}
    </div>
    ${versions.length ? `
      <details class="mb-4">
        <summary class="text-xs cursor-pointer" style="color:var(--muted); list-style:none;">Histórico de versões (${versions.length})</summary>
        <div class="mt-2 space-y-2">
          ${versions.map((v) => `
            <div class="text-xs" style="color:var(--muted);">
              Versão ${v.version} — ${v.lines.length} pagamento(s), total ${brl(v.totalValue)} · alterada em ${formatDateTime(v.changedAt)} por ${v.changedBy}${v.reason ? ` — ${v.reason}` : ''}${v.aditivoNeeded ? ' · <span style="color:var(--gold);">Aditivo contratual necessário</span>' : ''}
            </div>
          `).join('')}
        </div>
      </details>
    ` : ''}
    ${!isAssistant ? `<button type="button" id="renegotiate-plan" class="btn-ghost">Renegociar Plano</button>` : ''}
  `, 'mb-6');
}

function openRenegotiateModal(payments, render) {
  const { el, close } = openModal({
    title: 'Renegociar Plano de Pagamento',
    bodyHtml: `
      <p class="text-xs text-white/30 mb-4">O plano original assinado é preservado como uma versão anterior — isto cria uma nova versão, não apaga a antiga.</p>
      <div id="renegotiate-lines">${payments.map((p) => paymentPlanLineRowHtml(p)).join('')}</div>
      <button type="button" id="renegotiate-add-line" class="btn-text mb-4">+ Adicionar Pagamento</button>
      <div class="mb-4">
        <label class="text-xs text-white/40 block mb-1">Motivo da renegociação</label>
        <textarea id="renegotiate-reason" rows="2" class="field text-sm" placeholder="Ex.: Cliente pediu para adiar a parcela 3 por dificuldades financeiras."></textarea>
      </div>
      <label class="flex items-center gap-2 text-xs text-white/40 mb-4"><input type="checkbox" id="renegotiate-aditivo" /> Aditivo contratual necessário</label>
      <button type="button" id="renegotiate-save" class="btn-primary block w-full text-center" style="padding-top:10px;padding-bottom:10px;">Salvar Nova Versão</button>
    `,
  });
  el.querySelector('#renegotiate-add-line').addEventListener('click', () => {
    el.querySelector('#renegotiate-lines').insertAdjacentHTML('beforeend', paymentPlanLineRowHtml());
  });
  el.querySelector('#renegotiate-lines').addEventListener('click', (e) => {
    if (!e.target.matches('[data-remove-line]')) return;
    const rows = el.querySelectorAll('.plan-line-row');
    const row = e.target.closest('.plan-line-row');
    if (rows.length > 1) row.remove();
  });
  el.querySelector('#renegotiate-save').addEventListener('click', () => {
    const lines = [...el.querySelectorAll('.plan-line-row')].map((row) => ({
      id: row.dataset.existingId || null,
      amount: Math.round((parseFloat(row.querySelector('[data-line-amount]').value) || 0) * 100) / 100,
      method: row.querySelector('[data-line-method]').value || null,
      dueDate: row.querySelector('[data-line-date]').value || null,
      label: row.querySelector('[data-line-label]').value.trim() || null,
    })).filter((l) => l.amount > 0);
    if (!lines.length) { toast('Adicione ao menos um pagamento com valor.', { tone: 'error' }); return; }
    const reason = el.querySelector('#renegotiate-reason').value.trim();
    const aditivoNeeded = el.querySelector('#renegotiate-aditivo').checked;
    const result = MockDB.renegotiatePaymentPlan(clientId, lines, { reason, actorRole: role, actorName: role === 'admin' ? 'Nay' : 'Assistente', aditivoNeeded });
    if (!result.ok) { toast('Não foi possível renegociar o plano.', { tone: 'error' }); return; }
    close();
    toast(`Plano renegociado — versão ${result.version} criada.`);
    render();
  });
}

function renderOnboardingTab() {
  const o = MockDB.getOnboarding(clientId);
  const info = o.clientInfo;
  const c = o.contract;
  const isPJ = info.partyType === 'PJ';
  const payments = MockDB.getPayments(clientId);

  return `
    ${card(`
      <p class="text-sm text-white/50 mb-4">Informações Enviadas pela Cliente</p>
      ${info.submitted ? `
        <div class="grid sm:grid-cols-2 gap-4 text-sm">
          <div><p class="text-white/40 text-xs mb-1">Nome Completo</p><p>${info.fullName}</p></div>
          <div><p class="text-white/40 text-xs mb-1">Tipo</p><p>${isPJ ? 'Pessoa Jurídica' : 'Pessoa Física'}</p></div>
          <div><p class="text-white/40 text-xs mb-1">${isPJ ? 'CNPJ' : 'CPF'}</p><p>${isPJ ? info.cnpj : info.cpf}</p></div>
          ${isPJ ? `<div><p class="text-white/40 text-xs mb-1">Empresa</p><p>${info.companyName || '—'}</p></div>` : ''}
          <div><p class="text-white/40 text-xs mb-1">Endereço</p><p>${info.address}</p></div>
          <div><p class="text-white/40 text-xs mb-1">Email</p><p>${info.email}</p></div>
          <div><p class="text-white/40 text-xs mb-1">WhatsApp</p><p>${info.whatsapp}</p></div>
        </div>
      ` : '<p class="text-sm" style="color:var(--muted);">A cliente ainda não enviou suas informações.</p>'}
    `, 'mb-6')}

    ${card(`
      <p class="text-sm text-white/50 mb-3">Redes Sociais</p>
      <form id="social-links-form" class="grid sm:grid-cols-2 gap-4">
        ${SOCIAL_PLATFORMS.map((p) => `
          <div>
            <label class="text-xs text-white/40 block mb-1">${SOCIAL_PLATFORM_LABEL[p]}</label>
            <input name="social_${p}" class="field text-sm" value="${MockDB.getSocialLinks(clientId)[p] || ''}" placeholder="https://..." />
          </div>
        `).join('')}
        <div class="sm:col-span-2 flex justify-end">
          <button type="submit" class="btn-primary" style="padding:9px 18px;font-size:12.5px;">Salvar</button>
        </div>
      </form>
    `, 'mb-6')}

    ${card(`
      <div class="flex items-center justify-between mb-4">
        <p class="text-sm text-white/50">Contrato</p>
        ${onboardingBadge(c.status)}
      </div>
      <div class="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm mb-4">
        <div>
          <p class="text-white/40 text-xs mb-1">Programa</p>
          <select id="contract-program" class="field text-sm">
            <option value="">Não definido</option>
            ${PROGRAMS.map((p) => `<option value="${p}" ${c.program === p ? 'selected' : ''}>${PROGRAM_LABEL[p]}</option>`).join('')}
          </select>
        </div>
        <div>
          <p class="text-white/40 text-xs mb-1">Modelo de Contrato</p>
          <select id="contract-duration" class="field text-sm" ${c.program !== 'persea' ? 'disabled' : ''}>
            <option value="">Não definido</option>
            ${CONTRACT_DURATIONS.map((d) => `<option value="${d}" ${c.duration === d ? 'selected' : ''}>${CONTRACT_DURATION_LABEL[d]} · sugestão R$ ${CONTRACT_DURATION_VALUE[d].toLocaleString('pt-BR')}</option>`).join('')}
          </select>
        </div>
        <div>
          <p class="text-white/40 text-xs mb-1">Valor Total Acordado (R$)</p>
          <div class="flex gap-2">
            <input id="contract-value" type="number" min="0" step="0.01" class="field text-sm" value="${c.agreedValue ?? ''}" placeholder="0,00" />
            <button id="save-contract-value" class="btn-ghost">Salvar</button>
          </div>
        </div>
        <div>
          <p class="text-white/40 text-xs mb-1">Avançar Status</p>
          <div class="flex gap-2">
            <select id="contract-status" class="field text-sm">
              ${ONBOARDING_STAGES.map((s) => `<option value="${s}" ${c.status === s ? 'selected' : ''}>${ONBOARDING_STAGE_LABEL[s]}</option>`).join('')}
            </select>
            <button id="update-contract-status" class="btn-ghost">Atualizar</button>
          </div>
        </div>
      </div>
      <p class="text-xs text-white/20 mb-4">O valor sugerido pelo programa/modelo é só um ponto de partida — ajuste livremente aqui para refletir o que foi realmente negociado com a cliente.</p>
      <p class="text-xs text-white/30 mb-4">Os campos acima são o rascunho antigo (dados de exemplo). Geração real do contrato, envio para assinatura via Autentique e o arquivo assinado agora vivem no sistema novo — abra pelo botão abaixo.</p>
      <div class="flex items-center gap-3">
        <a href="contract.html?legacy_id=${clientId}" class="btn-primary inline-block">Abrir Contrato (Sistema Real) ↗</a>
      </div>
    `, 'mb-6')}

    ${card(`
      <p class="text-sm text-white/50 mb-3">Notas do Fechamento</p>
      <p class="text-xs text-white/20 mb-3">Anotações da call de fechamento — condições combinadas, promessas feitas, qualquer detalhe que precise constar além do contrato em si.</p>
      <textarea id="contract-notes" rows="3" class="field text-sm" placeholder="Ex.: Cliente pediu para começar a Fase 1 antes da assinatura formal...">${c.notes || ''}</textarea>
      <div class="flex justify-end mt-3">
        <button id="save-contract-notes" class="btn-ghost">Salvar Notas</button>
      </div>
    `, 'mb-6')}

    ${renderAgreedValueDiscrepancy(c, payments)}
    ${c.status === 'completed' ? renderSignedPaymentPlan(payments) : card(`
      <div class="flex items-center justify-between mb-1">
        <p class="text-sm text-white/50">Plano de Pagamento</p>
        <p class="text-xs text-white/30">Total: <strong id="plan-lines-total" style="color:var(--gold);">R$ 0,00</strong></p>
      </div>
      <p class="text-xs text-white/20 mb-4">Registre cada pagamento combinado com a cliente — entrada, depósitos avulsos, parcelas — em qualquer combinação, valor, forma de pagamento e data. Não precisa ser um plano parcelado padrão: adicione quantas linhas forem necessárias, em qualquer ordem.</p>
      <div id="plan-lines">${(payments.length ? payments : [{}]).map((p) => paymentPlanLineRowHtml(p)).join('')}</div>
      <div class="flex items-center justify-between mt-2 mb-4">
        <button type="button" id="add-plan-line" class="btn-text">+ Adicionar Pagamento</button>
        <button type="button" id="save-plan-lines" class="btn-primary">Salvar Plano de Pagamento</button>
      </div>
    `, 'mb-6')}

    ${card(`
      <div class="flex items-center justify-between mb-4">
        <p class="text-sm text-white/50">Grupo de WhatsApp</p>
        ${whatsappBadge(o.whatsappGroup.status)}
      </div>
      <div class="flex items-center gap-2">
        <select id="whatsapp-status" class="field text-sm">
          ${WHATSAPP_STATUSES.map((s) => `<option value="${s}" ${o.whatsappGroup.status === s ? 'selected' : ''}>${WHATSAPP_STATUS_LABEL[s]}</option>`).join('')}
        </select>
        <button id="update-whatsapp-status" class="btn-ghost">Atualizar</button>
      </div>
      <p class="text-xs text-white/30 mt-3">Aulas e materiais iniciais são liberados para a cliente assim que este status estiver "Adicionada".</p>
    `)}
  `;
}

// Production Audit Remediation Pass (Critical 2): fired-and-forgotten after
// the Financeiro tab renders (see render() below) — fills #real-financial-
// summary with the real Supabase numbers for this client, if she has a real
// client record (matched by legacy_id, same lookup admin/payments.js uses).
// Kept separate from renderFinancialTab (which stays synchronous) rather
// than restructuring the whole render pipeline to be async, since this is
// the one tab that needs a network round-trip. Most existing seed clients
// have no Supabase counterpart yet (only ones that went through the real
// activate/registration flow do) — that fact is surfaced explicitly rather
// than silently showing nothing or, worse, mock numbers relabeled as real.
async function hydrateRealFinancialSummary() {
  const el = document.getElementById('real-financial-summary');
  if (!el) return;
  const { data: realClient } = await supabase.from('clients').select('id').eq('legacy_id', clientId).maybeSingle();
  if (!realClient) {
    el.innerHTML = card(`<p class="text-xs" style="color:var(--terracotta);">⚠ Esta cliente ainda não tem registro real no Supabase — os valores de Pagamentos abaixo são só demonstração local, não um pagamento persistente.</p>`, 'mb-6');
    return;
  }
  const { data: contract } = await supabase.from('contracts').select('id, value_cents').eq('client_id', realClient.id).maybeSingle();
  const [{ data: payments }, { lines, error: linesErr }] = await Promise.all([
    supabase.from('payments').select('amount_cents, status').eq('client_id', realClient.id).eq('provider', 'sumup'),
    contract?.id ? loadActiveObligations({ contractId: contract.id }) : Promise.resolve({ lines: [] }),
  ]);
  const brlCents = (c) => (c / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  // Recebido: confirmed real payments, a fact about money movement — Final
  // Core Production Architecture Pass, Part 3. A Receber/Em Atraso: the
  // contractual obligation itself (current signed plan) minus confirmed
  // allocations, never "payments where status is pending/overdue" — a
  // client can owe money for an installment Nay never generated a SumUp
  // link for at all.
  const recebido = (payments || []).filter((p) => p.status === 'paid').reduce((s, p) => s + p.amount_cents, 0);
  const { aReceberCents, emAtrasoCents } = summarizeObligations(lines || []);
  const planTotal = (lines || []).reduce((s, l) => s + l.amount_cents, 0);
  const agreedVsPlanMismatch = contract?.value_cents != null && lines?.length && Math.abs(planTotal - contract.value_cents) >= 1;
  el.innerHTML = card(`
    <p class="text-sm text-white/50 mb-3">Financeiro Real — Sistema Supabase</p>
    <div class="grid sm:grid-cols-4 gap-4 text-sm mb-3">
      <div><p class="text-white/40 text-xs mb-1">Valor Contratado</p><p>${contract?.value_cents ? brlCents(contract.value_cents) : '—'}</p></div>
      <div><p class="text-white/40 text-xs mb-1">Recebido</p><p>${brlCents(recebido)}</p></div>
      <div><p class="text-white/40 text-xs mb-1">A Receber</p><p>${linesErr ? '—' : brlCents(aReceberCents)}</p></div>
      <div><p class="text-white/40 text-xs mb-1">Em Atraso</p><p style="${emAtrasoCents ? 'color:var(--terracotta);' : ''}">${linesErr ? '—' : brlCents(emAtrasoCents)}</p></div>
    </div>
    ${agreedVsPlanMismatch ? `
      <p class="text-xs" style="color:var(--terracotta);">⚠ Valor acordado (${brlCents(contract.value_cents)}) e soma do plano assinado (${brlCents(planTotal)}) não batem — diferença de ${brlCents(Math.abs(planTotal - contract.value_cents))}. Resolva no contrato real antes de considerar o plano final.</p>
    ` : ''}
  `, 'mb-6');
}

function renderFinancialTab() {
  const o = MockDB.getOnboarding(clientId);
  const c = o.contract;
  const payments = MockDB.getPayments(clientId);
  const paid = payments.filter((p) => p.status === 'paid').reduce((s, p) => s + p.amount, 0);
  const pending = payments.filter((p) => p.status !== 'paid').reduce((s, p) => s + p.amount, 0);

  return `
    ${card(`
      <p class="text-sm text-white/50 mb-4">Programa &amp; Contrato</p>
      <div class="grid sm:grid-cols-3 gap-4 text-sm mb-4">
        <div><p class="text-white/40 text-xs mb-1">Programa</p><p>${c.program ? PROGRAM_LABEL[c.program] : '—'}</p></div>
        <div><p class="text-white/40 text-xs mb-1">Modelo</p><p>${c.duration ? CONTRACT_DURATION_LABEL[c.duration] : '—'}</p></div>
        <div><p class="text-white/40 text-xs mb-1">Valor Total</p><p>${c.value ? `${brl(c.value)}` : '—'}</p></div>
      </div>
      <a href="contract.html?legacy_id=${clientId}" class="btn-ghost inline-block">Abrir Contrato (Sistema Real) ↗</a>
    `, 'mb-6')}
    <div id="real-financial-summary"></div>
    ${card(`
      <div class="flex items-center justify-between mb-4">
        <p class="text-sm text-white/50">Pagamentos (demonstração)</p>
        <div class="flex items-center gap-3">
          <span class="text-xs text-white/30">Recebido ${brl(paid)} (demo) · A receber ${brl(pending)} (demo)</span>
          <a href="payments.html?legacy_id=${clientId}" class="btn-text">Cobranças (SumUp) ↗</a>
        </div>
      </div>
      <p class="text-xs text-white/20 mb-4">Os valores acima vêm dos dados de demonstração locais (MockDB) — veja o resumo real acima (se existir) ou "Cobranças (SumUp)" para os pagamentos efetivamente registrados no Supabase.</p>
      ${payments.length ? `
        <div class="divide-y" style="border-color:var(--line);">
          ${payments.map((p, i) => {
            const desc = `Parcela ${i + 1}/${payments.length} — ${client.fullName}`;
            const genLinkHref = `payments.html?legacy_id=${clientId}&open=charge&prefill_amount=${p.amount}&prefill_due=${p.dueDate}&prefill_desc=${encodeURIComponent(desc)}`;
            return `
            <div class="py-3 ${p.reportedPaidAt && p.status !== 'paid' ? 'bg-white/5 -mx-2 px-2 rounded' : ''}">
              <div class="flex items-center justify-between">
                <div>
                  <p class="text-sm">${brl(p.amount)}</p>
                  <p class="text-xs text-white/30 mt-0.5">
                    Vencimento ${formatDate(p.dueDate)}${p.method ? ` · ${PAYMENT_METHOD_LABEL[p.method] || p.method}` : ''}${p.paidAt ? ` · Pago em ${formatDate(p.paidAt)}` : ''}
                    ${p.linkSentAt ? ` · Link enviado em ${formatDate(p.linkSentAt)}` : ''}
                    ${p.reportedPaidAt && p.status !== 'paid' ? ` · <span style="color:var(--gold);">Assistente reportou pagamento em ${formatDate(p.reportedPaidAt)}</span>` : ''}
                  </p>
                </div>
                <div class="flex items-center gap-3">
                  ${paymentBadge(p.status)}
                  ${p.status !== 'paid' ? `<a href="${genLinkHref}" class="btn-primary">Gerar Link de Pagamento</a>` : ''}
                  ${p.status !== 'paid' ? `<button data-mark-paid="${p.id}" class="btn-ghost">${p.reportedPaidAt ? 'Confirmar recebimento' : 'Marcar como pago'}</button>` : ''}
                </div>
              </div>
              <div class="flex items-center justify-between mt-2">
                <p class="text-xs text-white/30">Nota Fiscal: ${NF_STATUS_LABEL[p.nf.status]}</p>
                ${p.nf.status === 'requested' ? `<button data-issue-nf="${p.id}" class="btn-text">Emitir Nota Fiscal</button>` : ''}
              </div>
            </div>
          `;
          }).join('')}
        </div>
      ` : '<p class="text-sm" style="color:var(--muted);">Nenhum pagamento registrado — defina o programa e o modelo de contrato na aba Onboarding.</p>'}
    `)}
  `;
}

function renderBrandDirectionTab() {
  const bd = MockDB.getBrandDirection(clientId);
  const linkOk = bd.pinterestUrl && isValidHttpUrl(bd.pinterestUrl);
  return `
    ${card(`
      <div class="flex items-center justify-between mb-4">
        <p class="text-sm text-white/50">Pré-visualização do Mural</p>
        ${linkOk ? `<a ${externalLinkAttrs(bd.pinterestUrl)} class="btn-ghost">Abrir no Pinterest</a>` : ''}
      </div>
      <div class="board-area" id="board-area">${linkOk ? '' : boardEmptyState()}</div>
    `, 'mb-6')}
    ${card(`
    <form id="brand-direction-form" class="space-y-4">
      <div>
        <label class="text-xs text-white/40 block mb-1">URL do Mural no Pinterest</label>
        <input name="pinterestUrl" class="field" value="${bd.pinterestUrl || ''}" placeholder="https://www.pinterest.com/..." />
        ${bd.pinterestUrl && !isValidHttpUrl(bd.pinterestUrl) ? '<p class="text-xs mt-1" style="color:var(--error);">O link salvo não parece válido.</p>' : ''}
        <p class="text-xs text-white/20 mt-1">O board precisa ser público para aparecer embutido na página da cliente; do contrário, ela vê um card alternativo.</p>
      </div>
      <div>
        <label class="text-xs text-white/40 block mb-1">Mensagem sobre o Mural <span class="text-white/20">(explica à cliente como usar as referências)</span></label>
        <textarea name="moodBoardIntro" rows="2" class="field">${bd.moodBoardIntro || ''}</textarea>
      </div>
      <div>
        <label class="text-xs text-white/40 block mb-1">Resumo do Posicionamento</label>
        <textarea name="positioningSummary" rows="3" class="field">${bd.positioningSummary || ''}</textarea>
      </div>
      <div class="grid sm:grid-cols-2 gap-4">
        <div>
          <label class="text-xs text-white/40 block mb-1">Palavras-Chave / Atributos <span class="text-white/20">(uma por linha)</span></label>
          <textarea name="keywords" rows="4" class="field">${(bd.keywords || []).join('\n')}</textarea>
        </div>
        <div>
          <label class="text-xs text-white/40 block mb-1">Tom de Comunicação</label>
          <textarea name="tone" rows="4" class="field">${bd.tone || ''}</textarea>
        </div>
      </div>
      <div>
        <label class="text-xs text-white/40 block mb-1">Referências Visuais e de Conteúdo <span class="text-white/20">(uma por linha)</span></label>
        <textarea name="references" rows="3" class="field">${(bd.references || []).join('\n')}</textarea>
      </div>
      <div>
        <label class="text-xs text-white/40 block mb-1">Orientações e Observações da Nay</label>
        <textarea name="guidance" rows="3" class="field">${bd.guidance || ''}</textarea>
      </div>
      <div class="grid sm:grid-cols-2 gap-4">
        <div>
          <label class="text-xs text-white/40 block mb-1">O que pertence a esta marca <span class="text-white/20">(uma por linha)</span></label>
          <textarea name="belongs" rows="4" class="field">${(bd.belongs || []).join('\n')}</textarea>
        </div>
        <div>
          <label class="text-xs text-white/40 block mb-1">O que não pertence a esta marca <span class="text-white/20">(uma por linha)</span></label>
          <textarea name="doesntBelong" rows="4" class="field">${(bd.doesntBelong || []).join('\n')}</textarea>
        </div>
      </div>
      <div class="flex items-center justify-between pt-1">
        <p class="text-xs text-white/20">${bd.updatedAt ? `Atualizado em ${formatDate(bd.updatedAt)}` : 'Ainda não preenchido — a cliente vê um estado "em breve" até aqui ser salvo.'}</p>
        <button type="submit" class="btn-primary" style="padding:9px 18px;font-size:12.5px;">Salvar</button>
      </div>
    </form>
    `)}
  `;
}

function renderQuestionnaireTab() {
  const q = MockDB.getQuestionnaire(clientId);
  const a = MockDB.getQuestionnaireAnalysis(clientId);
  return `
    ${card(`
      <p class="text-sm text-white/50 mb-4">Respostas da Cliente</p>
      <div class="space-y-4">
        ${q.questions.map((qu) => `
          <div class="pb-4 border-b border-white/5 last:border-0 last:pb-0">
            <p class="text-sm text-white/40 mb-1">${qu.text}</p>
            <p>${qu.answer}</p>
          </div>
        `).join('')}
      </div>
    `, 'mb-6')}
    ${card(`
      <div class="flex items-center justify-between mb-4">
        <p class="text-sm text-white/50">Análise de IA <span class="text-white/30">· v${a.version}</span></p>
        <button id="regen-qa" class="btn-ghost">Regenerar</button>
      </div>
      <div id="qa-body" class="space-y-4 text-sm">
        ${renderQABody(a)}
      </div>
    `)}
  `;
}

function renderQABody(a) {
  return `
    <div><p class="text-white/40 mb-1">Resumo Executivo</p><p>${a.executiveSummary}</p></div>
    <div><p class="text-white/40 mb-1">Pontos Fortes</p><ul class="list-disc list-inside space-y-1">${a.strengths.map((s) => `<li>${s}</li>`).join('')}</ul></div>
    <div><p class="text-white/40 mb-1">Objetivos</p><ul class="list-disc list-inside space-y-1">${a.goals.map((s) => `<li>${s}</li>`).join('')}</ul></div>
    <div><p class="text-white/40 mb-1">Pontos de Dor</p><ul class="list-disc list-inside space-y-1">${a.painPoints.map((s) => `<li>${s}</li>`).join('')}</ul></div>
    <div><p class="text-white/40 mb-1">Oportunidades</p><ul class="list-disc list-inside space-y-1">${a.opportunities.map((s) => `<li>${s}</li>`).join('')}</ul></div>
    <div><p class="text-white/40 mb-1">Perguntas Sugeridas</p><ul class="list-disc list-inside space-y-1">${a.suggestedQuestions.map((s) => `<li>${s}</li>`).join('')}</ul></div>
    <div><p class="text-white/40 mb-1">Maturidade do Negócio</p><p>${a.businessMaturity}</p></div>
  `;
}

function renderMeetingTab() {
  const meeting = MockDB.getMeeting(clientId);
  const ta = MockDB.getTranscriptAnalysis(clientId);
  return `
    ${card(`
      <div class="flex items-center justify-between mb-4">
        <p class="text-sm text-white/50">${meeting.title}</p>
        ${statusBadge(meeting.status)}
      </div>
      <p class="text-sm text-white/40 mb-4">Transcrição ${meeting.transcriptUploaded ? 'enviada' : 'não enviada'}. Este protótipo simula o upload/análise — nenhuma leitura real de arquivo ou chamada ao modelo acontece.</p>
      <div class="flex gap-3">
        <button id="upload-btn" class="btn-ghost" ${meeting.transcriptUploaded ? 'disabled' : ''}>Simular Envio de Transcrição</button>
        <button id="analyze-btn" class="btn-ghost" ${!meeting.transcriptUploaded ? 'disabled' : ''}>Analisar Transcrição</button>
      </div>
    `, 'mb-6')}
    ${card(`
      <p class="text-sm text-white/50 mb-4">Análise da Transcrição</p>
      <div id="ta-body" class="space-y-4 text-sm">${ta ? renderTABody(ta) : '<p class="text-white/30 text-sm">Ainda não analisada — envie e analise a transcrição acima.</p>'}</div>
    `)}
  `;
}

function renderTABody(ta) {
  return `
    <div><p class="text-white/40 mb-1">Resumo da Reunião</p><p>${ta.summary}</p></div>
    <div><p class="text-white/40 mb-1">Objetivos</p><ul class="list-disc list-inside space-y-1">${ta.goals.map((s) => `<li>${s}</li>`).join('')}</ul></div>
    <div><p class="text-white/40 mb-1">Desafios</p><ul class="list-disc list-inside space-y-1">${ta.challenges.map((s) => `<li>${s}</li>`).join('')}</ul></div>
    <div><p class="text-white/40 mb-1">Itens de Ação</p><ul class="list-disc list-inside space-y-1">${ta.actionItems.map((s) => `<li>${s}</li>`).join('')}</ul></div>
    <div><p class="text-white/40 mb-1">Tarefas</p><ul class="list-disc list-inside space-y-1">${ta.homework.map((s) => `<li>${s}</li>`).join('')}</ul></div>
    <div><p class="text-white/40 mb-1">Principais Insights</p><ul class="list-disc list-inside space-y-1">${ta.keyInsights.map((s) => `<li>${s}</li>`).join('')}</ul></div>
  `;
}

function renderPlaybookTab() {
  const pb = MockDB.getPlaybook(clientId);
  const latest = pb.versions[pb.versions.length - 1];
  const sectionDefs = MockDB.getSectionDefs();

  if (!latest) {
    return card(`
      <div class="flex items-center justify-between mb-2">
        <p class="text-sm text-white/50">Nenhuma versão gerada ainda</p>
        <button id="generate-pb" class="btn-ghost">Gerar Primeira Versão</button>
      </div>
      <p class="text-xs text-white/30">Requer questionário e transcrição analisados.</p>
    `);
  }

  return `
    <div class="flex items-center justify-between mb-4">
      <p class="text-sm text-white/50">Versão ${latest.version} ${statusBadge(latest.status)}</p>
      <div class="flex gap-3">
        <button id="generate-pb" class="btn-ghost">Gerar Nova Versão</button>
        <button id="publish-pb" class="btn-primary" style="padding:9px 18px;font-size:12.5px;" ${latest.status === 'published' ? 'disabled' : ''}>Publicar</button>
      </div>
    </div>
    <p class="text-xs text-white/30 mb-6">${pb.versions.length} versão(ões) no total — histórico completo preservado.</p>
    <div class="space-y-4">
      ${sectionDefs.map(([key, title]) => `
        <div class="card">
          <p class="text-xs uppercase tracking-wider text-white/40 mb-2">${title}</p>
          <textarea data-section="${key}" rows="2" class="field text-sm">${latest.sections[key]}</textarea>
        </div>
      `).join('')}
    </div>
  `;
}

function renderPitchTab() {
  const pitches = MockDB.getPitches(clientId);
  return `
    ${card(`
      <div class="flex items-center justify-between mb-4">
        <p class="text-sm text-white/50">Variações de Pitch</p>
        <button id="generate-pitch" class="btn-ghost">${pitches ? 'Regenerar' : 'Gerar'}</button>
      </div>
      <div id="pitch-body">
        ${pitches ? Object.entries(pitches).filter(([k]) => k !== 'version').map(([k, v]) => `
          <div class="mb-4 last:mb-0"><p class="text-xs text-white/40 mb-1 capitalize">${k.replace(/_/g, ' ')}</p><p class="text-sm">${v}</p></div>
        `).join('') : '<p class="text-white/30 text-sm">Ainda não gerado.</p>'}
      </div>
    `)}
  `;
}

// --- Teste de Arquétipos (Persea Archetype Quiz) — Nay's internal view.
// Never shows raw responses (only computed scores) since that's all the
// scoring engine (mock-db.js) exposes — same "trusted calc, never a raw
// dump" boundary the client side has to respect too.
function renderArchetypeQuizTab() {
  const quiz = MockDB.getClientArchetypeQuiz(clientId);
  const attempts = quiz.attempts;
  const latest = attempts[attempts.length - 1];
  const status = !latest ? 'not_started' : latest.status;

  if (!latest) {
    return card(`
      <div class="flex items-center justify-between mb-3">
        <p class="text-sm text-white/50">Status</p>
        <span class="badge ${ARCHETYPE_ATTEMPT_STATUS_BADGE_CLASS.not_started}">${ARCHETYPE_ATTEMPT_STATUS_LABEL.not_started}</span>
      </div>
      <p class="text-sm" style="color:var(--muted);">Esta cliente ainda não começou o Teste de Arquétipos.</p>
    `);
  }

  const progress = MockDB.getArchetypeAttemptProgress(latest);
  const results = status === 'completed' ? MockDB.getArchetypeResults(clientId) : null;

  return `
    ${card(`
      <div class="flex items-center justify-between mb-4 flex-wrap gap-3">
        <p class="text-sm text-white/50">Status do Teste</p>
        <span class="badge ${ARCHETYPE_ATTEMPT_STATUS_BADGE_CLASS[status]}">${ARCHETYPE_ATTEMPT_STATUS_LABEL[status]}</span>
      </div>
      <div class="grid sm:grid-cols-4 gap-4 text-sm mb-5">
        <div><p class="text-xs text-white/30 mb-1">Iniciado em</p><p>${formatDate(latest.startedAt)}</p></div>
        <div><p class="text-xs text-white/30 mb-1">Concluído em</p><p>${latest.completedAt ? formatDate(latest.completedAt) : '—'}</p></div>
        <div><p class="text-xs text-white/30 mb-1">Respostas</p><p>${progress.answered} de ${progress.total}</p></div>
        <div>
          <p class="text-xs text-white/30 mb-1">Coleção visual</p>
          <select id="archetype-visual-set" class="field text-sm" style="padding:4px 8px;">
            <option value="">Não definida</option>
            ${ARCHETYPE_VISUAL_SETS.map((v) => `<option value="${v}" ${quiz.visualSet === v ? 'selected' : ''}>${ARCHETYPE_VISUAL_SET_LABEL[v]}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="flex flex-wrap items-center gap-3 pt-3" style="border-top:1px solid var(--line);">
        ${status === 'completed' ? `<a href="#" id="preview-as-client" class="btn-ghost">Pré-visualizar como a cliente ↗</a>` : ''}
        ${status === 'completed' ? `<button type="button" id="unlock-retake" class="btn-text">Liberar novo teste</button>` : ''}
        ${status === 'completed' ? `<button type="button" id="print-result" class="btn-text no-print">Imprimir resultado</button>` : ''}
      </div>
    `, 'mb-6')}

    ${results ? `
      ${results.hasTie ? `
        <div class="mb-6" style="border-left:3px solid var(--gold); border-radius:4px;">${card(`
          <p class="text-sm" style="color:var(--gold);">Há um empate na faixa de destaque — considere esses arquétipos juntos na leitura com a cliente.</p>
        `)}</div>
      ` : ''}

      ${card(`
        <p class="text-sm text-white/50 mb-4">Arquétipos em Destaque</p>
        <div class="grid sm:grid-cols-2 lg:grid-cols-${Math.min(results.featured.length, 4)} gap-4">
          ${results.featured.map((f) => `
            <div class="flex items-start gap-3">
              ${archetypePortrait(f, { size: 64 })}
              <div>
                <p class="text-sm font-medium">${f.name}</p>
                <p class="text-xs text-white/30">${f.rawScore}/20 · ${f.percentage}%</p>
                <p class="text-xs text-white/40 mt-1">${f.centralDesire}</p>
              </div>
            </div>
          `).join('')}
        </div>
      `, 'mb-6')}

      ${card(`
        <p class="text-sm text-white/50 mb-4">Mapa Completo — Os 12 Arquétipos</p>
        <div class="flex justify-center mb-6">${renderArchetypeRadar(results.scores, { size: 300 })}</div>
        <div class="divide-y" style="border-color:var(--line);">
          ${results.scores.map((s) => `
            <div class="flex items-center justify-between py-2.5">
              <div class="flex items-center gap-2">
                <span class="text-xs text-white/20 w-6">#${s.rank}</span>
                <span class="text-sm">${s.name}</span>
              </div>
              <span class="text-xs text-white/40">${s.rawScore}/20 · ${s.percentage}%</span>
            </div>
          `).join('')}
        </div>
      `, 'mb-6')}

      ${card(`
        <p class="text-sm text-white/50 mb-3">Suas Notas Privadas <span class="text-white/20 text-xs">(nunca aparecem para a cliente)</span></p>
        <textarea id="archetype-notes" rows="4" class="field">${quiz.notes || ''}</textarea>
        <button type="button" id="save-archetype-notes" class="btn-ghost mt-3">Salvar Notas</button>
      `)}
    ` : `
      ${card(`<p class="text-sm" style="color:var(--muted);">O teste ainda está em andamento — o resultado aparece aqui assim que a cliente concluir.</p>`)}
    `}
  `;
}

function renderAssessmentTab() {
  const a = MockDB.getAssessment(clientId);
  return card(`
    <div class="flex items-center justify-between mb-3">
      <p class="font-medium">${a.title}</p>
      ${statusBadge(a.status)}
    </div>
    <p class="text-sm text-white/50 mb-4">${a.description}</p>
    <div class="flex items-center gap-3">
      <a href="${a.externalUrl}" target="_blank" class="btn-ghost">Abrir Teste Externo</a>
      <button id="mark-complete" class="btn-ghost" ${a.status === 'completed' ? 'disabled' : ''}>Marcar como Concluído</button>
    </div>
  `);
}

function renderHomeworkTab() {
  const tasks = MockDB.getHomework(clientId);
  const pct = MockDB.homeworkCompletionPct(clientId);
  return card(`
    <p class="text-sm text-white/50 mb-4">Conclusão: ${pct}%</p>
    <div class="space-y-3">
      ${tasks.map((t) => `
        <div class="py-3 border-b border-white/5 last:border-0">
          <div class="flex items-center justify-between">
            <span>${t.title}</span>
            ${statusBadge(t.status)}
          </div>
          ${t.type === 'media_upload' && (t.submissions || []).length ? `
            <div class="mt-3 space-y-2">
              ${t.submissions.map((s) => `
                <div class="rounded border p-3" style="border-color:var(--line);">
                  <p class="text-xs mb-2" style="color:var(--muted);">${s.name} · ${formatDateTime(s.uploadedAt)}</p>
                  ${s.url
                    ? (s.kind === 'video'
                        ? `<video src="${s.url}" controls class="w-full rounded" style="max-height:220px;"></video>`
                        : `<audio src="${s.url}" controls class="w-full"></audio>`)
                    : `<p class="text-xs italic" style="color:var(--muted);">Gravação de sessão anterior — não reproduzível neste protótipo.</p>`}
                </div>
              `).join('')}
            </div>
          ` : ''}
        </div>
      `).join('')}
    </div>
  `);
}

function renderMeetingPrepTab() {
  const q = MockDB.getQuestionnaire(clientId);
  const pct = MockDB.homeworkCompletionPct(clientId);
  const pb = MockDB.getPublishedPlaybook(clientId);
  const hw = MockDB.getHomework(clientId);
  const questionsSubmitted = hw.find((t) => t.id === 'h3')?.status === 'completed';
  const experience = MockDB.getPlaybookExperience(clientId);
  const quiz = MockDB.getQuiz(clientId);
  const attention = [];
  if (!pb) attention.push('Playbook ainda não publicado para a cliente');
  if (pct < 100) attention.push('Tarefas não totalmente concluídas');
  if (!questionsSubmitted) attention.push('Perguntas de reflexão não enviadas');
  if (pb && !experience.completedAt) attention.push('Cliente ainda não vivenciou o playbook (podcast/vídeo/audiobook)');
  if (pb && experience.completedAt && !quiz.completedAt) attention.push('Quiz do playbook ainda não feito');

  return `
    ${card(`
      <p class="text-sm text-white/50 mb-4">Checklist Pré-Encontro</p>
      <div class="grid md:grid-cols-2 gap-4 text-sm">
        <div class="flex justify-between py-2 border-b border-white/5"><span>Questionário</span>${statusBadge(q.status === 'submitted' ? 'completed' : 'pending')}</div>
        <div class="flex justify-between py-2 border-b border-white/5"><span>Tarefas</span><span>${pct}%</span></div>
        <div class="flex justify-between py-2 border-b border-white/5"><span>Playbook Publicado</span>${statusBadge(pb ? 'published' : 'draft')}</div>
        <div class="flex justify-between py-2 border-b border-white/5"><span>Perguntas Enviadas</span>${statusBadge(questionsSubmitted ? 'completed' : 'pending')}</div>
        <div class="flex justify-between py-2 border-b border-white/5"><span>Experiência do Playbook</span>${statusBadge(experience.completedAt ? 'completed' : 'pending')}</div>
        <div class="flex justify-between py-2 border-b border-white/5"><span>Quiz</span>${quiz.completedAt ? `<span class="text-xs">${quiz.score}/${quiz.total}</span>` : statusBadge('pending')}</div>
      </div>
    `, 'mb-6')}
    ${card(`
      <p class="text-sm text-white/50 mb-3">Áreas que Requerem Atenção</p>
      ${attention.length ? `<ul class="list-disc list-inside space-y-1 text-sm" style="color:var(--gold);">${attention.map((a) => `<li>${a}</li>`).join('')}</ul>` : '<p class="text-sm" style="color:var(--gold);">Tudo em dia.</p>'}
    `)}
  `;
}

function renderActivityTab() {
  const events = MockDB.getActivity(clientId);
  const moodLog = MockDB.getMoodLog(clientId).slice(-6).reverse();
  const requests = MockDB.getMeetingRequests(clientId);

  return `
    ${card(`
      <div class="space-y-4">
        ${events.map((e) => `
          <div class="flex items-start gap-4 py-3 border-b border-white/5 last:border-0">
            <div class="w-2 h-2 mt-2 rounded-full shrink-0" style="background:var(--terracotta);"></div>
            <div><p>${e.text}</p><p class="text-xs text-white/30 mt-1">${formatDateTime(e.at)}</p></div>
          </div>
        `).join('')}
      </div>
    `, 'mb-6')}
    ${card(`
      <p class="text-sm text-white/50 mb-4">Humor Recente</p>
      ${moodLog.length ? `
        <div class="flex items-center gap-3">
          ${moodLog.map((m) => `<span title="${m.context} · ${formatDateTime(m.at)}" style="font-size:1.4rem;">${MOOD_EMOJI[m.mood]}</span>`).join('')}
        </div>
      ` : '<p class="text-sm" style="color:var(--muted);">Sem registros ainda.</p>'}
    `, 'mb-6')}
    ${card(`
      <p class="text-sm text-white/50 mb-4">Solicitações de Reunião</p>
      ${requests.length ? requests.map((r) => `
        <div class="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
          <span class="text-sm">${r.reason}</span>
          ${statusBadge(r.status === 'done' ? 'completed' : r.status === 'assigned' ? 'in_progress' : 'pending')}
        </div>
      `).join('') : '<p class="text-sm" style="color:var(--muted);">Nenhuma solicitação.</p>'}
    `)}
  `;
}

// --- Ficha de Valor e Precificação — Nay's private workspace for the
// Leitura Estratégica de Valor. Never visible to the client (see
// client/value-analysis.js: it only ever reads publishedDeliverable, never
// recommendation/reviewStatus/internalNotes/scenarios). "Preview before
// publish" is enforced with a local flag reset per tab visit — see
// deliverablePreviewShown below.
let deliverablePreviewShown = false;

function formatAnswerForDisplay(v, type) {
  if (v === 'unknown') return '<span class="text-white/30 italic">Não sei informar</span>';
  if (v === '' || v === null || v === undefined || (Array.isArray(v) && !v.length)) return '<span class="text-white/20 italic">— não informado —</span>';
  if (Array.isArray(v)) return v.join(', ');
  if (type === 'currency') return fmtBRL(v);
  if (type === 'percent') return fmtPct(v);
  return String(v);
}
function reviewStatusBadge(status) {
  const cls = { confirmado: 'badge-completed', estimado: 'badge-progress', precisa_esclarecer: 'badge-locked', nao_aplicavel: 'badge-locked' };
  return status ? `<span class="badge ${cls[status]}" style="font-size:9px;">${REVIEW_STATUS_LABEL[status]}</span>` : '';
}
function reviewSelect(path, current) {
  return `
    <select data-review-select="${path}" class="field" style="max-width:170px; font-size:11.5px; padding:5px 8px;">
      <option value="">Marcar…</option>
      ${REVIEW_STATUSES.map((s) => `<option value="${s}" ${current === s ? 'selected' : ''}>${REVIEW_STATUS_LABEL[s]}</option>`).join('')}
    </select>
  `;
}
function reviewFieldRow(rec, path, label, value, type) {
  return `
    <div class="flex items-start justify-between gap-4 py-2 border-b border-white/5 last:border-0">
      <div class="min-w-0">
        <p class="text-xs text-white/30">${label}</p>
        <p class="text-sm mt-0.5">${formatAnswerForDisplay(value, type)}</p>
      </div>
      ${reviewSelect(path, rec.reviewStatus[path])}
    </div>
  `;
}
function renderAdminSimpleSection(rec, section) {
  const rows = section.fields
    .filter((f) => !f.condition || f.condition(rec.answers))
    .map((f) => reviewFieldRow(rec, `${section.key}.${f.key}`, f.label, rec.answers[section.key][f.key], f.type))
    .join('');
  return card(`<p class="text-sm text-white/50 mb-1">${section.num}. ${section.title}</p><div class="mt-2">${rows}</div>`, 'mb-4');
}
function renderAdminItemCard(rec, groupKey, item, fields, titleFallback) {
  const path = `${groupKey}.${item.id}`;
  const title = item.name || item.description || item.category || titleFallback;
  return `
    <div class="value-item-card mb-3">
      <div class="flex items-center justify-between gap-3 mb-3 flex-wrap">
        <p class="text-sm font-medium">${title}</p>
        ${reviewStatusBadge(rec.reviewStatus[path])}
        ${reviewSelect(path, rec.reviewStatus[path])}
      </div>
      <div class="grid sm:grid-cols-2 gap-x-6">
        ${fields.filter((f) => !f.condition || f.condition(item)).map((f) => `
          <div class="py-1.5">
            <p class="text-xs text-white/30">${f.label}</p>
            <p class="text-sm mt-0.5">${formatAnswerForDisplay(item[f.key], f.type)}</p>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}
// Everything Nay needs to actually know this client before she reviews the
// Leitura Estratégica de Valor — reuses the exact same aggregation the
// assistant's context bundle is built from (see getClientContextBundle),
// so there's one source of truth for "who is this client" instead of a
// second, thinner copy living here. This is the material worth spending
// real time with before touching the recommendation below: the first
// meeting, her mood board/positioning, her archetype result, and any
// private notes — not just her name and program.
function renderClientContextCard() {
  const b = MockDB.getClientContextBundle(clientId);
  const bd = b.brandDirection;
  return card(`
    <p class="text-sm text-white/50 mb-4">Contexto da Cliente <span class="text-white/20 text-xs">(reveja antes de analisar — evita reperguntar o que ela já contou)</span></p>
    <div class="grid sm:grid-cols-3 gap-4 text-sm mb-5">
      <div><p class="text-xs text-white/30 mb-1">Nome</p><p>${client.fullName}</p></div>
      <div><p class="text-xs text-white/30 mb-1">Programa</p><p>${PROGRAM_LABEL[MockDB.getOnboarding(clientId).contract.program] || '—'}</p></div>
      <div><p class="text-xs text-white/30 mb-1">Plano</p><p>Premium</p></div>
    </div>
    <div class="space-y-4 text-sm" style="border-top:1px solid var(--line); padding-top:16px;">
      <div>
        <p class="text-white/40 text-xs mb-1">Primeira Reunião</p>
        ${b.firstMeeting
          ? `<p>${formatDateTime(b.firstMeeting.date)} — ${b.firstMeeting.topic || b.firstMeeting.title}</p>${b.firstMeeting.generalNotes ? `<p class="text-white/40 text-xs mt-1">${b.firstMeeting.generalNotes}</p>` : ''}`
          : '<p class="text-white/20">Ainda não realizada.</p>'}
      </div>
      <div>
        <p class="text-white/40 text-xs mb-1">Mural de Inspiração / Posicionamento</p>
        ${bd.pinterestUrl && isValidHttpUrl(bd.pinterestUrl) ? `<a ${externalLinkAttrs(bd.pinterestUrl)} class="btn-text">Abrir no Pinterest ↗</a>` : '<p class="text-white/20">Sem mural ainda.</p>'}
        ${bd.positioningSummary ? `<p class="mt-1">${bd.positioningSummary}</p>` : ''}
      </div>
      <div>
        <p class="text-white/40 text-xs mb-1">Teste de Arquétipos</p>
        <p>${{ not_started: 'Não iniciado', in_progress: 'Em andamento', completed: 'Concluído' }[b.archetypeAssessment.status] || 'Não iniciado'}</p>
      </div>
      <div>
        <p class="text-white/40 text-xs mb-1">Suas Notas Privadas</p>
        <p class="${b.privateNotes ? '' : 'text-white/20'}">${b.privateNotes || 'Nenhuma nota registrada.'}</p>
      </div>
    </div>
  `, 'mb-4');
}
function renderValueAnalysisTab() {
  if (client.programSlug !== 'persea-premium') {
    return card('<p class="text-sm" style="color:var(--muted);">Esta cliente não está no Programa Premium — a Leitura Estratégica de Valor não se aplica.</p>');
  }
  const access = MockDB.getValueAnalysisAccess(clientId);
  const introBanner = `
    <div class="mb-6" style="border-left:3px solid var(--gold); border-radius:4px;">${card(`
      <p class="text-xs uppercase tracking-[.1em] mb-1" style="color:var(--gold);">✦ Exclusivo do Persea Premium</p>
      <p class="text-sm text-white/50">Este é o coração do programa Premium. Reserve um tempo de verdade aqui — o ideal são algumas horas revendo o contexto da cliente e cada resposta com calma — antes de fazer qualquer recomendação. Você vai sugerir mudanças financeiras e no processo comercial dela; a análise precisa ser tão cuidadosa quanto o impacto que ela terá.</p>
    `)}</div>
  `;
  if (access.status === 'upcoming' || access.status === 'available') {
    return `
      ${introBanner}
      ${card(`
        <span class="badge ${VALUE_ASSESSMENT_STATUS_BADGE_CLASS[access.status]}">${VALUE_ASSESSMENT_STATUS_LABEL[access.status]}</span>
        <p class="text-sm mt-3" style="color:var(--muted);">${access.status === 'upcoming' ? 'Ainda não liberada para esta cliente (onboarding em andamento).' : 'Liberada — aguardando a cliente começar.'}</p>
      `)}
    `;
  }

  const rec = MockDB.getValueAssessment(clientId);
  const capacity = calcCapacity(rec.answers.s4);
  const fixedTotal = calcFixedCostsTotal(rec.answers.fixedCosts);
  const varSummary = calcVariableCostsSummary(rec.answers.variableCosts, rec.answers.s2.monthlyRevenue);
  const reserves = ['reserveEmergency', 'reserveReinvestment', 'reserveGrowth', 'reserveVacation', 'reserveOther']
    .reduce((sum, k) => sum + (Number(rec.answers.s5[k]) || 0), 0);
  const operatingReq = calcOperatingRequirement({
    fixedCostsTotal: fixedTotal.value, desiredProLabore: rec.answers.s5.desiredProLabore, reserves, debt: 0,
    variableCostPct: varSummary.pctOfRevenue, taxPct: 0, revenueTarget: rec.answers.s5.desiredMonthlyRevenue,
  });
  const clarifications = Object.entries(rec.reviewStatus).filter(([, v]) => v === 'precisa_esclarecer');
  const pathLabel = (path) => {
    const [sec, ...rest] = path.split('.');
    const section = SECTIONS.find((s) => s.key === sec);
    if (section && rest.length === 1) { const f = section.fields.find((f) => f.key === rest[0]); if (f) return `${section.title} — ${f.label}`; }
    if (['offers', 'fixedCosts', 'variableCosts', 'references'].includes(sec)) return `${sec} — item`;
    return path;
  };

  return `
    ${introBanner}
    <div class="flex items-center justify-between flex-wrap gap-3 mb-6">
      <div class="flex items-center gap-3">
        <span class="badge ${VALUE_ASSESSMENT_STATUS_BADGE_CLASS[rec.status]}">${VALUE_ASSESSMENT_STATUS_LABEL[rec.status]}</span>
        <span class="text-xs text-white/30">${rec.submittedAt ? `Enviado em ${formatDate(rec.submittedAt)}` : 'Ainda não enviado'}</span>
      </div>
      ${rec.status === 'submitted' ? '<button type="button" id="start-analysis-admin" class="btn-primary" style="padding:8px 16px;font-size:12.5px;">Iniciar Análise</button>' : ''}
    </div>

    ${renderClientContextCard()}
    ${renderAdminSimpleSection(rec, SECTIONS[0])}

    ${card(`
      <p class="text-sm text-white/50 mb-3">2. Oferta e preço atual</p>
      ${rec.answers.offers.map((o) => renderAdminItemCard(rec, 'offers', o, OFFER_FIELDS, 'Oferta')).join('') || '<p class="text-xs text-white/20 mb-3">Nenhuma oferta informada.</p>'}
    `, 'mb-1')}
    ${renderAdminSimpleSection(rec, SECTIONS[1])}

    ${card(`
      <p class="text-sm text-white/50 mb-2">3. Custos da operação</p>
      <p class="text-xs uppercase mt-3 mb-2" style="color:var(--muted); letter-spacing:.1em;">Custos Fixos · Total: ${fmtBRL(fixedTotal.value)}/mês</p>
      ${rec.answers.fixedCosts.map((c) => renderAdminItemCard(rec, 'fixedCosts', c, FIXED_COST_FIELDS, 'Custo fixo')).join('') || '<p class="text-xs text-white/20">Nenhum custo fixo informado.</p>'}
      <p class="text-xs uppercase mt-4 mb-2" style="color:var(--muted); letter-spacing:.1em;">Custos Variáveis · ${fmtBRL(varSummary.value)}/mês${varSummary.pctOfRevenue ? ` + ${fmtPct(varSummary.pctOfRevenue)} do faturamento` : ''}</p>
      ${rec.answers.variableCosts.map((c) => renderAdminItemCard(rec, 'variableCosts', c, VARIABLE_COST_FIELDS, 'Custo variável')).join('') || '<p class="text-xs text-white/20">Nenhum custo variável informado.</p>'}
    `, 'mb-1')}
    ${renderAdminSimpleSection(rec, SECTIONS[2])}
    ${renderAdminSimpleSection(rec, SECTIONS[3])}
    ${renderAdminSimpleSection(rec, SECTIONS[4])}
    ${renderAdminSimpleSection(rec, SECTIONS[5])}
    ${card(`
      <p class="text-sm text-white/50 mb-3">Referências e concorrência</p>
      ${rec.answers.s6.references.map((r) => renderAdminItemCard(rec, 'references', r, REFERENCE_FIELDS, 'Referência')).join('') || '<p class="text-xs text-white/20">Nenhuma referência informada.</p>'}
    `, 'mb-6')}

    ${card(`
      <p class="text-sm text-white/50 mb-3">Informações ausentes ou incertas <span class="text-white/20 text-xs">(gerado a partir das marcações "Precisa esclarecer")</span></p>
      ${clarifications.length ? `<ul class="space-y-1 text-sm">${clarifications.map(([p]) => `<li>• ${pathLabel(p)}</li>`).join('')}</ul>` : '<p class="text-xs text-white/20">Nenhum item marcado como "Precisa esclarecer" até agora.</p>'}
      <p class="text-xs text-white/20 mt-3">Esta lista não é enviada automaticamente à cliente.</p>
    `, 'mb-6')}

    ${renderCalculationsPanel(rec, capacity, operatingReq)}
    ${renderScenariosPanel(rec)}
    ${renderRecommendationPanel(rec)}
    ${renderDeliverablePanel(rec)}
    ${renderPriceHistoryPanel()}
  `;
}
function renderCalculationsPanel(rec, capacity, operatingReq) {
  return card(`
    <p class="text-sm text-white/50 mb-1">Cálculos Automáticos</p>
    <p class="text-xs text-white/20 mb-4">Indicadores calculados a partir das respostas — não são a recomendação final.</p>
    <div class="grid sm:grid-cols-2 gap-6 mb-5">
      <div>
        <p class="text-xs uppercase mb-2" style="color:var(--muted); letter-spacing:.1em;">Capacidade Disponível</p>
        <p class="text-sm">Horas de entrega/semana: <strong>${capacity.deliveryHoursWeekly.toFixed(1)}h</strong></p>
        <p class="text-sm">Horas de entrega/mês: <strong>${capacity.deliveryHoursMonthly.toFixed(1)}h</strong></p>
        <details class="text-xs text-white/30 mt-2"><summary style="cursor:pointer;">Fórmula</summary><p class="mt-1">${capacity.formula}</p>${capacity.assumptions.map((a) => `<p class="mt-1" style="color:var(--terracotta);">⚠ ${a}</p>`).join('')}</details>
      </div>
      <div>
        <p class="text-xs uppercase mb-2" style="color:var(--muted); letter-spacing:.1em;">Necessidade Operacional Mensal</p>
        <p class="text-sm">Necessidade base: <strong>${fmtBRL(operatingReq.baseNeed)}</strong></p>
        <p class="text-sm">Necessidade bruta (c/ custos variáveis): <strong>${fmtBRL(operatingReq.grossedUpRequirement)}</strong></p>
        <details class="text-xs text-white/30 mt-2"><summary style="cursor:pointer;">Fórmula</summary><p class="mt-1">${operatingReq.formula}</p>${operatingReq.assumptions.map((a) => `<p class="mt-1" style="color:var(--terracotta);">⚠ ${a}</p>`).join('')}</details>
      </div>
    </div>
    <p class="text-xs uppercase mb-3" style="color:var(--muted); letter-spacing:.1em;">Indicadores por Oferta</p>
    ${rec.answers.offers.map((o) => {
      const offerCap = calcOfferCapacity(o, capacity);
      const ind = calcPricingIndicators(o, offerCap, operatingReq.grossedUpRequirement);
      return `
        <div class="value-item-card mb-3">
          <p class="text-sm font-medium mb-2">${o.name || 'Oferta'}</p>
          <div class="grid sm:grid-cols-4 gap-3 text-sm">
            <div><p class="text-xs text-white/30">Capacidade realista/mês</p><p>${offerCap.realisticMax ?? '—'}</p></div>
            <div><p class="text-xs text-white/30">Contribuição atual</p><p>${fmtBRL(ind.contribution)}</p></div>
            <div><p class="text-xs text-white/30">Receita na capacidade atual</p><p>${fmtBRL(ind.currentRealisticRevenue)}</p></div>
            <div><p class="text-xs text-white/30">Preço mínimo matemático</p><p style="color:var(--gold);">${fmtBRL(ind.mathematicalMinimum)}</p></div>
          </div>
          <details class="text-xs text-white/30 mt-2"><summary style="cursor:pointer;">Fórmulas</summary><p class="mt-1">${offerCap.formula}</p><p class="mt-1">${ind.formula}</p></details>
        </div>
      `;
    }).join('') || '<p class="text-xs text-white/20">Nenhuma oferta informada.</p>'}
  `, 'mb-6');
}
function renderScenariosPanel(rec) {
  return card(`
    <div class="flex items-center justify-between mb-4">
      <p class="text-sm text-white/50">Cenários de Precificação</p>
      <button type="button" id="new-scenario" class="btn-ghost">+ Novo Cenário</button>
    </div>
    ${rec.scenarios.length ? `
      <div class="overflow-x-auto">
        <table class="w-full text-sm" style="border-collapse:collapse;">
          <thead><tr class="text-left text-xs text-white/30" style="border-bottom:1px solid var(--line);">
            <th class="py-2 pr-4">Cenário</th><th class="py-2 pr-4">Preço</th><th class="py-2 pr-4">Volume/mês</th>
            <th class="py-2 pr-4">Receita</th><th class="py-2 pr-4">Resultado</th><th class="py-2 pr-4"></th>
          </tr></thead>
          <tbody>
            ${rec.scenarios.map((s) => {
              const p = projectScenario(s);
              return `
                <tr style="border-bottom:1px solid var(--line);">
                  <td class="py-2 pr-4">${s.name}${s.isRecommended ? ' <span class="badge badge-completed" style="font-size:9px;">Recomendado</span>' : ''}</td>
                  <td class="py-2 pr-4">${fmtBRL(s.price)}</td>
                  <td class="py-2 pr-4">${s.monthlyVolume ?? '—'}</td>
                  <td class="py-2 pr-4">${fmtBRL(p.revenue)}</td>
                  <td class="py-2 pr-4">${fmtBRL(p.result)}</td>
                  <td class="py-2 pr-4 text-right whitespace-nowrap">
                    ${!s.isRecommended ? `<button type="button" data-set-recommended-scenario="${s.id}" class="btn-text">Marcar recomendado</button>` : ''}
                    <button type="button" data-remove-scenario="${s.id}" class="btn-text" style="color:var(--error);">Remover</button>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    ` : '<p class="text-xs text-white/20">Nenhum cenário criado ainda.</p>'}
  `, 'mb-6');
}
function renderRecommendationPanel(rec) {
  const r = rec.recommendation || {};
  const FACTORS = ['Capacidade', 'Custos', 'Margem', 'Posicionamento', 'Mercado', 'Especialização', 'Experiência entregue', 'Diferenciação', 'Demanda', 'Objetivo financeiro', 'Valor percebido', 'Referências de concorrência', 'Maturidade profissional'];
  return card(`
    <p class="text-sm text-white/50 mb-4">Raciocínio Estratégico da Nay <span class="text-white/20 text-xs">(privado — nunca visível à cliente)</span></p>
    <form id="recommendation-form" class="space-y-4">
      <div>
        <label class="text-xs text-white/40 block mb-1">Oferta desta recomendação</label>
        <select name="offerId" class="field">
          <option value="">— Selecione —</option>
          ${rec.answers.offers.map((o) => `<option value="${o.id}" ${r.offerId === o.id ? 'selected' : ''}>${o.name || 'Oferta'}</option>`).join('')}
        </select>
      </div>
      <div>
        <label class="text-xs text-white/40 block mb-1">Fatores considerados</label>
        <div class="flex flex-wrap gap-2">
          ${FACTORS.map((f) => `<label class="ms-chip" style="cursor:pointer; display:inline-flex; align-items:center; gap:6px;"><input type="checkbox" name="factorsConsidered" value="${f}" ${(r.factorsConsidered || []).includes(f) ? 'checked' : ''} style="accent-color:var(--terracotta);" />${f}</label>`).join('')}
        </div>
      </div>
      <div class="grid sm:grid-cols-2 gap-4">
        <div><label class="text-xs text-white/40 block mb-1">Preço mínimo matemático (R$)</label><input type="number" step="0.01" name="mathematicalMinimum" class="field" value="${r.mathematicalMinimum ?? ''}" /></div>
        <div><label class="text-xs text-white/40 block mb-1">Preço estratégico recomendado (R$)</label><input type="number" step="0.01" name="strategicPrice" class="field" value="${r.strategicPrice ?? ''}" /></div>
      </div>
      <div class="grid sm:grid-cols-2 gap-4">
        <div><label class="text-xs text-white/40 block mb-1">Estrutura de pagamento sugerida</label><input type="text" name="paymentStructure" class="field" value="${r.paymentStructure || ''}" /></div>
        <div><label class="text-xs text-white/40 block mb-1">Ajuste sugerido de produto/oferta</label><input type="text" name="offerAdjustment" class="field" value="${r.offerAdjustment || ''}" /></div>
      </div>
      <div class="grid sm:grid-cols-2 gap-4">
        <div><label class="text-xs text-white/40 block mb-1">Data de vigência</label><input type="date" name="effectiveDate" class="field" value="${r.effectiveDate || ''}" /></div>
        <div><label class="text-xs text-white/40 block mb-1">Data de revisão</label><input type="date" name="reviewDate" class="field" value="${r.reviewDate || ''}" /></div>
      </div>
      <div>
        <label class="text-xs text-white/40 block mb-1">Justificativa estratégica</label>
        <textarea name="strategicJustification" rows="4" class="field" placeholder="Recomendo R$ ___ porque...">${r.strategicJustification || ''}</textarea>
      </div>
      <div class="grid sm:grid-cols-2 gap-4">
        <div><label class="text-xs text-white/40 block mb-1">Riscos da recomendação</label><textarea name="risks" rows="2" class="field">${r.risks || ''}</textarea></div>
        <div><label class="text-xs text-white/40 block mb-1">Condições necessárias para sustentar o preço</label><textarea name="requiredChanges" rows="2" class="field">${r.requiredChanges || ''}</textarea></div>
      </div>
      <div class="grid sm:grid-cols-2 gap-4">
        <div><label class="text-xs text-white/40 block mb-1">Ajustes de venda/comunicação</label><textarea name="communicationAdjustments" rows="2" class="field">${r.communicationAdjustments || ''}</textarea></div>
        <div><label class="text-xs text-white/40 block mb-1">Indicadores de acompanhamento</label><textarea name="followUpIndicators" rows="2" class="field">${r.followUpIndicators || ''}</textarea></div>
      </div>
      <div class="flex justify-end pt-2">
        <button type="submit" class="btn-primary" style="padding:9px 18px;font-size:12.5px;">Salvar Raciocínio</button>
      </div>
    </form>
  `, 'mb-6');
}
function renderDeliverablePreviewHtml(payload) {
  return `
    <div class="mt-5 p-5 rounded" style="border:1px solid var(--line); background:rgba(220,199,168,.03);">
      <p class="text-xs uppercase mb-3" style="color:var(--gold); letter-spacing:.12em;">Pré-visualização — o que a cliente verá</p>
      <h3 class="text-xl font-serif mb-3">Sua Leitura Estratégica de Valor</h3>
      <p class="text-xs text-white/30 mb-1">Situação atual</p><p class="text-sm mb-3">${payload.situationSummary || '—'}</p>
      <p class="text-xs text-white/30 mb-1">Principal constatação</p><p class="text-sm mb-3">${payload.mainFinding || '—'}</p>
      <div class="grid sm:grid-cols-2 gap-4 mb-3">
        <div><p class="text-xs text-white/30">Preço mínimo matemático</p><p class="text-lg font-serif">${fmtBRL(payload.mathematicalMinimum)}</p></div>
        <div><p class="text-xs text-white/30">Preço estratégico recomendado</p><p class="text-lg font-serif" style="color:var(--gold);">${fmtBRL(payload.strategicPrice)}</p></div>
      </div>
      ${payload.explanation ? `<p class="text-xs text-white/30 mb-1">Explicação</p><p class="text-sm mb-3">${payload.explanation}</p>` : ''}
      ${payload.offerChanges ? `<p class="text-xs text-white/30 mb-1">Ajustes sugeridos</p><p class="text-sm mb-3">${payload.offerChanges}</p>` : ''}
      ${payload.nextActions ? `<p class="text-xs text-white/30 mb-1">Próximas ações</p><p class="text-sm mb-3">${payload.nextActions}</p>` : ''}
      <p class="text-xs text-white/20">Recomendação de ${payload.recommendationDate ? formatDate(payload.recommendationDate) : '—'}${payload.reviewDate ? ` · revisão sugerida em ${formatDate(payload.reviewDate)}` : ''}</p>
    </div>
  `;
}
function renderDeliverablePanel(rec) {
  const d = rec.publishedDeliverable || {};
  const r = rec.recommendation || {};
  const canPublish = rec.status === 'in_analysis' || rec.status === 'published';
  return card(`
    <p class="text-sm text-white/50 mb-1">Devolutiva para a Cliente</p>
    <p class="text-xs text-white/20 mb-4">Só o que for preenchido aqui é publicado — notas privadas, cenários e o raciocínio acima nunca são enviados.</p>
    ${!canPublish ? '<p class="text-sm" style="color:var(--muted);">Disponível assim que a análise estiver em andamento (após "Iniciar Análise").</p>' : `
      <form id="deliverable-form" class="space-y-4">
        <div><label class="text-xs text-white/40 block mb-1">Resumo da situação atual</label><textarea name="situationSummary" rows="2" class="field">${d.situationSummary || ''}</textarea></div>
        <div><label class="text-xs text-white/40 block mb-1">Principal constatação financeira ou de capacidade</label><textarea name="mainFinding" rows="2" class="field">${d.mainFinding || ''}</textarea></div>
        <div><label class="text-xs text-white/40 block mb-1">Explicação da recomendação</label><textarea name="explanation" rows="3" class="field">${d.explanation || r.strategicJustification || ''}</textarea></div>
        <div><label class="text-xs text-white/40 block mb-1">Ajustes sugeridos na oferta ou pagamento <span class="text-white/20">(opcional)</span></label><textarea name="offerChanges" rows="2" class="field">${d.offerChanges || ''}</textarea></div>
        <div><label class="text-xs text-white/40 block mb-1">Próximas ações práticas <span class="text-white/20">(opcional)</span></label><textarea name="nextActions" rows="2" class="field">${d.nextActions || ''}</textarea></div>
        <div class="grid sm:grid-cols-2 gap-4">
          <div><label class="text-xs text-white/40 block mb-1">Data da recomendação</label><input type="date" name="recommendationDate" class="field" value="${d.recommendationDate || r.effectiveDate || new Date().toISOString().slice(0, 10)}" /></div>
          <div><label class="text-xs text-white/40 block mb-1">Data de revisão sugerida</label><input type="date" name="reviewDate" class="field" value="${d.reviewDate || r.reviewDate || ''}" /></div>
        </div>
        <div class="flex items-center gap-3 pt-2">
          <button type="button" id="preview-deliverable" class="btn-ghost">Pré-visualizar</button>
          <button type="submit" id="publish-deliverable" class="btn-primary" ${deliverablePreviewShown ? '' : 'disabled'} title="${deliverablePreviewShown ? '' : 'Pré-visualize antes de publicar'}">${rec.status === 'published' ? 'Republicar Devolutiva' : 'Publicar Devolutiva'}</button>
          ${!deliverablePreviewShown ? '<span class="text-xs text-white/20">Pré-visualize antes de publicar.</span>' : ''}
        </div>
      </form>
      <div id="deliverable-preview"></div>
    `}
  `, 'mb-6');
}
function renderPriceHistoryPanel() {
  const history = MockDB.getPriceHistory(clientId);
  return card(`
    <p class="text-sm text-white/50 mb-4">Histórico de Preços <span class="text-white/20 text-xs">(permanente — nunca sobrescrito)</span></p>
    ${history.length ? `
      <div class="divide-y" style="border-color:var(--line);">
        ${history.map((h) => `
          <div class="py-3">
            <div class="flex items-center justify-between">
              <p class="text-sm">${h.offerName || 'Oferta'}: ${fmtBRL(h.previousPrice)} &rarr; <strong style="color:var(--gold);">${fmtBRL(h.newPrice)}</strong></p>
              <span class="text-xs text-white/30">${formatDate(h.createdAt)}</span>
            </div>
            ${h.reason ? `<p class="text-xs text-white/30 mt-1">${h.reason}</p>` : ''}
          </div>
        `).join('')}
      </div>
    ` : '<p class="text-xs text-white/20">Nenhuma mudança de preço registrada ainda.</p>'}
  `);
}
function wireValueAnalysisTab() {
  const tc = document.getElementById('tab-content');
  tc.querySelector('#start-analysis-admin')?.addEventListener('click', () => {
    MockDB.startValueAnalysis(clientId);
    toast('Análise iniciada.');
    render();
  });
  tc.querySelectorAll('[data-review-select]').forEach((sel) => {
    sel.addEventListener('change', () => {
      MockDB.setValueAssessmentReview(clientId, sel.dataset.reviewSelect, sel.value || null);
      render();
    });
  });
  tc.querySelector('#new-scenario')?.addEventListener('click', () => {
    const rec = MockDB.getValueAssessment(clientId);
    const firstOffer = rec.answers.offers[0];
    MockDB.addValueScenario(clientId, {
      name: `Cenário ${rec.scenarios.length + 1}`, price: firstOffer?.currentPrice || 0,
      monthlyVolume: firstOffer?.avgMonthlySales || 0, deliveryMinutes: firstOffer?.deliveryMinutes || 0,
      variableCostPct: 0, directCostPerSale: firstOffer?.directCostPerSale || 0,
    });
    render();
  });
  tc.querySelectorAll('[data-remove-scenario]').forEach((btn) => btn.addEventListener('click', () => { MockDB.removeValueScenario(clientId, btn.dataset.removeScenario); render(); }));
  tc.querySelectorAll('[data-set-recommended-scenario]').forEach((btn) => btn.addEventListener('click', () => { MockDB.setRecommendedValueScenario(clientId, btn.dataset.setRecommendedScenario); render(); }));

  tc.querySelector('#recommendation-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    MockDB.saveValueRecommendation(clientId, {
      offerId: fd.get('offerId') || null, factorsConsidered: fd.getAll('factorsConsidered'),
      mathematicalMinimum: fd.get('mathematicalMinimum') ? Number(fd.get('mathematicalMinimum')) : null,
      strategicPrice: fd.get('strategicPrice') ? Number(fd.get('strategicPrice')) : null,
      paymentStructure: fd.get('paymentStructure'), offerAdjustment: fd.get('offerAdjustment'),
      effectiveDate: fd.get('effectiveDate') || null, reviewDate: fd.get('reviewDate') || null,
      strategicJustification: fd.get('strategicJustification'), risks: fd.get('risks'),
      requiredChanges: fd.get('requiredChanges'), communicationAdjustments: fd.get('communicationAdjustments'),
      followUpIndicators: fd.get('followUpIndicators'), status: 'ready',
    });
    toast('Raciocínio estratégico salvo.');
    render();
  });

  tc.querySelector('#preview-deliverable')?.addEventListener('click', () => {
    const form = tc.querySelector('#deliverable-form');
    const fd = new FormData(form);
    const rec = MockDB.getValueAssessment(clientId);
    const payload = {
      situationSummary: fd.get('situationSummary'), mainFinding: fd.get('mainFinding'), explanation: fd.get('explanation'),
      offerChanges: fd.get('offerChanges'), nextActions: fd.get('nextActions'),
      recommendationDate: fd.get('recommendationDate'), reviewDate: fd.get('reviewDate'),
      mathematicalMinimum: rec.recommendation?.mathematicalMinimum, strategicPrice: rec.recommendation?.strategicPrice,
    };
    tc.querySelector('#deliverable-preview').innerHTML = renderDeliverablePreviewHtml(payload);
    deliverablePreviewShown = true;
    tc.querySelector('#publish-deliverable').disabled = false;
    tc.querySelector('#publish-deliverable').title = '';
  });
  tc.querySelector('#deliverable-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!deliverablePreviewShown) { toast('Pré-visualize antes de publicar.', { tone: 'error' }); return; }
    const fd = new FormData(e.target);
    const rec = MockDB.getValueAssessment(clientId);
    MockDB.publishValueDeliverable(clientId, {
      situationSummary: fd.get('situationSummary'), mainFinding: fd.get('mainFinding'), explanation: fd.get('explanation'),
      offerChanges: fd.get('offerChanges'), nextActions: fd.get('nextActions'),
      recommendationDate: fd.get('recommendationDate'), reviewDate: fd.get('reviewDate'),
      mathematicalMinimum: rec.recommendation?.mathematicalMinimum, strategicPrice: rec.recommendation?.strategicPrice,
    });
    deliverablePreviewShown = false;
    toast('Devolutiva publicada — a cliente já pode vê-la.');
    render();
  });
}

// --- Programa — Nay's umbrella view of this client's Program Hub. Reads
// the exact same MockDB.getProgramActivities/getProgramProgress the client
// sees on program.html — never a separate admin-only copy of the numbers.
// Nova Persea methodology — the full E1-E8 encounter journey (see
// ENCOUNTER_DEFS in mock-db.js, the single source of truth for these
// names). Always shows all 8 rows, for every client, so Nay and the team
// get familiar with the new names regardless of tier — E5-E8 just read as
// locked/"Somente Premium" for a non-Premium program, same visual treatment
// already used for the Business activity's premium_preview state below.
const ENCOUNTER_STATUS_BADGE_CLASS = { not_scheduled: 'badge-locked', upcoming: 'badge-progress', completed: 'badge-completed', rescheduled: 'badge-locked', cancelled: 'badge-locked' };
const ENCOUNTER_STATUS_LABEL = { not_scheduled: 'Não agendado', ...AGENDA_STATUS_LABEL };
// One row per activity or mentor deliverable inside a phase — same
// building blocks the client's own "Sua Jornada" shows, just with
// admin-facing actions (open the activity itself in a new tab) instead of
// client CTAs. Individual encounter status lives in each E-tab's own
// header instead (see renderEncounterTab) — no separate encounter row here.
// Whatever the client actually sent/answered for this activity — read-only,
// no separate page to open. Returns null when there's nothing to show yet
// (not started, or this activity type doesn't carry client-authored
// content), in which case the row stays a plain link+badge instead of an
// expandable one. This is exactly the material Nay needs to be caught up
// on before requesting a meeting (see renderScheduleRequestSection above).
function activityAnswersPreview(a) {
  if (a.slug === 'brand-extraction') {
    const q = MockDB.getQuestionnaire(clientId);
    if (!q.questions.some((qu) => qu.answer)) return null;
    return `<div class="space-y-3 mt-2">${q.questions.map((qu) => `<div><p class="text-xs text-white/30 mb-0.5">${qu.text}</p><p class="text-sm">${qu.answer || '—'}</p></div>`).join('')}</div>`;
  }
  if (a.slug === 'business-survey') {
    const survey = MockDB.getBusinessSurvey(clientId);
    if (survey.status !== 'submitted') return null;
    return `<div class="grid sm:grid-cols-2 gap-4 mt-2">${BUSINESS_SURVEY_QUESTIONS.map((q) => `<div><p class="text-xs text-white/30 mb-0.5">${q.label}</p><p class="text-sm">${survey.responses[q.key] || '—'}</p></div>`).join('')}</div>`;
  }
  if (a.slug === 'archetype-test') {
    const results = MockDB.getArchetypeResults(clientId);
    if (!results) return null;
    return `<p class="text-sm mt-2"><span class="text-xs text-white/30 block mb-0.5">Arquétipos em destaque</span>${results.featured.map((f) => `${f.name} (${f.percentage}%)`).join(' · ')}</p>`;
  }
  if (a.slug === 'initial-images') {
    const imgs = MockDB.getClientImages(clientId);
    if (!imgs.images.length) return null;
    return `
      <div class="grid grid-cols-6 gap-2 mt-2">${imgs.images.slice(0, 12).map((img) => `<img src="${img.dataUrl}" alt="${img.fileName || ''}" style="width:100%; aspect-ratio:3/4; object-fit:cover; border-radius:3px; border:1px solid var(--line);" />`).join('')}</div>
      ${imgs.images.length > 12 ? `<p class="text-xs text-white/20 mt-1">+${imgs.images.length - 12} imagens</p>` : ''}
    `;
  }
  if (a.slug === 'pitch') {
    const pitches = MockDB.getPitches(clientId);
    if (!pitches) return null;
    return `<p class="text-sm mt-2"><span class="text-xs text-white/30 block mb-0.5">Pitch de 30s</span>${pitches.pitch_30s || '—'}</p>`;
  }
  return null;
}
function phaseActivityRow(a) {
  const preview = activityAnswersPreview(a);
  // Once there's a results view to expand in place, the title stops
  // linking into the client's own page — admin should never need to open
  // that page just to read an answer (see the login/RLS note this avoids).
  // The link stays only for activities with no inline results yet.
  const titleRow = `
    <div class="flex items-center gap-2">
      ${preview
        ? `<span class="text-sm">${a.title}</span>`
        : `<a href="${a.route ? `../client/${a.route}` : '#'}" ${a.route ? 'target="_blank" rel="noopener"' : ''} class="text-sm hover:underline">${a.title}</a>`}
      ${a.access === 'premium_preview' ? '<span class="text-xs text-white/20">(preview)</span>' : ''}
    </div>
  `;
  if (!preview) {
    return `<div class="flex items-center justify-between py-2">${titleRow}<span class="badge ${a.badgeClass}">${a.statusLabel}</span></div>`;
  }
  return `
    <details class="answer-row">
      <summary>${titleRow}<span class="badge ${a.badgeClass}">${a.statusLabel}</span></summary>
      ${preview}
    </details>
  `;
}
function phaseDeliverableRow(d) {
  return `
    <div class="flex items-center justify-between py-2">
      <p class="text-sm">${d.label}</p>
      <span class="badge ${MENTOR_DELIVERABLE_STATUS_BADGE_CLASS[d.status]}">${MENTOR_DELIVERABLE_STATUS_LABEL[d.status]}</span>
    </div>
  `;
}
// One card per phase — encontro(s), atividades da cliente, e entregáveis da
// equipe, all kept inside the phase they actually belong to (E1/E2 -> Fase
// 1, E3 -> Fase 2, E4 -> Fase 3, E5-E8 -> Fase 4), reusing the exact same
// MockDB.getClientJourney the client's own Minha Jornada reads — never a
// second, admin-only grouping that could drift from what she sees.
// Programa — trimmed down to "who is this client" per the redesign: photo,
// social links (already shown above the tabs, see shell()), a WHO/WHAT/WHY/
// HOW summary Nay fills in from E1/E2, her private notes, and an
// easy-to-reach deliverables list. Everything about the actual mentoring
// progress (encounters, activities, gates) now lives on its own E1-E8 tab —
// see renderEncounterTab — so this page never re-competes with those.
function initials(name) {
  return (name || '').split(' ').filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('');
}
function deliverableRow(label, status, url) {
  const ok = isValidHttpUrl(url);
  return `
    <div class="flex items-center justify-between py-2.5">
      <p class="text-sm">${label}</p>
      <div class="flex items-center gap-3">
        <span class="badge ${status === 'delivered' ? 'badge-completed' : status === 'in_review' ? 'badge-progress' : 'badge-locked'}">${GUIDE_STATUS_LABEL[status] || status}</span>
        ${ok ? `<a ${externalLinkAttrs(url)} class="btn-text">Abrir ↗</a>` : ''}
      </div>
    </div>
  `;
}
function renderProgramTab() {
  const program = MockDB.getClientProgram(clientId);
  const summary = MockDB.getClientProfileSummary(clientId);
  const notes = MockDB.getNotes(clientId);
  const guides = MockDB.getImageGuides(clientId);
  const kit = MockDB.getDigitalKit(clientId);
  const links = MockDB.getPlaybookLinks(clientId);
  const history = MockDB.getProgramHistory(clientId);
  const myInterests = MockDB.getPremiumUpgradeInterests().filter((i) => i.clientId === clientId);

  return `
    ${card(`
      <div class="flex items-start gap-5 flex-wrap">
        <div id="profile-photo-frame" style="width:96px; height:96px; border-radius:50%; overflow:hidden; flex-shrink:0; background:var(--bg2); border:1px solid var(--line); display:flex; align-items:center; justify-content:center;">
          ${isValidHttpUrl(summary.photoUrl) ? `<img id="profile-photo-img" src="${summary.photoUrl}" alt="${client.fullName}" style="width:100%; height:100%; object-fit:cover;" onerror="this.remove(); document.getElementById('profile-photo-fallback').style.display='flex';" />` : ''}
          <span id="profile-photo-fallback" class="font-serif text-xl" style="color:var(--muted); ${isValidHttpUrl(summary.photoUrl) ? 'display:none;' : ''}">${initials(client.fullName)}</span>
        </div>
        <div class="flex-1 min-w-[220px]">
          <p class="text-xl font-serif">${client.fullName}</p>
          <p class="text-xs text-white/30 mt-0.5">${program.name}${program.positioning ? ` · ${program.positioning}` : ''}</p>
          <form id="photo-form" class="flex items-center gap-2 mt-3">
            <input name="photoUrl" id="photo-url-input" class="field text-sm" style="max-width:340px;" placeholder="Link da foto de perfil" value="${summary.photoUrl || ''}" />
            <button type="submit" class="btn-ghost">Salvar</button>
          </form>
          <p class="text-xs text-white/20 mt-1">Cole o link e a foto aparece assim que salvar — precisa ser um link direto para a imagem, não uma página.</p>
        </div>
        <a href="../client/program.html?asClient=1" target="_blank" rel="noopener" class="btn-ghost">Pré-visualizar como cliente ↗</a>
      </div>
    `, 'mb-6')}

    ${card(`
      <p class="text-sm text-white/50 mb-1">Quem é ${client.fullName.split(' ')[0]}</p>
      <p class="text-xs text-white/20 mb-4">Preenchido a partir do E1 e do E2 — o resumo que qualquer pessoa da equipe precisa para entender esta cliente rapidamente.</p>
      <form id="summary-form" class="space-y-4">
        <div>
          <label class="text-xs text-white/40 block mb-1">QUEM ela é</label>
          <textarea name="who" rows="2" class="field text-sm">${summary.who}</textarea>
        </div>
        <div class="grid sm:grid-cols-2 gap-4">
          <div>
            <label class="text-xs text-white/40 block mb-1">O QUE ela vende</label>
            <textarea name="what" rows="2" class="field text-sm">${summary.what}</textarea>
          </div>
          <div>
            <label class="text-xs text-white/40 block mb-1">POR QUE ela vende</label>
            <textarea name="why" rows="2" class="field text-sm">${summary.why}</textarea>
          </div>
        </div>
        <div>
          <label class="text-xs text-white/40 block mb-1">COMO ela vende</label>
          <textarea name="how" rows="2" class="field text-sm">${summary.how}</textarea>
        </div>
        <div class="flex justify-end">
          <button type="submit" class="btn-primary" style="padding:9px 18px;font-size:12.5px;">Salvar Resumo</button>
        </div>
      </form>
    `, 'mb-6')}

    ${card(`
      <p class="text-sm text-white/50 mb-3">Notas Internas</p>
      <p class="text-xs text-white/20 mb-3">Visível para Nay e para a assistente — nunca para a cliente.</p>
      <form id="notes-form" class="space-y-3">
        <textarea name="notes" rows="4" class="field text-sm">${notes || ''}</textarea>
        <div class="flex justify-end"><button type="submit" class="btn-ghost">Salvar Notas</button></div>
      </form>
    `, 'mb-6')}

    ${card(`
      <p class="text-sm text-white/50 mb-3">Entregáveis</p>
      <div class="divide-y" style="border-color:var(--line);">
        ${guides.map((g) => deliverableRow(g.label, g.status, g.fileUrl)).join('')}
        ${deliverableRow('Kit Digital', kit.status, kit.fileUrl)}
        ${deliverableRow('Playbook de Marca Pessoal', links.personalPlaybookUrl ? 'delivered' : 'not_started', links.personalPlaybookUrl)}
        ${deliverableRow('Business Playbook', links.businessPlaybookUrl ? 'delivered' : 'not_started', links.businessPlaybookUrl)}
      </div>
    `, 'mb-6')}

    ${card(`
      <p class="text-sm text-white/50 mb-3">Alterar programa</p>
      <p class="text-xs text-white/20 mb-3">Preserva todo o progresso — a mudança apenas altera qual conjunto de atividades conta para o progresso dela.</p>
      <div class="flex items-center gap-3 flex-wrap">
        <select id="upgrade-program-select" class="field" style="max-width:240px;">
          ${PROGRAM_DEFS.map((p) => `<option value="${p.slug}" ${p.slug === program.slug ? 'selected' : ''}>${p.name}</option>`).join('')}
        </select>
        <button type="button" id="apply-program-change" class="btn-primary" style="padding:8px 16px;font-size:12.5px;">Aplicar</button>
      </div>
      ${history.length ? `
        <div class="mt-4 pt-4" style="border-top:1px solid var(--line);">
          <p class="text-xs text-white/30 mb-2">Histórico</p>
          ${history.map((h) => `<p class="text-xs text-white/20">${h.changedAt ? formatDate(h.changedAt) : '—'} · ${PROGRAM_LABEL_MAP[h.programSlug] || h.programSlug} (${h.changedBy})</p>`).join('')}
        </div>
      ` : ''}
    `, 'mb-6')}

    ${card(`
      <p class="text-sm text-white/50 mb-3">Interesse em upgrade</p>
      ${myInterests.length ? myInterests.map((i) => `
        <div class="py-2 border-b border-white/5 last:border-0">
          <div class="flex items-center justify-between">
            <p class="text-sm">Via ${i.activityTitle} · ${formatDate(i.createdAt)}</p>
            <select data-interest-status="${i.id}" class="field text-xs" style="max-width:150px;">
              ${UPGRADE_INTEREST_STATUSES.map((s) => `<option value="${s}" ${i.status === s ? 'selected' : ''}>${UPGRADE_INTEREST_STATUS_LABEL[s]}</option>`).join('')}
            </select>
          </div>
        </div>
      `).join('') : '<p class="text-sm" style="color:var(--muted);">Nenhum interesse registrado.</p>'}
    `)}
  `;
}
const PROGRAM_LABEL_MAP = Object.fromEntries(PROGRAM_DEFS.map((p) => [p.slug, p.name]));

// --- Encontro briefs (E1-E8) — what replaced the old flat tab row. Each
// tab is the encounter's purpose (ENCOUNTER_DEFS), its schedule, and
// whatever belongs to its phase (getClientJourney), plus a small
// encounter-specific block for the handful of E's with a real prerequisite
// or a deliverable prompt. Legacy admin workspaces (Direção da Marca,
// Editor de Pitch, Ficha de Valor, etc.) aren't gone — see RENDERERS below
// — they're just reached from inside the relevant brief now (data-tab
// buttons below reuse the exact same tab-switching wiring as the row above).
// --- E3 image tools — everything the assistant produces day-to-day for
// this encounter (color palette, production guide, mood board, image
// planning tools) lives here, editable only for her (see
// ASSISTANT_EDITABLE_TABS). Ported from the old assistant/client-
// workspace.js checklist rather than rebuilt, since the review-queue
// workflow (submit -> Nay approves/requests changes -> delivered) already
// worked correctly there.
function reviewNoteHtml(item) {
  if (!item.review) return '';
  if (item.review.status === 'pending') return '<p class="text-xs mt-1" style="color:var(--gold);">Aguardando revisão da Nay</p>';
  if (item.review.status === 'changes_requested') return `<p class="text-xs mt-1" style="color:var(--terracotta);">Nay pediu ajustes: ${item.review.nayNote}</p>`;
  return '';
}
function guideRow(g) {
  return `
    <div class="flex items-center justify-between py-2.5">
      <div>
        <p class="text-sm">${g.label}</p>
        ${reviewNoteHtml(g)}
      </div>
      <div class="flex items-center gap-3">
        <span class="badge ${g.status === 'delivered' ? 'badge-completed' : g.status === 'in_review' ? 'badge-progress' : 'badge-locked'}">${GUIDE_STATUS_LABEL[g.status]}</span>
        ${g.status !== 'delivered' && g.status !== 'in_review' ? `<button data-submit-guide="${g.slug}" data-guide-label="${g.label}" class="btn-text">Enviar para revisão</button>` : ''}
        ${g.status === 'in_review' && g.review && g.review.status === 'changes_requested' ? `<button data-submit-guide="${g.slug}" data-guide-label="${g.label}" class="btn-text">Reenviar</button>` : ''}
      </div>
    </div>
  `;
}
function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
function openSubmitReviewModal(type, refSlug, title) {
  const { el, close } = openModal({
    title: `Enviar para revisão — ${title}`,
    bodyHtml: `
      <form id="review-form" class="space-y-4">
        <div><label class="text-xs text-white/40 block mb-1">Arquivo (PDF ou imagem)</label><input type="file" name="file" accept="application/pdf,image/*" class="field" /></div>
        <div><label class="text-xs text-white/40 block mb-1">Ou link do arquivo <span class="text-white/20">(se já estiver hospedado em outro lugar)</span></label><input name="fileUrl" class="field" placeholder="https://..." /></div>
        <div><label class="text-xs text-white/40 block mb-1">Link editável no Canva <span class="text-white/20">(opcional)</span></label><input name="canvaUrl" class="field" placeholder="https://www.canva.com/design/..." /></div>
        <div><label class="text-xs text-white/40 block mb-1">Resumo <span class="text-white/20">(para referência futura)</span></label><textarea name="summary" rows="2" class="field"></textarea></div>
        <div><label class="text-xs text-white/40 block mb-1">Nota para a Nay <span class="text-white/20">(opcional)</span></label><textarea name="note" rows="2" class="field"></textarea></div>
        <button type="submit" class="btn-primary" style="padding:9px 18px;font-size:12.5px;">Enviar para revisão</button>
      </form>
    `,
  });
  el.querySelector('#review-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const file = fd.get('file');
    if (file && file.size > 8 * 1024 * 1024) { toast('Arquivo passa de 8MB — use o link em vez do upload.', { tone: 'error' }); return; }
    const fileUrl = file && file.size ? await fileToDataUrl(file) : fd.get('fileUrl');
    if (!fileUrl) { toast('Envie um arquivo ou informe um link.', { tone: 'error' }); return; }
    MockDB.submitForReview(clientId, { type, refSlug, title, note: fd.get('note') || '', fileUrl, summary: fd.get('summary') || '', canvaUrl: fd.get('canvaUrl') || '' });
    close();
    toast('Enviado para revisão da Nay.');
    render();
  });
}
function renderAssistantImageTools() {
  const guides = MockDB.getImageGuides(clientId);
  const kit = MockDB.getDigitalKit(clientId);
  const reminder = MockDB.getPhotoReminder(clientId);
  const notes = MockDB.getWhatsappNotes(clientId);
  const productionGuide = guides.find((g) => g.slug === 'guia_looks_mensal');
  const moodGuide = guides.find((g) => g.slug === 'moodboard_ensaio');
  const otherGuides = guides.filter((g) => g.slug !== 'guia_looks_mensal' && g.slug !== 'moodboard_ensaio');
  return `
    ${card(`
      <div class="flex items-center justify-between mb-1">
        <p class="text-sm text-white/50">Projeto de Imagem</p>
        <span class="badge ${client.imageProjectStatus === 'created' ? 'badge-completed' : 'badge-locked'}">${client.imageProjectStatus === 'created' ? 'Criado' : 'Não criado'}</span>
      </div>
      <p class="text-xs text-white/30 mb-3">Depende das fotos enviadas pela cliente.</p>
      <div class="flex items-center gap-3 flex-wrap">
        ${client.imageProjectStatus !== 'created' ? '<button id="create-image-project" class="btn-ghost">Criar projeto</button>' : ''}
        <button id="remind-photos" class="btn-text">🔔 Lembrar cliente de enviar fotos</button>
      </div>
      ${reminder.sentAt ? `<p class="text-xs mt-2" style="color:var(--muted);">Último lembrete enviado em ${formatDateTime(reminder.sentAt)}.</p>` : ''}
    `, 'mb-6')}
    ${productionGuide ? card(`<p class="text-sm text-white/50 mb-1">Guia de Produções <span class="text-white/20 text-xs">(cartela de cores e looks do mês)</span></p>${guideRow(productionGuide)}`, 'mb-6') : ''}
    ${moodGuide ? card(`<p class="text-sm text-white/50 mb-1">Mood Fotográfico</p>${guideRow(moodGuide)}`, 'mb-6') : ''}
    ${otherGuides.length ? card(`<p class="text-sm text-white/50 mb-4">Ferramentas para Nova Imagem</p><div class="divide-y" style="border-color:var(--line);">${otherGuides.map(guideRow).join('')}</div>`, 'mb-6') : ''}
    ${card(`
      <div class="flex items-center justify-between mb-1">
        <p class="text-sm text-white/50">Kit Digital</p>
        <span class="badge ${kit.status === 'delivered' ? 'badge-completed' : kit.status === 'in_review' ? 'badge-progress' : 'badge-locked'}">${GUIDE_STATUS_LABEL[kit.status]}</span>
      </div>
      ${reviewNoteHtml(kit)}
      ${kit.status !== 'delivered' && kit.status !== 'in_review' ? '<button id="submit-kit" class="btn-text">Enviar para revisão</button>' : ''}
      ${kit.status === 'in_review' && kit.review && kit.review.status === 'changes_requested' ? '<button id="submit-kit" class="btn-text">Reenviar</button>' : ''}
    `, 'mb-6')}
    ${card(`
      <p class="text-sm text-white/50 mb-4">Notas para a Nay <span class="text-white/20 text-xs">(sobre a imagem desta cliente — nunca visível para ela)</span></p>
      <form id="e3-note-form" class="flex items-start gap-2 mb-4">
        <textarea name="note" rows="2" class="field" placeholder="Ex.: cliente prefere tons mais neutros do que o padrão da paleta." required></textarea>
        <button type="submit" class="btn-ghost" style="white-space:nowrap;">Registrar</button>
      </form>
      ${notes.length ? `
        <div class="space-y-2">
          ${notes.map((n) => `<div class="text-sm" style="border-left:2px solid var(--line); padding-left:10px;"><p class="text-white/70">${n.text}</p><p class="text-xs text-white/20 mt-0.5">${formatDateTime(n.at)}</p></div>`).join('')}
        </div>
      ` : '<p class="text-xs text-white/20">Nenhuma nota registrada ainda.</p>'}
    `)}
  `;
}

function renderEncounterExtra(n) {
  if (n === 1) {
    return card(`
      <p class="text-sm text-white/50 mb-3">Depois Deste Encontro</p>
      <p class="text-xs text-white/20 mb-3">Preencha o resumo de QUEM ela é e POR QUE vende na aba Programa, e monte o mural de inspiração dela na Direção da Marca.</p>
      <div class="flex items-center gap-3">
        <button type="button" data-tab="program" class="btn-ghost">Abrir Programa</button>
        <button type="button" data-tab="brand-direction" class="btn-ghost">Abrir Direção da Marca</button>
      </div>
    `, 'mb-6');
  }
  if (n === 2) {
    const survey = MockDB.getBusinessSurvey(clientId);
    return card(`
      <p class="text-sm text-white/50 mb-3">Pesquisa de Precificação</p>
      ${survey.status === 'submitted' ? `
        <div class="grid sm:grid-cols-2 gap-4 text-sm mb-3">
          ${BUSINESS_SURVEY_QUESTIONS.map((q) => `<div><p class="text-xs text-white/30 mb-1">${q.label}</p><p>${survey.responses[q.key] || '—'}</p></div>`).join('')}
        </div>
        <p class="text-xs text-white/20">Respondido em ${formatDateTime(survey.submittedAt)}</p>
      ` : '<p class="text-sm" style="color:var(--muted);">A cliente ainda não respondeu.</p>'}
      <div class="flex items-center gap-3 mt-4">
        <button type="button" data-tab="pitch" class="btn-ghost">Abrir Editor de Pitch</button>
      </div>
    `, 'mb-6');
  }
  if (n === 3) {
    const gate = MockDB.canScheduleE3(clientId);
    const gateCard = card(`
      <div class="flex items-center justify-between mb-3">
        <p class="text-sm text-white/50">Autorização de Entregáveis</p>
        <span class="badge ${gate.ready ? 'badge-completed' : 'badge-locked'}">${gate.ready ? 'Liberado para agendar' : 'Aguardando aprovação'}</span>
      </div>
      <p class="text-xs text-white/20 mb-3">Cartela de Cores e Guia de Produções precisam estar aprovados por Nay antes deste encontro poder ser marcado — Planejamento de Imagem e Ferramentas para Nova Imagem são modelos compartilhados (ver Templates), ainda sem revisão por cliente.</p>
      <div class="divide-y mb-3" style="border-color:var(--line);">
        ${gate.guides.map((g) => `<div class="flex items-center justify-between py-2"><p class="text-sm">${g.label}</p><span class="badge ${g.status === 'delivered' ? 'badge-completed' : 'badge-progress'}">${g.status === 'delivered' ? 'Aprovado' : GUIDE_STATUS_LABEL[g.status]}</span></div>`).join('')}
      </div>
      ${!gate.ready ? '<a href="assistente.html?section=revisoes" class="btn-text">Ver Revisões Pendentes →</a>' : ''}
      <p class="text-xs text-white/20 mt-4">Por padrão, o E3 é conduzido pela assistente — atribua a ela ao agendar este encontro na Agenda.</p>
    `, 'mb-6');
    // The real day-to-day tools for this encounter — color palette,
    // production guide, image planning — live only in the assistant view,
    // where she actually produces and uploads them. Admin keeps the
    // approval-gate summary above, unchanged.
    return isAssistant ? gateCard + renderAssistantImageTools() : gateCard;
  }
  if (n === 4) {
    const links = MockDB.getPlaybookLinks(clientId);
    const kit = MockDB.getDigitalKit(clientId);
    return card(`
      <p class="text-sm text-white/50 mb-3">Playbook de Marca Pessoal</p>
      <p class="text-xs text-white/20 mb-3">Montado por Nay fora do sistema — cole o link aqui para apresentar neste encontro.</p>
      <form id="personal-playbook-form" class="flex items-center gap-2 mb-2">
        <input name="url" class="field text-sm" placeholder="https://..." value="${links.personalPlaybookUrl || ''}" />
        <button type="submit" class="btn-ghost">Salvar</button>
        ${isValidHttpUrl(links.personalPlaybookUrl) ? `<a ${externalLinkAttrs(links.personalPlaybookUrl)} class="btn-text">Abrir ↗</a>` : ''}
      </form>
      ${links.personalPlaybookDeliveredAt ? `<p class="text-xs" style="color:var(--gold);">Enviado em ${formatDateTime(links.personalPlaybookDeliveredAt)}</p>` : '<p class="text-xs text-white/20">Ainda não enviado — a cliente precisa ver isso antes/durante o E4.</p>'}
      <div class="pt-4 mt-4" style="border-top:1px solid var(--line);">
        <div class="flex items-center justify-between">
          <p class="text-sm text-white/50">Kit Digital</p>
          <span class="badge ${kit.status === 'delivered' ? 'badge-completed' : kit.status === 'in_review' ? 'badge-progress' : 'badge-locked'}">${GUIDE_STATUS_LABEL[kit.status]}</span>
        </div>
      </div>
    `, 'mb-6');
  }
  if (n === 5) {
    const gate = MockDB.canScheduleE5(clientId);
    // Final Production-Readiness Pass decision: warning + admin override,
    // not a hard block — "Bloqueado" falsely implied scheduling was
    // actually prevented, when nothing ever enforced that. The prerequisite
    // rule itself (Análise de Negócio submitted) is unchanged.
    return card(`
      <div class="flex items-center justify-between mb-3">
        <p class="text-sm text-white/50">Análise de Negócio — Pré-requisito Obrigatório</p>
        <span class="badge ${gate.ready ? 'badge-completed' : 'badge-locked'}">${gate.ready ? 'Liberado para agendar' : 'Pré-requisito pendente'}</span>
      </div>
      <p class="text-xs text-white/20 mb-3">${gate.ready ? 'A cliente já preencheu a Análise de Negócio — pode seguir com o E5.' : 'A cliente ainda não preencheu a Análise de Negócio (Ficha de Valor). O ideal é aguardar, mas Nay pode agendar mesmo assim ao solicitar o encontro abaixo — é só confirmar quando avisada do pendente.'}</p>
      <button type="button" data-tab="value-analysis" class="btn-ghost">Abrir Ficha de Valor</button>
    `, 'mb-6');
  }
  if (n === 6) {
    const links = MockDB.getPlaybookLinks(clientId);
    return card(`
      <p class="text-sm text-white/50 mb-3">Business Playbook</p>
      <p class="text-xs text-white/20 mb-3">Análise de negócio + pontos de foco para a cliente perseguir — cole o link aqui para apresentar neste encontro.</p>
      <form id="business-playbook-form" class="flex items-center gap-2 mb-2">
        <input name="url" class="field text-sm" placeholder="https://..." value="${links.businessPlaybookUrl || ''}" />
        <button type="submit" class="btn-ghost">Salvar</button>
        ${isValidHttpUrl(links.businessPlaybookUrl) ? `<a ${externalLinkAttrs(links.businessPlaybookUrl)} class="btn-text">Abrir ↗</a>` : ''}
      </form>
      ${links.businessPlaybookDeliveredAt ? `<p class="text-xs" style="color:var(--gold);">Enviado em ${formatDateTime(links.businessPlaybookDeliveredAt)}</p>` : '<p class="text-xs text-white/20">Ainda não enviado.</p>'}
    `, 'mb-6');
  }
  return '';
}
// Nay's side of the negotiation — request (with her prep checklist) ->
// client proposes a time (client/dashboard.js + encontros.js) -> Nay
// confirms, which is the one moment a real agendaItem gets created (see
// MockDB.confirmEncounterMeeting). Nothing to show once it's actually
// scheduled — the header above already covers that.
// Up to 3 candidate slots for Nay to type in when requesting or
// re-proposing — plain datetime inputs, empty ones just get dropped.
function timeSlotInputs(namePrefix) {
  return `
    <div class="space-y-2">
      ${[0, 1, 2].map((i) => `<input type="datetime-local" name="${namePrefix}${i}" class="field text-sm" />`).join('')}
    </div>
    <p class="text-xs text-white/20 mt-1">Ofereça até 3 horários — a cliente escolhe um, ou avisa se nenhum funciona.</p>
  `;
}
function renderScheduleRequestSection(n, enc) {
  if (enc.agendaItemId) return '';
  const openReq = MockDB.getEncounterRequests(clientId)
    .find((r) => r.encounterNumber === n && !['confirmed', 'cancelled'].includes(r.status));

  if (openReq && openReq.status === 'awaiting_client_response') {
    return card(`
      <div class="flex items-center justify-between mb-1">
        <p class="text-sm text-white/50">Solicitação de Agendamento</p>
        <span class="badge badge-progress">Aguardando resposta da cliente</span>
      </div>
      <p class="text-xs text-white/20 mb-3">Horários oferecidos: ${openReq.proposedTimes.map((t) => formatDateTime(t)).join(' · ')}</p>
      <button type="button" data-cancel-request="${openReq.id}" class="btn-text">Cancelar Solicitação</button>
    `, 'mb-6');
  }
  if (openReq && openReq.status === 'awaiting_nay_confirmation') {
    return card(`
      <div class="flex items-center justify-between mb-3">
        <p class="text-sm text-white/50">Horário Escolhido pela Cliente</p>
        <span class="badge badge-progress">Aguardando sua confirmação</span>
      </div>
      <p class="text-sm mb-4">${formatDateTime(openReq.selectedTime)}</p>
      <div class="flex items-center gap-3">
        <button type="button" data-confirm-request="${openReq.id}" class="btn-primary" style="padding:9px 18px;font-size:12.5px;">Confirmar Agendamento</button>
        <button type="button" data-cancel-request="${openReq.id}" class="btn-text">Recusar</button>
      </div>
    `, 'mb-6');
  }
  if (openReq && openReq.status === 'client_unavailable') {
    return card(`
      <div class="flex items-center justify-between mb-3">
        <p class="text-sm text-white/50">Nenhum Horário Funcionou</p>
        <span class="badge badge-locked">Aguardando novos horários</span>
      </div>
      <p class="text-xs text-white/30 mb-1">Observação da cliente</p>
      <p class="text-sm mb-4">${openReq.clientNote || '—'}</p>
      <form id="repropose-meeting-form" data-request="${openReq.id}">
        ${timeSlotInputs('slot')}
        <button type="submit" class="btn-primary mt-3" style="padding:9px 18px;font-size:12.5px;">Enviar Novos Horários</button>
      </form>
    `, 'mb-6');
  }
  const checklist = ENCOUNTER_PREP_CHECKLIST[n] || [];
  return card(`
    <p class="text-sm text-white/50 mb-3">Solicitar Agendamento</p>
    <p class="text-xs text-white/20 mb-3">Confirme o que você já tem pronto e ofereça horários para a cliente escolher.</p>
    <form id="request-meeting-form" data-encounter="${n}" class="space-y-2">
      ${checklist.map((label) => `
        <label class="flex items-center gap-2 text-sm">
          <input type="checkbox" name="item" value="${label}" checked /> ${label}
        </label>
      `).join('')}
      <div class="pt-3 mt-3" style="border-top:1px solid var(--line);">${timeSlotInputs('slot')}</div>
      <button type="submit" class="btn-primary mt-3" style="padding:9px 18px;font-size:12.5px;">Solicitar Agendamento</button>
    </form>
  `, 'mb-6');
}
// The actual mock version of "link this encounter's Google Drive
// recording/transcript to the client" — reuses the exact recording bundle
// already tracked per meeting (see admin/recordings.js, blankMeetingRecording
// in mock-db.js) via the same agendaItemId every E-tab already has, so
// there's no second, parallel recording concept to keep in sync. Once the
// real Drive connection exists (see the sharing-model note on Gravações),
// this same card is what real file links would render into — the mock
// data shape doesn't change, only where recordingUrl/transcriptUrl come from.
function renderEncounterRecordingCard(enc) {
  if (!enc.agendaItemId) return '';
  const meeting = MockDB.getMeetingDetail(enc.agendaItemId);
  if (!meeting || meeting.type !== 'individual_meeting') return '';
  return card(`
    <div class="flex items-center justify-between mb-3">
      <p class="text-sm text-white/50">Gravação da Reunião</p>
      <a href="recording-detail.html?id=${meeting.id}" class="btn-text">Ver detalhes →</a>
    </div>
    ${renderRecordingBlock(meeting)}
  `, 'mb-6');
}

function renderEncounterTab(n) {
  const def = ENCOUNTER_DEFS[n - 1];
  const program = MockDB.getClientProgram(clientId);
  const isPremiumProgram = program.slug === 'persea-premium';
  const locked = def.premiumOnly && !isPremiumProgram;
  const journey = MockDB.getClientJourney(clientId);
  const journeyPhase = journey ? journey.phases[def.phase] : null;
  const enc = (MockDB.getEncounterJourney(clientId) || []).find((e) => e.number === n) || {};

  return `
    ${card(`
      <div class="flex items-center justify-between mb-1 flex-wrap gap-2">
        <p class="text-lg font-serif">E${def.number} — ${def.name}</p>
        <span class="badge ${locked ? 'badge-locked' : ENCOUNTER_STATUS_BADGE_CLASS[enc.status]}">${locked ? 'Somente Premium' : ENCOUNTER_STATUS_LABEL[enc.status]}</span>
      </div>
      <p class="text-xs text-white/20 mb-3">Fase ${def.phase + 1}${journeyPhase ? ` — ${journeyPhase.name}` : ''}</p>
      <p class="text-sm text-white/50 mb-4 max-w-2xl">${def.purpose}</p>
      <div class="flex items-center gap-3 flex-wrap">
        <p class="text-sm">${enc.date ? formatDateTime(enc.date) : 'Ainda não agendado'}${enc.assignedTo ? ` · ${enc.assignedTo === 'assistant' && enc.assistantPersona ? ASSISTANT_PERSONA_LABEL[enc.assistantPersona] : enc.assignedTo === 'nay' ? 'Nay' : enc.assignedTo}` : ''}</p>
        ${enc.agendaItemId ? `<a href="agenda.html?item=${enc.agendaItemId}" class="btn-text">Abrir na Agenda</a>` : `<a href="agenda.html" class="btn-text">Ir para Agenda →</a>`}
      </div>
    `, 'mb-6')}
    ${renderEncounterRecordingCard(enc)}
    ${renderScheduleRequestSection(n, enc)}
    ${renderEncounterExtra(n)}
    ${journeyPhase && (journeyPhase.activities.length || journeyPhase.mentorDeliverables.length) ? card(`
      <p class="text-sm text-white/50 mb-3">O Que Pertence à Fase ${def.phase + 1}</p>
      ${journeyPhase.activities.length ? `<div class="divide-y mb-1" style="border-color:var(--line);">${journeyPhase.activities.map(phaseActivityRow).join('')}</div>` : ''}
      ${journeyPhase.mentorDeliverables.length ? `<div class="divide-y" style="border-color:var(--line);">${journeyPhase.mentorDeliverables.map(phaseDeliverableRow).join('')}</div>` : ''}
    `, 'mb-6') : ''}
  `;
}

const RENDERERS = {
  program: renderProgramTab,
  onboarding: renderOnboardingTab,
  financial: renderFinancialTab,
  'brand-direction': renderBrandDirectionTab,
  questionnaire: renderQuestionnaireTab,
  meeting: renderMeetingTab,
  playbook: renderPlaybookTab,
  pitch: renderPitchTab,
  assessment: renderAssessmentTab,
  'archetype-quiz': renderArchetypeQuizTab,
  'value-analysis': renderValueAnalysisTab,
  homework: renderHomeworkTab,
  'meeting-prep': renderMeetingPrepTab,
  activity: renderActivityTab,
  e1: () => renderEncounterTab(1), e2: () => renderEncounterTab(2), e3: () => renderEncounterTab(3), e4: () => renderEncounterTab(4),
  e5: () => renderEncounterTab(5), e6: () => renderEncounterTab(6), e7: () => renderEncounterTab(7), e8: () => renderEncounterTab(8),
};

function wireTabEvents() {
  const tc = document.getElementById('tab-content');

  tc.querySelector('#archetype-visual-set')?.addEventListener('change', (e) => {
    if (!e.target.value) return;
    MockDB.setArchetypeVisualSet(clientId, e.target.value);
    toast('Coleção visual atualizada — os escores não mudam.');
    render();
  });
  tc.querySelector('#preview-as-client')?.addEventListener('click', (e) => {
    e.preventDefault();
    setActiveClientId(clientId);
    window.open('../client/arquetipos-resultado.html', '_blank');
  });
  tc.querySelector('#unlock-retake')?.addEventListener('click', () => {
    MockDB.unlockArchetypeRetake(clientId);
    toast('Novo teste liberado — o resultado anterior continua salvo no histórico.');
    render();
  });
  tc.querySelector('#print-result')?.addEventListener('click', () => window.print());
  tc.querySelector('#save-archetype-notes')?.addEventListener('click', () => {
    MockDB.saveArchetypeNotes(clientId, tc.querySelector('#archetype-notes').value);
    toast('Notas salvas.');
  });

  tc.querySelector('#apply-program-change')?.addEventListener('click', () => {
    const newSlug = tc.querySelector('#upgrade-program-select').value;
    if (newSlug === client.programSlug) { toast('A cliente já está nesse programa.'); return; }
    MockDB.upgradeClientProgram(clientId, newSlug);
    client.programSlug = newSlug;
    toast('Programa atualizado — progresso preservado.');
    render();
  });
  tc.querySelectorAll('[data-interest-status]').forEach((sel) => {
    sel.addEventListener('change', () => {
      MockDB.setUpgradeInterestStatus(sel.dataset.interestStatus, sel.value);
      toast('Status do interesse atualizado.');
      render();
    });
  });

  tc.querySelector('#contract-program')?.addEventListener('change', (e) => {
    MockDB.setContractProgram(clientId, e.target.value);
    toast('Programa atualizado.');
    render();
  });
  tc.querySelector('#contract-duration')?.addEventListener('change', (e) => {
    MockDB.setContractDuration(clientId, e.target.value);
    toast('Modelo de contrato atualizado.');
    render();
  });
  tc.querySelectorAll('[data-mark-paid]').forEach((btn) => {
    btn.addEventListener('click', () => {
      MockDB.markPaymentPaid(clientId, btn.dataset.markPaid);
      toast('Pagamento marcado como pago.');
      render();
    });
  });
  tc.querySelectorAll('[data-issue-nf]').forEach((btn) => {
    btn.addEventListener('click', () => {
      MockDB.issueInvoice(clientId, btn.dataset.issueNf);
      toast('Nota fiscal emitida — disponível para a cliente.');
      render();
    });
  });
  tc.querySelector('#save-contract-notes')?.addEventListener('click', () => {
    MockDB.saveContractNotes(clientId, tc.querySelector('#contract-notes').value);
    toast('Notas do fechamento salvas.');
    render();
  });
  tc.querySelector('#social-links-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const links = Object.fromEntries(SOCIAL_PLATFORMS.map((p) => [p, fd.get(`social_${p}`) || '']));
    MockDB.saveSocialLinks(clientId, links);
    toast('Redes sociais atualizadas.');
    render();
  });
  tc.querySelector('#save-contract-value')?.addEventListener('click', () => {
    const value = Number(tc.querySelector('#contract-value').value) || null;
    MockDB.setContractValue(clientId, value);
    toast('Valor total acordado salvo.');
    render();
  });
  wirePaymentPlanLines(tc, clientId, render);
  tc.querySelector('#renegotiate-plan')?.addEventListener('click', () => {
    if (isAssistant) return; // defense-in-depth — button is already !isAssistant-gated in renderSignedPaymentPlan
    openRenegotiateModal(MockDB.getPayments(clientId), render);
  });
  tc.querySelector('#create-image-project')?.addEventListener('click', () => {
    MockDB.setImageProjectStatus(clientId, 'created');
    toast('Projeto de imagens criado.');
    render();
  });
  tc.querySelector('#remind-photos')?.addEventListener('click', () => {
    MockDB.sendPhotoReminder(clientId, 'A equipe está aguardando suas fotos para seguir com o Projeto de Imagem, o Guia de Produções e o Mood Fotográfico.');
    toast('Lembrete enviado à cliente.');
    render();
  });
  tc.querySelector('#submit-kit')?.addEventListener('click', () => openSubmitReviewModal('digital_kit', null, 'Kit Digital'));
  tc.querySelectorAll('[data-submit-guide]').forEach((btn) => {
    btn.addEventListener('click', () => openSubmitReviewModal('image_guide', btn.dataset.submitGuide, btn.dataset.guideLabel));
  });
  tc.querySelector('#e3-note-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = new FormData(e.target).get('note');
    if (!text || !text.trim()) return;
    MockDB.addWhatsappNote(clientId, text.trim());
    toast('Nota registrada.');
    render();
  });
  tc.querySelector('#update-contract-status')?.addEventListener('click', () => {
    const status = tc.querySelector('#contract-status').value;
    MockDB.advanceContractStatus(clientId, status);
    toast('Status do contrato atualizado.');
    render();
  });
  tc.querySelector('#update-whatsapp-status')?.addEventListener('click', () => {
    const status = tc.querySelector('#whatsapp-status').value;
    MockDB.setWhatsappStatus(clientId, status);
    toast('Status do grupo de WhatsApp atualizado.');
    render();
  });

  tc.querySelector('#brand-direction-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const splitLines = (v) => (v || '').split('\n').map((s) => s.trim()).filter(Boolean);
    MockDB.saveBrandDirection(clientId, {
      pinterestUrl: (fd.get('pinterestUrl') || '').trim() || null,
      moodBoardIntro: fd.get('moodBoardIntro'),
      positioningSummary: fd.get('positioningSummary'),
      keywords: splitLines(fd.get('keywords')),
      tone: fd.get('tone'),
      references: splitLines(fd.get('references')),
      guidance: fd.get('guidance'),
      belongs: splitLines(fd.get('belongs')),
      doesntBelong: splitLines(fd.get('doesntBelong')),
    });
    toast('Direção da Marca atualizada.');
    render();
  });

  tc.querySelector('#regen-qa')?.addEventListener('click', async (e) => {
    e.target.disabled = true; e.target.textContent = 'Gerando…';
    const a = await MockDB.regenerateQuestionnaireAnalysis(clientId);
    document.getElementById('qa-body').innerHTML = renderQABody(a);
    toast('Análise regenerada.');
    render();
  });

  tc.querySelector('#upload-btn')?.addEventListener('click', async (e) => {
    e.target.disabled = true; e.target.textContent = 'Enviando…';
    await MockDB.uploadTranscript(clientId);
    toast('Transcrição enviada.');
    render();
  });
  tc.querySelector('#analyze-btn')?.addEventListener('click', async (e) => {
    e.target.disabled = true; e.target.textContent = 'Analisando…';
    await MockDB.analyzeTranscript(clientId);
    toast('Transcrição analisada.');
    render();
  });

  tc.querySelector('#generate-pb')?.addEventListener('click', async (e) => {
    e.target.disabled = true; e.target.textContent = 'Gerando…';
    await MockDB.generatePlaybookDraft(clientId);
    toast('Novo rascunho de playbook gerado.');
    render();
  });
  tc.querySelector('#publish-pb')?.addEventListener('click', () => {
    const pb = MockDB.getPlaybook(clientId);
    const latest = pb.versions[pb.versions.length - 1];
    MockDB.publishPlaybook(clientId, latest.version);
    toast('Playbook publicado — cliente notificada.');
    render();
  });
  tc.querySelectorAll('[data-section]').forEach((el) => {
    el.addEventListener('blur', () => {
      const pb = MockDB.getPlaybook(clientId);
      const latest = pb.versions[pb.versions.length - 1];
      MockDB.saveSectionEdit(clientId, latest.version, el.dataset.section, el.value);
    });
  });

  tc.querySelector('#generate-pitch')?.addEventListener('click', async (e) => {
    e.target.disabled = true; e.target.textContent = 'Gerando…';
    await MockDB.generatePitches(clientId);
    toast('Pitches gerados.');
    render();
  });

  tc.querySelector('#mark-complete')?.addEventListener('click', () => {
    MockDB.markAssessmentComplete(clientId);
    toast('Avaliação marcada como concluída.');
    render();
  });
}

// Tabs the assistant can actually change something on — everything else
// (Programa, E1, E2, E4-E8) is hers to read, not edit, so those stay
// visible for context without her being able to touch commercial/program
// decisions, scheduling requests, playbook links, etc. that are Nay's
// calls to make. E3 is the one encounter she runs day-to-day (image
// guides, production tools), so it — along with Onboarding and Financeiro
// — stays fully editable.
const ASSISTANT_EDITABLE_TABS = new Set(['onboarding', 'financial', 'e3']);

// Blunt but reliable: rather than threading a read-only flag through every
// render function above (dozens of forms/buttons across encounter briefs,
// sub-tabs like Direção da Marca, Ficha de Valor, etc.), just disable every
// interactive control after the fact for a locked tab. Links and <details>
// stay live, so "she can view but not edit" holds even for read-only tabs
// that link into deeper sub-pages — those inherit the same lockdown when
// opened, since activeTab drives this check regardless of how she got there.
// One deliberate carve-out: Notas Internas on Programa stays editable even
// though the rest of that tab is locked — a shared note both Nay and the
// assistant can read and add to is exactly what's wanted there, not
// something worth its own separate mechanism from the rest of the lockdown.
function applyReadOnlyLockdown() {
  if (!isAssistant || ASSISTANT_EDITABLE_TABS.has(activeTab)) return;
  const tc = document.getElementById('tab-content');
  if (!tc) return;
  // [data-tab] buttons are internal navigation shortcuts (e.g. "Abrir
  // Direção da Marca" from inside an encounter brief), not edits — leave
  // those live so browsing between read-only sub-pages still works.
  tc.querySelectorAll('input, select, textarea, button:not([data-tab])').forEach((el) => {
    if (el.closest('#notes-form')) return;
    el.disabled = true;
  });
  tc.querySelectorAll('form').forEach((f) => {
    if (f.id === 'notes-form') return;
    f.addEventListener('submit', (e) => e.preventDefault());
  });
}

function render() {
  content.innerHTML = shell(RENDERERS[activeTab]());
  applyReadOnlyLockdown();
  if (activeTab === 'financial') hydrateRealFinancialSummary();
  content.querySelectorAll('[data-tab]').forEach((btn) => {
    btn.addEventListener('click', () => { deliverablePreviewShown = false; activeTab = btn.dataset.tab; render(); });
  });
  // Critical 3 fix: renderPhaseControl() is never rendered for the assistant
  // now (see shell() above), so these listeners normally have nothing to
  // attach to — the isAssistant check here is defense-in-depth in case
  // either handler is ever wired from another spot. The real backstop is
  // inside MockDB.setClientPhase itself, which now refuses to run for a
  // non-admin actor regardless of caller.
  content.querySelector('#advance-phase')?.addEventListener('click', () => {
    if (isAssistant) return;
    MockDB.setClientPhase(clientId, phaseProgress.currentIndex + 1, role);
    toast('Fase avançada.');
    location.reload();
  });
  content.querySelector('#set-phase')?.addEventListener('click', () => {
    if (isAssistant) return;
    MockDB.setClientPhase(clientId, Number(content.querySelector('#phase-select').value), role);
    toast('Fase atualizada.');
    location.reload();
  });
  content.querySelector('#recommend-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = new FormData(e.target).get('text');
    if (!text || !text.trim()) return;
    MockDB.sendAssistantMessage({ from: 'nay', clientId, text: text.trim(), route: `client-workspace.html?id=${clientId}` });
    toast('Recomendação enviada para a Assistente.');
    render();
  });
  content.querySelector('#photo-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    MockDB.setClientProfileSummary(clientId, { ...MockDB.getClientProfileSummary(clientId), photoUrl: new FormData(e.target).get('photoUrl') });
    toast('Foto atualizada.');
    render();
  });
  // Live preview — the face shows up the moment she pastes a valid link,
  // before she even clicks Salvar, instead of only after a save+reload.
  content.querySelector('#photo-url-input')?.addEventListener('input', (e) => {
    const frame = document.getElementById('profile-photo-frame');
    const fallback = document.getElementById('profile-photo-fallback');
    if (!frame || !fallback) return;
    document.getElementById('profile-photo-img')?.remove();
    if (!isValidHttpUrl(e.target.value)) { fallback.style.display = ''; return; }
    const img = document.createElement('img');
    img.id = 'profile-photo-img';
    img.src = e.target.value;
    img.alt = client.fullName;
    img.style.cssText = 'width:100%; height:100%; object-fit:cover;';
    img.onerror = () => { img.remove(); fallback.style.display = ''; };
    img.onload = () => { fallback.style.display = 'none'; };
    frame.appendChild(img);
  });
  content.querySelector('#summary-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    MockDB.setClientProfileSummary(clientId, { ...MockDB.getClientProfileSummary(clientId), who: fd.get('who'), what: fd.get('what'), why: fd.get('why'), how: fd.get('how') });
    toast('Resumo salvo.');
    render();
  });
  content.querySelector('#notes-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    MockDB.saveNotes(clientId, new FormData(e.target).get('notes'));
    toast('Notas salvas.');
    render();
  });
  content.querySelector('#personal-playbook-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    MockDB.setPersonalPlaybookUrl(clientId, new FormData(e.target).get('url'));
    toast('Link do Playbook de Marca Pessoal salvo.');
    render();
  });
  content.querySelector('#business-playbook-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    MockDB.setBusinessPlaybookUrl(clientId, new FormData(e.target).get('url'));
    toast('Link do Business Playbook salvo.');
    render();
  });
  content.querySelector('#request-meeting-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const form = e.target;
    const n = Number(form.dataset.encounter);
    const checklist = Array.from(form.querySelectorAll('input[name="item"]')).map((el) => ({ label: el.value, done: el.checked }));
    const times = [0, 1, 2].map((i) => new FormData(form).get(`slot${i}`)).filter(Boolean).map((d) => new Date(d).toISOString());
    if (!times.length) { toast('Ofereça pelo menos um horário.', { tone: 'error' }); return; }
    // Final Production-Readiness Pass, decision on E3/E5: warning + admin
    // override, not a hard block — the existing canScheduleE3/E5 prerequisite
    // logic is unchanged, this only adds a confirmation step when Admin
    // (specifically — not a new capability for the assistant, whose
    // pre-existing E3 scheduling access is untouched either way) tries to
    // schedule past it. Cancel leaves everything exactly as it was; the
    // override itself is recorded as a lightweight client-history event
    // (reusing logActivity, not a new audit framework) rather than silently
    // let through.
    if (role === 'admin') {
      const gate = n === 3 ? MockDB.canScheduleE3(clientId) : n === 5 ? MockDB.canScheduleE5(clientId) : { ready: true };
      if (!gate.ready) {
        if (!confirm('Este encontro possui pré-requisitos pendentes. Deseja agendar mesmo assim?')) return;
        MockDB.logActivity(clientId, 'prerequisite_override', `Encontro E${n} solicitado com pré-requisito pendente — decisão de Nay.`);
      }
    }
    MockDB.requestEncounterMeeting(clientId, n, checklist, times);
    toast('Solicitação enviada — aguardando a cliente escolher um horário.');
    render();
  });
  content.querySelector('#repropose-meeting-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const form = e.target;
    const times = [0, 1, 2].map((i) => new FormData(form).get(`slot${i}`)).filter(Boolean).map((d) => new Date(d).toISOString());
    if (!times.length) { toast('Ofereça pelo menos um horário.', { tone: 'error' }); return; }
    MockDB.proposeNewEncounterMeetingTimes(form.dataset.request, times);
    toast('Novos horários enviados à cliente.');
    render();
  });
  content.querySelectorAll('[data-confirm-request]').forEach((btn) => {
    btn.addEventListener('click', () => {
      MockDB.confirmEncounterMeeting(btn.dataset.confirmRequest);
      toast('Encontro confirmado e agendado.');
      render();
    });
  });
  content.querySelectorAll('[data-cancel-request]').forEach((btn) => {
    btn.addEventListener('click', () => {
      MockDB.cancelEncounterRequest(btn.dataset.cancelRequest);
      toast('Solicitação cancelada.');
      render();
    });
  });
  wireTabEvents();

  if (activeTab === 'brand-direction') {
    const bd = MockDB.getBrandDirection(clientId);
    if (bd.pinterestUrl && isValidHttpUrl(bd.pinterestUrl)) {
      mountPinterestBoard(document.getElementById('board-area'), bd.pinterestUrl);
    }
  }
  if (activeTab === 'value-analysis') wireValueAnalysisTab();
}

// Deep-link from the dev preview panel ("client-detail.html?id=...&tab=value-analysis").
const deepLinkTab = new URLSearchParams(location.search).get('tab');
if (deepLinkTab && RENDERERS[deepLinkTab]) activeTab = deepLinkTab;

render();
