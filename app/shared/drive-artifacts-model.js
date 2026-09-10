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

// Manual link — a staff member confirming "this file belongs to this
// client," distinct from google-drive-meet-files' own automatic
// title+time match (match_confidence: 'confident'). Deliberately doesn't
// touch agenda_item_id — she's identifying who it belongs to, not
// necessarily which exact calendar entry, and requiring that second guess
// would just block an otherwise-confident manual call.
export function linkArtifactToClient(artifactId, clientId, staffId) {
  return supabase.from('google_meet_drive_artifacts').update({
    client_id: clientId,
    match_confidence: 'manual',
    matched_at: new Date().toISOString(),
    matched_by: staffId,
    updated_at: new Date().toISOString(),
  }).eq('id', artifactId);
}

// Undo — puts a mistaken link back in the unmatched pool.
export function unlinkArtifact(artifactId) {
  return supabase.from('google_meet_drive_artifacts').update({
    client_id: null, match_confidence: null, matched_at: null, matched_by: null,
    updated_at: new Date().toISOString(),
  }).eq('id', artifactId);
}
