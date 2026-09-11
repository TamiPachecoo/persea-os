// Real Supabase-backed access to google_meet_drive_artifacts — the raw
// Drive files google-drive-meet-files discovers (Meet recordings,
// transcripts, the per-session folder Meet also creates). No Edge
// Function needed for these: admin/assistant RLS on this table already
// permits ALL, so this is a direct read/write, same pattern as
// shared/hubla-model.js.
import { supabase } from './supabase-client.js';

export async function loadDriveArtifacts() {
  const { data, error } = await supabase.from('google_meet_drive_artifacts')
    .select('id, google_drive_file_id, artifact_type, name, mime_type, web_view_link, agenda_item_id, client_id, encounter_slug, is_checkpoint, match_confidence, matched_at, discovered_at, clients(full_name)')
    .order('discovered_at', { ascending: false });
  if (error) return { artifacts: [], error: error.message };
  return { artifacts: data || [], error: null };
}

// Every artifact linked to one specific client — admin/client-detail.js's
// per-encounter tabs and its Checkpoints card both read from this, keyed
// by encounter_slug (e1..e8) or is_checkpoint. An artifact with neither set
// is still "linked to her" (the original client-only linking this table
// started with) but doesn't have a specific home yet — surfaced separately
// so it isn't just invisible.
export async function loadArtifactsForClient(clientId) {
  const { data, error } = await supabase.from('google_meet_drive_artifacts')
    .select('id, google_drive_file_id, artifact_type, name, mime_type, web_view_link, encounter_slug, is_checkpoint, match_confidence, matched_at, discovered_at')
    .eq('client_id', clientId)
    .order('discovered_at', { ascending: false });
  if (error) return { artifacts: [], error: error.message };
  return { artifacts: data || [], error: null };
}

// The picker for "attach an already-discovered file here" (per-encounter
// tab, Checkpoints card) — every artifact not yet linked to any client.
// Discovery itself (finding new files in Drive) still only happens from
// the Gravações page's Buscar Gravações/Busca avançada — this just reuses
// whatever's already been found and is sitting unclaimed.
export async function loadUnlinkedArtifacts() {
  const { data, error } = await supabase.from('google_meet_drive_artifacts')
    .select('id, name, artifact_type')
    .is('client_id', null)
    .order('discovered_at', { ascending: false });
  if (error) return { artifacts: [], error: error.message };
  return { artifacts: data || [], error: null };
}

// Meet names a session's recording/transcript/folder identically apart
// from one of these suffixes — "Sessão X - Recording" / "Sessão X -
// Anotações do Gemini" / bare "Sessão X" for the folder itself (see the
// real example this was built from: google-drive-meet-files' delivery
// report). Stripping the suffix gives the shared session key so one
// confirmed link can apply to the whole session's files at once, instead
// of requiring three separate clicks — and a staff member confirming
// against, say, the recording row has no reason to expect the transcript
// to stay silently unlinked right next to it.
const SESSION_SUFFIX_PATTERN = / - (Recording|Anotações do Gemini)$/;
export function sessionKeyFor(name) {
  return (name || '').replace(SESSION_SUFFIX_PATTERN, '');
}

// Manual link — a staff member confirming "this session belongs to this
// client," distinct from google-drive-meet-files' own automatic
// title+time match (match_confidence: 'confident'). Applies to every
// currently-UNMATCHED file sharing the same session key — `.is('client_id',
// null)` means an already-linked sibling (confident, manual, or linked to
// someone else entirely) is never silently overwritten; that one would
// need its own explicit Desvincular first. Classification (encounterSlug/
// isCheckpoint) is optional — the Gravações page's quick-confirm flow
// leaves both null (just "belongs to this client," unclassified); linking
// from a specific E-tab or the Checkpoints card sets one of them.
export function linkSessionToClient(sessionKey, clientId, staffId, { encounterSlug = null, isCheckpoint = false } = {}) {
  return supabase.from('google_meet_drive_artifacts')
    .update({
      client_id: clientId,
      encounter_slug: encounterSlug,
      is_checkpoint: isCheckpoint,
      match_confidence: 'manual',
      matched_at: new Date().toISOString(),
      matched_by: staffId,
      updated_at: new Date().toISOString(),
    })
    .is('client_id', null)
    .ilike('name', `${sessionKey}%`);
}

// Attaching a single already-discovered (but unlinked) file to a specific
// client + encounter/checkpoint slot — the per-encounter-tab and
// Checkpoints-card flow, as opposed to linkSessionToClient's "confirm from
// the Gravações list" flow. Deliberately single-file, not session-wide:
// picking one file for "E3" shouldn't silently also claim an unrelated
// file that happens to share a name prefix.
export function linkArtifactToSlot(artifactId, clientId, staffId, { encounterSlug = null, isCheckpoint = false } = {}) {
  return supabase.from('google_meet_drive_artifacts').update({
    client_id: clientId,
    encounter_slug: encounterSlug,
    is_checkpoint: isCheckpoint,
    match_confidence: 'manual',
    matched_at: new Date().toISOString(),
    matched_by: staffId,
    updated_at: new Date().toISOString(),
  }).eq('id', artifactId);
}

// Undo — puts a mistaken link back in the unmatched pool.
export function unlinkArtifact(artifactId) {
  return supabase.from('google_meet_drive_artifacts').update({
    client_id: null, encounter_slug: null, is_checkpoint: false,
    match_confidence: null, matched_at: null, matched_by: null,
    updated_at: new Date().toISOString(),
  }).eq('id', artifactId);
}
