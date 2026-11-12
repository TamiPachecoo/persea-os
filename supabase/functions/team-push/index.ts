// Notificações push da equipe (Nay + assistente). Chamada só pelo próprio
// banco (pg_net — ver migration 20261112160000_team_push.sql), com o token
// interno guardado no Vault; nunca pelo navegador.
//
// Eventos:
//   task_created — avisa quem recebeu a tarefa/pergunta
//   comment      — avisa o outro lado da conversa
//   task_done    — avisa quem pediu, quando outra pessoa concluiu
//   sweep        — (a cada 15 min) prazo nas próximas 24h → quem é
//                  responsável; atrasada → responsável e a Nay. Uma vez cada.
//   ensure_keys  — só cria as chaves VAPID se ainda não existirem.
//
// As chaves VAPID são criadas aqui na primeira execução e guardadas no
// Vault (team_push_store_vapid) — nenhuma pessoa precisa copiá-las.
import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const APP = "https://app.naymurta.com";
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { "Content-Type": "application/json" } });
const firstName = (s: string | null | undefined) => String(s || "").replace(/\(.*?\)/g, "").trim().split(/\s+/)[0] || "";

type Profile = { id: string; role: string; full_name: string | null };
type Task = {
  id: string; kind: string; title: string; notes: string | null; client_id: string | null;
  assigned_role: string; assigned_to: string | null; created_by: string | null; created_by_name: string | null;
  due_at: string | null; status: string; completed_by: string | null; completed_by_name: string | null; source: string;
};

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  let { data: cfg } = await db.rpc("team_push_config");
  const token = req.headers.get("x-internal-token") || "";
  if (!cfg?.internal_token || token !== cfg.internal_token) return json({ error: "forbidden" }, 403);

  if (!cfg.vapid_private) {
    const keys = webpush.generateVAPIDKeys();
    await db.rpc("team_push_store_vapid", { p_public: keys.publicKey, p_private: keys.privateKey });
    ({ data: cfg } = await db.rpc("team_push_config"));
  }
  webpush.setVapidDetails(APP, cfg.vapid_public, cfg.vapid_private);

  const body = await req.json().catch(() => ({}));
  const event = String(body.event || "");
  if (event === "ensure_keys") return json({ ok: true });

  const { data: staffRows } = await db.from("profiles").select("id, role, full_name").in("role", ["admin", "assistant"]);
  const staff = (staffRows || []) as Profile[];
  const byRole = (role: string) => staff.filter((p) => p.role === role).map((p) => p.id);
  const roleOf = (id: string | null) => staff.find((p) => p.id === id)?.role || null;
  const assignees = (t: Task) => (t.assigned_to ? [t.assigned_to] : byRole(t.assigned_role));
  const clientName = async (id: string | null) => {
    if (!id) return "";
    const { data } = await db.from("clients").select("full_name").eq("id", id).maybeSingle();
    return data?.full_name || "";
  };
  const linkFor = (profileId: string, taskId: string) =>
    `${APP}/${roleOf(profileId) === "assistant" ? "assistant" : "admin"}/tarefas.html?task=${taskId}`;

  let sent = 0;
  async function notify(profileIds: string[], taskId: string, title: string, text: string, tag: string) {
    const ids = [...new Set(profileIds.filter(Boolean))];
    if (!ids.length) return;
    const { data: subs } = await db.from("push_subscriptions").select("*").in("profile_id", ids);
    await Promise.all((subs || []).map(async (s) => {
      const payload = JSON.stringify({ title, body: text, url: linkFor(s.profile_id, taskId), tag });
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 60 * 60 * 24, urgency: "high" });
        sent++;
        await db.from("push_subscriptions").update({ last_success_at: new Date().toISOString() }).eq("id", s.id);
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) await db.from("push_subscriptions").delete().eq("id", s.id); // device unsubscribed
        else console.error("push failed", code, String(e));
      }
    }));
  }
  const loadTask = async (id: string) => {
    const { data } = await db.from("team_tasks").select("*").eq("id", id).maybeSingle();
    return data as Task | null;
  };
  const dueText = (iso: string | null) => iso
    ? new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
    : "";

  if (event === "task_created") {
    const t = await loadTask(String(body.task_id));
    if (!t) return json({ ok: true, sent });
    const who = t.source === "auto" ? "Sistema" : firstName(t.created_by_name) || "Equipe";
    const cn = await clientName(t.client_id);
    const kindLabel = t.kind === "question" ? "Nova pergunta" : "Nova tarefa";
    await notify(assignees(t).filter((id) => id !== t.created_by), t.id,
      `${kindLabel} · ${who}`,
      `${t.title}${cn && !t.title.includes(cn) ? ` — ${cn}` : ""}${t.due_at ? ` · prazo ${dueText(t.due_at)}` : ""}`, `task-${t.id}`);
  } else if (event === "comment") {
    const { data: c } = await db.from("team_task_comments").select("*").eq("id", String(body.comment_id)).maybeSingle();
    if (!c) return json({ ok: true, sent });
    const t = await loadTask(c.task_id);
    if (!t) return json({ ok: true, sent });
    const { data: earlier } = await db.from("team_task_comments").select("author_id").eq("task_id", t.id);
    const people = new Set<string>([...assignees(t), ...(t.created_by ? [t.created_by] : []), ...((earlier || []).map((x) => x.author_id).filter(Boolean))]);
    if (t.source === "auto") byRole("admin").forEach((id) => people.add(id));
    people.delete(c.author_id);
    await notify([...people], t.id, `${firstName(c.author_name) || "Equipe"} respondeu`, `${t.title}: ${String(c.body).slice(0, 140)}`, `task-${t.id}`);
  } else if (event === "task_done") {
    const t = await loadTask(String(body.task_id));
    if (!t || !t.created_by || t.created_by === t.completed_by) return json({ ok: true, sent });
    await notify([t.created_by], t.id, `✓ Concluída por ${firstName(t.completed_by_name) || "equipe"}`, t.title, `task-${t.id}`);
  } else if (event === "sweep") {
    const now = new Date();
    const in24h = new Date(now.getTime() + 24 * 3600e3);
    const { data: soon } = await db.from("team_tasks").select("*").neq("status", "done").is("notified_soon_at", null)
      .gt("due_at", now.toISOString()).lte("due_at", in24h.toISOString());
    for (const t of (soon || []) as Task[]) {
      await notify(assignees(t), t.id, "⏰ Prazo chegando", `${t.title} · até ${dueText(t.due_at)}`, `due-${t.id}`);
      await db.from("team_tasks").update({ notified_soon_at: now.toISOString() }).eq("id", t.id);
    }
    const { data: late } = await db.from("team_tasks").select("*").neq("status", "done").is("notified_overdue_at", null)
      .lte("due_at", now.toISOString());
    for (const t of (late || []) as Task[]) {
      await notify([...assignees(t), ...byRole("admin")], t.id, "⚠ Tarefa atrasada", `${t.title} · venceu ${dueText(t.due_at)}`, `late-${t.id}`);
      await db.from("team_tasks").update({ notified_overdue_at: now.toISOString() }).eq("id", t.id);
    }
  }
  return json({ ok: true, sent });
});
