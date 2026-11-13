// Visão geral dos encontros — the horizontal E1–E8 timeline at the top of
// Clientes (admin/crm.js). Every student sits, as a small initials chip, on
// the encounter she is on now (automatic from completed individual
// meetings, unless Nay set it by hand on her page). Ascensão students
// appear on the same line with a different (outlined) chip, since those
// programs are separate from the Mentoria. Clicking an encounter opens what
// it requires (homework) and what the team delivers, plus who is there and
// how far along each student's homework is.
import { card, openModal, formatDateTime, toast } from '../shared/ui.js';
import { loadProgramState } from '../shared/program-model.js';
import { supabase } from '../shared/supabase-client.js';
import {
  loadEncounterRefs, resetEncounterRefs, savePlan, loadPlans, loadCompletedCounts, loadUpcomingMeetings,
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
  return `<a href="/admin/client-onboarding.html?id=${s.client.id}" class="${cls}" title="${esc(title)}" aria-label="${esc(title)}">${esc(initials(s.client.full_name))}${s.overridden ? '<span class="enc-chip-pin" aria-hidden="true">•</span>' : ''}</a>`;
}

// profile: the logged-in team member. Both Nay and the assistants move
// students (Mover para…); Nay edits every encounter, an assistant edits the
// ones she leads (encounter_defs.led_by_role = 'assistant', e.g. E3).
let boardProfile = null;
let remount = null;
const canEditEncounter = (def) => boardProfile?.role === 'admin' || (boardProfile?.role === 'assistant' && def?.led_by_role === 'assistant');

export async function mountEncounterBoard(container, clients, profile = null) {
  if (!container) return;
  boardProfile = profile;
  remount = () => mountEncounterBoard(container, clients, profile);
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
      <p class="text-sm text-white/50">Onde cada cliente está — encontros E1 a E8</p>
      <p class="text-xs text-white/30">Toque em um encontro para ver a lição de casa e as entregas · toque na inicial para abrir o cadastro</p>
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
                ${refs.defByNumber.get(col.number)?.led_by_role === 'assistant' ? '<span class="enc-col-premium" style="color:#7fa3c4;border-color:#7fa3c4;">Assistente</span>' : ''}
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
  const { el, close } = openModal({
    title: `Encontro ${number}`,
    bodyHtml: `
      ${canEditEncounter(def) ? '<div class="flex justify-end mb-2"><button type="button" class="btn-ghost" data-edit-encounter style="padding:7px 14px;font-size:12px;">Editar este encontro</button></div>' : ''}
      ${encounterDetailHtml({ def, homework: homeworkFor(number, refs), deliverables: teamDeliverablesFor(number, refs), audience: boardProfile?.role === 'assistant' ? 'assistant' : 'admin' })}
      <div class="enc-sec enc-sec-people">
        <p class="enc-sec-title mb-2">Quem está aqui agora (${here.length})</p>
        <div id="enc-here">${here.length ? '<p class="text-xs text-white/30">Carregando a lição de casa de cada cliente…</p>' : '<p class="text-sm text-white/30">Ninguém neste encontro agora.</p>'}</div>
      </div>`,
  });
  el.querySelector('[data-edit-encounter]')?.addEventListener('click', () => { close(); openEncounterEditor(def, refs); });
  if (!here.length) return;
  const rows = await Promise.all(here.map(async (s) => {
    let hw = [];
    try {
      const state = await loadProgramState(s.client.id, s.client);
      hw = homeworkFor(number, refs, activityStatusFromProgramState(state));
    } catch { /* still list her */ }
    const p = homeworkProgress(hw);
    const missing = hw.filter((h) => !h.completed).map((h) => h.title);
    const move = s.persea && s.seq.length ? `
      <div class="flex items-center gap-2 mt-1.5 flex-wrap">
        <label class="text-xs text-white/40" for="mv-${s.client.id}">Mover para</label>
        <select id="mv-${s.client.id}" data-move-student="${s.client.id}" class="field text-xs" style="width:auto;padding:4px 8px;">
          <option value="">Automático (pelos encontros realizados)</option>
          ${s.seq.map((d) => `<option value="${d.number}" ${s.plan?.current_encounter === d.number ? 'selected' : ''}>E${d.number} — ${esc(d.name)}</option>`).join('')}
        </select>
      </div>` : '';
    return `
      <div class="py-2 border-b border-white/5 last:border-0">
      <a href="/admin/client-onboarding.html?id=${s.client.id}" class="block hover:bg-white/5 -mx-2 px-2 rounded">
        <div class="flex items-center justify-between gap-3 flex-wrap">
          <span class="text-sm">${esc(s.client.full_name)}${s.persea ? '' : ` <span class="text-xs" style="color:#7fa3c4;">· ${esc(PROGRAM_SHORT[s.client.program_slug] || 'outro programa')}</span>`}</span>
          <span class="text-xs" style="color:${p.total && p.done === p.total ? '#8fae8b' : 'var(--gold)'};">${p.total ? `Lição de casa ${p.done}/${p.total}` : 'Sem lição de casa'}${s.upcoming ? ` · agendado ${formatDateTime(s.upcoming.item_date)}` : ' · a agendar'}</span>
        </div>
        ${missing.length ? `<p class="text-xs text-white/30 mt-0.5">Falta: ${esc(missing.join(', '))}</p>` : ''}
      </a>
      ${move}
      </div>`;
  }));
  const target = el.querySelector('#enc-here');
  if (!target) return;
  target.innerHTML = rows.join('');
  // Move a student to another encounter (her "encontro atual"); her own
  // order stays as it is. Automático = back to the completed-meetings count.
  target.querySelectorAll('[data-move-student]').forEach((sel) => sel.addEventListener('change', async () => {
    const s = here.find((x) => x.client.id === sel.dataset.moveStudent);
    sel.disabled = true;
    const { error } = await savePlan(s.client.id, { encounterOrder: s.plan?.encounter_order || null, currentEncounter: sel.value ? Number(sel.value) : null }, boardProfile?.id);
    if (error) { toast(`Não foi possível mover: ${error.message}`, { tone: 'error' }); sel.disabled = false; return; }
    toast(sel.value ? `${s.client.full_name.split(' ')[0]} agora está no E${sel.value}.` : 'Posição volta a ser automática.');
    close();
    remount?.();
  }));
}

// "Editar este encontro": the text the team and the students read, the
// homework (app activities finished before it) and the team's prep
// checklist. Nay also chooses who leads it.
function openEncounterEditor(def, refs) {
  const isAdmin = boardProfile?.role === 'admin';
  const hasLead = 'led_by_role' in def; // column added by migration assistant_led_encounters
  const hwSet = new Set(refs.homeworkByNumber.get(def.number) || []);
  const acts = [...refs.activityBySlug.values()].sort((a, b) => String(a.title).localeCompare(String(b.title)));
  const prep = refs.prepByNumber.get(def.number) || [];
  const { el, close } = openModal({
    title: `Editar E${def.number} — ${def.name}`,
    bodyHtml: `
      <form id="enc-edit" class="space-y-4">
        <div>
          <label class="text-xs text-white/40 block mb-1">Sobre o encontro (a equipe e o app mostram este texto)</label>
          <textarea name="purpose" rows="4" class="field text-sm">${esc(def.purpose || '')}</textarea>
        </div>
        <div>
          <p class="text-xs text-white/40 mb-1">Lição de casa — atividades do app a concluir antes deste encontro</p>
          <div class="grid sm:grid-cols-2 gap-x-4 gap-y-1">
            ${acts.map((a) => `<label class="text-sm flex items-center gap-2"><input type="checkbox" name="hw" value="${esc(a.slug)}" ${hwSet.has(a.slug) ? 'checked' : ''}/> ${esc(a.title)}</label>`).join('')}
          </div>
        </div>
        <div>
          <label class="text-xs text-white/40 block mb-1">Entregas da equipe — prontas antes do encontro (uma por linha)</label>
          <textarea name="prep" rows="4" class="field text-sm">${esc(prep.join('\n'))}</textarea>
        </div>
        ${isAdmin && hasLead ? `
        <div>
          <label class="text-xs text-white/40 block mb-1">Quem conduz este encontro</label>
          <select name="led_by_role" class="field text-sm" style="width:auto;">
            <option value="admin" ${def.led_by_role !== 'assistant' ? 'selected' : ''}>Nay</option>
            <option value="assistant" ${def.led_by_role === 'assistant' ? 'selected' : ''}>Assistente (ela também pode editar este encontro)</option>
          </select>
        </div>` : ''}
        <div class="flex justify-end gap-2">
          <button type="button" class="btn-ghost" data-cancel style="padding:9px 18px;font-size:12.5px;">Cancelar</button>
          <button type="submit" class="btn-primary" style="padding:9px 18px;font-size:12.5px;">Salvar</button>
        </div>
      </form>`,
  });
  el.querySelector('[data-cancel]').addEventListener('click', close);
  el.querySelector('#enc-edit').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const btn = e.target.querySelector('[type=submit]'); btn.disabled = true; btn.textContent = 'Salvando…';
    const fail = (msg) => { toast(msg, { tone: 'error' }); btn.disabled = false; btn.textContent = 'Salvar'; };
    const update = { purpose: String(fd.get('purpose') || '').trim() };
    if (isAdmin && hasLead) update.led_by_role = String(fd.get('led_by_role') || 'admin');
    const { data: upd, error: e1 } = await supabase.from('encounter_defs').update(update).eq('number', def.number).select('number');
    if (e1 || !upd?.length) { fail(`Não foi possível salvar: ${e1?.message || 'sem permissão para este encontro'}`); return; }
    const hw = fd.getAll('hw').map(String);
    const { error: e2 } = await supabase.from('encounter_homework_defs').delete().eq('encounter_number', def.number);
    if (e2) { fail(`Lição de casa: ${e2.message}`); return; }
    if (hw.length) {
      const { error: e3 } = await supabase.from('encounter_homework_defs').insert(hw.map((slug, i) => ({ encounter_number: def.number, activity_slug: slug, sort_order: i })));
      if (e3) { fail(`Lição de casa: ${e3.message}`); return; }
    }
    const lines = String(fd.get('prep') || '').split('\n').map((l) => l.trim()).filter(Boolean);
    const { error: e4 } = await supabase.from('encounter_prep_checklist_items').delete().eq('encounter_number', def.number);
    if (e4) { fail(`Checklist: ${e4.message}`); return; }
    if (lines.length) {
      const { error: e5 } = await supabase.from('encounter_prep_checklist_items').insert(lines.map((label, i) => ({ encounter_number: def.number, label, sort_order: i })));
      if (e5) { fail(`Checklist: ${e5.message}`); return; }
    }
    toast(`E${def.number} atualizado.`);
    close();
    resetEncounterRefs();
    remount?.();
  });
}
