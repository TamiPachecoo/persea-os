// Diagnóstico de Percepção de Valor — admin view of every real submission
// from the public quiz (app.naymurta.com/diagnostico.html). Read-only:
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
  D: 'R$ 50 mil – 100 mil', E: 'Acima de R$ 100 mil', F: 'Não informado',
};
const GAP_LABEL = { acima: 'Se percebe acima do resultado', abaixo: 'Se percebe abaixo do resultado', alinhado: 'Autopercepção alinhada' };

let rows = [];
let search = '';
let expandedId = null;

async function loadRows() {
  const { data } = await supabase.from('value_perception_diagnostics').select('*').order('created_at', { ascending: false });
  return data || [];
}

function pillarBar(label, value) {
  return `
    <div class="mb-2">
      <div class="flex justify-between text-xs mb-1"><span class="text-white/50">${label}</span><span class="text-white/30">${Math.round(value)}/100</span></div>
      <div style="height:4px;background:var(--line);border-radius:99px;overflow:hidden;">
        <div style="height:100%;width:${value}%;background:var(--terracotta);border-radius:99px;"></div>
      </div>
    </div>
  `;
}

function diagnosticRow(r) {
  const isOpen = expandedId === r.id;
  const igHref = r.instagram ? `https://instagram.com/${r.instagram.replace(/^@/, '')}` : null;
  const waLeadHref = r.whatsapp ? `https://wa.me/55${r.whatsapp.replace(/\D/g, '')}` : null;
  return `
    <div class="py-3" style="border-bottom:1px solid var(--line);">
      <button type="button" data-toggle="${r.id}" class="flex items-center justify-between w-full text-left">
        <div class="min-w-0">
          <p class="font-medium">${r.full_name}</p>
          <p class="text-xs text-white/30">${r.email} · ${r.whatsapp}</p>
          <p class="text-xs text-white/30">${r.market} · ${REVENUE_LABEL[r.revenue_band] || r.revenue_band} · ${formatDateTime(r.created_at)}</p>
        </div>
        <div class="flex items-center gap-3 shrink-0">
          <span class="badge badge-progress">${r.classification}</span>
          <span class="text-xs text-white/30">${Math.round(r.value_index)}</span>
        </div>
      </button>
      ${isOpen ? `
        <div class="mt-4 pl-1">
          ${pillarBar('Posicionamento', r.score_positioning)}
          ${pillarBar('Imagem', r.score_image)}
          ${pillarBar('Visibilidade', r.score_visibility)}
          ${pillarBar('Conexão', r.score_connection)}
          ${pillarBar('Vendas', r.score_sales)}
          <p class="text-xs text-white/30 mt-3">${r.main_opportunity ? `Principal oportunidade: <strong style="color:var(--gold);">${r.main_opportunity}</strong>` : 'Pilares equilibrados — sem gargalo destacado.'}</p>
          <p class="text-xs text-white/20 mt-1">${GAP_LABEL[r.perception_gap] || r.perception_gap} · resposta espelho: ${r.mirror_classification}</p>
          <p class="text-xs text-white/20 mt-1">Coerência de percepção: ${Math.round(r.coherence_index)} pontos de diferença entre o maior e o menor pilar.</p>
          <div class="flex flex-wrap gap-3 mt-3">
            ${waLeadHref ? `<a href="${waLeadHref}" target="_blank" rel="noopener" class="btn-primary" style="padding:6px 12px;font-size:11px;">WhatsApp</a>` : ''}
            <a href="mailto:${r.email}" class="btn-ghost" style="padding:6px 12px;font-size:11px;">E-mail</a>
            ${igHref ? `<a href="${igHref}" target="_blank" rel="noopener" class="btn-ghost" style="padding:6px 12px;font-size:11px;">Instagram</a>` : ''}
          </div>
        </div>
      ` : ''}
    </div>
  `;
}

function exportCsv() {
  downloadCSV('diagnostico-percepcao-de-valor.csv', [
    ['full_name', 'Nome'], ['email', 'E-mail'], ['whatsapp', 'WhatsApp'], ['market', 'Mercado'], ['revenue_band', 'Faturamento'], ['instagram', 'Instagram'],
    ['value_index', 'Índice'], ['classification', 'Classificação'], ['main_opportunity', 'Principal Oportunidade'],
    ['score_positioning', 'Posicionamento'], ['score_image', 'Imagem'], ['score_visibility', 'Visibilidade'],
    ['score_connection', 'Conexão'], ['score_sales', 'Vendas'], ['coherence_index', 'Coerência'],
    ['mirror_classification', 'Classificação Espelho'], ['perception_gap', 'Gap de Autopercepção'],
    ['created_at', 'Data'],
  ], rows.map((r) => ({ ...r, revenue_band: REVENUE_LABEL[r.revenue_band] || r.revenue_band })));
}

function render() {
  const filtered = rows.filter((r) => !search
    || r.full_name.toLowerCase().includes(search.toLowerCase())
    || r.market.toLowerCase().includes(search.toLowerCase())
    || r.email.toLowerCase().includes(search.toLowerCase()));

  content.innerHTML = `
    <div class="mb-8 flex items-start justify-between flex-wrap gap-3">
      <div>
        <p class="text-white/40 text-sm mb-1">Diagnóstico</p>
        <h1 class="text-3xl font-serif">Percepção de Valor</h1>
      </div>
      <button type="button" id="export-csv" class="btn-ghost" ${rows.length ? '' : 'disabled'}>Exportar CSV</button>
    </div>
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
