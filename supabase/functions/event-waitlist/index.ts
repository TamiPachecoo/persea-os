// Public endpoint for naymurta.com/listadeespera: waiting list for the next PERSEA
// Experience. Saves name, WhatsApp, e-mail and Instagram to event_waitlist
// (staff-only), which the CRM's Eventos tab lists under that edition.
import { createClient } from "npm:@supabase/supabase-js@2";

const ALLOWED_ORIGINS = ["https://naymurta.com", "https://www.naymurta.com", "http://localhost:8934"];
const EDITION = "2027";
function corsHeadersFor(req: Request) {
  const origin = req.headers.get("Origin");
  const allow = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}
function json(body: unknown, status: number, cors: Record<string, string>) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...cors } });
}
const clean = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);

Deno.serve(async (req) => {
  const cors = corsHeadersFor(req);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") return json({ error: "POST only" }, 405, cors);
  try {
    const b = await req.json();
    if (clean(b.website, 200)) return json({ ok: true }, 200, cors); // honeypot
    const fullName = clean(b.name, 200);
    if (fullName.length < 2) return json({ error: "Escreva o seu nome." }, 400, cors);
    const phone = clean(b.phone, 40);
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 10 || digits.length > 13) return json({ error: "Informe o seu WhatsApp com DDD." }, 400, cors);
    const email = clean(b.email, 200).toLowerCase() || null;
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: "Confira o seu e-mail." }, 400, cors);
    const instagram = clean(b.instagram, 120)
      .replace(/^https?:\/\/(www\.)?instagram\.com\//i, "").replace(/[/?#].*$/, "").replace(/^@+/, "") || null;
    const attended = typeof b.attended_before === "boolean" ? b.attended_before : null;

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    // Same WhatsApp signing up twice: keep one row, refresh what she typed.
    const { data: existing } = await admin.from("event_waitlist").select("id, phone").eq("edition", EDITION);
    const dup = (existing || []).find((r) => r.phone.replace(/\D/g, "").slice(-11) === digits.slice(-11));
    const row = { full_name: fullName, phone, email, instagram, attended_before: attended };
    const { error } = dup
      ? await admin.from("event_waitlist").update(row).eq("id", dup.id)
      : await admin.from("event_waitlist").insert({ ...row, edition: EDITION });
    if (error) return json({ error: error.code === "P0001" ? error.message : "Não foi possível enviar agora." }, error.code === "P0001" ? 429 : 500, cors);
    return json({ ok: true }, 200, cors);
  } catch (e) {
    return json({ error: String(e) }, 500, cors);
  }
});
