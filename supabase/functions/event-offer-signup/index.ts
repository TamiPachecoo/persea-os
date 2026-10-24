// Public endpoint for app.naymurta.com/pagamento.html (QR code at the end of the
// PERSEA Experience pitch). Saves who is about to pay — name, WhatsApp, Instagram —
// to event_offer_signups (staff-only), which the CRM's Eventos tab lists.
// A second call with the same id records which payment option she chose.
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
const clean = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  const cors = corsHeadersFor(req);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") return json({ error: "POST only" }, 405, cors);
  try {
    const b = await req.json();
    if (clean(b.website, 200)) return json({ ok: true }, 200, cors); // honeypot
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Second step: which payment option she opened.
    if (b.id) {
      const choice = b.payment_choice;
      if (!UUID.test(String(b.id)) || !["pix", "cartao"].includes(choice)) return json({ error: "Dados inválidos." }, 400, cors);
      await admin.from("event_offer_signups").update({ payment_choice: choice }).eq("id", b.id).is("payment_choice", null);
      return json({ ok: true }, 200, cors);
    }

    const fullName = clean(b.name, 200);
    if (fullName.length < 2) return json({ error: "Escreva o seu nome." }, 400, cors);
    const digits = clean(b.phone, 40).replace(/\D/g, "");
    if (digits.length < 10 || digits.length > 13) return json({ error: "Informe o seu WhatsApp com DDD." }, 400, cors);
    const instagram = clean(b.instagram, 120)
      .replace(/^https?:\/\/(www\.)?instagram\.com\//i, "").replace(/[/?#].*$/, "").replace(/^@+/, "") || null;

    const { data, error } = await admin.from("event_offer_signups")
      .insert({ full_name: fullName, phone: clean(b.phone, 40), instagram })
      .select("id").single();
    if (error) return json({ error: error.code === "P0001" ? error.message : "Não foi possível enviar agora." }, error.code === "P0001" ? 429 : 500, cors);
    return json({ ok: true, id: data.id }, 200, cors);
  } catch (e) {
    return json({ error: String(e) }, 500, cors);
  }
});
