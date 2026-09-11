// Production Data Migration — Batch 3: converted off MockDB onto real
// Supabase tables. Deliberately NOT one giant query — each section reads
// its own table, matching the UX's own natural boundaries:
//   - "Complete suas Informações" -> party_info (client-owned, one row,
//     upsert; RLS write policies added this pass — party_info_client_insert/
//     _update, matching this codebase's established client-owned-row
//     pattern rather than an Edge Function, since there's no multi-table
//     validation here, just one client writing one row she can already
//     read).
//   - "Contrato e Assinatura" -> contracts (read-only here; the actual
//     signature flow lives on contract.html, already real — see
//     admin/contract.js's 20 real Supabase calls).
//   - "Comunidade no WhatsApp" -> client_onboarding.whatsapp_group_status
//     (read-only client policy added last pass; written by staff only).
//   - "Próximo passo" -> questionnaires.status + archetype_quiz_attempts
//     (latest attempt).
//   - "Aulas e Materiais Iniciais" -> resources, real client-read RLS
//     (general_audience OR resource_assignments) — these are Hubla-hosted
//     links (resources.hubla_url), so they route through hublaHref() like
//     every other content CTA in this app.
import { getCurrentClientContext } from '../shared/client-context.js';
import { supabase } from '../shared/supabase-client.js';
import { renderShell, card, toast, stepEyebrow, initClientSwitcher, externalLinkAttrs, hublaHref } from '../shared/ui.js';

const CONTRACT_DURATION_LABEL = { semestral: 'Semestral', anual: 'Anual' };
const ONBOARDING_STAGE_LABEL = {
  info_pending: 'Informações Pendentes', info_received: 'Informações Recebidas', contract_prepared: 'Contrato Preparado',
  sent_for_signature: 'Enviado para Assinatura', awaiting_signature: 'Aguardando Assinatura', signed: 'Assinado', completed: 'Contrato Concluído',
};
const WHATSAPP_STATUS_LABEL = { not_added: 'Não Adicionada', pending: 'Pendente', added: 'Adicionada' };

const __clientCtx = await getCurrentClientContext('../login.html', { page: 'onboarding' });
if (!__clientCtx) throw new Error('not authorized');
const activeClientId = __clientCtx.clientId;
const client = __clientCtx.client; // real clients row, from client-context.js
document.body.innerHTML = renderShell({ role: 'client', active: 'onboarding.html', title: 'Onboarding' });
initClientSwitcher();
const content = document.getElementById('app-content');

const JOURNEY_STEPS = [
  'Boas-vindas', 'Complete suas Informações', 'Contrato', 'Assinatura',
  'Comunidade no WhatsApp', 'Aulas e Materiais', 'Início da Mentoria',
];

async function loadOnboardingState() {
  const [{ data: partyInfo }, { data: contract }, { data: clientOnboarding }] = await Promise.all([
    supabase.from('party_info').select('*').eq('client_id', activeClientId).maybeSingle(),
    supabase.from('contracts').select('*').eq('client_id', activeClientId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('client_onboarding').select('*').eq('client_id', activeClientId).maybeSingle(),
  ]);
  return {
    partyInfo,
    contractStatus: contract?.status || 'info_pending',
    contractDuration: contract?.duration || null,
    whatsappStatus: clientOnboarding?.whatsapp_group_status || 'not_added',
  };
}

function computeStepStates(s) {
  const infoDone = !!s.partyInfo?.submitted;
  const contractPrepared = ['contract_prepared', 'sent_for_signature', 'awaiting_signature', 'signed', 'completed'].includes(s.contractStatus);
  const signedOrDone = ['signed', 'completed'].includes(s.contractStatus);
  const contractDone = s.contractStatus === 'completed';
  const whatsappDone = s.whatsappStatus === 'added';

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

function renderStepper(s) {
  const states = computeStepStates(s);
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

function renderInfoForm(info) {
  const isPJ = info?.party_type === 'PJ';
  return card(`
    ${stepEyebrow(1, 4, 'Complete suas Informações')}
    <p class="text-sm text-white/50 mb-4 mt-2">Estes dados serão usados para preparar o seu contrato de mentoria.</p>
    <form id="info-form" class="space-y-4">
      <div>
        <label class="text-xs text-white/40 block mb-1">Nome Completo</label>
        <input name="fullName" class="field" value="${info?.full_name || client.full_name || ''}" required />
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
          <input name="doc" id="doc-input" class="field" value="${(isPJ ? info?.cnpj : info?.cpf) || ''}" required />
        </div>
      </div>
      <div id="company-name-field" style="display:${isPJ ? 'block' : 'none'};">
        <label class="text-xs text-white/40 block mb-1">Nome da Empresa</label>
        <input name="companyName" class="field" value="${info?.company_name || ''}" />
      </div>
      <div>
        <label class="text-xs text-white/40 block mb-1">Endereço</label>
        <input name="address" class="field" value="${info?.street ? [info.street, info.number, info.neighborhood, info.city, info.state].filter(Boolean).join(', ') : ''}" required />
      </div>
      <div class="grid sm:grid-cols-2 gap-4">
        <div>
          <label class="text-xs text-white/40 block mb-1">Email</label>
          <input name="email" type="email" class="field" value="${info?.email || client.email || ''}" required />
        </div>
        <div>
          <label class="text-xs text-white/40 block mb-1">Telefone / WhatsApp</label>
          <input name="whatsapp" class="field" value="${info?.whatsapp || ''}" required />
        </div>
      </div>
      <button type="submit" class="btn-primary" style="padding:9px 18px;font-size:12.5px;">${info?.submitted ? 'Atualizar Informações' : 'Enviar Informações'}</button>
    </form>
  `, 'mb-6');
}

function renderContractCard(s) {
  const badgeClass = s.contractStatus === 'completed' ? 'badge-completed' : s.contractStatus === 'info_pending' ? 'badge-locked' : 'badge-progress';
  return card(`
    ${stepEyebrow(2, 4, 'Contrato e Assinatura')}
    <div class="flex items-center justify-between mt-2 mb-3">
      <p class="text-sm">${s.contractDuration ? CONTRACT_DURATION_LABEL[s.contractDuration] : 'Modelo a definir pela equipe PERSEA'}</p>
      <span class="badge ${badgeClass}">${ONBOARDING_STAGE_LABEL[s.contractStatus]}</span>
    </div>
    <p class="text-xs text-white/30 mb-4">A assinatura acontece em uma plataforma externa. Assim que a Persea receber o contrato assinado, ele fica disponível aqui.</p>
    ${s.contractStatus === 'completed'
      ? `<a href="contract.html" class="btn-ghost inline-block">Ver Contrato Assinado</a>`
      : `<a href="contract.html" class="btn-text">Acompanhar contrato →</a>`}
  `, 'mb-6');
}

// Shown as soon as the contract is done — Extração de Marca and Teste de
// Arquétipos don't need the rest of onboarding (WhatsApp, resources) to
// start, so she's prompted straight into them instead of waiting idle.
async function renderNextStepCard(s) {
  if (s.contractStatus !== 'completed') return '';
  const [{ data: questionnaire }, { data: attempts }] = await Promise.all([
    supabase.from('questionnaires').select('status').eq('client_id', activeClientId).maybeSingle(),
    supabase.from('archetype_quiz_attempts').select('status').eq('client_id', activeClientId).order('started_at', { ascending: false }).limit(1),
  ]);
  const qDone = questionnaire?.status === 'submitted';
  const aStatus = attempts?.[0]?.status || 'not_started';
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

function renderWhatsappCard(s) {
  const badgeClass = s.whatsappStatus === 'added' ? 'badge-completed' : s.whatsappStatus === 'pending' ? 'badge-progress' : 'badge-locked';
  return card(`
    ${stepEyebrow(3, 4, 'Comunidade no WhatsApp')}
    <div class="flex items-center justify-between mt-2">
      <p class="text-sm text-white/50">Grupo fechado com a Nay e a equipe</p>
      <span class="badge ${badgeClass}">${WHATSAPP_STATUS_LABEL[s.whatsappStatus]}</span>
    </div>
    <p class="text-xs text-white/30 mt-2">${s.whatsappStatus === 'added' ? 'Você já faz parte do grupo.' : 'Você será adicionada assim que o contrato for concluído.'}</p>
  `, 'mb-6');
}

async function renderResourcesCard(unlocked) {
  const { data: resources } = await supabase.from('resources').select('*').order('created_at');
  return card(`
    ${stepEyebrow(4, 4, 'Aulas e Materiais Iniciais')}
    ${unlocked ? (
      resources && resources.length ? `
        <div class="space-y-1 mt-3">
          ${resources.map((r) => `
            <a ${externalLinkAttrs(hublaHref(r.hubla_url))} class="flex items-center justify-between py-2 border-b border-white/5 last:border-0 hover:bg-white/5 -mx-2 px-2 rounded transition-colors">
              <span>${r.title}</span>
              <span class="text-xs text-white/30">Acessar na Hubla ↗</span>
            </a>
          `).join('')}
        </div>
      ` : '<p class="text-xs mt-2" style="color:var(--muted);">Nenhum material disponível no momento.</p>'
    ) : `<p class="text-xs mt-2" style="color:var(--muted);">Liberado assim que o onboarding for concluído.</p>`}
  `);
}

async function render() {
  const s = await loadOnboardingState();
  const unlocked = s.whatsappStatus === 'added';
  const [nextStepHtml, resourcesHtml] = await Promise.all([renderNextStepCard(s), renderResourcesCard(unlocked)]);

  content.innerHTML = `
    <div class="mb-8">
      <p class="text-white/40 text-sm mb-1">Bem-vinda à Persea,</p>
      <h1 class="text-3xl font-serif">${client.full_name}</h1>
      <p class="text-sm text-white/40 mt-2">Antes de começar a Fase 1 da mentoria, vamos concluir seu cadastro.</p>
    </div>
    ${renderStepper(s)}
    <div ${!s.partyInfo?.submitted ? 'style="border-left:3px solid var(--terracotta); border-radius:4px;"' : ''}>${renderInfoForm(s.partyInfo)}</div>
    ${renderContractCard(s)}
    ${nextStepHtml}
    ${renderWhatsappCard(s)}
    ${resourcesHtml}
  `;

  document.getElementById('party-type')?.addEventListener('change', (e) => {
    document.getElementById('doc-label').textContent = e.target.value === 'PJ' ? 'CNPJ' : 'CPF';
    document.getElementById('company-name-field').style.display = e.target.value === 'PJ' ? 'block' : 'none';
  });

  document.getElementById('info-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const partyType = fd.get('partyType');
    const row = {
      client_id: activeClientId,
      submitted: true,
      full_name: fd.get('fullName'),
      party_type: partyType,
      cpf: partyType === 'PF' ? fd.get('doc') : null,
      cnpj: partyType === 'PJ' ? fd.get('doc') : null,
      company_name: partyType === 'PJ' ? fd.get('companyName') : null,
      street: fd.get('address'),
      email: fd.get('email'),
      whatsapp: fd.get('whatsapp'),
    };
    const { error } = s.partyInfo
      ? await supabase.from('party_info').update(row).eq('client_id', activeClientId)
      : await supabase.from('party_info').insert(row);
    if (error) { toast('Não foi possível salvar suas informações agora.', { tone: 'error' }); return; }
    toast('Informações enviadas — sua consultora vai preparar o contrato.');
    render();
  });
}

render();
