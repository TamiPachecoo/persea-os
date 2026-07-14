import { MockDB } from '../shared/mock-db.js';
import { renderShell, card, progressBar } from '../shared/ui.js';

document.body.innerHTML = renderShell({ role: 'client', active: 'homework.html', title: 'Tarefas' });
const content = document.getElementById('app-content');

function render() {
  const tasks = MockDB.getHomework();
  const pct = MockDB.homeworkCompletionPct();

  content.innerHTML = `
    ${card(`
      <div class="flex items-center justify-between mb-3">
        <p class="text-sm text-white/50">Conclusão</p>
        <p class="text-sm font-medium">${pct}%</p>
      </div>
      ${progressBar(pct)}
    `, 'mb-6')}
    <div class="space-y-4">
      ${tasks.map((t) => `
        <div class="card">
          ${t.type === 'boolean' ? `
            <label class="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" data-toggle="${t.id}" ${t.status === 'completed' ? 'checked' : ''} class="w-5 h-5 rounded accent-[#e8c99b]" />
              <span class="${t.status === 'completed' ? 'line-through text-white/40' : ''}">${t.title}</span>
            </label>
          ` : `
            <p class="mb-3">${t.title}</p>
            <textarea data-submit="${t.id}" rows="3" class="w-full bg-transparent border border-white/15 rounded-lg px-4 py-3 focus:outline-none focus:border-white/40" placeholder="Escreva sua reflexão...">${t.submission || ''}</textarea>
          `}
        </div>
      `).join('')}
    </div>
  `;

  content.querySelectorAll('[data-toggle]').forEach((el) => {
    el.addEventListener('change', () => { MockDB.toggleHomework(el.dataset.toggle); render(); });
  });
  content.querySelectorAll('[data-submit]').forEach((el) => {
    el.addEventListener('blur', () => { MockDB.submitHomeworkText(el.dataset.submit, el.value); render(); });
  });
}

render();
