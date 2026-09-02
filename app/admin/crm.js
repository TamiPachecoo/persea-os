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
import { renderShell, card, statusBadge, toast, formatDate, openModal } from '../shared/ui.js';
import { requireProfile } from '../shared/supabase-auth.js';

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
        const link = `${location.origin}${location.pathname.replace('admin/crm.html', 'client/registration.html')}?token=${lead.registrationToken}`;
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

render();
