import { MockDB, setActiveClientId, DEFAULT_CLIENT_ID, MOOD_SCALE, ONBOARDING_STAGES, ONBOARDING_STAGE_LABEL, WHATSAPP_STATUSES, WHATSAPP_STATUS_LABEL, CONTRACT_DURATIONS, CONTRACT_DURATION_LABEL, CONTRACT_DURATION_VALUE, PROGRAMS, PROGRAM_LABEL, PAYMENT_STATUS_LABEL, PAYMENT_METHODS, PAYMENT_METHOD_LABEL, SOCIAL_PLATFORMS, SOCIAL_PLATFORM_LABEL, PROGRAM_DEFS, UPGRADE_INTEREST_STATUSES, UPGRADE_INTEREST_STATUS_LABEL, NF_STATUS_LABEL, ARCHETYPE_ATTEMPT_STATUS_LABEL, ARCHETYPE_ATTEMPT_STATUS_BADGE_CLASS, ARCHETYPE_VISUAL_SETS, ARCHETYPE_VISUAL_SET_LABEL, ASSISTANT_PERSONA_LABEL, AGENDA_STATUS_LABEL } from '../shared/mock-db.js';
import { renderShell, card, statusBadge, toast, formatDateTime, formatDate, renderPhaseTracker, isValidHttpUrl, externalLinkAttrs, boardEmptyState, mountPinterestBoard, renderSocialLinks, progressBar, renderArchetypeRadar, archetypePortrait } from '../shared/ui.js';
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

document.body.innerHTML = renderShell({ role: 'admin', active: 'clients.html' });

const clientId = new URLSearchParams(location.search).get('id') || DEFAULT_CLIENT_ID;
const client = MockDB.getClient(clientId);
const phaseProgress = MockDB.getPhaseProgress(clientId);
const TIER_LABEL = { premium: 'Premium', essential: 'Essential' };
const TABS = [
  ['program', 'Programa'],
  ['onboarding', 'Onboarding'],
  ['financial', 'Financeiro'],
  ['brand-direction', 'Direção da Marca'],
  ['questionnaire', 'Questionário'],
  ['meeting', 'Reunião e Transcrição'],
  ['playbook', 'Editor de Playbook'],
  ['pitch', 'Editor de Pitch'],
  ['assessment', 'Avaliação (legado)'],
  ['archetype-quiz', 'Arquétipos'],
  ['value-analysis', '✦ Ficha de Valor e Precificação (Premium)'],
  ['homework', 'Tarefas'],
  ['meeting-prep', 'Preparação de Reunião'],
  ['activity', 'Atividade'],
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

function shell(inner) {
  const done = isOnboardingDone();
  // "Ficha de Valor e Precificação" is a premium-only private workspace —
  // never shown for a standard-tier client, same reasoning as onboarding
  // dropping off the row once it's settled.
  let visibleTabs = done ? TABS.filter(([key]) => key !== 'onboarding') : TABS;
  if (client.programSlug !== 'persea-premium') visibleTabs = visibleTabs.filter(([key]) => key !== 'value-analysis');
  return `
    <a href="clients.html" class="btn-text mb-4 inline-block">&larr; Todos os clientes</a>
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
    ${!MockDB.getOnboarding(clientId).clientInfo.submitted ? `
      <div class="mb-8" style="border-left:3px solid var(--terracotta); border-radius:4px;">${card(`
        <p class="text-sm" style="color:var(--terracotta);">⚠ Esta cliente ainda não preencheu as informações de cadastro — o contrato não pode ser preparado até isso acontecer.</p>
      `)}</div>
    ` : ''}
    <details class="mb-8">
      <summary class="text-sm cursor-pointer" style="color:var(--muted); list-style:none;">💬 Recomendar algo para a Assistente sobre ${client.fullName}</summary>
      <div class="mt-3">${card(`
        <form id="recommend-form" class="flex items-start gap-2">
          <textarea name="text" rows="2" class="field" placeholder="Ex.: assista a gravação do E1 antes de preparar o guia de looks dela." required></textarea>
          <button type="submit" class="btn-ghost" style="white-space:nowrap;">Enviar</button>
        </form>
      `)}</div>
    </details>
    <div class="mb-8">${renderSocialLinks(MockDB.getSocialLinks(clientId))}</div>

    ${renderPhaseTracker(phaseProgress)}

    <div class="flex gap-1 mb-8 border-b border-white/10 overflow-x-auto">
      ${visibleTabs.map(([key, label]) => `
        <button data-tab="${key}" class="tab-btn ${activeTab === key ? 'active' : ''}">${label}</button>
      `).join('')}
    </div>
    <div id="tab-content">${inner}</div>
  `;
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
      <div class="grid sm:grid-cols-3 gap-4 text-sm mb-4">
        <div>
          <p class="text-white/40 text-xs mb-1">Programa</p>
          <select id="contract-program" class="field text-sm">
            <option value="">Não definido</option>
            ${PROGRAMS.map((p) => `<option value="${p}" ${c.program === p ? 'selected' : ''}>${PROGRAM_LABEL[p]}</option>`).join('')}
          </select>
        </div>
        <div>
          <p class="text-white/40 text-xs mb-1">Modelo de Contrato</p>
          ${c.program === 'ascensao_imagem'
            ? `<p class="field text-sm flex items-center">Pagamento único · R$ ${(c.value || 0).toLocaleString('pt-BR')}</p>`
            : `<select id="contract-duration" class="field text-sm" ${c.program !== 'persea' ? 'disabled' : ''}>
                <option value="">Não definido</option>
                ${CONTRACT_DURATIONS.map((d) => `<option value="${d}" ${c.duration === d ? 'selected' : ''}>${CONTRACT_DURATION_LABEL[d]} · R$ ${CONTRACT_DURATION_VALUE[d].toLocaleString('pt-BR')}</option>`).join('')}
              </select>`}
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
      <p class="text-xs text-white/30 mb-4">Assinatura acontece em uma plataforma externa — este protótipo apenas rastreia o status, sem integração real.</p>
      <div class="flex items-center gap-3">
        <button id="upload-signed-contract" class="btn-ghost" ${!['signed', 'completed'].includes(c.status) ? 'disabled' : ''}>
          ${c.signedFileName ? 'Reenviar Contrato Assinado' : 'Simular Upload do Contrato Assinado'}
        </button>
        ${c.signedFileName ? `<span class="text-xs" style="color:var(--muted);">${c.signedFileName}</span>` : ''}
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

    ${card(`
      <div class="flex items-center justify-between mb-4">
        <p class="text-sm text-white/50">Plano de Pagamento</p>
        ${c.installments ? `<span class="text-xs text-white/30">${c.installments}x de R$ ${Math.round(c.value / c.installments).toLocaleString('pt-BR')} · ${PAYMENT_METHOD_LABEL[c.paymentMethod] || '—'}</span>` : ''}
      </div>
      ${!c.value ? `
        <p class="text-sm" style="color:var(--muted);">Defina o programa e o modelo de contrato acima para gerar o plano de pagamento.</p>
      ` : `
        <div class="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm mb-3">
          <div>
            <p class="text-white/40 text-xs mb-1">Forma de Pagamento</p>
            <select id="payment-method" class="field text-sm">
              ${PAYMENT_METHODS.map((m) => `<option value="${m}" ${c.paymentMethod === m ? 'selected' : ''}>${PAYMENT_METHOD_LABEL[m]}</option>`).join('')}
            </select>
          </div>
          <div>
            <p class="text-white/40 text-xs mb-1">Número de Parcelas</p>
            <input id="payment-installments" type="number" min="1" max="24" class="field text-sm" value="${c.installments || 1}" />
          </div>
          <div>
            <p class="text-white/40 text-xs mb-1">Data da 1ª Parcela</p>
            <input id="payment-start-date" type="date" class="field text-sm" value="${payments[0]?.dueDate || new Date().toISOString().slice(0, 10)}" />
          </div>
          <div class="flex items-end">
            <button id="generate-payment-plan" class="btn-ghost w-full">${c.installments ? 'Refazer Plano' : 'Gerar Plano'}</button>
          </div>
        </div>
        <p class="text-xs text-white/20 mb-4">Valor total do contrato: R$ ${c.value.toLocaleString('pt-BR')}. Gerar o plano recalcula o cronograma abaixo — e na aba Financeiro — a partir da data escolhida, em parcelas mensais iguais.</p>
        ${payments.length ? `
          <div class="divide-y mb-4" style="border-color:var(--line);">
            ${payments.map((p) => `
              <div class="flex items-center gap-3 py-2.5 flex-wrap">
                <div class="flex items-center gap-2">
                  <span class="text-xs text-white/30">R$</span>
                  <input type="number" min="0" step="0.01" class="field text-sm" style="width:100px;" data-payment-amount="${p.id}" value="${p.amount}" />
                  <span class="text-xs text-white/30">vencimento</span>
                  <input type="date" class="field text-sm" style="width:152px;" data-payment-date="${p.id}" value="${p.dueDate}" />
                </div>
                <div class="flex items-center gap-3 ml-auto">
                  ${paymentBadge(p.status)}
                  <button data-remove-payment="${p.id}" class="btn-text">Remover</button>
                </div>
              </div>
            `).join('')}
          </div>
        ` : '<p class="text-sm mb-4" style="color:var(--muted);">Nenhum plano de pagamento definido ainda.</p>'}
        <div class="flex items-end gap-3 pt-4" style="border-top:1px solid var(--line);">
          <div class="flex-1">
            <p class="text-white/40 text-xs mb-1">Adicionar Parcela Avulsa — Data</p>
            <input id="manual-payment-date" type="date" class="field text-sm" />
          </div>
          <div class="flex-1">
            <p class="text-white/40 text-xs mb-1">Valor (R$)</p>
            <input id="manual-payment-amount" type="number" min="0" step="0.01" class="field text-sm" placeholder="0,00" />
          </div>
          <button id="add-manual-payment" class="btn-ghost">+ Adicionar</button>
        </div>
      `}
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

function renderFinancialTab() {
  const o = MockDB.getOnboarding(clientId);
  const c = o.contract;
  const payments = MockDB.getPayments(clientId);
  const paid = payments.filter((p) => p.status === 'paid').reduce((s, p) => s + p.amount, 0);
  const pending = payments.filter((p) => p.status !== 'paid').reduce((s, p) => s + p.amount, 0);

  return `
    ${card(`
      <p class="text-sm text-white/50 mb-4">Programa &amp; Contrato</p>
      <div class="grid sm:grid-cols-3 gap-4 text-sm">
        <div><p class="text-white/40 text-xs mb-1">Programa</p><p>${c.program ? PROGRAM_LABEL[c.program] : '—'}</p></div>
        <div><p class="text-white/40 text-xs mb-1">Modelo</p><p>${c.program === 'ascensao_imagem' ? 'Pagamento único' : (c.duration ? CONTRACT_DURATION_LABEL[c.duration] : '—')}</p></div>
        <div><p class="text-white/40 text-xs mb-1">Valor Total</p><p>${c.value ? `R$ ${c.value.toLocaleString('pt-BR')}` : '—'}</p></div>
      </div>
    `, 'mb-6')}
    ${card(`
      <div class="flex items-center justify-between mb-4">
        <p class="text-sm text-white/50">Pagamentos</p>
        <span class="text-xs text-white/30">Recebido R$ ${paid.toLocaleString('pt-BR')} · A receber R$ ${pending.toLocaleString('pt-BR')}</span>
      </div>
      ${payments.length ? `
        <div class="divide-y" style="border-color:var(--line);">
          ${payments.map((p) => `
            <div class="py-3 ${p.reportedPaidAt && p.status !== 'paid' ? 'bg-white/5 -mx-2 px-2 rounded' : ''}">
              <div class="flex items-center justify-between">
                <div>
                  <p class="text-sm">R$ ${p.amount.toLocaleString('pt-BR')}</p>
                  <p class="text-xs text-white/30 mt-0.5">
                    Vencimento ${formatDate(p.dueDate)}${p.paidAt ? ` · Pago em ${formatDate(p.paidAt)}` : ''}
                    ${p.linkSentAt ? ` · Link enviado em ${formatDate(p.linkSentAt)}` : ''}
                    ${p.reportedPaidAt && p.status !== 'paid' ? ` · <span style="color:var(--gold);">Assistente reportou pagamento em ${formatDate(p.reportedPaidAt)}</span>` : ''}
                  </p>
                </div>
                <div class="flex items-center gap-3">
                  ${paymentBadge(p.status)}
                  ${p.status !== 'paid' ? `<button data-mark-paid="${p.id}" class="btn-ghost">${p.reportedPaidAt ? 'Confirmar recebimento' : 'Marcar como pago'}</button>` : ''}
                </div>
              </div>
              <div class="flex items-center justify-between mt-2">
                <p class="text-xs text-white/30">Nota Fiscal: ${NF_STATUS_LABEL[p.nf.status]}</p>
                ${p.nf.status === 'requested' ? `<button data-issue-nf="${p.id}" class="btn-text">Emitir Nota Fiscal</button>` : ''}
              </div>
            </div>
          `).join('')}
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
function encounterRow(e, isPremiumProgram) {
  const locked = e.premiumOnly && !isPremiumProgram;
  return `
    <div class="flex items-center justify-between py-2.5 ${locked ? 'opacity-50' : ''}">
      <div class="flex items-center gap-2 min-w-0">
        <span class="text-xs" style="color:var(--muted); flex-shrink:0;">E${e.number}</span>
        <div class="min-w-0">
          <p class="text-sm truncate">${e.name}</p>
          <p class="text-xs text-white/20">Fase ${e.phase + 1}${e.date ? ` · ${formatDateTime(e.date)}` : ''}${e.assignedTo ? ` · ${e.assignedTo === 'assistant' && e.assistantPersona ? ASSISTANT_PERSONA_LABEL[e.assistantPersona] : e.assignedTo === 'nay' ? 'Nay' : e.assignedTo}` : ''}</p>
        </div>
      </div>
      <div class="flex items-center gap-2 flex-shrink-0">
        ${e.premiumOnly ? '<span class="text-xs text-white/20">Premium</span>' : ''}
        <span class="badge ${locked ? 'badge-locked' : ENCOUNTER_STATUS_BADGE_CLASS[e.status]}">${locked ? 'Somente Premium' : ENCOUNTER_STATUS_LABEL[e.status]}</span>
        ${e.agendaItemId && !locked ? `<a href="agenda.html?item=${e.agendaItemId}" class="btn-text">Abrir</a>` : ''}
      </div>
    </div>
  `;
}
function renderEncounterJourney(program) {
  const journey = MockDB.getEncounterJourney(clientId);
  const isPremiumProgram = program.slug === 'persea-premium';
  return card(`
    <div class="flex items-center justify-between mb-1">
      <p class="text-sm text-white/50">Jornada de Encontros (E1–E8)</p>
      <span class="text-xs" style="color:var(--muted);">${PROGRAM_LABEL_MAP[program.slug] || program.name}</span>
    </div>
    <p class="text-xs text-white/20 mb-3">Metodologia Nova Persea — E1–E4 formam a jornada completa da Essencial; Premium segue até E8. E7 e E8 são encontros adaptativos, sem pauta fixa.</p>
    <div class="divide-y" style="border-color:var(--line);">
      ${journey.map((e) => encounterRow(e, isPremiumProgram)).join('')}
    </div>
  `, 'mb-6');
}

function renderProgramTab() {
  const program = MockDB.getClientProgram(clientId);
  const progress = MockDB.getProgramProgress(clientId);
  const activities = MockDB.getProgramActivities(clientId);
  const meeting = MockDB.getUpcomingMeetingForClient(clientId);
  const history = MockDB.getProgramHistory(clientId);
  const myInterests = MockDB.getPremiumUpgradeInterests().filter((i) => i.clientId === clientId);

  const awaitingClient = activities.filter((a) => a.access === 'included' && ['not_started', 'in_progress', 'novas_solicitadas'].includes(a.status));
  const awaitingTeam = activities.filter((a) => a.access === 'included' && ['submitted', 'in_analysis'].includes(a.status));
  const completed = activities.filter((a) => a.access === 'included' && ['completed', 'feedback_available'].includes(a.status));

  return `
    ${card(`
      <div class="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <p class="text-sm text-white/50 mb-1">Programa</p>
          <p class="text-xl font-serif">${program.name}</p>
          ${program.positioning ? `<p class="text-xs mt-0.5" style="color:var(--gold);">${program.positioning} — ${program.supportingStatement || ''}</p>` : ''}
        </div>
        <a href="../client/program.html?asClient=1" target="_blank" rel="noopener" class="btn-ghost">Pré-visualizar como cliente ↗</a>
      </div>
      <div class="grid sm:grid-cols-4 gap-4 text-sm">
        <div><p class="text-xs text-white/30 mb-1">Duração</p><p>${program.durationMonths ? `${program.durationMonths} meses` : 'A confirmar'}</p></div>
        <div><p class="text-xs text-white/30 mb-1">Progresso</p><p>${progress.pct}% (${progress.completedCount}/${progress.totalIncluded})</p></div>
        <div><p class="text-xs text-white/30 mb-1">Próxima atividade</p><p>${progress.nextActivity ? progress.nextActivity.title : 'Tudo em dia'}</p></div>
        <div><p class="text-xs text-white/30 mb-1">Acesso Premium</p><p>${program.slug === 'persea-premium' ? 'Sim' : 'Não'}</p></div>
      </div>
      ${progressBarRow(progress.pct)}
    `, 'mb-6')}

    <div class="grid md:grid-cols-3 gap-4 mb-6">
      ${card(`<p class="text-xs text-white/30 mb-1">Aguardando a cliente</p><p class="text-2xl font-serif">${awaitingClient.length}</p>`)}
      ${card(`<p class="text-xs text-white/30 mb-1">Aguardando a equipe</p><p class="text-2xl font-serif">${awaitingTeam.length}</p>`)}
      ${card(`<p class="text-xs text-white/30 mb-1">Concluídas</p><p class="text-2xl font-serif">${completed.length}</p>`)}
    </div>

    ${card(`
      <p class="text-sm text-white/50 mb-3">Próximo encontro</p>
      ${meeting ? `<p class="text-sm">${meeting.title} — ${formatDateTime(meeting.date)}</p>` : '<p class="text-sm" style="color:var(--muted);">Nenhum encontro agendado.</p>'}
      <a href="agenda.html" class="btn-text mt-2 inline-block">Abrir Agenda</a>
    `, 'mb-6')}

    ${renderEncounterJourney(program)}

    ${card(`
      <p class="text-sm text-white/50 mb-4">Atividades</p>
      <div class="divide-y" style="border-color:var(--line);">
        ${activities.map((a) => `
          <div class="flex items-center justify-between py-2.5">
            <div class="flex items-center gap-2">
              <a href="${a.route ? `../client/${a.route}` : '#'}" ${a.route ? 'target="_blank" rel="noopener"' : ''} class="text-sm hover:underline">${a.title}</a>
              ${a.access === 'premium_preview' ? '<span class="text-xs text-white/20">(preview)</span>' : ''}
            </div>
            <span class="badge ${a.badgeClass}">${a.statusLabel}</span>
          </div>
        `).join('')}
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
function progressBarRow(pct) {
  return `<div class="mt-4">${progressBar(pct)}</div>`;
}
const PROGRAM_LABEL_MAP = Object.fromEntries(PROGRAM_DEFS.map((p) => [p.slug, p.name]));

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
  tc.querySelectorAll('[data-remove-payment]').forEach((btn) => {
    btn.addEventListener('click', () => {
      MockDB.removePayment(clientId, btn.dataset.removePayment);
      toast('Parcela removida.');
      render();
    });
  });
  tc.querySelectorAll('[data-payment-date]').forEach((input) => {
    input.addEventListener('change', () => {
      if (!input.value) return;
      MockDB.updatePayment(clientId, input.dataset.paymentDate, { dueDate: input.value });
      toast('Data da parcela atualizada.');
      render();
    });
  });
  tc.querySelectorAll('[data-payment-amount]').forEach((input) => {
    input.addEventListener('change', () => {
      const amount = Number(input.value);
      if (!input.value || Number.isNaN(amount) || amount < 0) return;
      MockDB.updatePayment(clientId, input.dataset.paymentAmount, { amount });
      toast('Valor da parcela atualizado.');
      render();
    });
  });
  tc.querySelector('#add-manual-payment')?.addEventListener('click', () => {
    const dueDate = tc.querySelector('#manual-payment-date').value;
    const amount = tc.querySelector('#manual-payment-amount').value;
    if (!dueDate || !amount) { toast('Informe data e valor da parcela.', { tone: 'error' }); return; }
    MockDB.addPayment(clientId, { dueDate, amount });
    toast('Parcela adicionada.');
    render();
  });
  tc.querySelector('#generate-payment-plan')?.addEventListener('click', () => {
    const method = tc.querySelector('#payment-method').value;
    const installments = Number(tc.querySelector('#payment-installments').value) || 1;
    const startDate = tc.querySelector('#payment-start-date').value || undefined;
    const hasPaid = MockDB.getPayments(clientId).some((p) => p.status === 'paid');
    if (hasPaid && !confirm('Já existem parcelas pagas registradas para esta cliente. Gerar um novo plano substitui todo o cronograma atual. Continuar?')) return;
    MockDB.setPaymentPlan(clientId, { method, installments, startDate });
    toast('Plano de pagamento gerado.');
    render();
  });
  tc.querySelector('#update-contract-status')?.addEventListener('click', () => {
    const status = tc.querySelector('#contract-status').value;
    MockDB.advanceContractStatus(clientId, status);
    toast('Status do contrato atualizado.');
    render();
  });
  tc.querySelector('#upload-signed-contract')?.addEventListener('click', async (e) => {
    e.target.disabled = true; e.target.textContent = 'Enviando…';
    await MockDB.uploadSignedContract(clientId, `contrato-${clientId}-assinado.pdf`);
    toast('Contrato assinado enviado — visível no perfil da cliente.');
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

function render() {
  content.innerHTML = shell(RENDERERS[activeTab]());
  content.querySelectorAll('[data-tab]').forEach((btn) => {
    btn.addEventListener('click', () => { deliverablePreviewShown = false; activeTab = btn.dataset.tab; render(); });
  });
  content.querySelector('#recommend-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = new FormData(e.target).get('text');
    if (!text || !text.trim()) return;
    MockDB.sendAssistantMessage({ from: 'nay', clientId, text: text.trim(), route: `client-workspace.html?id=${clientId}` });
    toast('Recomendação enviada para a Assistente.');
    render();
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
