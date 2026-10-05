// Public endpoint behind the PERSEA Experience preparation form
// (perseaexperience.naymurta.com/preparacao.html?t=<prep_token>). The
// unguessable per-registration prep_token is the only key: it reads back
// her first name and any earlier answers, and saves new ones onto her own
// event_registrations row, which staff see in the CRM's Eventos tab.
import { createClient } from "npm:@supabase/supabase-js@2";

const ALLOWED_ORIGINS = [
  "https://perseaexperience.naymurta.com",
  "https://persea-experience-preview.vercel.app",
  "http://localhost:8934",
];
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

// Allowed answers — must match preparacao.html's options exactly.
const EXPECTATIONS = [
  "Clareza sobre o meu posicionamento", "Elevar minha imagem e presença", "Comunicar meu valor com segurança",
  "Ser mais reconhecida no meu mercado", "Vender e precificar melhor", "Conexões com outras profissionais",
  "Viver uma experiência inspiradora",
];
const FOOD = ["Nenhuma", "Vegetariana", "Vegana", "Sem glúten", "Sem lactose", "Low carb", "Outra"];
const REVENUE_NOW = ["Até R$ 5 mil", "R$ 5 mil a R$ 10 mil", "R$ 10 mil a R$ 20 mil", "R$ 20 mil a R$ 50 mil", "Acima de R$ 50 mil"];
const REVENUE_GOAL = ["Até R$ 10 mil", "R$ 10 mil a R$ 20 mil", "R$ 20 mil a R$ 50 mil", "R$ 50 mil a R$ 100 mil", "Acima de R$ 100 mil"];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const clean = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max) || null;

Deno.serve(async (req) => {
  const cors = corsHeadersFor(req);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") return json({ error: "POST only" }, 405, cors);
  try {
    const body = await req.json();
    const token = String(body.token || "");
    if (!UUID.test(token)) return json({ error: "Link inválido." }, 400, cors);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: reg } = await admin.from("event_registrations")
      .select("id, full_name, prep_submitted_at, prep_expectations, prep_expectations_note, prep_food_restrictions, prep_food_note, prep_allergies, prep_revenue_current, prep_revenue_goal")
      .eq("prep_token", token).maybeSingle();
    if (!reg) return json({ error: "Link inválido ou expirado." }, 404, cors);

    if (body.action === "get") {
      return json({
        first_name: String(reg.full_name || "").trim().split(/\s+/)[0],
        submitted: !!reg.prep_submitted_at,
        answers: {
          expectations: reg.prep_expectations || [], expectations_note: reg.prep_expectations_note || "",
          food: reg.prep_food_restrictions || [], food_note: reg.prep_food_note || "",
          allergies: reg.prep_allergies || "", revenue_current: reg.prep_revenue_current || "", revenue_goal: reg.prep_revenue_goal || "",
        },
      }, 200, cors);
    }

    if (body.action !== "submit") return json({ error: "ação inválida" }, 400, cors);
    const a = body.answers || {};
    const expectations = (Array.isArray(a.expectations) ? a.expectations : []).filter((x: string) => EXPECTATIONS.includes(x)).slice(0, 3);
    const food = (Array.isArray(a.food) ? a.food : []).filter((x: string) => FOOD.includes(x));
    if (!expectations.length) return json({ error: "Escolha pelo menos uma expectativa." }, 400, cors);
    if (!food.length) return json({ error: "Responda sobre restrições alimentares." }, 400, cors);
    if (food.includes("Outra") && !clean(a.food_note, 300)) return json({ error: "Conte qual é a sua restrição alimentar." }, 400, cors);
    if (!REVENUE_NOW.includes(a.revenue_current)) return json({ error: "Escolha seu faturamento atual." }, 400, cors);
    if (!REVENUE_GOAL.includes(a.revenue_goal)) return json({ error: "Escolha sua meta de faturamento." }, 400, cors);

    const { error } = await admin.from("event_registrations").update({
      prep_expectations: expectations, prep_expectations_note: clean(a.expectations_note, 600),
      prep_food_restrictions: food.includes("Nenhuma") ? ["Nenhuma"] : food, prep_food_note: clean(a.food_note, 300),
      prep_allergies: clean(a.allergies, 300),
      prep_revenue_current: a.revenue_current, prep_revenue_goal: a.revenue_goal,
      prep_submitted_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }).eq("id", reg.id);
    if (error) return json({ error: "Não foi possível salvar agora." }, 500, cors);
    return json({ ok: true }, 200, cors);
  } catch (e) {
    return json({ error: String(e) }, 500, cors);
  }
});
