import { MockDB } from '../shared/mock-db.js';
import { renderShell, card, toast } from '../shared/ui.js';

document.body.innerHTML = renderShell({ role: 'client', active: 'questionnaire.html', title: 'Identity Questionnaire' });

const q = MockDB.getQuestionnaire();
const content = document.getElementById('app-content');

function render() {
  content.innerHTML = `
    ${q.status === 'submitted' ? `
      <div class="mb-6 px-4 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-sm">
        Submitted. You can still review your answers below.
      </div>
    ` : ''}
    <div class="space-y-6">
      ${q.questions.map((question, i) => `
        <div class="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          <label class="block text-sm text-white/50 mb-3">Question ${i + 1} of ${q.questions.length}</label>
          <p class="text-lg font-medium mb-4">${question.text}</p>
          ${question.type === 'scale'
            ? `<input type="number" min="1" max="10" data-qid="${question.id}" value="${question.answer}" class="w-24 border border-white/15 rounded-lg px-3 py-2 focus:outline-none focus:border-white/40" />`
            : `<textarea data-qid="${question.id}" rows="3" class="w-full border border-white/15 rounded-lg px-4 py-3 focus:outline-none focus:border-white/40">${question.answer}</textarea>`
          }
        </div>
      `).join('')}
    </div>
    <div class="mt-8 flex justify-end">
      <button id="submit-btn" class="px-6 py-3 rounded-xl bg-white text-black font-medium hover:bg-white/90 transition-colors">
        ${q.status === 'submitted' ? 'Save Changes' : 'Submit Questionnaire'}
      </button>
    </div>
  `;

  content.querySelectorAll('[data-qid]').forEach((el) => {
    el.addEventListener('change', () => MockDB.saveAnswer(el.dataset.qid, el.value));
  });

  content.querySelector('#submit-btn').addEventListener('click', () => {
    const wasSubmitted = q.status === 'submitted';
    MockDB.submitQuestionnaire();
    q.status = 'submitted';
    toast(wasSubmitted ? 'Answers updated.' : 'Questionnaire submitted!');
    render();
  });
}

render();
