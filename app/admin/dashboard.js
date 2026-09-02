// Painel — redesigned to answer one question: "what do I need to do right
// now?" Nay said the old version (a dozen stacked cards — metrics, mood,
// recent clients, every pipeline at once) left her not knowing where to
// look. Everything that's a number to admire rather than a thing to act on
// moved to Relatórios (see admin/reports.js); everything actionable here
// got folded into one prioritized list instead of one card per source.
import { MockDB, AGENDA_TYPE_LABEL, ASSISTANT_PERSONA_LABEL, ASSIGNEE_LABEL, ENCOUNTER_DEFS, ENCOUNTER_LABEL } from '../shared/mock-db.js';
import { renderShell, card, formatDateTime, formatDate, toast } from '../shared/ui.js';
import { requireProfile } from '../shared/supabase-auth.js';

const AGENDA_TYPE_ICON = {
  class: '🎓', individual_meeting: '👤', checkpoint: '☎️', group_meeting: '👥',
  online_event: '🌐', admin_task: '🗂️', deadline: '⏰', photo_review: '📸',
};
const REQUEST_STATUS_LABEL = {
  pending: ['Aguardando triagem', 'badge-locked'],
  assigned: ['Agendada', 'badge-progress'],
  done: ['Concluída', 'badge-completed'],
};
const brl = (n) => `R$ ${Math.round(n).toLocaleString('pt-BR')}`;

if (!(await requireProfile('admin'))) throw new Error('not authorized');
document.body.innerHTML = renderShell({ role: 'admin', active: 'dashboard.html', title: 'Painel Admin' });
const content = document.getElementById('app-content');

// --- One prioritized action list, instead of one card per data source. ---
// Same underlying facts as before (getClientsAwaitingInfo,
// getOverdueAssistantTasks, financial summary) — just merged and ranked so
// the single most urgent thing is always the first line, not buried in the
// third card down.
function getActionItems() {
  const items = [];

  MockDB.getClientsAwaitingInfo().forEach((c) => {
    items.push({
      rank: 0, tone: 'var(--terracotta)',
      text: `<strong>${c.fullName}</strong> — contrato não pode ser preparado, aguardando informações dela`,
      href: `client-detail.html?id=${c.id}`, cta: 'Ver cliente',
    });
  });

  MockDB.getOverdueAssistantTasks().forEach((it) => {
    items.push({
      rank: 1, tone: 'var(--terracotta)',
      text: `<strong>${it.title}</strong>${it.clientName ? ` — ${it.clientName}` : ''} — tarefa da assistente em atraso desde ${formatDateTime(it.date)}`,
      href: `agenda.html?item=${it.id}`, cta: 'Abrir',
    });
  });

  const fin = MockDB.getFinancialSummary();
  if (fin.totalOverdue > 0) {
    items.push({
      rank: 2, tone: 'var(--terracotta)',
      text: `<strong>${brl(fin.totalOverdue)}</strong> em pagamentos atrasados`,
      href: 'financial.html', cta: 'Ver financeiro',
    });
  }

  const va = MockDB.getOwnerValueAnalysisOverview();
  if (va.readyToPublish > 0) {
    items.push({
      rank: 3, tone: 'var(--gold)',
      text: `<strong>${va.readyToPublish}</strong> leitura${va.readyToPublish === 1 ? '' : 's'} estratégica${va.readyToPublish === 1 ? '' : 's'} de valor pronta${va.readyToPublish === 1 ? '' : 's'} para publicar`,
      href: 'crm.html', cta: 'Ver clientes',
    });
  }

  MockDB.getPremiumUpgradeInterests().filter((i) => ['novo', 'em_conversa'].includes(i.status)).forEach((i) => {
    items.push({
      rank: 4, tone: 'var(--gold)',
      text: `<strong>${i.clientName}</strong> demonstrou interesse em upgrade para Premium`,
      href: 'crm.html', cta: 'Ver cliente',
    });
  });

  return items.sort((a, b) => a.rank - b.rank);
}

function renderActionList() {
  const items = getActionItems();
  if (!items.length) {
    return card(`<p class="text-sm" style="color:var(--gold);">Tudo em dia ✦ Nada precisa da sua atenção agora.</p>`, 'mb-8');
  }
  return card(`
    <div class="flex items-center justify-between mb-4">
      <p class="text-sm text-white/50">Precisa de Você Agora</p>
      <span class="text-xs" style="color:var(--muted);">${items.length}</span>
    </div>
    <div class="divide-y" style="border-color:var(--line);">
      ${items.map((it) => `
        <div class="flex items-center justify-between gap-4 py-3">
          <p class="text-sm" style="color:${it.tone};"><span style="color:var(--cream);">●</span> ${it.text}</p>
          <a href="${it.href}" class="btn-text shrink-0">${it.cta} →</a>
        </div>
      `).join('')}
    </div>
  `, 'mb-8');
}

// Encontro-scheduling requests (see admin/client-detail.js's E-tabs) share
// this same card — one place for every "a client's waiting on a meeting
// decision" item, not a separate heading. Full context/actions (confirm,
// re-propose, decline) live on the client's own E-tab; this just links her
// there, same "surface it, act where the context lives" rule as elsewhere.
function encounterRequestRow(r) {
  const client = MockDB.getClient(r.clientId);
  const def = ENCOUNTER_DEFS[r.encounterNumber - 1];
  const detail = r.status === 'awaiting_nay_confirmation'
    ? `Horário escolhido: ${formatDateTime(r.selectedTime)}`
    : r.status === 'client_unavailable' ? 'Nenhum horário ofertado funcionou'
    : 'Aguardando a cliente escolher um horário';
  const needsNay = r.status !== 'awaiting_client_response';
  return `
    <div class="py-3 border-b border-white/5 last:border-0">
      <div class="flex items-start justify-between gap-4">
        <div>
          <p class="font-medium text-sm">${client ? client.fullName : r.clientId}</p>
          <p class="text-sm mt-1">${ENCOUNTER_LABEL[def.slug]} — ${detail}</p>
        </div>
        <span class="badge ${needsNay ? 'badge-progress' : 'badge-locked'}">${needsNay ? 'Aguardando você' : 'Aguardando a cliente'}</span>
      </div>
      <div class="flex items-center gap-2 mt-3">
        <a href="client-detail.html?id=${r.clientId}&tab=e${r.encounterNumber}" class="btn-text">Abrir</a>
      </div>
    </div>
  `;
}
// Meeting requests keep their own card — they need inline assign/resolve
// actions, not just a link — but only appear at all when one is pending.
function renderRequestsCard() {
  const pending = MockDB.listAllMeetingRequests().filter((r) => r.status !== 'done');
  const encounterPending = MockDB.listAllEncounterRequests().filter((r) => !['confirmed', 'cancelled'].includes(r.status));
  if (!pending.length && !encounterPending.length) return '';
  return card(`
    <div class="flex items-center justify-between mb-4">
      <p class="text-sm text-white/50">Solicitações de Reunião</p>
      <span class="text-xs" style="color:var(--muted);">${pending.length + encounterPending.length} em aberto</span>
    </div>
    <div class="space-y-4">
      ${encounterPending.map(encounterRequestRow).join('')}
      ${pending.map((r) => `
        <div class="py-3 border-b border-white/5 last:border-0">
          <div class="flex items-start justify-between gap-4">
            <div>
              <p class="font-medium text-sm">${r.clientName}</p>
              <p class="text-sm mt-1">${r.reason}</p>
              <p class="text-xs mt-1" style="color:var(--muted);">${formatDate(r.createdAt)}</p>
            </div>
            <span class="badge ${REQUEST_STATUS_LABEL[r.status][1]}">${REQUEST_STATUS_LABEL[r.status][0]}</span>
          </div>
          <div class="flex items-center gap-2 mt-3">
            ${r.status === 'pending' ? `
              <button data-assign="${r.clientId}:${r.id}:nay" class="btn-ghost">Atribuir à Nay</button>
              <button data-assign="${r.clientId}:${r.id}:assistant" class="btn-ghost">Atribuir à Assistente</button>
            ` : `
              <span class="text-xs" style="color:var(--muted);">Com ${ASSIGNEE_LABEL[r.assignedTo]}</span>
              <button data-resolve="${r.clientId}:${r.id}" class="btn-text">Marcar como concluída</button>
            `}
          </div>
        </div>
      `).join('')}
    </div>
  `, 'mb-8');
}

function agendaItemLink(it) {
  const who = it.relatedStudentId ? (MockDB.getClient(it.relatedStudentId)?.fullName || '') : (it.relatedGroupLabel || '');
  return `
    <a href="agenda.html?item=${it.id}" class="block py-2.5 border-b border-white/5 last:border-0 hover:bg-white/5 -mx-1 px-1 rounded transition-colors">
      <div class="flex items-center justify-between gap-2">
        <p class="text-xs" style="color:var(--terracotta);">${AGENDA_TYPE_ICON[it.type] || ''} ${AGENDA_TYPE_LABEL[it.type]}</p>
        ${it.assignedTo ? `<span class="badge badge-progress" style="font-size:9px;">${it.assignedTo === 'assistant' && it.assistantPersona ? ASSISTANT_PERSONA_LABEL[it.assistantPersona] : ASSIGNEE_LABEL[it.assignedTo]}</span>` : ''}
      </div>
      <p class="text-sm font-medium mt-0.5">${it.title}</p>
      <p class="text-xs mt-0.5 text-white/30">${who ? who + ' · ' : ''}${formatDateTime(it.date)}</p>
    </a>
  `;
}
function renderAgendaSnapshot() {
  const buckets = MockDB.getAgendaBuckets();
  return card(`
    <div class="flex items-center justify-between mb-5">
      <p class="text-sm text-white/50">Agenda de Hoje</p>
      <a href="agenda.html" class="btn-text">Ver agenda completa &rarr;</a>
    </div>
    ${buckets.hoje.length ? buckets.hoje.map(agendaItemLink).join('') : '<p class="text-xs text-white/20">Nada agendado para hoje.</p>'}
  `, 'mb-8');
}

// One quiet row of orientation numbers instead of the old wall of cards
// (recent clients, mood, onboarding breakdown, full leads snapshot) —
// each of those still has its own home (Clientes, Leads, Relatórios); this
// is just "where do things stand" at a glance, not a second copy of them.
function renderShortcuts() {
  const clients = MockDB.listClients();
  const activeCount = clients.filter((c) => c.status === 'active').length;
  const onboardingCount = clients.filter((c) => c.status === 'onboarding').length;
  const leadsSummary = MockDB.getLeadsSummary();
  const fin = MockDB.getFinancialSummary();
  const tiles = [
    ['crm.html', `${activeCount}`, 'Clientes Ativas'],
    ['crm.html', `${onboardingCount}`, 'Em Onboarding'],
    ['crm.html?section=leads', `${leadsSummary.total}`, 'Leads'],
    ['financial.html', brl(fin.totalPending), 'A Receber'],
  ];
  return `
    <div class="grid sm:grid-cols-4 gap-4 mb-8">
      ${tiles.map(([href, value, label]) => `
        <a href="${href}" class="block">${card(`<p class="text-2xl font-serif">${value}</p><p class="text-white/40 text-xs mt-1">${label}</p>`)}</a>
      `).join('')}
    </div>
  `;
}

function render() {
  content.innerHTML = `
    <div class="mb-8">
      <p class="text-white/40 text-sm mb-1">Painel</p>
      <h1 class="text-3xl font-serif">Olá, Nay</h1>
    </div>

    ${renderActionList()}
    ${renderAgendaSnapshot()}
    ${renderRequestsCard()}
    ${renderShortcuts()}

    <a href="reports.html" class="btn-text">Ver relatórios completos (impacto, adesão, engajamento, financeiro) &rarr;</a>
  `;

  content.querySelectorAll('[data-assign]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const [clientId, requestId, assignee] = btn.dataset.assign.split(':');
      MockDB.assignMeetingRequest(clientId, requestId, assignee);
      toast(`Reunião atribuída a ${ASSIGNEE_LABEL[assignee]}.`);
      render();
    });
  });
  content.querySelectorAll('[data-resolve]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const [clientId, requestId] = btn.dataset.resolve.split(':');
      MockDB.resolveMeetingRequest(clientId, requestId);
      toast('Solicitação marcada como concluída.');
      render();
    });
  });
}

render();
