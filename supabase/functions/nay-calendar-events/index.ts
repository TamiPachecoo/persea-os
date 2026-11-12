// A agenda Google da Nay para a equipe (somente leitura). A assistente não
// tem acesso à conta Google da Nay; esta função lê os eventos com a conexão
// da Nay (calendar_connections do perfil admin) e devolve só o necessário
// para ver e confirmar encontros — nunca tokens.
//   - Eventos marcados como particulares no Google aparecem só como
//     "Ocupado" (sem título, descrição ou convidados).
//   - Cada evento vem com client_id quando dá para saber quem é a aluna:
//     e-mail de um convidado igual ao e-mail dela, ou o nome dela no título.
//   - Junto vem a confirmação já registrada (calendar_event_confirmations).
// Quem pode chamar: admin e assistente.
import { createClient } from "npm:@supabase/supabase-js@2";

const ALLOWED_ORIGINS = ["https://app.naymurta.com", "https://persea-os-pages.pages.dev", "https://persea-os.pachecootami.workers.dev", "http://localhost:8934"];
function cors(req: Request) {
  const o = req.headers.get("Origin");
  return {
    "Access-Control-Allow-Origin": o && ALLOWED_ORIGINS.includes(o) ? o : ALLOWED_ORIGINS[0],
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}
const norm = (s: string) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

Deno.serve(async (req) => {
  const h = cors(req);
  const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { "Content-Type": "application/json", ...h } });
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: h });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  try {
    const asCaller = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });
    const { data: { user } } = await asCaller.auth.getUser();
    if (!user) return json({ error: "não autenticado" }, 401);
    const { data: me } = await asCaller.from("profiles").select("role").eq("id", user.id).maybeSingle();
    if (!me || !["admin", "assistant"].includes(me.role)) return json({ error: "apenas a equipe" }, 403);

    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: admins } = await db.from("profiles").select("id").eq("role", "admin");
    const { data: conn } = await db.from("calendar_connections").select("refresh_token, status")
      .in("internal_user_id", (admins || []).map((a) => a.id)).eq("provider", "google").eq("status", "connected")
      .not("refresh_token", "is", null).limit(1).maybeSingle();
    if (!conn) return json({ ok: true, connected: false, events: [] });

    const tokRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: Deno.env.get("GOOGLE_CLIENT_ID")!, client_secret: Deno.env.get("GOOGLE_CLIENT_SECRET")!,
        refresh_token: conn.refresh_token, grant_type: "refresh_token",
      }),
    });
    const tok = await tokRes.json();
    if (!tokRes.ok) return json({ ok: false, connected: true, error: "Não foi possível ler a agenda da Nay agora." }, 502);

    const body = await req.json().catch(() => ({}));
    const days = Math.min(Math.max(Number(body.days) || 14, 1), 62);
    const from = new Date(Date.now() - 12 * 3600e3);
    const to = new Date(Date.now() + days * 86400e3);
    const params = new URLSearchParams({ timeMin: from.toISOString(), timeMax: to.toISOString(), maxResults: "250", singleEvents: "true", orderBy: "startTime" });
    const listRes = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`, { headers: { Authorization: `Bearer ${tok.access_token}` } });
    const list = await listRes.json();
    if (!listRes.ok) return json({ ok: false, connected: true, error: list.error?.message || "erro ao ler a agenda" }, 502);

    // Match events to students: attendee e-mail first, then name in title.
    const [{ data: clients }, { data: parties }] = await Promise.all([
      db.from("clients").select("id, full_name, email").eq("is_demo", false),
      db.from("party_info").select("client_id, email, full_name, social_name"),
    ]);
    const byEmail = new Map<string, string>();
    (clients || []).forEach((c) => { if (c.email) byEmail.set(c.email.toLowerCase(), c.id); });
    (parties || []).forEach((p) => { if (p.email && p.client_id) byEmail.set(String(p.email).toLowerCase(), p.client_id); });
    const nameKeys = (clients || []).map((c) => {
      const parts = norm(c.full_name).split(/\s+/).filter(Boolean);
      return { id: c.id, full: norm(c.full_name), firstLast: parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1]}` : null };
    });
    const matchClient = (e: any): string | null => {
      for (const a of e.attendees || []) { const id = byEmail.get(String(a.email || "").toLowerCase()); if (id) return id; }
      const t = norm(`${e.summary || ""} ${e.description || ""}`);
      const hits = nameKeys.filter((k) => t.includes(k.full) || (k.firstLast && t.includes(k.firstLast)));
      return hits.length === 1 ? hits[0].id : null;
    };

    const items = (list.items || []).filter((e: any) => e.status !== "cancelled");
    const ids = items.map((e: any) => e.id);
    const { data: confs } = ids.length ? await db.from("calendar_event_confirmations").select("*").in("google_event_id", ids) : { data: [] };
    const confById = new Map((confs || []).map((c) => [c.google_event_id, c]));

    const events = items.map((e: any) => {
      const isPrivate = ["private", "confidential"].includes(e.visibility) && me.role !== "admin";
      const conf = confById.get(e.id);
      return {
        id: e.id,
        summary: isPrivate ? "Ocupado (particular)" : (e.summary || "(sem título)"),
        start: e.start?.dateTime || e.start?.date || null,
        end: e.end?.dateTime || e.end?.date || null,
        all_day: !e.start?.dateTime,
        meet_url: isPrivate ? null : (e.hangoutLink || null),
        private: isPrivate,
        client_id: isPrivate ? null : (conf ? conf.client_id : matchClient(e)), // a saved row (even "no student") wins over the automatic match
        confirmation_status: conf?.status || null,
        confirmation_by_name: conf?.confirmed_by_name || null,
      };
    });
    return json({ ok: true, connected: true, events });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
