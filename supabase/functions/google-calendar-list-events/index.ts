// Reads upcoming events off a connected Google Calendar — read-only, never
// writes anything back to Google here.
//
// Default: the CALLER's own connection (Nay on her agenda, an assistant on
// hers). With { owner: "nay" } (staff only): Nay's calendar, through the
// admin's stored connection, so the assistants can see and confirm the
// meetings Nay booked in Google ("Agenda da Nay"). Those answers carry
// owner:"nay" and attendee e-mails (used to find the student); a missing
// connection is reported as { error: "not_connected" } with status 200 so
// the page can explain it instead of failing.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...corsHeaders } });
}

async function refreshAccessToken(clientId: string, clientSecret: string, refreshToken: string) {
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

const DAY = 24 * 60 * 60 * 1000;
function parseDate(v: unknown): Date | null {
  if (typeof v !== "string") return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
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

    let body: Record<string, unknown> = {};
    try { body = await req.json(); } catch { /* no body: defaults */ }
    const forNay = body.owner === "nay";

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    let conn: { refresh_token: string | null; status: string } | null = null;
    if (forNay) {
      const { data: admins } = await admin.from("profiles").select("id").eq("role", "admin");
      const ids = (admins || []).map((a: { id: string }) => a.id);
      if (ids.length) {
        const { data } = await admin.from("calendar_connections").select("refresh_token, status, updated_at")
          .in("internal_user_id", ids).eq("provider", "google").eq("status", "connected")
          .order("updated_at", { ascending: false }).limit(1);
        conn = data?.[0] || null;
      }
    } else {
      const { data } = await admin.from("calendar_connections").select("refresh_token, status")
        .eq("internal_user_id", user.id).eq("provider", "google").maybeSingle();
      conn = data;
    }
    if (!conn || conn.status !== "connected" || !conn.refresh_token) {
      return forNay ? json({ owner: "nay", error: "not_connected", events: [] }) : json({ error: "Google Calendar não conectado" }, 400);
    }

    const CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID")!;
    const CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET")!;
    const accessToken = await refreshAccessToken(CLIENT_ID, CLIENT_SECRET, conn.refresh_token);

    // Bounded window (default: now → 90 days), never open-ended — a single
    // yearly-recurring all-day event otherwise fills the page with repeats.
    const now = new Date();
    let timeMin = parseDate(body.time_min) || now;
    let timeMax = parseDate(body.time_max) || new Date(now.getTime() + 90 * DAY);
    if (timeMin.getTime() < now.getTime() - 30 * DAY) timeMin = new Date(now.getTime() - 30 * DAY);
    if (timeMax.getTime() > timeMin.getTime() + 90 * DAY || timeMax <= timeMin) timeMax = new Date(timeMin.getTime() + 90 * DAY);
    const params = new URLSearchParams({
      timeMin: timeMin.toISOString(), timeMax: timeMax.toISOString(),
      maxResults: forNay ? "100" : "50", singleEvents: "true", orderBy: "startTime",
    });
    const listRes = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const listJson = await listRes.json();
    if (!listRes.ok) {
      console.log("google event list failed:", listJson.error?.message || "unknown");
      return forNay ? json({ owner: "nay", error: "google_error", events: [] })
        : json({ error: listJson.error?.message || "erro ao ler eventos do Google Calendar" }, 502);
    }

    const events = (listJson.items || [])
      .filter((e: any) => e.status !== "cancelled")
      .map((e: any) => ({
        id: e.id,
        summary: e.summary || "(sem título)",
        start: e.start?.dateTime || e.start?.date || null,
        end: e.end?.dateTime || e.end?.date || null,
        all_day: !e.start?.dateTime,
        meet_url: e.hangoutLink || null,
        html_link: e.htmlLink || null,
        ...(forNay ? {
          location: e.location || null,
          description: typeof e.description === "string" ? e.description.slice(0, 500) : null,
          attendees: (e.attendees || []).filter((a: any) => !a.self && !a.organizer && a.email).map((a: any) => ({ email: a.email })),
        } : {}),
      }));

    return json(forNay ? { ok: true, owner: "nay", events } : { ok: true, events });
  } catch (e) {
    console.log("list-events error:", String(e));
    return json({ error: String(e) }, 500);
  }
});
