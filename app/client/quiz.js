import { MockDB, getActiveClientId } from '../shared/mock-db.js';
import { renderShell, card, progressBar, showMoodPrompt, enableTilt, animateCount, initClientSwitcher } from '../shared/ui.js';

const activeClientId = getActiveClientId();
document.body.innerHTML = renderShell({ role: 'client', active: 'playbook.html', title: 'Quiz Rápido' });
initClientSwitcher();
const content = document.getElementById('app-content');

const questions = MockDB.buildQuizQuestions(activeClientId);
let step = 0;
let score = 0;
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
  document.getElementById('start-quiz').addEventListener('click', () => { step = 0; score = 0; renderQuestion(); });
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
  const correct = chosen === q.correct;
  if (correct) score += 1;
  document.querySelectorAll('[data-opt]').forEach((btn, idx) => {
    if (q.options[idx] === q.correct) btn.style.borderColor = 'var(--gold)';
    if (idx === i && !correct) btn.style.borderColor = 'var(--error)';
  });
  setTimeout(() => {
    if (step + 1 < questions.length) { step += 1; renderQuestion(); }
    else renderResult();
  }, 700);
}

function renderResult() {
  MockDB.submitQuiz(activeClientId, score, questions.length);
  const msg = resultMessage(score, questions.length);
  content.innerHTML = card(`
    <p style="font-size:2.4rem;" class="mb-3">${msg.emoji}</p>
    <p class="eyebrow mb-2">Resultado</p>
    <h2 class="pg-title mb-3" style="font-size:1.8rem;"><span id="score-counter">0</span> de ${questions.length}</h2>
    <p class="text-sm mb-6" style="color:var(--muted);">${msg.text}</p>
    <div class="flex gap-3">
      <a href="playbook.html" class="btn-primary">Voltar ao Playbook</a>
      <a href="pitch.html" class="btn-ghost">Ver Meu Pitch</a>
    </div>
  `);
  const scoreCounter = document.getElementById('score-counter');
  if (scoreCounter) animateCount(scoreCounter, score, { duration: 900 });
  showMoodPrompt({
    label: 'Como você se sentiu fazendo o quiz?',
    onSelect: (mood) => MockDB.logMood(activeClientId, 'quiz_completed', mood),
  });
}

if (!questions.length) {
  content.innerHTML = card(`<p class="text-white/50">Seu playbook ainda não está publicado — o quiz fica disponível assim que ele chegar até você.</p>`);
} else {
  renderIntro();
}
