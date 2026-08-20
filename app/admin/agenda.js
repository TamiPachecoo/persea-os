// Agenda — Nay's real calendar, laid out the way Google Calendar's month
// view is: weekday header, a grid of day squares, click a day to add
// something on it, click an item to open it. The difference from Google
// Calendar: when an item here is linked to a client (relatedStudentId),
// that client sees it on her own dashboard (see MockDB.getUpcomingMeetingForClient
// + client/dashboard.js), and anything typed into the meeting notes while
// it happens lives in this OS instead of staying trapped in Nay's head/inbox.
import {
  MockDB, AGENDA_TYPES, AGENDA_TYPE_LABEL, AGENDA_STATUSES, AGENDA_STATUS_LABEL,
  ASSISTANT_PERSONAS, ASSISTANT_PERSONA_LABEL, ASSIGNEE_LABEL,
} from '../shared/mock-db.js';
import { renderShell, card, formatDateTime, toast, openModal } from '../shared/ui.js';

const AGENDA_TYPE_ICON = {
  class: '🎓', individual_meeting: '👤', group_meeting: '👥',
  online_event: '🌐', admin_task: '🗂️', deadline: '⏰', photo_review: '📸',
};

document.body.innerHTML = renderShell({ role: 'admin', active: 'agenda.html', title: 'Agenda' });
const content = document.getElementById('app-content');

const WEEKDAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MAX_CHIPS_PER_DAY = 3;

const filters = { type: '', assignedTo: '', showCompleted: false };
// Which month the grid is currently showing — always normalized to day 1 so
// setMonth() never overflows into the wrong month on short months.
let viewDate = new Date();
viewDate.setDate(1);
viewDate.setHours(0, 0, 0, 0);

function pad2(n) { return String(n).padStart(2, '0'); }
function dateKey(d) { return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; }
function formatTime(iso) { return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); }

function monthGridDays(year, month) {
  const firstOfMonth = new Date(year, month, 1);
  const gridStart = new Date(year, month, 1 - firstOfMonth.getDay());
  const days = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    days.push(d);
  }
  // Drop a trailing 6th row if it's entirely spillover into next month —
  // most months only need 5 rows, and a blank row of nothing but "31, 1, 2…"
  // reads as clutter, not information.
  const lastRowAllNextMonth = days.slice(35, 42).every((d) => d.getMonth() !== month);
  return lastRowAllNextMonth ? days.slice(0, 35) : days;
}

function agendaFilterPredicate(it) {
  if (filters.type && it.type !== filters.type) return false;
  if (filters.assignedTo === 'none' && it.assignedTo) return false;
  if (filters.assignedTo && filters.assignedTo !== 'none' && it.assignedTo !== filters.assignedTo) return false;
  if (!filters.showCompleted && it.status !== 'upcoming') return false;
  return true;
}

function buildItemsByDay() {
  const byDay = {};
  MockDB.getAgendaItems().filter(agendaFilterPredicate).forEach((it) => {
    const key = dateKey(new Date(it.date));
    (byDay[key] || (byDay[key] = [])).push(it);
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
      <div>
        <p class="text-xs text-white/40 mb-1">Atribuído a</p>
        <select id="filter-assigned" class="field text-sm">
          <option value="">Todos</option>
          <option value="none" ${filters.assignedTo === 'none' ? 'selected' : ''}>Não atribuído</option>
          ${Object.entries(ASSIGNEE_LABEL).map(([v, label]) => `<option value="${v}" ${filters.assignedTo === v ? 'selected' : ''}>${label}</option>`).join('')}
        </select>
      </div>
      <label class="flex items-center gap-2 text-sm pb-2">
        <input type="checkbox" id="filter-completed" ${filters.showCompleted ? 'checked' : ''} /> Mostrar concluídos/cancelados
      </label>
      <button id="new-agenda-item" class="btn-primary ml-auto" style="padding:9px 18px;font-size:12.5px;">+ Novo Item</button>
    </div>
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
        ${items.map((it) => `
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
    generalNotes: '', onlineLink: '', followUpNotes: '', assignedTo: null, assigneeNotes: '', assistantPersona: 'ju',
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
            <label class="text-xs text-white/40 block mb-1">Como <span class="text-white/20">(Ju/Nath são a mesma assistente — só o nome muda pelo contexto)</span></label>
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

function render() {
  content.innerHTML = `
    <div class="flex items-center justify-between flex-wrap gap-3 mb-6">
      <div>
        <p class="text-white/40 text-sm mb-1">Agenda</p>
        <h1 class="text-3xl font-serif">Sua Agenda</h1>
      </div>
      <a href="recordings.html" class="btn-ghost">Gravações e Transcrições →</a>
    </div>
    ${renderFilters()}
    ${renderPendenciasStrip()}
    ${renderCalendar()}
  `;

  content.querySelector('#filter-type').addEventListener('change', (e) => { filters.type = e.target.value; render(); });
  content.querySelector('#filter-assigned').addEventListener('change', (e) => { filters.assignedTo = e.target.value; render(); });
  content.querySelector('#filter-completed').addEventListener('change', (e) => { filters.showCompleted = e.target.checked; render(); });
  content.querySelector('#new-agenda-item').addEventListener('click', () => openAgendaModal(null));

  content.querySelector('#cal-prev').addEventListener('click', () => { viewDate.setMonth(viewDate.getMonth() - 1); render(); });
  content.querySelector('#cal-next').addEventListener('click', () => { viewDate.setMonth(viewDate.getMonth() + 1); render(); });
  content.querySelector('#cal-today').addEventListener('click', () => {
    viewDate = new Date(); viewDate.setDate(1); viewDate.setHours(0, 0, 0, 0); render();
  });

  content.querySelectorAll('[data-cal-day]').forEach((cell) => {
    cell.addEventListener('click', (e) => {
      if (e.target.closest('[data-agenda-item]') || e.target.closest('[data-cal-more]')) return;
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

// Deep-link from the Painel's exceptions card ("agenda.html?item=<id>") —
// jump straight into that item's edit modal instead of making her hunt for it.
const deepLinkItemId = new URLSearchParams(location.search).get('item');
if (deepLinkItemId) openAgendaModal(deepLinkItemId);
