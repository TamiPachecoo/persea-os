// Public endpoint for the PERSEA mentee results survey at
// naymurta.com/resultados. Validates the answers and writes one row to
// mentee_results (staff-only table), which the CRM's Eventos tab lists.
import { createClient } from "npm:@supabase/supabase-js@2";

const ALLOWED_ORIGINS = ["https://naymurta.com", "https://www.naymurta.com", "http://localhost:8934"];
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
const score = (v: unknown) => { const n = Number(v); return Number.isInteger(n) && n >= 0 && n <= 10 ? n : null; };

// Must match resultados/index.html exactly.
const FIRST_SALE = ["Na primeira semana", "No primeiro mês", "Entre 1 e 3 meses", "Entre 3 e 6 meses", "Mais de 6 meses"];
const SCORES = ["confidence_before", "confidence_after", "visibility_before", "visibility_after", "value_before", "value_after"];

Deno.serve(async (req) => {
  const cors = corsHeadersFor(req);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") return json({ error: "POST only" }, 405, cors);
  try {
    const b = await req.json();
    if (clean(b.website, 200)) return json({ ok: true }, 200, cors); // honeypot: bots fill every field

    const fullName = clean(b.name, 200);
    if (fullName.length < 2) return json({ error: "Escreva o seu nome." }, 400, cors);
    const revenueCents = Number(b.revenue_cents);
    if (!Number.isSafeInteger(revenueCents) || revenueCents < 0 || revenueCents > 100_000_000_00) return json({ error: "Informe o faturamento (pode ser 0)." }, 400, cors);
    if (!FIRST_SALE.includes(b.first_sale)) return json({ error: "Responda quando foi a sua primeira venda." }, 400, cors);
    const row: Record<string, unknown> = { full_name: fullName, revenue_cents: revenueCents, first_sale: b.first_sale };
    for (const k of SCORES) {
      const n = score(b[k]);
      if (n === null) return json({ error: "Responda todas as notas de antes e de hoje." }, 400, cors);
      row[k] = n;
    }
    row.opportunities = clean(b.opportunities, 2000) || null;
    row.transformation = clean(b.transformation, 3000);
    if (!row.transformation) return json({ error: "Conte qual foi a principal mudança." }, 400, cors);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { error } = await admin.from("mentee_results").insert(row);
    if (error) return json({ error: "Não foi possível enviar agora." }, 500, cors);
    return json({ ok: true }, 200, cors);
  } catch (e) {
    return json({ error: String(e) }, 500, cors);
  }
});
