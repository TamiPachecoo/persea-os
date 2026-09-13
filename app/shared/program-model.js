// Real Supabase Program Hub status model — Production Migration: Program
// Hub (final consolidation batch). Schema mapped before writing any of
// this (information_schema + pg_policies, not assumed): program_defs,
// program_phases, program_activities, program_phase_activities,
// program_phase_deliverables, and program_activity_access all exist as
// real tables mirroring MockDB's PROGRAM_DEFS/PROGRAM_PHASES/
// PROGRAM_ACTIVITIES/PROGRAM_ACTIVITY_ACCESS 1:1 — read-for-authenticated +
// admin-write RLS already correct on every one, zero changes needed. This
// module reads those real tables directly (never the MockDB JS mirrors,
// even though their content currently matches) so an admin edit to
// program_activities/program_activity_access is what production actually
// reflects.
//
// DISCLOSED SIMPLIFICATION vs MockDB: MockDB's deriveActivityStatus gates
// early activities behind `contract.status === 'completed'`. In real
// production this condition is vacuous — a client can only ever reach an
// authenticated session at all once invite-client has already run, which
// itself only ever fires after her contract is signed (see
// shared/client-status.js) — so a logged-in real client's contract is
// always already done. No separate contract-gate check is implemented
// here; access is governed only by program_activity_access.
//
// DISCLOSED GAP: MockDB's "O que estamos preparando para você" mentor-
// deliverable cards (em_preparacao/pronto/entregue) have no real per-client
// status anywhere — program_phase_deliverables only records which
// deliverable *keys* exist per phase (static reference), not a per-client
// completion state. Rather than invent a status, this section is omitted
// from the real production Program Hub — see client/program.js.
import { supabase } from './supabase-client.js';
import { getLatestAttempt as getLatestArchetypeAttempt } from './archetype-model.js';
import { getPublishedPlaybook, getQuizResult as getPlaybookQuizResult } from './playbook-model.js';

const STATUS_LABEL = {
  locked: 'Próxima etapa', not_started: 'Disponível', in_progress: 'Em andamento', submitted: 'Enviada',
  in_analysis: 'Em análise', feedback_available: 'Devolutiva disponível', completed: 'Concluída', premium_preview: 'Exclusivo Premium',
};
const STATUS_BADGE = {
  locked: 'badge-locked', not_started: 'badge-progress', in_progress: 'badge-progress', submitted: 'badge-progress',
  in_analysis: 'badge-progress', feedback_available: 'badge-completed', completed: 'badge-completed', premium_preview: 'badge-locked',
};

// Real per-activity completion, derived from each activity's own real
// underlying table — never a separate progress table, so this can never
// show a number the feature itself would contradict.
async function computeActivityStatus(slug, clientId) {
  switch (slug) {
    case 'brand-extraction': {
      const { data } = await supabase.from('questionnaires').select('status').eq('client_id', clientId).maybeSingle();
      if (!data) return 'not_started';
      return data.status === 'submitted' ? 'completed' : (data.status === 'in_progress' ? 'in_progress' : 'not_started');
    }
    case 'archetype-test': {
      const attempt = await getLatestArchetypeAttempt(clientId);
      if (!attempt) return 'not_started';
      return attempt.status === 'completed' ? 'completed' : 'in_progress';
    }
    case 'business-survey': {
      const { data } = await supabase.from('business_surveys').select('status').eq('client_id', clientId).maybeSingle();
      return data?.status === 'submitted' ? 'completed' : 'not_started';
    }
    case 'activity-guide': {
      const { data } = await supabase.from('clients').select('guide_acknowledged').eq('id', clientId).maybeSingle();
      return data?.guide_acknowledged ? 'completed' : 'not_started';
    }
    case 'initial-images': {
      const { data } = await supabase.from('clients').select('images_status').eq('id', clientId).maybeSingle();
      const map = {
        aguardando_envio: 'not_started', envio_iniciado: 'in_progress', enviado: 'submitted',
        em_analise: 'in_analysis', novas_solicitadas: 'in_progress', aprovado: 'completed',
      };
      return map[data?.images_status] || 'not_started';
    }
    case 'brand-direction': {
      const { data } = await supabase.from('brand_directions').select('pinterest_url, positioning_summary, tone, guidance').eq('client_id', clientId).maybeSingle();
      const hasContent = Boolean(data && (data.pinterest_url || data.positioning_summary || data.tone || data.guidance));
      return hasContent ? 'feedback_available' : 'not_started'; // a strategist deliverable becoming available, not a client "task"
    }
    case 'pitch': {
      const { data } = await supabase.from('pitches').select('client_id').eq('client_id', clientId).maybeSingle();
      return data ? 'completed' : 'not_started';
    }
    case 'content': {
      const { data } = await supabase.from('content_activities').select('status').eq('client_id', clientId).maybeSingle();
      return data?.status || 'not_started';
    }
    case 'business': {
      const { data } = await supabase.from('value_assessments').select('status').eq('client_id', clientId).maybeSingle();
      if (!data) return 'not_started';
      if (data.status === 'published') return 'feedback_available';
      if (data.status === 'in_analysis') return 'in_analysis';
      if (data.status === 'submitted') return 'submitted';
      return 'in_progress';
    }
    default:
      return 'not_started';
  }
}

// Full normalized Program bundle for a real client — one call, everything
// client/program.js and the admin staff summary card both need, so the two
// screens can never drift on what "her status" actually means.
export async function loadProgramState(clientId, client) {
  const programSlug = client.program_slug;

  const [
    { data: programDef },
    { data: phases },
    { data: activityDefs },
    { data: phaseActivities },
    { data: accessRows },
  ] = await Promise.all([
    supabase.from('program_defs').select('*').eq('slug', programSlug).maybeSingle(),
    supabase.from('program_phases').select('*').order('id'),
    supabase.from('program_activities').select('*').order('display_order'),
    supabase.from('program_phase_activities').select('*').order('phase_id, sort_order'),
    supabase.from('program_activity_access').select('activity_slug, access').eq('program_slug', programSlug),
  ]);

  const accessBySlug = Object.fromEntries((accessRows || []).map((r) => [r.activity_slug, r.access]));
  const activityDefBySlug = Object.fromEntries((activityDefs || []).map((a) => [a.slug, a]));

  // Only fetch real status for activities this program actually includes —
  // no point querying a table for an activity the client can't reach.
  const includedSlugs = (phaseActivities || []).map((pa) => pa.activity_slug).filter((slug) => accessBySlug[slug] === 'included');
  const statusBySlug = Object.fromEntries(
    await Promise.all(includedSlugs.map(async (slug) => [slug, await computeActivityStatus(slug, clientId)])),
  );

  function buildActivity(slug) {
    const def = activityDefBySlug[slug];
    if (!def) return null;
    const access = accessBySlug[slug] || 'unavailable';
    if (access !== 'included') {
      return { slug, title: def.title, description: def.description, premiumDescription: def.premium_description, route: def.route, access, status: 'premium_preview', statusLabel: STATUS_LABEL.premium_preview, badgeClass: STATUS_BADGE.premium_preview, completed: false };
    }
    const status = statusBySlug[slug] || 'not_started';
    return {
      slug, title: def.title, description: def.description, route: def.route, access,
      status, statusLabel: STATUS_LABEL[status] || status, badgeClass: STATUS_BADGE[status] || 'badge-locked',
      completed: status === 'completed' || status === 'feedback_available',
    };
  }

  const phasesOut = (phases || []).map((phase) => {
    const slugsInPhase = (phaseActivities || []).filter((pa) => pa.phase_id === phase.id).map((pa) => pa.activity_slug);
    const activities = slugsInPhase.map(buildActivity).filter(Boolean);
    const includedActivities = activities.filter((a) => a.access === 'included');
    const premiumLocked = slugsInPhase.length > 0 && slugsInPhase.every((slug) => accessBySlug[slug] !== 'included');
    const completedCount = includedActivities.filter((a) => a.completed).length;
    let phaseStatus = 'upcoming';
    if (phase.id < (client.phase_index || 0)) phaseStatus = 'completed';
    else if (phase.id === (client.phase_index || 0)) phaseStatus = 'current';
    return {
      id: phase.id, description: phase.description, premiumLocked, activities, includedActivities,
      status: phaseStatus, progress: { completed: completedCount, total: includedActivities.length },
    };
  });

  const allIncluded = phasesOut.flatMap((p) => p.includedActivities);
  const completedCount = allIncluded.filter((a) => a.completed).length;
  const totalIncluded = allIncluded.length;
  const nextActivity = allIncluded.find((a) => !a.completed) || null;
  const pct = totalIncluded ? Math.round((completedCount / totalIncluded) * 100) : 0;

  return {
    programDef, phases: phasesOut,
    progress: { pct, completedCount, totalIncluded, nextActivity },
  };
}

// Real next-meeting lookup — agenda_items, client-scoped via RLS
// (agenda_items_client_read). Returns the soonest upcoming item, or null.
export async function loadNextMeeting(clientId) {
  const { data } = await supabase.from('agenda_items').select('*')
    .eq('related_student_id', clientId).eq('status', 'upcoming')
    .order('item_date', { ascending: true }).limit(1).maybeSingle();
  return data || null;
}

// Real Playbook availability, reusing shared/playbook-model.js — never a
// second "is the playbook ready" check.
export async function loadPlaybookSummary(clientId) {
  const playbook = await getPublishedPlaybook(clientId);
  const quizResult = playbook ? await getPlaybookQuizResult(clientId) : null;
  return { published: Boolean(playbook), quizResult };
}
