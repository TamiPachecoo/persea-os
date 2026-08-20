// Content Center admin — two separate systems on one page:
//  1. The Conteúdos gateway (renderGatewaySection) — the small, ordered set
//     of premium cards clients see, each just a link out to Hubla. Managed
//     here behind a discreet "Gerenciar conteúdos" toggle; the default view
//     is the same read-only preview a client sees.
//  2. The Content Center library (renderLibrary/renderAssignments, below) —
//     the existing per-lesson metadata + link library and per-student
//     recommendations. Untouched: still Hubla-hosted, metadata/link only.
import {
  MockDB, CONTENT_TRACKS, CONTENT_TRACK_LABEL,
} from '../shared/mock-db.js';
import {
  renderShell, card, toast, formatDate, openModal, isValidHttpUrl,
  externalLinkAttrs, contentCardInner,
} from '../shared/ui.js';

document.body.innerHTML = renderShell({ role: 'admin', active: 'content.html', title: 'Conteúdos' });
const content = document.getElementById('app-content');

let manageMode = false;

function isValidUrlOrEmpty(v) { return !v || isValidHttpUrl(v); }

function gatewayCardManage(cat) {
  return `
    <div class="content-card content-card-manage">
      ${contentCardInner(cat)}
      ${!cat.isVisible ? '<span class="content-card-hidden-flag">Oculto</span>' : ''}
      <div class="content-card-toolbar">
        <button type="button" data-move-cat="${cat.id}" data-dir="-1" title="Mover para cima">◀</button>
        <button type="button" data-move-cat="${cat.id}" data-dir="1" title="Mover para baixo">▶</button>
        <button type="button" data-toggle-cat="${cat.id}" title="${cat.isVisible ? 'Ocultar' : 'Mostrar'}">${cat.isVisible ? '👁' : '🚫'}</button>
        <button type="button" data-edit-cat="${cat.id}" title="Editar">✎</button>
      </div>
    </div>
  `;
}

function gatewayCardPreview(cat) {
  return `<div class="content-card content-card-disabled" role="group" aria-label="${cat.title}">${contentCardInner(cat)}</div>`;
}

function openCategoryModal(category) {
  const isNew = !category;
  const data = category || { title: '', description: '', hublaUrl: '', coverImage: '' };
  const { el, close } = openModal({
    title: isNew ? 'Novo Card de Conteúdo' : 'Editar Card de Conteúdo',
    bodyHtml: `
      <form id="category-form" class="space-y-4">
        <div>
          <label class="text-xs text-white/40 block mb-1">Título</label>
          <input name="title" class="field" value="${data.title}" required />
        </div>
        <div>
          <label class="text-xs text-white/40 block mb-1">Descrição Curta <span class="text-white/20">(opcional)</span></label>
          <textarea name="description" rows="2" class="field">${data.description || ''}</textarea>
        </div>
        <div>
          <label class="text-xs text-white/40 block mb-1">URL da Imagem de Capa <span class="text-white/20">(opcional — sem imagem, usa um fundo padrão)</span></label>
          <input name="coverImage" class="field" value="${data.coverImage || ''}" placeholder="https://... ou deixe em branco" />
        </div>
        <div>
          <label class="text-xs text-white/40 block mb-1">URL na Hubla</label>
          <input name="hublaUrl" class="field" value="${data.hublaUrl || ''}" placeholder="https://pay.hubla.com.br/..." required />
          <p id="cat-url-error" class="text-xs mt-1" style="color:var(--error); display:none;">Insira uma URL válida (http:// ou https://).</p>
        </div>
        <div class="flex items-center justify-between pt-2">
          ${!isNew ? `<button type="button" id="delete-category" class="btn-text" style="color:var(--error);">Excluir card</button>` : '<span></span>'}
          <button type="submit" class="btn-primary" style="padding:9px 18px;font-size:12.5px;">${isNew ? 'Adicionar' : 'Salvar'}</button>
        </div>
      </form>
    `,
  });
  el.querySelector('#category-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const hublaUrl = fd.get('hublaUrl');
    if (!isValidHttpUrl(hublaUrl)) {
      el.querySelector('#cat-url-error').style.display = 'block';
      return;
    }
    MockDB.saveContentCategory({
      id: category ? category.id : undefined,
      title: fd.get('title'), description: fd.get('description') || '',
      coverImage: fd.get('coverImage') || null, hublaUrl,
    });
    close();
    toast(isNew ? 'Card adicionado.' : 'Card atualizado.');
    render();
  });
  el.querySelector('#delete-category')?.addEventListener('click', () => {
    if (!confirm(`Excluir o card "${data.title}"? Essa ação não pode ser desfeita.`)) return;
    MockDB.deleteContentCategory(category.id);
    close();
    toast('Card excluído.');
    render();
  });
}

function renderGatewaySection() {
  const categories = MockDB.getContentCategories({ includeHidden: manageMode });
  const tenant = MockDB.getTenant();

  return `
    <div class="mb-6">
      <div class="flex items-start justify-between gap-4 flex-wrap mb-2">
        <div>
          <h1 class="text-2xl font-serif mb-1">Conteúdos da Metodologia PERSEA</h1>
          <p class="text-sm text-white/40">Acesse suas aulas e materiais disponíveis na Hubla.</p>
        </div>
        <div class="flex items-center gap-2 shrink-0">
          <a href="../client/content.html" target="_blank" rel="noopener" class="btn-ghost">Pré-visualizar como cliente</a>
          <button type="button" id="toggle-manage" class="btn-ghost">${manageMode ? 'Sair do modo de gerenciamento' : 'Gerenciar conteúdos'}</button>
        </div>
      </div>
      ${isValidHttpUrl(tenant.hublaAllContentUrl)
        ? `<a ${externalLinkAttrs(tenant.hublaAllContentUrl)} class="btn-primary inline-block mt-2">Abrir todos os conteúdos na Hubla</a>`
        : `<button type="button" class="btn-ghost mt-2" disabled>Abrir todos os conteúdos na Hubla</button>`}
    </div>

    ${manageMode ? card(`
      <div class="flex items-center justify-between gap-3 mb-3">
        <p class="text-sm text-white/50">Link geral da Hubla (botão acima)</p>
      </div>
      <form id="all-content-url-form" class="flex items-center gap-2 flex-wrap">
        <input name="hublaAllContentUrl" class="field" style="flex:1; min-width:220px;" value="${tenant.hublaAllContentUrl || ''}" placeholder="https://..." />
        <button type="submit" class="btn-ghost">Salvar</button>
      </form>
    `, 'mb-6') : ''}

    <div class="content-grid mb-4">
      ${categories.length
        ? categories.map((c) => (manageMode ? gatewayCardManage(c) : gatewayCardPreview(c))).join('')
        : '<p class="text-xs text-white/20">Nenhum card ainda.</p>'}
    </div>
    ${manageMode ? `
      <button type="button" id="new-category" class="btn-ghost mb-10">+ Novo Card</button>
    ` : '<div class="mb-10"></div>'}
  `;
}

function wireGatewayEvents() {
  content.querySelector('#toggle-manage')?.addEventListener('click', () => {
    manageMode = !manageMode;
    render();
  });
  content.querySelector('#new-category')?.addEventListener('click', () => openCategoryModal(null));
  content.querySelectorAll('[data-edit-cat]').forEach((btn) => {
    btn.addEventListener('click', () => openCategoryModal(MockDB.getContentCategory(btn.dataset.editCat)));
  });
  content.querySelectorAll('[data-toggle-cat]').forEach((btn) => {
    btn.addEventListener('click', () => { MockDB.toggleContentCategoryVisibility(btn.dataset.toggleCat); render(); });
  });
  content.querySelectorAll('[data-move-cat]').forEach((btn) => {
    btn.addEventListener('click', () => { MockDB.moveContentCategory(btn.dataset.moveCat, Number(btn.dataset.dir)); render(); });
  });
  content.querySelector('#all-content-url-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const url = new FormData(e.target).get('hublaAllContentUrl');
    if (!isValidUrlOrEmpty(url)) { toast('Insira uma URL válida.', { tone: 'error' }); return; }
    MockDB.setTenantHublaAllContentUrl(url);
    toast('Link atualizado.');
    render();
  });
}

function resourceRow(r, assignedCount = 0) {
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
            ${assignedCount ? `<span class="text-xs text-white/30">· Recomendado a ${assignedCount} cliente${assignedCount === 1 ? '' : 's'}</span>` : ''}
            ${!linkOk ? '<span class="text-xs" style="color:var(--error);">Link da Hubla pendente</span>' : ''}
          </div>
        </div>
        <div class="flex items-center gap-2 shrink-0">
          <button type="button" data-attribute-resource="${r.id}" class="btn-ghost">Recomendar a Cliente</button>
          <button type="button" data-edit-resource="${r.id}" class="btn-ghost">Editar</button>
        </div>
      </div>
    </div>
  `;
}

function renderLibrary() {
  const byTrack = MockDB.getResourcesByTrack();
  const assignedCountByResource = {};
  MockDB.getAllAssignments().forEach((a) => {
    assignedCountByResource[a.resourceId] = (assignedCountByResource[a.resourceId] || 0) + 1;
  });
  return CONTENT_TRACKS.map((t) => card(`
    <div class="flex items-center justify-between mb-3">
      <p class="text-sm text-white/50">${CONTENT_TRACK_LABEL[t]}</p>
      <button type="button" data-new-resource="${t}" class="btn-ghost">+ Novo Conteúdo</button>
    </div>
    ${byTrack[t].length ? byTrack[t].map((r) => resourceRow(r, assignedCountByResource[r.id] || 0)).join('') : '<p class="text-xs text-white/20">Nenhum conteúdo nesta trilha ainda.</p>'}
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
            <input name="phaseKey" class="field" value="${data.phaseKey || ''}" placeholder="Ex.: Essência, Comunicação e Vendas" />
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

function openAssignmentModal(preselectedResourceId) {
  const resources = MockDB.getResources();
  const clients = MockDB.listClients();
  const { el, close } = openModal({
    title: 'Nova Atribuição',
    bodyHtml: `
      <form id="assignment-form" class="space-y-4">
        <div>
          <label class="text-xs text-white/40 block mb-1">Conteúdo</label>
          <select name="resourceId" class="field" required>
            ${resources.map((r) => `<option value="${r.id}" ${r.id === preselectedResourceId ? 'selected' : ''}>${r.title}</option>`).join('')}
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
  content.querySelectorAll('[data-attribute-resource]').forEach((btn) => {
    btn.addEventListener('click', () => openAssignmentModal(btn.dataset.attributeResource));
  });
}

function render() {
  content.innerHTML = `
    ${renderGatewaySection()}
    <div class="divider mb-6" style="margin-top:8px;"></div>
    <p class="text-xs text-white/30 mb-1 uppercase tracking-[.15em]">Biblioteca de Aulas</p>
    <p class="text-sm text-white/40 mb-8 max-w-2xl">As aulas continuam hospedadas na Hubla — aqui você organiza como elas aparecem para as clientes e pode recomendar conteúdos específicos. Isso é diferente dos cards acima: aqui você gerencia aulas individuais, não as categorias em destaque.</p>
    ${renderLibrary()}
    ${renderAssignments()}
  `;
  wireGatewayEvents();
  wireEvents();
}

render();
