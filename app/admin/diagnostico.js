// Diagnóstico de Percepção de Valor — admin view of every real submission
// from the public tool (app.naymurta.com/diagnostico.html). Read-only:
// scoring already happened server-side in diagnostico-submit at
// submission time, this page only displays and exports what's stored.
import { supabase } from '../shared/supabase-client.js';
import { requireProfile } from '../shared/supabase-auth.js';
import { renderShell, card, formatDateTime, downloadCSV } from '../shared/ui.js';

if (!(await requireProfile('admin'))) throw new Error('not authorized');
document.body.innerHTML = renderShell({ role: 'admin', active: 'diagnostico.html', title: 'Diagnóstico' });
const content = document.getElementById('app-content');

const REVENUE_LABEL = {
  A: 'Até R$ 10 mil', B: 'R$ 10 mil – 30 mil', C: 'R$ 30 mil – 50 mil',
  D: 'R$ 50 mil – 100 mil', E: 'Acima de R$ 100 mil',
};
const STATE_LABEL = { ESFORCO: 'Esforço', DISPERSAO: 'Dispersão', SUSTENTACAO: 'Sustentação', ALVO: 'Alvo' };
const STATE_ORDER = ['ESFORCO', 'DISPERSAO', 'SUSTENTACAO', 'ALVO'];

let rows = [];
let search = '';
let expandedId = null;

async function loadRows() {
  const { data } = await supabase.from('value_perception_diagnostics').select('*').order('created_at', { ascending: false });
  return data || [];
}

function indexBar(label, value) {
  return `
    <div class="mb-2">
      <div class="flex justify-between text-xs mb-1"><span class="text-white/50">${label}</span><span class="text-white/30">${Math.round(value)}/100</span></div>
      <div style="height:4px;background:var(--line);border-radius:99px;overflow:hidden;">
        <div style="height:100%;width:${Math.max(0, Math.min(100, value))}%;background:var(--terracotta);border-radius:99px;"></div>
      </div>
    </div>
  `;
}

function diagnosticRow(r) {
  const isOpen = expandedId === r.id;
  const igHref = r.instagram ? `https://instagram.com/${r.instagram.replace(/^@/, '')}` : null;
  const waHref = r.whatsapp ? `https://wa.me/55${r.whatsapp.replace(/\D/g, '')}` : null;
  return `
    <div class="py-3" style="border-bottom:1px solid var(--line);">
      <button type="button" data-toggle="${r.id}" class="flex items-center justify-between w-full text-left">
        <div class="min-w-0">
          <div class="flex items-center gap-2 flex-wrap">
            <p class="font-medium">${r.full_name}</p>
            ${r.requested_meeting ? '<span class="badge badge-completed">Pediu reunião</span>' : ''}
          </div>
          <p class="text-xs text-white/30">${r.whatsapp}</p>
          <p class="text-xs text-white/30">${r.market} · ${REVENUE_LABEL[r.revenue_band] || r.revenue_band} · ${formatDateTime(r.created_at)}</p>
        </div>
        <div class="flex items-center gap-3 shrink-0">
          <span class="badge badge-progress">${STATE_LABEL[r.classification] || r.classification}</span>
        </div>
      </button>
      ${isOpen ? `
        <div class="mt-4 pl-1">
          ${indexBar('Clareza', r.score_clareza)}
          ${indexBar('Percepção', r.score_percepcao)}
          <div class="flex flex-wrap gap-3 mt-3">
            ${waHref ? `<a href="${waHref}" target="_blank" rel="noopener" class="btn-primary" style="padding:6px 12px;font-size:11px;">WhatsApp</a>` : ''}
            ${igHref ? `<a href="${igHref}" target="_blank" rel="noopener" class="btn-ghost" style="padding:6px 12px;font-size:11px;">Instagram</a>` : ''}
          </div>
          ${r.requested_meeting ? `
            <div class="mt-4" style="border-top:1px solid var(--line); padding-top:14px;">
              <p class="text-xs uppercase mb-2" style="color:var(--gold); letter-spacing:.08em;">Pedido de reunião</p>
              <p class="text-xs text-white/30 mb-1">O que gostaria de mudar na percepção do mercado:</p>
              <p class="text-sm mb-3">${r.meeting_answer_1 || '—'}</p>
              <p class="text-xs text-white/30 mb-1">Principal desafio para sustentar o posicionamento:</p>
              <p class="text-sm">${r.meeting_answer_2 || '—'}</p>
              <p class="text-xs text-white/20 mt-2">Solicitado em ${formatDateTime(r.meeting_requested_at)}</p>
            </div>
          ` : ''}
        </div>
      ` : ''}
    </div>
  `;
}

function exportCsv() {
  downloadCSV('diagnostico-percepcao-de-valor.csv', [
    ['full_name', 'Nome'], ['whatsapp', 'WhatsApp'], ['market', 'Mercado'], ['revenue_band', 'Faturamento'], ['instagram', 'Instagram'],
    ['score_clareza', 'Índice de Clareza'], ['score_percepcao', 'Índice de Percepção'], ['classification', 'Estado'],
    ['requested_meeting', 'Pediu Reunião'], ['meeting_answer_1', 'O que quer mudar'], ['meeting_answer_2', 'Principal desafio'],
    ['created_at', 'Data'],
  ], rows.map((r) => ({ ...r, revenue_band: REVENUE_LABEL[r.revenue_band] || r.revenue_band, classification: STATE_LABEL[r.classification] || r.classification })));
}

function summaryCards() {
  const total = rows.length;
  const avg = (key) => total ? Math.round(rows.reduce((s, r) => s + Number(r[key] || 0), 0) / total) : 0;
  const meetingCount = rows.filter((r) => r.requested_meeting).length;
  const meetingRate = total ? Math.round((meetingCount / total) * 100) : 0;
  const stateCounts = STATE_ORDER.map((s) => ({ state: s, count: rows.filter((r) => r.classification === s).length }));

  return `
    <div class="grid sm:grid-cols-4 gap-4 mb-6">
      ${card(`<p class="text-xs text-white/30 mb-1">Diagnósticos</p><p class="text-2xl font-serif">${total}</p>`)}
      ${card(`<p class="text-xs text-white/30 mb-1">Índice de Clareza (média)</p><p class="text-2xl font-serif" style="color:var(--gold);">${avg('score_clareza')}</p>`)}
      ${card(`<p class="text-xs text-white/30 mb-1">Índice de Percepção (média)</p><p class="text-2xl font-serif" style="color:var(--gold);">${avg('score_percepcao')}</p>`)}
      ${card(`<p class="text-xs text-white/30 mb-1">Pediram reunião</p><p class="text-2xl font-serif" style="color:var(--gold);">${meetingCount}<span class="text-sm text-white/30"> (${meetingRate}%)</span></p>`)}
    </div>
    ${card(`
      <p class="text-sm text-white/50 mb-3">Distribuição por estado</p>
      <div class="grid sm:grid-cols-4 gap-3">
        ${stateCounts.map(({ state, count }) => `
          <div>
            <p class="text-xs text-white/30 mb-1">${STATE_LABEL[state]}</p>
            <p class="text-xl font-serif">${count}</p>
          </div>
        `).join('')}
      </div>
    `, 'mb-6')}
  `;
}

function render() {
  const filtered = rows.filter((r) => !search
    || r.full_name.toLowerCase().includes(search.toLowerCase())
    || r.market.toLowerCase().includes(search.toLowerCase()));

  content.innerHTML = `
    <div class="mb-8 flex items-start justify-between flex-wrap gap-3">
      <div>
        <p class="text-white/40 text-sm mb-1">Diagnóstico</p>
        <h1 class="text-3xl font-serif">Percepção de Valor</h1>
      </div>
      <button type="button" id="export-csv" class="btn-ghost" ${rows.length ? '' : 'disabled'}>Exportar CSV</button>
    </div>
    ${summaryCards()}
    ${card(`
      <div class="flex items-center justify-between mb-4">
        <p class="text-sm text-white/50">Respostas</p>
        <span class="text-xs text-white/30">${filtered.length} de ${rows.length}</span>
      </div>
      <input id="search" class="field text-sm mb-4" style="max-width:300px;" placeholder="Buscar por nome ou mercado..." value="${search}" />
      <div>
        ${filtered.length ? filtered.map(diagnosticRow).join('') : '<p class="text-sm text-white/20 py-6">Nenhuma resposta ainda.</p>'}
      </div>
    `)}
  `;

  content.querySelector('#search').addEventListener('input', (e) => { search = e.target.value; render(); });
  content.querySelector('#export-csv').addEventListener('click', exportCsv);
  content.querySelectorAll('[data-toggle]').forEach((btn) => {
    btn.addEventListener('click', () => { expandedId = expandedId === btn.dataset.toggle ? null : btn.dataset.toggle; render(); });
  });
}

rows = await loadRows();
render();
