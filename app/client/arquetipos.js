// Teste de Arquétipos — the client-facing quiz-taking flow: intro, a 6-
// section wizard (8 statements each, autosaved per answer), and a calm
// confirmation screen. Scoring never happens here — see mock-db.js's
// calcArchetypeScores/submitArchetypeQuiz, the actual trust boundary.
// Reached from the Program Hub's "Teste de Arquétipos" activity card
// (see PROGRAM_ACTIVITIES in mock-db.js) — one route for every state
// (not started / resuming / already done), matching how every other
// Program Hub activity in this app works.
import {
  MockDB, getActiveClientId, ARCHETYPE_QUIZ_SECTIONS, ARCHETYPE_SCALE_LABELS,
} from '../shared/mock-db.js';
import { renderShell, card, toast, initClientSwitcher } from '../shared/ui.js';

const clientId = getActiveClientId();
document.body.innerHTML = renderShell({ role: 'client', active: 'program.html', title: 'Teste de Arquétipos' });
initClientSwitcher();
const content = document.getElementById('app-content');

let currentStep = 0; // 0..5 = a section (ARCHETYPE_QUIZ_SECTIONS is 6 sections of 8)
let showMissingWarning = false;

// Dev-only preview controls — no real auth/profile data yet to drive these
// states naturally. Removable wholesale once that's connected; see
// MockDB.devSimulateArchetype*/devSetArchetypeGender (mock-db.js).
function renderDevPanel() {
  return `
    <div class="dev-preview-panel max-w-2xl mx-auto">
      <p class="text-xs uppercase tracking-[.12em] mb-3" style="color:var(--muted);">🧪 Controles da demonstração (dev, removível)</p>
      <div class="flex flex-wrap gap-2">
        <button type="button" data-dev="female" class="btn-ghost" style="padding:6px 12px;font-size:11.5px;">Simular cliente feminina</button>
        <button type="button" data-dev="male" class="btn-ghost" style="padding:6px 12px;font-size:11.5px;">Simular cliente masculina</button>
        <button type="button" data-dev="progress" class="btn-ghost" style="padding:6px 12px;font-size:11.5px;">Simular teste em andamento</button>
        <button type="button" data-dev="reset" class="btn-ghost" style="padding:6px 12px;font-size:11.5px;">Reiniciar teste</button>
      </div>
    </div>
  `;
}
function wireDevPanel() {
  content.querySelectorAll('[data-dev]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const action = btn.dataset.dev;
      if (action === 'female') MockDB.devSetArchetypeGender(clientId, 'feminino');
      if (action === 'male') MockDB.devSetArchetypeGender(clientId, 'masculino');
      if (action === 'progress') MockDB.devSimulateArchetypeInProgress(clientId);
      if (action === 'reset') MockDB.devResetArchetypeQuiz(clientId);
      currentStep = 0;
      toast('Estado da demonstração atualizado.');
      render();
    });
  });
}

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
      ${renderDevPanel()}
    </div>
  `;
  content.querySelector('#start-quiz').addEventListener('click', () => {
    MockDB.getOrCreateActiveArchetypeAttempt(clientId);
    currentStep = 0;
    render();
  });
  wireDevPanel();
}

function statementFieldset(q, attempt) {
  const answered = attempt.responses[q.number];
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

function renderWizard(attempt) {
  const section = ARCHETYPE_QUIZ_SECTIONS[currentStep];
  const progress = MockDB.getArchetypeAttemptProgress(attempt);
  const isLastSection = currentStep === ARCHETYPE_QUIZ_SECTIONS.length - 1;

  content.innerHTML = `
    <div class="max-w-2xl mx-auto">
      <div class="flex items-center justify-between mb-2">
        <p class="text-xs text-white/30">Etapa ${section.index} de ${ARCHETYPE_QUIZ_SECTIONS.length} · Salvo automaticamente</p>
        <p class="text-xs text-white/30">${progress.pct}% concluído</p>
      </div>
      <div class="progress-track mb-8"><div class="progress-fill" style="width:${progress.pct}%;"></div></div>

      ${card(`
        <form id="wizard-form">
          ${section.questions.map((q) => statementFieldset(q, attempt)).join('')}
        </form>
      `, 'mb-6')}

      ${showMissingWarning ? `
        <p class="text-sm mb-4" style="color:var(--terracotta);">Ainda faltam afirmações para responder antes de concluir — veja acima e nas outras etapas.</p>
      ` : ''}

      <div class="flex items-center justify-between">
        <button type="button" id="wiz-back" class="btn-ghost" ${currentStep === 0 ? 'disabled' : ''}>&larr; Voltar</button>
        <div class="flex items-center gap-2">
          ${ARCHETYPE_QUIZ_SECTIONS.map((s, i) => `<button type="button" data-jump="${i}" aria-label="Ir para etapa ${s.index}" class="rounded-full" style="width:8px;height:8px;padding:0;border:none;cursor:pointer;background:${i === currentStep ? 'var(--terracotta)' : 'var(--line)'};"></button>`).join('')}
        </div>
        <button type="button" id="wiz-next" class="btn-primary" style="padding:9px 20px;font-size:12.5px;">${isLastSection ? 'Concluir' : 'Próxima →'}</button>
      </div>
    </div>
  `;

  content.querySelectorAll('input[type="radio"]').forEach((input) => {
    input.addEventListener('change', (e) => {
      MockDB.saveArchetypeResponse(clientId, attempt.id, Number(e.target.dataset.question), Number(e.target.value));
      // Full re-render on every answer, same autosave pattern used by every
      // other wizard in this app (see value-analysis.js) — radios have no
      // cursor position to preserve, so this never feels jumpy in practice.
      render();
    });
  });

  content.querySelector('#wiz-back').addEventListener('click', () => {
    if (currentStep > 0) { currentStep--; showMissingWarning = false; render(); }
  });
  content.querySelectorAll('[data-jump]').forEach((btn) => {
    btn.addEventListener('click', () => { currentStep = Number(btn.dataset.jump); showMissingWarning = false; render(); });
  });
  content.querySelector('#wiz-next').addEventListener('click', () => {
    if (!isLastSection) { currentStep++; showMissingWarning = false; render(); return; }
    const result = MockDB.submitArchetypeQuiz(clientId, attempt.id);
    if (!result.ok) {
      showMissingWarning = true;
      // Jump to the first section containing a missing answer.
      const firstMissing = result.missing[0];
      currentStep = ARCHETYPE_QUIZ_SECTIONS.findIndex((s) => s.questions.some((q) => q.number === firstMissing));
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

function render() {
  const quiz = MockDB.getClientArchetypeQuiz(clientId);
  const latest = quiz.attempts[quiz.attempts.length - 1];

  if (latest && latest.status === 'completed') {
    // Already has a result — this page's job here is done; the results
    // page is the one dedicated place to view it.
    location.replace('arquetipos-resultado.html');
    return;
  }
  if (latest && latest.status === 'in_progress') {
    renderWizard(latest);
    return;
  }
  renderIntro();
}

render();
