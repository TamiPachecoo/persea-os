// Content Center admin — two separate systems on one page:
//  1. The Conteúdos gateway (renderGatewaySection) — the small, ordered set
//     of premium cards clients see, each just a link out to Hubla. Managed
//     here behind a discreet "Gerenciar conteúdos" toggle; the default view
//     is the same read-only preview a client sees.
//  2. The Content Center library (renderLibrary/renderAssignments, below) —
//     the existing per-lesson metadata + link library and per-student
//     recommendations. Untouched: still Hubla-hosted, metadata/link only.
//
// Real bug found: this whole file was 100% MockDB — no environment branch,
// no supabase import at all — while client/content.js (what a real client
// actually sees) already reads real content_categories/tenant_settings.
// So "Gerenciar conteúdos" looked fully functional here (edit modal, move,
// hide, the Hubla URL field, all present) but only ever wrote to local
// MockDB state — never the real table a real client's "Abrir na Hubla"
// button reads. Every real content_categories.hubla_url and
// tenant_settings.hubla_all_content_url was still its original seed
// placeholder (literally "PLACEHOLDER-marca-pessoal" etc.) with no way for
// Nay to ever have fixed it — the actual root cause of the broken link a
// real client hit on mobile. Gateway section (only — the Content Center
// library below stays MockDB/out of scope for this fix) now branches on
// isProductionEnvironment(): real reads/writes against content_categories/
// tenant_settings in production (admin-only RLS, confirmed via
// pg_policies — matches this page's own requireProfile('admin') gate
// exactly), MockDB unchanged in staging/demo.
import {
  MockDB, CONTENT_TRACKS, CONTENT_TRACK_LABEL,
} from '../shared/mock-db.js';
import {
  renderShell, card, toast, formatDate, openModal, isValidHttpUrl,
  externalLinkAttrs, contentCardInner, hublaHref, isProductionEnvironment,
} from '../shared/ui.js';
import { requireProfile } from '../shared/supabase-auth.js';
import { supabase } from '../shared/supabase-client.js';

if (!(await requireProfile('admin'))) throw new Error('not authorized');
document.body.innerHTML = renderShell({ role: 'admin', active: 'content.html', title: 'Conteúdos' });
const content = document.getElementById('app-content');

let manageMode = false;
// Populated by loadGatewayData() each render — the handlers below read
// from these rather than re-querying per action (delete/move/toggle all
// need the current list; the URL-form save needs the settings row's real
// id) — same simple module-level-state style this file already uses for
// manageMode.
let currentCategories = [];
let currentTenantId = null;

function shapeCategory(row) {
  return {
    id: row.id, title: row.title, description: row.description, hublaUrl: row.hubla_url,
    coverImage: row.cover_image_url, coverTone: row.cover_tone, isVisible: row.is_visible, displayOrder: row.display_order,
  };
}

// Mirrors MockDB.getContentCategories({includeHidden})/getTenant() exactly
// in shape (camelCase, same field names) so gatewayCardManage/
// gatewayCardPreview/contentCardInner below need zero changes — only the
// data source differs.
async function loadGatewayData() {
  if (!isProductionEnvironment()) {
    return { categories: MockDB.getContentCategories({ includeHidden: manageMode }), hublaAllContentUrl: MockDB.getTenant().hublaAllContentUrl };
  }
  const [{ data: catRows }, { data: tenantRow }] = await Promise.all([
    supabase.from('content_categories').select('*').order('display_order', { ascending: true }),
    supabase.from('tenant_settings').select('id, hubla_all_content_url').limit(1).maybeSingle(),
  ]);
  const all = (catRows || []).map(shapeCategory);
  currentCategories = all;
  currentTenantId = tenantRow?.id ?? null;
  return { categories: manageMode ? all : all.filter((c) => c.isVisible), hublaAllContentUrl: tenantRow?.hubla_all_content_url || null };
}

async function saveRealCategory({ id, title, description, coverImage, hublaUrl }) {
  if (id) {
    const { error } = await supabase.from('content_categories')
      .update({ title, description, cover_image_url: coverImage, hubla_url: hublaUrl, updated_at: new Date().toISOString() }).eq('id', id);
    return error;
  }
  const nextOrder = currentCategories.length ? Math.max(...currentCategories.map((c) => c.displayOrder ?? 0)) + 1 : 0;
  const { error } = await supabase.from('content_categories')
    .insert({ title, description, cover_image_url: coverImage, hubla_url: hublaUrl, display_order: nextOrder, is_visible: true });
  return error;
}

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
  el.querySelector('#category-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const hublaUrl = fd.get('hublaUrl');
    if (!isValidHttpUrl(hublaUrl)) {
      el.querySelector('#cat-url-error').style.display = 'block';
      return;
    }
    const payload = { id: category ? category.id : undefined, title: fd.get('title'), description: fd.get('description') || '', coverImage: fd.get('coverImage') || null, hublaUrl };
    const error = isProductionEnvironment() ? await saveRealCategory(payload) : (MockDB.saveContentCategory(payload), null);
    if (error) { toast('Não foi possível salvar agora.', { tone: 'error' }); return; }
    close();
    toast(isNew ? 'Card adicionado.' : 'Card atualizado.');
    render();
  });
  el.querySelector('#delete-category')?.addEventListener('click', async () => {
    if (!confirm(`Excluir o card "${data.title}"? Essa ação não pode ser desfeita.`)) return;
    const error = isProductionEnvironment()
      ? (await supabase.from('content_categories').delete().eq('id', category.id)).error
      : (MockDB.deleteContentCategory(category.id), null);
    if (error) { toast('Não foi possível excluir agora.', { tone: 'error' }); return; }
    close();
    toast('Card excluído.');
    render();
  });
}

async function renderGatewaySection() {
  const { categories, hublaAllContentUrl } = await loadGatewayData();
  const tenant = { hublaAllContentUrl };

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
      <a ${externalLinkAttrs(hublaHref(tenant.hublaAllContentUrl))} class="btn-primary inline-block mt-2">Abrir todos os conteúdos na Hubla</a>
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
    btn.addEventListener('click', () => {
      const cat = isProductionEnvironment()
        ? currentCategories.find((c) => c.id === btn.dataset.editCat)
        : MockDB.getContentCategory(btn.dataset.editCat);
      openCategoryModal(cat);
    });
  });
  content.querySelectorAll('[data-toggle-cat]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (isProductionEnvironment()) {
        const cat = currentCategories.find((c) => c.id === btn.dataset.toggleCat);
        await supabase.from('content_categories').update({ is_visible: !cat?.isVisible }).eq('id', btn.dataset.toggleCat);
      } else {
        MockDB.toggleContentCategoryVisibility(btn.dataset.toggleCat);
      }
      render();
    });
  });
  content.querySelectorAll('[data-move-cat]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (isProductionEnvironment()) {
        // Swap display_order with the adjacent card in the current
        // (already display_order-sorted) list — same "move up/down by one"
        // semantics MockDB.moveContentCategory has, just as two real
        // UPDATEs instead of a local array splice.
        const dir = Number(btn.dataset.dir);
        const idx = currentCategories.findIndex((c) => c.id === btn.dataset.moveCat);
        const swapIdx = idx + dir;
        if (idx === -1 || swapIdx < 0 || swapIdx >= currentCategories.length) return;
        const a = currentCategories[idx];
        const b = currentCategories[swapIdx];
        await Promise.all([
          supabase.from('content_categories').update({ display_order: b.displayOrder }).eq('id', a.id),
          supabase.from('content_categories').update({ display_order: a.displayOrder }).eq('id', b.id),
        ]);
      } else {
        MockDB.moveContentCategory(btn.dataset.moveCat, Number(btn.dataset.dir));
      }
      render();
    });
  });
  content.querySelector('#all-content-url-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const url = new FormData(e.target).get('hublaAllContentUrl');
    if (!isValidUrlOrEmpty(url)) { toast('Insira uma URL válida.', { tone: 'error' }); return; }
    if (isProductionEnvironment()) {
      const { error } = await supabase.from('tenant_settings').update({ hubla_all_content_url: url || null }).eq('id', currentTenantId);
      if (error) { toast('Não foi possível salvar agora.', { tone: 'error' }); return; }
    } else {
      MockDB.setTenantHublaAllContentUrl(url);
    }
    toast('Link atualizado.');
    render();
  });
}

// Real bug/gap found: the whole Content Center Library + Assignments
// below (renderLibrary/renderAssignments/openResourceModal/
// openAssignmentModal) was 100% MockDB too — same situation as the
// gateway section above, and for "recommend content to a specific
// client" specifically, the real receiving end (client/content.js's
// recommendedSection — resource_assignments joined with resources) has
// existed and worked for real this whole time with nothing on the admin
// side able to actually write to it. resources_client_read RLS already
// grants a client SELECT the moment general_audience=true, with no admin
// UI ever built to use that either — exactly the shape needed for
// "recorded classes visible to everyone," not just per-client
// recommendations. Real Supabase now, same isProductionEnvironment()
// branch pattern as the gateway section (MockDB unchanged in
// staging/demo).
let currentResources = [];
let currentAssignments = [];

function shapeResource(row) {
  return {
    id: row.id, title: row.title, description: row.description, track: row.track, phaseKey: row.phase_key,
    duration: row.duration, hublaUrl: row.hubla_url, recommendation: row.recommendation,
    generalAudience: row.general_audience, coverImage: row.cover_image_url,
  };
}

async function loadRealResourcesByTrack() {
  const { data } = await supabase.from('resources').select('*').order('created_at', { ascending: true });
  currentResources = (data || []).map(shapeResource);
  const byTrack = Object.fromEntries(CONTENT_TRACKS.map((t) => [t, []]));
  currentResources.forEach((r) => { (byTrack[r.track] || (byTrack[r.track] = [])).push(r); });
  return byTrack;
}

async function loadRealAssignments() {
  // resources(title) — a resource can be deleted after being assigned
  // (real FK has no cascade rule forcing otherwise); left join surfaces
  // that as null, same "(conteúdo removido)" fallback the demo already
  // shows for exactly this case.
  const { data } = await supabase.from('resource_assignments')
    .select('*, resources(title), clients(full_name)').order('assigned_at', { ascending: false });
  currentAssignments = data || [];
  return currentAssignments.map((a) => ({
    id: a.id, resourceId: a.resource_id, resource: a.resources ? { title: a.resources.title } : null,
    clientName: a.clients?.full_name || '—', deadline: a.deadline, reason: a.reason, completed: a.completed,
  }));
}

async function saveRealResource({ id, title, description, track, phaseKey, duration, generalAudience, hublaUrl, recommendation, coverImage }) {
  const payload = {
    title, description, track, phase_key: phaseKey, duration, general_audience: generalAudience,
    hubla_url: hublaUrl, recommendation, cover_image_url: coverImage, updated_at: new Date().toISOString(),
  };
  if (id) return (await supabase.from('resources').update(payload).eq('id', id)).error;
  return (await supabase.from('resources').insert(payload)).error;
}

function resourceRow(r, assignedCount = 0) {
  const linkOk = isValidHttpUrl(r.hublaUrl);
  return `
    <div class="py-3 border-b border-white/5 last:border-0">
      <div class="flex items-start gap-3 flex-wrap">
        ${isValidHttpUrl(r.coverImage) ? `<img src="${r.coverImage}" alt="" style="width:64px;height:85px;border-radius:6px;object-fit:cover;flex-shrink:0;border:1px solid var(--line);" />` : ''}
        <div class="min-w-0" style="flex:1 1 200px;">
          <p class="font-medium text-sm break-words">${r.title}</p>
          ${r.description ? `<p class="text-xs text-white/40 mt-1 break-words">${r.description}</p>` : ''}
          <div class="flex items-center gap-2 mt-2 flex-wrap">
            <span class="badge ${r.generalAudience ? 'badge-completed' : 'badge-locked'}">${r.generalAudience ? 'Geral' : 'Somente por indicação'}</span>
            ${r.duration ? `<span class="text-xs text-white/30">${r.duration}</span>` : ''}
            ${r.phaseKey ? `<span class="text-xs text-white/30">· Fase ${r.phaseKey}</span>` : ''}
            ${assignedCount ? `<span class="text-xs text-white/30">· Recomendado a ${assignedCount} cliente${assignedCount === 1 ? '' : 's'}</span>` : ''}
            ${!linkOk ? '<span class="text-xs" style="color:var(--error);">Link pendente</span>' : ''}
          </div>
          <div class="flex items-center gap-2 flex-wrap mt-3">
            <button type="button" data-attribute-resource="${r.id}" class="btn-ghost">Recomendar a Cliente</button>
            <button type="button" data-edit-resource="${r.id}" class="btn-ghost">Editar</button>
          </div>
        </div>
      </div>
    </div>
  `;
}

async function renderLibrary() {
  const byTrack = isProductionEnvironment() ? await loadRealResourcesByTrack() : MockDB.getResourcesByTrack();
  const assignments = isProductionEnvironment() ? await loadRealAssignments() : MockDB.getAllAssignments();
  const assignedCountByResource = {};
  assignments.forEach((a) => {
    assignedCountByResource[a.resourceId] = (assignedCountByResource[a.resourceId] || 0) + 1;
  });
  return CONTENT_TRACKS.map((t) => card(`
    <div class="flex items-center justify-between mb-3">
      <p class="text-sm text-white/50">${CONTENT_TRACK_LABEL[t]}</p>
      <button type="button" data-new-resource="${t}" class="btn-ghost">+ Novo Conteúdo</button>
    </div>
    ${(byTrack[t] || []).length ? byTrack[t].map((r) => resourceRow(r, assignedCountByResource[r.id] || 0)).join('') : '<p class="text-xs text-white/20">Nenhum conteúdo nesta trilha ainda.</p>'}
  `, 'mb-6')).join('');
}

async function renderAssignments() {
  const assignments = isProductionEnvironment() ? await loadRealAssignments() : MockDB.getAllAssignments();
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
    duration: '', hublaUrl: '', recommendation: '', generalAudience: true, coverImage: '',
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
          <label class="text-xs text-white/40 block mb-1">URL da Imagem de Capa <span class="text-white/20">(opcional)</span></label>
          <input name="coverImage" class="field" value="${data.coverImage || ''}" placeholder="https://... ou deixe em branco" />
        </div>
        <div>
          <label class="text-xs text-white/40 block mb-1">Link da Aula <span class="text-white/20">(Hubla ou gravação no Google Drive)</span></label>
          <input name="hublaUrl" class="field" value="${data.hublaUrl || ''}" placeholder="https://pay.hubla.com.br/... ou https://drive.google.com/..." />
          <p class="text-xs text-white/20 mt-1">Para uma aula gravada no Google Meet: abra a gravação na Hubla ou no Google Drive, copie o link de compartilhamento e cole aqui — é exatamente esse link que abre quando a cliente clica em "Assistir".</p>
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
  el.querySelector('#resource-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const payload = {
      id: resource ? resource.id : undefined,
      title: fd.get('title'), description: fd.get('description'), track: fd.get('track'),
      phaseKey: fd.get('phaseKey') || null, duration: fd.get('duration') || null,
      generalAudience: fd.get('generalAudience') === 'true',
      hublaUrl: fd.get('hublaUrl'), recommendation: fd.get('recommendation') || null,
      coverImage: fd.get('coverImage') || null,
    };
    const error = isProductionEnvironment() ? await saveRealResource(payload) : (MockDB.saveResource(payload), null);
    if (error) { toast('Não foi possível salvar agora.', { tone: 'error' }); return; }
    close();
    toast(isNew ? 'Conteúdo adicionado.' : 'Conteúdo atualizado.');
    render();
  });
}

async function openAssignmentModal(preselectedResourceId) {
  const resources = isProductionEnvironment() ? currentResources : MockDB.getResources();
  const clients = isProductionEnvironment()
    ? (await supabase.from('clients').select('id, full_name').eq('is_demo', false).order('full_name')).data?.map((c) => ({ id: c.id, fullName: c.full_name })) || []
    : MockDB.listClients();
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
  el.querySelector('#assignment-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const reason = fd.get('reason'), deadline = fd.get('deadline') || null, relatedPhaseOrMeeting = fd.get('relatedPhaseOrMeeting') || null;
    let error = null;
    if (isProductionEnvironment()) {
      // assigned_at is NOT NULL with no default (same real trap fixed in
      // client/images.js's upload insert) — set explicitly here too.
      ({ error } = await supabase.from('resource_assignments').insert({
        resource_id: fd.get('resourceId'), client_id: fd.get('studentId'), reason,
        deadline, related_phase_or_meeting: relatedPhaseOrMeeting, assigned_at: new Date().toISOString(),
      }));
    } else {
      MockDB.assignResourceToClient(fd.get('resourceId'), fd.get('studentId'), { reason, deadline, relatedPhaseOrMeeting });
    }
    if (error) { toast('Não foi possível atribuir agora.', { tone: 'error' }); return; }
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
    btn.addEventListener('click', () => {
      const r = isProductionEnvironment() ? currentResources.find((x) => x.id === btn.dataset.editResource) : MockDB.getResource(btn.dataset.editResource);
      openResourceModal(r);
    });
  });
  content.querySelector('#new-assignment')?.addEventListener('click', () => openAssignmentModal());
  content.querySelectorAll('[data-attribute-resource]').forEach((btn) => {
    btn.addEventListener('click', () => openAssignmentModal(btn.dataset.attributeResource));
  });
}

async function render() {
  content.innerHTML = `
    ${await renderGatewaySection()}
    <div class="divider mb-6" style="margin-top:8px;"></div>
    <p class="text-xs text-white/30 mb-1 uppercase tracking-[.15em]">Biblioteca de Aulas</p>
    <p class="text-sm text-white/40 mb-8 max-w-2xl">Cada aula fica hospedada na Hubla ou como gravação no Google Drive — aqui você organiza como elas aparecem para as clientes e pode recomendar conteúdos específicos. Isso é diferente dos cards acima: aqui você gerencia aulas individuais, não as categorias em destaque.</p>
    ${await renderLibrary()}
    ${await renderAssignments()}
  `;
  wireGatewayEvents();
  wireEvents();
}

render();
