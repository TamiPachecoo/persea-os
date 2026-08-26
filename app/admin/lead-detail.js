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
  PROGRAM_DEFS, PAYMENT_METHODS, PAYMENT_METHOD_LABEL, ONBOARDING_STAGES, ONBOARDING_STAGE_LABEL,
  LEAD_ONBOARDING_STATUS_LABEL, LEAD_ONBOARDING_STATUS_BADGE_CLASS,
} from '../shared/mock-db.js';
import { renderShell, card, toast, formatDate, formatDateTime, openModal, renderSocialLinks } from '../shared/ui.js';

document.body.innerHTML = renderShell({ role: 'admin', active: 'leads.html' });
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
    <a href="leads.html" class="btn-text mb-4 inline-block">&larr; Todos os leads</a>
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
// The client never sees or edits this from her registration form. ---------
function renderCommercialCard(lead) {
  const ct = lead.commercialTerms || {};
  return card(`
    <div class="flex items-center justify-between mb-1">
      <p class="text-sm text-white/50">Condições Comerciais</p>
      ${lead.onboardingStatus ? `<span class="text-xs" style="color:var(--gold);">Venda fechada${ct.saleAgreedAt ? ` em ${formatDate(ct.saleAgreedAt)}` : ''}</span>` : ''}
    </div>
    <p class="text-xs text-white/20 mb-4">Preenchido por quem fechou a venda — a cliente não escolhe nem edita essas condições no formulário dela.</p>
    <form id="commercial-form" class="space-y-4">
      <div class="grid sm:grid-cols-2 gap-4">
        <div>
          <label class="text-xs text-white/40 block mb-1">Programa Acordado</label>
          <select name="program" class="field text-sm" required>
            <option value="">Selecione</option>
            ${PROGRAM_DEFS.map((p) => `<option value="${p.slug}" ${lead.program === p.slug ? 'selected' : ''}>${p.name}</option>`).join('')}
          </select>
        </div>
        <div>
          <label class="text-xs text-white/40 block mb-1">Forma de Pagamento</label>
          <select name="paymentMethod" class="field text-sm" required>
            <option value="">Selecione</option>
            ${PAYMENT_METHODS.map((m) => `<option value="${m}" ${ct.paymentMethod === m ? 'selected' : ''}>${PAYMENT_METHOD_LABEL[m]}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="grid sm:grid-cols-3 gap-4">
        <div>
          <label class="text-xs text-white/40 block mb-1">Valor Total Acordado</label>
          <input name="agreedAmount" type="number" min="0" step="0.01" class="field text-sm" value="${ct.agreedAmount ?? ''}" required />
        </div>
        <div>
          <label class="text-xs text-white/40 block mb-1">Número de Parcelas</label>
          <input name="installments" type="number" min="1" class="field text-sm" value="${ct.installments ?? 1}" required />
        </div>
        <div>
          <label class="text-xs text-white/40 block mb-1">Primeiro Vencimento</label>
          <input name="firstDueDate" type="date" class="field text-sm" value="${ct.firstDueDate || ''}" required />
        </div>
      </div>
      <div>
        <label class="text-xs text-white/40 block mb-1">Notas Comerciais / Condição Negociada</label>
        <textarea name="commercialNotes" rows="2" class="field text-sm">${ct.commercialNotes || ''}</textarea>
      </div>
      <div class="flex justify-end">
        <button type="submit" class="btn-primary" style="padding:9px 18px;font-size:12.5px;">${lead.onboardingStatus ? 'Atualizar Condições' : 'Registrar Venda Fechada'}</button>
      </div>
    </form>
  `, 'mb-6');
}

// --- 2. Cadastro — secure registration link + what she submitted. --------
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
  if (!lead.onboardingStatus) return '';
  const link = lead.registrationToken ? `${location.origin}${location.pathname.replace('admin/lead-detail.html', 'client/registration.html')}?token=${lead.registrationToken}` : null;
  return card(`
    <p class="text-sm text-white/50 mb-1">Cadastro</p>
    <p class="text-xs text-white/20 mb-4">Formulário simples e seguro — não expõe o painel normal da cliente, só o cadastro necessário para preparar o contrato.</p>
    ${!lead.registrationToken ? `
      <button id="generate-link" class="btn-primary" style="padding:9px 18px;font-size:12.5px;">Gerar link de cadastro</button>
    ` : `
      <div class="flex items-center gap-2 mb-3">
        <input readonly class="field text-sm" style="flex:1;" value="${link}" onclick="this.select()" />
        <button id="copy-link" class="btn-ghost">Copiar</button>
      </div>
      <div class="flex items-center gap-3 mb-4">
        ${!lead.registrationSentAt ? '<button id="mark-sent" class="btn-primary" style="padding:9px 18px;font-size:12.5px;">Enviar formulário de cadastro</button>' : `<span class="text-xs" style="color:var(--gold);">Enviado em ${formatDateTime(lead.registrationSentAt)}</span>`}
      </div>
      <div class="pt-4" style="border-top:1px solid var(--line);">
        <p class="text-xs uppercase mb-3" style="color:var(--muted); letter-spacing:.1em;">${lead.registrationCompletedAt ? `Cadastro recebido em ${formatDate(lead.registrationCompletedAt)}` : 'Aguardando preenchimento'}</p>
        ${registrationSummary(lead.registrationInfo)}
      </div>
    `}
  `, 'mb-6');
}

// --- 3. Contrato — reuses the exact same ONBOARDING_STAGES clients use. --
function renderContractCard(lead) {
  if (!lead.registrationCompletedAt) return '';
  const status = lead.contractStatus || 'info_pending';
  return card(`
    <div class="flex items-center justify-between mb-1">
      <p class="text-sm text-white/50">Contrato</p>
      ${lead.onboardingStatus === 'registration_completed' || (lead.onboardingStatus === 'in_contract' && status === 'info_received') ? '<span class="text-xs" style="color:var(--gold);">Contrato pronto para preparação</span>' : ''}
    </div>
    <div class="flex items-center gap-2 mb-3">
      <select id="contract-status" class="field text-sm">
        ${ONBOARDING_STAGES.map((s) => `<option value="${s}" ${status === s ? 'selected' : ''}>${ONBOARDING_STAGE_LABEL[s]}</option>`).join('')}
      </select>
      <button id="update-contract-status" class="btn-ghost">Atualizar</button>
    </div>
    ${status === 'completed'
      ? `<p class="text-xs" style="color:var(--gold);">Arquivado: ${lead.signedFileName || 'contrato-assinado.pdf'}</p>`
      : `<button id="upload-signed-contract" class="btn-primary" style="padding:9px 18px;font-size:12.5px;">Fazer upload do contrato autenticado</button>`}
    <p class="text-xs text-white/30 mt-3">Assinatura acontece na plataforma externa de assinatura — o upload aqui é o que libera a ativação.</p>
  `, 'mb-6');
}

// --- 4. Ativação — the only door into a real client row. -----------------
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
    <p class="text-xs text-white/20 mb-4">Cadastro recebido e contrato assinado — ativar cria o perfil de cliente com tudo já preenchido (dados, condições comerciais e contrato) e libera o acesso dela ao Persea OS.</p>
    <button id="activate-lead" class="btn-primary" style="padding:10px 20px;font-size:13px;">Ativar Cliente</button>
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

// --- Legacy quick-path — preserved, just demoted below the new flow. -----
function renderLegacyConvertCard(lead) {
  if (lead.convertedToClientId) return '';
  return card(`
    <details>
      <summary class="text-sm cursor-pointer" style="color:var(--muted); list-style:none;">⚙ Converter em Cliente diretamente (pula o fluxo de cadastro/contrato)</summary>
      <div class="mt-4">
        <p class="text-xs text-white/20 mb-4">Cria o perfil de cliente em onboarding sem exigir cadastro ou contrato assinado — use só em casos excepcionais; o caminho normal é Ativar Cliente acima.</p>
        <div class="flex items-center gap-3">
          <select id="convert-tier" class="field text-sm" style="max-width:180px;">
            <option value="essential">Jornada Essential</option>
            <option value="premium">Jornada Premium</option>
          </select>
          <button id="convert-lead" class="btn-ghost">Converter em Cliente</button>
        </div>
      </div>
    </details>
  `, 'mb-6');
}

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
    content.innerHTML = `<a href="leads.html" class="btn-text">&larr; Todos os leads</a><p class="mt-6 text-sm" style="color:var(--muted);">Lead não encontrada.</p>`;
    return;
  }

  content.innerHTML = `
    ${renderHeader(lead)}
    ${renderCommercialCard(lead)}
    ${renderRegistrationCard(lead)}
    ${renderContractCard(lead)}
    ${renderActivationCard(lead)}
    ${renderHistoryCard(lead)}
    ${renderLegacyConvertCard(lead)}
    ${renderInfoForm(lead)}
    ${renderInteractions(lead)}
  `;

  content.querySelector('#commercial-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    MockDB.agreeSale(leadId, {
      program: fd.get('program'), paymentMethod: fd.get('paymentMethod'),
      installments: Number(fd.get('installments')) || 1, agreedAmount: Number(fd.get('agreedAmount')) || 0,
      firstDueDate: fd.get('firstDueDate'), commercialNotes: fd.get('commercialNotes'), responsibleId: 'nay',
    });
    toast('Condições comerciais registradas.');
    render();
  });

  content.querySelector('#generate-link')?.addEventListener('click', () => {
    MockDB.generateRegistrationLink(leadId);
    toast('Link de cadastro gerado.');
    render();
  });
  content.querySelector('#copy-link')?.addEventListener('click', async (e) => {
    const link = content.querySelector('#copy-link').previousElementSibling.value;
    try { await navigator.clipboard.writeText(link); toast('Link copiado.'); }
    catch { toast('Não foi possível copiar automaticamente — selecione e copie manualmente.', { tone: 'error' }); }
  });
  content.querySelector('#mark-sent')?.addEventListener('click', () => {
    MockDB.markRegistrationSent(leadId);
    toast('Cadastro marcado como enviado.');
    render();
  });

  content.querySelector('#update-contract-status')?.addEventListener('click', () => {
    MockDB.advanceLeadContractStatus(leadId, content.querySelector('#contract-status').value);
    toast('Status do contrato atualizado.');
    render();
  });
  content.querySelector('#upload-signed-contract')?.addEventListener('click', async (e) => {
    e.target.disabled = true; e.target.textContent = 'Enviando…';
    await MockDB.uploadLeadSignedContract(leadId, `contrato-${leadId}-assinado.pdf`);
    toast('Contrato assinado enviado — pronta para ativação.');
    render();
  });

  content.querySelector('#activate-lead')?.addEventListener('click', () => {
    const result = MockDB.activateLead(leadId);
    if (!result.ok) { toast('Não foi possível ativar — verifique cadastro e contrato.', { tone: 'error' }); return; }
    toast('Cliente ativada — acesso ao Persea OS liberado!');
    location.href = `client-detail.html?id=${result.clientId}`;
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

  content.querySelector('#convert-lead')?.addEventListener('click', () => {
    const tier = content.querySelector('#convert-tier').value;
    const clientId = MockDB.convertLeadToClient(leadId, { tier });
    toast('Lead convertida em cliente!');
    location.href = `client-detail.html?id=${clientId}`;
  });
}

render();
