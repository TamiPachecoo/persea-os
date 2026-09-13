// Real client onboarding action panel — Production Migration Batch 5.
// Reached from admin/crm.js's real Clientes list (production only).
// Every action here reuses existing, already-real infrastructure — no
// second invitation/contract/token system:
//   - registration link: generate-registration-link Edge Function (new
//     this batch, narrow: only (re)issues a token for a client that
//     already exists — client creation itself stays in
//     create-client-registration).
//   - contract: the existing admin/contract.js (real, already handles
//     Autentique send/status) — this page only creates the initial empty
//     `contracts` row if one doesn't exist yet (the old MockDB-lead-
//     conversion flow used to do this; a client created directly via
//     "Novo Cliente" has no lead to convert from), then hands off.
//   - invite: the existing invite-client Edge Function, unchanged.
// Available to both admin and assistant — every action here (client read,
// token issuance, contract-row creation, invite) is already permitted to
// both roles at the RLS/Edge-Function level; this page doesn't add a new
// restriction beyond what already exists (see the delivery report for the
// one real boundary found: `profiles` is admin-only readable, which is why
// activation state is derived from clients.access_status instead, already
// readable by both roles).
import { getCurrentProfile, signOut } from '../shared/supabase-auth.js';
import { supabase } from '../shared/supabase-client.js';
import { renderShell, card, toast, openModal, formatDateTime } from '../shared/ui.js';
import { deriveClientStatus, NEXT_ACTION_LABEL } from '../shared/client-status.js';
import { loadValueAssessment } from '../shared/value-analysis-model.js';
import { SECTIONS, VALUE_ASSESSMENT_STATUS_LABEL, VALUE_ASSESSMENT_STATUS_BADGE_CLASS, fmtBRL } from '../shared/value-analysis-schema.js';
import { getLatestAttempt, getAttemptResponses, getArchetypeQuestions, loadArchetypeResults } from '../shared/archetype-model.js';
import { getVersions, getSections, createDraft, saveSectionContent, publishVersion, SECTION_DEFS } from '../shared/playbook-model.js';
import { loadProgramState, loadNextMeeting } from '../shared/program-model.js';

const PLAYBOOK_STATUS_LABEL = { draft: 'Rascunho', published: 'Publicado', archived: 'Arquivado' };
const PLAYBOOK_STATUS_BADGE = { draft: 'badge-progress', published: 'badge-completed', archived: 'badge-locked' };

// Staff-side conversion of Business Survey / Brand Direction / Value
// Analysis off MockDB (client-detail.js's MockDB.getBrandDirection/
// getValueAssessment/getBusinessSurvey are the old, still-MockDB versions —
// not converted in place there because client-detail.html is never reached
// for a real client: admin/crm.js's production client list links to THIS
// page, never to client-detail.html, for every real client — see
// productionClientRow(). Rather than retrofit a real-client identity path
// onto a 2500-line MockDB-shaped page that nothing routes to in production,
// these three real-data sections live where real clients are actually
// reviewed. client-detail.html stays exactly as-is (demo/legacy clients
// only) — a disclosed architecture decision, not an oversight.
//
// Real, same-Supabase-row source of truth throughout: the client reads
// business_surveys/business_survey_responses, brand_directions (+3 sibling
// tables), and value_assessments (+ its answer/offer/cost tables) directly
// (see client/business-survey.js, client/brand-direction.js,
// client/value-analysis.js) — the exact same rows are read/written here,
// never a second copy.
const BUSINESS_SURVEY_STAFF_ROLES = ['admin', 'assistant']; // business_surveys_staff_all / business_survey_responses_staff_all RLS covers both
// Brand Direction real RLS (unchanged from the client-side batch):
// *_admin_write is ALL for admin, *_assistant_read/*_client_read are
// SELECT-only — so assistant genuinely cannot write here; the UI reflects
// that rather than fighting it.
// Value Analysis real RLS: value_assessments/value_published_deliverables/
// the internal analysis tables all have an admin-only policy and NO
// assistant policy at all (confirmed via pg_policies before writing this —
// not assumed) — assistant is not given any Value Analysis UI at all below,
// rather than showing controls RLS would silently reject.

const clientId = new URLSearchParams(location.search).get('id');

const profile = await getCurrentProfile();
if (!profile || !['admin', 'assistant'].includes(profile.role)) {
  await signOut();
  location.href = `../login.html?next=${encodeURIComponent(location.pathname + location.search)}`;
  throw new Error('not authorized');
}
document.body.innerHTML = renderShell({ role: profile.role, active: profile.role === 'assistant' ? 'leads.html' : 'crm.html', title: 'Onboarding' });
const content = document.getElementById('app-content');
const isAssistant = profile.role === 'assistant';

if (!clientId) {
  content.innerHTML = card('<p class="text-sm" style="color:var(--terracotta);">Falta o parâmetro ?id= na URL.</p>');
  throw new Error('missing client id');
}

const TIER_LABEL = { premium: 'Premium', essential: 'Essential' };
const CONTRACT_STATUS_LABEL = {
  info_pending: 'Aguardando informações comerciais', info_received: 'Informações recebidas',
  contract_prepared: 'Contrato preparado', sent_for_signature: 'Enviado para assinatura externa',
  awaiting_signature: 'Aguardando assinatura', signed: 'Assinado', completed: 'Concluído',
};

async function loadAll() {
  const [{ data: client }, { data: partyInfo }, { data: contract }, { data: tokens }] = await Promise.all([
    supabase.from('clients').select('*').eq('id', clientId).maybeSingle(),
    supabase.from('party_info').select('*').eq('client_id', clientId).maybeSingle(),
    supabase.from('contracts').select('*').eq('client_id', clientId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('client_registration_tokens').select('id, expires_at, consumed_at, created_at').eq('client_id', clientId).order('created_at', { ascending: false }).limit(1),
  ]);
  const latestToken = tokens?.[0] || null;
  const tokenActive = latestToken && !latestToken.consumed_at && new Date(latestToken.expires_at).getTime() > Date.now();
  return { client, partyInfo, contract, latestToken, tokenActive };
}

async function loadBusinessSurvey() {
  const [{ data: questions }, { data: survey }, { data: responses }] = await Promise.all([
    supabase.from('business_survey_questions').select('*').order('sort_order'),
    supabase.from('business_surveys').select('*').eq('client_id', clientId).maybeSingle(),
    supabase.from('business_survey_responses').select('*').eq('client_id', clientId),
  ]);
  return { questions: questions || [], survey, responseByKey: new Map((responses || []).map((r) => [r.question_key, r.response])) };
}

function businessSurveyCard({ questions, survey, responseByKey }) {
  if (!survey || survey.status !== 'submitted' || !questions.length) {
    return card(`
      <p class="text-sm text-white/50 mb-1">Questionário de Negócios</p>
      <p class="text-xs" style="color:var(--muted);">Questionário de negócios ainda não respondido.</p>
    `, 'mb-6');
  }
  return card(`
    <div class="flex items-center justify-between mb-4 flex-wrap gap-2">
      <p class="text-sm text-white/50">Questionário de Negócios</p>
      <p class="text-xs" style="color:var(--gold);">Enviado em ${formatDateTime(survey.submitted_at)}</p>
    </div>
    <div class="grid sm:grid-cols-2 gap-4">
      ${questions.map((q) => `
        <div>
          <p class="text-xs text-white/30 mb-1">${q.label}</p>
          <p class="text-sm">${responseByKey.get(q.key) || '—'}</p>
        </div>
      `).join('')}
    </div>
  `, 'mb-6');
}

async function loadBrandDirection() {
  const [{ data: bdRow }, { data: keywords }, { data: references }, { data: styleNotes }] = await Promise.all([
    supabase.from('brand_directions').select('*').eq('client_id', clientId).maybeSingle(),
    supabase.from('brand_direction_keywords').select('*').eq('client_id', clientId).order('sort_order'),
    supabase.from('brand_direction_references').select('*').eq('client_id', clientId).order('sort_order'),
    supabase.from('brand_direction_style_notes').select('*').eq('client_id', clientId).order('sort_order'),
  ]);
  return { bdRow, keywords: keywords || [], references: references || [], styleNotes: styleNotes || [] };
}

function brandDirectionCard({ bdRow, keywords, references, styleNotes }) {
  const belongs = styleNotes.filter((n) => n.polarity === 'belongs').map((n) => n.text);
  const doesntBelong = styleNotes.filter((n) => n.polarity === 'doesnt_belong').map((n) => n.text);
  const hasContent = Boolean(bdRow || keywords.length || references.length || styleNotes.length);

  if (isAssistant) {
    // Read-only, matching brand_directions_assistant_read — no form, no
    // save controls, so there's nothing here that could look like it works
    // and then silently be rejected by RLS.
    if (!hasContent) {
      return card(`<p class="text-sm text-white/50 mb-1">Direção de Marca</p><p class="text-xs" style="color:var(--muted);">Direção de Marca ainda não criada.</p>`, 'mb-6');
    }
    return card(`
      <p class="text-sm text-white/50 mb-3">Direção de Marca <span class="text-xs text-white/30">(somente leitura)</span></p>
      <div class="space-y-3 text-sm">
        ${bdRow?.positioning_summary ? `<div><p class="text-xs text-white/30 mb-1">Posicionamento</p><p>${bdRow.positioning_summary}</p></div>` : ''}
        ${bdRow?.tone ? `<div><p class="text-xs text-white/30 mb-1">Tom de Comunicação</p><p>${bdRow.tone}</p></div>` : ''}
        ${bdRow?.guidance ? `<div><p class="text-xs text-white/30 mb-1">Orientações</p><p>${bdRow.guidance}</p></div>` : ''}
        ${keywords.length ? `<div><p class="text-xs text-white/30 mb-1">Palavras-chave</p><p>${keywords.map((k) => k.keyword).join(', ')}</p></div>` : ''}
        ${references.length ? `<div><p class="text-xs text-white/30 mb-1">Referências</p><p>${references.map((r) => r.reference).join(', ')}</p></div>` : ''}
      </div>
    `, 'mb-6');
  }

  // Admin: real edit form, writing the exact same rows client/brand-
  // direction.js reads. Scalar fields upsert brand_directions (PK is
  // client_id — no separate id column); the three list-shaped tables use a
  // delete-all-then-reinsert per save, the smallest correct way to sync a
  // freeform list of lines to a sort_order-keyed table without a second
  // per-item CRUD UI.
  return card(`
    <p class="text-sm text-white/50 mb-4">Direção de Marca <span class="text-xs text-white/30">— salvo aqui, visível para a cliente imediatamente</span></p>
    <form id="bd-form" class="space-y-3">
      <div><label class="text-xs text-white/40 block mb-1">Link do Pinterest</label><input name="pinterestUrl" class="field text-sm" value="${bdRow?.pinterest_url || ''}" placeholder="https://pinterest.com/..." /></div>
      <div><label class="text-xs text-white/40 block mb-1">Introdução do Mural</label><textarea name="moodBoardIntro" rows="2" class="field text-sm">${bdRow?.mood_board_intro || ''}</textarea></div>
      <div><label class="text-xs text-white/40 block mb-1">Posicionamento</label><textarea name="positioningSummary" rows="2" class="field text-sm">${bdRow?.positioning_summary || ''}</textarea></div>
      <div><label class="text-xs text-white/40 block mb-1">Tom de Comunicação</label><textarea name="tone" rows="2" class="field text-sm">${bdRow?.tone || ''}</textarea></div>
      <div><label class="text-xs text-white/40 block mb-1">Orientações da Nay</label><textarea name="guidance" rows="2" class="field text-sm">${bdRow?.guidance || ''}</textarea></div>
      <div><label class="text-xs text-white/40 block mb-1">Palavras-chave <span class="text-white/20">(uma por linha)</span></label><textarea name="keywords" rows="3" class="field text-sm">${keywords.map((k) => k.keyword).join('\n')}</textarea></div>
      <div><label class="text-xs text-white/40 block mb-1">Direção Visual / Referências <span class="text-white/20">(uma por linha)</span></label><textarea name="references" rows="3" class="field text-sm">${references.map((r) => r.reference).join('\n')}</textarea></div>
      <div><label class="text-xs text-white/40 block mb-1">O que pertence a esta marca <span class="text-white/20">(uma por linha)</span></label><textarea name="belongs" rows="3" class="field text-sm">${belongs.join('\n')}</textarea></div>
      <div><label class="text-xs text-white/40 block mb-1">O que não pertence a esta marca <span class="text-white/20">(uma por linha)</span></label><textarea name="doesntBelong" rows="3" class="field text-sm">${doesntBelong.join('\n')}</textarea></div>
      <div class="flex justify-end pt-1"><button type="submit" class="btn-primary" style="padding:9px 18px;font-size:12.5px;">Salvar Direção de Marca</button></div>
    </form>
  `, 'mb-6');
}

async function saveBrandDirection(e) {
  e.preventDefault();
  const form = e.target;
  const btn = form.querySelector('button[type="submit"]');
  btn.disabled = true;
  btn.textContent = 'Salvando…';
  const fd = new FormData(form);
  const trim = (k) => (fd.get(k) || '').toString().trim() || null;
  const lines = (k) => (fd.get(k) || '').toString().split('\n').map((s) => s.trim()).filter(Boolean);

  const { error: bdErr } = await supabase.from('brand_directions').upsert({
    client_id: clientId,
    pinterest_url: trim('pinterestUrl'),
    mood_board_intro: trim('moodBoardIntro'),
    positioning_summary: trim('positioningSummary'),
    tone: trim('tone'),
    guidance: trim('guidance'),
    updated_at: new Date().toISOString(),
  }, { onConflict: 'client_id' });

  const keywordLines = lines('keywords');
  const referenceLines = lines('references');
  const belongsLines = lines('belongs');
  const doesntBelongLines = lines('doesntBelong');

  await Promise.all([
    supabase.from('brand_direction_keywords').delete().eq('client_id', clientId),
    supabase.from('brand_direction_references').delete().eq('client_id', clientId),
    supabase.from('brand_direction_style_notes').delete().eq('client_id', clientId),
  ]);
  const inserts = [];
  if (keywordLines.length) inserts.push(supabase.from('brand_direction_keywords').insert(keywordLines.map((keyword, i) => ({ client_id: clientId, keyword, sort_order: i }))));
  if (referenceLines.length) inserts.push(supabase.from('brand_direction_references').insert(referenceLines.map((reference, i) => ({ client_id: clientId, reference, sort_order: i }))));
  const styleRows = [
    ...belongsLines.map((text, i) => ({ client_id: clientId, polarity: 'belongs', text, sort_order: i })),
    ...doesntBelongLines.map((text, i) => ({ client_id: clientId, polarity: 'doesnt_belong', text, sort_order: i })),
  ];
  if (styleRows.length) inserts.push(supabase.from('brand_direction_style_notes').insert(styleRows));
  const results = await Promise.all(inserts);

  if (bdErr || results.some((r) => r.error)) {
    toast('Não foi possível salvar agora.', { tone: 'error' });
    btn.disabled = false;
    btn.textContent = 'Salvar Direção de Marca';
    return;
  }
  toast('Direção de Marca salva.');
  render();
}

function valueAnalysisCard(va) {
  if (!va) {
    return card(`<p class="text-sm text-white/50 mb-1">Análise de Valor</p><p class="text-xs" style="color:var(--muted);">Análise de Valor ainda não iniciada.</p>`, 'mb-6');
  }
  const rows = [];
  SECTIONS.forEach((s) => {
    s.fields.forEach((f) => {
      const v = va.answers[s.key]?.[f.key];
      if (v === null || v === undefined || v === '' || (Array.isArray(v) && !v.length)) return;
      const display = f.type === 'currency' ? fmtBRL(v) : Array.isArray(v) ? v.join(', ') : String(v);
      rows.push(`<div><p class="text-xs text-white/30">${f.label}</p><p class="text-sm">${display}</p></div>`);
    });
  });
  const dl = va.publishedDeliverable;
  return card(`
    <div class="flex items-center justify-between mb-4 flex-wrap gap-2">
      <p class="text-sm text-white/50">Análise de Valor <span class="text-xs text-white/30">(somente administradoras — RLS não concede acesso à assistente aqui)</span></p>
      <span class="badge ${VALUE_ASSESSMENT_STATUS_BADGE_CLASS[va.status] || 'badge-progress'}">${VALUE_ASSESSMENT_STATUS_LABEL[va.status] || va.status}</span>
    </div>
    <p class="text-xs text-white/30 mb-2">Respostas da cliente</p>
    <div class="grid sm:grid-cols-2 gap-3 mb-6">${rows.join('') || '<p class="text-xs" style="color:var(--muted);">Sem respostas registradas ainda.</p>'}</div>
    <div class="pt-4" style="border-top:1px solid var(--line);">
      <p class="text-sm text-white/50 mb-3">Devolutiva Publicada <span class="text-xs text-white/30">— única coisa que a cliente vê desta análise</span></p>
      ${dl ? `<p class="text-xs mb-3" style="color:var(--gold);">Publicada em ${formatDateTime(dl.publishedAt)}</p>` : ''}
      <form id="value-publish-form" class="space-y-3">
        <div class="grid sm:grid-cols-2 gap-3">
          <div><label class="text-xs text-white/40 block mb-1">Preço estratégico (R$)</label><input name="strategicPrice" type="number" step="0.01" class="field text-sm" value="${dl?.strategicPriceCents != null ? (dl.strategicPriceCents / 100).toFixed(2) : ''}" /></div>
          <div><label class="text-xs text-white/40 block mb-1">Mínimo matemático (R$)</label><input name="mathematicalMinimum" type="number" step="0.01" class="field text-sm" value="${dl?.mathematicalMinimumCents != null ? (dl.mathematicalMinimumCents / 100).toFixed(2) : ''}" /></div>
          <div><label class="text-xs text-white/40 block mb-1">Data da recomendação</label><input name="recommendationDate" type="date" class="field text-sm" value="${dl?.recommendationDate || ''}" /></div>
          <div><label class="text-xs text-white/40 block mb-1">Rever em</label><input name="reviewDate" type="date" class="field text-sm" value="${dl?.reviewDate || ''}" /></div>
        </div>
        <div><label class="text-xs text-white/40 block mb-1">Explicação para a cliente</label><textarea name="explanation" rows="3" class="field text-sm">${dl?.explanation || ''}</textarea></div>
        <div class="flex justify-end pt-1"><button type="submit" class="btn-primary" style="padding:9px 18px;font-size:12.5px;">${dl ? 'Atualizar Devolutiva' : 'Publicar Devolutiva'}</button></div>
      </form>
    </div>
  `, 'mb-6');
}

async function publishValueDeliverable(e, assessmentId) {
  e.preventDefault();
  const form = e.target;
  const btn = form.querySelector('button[type="submit"]');
  btn.disabled = true;
  btn.textContent = 'Publicando…';
  const fd = new FormData(form);
  const toCents = (k) => {
    const raw = (fd.get(k) || '').toString().trim();
    if (!raw) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? Math.round(n * 100) : null;
  };
  const publishedAt = new Date().toISOString();
  const { error } = await supabase.from('value_published_deliverables').upsert({
    assessment_id: assessmentId,
    strategic_price_cents: toCents('strategicPrice'),
    mathematical_minimum_cents: toCents('mathematicalMinimum'),
    explanation: (fd.get('explanation') || '').toString().trim() || null,
    recommendation_date: fd.get('recommendationDate') || null,
    review_date: fd.get('reviewDate') || null,
    published_at: publishedAt,
  }, { onConflict: 'assessment_id' });
  if (error) {
    toast('Não foi possível publicar agora.', { tone: 'error' });
    btn.disabled = false;
    btn.textContent = 'Publicar Devolutiva';
    return;
  }
  await supabase.from('value_assessments').update({ status: 'published', published_at: publishedAt }).eq('id', assessmentId);
  toast('Devolutiva publicada — a cliente já pode vê-la.');
  render();
}

// Archetypes + Quiz — staff view (both admin and assistant; the real
// archetype_quiz_attempts/_responses RLS already grants both roles ALL
// access — this only *reads*, matching item 8's "do not give assistant
// permission to alter scoring unless clearly intended": no editing UI is
// built on top of the real staff write access RLS already happens to
// allow). Same shared/archetype-model.js the client pages use — one real
// source of truth, result computed fresh here too, never stored/trusted.
async function loadArchetypeState() {
  const latest = await getLatestAttempt(clientId);
  if (!latest) return { status: 'not_started' };
  if (latest.status === 'in_progress') {
    const [responses, questions] = await Promise.all([getAttemptResponses(latest.id), getArchetypeQuestions()]);
    return { status: 'in_progress', answered: responses.size, total: questions.length };
  }
  const results = await loadArchetypeResults(clientId);
  return { status: 'completed', results };
}

function archetypeCard(state) {
  if (state.status === 'not_started') {
    return card(`<p class="text-sm text-white/50 mb-1">Teste de Arquétipos</p><p class="text-xs" style="color:var(--muted);">Teste de Arquétipos ainda não iniciado.</p>`, 'mb-6');
  }
  if (state.status === 'in_progress') {
    return card(`
      <p class="text-sm text-white/50 mb-1">Teste de Arquétipos</p>
      <p class="text-xs" style="color:var(--muted);">Em andamento — ${state.answered} de ${state.total} afirmações respondidas.</p>
    `, 'mb-6');
  }
  const r = state.results;
  return card(`
    <div class="flex items-center justify-between mb-4 flex-wrap gap-2">
      <p class="text-sm text-white/50">Teste de Arquétipos</p>
      <p class="text-xs" style="color:var(--gold);">Concluído em ${formatDateTime(r.completedAt)}</p>
    </div>
    ${r.hasTie ? `<p class="text-xs mb-3" style="color:var(--gold);">Há um empate na faixa de destaque.</p>` : ''}
    <p class="text-xs text-white/30 mb-2">Arquétipos em destaque</p>
    <div class="flex flex-wrap gap-2 mb-4">
      ${r.featured.map((f) => `<span class="badge badge-completed">${f.name} — ${f.rawScore}/20 (${f.percentage}%)</span>`).join('')}
    </div>
    <p class="text-xs text-white/30 mb-2">Mapa completo</p>
    <div class="grid sm:grid-cols-2 gap-x-6 gap-y-1 text-sm">
      ${r.scores.map((s) => `<div class="flex items-center justify-between"><span class="text-white/60">#${s.rank} ${s.name}</span><span class="text-white/30 text-xs">${s.rawScore}/20 · ${s.percentage}%</span></div>`).join('')}
    </div>
  `, 'mb-6');
}

// Playbook — staff workflow (both admin and assistant: playbook_versions/
// _sections real RLS grants both roles one combined ALL policy, not split
// like Brand Direction — a pre-existing schema decision, respected as-is
// here rather than narrowed or broadened). Editing only ever touches the
// current draft; a published/archived version renders read-only, matching
// the real client_read RLS which only ever exposes status='published'.
async function loadPlaybookState() {
  const versions = await getVersions(clientId);
  const draft = versions.find((v) => v.status === 'draft');
  const published = versions.find((v) => v.status === 'published');
  const active = draft || published || null;
  const sections = active ? await getSections(active.id) : {};
  return { versions, draft, published, active, sections };
}

function playbookCard({ versions, draft, published, active, sections }) {
  if (!versions.length) {
    return card(`
      <p class="text-sm text-white/50 mb-1">Playbook</p>
      <p class="text-xs mb-4" style="color:var(--muted);">Nenhum Playbook criado ainda.</p>
      <button id="create-draft" class="btn-primary" style="padding:9px 18px;font-size:12.5px;">Criar primeiro rascunho</button>
    `, 'mb-6');
  }

  const isEditable = active && active.status === 'draft';
  return card(`
    <div class="flex items-center justify-between mb-4 flex-wrap gap-2">
      <p class="text-sm text-white/50">Playbook</p>
      <div class="flex items-center gap-2">
        ${versions.map((v) => `<span class="badge ${PLAYBOOK_STATUS_BADGE[v.status]}">v${v.version} — ${PLAYBOOK_STATUS_LABEL[v.status]}</span>`).join('')}
      </div>
    </div>
    ${!draft && published ? `<div class="mb-4"><button id="create-draft" class="btn-ghost">Criar novo rascunho a partir do publicado</button></div>` : ''}
    ${active ? `
      <form id="playbook-form" class="space-y-4">
        ${SECTION_DEFS.map(([key, label]) => `
          <div>
            <label class="text-xs text-white/40 block mb-1">${label}</label>
            <textarea name="${key}" rows="3" class="field text-sm" ${isEditable ? '' : 'readonly'}>${sections[key] || ''}</textarea>
          </div>
        `).join('')}
      </form>
      ${isEditable ? `
        <div class="flex justify-end pt-3">
          <button id="publish-draft" class="btn-primary" style="padding:9px 18px;font-size:12.5px;">Publicar v${active.version}</button>
        </div>
      ` : ''}
    ` : ''}
  `, 'mb-6');
}

async function createPlaybookDraft() {
  const btn = content.querySelector('#create-draft');
  btn.disabled = true;
  btn.textContent = 'Criando…';
  try { await createDraft(clientId); toast('Rascunho criado.'); render(); }
  catch { toast('Não foi possível criar o rascunho agora.', { tone: 'error' }); btn.disabled = false; btn.textContent = 'Criar rascunho'; }
}

let savingSection = null;
async function saveSectionField(versionId, key, textarea) {
  if (savingSection === key) return;
  savingSection = key;
  try { await saveSectionContent(versionId, key, textarea.value); }
  catch { toast('Não foi possível salvar esta seção agora.', { tone: 'error' }); }
  finally { savingSection = null; }
}

async function publishPlaybookDraft(versionId, versionNumber) {
  if (!confirm(`Publicar a v${versionNumber}? A cliente passará a ver esta versão imediatamente.`)) return;
  const btn = content.querySelector('#publish-draft');
  btn.disabled = true;
  btn.textContent = 'Publicando…';
  try { await publishVersion(clientId, versionId); toast('Playbook publicado.'); render(); }
  catch { toast('Não foi possível publicar agora.', { tone: 'error' }); btn.disabled = false; btn.textContent = `Publicar v${versionNumber}`; }
}

const TIER_NAME = { premium: 'Persea Premium', essential: 'Persea Essencial' };

// Program/Journey — staff summary, reusing the exact same shared/
// program-model.js the client page uses (loadProgramState/loadNextMeeting)
// — one real source of truth, not a second hand-rolled staff view. Compact
// by design (per "do not recreate the entire client Program page for
// staff") — status/phase/next-action/next-meeting only, no per-activity
// card wall.
async function programSummaryCard(client) {
  const [state, nextMeeting] = await Promise.all([loadProgramState(clientId, client), loadNextMeeting(clientId)]);
  const { programDef, progress } = state;
  if (!programDef) {
    return card(`<p class="text-sm text-white/50 mb-1">Programa</p><p class="text-xs" style="color:var(--muted);">Programa ainda não configurado.</p>`, 'mb-6');
  }
  return card(`
    <div class="flex items-center justify-between mb-4 flex-wrap gap-2">
      <p class="text-sm text-white/50">Programa</p>
      ${!isAssistant ? `<a href="agenda.html?client=${clientId}" class="btn-ghost">Agendar encontro</a>` : ''}
    </div>
    <div class="grid sm:grid-cols-2 gap-4 text-sm">
      <div><p class="text-xs text-white/30">Plano</p><p>${TIER_NAME[client.tier] || programDef.name}</p></div>
      <div><p class="text-xs text-white/30">Fase atual</p><p>Fase ${(client.phase_index || 0) + 1}</p></div>
      <div><p class="text-xs text-white/30">Atividades</p><p>${progress.completedCount} de ${progress.totalIncluded} concluídas (${progress.pct}%)</p></div>
      <div><p class="text-xs text-white/30">Próxima ação da cliente</p><p>${progress.nextActivity ? progress.nextActivity.title : 'Tudo em dia'}</p></div>
      <div class="sm:col-span-2"><p class="text-xs text-white/30">Próximo encontro</p><p>${nextMeeting ? `${nextMeeting.title || 'Encontro agendado'} — ${formatDateTime(nextMeeting.item_date)}` : 'Não agendado'}</p></div>
    </div>
  `, 'mb-6');
}

function openLinkModal(url, expiresAt) {
  const { el } = openModal({
    title: 'Link de cadastro',
    bodyHtml: `
      <p class="text-sm text-white/50 mb-4">Envie este link para a cliente concluir o cadastro. Expira em ${formatDateTime(expiresAt)} e só pode ser usado uma vez.</p>
      <div class="flex items-center gap-2">
        <input class="field text-sm" readonly value="${url}" />
        <button type="button" id="copy-reg-link" class="btn-ghost shrink-0">Copiar</button>
      </div>
    `,
  });
  el.querySelector('#copy-reg-link').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(url); toast('Link copiado.'); } catch { toast('Não foi possível copiar.', { tone: 'error' }); }
  });
}

let generatingLink = false;
async function generateLink(e) {
  // Same double-click guard as admin/crm.js's "Criar Cliente" — this
  // function always revokes any existing active token before issuing a
  // new one (that's its whole job), so firing it twice in a row would
  // silently burn a link the admin had just generated and not yet copied.
  if (generatingLink) return;
  generatingLink = true;
  const btn = e?.target;
  if (btn) btn.disabled = true;
  try {
    const { data, error } = await supabase.functions.invoke('generate-registration-link', { body: { client_id: clientId } });
    if (error || data?.error) { toast(data?.error || 'Não foi possível gerar o link agora.', { tone: 'error' }); return; }
    openLinkModal(data.registration_url, data.expires_at);
    render();
  } finally {
    generatingLink = false;
    if (btn) btn.disabled = false;
  }
}

async function prepareContract(client) {
  const { error } = await supabase.from('contracts').insert({ client_id: clientId, status: 'info_pending' });
  if (error) { toast('Não foi possível preparar o contrato agora.', { tone: 'error' }); return; }
  location.href = `contract.html?client_id=${clientId}`;
}

async function sendInvite() {
  if (!confirm('Isto envia um convite real de acesso por e-mail para a cliente. Confirmar?')) return;
  const { data, error } = await supabase.functions.invoke('invite-client', { body: { client_id: clientId } });
  if (error || data?.error) { toast(data?.error || 'Não foi possível enviar o convite agora.', { tone: 'error' }); return; }
  toast('Convite enviado.');
  render();
}

function partyInfoSummary(info) {
  if (!info) return '';
  const isPJ = info.party_type === 'PJ';
  const rows = [
    ['Nome', info.full_name], ['Tipo', isPJ ? 'Pessoa Jurídica' : 'Pessoa Física'],
    [isPJ ? 'CNPJ' : 'CPF', isPJ ? info.cnpj : info.cpf], ['Email', info.email], ['WhatsApp', info.whatsapp],
    ['Endereço', [info.street, info.number, info.neighborhood, info.city, info.state].filter(Boolean).join(', ') || null],
  ].filter(([, v]) => v);
  return card(`
    <p class="text-sm text-white/50 mb-3">Informações do Cadastro</p>
    <div class="grid sm:grid-cols-2 gap-3">
      ${rows.map(([label, value]) => `<div><p class="text-xs text-white/30">${label}</p><p class="text-sm">${value}</p></div>`).join('')}
    </div>
  `, 'mb-6');
}

function registrationLinkCard({ tokenActive, latestToken }) {
  if (tokenActive) {
    return card(`
      <div class="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p class="text-sm text-white/50 mb-1">Link de Cadastro</p>
          <p class="text-xs" style="color:var(--muted);">Ativo — expira em ${formatDateTime(latestToken.expires_at)}. Por segurança, o link em si só é exibido no momento em que é gerado.</p>
        </div>
        <button id="regenerate-link" class="btn-ghost">Gerar novo link</button>
      </div>
    `, 'mb-6');
  }
  return card(`
    <div class="flex items-center justify-between flex-wrap gap-3">
      <p class="text-sm text-white/50">Nenhum link de cadastro ativo${latestToken ? ' — o anterior expirou ou já foi utilizado' : ''}.</p>
      <button id="generate-link" class="btn-primary" style="padding:9px 18px;font-size:12.5px;">Gerar link de cadastro</button>
    </div>
  `, 'mb-6');
}

function nextActionCard(nextAction) {
  if (!nextAction) return '';
  const label = NEXT_ACTION_LABEL[nextAction];
  return card(`
    <p class="text-xs uppercase mb-2" style="color:var(--gold); letter-spacing:.12em;">Próxima Ação</p>
    <p class="text-lg font-serif">${label}</p>
  `, 'mb-6');
}

// Admin-only, matching delete-client's own role check — this is more
// destructive than anything else on this page (real login, contrato,
// pagamentos, cadastro, tudo) so it gets a tighter bar than the
// admin/assistant-shared actions above.
function dangerZoneCard() {
  if (profile.role !== 'admin') return '';
  return card(`
    <div class="flex items-center justify-between flex-wrap gap-3">
      <div>
        <p class="text-sm" style="color:var(--terracotta);">Zona de Risco</p>
        <p class="text-xs mt-1" style="color:var(--muted);">Exclui permanentemente esta cliente e todos os dados relacionados (contrato, pagamentos, cadastro, acesso, questionários, tarefas, imagens, direção de marca, análise de valor). Não pode ser desfeito.</p>
      </div>
      <button id="delete-client" class="btn-ghost" style="border-color:var(--error); color:var(--error);">Excluir Cliente</button>
    </div>
  `, 'mb-6');
}

function openDeleteClientModal(client) {
  const { el, close } = openModal({
    title: 'Excluir Cliente — Ação Irreversível',
    bodyHtml: `
      <p class="text-sm text-white/70 mb-3">Você está prestes a excluir <strong>${client.full_name}</strong> permanentemente.</p>
      <p class="text-sm text-white/50 mb-4">Isto remove definitivamente: contrato, pagamentos, cadastro, acesso de login (se existir), questionários, tarefas, imagens, direção de marca, análise de valor e todo o restante ligado a esta cliente. Não há como desfazer esta ação.</p>
      <label class="text-xs text-white/40 block mb-1">Digite <strong>DELETE</strong> para confirmar</label>
      <input id="delete-confirm-input" class="field" autocomplete="off" />
      <div class="flex justify-end gap-3 pt-4">
        <button type="button" id="cancel-delete" class="btn-ghost">Cancelar</button>
        <button type="button" id="confirm-delete" class="btn-primary" style="background:var(--error); border-color:var(--error);" disabled>Excluir Permanentemente</button>
      </div>
    `,
  });
  const input = el.querySelector('#delete-confirm-input');
  const confirmBtn = el.querySelector('#confirm-delete');
  input.addEventListener('input', () => { confirmBtn.disabled = input.value !== 'DELETE'; });
  el.querySelector('#cancel-delete').addEventListener('click', close);
  confirmBtn.addEventListener('click', async () => {
    if (input.value !== 'DELETE') return;
    confirmBtn.disabled = true;
    confirmBtn.textContent = 'Excluindo…';
    const { data, error } = await supabase.functions.invoke('delete-client', { body: { client_id: clientId, confirm: 'DELETE' } });
    if (error || data?.error) {
      toast(data?.error || 'Não foi possível excluir agora.', { tone: 'error' });
      confirmBtn.disabled = false;
      confirmBtn.textContent = 'Excluir Permanentemente';
      return;
    }
    close();
    toast(`${data.deleted_full_name} foi excluída permanentemente.`);
    location.href = 'crm.html';
  });
}

async function render() {
  const { client, partyInfo, contract, latestToken, tokenActive } = await loadAll();
  if (!client) { content.innerHTML = card('<p class="text-sm" style="color:var(--terracotta);">Cliente não encontrada.</p>'); return; }

  const [surveyState, brandState, valueAssessment, archetypeState, playbookState, programSummaryHtml] = await Promise.all([
    loadBusinessSurvey(),
    loadBrandDirection(),
    !isAssistant ? loadValueAssessment(clientId) : Promise.resolve(null),
    loadArchetypeState(),
    loadPlaybookState(),
    programSummaryCard(client),
  ]);

  const status = deriveClientStatus({
    accessStatus: client.access_status,
    partyInfoSubmitted: !!partyInfo?.submitted,
    contractStatus: contract?.status || null,
  });

  content.innerHTML = `
    <div class="mb-8">
      <p class="text-white/40 text-sm mb-1">Onboarding</p>
      <div class="flex items-center gap-3 flex-wrap mb-1">
        <h1 class="text-3xl font-serif">${client.full_name}</h1>
        <span class="badge ${status.badgeClass}">${status.label}</span>
      </div>
      <p class="text-sm text-white/40">${client.email || 'sem e-mail'} · ${TIER_LABEL[client.tier] || client.tier}</p>
    </div>

    ${nextActionCard(status.nextAction)}

    ${!partyInfo?.submitted ? registrationLinkCard({ tokenActive, latestToken }) : ''}

    ${partyInfo?.submitted ? partyInfoSummary(partyInfo) : ''}

    ${partyInfo?.submitted ? card(`
      <div class="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p class="text-sm text-white/50 mb-1">Contrato</p>
          <p class="text-xs" style="color:var(--muted);">${contract ? (CONTRACT_STATUS_LABEL[contract.status] || contract.status) : 'Nenhum contrato preparado ainda.'}</p>
        </div>
        ${!contract
          ? `<button id="prepare-contract" class="btn-primary" style="padding:9px 18px;font-size:12.5px;">Preparar contrato</button>`
          : `<a href="contract.html?client_id=${clientId}" class="btn-ghost">${['signed', 'completed'].includes(contract.status) ? 'Ver contrato' : 'Acompanhar contrato'}</a>`}
      </div>
    `, 'mb-6') : ''}

    ${status.nextAction === 'send_invite' ? card(`
      <div class="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p class="text-sm text-white/50 mb-1">Acesso</p>
          <p class="text-xs" style="color:var(--muted);">Contrato assinado — envie o convite de acesso real para a cliente entrar em app.naymurta.com.</p>
        </div>
        <button id="send-invite" class="btn-primary" style="padding:9px 18px;font-size:12.5px;">Enviar convite de acesso</button>
      </div>
    `, 'mb-6') : ''}

    <div class="mb-4 mt-2">
      <p class="eyebrow">Trabalho da Cliente</p>
    </div>
    ${programSummaryHtml}
    ${playbookCard(playbookState)}
    ${businessSurveyCard(surveyState)}
    ${brandDirectionCard(brandState)}
    ${archetypeCard(archetypeState)}
    ${!isAssistant ? valueAnalysisCard(valueAssessment) : ''}

    ${dangerZoneCard()}
  `;

  content.querySelector('#generate-link')?.addEventListener('click', generateLink);
  content.querySelector('#regenerate-link')?.addEventListener('click', generateLink);
  content.querySelector('#prepare-contract')?.addEventListener('click', () => prepareContract(client));
  content.querySelector('#send-invite')?.addEventListener('click', sendInvite);
  content.querySelector('#delete-client')?.addEventListener('click', () => openDeleteClientModal(client));
  content.querySelector('#bd-form')?.addEventListener('submit', saveBrandDirection);
  content.querySelector('#value-publish-form')?.addEventListener('submit', (e) => publishValueDeliverable(e, valueAssessment.id));
  content.querySelector('#create-draft')?.addEventListener('click', createPlaybookDraft);
  if (playbookState.active && playbookState.active.status === 'draft') {
    content.querySelectorAll('#playbook-form textarea').forEach((textarea) => {
      textarea.addEventListener('blur', () => saveSectionField(playbookState.active.id, textarea.name, textarea));
    });
    content.querySelector('#publish-draft')?.addEventListener('click', () => publishPlaybookDraft(playbookState.active.id, playbookState.active.version));
  }
}

render();
