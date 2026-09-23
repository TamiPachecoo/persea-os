// Admin-only utility: set a real password for an existing client login,
// for when Nay (or whoever's actually running the account) needs to log
// in as that client to check what she sees — e.g. QA on her own test
// account — without going through the "forgot password" email flow.
// verify_jwt stays ON (no --no-verify-jwt at deploy) — the caller's own
// JWT is forwarded into a Supabase client that respects RLS, exactly
// like autentique-send's own header comment describes, so only a real
// logged-in admin can ever reach the service-role update below.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...corsHeaders } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  try {
    const authHeader = req.headers.get("Authorization") || "";
    const caller = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await caller.auth.getUser();
    if (!userData?.user) return json({ error: "Não autenticado." }, 401);

    const { data: profile } = await caller.from("profiles").select("role").eq("id", userData.user.id).maybeSingle();
    if (profile?.role !== "admin") return json({ error: "Apenas admin." }, 403);

    const { client_id, new_password } = await req.json();
    if (!client_id || !new_password || String(new_password).length < 8) {
      return json({ error: "client_id e new_password (min. 8 caracteres) são obrigatórios." }, 400);
    }

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: clientProfile } = await admin.from("profiles").select("id, email").eq("client_id", client_id).maybeSingle();
    if (!clientProfile) return json({ error: "Este cliente ainda não tem login criado." }, 404);

    const { error: updErr } = await admin.auth.admin.updateUserById(clientProfile.id, { password: new_password });
    if (updErr) return json({ error: updErr.message }, 500);

    return json({ ok: true, email: clientProfile.email }, 200);
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
