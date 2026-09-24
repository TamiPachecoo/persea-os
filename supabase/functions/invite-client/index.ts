// Creates a client's real login and emails her Supabase's built-in invite
// link (she sets her own password there — nobody ever generates or
// transmits one). Uses the service-role key, which only ever lives here,
// server-side; the caller's own JWT (forwarded, RLS-respecting) is what
// proves they're allowed to read this client's row in the first place.
//
// Security audit (real E2E test, Assistant handoff): this previously had
// no explicit role check at all — authorization was entirely indirect,
// via clients_staff_read RLS letting only admin/assistant read a `clients`
// row at all (a client-role caller passing another client's id got a 404
// from the RLS-scoped read; passing her OWN id would have just resent her
// own real invite — not a privilege escalation, but not clearly intended
// either). Added an explicit admin/assistant role check as defense-in-
// depth, matching the exact pattern every other real staff-only function
// in this project already uses (see google-calendar-create-event,
// generate-registration-link) — this was the one function missing it, not
// a new pattern. Does not broaden anything: admin and assistant could
// already both do this; a client or unauthenticated caller could not
// meaningfully abuse the old behavior, and definitely cannot now.
import { createClient } from "npm:@supabase/supabase-js@2";

// Known real frontend origins — both the redirect destination for the
// invite email AND the CORS allowlist below. persea-os-pages.pages.dev is
// the Cloudflare Pages staging/test deployment (pre-domain-connection);
// app.naymurta.com is the production custom domain.
const ALLOWED_ORIGINS = ["http://localhost:8934", "https://persea-os.pachecootami.workers.dev", "https://persea-os-pages.pages.dev", "https://app.naymurta.com"];
function resolveBaseUrl(req: Request): string {
  const origin = req.headers.get("Origin");
  if (origin && ALLOWED_ORIGINS.includes(origin)) return origin;
  return Deno.env.get("APP_BASE_URL") || ALLOWED_ORIGINS[0];
}
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
    const SITE_URL = resolveBaseUrl(req);
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabaseAsCaller = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user } } = await supabaseAsCaller.auth.getUser();
    if (!user) return json({ error: "não autenticado" }, 401, cors);
    const { data: callerProfile } = await supabaseAsCaller.from("profiles").select("role").eq("id", user.id).maybeSingle();
    if (!callerProfile || !["admin", "assistant"].includes(callerProfile.role)) {
      return json({ error: "apenas admin ou assistente podem conceder acesso" }, 403, cors);
    }

    const { client_id, mock } = await req.json();
    if (!client_id) return json({ error: "client_id required" }, 400, cors);

    const { data: client, error: cErr } = await supabaseAsCaller.from("clients").select("id, full_name, email, is_demo, status, program_slug").eq("id", client_id).maybeSingle();
    if (cErr || !client) return json({ error: cErr?.message || "cliente não encontrada (verifique permissões)" }, 404, cors);
    if (!client.email) return json({ error: "cliente sem e-mail cadastrado" }, 400, cors);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: existingProfile } = await admin.from("profiles").select("id").eq("client_id", client_id).maybeSingle();

    // Demo/test clients (clients.is_demo) skip the real invite email
    // entirely — Supabase's built-in sender has a strict per-hour rate limit
    // shared with every real invite, and this path exists purely so staff
    // can practice "Criar Acesso" repeatedly without burning that quota or
    // spamming an inbox. It still creates a real, working auth user +
    // profile (pre-confirmed, random password she'd never use) so the rest
    // of the app — access_status, login, everything — behaves exactly as
    // it would for a real activation, just without the email.
    const isMockRequest = mock === true || client.is_demo === true;

    if (existingProfile) {
      if (isMockRequest) return json({ ok: true, resent: true, mock: true }, 200, cors);
      const { error: inviteErr } = await admin.auth.admin.inviteUserByEmail(client.email, {
        data: { full_name: client.full_name, program_slug: client.program_slug || "persea" }, redirectTo: `${SITE_URL}/client/set-password.html`,
      });
      if (inviteErr) return json({ error: inviteErr.message }, 502, cors);
      return json({ ok: true, resent: true }, 200, cors);
    }

    if (isMockRequest) {
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email: client.email, email_confirm: true, password: crypto.randomUUID(),
        user_metadata: { full_name: client.full_name },
      });
      if (createErr) return json({ error: createErr.message }, 502, cors);
      const { error: profileErr } = await admin.from("profiles").insert({
        id: created.user.id, role: "client", full_name: client.full_name, email: client.email, client_id,
      });
      if (profileErr) return json({ error: profileErr.message }, 500, cors);
      const clientUpdate: Record<string, unknown> = { access_status: "created" };
      if (client.status !== "active") clientUpdate.status = "active";
      await admin.from("clients").update(clientUpdate).eq("id", client_id);
      return json({ ok: true, resent: false, mock: true }, 200, cors);
    }

    const { data: invited, error: inviteErr } = await admin.auth.admin.inviteUserByEmail(client.email, {
      data: { full_name: client.full_name, program_slug: client.program_slug || "persea" }, redirectTo: `${SITE_URL}/client/set-password.html`,
    });
    if (inviteErr) return json({ error: inviteErr.message }, 502, cors);

    const { error: profileErr } = await admin.from("profiles").insert({
      id: invited.user.id, role: "client", full_name: client.full_name, email: client.email, client_id,
    });
    if (profileErr) return json({ error: profileErr.message }, 500, cors);

    const clientUpdate: Record<string, unknown> = { access_status: "created" };
    if (client.status !== "active") clientUpdate.status = "active";
    await admin.from("clients").update(clientUpdate).eq("id", client_id);

    return json({ ok: true, resent: false }, 200, cors);
  } catch (e) {
    return json({ error: String(e) }, 500, corsHeadersFor(req));
  }
});
