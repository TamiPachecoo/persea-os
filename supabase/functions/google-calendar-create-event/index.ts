// Creates a real Google Calendar event (with a Google Meet link) on the
// connected account's primary calendar, using the refresh token stored by
// google-calendar-callback. Never exposes the refresh/access token to the
// caller — only the resulting event id + links come back.
//
// no_meet: true (Nov 2026) — a time block for a tarefa: busy time on the
// calendar, no Meet link.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...corsHeaders } });
}

// Access tokens are short-lived (~1h); rather than tracking expiry, just
// mint a fresh one from the stored refresh_token on every call — simplest
// correct approach at this volume. Google's refresh grant does not return a
// new refresh_token, so the stored one is left untouched.
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

// Real bug found: Google Meet conference creation is asynchronous even
// though the event insert itself is synchronous — the API's own docs say
// the createRequest can come back with status.statusCode:"pending" on the
// very first response, with hangoutLink/entryPoints only populated a
// moment later. Creating straight from Google Calendar's own UI works
// because their client polls until it's ready; this function was doing
// one POST and returning whatever came back immediately, which was often
// still empty — exactly the reported "link only appears if she creates it
// directly in Google" symptom (and the workaround of duplicating the
// event, since a second create-or-re-open in Google's UI would show the
// by-then-ready link). Fixed by polling the event itself (GET, not a new
// POST — never creates a second event) a few times until the link shows
// up or we give up and return whatever's there.
function meetUrlFrom(event: any): string | null {
  if (event?.hangoutLink) return event.hangoutLink;
  const entryPoints = event?.conferenceData?.entryPoints || [];
  const video = entryPoints.find((e: any) => e.entryPointType === "video");
  return video?.uri || null;
}

async function waitForMeetLink(accessToken: string, eventId: string, initialEvent: any) {
  let event = initialEvent;
  for (let attempt = 0; attempt < 5; attempt++) {
    const url = meetUrlFrom(event);
    const pending = event?.conferenceData?.createRequest?.status?.statusCode === "pending";
    if (url && !pending) return url;
    if (!pending && attempt > 0) break; // not pending and still no link — Google isn't going to produce one
    await new Promise((r) => setTimeout(r, 500));
    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (!res.ok) break;
    event = await res.json();
  }
  return meetUrlFrom(event);
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

    const { summary, description, start, end, no_meet = false } = await req.json();
    if (!summary || !start || !end) return json({ error: "summary, start e end são obrigatórios" }, 400);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: conn } = await admin.from("calendar_connections").select("refresh_token, status")
      .eq("internal_user_id", user.id).eq("provider", "google").maybeSingle();
    if (!conn || conn.status !== "connected" || !conn.refresh_token) {
      return json({ error: "Google Calendar não conectado" }, 400);
    }

    const CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID")!;
    const CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET")!;
    const accessToken = await refreshAccessToken(CLIENT_ID, CLIENT_SECRET, conn.refresh_token);

    const eventRes = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events${no_meet ? "" : "?conferenceDataVersion=1"}`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          summary,
          description: description || undefined,
          start: { dateTime: start, timeZone: "America/Sao_Paulo" },
          end: { dateTime: end, timeZone: "America/Sao_Paulo" },
          transparency: "opaque",
          ...(no_meet ? {} : { conferenceData: { createRequest: { requestId: crypto.randomUUID(), conferenceSolutionKey: { type: "hangoutsMeet" } } } }),
        }),
      },
    );
    const eventJson = await eventRes.json();
    if (!eventRes.ok) {
      console.log("google event insert failed:", eventJson.error?.message || "unknown");
      return json({ error: eventJson.error?.message || "erro ao criar evento no Google Calendar" }, 502);
    }

    // Never a second event — same eventJson.id throughout, just re-fetched
    // (GET) until the conference link Google promised actually shows up.
    const meetUrl = no_meet ? null : await waitForMeetLink(accessToken, eventJson.id, eventJson);

    return json({
      ok: true,
      event_id: eventJson.id,
      html_link: eventJson.htmlLink || null,
      meet_url: meetUrl,
    });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
