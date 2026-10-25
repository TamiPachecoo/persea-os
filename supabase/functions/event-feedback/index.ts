// Public endpoint for app.naymurta.com/feedback.html: anonymous feedback after the
// PERSEA Experience. Saves only the answers (no name, contact or IP) to
// event_feedback (staff-only), which the CRM's Eventos tab summarises.
import { createClient } from "npm:@supabase/supabase-js@2";

const ALLOWED_ORIGINS = ["https://app.naymurta.com", "https://persea-os-pages.pages.dev", "http://localhost:8934"];
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
const clean = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max) || null;
const score = (v: unknown, lo: number, hi: number) => {
  const n = Number(v);
  return Number.isInteger(n) && n >= lo && n <= hi ? n : null;
};
const STARS = ["overall", "location", "food", "organization", "value_for_money",
  "talk_posicionamento", "talk_capital_visual", "talk_visibilidade", "talk_vendas", "talk_larissa", "talk_rejane"];
const TALKS = ["posicionamento", "capital_visual", "visibilidade", "vendas", "larissa", "rejane"];
const WISH = ["pratica", "networking", "perguntas", "vendas", "instagram", "imagem", "mentalidade", "pausas"];

Deno.serve(async (req) => {
  const cors = corsHeadersFor(req);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") return json({ error: "POST only" }, 405, cors);
  try {
    const b = await req.json();
    if (clean(b.website, 200)) return json({ ok: true }, 200, cors); // honeypot
    const row: Record<string, unknown> = {};
    for (const k of STARS) row[k] = score(b[k], 1, 5);
    row.recommend = score(b.recommend, 0, 10);
    row.price_perception = ["barato", "justo", "caro"].includes(b.price_perception) ? b.price_perception : null;
    row.favorite_talk = TALKS.includes(b.favorite_talk) ? b.favorite_talk : null;
    row.wish_more = Array.isArray(b.wish_more) ? [...new Set(b.wish_more.filter((w: unknown) => WISH.includes(String(w))))] : [];
    row.wish_more_other = clean(b.wish_more_other, 300);
    for (const k of ["location_note", "food_note", "highlight", "improve", "suggestions"]) row[k] = clean(b[k], 2000);
    if (row.overall === null) return json({ error: "Dê uma nota geral para o evento." }, 400, cors);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { error } = await admin.from("event_feedback").insert(row);
    if (error) return json({ error: error.code === "P0001" ? error.message : "Não foi possível enviar agora." }, error.code === "P0001" ? 429 : 500, cors);
    return json({ ok: true }, 200, cors);
  } catch (e) {
    return json({ error: String(e) }, 500, cors);
  }
});
