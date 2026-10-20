// Receives Content-Security-Policy violation reports from app.naymurta.com
// (header in app/_headers, report-only for now) and stores the essentials
// in csp_reports. Browsers send these without a login, so: only the app's
// own pages are accepted, every field is cut short, and nothing is echoed.
import { createClient } from "npm:@supabase/supabase-js@2";

const APP_PAGE = /^https:\/\/(app\.naymurta\.com|[a-z0-9-]+\.persea-os-pages\.pages\.dev|persea-os-pages\.pages\.dev)\//;
const clean = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max) || null;

Deno.serve(async (req) => {
  const done = () => new Response(null, { status: 204 });
  if (req.method !== "POST") return done();
  try {
    const body = await req.json();
    // report-uri sends { "csp-report": {...} }; the Reporting API sends [{ body: {...} }].
    const items = Array.isArray(body) ? body.map((r) => r?.body || {}) : [body?.["csp-report"] || {}];
    const rows = items.slice(0, 10).map((r: any) => {
      const page = clean(r["document-uri"] ?? r.documentURL, 300);
      if (!page || !APP_PAGE.test(page)) return null;
      return {
        page: page.split("?")[0],
        directive: clean(r["effective-directive"] ?? r.effectiveDirective ?? r["violated-directive"], 60),
        blocked: clean(r["blocked-uri"] ?? r.blockedURL, 300),
        source: clean(r["source-file"] ?? r.sourceFile, 300),
        sample: clean(r["script-sample"] ?? r.sample, 120),
      };
    }).filter(Boolean);
    if (!rows.length) return done();
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    // Flood guard: at most 300 reports an hour are kept.
    const since = new Date(Date.now() - 3600_000).toISOString();
    const { count } = await admin.from("csp_reports").select("id", { count: "exact", head: true }).gte("created_at", since);
    if ((count ?? 0) >= 300) return done();
    await admin.from("csp_reports").insert(rows);
    return done();
  } catch {
    return done();
  }
});
