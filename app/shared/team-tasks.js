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
// Assistants (both roles can see the team's names through team_members(),
// since an assistant can't read profiles directly). Without it (older
// database), the admin still reads profiles and the assistant just gets Nay.
async function loadAssistants(profile) {
  const { data, error } = await supabase.rpc('team_members');
  if (!error && data) return data.filter((m) => m.role === 'assistant').map((m) => ({ id: m.id, full_name: m.full_name || 'Assistente' }));
  if (profile.role !== 'admin') return [];
  const { data: rows } = await supabase.from('profiles').select('id, full_name').eq('role', 'assistant').order('full_name');
  return rows || [];
}

// --- history ---------------------------------------------------------------
// Every task/question with its whole conversation, newest activity first:
// the record of what the team did — per student (client page) or for the
// team's own workflow (tasks with no student), in Tarefas → Histórico.
export async function loadHistory({ clientId = null } = {}) {
  let q = supabase.from('team_tasks').select('*').order('updated_at', { ascending: false }).limit(clientId ? 300 : 500);
  if (clientId) q = q.eq('client_id', clientId);
  const { data: tasks } = await q;
  const ids = (tasks || []).map((t) => t.id);
  const comments = [];
  for (let i = 0; i < ids.length; i += 80) {
    const { data } = await supabase.from('team_task_comments').select('*').in('task_id', ids.slice(i, i + 80)).order('created_at');
    comments.push(...(data || []));
  }
  const byTask = new Map();
  comments.forEach((c) => (byTask.get(c.task_id) || byTask.set(c.task_id, []).get(c.task_id)).push(c));
  return (tasks || []).map((t) => {
    const msgs = byTask.get(t.id) || [];
    const last = [t.updated_at, t.created_at, t.completed_at, msgs.at(-1)?.created_at].filter(Boolean).map((d) => new Date(d).getTime());
    return { ...t, comments: msgs, lastActivity: Math.max(...last) };
  }).sort((a, b) => b.lastActivity - a.lastActivity);
}

// Compact (client page / CRM): one line per conversation — title, status,
// last message date and count — that opens to the full thread.
function historyThreadCompact(t, ctx) {
  const n = 1 + t.comments.length;
  const last = [t.created_at, ...t.comments.map((c) => c.created_at), t.completed_at].filter(Boolean).sort().pop();
  return `
    <details class="hist-compact">
      <summary>
        <span class="hist-compact-title">${t.kind === 'question' ? '<span class="task-kind">Pergunta</span> ' : ''}${esc(t.title)}</span>
        <span class="hist-compact-meta">${n} mensage${n === 1 ? 'm' : 'ns'} · ${formatDateTime(last)}</span>
        <span class="badge ${t.status === 'done' ? 'badge-completed' : t.status === 'in_progress' ? 'badge-progress' : 'badge-locked'}" style="flex:none;">${STATUS_LABEL[t.status]}</span>
      </summary>
      ${historyThread(t, ctx)}
      <button type="button" data-task-open="${t.id}" class="btn-text hist-compact-open">Responder / abrir →</button>
    </details>`;
}

function historyThread(t, { profile, clientsById, showClient = true }) {
  const client = showClient && t.client_id ? clientsById.get(t.client_id) : null;
  const toWho = t.assigned_role === 'admin' ? 'Nay' : (t.assigned_to_name ? firstName(t.assigned_to_name) : 'Assistente');
  const fromWho = t.source === 'auto' ? 'Sistema' : firstName(t.created_by_name) || 'Equipe';
  const events = [
    { at: t.created_at, html: `<b>${esc(fromWho)}</b> ${t.kind === 'question' ? 'perguntou' : 'pediu'} para <b>${esc(toWho)}</b>${t.notes ? `<span class="block text-white/60 mt-0.5" style="white-space:pre-wrap;">${esc(t.notes)}</span>` : ''}` },
    ...t.comments.map((c) => ({ at: c.created_at, html: `<b>${esc(firstName(c.author_name) || 'Equipe')}</b><span class="block text-white/70 mt-0.5" style="white-space:pre-wrap;">${esc(c.body)}</span>` })),
    ...(t.status === 'done' && t.completed_at ? [{ at: t.completed_at, html: `✓ Concluída por <b>${esc(firstName(t.completed_by_name) || 'equipe')}</b>` }] : []),
  ].sort((a, b) => new Date(a.at) - new Date(b.at));
  const shown = events.slice(-4);
  const hidden = events.slice(0, -4);
  const ev = (e) => `<div class="hist-ev"><span class="hist-ev-at">${formatDateTime(e.at)}</span><span class="text-xs">${e.html}</span></div>`;
  return `
    <div class="hist-thread">
      <div class="flex items-start justify-between gap-3 flex-wrap">
        <button type="button" data-task-open="${t.id}" class="hist-title text-left min-w-0">
          <span class="text-sm ${t.status === 'done' ? 'text-white/60' : ''}">${t.kind === 'question' ? '<span class="task-kind">Pergunta</span> ' : ''}${esc(t.title)}</span>
          ${client ? `<span class="block text-xs mt-0.5" style="color:var(--gold);">${esc(client.full_name)}</span>` : showClient ? '<span class="block text-xs mt-0.5 text-white/30">Equipe · fluxo de trabalho</span>' : ''}
        </button>
        <span class="badge ${t.status === 'done' ? 'badge-completed' : t.status === 'in_progress' ? 'badge-progress' : 'badge-locked'}">${STATUS_LABEL[t.status]}</span>
      </div>
      <div class="hist-evs">
        ${hidden.length ? `<details><summary class="text-xs text-white/30 cursor-pointer py-1">+ ${hidden.length} mensage${hidden.length === 1 ? 'm' : 'ns'} anterior${hidden.length === 1 ? '' : 'es'}</summary>${hidden.map(ev).join('')}</details>` : ''}
        ${shown.map(ev).join('')}
      </div>
    </div>`;
}

// --- rows ----------------------------------------------------------------
function taskRow(t, { profile, clientsById, showClient = true }) {
  const client = showClient && t.client_id ? clientsById.get(t.client_id) : null;
  const toWho = t.assigned_role === 'admin' ? 'Nay' : (t.assigned_to_name ? firstName(t.assigned_to_name) : 'Assistente');
  const fromWho = t.source === 'auto' ? 'Sistema' : firstName(t.created_by_name) || 'Equipe';
  const due = t.status === 'done' ? `<span class="task-due">feita ${t.completed_at ? formatDateTime(t.completed_at) : ''}</span>` : dueChip(t);
  return `
    <button type="button" data-task-open="${t.id}" class="task-row ${t.status === 'done' ? 'task-row-done' : ''}">
      <span class="task-check" aria-hidden="true">${t.status === 'done' ? '✓' : t.kind === 'question' ? '?' : ''}</span>
      <span class="min-w-0 flex-1 text-left">
        <span class="block text-sm ${t.status === 'done' ? 'line-through text-white/40' : ''}">${t.kind === 'question' ? '<span class="task-kind">Pergunta</span> ' : ''}${esc(t.title)}</span>
        <span class="block text-xs text-white/40 mt-0.5">
          ${client ? `${esc(client.full_name)} · ` : ''}${isMine(t, profile) ? (t.created_by === profile.id ? 'minha tarefa' : `de ${esc(fromWho)}`) : `para ${esc(toWho)}`}${t.status === 'in_progress' ? ' · em andamento' : ''}
        </span>
        ${t.block_start && t.status !== 'done' ? `<span class="block text-xs mt-0.5" style="color:var(--gold);">${blockLabel(t)}</span>` : ''}
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

// Reserve time for a tarefa on the agenda of whoever does it: an agenda item
// (admin_task, Nay's or the assistant's) and, when that person's Google
// Calendar is connected, a busy block there too (no Meet link).
async function reserveTaskTime(task, profile, startIso, minutes) {
  const forNay = task.assigned_role === 'admin';
  const { data: item, error } = await supabase.from('agenda_items').insert({
    type: 'admin_task', title: task.title, item_date: startIso, duration_minutes: minutes, status: 'upcoming',
    assigned_to: forNay ? 'nay' : 'assistant', related_student_id: task.client_id || null,
    topic: task.notes || null, source_key: `team_task:${task.id}`,
  }).select('id').single();
  if (error) return { ok: false, message: error.message };
  await supabase.from('team_tasks').update({ agenda_item_id: item.id, block_start: startIso, block_minutes: minutes }).eq('id', task.id);
  let google = false;
  try {
    const endIso = new Date(new Date(startIso).getTime() + minutes * 60000).toISOString();
    const { data } = await supabase.functions.invoke('google-calendar-create-event', { body: { summary: `🗂️ ${task.title}`, description: task.notes || undefined, start: startIso, end: endIso, no_meet: true } });
    if (data?.event_id) { google = true; await supabase.from('agenda_items').update({ google_event_id: data.event_id }).eq('id', item.id); }
  } catch { /* Google not connected: the block still lives on the PERSEA agenda */ }
  return { ok: true, google };
}
const blockLabel = (t) => {
  if (!t.block_start) return '';
  const a = new Date(t.block_start); const b = new Date(a.getTime() + (t.block_minutes || 60) * 60000);
  return `📅 ${a.toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' }).replace('.', '')} · ${a.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}–${b.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
};

export async function openNewTaskModal(profile, { clientId = null, kind = 'task', forSelf = false, onSaved } = {}) {
  const [clients, assistants] = await Promise.all([loadClientsMap(), loadAssistants(profile)]);
  const isAdmin = profile.role === 'admin';
  const { el, close } = openModal({
    title: kind === 'question' ? 'Nova pergunta' : forSelf ? 'Minha tarefa' : isAdmin ? 'Delegar uma tarefa' : 'Nova tarefa / pergunta',
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
                   <option value="role:admin" ${forSelf ? 'selected' : ''}>Para mim</option>`
                : `<option value="role:admin">Nay</option>
                   ${assistants.filter((a) => a.id !== profile.id).map((a) => `<option value="id:${a.id}">${esc(a.full_name)} (assistente)</option>`).join('')}
                   <option value="id:${profile.id}" ${forSelf ? 'selected' : ''}>Para mim</option>`}
            </select>
          </div>
          <div>
            <label class="text-xs text-white/40 block mb-1">Prazo</label>
            <input name="due_at" type="datetime-local" class="field" value="${defaultDue()}" />
          </div>
        </div>
        <div data-block-box class="${forSelf ? '' : 'hidden'} rounded" style="padding:12px 14px;border:1px solid rgba(201,169,110,.35);background:rgba(201,169,110,.06);">
          <label class="flex items-center gap-2 text-sm"><input type="checkbox" name="block" ${forSelf ? 'checked' : ''}/> Reservar horário na minha agenda para fazer</label>
          <div class="grid sm:grid-cols-2 gap-3 mt-3" data-block-fields>
            <div>
              <label class="text-xs text-white/40 block mb-1">Quando</label>
              <input name="block_start" type="datetime-local" class="field" />
            </div>
            <div>
              <label class="text-xs text-white/40 block mb-1">Duração</label>
              <select name="block_minutes" class="field">
                ${[[30, '30 min'], [60, '1 hora'], [90, '1h30'], [120, '2 horas'], [180, '3 horas'], [240, '4 horas']].map(([m, l]) => `<option value="${m}" ${m === 60 ? 'selected' : ''}>${l}</option>`).join('')}
              </select>
            </div>
          </div>
          <p class="text-xs text-white/30 mt-2">Aparece na sua agenda do PERSEA e bloqueia o horário no seu Google Calendar (se estiver conectado).</p>
        </div>
        <div>
          <label class="text-xs text-white/40 block mb-1">É sobre qual cliente?</label>
          <select name="client_id" class="field">
            <option value="">Nenhum — é sobre o trabalho da equipe</option>
            ${clients.map((c) => `<option value="${c.id}" ${c.id === clientId ? 'selected' : ''}>${esc(c.full_name)}${c.is_demo ? ' (demo)' : ''}</option>`).join('')}
          </select>
        </div>
        <p class="text-xs text-white/30">Escolhendo o cliente, a tarefa e toda a conversa ficam no histórico do perfil dele. Sem cliente, ficam no Histórico da equipe (Tarefas → Histórico). Quem recebe é avisado no app (e por notificação no celular, se ativou). Um dia antes do prazo e se atrasar, o sistema avisa de novo.</p>
        <div class="flex justify-end gap-2">
          <button type="button" class="btn-ghost" data-cancel style="padding:9px 18px;font-size:12.5px;">Cancelar</button>
          <button type="submit" class="btn-primary" style="padding:9px 18px;font-size:12.5px;">${isAdmin ? 'Delegar' : 'Enviar'}</button>
        </div>
      </form>`,
  });
  el.querySelector('[data-cancel]').addEventListener('click', close);
  // The time block only makes sense when the tarefa is for me.
  const selfValue = isAdmin ? 'role:admin' : `id:${profile.id}`;
  const assigneeSel = el.querySelector('[name=assignee]');
  const blockBox = el.querySelector('[data-block-box]');
  const syncBlock = () => {
    const self = assigneeSel.value === selfValue && el.querySelector('[name=kind]:checked')?.value !== 'question';
    blockBox.classList.toggle('hidden', !self);
    el.querySelector('[data-block-fields]').classList.toggle('hidden', !el.querySelector('[name=block]').checked);
  };
  assigneeSel.addEventListener('change', syncBlock);
  el.querySelectorAll('[name=kind], [name=block]').forEach((i) => i.addEventListener('change', syncBlock));
  syncBlock();
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
    const wantsBlock = !blockBox.classList.contains('hidden') && fd.get('block');
    const blockStart = String(fd.get('block_start') || '');
    const blockMinutes = Number(fd.get('block_minutes') || 60);
    if (wantsBlock && !blockStart) { toast('Escolha quando você vai fazer (ou desmarque "Reservar horário").', { tone: 'error' }); return; }
    if (wantsBlock) {
      // The deadline is never before the reserved time.
      const blockEnd = new Date(new Date(blockStart).getTime() + blockMinutes * 60000);
      if (!row.due_at || new Date(row.due_at) < blockEnd) row.due_at = blockEnd.toISOString();
    }
    const btn = e.target.querySelector('[type=submit]'); btn.disabled = true;
    const { data: created, error } = await supabase.from('team_tasks').insert(row).select('*').single();
    if (error) { btn.disabled = false; toast(`Não foi possível salvar: ${error.message}`, { tone: 'error' }); return; }
    close();
    if (wantsBlock) {
      const r = await reserveTaskTime(created, profile, new Date(blockStart).toISOString(), blockMinutes);
      toast(!r.ok ? `Tarefa salva, mas o horário não entrou na agenda: ${r.message}`
        : r.google ? 'Tarefa salva e horário reservado na agenda e no Google Calendar.' : 'Tarefa salva e horário reservado na agenda.', { tone: r.ok ? undefined : 'error' });
    } else {
      toast(row.kind === 'question' ? 'Pergunta enviada.' : 'Tarefa salva.');
    }
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
        ${t.block_start ? `<span class="text-xs" style="color:var(--gold);">${blockLabel(t)} na agenda</span>` : ''}
        ${t.source === 'auto' ? '<span class="text-xs text-white/30">criada automaticamente</span>' : ''}
      </div>
      <p class="font-serif text-xl mb-2">${esc(t.title)}</p>
      ${t.notes ? `<p class="text-sm text-white/60 mb-3" style="white-space:pre-wrap;">${esc(t.notes)}</p>` : ''}
      <p class="text-xs text-white/40 mb-4">
        ${t.source === 'auto' ? 'Sistema' : `De ${esc(firstName(t.created_by_name) || 'equipe')}`} → ${t.assigned_role === 'admin' ? 'Nay' : esc(t.assigned_to_name ? firstName(t.assigned_to_name) : 'Assistente')} · criada ${formatDateTime(t.created_at)}
        ${client ? ` · <a href="${clientHref}" style="color:var(--gold);">${esc(client.full_name)} →</a>` : ' · Equipe (sem cliente)'}
        · <button type="button" class="btn-text" data-relink style="font-size:12px;">${client ? 'Trocar cliente' : 'Vincular a um cliente'}</button>
        ${t.status === 'done' && t.completed_at ? `<br/>Concluída por ${esc(firstName(t.completed_by_name) || 'equipe')} em ${formatDateTime(t.completed_at)}` : ''}
      </p>
      <div class="flex gap-2 flex-wrap mb-5">
        ${t.status === 'open' ? '<button type="button" class="btn-ghost" data-set-status="in_progress" style="padding:8px 14px;font-size:12px;">Comecei</button>' : ''}
        ${t.status !== 'done' ? '<button type="button" class="btn-primary" data-set-status="done" style="padding:8px 14px;font-size:12px;">✓ Concluir</button>' : '<button type="button" class="btn-ghost" data-set-status="open" style="padding:8px 14px;font-size:12px;">Reabrir</button>'}
        ${t.status !== 'done' ? '<button type="button" class="btn-text" data-edit-due style="font-size:12px;">Mudar prazo</button>' : ''}
        ${t.status !== 'done' && !t.block_start && isMine(t, profile) && t.kind !== 'question' ? '<button type="button" class="btn-text" data-reserve style="font-size:12px;">📅 Reservar horário</button>' : ''}
        ${canDelete ? '<button type="button" class="btn-text" data-delete-task style="font-size:12px;color:var(--terracotta);">Apagar</button>' : ''}
      </div>
      <div id="reserve-editor" style="display:none;" class="mb-5 flex gap-2 items-center flex-wrap">
        <input type="datetime-local" class="field" data-reserve-start style="width:auto;" />
        <select class="field" data-reserve-min style="width:auto;">${[[30, '30 min'], [60, '1 hora'], [90, '1h30'], [120, '2 horas'], [180, '3 horas'], [240, '4 horas']].map(([m, l]) => `<option value="${m}" ${m === 60 ? 'selected' : ''}>${l}</option>`).join('')}</select>
        <button type="button" class="btn-ghost" data-save-reserve style="padding:8px 14px;font-size:12px;">Reservar</button>
      </div>
      <div id="relink-editor" style="display:none;" class="mb-5 flex gap-2 items-center flex-wrap">
        <select class="field" style="width:auto;max-width:100%;"><option value="">Nenhum — trabalho da equipe</option></select>
        <button type="button" class="btn-ghost" data-save-relink style="padding:8px 14px;font-size:12px;">Salvar</button>
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
  el.querySelector('[data-reserve]')?.addEventListener('click', () => { el.querySelector('#reserve-editor').style.display = 'flex'; });
  el.querySelector('[data-save-reserve]')?.addEventListener('click', async (e) => {
    const start = el.querySelector('[data-reserve-start]').value;
    if (!start) { toast('Escolha o dia e a hora.', { tone: 'error' }); return; }
    e.target.disabled = true;
    const r = await reserveTaskTime(t, profile, new Date(start).toISOString(), Number(el.querySelector('[data-reserve-min]').value));
    if (!r.ok) { e.target.disabled = false; toast(`Não foi possível reservar: ${r.message}`, { tone: 'error' }); return; }
    toast(r.google ? 'Horário reservado na agenda e no Google Calendar.' : 'Horário reservado na agenda.');
    close(); onChanged?.();
  });
  el.querySelectorAll('[data-set-status]').forEach((b) => b.addEventListener('click', async () => {
    b.disabled = true;
    const { error } = await supabase.from('team_tasks').update({ status: b.dataset.setStatus }).eq('id', t.id);
    if (error) { b.disabled = false; toast(error.message, { tone: 'error' }); return; }
    toast(b.dataset.setStatus === 'done' ? 'Concluída ✓' : 'Atualizada.');
    done();
  }));
  el.querySelector('[data-relink]').addEventListener('click', async () => {
    const box = el.querySelector('#relink-editor');
    const sel = box.querySelector('select');
    if (sel.options.length === 1) {
      const clients = await loadClientsMap();
      sel.insertAdjacentHTML('beforeend', clients.map((c) => `<option value="${c.id}" ${c.id === t.client_id ? 'selected' : ''}>${esc(c.full_name)}${c.is_demo ? ' (demo)' : ''}</option>`).join(''));
    }
    box.style.display = 'flex';
  });
  el.querySelector('[data-save-relink]').addEventListener('click', async () => {
    const v = el.querySelector('#relink-editor select').value || null;
    const { error } = await supabase.from('team_tasks').update({ client_id: v }).eq('id', t.id);
    if (error) { toast(error.message, { tone: 'error' }); return; }
    toast(v ? 'Vinculada ao cliente — aparece no histórico do perfil.' : 'Agora é uma tarefa da equipe.'); done();
  });
  el.querySelector('[data-edit-due]')?.addEventListener('click', () => { el.querySelector('#due-editor').style.display = 'flex'; });
  el.querySelector('[data-save-due]')?.addEventListener('click', async () => {
    const v = el.querySelector('#due-editor input').value;
    const { error } = await supabase.from('team_tasks').update({ due_at: v ? new Date(v).toISOString() : null }).eq('id', t.id);
    if (error) { toast(error.message, { tone: 'error' }); return; }
    toast('Prazo atualizado.'); done();
  });
  el.querySelector('[data-delete-task]')?.addEventListener('click', async () => {
    if (!confirm('Apagar esta tarefa e a conversa?')) return;
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
  let view = params.get('view') === 'history' ? 'history' : 'mine'; // mine | sent | all | history
  let histFilter = ''; // '' = tudo, 'team' = sem cliente, or a client id
  let histSearch = '';
  const render = async () => {
    const [tasks, clients, pushBtn] = await Promise.all([loadTasks({ includeDone: showDone }), loadClientsMap(), pushButtonHtml()]);
    if (view === 'history') return renderHistory(clients, pushBtn, tasks);
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
          <p class="text-sm text-white/40 mt-2 max-w-xl">${isAdmin ? 'Delegue para a assistente com prazo. A pessoa recebe aqui e no celular, e pode te mandar perguntas de volta.' : 'O que a Nay pediu, com prazo — e a conversa da equipe. Em "+ Nova tarefa" você escolhe para quem: a Nay ou a outra assistente. Fica tudo registrado.'}</p>
        </div>
        <div class="flex gap-2 flex-wrap">
          ${isAdmin ? '' : '<button type="button" id="new-question" class="btn-ghost" style="padding:9px 18px;font-size:12.5px;">? Perguntar à Nay</button>'}
          <button type="button" id="new-self-task" class="btn-ghost" style="padding:9px 18px;font-size:12.5px;">+ Minha tarefa</button>
          <button type="button" id="new-task" class="btn-primary" style="padding:9px 18px;font-size:12.5px;">${isAdmin ? '+ Delegar tarefa' : '+ Nova tarefa'}</button>
        </div>
      </div>
      <div class="mb-4">${pushBtn}</div>
      ${card(`
        <div class="flex gap-1 border-b border-white/10 mb-1 flex-wrap">
          <button type="button" data-view="mine" class="tab-btn ${view === 'mine' ? 'active' : ''}">Para mim (${mine.length})</button>
          <button type="button" data-view="sent" class="tab-btn ${view === 'sent' ? 'active' : ''}">Que eu pedi (${sent.length})</button>
          ${isAdmin ? `<button type="button" data-view="all" class="tab-btn ${view === 'all' ? 'active' : ''}">Todas abertas (${open.length})</button>` : ''}
          <button type="button" data-view="history" class="tab-btn">Histórico</button>
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
    content.querySelector('#new-self-task')?.addEventListener('click', () => openNewTaskModal(profile, { forSelf: true, onSaved: render }));
    content.querySelectorAll('[data-task-open]').forEach((b) => b.addEventListener('click', () => openTaskModal(b.dataset.taskOpen, profile, { onChanged: render })));
    wirePushButton(content, profile, render);
  };
  const header = (isAdmin) => `
      <div class="mb-6 flex items-end justify-between gap-4 flex-wrap">
        <div>
          <p class="text-white/40 text-sm mb-1">Tarefas</p>
          <h1 class="text-3xl font-serif">Histórico da equipe</h1>
          <p class="text-sm text-white/40 mt-2 max-w-xl">Tudo o que a equipe conversou e fez, mais recente primeiro. O que é sobre um cliente também aparece no perfil dele; o que é do fluxo de trabalho fica em "Equipe".</p>
        </div>
        <button type="button" id="new-task" class="btn-primary" style="padding:9px 18px;font-size:12.5px;">${isAdmin ? '+ Delegar tarefa' : '+ Nova tarefa'}</button>
      </div>`;
  const renderHistory = async (clients, pushBtn, openTasks) => {
    const isAdmin = profile.role === 'admin';
    const clientsById = new Map(clients.map((c) => [c.id, c]));
    const all = await loadHistory();
    const mineCount = openTasks.filter((t) => t.status !== 'done' && isMine(t, profile)).length;
    const norm = (v) => String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const q = norm(histSearch);
    const list = all.filter((t) => (histFilter === 'team' ? !t.client_id : histFilter ? t.client_id === histFilter : true))
      .filter((t) => !q || norm([t.title, t.notes, clientsById.get(t.client_id)?.full_name, ...t.comments.map((c) => c.body)].join(' ')).includes(q));
    const teamCount = all.filter((t) => !t.client_id).length;
    const withClients = [...new Set(all.map((t) => t.client_id).filter(Boolean))].map((id) => clientsById.get(id)).filter(Boolean)
      .sort((a, b) => a.full_name.localeCompare(b.full_name));
    content.innerHTML = `${header(isAdmin)}
      <div class="mb-4">${pushBtn}</div>
      ${card(`
        <div class="flex gap-1 border-b border-white/10 mb-4 flex-wrap">
          <button type="button" data-view="mine" class="tab-btn">Para mim (${mineCount})</button>
          <button type="button" data-view="sent" class="tab-btn">Que eu pedi</button>
          ${isAdmin ? '<button type="button" data-view="all" class="tab-btn">Todas abertas</button>' : ''}
          <button type="button" data-view="history" class="tab-btn active">Histórico</button>
        </div>
        <div class="flex gap-2 flex-wrap mb-4">
          <select id="hist-filter" class="field" style="width:auto;max-width:100%;">
            <option value="" ${histFilter === '' ? 'selected' : ''}>Tudo (${all.length})</option>
            <option value="team" ${histFilter === 'team' ? 'selected' : ''}>Equipe · fluxo de trabalho (${teamCount})</option>
            ${withClients.map((c) => `<option value="${c.id}" ${histFilter === c.id ? 'selected' : ''}>${esc(c.full_name)}</option>`).join('')}
          </select>
          <input id="hist-search" class="field" style="width:auto;flex:1;min-width:180px;" placeholder="Buscar nas conversas…" value="${esc(histSearch)}" />
        </div>
        ${list.length ? list.map((t) => historyThread(t, { profile, clientsById })).join('') : '<p class="text-sm text-white/40 py-6 text-center">Nada encontrado.</p>'}
      `)}`;
    content.querySelectorAll('[data-view]').forEach((b) => b.addEventListener('click', () => { view = b.dataset.view; render(); }));
    content.querySelector('#hist-filter').addEventListener('change', (e) => { histFilter = e.target.value; render(); });
    let timer;
    content.querySelector('#hist-search').addEventListener('input', (e) => {
      clearTimeout(timer);
      timer = setTimeout(async () => {
        histSearch = e.target.value;
        const pos = e.target.selectionStart;
        await render();
        const inp = content.querySelector('#hist-search'); inp?.focus(); inp?.setSelectionRange(pos, pos);
      }, 350);
    });
    content.querySelector('#new-task').addEventListener('click', () => openNewTaskModal(profile, { onSaved: render }));
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
    const [history, { data: c }] = await Promise.all([loadHistory({ clientId }), supabase.from('clients').select('id, full_name').eq('id', clientId).maybeSingle()]);
    const clientsById = new Map(c ? [[c.id, c]] : []);
    const tasks = history.filter((t) => t.status !== 'done')
      .sort((a, b) => (a.due_at ? new Date(a.due_at) : Infinity) - (b.due_at ? new Date(b.due_at) : Infinity));
    const ctx = { profile, clientsById, showClient: false };
    container.innerHTML = card(`
      <div class="flex items-center justify-between flex-wrap gap-2 mb-2">
        <p class="text-sm text-white/50">Equipe — tarefas e conversas sobre este cliente</p>
        <button type="button" data-client-task-new class="btn-ghost" style="padding:7px 14px;font-size:12px;">${profile.role === 'admin' ? '+ Delegar' : '+ Tarefa / pergunta'}</button>
      </div>
      ${tasks.length ? tasks.map((t) => taskRow(t, ctx)).join('') : '<p class="text-xs text-white/30">Nenhuma tarefa aberta.</p>'}
      ${history.length ? `
        <details class="mt-4">
          <summary class="text-xs uppercase cursor-pointer" style="color:var(--gold);letter-spacing:.1em;">Histórico da equipe (${history.length})</summary>
          <div class="mt-2">${history.map((t) => historyThreadCompact(t, ctx)).join('')}</div>
        </details>` : ''}
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
