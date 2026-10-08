// Gives the assistant (staff) her login. Admin-only. Creates the auth user
// if needed, makes her profile role 'assistant', and returns a one-time
// link to app.naymurta.com/client/set-password.html where she creates her
// own password (same page and token flow students use). No e-mail is sent:
// the invite e-mail template is written for students ("seu contrato foi
// assinado…"), so Nay sends this link herself (WhatsApp), the same way she
// already shares registration links. Calling it again for the same e-mail
// returns a fresh link (recovery type) — useful if the first one expired.
import { createClient } from "npm:@supabase/supabase-js@2";

const ALLOWED_ORIGINS = ["https://app.naymurta.com", "https://persea-os-pages.pages.dev", "https://persea-os.pachecootami.workers.dev", "http://localhost:8934"];
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
    const origin = req.headers.get("Origin");
    const SITE_URL = origin && ALLOWED_ORIGINS.includes(origin) ? origin : "https://app.naymurta.com";
    const asCaller = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });
    const { data: { user } } = await asCaller.auth.getUser();
    if (!user) return json({ error: "não autenticado" }, 401, cors);
    const { data: caller } = await asCaller.from("profiles").select("role").eq("id", user.id).maybeSingle();
    if (caller?.role !== "admin") return json({ error: "Apenas a Nay (admin) pode dar acesso à equipe." }, 403, cors);

    const body = await req.json();
    const email = String(body.email || "").trim().toLowerCase();
    const fullName = String(body.full_name || "").trim().slice(0, 120);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: "Confira o e-mail." }, 400, cors);
    if (!fullName) return json({ error: "Escreva o nome dela." }, 400, cors);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // New person → invite link (creates the user). Already registered →
    // recovery link for the same user, so the button doubles as "new link".
    let type: "invite" | "recovery" = "invite";
    let { data: link, error } = await admin.auth.admin.generateLink({ type: "invite", email, options: { data: { full_name: fullName, role: "assistant" } } });
    if (error && /already|registered|exists/i.test(error.message)) {
      type = "recovery";
      ({ data: link, error } = await admin.auth.admin.generateLink({ type: "recovery", email }));
    }
    if (error || !link?.user) return json({ error: error?.message || "Não foi possível criar o acesso." }, 502, cors);

    // Never turn a student's (or Nay's own) account into a staff account.
    const { data: existing } = await admin.from("profiles").select("id, role").eq("id", link.user.id).maybeSingle();
    if (existing && existing.role !== "assistant") {
      return json({ error: "Este e-mail já pertence a outra conta do sistema (cliente ou admin). Use outro e-mail para a assistente." }, 409, cors);
    }
    if (!existing) {
      const { error: pErr } = await admin.from("profiles").insert({ id: link.user.id, role: "assistant", full_name: fullName, email, client_id: null });
      if (pErr) return json({ error: pErr.message }, 500, cors);
    } else {
      await admin.from("profiles").update({ full_name: fullName }).eq("id", link.user.id);
    }

    const url = `${SITE_URL}/client/set-password.html?token_hash=${encodeURIComponent(link.properties.hashed_token)}&type=${type}`;
    return json({ ok: true, url, type }, 200, cors);
  } catch (e) {
    return json({ error: String(e) }, 500, corsHeadersFor(req));
  }
});
