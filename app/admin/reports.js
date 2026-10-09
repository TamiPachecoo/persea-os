// Relatórios — the "help me make a decision" view: is adherence to
// assigned tasks actually happening, who has gone quiet, and what does the
// money look like now and over the next few months. Everything here is
// computed from data already recorded elsewhere (assignments, activity
// logs, payments) — no separate report data to seed/maintain.
//
// Filterable (which reports to show, by program, engagement window,
// forecast horizon) and exportable (CSV per report, print/PDF for the
// whole page) — Nay asked to be able to narrow down and take reports with her.
import { MockDB, PROGRAMS, PROGRAM_LABEL, PROGRAM_LABEL_BY_SLUG } from '../shared/mock-db.js';
import { renderShell, card, formatDate, downloadCSV, brl } from '../shared/ui.js';
import { requireProfile } from '../shared/supabase-auth.js';
import { supabase } from '../shared/supabase-client.js';
import { isProductionEnvironment, toast } from '../shared/ui.js';
import { loadActiveObligations } from '../shared/financial-model.js';

if (!(await requireProfile('admin'))) throw new Error('not authorized');
document.body.innerHTML = renderShell({ role: 'admin', active: 'reports.html', title: 'Relatórios' });
const content = document.getElementById('app-content');

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

// ===== Real financial report (production) ===============================
// Everything below reads real Supabase data, never MockDB: receipts are
// payments with status 'paid' from SumUp or confirmed by hand ('manual'),
// demo clients excluded; installments come from loadActiveObligations (the
// same source Financeiro and each client's page use). The MockDB reports
// above (impact, adherence, engagement and the demo financial summary)
// are not rendered in production — they would show sample numbers.
const METHOD_LABEL = { pix: 'PIX', cartao_credito: 'Cartão de crédito', transferencia: 'Transferência', boleto: 'Boleto' };
const methodLabel = (m) => METHOD_LABEL[m] || (m ? m : 'Não informado');
// Local (Brazil) calendar day, never UTC: a payment at 22h on the 31st
// belongs to the 31st, and a 'YYYY-MM-DD' due date is not shifted a day back.
const pad2 = (n) => String(n).padStart(2, '0');
const isoDay = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const paidDay = (p) => isoDay(new Date(p.paid_at));
const fmtDay = (v) => formatDate(typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? `${v}T12:00:00` : v);
const realFilters = { period: 'this_month', from: '', to: '', program: '' };

function periodRange() {
  const now = new Date();
  const y = now.getFullYear(), m = now.getMonth();
  switch (realFilters.period) {
    case 'last_month': return [new Date(y, m - 1, 1), new Date(y, m, 0)];
    case 'this_quarter': { const q = Math.floor(m / 3) * 3; return [new Date(y, q, 1), new Date(y, q + 3, 0)]; }
    case 'this_year': return [new Date(y, 0, 1), new Date(y, 11, 31)];
    case 'last_12': return [new Date(y, m - 11, 1), new Date(y, m + 1, 0)];
    case 'custom': return [realFilters.from ? new Date(`${realFilters.from}T00:00:00`) : new Date(y, 0, 1), realFilters.to ? new Date(`${realFilters.to}T00:00:00`) : now];
    default: return [new Date(y, m, 1), new Date(y, m + 1, 0)];
  }
}

async function loadRealFinancial() {
  const [{ data: payments, error }, obligations, { data: clients }] = await Promise.all([
    supabase.from('payments').select('id, amount_cents, status, provider, paid_at, method, description, client_id').eq('status', 'paid').in('provider', ['sumup', 'manual']),
    loadActiveObligations({ excludeDemo: true }),
    supabase.from('clients').select('id, full_name, program_slug, is_demo'),
  ]);
  if (error) return { error: error.message };
  if (obligations.error) return { error: obligations.error };
  const clientById = new Map((clients || []).map((c) => [c.id, c]));
  // Payments made through a SumUp link may not carry a method yet: take it
  // from the installment they paid.
  const missing = (payments || []).filter((p) => !p.method).map((p) => p.id);
  const methodByPayment = {};
  if (missing.length) {
    const { data: allocs } = await supabase.from('payment_allocations').select('payment_id, contract_payment_lines(method)').in('payment_id', missing);
    (allocs || []).forEach((a) => { if (a.contract_payment_lines?.method) methodByPayment[a.payment_id] = a.contract_payment_lines.method; });
  }
  const receipts = (payments || [])
    .map((p) => ({ ...p, method: p.method || methodByPayment[p.id] || null, client: clientById.get(p.client_id) }))
    .filter((p) => p.client && !p.client.is_demo && p.paid_at);
  const lines = (obligations.lines || []).map((l) => ({ ...l, client: clientById.get(l.contracts?.client_id) })).filter((l) => l.client);
  return { receipts, lines };
}

function sumBy(list, keyFn, valFn) {
  const out = new Map();
  list.forEach((x) => { const k = keyFn(x); out.set(k, (out.get(k) || 0) + valFn(x)); });
  return out;
}
const brlC = (c) => brl(c / 100);
const centsBR = (c) => (c / 100).toFixed(2).replace('.', ',');

// Excel in Portuguese expects ';' between columns and ',' for decimals.
function downloadCsvBR(filename, headers, rows) {
  const esc = (v) => { const t = String(v ?? ''); return /[";\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; };
  const text = [headers.map(([, l]) => esc(l)).join(';'), ...rows.map((r) => headers.map(([k]) => esc(r[k])).join(';'))].join('\r\n');
  const url = URL.createObjectURL(new Blob(['\uFEFF' + text], { type: 'text/csv;charset=utf-8;' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}

let realData = null;
function realView() {
  const [from, to] = periodRange();
  const fromS = isoDay(from), toS = isoDay(to);
  const inProgram = (c) => !realFilters.program || c?.program_slug === realFilters.program;
  const receipts = realData.receipts.filter((p) => inProgram(p.client) && paidDay(p) >= fromS && paidDay(p) <= toS)
    .sort((a, b) => b.paid_at.localeCompare(a.paid_at));
  const lines = realData.lines.filter((l) => inProgram(l.client));
  const today = isoDay(new Date());
  const open = lines.filter((l) => l.outstanding_cents > 0);
  const dueInPeriod = open.filter((l) => l.due_date >= fromS && l.due_date <= toS).sort((a, b) => a.due_date.localeCompare(b.due_date));
  const overdue = open.filter((l) => l.due_date < today);
  return { from, to, receipts, lines, open, dueInPeriod, overdue };
}

function renderRealFinancial() {
  if (realData?.error) return card(`<p class="text-sm" style="color:var(--terracotta);">Não foi possível carregar os dados financeiros: ${realData.error}</p>`, 'mb-8');
  const v = realView();
  const received = v.receipts.reduce((s, p) => s + p.amount_cents, 0);
  const dueSum = v.dueInPeriod.reduce((s, l) => s + l.outstanding_cents, 0);
  const overdueSum = v.overdue.reduce((s, l) => s + l.outstanding_cents, 0);
  const openSum = v.open.reduce((s, l) => s + l.outstanding_cents, 0);
  const byMonth = sumBy(v.receipts, (p) => paidDay(p).slice(0, 7), (p) => p.amount_cents);
  const months = [...byMonth.entries()].sort(([a], [b]) => a.localeCompare(b));
  const maxMonth = Math.max(1, ...months.map(([, c]) => c));
  const byMethod = [...sumBy(v.receipts, (p) => methodLabel(p.method), (p) => p.amount_cents).entries()].sort((a, b) => b[1] - a[1]);
  const clientIds = new Set([...v.receipts.map((p) => p.client.id), ...v.open.map((l) => l.client.id)]);
  const byClient = [...clientIds].map((id) => {
    const name = (v.receipts.find((p) => p.client.id === id) || v.open.find((l) => l.client.id === id)).client.full_name;
    return {
      id, name,
      received: v.receipts.filter((p) => p.client.id === id).reduce((s, p) => s + p.amount_cents, 0),
      open: v.open.filter((l) => l.client.id === id).reduce((s, l) => s + l.outstanding_cents, 0),
      overdue: v.overdue.filter((l) => l.client.id === id).reduce((s, l) => s + l.outstanding_cents, 0),
    };
  }).sort((a, b) => b.received - a.received || b.open - a.open);
  const monthLabel = (ym) => new Date(`${ym}-01T12:00:00`).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  const kpi = (label, value, color = '') => `<div><p class="text-white/40 text-xs mb-1">${label}</p><p class="text-2xl font-serif" style="${color}">${value}</p></div>`;

  return `
    ${card(`
      <div class="flex items-center justify-between mb-1 flex-wrap gap-2">
        <p class="text-sm text-white/50">Financeiro · ${fmtDay(v.from)} a ${fmtDay(v.to)}${realFilters.program ? ` · ${PROGRAM_LABEL_BY_SLUG[realFilters.program] || realFilters.program}` : ''}</p>
      </div>
      <p class="text-xs text-white/20 mb-5">Recebido = pagamentos confirmados (SumUp ou marcados como recebidos), pela data em que foram recebidos. Clientes de demonstração não entram.</p>
      <div class="grid sm:grid-cols-4 gap-4">
        ${kpi('Recebido no período', brlC(received), 'color:var(--gold);')}
        ${kpi('Em aberto no período', brlC(dueSum))}
        ${kpi('Em atraso (hoje)', brlC(overdueSum), overdueSum ? 'color:var(--terracotta);' : '')}
        ${kpi('Saldo total a receber', brlC(openSum))}
      </div>
    `, 'mb-6')}
    <div class="grid md:grid-cols-2 gap-6 mb-6">
      ${card(`
        <p class="text-sm text-white/50 mb-4">Recebido por mês</p>
        ${months.length ? `<div class="space-y-3">${months.map(([ym, c]) => `
          <div class="flex items-center gap-3">
            <span class="w-32 text-xs text-white/50 capitalize">${monthLabel(ym)}</span>
            <div class="progress-track flex-1"><div class="progress-fill" style="width:${Math.round((c / maxMonth) * 100)}%;"></div></div>
            <span class="text-xs w-24 text-right">${brlC(c)}</span>
          </div>`).join('')}</div>` : '<p class="text-sm" style="color:var(--muted);">Nenhum recebimento no período.</p>'}
      `)}
      ${card(`
        <p class="text-sm text-white/50 mb-4">Recebido por forma de pagamento</p>
        ${byMethod.length ? `<div class="divide-y" style="border-color:var(--line);">${byMethod.map(([m, c]) => `
          <div class="flex items-center justify-between py-2 text-sm"><span>${m}</span><span>${brlC(c)} <span class="text-white/30 text-xs">· ${Math.round((c / Math.max(1, received)) * 100)}%</span></span></div>`).join('')}</div>`
          : '<p class="text-sm" style="color:var(--muted);">Nenhum recebimento no período.</p>'}
      `)}
    </div>
    ${card(`
      <div class="flex items-center justify-between mb-4 flex-wrap gap-2">
        <p class="text-sm text-white/50">Por cliente</p>
        <button data-real-export="clients" class="btn-text no-print">Exportar planilha</button>
      </div>
      ${byClient.length ? `
      <div class="overflow-x-auto"><table class="w-full text-sm">
        <thead><tr class="text-xs text-white/40 text-left"><th class="py-2 pr-3 font-normal">Cliente</th><th class="py-2 pr-3 font-normal text-right">Recebido no período</th><th class="py-2 pr-3 font-normal text-right">Saldo a receber</th><th class="py-2 font-normal text-right">Em atraso</th></tr></thead>
        <tbody>${byClient.map((c) => `
          <tr style="border-top:1px solid var(--line);"><td class="py-2 pr-3"><a href="client-onboarding.html?id=${c.id}" class="hover:underline">${c.name}</a></td>
          <td class="py-2 pr-3 text-right">${brlC(c.received)}</td><td class="py-2 pr-3 text-right">${brlC(c.open)}</td>
          <td class="py-2 text-right" style="${c.overdue ? 'color:var(--terracotta);' : ''}">${brlC(c.overdue)}</td></tr>`).join('')}</tbody>
      </table></div>` : '<p class="text-sm" style="color:var(--muted);">Nenhum dado no período.</p>'}
    `, 'mb-6')}
    ${card(`
      <div class="flex items-center justify-between mb-4 flex-wrap gap-2">
        <p class="text-sm text-white/50">Recebimentos no período (${v.receipts.length})</p>
        <button data-real-export="receipts" class="btn-text no-print">Exportar planilha</button>
      </div>
      ${v.receipts.length ? `<div class="divide-y" style="border-color:var(--line);">${v.receipts.map((p) => `
        <div class="flex items-center justify-between py-2 gap-3 flex-wrap text-sm">
          <div><p>${p.client.full_name}</p><p class="text-xs text-white/30">${formatDate(p.paid_at)} · ${methodLabel(p.method)}${p.description ? ` · ${p.description}` : ''}</p></div>
          <span>${brlC(p.amount_cents)}</span>
        </div>`).join('')}</div>` : '<p class="text-sm" style="color:var(--muted);">Nenhum recebimento no período.</p>'}
    `, 'mb-6')}
    ${card(`
      <div class="flex items-center justify-between mb-4 flex-wrap gap-2">
        <p class="text-sm text-white/50">Parcelas a vencer no período e em atraso</p>
        <button data-real-export="installments" class="btn-text no-print">Exportar planilha</button>
      </div>
      ${[...v.overdue.filter((l) => !v.dueInPeriod.includes(l)), ...v.dueInPeriod].length ? `<div class="divide-y" style="border-color:var(--line);">${[...v.overdue.filter((l) => !v.dueInPeriod.includes(l)), ...v.dueInPeriod].map((l) => `
        <div class="flex items-center justify-between py-2 gap-3 flex-wrap text-sm">
          <div><p>${l.client.full_name}</p><p class="text-xs text-white/30">Vence ${fmtDay(l.due_date)} · ${methodLabel(l.method)}${l.label ? ` · ${l.label}` : ''}</p></div>
          <div class="flex items-center gap-3"><span>${brlC(l.outstanding_cents)}</span>${l.due_date < isoDay(new Date()) ? '<span class="badge badge-locked">Em atraso</span>' : ''}</div>
        </div>`).join('')}</div>` : '<p class="text-sm" style="color:var(--muted);">Nenhuma parcela em aberto neste período.</p>'}
    `, 'mb-8')}
  `;
}

function exportReal(kind) {
  const v = realView();
  const range = `${isoDay(v.from)}_a_${isoDay(v.to)}`;
  if (kind === 'receipts') {
    downloadCsvBR(`recebimentos_${range}.csv`, [['date', 'Data'], ['client', 'Cliente'], ['method', 'Forma de pagamento'], ['description', 'Descrição'], ['amount', 'Valor (R$)']],
      v.receipts.map((p) => ({ date: formatDate(p.paid_at), client: p.client.full_name, method: methodLabel(p.method), description: p.description || '', amount: centsBR(p.amount_cents) })));
  } else if (kind === 'installments') {
    const rows = [...v.overdue.filter((l) => !v.dueInPeriod.includes(l)), ...v.dueInPeriod];
    downloadCsvBR(`parcelas_${range}.csv`, [['due', 'Vencimento'], ['client', 'Cliente'], ['method', 'Forma de pagamento'], ['label', 'Descrição'], ['amount', 'Valor em aberto (R$)'], ['status', 'Situação']],
      rows.map((l) => ({ due: fmtDay(l.due_date), client: l.client.full_name, method: methodLabel(l.method), label: l.label || '', amount: centsBR(l.outstanding_cents), status: l.due_date < isoDay(new Date()) ? 'Em atraso' : 'A vencer' })));
  } else {
    const ids = new Set([...v.receipts.map((p) => p.client.id), ...v.open.map((l) => l.client.id)]);
    downloadCsvBR(`clientes_${range}.csv`, [['client', 'Cliente'], ['received', 'Recebido no período (R$)'], ['open', 'Saldo a receber (R$)'], ['overdue', 'Em atraso (R$)']],
      [...ids].map((id) => {
        const name = (v.receipts.find((p) => p.client.id === id) || v.open.find((l) => l.client.id === id)).client.full_name;
        return {
          client: name,
          received: centsBR(v.receipts.filter((p) => p.client.id === id).reduce((s, p) => s + p.amount_cents, 0)),
          open: centsBR(v.open.filter((l) => l.client.id === id).reduce((s, l) => s + l.outstanding_cents, 0)),
          overdue: centsBR(v.overdue.filter((l) => l.client.id === id).reduce((s, l) => s + l.outstanding_cents, 0)),
        };
      }));
  }
  toast('Planilha baixada.');
}

function renderRealFilters() {
  const opt = (v, l) => `<option value="${v}" ${realFilters.period === v ? 'selected' : ''}>${l}</option>`;
  return card(`
    <div class="flex flex-wrap items-end gap-x-6 gap-y-4">
      <div>
        <p class="text-xs text-white/40 mb-1">Período</p>
        <select id="real-period" class="field text-sm">
          ${opt('this_month', 'Este mês')}${opt('last_month', 'Mês passado')}${opt('this_quarter', 'Este trimestre')}${opt('this_year', 'Este ano')}${opt('last_12', 'Últimos 12 meses')}${opt('custom', 'Personalizado')}
        </select>
      </div>
      ${realFilters.period === 'custom' ? `
        <div><p class="text-xs text-white/40 mb-1">De</p><input type="date" id="real-from" class="field text-sm" value="${realFilters.from}"></div>
        <div><p class="text-xs text-white/40 mb-1">Até</p><input type="date" id="real-to" class="field text-sm" value="${realFilters.to}"></div>` : ''}
      <div>
        <p class="text-xs text-white/40 mb-1">Programa</p>
        <select id="real-program" class="field text-sm">
          <option value="">Todos os programas</option>
          ${Object.entries(PROGRAM_LABEL_BY_SLUG).map(([slug, name]) => `<option value="${slug}" ${realFilters.program === slug ? 'selected' : ''}>${name}</option>`).join('')}
        </select>
      </div>
      <button id="print-report" class="btn-ghost">Imprimir / Exportar PDF</button>
    </div>
  `, 'mb-8 no-print');
}

// ── Site: visits and clicks on naymurta.com and the event site ──────────
// Counted by our own tracker (site-track Edge Function → site_events);
// site_stats() returns the period's aggregates in one call. Single gold
// hue throughout: every chart here is one series (or a ranked list), and
// the numbers are always written next to the bars.
const SITE_LABEL = { naymurta: 'naymurta.com', experience: 'Site do evento' };
const DEVICE_LABEL = { mobile: 'Celular', desktop: 'Computador', tablet: 'Tablet' };
// 'instagram' / 'facebook' / 'linkedin' are also set by site-track when the
// visit opens inside those apps, so the bio link can stay plain naymurta.com.
const SOURCE_LABEL = { direto: 'Direto (link, WhatsApp, digitado)', instagram: 'Instagram', facebook: 'Facebook', linkedin: 'LinkedIn', 'google.com': 'Google' };
const PAGE_LABEL = { '/': 'Página inicial', '/index.html': 'Página inicial', '/resultados/': 'Formulário de resultados', '/aplicacao/': 'Aplicação da mentoria', '/preparacao.html': 'Formulário de preparação' };
const siteFilters = { days: 30 };
let siteData = null;

async function loadSiteStats() {
  const to = new Date(); to.setDate(to.getDate() + 1); to.setHours(0, 0, 0, 0);
  const from = new Date(to); from.setDate(from.getDate() - siteFilters.days);
  const { data, error } = await supabase.rpc('site_stats', { p_from: from.toISOString(), p_to: to.toISOString() });
  return error ? { error: error.message } : { ...data, from, to };
}

const escH = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
// Ranked list: label, thin bar scaled to the largest value, the number.
function barList(rows, emptyText) {
  if (!rows.length) return `<p class="text-sm" style="color:var(--muted);">${emptyText}</p>`;
  const max = Math.max(...rows.map((r) => r.n), 1);
  return `<div class="space-y-2">${rows.map((r) => `
    <div title="${escH(r.label)}: ${r.n}">
      <div class="flex items-baseline justify-between gap-3 text-sm"><span class="truncate">${escH(r.label)}${r.sub ? ` <span class="text-xs text-white/30">${escH(r.sub)}</span>` : ''}</span><span class="text-white/60 shrink-0">${r.n}</span></div>
      <div style="height:4px;border-radius:4px;background:var(--line);margin-top:4px;"><div style="height:4px;border-radius:4px;background:var(--gold);width:${Math.max(2, Math.round((r.n / max) * 100))}%;"></div></div>
    </div>`).join('')}</div>`;
}

// Visits per day, both sites together; hover a bar for the day's numbers.
function dailyChart(d) {
  const byDay = new Map();
  (d.by_day || []).forEach((r) => { const x = byDay.get(r.day) || { visits: 0, clicks: 0 }; x.visits += r.visits; x.clicks += r.clicks; byDay.set(r.day, x); });
  const days = [];
  for (let t = new Date(d.from); t < d.to; t.setDate(t.getDate() + 1)) days.push(isoDay(t));
  const max = Math.max(...days.map((k) => byDay.get(k)?.visits || 0), 1);
  return `
    <div class="flex items-end" style="gap:2px;height:120px;border-bottom:1px solid var(--line);">
      ${days.map((k) => { const v = byDay.get(k) || { visits: 0, clicks: 0 }; return `
        <div title="${fmtDay(k)}: ${v.visits} ${v.visits === 1 ? 'visita' : 'visitas'} · ${v.clicks} ${v.clicks === 1 ? 'clique' : 'cliques'}" style="flex:1;height:100%;display:flex;align-items:flex-end;cursor:default;">
          <div style="width:100%;height:${v.visits ? Math.max(3, Math.round((v.visits / max) * 100)) : 0}%;background:var(--gold);border-radius:4px 4px 0 0;opacity:.85;"></div>
        </div>`; }).join('')}
    </div>
    <div class="flex justify-between text-xs text-white/30 mt-1"><span>${fmtDay(days[0])}</span><span>${fmtDay(days[days.length - 1])}</span></div>`;
}

function renderSite() {
  const head = `
    <div class="flex items-center justify-between gap-3 flex-wrap mb-4 mt-12">
      <div><p class="text-white/40 text-sm mb-1">Relatórios</p><h2 class="text-2xl font-serif">Site: visitas e cliques</h2></div>
      <select id="site-days" class="field text-sm" style="width:auto;">
        ${[[7, 'Últimos 7 dias'], [30, 'Últimos 30 dias'], [90, 'Últimos 90 dias'], [365, 'Último ano']].map(([v, l]) => `<option value="${v}" ${siteFilters.days === v ? 'selected' : ''}>${l}</option>`).join('')}
      </select>
    </div>`;
  if (!siteData) return head + card('<p class="text-sm" style="color:var(--muted);">Carregando…</p>');
  if (siteData.error) return head + card(`<p class="text-sm" style="color:var(--terracotta);">Não foi possível carregar: ${escH(siteData.error)}</p>`);
  const tot = (site) => (siteData.totals || []).find((t) => t.site === site) || { visits: 0, views: 0, clicks: 0 };
  const tile = (site) => { const t = tot(site); return card(`
    <p class="text-xs text-white/30 mb-1">${SITE_LABEL[site]}</p>
    <p class="text-2xl font-serif" style="color:var(--gold);">${t.visits} <span class="text-sm text-white/40">${t.visits === 1 ? 'visita' : 'visitas'}</span></p>
    <p class="text-xs text-white/30">${t.views} páginas vistas · ${t.clicks} cliques</p>`); };
  const clicks = (siteData.clicks || []).map((c) => ({ label: c.label, sub: SITE_LABEL[c.site], n: c.n }));
  const devices = (siteData.devices || []).map((r) => ({ label: DEVICE_LABEL[r.device] || r.device, n: r.visits })).sort((a, b) => b.n - a.n);
  const sources = (siteData.sources || []).map((r) => ({ label: SOURCE_LABEL[r.source] || r.source, n: r.n }));
  const pages = (siteData.pages || []).map((r) => ({ label: PAGE_LABEL[r.path] || r.path, sub: SITE_LABEL[r.site], n: r.n }));
  return head + `
    <div class="grid sm:grid-cols-2 gap-4 mb-4">${tile('naymurta')}${tile('experience')}</div>
    ${card(`<p class="text-sm text-white/50 mb-4">Visitas por dia <span class="text-xs text-white/30">(os dois sites; passe o mouse numa barra para ver o dia)</span></p>${dailyChart(siteData)}`, 'mb-4')}
    ${card(`<p class="text-sm text-white/50 mb-4">Onde clicaram</p>${barList(clicks, 'Nenhum clique ainda neste período.')}`, 'mb-4')}
    <div class="grid md:grid-cols-3 gap-4">
      ${card(`<p class="text-sm text-white/50 mb-4">De onde vieram</p>${barList(sources, 'Nenhuma visita ainda.')}`)}
      ${card(`<p class="text-sm text-white/50 mb-4">Aparelho</p>${barList(devices, 'Nenhuma visita ainda.')}`)}
      ${card(`<p class="text-sm text-white/50 mb-4">Páginas mais vistas</p>${barList(pages, 'Nenhuma visita ainda.')}`)}
    </div>
    <p class="text-xs text-white/20 mt-4">Contagem própria, sem cookies e sem dados pessoais. Uma visita é uma pessoa navegando numa aba do navegador; começou a contar em 9 de outubro de 2026.</p>`;
}

function renderReal() {
  content.innerHTML = `
    <div class="mb-8"><p class="text-white/40 text-sm mb-1">Relatórios</p><h1 class="text-3xl font-serif">Relatório Financeiro</h1></div>
    ${renderRealFilters()}
    ${renderRealFinancial()}
    <p class="text-xs text-white/20 no-print">Os relatórios de impacto, adesão e engajamento ainda não estão ligados aos dados reais e ficam ocultos aqui para não mostrar números de demonstração.</p>
    <div id="site-report">${renderSite()}</div>
  `;
  wireSite();
  content.querySelector('#real-period').addEventListener('change', (e) => {
    realFilters.period = e.target.value;
    if (realFilters.period === 'custom' && !realFilters.from) { const [f, t] = [new Date(new Date().getFullYear(), 0, 1), new Date()]; realFilters.from = isoDay(f); realFilters.to = isoDay(t); }
    renderReal();
  });
  content.querySelector('#real-from')?.addEventListener('change', (e) => { realFilters.from = e.target.value; renderReal(); });
  content.querySelector('#real-to')?.addEventListener('change', (e) => { realFilters.to = e.target.value; renderReal(); });
  content.querySelector('#real-program').addEventListener('change', (e) => { realFilters.program = e.target.value; renderReal(); });
  content.querySelector('#print-report').addEventListener('click', () => window.print());
  content.querySelectorAll('[data-real-export]').forEach((b) => b.addEventListener('click', () => exportReal(b.dataset.realExport)));
}

function wireSite() {
  content.querySelector('#site-days')?.addEventListener('change', async (e) => {
    siteFilters.days = Number(e.target.value);
    siteData = null; refreshSite();
    siteData = await loadSiteStats(); refreshSite();
  });
}
function refreshSite() {
  const el = content.querySelector('#site-report');
  if (el) { el.innerHTML = renderSite(); wireSite(); }
}

if (isProductionEnvironment()) {
  content.innerHTML = card('<p class="text-sm" style="color:var(--muted);">Carregando…</p>');
  realData = await loadRealFinancial();
  renderReal();
  siteData = await loadSiteStats();
  refreshSite();
} else {
  render();
}
