// Relatórios — the "help me make a decision" view: is adherence to
// assigned tasks actually happening, who has gone quiet, and what does the
// money look like now and over the next few months. Everything here is
// computed from data already recorded elsewhere (assignments, activity
// logs, payments) — no separate report data to seed/maintain.
//
// Filterable (which reports to show, by program, engagement window,
// forecast horizon) and exportable (CSV per report, print/PDF for the
// whole page) — Nay asked to be able to narrow down and take reports with her.
import { MockDB, PROGRAMS, PROGRAM_LABEL } from '../shared/mock-db.js';
import { renderShell, card, formatDate, downloadCSV } from '../shared/ui.js';

document.body.innerHTML = renderShell({ role: 'admin', active: 'reports.html', title: 'Relatórios' });
const content = document.getElementById('app-content');
const brl = (n) => `R$ ${n.toLocaleString('pt-BR')}`;

const filters = {
  types: { impact: true, adherence: true, engagement: true, financial: true },
  program: '',
  engagementDays: 14,
  forecastMonths: 3,
};

function renderFilters() {
  return card(`
    <div class="flex flex-wrap items-end gap-x-8 gap-y-4">
      <div>
        <p class="text-xs text-white/40 mb-2">Mostrar Relatórios</p>
        <div class="flex items-center gap-4 text-sm">
          <label class="flex items-center gap-1.5"><input type="checkbox" id="filter-type-impact" ${filters.types.impact ? 'checked' : ''} /> Impacto</label>
          <label class="flex items-center gap-1.5"><input type="checkbox" id="filter-type-adherence" ${filters.types.adherence ? 'checked' : ''} /> Adesão</label>
          <label class="flex items-center gap-1.5"><input type="checkbox" id="filter-type-engagement" ${filters.types.engagement ? 'checked' : ''} /> Engajamento</label>
          <label class="flex items-center gap-1.5"><input type="checkbox" id="filter-type-financial" ${filters.types.financial ? 'checked' : ''} /> Financeiro</label>
        </div>
      </div>
      <div>
        <p class="text-xs text-white/40 mb-1">Programa</p>
        <select id="filter-program" class="field text-sm">
          <option value="">Todos os programas</option>
          ${PROGRAMS.map((p) => `<option value="${p}" ${filters.program === p ? 'selected' : ''}>${PROGRAM_LABEL[p]}</option>`).join('')}
        </select>
      </div>
      <div>
        <p class="text-xs text-white/40 mb-1">Engajamento — inativa após</p>
        <select id="filter-engagement-days" class="field text-sm">
          ${[7, 14, 30].map((d) => `<option value="${d}" ${filters.engagementDays === d ? 'selected' : ''}>${d} dias</option>`).join('')}
        </select>
      </div>
      <div>
        <p class="text-xs text-white/40 mb-1">Previsão Financeira</p>
        <select id="filter-forecast-months" class="field text-sm">
          ${[3, 6, 12].map((m) => `<option value="${m}" ${filters.forecastMonths === m ? 'selected' : ''}>${m} meses</option>`).join('')}
        </select>
      </div>
      <button id="print-report" class="btn-ghost">Imprimir / Exportar PDF</button>
    </div>
  `, 'mb-8 no-print');
}

// Impacto — the proof-of-work numbers: revenue growth, lead conversion,
// upsells among existing clients, and the pricing-strategy lift Nay
// delivers through the Leitura Estratégica de Valor. Same numbers as the
// dashboard's motivational card, just with the full detail lists here.
function renderImpactReport() {
  if (!filters.types.impact) return '';
  const m = MockDB.getSuccessMetrics();
  const maxMonth = Math.max(1, ...m.revenueGrowth.months.map((b) => b.total));
  return card(`
    <div class="flex items-center justify-between mb-4">
      <p class="text-sm text-white/50">Impacto — Provas de Resultado</p>
      <button data-export="impact" class="btn-text no-print">Exportar CSV</button>
    </div>
    <div class="grid sm:grid-cols-4 gap-4 text-sm mb-6">
      <div><p class="text-white/40 text-xs mb-1">Crescimento de receita</p><p class="text-lg" style="color:var(--gold);">${m.revenueGrowth.growthPct !== null ? `${m.revenueGrowth.growthPct >= 0 ? '+' : ''}${m.revenueGrowth.growthPct}%` : '—'}</p></div>
      <div><p class="text-white/40 text-xs mb-1">Conversão de leads</p><p class="text-lg" style="color:var(--gold);">${m.leadConversion.conversionRatePct}%</p></div>
      <div><p class="text-white/40 text-xs mb-1">Upsells</p><p class="text-lg" style="color:var(--gold);">${m.upsells.count}</p></div>
      <div><p class="text-white/40 text-xs mb-1">Múltiplo médio de preço</p><p class="text-lg" style="color:var(--gold);">${m.pricingImpact.avgMultiplier ? `${m.pricingImpact.avgMultiplier.toFixed(2)}x` : '—'}</p></div>
    </div>

    <p class="text-xs uppercase mb-3" style="color:var(--muted); letter-spacing:.12em;">Receita — Últimos ${m.revenueGrowth.months.length} Meses</p>
    <div class="space-y-3 mb-6">
      ${m.revenueGrowth.months.map((b) => {
        const pct = Math.round((b.total / maxMonth) * 100);
        return `
          <div class="flex items-center gap-3">
            <span class="w-36 text-xs text-white/50 capitalize">${b.label}</span>
            <div class="progress-track flex-1"><div class="progress-fill" style="width:${pct}%;"></div></div>
            <span class="text-xs w-24 text-right" style="color:var(--muted);">${brl(b.total)}</span>
          </div>
        `;
      }).join('')}
    </div>

    ${m.upsells.count ? `
      <p class="text-xs uppercase mb-3" style="color:var(--muted); letter-spacing:.12em;">Upsells em Clientes Existentes</p>
      <div class="divide-y mb-6" style="border-color:var(--line);">
        ${m.upsells.entries.map((u) => `
          <div class="flex items-center justify-between py-2 text-sm">
            <span>${u.clientName} — ${u.fromLabel} → ${u.toLabel}</span>
            <span class="text-xs text-white/30">${formatDate(u.changedAt)}</span>
          </div>
        `).join('')}
      </div>
    ` : ''}

    ${m.pricingImpact.count ? `
      <p class="text-xs uppercase mb-3" style="color:var(--muted); letter-spacing:.12em;">Estratégias de Precificação Publicadas</p>
      <div class="divide-y" style="border-color:var(--line);">
        ${m.pricingImpact.entries.map((p) => `
          <div class="py-2 text-sm">
            <div class="flex items-center justify-between">
              <span>${p.clientName} — ${p.offerName}</span>
              <span style="color:var(--gold);">${p.multiplier.toFixed(2)}x</span>
            </div>
            <p class="text-xs text-white/30 mt-0.5">${brl(p.previousPrice)} → ${brl(p.newPrice)}${p.monthlyLift ? ` · ganho estimado de ${brl(p.monthlyLift)}/mês` : ''}</p>
          </div>
        `).join('')}
      </div>
    ` : ''}
  `, 'mb-8');
}

function renderAdherenceReport() {
  if (!filters.types.adherence) return '';
  const program = filters.program || undefined;
  const r = MockDB.getAdherenceReport({ program });
  if (!r.total) {
    return card(`
      <p class="text-sm text-white/50 mb-2">Adesão às Tarefas</p>
      <p class="text-sm" style="color:var(--muted);">Nenhuma atribuição de conteúdo registrada${program ? ' para este programa' : ''}.</p>
    `, 'mb-8');
  }

  const behind = r.byClient.filter((c) => c.total && Math.round((c.completed / c.total) * 100) < 70).sort((a, b) => (a.completed / a.total) - (b.completed / b.total));

  return card(`
    <div class="flex items-center justify-between mb-4">
      <p class="text-sm text-white/50">Adesão às Tarefas</p>
      <div class="flex items-center gap-3">
        <span class="text-xs text-white/30">${r.total} atribuições no total</span>
        <button data-export="adherence" class="btn-text no-print">Exportar CSV</button>
      </div>
    </div>
    <div class="flex items-center gap-4 mb-5">
      <p class="text-3xl font-serif">${r.completedPct}%</p>
      <p class="text-xs" style="color:var(--muted);">das clientes concluem o que é atribuído</p>
    </div>
    <div class="space-y-2 mb-6">
      ${[['Concluído', r.completed, 'var(--gold)'], ['Em atraso', r.overdue, 'var(--terracotta)'], ['Pendente', r.pending, 'var(--muted)']].map(([label, n, colorVar]) => {
        const pct = r.total ? Math.round((n / r.total) * 100) : 0;
        return `
          <div class="flex items-center gap-3">
            <span class="w-24 text-xs text-white/50">${label}</span>
            <div class="progress-track flex-1"><div class="progress-fill" style="width:${pct}%; background:${colorVar};"></div></div>
            <span class="text-xs w-10 text-right" style="color:var(--muted);">${n}</span>
          </div>
        `;
      }).join('')}
    </div>
    ${behind.length ? `
      <p class="text-xs uppercase mb-3" style="color:var(--muted); letter-spacing:.12em;">Clientes Abaixo de 70% de Conclusão</p>
      <div class="divide-y" style="border-color:var(--line);">
        ${behind.map((c) => `
          <div class="flex items-center justify-between py-2.5">
            <span class="text-sm">${c.clientName}</span>
            <span class="text-xs" style="color:var(--terracotta);">${c.completed}/${c.total} concluídas${c.overdue ? ` · ${c.overdue} em atraso` : ''}</span>
          </div>
        `).join('')}
      </div>
    ` : '<p class="text-sm" style="color:var(--gold);">Nenhuma cliente abaixo de 70% de conclusão.</p>'}
  `, 'mb-8');
}

function renderEngagementReport() {
  if (!filters.types.engagement) return '';
  const program = filters.program || undefined;
  const r = MockDB.getEngagementReport(filters.engagementDays, { program });
  return card(`
    <div class="flex items-center justify-between mb-4">
      <p class="text-sm text-white/50">Engajamento</p>
      <div class="flex items-center gap-3">
        <span class="text-xs text-white/30">${r.inactiveCount} inativa${r.inactiveCount === 1 ? '' : 's'} há mais de ${r.thresholdDays} dias</span>
        <button data-export="engagement" class="btn-text no-print">Exportar CSV</button>
      </div>
    </div>
    ${r.clients.length ? `
      <div class="divide-y" style="border-color:var(--line);">
        ${r.clients.map((c) => `
          <div class="flex items-center justify-between py-2.5">
            <span class="text-sm">${c.clientName}</span>
            <div class="flex items-center gap-3">
              <span class="text-xs" style="color:var(--muted);">${c.lastActivityAt ? `última atividade ${formatDate(c.lastActivityAt)}` : 'sem atividade registrada'}</span>
              ${c.inactive ? '<span class="badge badge-locked">Inativa</span>' : '<span class="badge badge-completed">Ativa</span>'}
            </div>
          </div>
        `).join('')}
      </div>
    ` : `<p class="text-sm" style="color:var(--muted);">Nenhuma cliente${program ? ' neste programa' : ''}.</p>`}
  `, 'mb-8');
}

function renderFinancialReport() {
  if (!filters.types.financial) return '';
  const program = filters.program || undefined;
  const summary = MockDB.getFinancialSummary({ program });
  const forecast = MockDB.getFinancialForecast(filters.forecastMonths, { program });
  const maxForecast = Math.max(1, ...forecast.map((b) => b.total));

  return card(`
    <div class="flex items-center justify-between mb-4">
      <p class="text-sm text-white/50">Financeiro — Resumo e Previsão</p>
      <button data-export="financial" class="btn-text no-print">Exportar CSV</button>
    </div>
    ${program ? '<p class="text-xs text-white/20 mb-4">Receita filtrada por programa. Despesas são sempre do negócio como um todo — não atribuíveis a um programa específico.</p>' : ''}
    <div class="grid sm:grid-cols-4 gap-4 text-sm mb-6">
      <div><p class="text-white/40 text-xs mb-1">Recebido</p><p class="text-lg">${brl(summary.totalPaid)}</p></div>
      <div><p class="text-white/40 text-xs mb-1">A Receber</p><p class="text-lg">${brl(summary.totalPending)}</p></div>
      <div><p class="text-white/40 text-xs mb-1">Em Atraso</p><p class="text-lg" style="color:var(--terracotta);">${brl(summary.totalOverdue)}</p></div>
      <div><p class="text-white/40 text-xs mb-1">Lucro Líquido</p><p class="text-lg" style="color:var(--gold);">${brl(summary.net)}</p></div>
    </div>
    <p class="text-xs text-white/20 mb-4">"A Receber" e "Em Atraso" são mostrados separadamente de propósito — parcelas em atraso não devem ser contadas como recebimento garantido.</p>
    <p class="text-xs uppercase mb-3" style="color:var(--muted); letter-spacing:.12em;">Previsão — Próximos ${filters.forecastMonths} Meses</p>
    <p class="text-xs text-white/20 mb-3">Estimativa com base nos pagamentos já agendados dos contratos ativos — não é uma projeção estatística.</p>
    <div class="space-y-3">
      ${forecast.map((b) => {
        const pct = Math.round((b.total / maxForecast) * 100);
        return `
          <div class="flex items-center gap-3">
            <span class="w-36 text-xs text-white/50 capitalize">${b.label}</span>
            <div class="progress-track flex-1"><div class="progress-fill" style="width:${pct}%;"></div></div>
            <span class="text-xs w-24 text-right" style="color:var(--muted);">${brl(b.total)}</span>
          </div>
        `;
      }).join('')}
    </div>
  `, 'mb-8');
}

function exportImpactCSV() {
  const m = MockDB.getSuccessMetrics();
  const rows = [
    { metric: 'Crescimento de receita (%)', value: m.revenueGrowth.growthPct ?? '' },
    { metric: 'Conversão de leads (%)', value: m.leadConversion.conversionRatePct },
    { metric: 'Upsells (contagem)', value: m.upsells.count },
    { metric: 'Múltiplo médio de preço', value: m.pricingImpact.avgMultiplier ? m.pricingImpact.avgMultiplier.toFixed(2) : '' },
    { metric: 'Ganho mensal estimado (precificação)', value: m.pricingImpact.totalMonthlyLift },
    ...m.revenueGrowth.months.map((b) => ({ metric: `Receita — ${b.label}`, value: b.total })),
  ];
  downloadCSV('impacto.csv', [['metric', 'Métrica'], ['value', 'Valor']], rows);
}
function exportAdherenceCSV() {
  const r = MockDB.getAdherenceReport({ program: filters.program || undefined });
  downloadCSV('adesao-tarefas.csv',
    [['clientName', 'Cliente'], ['total', 'Total Atribuído'], ['completed', 'Concluídas'], ['overdue', 'Em Atraso']],
    r.byClient);
}
function exportEngagementCSV() {
  const r = MockDB.getEngagementReport(filters.engagementDays, { program: filters.program || undefined });
  downloadCSV('engajamento.csv',
    [['clientName', 'Cliente'], ['lastActivityAt', 'Última Atividade'], ['daysSinceActivity', 'Dias Desde a Última Atividade'], ['inactive', 'Inativa']],
    r.clients.map((c) => ({ ...c, lastActivityAt: c.lastActivityAt ? formatDate(c.lastActivityAt) : '—', inactive: c.inactive ? 'Sim' : 'Não' })));
}
function exportFinancialCSV() {
  const program = filters.program || undefined;
  const summary = MockDB.getFinancialSummary({ program });
  const forecast = MockDB.getFinancialForecast(filters.forecastMonths, { program });
  const rows = [
    { metric: 'Recebido', value: summary.totalPaid },
    { metric: 'A Receber', value: summary.totalPending },
    { metric: 'Em Atraso', value: summary.totalOverdue },
    { metric: 'Despesas', value: summary.totalExpenses },
    { metric: 'Lucro Líquido', value: summary.net },
    ...forecast.map((b) => ({ metric: `Previsão — ${b.label}`, value: b.total })),
  ];
  downloadCSV('financeiro-resumo.csv', [['metric', 'Métrica'], ['value', 'Valor (R$)']], rows);
}

function render() {
  content.innerHTML = `
    ${renderFilters()}
    ${renderImpactReport()}
    ${renderAdherenceReport()}
    ${renderEngagementReport()}
    ${renderFinancialReport()}
  `;
  wireEvents();
}

function wireEvents() {
  content.querySelector('#filter-type-impact').addEventListener('change', (e) => { filters.types.impact = e.target.checked; render(); });
  content.querySelector('#filter-type-adherence').addEventListener('change', (e) => { filters.types.adherence = e.target.checked; render(); });
  content.querySelector('#filter-type-engagement').addEventListener('change', (e) => { filters.types.engagement = e.target.checked; render(); });
  content.querySelector('#filter-type-financial').addEventListener('change', (e) => { filters.types.financial = e.target.checked; render(); });
  content.querySelector('#filter-program').addEventListener('change', (e) => { filters.program = e.target.value; render(); });
  content.querySelector('#filter-engagement-days').addEventListener('change', (e) => { filters.engagementDays = Number(e.target.value); render(); });
  content.querySelector('#filter-forecast-months').addEventListener('change', (e) => { filters.forecastMonths = Number(e.target.value); render(); });
  content.querySelector('#print-report').addEventListener('click', () => window.print());

  content.querySelector('[data-export="impact"]')?.addEventListener('click', exportImpactCSV);
  content.querySelector('[data-export="adherence"]')?.addEventListener('click', exportAdherenceCSV);
  content.querySelector('[data-export="engagement"]')?.addEventListener('click', exportEngagementCSV);
  content.querySelector('[data-export="financial"]')?.addEventListener('click', exportFinancialCSV);
}

render();
