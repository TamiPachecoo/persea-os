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
const ACCESS = ["Não preciso", "Cadeira de rodas ou mobilidade reduzida", "Acesso sem escadas", "Assento com apoio ou mais conforto", "Deficiência auditiva", "Deficiência visual", "Gestante", "Outra"];
const REVENUE_NOW = ["Até R$ 5 mil", "R$ 5 mil a R$ 10 mil", "R$ 10 mil a R$ 20 mil", "R$ 20 mil a R$ 50 mil", "Acima de R$ 50 mil"];
const REVENUE_GOAL = ["Até R$ 10 mil", "R$ 10 mil a R$ 20 mil", "R$ 20 mil a R$ 50 mil", "R$ 50 mil a R$ 100 mil", "Acima de R$ 100 mil"];
// Photos for the event dynamic: childhood photo(s) and special people.
const BUCKET = "event-prep-photos";
const PHOTO_KINDS: Record<string, { column: string; max: number }> = {
  child: { column: "prep_child_photos", max: 3 },
  special: { column: "prep_special_photos", max: 3 },
};
const PHOTO_EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/heic": "heic", "image/heif": "heif" };
type Photo = { path: string };
// deno-lint-ignore no-explicit-any
async function withViewUrls(admin: any, photos: Photo[]) {
  if (!photos.length) return [];
  const { data } = await admin.storage.from(BUCKET).createSignedUrls(photos.map((p) => p.path), 3600);
  return photos.map((p, i) => ({ ...p, url: data?.[i]?.signedUrl || null }));
}

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
      .select("id, full_name, prep_submitted_at, prep_expectations, prep_expectations_note, prep_food_restrictions, prep_food_note, prep_allergies, prep_accessibility, prep_accessibility_note, prep_revenue_current, prep_revenue_goal, prep_child_photos, prep_special_photos")
      .eq("prep_token", token).maybeSingle();
    if (!reg) return json({ error: "Link inválido ou expirado." }, 404, cors);

    if (body.action === "get") {
      return json({
        first_name: String(reg.full_name || "").trim().split(/\s+/)[0],
        submitted: !!reg.prep_submitted_at,
        answers: {
          expectations: reg.prep_expectations || [], expectations_note: reg.prep_expectations_note || "",
          food: reg.prep_food_restrictions || [], food_note: reg.prep_food_note || "",
          child_photos: await withViewUrls(admin, reg.prep_child_photos || []),
          special_photos: await withViewUrls(admin, reg.prep_special_photos || []),
          allergies: reg.prep_allergies || "", accessibility: reg.prep_accessibility || [], accessibility_note: reg.prep_accessibility_note || "", revenue_current: reg.prep_revenue_current || "", revenue_goal: reg.prep_revenue_goal || "",
        },
      }, 200, cors);
    }

    // 1) a one-time signed upload slot inside her own folder; the browser
    // uploads the file straight to Storage with it.
    if (body.action === "photo_upload_url") {
      const kind = PHOTO_KINDS[body.kind];
      const ext = PHOTO_EXT[String(body.content_type || "")];
      if (!kind || !ext) return json({ error: "Envie uma imagem (JPG, PNG, WEBP ou HEIC)." }, 400, cors);
      if ((reg[kind.column] || []).length >= kind.max) return json({ error: `Limite de ${kind.max} fotos aqui.` }, 400, cors);
      const path = `${reg.id}/${body.kind}-${crypto.randomUUID()}.${ext}`;
      const { data, error } = await admin.storage.from(BUCKET).createSignedUploadUrl(path);
      if (error) return json({ error: "Não foi possível preparar o envio da foto." }, 500, cors);
      return json({ path, signed_url: data.signedUrl }, 200, cors);
    }
    // 2) once uploaded, attach it to her registration (only paths in her folder that really exist)
    if (body.action === "photo_add") {
      const kind = PHOTO_KINDS[body.kind];
      const path = String(body.path || "");
      if (!kind || !path.startsWith(`${reg.id}/${body.kind}-`)) return json({ error: "Foto inválida." }, 400, cors);
      const list: Photo[] = reg[kind.column] || [];
      if (list.length >= kind.max) return json({ error: `Limite de ${kind.max} fotos aqui.` }, 400, cors);
      const folder = path.split("/")[0], name = path.split("/")[1];
      const { data: found } = await admin.storage.from(BUCKET).list(folder, { search: name });
      if (!found?.some((f: { name: string }) => f.name === name)) return json({ error: "A foto não chegou. Tente de novo." }, 400, cors);
      const next = list.filter((p) => p.path !== path).concat({ path });
      const { error } = await admin.from("event_registrations").update({ [kind.column]: next, updated_at: new Date().toISOString() }).eq("id", reg.id);
      if (error) return json({ error: "Não foi possível salvar a foto." }, 500, cors);
      return json({ ok: true, photos: await withViewUrls(admin, next) }, 200, cors);
    }
    // 3) remove one of her photos (and the file)
    if (body.action === "photo_remove") {
      const kind = PHOTO_KINDS[body.kind];
      const path = String(body.path || "");
      if (!kind) return json({ error: "Foto inválida." }, 400, cors);
      const list: Photo[] = reg[kind.column] || [];
      if (!list.some((p) => p.path === path)) return json({ error: "Foto não encontrada." }, 404, cors);
      const next = list.filter((p) => p.path !== path);
      await admin.storage.from(BUCKET).remove([path]);
      await admin.from("event_registrations").update({ [kind.column]: next, updated_at: new Date().toISOString() }).eq("id", reg.id);
      return json({ ok: true, photos: await withViewUrls(admin, next) }, 200, cors);
    }

    if (body.action !== "submit") return json({ error: "ação inválida" }, 400, cors);
    const a = body.answers || {};
    const expectations = (Array.isArray(a.expectations) ? a.expectations : []).filter((x: string) => EXPECTATIONS.includes(x)).slice(0, 3);
    const food = (Array.isArray(a.food) ? a.food : []).filter((x: string) => FOOD.includes(x));
    if (!expectations.length) return json({ error: "Escolha pelo menos uma expectativa." }, 400, cors);
    if (!food.length) return json({ error: "Responda sobre restrições alimentares." }, 400, cors);
    if (food.includes("Outra") && !clean(a.food_note, 300)) return json({ error: "Conte qual é a sua restrição alimentar." }, 400, cors);
    const access = (Array.isArray(a.accessibility) ? a.accessibility : []).filter((x: string) => ACCESS.includes(x));
    if (!access.length) return json({ error: "Responda sobre acessibilidade." }, 400, cors);
    if (access.includes("Outra") && !clean(a.accessibility_note, 300)) return json({ error: "Conte qual é a sua necessidade de acessibilidade." }, 400, cors);
    if (!REVENUE_NOW.includes(a.revenue_current)) return json({ error: "Escolha seu faturamento atual." }, 400, cors);
    if (!REVENUE_GOAL.includes(a.revenue_goal)) return json({ error: "Escolha sua meta de faturamento." }, 400, cors);

    const { error } = await admin.from("event_registrations").update({
      prep_expectations: expectations, prep_expectations_note: clean(a.expectations_note, 600),
      prep_food_restrictions: food.includes("Nenhuma") ? ["Nenhuma"] : food, prep_food_note: clean(a.food_note, 300),
      prep_allergies: clean(a.allergies, 300),
      prep_accessibility: access.includes("Não preciso") ? ["Não preciso"] : access, prep_accessibility_note: clean(a.accessibility_note, 300),
      prep_revenue_current: a.revenue_current, prep_revenue_goal: a.revenue_goal,
      prep_submitted_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }).eq("id", reg.id);
    if (error) return json({ error: "Não foi possível salvar agora." }, 500, cors);
    return json({ ok: true }, 200, cors);
  } catch (e) {
    return json({ error: String(e) }, 500, cors);
  }
});
