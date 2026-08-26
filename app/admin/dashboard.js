import { MockDB, TIER_PHASES, MOOD_SCALE, ONBOARDING_STAGE_LABEL, AGENDA_TYPE_LABEL, ASSISTANT_PERSONA_LABEL, ASSIGNEE_LABEL, LEAD_STAGE_LABEL, UPGRADE_INTEREST_STATUSES, UPGRADE_INTEREST_STATUS_LABEL, LEAD_ONBOARDING_STATUS_BADGE_CLASS } from '../shared/mock-db.js';
import { renderShell, card, statusBadge, formatDateTime, formatDate, toast } from '../shared/ui.js';

const VALUE_OVERVIEW_ROWS = [
  ['awaitingClientAnswers', 'Aguardando respostas das clientes'],
  ['submittedAwaitingAnalysis', 'Enviadas, aguardando análise'],
  ['inAnalysis', 'Em análise'],
  ['clarificationsRequired', 'Com pontos a esclarecer'],
  ['readyToPublish', 'Recomendações prontas para publicar'],
  ['publishedNeedingReview', 'Publicadas, revisão vencida'],
];

const AGENDA_TYPE_ICON = {
  class: '🎓', individual_meeting: '👤', group_meeting: '👥',
  online_event: '🌐', admin_task: '🗂️', deadline: '⏰', photo_review: '📸',
};

const TIER_LABEL = { premium: 'Premium', essential: 'Essential' };
const REQUEST_STATUS_LABEL = {
  pending: ['Aguardando triagem', 'badge-locked'],
  assigned: ['Agendada', 'badge-progress'],
  done: ['Concluída', 'badge-completed'],
};
const LEAD_STAGE_CLASS = {
  novo: 'badge-locked', engajado: 'badge-progress', em_conversa: 'badge-progress',
  proposta_enviada: 'badge-progress', convertido: 'badge-completed', perdido: 'badge-locked',
};

document.body.innerHTML = renderShell({ role: 'admin', active: 'dashboard.html', title: 'Painel Admin' });
const content = document.getElementById('app-content');

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

// Compact snapshot only — today's items plus a count of what's further out.
// Full visualization (every bucket, filters, history, create/edit) lives on
// its own Agenda page now; Painel just needs "what's happening today" and a
// way in.
function renderAgendaSnapshot() {
  const buckets = MockDB.getAgendaBuckets();
  const upcomingCount = buckets.proximosDias.length + buckets.estaSemana.length + buckets.maisAdiante.length;
  return card(`
    <div class="flex items-center justify-between mb-5">
      <p class="text-sm text-white/50">Agenda de Hoje</p>
      <a href="agenda.html" class="btn-text">Ver agenda completa &rarr;</a>
    </div>
    ${buckets.hoje.length ? buckets.hoje.map(agendaItemLink).join('') : '<p class="text-xs text-white/20">Nada agendado para hoje.</p>'}
    <p class="text-xs mt-4" style="color:var(--muted);">
      ${upcomingCount} próximo${upcomingCount === 1 ? '' : 's'} nos próximos dias${buckets.pendencias.length ? ` · ${buckets.pendencias.length} pendência${buckets.pendencias.length === 1 ? '' : 's'}` : ''}
    </p>
  `, 'mb-8');
}

// Only renders when there's something to see — this is meant to be an
// exception signal ("a delay requiring Nay's attention"), not a routine
// status card she has to scan past every time the queue is healthy.
function renderAssistantExceptionsCard() {
  const overdue = MockDB.getOverdueAssistantTasks();
  if (!overdue.length) return '';
  return card(`
    <div class="flex items-center justify-between mb-4">
      <p class="text-sm" style="color:var(--terracotta);">⚠ Tarefas da Assistente em Atraso</p>
      <span class="text-xs" style="color:var(--muted);">${overdue.length} pendência${overdue.length === 1 ? '' : 's'}</span>
    </div>
    <div class="divide-y" style="border-color:var(--line);">
      ${overdue.map((it) => `
        <a href="agenda.html?item=${it.id}" class="flex items-center justify-between py-2.5 hover:bg-white/5 -mx-1 px-1 rounded transition-colors">
          <div>
            <p class="text-sm">${it.title}</p>
            <p class="text-xs mt-0.5 text-white/30">${it.clientName ? it.clientName + ' · ' : ''}era para ${formatDateTime(it.date)}</p>
          </div>
          <span class="badge badge-locked" style="font-size:9px;">${it.assistantPersona ? ASSISTANT_PERSONA_LABEL[it.assistantPersona] : 'Assistente'}</span>
        </a>
      `).join('')}
    </div>
  `, 'mb-8');
}

function renderLeadsSnapshotCard() {
  const s = MockDB.getLeadsSummary();
  // Onboarding pipeline (post-sale, pre-activation) takes priority over the
  // older top-of-funnel "em conversa" view — it's the one that actually
  // needs Nay's action right now. Falls back to the old view when nothing's
  // in that pipeline yet, so this card is never empty for no reason.
  const pipeline = MockDB.getOnboardingPipeline();
  const active = pipeline.length ? pipeline : MockDB.getLeads()
    .filter((l) => ['em_conversa', 'proposta_enviada'].includes(l.stage))
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  return card(`
    <div class="flex items-center justify-between mb-4">
      <p class="text-sm text-white/50">Leads</p>
      <a href="leads.html" class="btn-text">Ver todos os leads &rarr;</a>
    </div>
    <div class="grid sm:grid-cols-4 gap-4 text-sm mb-4">
      <div><p class="text-2xl font-serif">${s.total}</p><p class="text-white/40 text-xs mt-1">Total</p></div>
      <div><p class="text-2xl font-serif">${s.inGroup}</p><p class="text-white/40 text-xs mt-1">No Grupo VIP</p></div>
      <div><p class="text-2xl font-serif">${s.converted}</p><p class="text-white/40 text-xs mt-1">Convertidos</p></div>
      <div><p class="text-2xl font-serif">${s.conversionRatePct}%</p><p class="text-white/40 text-xs mt-1">Taxa de Conversão</p></div>
    </div>
    ${active.length ? `
      <p class="text-xs uppercase mb-3" style="color:var(--muted); letter-spacing:.12em;">${pipeline.length ? 'Onboarding — Entre a Venda e a Ativação' : 'Em Andamento'}</p>
      <div class="divide-y" style="border-color:var(--line);">
        ${active.slice(0, 5).map((l) => `
          <a href="lead-detail.html?id=${l.id}" class="flex items-center justify-between py-2.5 hover:bg-white/5 -mx-1 px-1 rounded transition-colors">
            <span class="text-sm">${l.fullName}</span>
            <span class="badge ${l.onboardingStatus ? (LEAD_ONBOARDING_STATUS_BADGE_CLASS[l.onboardingStatus] || 'badge-locked') : (LEAD_STAGE_CLASS[l.stage] || 'badge-locked')}">${l.pipelineLabel || LEAD_STAGE_LABEL[l.stage]}</span>
          </a>
        `).join('')}
      </div>
    ` : '<p class="text-sm" style="color:var(--muted);">Nenhum lead em conversa avançada no momento.</p>'}
  `, 'mb-8');
}

// Concise and exception-focused, per design: only rows with something to
// act on show up — a healthy queue with everything at zero renders nothing.
function renderValueAnalysisOverviewCard() {
  const o = MockDB.getOwnerValueAnalysisOverview();
  const rows = VALUE_OVERVIEW_ROWS.filter(([key]) => o[key] > 0);
  if (!rows.length) return '';
  return card(`
    <p class="text-sm text-white/50 mb-4">Leitura Estratégica de Valor</p>
    <div class="grid sm:grid-cols-2 gap-3">
      ${rows.map(([key, label]) => `
        <div class="flex items-center justify-between py-1.5 border-b border-white/5">
          <span class="text-sm">${label}</span>
          <span class="badge ${key === 'readyToPublish' ? 'badge-completed' : 'badge-progress'}">${o[key]}</span>
        </div>
      `).join('')}
    </div>
  `, 'mb-8');
}

// Every Premium-preview activity (Business, or Direção da Marca for
// Ascensão de Imagem) can generate one of these — not just Business, so
// this stays separate from the Leitura Estratégica de Valor card above.
function renderUpgradeInterestCard() {
  const interests = MockDB.getPremiumUpgradeInterests().filter((i) => ['novo', 'em_conversa'].includes(i.status));
  if (!interests.length) return '';
  return card(`
    <div class="flex items-center justify-between mb-4">
      <p class="text-sm text-white/50">Interesse em Upgrade</p>
      <span class="text-xs" style="color:var(--muted);">${interests.length} em aberto</span>
    </div>
    <div class="divide-y" style="border-color:var(--line);">
      ${interests.map((i) => `
        <div class="py-3">
          <div class="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <p class="text-sm font-medium">${i.clientName}</p>
              <p class="text-xs text-white/30 mt-0.5">${i.currentProgramName} · via ${i.activityTitle} · ${formatDate(i.createdAt)}${i.currentPhase ? ` · ${i.currentPhase}` : ''}</p>
            </div>
            <div class="flex items-center gap-2">
              <a href="clients.html" class="btn-text">Contatar</a>
              <select data-interest-status="${i.id}" class="field text-xs" style="max-width:150px;">
                ${UPGRADE_INTEREST_STATUSES.map((s) => `<option value="${s}" ${i.status === s ? 'selected' : ''}>${UPGRADE_INTEREST_STATUS_LABEL[s]}</option>`).join('')}
              </select>
            </div>
          </div>
        </div>
      `).join('')}
    </div>
  `, 'mb-8');
}

function renderRequestsCard() {
  const requests = MockDB.listAllMeetingRequests();
  const pending = requests.filter((r) => r.status !== 'done');
  return card(`
    <div class="flex items-center justify-between mb-4">
      <p class="text-sm text-white/50">Solicitações de Reunião</p>
      <span class="text-xs" style="color:var(--muted);">${pending.length} em aberto</span>
    </div>
    ${pending.length ? `
      <div class="space-y-4">
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
    ` : '<p class="text-sm" style="color:var(--muted);">Nenhuma solicitação em aberto.</p>'}
  `, 'mb-8');
}

const brl = (n) => `R$ ${Math.round(n).toLocaleString('pt-BR')}`;

// The single most urgent thing that can block a whole client relationship
// from moving forward, so it sits at the very top of the dashboard —
// surfaced identically here, on Clientes, on the client's own detail page,
// and in the assistant's checklist (see getClientsAwaitingInfo).
function renderAwaitingInfoCard() {
  const clients = MockDB.getClientsAwaitingInfo();
  if (!clients.length) return '';
  return `
    <div class="mb-8" style="border-left:3px solid var(--terracotta); border-radius:4px;">${card(`
      <div class="flex items-center justify-between mb-4">
        <p class="text-sm" style="color:var(--terracotta);">⚠ Aguardando Informações da Cliente</p>
        <span class="text-xs" style="color:var(--muted);">${clients.length}</span>
      </div>
      <div class="divide-y" style="border-color:var(--line);">
        ${clients.map((c) => `
          <a href="client-detail.html?id=${c.id}" class="flex items-center justify-between py-2.5 hover:bg-white/5 -mx-2 px-2 rounded-lg transition-colors">
            <div>
              <p class="font-medium text-sm">${c.fullName}</p>
              <p class="text-xs text-white/30">${c.email}</p>
            </div>
            <span class="text-xs" style="color:var(--terracotta);">Contrato não pode ser preparado ainda</span>
          </a>
        `).join('')}
      </div>
    `)}</div>
  `;
}

// Motivational proof-of-impact numbers, per Nay's explicit request — real
// numbers derived from data that already exists (payments, leads,
// programHistory, priceHistory), never invented. See getSuccessMetrics.
function renderSuccessMetricsCard() {
  const m = MockDB.getSuccessMetrics();
  const topPricing = m.pricingImpact.entries[0];
  return card(`
    <p class="text-sm text-white/50 mb-1">Impacto do Seu Trabalho</p>
    <p class="text-xs text-white/20 mb-5">Números reais, calculados a partir dos dados do sistema.</p>
    <div class="grid sm:grid-cols-4 gap-4 text-sm mb-5">
      <div>
        <p class="text-2xl font-serif" style="color:var(--gold);">${m.revenueGrowth.growthPct !== null ? `${m.revenueGrowth.growthPct >= 0 ? '+' : ''}${m.revenueGrowth.growthPct}%` : '—'}</p>
        <p class="text-white/40 text-xs mt-1">Crescimento de receita</p>
      </div>
      <div>
        <p class="text-2xl font-serif" style="color:var(--gold);">${m.leadConversion.conversionRatePct}%</p>
        <p class="text-white/40 text-xs mt-1">Taxa de conversão de leads</p>
      </div>
      <div>
        <p class="text-2xl font-serif" style="color:var(--gold);">${m.upsells.count}</p>
        <p class="text-white/40 text-xs mt-1">Upsells em clientes atuais</p>
      </div>
      <div>
        <p class="text-2xl font-serif" style="color:var(--gold);">${m.pricingImpact.avgMultiplier ? `${m.pricingImpact.avgMultiplier.toFixed(2)}x` : '—'}</p>
        <p class="text-white/40 text-xs mt-1">Preço médio recomendado vs. anterior</p>
      </div>
    </div>
    ${topPricing ? `
      <p class="text-sm" style="border-top:1px solid var(--line); padding-top:16px;">
        <strong>${topPricing.clientName}</strong> agora cobra <strong style="color:var(--gold);">${topPricing.multiplier.toFixed(2)}x mais</strong> por "${topPricing.offerName}" — de ${brl(topPricing.previousPrice)} para ${brl(topPricing.newPrice)}${topPricing.monthlyLift ? `, um ganho estimado de ${brl(topPricing.monthlyLift)}/mês para ela` : ''}.
      </p>
    ` : ''}
  `, 'mb-8');
}

function renderOnboardingSummaryCard() {
  const s = MockDB.getOnboardingSummary();
  if (!s.stillOnboarding && !s.readyForPhase1) return '';
  return card(`
    <div class="flex items-center justify-between mb-4">
      <p class="text-sm text-white/50">Onboarding de Clientes</p>
      <span class="text-xs" style="color:var(--muted);">${s.stillOnboarding} em andamento</span>
    </div>
    <div class="grid sm:grid-cols-3 gap-4 text-sm">
      <div><p class="text-2xl font-serif">${s.awaitingContractPrep}</p><p class="text-white/40 text-xs mt-1">Aguardando Contrato</p></div>
      <div><p class="text-2xl font-serif">${s.awaitingSignature}</p><p class="text-white/40 text-xs mt-1">Aguardando Assinatura</p></div>
      <div><p class="text-2xl font-serif">${s.readyForPhase1}</p><p class="text-white/40 text-xs mt-1">Prontas para a Fase 1</p></div>
    </div>
  `, 'mb-8');
}

function renderMoodCard() {
  const stats = MockDB.getGlobalMoodStats();
  if (!stats.count) return card(`<p class="text-sm" style="color:var(--muted);">Ainda sem registros de sentimento dos clientes.</p>`, 'mb-8');
  const avgEmoji = MOOD_SCALE.find((m) => m.value === Math.round(stats.avg))?.emoji || '😐';
  return card(`
    <div class="flex items-center justify-between mb-4">
      <p class="text-sm text-white/50">Sentimento dos Clientes</p>
      <span class="text-xs" style="color:var(--muted);">${stats.count} registro${stats.count === 1 ? '' : 's'}</span>
    </div>
    <div class="flex items-center gap-4 mb-5">
      <span style="font-size:2.2rem;">${avgEmoji}</span>
      <div>
        <p class="text-2xl font-serif">${stats.avg.toFixed(1)} / 5</p>
        <p class="text-xs" style="color:var(--muted);">Média geral entre todos os clientes</p>
      </div>
    </div>
    <div class="space-y-2">
      ${MOOD_SCALE.map((m) => {
        const n = stats.distribution[m.value] || 0;
        const pct = stats.count ? Math.round((n / stats.count) * 100) : 0;
        return `
          <div class="flex items-center gap-3">
            <span style="width:22px;">${m.emoji}</span>
            <div class="progress-track flex-1"><div class="progress-fill" style="width:${pct}%;"></div></div>
            <span class="text-xs w-10 text-right" style="color:var(--muted);">${n}</span>
          </div>
        `;
      }).join('')}
    </div>
  `, 'mb-8');
}

function render() {
  const clients = MockDB.listClients();

  content.innerHTML = `
    ${renderAwaitingInfoCard()}
    ${renderSuccessMetricsCard()}
    ${renderAgendaSnapshot()}
    ${renderAssistantExceptionsCard()}
    ${renderLeadsSnapshotCard()}
    ${renderValueAnalysisOverviewCard()}
    ${renderUpgradeInterestCard()}
    ${renderOnboardingSummaryCard()}
    ${renderRequestsCard()}

    ${card(`
      <div class="flex items-center justify-between mb-4">
        <p class="text-sm text-white/50">Clientes Recentes</p>
        <a href="clients.html" class="btn-text">Ver todos os clientes &rarr;</a>
      </div>
      <div class="divide-y" style="border-color:var(--line);">
        ${clients.slice(0, 5).map((c) => {
          const metaLine = c.status === 'onboarding'
            ? `Onboarding: ${ONBOARDING_STAGE_LABEL[c.onboardingStage]}`
            : `${TIER_LABEL[c.tier] || c.tier} · Fase: ${TIER_PHASES[c.tier][c.phaseIndex]}`;
          return `
          <a href="client-detail.html?id=${c.id}" class="flex items-center justify-between py-3 hover:bg-white/5 -mx-2 px-2 rounded-lg transition-colors">
            <div>
              <p class="font-medium">${c.fullName}</p>
              <p class="text-xs text-white/30">${c.email} · ${metaLine}</p>
            </div>
            <div class="flex items-center gap-4">
              ${c.status === 'onboarding' ? '' : `<span class="text-xs text-white/40">Jornada ${c.journeyPct}% · Tarefas ${c.homeworkPct}%</span>`}
              ${statusBadge(c.status)}
            </div>
          </a>
        `;
        }).join('')}
      </div>
    `)}

    ${renderMoodCard()}
  `;

  content.querySelectorAll('[data-interest-status]').forEach((sel) => {
    sel.addEventListener('change', () => {
      MockDB.setUpgradeInterestStatus(sel.dataset.interestStatus, sel.value);
      toast('Status do interesse atualizado.');
      render();
    });
  });
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
