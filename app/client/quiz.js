// Quiz Rápido do Playbook — Production Migration: Playbook + Quiz + Notes.
// This is the PLAYBOOK comprehension quiz (buildQuizQuestions derives its
// questions from the real published playbook sections) — not the Teste de
// Arquétipos (archetype_quiz_* tables, a completely separate feature; see
// shared/archetype-model.js). Real Supabase via shared/playbook-model.js.
// Scoring is recomputed server-round-trip-fresh from the real published
// sections at submit time (submitQuizResult), never trusted as a bare
// client-supplied integer — see that module's header comment.
import { getCurrentClientContext } from '../shared/client-context.js';
import { renderShell, card, progressBar, showMoodPrompt, enableTilt, animateCount, initClientSwitcher } from '../shared/ui.js';
import { getPublishedPlaybook, getQuizResult, buildQuizQuestions, submitQuizResult } from '../shared/playbook-model.js';

const __clientCtx = await getCurrentClientContext('../login.html', { page: 'quiz' });
if (!__clientCtx) throw new Error('not authorized');
const clientId = __clientCtx.clientId;
document.body.innerHTML = renderShell({ role: 'client', active: 'playbook.html', title: 'Quiz Rápido' });
initClientSwitcher();
const content = document.getElementById('app-content');

const playbook = await getPublishedPlaybook(clientId);
const questions = playbook ? buildQuizQuestions(playbook.sections) : [];
let step = 0;
let answers = {};
let answered = false;

function resultMessage(score, total) {
  const pct = score / total;
  if (pct === 1) return { emoji: '🌟', text: 'Perfeito! Você já pensa exatamente como a sua nova marca.' };
  if (pct >= 0.5) return { emoji: '✨', text: 'Muito bem! Já está internalizando o essencial do seu playbook.' };
  return { emoji: '💛', text: 'Vale reler o playbook com calma — a essência ainda está se assentando, e tudo bem.' };
}

function renderIntro() {
  content.innerHTML = card(`
    <p class="eyebrow mb-2">Antes de seguir</p>
    <h2 class="pg-title mb-3" style="font-size:1.6rem;">Você absorveu a essência do seu playbook?</h2>
    <p class="text-sm mb-6" style="color:var(--muted);">${questions.length} perguntinhas rápidas, sem pegadinha — é só para fixar o que é seu.</p>
    <button id="start-quiz" class="btn-primary">Começar</button>
  `);
  document.getElementById('start-quiz').addEventListener('click', () => { step = 0; answers = {}; renderQuestion(); });
}

function renderQuestion() {
  answered = false;
  const q = questions[step];
  content.innerHTML = `
    ${card(`
      <p class="text-xs mb-3" style="color:var(--muted);">Pergunta ${step + 1} de ${questions.length}</p>
      ${progressBar(Math.round((step / questions.length) * 100))}
      <h2 class="pg-title mt-5 mb-6" style="font-size:1.4rem;">${q.question}</h2>
      <div class="space-y-3" id="options">
        ${q.options.map((opt, i) => `<button data-opt="${i}" class="card tilt-card text-left w-full" style="cursor:pointer;">${opt}</button>`).join('')}
      </div>
    `)}
  `;
  document.querySelectorAll('[data-opt]').forEach((btn, i) => {
    btn.addEventListener('click', () => selectOption(q, i));
  });
  enableTilt();
}

function selectOption(q, i) {
  if (answered) return;
  answered = true;
  const chosen = q.options[i];
  answers[q.key] = chosen;
  const correct = chosen === q.correct;
  document.querySelectorAll('[data-opt]').forEach((btn, idx) => {
    if (q.options[idx] === q.correct) btn.style.borderColor = 'var(--gold)';
    if (idx === i && !correct) btn.style.borderColor = 'var(--error)';
  });
  setTimeout(() => {
    if (step + 1 < questions.length) { step += 1; renderQuestion(); }
    else renderResult();
  }, 700);
}

async function renderResult() {
  let result;
  try { result = await submitQuizResult(clientId, playbook.sections, answers); }
  catch { content.innerHTML = card('<p class="text-sm" style="color:var(--terracotta);">Não foi possível salvar seu resultado agora. Tente novamente.</p>'); return; }
  const msg = resultMessage(result.score, result.total);
  content.innerHTML = card(`
    <p style="font-size:2.4rem;" class="mb-3">${msg.emoji}</p>
    <p class="eyebrow mb-2">Resultado</p>
    <h2 class="pg-title mb-3" style="font-size:1.8rem;"><span id="score-counter">0</span> de ${result.total}</h2>
    <p class="text-sm mb-6" style="color:var(--muted);">${msg.text}</p>
    <div class="flex gap-3">
      <a href="playbook.html" class="btn-primary">Voltar ao Playbook</a>
      <a href="pitch.html" class="btn-ghost">Ver Meu Pitch</a>
    </div>
  `);
  const scoreCounter = document.getElementById('score-counter');
  if (scoreCounter) animateCount(scoreCounter, result.score, { duration: 900 });
  showMoodPrompt({ label: 'Como você se sentiu fazendo o quiz?', onSelect: () => {} });
}

if (!playbook) {
  content.innerHTML = card(`<p class="text-white/50">Seu Playbook precisa estar disponível antes de iniciar esta atividade.</p>`);
} else if (!questions.length) {
  content.innerHTML = card(`<p class="text-white/50">Seu playbook ainda não está publicado — o quiz fica disponível assim que ele chegar até você.</p>`);
} else {
  const existing = await getQuizResult(clientId);
  if (existing) {
    const msg = resultMessage(existing.score, existing.total);
    content.innerHTML = card(`
      <p style="font-size:2.4rem;" class="mb-3">${msg.emoji}</p>
      <p class="eyebrow mb-2">Resultado</p>
      <h2 class="pg-title mb-3" style="font-size:1.8rem;">${existing.score} de ${existing.total}</h2>
      <p class="text-sm mb-6" style="color:var(--muted);">${msg.text}</p>
      <div class="flex gap-3">
        <button id="retry-quiz" class="btn-ghost">Refazer o quiz</button>
        <a href="playbook.html" class="btn-primary">Voltar ao Playbook</a>
      </div>
    `);
    document.getElementById('retry-quiz').addEventListener('click', () => { step = 0; answers = {}; renderQuestion(); });
  } else {
    renderIntro();
  }
}
