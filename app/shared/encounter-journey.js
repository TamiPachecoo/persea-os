// Linha dos encontros (E1–E8) — one shared definition used by the admin
// overview (admin/crm.js), the student's page for the team
// (admin/client-onboarding.js, both admin and assistant) and the student's
// own app (client/encontros.js, client/program.js).
//
// Real data only:
//   - encounter_defs                 — E1–E8, name, phase, purpose, premium_only
//   - encounter_homework_defs        — "lição de casa": the app activities the
//                                      student finishes BEFORE that encounter
//                                      (a checklist — never a lock)
//   - encounter_prep_checklist_items — what Nay/the team has ready before it
//   - ENCOUNTER_MATERIALS            — what is released to her AT it
//                                      (Guia de Posicionamento E2, Kit Digital E4)
//   - client_encounter_plans         — per-student order chosen by Nay
//                                      (encounter_order) and a manual
//                                      "she is at E3 now" (current_encounter)
//
// Position is automatic (completed individual meetings, the same count
// shared/team-action-model.js has always used) unless Nay overrides it.
// The homework travels with its encounter when the order changes, because
// it is attached to the encounter number, not to a position.
import { supabase } from './supabase-client.js';
import { ENCOUNTER_MATERIALS } from './encounter-materials.js';
import { applicableEncounters } from './journey-skips.js';

export const usesPerseaJourney = (client) => !!client?.program_slug?.startsWith('persea');

const esc = (v) => String(v ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

let refsPromise = null;
// Reference data, identical for every student — loaded once per page.
export function loadEncounterRefs() {
  if (!refsPromise) {
    refsPromise = Promise.all([
      supabase.from('encounter_defs').select('*').order('number'),
      supabase.from('encounter_homework_defs').select('encounter_number, activity_slug, sort_order').order('sort_order'),
      supabase.from('encounter_prep_checklist_items').select('encounter_number, label, sort_order').order('sort_order'),
      supabase.from('program_activities').select('slug, title, description, route'),
    ]).then(([{ data: defs }, { data: hw }, { data: prep }, { data: acts }]) => {
      const homeworkByNumber = new Map();
      (hw || []).forEach((h) => { (homeworkByNumber.get(h.encounter_number) || homeworkByNumber.set(h.encounter_number, []).get(h.encounter_number)).push(h.activity_slug); });
      const prepByNumber = new Map();
      (prep || []).forEach((p) => { (prepByNumber.get(p.encounter_number) || prepByNumber.set(p.encounter_number, []).get(p.encounter_number)).push(p.label); });
      return {
        defs: defs || [],
        defByNumber: new Map((defs || []).map((d) => [d.number, d])),
        homeworkByNumber,
        prepByNumber,
        activityBySlug: new Map((acts || []).map((a) => [a.slug, a])),
      };
    });
  }
  return refsPromise;
}

// --- Per-student plan ---------------------------------------------------
export async function loadPlan(clientId) {
  const { data } = await supabase.from('client_encounter_plans').select('*').eq('client_id', clientId).maybeSingle();
  return data || null;
}
export async function loadPlans(clientIds) {
  if (!clientIds.length) return new Map();
  const { data } = await supabase.from('client_encounter_plans').select('*').in('client_id', clientIds);
  return new Map((data || []).map((p) => [p.client_id, p]));
}
export async function savePlan(clientId, { encounterOrder, currentEncounter }, profileId) {
  return supabase.from('client_encounter_plans').upsert({
    client_id: clientId,
    encounter_order: encounterOrder && encounterOrder.length ? encounterOrder : null,
    current_encounter: currentEncounter || null,
    updated_by: profileId || null,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'client_id' });
}

// Sorts defs by a custom order; anything not named keeps its default place
// after the named ones.
export function orderDefs(defs, order) {
  if (!order?.length) return [...defs];
  const idx = new Map(order.map((n, i) => [Number(n), i]));
  return [...defs].sort((a, b) => (idx.has(a.number) ? idx.get(a.number) : 100 + a.number) - (idx.has(b.number) ? idx.get(b.number) : 100 + b.number));
}

// Her encounters, in her order. Persea: tier + skipped phases (see
// journey-skips.js). Other programs (Ascensão) have no premium encounters.
export function clientSequence(defs, client, plan) {
  const base = usesPerseaJourney(client)
    ? applicableEncounters(defs, client)
    : (defs || []).filter((d) => !d.premium_only);
  return orderDefs(base, plan?.encounter_order);
}

// Where she is: index into her sequence + that encounter (null = all done).
export function positionOf(sequence, completedCount, plan) {
  if (plan?.current_encounter) {
    const i = sequence.findIndex((d) => d.number === plan.current_encounter);
    if (i >= 0) return { index: i, def: sequence[i], overridden: true };
  }
  const i = Math.min(completedCount, sequence.length);
  return { index: i, def: sequence[i] || null, overridden: false };
}

// Completed individual meetings per client — one query for many students.
export async function loadCompletedCounts(clientIds) {
  const out = new Map(clientIds.map((id) => [id, 0]));
  if (!clientIds.length) return out;
  const { data } = await supabase.from('agenda_items').select('related_student_id')
    .eq('type', 'individual_meeting').eq('status', 'completed').in('related_student_id', clientIds);
  (data || []).forEach((r) => out.set(r.related_student_id, (out.get(r.related_student_id) || 0) + 1));
  return out;
}
// Next upcoming individual meeting per client.
export async function loadUpcomingMeetings(clientIds) {
  const out = new Map();
  if (!clientIds.length) return out;
  const { data } = await supabase.from('agenda_items').select('related_student_id, item_date, title')
    .eq('type', 'individual_meeting').eq('status', 'upcoming').in('related_student_id', clientIds)
    .gte('item_date', new Date(Date.now() - 6 * 3600e3).toISOString()).order('item_date');
  (data || []).forEach((r) => { if (!out.has(r.related_student_id)) out.set(r.related_student_id, r); });
  return out;
}

// --- Homework & deliverables -------------------------------------------
// activityStatus: Map slug → activity from loadProgramState (only the
// activities included in HER program and not skipped). Without it, every
// mapped activity is listed with no status (the reference view).
export function activityStatusFromProgramState(state) {
  const m = new Map();
  (state?.phases || []).forEach((ph) => (ph.includedActivities || []).forEach((a) => m.set(a.slug, a)));
  return m;
}
export function homeworkFor(number, refs, activityStatus = null) {
  const slugs = refs.homeworkByNumber.get(number) || [];
  return slugs
    .filter((slug) => !activityStatus || activityStatus.has(slug))
    .map((slug) => {
      const def = refs.activityBySlug.get(slug) || { slug, title: slug };
      const st = activityStatus?.get(slug);
      return {
        slug, title: def.title, description: def.description, route: def.route,
        status: st?.status || null, statusLabel: st?.statusLabel || null, badgeClass: st?.badgeClass || 'badge-locked',
        completed: !!st?.completed,
      };
    });
}
export function teamDeliverablesFor(number, refs) {
  const material = ENCOUNTER_MATERIALS[number];
  return {
    prep: refs.prepByNumber.get(number) || [],
    released: material ? [material.label] : [],
  };
}
export function homeworkProgress(list) {
  return { done: list.filter((h) => h.completed).length, total: list.length };
}

// --- Rendering ---------------------------------------------------------
// The detail for one encounter. audience: 'admin' | 'assistant' | 'client'.
// The student sees her homework and what she receives; the team also sees
// what must be ready on their side.
export function encounterDetailHtml({ def, homework, deliverables, audience = 'admin', activityHref = null, positionLabel = '' }) {
  const isClient = audience === 'client';
  const hwDone = homework.filter((h) => h.completed).length;
  const hwRows = homework.length ? homework.map((h) => {
    const href = activityHref ? activityHref(h) : null;
    const mark = h.status == null ? '•' : h.completed ? '✓' : '○';
    return `
      <li class="flex items-start justify-between gap-3 py-2 border-b border-white/5 last:border-0">
        <div class="flex items-start gap-2 min-w-0">
          <span style="color:${h.completed ? '#8fae8b' : 'var(--muted)'};width:14px;flex:none;">${mark}</span>
          <div class="min-w-0">
            <p class="text-sm">${href ? `<a href="${href}" style="color:var(--cream);text-decoration:underline;text-underline-offset:3px;">${esc(h.title)}</a>` : esc(h.title)}</p>
            ${h.description && isClient ? `<p class="text-xs text-white/30">${esc(h.description)}</p>` : ''}
          </div>
        </div>
        ${h.statusLabel ? `<span class="badge ${h.badgeClass}" style="flex:none;">${esc(h.statusLabel)}</span>` : ''}
      </li>`;
  }).join('') : '';
  const section = (title, note, inner) => `
    <div class="mb-5">
      <p class="text-xs uppercase mb-1" style="color:var(--gold);letter-spacing:.1em;">${title}</p>
      ${note ? `<p class="text-xs text-white/30 mb-2">${note}</p>` : ''}
      ${inner}
    </div>`;
  const list = (items) => `<ul>${items.map((t) => `<li class="text-sm py-1.5 border-b border-white/5 last:border-0 flex gap-2"><span style="color:var(--muted);">•</span><span>${esc(t)}</span></li>`).join('')}</ul>`;
  return `
    <div>
      <div class="flex items-center gap-2 flex-wrap mb-2">
        <span class="badge" style="background:var(--terracotta);color:#16100a;border-color:var(--terracotta);font-weight:700;">E${def.number}</span>
        <p class="font-serif text-lg">${esc(def.name)}</p>
        ${def.premium_only ? '<span class="premium-badge" style="font-size:10px;">Premium</span>' : ''}
        ${positionLabel ? `<span class="text-xs" style="color:var(--gold);">${esc(positionLabel)}</span>` : ''}
      </div>
      <p class="text-sm text-white/50 mb-5">${esc(def.purpose)}</p>
      ${section(
        isClient ? 'Sua lição de casa — conclua antes deste encontro' : 'Lição de casa da aluna — antes do encontro',
        homework.length ? (homework[0].status == null ? 'Atividades do app que a aluna conclui antes deste encontro.' : `${hwDone} de ${homework.length} concluída${homework.length === 1 ? '' : 's'}. Não bloqueia o encontro, mas é importante chegar com tudo feito.`) : '',
        homework.length ? `<ul>${hwRows}</ul>` : `<p class="text-sm text-white/30">${isClient ? 'Nenhuma atividade obrigatória antes deste encontro. É só comparecer!' : 'Sem atividade do app antes deste encontro.'}</p>`,
      )}
      ${!isClient ? section(
        'Entregas da Nay e da equipe — prontas antes do encontro',
        '',
        deliverables.prep.length ? list(deliverables.prep) : '<p class="text-sm text-white/30">Nada específico a preparar.</p>',
      ) : ''}
      ${deliverables.released.length ? section(
        isClient ? 'O que você recebe neste encontro' : 'Liberado para a aluna neste encontro',
        '',
        list(deliverables.released),
      ) : ''}
    </div>`;
}

// One student's horizontal track (her own order). nodes: [{def, state,
// hw:{done,total}}], state ∈ done|current|upcoming.
export function studentTrackHtml(nodes, { title = 'Linha dos encontros', subtitle = '' } = {}) {
  if (!nodes.length) return '';
  const cur = nodes.findIndex((n) => n.state === 'current');
  const fill = nodes.length > 1 ? (Math.max(0, cur === -1 ? nodes.length - 1 : cur) / (nodes.length - 1)) * 88 : 0;
  return `
    <div class="phase-tracker-card mb-6 enc-track-card">
      <div class="flex items-center justify-between flex-wrap gap-2">
        <span class="phase-tier-label">${esc(title)}</span>
        ${subtitle ? `<span class="text-xs" style="color:var(--muted);">${subtitle}</span>` : ''}
      </div>
      <div class="phase-tracker">
        <div class="phase-line"></div>
        <div class="phase-line-fill" style="width:${fill}%;"></div>
        ${nodes.map((n) => {
          const cls = n.state === 'done' ? 'phase-done' : n.state === 'current' ? 'phase-current' : 'phase-locked';
          const hw = n.hw && n.hw.total ? `<span class="enc-hw ${n.hw.done === n.hw.total ? 'enc-hw-done' : ''}">${n.hw.done}/${n.hw.total} lição</span>` : '';
          return `
            <button type="button" data-encounter-open="${n.def.number}" class="phase-node ${cls}" style="cursor:pointer;">
              <div class="phase-dot" style="${n.state === 'upcoming' ? 'opacity:.8;' : ''}">${n.state === 'done' ? '&#10003;' : `E${n.def.number}`}</div>
              <div class="phase-label">${esc(n.def.name)}${hw ? `<br/>${hw}` : ''}</div>
            </button>`;
        }).join('')}
      </div>
      <p class="text-xs text-white/30 mt-3">Toque em um encontro para ver a lição de casa e as entregas.</p>
    </div>`;
}
