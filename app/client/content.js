// Conteúdos e Aulas — Hubla continues hosting the classes themselves; this
// screen only organizes metadata + links a student can open. No video is
// migrated, uploaded, duplicated, or embedded here.
import { MockDB, getActiveClientId, CONTENT_TRACKS, CONTENT_TRACK_LABEL } from '../shared/mock-db.js';
import { renderShell, card, initClientSwitcher, externalLinkAttrs, isValidHttpUrl, toast, formatDate } from '../shared/ui.js';

const activeClientId = getActiveClientId();
document.body.innerHTML = renderShell({ role: 'client', active: 'content.html', title: 'Conteúdos e Aulas' });
initClientSwitcher();

const content = document.getElementById('app-content');

function hublaButton(url) {
  return isValidHttpUrl(url)
    ? `<a ${externalLinkAttrs(url)} class="btn-primary inline-block" style="padding:9px 18px;font-size:12.5px;">Assistir aula na Hubla</a>`
    : `<button type="button" class="btn-ghost" disabled title="Link ainda não configurado pela sua consultora">Aula em breve</button>`;
}

function resourceCard(r, assignment) {
  return card(`
    <p class="text-sm text-white/50 mb-1">${CONTENT_TRACK_LABEL[r.track]}${r.phaseKey ? ` · ${r.phaseKey}` : ''}</p>
    <p class="font-medium mb-2">${r.title}</p>
    ${r.description ? `<p class="text-sm text-white/40 mb-3">${r.description}</p>` : ''}
    ${assignment ? `
      <div class="mb-3 p-3 rounded" style="background:rgba(184,134,58,.08); border:1px solid var(--line);">
        <p class="text-xs" style="color:var(--gold);">Recomendado para você</p>
        ${assignment.reason ? `<p class="text-xs text-white/50 mt-1">${assignment.reason}</p>` : ''}
        ${assignment.deadline ? `<p class="text-xs text-white/30 mt-1">Prazo: ${formatDate(assignment.deadline)}</p>` : ''}
        <label class="flex items-center gap-2 mt-2 text-xs text-white/50" style="cursor:pointer;">
          <input type="checkbox" data-toggle-assignment="${assignment.id}" ${assignment.completed ? 'checked' : ''} />
          Marcar como concluída
        </label>
      </div>
    ` : ''}
    <div class="flex items-center gap-3 flex-wrap">
      ${hublaButton(r.hublaUrl)}
      ${r.duration ? `<span class="text-xs text-white/30">${r.duration}</span>` : ''}
    </div>
  `);
}

function render() {
  const assignments = MockDB.getAssignmentsForClient(activeClientId);
  const byTrack = MockDB.getResourcesByTrack();
  const anyGeneral = CONTENT_TRACKS.some((t) => (byTrack[t] || []).some((r) => r.generalAudience));

  content.innerHTML = `
    <div class="mb-8">
      <p class="text-white/40 text-sm mb-1">Central de Conteúdos</p>
      <h1 class="text-3xl font-serif">Conteúdos e Aulas</h1>
      <p class="text-sm text-white/40 mt-2">As aulas ficam hospedadas na Hubla — clique para assistir em uma nova aba.</p>
    </div>

    ${assignments.length ? `
      <div class="mb-10">
        <p class="text-sm text-white/50 mb-4">Recomendado para você</p>
        <div class="grid md:grid-cols-2 gap-5">
          ${assignments.map((a) => resourceCard(a.resource, a)).join('')}
        </div>
      </div>
    ` : ''}

    ${anyGeneral ? CONTENT_TRACKS.map((t) => {
      const items = (byTrack[t] || []).filter((r) => r.generalAudience);
      if (!items.length) return '';
      return `
        <div class="mb-10">
          <p class="text-sm text-white/50 mb-4">${CONTENT_TRACK_LABEL[t]}</p>
          <div class="grid md:grid-cols-2 gap-5">${items.map((r) => resourceCard(r, null)).join('')}</div>
        </div>
      `;
    }).join('') : (assignments.length ? '' : card('<p class="text-sm text-white/30">Ainda não há conteúdos disponíveis — volte em breve.</p>'))}
  `;

  content.querySelectorAll('[data-toggle-assignment]').forEach((cb) => {
    cb.addEventListener('change', () => {
      MockDB.toggleAssignmentCompletion(cb.dataset.toggleAssignment);
      toast(cb.checked ? 'Marcado como concluída.' : 'Marcado como pendente.');
    });
  });
}

render();
