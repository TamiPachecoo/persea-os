// Second, independent step of the Diagnóstico de Percepção de Valor flow:
// after seeing her result, she can ask for a strategy meeting without
// re-entering name/WhatsApp/market/faturamento/Instagram — those were
// already collected and saved by diagnostico-submit. This function only
// updates that existing row (matched by the id it returned) with the two
// open-text follow-up answers, never re-scores or re-classifies anything.
import { createClient } from "npm:@supabase/supabase-js@2";

const ALLOWED_ORIGINS = [
  "https://app.naymurta.com",
  "http://localhost:8934",
];
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

Deno.serve(async (req) => {
  const cors = corsHeadersFor(req);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") return json({ error: "POST only" }, 405, cors);
  try {
    const body = await req.json();
    const id = String(body.id || "").trim();
    const answer1 = String(body.meeting_answer_1 || "").trim().slice(0, 2000);
    const answer2 = String(body.meeting_answer_2 || "").trim().slice(0, 2000);

    if (!id) return json({ error: "id é obrigatório." }, 400, cors);
    if (!answer1) return json({ error: "Resposta obrigatória." }, 400, cors);
    if (!answer2) return json({ error: "Resposta obrigatória." }, 400, cors);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { error: updErr } = await admin.from("value_perception_diagnostics").update({
      requested_meeting: true,
      meeting_answer_1: answer1,
      meeting_answer_2: answer2,
      meeting_requested_at: new Date().toISOString(),
    }).eq("id", id);
    if (updErr) return json({ error: updErr.message }, 500, cors);

    return json({ ok: true }, 200, cors);
  } catch (e) {
    return json({ error: String(e) }, 500, cors);
  }
});
