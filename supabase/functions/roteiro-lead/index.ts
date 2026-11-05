// Public endpoint for app.naymurta.com/roteiro-stories (QR code of the
// PERSEA Experience Visibilidade class). Before the roteiro opens, the
// participant leaves name, WhatsApp and Instagram. Someone new becomes a
// lead in the CRM (stage "novo"); someone already there (same WhatsApp or
// Instagram) is not duplicated, only gets a note that she used the roteiro.
import { createClient } from "npm:@supabase/supabase-js@2";

const ALLOWED_ORIGINS = ["https://app.naymurta.com", "https://persea-os-pages.pages.dev", "http://localhost:8934"];
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
const clean = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);
const NOTE = "Roteiro de Stories (PERSEA Experience)";
// Compare phones by their last 11 digits so "+55 31 9…" and "(31) 9…" match.
const tail = (p: string) => p.replace(/\D/g, "").slice(-11);
const today = () => new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });

Deno.serve(async (req) => {
  const cors = corsHeadersFor(req);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") return json({ error: "POST only" }, 405, cors);
  try {
    const b = await req.json();
    if (clean(b.website, 200)) return json({ ok: true }, 200, cors); // honeypot
    const fullName = clean(b.name, 200);
    if (fullName.length < 2) return json({ error: "Escreva o seu nome." }, 400, cors);
    const phone = clean(b.phone, 40);
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 10 || digits.length > 13) return json({ error: "Informe o seu WhatsApp com DDD." }, 400, cors);
    const instagram = clean(b.instagram, 120)
      .replace(/^https?:\/\/(www\.)?instagram\.com\//i, "").replace(/[/?#].*$/, "").replace(/^@+/, "").toLowerCase();
    if (!instagram) return json({ error: "Informe o seu Instagram." }, 400, cors);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: rows } = await admin.from("leads").select("id, phone, instagram, notes");
    const existing = (rows || []).find((l) =>
      (l.phone && tail(l.phone) === tail(phone)) ||
      (l.instagram && l.instagram.replace(/^@+/, "").toLowerCase() === instagram));
    const line = `Acessou o ${NOTE} em ${today()}.`;
    if (existing) {
      const notes = existing.notes || "";
      if (!notes.includes(NOTE)) {
        await admin.from("leads").update({
          notes: notes ? `${notes}\n${line}` : line,
          instagram: existing.instagram || instagram,
          updated_at: new Date().toISOString(),
        }).eq("id", existing.id);
      }
      return json({ ok: true, new_lead: false }, 200, cors);
    }
    const { error } = await admin.from("leads").insert({
      full_name: fullName, phone, instagram, source: "other", vip_group_status: "not_in_group", notes: line,
    });
    if (error) {
      console.log("roteiro-lead insert failed:", error.message);
      return json({ error: "Não foi possível enviar agora." }, 500, cors);
    }
    return json({ ok: true, new_lead: true }, 200, cors);
  } catch (e) {
    return json({ error: String(e) }, 500, cors);
  }
});
