// Production Data Migration — Batch 3, Priority 4: converted off MockDB
// onto real `homework_tasks` + `homework_submissions` (exact column/status
// vocabulary match — task_type: boolean/media_upload/text_submission,
// status: pending/completed). Media uploads now go to the real
// `client-uploads` Storage bucket (path
// ${clientId}/homework/${taskId}/${filename}), same bucket/RLS added for
// client/images.js this pass — no separate storage system invented.
// Mood-log prompt kept as UI-only (no MockDB.logMood call) — wiring it to
// the real `mood_log` table wasn't in scope for this batch.
import { getCurrentClientContext } from '../shared/client-context.js';
import { supabase } from '../shared/supabase-client.js';
import { renderShell, card, progressBar, formatDateTime, toast, showMoodPrompt, stepEyebrow, animateCount, initClientSwitcher } from '../shared/ui.js';

const __clientCtx = await getCurrentClientContext('../login.html', { page: 'homework' });
if (!__clientCtx) throw new Error('not authorized');
const activeClientId = __clientCtx.clientId;
const BUCKET = 'client-uploads';

document.body.innerHTML = renderShell({ role: 'client', active: 'homework.html', title: 'Tarefas' });
initClientSwitcher();
const content = document.getElementById('app-content');

function promptMoodIfNewlyCompleted(wasCompletedBefore, isCompletedNow) {
  if (isCompletedNow && !wasCompletedBefore) {
    showMoodPrompt({ label: 'Como você se sente com essa tarefa concluída?', onSelect: () => {} });
  }
}

async function loadTasks() {
  const { data: tasks } = await supabase.from('homework_tasks').select('*').eq('client_id', activeClientId).order('sort_order');
  const rows = tasks || [];
  const mediaTaskIds = rows.filter((t) => t.task_type === 'media_upload').map((t) => t.id);
  const { data: submissions } = mediaTaskIds.length
    ? await supabase.from('homework_submissions').select('*').in('homework_task_id', mediaTaskIds)
    : { data: [] };
  const subsByTask = new Map();
  (submissions || []).forEach((s) => {
    if (!subsByTask.has(s.homework_task_id)) subsByTask.set(s.homework_task_id, []);
    subsByTask.get(s.homework_task_id).push(s);
  });
  return rows.map((t) => ({ ...t, submissions: subsByTask.get(t.id) || [] }));
}

function completionPct(tasks) {
  if (!tasks.length) return 0;
  return Math.round((tasks.filter((t) => t.status === 'completed').length / tasks.length) * 100);
}

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
        <div class="rounded border p-3" style="border-color:var(--line);" data-signed-slot="${s.id}">
          <div class="flex items-center justify-between mb-2">
            <span class="text-xs" style="color:var(--muted);">${s.file_name} · ${formatDateTime(s.uploaded_at)}</span>
            <button data-remove-media="${s.id}" data-remove-path="${s.file_url}" class="btn-text">Remover</button>
          </div>
          <p class="text-xs italic" style="color:var(--muted);">Carregando pré-visualização…</p>
        </div>
      `).join('') : '<p class="text-sm" style="color:var(--muted);">Nenhuma gravação enviada ainda.</p>'}
    </div>
  `;
}

// Signed URLs are fetched after the initial paint (private bucket — no
// direct URL to embed synchronously) so the list renders immediately
// instead of blocking on N storage round-trips first.
async function hydrateMediaPreviews(tasks) {
  for (const t of tasks) {
    for (const s of t.submissions || []) {
      const slot = content.querySelector(`[data-signed-slot="${s.id}"]`);
      if (!slot) continue;
      const { data } = await supabase.storage.from(BUCKET).createSignedUrl(s.file_url, 3600);
      if (!data?.signedUrl) continue;
      const preview = slot.querySelector('p.italic');
      if (preview) {
        preview.outerHTML = s.kind === 'video'
          ? `<video src="${data.signedUrl}" controls class="w-full rounded" style="max-height:220px;"></video>`
          : `<audio src="${data.signedUrl}" controls class="w-full"></audio>`;
      }
    }
  }
}

async function render() {
  const tasks = await loadTasks();
  const pct = completionPct(tasks);

  content.innerHTML = tasks.length ? `
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
          ${t.task_type === 'boolean' ? `
            <label class="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" data-toggle="${t.id}" ${t.status === 'completed' ? 'checked' : ''} class="w-5 h-5 rounded accent-[#e8c99b]" />
              <span class="${t.status === 'completed' ? 'line-through text-white/40' : ''}">${t.title}</span>
            </label>
          ` : t.task_type === 'media_upload' ? renderMediaTask(t) : `
            <p class="mb-3">${t.title}</p>
            <textarea data-submit="${t.id}" rows="3" class="field" placeholder="Escreva sua reflexão...">${t.submission_text || ''}</textarea>
          `}
        </div>
      `).join('')}
    </div>
  ` : card('<p class="text-sm" style="color:var(--muted);">Nenhuma atividade disponível no momento.</p>');

  if (!tasks.length) return;

  content.querySelectorAll('[data-toggle]').forEach((el) => {
    el.addEventListener('change', async () => {
      const task = tasks.find((t) => t.id === el.dataset.toggle);
      const wasCompleted = task?.status === 'completed';
      const newStatus = wasCompleted ? 'pending' : 'completed';
      const { error } = await supabase.from('homework_tasks').update({ status: newStatus }).eq('id', el.dataset.toggle);
      if (error) { toast('Não foi possível salvar agora.', { tone: 'error' }); return; }
      await render();
      promptMoodIfNewlyCompleted(wasCompleted, newStatus === 'completed');
    });
  });
  content.querySelectorAll('[data-submit]').forEach((el) => {
    el.addEventListener('blur', async () => {
      const task = tasks.find((t) => t.id === el.dataset.submit);
      const wasCompleted = task?.status === 'completed';
      const isCompleted = el.value.trim().length > 0;
      const { error } = await supabase.from('homework_tasks').update({
        submission_text: el.value, status: isCompleted ? 'completed' : 'pending',
      }).eq('id', el.dataset.submit);
      if (error) { toast('Não foi possível salvar agora.', { tone: 'error' }); return; }
      await render();
      promptMoodIfNewlyCompleted(wasCompleted, isCompleted);
    });
  });
  content.querySelectorAll('[data-media]').forEach((el) => {
    el.addEventListener('change', async () => {
      const file = el.files[0];
      if (!file) return;
      const taskId = el.dataset.media;
      const task = tasks.find((t) => t.id === taskId);
      const wasCompleted = task?.status === 'completed';
      const kind = file.type.startsWith('video/') ? 'video' : 'audio';
      const path = `${activeClientId}/homework/${taskId}/${Date.now()}-${file.name}`;
      const { error: uploadErr } = await supabase.storage.from(BUCKET).upload(path, file);
      if (uploadErr) { toast('Não foi possível enviar a gravação.', { tone: 'error' }); return; }
      const { error: insertErr } = await supabase.from('homework_submissions').insert({
        homework_task_id: taskId, kind, file_name: file.name, file_url: path,
      });
      if (insertErr) { toast('Gravação enviada, mas houve um erro ao registrá-la.', { tone: 'error' }); return; }
      await supabase.from('homework_tasks').update({ status: 'completed' }).eq('id', taskId);
      toast('Gravação enviada!');
      await render();
      promptMoodIfNewlyCompleted(wasCompleted, true);
    });
  });
  content.querySelectorAll('[data-remove-media]').forEach((el) => {
    el.addEventListener('click', async () => {
      await supabase.storage.from(BUCKET).remove([el.dataset.removePath]);
      await supabase.from('homework_submissions').delete().eq('id', el.dataset.removeMedia);
      render();
    });
  });

  const counterEl = document.getElementById('hw-pct-counter');
  if (counterEl) animateCount(counterEl, pct, { duration: 700 });
  hydrateMediaPreviews(tasks);
}

render();
