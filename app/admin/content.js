// Content Center admin — manages the Hubla-hosted class library (metadata +
// link only, per docs' explicit non-goal: no video migration/embedding) and
// per-student recommendations layered on top of it.
import { MockDB, CONTENT_TRACKS, CONTENT_TRACK_LABEL } from '../shared/mock-db.js';
import { renderShell, card, toast, formatDate, openModal, isValidHttpUrl } from '../shared/ui.js';

document.body.innerHTML = renderShell({ role: 'admin', active: 'content.html', title: 'Conteúdos' });
const content = document.getElementById('app-content');

function resourceRow(r) {
  const linkOk = isValidHttpUrl(r.hublaUrl);
  return `
    <div class="py-3 border-b border-white/5 last:border-0">
      <div class="flex items-start justify-between gap-4">
        <div class="min-w-0">
          <p class="font-medium text-sm">${r.title}</p>
          ${r.description ? `<p class="text-xs text-white/40 mt-1">${r.description}</p>` : ''}
          <div class="flex items-center gap-2 mt-2 flex-wrap">
            <span class="badge ${r.generalAudience ? 'badge-completed' : 'badge-locked'}">${r.generalAudience ? 'Geral' : 'Somente por indicação'}</span>
            ${r.duration ? `<span class="text-xs text-white/30">${r.duration}</span>` : ''}
            ${r.phaseKey ? `<span class="text-xs text-white/30">· Fase ${r.phaseKey}</span>` : ''}
            ${!linkOk ? '<span class="text-xs" style="color:var(--error);">Link da Hubla pendente</span>' : ''}
          </div>
        </div>
        <button type="button" data-edit-resource="${r.id}" class="btn-ghost">Editar</button>
      </div>
    </div>
  `;
}

function renderLibrary() {
  const byTrack = MockDB.getResourcesByTrack();
  return CONTENT_TRACKS.map((t) => card(`
    <div class="flex items-center justify-between mb-3">
      <p class="text-sm text-white/50">${CONTENT_TRACK_LABEL[t]}</p>
      <button type="button" data-new-resource="${t}" class="btn-ghost">+ Novo Conteúdo</button>
    </div>
    ${byTrack[t].length ? byTrack[t].map(resourceRow).join('') : '<p class="text-xs text-white/20">Nenhum conteúdo nesta trilha ainda.</p>'}
  `, 'mb-6')).join('');
}

function renderAssignments() {
  const assignments = MockDB.getAllAssignments();
  return card(`
    <div class="flex items-center justify-between mb-4">
      <p class="text-sm text-white/50">Atribuições a Clientes</p>
      <button type="button" id="new-assignment" class="btn-ghost">+ Nova Atribuição</button>
    </div>
    ${assignments.length ? assignments.map((a) => `
      <div class="py-3 border-b border-white/5 last:border-0">
        <div class="flex items-start justify-between gap-4">
          <div>
            <p class="text-sm font-medium">${a.resource ? a.resource.title : '(conteúdo removido)'}</p>
            <p class="text-xs text-white/40 mt-1">Para ${a.clientName}${a.deadline ? ` · prazo ${formatDate(a.deadline)}` : ''}</p>
            ${a.reason ? `<p class="text-xs text-white/30 mt-1">${a.reason}</p>` : ''}
          </div>
          <span class="badge ${a.completed ? 'badge-completed' : 'badge-progress'}">${a.completed ? 'Concluído' : 'Pendente'}</span>
        </div>
      </div>
    `).join('') : '<p class="text-xs text-white/20">Nenhuma atribuição ainda.</p>'}
  `);
}

function openResourceModal(resource, defaultTrack) {
  const isNew = !resource;
  const data = resource || {
    title: '', description: '', track: defaultTrack || CONTENT_TRACKS[0], phaseKey: '',
    duration: '', hublaUrl: '', recommendation: '', generalAudience: true,
  };
  const { el, close } = openModal({
    title: isNew ? 'Novo Conteúdo' : 'Editar Conteúdo',
    bodyHtml: `
      <form id="resource-form" class="space-y-4">
        <div>
          <label class="text-xs text-white/40 block mb-1">Título da Aula</label>
          <input name="title" class="field" value="${data.title}" required />
        </div>
        <div>
          <label class="text-xs text-white/40 block mb-1">Descrição Curta</label>
          <textarea name="description" rows="2" class="field">${data.description || ''}</textarea>
        </div>
        <div class="grid sm:grid-cols-2 gap-4">
          <div>
            <label class="text-xs text-white/40 block mb-1">Trilha</label>
            <select name="track" class="field">
              ${CONTENT_TRACKS.map((t) => `<option value="${t}" ${data.track === t ? 'selected' : ''}>${CONTENT_TRACK_LABEL[t]}</option>`).join('')}
            </select>
          </div>
          <div>
            <label class="text-xs text-white/40 block mb-1">Fase Relacionada</label>
            <input name="phaseKey" class="field" value="${data.phaseKey || ''}" placeholder="Ex.: Identidade" />
          </div>
        </div>
        <div class="grid sm:grid-cols-2 gap-4">
          <div>
            <label class="text-xs text-white/40 block mb-1">Duração</label>
            <input name="duration" class="field" value="${data.duration || ''}" placeholder="Ex.: 30 min" />
          </div>
          <div>
            <label class="text-xs text-white/40 block mb-1">Visibilidade</label>
            <select name="generalAudience" class="field">
              <option value="true" ${data.generalAudience ? 'selected' : ''}>Geral (todas as clientes)</option>
              <option value="false" ${!data.generalAudience ? 'selected' : ''}>Somente por indicação</option>
            </select>
          </div>
        </div>
        <div>
          <label class="text-xs text-white/40 block mb-1">URL da Aula na Hubla</label>
          <input name="hublaUrl" class="field" value="${data.hublaUrl || ''}" placeholder="https://pay.hubla.com.br/..." />
          <p class="text-xs text-white/20 mt-1">Cole aqui a URL real da aula/ambiente na Hubla — o botão "Assistir na Hubla" abre exatamente este link.</p>
        </div>
        <div>
          <label class="text-xs text-white/40 block mb-1">Recomendação da Nay <span class="text-white/20">(opcional)</span></label>
          <textarea name="recommendation" rows="2" class="field">${data.recommendation || ''}</textarea>
        </div>
        <div class="flex justify-end pt-2">
          <button type="submit" class="btn-primary" style="padding:9px 18px;font-size:12.5px;">${isNew ? 'Adicionar' : 'Salvar'}</button>
        </div>
      </form>
    `,
  });
  el.querySelector('#resource-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    MockDB.saveResource({
      id: resource ? resource.id : undefined,
      title: fd.get('title'), description: fd.get('description'), track: fd.get('track'),
      phaseKey: fd.get('phaseKey') || null, duration: fd.get('duration') || null,
      generalAudience: fd.get('generalAudience') === 'true',
      hublaUrl: fd.get('hublaUrl'), recommendation: fd.get('recommendation') || null,
    });
    close();
    toast(isNew ? 'Conteúdo adicionado.' : 'Conteúdo atualizado.');
    render();
  });
}

function openAssignmentModal() {
  const resources = MockDB.getResources();
  const clients = MockDB.listClients();
  const { el, close } = openModal({
    title: 'Nova Atribuição',
    bodyHtml: `
      <form id="assignment-form" class="space-y-4">
        <div>
          <label class="text-xs text-white/40 block mb-1">Conteúdo</label>
          <select name="resourceId" class="field" required>
            ${resources.map((r) => `<option value="${r.id}">${r.title}</option>`).join('')}
          </select>
        </div>
        <div>
          <label class="text-xs text-white/40 block mb-1">Cliente</label>
          <select name="studentId" class="field" required>
            ${clients.map((c) => `<option value="${c.id}">${c.fullName}</option>`).join('')}
          </select>
        </div>
        <div>
          <label class="text-xs text-white/40 block mb-1">Motivo da Recomendação</label>
          <textarea name="reason" rows="2" class="field" placeholder="Por que esse conteúdo faz sentido para ela agora?"></textarea>
        </div>
        <div class="grid sm:grid-cols-2 gap-4">
          <div>
            <label class="text-xs text-white/40 block mb-1">Prazo <span class="text-white/20">(opcional)</span></label>
            <input name="deadline" type="date" class="field" />
          </div>
          <div>
            <label class="text-xs text-white/40 block mb-1">Fase/Reunião Relacionada <span class="text-white/20">(opcional)</span></label>
            <input name="relatedPhaseOrMeeting" class="field" />
          </div>
        </div>
        <div class="flex justify-end pt-2">
          <button type="submit" class="btn-primary" style="padding:9px 18px;font-size:12.5px;">Atribuir</button>
        </div>
      </form>
    `,
  });
  el.querySelector('#assignment-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    MockDB.assignResourceToClient(fd.get('resourceId'), fd.get('studentId'), {
      reason: fd.get('reason'), deadline: fd.get('deadline') || null, relatedPhaseOrMeeting: fd.get('relatedPhaseOrMeeting') || null,
    });
    close();
    toast('Conteúdo atribuído.');
    render();
  });
}

function wireEvents() {
  content.querySelectorAll('[data-new-resource]').forEach((btn) => {
    btn.addEventListener('click', () => openResourceModal(null, btn.dataset.newResource));
  });
  content.querySelectorAll('[data-edit-resource]').forEach((btn) => {
    btn.addEventListener('click', () => openResourceModal(MockDB.getResource(btn.dataset.editResource)));
  });
  content.querySelector('#new-assignment')?.addEventListener('click', () => openAssignmentModal());
}

function render() {
  content.innerHTML = `
    <p class="text-sm text-white/40 mb-8 max-w-2xl">As aulas continuam hospedadas na Hubla — aqui você organiza como elas aparecem para as clientes e pode recomendar conteúdos específicos.</p>
    ${renderLibrary()}
    ${renderAssignments()}
  `;
  wireEvents();
}

render();
