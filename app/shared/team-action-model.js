// What should Nay/the team actually DO next for an already-active client —
// the one question the admin has no answer to once a client's status
// simply says "Ativa" (deriveClientStatus in client-status.js stops there
// on purpose: nextAction is null once access is created, since everything
// after that point is program work, not onboarding pipeline). Shared by
// admin/crm.js (the roster-level teaser) and admin/client-onboarding.js
// (the full workspace card) so this is computed exactly once, never a
// second time with slightly different logic.
//
// Grounded entirely in real, already-existing data — no new table, no
// invented content:
//   - encounter_defs: the real E1-E8 reference table, each row's `purpose`
//     already states, in Nay's own words, what she needs walking into that
//     encounter (e.g. e1's purpose literally says she arrives prepared
//     from Extração de Marca + Teste de Arquétipos) — this IS the
//     methodology text, not a paraphrase of it.
//   - agenda_items (type='individual_meeting'): counting COMPLETED ones
//     tells us which encounter number she's on next (count + 1) — the same
//     type filter client/encontros.js's own "Encontros Individuais" stat
//     already uses, not a new definition of what counts as an encounter.
//   - questionnaires.status / the real archetype attempt (via
//     getLatestAttempt) — the two real prerequisites e1's own purpose text
//     names for E1 specifically.
// Deliberately NOT generalized into an arbitrary per-encounter prerequisite
// engine — encounters 2-8 don't have an equivalently explicit, machine-
// checkable dependency recorded anywhere in the schema today. Scoped to the
// one real, concrete gate the data can actually answer; everything past E1
// gets "prepare and schedule" once no meeting is booked, plus that
// encounter's own real purpose text so Nay always knows what it's for.
import { supabase } from './supabase-client.js';
import { getLatestAttempt } from './archetype-model.js';
import { formatDateTime } from './ui.js';

export async function computeTeamNextStep(client, clientId) {
  const [{ data: completedMeetings }, { data: upcoming }, { data: questionnaire }, archetype] = await Promise.all([
    supabase.from('agenda_items').select('id').eq('related_student_id', clientId).eq('type', 'individual_meeting').eq('status', 'completed'),
    supabase.from('agenda_items').select('item_date').eq('related_student_id', clientId).eq('type', 'individual_meeting').eq('status', 'upcoming').order('item_date', { ascending: true }).limit(1).maybeSingle(),
    supabase.from('questionnaires').select('status').eq('client_id', clientId).maybeSingle(),
    getLatestAttempt(clientId),
  ]);

  const nextNumber = (completedMeetings || []).length + 1;
  const { data: nextDef } = await supabase.from('encounter_defs').select('*').eq('number', nextNumber).maybeSingle();

  if (!nextDef || (nextDef.premium_only && client.tier !== 'premium')) {
    return { label: 'Encontros do plano concluídos', detail: 'Nenhum encontro pendente para o plano atual dela.', kind: 'done' };
  }

  if (upcoming) {
    return {
      label: `Encontro ${nextDef.number} (${nextDef.name}) já agendado`,
      detail: `${formatDateTime(upcoming.item_date)} — ${nextDef.purpose}`,
      kind: 'scheduled',
    };
  }

  if (nextDef.number === 1 && !(questionnaire?.status === 'submitted' && archetype?.status === 'completed')) {
    const missing = [];
    if (questionnaire?.status !== 'submitted') missing.push('Extração de Marca');
    if (archetype?.status !== 'completed') missing.push('Teste de Arquétipos');
    return {
      label: 'Aguardando a cliente',
      detail: `Falta ela concluir ${missing.join(' e ')} antes de preparar o Encontro 1.`,
      kind: 'waiting',
    };
  }

  return {
    label: `Preparar e agendar o Encontro ${nextDef.number} (${nextDef.name})`,
    detail: nextDef.purpose,
    kind: 'ready',
  };
}

// The full E1-E8 journey (all encounters, not just the next one) — for the
// client profile brought over from the MockDB/demo prototype's
// admin/client-detail.js (its own TABS: E1..E8, always all 8 "for
// familiarity", tier-gated the same way TIER_MAX_PHASE_INDEX did there).
// Same signals as computeTeamNextStep above, generalized across every
// number instead of just the next one: completed-individual-meeting count
// -> everything at or below that number is 'completed'; the one right
// after is 'scheduled' (if an upcoming meeting exists) or 'pending';
// everything further out is 'locked' (not reachable yet). E1's real
// questionnaire/archetype gate is surfaced the same way it is above.
export async function loadEncounterJourney(client, clientId) {
  const [{ data: defs }, { data: completedMeetings }, { data: upcoming }, { data: questionnaire }, archetype] = await Promise.all([
    supabase.from('encounter_defs').select('*').order('number', { ascending: true }),
    supabase.from('agenda_items').select('id').eq('related_student_id', clientId).eq('type', 'individual_meeting').eq('status', 'completed'),
    supabase.from('agenda_items').select('item_date').eq('related_student_id', clientId).eq('type', 'individual_meeting').eq('status', 'upcoming').order('item_date', { ascending: true }).limit(1).maybeSingle(),
    supabase.from('questionnaires').select('status').eq('client_id', clientId).maybeSingle(),
    getLatestAttempt(clientId),
  ]);
  const completedCount = (completedMeetings || []).length;
  const intakeReady = questionnaire?.status === 'submitted' && archetype?.status === 'completed';

  return (defs || [])
    .filter((def) => client.tier === 'premium' || !def.premium_only)
    .map((def) => {
      if (def.number <= completedCount) return { ...def, status: 'completed' };
      if (def.number === completedCount + 1) {
        if (upcoming) return { ...def, status: 'scheduled', scheduledAt: upcoming.item_date };
        if (def.number === 1 && !intakeReady) return { ...def, status: 'waiting_on_client' };
        return { ...def, status: 'pending' };
      }
      return { ...def, status: 'locked' };
    });
}
