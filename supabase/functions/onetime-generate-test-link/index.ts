// Throwaway diagnostic: generates a real invite-type token_hash for a
// given email via the admin API, WITHOUT sending an email, so the new
// token_hash-based set-password flow can be tested end-to-end (does
// merely loading the page consume it? does submitting the form actually
// work?) without waiting on real email delivery or burning a real
// client's invite quota. Disabled after use — see autentique-inspect's
// own header comment for the same precedent/reasoning.
import { createClient } from "npm:@supabase/supabase-js@2";

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "POST only" }), { status: 405 });
  const { email, type } = await req.json();
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data, error } = await admin.auth.admin.generateLink({ type: type || "recovery", email });
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  return new Response(JSON.stringify({
    token_hash: data.properties.hashed_token,
    verification_type: data.properties.verification_type,
  }), { status: 200, headers: { "Content-Type": "application/json" } });
});
