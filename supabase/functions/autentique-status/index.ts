// Polls Autentique for a document's signature status — the workaround for
// not having a public webhook URL yet. Called on demand from the admin
// contract page. Once every REQUIRED signer has actually signed: downloads
// the executed file into our own signed-contracts bucket, marks the
// contract completed, and logs the activity.
//
// Product-flow correction (see an earlier pass): this no longer touches
// profiles/Auth/access_status/clients.status at all — see invite-client
// for where client activation now happens, as an explicit staff action.
//
// Real bug found via the live E2E test and fixed here: the completion
// check used to be `signatures.length > 0 && signatures.every(s => !!s.signed)`
// — but a real Autentique document can contain MORE signature records than
// actual required signers. Confirmed on this project's own real test
// document (queried directly, not assumed): document.signatures included
// the account owner (naymurta@gmail.com) with action: null — an implicit
// participant Autentique adds for the API-token owner, never assigned a
// signing action — alongside the real client signer (action: SIGN, fully
// signed). `.every()` over the raw array was checking the owner's
// never-going-to-be-signed placeholder too, permanently returning false
// even after the real, only-required signer had genuinely signed.
//
// classifyDocument() below is the small, explicit normalization layer
// (item 7) — only ever looks at signatures with a real `action` (SIGN,
// APPROVE, RECOGNIZE, SIGN_AS_A_WITNESS all count as "required"; a null
// action means "not a required participant", confirmed via this real
// response) and produces one of: AWAITING_SIGNATURE, AWAITING_APPROVAL,
// COMPLETED, REJECTED, DELIVERY_FAILED, ERROR. Safe for multi-signer
// contracts: COMPLETED only when every required signer has signed, never
// from a single signer among several.
//
// While not completed it also returns `signers`: each required signer's
// e-mail, whether Autentique's e-mail was sent / delivered / opened, and
// her personal signing link, so Nay can send that link by WhatsApp when
// the e-mail went to spam or wasn't found. Fetched in a separate query so
// that, if Autentique ever rejects one of these fields, the status check
// itself still works (signers just comes back empty).
import { createClient } from "npm:@supabase/supabase-js@2";

const ALLOWED_ORIGINS = ["http://localhost:8934", "https://persea-os.pachecootami.workers.dev", "https://persea-os-pages.pages.dev", "https://app.naymurta.com"];
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

type DocStatus = "AWAITING_SIGNATURE" | "AWAITING_APPROVAL" | "COMPLETED" | "REJECTED" | "DELIVERY_FAILED" | "ERROR";

// A signature record is a real required signer only when Autentique
// assigned it an action (SIGN/APPROVE/RECOGNIZE/SIGN_AS_A_WITNESS) — a
// null action means it's a non-required participant (e.g. the API token's
// own account, auto-listed as a viewer), confirmed via a real document,
// not assumed. Anything without a real action is excluded from the
// completion calculation entirely.
function classifyDocument(signatures: any[]): { status: DocStatus; requiredCount: number } {
  const required = (signatures || []).filter((s) => !!s?.action?.name);
  if (required.length === 0) return { status: "ERROR", requiredCount: 0 };

  if (required.some((s) => !!s.rejected || !!s.biometric_rejected)) return { status: "REJECTED", requiredCount: required.length };
  if (required.some((s) => !!s.email_events?.refused)) return { status: "DELIVERY_FAILED", requiredCount: required.length };

  const allSigned = required.every((s) => !!s.signed);
  if (allSigned) return { status: "COMPLETED", requiredCount: required.length };

  // A required signature captured but not yet through Autentique's own
  // approval step (biometric/chat-based signing flows) — signed_unapproved
  // true with signed still null. Distinct from plain "hasn't signed yet".
  if (required.some((s) => !!s.signed_unapproved && !s.signed)) return { status: "AWAITING_APPROVAL", requiredCount: required.length };

  return { status: "AWAITING_SIGNATURE", requiredCount: required.length };
}

async function autentique(token: string, query: string, variables: Record<string, unknown>) {
  const res = await fetch("https://api.autentique.com.br/v2/graphql", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  return await res.json();
}

// Required signers' delivery state and personal signing link. Never throws.
async function signerDetails(token: string, id: string) {
  try {
    const r = await autentique(token, `query($id: UUID!) {
      document(id: $id) {
        signatures {
          email
          action { name }
          link { short_link }
          email_events { sent opened delivered refused reason }
          signed { created_at }
        }
      }
    }`, { id });
    if (r.errors) return { signers: [], signers_error: r.errors[0]?.message || "erro" };
    return {
      signers: (r.data?.document?.signatures || []).filter((s: any) => !!s?.action?.name).map((s: any) => ({
        email: s.email || null,
        link: s.link?.short_link || null,
        sent: !!s.email_events?.sent,
        delivered: !!s.email_events?.delivered,
        opened: !!s.email_events?.opened,
        refused: !!s.email_events?.refused,
        refused_reason: s.email_events?.reason || null,
        signed: !!s.signed,
      })),
    };
  } catch (e) {
    return { signers: [], signers_error: String(e) };
  }
}

Deno.serve(async (req) => {
  const cors = corsHeadersFor(req);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") return json({ error: "POST only" }, 405, cors);
  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { contract_id } = await req.json();
    if (!contract_id) return json({ error: "contract_id required" }, 400, cors);

    const { data: contract, error: cErr } = await supabase.from("contracts").select("*, clients(status, full_name, email)").eq("id", contract_id).maybeSingle();
    if (cErr || !contract) return json({ error: cErr?.message || "contrato não encontrado" }, 404, cors);
    if (!contract.autentique_document_id) return json({ error: "este contrato não foi enviado via Autentique" }, 400, cors);

    // Idempotency (item 11): a contract already completed must never be
    // re-processed — re-downloading the signed file would create a
    // duplicate Storage object (Date.now()-based path), and re-logging
    // would duplicate the activity entry. Returns a clean "already done"
    // response instead.
    if (contract.status === "completed" && contract.signed_file_path) {
      return json({ ok: true, normalized_status: "COMPLETED", signed: true, already_processed: true, signed_file_path: contract.signed_file_path }, 200, cors);
    }

    const AUTENTIQUE_TOKEN = Deno.env.get("AUTENTIQUE_API_TOKEN");
    if (!AUTENTIQUE_TOKEN) return json({ error: "AUTENTIQUE_API_TOKEN não configurado" }, 500, cors);

    const query = `query($id: UUID!) {
      document(id: $id) {
        id
        name
        files { signed pades }
        signatures {
          action { name }
          email_events { refused reason }
          signed { created_at }
          rejected { created_at }
          signed_unapproved { created_at }
          biometric_rejected { created_at }
        }
      }
    }`;
    const autJson = await autentique(AUTENTIQUE_TOKEN, query, { id: contract.autentique_document_id });
    if (autJson.errors) return json({ error: autJson.errors[0]?.message || "erro na Autentique", raw: autJson.errors }, 502, cors);

    const doc = autJson.data.document;
    const signatures = doc?.signatures ?? [];
    const { status: normalizedStatus, requiredCount } = classifyDocument(signatures);

    if (normalizedStatus !== "COMPLETED") {
      const details = await signerDetails(AUTENTIQUE_TOKEN, contract.autentique_document_id);
      return json({ ok: true, normalized_status: normalizedStatus, signed: false, required_signer_count: requiredCount, ...details }, 200, cors);
    }

    const signedUrl = doc.files?.signed;
    if (!signedUrl) {
      // All required signers show as signed, but Autentique hasn't
      // finished assembling the executed file yet — a real, if rare,
      // timing gap. Reported distinctly rather than silently retried with
      // an empty file.
      return json({ ok: true, normalized_status: "AWAITING_SIGNATURE", signed: false, warning: "todas as assinaturas necessárias foram recebidas, mas a Autentique ainda não gerou o arquivo assinado — tente novamente em instantes" }, 200, cors);
    }

    const fileRes = await fetch(signedUrl, { headers: { Authorization: `Bearer ${AUTENTIQUE_TOKEN}` } });
    const fileBytes = new Uint8Array(await fileRes.arrayBuffer());
    const path = `${contract.client_id}/${Date.now()}-assinado.pdf`;

    const { error: upErr } = await supabase.storage.from("signed-contracts").upload(path, fileBytes, { contentType: "application/pdf" });
    if (upErr) return json({ error: upErr.message }, 500, cors);

    const { error: updErr } = await supabase.from("contracts").update({
      status: "completed", signed_file_path: path, signed_file_name: "contrato-assinado.pdf", signed_file_uploaded_at: new Date().toISOString(),
    }).eq("id", contract_id);
    if (updErr) return json({ error: updErr.message }, 500, cors);

    await supabase.from("client_activity_log").insert({
      client_id: contract.client_id,
      event_type: "contract_signed",
      text: "Contrato assinado via Autentique — recebido automaticamente pelo sistema. Acesso ainda não concedido.",
      occurred_at: new Date().toISOString(),
    });

    return json({ ok: true, normalized_status: "COMPLETED", signed: true, signed_file_path: path }, 200, cors);
  } catch (e) {
    return json({ error: String(e) }, 500, corsHeadersFor(req));
  }
});
