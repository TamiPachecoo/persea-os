// Public tracker endpoint for Nay's sites: one page view or one click per
// call, written to site_events (staff-only). The site comes from the
// Origin header, so only naymurta.com and perseaexperience.naymurta.com
// can write; the device type is worked out here from the user agent and
// the user agent itself is not stored. No IP, no cookie.
import { createClient } from "npm:@supabase/supabase-js@2";

const SITES: Record<string, string> = {
  "https://naymurta.com": "naymurta",
  "https://www.naymurta.com": "naymurta",
  "https://perseaexperience.naymurta.com": "experience",
};
function corsHeadersFor(req: Request) {
  const origin = req.headers.get("Origin") || "";
  return {
    "Access-Control-Allow-Origin": SITES[origin] ? origin : "https://naymurta.com",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}
const clean = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max) || null;
const BOT = /bot|crawl|spider|slurp|preview|facebookexternalhit|whatsapp|headless|lighthouse/i;
function deviceOf(ua: string) {
  if (/ipad|tablet/i.test(ua)) return "tablet";
  if (/mobi|iphone|android/i.test(ua)) return "mobile";
  return "desktop";
}

Deno.serve(async (req) => {
  const cors = corsHeadersFor(req);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  const done = () => new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") return done();
  try {
    const site = SITES[req.headers.get("Origin") || ""];
    const ua = req.headers.get("User-Agent") || "";
    if (!site || BOT.test(ua)) return done();
    const b = await req.json();
    const kind = b.kind === "click" ? "click" : b.kind === "view" ? "view" : null;
    if (!kind) return done();
    let referrer = clean(b.referrer, 300);
    try { referrer = referrer ? new URL(referrer).hostname.replace(/^www\./, "").slice(0, 100) : null; } catch { referrer = null; }
    if (referrer && /(^|\.)naymurta\.com$/.test(referrer)) referrer = null; // moving between her own pages isn't a source
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    await admin.from("site_events").insert({
      site, kind,
      path: clean(b.path, 200) || "/",
      label: kind === "click" ? clean(b.label, 120) : null,
      device: deviceOf(ua),
      referrer,
      utm_source: clean(b.utm_source, 60),
      session_id: clean(b.session_id, 40),
    });
    return done();
  } catch {
    return done();
  }
});
