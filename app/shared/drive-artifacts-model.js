// Real Supabase-backed access to google_meet_drive_artifacts — the raw
// Drive files google-drive-meet-files discovers (Meet recordings,
// transcripts, the per-session folder Meet also creates). No Edge
// Function needed for these: admin/assistant RLS on this table already
// permits ALL, so this is a direct read/write, same pattern as
// shared/hubla-model.js.
import { supabase } from './supabase-client.js';

export async function loadDriveArtifacts() {
  const { data, error } = await supabase.from('google_meet_drive_artifacts')
    .select('id, google_drive_file_id, artifact_type, name, mime_type, web_view_link, agenda_item_id, client_id, match_confidence, matched_at, discovered_at, clients(full_name)')
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
// need its own explicit Desvincular first. Deliberately doesn't touch
// agenda_item_id — identifying who it belongs to, not necessarily which
// exact calendar entry.
export function linkSessionToClient(sessionKey, clientId, staffId) {
  return supabase.from('google_meet_drive_artifacts')
    .update({
      client_id: clientId,
      match_confidence: 'manual',
      matched_at: new Date().toISOString(),
      matched_by: staffId,
      updated_at: new Date().toISOString(),
    })
    .is('client_id', null)
    .ilike('name', `${sessionKey}%`);
}

// Undo — puts a mistaken link back in the unmatched pool.
export function unlinkArtifact(artifactId) {
  return supabase.from('google_meet_drive_artifacts').update({
    client_id: null, match_confidence: null, matched_at: null, matched_by: null,
    updated_at: new Date().toISOString(),
  }).eq('id', artifactId);
}
