// Leitura Estratégica de Valor — client-facing entry point. Renders one of
// six screens depending on plan + status: locked preview (non-premium),
// upcoming (premium, not yet active), intro, wizard, waiting, or published
// deliverable. Every branch below reads through MockDB.getValueAnalysisAccess/
// getValueAssessment — those functions are where premium access is actually
// enforced (see mock-db.js), not this screen; this screen just reacts to
// what they return.
import { MockDB, getActiveClientId } from '../shared/mock-db.js';
import { renderShell, card, toast, initClientSwitcher, formatDate, isNonProduction } from '../shared/ui.js';
import {
  SECTIONS, OFFER_FIELDS, FIXED_COST_FIELDS, VARIABLE_COST_FIELDS, REFERENCE_FIELDS,
  FIXED_COST_CATEGORIES, VARIABLE_COST_CATEGORIES,
  fmtBRL, fmtPct, calcFixedCostsTotal, calcVariableCostsSummary,
  VALUE_ASSESSMENT_STATUS_LABEL, VALUE_ASSESSMENT_STATUS_BADGE_CLASS,
} from '../shared/value-analysis-schema.js';

const clientId = getActiveClientId();
document.body.innerHTML = renderShell({ role: 'client', active: 'value-analysis.html', title: 'Leitura Estratégica de Valor' });
initClientSwitcher();
const content = document.getElementById('app-content');

let currentStep = 0; // 0..SECTIONS.length-1 = a section, SECTIONS.length = review
let showAnswersReadonly = false;

function esc(s) { return String(s ?? '').replace(/"/g, '&quot;'); }

// --- Generic field rendering (shared shape for section fields + repeatable
// item fields — only the `path` differs, see commitField's dispatch). ---
function renderFieldControl(path, field, value) {
  const reqMark = field.required
    ? ' <span style="color:var(--terracotta);">*</span>'
    : ' <span class="text-white/20 text-xs">(opcional)</span>';
  let control;
  if (field.type === 'text') {
    control = `<input type="text" data-field="${path}" class="field" value="${esc(value)}" />`;
  } else if (field.type === 'textarea') {
    control = `<textarea data-field="${path}" rows="3" class="field">${value ?? ''}</textarea>`;
  } else if (field.type === 'select') {
    control = `<select data-field="${path}" class="field">
      <option value="">Selecione…</option>
      ${field.options.map((o) => `<option value="${esc(o)}" ${value === o ? 'selected' : ''}>${field.optionLabels ? field.optionLabels[o] : o}</option>`).join('')}
    </select>`;
  } else if (field.type === 'multiselect') {
    control = `<div class="flex flex-wrap gap-2" data-multiselect="${path}">
      ${field.options.map((o) => `<button type="button" class="ms-chip ${((value || []).includes(o)) ? 'ms-chip-active' : ''}" data-ms-option="${esc(o)}">${o}</button>`).join('')}
    </div>`;
  } else {
    // currency / number / percent
    const isUnknown = value === 'unknown';
    const unit = field.type === 'currency' ? 'R$' : field.type === 'percent' ? '%' : '';
    control = `
      <div class="flex items-center gap-3 flex-wrap">
        <div class="flex items-center gap-2">
          ${unit ? `<span class="text-xs text-white/30">${unit}</span>` : ''}
          <input type="number" inputmode="decimal" step="0.01" data-field="${path}" class="field" style="max-width:180px;"
            value="${isUnknown || value === null || value === undefined ? '' : value}" ${isUnknown ? 'disabled' : ''} />
        </div>
        ${field.allowUnknown ? `
          <label class="flex items-center gap-2 text-xs text-white/40" style="cursor:pointer;">
            <input type="checkbox" data-unknown-toggle="${path}" ${isUnknown ? 'checked' : ''} /> Não sei informar / ainda não acompanho esse número
          </label>
        ` : ''}
      </div>
    `;
  }
  return `<div class="mb-5" data-field-wrap="${path}"><label class="text-sm block mb-1.5">${field.label}${reqMark}</label>${control}<p class="field-error text-xs mt-1" style="color:var(--error);">Este campo é obrigatório.</p></div>`;
}
function renderField(sectionKey, field, value) { return renderFieldControl(`${sectionKey}.${field.key}`, field, value); }
function renderItemField(groupKey, itemId, field, value) { return renderFieldControl(`${groupKey}.${itemId}.${field.key}`, field, value); }

// --- Repeatable groups ---
function renderOffersGroup(answers) {
  const offers = answers.offers;
  return `
    <div class="mb-8">
      <p class="text-sm text-white/50 mb-3">Produtos e serviços</p>
      ${offers.length ? offers.map((o) => `
        <div class="value-item-card mb-4" data-offer-id="${o.id}">
          <div class="flex items-center justify-between mb-3">
            <p class="text-sm font-medium">${o.name || 'Novo produto/serviço'}</p>
            <button type="button" data-remove-offer="${o.id}" class="btn-text" style="color:var(--error);">Remover</button>
          </div>
          <div class="grid sm:grid-cols-2 gap-x-6">
            ${OFFER_FIELDS.filter((f) => !f.condition || f.condition(o)).map((f) => renderItemField('offers', o.id, f, o[f.key])).join('')}
          </div>
        </div>
      `).join('') : '<p class="text-xs text-white/20 mb-3">Nenhum produto ou serviço adicionado ainda.</p>'}
      <button type="button" id="add-offer" class="btn-ghost">+ Adicionar Produto/Serviço</button>
    </div>
  `;
}
function renderCostsGroup(answers) {
  const fixedTotal = calcFixedCostsTotal(answers.fixedCosts);
  const varSummary = calcVariableCostsSummary(answers.variableCosts, answers.s2.monthlyRevenue);
  return `
    <div class="mb-8">
      <p class="text-sm text-white/50 mb-1">Custos fixos</p>
      <p class="text-xs text-white/30 mb-3 max-w-lg">Custos fixos são despesas que normalmente existem mesmo quando você vende menos. Se não souber o valor exato, use uma estimativa.</p>
      ${answers.fixedCosts.map((c) => `
        <div class="value-item-card mb-3">
          <div class="flex items-center justify-between gap-3 mb-2 flex-wrap">
            <select data-field="fixedCosts.${c.id}.category" class="field" style="max-width:280px;">
              ${FIXED_COST_CATEGORIES.map((cat) => `<option value="${cat}" ${c.category === cat ? 'selected' : ''}>${cat}</option>`).join('')}
            </select>
            <button type="button" data-remove-cost="fixedCosts:${c.id}" class="btn-text" style="color:var(--error);">Remover</button>
          </div>
          <div class="grid sm:grid-cols-3 gap-3 items-end">
            <div><label class="text-xs text-white/40 block mb-1">Descrição</label><input type="text" data-field="fixedCosts.${c.id}.description" class="field" value="${esc(c.description)}" /></div>
            <div><label class="text-xs text-white/40 block mb-1">Valor mensal (R$)</label><input type="number" step="0.01" data-field="fixedCosts.${c.id}.monthlyAmount" class="field" value="${c.monthlyAmount ?? ''}" /></div>
            <label class="flex items-center gap-2 text-xs text-white/40 pb-2" style="cursor:pointer;"><input type="checkbox" data-field="fixedCosts.${c.id}.isEstimate" data-bool="1" ${c.isEstimate ? 'checked' : ''} /> Estimativa</label>
          </div>
        </div>
      `).join('')}
      <button type="button" id="add-fixed-cost" class="btn-ghost mb-3">+ Adicionar Custo Fixo</button>
      <p class="text-sm" style="color:var(--gold);">Total estimado de custos fixos mensais: ${fmtBRL(fixedTotal.value)}</p>
    </div>
    <div class="mb-8">
      <p class="text-sm text-white/50 mb-1">Custos variáveis</p>
      <p class="text-xs text-white/30 mb-3 max-w-lg">Custos variáveis mudam conforme suas vendas ou entregas.</p>
      ${answers.variableCosts.map((c) => `
        <div class="value-item-card mb-3" data-cost-id="${c.id}">
          <div class="flex items-center justify-between gap-3 mb-2 flex-wrap">
            <select data-field="variableCosts.${c.id}.category" class="field" style="max-width:280px;">
              ${VARIABLE_COST_CATEGORIES.map((cat) => `<option value="${cat}" ${c.category === cat ? 'selected' : ''}>${cat}</option>`).join('')}
            </select>
            <button type="button" data-remove-cost="variableCosts:${c.id}" class="btn-text" style="color:var(--error);">Remover</button>
          </div>
          <div class="grid sm:grid-cols-3 gap-3 items-end">
            ${VARIABLE_COST_FIELDS.filter((f) => !f.condition || f.condition(c)).map((f) => renderItemField('variableCosts', c.id, f, c[f.key])).join('')}
            <label class="flex items-center gap-2 text-xs text-white/40 pb-2" style="cursor:pointer;"><input type="checkbox" data-field="variableCosts.${c.id}.isEstimate" data-bool="1" ${c.isEstimate ? 'checked' : ''} /> Estimativa</label>
          </div>
        </div>
      `).join('')}
      <button type="button" id="add-variable-cost" class="btn-ghost mb-3">+ Adicionar Custo Variável</button>
      <p class="text-sm" style="color:var(--gold);">Resumo estimado de custos variáveis: ${fmtBRL(varSummary.value)}/mês${varSummary.pctOfRevenue ? ` + ${fmtPct(varSummary.pctOfRevenue)} do faturamento em percentuais` : ''}</p>
    </div>
  `;
}
function renderReferencesGroup(answers) {
  const refs = answers.s6.references;
  return `
    <div class="mb-6 mt-2">
      <p class="text-sm text-white/50 mb-3">Registre até 5 referências <span class="text-white/20 text-xs">(opcional)</span></p>
      ${refs.map((r) => `
        <div class="value-item-card mb-3" data-ref-id="${r.id}">
          <div class="flex items-center justify-between mb-2">
            <p class="text-xs text-white/30">Referência</p>
            <button type="button" data-remove-ref="${r.id}" class="btn-text" style="color:var(--error);">Remover</button>
          </div>
          <div class="grid sm:grid-cols-2 gap-3">
            ${REFERENCE_FIELDS.map((f) => renderItemField('references', r.id, f, r[f.key])).join('')}
          </div>
        </div>
      `).join('')}
      ${refs.length < 5 ? '<button type="button" id="add-reference" class="btn-ghost">+ Adicionar Referência</button>' : '<p class="text-xs text-white/20">Limite de 5 referências atingido.</p>'}
    </div>
  `;
}

function renderSectionBody(answers, section) {
  let html = '';
  if (section.key === 's2') html += renderOffersGroup(answers);
  if (section.key === 's3') html += renderCostsGroup(answers);
  section.fields.forEach((f) => {
    if (f.condition && !f.condition(answers)) return;
    html += renderField(section.key, f, answers[section.key][f.key]);
    if (f.insertReferencesAfter) html += renderReferencesGroup(answers);
  });
  return html;
}

function validateSection(answers, section) {
  const missing = [];
  if (section.key === 's2' && answers.offers.length === 0) missing.push('offers');
  section.fields.forEach((f) => {
    if (f.condition && !f.condition(answers)) return;
    if (!f.required) return;
    const v = answers[section.key][f.key];
    const empty = f.type === 'multiselect' ? !(v && v.length) : (v === null || v === undefined || v === '');
    if (empty) missing.push(`${section.key}.${f.key}`);
  });
  return missing;
}

// --- Wizard shell ---
function renderWizardScreen(record) {
  return currentStep === SECTIONS.length ? renderReview(record.answers) : renderSectionScreen(record);
}
function renderSectionScreen(record) {
  const section = SECTIONS[currentStep];
  const pct = Math.round((currentStep / SECTIONS.length) * 100);
  return `
    <div class="mb-6">
      <div class="flex items-center justify-between mb-2">
        <p class="text-xs text-white/30">Seção ${currentStep + 1} de ${SECTIONS.length} · Salvo automaticamente</p>
        <p class="text-xs text-white/20">Atualizado ${formatDate(record.updatedAt)}</p>
      </div>
      <div class="progress-track"><div class="progress-fill" style="width:${pct}%;"></div></div>
    </div>
    <h2 class="text-2xl font-serif mb-2">${section.heading}</h2>
    ${section.intro ? `<p class="text-sm text-white/40 mb-6 max-w-xl">${section.intro}</p>` : '<div class="mb-6"></div>'}
    <div id="section-fields">${renderSectionBody(record.answers, section)}</div>
    <div class="flex items-center justify-between mt-8 pt-6" style="border-top:1px solid var(--line);">
      <button type="button" id="wiz-back" class="btn-ghost" ${currentStep === 0 ? 'disabled' : ''}>&larr; Voltar</button>
      <button type="button" id="wiz-next" class="btn-primary">${currentStep === SECTIONS.length - 1 ? 'Revisar respostas' : 'Continuar'}</button>
    </div>
  `;
}
function reviewFieldValue(f, v) {
  if (v === 'unknown') return 'Não sei informar';
  if (Array.isArray(v)) return v.length ? v.join(', ') : '—';
  if (f.type === 'currency') return fmtBRL(v);
  if (f.type === 'percent') return fmtPct(v);
  return v;
}
function renderReviewSection(answers, section, i) {
  const offerLines = section.key === 's2'
    ? answers.offers.map((o) => `<p><span class="text-white/30">Oferta:</span> ${o.name || '—'} · ${fmtBRL(o.currentPrice)} · ${o.avgMonthlySales || 0} vendas/mês</p>`).join('')
    : '';
  const costLines = section.key === 's3'
    ? `<p><span class="text-white/30">Custos fixos:</span> ${fmtBRL(calcFixedCostsTotal(answers.fixedCosts).value)}/mês (${answers.fixedCosts.length} itens)</p>
       <p><span class="text-white/30">Custos variáveis:</span> ${answers.variableCosts.length} itens</p>`
    : '';
  const fieldLines = section.fields.filter((f) => !f.condition || f.condition(answers)).map((f) => {
    const v = answers[section.key][f.key];
    if (v === '' || v === null || v === undefined || (Array.isArray(v) && !v.length)) return '';
    return `<p><span class="text-white/30">${f.label}</span><br/>${reviewFieldValue(f, v)}</p>`;
  }).join('');
  return card(`
    <div class="flex items-center justify-between mb-3">
      <p class="text-sm font-medium">${i + 1}. ${section.title}</p>
      <button type="button" data-jump-section="${i}" class="btn-text">Editar</button>
    </div>
    <div class="space-y-2 text-sm text-white/70">${offerLines}${costLines}${fieldLines || '<p class="text-white/20">Nenhuma resposta ainda.</p>'}</div>
  `, 'mb-4');
}
function renderReview(answers) {
  return `
    <div class="mb-6">
      <p class="text-xs text-white/30 mb-2">Revisão</p>
      <div class="progress-track"><div class="progress-fill" style="width:100%;"></div></div>
    </div>
    <h2 class="text-2xl font-serif mb-6">Revise suas respostas</h2>
    ${SECTIONS.map((section, i) => renderReviewSection(answers, section, i)).join('')}
    ${card(`
      <p class="text-sm font-medium mb-1">Sua análise será enviada para Nay</p>
      <p class="text-xs text-white/40">Após o envio, Nay utilizará essas informações para estudar sua oferta, sua capacidade e sua precificação. Você será avisada(o) quando a devolutiva estiver disponível.</p>
    `, 'mb-6')}
    <div class="flex items-center justify-between">
      <button type="button" id="wiz-back" class="btn-ghost">&larr; Voltar</button>
      <button type="button" id="submit-analysis" class="btn-primary">Enviar para análise</button>
    </div>
  `;
}

function commitField(path, value) {
  const parts = path.split('.');
  if (['offers', 'fixedCosts', 'variableCosts', 'references'].includes(parts[0]) && parts.length === 3) {
    MockDB.updateValueAssessmentItem(clientId, parts[0], parts[1], { [parts[2]]: value });
  } else {
    MockDB.saveValueAssessmentField(clientId, path, value);
  }
}
function wireGenericFields() {
  content.querySelectorAll('[data-field]').forEach((el) => {
    if (el.dataset.bool) { el.addEventListener('change', () => { commitField(el.dataset.field, el.checked); render(); }); return; }
    if (el.tagName === 'SELECT') {
      // Selects can gate a conditional field (e.g. "Outro" -> reveals a text
      // field), so a full re-render is both safe (change is atomic — it
      // can't race with itself the way a blur mid-type-elsewhere could) and
      // necessary for correctness.
      el.addEventListener('change', () => { commitField(el.dataset.field, el.value); render(); });
      return;
    }
    // Text/textarea/number: commit on blur WITHOUT a full re-render. A
    // synchronous re-render on every blur was replacing the whole section's
    // DOM mid-interaction — losing focus/scroll position on every field,
    // and racing real fast-typing/tabbing (a moved-to field could be
    // destroyed just as it received focus). Only maxVolumeAchieved gates
    // another question's visibility, so it's special-cased to re-render.
    el.addEventListener('blur', () => {
      let value = el.value;
      if (el.type === 'number') value = value === '' ? null : Number(value);
      commitField(el.dataset.field, value);
      const wrap = el.closest('[data-field-wrap]');
      wrap?.querySelector('.field-error')?.style.setProperty('display', 'none');
      if (el.dataset.field.endsWith('.maxVolumeAchieved')) render();
    });
  });
  content.querySelectorAll('[data-unknown-toggle]').forEach((cb) => {
    cb.addEventListener('change', () => { commitField(cb.dataset.unknownToggle, cb.checked ? 'unknown' : null); render(); });
  });
  content.querySelectorAll('[data-multiselect]').forEach((wrap) => {
    wrap.querySelectorAll('[data-ms-option]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const path = wrap.dataset.multiselect;
        const [sec, key] = path.split('.');
        const rec = MockDB.getValueAssessment(clientId);
        const current = rec.answers[sec][key] || [];
        const opt = btn.dataset.msOption;
        const next = current.includes(opt) ? current.filter((o) => o !== opt) : [...current, opt];
        commitField(path, next);
        render();
      });
    });
  });
}
function wireRepeatableGroups() {
  content.querySelector('#add-offer')?.addEventListener('click', () => { MockDB.addValueAssessmentItem(clientId, 'offers', {}); render(); });
  content.querySelectorAll('[data-remove-offer]').forEach((btn) => btn.addEventListener('click', () => { MockDB.removeValueAssessmentItem(clientId, 'offers', btn.dataset.removeOffer); render(); }));
  content.querySelector('#add-fixed-cost')?.addEventListener('click', () => { MockDB.addValueAssessmentItem(clientId, 'fixedCosts', { category: FIXED_COST_CATEGORIES[0] }); render(); });
  content.querySelector('#add-variable-cost')?.addEventListener('click', () => { MockDB.addValueAssessmentItem(clientId, 'variableCosts', { category: VARIABLE_COST_CATEGORIES[0] }); render(); });
  content.querySelectorAll('[data-remove-cost]').forEach((btn) => btn.addEventListener('click', () => {
    const [groupKey, id] = btn.dataset.removeCost.split(':');
    MockDB.removeValueAssessmentItem(clientId, groupKey, id);
    render();
  }));
  content.querySelector('#add-reference')?.addEventListener('click', () => { MockDB.addValueAssessmentItem(clientId, 'references', {}); render(); });
  content.querySelectorAll('[data-remove-ref]').forEach((btn) => btn.addEventListener('click', () => { MockDB.removeValueAssessmentItem(clientId, 'references', btn.dataset.removeRef); render(); }));
}
function wireWizardScreen(record) {
  if (currentStep === SECTIONS.length) {
    content.querySelector('#wiz-back').addEventListener('click', () => { currentStep = SECTIONS.length - 1; render(); });
    content.querySelectorAll('[data-jump-section]').forEach((btn) => btn.addEventListener('click', () => { currentStep = Number(btn.dataset.jumpSection); render(); }));
    content.querySelector('#submit-analysis').addEventListener('click', () => {
      MockDB.submitValueAssessment(clientId);
      toast('Informações enviadas!');
      render();
    });
    return;
  }
  wireGenericFields();
  wireRepeatableGroups();
  content.querySelector('#wiz-back').addEventListener('click', () => { if (currentStep > 0) { currentStep--; render(); } });
  content.querySelector('#wiz-next').addEventListener('click', () => {
    // Re-fetch rather than use the closured `record` — text/textarea/number
    // fields commit on blur without a re-render (see wireGenericFields), so
    // the value just typed in the field this button's own click blurred
    // wouldn't be reflected in a stale in-memory reference.
    const freshRecord = MockDB.getValueAssessment(clientId);
    const section = SECTIONS[currentStep];
    const missing = validateSection(freshRecord.answers, section);
    if (missing.length) {
      missing.forEach((p) => { const wrap = content.querySelector(`[data-field-wrap="${p}"]`); if (wrap) wrap.querySelector('.field-error').style.display = 'block'; });
      toast(missing.includes('offers') ? 'Adicione ao menos um produto ou serviço antes de continuar.' : 'Preencha os campos obrigatórios antes de continuar.', { tone: 'error' });
      return;
    }
    currentStep++;
    render();
  });
}

// --- Non-wizard screens ---
function renderLockedPreview() {
  const alreadyInterested = MockDB.getPremiumUpgradeInterests()
    .some((i) => i.clientId === clientId && i.sourceActivitySlug === 'business' && ['novo', 'em_conversa'].includes(i.status));
  return `
    <div class="mb-8">
      <p class="text-white/40 text-sm mb-1">Metodologia PERSEA</p>
      <h1 class="text-3xl font-serif">Leitura Estratégica de Valor</h1>
    </div>
    ${card(`
      <div class="flex items-center gap-3 mb-5">
        <span class="premium-badge">✦ Premium</span>
        <span style="color:var(--muted); font-size:1.15rem;" aria-hidden="true">🔒</span>
      </div>
      <p class="text-lg font-serif mb-5" style="max-width:580px; line-height:1.4;">Uma análise aprofundada da sua oferta, capacidade, custos, metas e precificação para que suas decisões comerciais sejam sustentáveis e coerentes com o seu posicionamento.</p>
      <div class="space-y-2.5 mb-7">
        ${[
          'Entenda quanto seu negócio realmente precisa faturar.',
          'Avalie se sua capacidade atual sustenta suas metas.',
          'Identifique possíveis problemas na oferta e no modelo de negócio.',
          'Construa uma precificação baseada em números e estratégia.',
          'Receba uma recomendação personalizada de Nay.',
        ].map((b) => `<div class="flex items-start gap-2.5 text-sm text-white/60"><span style="color:var(--gold);">✦</span><span>${b}</span></div>`).join('')}
      </div>
      ${alreadyInterested
        ? '<p class="text-sm" style="color:var(--gold);">Interesse enviado. Nay poderá conversar com você sobre o próximo passo.</p>'
        : `
        <div class="flex flex-wrap items-center gap-3">
          <button type="button" id="upgrade-interest" class="btn-primary">Tenho interesse no Premium</button>
          <span class="text-xs text-white/30 max-w-xs">Sem cobrança neste momento — apenas avisa a Nay que você quer conversar sobre o Programa Premium.</span>
        </div>`}
    `)}
  `;
}
function renderUpcoming() {
  return `
    <div class="mb-8">
      <p class="text-white/40 text-sm mb-1">Metodologia PERSEA</p>
      <h1 class="text-3xl font-serif">Leitura Estratégica de Valor</h1>
    </div>
    ${card(`
      <span class="premium-badge mb-4 inline-block">✦ Premium</span>
      <p class="text-lg font-serif mb-3" style="max-width:560px; line-height:1.4;">Uma análise aprofundada da sua oferta, capacidade, custos, metas e precificação.</p>
      <p class="text-sm text-white/40 max-w-lg">Esta etapa é liberada assim que seu onboarding for concluído e sua jornada Premium avançar. Você poderá começar por aqui quando chegar a hora.</p>
    `)}
  `;
}
function renderIntro() {
  return `
    <div class="mb-8">
      <p class="text-white/40 text-sm mb-1">Metodologia PERSEA</p>
      <h1 class="text-3xl font-serif mb-5">Leitura Estratégica de Valor</h1>
      <p class="text-white/60 mb-3 max-w-xl" style="line-height:1.7;">Preço não deve ser definido apenas pela concorrência ou pela sensação de quanto o cliente está disposto a pagar.</p>
      <p class="text-white/60 mb-3 max-w-xl" style="line-height:1.7;">Esta análise ajudará Nay a compreender seus números, sua capacidade, sua oferta e seus objetivos para construir uma recomendação de preço consciente e sustentável.</p>
      <p class="text-white/60 mb-6 max-w-xl" style="line-height:1.7;">Você não precisa ter todos os números exatos. Quando necessário, informe uma estimativa e indique que o valor é aproximado.</p>
    </div>
    ${card('<p class="text-sm" style="color:var(--gold);">🔒 As informações financeiras compartilhadas aqui serão utilizadas exclusivamente no seu processo de mentoria e estarão disponíveis apenas para você e para a equipe autorizada da Persea.</p>', 'mb-6')}
    <button type="button" id="start-analysis" class="btn-primary">Começar análise</button>
  `;
}
function renderWaiting(assessment) {
  const isSubmitted = assessment.status === 'submitted';
  const title = isSubmitted ? 'Informações enviadas' : 'Sua análise está sendo preparada';
  const body = isSubmitted
    ? 'Nay já pode iniciar sua Leitura Estratégica de Valor. Você poderá acompanhar o andamento por aqui.'
    : 'Nay está estudando sua oferta, sua capacidade e sua precificação. Você será avisada(o) quando a devolutiva estiver disponível.';
  return `
    <div class="mb-8">
      <p class="text-white/40 text-sm mb-1">Metodologia PERSEA</p>
      <h1 class="text-3xl font-serif">Leitura Estratégica de Valor</h1>
    </div>
    ${card(`
      <span class="badge ${VALUE_ASSESSMENT_STATUS_BADGE_CLASS[assessment.status]}">${VALUE_ASSESSMENT_STATUS_LABEL[assessment.status]}</span>
      <p class="text-xl font-serif mt-4 mb-2">${title}</p>
      <p class="text-sm text-white/40 max-w-lg">${body}</p>
      <p class="text-xs text-white/20 mt-3">Enviado em ${formatDate(assessment.submittedAt)}</p>
    `, 'mb-6')}
    <button type="button" id="toggle-view-answers" class="btn-ghost">${showAnswersReadonly ? 'Ocultar minhas respostas' : 'Ver minhas respostas'}</button>
    <div id="answers-readonly" class="mt-6">${showAnswersReadonly ? SECTIONS.map((s, i) => renderReviewSection(assessment.answers, s, i)).join('') : ''}</div>
  `;
}
function renderPublished(assessment) {
  const d = assessment.publishedDeliverable;
  return `
    <div class="mb-8">
      <p class="text-white/40 text-sm mb-1">Metodologia PERSEA</p>
      <h1 class="text-3xl font-serif">Sua Leitura Estratégica de Valor</h1>
    </div>
    ${card(`
      <p class="text-sm text-white/50 mb-2">Situação atual</p>
      <p class="text-sm text-white/70 mb-5">${d.situationSummary || '—'}</p>
      <p class="text-sm text-white/50 mb-2">Principal constatação</p>
      <p class="text-sm text-white/70 mb-5">${d.mainFinding || '—'}</p>
      <div class="grid sm:grid-cols-2 gap-4 mb-5">
        <div><p class="text-xs text-white/30 mb-1">Indicador de preço mínimo matemático</p><p class="text-2xl font-serif">${fmtBRL(d.mathematicalMinimum)}</p></div>
        <div><p class="text-xs text-white/30 mb-1">Preço estratégico recomendado</p><p class="text-2xl font-serif" style="color:var(--gold);">${fmtBRL(d.strategicPrice)}</p></div>
      </div>
      ${d.explanation ? `<p class="text-sm text-white/50 mb-2">Explicação da recomendação</p><p class="text-sm text-white/70 mb-5">${d.explanation}</p>` : ''}
      ${d.offerChanges ? `<p class="text-sm text-white/50 mb-2">Ajustes sugeridos na oferta</p><p class="text-sm text-white/70 mb-5">${d.offerChanges}</p>` : ''}
      ${d.nextActions ? `<p class="text-sm text-white/50 mb-2">Próximas ações práticas</p><p class="text-sm text-white/70 mb-5">${d.nextActions}</p>` : ''}
      <p class="text-xs text-white/20">Recomendação de ${formatDate(d.recommendationDate || d.publishedAt)}${d.reviewDate ? ` · revisão sugerida em ${formatDate(d.reviewDate)}` : ''}</p>
    `)}
  `;
}

// --- Removable dev-only preview panel — jumps the *active* client through
// every state this feature needs to be previewable in, without needing 12
// separate seeded clients. Never wired into any production-shaped action.
// Gated to non-production (local dev + demo/staging, see isNonProduction in
// shared/environment.js) so it can never render (and therefore never be
// interacted with, since wireDevPanel finds nothing to wire) in production. ---
function renderDevPanel() {
  if (!isNonProduction()) return '';
  const client = MockDB.getClient(clientId);
  return `
    <div class="dev-preview-panel">
      <p class="text-xs uppercase tracking-[.12em] mb-3" style="color:var(--muted);">🧪 Pré-visualização (dev, removível) — cliente ativa: ${client.fullName}</p>
      <div class="flex flex-wrap gap-2">
        <button type="button" data-dev-state="locked" class="btn-ghost" style="padding:6px 12px;font-size:11.5px;">Não-Premium bloqueada</button>
        <button type="button" data-dev-state="available" class="btn-ghost" style="padding:6px 12px;font-size:11.5px;">Premium — antes de começar</button>
        <button type="button" data-dev-state="in_progress" class="btn-ghost" style="padding:6px 12px;font-size:11.5px;">Premium — em andamento</button>
        <button type="button" data-dev-state="review" class="btn-ghost" style="padding:6px 12px;font-size:11.5px;">Premium — revisão/envio</button>
        <button type="button" data-dev-state="submitted" class="btn-ghost" style="padding:6px 12px;font-size:11.5px;">Premium — aguardando Nay</button>
        <button type="button" data-dev-state="in_analysis" class="btn-ghost" style="padding:6px 12px;font-size:11.5px;">Premium — em análise</button>
        <button type="button" data-dev-state="published" class="btn-ghost" style="padding:6px 12px;font-size:11.5px;">Premium — devolutiva publicada</button>
        <a href="../admin/client-detail.html?id=${clientId}&tab=value-analysis" class="btn-ghost" style="padding:6px 12px;font-size:11.5px;">Abrir workspace da Nay ↗</a>
      </div>
      <p class="text-xs text-white/20 mt-3">Ju vê apenas status/conclusão da tarefa; Nath não vê nada financeiro — nenhuma das duas tem uma tela própria desta análise a menos que a Nay autorize (ver admin/agenda + permissões).</p>
    </div>
  `;
}
function wireDevPanel() {
  content.querySelectorAll('[data-dev-state]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.devState;
      if (key === 'locked') MockDB.devSetValueAssessmentState(clientId, { programSlug: 'persea-essential' });
      else if (key === 'review') { MockDB.devSetValueAssessmentState(clientId, { programSlug: 'persea-premium', status: 'in_progress' }); currentStep = SECTIONS.length; }
      else { MockDB.devSetValueAssessmentState(clientId, { programSlug: 'persea-premium', status: key }); currentStep = 0; }
      render();
    });
  });
}

function render() {
  const access = MockDB.getValueAnalysisAccess(clientId);
  let body;
  if (!access) { content.innerHTML = '<p class="text-sm text-white/40">Cliente não encontrada.</p>'; return; }

  if (!access.isPremium) {
    body = renderLockedPreview();
    content.innerHTML = body + renderDevPanel();
    content.querySelector('#upgrade-interest')?.addEventListener('click', () => {
      MockDB.createPremiumUpgradeInterest(clientId, 'business');
      toast('Interesse enviado. Nay poderá conversar com você sobre o próximo passo.');
      render();
    });
    wireDevPanel();
    return;
  }
  if (access.status === 'upcoming') {
    content.innerHTML = renderUpcoming() + renderDevPanel();
    wireDevPanel();
    return;
  }

  const assessment = MockDB.getValueAssessment(clientId);
  if (access.status === 'available') {
    content.innerHTML = renderIntro() + renderDevPanel();
    content.querySelector('#start-analysis').addEventListener('click', () => { MockDB.startValueAssessment(clientId); currentStep = 0; render(); });
    wireDevPanel();
    return;
  }
  if (access.status === 'in_progress') {
    content.innerHTML = renderWizardScreen(assessment) + renderDevPanel();
    wireWizardScreen(assessment);
    wireDevPanel();
    return;
  }
  if (access.status === 'submitted' || access.status === 'in_analysis') {
    content.innerHTML = renderWaiting(assessment) + renderDevPanel();
    content.querySelector('#toggle-view-answers').addEventListener('click', () => { showAnswersReadonly = !showAnswersReadonly; render(); });
    wireDevPanel();
    return;
  }
  if (access.status === 'published') {
    content.innerHTML = renderPublished(assessment) + renderDevPanel();
    wireDevPanel();
    return;
  }
}

render();
