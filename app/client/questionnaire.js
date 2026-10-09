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
// the Diagnóstico Estratégico de Entrada (shared/diagnostic-template.js),
// which replaced the original 4-question "Extração de Marca" in Oct 2026;
// questionnaires created before that keep their own questions.
import { getCurrentClientContext } from '../shared/client-context.js';
import { supabase } from '../shared/supabase-client.js';
import { renderShell, card, toast, showMoodPrompt, initScrollReveal, initClientSwitcher } from '../shared/ui.js';
import {
  DIAGNOSTIC_TITLE, DIAGNOSTIC_SUBTITLE, DIAGNOSTIC_INTRO, DIAGNOSTIC_TIME, DIAGNOSTIC_CLOSING,
  DIAGNOSTIC_QUESTIONS, SECTION_NOTES, groupBySection,
} from '../shared/diagnostic-template.js';

const __clientCtx = await getCurrentClientContext('../login.html', { page: 'questionnaire' });
if (!__clientCtx) throw new Error('not authorized');
const activeClientId = __clientCtx.clientId;
document.body.innerHTML = renderShell({ role: 'client', program: __clientCtx?.client?.program_slug, active: 'questionnaire.html', title: DIAGNOSTIC_TITLE });
initClientSwitcher();

const content = document.getElementById('app-content');
const esc = (v) => String(v ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const filled = (v) => String(v ?? '').trim() !== '';

async function createQuestionnaire() {
  const { data: created, error } = await supabase.from('questionnaires').insert({ client_id: activeClientId, title: DIAGNOSTIC_TITLE }).select().single();
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
    DIAGNOSTIC_QUESTIONS.map((q, i) => ({ questionnaire_id: created.id, sort_order: i, ...q })),
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
const isDiagnostic = () => q.questions.some((x) => x.section);

function renderEmpty() {
  content.innerHTML = card('<p class="text-sm" style="color:var(--muted);">Seu questionário ainda não foi preparado — ele aparecerá aqui assim que sua consultora liberá-lo.</p>');
}

function introHtml() {
  if (!isDiagnostic()) return `<div class="mb-8"><h1 class="text-3xl font-serif">${esc(q.title || 'Questionário')}</h1></div>`;
  return `
    <div class="mb-10 max-w-2xl">
      <p class="text-xs uppercase mb-3" style="color:var(--terracotta);letter-spacing:.28em;">${DIAGNOSTIC_TITLE}</p>
      <h1 class="text-3xl md:text-4xl font-serif mb-5">${DIAGNOSTIC_SUBTITLE}</h1>
      ${DIAGNOSTIC_INTRO.map((t) => `<p class="text-white/70 mb-3" style="line-height:1.7;">${t}</p>`).join('')}
      <p class="text-sm mt-4" style="color:var(--gold);">${DIAGNOSTIC_TIME}</p>
    </div>`;
}

const sectionHead = (g, i) => g.name ? `
  <div class="mt-10 mb-4 reveal-scroll">
    <p class="text-xs uppercase" style="color:var(--terracotta);letter-spacing:.24em;">Parte ${i + 1}</p>
    <h2 class="text-2xl font-serif mt-1">${esc(g.name)}</h2>
    ${SECTION_NOTES[g.name] ? `<p class="text-sm text-white/50 mt-2">${SECTION_NOTES[g.name]}</p>` : ''}
  </div>` : '';

const scaleLabels = (x) => (x.min_label || x.max_label) ? `
  <div class="flex justify-between gap-4 text-xs text-white/40 mt-2" style="line-height:1.4;">
    <span style="max-width:45%;">0 = ${esc(x.min_label)}</span><span style="max-width:45%;text-align:right;">10 = ${esc(x.max_label)}</span>
  </div>` : '';

function renderReadOnly() {
  const groups = groupBySection(q.questions);
  content.innerHTML = `
    ${isDiagnostic() ? `
      <div class="card mb-8">
        ${DIAGNOSTIC_CLOSING.map((t, i) => `<p class="${i === 0 ? 'text-xl font-serif mb-3' : 'text-white/70'}" style="line-height:1.7;">${t}</p>`).join('')}
      </div>` : ''}
    <div class="mb-6 px-4 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-sm flex items-center justify-between gap-3 flex-wrap">
      <span>Enviado — suas respostas estão registradas.</span>
      <button type="button" id="edit-answers" class="btn-text" style="color:inherit; text-decoration:underline;">Editar respostas</button>
    </div>
    ${groups.map((g, gi) => `
      ${g.name ? `<p class="text-xs uppercase mt-8 mb-3" style="color:var(--terracotta);letter-spacing:.24em;">${gi + 1}. ${esc(g.name)}</p>` : ''}
      <div class="space-y-4">
        ${g.items.map(({ q: x, n }) => `
          <div class="card">
            <p class="text-sm text-white/40 mb-1">${n}. ${esc(x.question_text)}</p>
            <p class="text-white/90" style="white-space:pre-line;">${filled(x.answer) ? (x.question_type === 'scale' ? `${esc(x.answer)} <span class="text-white/40">de 10</span>` : esc(x.answer)) : '—'}</p>
          </div>`).join('')}
      </div>`).join('')}
  `;
  content.querySelector('#edit-answers').addEventListener('click', () => { editing = true; render(); });
}

// Answers save as she types (and on every rating tap), so leaving halfway
// and coming back loses nothing; "Enviar" only marks it as submitted.
const saveTimers = {};
async function saveAnswer(id, value) {
  const row = q.questions.find((x) => x.id === id);
  if (row) row.answer = value;
  const { error } = await supabase.from('questionnaire_questions').update({ answer: value }).eq('id', id);
  const status = content.querySelector('#save-status');
  if (status) status.textContent = error ? 'Não foi possível salvar agora — confira sua conexão.' : 'Respostas salvas automaticamente.';
}
function queueSave(id, value) {
  clearTimeout(saveTimers[id]);
  saveTimers[id] = setTimeout(() => saveAnswer(id, value), 700);
}
async function flushSaves() {
  const pending = Object.keys(saveTimers);
  pending.forEach((id) => clearTimeout(saveTimers[id]));
  await Promise.all(pending.map((id) => { delete saveTimers[id]; const el = content.querySelector(`textarea[data-qid="${id}"]`); return el ? saveAnswer(id, el.value) : null; }));
}

function questionHtml(x, n) {
  const input = x.question_type === 'scale'
    ? `<div class="flex flex-wrap gap-2" role="radiogroup" aria-label="Nota de 0 a 10">
        ${Array.from({ length: 11 }, (_, v) => `<button type="button" role="radio" aria-checked="${String(x.answer) === String(v)}" data-scale="${x.id}" data-value="${v}"
          style="width:42px;height:42px;border-radius:50%;border:1px solid ${String(x.answer) === String(v) ? 'var(--gold)' : 'var(--line)'};background:${String(x.answer) === String(v) ? 'var(--gold)' : 'transparent'};color:${String(x.answer) === String(v) ? '#0c0a09' : 'inherit'};font-size:14px;">${v}</button>`).join('')}
      </div>${scaleLabels(x)}`
    : `<textarea data-qid="${x.id}" rows="5" class="w-full border border-white/15 rounded-lg px-4 py-3 focus:outline-none focus:border-white/40" style="line-height:1.6;" placeholder="Escreva aqui...">${esc(x.answer)}</textarea>`;
  return `
    <div class="card reveal-scroll" id="q-${x.id}">
      <p class="text-xs mb-2" style="color:var(--gold);letter-spacing:.14em;">PERGUNTA ${n} DE ${q.questions.length}</p>
      <p class="text-lg font-medium mb-2" style="line-height:1.5;">${esc(x.question_text)}</p>
      ${x.help ? `<p class="text-sm text-white/50 mb-4" style="line-height:1.6;">${esc(x.help)}</p>` : '<div class="mb-2"></div>'}
      ${input}
    </div>`;
}

function renderForm() {
  const groups = groupBySection(q.questions);
  content.innerHTML = `
    ${introHtml()}
    ${q.status === 'submitted' ? `
      <div class="mb-6 px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white/60 text-sm">
        Editando suas respostas já enviadas.
      </div>
    ` : ''}
    ${groups.map((g, gi) => `${sectionHead(g, gi)}<div class="space-y-6">${g.items.map(({ q: x, n }) => questionHtml(x, n)).join('')}</div>`).join('')}
    <p id="save-status" class="text-xs text-white/30 mt-6">Suas respostas são salvas automaticamente enquanto você escreve.</p>
    <div class="mt-6 flex justify-end gap-3 flex-wrap">
      ${q.status === 'submitted' ? '<button id="cancel-edit" class="px-6 py-3 rounded-xl border border-white/15 text-white/60 hover:text-white transition-colors">Cancelar</button>' : ''}
      <button id="submit-btn" class="px-6 py-3 rounded-xl bg-white text-black font-medium hover:bg-white/90 transition-colors">
        ${q.status === 'submitted' ? 'Salvar alterações' : 'Enviar diagnóstico'}
      </button>
    </div>
  `;

  content.querySelectorAll('textarea[data-qid]').forEach((el) => {
    el.addEventListener('input', () => queueSave(el.dataset.qid, el.value));
  });
  content.querySelectorAll('[data-scale]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.scale;
      content.querySelectorAll(`[data-scale="${id}"]`).forEach((b) => {
        const on = b === btn;
        b.setAttribute('aria-checked', String(on));
        b.style.background = on ? 'var(--gold)' : 'transparent';
        b.style.borderColor = on ? 'var(--gold)' : 'var(--line)';
        b.style.color = on ? '#0c0a09' : 'inherit';
      });
      await saveAnswer(id, btn.dataset.value);
    });
  });

  content.querySelector('#cancel-edit')?.addEventListener('click', async () => { await flushSaves(); editing = false; render(); });
  content.querySelector('#submit-btn').addEventListener('click', async () => {
    await flushSaves();
    const missing = q.questions.map((x, i) => (filled(x.answer) ? null : { x, n: i + 1 })).filter(Boolean);
    if (missing.length) {
      toast(missing.length === 1 ? `Falta responder a pergunta ${missing[0].n}.` : `Faltam ${missing.length} perguntas: ${missing.map((m) => m.n).join(', ')}.`, { tone: 'error' });
      document.getElementById(`q-${missing[0].x.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    const wasSubmitted = q.status === 'submitted';
    const { error } = await supabase.from('questionnaires').update({ status: 'submitted' }).eq('id', q.id);
    if (error) { toast('Não foi possível enviar agora.', { tone: 'error' }); return; }
    q.status = 'submitted';
    editing = false;
    toast(wasSubmitted ? 'Respostas atualizadas.' : 'Diagnóstico enviado!');
    render();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (!wasSubmitted) {
      showMoodPrompt({
        label: 'Como você se sentiu respondendo o diagnóstico?',
        onSelect: () => {}, // mood log (mood_log table) not yet wired for production — no-op rather than a MockDB call
      });
    }
  });
  initScrollReveal();
}

// Leaving the page with a text still waiting to save: save it now.
window.addEventListener('pagehide', () => { flushSaves(); });

function render() {
  if (!q) { renderEmpty(); return; }
  if (q.status === 'submitted' && !editing) renderReadOnly();
  else renderForm();
}

render();
