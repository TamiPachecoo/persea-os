// Public, unauthenticated endpoint for the PERSEA Experience event landing
// page's "Quero garantir minha vaga" button. Now reachable from two
// origins for the same site: perseaexperience.naymurta.com (the real
// custom domain) and the underlying persea-experience-preview.vercel.app
// (kept working too, in case anything still links there). Creates the
// real event_registrations row AND a real SumUp hosted checkout,
// returning the checkout URL so the landing page can send her straight
// to payment. sumup-webhook (already deployed for real client payments)
// is extended to also confirm these once SumUp reports PAID — see that
// function's own updated comment.
//
// The price is looked up server-side by event_slug, never trusted from
// the request — the same reasoning sumup-create-checkout's own header
// comment already lays out for client charges: nothing typed on the
// frontend ever decides how much a real charge is for.
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
function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

// Single source of truth for event pricing — add a row here for any
// future event; the landing page and this function agree on the slug,
// never on a price it sends.
const EVENT_PRICES: Record<string, { amountCents: number; description: string }> = {
  "persea-experience": { amountCents: 99700, description: "PERSEA Experience" },
};

const SUMUP_API_BASE = "https://api.sumup.com";

Deno.serve(async (req) => {
  const cors = corsHeadersFor(req);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") return json({ error: "POST only" }, 405, cors);
  try {
    const { event_slug, name, email, whatsapp, age, instagram, linkedin } = await req.json();
    const event = EVENT_PRICES[event_slug];
    if (!event) return json({ error: "evento não encontrado" }, 400, cors);

    const fullName = String(name || "").trim().slice(0, 200);
    const emailTrim = String(email || "").trim().slice(0, 200);
    const phone = String(whatsapp || "").trim().slice(0, 40);
    const instagramTrim = String(instagram || "").trim().slice(0, 100) || null;
    const linkedinTrim = String(linkedin || "").trim().slice(0, 200) || null;
    const ageNum = age !== undefined && age !== null && age !== "" ? Number(age) : null;
    if (!fullName) return json({ error: "Nome é obrigatório." }, 400, cors);
    if (!emailTrim || !isValidEmail(emailTrim)) return json({ error: "E-mail inválido." }, 400, cors);
    if (!phone) return json({ error: "WhatsApp é obrigatório." }, 400, cors);
    if (!instagramTrim && !linkedinTrim) return json({ error: "Informe seu Instagram ou LinkedIn." }, 400, cors);
    if (ageNum !== null && (!Number.isInteger(ageNum) || ageNum < 1 || ageNum > 120)) {
      return json({ error: "Idade inválida." }, 400, cors);
    }

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Already paid — nothing to charge again, just let her know.
    const { data: existingRows } = await admin.from("event_registrations").select("*")
      .eq("event_slug", event_slug).eq("email", emailTrim)
      .order("created_at", { ascending: false }).limit(1);
    const existing = existingRows?.[0] ?? null;
    if (existing?.status === "pago") {
      return json({ ok: true, already_paid: true }, 200, cors);
    }

    const reference = `event-${event_slug}-${crypto.randomUUID().slice(0, 8)}`;
    const SUMUP_API_KEY = Deno.env.get("SUMUP_API_KEY");
    const SUMUP_MERCHANT_CODE = Deno.env.get("SUMUP_MERCHANT_CODE");
    const hasRealCredentials = !!(SUMUP_API_KEY && SUMUP_MERCHANT_CODE);

    let provider: "sumup" | "mock" | "manual_link" = "mock";
    let sumupCheckoutId: string | null = null;
    let hostedUrl: string;
    let rawStatus = "PENDING";

    // Real installment choice (client picks 1-12x, Nay absorbs the fee)
    // only exists today on SumUp's own manually-created "Link de
    // Pagamento" — their public Checkouts API (used below) has no
    // installments field at creation time, only at the processing step of
    // a direct card-capture integration we don't have. Until that's
    // built, Nay can paste one static link here (configured with
    // installments in the SumUp app) and every registrant is sent there
    // instead of a fresh per-registrant checkout — see admin/events.js's
    // own settings field. The tradeoff: sumup-webhook can't auto-confirm
    // payment against a shared link the way it does a real checkout_id,
    // so registrations stay 'interessada' until marked paid by hand.
    const { data: tenantSettings } = await admin.from("tenant_settings").select("event_manual_payment_link_url").eq("id", 1).maybeSingle();
    const manualLink = tenantSettings?.event_manual_payment_link_url?.trim();

    if (manualLink) {
      provider = "manual_link";
      hostedUrl = manualLink;
    } else if (hasRealCredentials) {
      const createRes = await fetch(`${SUMUP_API_BASE}/v0.1/checkouts`, {
        method: "POST",
        headers: { Authorization: `Bearer ${SUMUP_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          checkout_reference: reference,
          amount: Math.round(event.amountCents) / 100,
          currency: "BRL",
          merchant_code: SUMUP_MERCHANT_CODE,
          // Just the event name — no registrant name appended. A real
          // person's own name is fine on a checkout page in principle, but
          // this is the one field visible in the SumUp "Pagamento seguro"
          // header itself, above the actual cardholder-name field she
          // still fills in separately — showing it there read as part of
          // the event's own title rather than "your name", and it's what
          // made a test submission's placeholder name ("Teste") visibly
          // stick to the checkout.
          description: event.description,
          return_url: "https://perseaexperience.naymurta.com/?obrigada=1#vaga",
          hosted_checkout: { enabled: true },
        }),
      });
      const createJson = await createRes.json();
      if (!createRes.ok) {
        console.log("event checkout create failed:", JSON.stringify(createJson));
        return json({ error: createJson.message || createJson.error_message || "erro ao criar checkout na SumUp" }, 502, cors);
      }
      provider = "sumup";
      sumupCheckoutId = createJson.id;
      hostedUrl = createJson.hosted_checkout_url;
      rawStatus = createJson.status || "PENDING";
    } else {
      sumupCheckoutId = `mock_${crypto.randomUUID()}`;
      hostedUrl = `mock-payment.html?checkout=${sumupCheckoutId}`;
    }

    const row = {
      event_slug, full_name: fullName, email: emailTrim, phone,
      age: ageNum, instagram: instagramTrim, linkedin: linkedinTrim,
      amount_cents: event.amountCents, currency: "BRL", status: "interessada",
      provider, sumup_checkout_id: sumupCheckoutId, sumup_checkout_reference: reference,
      sumup_link_url: hostedUrl, sumup_raw_status: rawStatus, updated_at: new Date().toISOString(),
    };

    if (existing) {
      const { error: updErr } = await admin.from("event_registrations").update(row).eq("id", existing.id);
      if (updErr) return json({ error: updErr.message }, 500, cors);
    } else {
      const { error: insErr } = await admin.from("event_registrations").insert(row);
      if (insErr) return json({ error: insErr.message }, 500, cors);
    }

    return json({ ok: true, hosted_url: hostedUrl }, 200, cors);
  } catch (e) {
    return json({ error: String(e) }, 500, cors);
  }
});
