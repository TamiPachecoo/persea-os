// Production Data Migration — Batch 3: converted off MockDB onto the real
// `content_activities` table (one row per client, exact status vocabulary
// match — not_started/in_progress/submitted/feedback_available/completed;
// full client read/write RLS already scoped to profiles.client_id).
// PROGRAM_ACTIVITY_STATUS_LABEL/_BADGE_CLASS are static presentation-only
// dictionaries, not per-client data.
import { PROGRAM_ACTIVITY_STATUS_LABEL, PROGRAM_ACTIVITY_STATUS_BADGE_CLASS } from '../shared/mock-db.js';
import { getCurrentClientContext } from '../shared/client-context.js';
import { supabase } from '../shared/supabase-client.js';
import { renderShell, card, toast, initClientSwitcher, formatDateTime } from '../shared/ui.js';

const __clientCtx = await getCurrentClientContext('../login.html', { page: 'content-activity' });
if (!__clientCtx) throw new Error('not authorized');
const clientId = __clientCtx.clientId;
document.body.innerHTML = renderShell({ role: 'client', active: 'program.html', title: 'Conteúdo' });
initClientSwitcher();
const content = document.getElementById('app-content');

async function loadActivity() {
  const { data } = await supabase.from('content_activities').select('*').eq('client_id', clientId).maybeSingle();
  return data || { client_id: clientId, status: 'not_started', submission: null, feedback: null, updated_at: null };
}

async function render() {
  const activity = await loadActivity();

  content.innerHTML = `
    <a href="program.html" class="btn-text mb-6 inline-block">&larr; Seu Programa</a>
    <div class="flex items-center justify-between flex-wrap gap-3 mb-6">
      <p class="text-sm text-white/40 max-w-xl">Transforme seu posicionamento em uma comunicação consistente e aplicável aos seus canais.</p>
      <span class="badge ${PROGRAM_ACTIVITY_STATUS_BADGE_CLASS[activity.status]}">${PROGRAM_ACTIVITY_STATUS_LABEL[activity.status]}</span>
    </div>

    ${card(`
      <p class="text-sm text-white/50 mb-2">Instruções</p>
      <p class="text-sm text-white/40">Nay ainda está preparando as instruções detalhadas para esta etapa. Por enquanto, use o espaço abaixo para deixar rascunhos, ideias ou perguntas — ela vai revisar assim que possível.</p>
    `, 'mb-6')}

    ${card(`
      <label class="text-sm text-white/50 block mb-2">Seu envio</label>
      <textarea id="content-submission" rows="6" class="field" placeholder="Escreva aqui seu material, rascunho ou dúvida...">${activity.submission || ''}</textarea>
      <div class="flex justify-end mt-3">
        <button type="button" id="save-submission" class="btn-primary" style="padding:9px 18px;font-size:12.5px;">Enviar</button>
      </div>
    `, 'mb-6')}

    ${activity.feedback ? card(`
      <p class="text-sm text-white/50 mb-2">Devolutiva da Nay</p>
      <p class="text-sm text-white/70">${activity.feedback}</p>
      ${activity.updated_at ? `<p class="text-xs text-white/20 mt-3">${formatDateTime(activity.updated_at)}</p>` : ''}
    `, 'mb-6') : card('<p class="text-sm" style="color:var(--muted);">A devolutiva aparece aqui assim que Nay revisar seu envio.</p>', 'mb-6')}
  `;

  content.querySelector('#save-submission').addEventListener('click', async () => {
    const text = content.querySelector('#content-submission').value.trim();
    if (!text) { toast('Escreva algo antes de enviar.', { tone: 'error' }); return; }
    const row = { client_id: clientId, submission: text, status: 'submitted', updated_at: new Date().toISOString() };
    const { error } = activity.updated_at || activity.submission
      ? await supabase.from('content_activities').update(row).eq('client_id', clientId)
      : await supabase.from('content_activities').insert(row);
    if (error) { toast('Não foi possível enviar agora.', { tone: 'error' }); return; }
    toast('Enviado! Nay será avisada.');
    render();
  });
}

render();
