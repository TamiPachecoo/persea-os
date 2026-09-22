// Public, unauthenticated endpoint for the Diagnóstico de Percepção de
// Valor lead-capture tool (app.naymurta.com/diagnostico.html). Scoring
// happens here, never in the browser — the same reasoning
// event-registration-create's own header comment lays out for price: the
// formula, weights and bottleneck threshold are the business logic Nay
// actually cares about, so nothing typed or computed on the frontend ever
// decides the result. The client only collects the 26 answers and renders
// whatever this function returns.
import { createClient } from "npm:@supabase/supabase-js@2";

const ALLOWED_ORIGINS = [
  "https://app.naymurta.com",
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

// Pillar -> question slugs + normalization range. Matches the spec exactly:
// four questions per pillar scored 1-4 except Vendas (five questions).
const PILLARS: Record<string, { questions: string[]; min: number; max: number; weight: number; label: string }> = {
  positioning: { questions: ["q5", "q6", "q7", "q8"], min: 4, max: 16, weight: 0.25, label: "Posicionamento" },
  image: { questions: ["q9", "q10", "q11", "q12"], min: 4, max: 16, weight: 0.20, label: "Imagem" },
  visibility: { questions: ["q13", "q14", "q15", "q16"], min: 4, max: 16, weight: 0.20, label: "Visibilidade" },
  connection: { questions: ["q17", "q18", "q19", "q20"], min: 4, max: 16, weight: 0.15, label: "Conexão" },
  sales: { questions: ["q21", "q22", "q23", "q24", "q25"], min: 5, max: 20, weight: 0.20, label: "Vendas" },
};
const LETTER_POINTS: Record<string, number> = { A: 1, B: 2, C: 3, D: 4 };
const MIRROR_CLASSIFICATION: Record<string, string> = {
  A: "VALOR INVISÍVEL", B: "VALOR SUBPERCEBIDO", C: "VALOR RECONHECIDO",
  D: "VALOR POSICIONADO", E: "VALOR POTENCIALIZADO",
};

function classify(index: number): string {
  if (index <= 39) return "VALOR INVISÍVEL";
  if (index <= 54) return "VALOR SUBPERCEBIDO";
  if (index <= 69) return "VALOR RECONHECIDO";
  if (index <= 84) return "VALOR POSICIONADO";
  return "VALOR POTENCIALIZADO";
}

const CLASSIFICATION_COPY: Record<string, string> = {
  "VALOR INVISÍVEL": "Existe uma distância significativa entre o valor que você entrega e aquilo que o mercado consegue perceber.",
  "VALOR SUBPERCEBIDO": "O mercado reconhece parte do seu valor, mas ainda existe uma diferença relevante entre o que você entrega e o que é percebido.",
  "VALOR RECONHECIDO": "Existe uma percepção consistente de valor, mas alguns pontos ainda limitam sua diferenciação, influência ou conversão.",
  "VALOR POSICIONADO": "Existe clareza e consistência entre seu posicionamento, imagem, visibilidade, conexão e capacidade de transformar valor em oportunidades.",
  "VALOR POTENCIALIZADO": "Existe forte alinhamento entre posicionamento, imagem, visibilidade, conexão e vendas. Seu valor não é apenas percebido: ele se transforma em reconhecimento, oportunidades e resultado.",
};

Deno.serve(async (req) => {
  const cors = corsHeadersFor(req);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") return json({ error: "POST only" }, 405, cors);
  try {
    const body = await req.json();
    const fullName = String(body.full_name || "").trim().slice(0, 200);
    const market = String(body.market || "").trim().slice(0, 200);
    const revenueBand = String(body.revenue_band || "").trim();
    const instagram = body.instagram ? String(body.instagram).trim().slice(0, 100) : null;
    const answers: Record<string, string> = body.answers || {};
    const mirrorAnswer = String(body.mirror_answer || "").trim().toUpperCase();

    if (!fullName) return json({ error: "Nome é obrigatório." }, 400, cors);
    if (!market) return json({ error: "Mercado de atuação é obrigatório." }, 400, cors);
    if (!["A", "B", "C", "D", "E", "F"].includes(revenueBand)) return json({ error: "Faturamento inválido." }, 400, cors);
    if (!["A", "B", "C", "D", "E"].includes(mirrorAnswer)) return json({ error: "Resposta espelho inválida." }, 400, cors);

    const allQuestionSlugs = Object.values(PILLARS).flatMap((p) => p.questions);
    for (const q of allQuestionSlugs) {
      if (!["A", "B", "C", "D"].includes(String(answers[q] || "").toUpperCase())) {
        return json({ error: `Resposta ausente ou inválida para ${q}.` }, 400, cors);
      }
    }

    const pillarScores: Record<string, number> = {};
    for (const [key, def] of Object.entries(PILLARS)) {
      const raw = def.questions.reduce((sum, q) => sum + LETTER_POINTS[String(answers[q]).toUpperCase()], 0);
      pillarScores[key] = ((raw - def.min) / (def.max - def.min)) * 100;
    }

    const valueIndex = Object.entries(PILLARS).reduce((sum, [key, def]) => sum + pillarScores[key] * def.weight, 0);
    const classification = classify(valueIndex);

    // Bottleneck: the lowest pillar only counts as the "main opportunity"
    // when it sits at least 10 points below the average of the other four —
    // otherwise the five pillars are considered balanced and none is
    // singled out (per spec's own worked examples).
    const pillarKeys = Object.keys(PILLARS);
    let mainOpportunity: string | null = null;
    let lowestKey = pillarKeys[0];
    for (const key of pillarKeys) if (pillarScores[key] < pillarScores[lowestKey]) lowestKey = key;
    const othersAvg = pillarKeys.filter((k) => k !== lowestKey).reduce((s, k) => s + pillarScores[k], 0) / (pillarKeys.length - 1);
    if (othersAvg - pillarScores[lowestKey] >= 10) mainOpportunity = PILLARS[lowestKey].label;

    const values = Object.values(pillarScores);
    const coherenceIndex = Math.max(...values) - Math.min(...values);

    const mirrorClassification = MIRROR_CLASSIFICATION[mirrorAnswer];
    const bandOrder = ["VALOR INVISÍVEL", "VALOR SUBPERCEBIDO", "VALOR RECONHECIDO", "VALOR POSICIONADO", "VALOR POTENCIALIZADO"];
    const calculatedRank = bandOrder.indexOf(classification);
    const mirrorRank = bandOrder.indexOf(mirrorClassification);
    const perceptionGap = mirrorRank > calculatedRank ? "acima" : mirrorRank < calculatedRank ? "abaixo" : "alinhado";

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { error: insErr } = await admin.from("value_perception_diagnostics").insert({
      full_name: fullName, market, revenue_band: revenueBand, instagram, answers,
      score_positioning: pillarScores.positioning, score_image: pillarScores.image,
      score_visibility: pillarScores.visibility, score_connection: pillarScores.connection,
      score_sales: pillarScores.sales, value_index: valueIndex, classification,
      main_opportunity: mainOpportunity, coherence_index: coherenceIndex,
      mirror_answer: mirrorAnswer, mirror_classification: mirrorClassification,
      perception_gap: perceptionGap,
    });
    if (insErr) return json({ error: insErr.message }, 500, cors);

    return json({
      ok: true,
      classification,
      classification_copy: CLASSIFICATION_COPY[classification],
      value_index: Math.round(valueIndex),
      pillars: {
        Posicionamento: Math.round(pillarScores.positioning),
        Imagem: Math.round(pillarScores.image),
        Visibilidade: Math.round(pillarScores.visibility),
        Conexão: Math.round(pillarScores.connection),
        Vendas: Math.round(pillarScores.sales),
      },
      main_opportunity: mainOpportunity,
    }, 200, cors);
  } catch (e) {
    return json({ error: String(e) }, 500, cors);
  }
});
