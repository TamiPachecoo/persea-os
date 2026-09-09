// Agenda — the assistant's mirror of Nay's real calendar (admin/agenda.js):
// same month-grid view, same underlying MockDB.getAgendaItems, so an item
// scheduled here is the exact same item Nay sees on her side and the client
// sees on her own dashboard when relatedStudentId is set — one calendar,
// three views. Unlike Nay's version, this one is locked to her own
// assigned items — everything else is Nay's to see, not a filter to widen.
import {
  MockDB, AGENDA_TYPES, AGENDA_TYPE_LABEL, AGENDA_STATUSES, AGENDA_STATUS_LABEL,
  ASSISTANT_PERSONAS, ASSISTANT_PERSONA_LABEL, ASSIGNEE_LABEL,
} from '../shared/mock-db.js';
import { renderShell, card, formatDateTime, toast, openModal } from '../shared/ui.js';
import { supabase } from '../shared/supabase-client.js';
import { getCurrentProfile, requireProfile } from '../shared/supabase-auth.js';

const AGENDA_TYPE_ICON = {
  class: '🎓', individual_meeting: '👤', checkpoint: '☎️', group_meeting: '👥',
  online_event: '🌐', admin_task: '🗂️', deadline: '⏰', photo_review: '📸',
};

if (!(await requireProfile('assistant'))) throw new Error('not authorized');
document.body.innerHTML = renderShell({ role: 'assistant', active: 'agenda.html', title: 'Agenda' });
const content = document.getElementById('app-content');

const WEEKDAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MAX_CHIPS_PER_DAY = 3;

const filters = { type: '', showCompleted: false };
// Same connection layer as admin/agenda.js — calendar_connections is keyed
// by internal_user_id, not by tenant, so this is her own Google account,
// entirely separate from Nay's. Set fresh on every render() from
// google-calendar-status / google-calendar-list-events.
let calendarConnected = false;
let googleEvents = [];
let viewDate = new Date();
viewDate.setDate(1);
viewDate.setHours(0, 0, 0, 0);

function pad2(n) { return String(n).padStart(2, '0'); }
function dateKey(d) { return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; }
function formatTime(iso) { return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); }

function dateKeyForGoogleEvent(e) {
  if (e.all_day) {
    const [y, m, d] = e.start.split('-').map(Number);
    return dateKey(new Date(y, m - 1, d));
  }
  return dateKey(new Date(e.start));
}

// Connection layer only — no sync, no event creation/reading yet. Status
// comes exclusively from google-calendar-status (see that function's
// comment): calendar_connections itself has no client-facing RLS policy at
// all, so this is the only way the UI can ever know whether an account is
// connected.
async function getCalendarStatus() {
  const { data, error } = await supabase.functions.invoke('google-calendar-status');
  if (error || data?.error) return { connected: false };
  return data;
}

// Read-only pull of what's already on the connected calendar — no PERSEA
// agenda item is created from these, just a list shown for reference/
// conflict-checking. Empty array (not an error) when not connected.
async function loadGoogleEvents() {
  if (!calendarConnected) return [];
  const { data, error } = await supabase.functions.invoke('google-calendar-list-events');
  if (error || data?.error) return [];
  return data.events || [];
}

// The pulled-in events themselves still show up as chips inside the month
// grid below (see buildItemsByDay/calChip) — this card is just the
// connection status, not a second listing of the same events.
function renderGoogleCalendarCard(status) {
  return card(`
    <div class="flex items-center justify-between flex-wrap gap-3">
      <div>
        <p class="text-sm text-white/50 mb-1">Google Calendar</p>
        ${status.connected
          ? `<p class="text-sm" style="color:var(--gold);">Status: Conectado</p>
             <p class="text-xs text-white/40 mt-0.5">Conta conectada: ${status.google_account_email || '—'}</p>`
          : '<p class="text-xs text-white/30">Nenhuma conta conectada ainda.</p>'}
      </div>
      ${status.connected
        ? '<button id="reconnect-google-calendar" class="btn-ghost">Reconectar Google</button>'
        : '<button id="connect-google-calendar" class="btn-primary">Connect Google Calendar</button>'}
    </div>
  `, 'mb-6');
}

function monthGridDays(year, month) {
  const firstOfMonth = new Date(year, month, 1);
  const gridStart = new Date(year, month, 1 - firstOfMonth.getDay());
  const days = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    days.push(d);
  }
  const lastRowAllNextMonth = days.slice(35, 42).every((d) => d.getMonth() !== month);
  return lastRowAllNextMonth ? days.slice(0, 35) : days;
}

function agendaFilterPredicate(it) {
  if (it.assignedTo !== 'assistant') return false;
  if (filters.type && it.type !== filters.type) return false;
  if (!filters.showCompleted && it.status !== 'upcoming') return false;
  return true;
}

function buildItemsByDay() {
  const byDay = {};
  MockDB.getAgendaItems().filter(agendaFilterPredicate).forEach((it) => {
    const key = dateKey(new Date(it.date));
    (byDay[key] || (byDay[key] = [])).push(it);
  });
  // Merged in as plain read-only entries, tagged source:'google' so
  // calChip/openDayListModal render them as links out to Google instead of
  // PERSEA items you can click into and edit.
  googleEvents.forEach((e) => {
    const key = dateKeyForGoogleEvent(e);
    (byDay[key] || (byDay[key] = [])).push({
      id: e.id, source: 'google', title: e.summary, date: e.all_day ? `${e.start}T00:00:00` : e.start,
      all_day: e.all_day, html_link: e.html_link, status: 'upcoming',
    });
  });
  Object.values(byDay).forEach((arr) => arr.sort((a, b) => new Date(a.date) - new Date(b.date)));
  return byDay;
}

function renderFilters() {
  return card(`
    <div class="flex flex-wrap items-end gap-4">
      <div>
        <p class="text-xs text-white/40 mb-1">Tipo</p>
        <select id="filter-type" class="field text-sm">
          <option value="">Todos os tipos</option>
          ${AGENDA_TYPES.map((t) => `<option value="${t}" ${filters.type === t ? 'selected' : ''}>${AGENDA_TYPE_LABEL[t]}</option>`).join('')}
        </select>
      </div>
      <label class="flex items-center gap-2 text-sm pb-2">
        <input type="checkbox" id="filter-completed" ${filters.showCompleted ? 'checked' : ''} /> Mostrar concluídos/cancelados
      </label>
      <button id="new-agenda-item" class="btn-primary ml-auto" style="padding:9px 18px;font-size:12.5px;">+ Novo Item</button>
    </div>
  `, 'mb-6');
}

// Assistant Painel removal: ported verbatim from assistant/queue.js's
// meetingRequestRow — meeting requests assigned to her now live on her
// Agenda, since that's what they are.
function meetingRequestRow(r) {
  return `
    <div class="py-3 border-b border-white/5 last:border-0">
      <p class="font-medium text-sm">${r.clientName}</p>
      <p class="text-sm mt-1">${r.reason}</p>
      <div class="flex items-center gap-2 mt-3">
        <button data-resolve-request="${r.clientId}:${r.id}" class="btn-text">Marcar como concluída</button>
      </div>
    </div>
  `;
}
function renderAssistantRequestsCard() {
  const requests = MockDB.listAllMeetingRequests().filter((r) => r.assignedTo === 'assistant' && r.status !== 'done');
  if (!requests.length) return '';
  return card(`
    <p class="text-sm text-white/50 mb-4">Solicitações de Reunião</p>
    ${requests.map(meetingRequestRow).join('')}
  `, 'mb-6');
}

function renderPendenciasStrip() {
  const buckets = MockDB.getAgendaBuckets(agendaFilterPredicate);
  if (!buckets.pendencias.length) return '';
  return card(`
    <div class="flex items-center justify-between mb-3">
      <p class="text-sm" style="color:var(--terracotta);">⚠ Pendências <span style="color:var(--muted);">(data já passou)</span></p>
      <span class="text-xs" style="color:var(--muted);">${buckets.pendencias.length}</span>
    </div>
    <div class="flex flex-wrap gap-2">
      ${buckets.pendencias.map((it) => `
        <button type="button" data-agenda-item="${it.id}" class="btn-ghost" style="padding:6px 12px; font-size:12px;">${AGENDA_TYPE_ICON[it.type] || ''} ${it.title} · ${formatDateTime(it.date)}</button>
      `).join('')}
    </div>
  `, 'mb-6');
}

function calChip(it) {
  if (it.source === 'google') {
    return `
      <a href="${it.html_link || '#'}" target="_blank" rel="noopener" data-google-event class="cal-chip" style="border-left:3px solid #4285F4; display:block;">
        ${it.all_day ? '' : `<span class="cal-chip-time">${formatTime(it.date)}</span> `}📅 ${it.title}
      </a>
    `;
  }
  return `
    <button type="button" data-agenda-item="${it.id}" class="cal-chip ${it.status !== 'upcoming' ? 'cal-chip-done' : ''}">
      <span class="cal-chip-time">${formatTime(it.date)}</span> ${AGENDA_TYPE_ICON[it.type] || ''} ${it.title}
    </button>
  `;
}

function renderCalendar() {
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const days = monthGridDays(year, month);
  const itemsByDay = buildItemsByDay();
  const todayKey = dateKey(new Date());
  const monthLabel = viewDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  return card(`
    <div class="flex items-center justify-between mb-5 flex-wrap gap-3">
      <div class="flex items-center gap-3">
        <button type="button" id="cal-prev" class="btn-ghost" style="padding:6px 12px;" aria-label="Mês anterior">‹</button>
        <p class="text-lg font-serif capitalize" style="min-width:180px;">${monthLabel}</p>
        <button type="button" id="cal-next" class="btn-ghost" style="padding:6px 12px;" aria-label="Próximo mês">›</button>
      </div>
      <button type="button" id="cal-today" class="btn-text">Hoje</button>
    </div>
    <div class="cal-grid">
      ${WEEKDAY_LABELS.map((l) => `<div class="cal-weekday">${l}</div>`).join('')}
      ${days.map((d) => {
        const key = dateKey(d);
        const inMonth = d.getMonth() === month;
        const items = itemsByDay[key] || [];
        const visible = items.slice(0, MAX_CHIPS_PER_DAY);
        const extra = items.length - visible.length;
        return `
          <div class="cal-cell ${inMonth ? '' : 'cal-cell-other-month'} ${key === todayKey ? 'cal-cell-today' : ''}" data-cal-day="${key}">
            <p class="cal-day-num">${d.getDate()}</p>
            <div class="cal-chips">
              ${visible.map(calChip).join('')}
              ${extra > 0 ? `<button type="button" data-cal-more="${key}" class="cal-more">+${extra} mais</button>` : ''}
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `, 'mb-8');
}

function openDayListModal(key) {
  const items = (buildItemsByDay()[key] || []);
  const [y, m, d] = key.split('-').map(Number);
  const label = new Date(y, m - 1, d).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
  const { el, close } = openModal({
    title: label,
    bodyHtml: `
      <div class="divide-y" style="border-color:var(--line);">
        ${items.map((it) => it.source === 'google' ? `
          <a href="${it.html_link || '#'}" target="_blank" rel="noopener" class="w-full text-left flex items-center justify-between py-2.5 hover:bg-white/5 -mx-1 px-1 rounded transition-colors" style="display:flex;">
            <div>
              <p class="text-sm">📅 ${it.title}</p>
              <p class="text-xs mt-0.5 text-white/30">${it.all_day ? 'Dia inteiro' : formatDateTime(it.date)} · Google Calendar</p>
            </div>
          </a>
        ` : `
          <button type="button" data-agenda-item="${it.id}" class="w-full text-left flex items-center justify-between py-2.5 hover:bg-white/5 -mx-1 px-1 rounded transition-colors">
            <div>
              <p class="text-sm">${AGENDA_TYPE_ICON[it.type] || ''} ${it.title}</p>
              <p class="text-xs mt-0.5 text-white/30">${formatDateTime(it.date)}</p>
            </div>
            ${it.status !== 'upcoming' ? `<span class="badge badge-locked">${AGENDA_STATUS_LABEL[it.status]}</span>` : ''}
          </button>
        `).join('')}
      </div>
      <div class="flex justify-end pt-4">
        <button type="button" id="day-modal-new" class="btn-ghost">+ Novo Item Neste Dia</button>
      </div>
    `,
  });
  el.querySelectorAll('[data-agenda-item]').forEach((btn) => {
    btn.addEventListener('click', () => { close(); openAgendaModal(btn.dataset.agendaItem); });
  });
  el.querySelector('#day-modal-new').addEventListener('click', () => { close(); openAgendaModal(null, key); });
}

function openAgendaModal(itemId, defaultDateKey) {
  const item = itemId ? MockDB.getAgendaItem(itemId) : null;
  const isNew = !item;
  const defaultDate = defaultDateKey ? `${defaultDateKey}T09:00:00` : new Date().toISOString();
  const data = item || {
    type: 'individual_meeting', title: '', date: defaultDate, status: 'upcoming',
    relatedStudentId: null, relatedGroupLabel: '', topic: '', prepNotes: '',
    generalNotes: '', onlineLink: '', followUpNotes: '', assignedTo: 'assistant', assigneeNotes: '', assistantPersona: 'ju',
  };
  const clients = MockDB.listClients();

  const { el, close } = openModal({
    title: isNew ? 'Novo Item da Agenda' : 'Editar Item da Agenda',
    bodyHtml: `
      <form id="agenda-form" class="space-y-4">
        <div class="grid sm:grid-cols-2 gap-4">
          <div>
            <label class="text-xs text-white/40 block mb-1">Título</label>
            <input name="title" class="field" value="${data.title}" required />
          </div>
          <div>
            <label class="text-xs text-white/40 block mb-1">Tipo</label>
            <select name="type" class="field">
              ${AGENDA_TYPES.map((t) => `<option value="${t}" ${data.type === t ? 'selected' : ''}>${AGENDA_TYPE_LABEL[t]}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="grid sm:grid-cols-2 gap-4">
          <div>
            <label class="text-xs text-white/40 block mb-1">Data e Hora</label>
            <input name="date" type="datetime-local" class="field" value="${(data.date || '').slice(0, 16)}" required />
          </div>
          <div>
            <label class="text-xs text-white/40 block mb-1">Status</label>
            <select name="status" class="field">
              ${AGENDA_STATUSES.map((s) => `<option value="${s}" ${data.status === s ? 'selected' : ''}>${AGENDA_STATUS_LABEL[s]}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="grid sm:grid-cols-2 gap-4">
          <div>
            <label class="text-xs text-white/40 block mb-1">Cliente Relacionada <span class="text-white/20">(ela verá isso no painel dela)</span></label>
            <select name="relatedStudentId" class="field">
              <option value="">— Nenhuma —</option>
              ${clients.map((c) => `<option value="${c.id}" ${data.relatedStudentId === c.id ? 'selected' : ''}>${c.fullName}</option>`).join('')}
            </select>
          </div>
          <div>
            <label class="text-xs text-white/40 block mb-1">Grupo / Turma</label>
            <input name="relatedGroupLabel" class="field" value="${data.relatedGroupLabel || ''}" placeholder="Ex.: Q&amp;A Mensal" />
          </div>
        </div>
        <div>
          <label class="text-xs text-white/40 block mb-1">Tópico <span class="text-white/20">(visível para a cliente, se houver)</span></label>
          <input name="topic" class="field" value="${data.topic || ''}" />
        </div>
        <div>
          <label class="text-xs text-white/40 block mb-1">Link da Reunião Online <span class="text-white/20">(visível para a cliente, se houver)</span></label>
          <input name="onlineLink" class="field" value="${data.onlineLink || ''}" placeholder="https://..." />
        </div>
        <div>
          <label class="text-xs text-white/40 block mb-1">Notas de Preparação <span class="text-white/20">(interno)</span></label>
          <textarea name="prepNotes" rows="2" class="field">${data.prepNotes || ''}</textarea>
        </div>
        <div>
          <label class="text-xs text-white/40 block mb-1">Notas Gerais / da Reunião <span class="text-white/20">(interno — fica registrado aqui no OS)</span></label>
          <textarea name="generalNotes" rows="2" class="field">${data.generalNotes || ''}</textarea>
        </div>
        <div>
          <label class="text-xs text-white/40 block mb-1">Notas de Follow-up <span class="text-white/20">(interno)</span></label>
          <textarea name="followUpNotes" rows="2" class="field">${data.followUpNotes || ''}</textarea>
        </div>
        <div class="grid sm:grid-cols-2 gap-4 pt-2" style="border-top:1px solid var(--line);">
          <div>
            <label class="text-xs text-white/40 block mb-1">Atribuir a</label>
            <select name="assignedTo" id="agenda-assigned-to" class="field">
              <option value="">— Não atribuído —</option>
              ${Object.entries(ASSIGNEE_LABEL).map(([v, label]) => `<option value="${v}" ${data.assignedTo === v ? 'selected' : ''}>${label}</option>`).join('')}
            </select>
          </div>
          <div id="agenda-persona-field" style="${data.assignedTo === 'assistant' ? '' : 'display:none;'}">
            <label class="text-xs text-white/40 block mb-1">Como <span class="text-white/20">(nome que aparece pro contexto)</span></label>
            <select name="assistantPersona" class="field">
              ${ASSISTANT_PERSONAS.map((p) => `<option value="${p}" ${data.assistantPersona === p ? 'selected' : ''}>${ASSISTANT_PERSONA_LABEL[p]}</option>`).join('')}
            </select>
          </div>
        </div>
        <div>
          <label class="text-xs text-white/40 block mb-1">Notas para Quem For Atribuído <span class="text-white/20">(visível para a Nay e para a Assistente)</span></label>
          <textarea name="assigneeNotes" rows="2" class="field" placeholder="O que a pessoa responsável precisa saber para tocar isso.">${data.assigneeNotes || ''}</textarea>
        </div>
        <div class="flex justify-end pt-2">
          <button type="submit" class="btn-primary" style="padding:9px 18px;font-size:12.5px;">${isNew ? 'Criar Item' : 'Salvar Alterações'}</button>
        </div>
      </form>
    `,
  });

  el.querySelector('#agenda-assigned-to').addEventListener('change', (e) => {
    el.querySelector('#agenda-persona-field').style.display = e.target.value === 'assistant' ? '' : 'none';
  });
  el.querySelector('#agenda-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const payload = {
      title: fd.get('title'), type: fd.get('type'), date: fd.get('date'), status: fd.get('status'),
      relatedStudentId: fd.get('relatedStudentId') || null, relatedGroupLabel: fd.get('relatedGroupLabel') || null,
      topic: fd.get('topic'), onlineLink: fd.get('onlineLink'), prepNotes: fd.get('prepNotes'),
      generalNotes: fd.get('generalNotes'), followUpNotes: fd.get('followUpNotes'),
      assignedTo: fd.get('assignedTo') || null, assigneeNotes: fd.get('assigneeNotes'),
      assistantPersona: fd.get('assignedTo') === 'assistant' ? fd.get('assistantPersona') : null,
    };
    if (isNew) MockDB.createAgendaItem(payload);
    else MockDB.updateAgendaItem(item.id, payload);
    close();
    toast(isNew ? 'Item adicionado à agenda.' : 'Alterações salvas.');
    render();
  });
}

async function render() {
  const calendarStatus = await getCalendarStatus();
  calendarConnected = calendarStatus.connected;
  googleEvents = await loadGoogleEvents();
  content.innerHTML = `
    <div class="flex items-center justify-between flex-wrap gap-3 mb-6">
      <div>
        <p class="text-white/40 text-sm mb-1">Agenda</p>
        <h1 class="text-3xl font-serif">Sua Agenda</h1>
      </div>
      <a href="recordings.html" class="btn-ghost">Recomendações de Conteúdo →</a>
    </div>
    ${renderGoogleCalendarCard(calendarStatus)}
    ${renderAssistantRequestsCard()}
    ${renderFilters()}
    ${renderPendenciasStrip()}
    ${renderCalendar()}
  `;

  content.querySelector('#connect-google-calendar')?.addEventListener('click', async (e) => {
    const profile = await getCurrentProfile();
    if (!profile || !['admin', 'assistant'].includes(profile.role)) {
      toast('Faça login no sistema real (login.html) antes de conectar o Google Calendar.', { tone: 'error' });
      return;
    }
    e.target.disabled = true; e.target.textContent = 'Conectando...';
    const { data, error } = await supabase.functions.invoke('google-calendar-auth-start');
    if (error || data?.error) {
      toast(data?.error || error.message, { tone: 'error' });
      e.target.disabled = false; e.target.textContent = 'Connect Google Calendar';
      return;
    }
    window.location.href = data.url;
  });

  // Reconnect = clear this account's own stored Google OAuth credentials
  // (google-calendar-disconnect, scoped to the caller's own row — never
  // another user's, never any other PERSEA data), then run the exact same
  // auth-start flow as a first-time connect. Needed whenever the underlying
  // Google OAuth app/credentials change (e.g. moving off a test project),
  // since the old refresh token belongs to the old app and would otherwise
  // just sit there marked "connected" while silently no longer working.
  content.querySelector('#reconnect-google-calendar')?.addEventListener('click', async (e) => {
    const profile = await getCurrentProfile();
    if (!profile || !['admin', 'assistant'].includes(profile.role)) {
      toast('Faça login no sistema real (login.html) antes de reconectar o Google Calendar.', { tone: 'error' });
      return;
    }
    e.target.disabled = true; e.target.textContent = 'Reconectando...';
    const { data: discData, error: discErr } = await supabase.functions.invoke('google-calendar-disconnect');
    if (discErr || discData?.error) {
      toast(discData?.error || discErr.message, { tone: 'error' });
      e.target.disabled = false; e.target.textContent = 'Reconectar Google';
      return;
    }
    const { data, error } = await supabase.functions.invoke('google-calendar-auth-start');
    if (error || data?.error) {
      toast(data?.error || error.message, { tone: 'error' });
      e.target.disabled = false; e.target.textContent = 'Reconectar Google';
      return;
    }
    window.location.href = data.url;
  });

  content.querySelectorAll('[data-resolve-request]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const [clientId, requestId] = btn.dataset.resolveRequest.split(':');
      MockDB.resolveMeetingRequest(clientId, requestId);
      toast('Solicitação marcada como concluída.');
      render();
    });
  });

  content.querySelector('#filter-type').addEventListener('change', (e) => { filters.type = e.target.value; render(); });
  content.querySelector('#filter-completed').addEventListener('change', (e) => { filters.showCompleted = e.target.checked; render(); });
  content.querySelector('#new-agenda-item').addEventListener('click', () => openAgendaModal(null));

  content.querySelector('#cal-prev').addEventListener('click', () => { viewDate.setMonth(viewDate.getMonth() - 1); render(); });
  content.querySelector('#cal-next').addEventListener('click', () => { viewDate.setMonth(viewDate.getMonth() + 1); render(); });
  content.querySelector('#cal-today').addEventListener('click', () => {
    viewDate = new Date(); viewDate.setDate(1); viewDate.setHours(0, 0, 0, 0); render();
  });

  content.querySelectorAll('[data-cal-day]').forEach((cell) => {
    cell.addEventListener('click', (e) => {
      if (e.target.closest('[data-agenda-item]') || e.target.closest('[data-cal-more]') || e.target.closest('[data-google-event]')) return;
      openAgendaModal(null, cell.dataset.calDay);
    });
  });
  content.querySelectorAll('[data-cal-more]').forEach((btn) => {
    btn.addEventListener('click', (e) => { e.stopPropagation(); openDayListModal(btn.dataset.calMore); });
  });
  content.querySelectorAll('[data-agenda-item]').forEach((btn) => {
    btn.addEventListener('click', (e) => { e.stopPropagation(); openAgendaModal(btn.dataset.agendaItem); });
  });
}

render();

const deepLinkItemId = new URLSearchParams(location.search).get('item');
if (deepLinkItemId) openAgendaModal(deepLinkItemId);

// google-calendar-callback redirects back here with ?calendar=connected|
// denied|error(&reason=...) — surface it once, then scrub the URL so a
// refresh doesn't keep re-showing the toast.
const calendarParam = new URLSearchParams(location.search).get('calendar');
if (calendarParam) {
  const CALENDAR_TOAST = {
    connected: { text: 'Google Calendar conectado com sucesso.' },
    denied: { text: 'Conexão com o Google Calendar cancelada.', tone: 'error' },
    error: { text: 'Não foi possível conectar o Google Calendar.', tone: 'error' },
  };
  const t = CALENDAR_TOAST[calendarParam];
  if (t) toast(t.text, t.tone ? { tone: t.tone } : undefined);
  const cleanUrl = new URL(location.href);
  cleanUrl.searchParams.delete('calendar');
  cleanUrl.searchParams.delete('reason');
  history.replaceState({}, '', cleanUrl.toString());
}
