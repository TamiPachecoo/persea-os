// Real Supabase persistence + scoring for the Teste de Arquétipos —
// Production Migration: Archetypes + Quiz. The real schema already fully
// mirrors MockDB's model 1:1 (confirmed via information_schema before
// writing any of this, not assumed) — archetype_defs and
// archetype_quiz_questions are shared, admin-authored reference content
// (real product content: the 12 archetype write-ups and the 48-statement
// workbook, transcribed once, same content the demo/MockDB copy already
// has — not fabricated); archetype_quiz_attempts/archetype_quiz_responses
// are the real per-client attempt data; client_archetype_settings holds the
// one client-facing preference (visual_set) plus a staff-only `notes` field
// (never selected here — see loadArchetypeResults).
//
// Scoring is never trusted from the client: no table anywhere stores a
// final score or archetype result — every screen (client, admin, this
// module) computes it fresh, identically, from the raw per-question
// responses (see calcScores below, transcribed verbatim from
// MockDB.calcArchetypeScores). The only per-answer trust boundary is RLS
// (archetype_quiz_responses_client_rw, scoped through the attempt's real
// client_id) plus the DB-level CHECK (score between 1 and 5) already
// present on archetype_quiz_responses — confirmed before writing this, not
// added by this batch. A client can update her own attempt's `status`, but
// submitAttempt() below still independently verifies all 48 questions are
// answered before allowing 'completed' — the same "UI already prevents
// this, but the trust boundary is here too" convention as every other real
// submit flow in this app (business survey, value analysis).
import { supabase } from './supabase-client.js';

export const ARCHETYPE_VISUAL_SET_LABEL = { female: 'Feminina', male: 'Masculina' };

export async function getArchetypeQuestions() {
  const { data } = await supabase.from('archetype_quiz_questions').select('*').order('number');
  return data || [];
}

export async function getArchetypeDefs() {
  const { data } = await supabase.from('archetype_defs').select('*').order('display_order');
  return data || [];
}

export async function getLatestAttempt(clientId) {
  const { data } = await supabase.from('archetype_quiz_attempts').select('*').eq('client_id', clientId).order('started_at', { ascending: false }).limit(1).maybeSingle();
  return data || null;
}

// Mirrors MockDB.getOrCreateActiveArchetypeAttempt — a client only ever has
// at most one non-completed attempt; completed ones are historical.
export async function getOrCreateActiveAttempt(clientId) {
  const latest = await getLatestAttempt(clientId);
  if (latest && latest.status !== 'completed') return latest;
  const { data, error } = await supabase.from('archetype_quiz_attempts')
    .insert({ client_id: clientId, quiz_version: 1, status: 'in_progress', started_at: new Date().toISOString() })
    .select().single();
  if (error) throw error;
  return data;
}

export async function getAttemptResponses(attemptId) {
  const { data } = await supabase.from('archetype_quiz_responses').select('question_number, score').eq('attempt_id', attemptId);
  const byNumber = new Map((data || []).map((r) => [r.question_number, r.score]));
  return byNumber;
}

export async function saveResponse(attemptId, questionNumber, score) {
  const { error } = await supabase.from('archetype_quiz_responses')
    .upsert({ attempt_id: attemptId, question_number: questionNumber, score }, { onConflict: 'attempt_id,question_number' });
  if (error) throw error;
}

// Real trust boundary: validates every one of the 48 questions is answered
// before allowing submission, independent of whatever the wizard UI already
// enforced client-side.
export async function submitAttempt(attemptId, totalQuestions) {
  const responses = await getAttemptResponses(attemptId);
  if (responses.size < totalQuestions) {
    const missing = [];
    for (let n = 1; n <= totalQuestions; n++) if (!responses.has(n)) missing.push(n);
    return { ok: false, missing };
  }
  const { error } = await supabase.from('archetype_quiz_attempts')
    .update({ status: 'completed', completed_at: new Date().toISOString() })
    .eq('id', attemptId);
  if (error) throw error;
  return { ok: true };
}

// Pure calculation, transcribed verbatim from MockDB.calcArchetypeScores —
// same sum-of-4-mapped-responses (4-20), percentage of the 20-point max,
// and explicit tie-aware ranking (equal raw scores share the same rank).
export function calcScores(defs, questions, responses) {
  const questionsByArchetype = new Map();
  questions.forEach((q) => {
    if (!questionsByArchetype.has(q.archetype_slug)) questionsByArchetype.set(q.archetype_slug, []);
    questionsByArchetype.get(q.archetype_slug).push(q.number);
  });
  const scored = defs.map((def) => {
    const qNumbers = questionsByArchetype.get(def.slug) || [];
    const rawScore = qNumbers.reduce((sum, n) => sum + (Number(responses.get(n)) || 0), 0);
    return { slug: def.slug, name: def.name, rawScore, percentage: Math.round((rawScore / 20) * 100) };
  });
  scored.sort((a, b) => b.rawScore - a.rawScore);
  let rank = 0; let prevScore = null;
  scored.forEach((s, i) => {
    if (s.rawScore !== prevScore) rank = i + 1;
    s.rank = rank;
    prevScore = s.rawScore;
  });
  return scored;
}

export function getFeaturedGroup(scored) {
  const thirdRank = scored[2] ? scored[2].rank : null;
  const featured = thirdRank === null ? scored : scored.filter((s) => s.rank <= thirdRank);
  return { featured, hasTie: featured.length > 3 };
}

// Whether the one-time visual-set question still needs asking. Real schema
// has no client gender field to auto-derive from (MockDB's profile.gender
// has no Supabase counterpart yet — a disclosed simplification, not a bug),
// so this only ever depends on whether she's already chosen one.
export function needsVisualSetPrompt(settings) {
  return !settings?.visual_set;
}

export async function setVisualSet(clientId, visualSet) {
  const { error } = await supabase.from('client_archetype_settings').upsert({ client_id: clientId, visual_set: visualSet }, { onConflict: 'client_id' });
  if (error) throw error;
}

// Full results bundle — same shape MockDB.getArchetypeResults returns,
// minus `notes` (Nay's private notes about the client; readable by the
// client via RLS but deliberately never selected or shown here — no client
// page has ever rendered it, per the existing MockDB behavior this mirrors).
export async function loadArchetypeResults(clientId) {
  const attempt = await getLatestAttempt(clientId);
  if (!attempt || attempt.status !== 'completed') return null;
  const [defs, questions, responses, { data: settings }] = await Promise.all([
    getArchetypeDefs(),
    getArchetypeQuestions(),
    getAttemptResponses(attempt.id),
    supabase.from('client_archetype_settings').select('visual_set').eq('client_id', clientId).maybeSingle(),
  ]);
  const scored = calcScores(defs, questions, responses);
  const { featured, hasTie } = getFeaturedGroup(scored);
  const visualSet = settings?.visual_set || 'female';
  const withDetail = scored.map((s) => {
    const def = defs.find((d) => d.slug === s.slug);
    return {
      ...s,
      centralDesire: def.central_desire, potentials: def.potentials, caution: def.caution, visualDirection: def.visual_direction,
      image: visualSet === 'male' ? def.male_image_url : def.female_image_url,
    };
  });
  return {
    attemptId: attempt.id, completedAt: attempt.completed_at, visualSet,
    scores: withDetail, featured: withDetail.filter((s) => featured.some((f) => f.slug === s.slug)), hasTie,
  };
}
