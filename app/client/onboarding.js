// Client-facing onboarding — the pre-Phase-1 workflow from
// docs/PERSEA_METHODOLOGY.md §2-3: client info -> contract -> signature ->
// WhatsApp milestone -> resources unlock -> Phase 1. Conceptual UI only;
// no real contract generation, e-signature, or WhatsApp integration.
import { MockDB, getActiveClientId, ONBOARDING_STAGE_LABEL, CONTRACT_DURATION_LABEL, WHATSAPP_STATUS_LABEL } from '../shared/mock-db.js';
import { renderShell, card, toast, stepEyebrow, initClientSwitcher } from '../shared/ui.js';

const activeClientId = getActiveClientId();
document.body.innerHTML = renderShell({ role: 'client', active: 'onboarding.html', title: 'Onboarding' });
initClientSwitcher();

const client = MockDB.getClient(activeClientId);
const content = document.getElementById('app-content');

const JOURNEY_STEPS = [
  'Boas-vindas',
  'Complete suas Informações',
  'Contrato',
  'Assinatura',
  'Comunidade no WhatsApp',
  'Aulas e Materiais',
  'Início da Mentoria',
];

// Derives each step's visual state from the underlying onboarding data —
// no separate "current step" field to keep in sync, matching how phase
// progress is derived elsewhere in this prototype (see getPhaseProgress).
function computeStepStates(o) {
  const infoDone = o.clientInfo.submitted;
  const contractPrepared = ['contract_prepared', 'sent_for_signature', 'awaiting_signature', 'signed', 'completed'].includes(o.contract.status);
  const signedOrDone = ['signed', 'completed'].includes(o.contract.status);
  const contractDone = o.contract.status === 'completed';
  const whatsappDone = o.whatsappGroup.status === 'added';

  return [
    'done',
    infoDone ? 'done' : 'current',
    !infoDone ? 'locked' : contractPrepared ? 'done' : 'current',
    !contractPrepared ? 'locked' : signedOrDone ? 'done' : 'current',
    !signedOrDone && !contractDone ? 'locked' : whatsappDone ? 'done' : 'current',
    !whatsappDone ? 'locked' : 'done',
    whatsappDone ? 'done' : 'locked',
  ];
}

function renderStepper(o) {
  const states = computeStepStates(o);
  return card(`
    <div class="flex flex-wrap gap-y-5 justify-between">
      ${JOURNEY_STEPS.map((label, i) => `
        <div class="flex flex-col items-center" style="width:13%; min-width:96px;">
          <div class="phase-dot" style="${states[i] === 'locked' ? 'opacity:.45;' : ''} ${states[i] === 'current' ? 'box-shadow:0 0 0 3px var(--gold) inset;' : ''}">${states[i] === 'done' ? '&#10003;' : i + 1}</div>
          <p class="text-xs text-center mt-2" style="color:${states[i] === 'current' ? 'var(--gold)' : 'var(--muted)'};">${label}</p>
        </div>
      `).join('')}
    </div>
  `, 'mb-10');
}

function renderInfoForm(o) {
  const info = o.clientInfo;
  const isPJ = info.partyType === 'PJ';
  return card(`
    ${stepEyebrow(1, 4, 'Complete suas Informações')}
    <p class="text-sm text-white/50 mb-4 mt-2">Estes dados serão usados para preparar o seu contrato de mentoria.</p>
    <form id="info-form" class="space-y-4">
      <div>
        <label class="text-xs text-white/40 block mb-1">Nome Completo</label>
        <input name="fullName" class="field" value="${info.fullName || client.fullName || ''}" required />
      </div>
      <div class="grid sm:grid-cols-2 gap-4">
        <div>
          <label class="text-xs text-white/40 block mb-1">Tipo de Contratante</label>
          <select name="partyType" id="party-type" class="field">
            <option value="PF" ${!isPJ ? 'selected' : ''}>Pessoa Física</option>
            <option value="PJ" ${isPJ ? 'selected' : ''}>Pessoa Jurídica</option>
          </select>
        </div>
        <div>
          <label class="text-xs text-white/40 block mb-1" id="doc-label">${isPJ ? 'CNPJ' : 'CPF'}</label>
          <input name="doc" id="doc-input" class="field" value="${(isPJ ? info.cnpj : info.cpf) || ''}" required />
        </div>
      </div>
      <div id="company-name-field" style="display:${isPJ ? 'block' : 'none'};">
        <label class="text-xs text-white/40 block mb-1">Nome da Empresa</label>
        <input name="companyName" class="field" value="${info.companyName || ''}" />
      </div>
      <div>
        <label class="text-xs text-white/40 block mb-1">Endereço</label>
        <input name="address" class="field" value="${info.address || ''}" required />
      </div>
      <div class="grid sm:grid-cols-2 gap-4">
        <div>
          <label class="text-xs text-white/40 block mb-1">Email</label>
          <input name="email" type="email" class="field" value="${info.email || client.email || ''}" required />
        </div>
        <div>
          <label class="text-xs text-white/40 block mb-1">Telefone / WhatsApp</label>
          <input name="whatsapp" class="field" value="${info.whatsapp || ''}" required />
        </div>
      </div>
      <button type="submit" class="btn-primary" style="padding:9px 18px;font-size:12.5px;">${info.submitted ? 'Atualizar Informações' : 'Enviar Informações'}</button>
    </form>
  `, 'mb-6');
}

function renderContractCard(o) {
  const c = o.contract;
  const badgeClass = c.status === 'completed' ? 'badge-completed' : c.status === 'info_pending' ? 'badge-locked' : 'badge-progress';
  return card(`
    ${stepEyebrow(2, 4, 'Contrato e Assinatura')}
    <div class="flex items-center justify-between mt-2 mb-3">
      <p class="text-sm">${c.duration ? CONTRACT_DURATION_LABEL[c.duration] : 'Modelo a definir pela equipe PERSEA'}</p>
      <span class="badge ${badgeClass}">${ONBOARDING_STAGE_LABEL[c.status]}</span>
    </div>
    <p class="text-xs text-white/30 mb-4">A assinatura acontece em uma plataforma externa. Assim que a Persea receber o contrato assinado, ele fica disponível aqui.</p>
    ${c.status === 'completed'
      ? `<a href="contract.html" class="btn-ghost inline-block">Ver Contrato Assinado</a>`
      : `<a href="contract.html" class="btn-text">Acompanhar contrato →</a>`}
  `, 'mb-6');
}

// Shown as soon as the contract is done — Extração de Marca and Teste de
// Arquétipos don't need the rest of onboarding (WhatsApp, resources) to
// start, so she's prompted straight into them instead of waiting idle.
function renderNextStepCard(o) {
  if (o.contract.status !== 'completed') return '';
  const q = MockDB.getQuestionnaire(activeClientId);
  const archetypeQuiz = MockDB.getClientArchetypeQuiz(activeClientId);
  const archetypeAttempt = archetypeQuiz.attempts[archetypeQuiz.attempts.length - 1];
  const qDone = q.status === 'submitted';
  const aStatus = !archetypeAttempt ? 'not_started' : archetypeAttempt.status;
  const aDone = aStatus === 'completed';
  if (qDone && aDone) return '';
  const archetypeLabel = aDone ? 'Ver meu resultado' : aStatus === 'in_progress' ? 'Continuar teste' : 'Iniciar teste';
  return card(`
    <p class="text-sm mb-1" style="color:var(--gold);">Contrato concluído ✓</p>
    <p class="text-lg font-serif mb-2">Próximo passo</p>
    <p class="text-sm text-white/50 mb-4 max-w-xl">Enquanto o restante do seu onboarding é finalizado, você já pode começar a Extração de Marca e o Teste de Arquétipos.</p>
    <div class="flex flex-wrap gap-3">
      <a href="questionnaire.html" class="btn-primary" style="padding:9px 18px;font-size:12.5px;">${qDone ? 'Ver Extração de Marca' : 'Iniciar Extração de Marca'}</a>
      <a href="${aDone ? 'arquetipos-resultado.html' : 'arquetipos.html'}" class="btn-ghost">${archetypeLabel}</a>
    </div>
  `, 'mb-6');
}

function renderWhatsappCard(o) {
  const w = o.whatsappGroup;
  const badgeClass = w.status === 'added' ? 'badge-completed' : w.status === 'pending' ? 'badge-progress' : 'badge-locked';
  return card(`
    ${stepEyebrow(3, 4, 'Comunidade no WhatsApp')}
    <div class="flex items-center justify-between mt-2">
      <p class="text-sm text-white/50">Grupo fechado com a Nay e a equipe</p>
      <span class="badge ${badgeClass}">${WHATSAPP_STATUS_LABEL[w.status]}</span>
    </div>
    <p class="text-xs text-white/30 mt-2">${w.status === 'added' ? 'Você já faz parte do grupo.' : 'Você será adicionada assim que o contrato for concluído.'}</p>
  `, 'mb-6');
}

function renderResourcesCard(unlocked) {
  const resources = MockDB.getResources();
  return card(`
    ${stepEyebrow(4, 4, 'Aulas e Materiais Iniciais')}
    ${unlocked ? `
      <div class="space-y-1 mt-3">
        ${resources.map((r) => `
          <a href="${r.url}" target="_blank" class="flex items-center justify-between py-2 border-b border-white/5 last:border-0 hover:bg-white/5 -mx-2 px-2 rounded transition-colors">
            <span>${r.icon} ${r.title}</span>
            <span class="text-xs text-white/30">${r.typeLabel}</span>
          </a>
        `).join('')}
      </div>
    ` : `<p class="text-xs mt-2" style="color:var(--muted);">Liberado assim que o onboarding for concluído.</p>`}
  `);
}

function render() {
  const o = MockDB.getOnboarding(activeClientId);
  const unlocked = o.whatsappGroup.status === 'added';

  content.innerHTML = `
    <div class="mb-8">
      <p class="text-white/40 text-sm mb-1">Bem-vinda à Persea,</p>
      <h1 class="text-3xl font-serif">${client.fullName}</h1>
      <p class="text-sm text-white/40 mt-2">Antes de começar a Fase 1 da mentoria, vamos concluir seu cadastro.</p>
    </div>
    ${renderStepper(o)}
    <div ${!o.clientInfo.submitted ? 'style="border-left:3px solid var(--terracotta); border-radius:4px;"' : ''}>${renderInfoForm(o)}</div>
    ${renderContractCard(o)}
    ${renderNextStepCard(o)}
    ${renderWhatsappCard(o)}
    ${renderResourcesCard(unlocked)}
  `;

  document.getElementById('party-type')?.addEventListener('change', (e) => {
    document.getElementById('doc-label').textContent = e.target.value === 'PJ' ? 'CNPJ' : 'CPF';
    document.getElementById('company-name-field').style.display = e.target.value === 'PJ' ? 'block' : 'none';
  });

  document.getElementById('info-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const partyType = fd.get('partyType');
    MockDB.saveClientInfo(activeClientId, {
      fullName: fd.get('fullName'),
      partyType,
      cpf: partyType === 'PF' ? fd.get('doc') : null,
      cnpj: partyType === 'PJ' ? fd.get('doc') : null,
      companyName: partyType === 'PJ' ? fd.get('companyName') : null,
      address: fd.get('address'),
      email: fd.get('email'),
      whatsapp: fd.get('whatsapp'),
    });
    toast('Informações enviadas — sua consultora vai preparar o contrato.');
    render();
  });

}

render();
