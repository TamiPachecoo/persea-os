import { MockDB, getActiveClientId } from '../shared/mock-db.js';
import { renderShell, card, progressBar, statusBadge, formatDateTime, toast, showMoodPrompt, stepEyebrow, animateCount, initClientSwitcher } from '../shared/ui.js';

const activeClientId = getActiveClientId();

function promptMoodIfNewlyCompleted(taskId, wasCompletedBefore) {
  const task = MockDB.getHomework(activeClientId).find((t) => t.id === taskId);
  if (task && task.status === 'completed' && !wasCompletedBefore) {
    showMoodPrompt({
      label: 'Como você se sente com essa tarefa concluída?',
      onSelect: (mood) => MockDB.logMood(activeClientId, 'homework_task', mood),
    });
  }
}

document.body.innerHTML = renderShell({ role: 'client', active: 'homework.html', title: 'Tarefas' });
initClientSwitcher();
const content = document.getElementById('app-content');

function renderMediaTask(t) {
  const subs = t.submissions || [];
  return `
    <p class="mb-3">${t.title}</p>
    <p class="text-xs text-white/30 mb-4">Grave um vídeo ou áudio praticando seu pitch e envie aqui — sua consultora vai assistir/ouvir e te dar feedback.</p>
    <label class="btn-ghost inline-block cursor-pointer mb-4">
      Enviar Gravação
      <input type="file" data-media="${t.id}" accept="audio/*,video/*" class="hidden" />
    </label>
    <div class="space-y-3">
      ${subs.length ? subs.map((s) => `
        <div class="rounded border p-3" style="border-color:var(--line);">
          <div class="flex items-center justify-between mb-2">
            <span class="text-xs" style="color:var(--muted);">${s.name} · ${formatDateTime(s.uploadedAt)}</span>
            <button data-remove-media="${t.id}:${s.id}" class="btn-text">Remover</button>
          </div>
          ${s.url
            ? (s.kind === 'video'
                ? `<video src="${s.url}" controls class="w-full rounded" style="max-height:220px;"></video>`
                : `<audio src="${s.url}" controls class="w-full"></audio>`)
            : `<p class="text-xs italic" style="color:var(--muted);">Gravação de sessão anterior — não reproduzível neste protótipo (sem armazenamento real).</p>`}
        </div>
      `).join('') : '<p class="text-sm" style="color:var(--muted);">Nenhuma gravação enviada ainda.</p>'}
    </div>
  `;
}

function render() {
  const tasks = MockDB.getHomework(activeClientId);
  const pct = MockDB.homeworkCompletionPct(activeClientId);

  content.innerHTML = `
    ${card(`
      <div class="flex items-center justify-between mb-3">
        <p class="text-sm text-white/50">Conclusão</p>
        <p class="text-sm font-medium"><span id="hw-pct-counter">0</span>%</p>
      </div>
      ${progressBar(pct)}
    `, 'mb-6')}
    <div class="space-y-4">
      ${tasks.map((t, i) => `
        <div class="card reveal" style="animation-delay:${(i * 0.08).toFixed(2)}s;">
          ${stepEyebrow(i + 1, tasks.length, 'Tarefa')}
          ${t.type === 'boolean' ? `
            <label class="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" data-toggle="${t.id}" ${t.status === 'completed' ? 'checked' : ''} class="w-5 h-5 rounded accent-[#e8c99b]" />
              <span class="${t.status === 'completed' ? 'line-through text-white/40' : ''}">${t.title}</span>
            </label>
          ` : t.type === 'media_upload' ? renderMediaTask(t) : `
            <p class="mb-3">${t.title}</p>
            <textarea data-submit="${t.id}" rows="3" class="field" placeholder="Escreva sua reflexão...">${t.submission || ''}</textarea>
          `}
        </div>
      `).join('')}
    </div>
  `;

  content.querySelectorAll('[data-toggle]').forEach((el) => {
    el.addEventListener('change', () => {
      const wasCompleted = tasks.find((t) => t.id === el.dataset.toggle)?.status === 'completed';
      MockDB.toggleHomework(activeClientId, el.dataset.toggle);
      render();
      promptMoodIfNewlyCompleted(el.dataset.toggle, wasCompleted);
    });
  });
  content.querySelectorAll('[data-submit]').forEach((el) => {
    el.addEventListener('blur', () => {
      const wasCompleted = tasks.find((t) => t.id === el.dataset.submit)?.status === 'completed';
      MockDB.submitHomeworkText(activeClientId, el.dataset.submit, el.value);
      render();
      promptMoodIfNewlyCompleted(el.dataset.submit, wasCompleted);
    });
  });
  content.querySelectorAll('[data-media]').forEach((el) => {
    el.addEventListener('change', () => {
      const file = el.files[0];
      if (!file) return;
      const wasCompleted = tasks.find((t) => t.id === el.dataset.media)?.status === 'completed';
      MockDB.addHomeworkMedia(activeClientId, el.dataset.media, file);
      toast('Gravação enviada!');
      render();
      promptMoodIfNewlyCompleted(el.dataset.media, wasCompleted);
    });
  });
  content.querySelectorAll('[data-remove-media]').forEach((el) => {
    el.addEventListener('click', () => {
      const [taskId, subId] = el.dataset.removeMedia.split(':');
      MockDB.removeHomeworkMedia(activeClientId, taskId, subId);
      render();
    });
  });

  const counterEl = document.getElementById('hw-pct-counter');
  if (counterEl) animateCount(counterEl, pct, { duration: 700 });
}

render();
