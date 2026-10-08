// Public/unauthenticated (same reasoning as registration-token-info) —
// re-validates the token from scratch rather than trusting anything the
// earlier /registration-token-info call returned, since a request here
// could arrive without ever calling that one first. client_id is ALWAYS
// derived from the token row server-side — the request body's own fields
// can never name which client they apply to, so there is no way to write
// into another client's party_info by forging a client_id in the payload.
// One-time: the token is marked consumed on success, and a second attempt
// with the same token is rejected exactly like an expired one.
//
// CORS fix (found via a live browser E2E test): see registration-token-
// info's identical fix — Access-Control-Allow-Headers was missing apikey/
// authorization, which supabase-js always sends, so a real browser's
// preflight silently blocked every call here too.
//
// Real gap (client created via "Novo Cliente" without an e-mail): the
// e-mail she typed here only reached party_info, so her clients row still
// said "sem e-mail" and the access invite (invite-client reads
// clients.email) could not be sent. A missing clients.email is now filled
// from this form; an e-mail Nay already set is never overwritten.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...corsHeaders } });
}
async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Only real party_info columns, explicitly listed — never a blind spread
// of the request body into an insert/update (that would let an attacker
// smuggle in e.g. client_id or submitted:false alongside legitimate fields).
const ALLOWED_FIELDS = [
  "full_name", "social_name", "birth_date", "party_type", "cpf", "rg", "profession", "nationality",
  "marital_status", "cnpj", "company_name", "email", "whatsapp", "cep", "street", "number",
  "complement", "neighborhood", "city", "state",
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  try {
    const body = await req.json().catch(() => ({}));
    const { token, ...fields } = body;
    if (!token || typeof token !== "string") return json({ error: "token obrigatório" }, 400);
    if (!fields.full_name || !fields.party_type || !["PF", "PJ"].includes(fields.party_type)) {
      return json({ error: "full_name e party_type (PF/PJ) obrigatórios" }, 400);
    }
    if (fields.party_type === "PJ" && (!fields.company_name || !fields.cnpj)) {
      return json({ error: "Pessoa Jurídica exige company_name e cnpj" }, 400);
    }

    const tokenHash = await sha256Hex(token);
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: tokenRow } = await admin.from("client_registration_tokens")
      .select("id, client_id, expires_at, consumed_at").eq("token_hash", tokenHash).maybeSingle();
    if (!tokenRow) return json({ error: "link inválido" }, 400);
    if (tokenRow.consumed_at) return json({ error: "este link já foi utilizado" }, 400);
    if (new Date(tokenRow.expires_at).getTime() < Date.now()) return json({ error: "este link expirou" }, 400);

    const row: Record<string, unknown> = { client_id: tokenRow.client_id, submitted: true };
    for (const key of ALLOWED_FIELDS) if (key in fields) row[key] = fields[key];

    const { data: existing } = await admin.from("party_info").select("client_id").eq("client_id", tokenRow.client_id).maybeSingle();
    const { error: writeErr } = existing
      ? await admin.from("party_info").update(row).eq("client_id", tokenRow.client_id)
      : await admin.from("party_info").insert(row);
    if (writeErr) return json({ error: writeErr.message }, 500);

    // Fill the client's own e-mail if staff never set one (never overwrite).
    const formEmail = String(fields.email || "").trim().toLowerCase();
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formEmail)) {
      await admin.from("clients").update({ email: formEmail }).eq("id", tokenRow.client_id).or("email.is.null,email.eq.");
    }

    // One-time: consume the token only after the write succeeds, so a
    // failed submission can still be retried with the same link.
    await admin.from("client_registration_tokens").update({ consumed_at: new Date().toISOString() }).eq("id", tokenRow.id);

    await admin.from("client_activity_log").insert({
      client_id: tokenRow.client_id, event_type: "registration_submitted",
      text: "Cadastro recebido pelo formulário de registro.", occurred_at: new Date().toISOString(),
    });

    return json({ ok: true, full_name: row.full_name });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
