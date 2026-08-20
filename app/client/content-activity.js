// Conteúdo — the client's practical content work inside the mentoring
// journey. Distinct from content.html (the Conteúdos gateway to Hubla):
// this is a submission/feedback shell, not a lesson library. Kept
// deliberately simple per spec — no content methodology invented here.
import { MockDB, getActiveClientId, PROGRAM_ACTIVITY_STATUS_LABEL, PROGRAM_ACTIVITY_STATUS_BADGE_CLASS } from '../shared/mock-db.js';
import { renderShell, card, toast, initClientSwitcher, formatDateTime } from '../shared/ui.js';

const clientId = getActiveClientId();
document.body.innerHTML = renderShell({ role: 'client', active: 'program.html', title: 'Conteúdo' });
initClientSwitcher();
const content = document.getElementById('app-content');

function render() {
  const activity = MockDB.getContentActivity(clientId);

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
      ${activity.updatedAt ? `<p class="text-xs text-white/20 mt-3">${formatDateTime(activity.updatedAt)}</p>` : ''}
    `, 'mb-6') : card('<p class="text-sm" style="color:var(--muted);">A devolutiva aparece aqui assim que Nay revisar seu envio.</p>', 'mb-6')}
  `;

  content.querySelector('#save-submission').addEventListener('click', () => {
    const text = content.querySelector('#content-submission').value.trim();
    if (!text) { toast('Escreva algo antes de enviar.', { tone: 'error' }); return; }
    MockDB.saveContentActivitySubmission(clientId, text);
    toast('Enviado! Nay será avisada.');
    render();
  });
}

render();
