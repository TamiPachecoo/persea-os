// Visão geral dos encontros — the horizontal E1–E8 timeline at the top of
// Clientes (admin/crm.js). Every student sits, as a small initials chip, on
// the encounter she is on now (automatic from completed individual
// meetings, unless Nay set it by hand on her page). Ascensão students
// appear on the same line with a different (outlined) chip, since those
// programs are separate from the Mentoria. Clicking an encounter opens what
// it requires (homework) and what the team delivers, plus who is there and
// how far along each student's homework is.
import { card, openModal, formatDateTime } from '../shared/ui.js';
import { loadProgramState } from '../shared/program-model.js';
import {
  loadEncounterRefs, loadPlans, loadCompletedCounts, loadUpcomingMeetings,
  clientSequence, positionOf, usesPerseaJourney, homeworkFor, teamDeliverablesFor,
  activityStatusFromProgramState, homeworkProgress, encounterDetailHtml,
} from '../shared/encounter-journey.js';

const esc = (v) => String(v ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const initials = (name) => (name || '?').trim().split(/\s+/).filter(Boolean).map((w, i, a) => (i === 0 || i === a.length - 1 ? w[0] : '')).join('').toUpperCase().slice(0, 2) || '?';
const PROGRAM_SHORT = { 'ascensao-marca': 'Ascensão da Marca', 'ascensao-imagem': 'Ascensão de Imagem' };

function chipHtml(s) {
  const persea = s.persea;
  const title = [
    s.client.full_name,
    persea ? (s.client.tier === 'premium' ? 'Persea Premium' : 'Persea Essencial') : (PROGRAM_SHORT[s.client.program_slug] || 'Outro programa'),
    s.onboarding ? 'Em onboarding' : s.def ? `Próximo: E${s.def.number} — ${s.def.name}` : 'Encontros concluídos',
    s.upcoming ? `Agendado: ${formatDateTime(s.upcoming.item_date)}` : '',
    s.overridden ? 'Posição definida pela Nay' : '',
  ].filter(Boolean).join('\n');
  const cls = ['enc-chip', persea ? '' : 'enc-chip-alt', s.upcoming ? 'enc-chip-scheduled' : '', s.client.tier === 'premium' && persea ? 'enc-chip-premium' : ''].join(' ');
  return `<a href="client-onboarding.html?id=${s.client.id}" class="${cls}" title="${esc(title)}" aria-label="${esc(title)}">${esc(initials(s.client.full_name))}${s.overridden ? '<span class="enc-chip-pin" aria-hidden="true">•</span>' : ''}</a>`;
}

export async function mountEncounterBoard(container, clients) {
  if (!container) return;
  const list = clients.filter((c) => !c.is_demo);
  if (!list.length) { container.innerHTML = ''; return; }
  container.innerHTML = card('<p class="text-sm text-white/40">Carregando a linha dos encontros…</p>', 'mb-6');

  const ids = list.map((c) => c.id);
  const [refs, plans, completed, upcoming] = await Promise.all([
    loadEncounterRefs(), loadPlans(ids), loadCompletedCounts(ids), loadUpcomingMeetings(ids),
  ]);

  const students = list.map((c) => {
    const plan = plans.get(c.id) || null;
    const persea = usesPerseaJourney(c);
    const onboarding = c._status?.label !== 'Acesso ativo';
    const seq = clientSequence(refs.defs, c, plan);
    const pos = positionOf(seq, completed.get(c.id) || 0, plan);
    return { client: c, plan, persea, onboarding, seq, def: pos.def, overridden: pos.overridden, upcoming: upcoming.get(c.id) || null };
  });

  const columns = [
    { key: 'onb', label: '…', sub: 'Onboarding (cadastro, contrato, acesso)', students: students.filter((s) => s.onboarding) },
    ...refs.defs.map((d) => ({ key: `e${d.number}`, number: d.number, label: `E${d.number}`, sub: d.name, premium: d.premium_only, students: students.filter((s) => !s.onboarding && s.def?.number === d.number) })),
    { key: 'done', label: '✓', sub: 'Encontros concluídos', students: students.filter((s) => !s.onboarding && !s.def) },
  ].filter((col) => col.key !== 'done' || col.students.length);

  const sortChips = (arr) => [...arr].sort((a, b) => Number(b.persea) - Number(a.persea) || a.client.full_name.localeCompare(b.client.full_name));
  container.innerHTML = card(`
    <div class="flex items-baseline justify-between flex-wrap gap-2 mb-1">
      <p class="text-sm text-white/50">Onde cada aluna está — encontros E1 a E8</p>
      <p class="text-xs text-white/30">Toque em um encontro para ver a lição de casa e as entregas · toque na inicial para abrir a aluna</p>
    </div>
    <div class="flex items-center gap-4 flex-wrap text-xs text-white/40 mb-4">
      <span class="flex items-center gap-1.5"><span class="enc-chip enc-chip-legend">AB</span> Mentoria Persea</span>
      <span class="flex items-center gap-1.5"><span class="enc-chip enc-chip-alt enc-chip-legend">AB</span> Ascensão (programa à parte)</span>
      <span class="flex items-center gap-1.5"><span class="enc-chip enc-chip-scheduled enc-chip-legend">AB</span> Encontro já agendado</span>
      <span class="flex items-center gap-1.5"><span class="enc-chip enc-chip-legend">AB<span class="enc-chip-pin">•</span></span> Posição ajustada pela Nay</span>
    </div>
    <p class="text-xs text-white/30 mb-2 md:hidden">Deslize para o lado para ver todos os encontros →</p>
    <div class="enc-board" role="list">
      <div class="enc-board-line" aria-hidden="true"></div>
      ${columns.map((col) => `
        <div class="enc-col ${col.number ? '' : 'enc-col-meta'}" role="listitem">
          ${col.number
            ? `<button type="button" class="enc-col-head" data-board-encounter="${col.number}">
                <span class="enc-col-dot">${col.label}</span>
                <span class="enc-col-name">${esc(col.sub)}</span>
                ${col.premium ? '<span class="enc-col-premium">Premium</span>' : ''}
              </button>`
            : `<div class="enc-col-head"><span class="enc-col-dot enc-col-dot-meta">${col.label}</span><span class="enc-col-name">${esc(col.sub)}</span></div>`}
          <div class="enc-col-chips">${sortChips(col.students).map(chipHtml).join('') || '<span class="enc-col-empty">—</span>'}</div>
          <p class="enc-col-count">${col.students.length || ''}</p>
        </div>`).join('')}
    </div>
  `, 'mb-6');

  container.querySelectorAll('[data-board-encounter]').forEach((btn) => btn.addEventListener('click', () => {
    const number = Number(btn.dataset.boardEncounter);
    openEncounterModal(number, refs, columns.find((c) => c.number === number)?.students || []);
  }));
}

async function openEncounterModal(number, refs, here) {
  const def = refs.defByNumber.get(number);
  const { el } = openModal({
    title: `Encontro ${number}`,
    bodyHtml: `
      ${encounterDetailHtml({ def, homework: homeworkFor(number, refs), deliverables: teamDeliverablesFor(number, refs), audience: 'admin' })}
      <div class="enc-sec enc-sec-people">
        <p class="enc-sec-title mb-2">Quem está aqui agora (${here.length})</p>
        <div id="enc-here">${here.length ? '<p class="text-xs text-white/30">Carregando a lição de casa de cada aluna…</p>' : '<p class="text-sm text-white/30">Nenhuma aluna neste encontro agora.</p>'}</div>
      </div>`,
  });
  if (!here.length) return;
  const rows = await Promise.all(here.map(async (s) => {
    let hw = [];
    try {
      const state = await loadProgramState(s.client.id, s.client);
      hw = homeworkFor(number, refs, activityStatusFromProgramState(state));
    } catch { /* still list her */ }
    const p = homeworkProgress(hw);
    const missing = hw.filter((h) => !h.completed).map((h) => h.title);
    return `
      <a href="client-onboarding.html?id=${s.client.id}" class="block py-2 border-b border-white/5 last:border-0 hover:bg-white/5 -mx-2 px-2 rounded">
        <div class="flex items-center justify-between gap-3 flex-wrap">
          <span class="text-sm">${esc(s.client.full_name)}${s.persea ? '' : ` <span class="text-xs" style="color:#7fa3c4;">· ${esc(PROGRAM_SHORT[s.client.program_slug] || 'outro programa')}</span>`}</span>
          <span class="text-xs" style="color:${p.total && p.done === p.total ? '#8fae8b' : 'var(--gold)'};">${p.total ? `Lição de casa ${p.done}/${p.total}` : 'Sem lição de casa'}${s.upcoming ? ` · agendado ${formatDateTime(s.upcoming.item_date)}` : ' · a agendar'}</span>
        </div>
        ${missing.length ? `<p class="text-xs text-white/30 mt-0.5">Falta: ${esc(missing.join(', '))}</p>` : ''}
      </a>`;
  }));
  const target = el.querySelector('#enc-here');
  if (target) target.innerHTML = rows.join('');
}
