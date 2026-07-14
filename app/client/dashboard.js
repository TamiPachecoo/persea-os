import { MockDB } from '../shared/mock-db.js';
import { renderShell, card, progressBar, statusBadge, formatDateTime } from '../shared/ui.js';

document.body.innerHTML = renderShell({ role: 'client', active: 'dashboard.html' });

const client = MockDB.getClient();
const journey = MockDB.getJourney();
const homeworkPct = MockDB.homeworkCompletionPct();
const completedSteps = journey.steps.filter((s) => s.status === 'completed').length;
const journeyPct = Math.round((completedSteps / journey.steps.length) * 100);
const outstanding = journey.steps.filter((s) => s.status === 'available' || s.status === 'in_progress');

const content = document.getElementById('app-content');
content.innerHTML = `
  <div class="mb-10">
    <p class="text-white/40 text-sm mb-1">Bem-vinda de volta,</p>
    <h1 class="text-3xl font-serif">${client.fullName}</h1>
  </div>

  <div class="grid md:grid-cols-3 gap-6 mb-8">
    ${card(`
      <p class="text-sm text-white/50 mb-3">Progresso da Jornada — ${journey.programName}</p>
      <p class="text-3xl font-serif mb-4">${journeyPct}%</p>
      ${progressBar(journeyPct)}
    `)}
    ${card(`
      <p class="text-sm text-white/50 mb-3">Fase Atual</p>
      <p class="text-xl font-serif mb-2">Identidade</p>
      <p class="text-sm text-white/40">Etapa ${completedSteps + 1} de ${journey.steps.length}</p>
    `)}
    ${card(`
      <p class="text-sm text-white/50 mb-3">Próxima Reunião</p>
      <p class="text-lg font-medium mb-1">${journey.upcomingMeeting.title}</p>
      <p class="text-sm text-white/40">${formatDateTime(journey.upcomingMeeting.date)}</p>
    `)}
  </div>

  <div class="grid md:grid-cols-2 gap-6">
    ${card(`
      <p class="text-sm text-white/50 mb-4">Tarefas Pendentes</p>
      <div class="space-y-3">
        ${outstanding.length ? outstanding.map((s) => `
          <div class="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
            <span>${s.title}</span>
            ${statusBadge(s.status)}
          </div>
        `).join('') : '<p class="text-white/30 text-sm">Nada pendente no momento.</p>'}
      </div>
    `)}
    ${card(`
      <p class="text-sm text-white/50 mb-4">Jornada Completa</p>
      <div class="space-y-3">
        ${journey.steps.map((s) => `
          <div class="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
            <span class="${s.status === 'locked' ? 'text-white/30' : ''}">${s.title}</span>
            ${statusBadge(s.status)}
          </div>
        `).join('')}
      </div>
    `)}
  </div>
`;
