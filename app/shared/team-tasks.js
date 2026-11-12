// Tarefas da equipe — delegação entre a Nay (admin) e a assistente, dentro
// do sistema. One module for both roles: the Tarefas page
// (admin/tarefas.html, assistant/tarefas.html), the "Tarefas desta aluna"
// card on a student's page, the due-soon strip on landing pages, and the
// "Ativar notificações" button. Data: team_tasks + team_task_comments
// (see supabase/migrations/20261112150000_team_tasks.sql). Push delivery is
// server-side (Edge Function team-push); this only registers the device.
import { supabase } from './supabase-client.js';
import { card, toast, openModal, formatDateTime } from './ui.js';

const esc = (v) => String(v ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const firstName = (s) => String(s || '').replace(/\(.*?\)/g, '').trim().split(/\s+/)[0] || '';
const SOON_MS = 24 * 3600e3;
export const STATUS_LABEL = { open: 'A fazer', in_progress: 'Em andamento', done: 'Concluída' };

// --- data ----------------------------------------------------------------
export async function loadTasks({ clientId = null, includeDone = false } = {}) {
  let q = supabase.from('team_tasks').select('*').order('due_at', { ascending: true, nullsFirst: false }).order('created_at', { ascending: false });
  if (clientId) q = q.eq('client_id', clientId);
  if (!includeDone) q = q.neq('status', 'done');
  else q = q.limit(400);
  const { data } = await q;
  return data || [];
}
export function isMine(t, profile) {
  return t.assigned_to ? t.assigned_to === profile.id : t.assigned_role === profile.role;
}
export function dueState(t, now = Date.now()) {
  if (t.status === 'done' || !t.due_at) return null;
  const d = new Date(t.due_at).getTime();
  if (d < now) return 'overdue';
  if (d - now <= SOON_MS) return 'soon';
  return 'later';
}
function dueChip(t) {
  if (!t.due_at) return '<span class="task-due">sem prazo</span>';
  const st = dueState(t);
  const label = st === 'overdue' ? `atrasada · ${formatDateTime(t.due_at)}` : `até ${formatDateTime(t.due_at)}`;
  return `<span class="task-due ${st ? `task-due-${st}` : ''}">${st === 'overdue' ? '⚠ ' : st === 'soon' ? '⏰ ' : ''}${esc(label)}</span>`;
}
async function loadClientsMap() {
  const { data } = await supabase.from('clients').select('id, full_name, is_demo').order('full_name');
  return data || [];
}
async function loadAssistants(profile) {
  if (profile.role !== 'admin') return [];
  const { data } = await supabase.from('profiles').select('id, full_name').eq('role', 'assistant').order('full_name');
  return data || [];
}

// --- rows ----------------------------------------------------------------
function taskRow(t, { profile, clientsById, showClient = true }) {
  const client = showClient && t.client_id ? clientsById.get(t.client_id) : null;
  const toWho = t.assigned_role === 'admin' ? 'Nay' : (t.assigned_to_name || 'Equipe');
  const fromWho = t.source === 'auto' ? 'Sistema' : firstName(t.created_by_name) || 'Equipe';
  const due = t.status === 'done' ? `<span class="task-due">feita ${t.completed_at ? formatDateTime(t.completed_at) : ''}</span>` : dueChip(t);
  return `
    <button type="button" data-task-open="${t.id}" class="task-row ${t.status === 'done' ? 'task-row-done' : ''}">
      <span class="task-check" aria-hidden="true">${t.status === 'done' ? '✓' : t.kind === 'question' ? '?' : ''}</span>
      <span class="min-w-0 flex-1 text-left">
        <span class="block text-sm ${t.status === 'done' ? 'line-through text-white/40' : ''}">${t.kind === 'question' ? '<span class="task-kind">Pergunta</span> ' : ''}${esc(t.title)}</span>
        <span class="block text-xs text-white/40 mt-0.5">
          ${client ? `${esc(client.full_name)} · ` : ''}${isMine(t, profile) ? `de ${esc(fromWho)}` : `para ${esc(toWho)}`}${t.status === 'in_progress' ? ' · em andamento' : ''}
        </span>
        <span class="block mt-1 sm:hidden">${due}</span>
      </span>
      <span class="flex-none text-right hidden sm:block">${due}</span>
    </button>`;
}

// --- create / edit -----------------------------------------------------------
function toLocalInput(iso) {
  if (!iso) return '';
  const d = new Date(iso); const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
function defaultDue() {
  const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(18, 0, 0, 0);
  return toLocalInput(d.toISOString());
}

export async function openNewTaskModal(profile, { clientId = null, kind = 'task', onSaved } = {}) {
  const [clients, assistants] = await Promise.all([loadClientsMap(), loadAssistants(profile)]);
  const isAdmin = profile.role === 'admin';
  const { el, close } = openModal({
    title: kind === 'question' ? 'Nova pergunta' : isAdmin ? 'Delegar uma tarefa' : 'Nova tarefa / pergunta',
    bodyHtml: `
      <form id="task-form" class="space-y-4">
        <div class="flex gap-2 flex-wrap">
          <label class="task-kind-opt"><input type="radio" name="kind" value="task" ${kind === 'task' ? 'checked' : ''}/> Tarefa</label>
          <label class="task-kind-opt"><input type="radio" name="kind" value="question" ${kind === 'question' ? 'checked' : ''}/> Pergunta</label>
        </div>
        <div>
          <label class="text-xs text-white/40 block mb-1">O que precisa ser feito?</label>
          <input name="title" class="field" required maxlength="200" placeholder="${isAdmin ? 'Ex.: Enviar a Cartela de Cores da Ana até sexta' : 'Ex.: Posso enviar o Kit Digital da Ana hoje?'}" />
        </div>
        <div>
          <label class="text-xs text-white/40 block mb-1">Detalhes (opcional)</label>
          <textarea name="notes" class="field" rows="3" placeholder="Links, contexto, como fazer…"></textarea>
        </div>
        <div class="grid sm:grid-cols-2 gap-3">
          <div>
            <label class="text-xs text-white/40 block mb-1">Para quem</label>
            <select name="assignee" class="field">
              ${isAdmin
                ? `<option value="role:assistant">Assistente${assistants.length > 1 ? ' (qualquer uma)' : ''}</option>
                   ${assistants.length > 1 ? assistants.map((a) => `<option value="id:${a.id}">${esc(a.full_name)}</option>`).join('') : ''}
                   <option value="role:admin">Eu mesma (lembrete)</option>`
                : `<option value="role:admin">Nay</option><option value="role:assistant">Eu mesma (lembrete)</option>`}
            </select>
          </div>
          <div>
            <label class="text-xs text-white/40 block mb-1">Prazo</label>
            <input name="due_at" type="datetime-local" class="field" value="${defaultDue()}" />
          </div>
        </div>
        <div>
          <label class="text-xs text-white/40 block mb-1">Sobre qual aluna (opcional)</label>
          <select name="client_id" class="field">
            <option value="">— Nenhuma —</option>
            ${clients.map((c) => `<option value="${c.id}" ${c.id === clientId ? 'selected' : ''}>${esc(c.full_name)}${c.is_demo ? ' (demo)' : ''}</option>`).join('')}
          </select>
        </div>
        <p class="text-xs text-white/30">Quem recebe é avisada no app (e por notificação no celular, se ativou). Um dia antes do prazo e se atrasar, o sistema avisa de novo.</p>
        <div class="flex justify-end gap-2">
          <button type="button" class="btn-ghost" data-cancel style="padding:9px 18px;font-size:12.5px;">Cancelar</button>
          <button type="submit" class="btn-primary" style="padding:9px 18px;font-size:12.5px;">${isAdmin ? 'Delegar' : 'Enviar'}</button>
        </div>
      </form>`,
  });
  el.querySelector('[data-cancel]').addEventListener('click', close);
  el.querySelector('#task-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const [kindA, val] = String(fd.get('assignee')).split(':');
    const due = String(fd.get('due_at') || '');
    const row = {
      kind: String(fd.get('kind') || 'task'),
      title: String(fd.get('title') || '').trim(),
      notes: String(fd.get('notes') || '').trim() || null,
      client_id: String(fd.get('client_id') || '') || null,
      assigned_role: kindA === 'role' ? val : 'assistant',
      assigned_to: kindA === 'id' ? val : null,
      due_at: due ? new Date(due).toISOString() : null,
      created_by: profile.id,
    };
    if (!row.title) { toast('Escreva o que precisa ser feito.', { tone: 'error' }); return; }
    const btn = e.target.querySelector('[type=submit]'); btn.disabled = true;
    const { error } = await supabase.from('team_tasks').insert(row);
    if (error) { btn.disabled = false; toast(`Não foi possível salvar: ${error.message}`, { tone: 'error' }); return; }
    close();
    toast(row.kind === 'question' ? 'Pergunta enviada.' : 'Tarefa enviada.');
    onSaved?.();
  });
}

export async function openTaskModal(taskId, profile, { onChanged } = {}) {
  const [{ data: t }, { data: comments }] = await Promise.all([
    supabase.from('team_tasks').select('*').eq('id', taskId).maybeSingle(),
    supabase.from('team_task_comments').select('*').eq('task_id', taskId).order('created_at'),
  ]);
  if (!t) { toast('Tarefa não encontrada (pode ter sido apagada).', { tone: 'error' }); return; }
  let client = null;
  if (t.client_id) ({ data: client } = await supabase.from('clients').select('id, full_name').eq('id', t.client_id).maybeSingle());
  const canDelete = profile.role === 'admin' || t.created_by === profile.id;
  const clientHref = client ? `/admin/client-onboarding.html?id=${client.id}` : null; // same page for both roles
  const { el, close } = openModal({
    title: t.kind === 'question' ? 'Pergunta' : 'Tarefa',
    bodyHtml: `
      <div class="flex items-center gap-2 flex-wrap mb-2">
        <span class="badge ${t.status === 'done' ? 'badge-completed' : t.status === 'in_progress' ? 'badge-progress' : 'badge-locked'}">${STATUS_LABEL[t.status]}</span>
        ${t.status !== 'done' ? dueChip(t) : ''}
        ${t.source === 'auto' ? '<span class="text-xs text-white/30">criada automaticamente</span>' : ''}
      </div>
      <p class="font-serif text-xl mb-2">${esc(t.title)}</p>
      ${t.notes ? `<p class="text-sm text-white/60 mb-3" style="white-space:pre-wrap;">${esc(t.notes)}</p>` : ''}
      <p class="text-xs text-white/40 mb-4">
        ${t.source === 'auto' ? 'Sistema' : `De ${esc(firstName(t.created_by_name) || 'equipe')}`} → ${t.assigned_role === 'admin' ? 'Nay' : 'Assistente'} · criada ${formatDateTime(t.created_at)}
        ${client ? ` · <a href="${clientHref}" style="color:var(--gold);">${esc(client.full_name)} →</a>` : ''}
        ${t.status === 'done' && t.completed_at ? `<br/>Concluída por ${esc(firstName(t.completed_by_name) || 'equipe')} em ${formatDateTime(t.completed_at)}` : ''}
      </p>
      <div class="flex gap-2 flex-wrap mb-5">
        ${t.status === 'open' ? '<button type="button" class="btn-ghost" data-set-status="in_progress" style="padding:8px 14px;font-size:12px;">Comecei</button>' : ''}
        ${t.status !== 'done' ? '<button type="button" class="btn-primary" data-set-status="done" style="padding:8px 14px;font-size:12px;">✓ Concluir</button>' : '<button type="button" class="btn-ghost" data-set-status="open" style="padding:8px 14px;font-size:12px;">Reabrir</button>'}
        ${t.status !== 'done' ? '<button type="button" class="btn-text" data-edit-due style="font-size:12px;">Mudar prazo</button>' : ''}
        ${canDelete ? '<button type="button" class="btn-text" data-delete-task style="font-size:12px;color:var(--terracotta);">Apagar</button>' : ''}
      </div>
      <div id="due-editor" style="display:none;" class="mb-5 flex gap-2 items-center flex-wrap">
        <input type="datetime-local" class="field" style="width:auto;" value="${toLocalInput(t.due_at)}" />
        <button type="button" class="btn-ghost" data-save-due style="padding:8px 14px;font-size:12px;">Salvar prazo</button>
      </div>
      <p class="text-xs uppercase mb-2" style="color:var(--gold);letter-spacing:.1em;">Conversa</p>
      <div class="space-y-2 mb-3">
        ${(comments || []).map((c) => `
          <div class="task-msg ${c.author_id === profile.id ? 'task-msg-me' : ''}">
            <p class="text-xs text-white/40 mb-0.5">${esc(firstName(c.author_name) || 'Equipe')} · ${formatDateTime(c.created_at)}</p>
            <p class="text-sm" style="white-space:pre-wrap;">${esc(c.body)}</p>
          </div>`).join('') || '<p class="text-xs text-white/30">Nenhuma mensagem ainda. Use para responder, tirar dúvidas ou avisar que terminou.</p>'}
      </div>
      <form id="reply-form" class="flex gap-2 items-end">
        <textarea name="body" class="field flex-1" rows="2" placeholder="${t.kind === 'question' ? 'Responder…' : 'Escrever uma mensagem…'}" required></textarea>
        <button type="submit" class="btn-primary" style="padding:9px 16px;font-size:12.5px;">Enviar</button>
      </form>`,
  });
  const done = () => { close(); onChanged?.(); };
  el.querySelectorAll('[data-set-status]').forEach((b) => b.addEventListener('click', async () => {
    b.disabled = true;
    const { error } = await supabase.from('team_tasks').update({ status: b.dataset.setStatus }).eq('id', t.id);
    if (error) { b.disabled = false; toast(error.message, { tone: 'error' }); return; }
    toast(b.dataset.setStatus === 'done' ? 'Concluída ✓' : 'Atualizada.');
    done();
  }));
  el.querySelector('[data-edit-due]')?.addEventListener('click', () => { el.querySelector('#due-editor').style.display = 'flex'; });
  el.querySelector('[data-save-due]')?.addEventListener('click', async () => {
    const v = el.querySelector('#due-editor input').value;
    const { error } = await supabase.from('team_tasks').update({ due_at: v ? new Date(v).toISOString() : null }).eq('id', t.id);
    if (error) { toast(error.message, { tone: 'error' }); return; }
    toast('Prazo atualizado.'); done();
  });
  el.querySelector('[data-delete-task]')?.addEventListener('click', async () => {
    if (!confirm('Apagar esta tarefa e a conversa dela?')) return;
    const { error } = await supabase.from('team_tasks').delete().eq('id', t.id);
    if (error) { toast(error.message, { tone: 'error' }); return; }
    toast('Tarefa apagada.'); done();
  });
  el.querySelector('#reply-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const body = String(new FormData(e.target).get('body') || '').trim();
    if (!body) return;
    const btn = e.target.querySelector('[type=submit]'); btn.disabled = true;
    const { error } = await supabase.from('team_task_comments').insert({ task_id: t.id, body, author_id: profile.id });
    if (error) { btn.disabled = false; toast(error.message, { tone: 'error' }); return; }
    close();
    openTaskModal(t.id, profile, { onChanged });
    onChanged?.();
  });
}

// --- push ------------------------------------------------------------------
function urlB64ToUint8Array(b64) {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from([...raw].map((ch) => ch.charCodeAt(0)));
}
export function pushSupported() {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}
export async function pushState() {
  if (!pushSupported()) return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  try {
    const reg = await navigator.serviceWorker.getRegistration('/');
    const sub = await reg?.pushManager.getSubscription();
    return sub ? 'on' : 'off';
  } catch { return 'off'; }
}
export async function enablePush(profile) {
  if (!pushSupported()) {
    toast('Este aparelho não aceita notificações aqui. No iPhone, instale o app na tela de início primeiro.', { tone: 'error' });
    return false;
  }
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') { toast('Notificações não permitidas. Libere nas configurações do navegador.', { tone: 'error' }); return false; }
  const { data: key, error: kErr } = await supabase.rpc('team_push_public_key');
  if (kErr || !key) { toast('Não foi possível ativar agora. Tente de novo em instantes.', { tone: 'error' }); return false; }
  const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' }).then(() => navigator.serviceWorker.ready);
  let sub = await reg.pushManager.getSubscription();
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64ToUint8Array(key) });
  const j = sub.toJSON();
  const { error } = await supabase.from('push_subscriptions').upsert({
    profile_id: profile.id, endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth, user_agent: navigator.userAgent.slice(0, 200),
  }, { onConflict: 'endpoint' });
  if (error) { toast(`Não foi possível ativar: ${error.message}`, { tone: 'error' }); return false; }
  toast('Notificações ativadas neste aparelho.');
  return true;
}
export async function disablePush() {
  try {
    const reg = await navigator.serviceWorker.getRegistration('/');
    const sub = await reg?.pushManager.getSubscription();
    if (sub) {
      await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
      await sub.unsubscribe();
    }
    toast('Notificações desativadas neste aparelho.');
  } catch { toast('Não foi possível desativar agora.', { tone: 'error' }); }
}
export async function pushButtonHtml() {
  const st = await pushState();
  if (st === 'on') return '<button type="button" id="push-toggle" data-push="off" class="btn-text" style="font-size:12px;">🔔 Notificações ativas · desativar</button>';
  if (st === 'denied') return '<span class="text-xs text-white/40">🔕 Notificações bloqueadas no navegador</span>';
  if (st === 'unsupported') return '<span class="text-xs text-white/40" title="No iPhone: instale o app na tela de início (Compartilhar → Adicionar à Tela de Início) e abra por lá.">🔕 Notificações: instale o app na tela de início</span>';
  return '<button type="button" id="push-toggle" data-push="on" class="btn-ghost" style="padding:8px 14px;font-size:12px;">🔔 Ativar notificações neste aparelho</button>';
}
export function wirePushButton(root, profile, onChange) {
  root.querySelector('#push-toggle')?.addEventListener('click', async (e) => {
    const b = e.currentTarget; b.disabled = true;
    if (b.dataset.push === 'on') await enablePush(profile); else await disablePush();
    onChange?.();
  });
}

// --- Tarefas page --------------------------------------------------------------
export async function mountTasksPage(content, profile) {
  const params = new URLSearchParams(location.search);
  let showDone = false;
  let view = 'mine'; // mine | sent | all
  const render = async () => {
    const [tasks, clients, pushBtn] = await Promise.all([loadTasks({ includeDone: showDone }), loadClientsMap(), pushButtonHtml()]);
    const clientsById = new Map(clients.map((c) => [c.id, c]));
    const open = tasks.filter((t) => t.status !== 'done');
    const mine = open.filter((t) => isMine(t, profile));
    const sent = open.filter((t) => !isMine(t, profile) && t.created_by === profile.id);
    const others = open.filter((t) => !isMine(t, profile) && t.created_by !== profile.id);
    const list = view === 'mine' ? mine : view === 'sent' ? sent : open;
    const overdue = list.filter((t) => dueState(t) === 'overdue');
    const soon = list.filter((t) => dueState(t) === 'soon');
    const rest = list.filter((t) => !['overdue', 'soon'].includes(dueState(t)));
    const ctx = { profile, clientsById };
    const section = (title, arr, tone = '') => arr.length ? `
      <p class="text-xs uppercase mt-5 mb-2" style="letter-spacing:.1em;${tone}">${title} (${arr.length})</p>
      <div>${arr.map((t) => taskRow(t, ctx)).join('')}</div>` : '';
    const done = showDone ? tasks.filter((t) => t.status === 'done').sort((a, b) => new Date(b.completed_at) - new Date(a.completed_at)).slice(0, 60) : [];
    const isAdmin = profile.role === 'admin';
    content.innerHTML = `
      <div class="mb-6 flex items-end justify-between gap-4 flex-wrap">
        <div>
          <p class="text-white/40 text-sm mb-1">Tarefas</p>
          <h1 class="text-3xl font-serif">${isAdmin ? 'Tarefas da equipe' : 'Suas tarefas'}</h1>
          <p class="text-sm text-white/40 mt-2 max-w-xl">${isAdmin ? 'Delegue para a assistente com prazo. Ela recebe aqui e no celular, e pode te mandar perguntas de volta.' : 'O que a Nay pediu, com prazo. Dúvida? Mande uma pergunta para ela por aqui — fica tudo registrado.'}</p>
        </div>
        <div class="flex gap-2 flex-wrap">
          ${isAdmin ? '' : '<button type="button" id="new-question" class="btn-ghost" style="padding:9px 18px;font-size:12.5px;">? Perguntar à Nay</button>'}
          <button type="button" id="new-task" class="btn-primary" style="padding:9px 18px;font-size:12.5px;">${isAdmin ? '+ Delegar tarefa' : '+ Nova tarefa'}</button>
        </div>
      </div>
      <div class="mb-4">${pushBtn}</div>
      ${card(`
        <div class="flex gap-1 border-b border-white/10 mb-1 flex-wrap">
          <button type="button" data-view="mine" class="tab-btn ${view === 'mine' ? 'active' : ''}">Para mim (${mine.length})</button>
          <button type="button" data-view="sent" class="tab-btn ${view === 'sent' ? 'active' : ''}">Que eu pedi (${sent.length})</button>
          ${isAdmin ? `<button type="button" data-view="all" class="tab-btn ${view === 'all' ? 'active' : ''}">Todas abertas (${open.length})</button>` : ''}
        </div>
        ${list.length ? `${section('⚠ Atrasadas', overdue, 'color:#d0705a;')}${section('⏰ Vencem em 24h', soon, 'color:var(--gold);')}${section(overdue.length || soon.length ? 'Próximas' : 'Abertas', rest, 'color:var(--muted);')}`
          : `<p class="text-sm text-white/40 py-6 text-center">${view === 'mine' ? 'Nada pendente para você. 🎉' : 'Nenhuma tarefa aberta aqui.'}</p>`}
        ${!isAdmin && others.length && view === 'mine' ? `<p class="text-xs text-white/30 mt-4">${others.length} outra${others.length === 1 ? '' : 's'} tarefa${others.length === 1 ? '' : 's'} aberta${others.length === 1 ? '' : 's'} da equipe.</p>` : ''}
        <div class="mt-5 flex justify-between flex-wrap gap-2">
          <label class="flex items-center gap-2 text-xs text-white/40"><input type="checkbox" id="show-done" ${showDone ? 'checked' : ''}/> Mostrar concluídas</label>
        </div>
        ${done.length ? `<p class="text-xs uppercase mt-4 mb-2" style="letter-spacing:.1em;color:var(--muted);">Concluídas</p><div>${done.map((t) => taskRow(t, ctx)).join('')}</div>` : ''}
      `)}`;
    content.querySelectorAll('[data-view]').forEach((b) => b.addEventListener('click', () => { view = b.dataset.view; render(); }));
    content.querySelector('#show-done').addEventListener('change', (e) => { showDone = e.target.checked; render(); });
    content.querySelector('#new-task').addEventListener('click', () => openNewTaskModal(profile, { onSaved: render }));
    content.querySelector('#new-question')?.addEventListener('click', () => openNewTaskModal(profile, { kind: 'question', onSaved: render }));
    content.querySelectorAll('[data-task-open]').forEach((b) => b.addEventListener('click', () => openTaskModal(b.dataset.taskOpen, profile, { onChanged: render })));
    wirePushButton(content, profile, render);
  };
  await render();
  const open = params.get('task');
  if (open) openTaskModal(open, profile, { onChanged: render });
}

// --- small embeds ----------------------------------------------------------
// Due-soon strip for landing pages: "2 atrasadas · 1 vence hoje → Tarefas".
export async function dueStripHtml(profile) {
  const tasks = (await loadTasks()).filter((t) => isMine(t, profile) || (profile.role === 'admin'));
  const mine = tasks.filter((t) => isMine(t, profile));
  const overdueAll = tasks.filter((t) => dueState(t) === 'overdue');
  const soonMine = mine.filter((t) => dueState(t) === 'soon');
  const overdueMine = mine.filter((t) => dueState(t) === 'overdue');
  const teamLate = profile.role === 'admin' ? overdueAll.filter((t) => !isMine(t, profile)) : [];
  if (!mine.length && !teamLate.length) return '';
  const href = `/${profile.role === 'assistant' ? 'assistant' : 'admin'}/tarefas.html`;
  const parts = [
    overdueMine.length ? `<span style="color:#d0705a;">⚠ ${overdueMine.length} atrasada${overdueMine.length === 1 ? '' : 's'}</span>` : '',
    soonMine.length ? `<span style="color:var(--gold);">⏰ ${soonMine.length} vence${soonMine.length === 1 ? '' : 'm'} em 24h</span>` : '',
    `<span class="text-white/50">${mine.length} aberta${mine.length === 1 ? '' : 's'} para você</span>`,
    teamLate.length ? `<span style="color:#d0705a;">${teamLate.length} da assistente atrasada${teamLate.length === 1 ? '' : 's'}</span>` : '',
  ].filter(Boolean);
  return `<a href="${href}" class="task-strip mb-6">${parts.join('<span class="text-white/20"> · </span>')}<span class="ml-auto" style="color:var(--gold);">Tarefas →</span></a>`;
}

// "Tarefas desta aluna" on a student's page (both roles).
export async function mountClientTasks(container, profile, clientId) {
  if (!container) return;
  const render = async () => {
    const [tasks, { data: c }] = await Promise.all([loadTasks({ clientId }), supabase.from('clients').select('id, full_name').eq('id', clientId).maybeSingle()]);
    const clientsById = new Map(c ? [[c.id, c]] : []);
    container.innerHTML = card(`
      <div class="flex items-center justify-between flex-wrap gap-2 mb-2">
        <p class="text-sm text-white/50">Tarefas da equipe sobre esta aluna</p>
        <button type="button" data-client-task-new class="btn-ghost" style="padding:7px 14px;font-size:12px;">${profile.role === 'admin' ? '+ Delegar' : '+ Tarefa / pergunta'}</button>
      </div>
      ${tasks.length ? tasks.map((t) => taskRow(t, { profile, clientsById, showClient: false })).join('') : '<p class="text-xs text-white/30">Nenhuma tarefa aberta para ela.</p>'}
    `, 'mb-6');
    container.querySelector('[data-client-task-new]').addEventListener('click', () => openNewTaskModal(profile, { clientId, onSaved: render }));
    container.querySelectorAll('[data-task-open]').forEach((b) => b.addEventListener('click', () => openTaskModal(b.dataset.taskOpen, profile, { onChanged: render })));
  };
  await render();
}

// Count for the nav badge (my open tasks that are overdue or due in 24h,
// plus new ones not yet started).
export async function myAttentionCount(profile) {
  const tasks = await loadTasks();
  return tasks.filter((t) => isMine(t, profile) && (t.status === 'open' || ['overdue', 'soon'].includes(dueState(t)))).length;
}

// Badge on every "Tarefas" link in the shell (desktop nav + mobile bar).
export async function decorateTaskNav(role) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;
  const n = await myAttentionCount({ id: session.user.id, role });
  if (!n) return;
  document.querySelectorAll('a.nav-link[href$="tarefas.html"], a.mobile-tab-link[href$="tarefas.html"], a.mobile-nav-panel-link[href$="tarefas.html"]').forEach((a) => {
    if (a.querySelector('.nav-count')) return;
    const target = a.querySelector('span:last-child') || a;
    target.insertAdjacentHTML('beforeend', ` <span class="nav-count">${n > 9 ? '9+' : n}</span>`);
  });
}
