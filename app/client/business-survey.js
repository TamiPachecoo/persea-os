// Pesquisa de Precificação — E2's short, surface-level survey (see
// BUSINESS_SURVEY_QUESTIONS in mock-db.js): how she prices herself today
// and what she'd like to be charging. Nay reads this before E2 so the
// encounter can go straight into her sales situation instead of starting
// from zero. Deliberately just 4 short questions — this is not the full
// Análise de Negócio (that's the separate Business/Ficha de Valor activity).
// Once submitted, this opens straight into "just the answers" — same rule
// as Extração de Marca (questionnaire.js) — editing is an explicit choice,
// not the default view.
import { MockDB, getActiveClientId, BUSINESS_SURVEY_QUESTIONS } from '../shared/mock-db.js';
import { renderShell, card, toast, initClientSwitcher, formatDateTime } from '../shared/ui.js';

const clientId = getActiveClientId();
document.body.innerHTML = renderShell({ role: 'client', active: 'program.html', title: 'Pesquisa de Precificação' });
initClientSwitcher();
const content = document.getElementById('app-content');

let editing = false;

function render() {
  const survey = MockDB.getBusinessSurvey(clientId);
  const submitted = survey.status === 'submitted';
  const showForm = !submitted || editing;

  content.innerHTML = `
    <a href="program.html" class="btn-text mb-6 inline-block">&larr; Seu Programa</a>
    <div class="mb-8 max-w-xl">
      <p class="text-white/40 text-sm mb-1">Pesquisa de Precificação</p>
      <h1 class="text-3xl font-serif mb-3">Como Você Vende Hoje</h1>
      <p class="text-sm text-white/50">Perguntas rápidas — sem certo ou errado. Isso ajuda a Nay a preparar o seu Encontro 2 já direcionado para a sua realidade.</p>
    </div>
    ${submitted && !editing ? `
      ${card(`
        <div class="flex items-center justify-between mb-4 flex-wrap gap-2">
          <p class="text-xs" style="color:var(--gold);">Enviado em ${formatDateTime(survey.submittedAt)}</p>
          <button type="button" id="edit-survey" class="btn-text">Editar respostas</button>
        </div>
        <div class="space-y-4">
          ${BUSINESS_SURVEY_QUESTIONS.map((q) => `
            <div>
              <p class="text-xs text-white/30 mb-1">${q.label}</p>
              <p class="text-sm">${survey.responses[q.key] || '—'}</p>
            </div>
          `).join('')}
        </div>
      `, 'max-w-xl')}
    ` : `
      ${card(`
        <form id="survey-form" class="space-y-5 max-w-xl">
          ${BUSINESS_SURVEY_QUESTIONS.map((q) => `
            <div>
              <label class="text-sm block mb-1.5">${q.label}</label>
              ${q.type === 'textarea'
                ? `<textarea name="${q.key}" rows="3" class="field text-sm" placeholder="${q.placeholder || ''}">${survey.responses[q.key] || ''}</textarea>`
                : `<input name="${q.key}" class="field text-sm" placeholder="${q.placeholder || ''}" value="${survey.responses[q.key] || ''}" />`}
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
  content.querySelector('#survey-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const responses = Object.fromEntries(BUSINESS_SURVEY_QUESTIONS.map((q) => [q.key, (fd.get(q.key) || '').trim()]));
    MockDB.submitBusinessSurvey(clientId, responses);
    editing = false;
    toast('Respostas enviadas — obrigada!');
    render();
  });
}

render();
