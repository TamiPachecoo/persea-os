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
import { PROGRAM_LABEL_BY_SLUG } from '../shared/mock-db.js';
import { getCurrentProfile, signOut } from '../shared/supabase-auth.js';
import { supabase } from '../shared/supabase-client.js';
import {
  renderShell, card, toast, openModal, formatDateTime, formatDate, brl, isValidHttpUrl, externalLinkAttrs, functionErrorMessage, initialsAvatar,
} from '../shared/ui.js';
import { deriveClientStatus, NEXT_ACTION_LABEL } from '../shared/client-status.js';
import { loadActiveObligations } from '../shared/financial-model.js';
import { loadValueAssessment } from '../shared/value-analysis-model.js';
import { SECTIONS, VALUE_ASSESSMENT_STATUS_LABEL, VALUE_ASSESSMENT_STATUS_BADGE_CLASS, fmtBRL } from '../shared/value-analysis-schema.js';
import { getLatestAttempt, getAttemptResponses, getArchetypeQuestions, loadArchetypeResults } from '../shared/archetype-model.js';
import { getVersions, getSections, createDraft, saveSectionContent, publishVersion, SECTION_DEFS } from '../shared/playbook-model.js';
import { loadProgramState, loadNextMeeting } from '../shared/program-model.js';
import { computeTeamNextStep, loadEncounterJourney } from '../shared/team-action-model.js';
import { markHublaAccessGranted } from '../shared/hubla-model.js';

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
let activeTab = 'jornada';
const ASSISTANT_HIDDEN_TABS = new Set(['pesquisa', 'playbook']);

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

// Sub-tabs — same real component (.tab-btn) and click pattern
// (`[data-tab]` -> activeTab = ... -> render()) as the MockDB/demo
// prototype's own admin/client-detail.js, so this reads like the same
// product, not a bespoke one. Jornada groups the phase/encounter/activity
// breakdown (see phaseBreakdownCard); Financeiro consolidates registration
// info, the contract, and the payment plan into one place instead of them
// being scattered at the top of the page; each real content-producing
// activity Nay actually reviews/edits gets its own tab, same as the demo's
// "Direção da Marca" example. Value Analysis is admin-only (no assistant
// RLS policy exists for it at all — see this file's own header comment).
const ALL_TABS = [
  ['jornada', 'Jornada'],
  ['financeiro', 'Financeiro'],
  ['direcao-marca', 'Direção de Marca'],
  ['pesquisa', 'Precificação & Valor'],
  ['arquetipos', 'Arquétipos'],
  ['playbook', 'Playbook'],
  ['projeto-imagem', 'Projeto de Imagem'],
];
// Explicit per feedback: the assistant's CRM should show Jornada,
// Financeiro, Direção de Marca, Arquétipos, and Projeto de Imagem (the
// part of the program she's actually responsible for) — not Precificação
// & Valor (Valor is already RLS-blocked for her — see this file's own
// header comment; Precificação/business survey is bundled with it) or
// Playbook.
const TABS = isAssistant ? ALL_TABS.filter(([key]) => !ASSISTANT_HIDDEN_TABS.has(key)) : ALL_TABS;

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

// A live E2E test found that clicking "Publicar" made the browser appear to
// hang/lose connection — the native window.confirm() below blocks JS
// execution synchronously waiting for a dialog response, which several
// automated/embedded browser contexts never dismiss (no native dialog
// surface to click), reading as a frozen page. Same delete-client modal
// pattern (openModal, real Cancelar/confirm buttons) used elsewhere in this
// file, so this is consistent with the rest of the app, not a one-off.
function openPublishConfirmModal(versionId, versionNumber) {
  const { el, close } = openModal({
    title: 'Publicar Playbook',
    bodyHtml: `
      <p class="text-sm text-white/70 mb-4">Publicar a v${versionNumber}? A cliente passará a ver esta versão imediatamente.</p>
      <div class="flex justify-end gap-3 pt-2">
        <button type="button" id="cancel-publish" class="btn-ghost">Cancelar</button>
        <button type="button" id="confirm-publish" class="btn-primary">Publicar</button>
      </div>
    `,
  });
  el.querySelector('#cancel-publish').addEventListener('click', close);
  el.querySelector('#confirm-publish').addEventListener('click', async () => {
    const btn = el.querySelector('#confirm-publish');
    btn.disabled = true;
    btn.textContent = 'Publicando…';
    try { await publishVersion(clientId, versionId); close(); toast('Playbook publicado.'); render(); }
    catch { toast('Não foi possível publicar agora.', { tone: 'error' }); btn.disabled = false; btn.textContent = 'Publicar'; }
  });
}

function publishPlaybookDraft(versionId, versionNumber) {
  openPublishConfirmModal(versionId, versionNumber);
}

const TIER_NAME = { premium: 'Persea Premium', essential: 'Persea Essencial' };

// Program/Journey — staff summary, reusing the exact same shared/
// program-model.js the client page uses (loadProgramState/loadNextMeeting)
// — one real source of truth, not a second hand-rolled staff view. Compact
// by design (per "do not recreate the entire client Program page for
// staff") — status/phase/next-action/next-meeting only, no per-activity
// card wall.
// state is fetched once in render() and shared with phaseBreakdownCard —
// this used to fetch its own copy of loadProgramState, duplicating the
// exact same 5-table query render() also needed for the phase breakdown.
async function programSummaryCard(client, state) {
  const [nextMeeting, teamNextStep] = await Promise.all([loadNextMeeting(clientId), computeTeamNextStep(client, clientId)]);
  const { programDef, progress } = state;
  if (!programDef) {
    return card(`<p class="text-sm text-white/50 mb-1">Programa</p><p class="text-xs" style="color:var(--muted);">Programa ainda não configurado.</p>`, 'mb-6');
  }
  return card(`
    <div class="flex items-center justify-between mb-4 flex-wrap gap-2">
      <p class="text-sm text-white/50">Programa</p>
      ${!isAssistant ? `<a href="agenda.html?client=${clientId}" class="btn-ghost">Agendar encontro</a>` : ''}
    </div>
    <div class="grid sm:grid-cols-2 gap-4 text-sm mb-5">
      <div><p class="text-xs text-white/30">Plano</p><p>${TIER_NAME[client.tier] || programDef.name}</p></div>
      <div><p class="text-xs text-white/30">Fase atual</p><p>Fase ${(client.phase_index || 0) + 1}</p></div>
      <div><p class="text-xs text-white/30">Atividades</p><p>${progress.completedCount} de ${progress.totalIncluded} concluídas (${progress.pct}%)</p></div>
      <div><p class="text-xs text-white/30">Próxima ação da cliente</p><p>${progress.nextActivity ? progress.nextActivity.title : 'Tudo em dia'}</p></div>
      <div class="sm:col-span-2"><p class="text-xs text-white/30">Próximo encontro</p><p>${nextMeeting ? `${nextMeeting.title || 'Encontro agendado'} — ${formatDateTime(nextMeeting.item_date)}` : 'Não agendado'}</p></div>
    </div>
    <div class="pt-4" style="border-top:1px solid var(--line);">
      <p class="text-xs uppercase mb-1" style="color:var(--gold); letter-spacing:.1em;">Próxima Ação da Equipe</p>
      <p class="text-sm font-medium mb-1">${teamNextStep.label}</p>
      <p class="text-xs text-white/40 max-w-2xl">${teamNextStep.detail}</p>
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

// Real E2E test found: this had no double-click guard at all (unlike
// generateLink()/the CRM "Criar Cliente" button, which got this exact fix
// in an earlier batch) — contracts.client_id is UNIQUE, so a double-click
// fires two concurrent inserts; one succeeds and navigates via
// location.href, the other hits the unique-violation and shows "Não foi
// possível criar o contrato" at almost the same moment — the confusing
// "error, but it worked anyway" the live test reported. Fixed two ways:
// (1) the usual disabled-button guard against a double-click in the same
// session, and (2) check for an already-existing contract FIRST and just
// navigate to it — so even a genuine retry (refresh, click again after a
// slow network) can never attempt a second insert or show a false error
// for a contract that already exists, per the "reuse an existing prepared
// contract, don't create a duplicate on retry" requirement.
let preparingContract = false;
async function prepareContract(client, btn) {
  if (preparingContract) return;
  preparingContract = true;
  if (btn) btn.disabled = true;
  try {
    const { data: existing } = await supabase.from('contracts').select('id').eq('client_id', clientId).maybeSingle();
    if (existing) { location.href = `contract.html?client_id=${clientId}`; return; }
    const { error } = await supabase.from('contracts').insert({ client_id: clientId, status: 'info_pending' });
    if (error) {
      // A unique-violation here means another request (a near-simultaneous
      // click, or a retry) already created the row — that's a real success,
      // not a failure, so route there instead of showing a false error.
      if (error.code === '23505') { location.href = `contract.html?client_id=${clientId}`; return; }
      toast('Não foi possível preparar o contrato agora.', { tone: 'error' });
      return;
    }
    location.href = `contract.html?client_id=${clientId}`;
  } finally {
    preparingContract = false;
    if (btn) btn.disabled = false;
  }
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

// Client profile — ported from the MockDB/demo prototype's
// admin/client-detail.js "Programa" tab (photo, staff-only private notes,
// full E1-E8 journey), the thing this whole request was about: one real
// place either role opens to see who this client is and what phase she's
// actually in, instead of it living only in a mock preview no real client
// could ever be attached to. Real Supabase now — see the
// client_profile_photo_and_internal_notes migration (clients.photo_url +
// the new client_internal_notes table, staff-only RLS, no client policy
// at all so "never visible to the cliente" is enforced at the database
// level, not just by omitting it from her own pages).
async function loadInternalProfile() {
  const { data } = await supabase.from('client_internal_notes').select('*').eq('client_id', clientId).maybeSingle();
  return data || { note: '', who: '', what: '', why: '', how: '' };
}

async function saveInternalProfile(fields) {
  const { error } = await supabase.from('client_internal_notes')
    .upsert({ client_id: clientId, ...fields, updated_at: new Date().toISOString(), updated_by: profile.id }, { onConflict: 'client_id' });
  return error;
}

// Same URL-based approach the old demo used ("no real photo upload exists"
// — still true here; a URL field, not a Storage upload widget, is the
// honest minimal version) — falls back to the real shared initialsAvatar
// (ui.js) exactly like every other avatar in this app when there's no URL
// or it fails to load.
function clientPhoto(c, size = 96) {
  if (isValidHttpUrl(c.photo_url)) {
    return `<img src="${c.photo_url}" alt="${c.full_name}" style="width:${size}px;height:${size}px;border-radius:50%;object-fit:cover;flex-shrink:0;border:1px solid var(--line);" onerror="this.remove();" />`;
  }
  return initialsAvatar(c.full_name, size);
}

// Same layout as the demo's own Programa tab header — photo, name and a
// one-line tagline sitting right next to it (not stacked below in a
// separate column), the photo-URL editor directly under the name. Kept as
// one card, exactly as it was there, rather than the earlier version's
// separate photo/name blocks.
function profileHeaderCard(c, status) {
  return card(`
    <div class="flex items-start gap-5 flex-wrap">
      ${clientPhoto(c)}
      <div class="flex-1" style="min-width:220px;">
        <div class="flex items-center gap-3 flex-wrap">
          <p class="text-xl font-serif">${c.full_name}</p>
          <span class="badge ${status.badgeClass}">${status.label}</span>
        </div>
        <p class="text-xs text-white/30 mt-0.5">${c.email || 'sem e-mail'} · ${TIER_LABEL[c.tier] || c.tier}${c.program_slug ? ` · ${PROGRAM_LABEL_BY_SLUG[c.program_slug] || c.program_slug}` : ''}</p>
        <form id="photo-form" class="flex items-center gap-2 mt-3 flex-wrap">
          <input name="photo_url" class="field text-sm" style="max-width:340px;" placeholder="Link da foto de perfil" value="${c.photo_url || ''}" />
          <button type="submit" class="btn-ghost">Salvar</button>
        </form>
        <p class="text-xs text-white/20 mt-1">Cole o link e a foto aparece assim que salvar — precisa ser um link direto para a imagem, não uma página.</p>
      </div>
    </div>
  `, 'mb-6');
}

// "Quem é [Nome]" — the WHO/WHAT/WHY/HOW summary Nay fills in from E1/E2,
// ported verbatim from the demo's own card (same fields, same caption).
// This is the concrete answer to "extracting WHO she is and WHY she does
// what she does": once filled in here, anyone on the team opening this
// page gets it at a glance instead of re-deriving it from her raw
// Extração de Marca / Arquétipos answers every time.
function profileSummaryCard(c, p) {
  const firstName = c.full_name.split(' ')[0];
  return card(`
    <p class="text-sm text-white/50 mb-1">Quem é ${firstName}</p>
    <p class="text-xs text-white/20 mb-4">Preenchido a partir do E1 e do E2 — o resumo que qualquer pessoa da equipe precisa para entender esta cliente rapidamente.</p>
    <form id="summary-form" class="space-y-4">
      <div>
        <label class="text-xs text-white/40 block mb-1">QUEM ela é</label>
        <textarea name="who" rows="2" class="field text-sm">${p.who}</textarea>
      </div>
      <div class="grid sm:grid-cols-2 gap-4">
        <div>
          <label class="text-xs text-white/40 block mb-1">O QUE ela vende</label>
          <textarea name="what" rows="2" class="field text-sm">${p.what}</textarea>
        </div>
        <div>
          <label class="text-xs text-white/40 block mb-1">POR QUE ela vende</label>
          <textarea name="why" rows="2" class="field text-sm">${p.why}</textarea>
        </div>
      </div>
      <div>
        <label class="text-xs text-white/40 block mb-1">COMO ela vende</label>
        <textarea name="how" rows="2" class="field text-sm">${p.how}</textarea>
      </div>
      <div class="flex justify-end">
        <button type="submit" class="btn-primary" style="padding:9px 18px;font-size:12.5px;">Salvar Resumo</button>
      </div>
    </form>
  `, 'mb-6');
}

function internalNotesCard(p) {
  return card(`
    <p class="text-sm text-white/50 mb-1">Notas Internas</p>
    <p class="text-xs text-white/20 mb-3">Visível para Nay e para a assistente — nunca para a cliente.</p>
    <form id="internal-notes-form" class="space-y-3">
      <textarea name="note" rows="4" class="field text-sm">${p.note}</textarea>
      <div class="flex justify-end"><button type="submit" class="btn-ghost">Salvar Notas</button></div>
    </form>
  `, 'mb-6');
}

const ENCOUNTER_STATUS_LABEL = {
  completed: 'Concluído', scheduled: 'Agendado', pending: 'Pronto para agendar',
  waiting_on_client: 'Aguardando cliente', locked: 'Ainda não chegou a vez',
};
const ENCOUNTER_STATUS_CLASS = {
  completed: 'badge-completed', scheduled: 'badge-progress', pending: 'badge-progress',
  waiting_on_client: 'badge-locked', locked: 'badge-locked',
};

// E3 (Imagem e Estratégia) is the one encounter the assistant directly
// prepares for — its own real purpose text (encounter_defs) names exactly
// the materials the new Projeto de Imagem tab manages. Same [data-tab]
// jump mechanism phaseActivityRow's "Ver material →" already uses below.
const ENCOUNTER_TAB_LINK = { 3: 'projeto-imagem' };

function encounterRow(e) {
  const detail = e.status === 'scheduled' ? `${formatDateTime(e.scheduledAt)} — ${e.purpose}` : e.purpose;
  const tabKey = ENCOUNTER_TAB_LINK[e.number];
  return `
    <div class="py-3 border-b border-white/5 last:border-0">
      <div class="flex items-center justify-between flex-wrap gap-2 mb-1">
        <p class="text-sm font-medium">E${e.number} — ${e.name}</p>
        <div class="flex items-center gap-3">
          ${tabKey ? `<button type="button" data-tab="${tabKey}" class="btn-text">Editar material →</button>` : ''}
          <span class="badge ${ENCOUNTER_STATUS_CLASS[e.status]}">${ENCOUNTER_STATUS_LABEL[e.status]}</span>
        </div>
      </div>
      <p class="text-xs text-white/30 max-w-2xl">${detail}</p>
    </div>
  `;
}

// Clicking a material's slug jumps straight to that tab (see the [data-tab]
// delegation in render()) — the same navigation any other tab button uses,
// not a second mechanism. Slugs without a dedicated staff-editable tab
// today (brand-extraction, activity-guide, initial-images, pitch, content,
// business) just show their status, no link — an honest gap, not hidden.
const ACTIVITY_TAB_LINK = { 'brand-direction': 'direcao-marca', 'business-survey': 'pesquisa', 'archetype-test': 'arquetipos' };

function phaseActivityRow(a) {
  const tabKey = ACTIVITY_TAB_LINK[a.slug];
  return `
    <div class="flex items-center justify-between py-2 border-b border-white/5 last:border-0 flex-wrap gap-2">
      <p class="text-sm">${a.title}</p>
      <div class="flex items-center gap-3">
        <span class="badge ${a.badgeClass}">${a.statusLabel}</span>
        ${tabKey ? `<button type="button" data-tab="${tabKey}" class="btn-text">Ver material →</button>` : ''}
      </div>
    </div>
  `;
}

const PHASE_STATUS_LABEL = { completed: 'Concluída', current: 'Fase atual', upcoming: 'Próxima' };
const PHASE_STATUS_CLASS = { completed: 'badge-completed', current: 'badge-progress', upcoming: 'badge-locked' };

// The core of "focus on each client's journey": one collapsible block per
// phase (open by default only for her current one — click any other to
// see it), each showing that phase's real encounters (encounter_defs.phase
// — the exact same real column powering computeTeamNextStep/
// loadEncounterJourney) alongside its real activities/materials (the same
// state.phases loadProgramState already computes for the client's own
// Program Hub — never a second, admin-only grouping that could drift from
// what she sees).
function phaseBreakdownCard(state, journey) {
  if (!state.programDef) return '';
  return card(`
    <p class="text-sm text-white/50 mb-1">Fases do Programa</p>
    <p class="text-xs text-white/20 mb-4">Clique em uma fase para ver os encontros, atividades e materiais dela.</p>
    ${state.phases.map((phase) => `
      <details class="mb-1" ${phase.status === 'current' ? 'open' : ''}>
        <summary class="text-sm cursor-pointer py-2 flex items-center gap-3 flex-wrap" style="list-style:none;">
          <span class="font-medium">Fase ${phase.id + 1}</span>
          ${phase.description ? `<span class="text-xs text-white/30">${phase.description}</span>` : ''}
          <span class="badge ${PHASE_STATUS_CLASS[phase.status]}">${PHASE_STATUS_LABEL[phase.status]}</span>
        </summary>
        <div class="pl-1 pb-3">
          ${journey.filter((e) => e.phase === phase.id).length ? `
            <p class="text-xs uppercase mt-2 mb-1" style="color:var(--muted); letter-spacing:.08em;">Encontros</p>
            ${journey.filter((e) => e.phase === phase.id).map(encounterRow).join('')}
          ` : ''}
          ${phase.includedActivities.length ? `
            <p class="text-xs uppercase mt-3 mb-1" style="color:var(--muted); letter-spacing:.08em;">Atividades e Materiais</p>
            ${phase.includedActivities.map(phaseActivityRow).join('')}
          ` : '<p class="text-xs text-white/20 mt-2">Nenhuma atividade nesta fase.</p>'}
        </div>
      </details>
    `).join('')}
  `, 'mb-6');
}

// Financeiro — real E2E test found: a signed contract's payment obligations
// (contract_payment_lines, via the same loadActiveObligations already used
// by admin/financial.js and client/financial.js — never a second formula)
// had no operational payment/checkout attached to them anywhere staff could
// act on. This is that missing generation step, on the one workspace both
// admin and assistant already share for a real client. Reuses
// sumup-create-checkout (already real, already idempotent, already
// derives the amount/client server-side from the payment line itself —
// see that function's own header) and sumup-verify (the existing manual
// reconciliation path) — no new payment infrastructure.
const FIN_METHOD_LABEL = { pix: 'PIX', cartao_credito: 'Cartão de crédito' };

async function loadFinanceiro(contract) {
  if (!contract) return null;
  const [{ lines, error }, { data: payments }] = await Promise.all([
    loadActiveObligations({ contractId: contract.id }),
    supabase.from('payments').select('*').eq('client_id', clientId).order('created_at', { ascending: false }),
  ]);
  if (error) return { error };
  // Newest payment per line wins — payments already ordered newest-first,
  // so the first write for a given line is the current/most relevant one
  // (a terminal failed/expired one is superseded by whatever comes next).
  const paymentByLine = new Map();
  (payments || []).forEach((p) => {
    if (p.intended_payment_line_id && !paymentByLine.has(p.intended_payment_line_id)) paymentByLine.set(p.intended_payment_line_id, p);
  });
  return { lines: (lines || []).slice().sort((a, b) => new Date(a.due_date) - new Date(b.due_date)), paymentByLine };
}

function financeiroLineRow(line, payment) {
  const methodLabel = FIN_METHOD_LABEL[line.method] || line.method || 'A combinar';
  const isPaid = line.effective_status === 'paid';
  // A payment row's own status only ever drives the "link already
  // generated, here's how to share/check it" controls below — whether the
  // line itself is paid always comes from the ledger (effective_status,
  // i.e. payment_allocations against confirmed payments), never guessed
  // from a payment row alone.
  const activePayment = !isPaid && payment && payment.status === 'pending' && isValidHttpUrl(payment.sumup_link_url) ? payment : null;
  let actionHtml;
  if (isPaid) {
    actionHtml = `<span class="badge badge-completed">Pago${payment?.status === 'paid' && payment.paid_at ? ` em ${formatDate(payment.paid_at)}` : ''}</span>`;
  } else if (activePayment) {
    actionHtml = `
      <div class="flex items-center gap-2 flex-wrap justify-end">
        <span class="badge badge-progress">Link gerado</span>
        <a ${externalLinkAttrs(activePayment.sumup_link_url)} class="btn-ghost">Abrir link</a>
        <button type="button" data-copy-link="${activePayment.sumup_link_url}" class="btn-ghost">Copiar link</button>
        <button type="button" data-verify-payment="${activePayment.id}" class="btn-text">Verificar pagamento</button>
      </div>`;
  } else {
    actionHtml = `<button type="button" data-generate-checkout="${line.id}" class="btn-primary" style="padding:8px 16px;font-size:12px;">${line.method === 'pix' ? 'Gerar PIX' : 'Gerar link de pagamento'}</button>`;
  }
  return `
    <div class="py-4 border-b border-white/5 last:border-0">
      <div class="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p class="text-sm">${brl(line.amount_cents / 100)}${line.label ? ` · ${line.label}` : ''} · ${methodLabel}</p>
          <p class="text-xs text-white/30 mt-0.5">Vencimento ${formatDate(line.due_date)}${line.allocated_cents > 0 && !isPaid ? ` · ${brl(line.allocated_cents / 100)} já alocado` : ''}</p>
        </div>
        ${actionHtml}
      </div>
    </div>
  `;
}

function financeiroCard(finState) {
  if (!finState) return '';
  if (finState.error) return card('<p class="text-sm" style="color:var(--terracotta);">Não foi possível carregar o financeiro agora.</p>', 'mb-6');
  const { lines, paymentByLine } = finState;
  return card(`
    <p class="text-sm text-white/50 mb-1">Financeiro</p>
    ${lines.length ? lines.map((l) => financeiroLineRow(l, paymentByLine.get(l.id))).join('') : '<p class="text-sm mt-3" style="color:var(--muted);">Nenhuma parcela do plano de pagamento assinado ainda.</p>'}
  `, 'mb-6');
}

// Real gap found: markHublaAccessGranted (shared/hubla-model.js) has
// worked correctly this whole time from the assistant's Cadastros queue —
// but the moment a client activates and moves out of Cadastros into
// Clientes, there was nowhere left to grant it from at all. Same real
// function, no second implementation — just also reachable from her real
// workspace now, since a client can need this granted well after she's
// already active.
function hublaAccessCard(c) {
  const granted = c.hubla_access_status === 'granted';
  return card(`
    <div class="flex items-center justify-between flex-wrap gap-3">
      <div>
        <p class="text-sm text-white/50 mb-1">Acesso Hubla</p>
        <p class="text-xs" style="color:var(--muted);">${granted ? `Concedido${c.hubla_access_granted_at ? ` em ${formatDate(c.hubla_access_granted_at)}` : ''}.` : 'Ainda não concedido — Hubla não tem API de convite, então isso é feito manualmente pelo painel da Hubla.'}</p>
      </div>
      ${granted
        ? '<span class="badge badge-completed">Concedido</span>'
        : '<button type="button" id="mark-hubla-granted" class="btn-primary" style="padding:9px 18px;font-size:12.5px;">Marcar como concedido</button>'}
    </div>
  `, 'mb-6');
}

// Projeto de Imagem — the part of the program the assistant is actually
// responsible for (E3's own real purpose text names exactly these:
// Cartela de Cores, Guia de Produções, Ferramentas para Nova Imagem —
// encounter_defs, unchanged), plus Kit Digital and Ensaio Fotográfico.
// Real tables (image_guides free-form-by-slug + digital_kits, one row per
// client) already existed and already worked on the client's own side
// (client/images.js's renderDeliveredMaterials) — nothing here ever wrote
// to them in production. delivered_at is the exact same "client can see
// it" gate that page already reads; a DB trigger (not just this UI) now
// enforces that only admin can set/clear it — see the
// admin_only_notes_and_deliverable_approval migration — so "assistant
// prepares, admin approves" is a real boundary, not a hidden button.
const IMAGE_GUIDE_DEFS = [
  { slug: 'paleta_cores', label: 'Cartela de Cores' },
  { slug: 'guia_producoes_completo', label: 'Guia de Produções (Completo)' },
  { slug: 'guia_looks_mensal', label: 'Guia de Produções (Mensal)' },
  { slug: 'ferramentas_nova_imagem', label: 'Ferramentas para Nova Imagem' },
  { slug: 'moodboard_ensaio', label: 'Ensaio Fotográfico' },
];

async function loadImageProject() {
  const [{ data: guides }, { data: kit }] = await Promise.all([
    supabase.from('image_guides').select('*').eq('client_id', clientId),
    supabase.from('digital_kits').select('*').eq('client_id', clientId).maybeSingle(),
  ]);
  return { guideBySlug: Object.fromEntries((guides || []).map((g) => [g.slug, g])), kit: kit || null };
}

function deliverableStatus(row) {
  if (row?.delivered_at) return { label: 'Entregue', cls: 'badge-completed' };
  if (row?.file_url || row?.canva_url) return { label: 'Aguardando aprovação', cls: 'badge-progress' };
  return { label: 'Não iniciado', cls: 'badge-locked' };
}

function imageDeliverableRow({ key, label, row, isKit }) {
  const status = deliverableStatus(row);
  const hasContent = !!(row?.file_url || row?.canva_url);
  return `
    <div class="py-3 border-b border-white/5 last:border-0">
      <div class="flex items-center justify-between flex-wrap gap-2 mb-1">
        <p class="text-sm font-medium">${label}</p>
        <span class="badge ${status.cls}">${status.label}</span>
      </div>
      ${row?.summary ? `<p class="text-xs text-white/30 mb-2">${row.summary}</p>` : ''}
      <div class="flex items-center gap-2 flex-wrap">
        <button type="button" data-edit-deliverable="${key}" data-is-kit="${isKit ? '1' : '0'}" class="btn-ghost">Editar</button>
        ${isValidHttpUrl(row?.file_url) ? `<a ${externalLinkAttrs(row.file_url)} class="btn-text">Ver arquivo ↗</a>` : ''}
        ${isValidHttpUrl(row?.canva_url) ? `<a ${externalLinkAttrs(row.canva_url)} class="btn-text">Abrir no Canva ↗</a>` : ''}
        ${!isAssistant && hasContent && !row?.delivered_at ? `<button type="button" data-approve-deliverable="${key}" data-is-kit="${isKit ? '1' : '0'}" class="btn-primary" style="padding:6px 14px;font-size:12px;">Aprovar e Entregar</button>` : ''}
        ${!isAssistant && row?.delivered_at ? `<button type="button" data-revert-deliverable="${key}" data-is-kit="${isKit ? '1' : '0'}" class="btn-text" style="color:var(--terracotta);">Reverter entrega</button>` : ''}
      </div>
    </div>
  `;
}

function imageProjectCard({ guideBySlug, kit }) {
  return card(`
    <p class="text-sm text-white/50 mb-1">Projeto de Imagem</p>
    <p class="text-xs text-white/20 mb-4">${isAssistant ? 'Prepare cada material abaixo — a Nay revisa e aprova antes de a cliente ver.' : 'Revise e aprove cada material preparado pela assistente antes que a cliente veja.'}</p>
    ${IMAGE_GUIDE_DEFS.map((d) => imageDeliverableRow({ key: d.slug, label: d.label, row: guideBySlug[d.slug], isKit: false })).join('')}
    ${imageDeliverableRow({ key: 'kit_digital', label: 'Kit Digital', row: kit, isKit: true })}
  `, 'mb-6');
}

function openDeliverableModal({ key, label, row, isKit }) {
  const data = row || {};
  const { el, close } = openModal({
    title: `Editar — ${label}`,
    bodyHtml: `
      <form id="deliverable-form" class="space-y-4">
        <div>
          <label class="text-xs text-white/40 block mb-1">Resumo <span class="text-white/20">(opcional)</span></label>
          <textarea name="summary" rows="2" class="field text-sm">${data.summary || ''}</textarea>
        </div>
        <div>
          <label class="text-xs text-white/40 block mb-1">Link do Arquivo</label>
          <input name="file_url" class="field text-sm" value="${data.file_url || ''}" placeholder="https://..." />
        </div>
        <div>
          <label class="text-xs text-white/40 block mb-1">Link do Canva <span class="text-white/20">(opcional)</span></label>
          <input name="canva_url" class="field text-sm" value="${data.canva_url || ''}" placeholder="https://canva.com/..." />
        </div>
        ${!isKit ? `
        <div>
          <label class="text-xs text-white/40 block mb-1">Nota <span class="text-white/20">(opcional)</span></label>
          <textarea name="note" rows="2" class="field text-sm">${data.note || ''}</textarea>
        </div>
        ` : ''}
        <div class="flex justify-end pt-2">
          <button type="submit" class="btn-primary" style="padding:9px 18px;font-size:12.5px;">Salvar</button>
        </div>
      </form>
    `,
  });
  el.querySelector('#deliverable-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const payload = { summary: fd.get('summary') || null, file_url: fd.get('file_url') || null, canva_url: fd.get('canva_url') || null };
    let error;
    if (isKit) {
      ({ error } = await supabase.from('digital_kits').upsert({ client_id: clientId, ...payload }, { onConflict: 'client_id' }));
    } else {
      payload.note = fd.get('note') || null;
      ({ error } = await supabase.from('image_guides').upsert({ client_id: clientId, slug: key, ...payload }, { onConflict: 'client_id,slug' }));
    }
    if (error) { toast('Não foi possível salvar agora — se você é assistente, lembre-se que só a Nay pode aprovar/entregar.', { tone: 'error' }); return; }
    close();
    toast('Material atualizado.');
    render();
  });
}

async function setDeliveryStatus({ key, isKit, delivered }) {
  const table = isKit ? 'digital_kits' : 'image_guides';
  let q = supabase.from(table).update({ delivered_at: delivered ? new Date().toISOString() : null }).eq('client_id', clientId);
  if (!isKit) q = q.eq('slug', key);
  return (await q).error;
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

function tabBarHtml() {
  return `
    <div class="flex gap-1 mb-8 border-b border-white/10 overflow-x-auto">
      ${TABS.map(([key, label]) => `<button type="button" data-tab="${key}" class="tab-btn ${activeTab === key ? 'active' : ''}">${label}</button>`).join('')}
    </div>
  `;
}

async function render() {
  const { client, partyInfo, contract, latestToken, tokenActive } = await loadAll();
  if (!client) { content.innerHTML = card('<p class="text-sm" style="color:var(--terracotta);">Cliente não encontrada.</p>'); return; }

  const [surveyState, brandState, valueAssessment, archetypeState, playbookState, state, finState, internalProfile, journey, imageProject] = await Promise.all([
    loadBusinessSurvey(),
    loadBrandDirection(),
    !isAssistant ? loadValueAssessment(clientId) : Promise.resolve(null),
    loadArchetypeState(),
    loadPlaybookState(),
    loadProgramState(clientId, client),
    loadFinanceiro(contract),
    !isAssistant ? loadInternalProfile() : Promise.resolve(null),
    loadEncounterJourney(client, clientId),
    loadImageProject(),
  ]);
  const programSummaryHtml = await programSummaryCard(client, state);

  const status = deriveClientStatus({
    accessStatus: client.access_status,
    partyInfoSubmitted: !!partyInfo?.submitted,
    contractStatus: contract?.status || null,
  });

  // Only the profile (photo + WHO/WHAT/WHY/HOW + private notes) stays
  // permanently visible — everything else moved into the sub-tabs below,
  // per explicit feedback: the top of this page should show just the
  // client, not a long scroll of every pipeline/program card at once.
  const TAB_CONTENT = {
    jornada: `
      ${nextActionCard(status.nextAction)}
      ${programSummaryHtml}
      ${phaseBreakdownCard(state, journey)}
    `,
    financeiro: `
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
      ${financeiroCard(finState)}
      ${hublaAccessCard(client)}
    `,
    'direcao-marca': brandDirectionCard(brandState),
    'projeto-imagem': imageProjectCard(imageProject),
    // Merged per explicit feedback — Precificação (business survey) and
    // Valor (admin-only) are the same commercial-context conversation with
    // the client, so they live together instead of competing for a tab
    // each. valueAnalysisCard is '' for assistant (no RLS policy grants
    // her that data at all — see this file's own header comment) rather
    // than hidden by omission.
    pesquisa: `${businessSurveyCard(surveyState)}${!isAssistant ? valueAnalysisCard(valueAssessment) : ''}`,
    arquetipos: archetypeCard(archetypeState),
    playbook: playbookCard(playbookState),
  };

  content.innerHTML = `
    <a href="${isAssistant ? 'clients.html' : 'crm.html'}" class="btn-text mb-4 inline-block">&larr; ${isAssistant ? 'Clientes' : 'Todos os clientes'}</a>
    ${profileHeaderCard(client, status)}
    ${!isAssistant ? profileSummaryCard(client, internalProfile) : ''}
    ${!isAssistant ? internalNotesCard(internalProfile) : ''}

    ${tabBarHtml()}
    <div id="tab-content">${TAB_CONTENT[activeTab] || ''}</div>

    ${dangerZoneCard()}
  `;

  content.querySelectorAll('[data-tab]').forEach((btn) => {
    btn.addEventListener('click', () => { activeTab = btn.dataset.tab; render(); });
  });

  content.querySelector('#generate-link')?.addEventListener('click', generateLink);
  content.querySelector('#regenerate-link')?.addEventListener('click', generateLink);
  content.querySelector('#prepare-contract')?.addEventListener('click', (e) => prepareContract(client, e.target));
  content.querySelector('#send-invite')?.addEventListener('click', sendInvite);
  content.querySelector('#mark-hubla-granted')?.addEventListener('click', async (e) => {
    e.target.disabled = true;
    const { error } = await markHublaAccessGranted(clientId);
    if (error) { toast('Não foi possível marcar agora.', { tone: 'error' }); e.target.disabled = false; return; }
    toast('Acesso Hubla marcado como concedido.');
    render();
  });
  content.querySelectorAll('[data-edit-deliverable]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.editDeliverable;
      const isKit = btn.dataset.isKit === '1';
      const def = IMAGE_GUIDE_DEFS.find((d) => d.slug === key);
      openDeliverableModal({ key, label: isKit ? 'Kit Digital' : def.label, row: isKit ? imageProject.kit : imageProject.guideBySlug[key], isKit });
    });
  });
  content.querySelectorAll('[data-approve-deliverable]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const error = await setDeliveryStatus({ key: btn.dataset.approveDeliverable, isKit: btn.dataset.isKit === '1', delivered: true });
      if (error) { toast('Não foi possível aprovar agora.', { tone: 'error' }); return; }
      toast('Material aprovado e entregue.');
      render();
    });
  });
  content.querySelectorAll('[data-revert-deliverable]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const error = await setDeliveryStatus({ key: btn.dataset.revertDeliverable, isKit: btn.dataset.isKit === '1', delivered: false });
      if (error) { toast('Não foi possível reverter agora.', { tone: 'error' }); return; }
      toast('Entrega revertida.');
      render();
    });
  });
  content.querySelector('#photo-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const url = new FormData(e.target).get('photo_url').trim();
    const { error } = await supabase.from('clients').update({ photo_url: url || null }).eq('id', clientId);
    if (error) { toast('Não foi possível salvar a foto.', { tone: 'error' }); return; }
    toast('Foto atualizada.');
    render();
  });
  content.querySelector('#internal-notes-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const note = new FormData(e.target).get('note');
    const error = await saveInternalProfile({ note });
    if (error) { toast('Não foi possível salvar as notas.', { tone: 'error' }); return; }
    toast('Notas internas salvas.');
  });
  content.querySelector('#summary-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const error = await saveInternalProfile({ who: fd.get('who'), what: fd.get('what'), why: fd.get('why'), how: fd.get('how') });
    if (error) { toast('Não foi possível salvar o resumo.', { tone: 'error' }); return; }
    toast('Resumo salvo.');
  });
  content.querySelector('#delete-client')?.addEventListener('click', () => openDeleteClientModal(client));
  content.querySelector('#bd-form')?.addEventListener('submit', saveBrandDirection);
  content.querySelector('#value-publish-form')?.addEventListener('submit', (e) => publishValueDeliverable(e, valueAssessment.id));
  content.querySelector('#create-draft')?.addEventListener('click', createPlaybookDraft);
  content.querySelectorAll('[data-generate-checkout]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const original = btn.textContent;
      btn.disabled = true; btn.textContent = 'Gerando…';
      const { data, error } = await supabase.functions.invoke('sumup-create-checkout', {
        body: { payment_line_id: btn.dataset.generateCheckout, use_outstanding_balance: true },
      });
      if (error || data?.error) { toast(await functionErrorMessage(data, error), { tone: 'error' }); btn.disabled = false; btn.textContent = original; return; }
      toast(data.mock ? 'Link gerado (ambiente de teste — cliente demo).' : data.reused ? 'Já existia um link ativo para esta parcela — reaproveitado.' : 'Link de pagamento gerado.');
      render();
    });
  });
  content.querySelectorAll('[data-copy-link]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(btn.dataset.copyLink); toast('Link copiado.'); }
      catch { toast('Não foi possível copiar automaticamente. Selecione o link manualmente.', { tone: 'error' }); }
    });
  });
  content.querySelectorAll('[data-verify-payment]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const original = btn.textContent;
      btn.disabled = true; btn.textContent = 'Verificando…';
      const { data, error } = await supabase.functions.invoke('sumup-verify', { body: { payment_id: btn.dataset.verifyPayment } });
      if (error || data?.error) { toast(await functionErrorMessage(data, error), { tone: 'error' }); btn.disabled = false; btn.textContent = original; return; }
      toast(data.status === 'paid' ? 'Pagamento confirmado — obrigado!' : `Ainda não confirmado (status: ${data.status}).`);
      render();
    });
  });
  if (playbookState.active && playbookState.active.status === 'draft') {
    content.querySelectorAll('#playbook-form textarea').forEach((textarea) => {
      textarea.addEventListener('blur', () => saveSectionField(playbookState.active.id, textarea.name, textarea));
    });
    content.querySelector('#publish-draft')?.addEventListener('click', () => publishPlaybookDraft(playbookState.active.id, playbookState.active.version));
  }
}

render();
