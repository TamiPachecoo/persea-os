// Financeiro — business-wide money view: what's coming in from client
// contracts (by program), what's going out as general business expenses,
// and net. Per-client payment detail/actions live on that client's own
// Financeiro tab (client-detail.html); this page is the overview.
import { MockDB, PROGRAMS, PROGRAM_LABEL, EXPENSE_CATEGORIES, EXPENSE_CATEGORY_LABEL, PAYMENT_STATUS_LABEL } from '../shared/mock-db.js';
import { renderShell, card, toast, formatDate, openModal } from '../shared/ui.js';

document.body.innerHTML = renderShell({ role: 'admin', active: 'financial.html', title: 'Financeiro' });
const content = document.getElementById('app-content');

const PAYMENT_STATUS_CLASS = { paid: 'badge-completed', pending: 'badge-progress', overdue: 'badge-locked' };
const paymentBadge = (status) => `<span class="badge ${PAYMENT_STATUS_CLASS[status] || 'badge-locked'}">${PAYMENT_STATUS_LABEL[status] || status}</span>`;
const brl = (n) => `R$ ${n.toLocaleString('pt-BR')}`;

function renderKPIs(summary) {
  return `
    <div class="grid md:grid-cols-3 gap-6 mb-6">
      ${card(`<p class="text-sm text-white/50 mb-2">Recebido</p><p class="text-2xl font-serif">${brl(summary.totalPaid)}</p>`)}
      ${card(`<p class="text-sm text-white/50 mb-2">A Receber</p><p class="text-2xl font-serif">${brl(summary.totalPending)}</p>`)}
      ${card(`<p class="text-sm text-white/50 mb-2">Em Atraso</p><p class="text-2xl font-serif" style="color:var(--terracotta);">${brl(summary.totalOverdue)}</p>`)}
    </div>
    <div class="grid md:grid-cols-2 gap-6 mb-8">
      ${card(`<p class="text-sm text-white/50 mb-2">Despesas</p><p class="text-2xl font-serif">${brl(summary.totalExpenses)}</p>`)}
      ${card(`<p class="text-sm text-white/50 mb-2">Lucro Líquido</p><p class="text-2xl font-serif" style="color:var(--gold);">${brl(summary.net)}</p><p class="text-xs text-white/30 mt-1">Recebido − Despesas</p>`)}
    </div>
  `;
}

function renderForecast() {
  const months = 6;
  const forecast = MockDB.getFinancialForecast(months);
  const maxForecast = Math.max(1, ...forecast.map((b) => b.total));
  return card(`
    <p class="text-sm text-white/50 mb-1">Previsão — Próximos ${months} Meses</p>
    <p class="text-xs text-white/20 mb-4">Com base nas parcelas já agendadas dos contratos ativos (ainda não pagas). Não é uma projeção estatística — veja Relatórios para o detalhamento por programa.</p>
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

function renderByProgram(summary) {
  const total = PROGRAMS.reduce((s, p) => s + (summary.byProgram[p] || 0), 0);
  return card(`
    <p class="text-sm text-white/50 mb-4">Receita por Programa</p>
    <div class="space-y-3">
      ${PROGRAMS.map((p) => {
        const amount = summary.byProgram[p] || 0;
        const pct = total ? Math.round((amount / total) * 100) : 0;
        return `
          <div class="flex items-center gap-3">
            <span class="w-40 text-xs text-white/50">${PROGRAM_LABEL[p]}</span>
            <div class="progress-track flex-1"><div class="progress-fill" style="width:${pct}%;"></div></div>
            <span class="text-xs w-24 text-right" style="color:var(--muted);">${brl(amount)}</span>
          </div>
        `;
      }).join('')}
    </div>
  `, 'mb-8');
}

function renderClientBilling() {
  const clients = MockDB.listClients();
  const rows = clients.map((c) => {
    const next = MockDB.getPayments(c.id).filter((p) => p.status !== 'paid').sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))[0];
    return { c, next };
  });
  return card(`
    <p class="text-sm text-white/50 mb-4">Cobrança por Cliente</p>
    <div class="divide-y" style="border-color:var(--line);">
      ${rows.map(({ c, next }) => `
        <a href="client-detail.html?id=${c.id}" class="flex items-center justify-between py-3 hover:bg-white/5 -mx-2 px-2 rounded-lg transition-colors">
          <div>
            <p class="font-medium">${c.fullName}</p>
            <p class="text-xs text-white/30">${c.program ? PROGRAM_LABEL[c.program] : 'Sem programa definido'}</p>
          </div>
          <div class="flex items-center gap-3">
            ${next ? `<span class="text-xs text-white/40">Vence ${formatDate(next.dueDate)} · ${brl(next.amount)}</span>${paymentBadge(next.status)}` : '<span class="text-xs" style="color:var(--muted);">Em dia</span>'}
          </div>
        </a>
      `).join('')}
    </div>
  `, 'mb-8');
}

function renderExpenses() {
  const expenses = MockDB.getExpenses().slice().sort((a, b) => new Date(b.date) - new Date(a.date));
  return card(`
    <div class="flex items-center justify-between mb-4">
      <p class="text-sm text-white/50">Despesas</p>
      <button id="new-expense" class="btn-ghost">+ Nova Despesa</button>
    </div>
    <div class="divide-y" style="border-color:var(--line);">
      ${expenses.length ? expenses.map((e) => `
        <div class="flex items-center justify-between py-3">
          <div>
            <p class="text-sm">${e.description}</p>
            <p class="text-xs text-white/30 mt-0.5">${EXPENSE_CATEGORY_LABEL[e.category] || e.category} · ${formatDate(e.date)}</p>
          </div>
          <div class="flex items-center gap-3">
            <span class="text-sm">${brl(e.amount)}</span>
            <button data-delete-expense="${e.id}" class="btn-text">Remover</button>
          </div>
        </div>
      `).join('') : '<p class="text-sm" style="color:var(--muted);">Nenhuma despesa registrada.</p>'}
    </div>
  `);
}

function openExpenseModal() {
  const { el, close } = openModal({
    title: 'Nova Despesa',
    bodyHtml: `
      <form id="expense-form" class="space-y-4">
        <div>
          <label class="text-xs text-white/40 block mb-1">Descrição</label>
          <input name="description" class="field" required />
        </div>
        <div class="grid sm:grid-cols-2 gap-4">
          <div>
            <label class="text-xs text-white/40 block mb-1">Categoria</label>
            <select name="category" class="field">
              ${EXPENSE_CATEGORIES.map((cat) => `<option value="${cat}">${EXPENSE_CATEGORY_LABEL[cat]}</option>`).join('')}
            </select>
          </div>
          <div>
            <label class="text-xs text-white/40 block mb-1">Valor (R$)</label>
            <input name="amount" type="number" min="0" step="0.01" class="field" required />
          </div>
        </div>
        <div>
          <label class="text-xs text-white/40 block mb-1">Data</label>
          <input name="date" type="date" class="field" value="${new Date().toISOString().slice(0, 10)}" required />
        </div>
        <div class="flex justify-end pt-2">
          <button type="submit" class="btn-primary" style="padding:9px 18px;font-size:12.5px;">Adicionar</button>
        </div>
      </form>
    `,
  });
  el.querySelector('#expense-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    MockDB.addExpense({ description: fd.get('description'), category: fd.get('category'), amount: Number(fd.get('amount')), date: fd.get('date') });
    close();
    toast('Despesa adicionada.');
    render();
  });
}

function render() {
  const summary = MockDB.getFinancialSummary();
  content.innerHTML = `
    ${renderKPIs(summary)}
    ${renderForecast()}
    ${renderByProgram(summary)}
    ${renderClientBilling()}
    ${renderExpenses()}
  `;
  content.querySelector('#new-expense')?.addEventListener('click', openExpenseModal);
  content.querySelectorAll('[data-delete-expense]').forEach((btn) => {
    btn.addEventListener('click', () => {
      MockDB.deleteExpense(btn.dataset.deleteExpense);
      toast('Despesa removida.');
      render();
    });
  });
}

render();
