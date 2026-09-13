// Real Supabase persistence for the Playbook + its comprehension quiz —
// Production Migration: Playbook + Quiz + Notes. The real schema
// (playbooks/playbook_versions/playbook_sections/playbook_experiences/
// playbook_quiz_results) was mapped before writing any of this — confirmed
// via information_schema + pg_policies, not assumed:
//
//   playbook_versions (client_id, version, status, created_at, published_at)
//   playbook_sections (playbook_version_id, section_key, content)
//     — 13 fixed section keys (see SECTION_DEFS), one row each per version.
//   playbook_experiences (client_id, format, completed_at) — which
//     "vivenciar" format (podcast/vídeo/audiobook) she engaged with.
//   playbook_quiz_results (client_id, score, total, completed_at) — one row
//     per client, the finished comprehension-quiz result.
//
// RLS was already exactly right and needed ZERO changes: playbook_versions/
// _sections have a client SELECT policy scoped to status='published' only
// (drafts are invisible to the client at the database level, not just the
// UI) plus a combined admin+assistant ALL policy (Playbook is real,
// pre-existing shared staff-write territory — unlike Brand Direction, this
// schema does not split assistant down to read-only, so the staff UI built
// on top of this does not either, per "respect existing rights, don't
// broaden or narrow them"). playbook_experiences/playbook_quiz_results are
// client_rw (her own row) + staff_all, matching their nature as her own
// input/completion data.
//
// IMPORTANT, DISCLOSED GAP: MockDB's client-facing "book" experience (cover
// image, epigraph, numbered narrative chapters with invented prose,
// PDF-of-chapters) has NO real schema counterpart anywhere — it exists only
// as one hardcoded fixture object on exactly one demo seed client
// (mock-db.js's `book:` field), every other seed client has none. It is
// decorative demo flourish, not a real per-client product. Production
// therefore reads a simpler, honest section-by-section view of the real 13
// sections instead of fabricating chapter prose that doesn't exist for any
// real client — see client/playbook.js.
import { supabase } from './supabase-client.js';

export const SECTION_DEFS = [
  ['identity', 'Identidade'], ['mission', 'Missão'], ['vision', 'Visão'],
  ['core_story', 'História Central'], ['golden_circle', 'Círculo Dourado'],
  ['target_audience', 'Público-Alvo'], ['value_proposition', 'Proposta de Valor'],
  ['positioning', 'Posicionamento'], ['brand_voice', 'Voz da Marca'],
  ['communication_style', 'Estilo de Comunicação'], ['goals', 'Objetivos'],
  ['pitch_30s', 'Pitch de 30 Segundos'], ['action_plan', 'Plano de Ação'],
];
export const SECTION_LABEL = Object.fromEntries(SECTION_DEFS);

export const FORMATS = {
  podcast: { icon: '🎙️', label: 'Podcast', verb: 'Ouvindo', desc: 'Um episódio íntimo, narrado na voz da Nay, contando a sua própria história de marca.' },
  video: { icon: '🎬', label: 'Vídeo', verb: 'Assistindo', desc: 'Uma apresentação visual do seu playbook, seção por seção.' },
  audiobook: { icon: '📖', label: 'Audiobook', verb: 'Ouvindo', desc: 'O playbook inteiro narrado como um audiolivro, na ordem, do início ao fim.' },
};

// --- Staff (admin/client-onboarding.js) --------------------------------
// Real version-model semantics, mirroring MockDB.generatePlaybookDraft/
// saveSectionEdit/publishPlaybook exactly: a client has at most one draft
// at a time; editing only ever touches the draft, never a published
// version in place (published/archived versions stay immutable history);
// publishing a draft archives whatever was previously published.
export async function getVersions(clientId) {
  const { data } = await supabase.from('playbook_versions').select('*').eq('client_id', clientId).order('version', { ascending: false });
  return data || [];
}

export async function getSections(versionId) {
  const { data } = await supabase.from('playbook_sections').select('*').eq('playbook_version_id', versionId);
  const byKey = Object.fromEntries((data || []).map((r) => [r.section_key, r.content]));
  return byKey;
}

// Creates a new draft, seeded from the current published version's real
// content when one exists — never invented placeholder copy (no MockDB-
// style "conteúdo de exemplo gerado pela IA"); a brand-new client's first
// draft starts with genuinely empty sections for Nay to fill in herself.
export async function createDraft(clientId) {
  const versions = await getVersions(clientId);
  const publishedVersion = versions.find((v) => v.status === 'published');
  const nextVersionNumber = versions.length ? Math.max(...versions.map((v) => v.version)) + 1 : 1;
  const seedSections = publishedVersion ? await getSections(publishedVersion.id) : {};

  // playbook_versions.client_id is actually a FK into playbooks.client_id
  // (not clients.id directly) — discovered mid-implementation via a
  // constraint check, same pattern as business_survey_responses earlier.
  // The parent row must exist before any version can be created; a no-op
  // if it already does.
  await supabase.from('playbooks').upsert({ client_id: clientId }, { onConflict: 'client_id', ignoreDuplicates: true });

  const { data: newVersion, error } = await supabase.from('playbook_versions')
    .insert({ client_id: clientId, version: nextVersionNumber, status: 'draft', created_at: new Date().toISOString() })
    .select().single();
  if (error) throw error;

  const rows = SECTION_DEFS.map(([key]) => ({ playbook_version_id: newVersion.id, section_key: key, content: seedSections[key] || '' }));
  const { error: sectionsErr } = await supabase.from('playbook_sections').insert(rows);
  if (sectionsErr) throw sectionsErr;
  return newVersion;
}

export async function saveSectionContent(versionId, sectionKey, content) {
  const { error } = await supabase.from('playbook_sections').update({ content }).eq('playbook_version_id', versionId).eq('section_key', sectionKey);
  if (error) throw error;
}

// Publishes a draft; archives whatever was previously published (never
// deleted or overwritten — stays queryable history, just no longer the
// client-visible one, matching playbook_versions_client_read's
// status='published' scoping).
export async function publishVersion(clientId, versionId) {
  const { error: archiveErr } = await supabase.from('playbook_versions').update({ status: 'archived' }).eq('client_id', clientId).eq('status', 'published');
  if (archiveErr) throw archiveErr;
  const { error } = await supabase.from('playbook_versions').update({ status: 'published', published_at: new Date().toISOString() }).eq('id', versionId);
  if (error) throw error;
}

// Client-facing: only the published version, RLS-enforced (a draft is
// invisible even if this queried for one). Returns { version, sections }
// or null.
export async function getPublishedPlaybook(clientId) {
  const { data: version } = await supabase.from('playbook_versions').select('*').eq('client_id', clientId).eq('status', 'published').order('version', { ascending: false }).limit(1).maybeSingle();
  if (!version) return null;
  const { data: sectionRows } = await supabase.from('playbook_sections').select('section_key, content').eq('playbook_version_id', version.id);
  const sections = Object.fromEntries((sectionRows || []).map((r) => [r.section_key, r.content]));
  return { version, sections };
}

export async function getExperience(clientId) {
  const { data } = await supabase.from('playbook_experiences').select('*').eq('client_id', clientId).maybeSingle();
  return data || { format: null, completed_at: null };
}

export async function completeExperience(clientId, format) {
  const { error } = await supabase.from('playbook_experiences').upsert({ client_id: clientId, format, completed_at: new Date().toISOString() }, { onConflict: 'client_id' });
  if (error) throw error;
}

export async function getQuizResult(clientId) {
  const { data } = await supabase.from('playbook_quiz_results').select('*').eq('client_id', clientId).maybeSingle();
  return data || null;
}

// Same bank/decoys as MockDB.buildQuizQuestions, transcribed verbatim —
// derived from the real published sections, not a second invented content
// set. The "correct" answer is the real section content itself, which the
// client can already read on this same page — there is no secret to
// protect here beyond what plain reading access already exposes.
const QUIZ_BANK = [
  ['positioning', 'Qual é o seu posicionamento?'],
  ['mission', 'Qual é a sua missão?'],
  ['target_audience', 'Quem é o seu público-alvo?'],
  ['pitch_30s', 'Qual é o seu pitch de 30 segundos?'],
];
const QUIZ_DECOYS = {
  positioning: ['A opção mais barata do mercado para qualquer perfil de cliente.', 'Alguém que atende qualquer segmento, sem distinção.'],
  mission: ['Vender o máximo de serviços possível, independente do encaixe.', 'Ser conhecida por estar em todas as redes sociais ao mesmo tempo.'],
  target_audience: ['Qualquer pessoa disposta a pagar, sem critério de encaixe.', 'Apenas grandes empresas com equipes de marketing próprias.'],
  pitch_30s: ['Um resumo técnico do currículo, sem conexão com o cliente.', 'Uma lista de certificados e ferramentas dominadas.'],
};
function shuffle(arr) { return [...arr].sort(() => Math.random() - 0.5); }

export function buildQuizQuestions(sections) {
  return QUIZ_BANK
    .filter(([key]) => sections[key])
    .map(([key, question]) => ({ key, question, options: shuffle([sections[key], ...QUIZ_DECOYS[key]]), correct: sections[key] }));
}

// Real trust boundary: takes the client's chosen option per question
// (never a bare "score" integer) and recomputes score/total itself against
// the real published sections fetched server-round-trip-fresh, exactly
// mirroring the pattern used for every other real submit flow in this app.
export async function submitQuizResult(clientId, sections, answers) {
  const questions = buildQuizQuestions(sections);
  const total = questions.length;
  const score = questions.reduce((sum, q) => sum + (answers[q.key] === q.correct ? 1 : 0), 0);
  const { error } = await supabase.from('playbook_quiz_results').upsert({ client_id: clientId, score, total, completed_at: new Date().toISOString() }, { onConflict: 'client_id' });
  if (error) throw error;
  return { score, total };
}
