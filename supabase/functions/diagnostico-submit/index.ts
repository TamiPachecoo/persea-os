// Public, unauthenticated endpoint for the Diagnóstico de Percepção de
// Valor lead-capture tool (app.naymurta.com/diagnostico.html). Scoring
// happens here, never in the browser — the client only collects the 12
// answers and renders whatever this function returns. Two independent
// axes (Clareza: q1-q6, Percepção: q7-q12), each normalized 0-100 with a
// fixed 70-point cutoff, cross into one of four states via a simple
// 2x2 matrix — no ranking between states, no weighting, no bottleneck
// logic like the tool's earlier version had.
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

const CLAREZA_QUESTIONS = ["q1", "q2", "q3", "q4", "q5", "q6"];
const PERCEPCAO_QUESTIONS = ["q7", "q8", "q9", "q10", "q11", "q12"];
const LETTER_POINTS: Record<string, number> = { A: 1, B: 2, C: 3, D: 4 };
const CUTOFF = 70;

const CLASSIFICATION_COPY: Record<string, { title: string; body: string }> = {
  ESFORCO: {
    title: "VOCÊ ESTÁ NO ESTADO ESFORÇO",
    body: "Você sabe onde quer chegar. Sabe o que faz. Provavelmente consegue explicar seus diferenciais.\n\nO problema é que essa clareza ainda não está chegando ao mercado na mesma proporção.\n\nE quando existe uma distância entre aquilo que você sabe sobre o seu próprio valor e aquilo que o outro consegue perceber, uma coisa costuma acontecer: você começa a compensar.\n\nMais conteúdo.\n\nMais explicação.\n\nMais cursos.\n\nMais esforço.\n\nMais tentativa de provar.\n\nQuando talvez o problema não seja falta de entrega.\n\nÉ falta de tradução.\n\nSeu próximo movimento não deveria ser simplesmente fazer mais.\n\nDeveria ser fazer com que aquilo que você já sabe sobre o seu valor se torne evidente para quem precisa percebê-lo.\n\nSeu desafio está menos em construir valor e mais em transformar valor em percepção.",
  },
  DISPERSAO: {
    title: "VOCÊ ESTÁ NO ESTADO DISPERSÃO",
    body: "Você provavelmente já percebeu que tem potencial para muito mais, mas ainda existe dificuldade para transformar esse potencial em uma direção clara.\n\nE quando falta clareza, qualquer referência externa pode parecer uma boa direção.\n\nVocê vê alguém crescendo e pensa que deveria fazer aquilo.\n\nVê uma tendência e muda.\n\nTenta falar com públicos diferentes.\n\nExperimenta vários caminhos.\n\nE, aos poucos, sua comunicação começa a dizer muitas coisas, mas nenhuma delas com força suficiente.\n\nO problema não é falta de potencial.\n\nÉ falta de direção.\n\nAntes de tentar aumentar sua percepção no mercado, você precisa decidir o que exatamente quer que o mercado perceba.\n\nSem isso, qualquer esforço de imagem, conteúdo ou vendas corre o risco de apenas aumentar o barulho.",
  },
  SUSTENTACAO: {
    title: "VOCÊ ESTÁ NO ESTADO SUSTENTAÇÃO",
    body: "Você já conquistou algo importante: atenção.\n\nAs pessoas provavelmente gostam de você, lembram de você, se conectam com você e reconhecem algumas características que tornam sua presença marcante.\n\nMas atenção não é a mesma coisa que valor percebido.\n\nSer uma pessoa agradável não significa necessariamente ser percebida como autoridade.\n\nSer lembrada não significa ser escolhida.\n\nE ser escolhida não significa conseguir sustentar preço, posicionamento e valor.\n\nO seu próximo desafio é transformar uma percepção que já existe em algo que você consiga sustentar de maneira consistente.\n\nPrincipalmente quando a situação exige mais de você:\n\nolho no olho.\n\nUma negociação.\n\nUma apresentação.\n\nUma conversa difícil.\n\nUma proposta.\n\nUma objeção.\n\nUm preço maior.\n\nVocê não precisa necessariamente chamar mais atenção.\n\nPrecisa aprender a sustentar o valor que essa atenção já enxerga.",
  },
  ALVO: {
    title: "VOCÊ ESTÁ NO ESTADO ALVO",
    body: "Existe uma coerência importante entre aquilo que você sabe sobre o seu valor e aquilo que o mercado consegue perceber.\n\nVocê sabe o que faz.\n\nSabe para quem faz.\n\nSabe o que diferencia seu trabalho.\n\nE essa clareza aparece na sua imagem, na sua comunicação, na forma como se posiciona, se relaciona e conduz oportunidades.\n\nIsso cria uma base poderosa:\n\nclareza → imagem → comunicação → presença → conexão → percepção → vendas.\n\nALVO não significa que não exista mais nada a desenvolver.\n\nSignifica que você já possui uma base coerente para ampliar sua influência, suas oportunidades e os resultados que deseja gerar.\n\nA partir daqui, o trabalho deixa de ser apenas ser percebido.\n\nÉ escolher estrategicamente onde essa percepção pode levar você.",
  },
};

function classify(clareza: number, percepcao: number): string {
  const clarezaAlta = clareza >= CUTOFF;
  const percepcaoAlta = percepcao >= CUTOFF;
  if (clarezaAlta && !percepcaoAlta) return "ESFORCO";
  if (!clarezaAlta && !percepcaoAlta) return "DISPERSAO";
  if (!clarezaAlta && percepcaoAlta) return "SUSTENTACAO";
  return "ALVO";
}

Deno.serve(async (req) => {
  const cors = corsHeadersFor(req);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") return json({ error: "POST only" }, 405, cors);
  try {
    const body = await req.json();
    const fullName = String(body.full_name || "").trim().slice(0, 200);
    const whatsapp = String(body.whatsapp || "").trim().slice(0, 40);
    const market = String(body.market || "").trim().slice(0, 200);
    const revenueBand = String(body.revenue_band || "").trim();
    const instagram = String(body.instagram || "").trim().slice(0, 100);
    const answers: Record<string, string> = body.answers || {};

    if (!fullName) return json({ error: "Nome é obrigatório." }, 400, cors);
    if (whatsapp.replace(/\D/g, "").length < 10) return json({ error: "WhatsApp inválido." }, 400, cors);
    if (!market) return json({ error: "Mercado de atuação é obrigatório." }, 400, cors);
    if (!["A", "B", "C", "D", "E"].includes(revenueBand)) return json({ error: "Faturamento inválido." }, 400, cors);
    if (!instagram) return json({ error: "Instagram é obrigatório." }, 400, cors);

    const allQuestions = [...CLAREZA_QUESTIONS, ...PERCEPCAO_QUESTIONS];
    for (const q of allQuestions) {
      if (!["A", "B", "C", "D"].includes(String(answers[q] || "").toUpperCase())) {
        return json({ error: `Resposta ausente ou inválida para ${q}.` }, 400, cors);
      }
    }

    const sumFor = (qs: string[]) => qs.reduce((sum, q) => sum + LETTER_POINTS[String(answers[q]).toUpperCase()], 0);
    const rawClareza = sumFor(CLAREZA_QUESTIONS);
    const rawPercepcao = sumFor(PERCEPCAO_QUESTIONS);
    const scoreClareza = Math.round(((rawClareza - 6) / 18) * 100);
    const scorePercepcao = Math.round(((rawPercepcao - 6) / 18) * 100);
    const classification = classify(scoreClareza, scorePercepcao);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: inserted, error: insErr } = await admin.from("value_perception_diagnostics").insert({
      full_name: fullName, whatsapp, market, revenue_band: revenueBand, instagram, answers,
      score_clareza: scoreClareza, score_percepcao: scorePercepcao, classification,
    }).select("id").single();
    if (insErr) return json({ error: insErr.message }, 500, cors);

    const copy = CLASSIFICATION_COPY[classification];
    return json({
      ok: true,
      id: inserted.id,
      classification,
      title: copy.title,
      body: copy.body,
      score_clareza: scoreClareza,
      score_percepcao: scorePercepcao,
    }, 200, cors);
  } catch (e) {
    return json({ error: String(e) }, 500, cors);
  }
});
