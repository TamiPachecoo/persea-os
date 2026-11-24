// Discovery/foundation layer for Google Drive files visible through the
// drive.meet.readonly scope — Meet-created recordings and transcripts.
// Same OAuth connection as Calendar (calendar_connections, one row per
// PERSEA staff member's own Google account) — there is no separate Drive
// auth flow; google-calendar-auth-start already requests both
// calendar.events and drive.meet.readonly in one consent screen.
//
// IMPORTANT, UNTESTED AGAINST A REAL GOOGLE ACCOUNT except for one live
// verification (a real 'Sessão Becca Hibas' session, confirmed working —
// see the delivery report). The matching heuristics below are still
// deliberately conservative — verify further before trusting the
// "confident" bucket broadly.
//
// Why there's no direct Calendar-event -> Drive-file link: Google's Drive
// API exposes no field tying a Meet recording/transcript back to the
// originating Calendar event id through this scope (or any scope, as far
// as the public Drive v3 reference documents). The only signals available
// are the file's name (Meet names these after the call's title) and its
// createdTime (shortly after the call ends). Both are heuristic, not
// authoritative — hence "confident" vs "uncertain" below, never a blind
// assignment.
//
// action 'folder' (Nov 2026): { client_id, folder_url } — the client's own
// Drive folder. Every recording/transcript inside it (and one level of
// subfolders) is filed under that client in one go, instead of linking
// meeting by meeting. Files already on a specific meeting keep it. With the
// drive.meet.readonly scope Drive only returns the Meet-created files in
// the folder (exactly the recordings and transcripts); if Google refuses
// the folder query, the folder link itself still works for the student.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...corsHeaders } });
}

// Same refresh pattern as google-calendar-list-events/-create-event —
// mint a fresh access token from the stored refresh_token on every call
// rather than tracking expiry. Google's refresh grant never returns a new
// refresh_token, so the stored one is left untouched.
async function refreshAccessToken(clientId: string, clientSecret: string, refreshToken: string): Promise<string> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: "refresh_token",
    }),
  });
  const j = await res.json();
  if (!res.ok) throw new Error(j.error_description || j.error || "falha ao renovar o token do Google");
  return j.access_token as string;
}

// Drive's `q` search syntax wraps string literals in single quotes — this
// is the API's own documented escaping (backslash, then single quote).
// Used now for the keyword search below (name contains '...') — the
// original build deliberately left keyword out of the Drive query itself,
// but with no UI to set a custom date range either, there was genuinely no
// way to find anything older than 30 days or by name. Both are real search
// controls now, not just a confidence-check hint.
function escapeDriveQueryLiteral(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

type ArtifactType = "recording" | "transcript" | "unknown";
function classifyArtifactType(mimeType: string | null, name: string | null): ArtifactType {
  const n = (name || "").toLowerCase();
  if (mimeType?.startsWith("video/")) return "recording";
  // Meet transcripts land in Drive as Google Docs — this is the reliable
  // signal; the filename check below is only a fallback for whatever this
  // account's Drive naming convention actually turns out to be.
  if (mimeType === "application/vnd.google-apps.document") return "transcript";
  if (n.includes("transcript") || n.includes("transcrição")) return "transcript";
  if (n.includes("recording") || n.includes("gravação") || n.includes("gravacao")) return "recording";
  return "unknown";
}

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  createdTime?: string;
  modifiedTime?: string;
  webViewLink?: string;
  size?: string;
}

async function listDriveFiles(accessToken: string, q: string, pageSize = 25, pageToken?: string): Promise<{ files: DriveFile[]; nextPageToken?: string }> {
  const params = new URLSearchParams({
    q,
    // Only the fields this integration actually uses — per Google's own
    // guidance for keeping responses minimal.
    fields: "files(id,name,mimeType,createdTime,modifiedTime,webViewLink,size),nextPageToken",
    orderBy: "createdTime desc",
    pageSize: String(pageSize),
  });
  if (pageToken) params.set("pageToken", pageToken);
  const res = await fetch(`https://www.googleapis.com/drive/v3/files?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const j = await res.json();
  if (!res.ok) throw new Error(j.error?.message || "erro ao listar arquivos do Google Drive");
  return { files: j.files || [], nextPageToken: j.nextPageToken };
}

// https://drive.google.com/drive/folders/<id>?usp=… | …/u/0/folders/<id> | open?id=<id> | a bare id
function folderIdFrom(input: string): string | null {
  const s = String(input || "").trim();
  const m = s.match(/\/folders\/([A-Za-z0-9_-]{10,})/) || s.match(/[?&]id=([A-Za-z0-9_-]{10,})/);
  if (m) return m[1];
  return /^[A-Za-z0-9_-]{10,}$/.test(s) ? s : null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return json({ error: "não autenticado" }, 401);
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
    if (!profile || !["admin", "assistant"].includes(profile.role)) {
      return json({ error: "apenas admin ou assistente" }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const action = body.action === "export_transcript" ? "export_transcript" : body.action === "folder" ? "folder" : "list";

    // Same "own connection" model as every other Calendar function — this
    // reads whichever staff member is calling, not a hardcoded account.
    // In practice Meet recordings/transcripts land in whoever HOSTED the
    // call's Drive, so this is most useful when Nay's own admin account is
    // the caller; an assistant calling this will only ever see files from
    // her own Drive, which is fine/expected under this model, not a bug.
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: conn } = await admin.from("calendar_connections")
      .select("refresh_token, status, google_account_email")
      .eq("internal_user_id", user.id).eq("provider", "google").maybeSingle();
    if (!conn || conn.status !== "connected" || !conn.refresh_token) {
      return json({ error: "Google Calendar/Drive não conectado" }, 400);
    }

    const CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID")!;
    const CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET")!;
    const accessToken = await refreshAccessToken(CLIENT_ID, CLIENT_SECRET, conn.refresh_token);

    // ---- action: folder ------------------------------------------------
    if (action === "folder") {
      const clientId = typeof body.client_id === "string" ? body.client_id : null;
      const folderId = folderIdFrom(body.folder_url || body.folder_id || "");
      if (!clientId) return json({ error: "client_id é obrigatório" }, 400);
      if (!folderId) return json({ error: "cole o link da pasta do Google Drive (…/drive/folders/…)" }, 400);
      // The caller must be able to see this client (RLS on the caller's own JWT).
      const { data: client } = await supabase.from("clients").select("id").eq("id", clientId).maybeSingle();
      if (!client) return json({ error: "cliente não encontrado" }, 404);

      const found: DriveFile[] = [];
      const folders = [folderId];
      const seenFolders = new Set<string>();
      try {
        // The folder plus one level of subfolders (Meet sometimes groups a
        // session's files); at most 500 files.
        for (let depth = 0; depth < 2 && folders.length; depth++) {
          const level = folders.splice(0);
          for (const fid of level) {
            if (seenFolders.has(fid)) continue;
            seenFolders.add(fid);
            let token: string | undefined;
            do {
              const page = await listDriveFiles(accessToken, `'${escapeDriveQueryLiteral(fid)}' in parents and trashed = false`, 100, token);
              for (const f of page.files) {
                if (f.mimeType === "application/vnd.google-apps.folder") folders.push(f.id);
                else found.push(f);
              }
              token = page.nextPageToken;
            } while (token && found.length < 500);
          }
        }
      } catch (e) {
        console.log("folder listing failed:", String(e));
        return json({ error: `o Google não deixou ler esta pasta (${String(e).replace(/^Error: /, "")}). O link da pasta continua salvo e a cliente consegue abrir por ele.` }, 502);
      }

      const media = found.filter((f) => classifyArtifactType(f.mimeType, f.name) !== "unknown");
      const ids = media.map((f) => f.id);
      const { data: existingRows } = ids.length
        ? await admin.from("google_meet_drive_artifacts").select("google_drive_file_id, agenda_item_id, client_id, match_confidence, matched_at").in("google_drive_file_id", ids)
        : { data: [] as any[] };
      const existingById = new Map((existingRows || []).map((r) => [r.google_drive_file_id, r]));
      let added = 0, skippedOtherClient = 0;
      for (const f of media) {
        const ex = existingById.get(f.id);
        if (ex?.client_id && ex.client_id !== clientId) { skippedOtherClient++; continue; } // never move another client's file
        if (!ex?.client_id) added++;
        const { error: upErr } = await admin.from("google_meet_drive_artifacts").upsert({
          google_drive_file_id: f.id,
          artifact_type: classifyArtifactType(f.mimeType, f.name),
          name: f.name,
          mime_type: f.mimeType,
          web_view_link: f.webViewLink || null,
          size_bytes: f.size ? Number(f.size) : null,
          drive_created_time: f.createdTime || null,
          drive_modified_time: f.modifiedTime || null,
          agenda_item_id: ex?.agenda_item_id ?? null,
          client_id: clientId,
          match_confidence: ex?.match_confidence ?? "manual",
          matched_at: ex?.matched_at ?? new Date().toISOString(),
          ...(ex?.client_id ? {} : { matched_by: user.id }),
          discovered_via_account: conn.google_account_email || null,
          discovered_by: user.id,
          updated_at: new Date().toISOString(),
        }, { onConflict: "google_drive_file_id" });
        if (upErr) console.log("folder upsert failed:", upErr.message);
      }
      return json({ ok: true, folder_id: folderId, found: media.length, added, skipped_other_client: skippedOtherClient, other_files: found.length - media.length });
    }

    // ---- action: export_transcript -----------------------------------
    // Retrieves transcript TEXT content server-side only — never a token,
    // never handed back to the caller as anything but plain text. This is
    // the retrieval foundation for future meeting-intelligence features;
    // no analysis happens here.
    if (action === "export_transcript") {
      const fileId = body.file_id;
      if (!fileId || typeof fileId !== "string") return json({ error: "file_id é obrigatório" }, 400);

      const metaRes = await fetch(
        `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?fields=id,name,mimeType`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      const meta = await metaRes.json();
      if (!metaRes.ok) return json({ error: meta.error?.message || "arquivo não encontrado no Google Drive" }, 502);

      const type = classifyArtifactType(meta.mimeType, meta.name);
      if (type === "recording") {
        // Deliberately refuses to stream video through a text-export path
        // — recordings are large binary files; this function's job is
        // transcript text, not video delivery.
        return json({ error: "este arquivo é uma gravação (vídeo), não um transcript" }, 400);
      }

      // Google's native formats (Docs, Sheets, Slides) can't be downloaded
      // with files.get?alt=media — they require the export endpoint with
      // an explicit target MIME type. Meet transcripts are Google Docs, so
      // this is the expected path; the alt=media branch below only exists
      // in case some account's transcripts ever land as a plain text file
      // instead (undocumented as of this writing — flagged for real-world
      // verification once Nay's account is connected).
      let text: string;
      if (meta.mimeType === "application/vnd.google-apps.document") {
        const exportRes = await fetch(
          `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}/export?mimeType=text/plain`,
          { headers: { Authorization: `Bearer ${accessToken}` } },
        );
        if (!exportRes.ok) {
          const errJson = await exportRes.json().catch(() => ({}));
          return json({ error: errJson.error?.message || "erro ao exportar o transcript" }, 502);
        }
        text = await exportRes.text();
      } else {
        const dlRes = await fetch(
          `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`,
          { headers: { Authorization: `Bearer ${accessToken}` } },
        );
        if (!dlRes.ok) {
          const errJson = await dlRes.json().catch(() => ({}));
          return json({ error: errJson.error?.message || "erro ao baixar o transcript" }, 502);
        }
        text = await dlRes.text();
      }

      return json({ ok: true, file_id: fileId, name: meta.name, mime_type: meta.mimeType, text });
    }

    // ---- action: list (default) --------------------------------------
    let agendaItem: { id: string; title: string; topic: string | null; item_date: string; duration_minutes: number | null; related_student_id: string | null } | null = null;
    if (body.agenda_item_id) {
      const { data } = await supabase.from("agenda_items")
        .select("id, title, topic, item_date, duration_minutes, related_student_id")
        .eq("id", body.agenda_item_id).maybeSingle();
      agendaItem = data || null;
    }

    // Search window: explicit date_from/date_to wins (now driven by a real
    // UI control, not just theoretical); otherwise derived from the agenda
    // item's own scheduled time with a generous buffer (Meet can take a
    // while to finish processing a recording/transcript after the call
    // ends — this buffer is a starting guess, not a documented Google
    // SLA); otherwise falls back to the last 30 days, matching the "check
    // what showed up recently" use case.
    let windowFrom: Date;
    let windowTo: Date;
    if (body.date_from && body.date_to) {
      windowFrom = new Date(body.date_from);
      windowTo = new Date(body.date_to);
    } else if (agendaItem) {
      const start = new Date(agendaItem.item_date);
      windowFrom = new Date(start.getTime() - 10 * 60 * 1000);
      windowTo = new Date(start.getTime() + ((agendaItem.duration_minutes || 60) + 180) * 60 * 1000);
    } else {
      windowTo = new Date();
      windowFrom = new Date(windowTo.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    const titleHint: string | null = (body.meeting_title || agendaItem?.topic || agendaItem?.title || null);

    const qParts = [
      "trashed = false",
      `createdTime >= '${windowFrom.toISOString()}'`,
      `createdTime <= '${windowTo.toISOString()}'`,
    ];
    // Free-text keyword search — a real UI control now (distinct from
    // titleHint above, which only feeds the confidence check against a
    // specific agenda item). This one actually narrows what Drive returns,
    // so a staff member can find "the recording with Fulana's name in it"
    // without needing an agenda_item_id at all.
    const keyword: string | null = typeof body.keyword === "string" ? body.keyword.trim() : null;
    if (keyword) qParts.push(`name contains '${escapeDriveQueryLiteral(keyword)}'`);
    const { files } = await listDriveFiles(accessToken, qParts.join(" and "));

    // ---- match each discovered file against the agenda item hint ------
    const driveIds = files.map((f) => f.id);
    const { data: existingRows } = driveIds.length
      ? await admin.from("google_meet_drive_artifacts")
        .select("google_drive_file_id, agenda_item_id, client_id, match_confidence, matched_at")
        .in("google_drive_file_id", driveIds)
      : { data: [] as any[] };
    const existingByFileId = new Map((existingRows || []).map((r) => [r.google_drive_file_id, r]));

    const matched: any[] = [];
    const unmatched: any[] = [];
    const conflicts: any[] = [];

    for (const f of files) {
      const artifactType = classifyArtifactType(f.mimeType, f.name);
      const existing = existingByFileId.get(f.id);

      // "Confident" requires BOTH an agenda item to match against AND its
      // title/topic appearing in the Drive file's name — time-window
      // membership alone is not enough (two meetings the same afternoon
      // would otherwise collide). Anything less stays a candidate.
      const titleMatches = !!(titleHint && titleHint.trim().length > 2 &&
        f.name.toLowerCase().includes(titleHint.trim().toLowerCase()));
      const computedConfident = !!(agendaItem && titleMatches);

      let finalAgendaItemId: string | null = existing?.agenda_item_id ?? null;
      let finalClientId: string | null = existing?.client_id ?? null;
      let finalConfidence: string | null = existing?.match_confidence ?? null;
      let finalMatchedAt: string | null = existing?.matched_at ?? null;
      let conflict = false;

      if (computedConfident) {
        if (existing?.agenda_item_id && existing.agenda_item_id !== agendaItem!.id) {
          // Already confidently matched to a DIFFERENT meeting — never
          // silently reassign. Surface as a conflict for a human to
          // resolve instead of guessing.
          conflict = true;
        } else {
          finalAgendaItemId = agendaItem!.id;
          finalClientId = agendaItem!.related_student_id;
          finalConfidence = "confident";
          finalMatchedAt = existing?.matched_at ?? new Date().toISOString();
        }
      }

      const { error: upsertErr } = await admin.from("google_meet_drive_artifacts").upsert({
        google_drive_file_id: f.id,
        artifact_type: artifactType,
        name: f.name,
        mime_type: f.mimeType,
        web_view_link: f.webViewLink || null,
        size_bytes: f.size ? Number(f.size) : null,
        drive_created_time: f.createdTime || null,
        drive_modified_time: f.modifiedTime || null,
        agenda_item_id: conflict ? existing?.agenda_item_id ?? null : finalAgendaItemId,
        client_id: conflict ? existing?.client_id ?? null : finalClientId,
        match_confidence: conflict ? existing?.match_confidence ?? null : finalConfidence,
        matched_at: conflict ? existing?.matched_at ?? null : finalMatchedAt,
        discovered_via_account: conn.google_account_email || null,
        discovered_by: user.id,
        updated_at: new Date().toISOString(),
      }, { onConflict: "google_drive_file_id" });
      if (upsertErr) console.log("google_meet_drive_artifacts upsert failed:", upsertErr.message);

      const row = {
        google_drive_file_id: f.id,
        name: f.name,
        mime_type: f.mimeType,
        artifact_type: artifactType,
        web_view_link: f.webViewLink || null,
        size: f.size || null,
        created_time: f.createdTime || null,
        modified_time: f.modifiedTime || null,
        confidence: conflict ? (existing?.match_confidence ?? null) : finalConfidence,
        agenda_item_id: conflict ? (existing?.agenda_item_id ?? null) : finalAgendaItemId,
        client_id: conflict ? (existing?.client_id ?? null) : finalClientId,
      };

      if (conflict) {
        conflicts.push({ ...row, conflicting_agenda_item_id: agendaItem!.id });
      } else if (row.confidence === "confident") {
        matched.push(row);
      } else {
        unmatched.push(row);
      }
    }

    return json({
      ok: true,
      google_account: conn.google_account_email || null,
      window: { from: windowFrom.toISOString(), to: windowTo.toISOString() },
      matched,
      unmatched,
      conflicts,
    });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
