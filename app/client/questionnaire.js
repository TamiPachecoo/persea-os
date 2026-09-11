// Production Data Migration — Batch 2: converted off MockDB onto the real
// `questionnaires` + `questionnaire_questions` tables (client's own
// questions/answers live directly on questionnaire_questions.answer, one
// row per client's questionnaire — not shared reference data). RLS
// confirmed (questionnaire_questions_client_rw, full read/write scoped to
// profiles.client_id via the parent questionnaire) before writing this.
import { getCurrentClientContext } from '../shared/client-context.js';
import { supabase } from '../shared/supabase-client.js';
import { renderShell, card, toast, showMoodPrompt, stepEyebrow, initScrollReveal, initClientSwitcher } from '../shared/ui.js';

const __clientCtx = await getCurrentClientContext('../login.html', { page: 'questionnaire' });
if (!__clientCtx) throw new Error('not authorized');
const activeClientId = __clientCtx.clientId;
document.body.innerHTML = renderShell({ role: 'client', active: 'questionnaire.html', title: 'Extração de Marca' });
initClientSwitcher();

const content = document.getElementById('app-content');

async function loadQuestionnaire() {
  const { data: q } = await supabase.from('questionnaires').select('*').eq('client_id', activeClientId).maybeSingle();
  if (!q) return null;
  const { data: questions } = await supabase.from('questionnaire_questions').select('*').eq('questionnaire_id', q.id).order('sort_order');
  return { ...q, questions: questions || [] };
}

let q = await loadQuestionnaire();
// Once submitted, this opens straight into "just the answers" — the form
// itself only comes back if she explicitly asks to edit (see #edit-answers).
let editing = !q || q.status !== 'submitted';

function renderEmpty() {
  content.innerHTML = card('<p class="text-sm" style="color:var(--muted);">Seu questionário ainda não foi preparado — ele aparecerá aqui assim que sua consultora liberá-lo.</p>');
}

function renderReadOnly() {
  content.innerHTML = `
    <div class="mb-6 px-4 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-sm flex items-center justify-between gap-3 flex-wrap">
      <span>Enviado — suas respostas estão registradas.</span>
      <button type="button" id="edit-answers" class="btn-text" style="color:inherit; text-decoration:underline;">Editar respostas</button>
    </div>
    <div class="space-y-4">
      ${q.questions.map((question) => `
        <div class="card">
          <p class="text-sm text-white/40 mb-1">${question.question_text}</p>
          <p class="text-white/90">${question.answer || '—'}</p>
        </div>
      `).join('')}
    </div>
  `;
  content.querySelector('#edit-answers').addEventListener('click', () => { editing = true; render(); });
}

function renderForm() {
  content.innerHTML = `
    ${q.status === 'submitted' ? `
      <div class="mb-6 px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white/60 text-sm">
        Editando suas respostas já enviadas.
      </div>
    ` : ''}
    <div class="space-y-6">
      ${q.questions.map((question, i) => `
        <div class="card reveal-scroll">
          ${stepEyebrow(i + 1, q.questions.length, 'Pergunta')}
          <p class="text-lg font-medium mb-4 mt-2">${question.question_text}</p>
          ${question.question_type === 'scale'
            ? `<input type="number" min="1" max="10" data-qid="${question.id}" value="${question.answer || ''}" class="w-24 border border-white/15 rounded-lg px-3 py-2 focus:outline-none focus:border-white/40" />`
            : `<textarea data-qid="${question.id}" rows="3" class="w-full border border-white/15 rounded-lg px-4 py-3 focus:outline-none focus:border-white/40">${question.answer || ''}</textarea>`
          }
        </div>
      `).join('')}
    </div>
    <div class="mt-8 flex justify-end gap-3">
      ${q.status === 'submitted' ? '<button id="cancel-edit" class="px-6 py-3 rounded-xl border border-white/15 text-white/60 hover:text-white transition-colors">Cancelar</button>' : ''}
      <button id="submit-btn" class="px-6 py-3 rounded-xl bg-white text-black font-medium hover:bg-white/90 transition-colors">
        ${q.status === 'submitted' ? 'Salvar Alterações' : 'Enviar Questionário'}
      </button>
    </div>
  `;

  content.querySelectorAll('[data-qid]').forEach((el) => {
    el.addEventListener('change', async () => {
      await supabase.from('questionnaire_questions').update({ answer: el.value }).eq('id', el.dataset.qid);
    });
  });

  content.querySelector('#cancel-edit')?.addEventListener('click', () => { editing = false; render(); });
  content.querySelector('#submit-btn').addEventListener('click', async () => {
    const wasSubmitted = q.status === 'submitted';
    const { error } = await supabase.from('questionnaires').update({ status: 'submitted' }).eq('id', q.id);
    if (error) { toast('Não foi possível enviar agora.', { tone: 'error' }); return; }
    q.status = 'submitted';
    editing = false;
    toast(wasSubmitted ? 'Respostas atualizadas.' : 'Questionário enviado!');
    render();
    if (!wasSubmitted) {
      showMoodPrompt({
        label: 'Como você se sentiu respondendo o questionário?',
        onSelect: () => {}, // mood log (mood_log table) not yet wired for production — no-op rather than a MockDB call
      });
    }
  });
  initScrollReveal();
}

function render() {
  if (!q) { renderEmpty(); return; }
  if (q.status === 'submitted' && !editing) renderReadOnly();
  else renderForm();
}

render();
