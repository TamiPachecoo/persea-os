// Production Data Migration — Batch 2: converted off MockDB onto the real
// `questionnaires` + `questionnaire_questions` tables (client's own
// questions/answers live directly on questionnaire_questions.answer, one
// row per client's questionnaire — not shared reference data). RLS
// confirmed (questionnaire_questions_client_rw, full read/write scoped to
// profiles.client_id via the parent questionnaire) before writing this.
//
// Real bug found: this originally only ever READ an existing questionnaire
// — nothing anywhere (no admin/assistant page, no invite-client, nothing)
// ever INSERTED the first `questionnaires` row for a real client, so
// renderEmpty()'s "ainda não foi preparado" was actually a permanent dead
// end for every real client, forever, not a genuine "not ready yet" state.
// Fixed the same way client/arquetipos.js already handles the exact same
// shape of problem (see shared/archetype-model.js's getOrCreateActiveAttempt) —
// lazily create it client-side on first visit, RLS already allows it
// (questionnaires_client_rw/questionnaire_questions_client_rw are both
// `ALL`, scoped to her own client_id, confirmed via pg_policies before
// writing this). Unlike archetype's quiz questions (a real shared
// `archetype_quiz_questions` reference table), there is no equivalent
// reference table here — question text genuinely lives per-client-row by
// design (see comment above) — so the canonical starting questions are
// the same fixed "Extração de Marca" set already used for every demo
// client's fresh (unanswered) MockDB seed.
import { getCurrentClientContext } from '../shared/client-context.js';
import { supabase } from '../shared/supabase-client.js';
import { renderShell, card, toast, showMoodPrompt, stepEyebrow, initScrollReveal, initClientSwitcher } from '../shared/ui.js';

const QUESTIONNAIRE_TEMPLATE = [
  { question_text: 'Pelo que você quer ser conhecida daqui a 3 anos?', question_type: 'long_text' },
  { question_text: 'O que parece mais verdadeiro sobre quem você é agora?', question_type: 'long_text' },
  { question_text: 'Qual é a transformação que você ajuda as pessoas a fazerem?', question_type: 'long_text' },
  { question_text: 'Avalie sua confiança atual na sua marca pessoal (1-10)', question_type: 'scale' },
];

const __clientCtx = await getCurrentClientContext('../login.html', { page: 'questionnaire' });
if (!__clientCtx) throw new Error('not authorized');
const activeClientId = __clientCtx.clientId;
document.body.innerHTML = renderShell({ role: 'client', program: __clientCtx?.client?.program_slug, active: 'questionnaire.html', title: 'Extração de Marca' });
initClientSwitcher();

const content = document.getElementById('app-content');

async function createQuestionnaire() {
  const { data: created, error } = await supabase.from('questionnaires').insert({ client_id: activeClientId }).select().single();
  if (error) {
    // questionnaires.client_id is UNIQUE — a concurrent create (double
    // tab/double-fast-reload) races here exactly like contract prep did
    // (see admin/client-onboarding.js's prepareContract) — treat 23505 as
    // "already created, go read it" rather than a failure.
    if (error.code === '23505') {
      const { data: existing } = await supabase.from('questionnaires').select('*').eq('client_id', activeClientId).maybeSingle();
      return existing || null;
    }
    return null;
  }
  const { error: qErr } = await supabase.from('questionnaire_questions').insert(
    QUESTIONNAIRE_TEMPLATE.map((q, i) => ({ questionnaire_id: created.id, sort_order: i, ...q })),
  );
  if (qErr) return null;
  return created;
}

async function loadQuestionnaire() {
  let { data: q } = await supabase.from('questionnaires').select('*').eq('client_id', activeClientId).maybeSingle();
  if (!q) q = await createQuestionnaire();
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
