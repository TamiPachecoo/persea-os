// Pesquisa de Precificação — Production Migration Batch 7: converted off
// MockDB onto real Supabase. Confirmed via the real, stable
// program_activity_access table (not a hardcoded tier check) that
// business-survey is 'included' for BOTH persea-essential and
// persea-premium — no Premium gate exists for this feature in the actual
// product architecture, unlike value-analysis. Real tables:
// business_survey_questions (shared reference content, any authenticated
// user can read), business_surveys + business_survey_responses (per-client,
// full client RLS already correctly scoped).
import { getCurrentClientContext } from '../shared/client-context.js';
import { supabase } from '../shared/supabase-client.js';
import { renderShell, card, toast, initClientSwitcher, formatDateTime } from '../shared/ui.js';

const __clientCtx = await getCurrentClientContext('../login.html', { page: 'business-survey' });
if (!__clientCtx) throw new Error('not authorized');
const clientId = __clientCtx.clientId;
document.body.innerHTML = renderShell({ role: 'client', active: 'program.html', title: 'Pesquisa de Precificação' });
initClientSwitcher();
const content = document.getElementById('app-content');

let editing = false;

async function loadState() {
  const [{ data: questions }, { data: survey }, { data: responses }] = await Promise.all([
    supabase.from('business_survey_questions').select('*').order('sort_order'),
    supabase.from('business_surveys').select('*').eq('client_id', clientId).maybeSingle(),
    supabase.from('business_survey_responses').select('*').eq('client_id', clientId),
  ]);
  const responseByKey = new Map((responses || []).map((r) => [r.question_key, r.response]));
  return { questions: questions || [], survey, responseByKey };
}

async function render() {
  const { questions, survey, responseByKey } = await loadState();
  const submitted = survey?.status === 'submitted';
  const showForm = !submitted || editing;

  content.innerHTML = `
    <a href="program.html" class="btn-text mb-6 inline-block">&larr; Seu Programa</a>
    <div class="mb-8 max-w-xl">
      <p class="text-white/40 text-sm mb-1">Pesquisa de Precificação</p>
      <h1 class="text-3xl font-serif mb-3">Como Você Vende Hoje</h1>
      <p class="text-sm text-white/50">Perguntas rápidas — sem certo ou errado. Isso ajuda a Nay a preparar o seu Encontro 2 já direcionado para a sua realidade.</p>
    </div>
    ${!questions.length ? card('<p class="text-sm" style="color:var(--muted);">Seu diagnóstico de negócios ainda não foi iniciado.</p>', 'max-w-xl') : submitted && !editing ? `
      ${card(`
        <div class="flex items-center justify-between mb-4 flex-wrap gap-2">
          <p class="text-xs" style="color:var(--gold);">Enviado em ${formatDateTime(survey.submitted_at)}</p>
          <button type="button" id="edit-survey" class="btn-text">Editar respostas</button>
        </div>
        <div class="space-y-4">
          ${questions.map((q) => `
            <div>
              <p class="text-xs text-white/30 mb-1">${q.label}</p>
              <p class="text-sm">${responseByKey.get(q.key) || '—'}</p>
            </div>
          `).join('')}
        </div>
      `, 'max-w-xl')}
    ` : `
      ${card(`
        <form id="survey-form" class="space-y-5 max-w-xl">
          ${questions.map((q) => `
            <div>
              <label class="text-sm block mb-1.5">${q.label}</label>
              ${q.question_type === 'textarea'
                ? `<textarea name="${q.key}" rows="3" class="field text-sm" placeholder="${q.placeholder || ''}">${responseByKey.get(q.key) || ''}</textarea>`
                : `<input name="${q.key}" class="field text-sm" placeholder="${q.placeholder || ''}" value="${responseByKey.get(q.key) || ''}" />`}
            </div>
          `).join('')}
          <div class="flex justify-end gap-3 pt-1">
            ${submitted ? '<button type="button" id="cancel-edit" class="btn-ghost">Cancelar</button>' : ''}
            <button type="submit" class="btn-primary" style="padding:9px 18px;font-size:12.5px;">${submitted ? 'Salvar Alterações' : 'Enviar Respostas'}</button>
          </div>
        </form>
      `, 'max-w-xl')}
    `}
  `;

  content.querySelector('#edit-survey')?.addEventListener('click', () => { editing = true; render(); });
  content.querySelector('#cancel-edit')?.addEventListener('click', () => { editing = false; render(); });
  content.querySelector('#survey-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const rows = questions.map((q) => ({ client_id: clientId, question_key: q.key, response: (fd.get(q.key) || '').toString().trim() }));

    // business_survey_responses.client_id is a FK into business_surveys
    // (not clients directly) — the survey row must exist before any
    // response can be written, so this must run first, not after.
    const { error: surveyErr } = survey
      ? await supabase.from('business_surveys').update({ status: 'submitted', submitted_at: new Date().toISOString() }).eq('client_id', clientId)
      : await supabase.from('business_surveys').insert({ client_id: clientId, status: 'submitted', submitted_at: new Date().toISOString() });
    if (surveyErr) { toast('Não foi possível enviar agora.', { tone: 'error' }); return; }

    const { error: upsertErr } = await supabase.from('business_survey_responses').upsert(rows, { onConflict: 'client_id,question_key' });
    if (upsertErr) { toast('Envio registrado, mas houve um erro ao salvar suas respostas.', { tone: 'error' }); return; }

    editing = false;
    toast('Respostas enviadas — obrigada!');
    render();
  });
}

render();
