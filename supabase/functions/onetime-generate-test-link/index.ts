// Disabled after single use — was a throwaway diagnostic to generate a
// real token_hash without sending an email, used to verify the
// scanner-safety fix in client/set-password.js. See autentique-inspect
// for the same precedent.
Deno.serve(() => new Response(JSON.stringify({ error: "disabled" }), { status: 410, headers: { "Content-Type": "application/json" } }));
