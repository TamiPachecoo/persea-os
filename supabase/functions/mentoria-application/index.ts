// Public endpoint for the PERSEA mentoria application form at
// naymurta.com/aplicacao. Writes (or updates) the lead in `leads` and keeps
// every answer in leads.application, so it shows in the CRM's Leads tab.
// Same rules as landing-lead-capture: staff-only table, this function is
// the one validated write path; a lead already being worked (stage past
// "novo") keeps her stage, but her newest answers are still recorded.
import { createClient } from "npm:@supabase/supabase-js@2";

const ALLOWED_ORIGINS = ["https://naymurta.com", "https://www.naymurta.com", "http://localhost:8934"];
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
const isValidEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim());
const clean = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);

// Allowed answers — must match aplicacao/index.html exactly.
const ONE_OF: Record<string, string[]> = {
  age: ["Até 24 anos", "25 a 34 anos", "35 a 44 anos", "45 a 54 anos", "55 anos ou mais"],
  role: ["Dona do próprio negócio", "Liderança no corporativo", "Carreira no corporativo", "Em transição ou fora do mercado"],
  field: ["Saúde", "Direito", "Arquitetura e design", "Beleza e estética", "Moda", "Consultoria e mentoria", "Tecnologia", "Finanças", "Educação", "Comunicação e marketing", "Outro"],
  revenue: ["Até R$ 5 mil", "R$ 5 mil a R$ 10 mil", "R$ 10 mil a R$ 20 mil", "R$ 20 mil a R$ 50 mil", "Acima de R$ 50 mil"],
  goal: ["Cobrar mais pelo que eu já faço", "Atrair clientes e oportunidades melhores", "Ser referência no meu mercado", "Uma promoção ou um novo cargo", "Um reposicionamento completo"],
  phrase: ["Que referência.", "Que presença.", "Dá para confiar de olhos fechados.", "Quero trabalhar com essa pessoa."],
  priority: ["Prioridade número 1", "Está nos planos para os próximos meses", "Ainda não é prioridade"],
};
const BLOCKS = ["Não sei comunicar o meu valor", "Minha imagem não acompanha o meu nível", "Sou invisível no digital", "Insegurança para me posicionar", "Não sei por onde começar", "Falta tempo e constância"];

Deno.serve(async (req) => {
  const cors = corsHeadersFor(req);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") return json({ error: "POST only" }, 405, cors);
  try {
    const b = await req.json();
    const fullName = clean(b.name, 200), email = clean(b.email, 200), phone = clean(b.whatsapp, 40), instagram = clean(b.instagram, 200);
    if (!fullName) return json({ error: "Nome é obrigatório." }, 400, cors);
    if (!email || !isValidEmail(email)) return json({ error: "E-mail inválido." }, 400, cors);
    if (!phone) return json({ error: "WhatsApp é obrigatório." }, 400, cors);

    const a = b.answers || {};
    const application: Record<string, unknown> = {};
    for (const [k, options] of Object.entries(ONE_OF)) {
      if (!options.includes(a[k])) return json({ error: "Responda todas as perguntas." }, 400, cors);
      application[k] = a[k];
    }
    if (a.field === "Outro") application.field_other = clean(a.field_other, 120);
    const thermo = Number(a.thermometer);
    if (!Number.isInteger(thermo) || thermo < 0 || thermo > 10) return json({ error: "Responda todas as perguntas." }, 400, cors);
    application.thermometer = thermo;
    const blocks = (Array.isArray(a.blocks) ? a.blocks : []).filter((x: string) => BLOCKS.includes(x)).slice(0, 2);
    if (!blocks.length) return json({ error: "Responda todas as perguntas." }, 400, cors);
    application.blocks = blocks;
    application.question = clean(a.question, 800);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const now = new Date().toISOString();
    const fields = { full_name: fullName, phone, instagram: instagram || null, interested_program: "persea", application, application_submitted_at: now, updated_at: now };

    const { data: existingRows } = await admin.from("leads").select("id").eq("email", email).order("created_at", { ascending: false }).limit(1);
    const existing = existingRows?.[0] ?? null;
    const { error } = existing
      ? await admin.from("leads").update(fields).eq("id", existing.id)
      : await admin.from("leads").insert({ ...fields, email, source: "organic", vip_group_status: "not_in_group" });
    if (error) {
      console.log("mentoria-application write failed:", error.message);
      return json({ error: "Não foi possível enviar agora. Tente de novo em instantes." }, 500, cors);
    }
    return json({ ok: true, first_name: fullName.split(/\s+/)[0] }, 200, cors);
  } catch (e) {
    return json({ error: String(e) }, 500, corsHeadersFor(req));
  }
});
