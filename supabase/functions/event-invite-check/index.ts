// Public preview of a PERSEA Experience invite code, for the event page's
// "Você foi convidada por …" banner and guest price. Never returns the
// discounted payment link itself — that is only handed out by
// event-registration-create after the same checks pass on a real
// registration.
import { createClient } from "npm:@supabase/supabase-js@2";

const ALLOWED_ORIGINS = [
  "https://perseaexperience.naymurta.com",
  "https://persea-experience-preview.vercel.app",
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

const INVITE_PRICES: Record<string, { amountCents: number; fullCents: number }> = {
  "persea-experience": { amountCents: 69790, fullCents: 99700 },
};

Deno.serve(async (req) => {
  const cors = corsHeadersFor(req);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") return json({ error: "POST only" }, 405, cors);
  try {
    const { event_slug, code } = await req.json();
    const price = INVITE_PRICES[event_slug];
    const normalized = String(code || "").trim().toUpperCase().slice(0, 60);
    if (!price || !normalized) return json({ valid: false, reason: "Código de convite inválido." }, 200, cors);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: invite } = await admin.from("event_invite_codes")
      .select("code, max_uses, active, event_registrations!event_invite_codes_inviter_registration_id_fkey(full_name)")
      .eq("event_slug", event_slug).eq("code", normalized).maybeSingle();
    if (!invite || !invite.active) return json({ valid: false, reason: "Código de convite inválido ou desativado." }, 200, cors);

    const { data: used } = await admin.from("event_registrations").select("email").eq("event_slug", event_slug).eq("invite_code", normalized);
    const usedCount = new Set((used || []).map((r: { email: string }) => r.email.toLowerCase())).size;
    if (usedCount >= invite.max_uses) return json({ valid: false, reason: "Este convite já foi usado o número máximo de vezes." }, 200, cors);

    const inviterFirstName = String(invite.event_registrations?.full_name || "").trim().split(/\s+/)[0] || null;
    return json({
      valid: true, code: normalized, inviter_first_name: inviterFirstName,
      amount_cents: price.amountCents, full_amount_cents: price.fullCents,
    }, 200, cors);
  } catch (e) {
    return json({ error: String(e) }, 500, cors);
  }
});
