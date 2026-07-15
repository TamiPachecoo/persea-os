import { MockDB, getActiveClientId } from '../shared/mock-db.js';
import { renderShell, card, toast, showMoodPrompt, stepEyebrow, initScrollReveal, initClientSwitcher } from '../shared/ui.js';

const activeClientId = getActiveClientId();
document.body.innerHTML = renderShell({ role: 'client', active: 'questionnaire.html', title: 'Questionário de Identidade' });
initClientSwitcher();

const q = MockDB.getQuestionnaire(activeClientId);
const content = document.getElementById('app-content');

function render() {
  content.innerHTML = `
    ${q.status === 'submitted' ? `
      <div class="mb-6 px-4 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-sm">
        Enviado. Você ainda pode revisar suas respostas abaixo.
      </div>
    ` : ''}
    <div class="space-y-6">
      ${q.questions.map((question, i) => `
        <div class="card reveal-scroll">
          ${stepEyebrow(i + 1, q.questions.length, 'Pergunta')}
          <p class="text-lg font-medium mb-4 mt-2">${question.text}</p>
          ${question.type === 'scale'
            ? `<input type="number" min="1" max="10" data-qid="${question.id}" value="${question.answer}" class="w-24 border border-white/15 rounded-lg px-3 py-2 focus:outline-none focus:border-white/40" />`
            : `<textarea data-qid="${question.id}" rows="3" class="w-full border border-white/15 rounded-lg px-4 py-3 focus:outline-none focus:border-white/40">${question.answer}</textarea>`
          }
        </div>
      `).join('')}
    </div>
    <div class="mt-8 flex justify-end">
      <button id="submit-btn" class="px-6 py-3 rounded-xl bg-white text-black font-medium hover:bg-white/90 transition-colors">
        ${q.status === 'submitted' ? 'Salvar Alterações' : 'Enviar Questionário'}
      </button>
    </div>
  `;

  content.querySelectorAll('[data-qid]').forEach((el) => {
    el.addEventListener('change', () => MockDB.saveAnswer(activeClientId, el.dataset.qid, el.value));
  });

  content.querySelector('#submit-btn').addEventListener('click', () => {
    const wasSubmitted = q.status === 'submitted';
    MockDB.submitQuestionnaire(activeClientId);
    q.status = 'submitted';
    toast(wasSubmitted ? 'Respostas atualizadas.' : 'Questionário enviado!');
    render();
    if (!wasSubmitted) {
      showMoodPrompt({
        label: 'Como você se sentiu respondendo o questionário?',
        onSelect: (mood) => MockDB.logMood(activeClientId, 'questionnaire_submitted', mood),
      });
    }
  });
  initScrollReveal();
}

render();
