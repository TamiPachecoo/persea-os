// CRM — Clientes and Leads merged under one tab (previously two separate
// nav items). Two sub-views, switched with plain pill buttons (same
// pattern as client-detail.js's TABS): Clientes, grouped by program so a
// program's roster reads as its own section instead of one flat list; and
// Leads, kept together as a single container — everything that used to
// live on the standalone Leads page (KPIs, onboarding pipeline, pipeline
// list, Grupo VIP dynamics) still does, just inside this one section.
import {
  MockDB, PROGRAM_DEFS, TIER_PHASES, ONBOARDING_STAGE_LABEL,
  LEAD_STAGES, LEAD_STAGE_LABEL, LEAD_SOURCES, LEAD_SOURCE_LABEL, VIP_GROUP_STATUSES, VIP_GROUP_STATUS_LABEL,
  PROGRAMS, PROGRAM_LABEL, SOCIAL_PLATFORMS, SOCIAL_PLATFORM_LABEL, PROGRAM_LABEL_BY_SLUG, LEAD_ONBOARDING_STATUS_BADGE_CLASS,
} from '../shared/mock-db.js';
import { renderShell, card, statusBadge, toast, formatDate, openModal, buildRegistrationLink, isProductionEnvironment } from '../shared/ui.js';
import { requireProfile } from '../shared/supabase-auth.js';
import { supabase } from '../shared/supabase-client.js';
import { deriveClientStatus, NEXT_ACTION_LABEL } from '../shared/client-status.js';
import { computeTeamNextStep } from '../shared/team-action-model.js';

// Production Migration Batch 4: app.naymurta.com never shows MockDB
// clients/leads. Real client creation + registration-link generation
// (below) is the only piece of this page converted this batch — the
// Leads/VIP-pipeline half stays MockDB-only and is simply not shown in
// production yet (an honest gap, not faked data), since that conversion
// wasn't in scope for this pass.
// Real gap found live, twice now: a client accidentally left checked
// "Cliente de demonstração" (the checkbox on her contract page) simply
// vanished from this entire list — the checkbox gives no warning that
// this is what it does, and the consequence (total invisibility, not a
// label) reads exactly like a bug. Demo clients are still fetched and
// shown here now, just tagged — see productionClientRow's badge below —
// so a mistaken toggle is visible and correctable instead of silently
// hiding someone. Financial rollups/reports still exclude them from real
// numbers (that exclusion lives separately in shared/financial-model.js
// and shared/hubla-model.js, untouched by this — this is only about
// whether she's visible here, not whether she counts as real revenue).
async function loadRealClients() {
  const { data: clients } = await supabase.from('clients').select('*').order('created_at', { ascending: false });
  const rows = clients || [];
  const ids = rows.map((c) => c.id);
  const [{ data: partyInfos }, { data: contracts }] = await Promise.all([
    ids.length ? supabase.from('party_info').select('client_id, submitted').in('client_id', ids) : Promise.resolve({ data: [] }),
    ids.length ? supabase.from('contracts').select('client_id, status, created_at').in('client_id', ids).order('created_at', { ascending: false }) : Promise.resolve({ data: [] }),
  ]);
  const partyByClient = new Map((partyInfos || []).map((p) => [p.client_id, p.submitted]));
  const contractByClient = new Map(); // first write per client wins — contracts already ordered newest-first
  (contracts || []).forEach((c) => { if (!contractByClient.has(c.client_id)) contractByClient.set(c.client_id, c.status); });
  const withStatus = rows.map((c) => ({
    ...c,
    _status: deriveClientStatus({ accessStatus: c.access_status, partyInfoSubmitted: !!partyByClient.get(c.id), contractStatus: contractByClient.get(c.id) }),
  }));
  // Real gap found: deriveClientStatus deliberately stops at "Ativa" (see
  // its own comment — everything past activation is program work, not
  // onboarding pipeline), which meant an active client's row here showed
  // literally nothing beyond that badge — no phase, no progress, no
  // indication of what the team should do next. computeTeamNextStep
  // (shared/team-action-model.js, also used by client-onboarding.js's own
  // fuller card — one definition, not two) fills exactly that gap, for
  // active clients only (a still-onboarding client has no program state
  // to compute this from yet).
  await Promise.all(withStatus.filter((c) => c._status.label === 'Ativa').map(async (c) => {
    c._teamNextStep = await computeTeamNextStep(c, c.id);
  }));
  return withStatus;
}

function productionClientRow(c) {
  const tierLabel = c.tier === 'premium' ? 'Premium' : 'Essential';
  const nextActionLabel = c._status.nextAction ? NEXT_ACTION_LABEL[c._status.nextAction] : null;
  return `
    <a href="client-onboarding.html?id=${c.id}" class="flex items-center justify-between py-3 hover:bg-white/5 -mx-2 px-2 rounded-lg transition-colors flex-wrap gap-2">
      <div class="min-w-0">
        <div class="flex items-center gap-2 flex-wrap">
          <p class="font-medium">${c.full_name}</p>
          ${c.is_demo ? '<span class="badge" style="background:rgba(196,90,60,.15); color:var(--terracotta); border-color:var(--terracotta);">Demo</span>' : ''}
        </div>
        <p class="text-xs text-white/30">${c.email || 'sem e-mail'} · ${tierLabel}${c.phase_index != null && c._teamNextStep ? ` · Fase ${c.phase_index + 1}` : ''}</p>
        ${c._teamNextStep ? `<p class="text-xs mt-0.5 break-words" style="color:var(--gold);">→ ${c._teamNextStep.label}</p>` : ''}
      </div>
      <!-- Real gap found live on mobile: this block itself never wrapped
           its own two children (label + badge), only the outer row did.
           A long combination — e.g. "Preparar contrato →" next to
           "Cadastro Recebido — Contrato Pendente" — had nowhere to go but
           to overflow off the right edge of the row (measured: this div's
           own right edge landed past the viewport width), rendering as a
           clipped, garbled mess that looked like the row wasn't really
           there. flex-wrap here lets the label drop below the badge
           instead of running off-screen. -->
      <div class="flex items-center gap-3 flex-wrap" style="max-width:100%;">
        ${nextActionLabel ? `<span class="text-xs" style="color:var(--gold);">${nextActionLabel} →</span>` : ''}
        <span class="badge ${c._status.badgeClass}">${c._status.label}</span>
      </div>
    </a>
  `;
}

function openRegistrationLinkModal(url) {
  const { el } = openModal({
    title: 'Cliente criada',
    bodyHtml: `
      <p class="text-sm text-white/50 mb-4">Envie este link para a cliente concluir o cadastro. Ele expira em 7 dias e só pode ser usado uma vez.</p>
      <div class="flex items-center gap-2">
        <input id="reg-link-field" class="field text-sm" readonly value="${url}" />
        <button type="button" id="copy-reg-link" class="btn-ghost shrink-0">Copiar</button>
      </div>
    `,
  });
  el.querySelector('#copy-reg-link').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(url); toast('Link copiado.'); } catch { toast('Não foi possível copiar.', { tone: 'error' }); }
  });
}

// fromLead: the real `leads` row this client is being created from, when
// reached via "Converter em Cliente" (or picking "Convertido" straight
// from the stage dropdown — see the leads-tab wiring below) — pre-fills
// her name/email (already on file, no re-typing) and, once the client is
// created for real, marks the lead itself as converted (stage +
// converted_to_client_id/converted_at, both real columns on `leads`
// already there for exactly this) so it drops out of the working pipeline
// instead of sitting there looking unconverted forever. undefined for the
// plain "+ Novo Cliente" button, which has no lead to link back to.
//
// onCancel: real gap found live — picking "Convertido" in the stage
// dropdown used to just save that word on the lead and stop there, with
// no client ever created; a lead marked "Convertido" but not actually in
// Clientes read as a bug (which it effectively was). Now that pick opens
// this same modal instead of silently saving the stage, and onCancel
// reverts the dropdown back to her real stage if the modal is dismissed
// without actually creating the client, so the dropdown never shows
// "Convertido" for a lead that isn't.
function openCreateClientModal(fromLead, { onCancel } = {}) {
  let converted = false;
  const { el, close } = openModal({
    title: 'Novo Cliente',
    onClose: () => { if (!converted) onCancel?.(); },
    bodyHtml: `
      <form id="create-client-form" class="space-y-4">
        <div>
          <label class="text-xs text-white/40 block mb-1">Nome Completo</label>
          <input name="full_name" class="field" required value="${fromLead?.full_name || ''}" />
        </div>
        <div class="grid sm:grid-cols-2 gap-4">
          <div>
            <label class="text-xs text-white/40 block mb-1">Email (opcional)</label>
            <input name="email" type="email" class="field" value="${fromLead?.email || ''}" />
          </div>
          <div>
            <label class="text-xs text-white/40 block mb-1">Programa</label>
            <select name="program_choice" class="field">
              <option value="essential">Persea Essential</option>
              <option value="premium">Persea Premium</option>
              <option value="ascensao_marca">Ascensão da Marca</option>
            </select>
          </div>
        </div>
        <div class="flex justify-end pt-2">
          <button type="submit" class="btn-primary" style="padding:9px 18px;font-size:12.5px;">Criar Cliente</button>
        </div>
      </form>
    `,
  });
  el.querySelector('#create-client-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    // Bug fix: a double-click here (no visual feedback while the request
    // is in flight) previously fired this handler twice, creating two real
    // clients + two valid tokens from a single "Criar Cliente" action — an
    // admin could easily copy/open the wrong one. The submit button is now
    // disabled for the duration of the request, and a second submit event
    // arriving before it resolves is ignored outright.
    const submitBtn = e.target.querySelector('button[type="submit"]');
    if (submitBtn.disabled) return;
    submitBtn.disabled = true;
    const originalLabel = submitBtn.textContent;
    submitBtn.textContent = 'Criando…';
    const fd = new FormData(e.target);
    // Ascensão da Marca is a genuinely separate program, not a Persea
    // tier — 'tier' stays a required, essential/premium-only column
    // technicality (see clients_tier_check), but program_slug is what
    // actually drives her real experience (Program Hub, Conteúdos —
    // see program-model.js/content.js), so it's sent explicitly here
    // rather than left to create-client-registration's persea-only default.
    const programChoice = fd.get('program_choice');
    const isAscensao = programChoice === 'ascensao_marca';
    try {
      const { data, error } = await supabase.functions.invoke('create-client-registration', {
        body: {
          full_name: fd.get('full_name'), email: fd.get('email') || null,
          tier: isAscensao ? 'essential' : programChoice,
          program_slug: isAscensao ? 'ascensao-marca' : undefined,
        },
      });
      if (error || data?.error) { toast(data?.error || 'Não foi possível criar a cliente agora.', { tone: 'error' }); return; }
      if (fromLead) {
        await supabase.from('leads').update({
          stage: 'convertido', converted_to_client_id: data.client_id || null, converted_at: new Date().toISOString(),
        }).eq('id', fromLead.id);
      }
      converted = true;
      close();
      openRegistrationLinkModal(data.registration_url);
      renderProductionCRM();
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = originalLabel;
    }
  });
}

// Real gap found live: naymurta.com's homepage form (landing-lead-capture
// Edge Function) writes real rows into `leads`, but this production path
// only ever rendered Clientes — Leads had no tab at all here (the mock
// `render()`/`renderLeadsSection()` further down, MockDB-based, is what
// non-production sees; app.naymurta.com never ran it). A real website
// contact had nowhere to show up. This is a first real-data pass at that
// tab, not a full migration of the Nova Persea lead pipeline (Condições
// Comerciais → Cadastro → Contrato still lives on MockDB leads in
// lead-detail.js/lead-bridge.js) — deliberately scoped to what's needed
// so a real lead is actually visible and actionable: see it, reach her
// on WhatsApp/e-mail, move her stage forward.
async function loadRealLeads() {
  const { data } = await supabase.from('leads').select('*').order('created_at', { ascending: false });
  return data || [];
}

function realLeadRow(l) {
  const waHref = l.phone ? `https://wa.me/55${l.phone.replace(/\D/g, '')}` : null;
  return `
    <div class="flex items-start justify-between py-3 gap-3 flex-wrap">
      <div class="min-w-0" style="flex:1 1 220px;">
        <p class="font-medium break-words">${l.full_name || '(sem nome)'}</p>
        <p class="text-xs text-white/30 break-words">${l.email || 'sem e-mail'} · ${l.phone || 'sem telefone'}</p>
        <p class="text-xs text-white/20 mt-1">${LEAD_SOURCE_LABEL[l.source] || l.source} · recebido ${formatDate(l.created_at)}</p>
      </div>
      <div class="flex items-center gap-2 flex-wrap shrink-0">
        ${waHref ? `<a href="${waHref}" target="_blank" rel="noopener" class="btn-ghost" style="padding:6px 12px;font-size:11px;">WhatsApp</a>` : ''}
        ${l.email ? `<a href="mailto:${l.email}" class="btn-ghost" style="padding:6px 12px;font-size:11px;">E-mail</a>` : ''}
        <select data-lead-stage="${l.id}" class="field text-xs" style="width:auto;padding:6px 10px;">
          ${LEAD_STAGES.map((s) => `<option value="${s}" ${l.stage === s ? 'selected' : ''}>${LEAD_STAGE_LABEL[s]}</option>`).join('')}
        </select>
        ${l.converted_to_client_id
          ? `<a href="client-onboarding.html?id=${l.converted_to_client_id}" class="text-xs" style="color:var(--gold);padding:6px 4px;">✓ Já é cliente</a>`
          : `<button type="button" data-convert-lead="${l.id}" class="btn-primary" style="padding:6px 12px;font-size:11px;">Converter em Cliente</button>`}
      </div>
    </div>
  `;
}

function renderRealLeadsSection(leads) {
  // Real gap found live: converting a lead marked it converted and pointed
  // it at the new client, but the row itself never left this list — from
  // the working pipeline's point of view she read as "still a lead" even
  // though Clientes now had her for real too. A converted lead stays out
  // of the default view (she's moved on, tracked in Clientes now), but
  // stays findable — searching by name/email still surfaces her, and so
  // does explicitly picking "Convertido" in the stage filter to review
  // past conversions.
  const showConverted = !!leadSearch || stageFilter === 'convertido';
  const openCount = leads.filter((l) => !l.converted_to_client_id).length;
  const filtered = leads.filter((l) => {
    const matchesSearch = !leadSearch || (l.full_name || '').toLowerCase().includes(leadSearch.toLowerCase()) || (l.email || '').toLowerCase().includes(leadSearch.toLowerCase());
    const matchesStage = !stageFilter || l.stage === stageFilter;
    const notArchived = showConverted || !l.converted_to_client_id;
    return matchesSearch && matchesStage && notArchived;
  });
  return card(`
    <div class="flex items-center justify-between mb-1">
      <p class="text-sm text-white/50">Leads</p>
      <span class="text-xs text-white/30">${filtered.length} de ${showConverted ? leads.length : openCount}</span>
    </div>
    <p class="text-xs text-white/20 mb-4">Contatos recebidos pelo formulário do site (naymurta.com) aparecem aqui automaticamente.</p>
    <div class="flex flex-wrap items-center gap-3 mb-4">
      <input id="lead-search" class="field text-sm" style="max-width:260px;" placeholder="Buscar por nome ou email..." value="${leadSearch}" />
      <select id="stage-filter" class="field text-sm" style="max-width:220px;">
        <option value="">Todos os estágios</option>
        ${LEAD_STAGES.map((s) => `<option value="${s}" ${stageFilter === s ? 'selected' : ''}>${LEAD_STAGE_LABEL[s]}</option>`).join('')}
      </select>
    </div>
    <div class="divide-y" style="border-color:var(--line);">
      ${filtered.length ? filtered.map(realLeadRow).join('') : '<p class="text-sm text-white/20 py-6">Nenhum lead encontrado.</p>'}
    </div>
  `, 'mb-8');
}

async function renderProductionCRM() {
  const header = `
    <div class="mb-8">
      <p class="text-white/40 text-sm mb-1">CRM</p>
      <h1 class="text-3xl font-serif">Clientes &amp; Leads</h1>
    </div>
    <div class="flex gap-1 mb-8 border-b border-white/10">
      <button data-section="clients" class="tab-btn ${section === 'clients' ? 'active' : ''}">Clientes</button>
      <button data-section="leads" class="tab-btn ${section === 'leads' ? 'active' : ''}">Leads</button>
    </div>
  `;

  if (section === 'leads') {
    const leads = await loadRealLeads();
    lastLoadedLeads = leads;
    content.innerHTML = header + renderRealLeadsSection(leads);
  } else {
    const clients = await loadRealClients();
    content.innerHTML = header + `
      ${card(`
        <div class="flex items-center justify-between">
          <p class="text-sm text-white/50">${clients.length} cliente${clients.length === 1 ? '' : 's'}</p>
          <button id="new-client" class="btn-primary" style="padding:9px 18px;font-size:12.5px;">+ Novo Cliente</button>
        </div>
      `, 'mb-6')}
      ${clients.length ? card(`<div class="divide-y" style="border-color:var(--line);">${clients.map(productionClientRow).join('')}</div>`)
        : card('<p class="text-sm" style="color:var(--muted);">Nenhum cliente ainda. Clique em "Novo Cliente" para começar o cadastro da primeira cliente real.</p>')}
    `;
  }

  content.querySelectorAll('[data-section]').forEach((btn) => {
    btn.addEventListener('click', () => {
      section = btn.dataset.section;
      history.replaceState(null, '', `crm.html?section=${section}`);
      renderProductionCRM();
    });
  });

  if (section === 'leads') {
    const searchEl = content.querySelector('#lead-search');
    searchEl.addEventListener('input', (e) => { leadSearch = e.target.value; renderProductionCRM(); });
    searchEl.focus();
    searchEl.setSelectionRange(leadSearch.length, leadSearch.length);
    content.querySelector('#stage-filter').addEventListener('change', (e) => { stageFilter = e.target.value; renderProductionCRM(); });
    content.querySelectorAll('[data-lead-stage]').forEach((sel) => {
      sel.addEventListener('change', async (e) => {
        const lead = lastLoadedLeads.find((l) => l.id === sel.dataset.leadStage);
        // Picking "Convertido" here means the same thing as clicking
        // "Converter em Cliente" — she's becoming a real client — so it
        // opens that same flow instead of just saving the word "Convertido"
        // on the lead with no client ever created behind it (the exact gap
        // reported live: the stage changed but nothing showed up in
        // Clientes). Reverts the dropdown if the modal is cancelled.
        if (e.target.value === 'convertido' && lead && !lead.converted_to_client_id) {
          openCreateClientModal(lead, { onCancel: () => { sel.value = lead.stage; } });
          return;
        }
        const { error } = await supabase.from('leads').update({ stage: e.target.value }).eq('id', sel.dataset.leadStage);
        if (error) { toast(error.message, { tone: 'error' }); return; }
        toast('Estágio atualizado.');
      });
    });
    content.querySelectorAll('[data-convert-lead]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const lead = lastLoadedLeads.find((l) => l.id === btn.dataset.convertLead);
        if (lead) openCreateClientModal(lead);
      });
    });
  } else {
    // Real gap found live: this used to pass openCreateClientModal
    // straight to addEventListener, which hands it the click Event as its
    // first argument — openCreateClientModal(fromLead) then treated that
    // Event as a truthy "fromLead" and tried to update a lead row with
    // id=undefined on every single client created this way (harmless to
    // the client creation itself, but a real failed request every time).
    content.querySelector('#new-client').addEventListener('click', () => openCreateClientModal());
  }
}

const TIER_LABEL = { premium: 'Premium', essential: 'Essential' };
const STAGE_CLASS = {
  novo: 'badge-locked', engajado: 'badge-progress', em_conversa: 'badge-progress',
  proposta_enviada: 'badge-progress', convertido: 'badge-completed', perdido: 'badge-locked',
};
const stageBadge = (stage) => `<span class="badge ${STAGE_CLASS[stage] || 'badge-locked'}">${LEAD_STAGE_LABEL[stage] || stage}</span>`;

if (!(await requireProfile('admin'))) throw new Error('not authorized');
document.body.innerHTML = renderShell({ role: 'admin', active: 'crm.html', title: 'CRM' });
const content = document.getElementById('app-content');

let section = new URLSearchParams(location.search).get('section') === 'leads' ? 'leads' : 'clients';
let clientSearch = '';
let leadSearch = '';
let stageFilter = '';
let lastLoadedLeads = []; // set by renderProductionCRM whenever it loads real leads — lets the "Converter em Cliente" click handler look up the full row by id without re-fetching

// --- Clientes, grouped by program -----------------------------------------
function clientRow(c) {
  const metaLine = c.status === 'onboarding'
    ? `Onboarding: ${ONBOARDING_STAGE_LABEL[c.onboardingStage]}`
    : `${TIER_LABEL[c.tier] || c.tier} · Fase: ${TIER_PHASES[c.tier][c.phaseIndex]}`;
  return `
    <a href="client-detail.html?id=${c.id}" class="flex items-center justify-between py-3 hover:bg-white/5 -mx-2 px-2 rounded-lg transition-colors" ${!c.infoSubmitted ? 'style="border-left:3px solid var(--terracotta); padding-left:9px;"' : ''}>
      <div>
        <p class="font-medium">${c.fullName}</p>
        <p class="text-xs text-white/30">${c.email} · ${metaLine}</p>
      </div>
      <div class="flex items-center gap-4">
        ${!c.infoSubmitted ? '<span class="badge" style="background:rgba(196,90,60,.15); color:var(--terracotta); border-color:var(--terracotta);">⚠ Aguardando Informações</span>' : ''}
        ${c.status === 'onboarding' ? '' : `<span class="text-xs text-white/40">Jornada ${c.journeyPct}% · Tarefas ${c.homeworkPct}%</span>`}
        ${statusBadge(c.status)}
      </div>
    </a>
  `;
}
function renderClientsSection() {
  const all = MockDB.listClients();
  const filtered = all.filter((c) => !clientSearch
    || c.fullName.toLowerCase().includes(clientSearch.toLowerCase())
    || c.email.toLowerCase().includes(clientSearch.toLowerCase()));
  const groups = PROGRAM_DEFS.map((def) => ({ def, clients: filtered.filter((c) => c.programSlug === def.slug) }));
  const ungrouped = filtered.filter((c) => !PROGRAM_DEFS.some((def) => def.slug === c.programSlug));

  return `
    <div class="grid md:grid-cols-4 gap-6 mb-8">
      ${card(`<p class="text-sm text-white/50 mb-2">Total de Clientes</p><p class="text-3xl font-serif">${all.length}</p>`)}
      ${PROGRAM_DEFS.map((def) => card(`
        <p class="text-sm text-white/50 mb-2">${def.name}</p>
        <p class="text-3xl font-serif">${all.filter((c) => c.programSlug === def.slug).length}</p>
      `)).join('')}
    </div>
    ${card(`
      <div class="flex flex-wrap items-center gap-3">
        <input id="client-search" class="field text-sm" style="max-width:260px;" placeholder="Buscar por nome ou email..." value="${clientSearch}" />
        <span class="text-xs text-white/30">${filtered.length} de ${all.length}</span>
      </div>
    `, 'mb-6')}
    ${groups.map(({ def, clients }) => clients.length ? card(`
      <div class="flex items-center justify-between mb-1">
        <p class="text-sm text-white/50">${def.name}</p>
        <span class="text-xs" style="color:var(--muted);">${clients.length} cliente${clients.length === 1 ? '' : 's'}</span>
      </div>
      <div class="divide-y" style="border-color:var(--line);">${clients.map(clientRow).join('')}</div>
    `, 'mb-6') : '').join('')}
    ${ungrouped.length ? card(`
      <p class="text-sm text-white/50 mb-4">Sem Programa Definido</p>
      <div class="divide-y" style="border-color:var(--line);">${ungrouped.map(clientRow).join('')}</div>
    `, 'mb-6') : ''}
    ${!filtered.length ? card('<p class="text-sm text-white/20 py-2">Nenhum cliente encontrado.</p>', 'mb-6') : ''}
  `;
}

// --- Leads, all together in one container ---------------------------------
function renderKPIs() {
  const s = MockDB.getLeadsSummary();
  return `
    <div class="grid md:grid-cols-4 gap-6 mb-8">
      ${card(`<p class="text-sm text-white/50 mb-2">Total de Leads</p><p class="text-3xl font-serif">${s.total}</p>`)}
      ${card(`<p class="text-sm text-white/50 mb-2">No Grupo VIP</p><p class="text-3xl font-serif">${s.inGroup}</p>`)}
      ${card(`<p class="text-sm text-white/50 mb-2">Convertidos</p><p class="text-3xl font-serif">${s.converted}</p>`)}
      ${card(`<p class="text-sm text-white/50 mb-2">Taxa de Conversão</p><p class="text-3xl font-serif">${s.conversionRatePct}%</p>`)}
    </div>
  `;
}
function leadRow(l) {
  const lastTouch = l.interactions[0]?.date || l.updatedAt;
  return `
    <a href="lead-detail.html?id=${l.id}" class="flex items-center justify-between py-3 hover:bg-white/5 -mx-2 px-2 rounded-lg transition-colors">
      <div class="min-w-0">
        <p class="font-medium">${l.fullName || '(sem nome)'}</p>
        <p class="text-xs text-white/30">${LEAD_SOURCE_LABEL[l.source] || l.source}${l.interestedProgram ? ` · ${PROGRAM_LABEL[l.interestedProgram]}` : ''} · último contato ${formatDate(lastTouch)}</p>
      </div>
      <div class="flex items-center gap-4 shrink-0">
        <span class="text-xs text-white/30">${VIP_GROUP_STATUS_LABEL[l.vipGroupStatus]}</span>
        ${stageBadge(l.stage)}
      </div>
    </a>
  `;
}
function onboardingRow(l) {
  const summary = l.commercialTerms
    ? `${PROGRAM_LABEL_BY_SLUG[l.program] || l.program || 'Programa a definir'} · R$ ${Number(l.commercialTerms.agreedAmount || 0).toLocaleString('pt-BR')} em ${l.commercialTerms.installments || 1}x`
    : '';
  const canCopy = l.registrationToken && !l.registrationCompletedAt;
  return `
    <div class="flex items-center justify-between py-3 -mx-2 px-2 rounded-lg gap-3">
      <a href="lead-detail.html?id=${l.id}" class="flex items-center justify-between flex-1 min-w-0 hover:opacity-80 transition-opacity">
        <div class="min-w-0">
          <p class="font-medium">${l.fullName}</p>
          <p class="text-xs text-white/30">${summary}</p>
        </div>
      </a>
      <div class="flex items-center gap-3 shrink-0">
        ${canCopy ? `<button data-copy-link="${l.id}" class="btn-ghost">📋 Copiar Link</button>` : ''}
        <a href="lead-detail.html?id=${l.id}"><span class="badge ${LEAD_ONBOARDING_STATUS_BADGE_CLASS[l.onboardingStatus] || 'badge-locked'}">${l.pipelineLabel}</span></a>
      </div>
    </div>
  `;
}
function renderOnboardingPipeline() {
  const pipeline = MockDB.getOnboardingPipeline();
  if (!pipeline.length) return '';
  return card(`
    <div class="flex items-center justify-between mb-4">
      <p class="text-sm text-white/50">Onboarding — Entre a Venda e a Ativação</p>
      <span class="text-xs" style="color:var(--muted);">${pipeline.length}</span>
    </div>
    <div class="divide-y" style="border-color:var(--line);">${pipeline.map(onboardingRow).join('')}</div>
  `, 'mb-8');
}
function renderLeadsList() {
  const all = MockDB.getLeads();
  const filtered = all.filter((l) => {
    const matchesSearch = !leadSearch || l.fullName.toLowerCase().includes(leadSearch.toLowerCase()) || l.email.toLowerCase().includes(leadSearch.toLowerCase());
    const matchesStage = !stageFilter || l.stage === stageFilter;
    return matchesSearch && matchesStage;
  });
  return card(`
    <div class="flex items-center justify-between mb-4">
      <p class="text-sm text-white/50">Pipeline de Leads</p>
      <button id="new-lead" class="btn-ghost">+ Novo Lead</button>
    </div>
    <div class="flex flex-wrap items-center gap-3 mb-4">
      <input id="lead-search" class="field text-sm" style="max-width:260px;" placeholder="Buscar por nome ou email..." value="${leadSearch}" />
      <select id="stage-filter" class="field text-sm" style="max-width:220px;">
        <option value="">Todos os estágios</option>
        ${LEAD_STAGES.map((s) => `<option value="${s}" ${stageFilter === s ? 'selected' : ''}>${LEAD_STAGE_LABEL[s]}</option>`).join('')}
      </select>
      <span class="text-xs text-white/30">${filtered.length} de ${all.length}</span>
    </div>
    <div class="divide-y" style="border-color:var(--line);">
      ${filtered.length ? filtered.map(leadRow).join('') : '<p class="text-sm text-white/20 py-6">Nenhum lead encontrado.</p>'}
    </div>
  `, 'mb-8');
}
function dynamicCard(d) {
  const deltaPct = d.beforeCount ? Math.round(((d.afterCount - d.beforeCount) / d.beforeCount) * 100) : null;
  const positive = deltaPct !== null && deltaPct >= 0;
  return `
    <div class="py-3 border-b border-white/5 last:border-0">
      <div class="flex items-start justify-between gap-4">
        <div class="min-w-0">
          <p class="font-medium text-sm">${d.title}</p>
          <p class="text-xs text-white/30 mt-1">${formatDate(d.date)}${d.description ? ` · ${d.description}` : ''}</p>
          <p class="text-xs mt-1" style="color:var(--muted);">${d.metricLabel}: ${d.beforeCount} → ${d.afterCount}</p>
        </div>
        <div class="flex items-center gap-3 shrink-0">
          ${deltaPct !== null ? `<span class="text-sm font-medium" style="color:${positive ? 'var(--gold)' : 'var(--terracotta)'};">${positive ? '+' : ''}${deltaPct}%</span>` : ''}
          <button data-delete-dynamic="${d.id}" class="btn-text">Remover</button>
        </div>
      </div>
    </div>
  `;
}
function renderGroupDynamics() {
  const dynamics = MockDB.getGroupDynamics();
  return card(`
    <div class="flex items-center justify-between mb-4">
      <p class="text-sm text-white/50">Dinâmicas do Grupo VIP</p>
      <button id="new-dynamic" class="btn-ghost">+ Nova Dinâmica</button>
    </div>
    <p class="text-xs text-white/20 mb-4">Registre o que foi feito no grupo e o número de antes/depois — para ver se a dinâmica realmente moveu algo (ex.: uma aula de oratória gerando mais preenchimentos de ficha).</p>
    ${dynamics.length ? dynamics.map(dynamicCard).join('') : '<p class="text-sm" style="color:var(--muted);">Nenhuma dinâmica registrada ainda.</p>'}
  `);
}
function renderLeadsSection() {
  return `
    ${renderKPIs()}
    ${renderOnboardingPipeline()}
    ${renderLeadsList()}
    ${renderGroupDynamics()}
  `;
}

function openLeadModal() {
  const { el, close } = openModal({
    title: 'Novo Lead',
    bodyHtml: `
      <form id="lead-form" class="space-y-4">
        <div class="grid sm:grid-cols-2 gap-4">
          <div>
            <label class="text-xs text-white/40 block mb-1">Nome Completo</label>
            <input name="fullName" class="field" required />
          </div>
          <div>
            <label class="text-xs text-white/40 block mb-1">Programa de Interesse</label>
            <select name="interestedProgram" class="field">
              <option value="">Ainda não sabe</option>
              ${PROGRAMS.map((p) => `<option value="${p}">${PROGRAM_LABEL[p]}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="grid sm:grid-cols-2 gap-4">
          <div>
            <label class="text-xs text-white/40 block mb-1">Email</label>
            <input name="email" type="email" class="field" />
          </div>
          <div>
            <label class="text-xs text-white/40 block mb-1">WhatsApp</label>
            <input name="phone" class="field" placeholder="(31) 90000-0000" />
          </div>
        </div>
        <div class="grid sm:grid-cols-2 gap-4">
          <div>
            <label class="text-xs text-white/40 block mb-1">Origem</label>
            <select name="source" class="field">
              ${LEAD_SOURCES.map((s) => `<option value="${s}">${LEAD_SOURCE_LABEL[s]}</option>`).join('')}
            </select>
          </div>
          <div>
            <label class="text-xs text-white/40 block mb-1">Status no Grupo VIP</label>
            <select name="vipGroupStatus" class="field">
              ${VIP_GROUP_STATUSES.map((s) => `<option value="${s}" ${s === 'in_group' ? 'selected' : ''}>${VIP_GROUP_STATUS_LABEL[s]}</option>`).join('')}
            </select>
          </div>
        </div>
        <p class="text-xs uppercase mt-2" style="color:var(--muted); letter-spacing:.12em;">Redes Sociais</p>
        <div class="grid sm:grid-cols-2 gap-4">
          ${SOCIAL_PLATFORMS.map((p) => `
            <div>
              <label class="text-xs text-white/40 block mb-1">${SOCIAL_PLATFORM_LABEL[p]}</label>
              <input name="social_${p}" class="field" placeholder="https://..." />
            </div>
          `).join('')}
        </div>
        <div>
          <label class="text-xs text-white/40 block mb-1">Notas</label>
          <textarea name="notes" rows="2" class="field" placeholder="O que você já sabe sobre esse lead..."></textarea>
        </div>
        <div class="flex justify-end pt-2">
          <button type="submit" class="btn-primary" style="padding:9px 18px;font-size:12.5px;">Adicionar Lead</button>
        </div>
      </form>
    `,
  });
  el.querySelector('#lead-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const socialLinks = Object.fromEntries(SOCIAL_PLATFORMS.map((p) => [p, fd.get(`social_${p}`) || '']));
    MockDB.createLead({
      fullName: fd.get('fullName'), email: fd.get('email') || '', phone: fd.get('phone') || '',
      source: fd.get('source'), vipGroupStatus: fd.get('vipGroupStatus'),
      interestedProgram: fd.get('interestedProgram') || null, notes: fd.get('notes') || '', socialLinks,
    });
    close();
    toast('Lead adicionado.');
    render();
  });
}
function openDynamicModal() {
  const { el, close } = openModal({
    title: 'Nova Dinâmica do Grupo VIP',
    bodyHtml: `
      <form id="dynamic-form" class="space-y-4">
        <div>
          <label class="text-xs text-white/40 block mb-1">Título</label>
          <input name="title" class="field" placeholder="Ex.: Aula de Oratória ao Vivo" required />
        </div>
        <div class="grid sm:grid-cols-2 gap-4">
          <div>
            <label class="text-xs text-white/40 block mb-1">Data</label>
            <input name="date" type="date" class="field" value="${new Date().toISOString().slice(0, 10)}" required />
          </div>
          <div>
            <label class="text-xs text-white/40 block mb-1">O Que Foi Medido</label>
            <input name="metricLabel" class="field" placeholder="Ex.: Preenchimento da Ficha de Interesse" required />
          </div>
        </div>
        <div class="grid sm:grid-cols-2 gap-4">
          <div>
            <label class="text-xs text-white/40 block mb-1">Antes</label>
            <input name="beforeCount" type="number" min="0" class="field" required />
          </div>
          <div>
            <label class="text-xs text-white/40 block mb-1">Depois</label>
            <input name="afterCount" type="number" min="0" class="field" required />
          </div>
        </div>
        <div>
          <label class="text-xs text-white/40 block mb-1">Descrição</label>
          <textarea name="description" rows="2" class="field"></textarea>
        </div>
        <div class="flex justify-end pt-2">
          <button type="submit" class="btn-primary" style="padding:9px 18px;font-size:12.5px;">Registrar</button>
        </div>
      </form>
    `,
  });
  el.querySelector('#dynamic-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    MockDB.addGroupDynamic({
      title: fd.get('title'), date: fd.get('date'), description: fd.get('description'),
      metricLabel: fd.get('metricLabel'), beforeCount: Number(fd.get('beforeCount')), afterCount: Number(fd.get('afterCount')),
    });
    close();
    toast('Dinâmica registrada.');
    render();
  });
}

function render() {
  content.innerHTML = `
    <div class="mb-8">
      <p class="text-white/40 text-sm mb-1">CRM</p>
      <h1 class="text-3xl font-serif">Clientes &amp; Leads</h1>
    </div>
    <div class="flex gap-1 mb-8 border-b border-white/10">
      <button data-section="clients" class="tab-btn ${section === 'clients' ? 'active' : ''}">Clientes</button>
      <button data-section="leads" class="tab-btn ${section === 'leads' ? 'active' : ''}">Leads</button>
    </div>
    ${section === 'clients' ? renderClientsSection() : renderLeadsSection()}
  `;

  content.querySelectorAll('[data-section]').forEach((btn) => {
    btn.addEventListener('click', () => {
      section = btn.dataset.section;
      history.replaceState(null, '', `crm.html?section=${section}`);
      render();
    });
  });

  if (section === 'clients') {
    const searchEl = content.querySelector('#client-search');
    searchEl.addEventListener('input', (e) => { clientSearch = e.target.value; render(); });
    searchEl.focus();
    searchEl.setSelectionRange(clientSearch.length, clientSearch.length);
  } else {
    const searchEl = content.querySelector('#lead-search');
    searchEl.addEventListener('input', (e) => { leadSearch = e.target.value; render(); });
    content.querySelector('#stage-filter').addEventListener('change', (e) => { stageFilter = e.target.value; render(); });
    searchEl.focus();
    searchEl.setSelectionRange(leadSearch.length, leadSearch.length);

    content.querySelector('#new-lead').addEventListener('click', openLeadModal);
    content.querySelector('#new-dynamic').addEventListener('click', openDynamicModal);
    content.querySelectorAll('[data-copy-link]').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.preventDefault();
        const lead = MockDB.getLead(btn.dataset.copyLink);
        const link = buildRegistrationLink(lead.registrationToken, location.pathname);
        try { await navigator.clipboard.writeText(link); toast('Link copiado — cole no WhatsApp da cliente.'); }
        catch { toast('Não foi possível copiar automaticamente.', { tone: 'error' }); }
        MockDB.markRegistrationSent(lead.id);
        render();
      });
    });
    content.querySelectorAll('[data-delete-dynamic]').forEach((btn) => {
      btn.addEventListener('click', () => {
        MockDB.deleteGroupDynamic(btn.dataset.deleteDynamic);
        toast('Dinâmica removida.');
        render();
      });
    });
  }
}

if (isProductionEnvironment()) {
  renderProductionCRM();
} else {
  render();
}
