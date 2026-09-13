// Teste de Arquétipos — Production Migration: Archetypes + Quiz. Same
// wizard UX as the MockDB/demo version (intro → 6 sections of 8 statements,
// autosaved per answer → confirmation), now backed by real Supabase via
// shared/archetype-model.js. Scoring never happens here — see that module's
// header comment for the real trust boundary (RLS + a DB-level CHECK on
// score, plus submitAttempt() independently re-validating completeness
// before allowing 'completed', exactly mirroring MockDB.submitArchetypeQuiz).
import { getCurrentClientContext } from '../shared/client-context.js';
import { renderShell, card, toast, initClientSwitcher } from '../shared/ui.js';
import {
  getArchetypeQuestions, getOrCreateActiveAttempt, getAttemptResponses, saveResponse, submitAttempt, getLatestAttempt,
} from '../shared/archetype-model.js';

const ARCHETYPE_SCALE_LABELS = {
  1: 'Pouco verdadeiro para mim', 2: 'Raramente verdadeiro', 3: 'Parcialmente verdadeiro',
  4: 'Bastante verdadeiro', 5: 'Muito verdadeiro para mim',
};

const __clientCtx = await getCurrentClientContext('../login.html', { page: 'arquetipos' });
if (!__clientCtx) throw new Error('not authorized');
const clientId = __clientCtx.clientId;
document.body.innerHTML = renderShell({ role: 'client', active: 'program.html', title: 'Teste de Arquétipos' });
initClientSwitcher();
const content = document.getElementById('app-content');

const questions = await getArchetypeQuestions();
const sections = [];
questions.forEach((q) => {
  const idx = q.section_index - 1;
  if (!sections[idx]) sections[idx] = { index: q.section_index, questions: [] };
  sections[idx].questions.push(q);
});

let currentStep = 0;
let showMissingWarning = false;
let attempt = null;
let responses = new Map();

function renderIntro() {
  content.innerHTML = `
    <div class="max-w-2xl mx-auto">
      <p class="text-white/40 text-sm mb-1">Sua Jornada</p>
      <h1 class="text-3xl font-serif mb-5">Descubra seu mapa de arquétipos</h1>
      ${card(`
        <p class="text-sm text-white/60 mb-4 leading-relaxed">Todos nós carregamos os 12 arquétipos. Este teste ajuda a identificar quais energias aparecem com mais intensidade em você neste momento.</p>
        <p class="text-sm text-white/60 mb-6 leading-relaxed">Não existem respostas certas ou erradas. Responda pensando em como você realmente age, sente e escolhe — e não apenas em como gostaria de ser percebida(o).</p>
        <p class="text-xs uppercase mb-3" style="color:var(--muted); letter-spacing:.1em;">Para cada afirmação</p>
        <div class="space-y-2 mb-6">
          ${Object.entries(ARCHETYPE_SCALE_LABELS).map(([v, label]) => `
            <div class="flex items-center gap-3 text-sm text-white/50">
              <span class="badge badge-locked" style="min-width:24px; justify-content:center;">${v}</span>
              <span>${label}</span>
            </div>
          `).join('')}
        </div>
        <button type="button" id="start-quiz" class="btn-primary" style="padding:11px 24px;font-size:13px;">Começar</button>
      `)}
      <p class="text-xs text-white/20 mt-6 mb-10 text-center">Este teste é uma ferramenta de reflexão e direcionamento de marca pessoal. Ele não é uma avaliação psicológica ou diagnóstico clínico.</p>
    </div>
  `;
  content.querySelector('#start-quiz').addEventListener('click', async () => {
    attempt = await getOrCreateActiveAttempt(clientId);
    responses = await getAttemptResponses(attempt.id);
    currentStep = 0;
    render();
  });
}

function statementFieldset(q) {
  const answered = responses.get(q.number);
  const isMissing = showMissingWarning && !answered;
  return `
    <fieldset class="mb-7" ${isMissing ? 'style="border-left:2px solid var(--terracotta); padding-left:14px; margin-left:-16px;"' : ''}>
      <legend class="text-base mb-3 leading-snug">${q.text}</legend>
      <div class="scale-row" role="radiogroup" aria-label="${q.text}">
        ${[1, 2, 3, 4, 5].map((v) => `
          <label class="scale-option">
            <input type="radio" name="q-${q.number}" value="${v}" data-question="${q.number}" ${answered === v ? 'checked' : ''} aria-label="${ARCHETYPE_SCALE_LABELS[v]}" />
            <span aria-hidden="true">${v}</span>
          </label>
        `).join('')}
      </div>
      ${isMissing ? '<p class="text-xs mt-2" style="color:var(--terracotta);">Ainda não respondida</p>' : ''}
    </fieldset>
  `;
}

function renderWizard() {
  const section = sections[currentStep];
  const answeredCount = responses.size;
  const pct = Math.round((answeredCount / questions.length) * 100);
  const isLastSection = currentStep === sections.length - 1;

  content.innerHTML = `
    <div class="max-w-2xl mx-auto">
      <div class="flex items-center justify-between mb-2">
        <p class="text-xs text-white/30">Etapa ${section.index} de ${sections.length} · Salvo automaticamente</p>
        <p class="text-xs text-white/30">${pct}% concluído</p>
      </div>
      <div class="progress-track mb-8"><div class="progress-fill" style="width:${pct}%;"></div></div>

      ${card(`
        <form id="wizard-form">
          ${section.questions.map((q) => statementFieldset(q)).join('')}
        </form>
      `, 'mb-6')}

      ${showMissingWarning ? `
        <p class="text-sm mb-4" style="color:var(--terracotta);">Ainda faltam afirmações para responder antes de concluir — veja acima e nas outras etapas.</p>
      ` : ''}

      <div class="flex items-center justify-between">
        <button type="button" id="wiz-back" class="btn-ghost" ${currentStep === 0 ? 'disabled' : ''}>&larr; Voltar</button>
        <div class="flex items-center gap-2">
          ${sections.map((s, i) => `<button type="button" data-jump="${i}" aria-label="Ir para etapa ${s.index}" class="rounded-full" style="width:8px;height:8px;padding:0;border:none;cursor:pointer;background:${i === currentStep ? 'var(--terracotta)' : 'var(--line)'};"></button>`).join('')}
        </div>
        <button type="button" id="wiz-next" class="btn-primary" style="padding:9px 20px;font-size:12.5px;">${isLastSection ? 'Concluir' : 'Próxima →'}</button>
      </div>
    </div>
  `;

  content.querySelectorAll('input[type="radio"]').forEach((input) => {
    input.addEventListener('change', async (e) => {
      const qNumber = Number(e.target.dataset.question);
      const score = Number(e.target.value);
      responses.set(qNumber, score);
      // Full re-render on every answer, same autosave pattern used by every
      // other wizard in this app (see value-analysis.js) — radios have no
      // cursor position to preserve, so this never feels jumpy in practice.
      render();
      try { await saveResponse(attempt.id, qNumber, score); }
      catch { toast('Não foi possível salvar esta resposta agora.', { tone: 'error' }); }
    });
  });

  content.querySelector('#wiz-back').addEventListener('click', () => {
    if (currentStep > 0) { currentStep--; showMissingWarning = false; render(); }
  });
  content.querySelectorAll('[data-jump]').forEach((btn) => {
    btn.addEventListener('click', () => { currentStep = Number(btn.dataset.jump); showMissingWarning = false; render(); });
  });
  content.querySelector('#wiz-next').addEventListener('click', async () => {
    if (!isLastSection) { currentStep++; showMissingWarning = false; render(); return; }
    const result = await submitAttempt(attempt.id, questions.length);
    if (!result.ok) {
      showMissingWarning = true;
      const firstMissing = result.missing[0];
      currentStep = sections.findIndex((s) => s.questions.some((q) => q.number === firstMissing));
      toast('Faltam algumas afirmações antes de concluir.', { tone: 'error' });
      render();
      return;
    }
    renderConfirmation();
  });
}

function renderConfirmation() {
  content.innerHTML = `
    <div class="max-w-md mx-auto text-center py-10">
      <p class="text-xs uppercase mb-4" style="color:var(--gold); letter-spacing:.12em;">✦</p>
      <h1 class="text-3xl font-serif mb-4">Seu mapa está pronto</h1>
      <p class="text-sm text-white/50 mb-8 leading-relaxed">Suas respostas foram analisadas e o resultado já está disponível.</p>
      <a href="arquetipos-resultado.html" class="btn-primary inline-block" style="padding:11px 24px;font-size:13px;">Ver meu resultado</a>
    </div>
  `;
}

async function render() {
  if (!attempt) {
    const latest = await getLatestAttempt(clientId);
    if (latest && latest.status === 'completed') { location.replace('arquetipos-resultado.html'); return; }
    if (latest && latest.status === 'in_progress') {
      attempt = latest;
      responses = await getAttemptResponses(attempt.id);
      renderWizard();
      return;
    }
    renderIntro();
    return;
  }
  renderWizard();
}

if (!questions.length) {
  content.innerHTML = card('<p class="text-white/50">O Teste de Arquétipos ainda não está disponível.</p>');
} else {
  render();
}
