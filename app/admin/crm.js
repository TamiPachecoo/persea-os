// CRM — Clientes and Leads merged under one tab (previously two separate
// nav items). Two sub-views, switched with plain pill buttons (same
// pattern as client-detail.js's TABS): Clientes, grouped by program so a
// program's roster reads as its own section instead of one flat list; and
// Leads, kept together as a single container — everything that used to
// live on the standalone Leads page (KPIs, onboarding pipeline, pipeline
// list, Grupo VIP dynamics) still does, just inside this one section.
import {
  MockDB, PROGRAM_DEFS, TIER_PHASES, ONBOARDING_STAGE_LABEL,
  LEAD_STAGES, LEAD_STAGE_LABEL, LEAD_SOURCES, LEAD_SOURCE_LABEL, VIP_GROUP_STATUSES, VIP_GROUP_STATUS_LABEL,
  PROGRAMS, PROGRAM_LABEL, SOCIAL_PLATFORMS, SOCIAL_PLATFORM_LABEL, PROGRAM_LABEL_BY_SLUG, LEAD_ONBOARDING_STATUS_BADGE_CLASS,
} from '../shared/mock-db.js';
import { renderShell, card, statusBadge, toast, formatDate, openModal, buildRegistrationLink, isProductionEnvironment, phaseChip, phaseColor, confirmEmailTypo } from '../shared/ui.js';
import { requireProfile } from '../shared/supabase-auth.js';
import { supabase } from '../shared/supabase-client.js';
import { deriveClientStatus, NEXT_ACTION_LABEL } from '../shared/client-status.js';
import { computeTeamNextStep } from '../shared/team-action-model.js';

// Production Migration Batch 4: app.naymurta.com never shows MockDB
// clients/leads. Real client creation + registration-link generation
// (below) is the only piece of this page converted this batch — the
// Leads/VIP-pipeline half stays MockDB-only and is simply not shown in
// production yet (an honest gap, not faked data), since that conversion
// wasn't in scope for this pass.
// Real gap found live, twice now: a client accidentally left checked
// "Cliente de demonstração" (the checkbox on her contract page) simply
// vanished from this entire list — the checkbox gives no warning that
// this is what it does, and the consequence (total invisibility, not a
// label) reads exactly like a bug. Demo clients are still fetched and
// shown here now, just tagged — see productionClientRow's badge below —
// so a mistaken toggle is visible and correctable instead of silently
// hiding someone. Financial rollups/reports still exclude them from real
// numbers (that exclusion lives separately in shared/financial-model.js
// and shared/hubla-model.js, untouched by this — this is only about
// whether she's visible here, not whether she counts as real revenue).
async function loadRealClients() {
  const { data: clients } = await supabase.from('clients').select('*').order('created_at', { ascending: false });
  const rows = clients || [];
  const ids = rows.map((c) => c.id);
  const [{ data: partyInfos }, { data: contracts }] = await Promise.all([
    ids.length ? supabase.from('party_info').select('client_id, submitted').in('client_id', ids) : Promise.resolve({ data: [] }),
    ids.length ? supabase.from('contracts').select('client_id, status, created_at').in('client_id', ids).order('created_at', { ascending: false }) : Promise.resolve({ data: [] }),
  ]);
  const partyByClient = new Map((partyInfos || []).map((p) => [p.client_id, p.submitted]));
  const contractByClient = new Map(); // first write per client wins — contracts already ordered newest-first
  (contracts || []).forEach((c) => { if (!contractByClient.has(c.client_id)) contractByClient.set(c.client_id, c.status); });
  const withStatus = rows.map((c) => ({
    ...c,
    _status: deriveClientStatus({ accessStatus: c.access_status, partyInfoSubmitted: !!partyByClient.get(c.id), contractStatus: contractByClient.get(c.id) }),
  }));
  // Real gap found: deriveClientStatus deliberately stops at "Ativa" (see
  // its own comment — everything past activation is program work, not
  // onboarding pipeline), which meant an active client's row here showed
  // literally nothing beyond that badge — no phase, no progress, no
  // indication of what the team should do next. computeTeamNextStep
  // (shared/team-action-model.js, also used by client-onboarding.js's own
  // fuller card — one definition, not two) fills exactly that gap, for
  // active clients only (a still-onboarding client has no program state
  // to compute this from yet).
  await Promise.all(withStatus.filter((c) => c._status.label === 'Ativa').map(async (c) => {
    c._teamNextStep = await computeTeamNextStep(c, c.id);
  }));
  // Engagement (last login, her own actions, meetings) — client_engagement()
  // is staff-only; if it fails the list still shows, just without it.
  const { data: eng } = await supabase.rpc('client_engagement');
  const engById = new Map((eng || []).map((e) => [e.client_id, e]));
  withStatus.forEach((c) => { c._eng = engagementOf(engById.get(c.id)); });
  return withStatus;
}

// "Interação" = the latest of her last login and her last own action.
// Engajada: up to 7 days · Atenção: 8–21 days · Sem resposta: more than 21
// days or never. Only meaningful once she is active on the platform.
const DAY = 86400000;
const ENG_LEVELS = {
  engajada: { label: 'Engajada', color: '#8fae8b' },
  atencao: { label: 'Atenção', color: '#d1a04f' },
  sem_resposta: { label: 'Sem resposta', color: '#c4785c' },
};
function engagementOf(e) {
  const times = [e?.last_login, e?.last_action].filter(Boolean).map((t) => new Date(t).getTime());
  const last = times.length ? Math.max(...times) : null;
  const days = last == null ? null : Math.floor((Date.now() - last) / DAY);
  const level = days == null || days > 21 ? 'sem_resposta' : days > 7 ? 'atencao' : 'engajada';
  return { ...(e || {}), lastInteraction: last, days, level, actions30: e?.actions_30d || 0 };
}
const daysText = (d) => (d == null ? 'nunca interagiu' : d === 0 ? 'interagiu hoje' : d === 1 ? 'há 1 dia' : `há ${d} dias`);
const shortDate = (t) => new Date(t).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
function engagementLine(c) {
  const e = c._eng;
  if (!e || c._status.label !== 'Ativa') return '';
  const lv = ENG_LEVELS[e.level];
  const bits = [
    `<span style="color:${lv.color};">● ${lv.label}</span>`,
    `última interação ${daysText(e.days)}`,
    `${e.actions30} ${e.actions30 === 1 ? 'ação' : 'ações'} em 30 dias`,
    e.next_meeting ? `próximo encontro ${shortDate(e.next_meeting)}` : (e.last_meeting ? `último encontro ${shortDate(e.last_meeting)}` : 'sem encontros ainda'),
  ];
  return `<p class="text-xs text-white/40 mt-0.5">${bits.join(' · ')}</p>`;
}

// Top of Clientes: how engaged the active clients are, and how long since
// each one last interacted (sorted: who needs a nudge first).
function engagementPanel(clients) {
  const active = clients.filter((c) => c._status.label === 'Ativa' && !c.is_demo && c._eng);
  if (!active.length) return '';
  const counts = Object.fromEntries(Object.keys(ENG_LEVELS).map((k) => [k, active.filter((c) => c._eng.level === k).length]));
  const bar = Object.keys(ENG_LEVELS).filter((k) => counts[k]).map((k) => `<div title="${ENG_LEVELS[k].label}: ${counts[k]}" style="flex:${counts[k]};background:${ENG_LEVELS[k].color};height:10px;"></div>`).join('');
  const sorted = [...active].sort((a, b) => (b._eng.days ?? 9999) - (a._eng.days ?? 9999));
  const max = Math.max(1, ...sorted.map((c) => c._eng.days ?? 0), 30);
  const rows = sorted.map((c) => {
    const d = c._eng.days;
    const w = d == null ? 100 : Math.max(2, Math.round((d / max) * 100));
    return `<a href="client-onboarding.html?id=${c.id}" class="block hover:bg-white/5 -mx-2 px-2 py-1 rounded" title="${c.full_name}: ${daysText(d)}">
      <div class="flex items-baseline justify-between gap-3 text-sm"><span class="truncate">${c.full_name}</span><span class="text-xs shrink-0" style="color:${ENG_LEVELS[c._eng.level].color};">${d == null ? 'nunca' : `${d} ${d === 1 ? 'dia' : 'dias'}`}</span></div>
      <div style="height:4px;border-radius:4px;background:var(--line);margin-top:4px;"><div style="height:4px;border-radius:4px;width:${w}%;background:${ENG_LEVELS[c._eng.level].color};opacity:${d == null ? 0.45 : 0.9};"></div></div>
    </a>`;
  }).join('');
  return card(`
    <div class="flex items-baseline justify-between flex-wrap gap-2 mb-3">
      <p class="text-sm text-white/50">Engajamento das clientes ativas</p>
      <p class="text-xs text-white/30">Interação = acesso à plataforma ou ação dela (fotos, tarefas, questionários, pedidos de encontro)</p>
    </div>
    <div class="grid grid-cols-3 gap-4 mb-3">
      ${Object.entries(ENG_LEVELS).map(([k, v]) => `<div><p class="text-2xl font-serif" style="color:${v.color};">${counts[k]}</p><p class="text-xs text-white/40">${v.label} <span class="text-white/20">${k === 'engajada' ? '(até 7 dias)' : k === 'atencao' ? '(8 a 21 dias)' : '(mais de 21 dias)'}</span></p></div>`).join('')}
    </div>
    <div class="flex rounded overflow-hidden mb-5" style="gap:2px;">${bar}</div>
    <p class="text-xs text-white/40 mb-2">Dias desde a última interação</p>
    <div class="space-y-1">${rows}</div>
  `, 'mb-6');
}

// Clients grouped by where they are: onboarding first, then Fase 1, 2, 3…
function clientsByPhase(clients) {
  const onboarding = clients.filter((c) => c._status.label !== 'Ativa');
  const active = clients.filter((c) => c._status.label === 'Ativa');
  const phases = [...new Set(active.map((c) => c.phase_index ?? 0))].sort((a, b) => a - b);
  const group = (title, chip, list, note = '') => card(`
    <div class="flex items-center justify-between flex-wrap gap-2 mb-2">
      <div class="flex items-center gap-2">${chip}<p class="text-sm text-white/60">${title}</p></div>
      <span class="text-xs text-white/30">${list.length} cliente${list.length === 1 ? '' : 's'}</span>
    </div>
    ${note ? `<p class="text-xs text-white/20 mb-2">${note}</p>` : ''}
    <div class="divide-y" style="border-color:var(--line);">${list.map(productionClientRow).join('')}</div>
  `, 'mb-4');
  return [
    ...phases.map((ph) => group('', phaseChip(ph), active.filter((c) => (c.phase_index ?? 0) === ph).sort((a, b) => (b._eng?.days ?? 9999) - (a._eng?.days ?? 9999)))),
    onboarding.length ? group('Em onboarding', '', onboarding, 'Cadastro, contrato ou convite ainda em andamento.') : '',
  ].join('');
}

function productionClientRow(c) {
  const isPersea = c.program_slug?.startsWith('persea') ?? true;
  const tierLabel = isPersea ? (c.tier === 'premium' ? 'Premium' : 'Essential') : null;
  const nextActionLabel = c._status.nextAction ? NEXT_ACTION_LABEL[c._status.nextAction] : null;
  return `
    <a href="client-onboarding.html?id=${c.id}" class="flex items-center justify-between py-3 hover:bg-white/5 -mx-2 px-2 rounded-lg transition-colors flex-wrap gap-2" style="${c.phase_index != null && c._teamNextStep ? `border-left:3px solid ${phaseColor(c.phase_index)};padding-left:12px;` : ''}">
      <div class="min-w-0">
        <div class="flex items-center gap-2 flex-wrap">
          <p class="font-medium">${c.full_name}</p>
          ${c.is_demo ? '<span class="badge" style="background:rgba(196,90,60,.15); color:var(--terracotta); border-color:var(--terracotta);">Demo</span>' : ''}
        </div>
        <p class="text-xs text-white/30">${c.email || 'sem e-mail'}${tierLabel ? ` · ${tierLabel}` : ''}</p>
        ${engagementLine(c)}
        ${c._teamNextStep ? `<p class="text-xs mt-0.5 break-words" style="color:var(--gold);">→ ${c._teamNextStep.label}</p>` : ''}
      </div>
      <!-- Real gap found live on mobile: this block itself never wrapped
           its own two children (label + badge), only the outer row did.
           A long combination — e.g. "Preparar contrato →" next to
           "Cadastro Recebido — Contrato Pendente" — had nowhere to go but
           to overflow off the right edge of the row (measured: this div's
           own right edge landed past the viewport width), rendering as a
           clipped, garbled mess that looked like the row wasn't really
           there. flex-wrap here lets the label drop below the badge
           instead of running off-screen. -->
      <div class="flex items-center gap-3 flex-wrap" style="max-width:100%;">
        ${nextActionLabel ? `<span class="text-xs" style="color:var(--gold);">${nextActionLabel} →</span>` : ''}
        <span class="badge ${c._status.badgeClass}">${c._status.label}</span>
      </div>
    </a>
  `;
}

function openRegistrationLinkModal(url) {
  const { el } = openModal({
    title: 'Cliente criada',
    bodyHtml: `
      <p class="text-sm text-white/50 mb-4">Envie este link para a cliente concluir o cadastro. Ele expira em 7 dias e só pode ser usado uma vez.</p>
      <div class="flex items-center gap-2">
        <input id="reg-link-field" class="field text-sm" readonly value="${url}" />
        <button type="button" id="copy-reg-link" class="btn-ghost shrink-0">Copiar</button>
      </div>
    `,
  });
  el.querySelector('#copy-reg-link').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(url); toast('Link copiado.'); } catch { toast('Não foi possível copiar.', { tone: 'error' }); }
  });
}

// fromLead: the real `leads` row this client is being created from, when
// reached via "Converter em Cliente" (or picking "Convertido" straight
// from the stage dropdown — see the leads-tab wiring below) — pre-fills
// her name/email (already on file, no re-typing) and, once the client is
// created for real, marks the lead itself as converted (stage +
// converted_to_client_id/converted_at, both real columns on `leads`
// already there for exactly this) so it drops out of the working pipeline
// instead of sitting there looking unconverted forever. undefined for the
// plain "+ Novo Cliente" button, which has no lead to link back to.
//
// onCancel: real gap found live — picking "Convertido" in the stage
// dropdown used to just save that word on the lead and stop there, with
// no client ever created; a lead marked "Convertido" but not actually in
// Clientes read as a bug (which it effectively was). Now that pick opens
// this same modal instead of silently saving the stage, and onCancel
// reverts the dropdown back to her real stage if the modal is dismissed
// without actually creating the client, so the dropdown never shows
// "Convertido" for a lead that isn't.
function openCreateClientModal(fromLead, { onCancel } = {}) {
  let converted = false;
  const { el, close } = openModal({
    title: 'Novo Cliente',
    onClose: () => { if (!converted) onCancel?.(); },
    bodyHtml: `
      <form id="create-client-form" class="space-y-4">
        <div>
          <label class="text-xs text-white/40 block mb-1">Nome Completo</label>
          <input name="full_name" class="field" required value="${fromLead?.full_name || ''}" />
        </div>
        <div class="grid sm:grid-cols-2 gap-4">
          <div>
            <label class="text-xs text-white/40 block mb-1">Email (opcional)</label>
            <input name="email" type="email" class="field" value="${fromLead?.email || ''}" />
          </div>
          <div>
            <label class="text-xs text-white/40 block mb-1">Programa</label>
            <select name="program_choice" class="field">
              <option value="essential">Persea Essential</option>
              <option value="premium">Persea Premium</option>
              <option value="ascensao_marca">Ascensão da Marca</option>
            </select>
          </div>
        </div>
        <div class="flex justify-end pt-2">
          <button type="submit" class="btn-primary" style="padding:9px 18px;font-size:12.5px;">Criar Cliente</button>
        </div>
      </form>
    `,
  });
  el.querySelector('#create-client-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    // Bug fix: a double-click here (no visual feedback while the request
    // is in flight) previously fired this handler twice, creating two real
    // clients + two valid tokens from a single "Criar Cliente" action — an
    // admin could easily copy/open the wrong one. The submit button is now
    // disabled for the duration of the request, and a second submit event
    // arriving before it resolves is ignored outright.
    const submitBtn = e.target.querySelector('button[type="submit"]');
    if (submitBtn.disabled) return;
    submitBtn.disabled = true;
    const originalLabel = submitBtn.textContent;
    submitBtn.textContent = 'Criando…';
    const fd = new FormData(e.target);
    // Ascensão da Marca is a genuinely separate program, not a Persea
    // tier — 'tier' stays a required, essential/premium-only column
    // technicality (see clients_tier_check), but program_slug is what
    // actually drives her real experience (Program Hub, Conteúdos —
    // see program-model.js/content.js), so it's sent explicitly here
    // rather than left to create-client-registration's persea-only default.
    const programChoice = fd.get('program_choice');
    const isAscensao = programChoice === 'ascensao_marca';
    try {
      const { data, error } = await supabase.functions.invoke('create-client-registration', {
        body: {
          full_name: fd.get('full_name'), email: fd.get('email') ? confirmEmailTypo(fd.get('email')) : null,
          tier: isAscensao ? 'essential' : programChoice,
          program_slug: isAscensao ? 'ascensao-marca' : undefined,
        },
      });
      if (error || data?.error) { toast(data?.error || 'Não foi possível criar a cliente agora.', { tone: 'error' }); return; }
      if (fromLead) {
        await supabase.from('leads').update({
          stage: 'convertido', converted_to_client_id: data.client_id || null, converted_at: new Date().toISOString(),
        }).eq('id', fromLead.id);
      }
      converted = true;
      close();
      openRegistrationLinkModal(data.registration_url);
      renderProductionCRM();
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = originalLabel;
    }
  });
}

// Real gap found live: naymurta.com's homepage form (landing-lead-capture
// Edge Function) writes real rows into `leads`, but this production path
// only ever rendered Clientes — Leads had no tab at all here (the mock
// `render()`/`renderLeadsSection()` further down, MockDB-based, is what
// non-production sees; app.naymurta.com never ran it). A real website
// contact had nowhere to show up. This is a first real-data pass at that
// tab, not a full migration of the Nova Persea lead pipeline (Condições
// Comerciais → Cadastro → Contrato still lives on MockDB leads in
// lead-detail.js/lead-bridge.js) — deliberately scoped to what's needed
// so a real lead is actually visible and actionable: see it, reach her
// on WhatsApp/e-mail, move her stage forward.
async function loadRealLeads() {
  const [{ data }, { data: notes }] = await Promise.all([
    supabase.from('leads').select('*').order('created_at', { ascending: false }),
    supabase.from('lead_interactions').select('*').order('occurred_at', { ascending: false }),
  ]);
  // Anotações (meetings, calls, follow-ups) — newest first, per lead.
  const byLead = new Map();
  (notes || []).forEach((n) => { if (!byLead.has(n.lead_id)) byLead.set(n.lead_id, []); byLead.get(n.lead_id).push(n); });
  return (data || []).map((l) => ({ ...l, _notes: byLead.get(l.id) || [] }));
}

const todayISO = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
function leadNotesBlock(l) {
  const notes = l._notes || [];
  const item = (n) => `
    <div class="py-1.5 flex items-start justify-between gap-2">
      <p class="text-sm" style="white-space:pre-line;"><span class="text-xs text-white/30 mr-2">${formatDate(n.occurred_at)}</span>${escL(n.summary)}</p>
      <button type="button" data-delete-note="${n.id}" class="btn-text shrink-0" style="font-size:11px;color:var(--terracotta);">Apagar</button>
    </div>`;
  return `
    <details class="mt-2" ${notes.length ? '' : ''}>
      <summary class="text-xs" style="color:var(--gold);cursor:pointer;">Anotações${notes.length ? ` (${notes.length})` : ''}${notes[0] ? ` · última em ${formatDate(notes[0].occurred_at)}` : ''}</summary>
      <div class="mt-2 pl-3" style="border-left:1px solid var(--line);">
        ${notes.map(item).join('')}
        <form data-note-form="${l.id}" class="mt-2 space-y-2">
          <textarea name="summary" rows="2" class="field text-sm" placeholder="Ex.: reunião hoje — quer começar em janeiro, pediu proposta do Essencial"></textarea>
          <div class="flex items-center gap-2 flex-wrap">
            <input type="date" name="occurred_at" class="field text-sm" style="width:auto;" value="${todayISO()}" max="${todayISO()}" />
            <button type="submit" class="btn-ghost" style="padding:6px 12px;font-size:11px;">Salvar anotação</button>
          </div>
        </form>
      </div>
    </details>`;
}

// "+ Novo lead": someone Nay met or who reached her outside the site forms.
function openNewLeadModal() {
  const { el, close } = openModal({
    title: 'Novo lead',
    bodyHtml: `
      <form id="new-lead-form" class="space-y-3">
        <div><label class="text-xs text-white/40 block mb-1">Nome *</label><input name="full_name" class="field" required /></div>
        <div class="grid gap-3" style="grid-template-columns:repeat(auto-fit,minmax(160px,1fr));">
          <div><label class="text-xs text-white/40 block mb-1">WhatsApp</label><input name="phone" type="tel" class="field" placeholder="(31) 99999-9999" /></div>
          <div><label class="text-xs text-white/40 block mb-1">E-mail</label><input name="email" type="email" class="field" /></div>
          <div><label class="text-xs text-white/40 block mb-1">Instagram</label><input name="instagram" class="field" placeholder="@perfil" /></div>
          <div><label class="text-xs text-white/40 block mb-1">Origem</label><select name="source" class="field">${LEAD_SOURCES.map((s) => `<option value="${s}" ${s === 'referral' ? 'selected' : ''}>${LEAD_SOURCE_LABEL[s]}</option>`).join('')}</select></div>
          <div><label class="text-xs text-white/40 block mb-1">Estágio</label><select name="stage" class="field">${LEAD_STAGES.filter((s) => s !== 'convertido').map((s) => `<option value="${s}">${LEAD_STAGE_LABEL[s]}</option>`).join('')}</select></div>
        </div>
        <div><label class="text-xs text-white/40 block mb-1">Primeira anotação <span class="text-white/20">(opcional)</span></label><textarea name="note" rows="3" class="field text-sm" placeholder="Como chegou, o que conversaram, próximo passo"></textarea></div>
        <div class="flex justify-end gap-2 pt-1">
          <button type="button" id="cancel-new-lead" class="btn-text">Cancelar</button>
          <button type="submit" class="btn-primary" style="padding:9px 18px;font-size:12.5px;">Salvar lead</button>
        </div>
      </form>`,
  });
  el.querySelector('#cancel-new-lead').addEventListener('click', close);
  el.querySelector('#new-lead-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const fullName = String(fd.get('full_name') || '').trim();
    if (fullName.length < 2) { toast('Escreva o nome.', { tone: 'error' }); return; }
    const btn = e.target.querySelector('[type=submit]'); btn.disabled = true; btn.textContent = 'Salvando…';
    const clean = (k) => String(fd.get(k) || '').trim() || null;
    const { data: lead, error } = await supabase.from('leads').insert({
      full_name: fullName, phone: clean('phone'), email: clean('email'),
      instagram: (clean('instagram') || '').replace(/^@+/, '') || null,
      source: fd.get('source'), stage: fd.get('stage'), vip_group_status: 'not_in_group',
    }).select('id').single();
    if (error) { toast(error.message, { tone: 'error' }); btn.disabled = false; btn.textContent = 'Salvar lead'; return; }
    const note = clean('note');
    if (note) await supabase.from('lead_interactions').insert({ lead_id: lead.id, occurred_at: new Date().toISOString(), summary: note });
    close();
    toast('Lead adicionado.');
    renderProductionCRM();
  });
}

// Answers from naymurta.com/aplicacao (mentoria-application → leads.application).
function applicationBlock(l) {
  const a = l.application;
  if (!a) return '';
  const esc = (v) => String(v ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const item = (label, value) => value ? `<div><p class="text-xs text-white/30">${label}</p><p class="text-sm">${value}</p></div>` : '';
  return `
    <details class="mt-2">
      <summary class="text-xs cursor-pointer" style="color:var(--gold);">Aplicação da mentoria · ${formatDate(l.application_submitted_at)} · ${esc(a.priority)} · ${esc(a.revenue)}</summary>
      <div class="grid sm:grid-cols-2 gap-3 mt-3 p-3 rounded" style="background:rgba(255,255,255,.03);border:1px solid var(--line);">
        ${item('Instagram / LinkedIn', esc(l.instagram))}
        ${item('Idade', esc(a.age))}
        ${item('Hoje ela é', esc(a.role))}
        ${item('Universo', esc(a.field === 'Outro' && a.field_other ? a.field_other : a.field))}
        ${item('Faturamento mensal', esc(a.revenue))}
        ${item('Imagem x nível (0–10)', esc(a.thermometer))}
        ${item('Quer comemorar em 12 meses', esc(a.goal))}
        ${item('O que mais trava', esc((a.blocks || []).join(' · ')))}
        ${item('Quer que pensem', esc(a.phrase ? `“${a.phrase}”` : ''))}
        ${item('Investir agora é', esc(a.priority))}
        ${a.question ? `<div class="sm:col-span-2"><p class="text-xs text-white/30">Pergunta para a Nay</p><p class="text-sm">“${esc(a.question)}”</p></div>` : ''}
      </div>
    </details>`;
}

const escL = (v) => String(v ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function realLeadRow(l) {
  const waHref = l.phone ? `https://wa.me/55${l.phone.replace(/\D/g, '')}` : null;
  return `
    <div class="flex items-start justify-between py-3 gap-3 flex-wrap">
      <div class="min-w-0" style="flex:1 1 220px;">
        <p class="font-medium break-words">${l.full_name || '(sem nome)'}</p>
        <p class="text-xs text-white/30 break-words">${l.email || 'sem e-mail'} · ${l.phone || 'sem telefone'}</p>
        ${l.instagram ? `<p class="text-xs mt-0.5"><a href="https://instagram.com/${encodeURIComponent(l.instagram.replace(/^@+/, ''))}" target="_blank" rel="noopener" style="color:var(--gold);">@${escL(l.instagram.replace(/^@+/, ''))}</a></p>` : ''}
        <p class="text-xs text-white/20 mt-1">${LEAD_SOURCE_LABEL[l.source] || l.source} · recebido ${formatDate(l.created_at)}</p>
        ${l.notes ? `<p class="text-xs text-white/40 mt-1" style="white-space:pre-line;">${escL(l.notes)}</p>` : ''}
        ${applicationBlock(l)}
        ${leadNotesBlock(l)}
      </div>
      <div class="flex items-center gap-2 flex-wrap shrink-0">
        ${waHref ? `<a href="${waHref}" target="_blank" rel="noopener" class="btn-ghost" style="padding:6px 12px;font-size:11px;">WhatsApp</a>` : ''}
        ${l.email ? `<a href="mailto:${l.email}" class="btn-ghost" style="padding:6px 12px;font-size:11px;">E-mail</a>` : ''}
        <select data-lead-stage="${l.id}" class="field text-xs" style="width:auto;padding:6px 10px;">
          ${LEAD_STAGES.map((s) => `<option value="${s}" ${l.stage === s ? 'selected' : ''}>${LEAD_STAGE_LABEL[s]}</option>`).join('')}
        </select>
        ${l.converted_to_client_id
          ? `<a href="client-onboarding.html?id=${l.converted_to_client_id}" class="text-xs" style="color:var(--gold);padding:6px 4px;">✓ Já é cliente</a>`
          : `<button type="button" data-convert-lead="${l.id}" class="btn-primary" style="padding:6px 12px;font-size:11px;">Converter em Cliente</button>`}
        <button type="button" data-delete-lead="${l.id}" class="btn-ghost" style="padding:6px 12px;font-size:11px;color:var(--terracotta);border-color:var(--terracotta);">Excluir lead</button>
      </div>
    </div>
  `;
}

function renderRealLeadsSection(leads) {
  // Real gap found live: converting a lead marked it converted and pointed
  // it at the new client, but the row itself never left this list — from
  // the working pipeline's point of view she read as "still a lead" even
  // though Clientes now had her for real too. A converted lead stays out
  // of the default view (she's moved on, tracked in Clientes now), but
  // stays findable — searching by name/email still surfaces her, and so
  // does explicitly picking "Convertido" in the stage filter to review
  // past conversions.
  const showConverted = !!leadSearch || stageFilter === 'convertido';
  const openCount = leads.filter((l) => !l.converted_to_client_id).length;
  const filtered = leads.filter((l) => {
    const matchesSearch = !leadSearch || (l.full_name || '').toLowerCase().includes(leadSearch.toLowerCase()) || (l.email || '').toLowerCase().includes(leadSearch.toLowerCase());
    const matchesStage = !stageFilter || l.stage === stageFilter;
    const notArchived = showConverted || !l.converted_to_client_id;
    return matchesSearch && matchesStage && notArchived;
  });
  return card(`
    <div class="flex items-center justify-between mb-1 flex-wrap gap-2">
      <p class="text-sm text-white/50">Leads <span class="text-xs text-white/30 ml-2">${filtered.length} de ${showConverted ? leads.length : openCount}</span></p>
      <button type="button" id="new-lead" class="btn-primary" style="padding:8px 16px;font-size:12px;">+ Novo lead</button>
    </div>
    <p class="text-xs text-white/20 mb-4">Contatos do site (naymurta.com) e do Roteiro de Stories entram aqui sozinhos; use "Novo lead" para quem chegou por outro caminho.</p>
    <div class="flex flex-wrap items-center gap-3 mb-4">
      <input id="lead-search" class="field text-sm" style="max-width:260px;" placeholder="Buscar por nome ou email..." value="${leadSearch}" />
      <select id="stage-filter" class="field text-sm" style="max-width:220px;">
        <option value="">Todos os estágios</option>
        ${LEAD_STAGES.map((s) => `<option value="${s}" ${stageFilter === s ? 'selected' : ''}>${LEAD_STAGE_LABEL[s]}</option>`).join('')}
      </select>
    </div>
    <div class="divide-y" style="border-color:var(--line);">
      ${filtered.length ? filtered.map(realLeadRow).join('') : '<p class="text-sm text-white/20 py-6">Nenhum lead encontrado.</p>'}
    </div>
  `, 'mb-8');
}

async function renderProductionCRM() {
  const header = `
    <div class="mb-8">
      <p class="text-white/40 text-sm mb-1">Clientes</p>
      <h1 class="text-3xl font-serif">Clientes &amp; Leads</h1>
    </div>
    <div class="flex gap-1 mb-8 border-b border-white/10">
      <button data-section="clients" class="tab-btn ${section === 'clients' ? 'active' : ''}">Clientes</button>
      <button data-section="leads" class="tab-btn ${section === 'leads' ? 'active' : ''}">Leads</button>
    </div>
  `;

  if (section === 'leads') {
    const leads = await loadRealLeads();
    lastLoadedLeads = leads;
    content.innerHTML = header + renderRealLeadsSection(leads);
  } else {
    const clients = await loadRealClients();
    content.innerHTML = header + `
      ${card(`
        <div class="flex items-center justify-between">
          <p class="text-sm text-white/50">${clients.length} cliente${clients.length === 1 ? '' : 's'}</p>
          <button id="new-client" class="btn-primary" style="padding:9px 18px;font-size:12.5px;">+ Novo Cliente</button>
        </div>
      `, 'mb-6')}
      ${clients.length ? engagementPanel(clients) + clientsByPhase(clients)
        : card('<p class="text-sm" style="color:var(--muted);">Nenhum cliente ainda. Clique em "Novo Cliente" para começar o cadastro da primeira cliente real.</p>')}
    `;
  }

  content.querySelectorAll('[data-section]').forEach((btn) => {
    btn.addEventListener('click', () => {
      section = btn.dataset.section;
      history.replaceState(null, '', `crm.html?section=${section}`);
      renderProductionCRM();
    });
  });

  if (section === 'leads') {
    const searchEl = content.querySelector('#lead-search');
    searchEl.addEventListener('input', (e) => { leadSearch = e.target.value; renderProductionCRM(); });
    searchEl.focus();
    searchEl.setSelectionRange(leadSearch.length, leadSearch.length);
    content.querySelector('#stage-filter').addEventListener('change', (e) => { stageFilter = e.target.value; renderProductionCRM(); });
    content.querySelector('#new-lead')?.addEventListener('click', openNewLeadModal);
    content.querySelectorAll('[data-note-form]').forEach((form) => form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const summary = String(fd.get('summary') || '').trim();
      if (!summary) { toast('Escreva a anotação.', { tone: 'error' }); return; }
      const day = String(fd.get('occurred_at') || todayISO());
      const btn = form.querySelector('[type=submit]'); btn.disabled = true;
      const { error } = await supabase.from('lead_interactions').insert({ lead_id: form.dataset.noteForm, occurred_at: `${day}T12:00:00-03:00`, summary });
      if (error) { toast(error.message, { tone: 'error' }); btn.disabled = false; return; }
      toast('Anotação salva.');
      keepOpenLead = form.dataset.noteForm;
      renderProductionCRM();
    }));
    content.querySelectorAll('[data-delete-note]').forEach((btn) => btn.addEventListener('click', async () => {
      if (!confirm('Apagar esta anotação?')) return;
      const { error } = await supabase.from('lead_interactions').delete().eq('id', btn.dataset.deleteNote);
      if (error) { toast(error.message, { tone: 'error' }); return; }
      keepOpenLead = btn.closest('details')?.querySelector('[data-note-form]')?.dataset.noteForm || null;
      renderProductionCRM();
    }));
    // Re-open the notes of the lead just edited (the list re-renders).
    if (keepOpenLead) { const f = content.querySelector(`[data-note-form="${keepOpenLead}"]`); if (f) f.closest('details').open = true; keepOpenLead = null; }
    content.querySelectorAll('[data-lead-stage]').forEach((sel) => {
      sel.addEventListener('change', async (e) => {
        const lead = lastLoadedLeads.find((l) => l.id === sel.dataset.leadStage);
        // Picking "Convertido" here means the same thing as clicking
        // "Converter em Cliente" — she's becoming a real client — so it
        // opens that same flow instead of just saving the word "Convertido"
        // on the lead with no client ever created behind it (the exact gap
        // reported live: the stage changed but nothing showed up in
        // Clientes). Reverts the dropdown if the modal is cancelled.
        if (e.target.value === 'convertido' && lead && !lead.converted_to_client_id) {
          openCreateClientModal(lead, { onCancel: () => { sel.value = lead.stage; } });
          return;
        }
        const { error } = await supabase.from('leads').update({ stage: e.target.value }).eq('id', sel.dataset.leadStage);
        if (error) { toast(error.message, { tone: 'error' }); return; }
        toast('Estágio atualizado.');
      });
    });
    content.querySelectorAll('[data-convert-lead]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const lead = lastLoadedLeads.find((l) => l.id === btn.dataset.convertLead);
        if (lead) openCreateClientModal(lead);
      });
    });
    // Deleting a lead also removes her notes, history and commercial terms
    // (those tables cascade). A lead already converted keeps her client record.
    content.querySelectorAll('[data-delete-lead]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const lead = lastLoadedLeads.find((l) => l.id === btn.dataset.deleteLead);
        if (!lead) return;
        const note = lead.converted_to_client_id ? ' O cadastro dela em Clientes continua.' : '';
        if (!confirm(`Excluir o lead ${lead.full_name || '(sem nome)'}? As anotações e o histórico dele também serão apagados. Isto não pode ser desfeito.${note}`)) return;
        btn.disabled = true;
        const { error } = await supabase.from('leads').delete().eq('id', lead.id);
        if (error) { toast('Não foi possível excluir agora.', { tone: 'error' }); btn.disabled = false; return; }
        toast('Lead excluído.');
        renderProductionCRM();
      });
    });
  } else {
    // Real gap found live: this used to pass openCreateClientModal
    // straight to addEventListener, which hands it the click Event as its
    // first argument — openCreateClientModal(fromLead) then treated that
    // Event as a truthy "fromLead" and tried to update a lead row with
    // id=undefined on every single client created this way (harmless to
    // the client creation itself, but a real failed request every time).
    content.querySelector('#new-client').addEventListener('click', () => openCreateClientModal());
  }
}

const TIER_LABEL = { premium: 'Premium', essential: 'Essential' };
const STAGE_CLASS = {
  novo: 'badge-locked', engajado: 'badge-progress', em_conversa: 'badge-progress',
  proposta_enviada: 'badge-progress', convertido: 'badge-completed', perdido: 'badge-locked',
};
const stageBadge = (stage) => `<span class="badge ${STAGE_CLASS[stage] || 'badge-locked'}">${LEAD_STAGE_LABEL[stage] || stage}</span>`;

if (!(await requireProfile('admin'))) throw new Error('not authorized');
document.body.innerHTML = renderShell({ role: 'admin', active: 'crm.html', title: 'Clientes' });
const content = document.getElementById('app-content');

let section = new URLSearchParams(location.search).get('section') === 'leads' ? 'leads' : 'clients';
let clientSearch = '';
let leadSearch = '';
let stageFilter = '';
let keepOpenLead = null;
let lastLoadedLeads = []; // set by renderProductionCRM whenever it loads real leads — lets the "Converter em Cliente" click handler look up the full row by id without re-fetching

// --- Clientes, grouped by program -----------------------------------------
function clientRow(c) {
  const metaLine = c.status === 'onboarding'
    ? `Onboarding: ${ONBOARDING_STAGE_LABEL[c.onboardingStage]}`
    : `${TIER_LABEL[c.tier] || c.tier} · Fase: ${TIER_PHASES[c.tier][c.phaseIndex]}`;
  return `
    <a href="client-detail.html?id=${c.id}" class="flex items-center justify-between py-3 hover:bg-white/5 -mx-2 px-2 rounded-lg transition-colors" ${!c.infoSubmitted ? 'style="border-left:3px solid var(--terracotta); padding-left:9px;"' : ''}>
      <div>
        <p class="font-medium">${c.fullName}</p>
        <p class="text-xs text-white/30">${c.email} · ${metaLine}</p>
      </div>
      <div class="flex items-center gap-4">
        ${!c.infoSubmitted ? '<span class="badge" style="background:rgba(196,90,60,.15); color:var(--terracotta); border-color:var(--terracotta);">⚠ Aguardando Informações</span>' : ''}
        ${c.status === 'onboarding' ? '' : `<span class="text-xs text-white/40">Jornada ${c.journeyPct}% · Tarefas ${c.homeworkPct}%</span>`}
        ${statusBadge(c.status)}
      </div>
    </a>
  `;
}
function renderClientsSection() {
  const all = MockDB.listClients();
  const filtered = all.filter((c) => !clientSearch
    || c.fullName.toLowerCase().includes(clientSearch.toLowerCase())
    || c.email.toLowerCase().includes(clientSearch.toLowerCase()));
  const groups = PROGRAM_DEFS.map((def) => ({ def, clients: filtered.filter((c) => c.programSlug === def.slug) }));
  const ungrouped = filtered.filter((c) => !PROGRAM_DEFS.some((def) => def.slug === c.programSlug));

  return `
    <div class="grid md:grid-cols-4 gap-6 mb-8">
      ${card(`<p class="text-sm text-white/50 mb-2">Total de Clientes</p><p class="text-3xl font-serif">${all.length}</p>`)}
      ${PROGRAM_DEFS.map((def) => card(`
        <p class="text-sm text-white/50 mb-2">${def.name}</p>
        <p class="text-3xl font-serif">${all.filter((c) => c.programSlug === def.slug).length}</p>
      `)).join('')}
    </div>
    ${card(`
      <div class="flex flex-wrap items-center gap-3">
        <input id="client-search" class="field text-sm" style="max-width:260px;" placeholder="Buscar por nome ou email..." value="${clientSearch}" />
        <span class="text-xs text-white/30">${filtered.length} de ${all.length}</span>
      </div>
    `, 'mb-6')}
    ${groups.map(({ def, clients }) => clients.length ? card(`
      <div class="flex items-center justify-between mb-1">
        <p class="text-sm text-white/50">${def.name}</p>
        <span class="text-xs" style="color:var(--muted);">${clients.length} cliente${clients.length === 1 ? '' : 's'}</span>
      </div>
      <div class="divide-y" style="border-color:var(--line);">${clients.map(clientRow).join('')}</div>
    `, 'mb-6') : '').join('')}
    ${ungrouped.length ? card(`
      <p class="text-sm text-white/50 mb-4">Sem Programa Definido</p>
      <div class="divide-y" style="border-color:var(--line);">${ungrouped.map(clientRow).join('')}</div>
    `, 'mb-6') : ''}
    ${!filtered.length ? card('<p class="text-sm text-white/20 py-2">Nenhum cliente encontrado.</p>', 'mb-6') : ''}
  `;
}

// --- Leads, all together in one container ---------------------------------
function renderKPIs() {
  const s = MockDB.getLeadsSummary();
  return `
    <div class="grid md:grid-cols-4 gap-6 mb-8">
      ${card(`<p class="text-sm text-white/50 mb-2">Total de Leads</p><p class="text-3xl font-serif">${s.total}</p>`)}
      ${card(`<p class="text-sm text-white/50 mb-2">No Grupo VIP</p><p class="text-3xl font-serif">${s.inGroup}</p>`)}
      ${card(`<p class="text-sm text-white/50 mb-2">Convertidos</p><p class="text-3xl font-serif">${s.converted}</p>`)}
      ${card(`<p class="text-sm text-white/50 mb-2">Taxa de Conversão</p><p class="text-3xl font-serif">${s.conversionRatePct}%</p>`)}
    </div>
  `;
}
function leadRow(l) {
  const lastTouch = l.interactions[0]?.date || l.updatedAt;
  return `
    <a href="lead-detail.html?id=${l.id}" class="flex items-center justify-between py-3 hover:bg-white/5 -mx-2 px-2 rounded-lg transition-colors">
      <div class="min-w-0">
        <p class="font-medium">${l.fullName || '(sem nome)'}</p>
        <p class="text-xs text-white/30">${LEAD_SOURCE_LABEL[l.source] || l.source}${l.interestedProgram ? ` · ${PROGRAM_LABEL[l.interestedProgram]}` : ''} · último contato ${formatDate(lastTouch)}</p>
      </div>
      <div class="flex items-center gap-4 shrink-0">
        <span class="text-xs text-white/30">${VIP_GROUP_STATUS_LABEL[l.vipGroupStatus]}</span>
        ${stageBadge(l.stage)}
      </div>
    </a>
  `;
}
function onboardingRow(l) {
  const summary = l.commercialTerms
    ? `${PROGRAM_LABEL_BY_SLUG[l.program] || l.program || 'Programa a definir'} · R$ ${Number(l.commercialTerms.agreedAmount || 0).toLocaleString('pt-BR')} em ${l.commercialTerms.installments || 1}x`
    : '';
  const canCopy = l.registrationToken && !l.registrationCompletedAt;
  return `
    <div class="flex items-center justify-between py-3 -mx-2 px-2 rounded-lg gap-3">
      <a href="lead-detail.html?id=${l.id}" class="flex items-center justify-between flex-1 min-w-0 hover:opacity-80 transition-opacity">
        <div class="min-w-0">
          <p class="font-medium">${l.fullName}</p>
          <p class="text-xs text-white/30">${summary}</p>
        </div>
      </a>
      <div class="flex items-center gap-3 shrink-0">
        ${canCopy ? `<button data-copy-link="${l.id}" class="btn-ghost">📋 Copiar Link</button>` : ''}
        <a href="lead-detail.html?id=${l.id}"><span class="badge ${LEAD_ONBOARDING_STATUS_BADGE_CLASS[l.onboardingStatus] || 'badge-locked'}">${l.pipelineLabel}</span></a>
      </div>
    </div>
  `;
}
function renderOnboardingPipeline() {
  const pipeline = MockDB.getOnboardingPipeline();
  if (!pipeline.length) return '';
  return card(`
    <div class="flex items-center justify-between mb-4">
      <p class="text-sm text-white/50">Onboarding — Entre a Venda e a Ativação</p>
      <span class="text-xs" style="color:var(--muted);">${pipeline.length}</span>
    </div>
    <div class="divide-y" style="border-color:var(--line);">${pipeline.map(onboardingRow).join('')}</div>
  `, 'mb-8');
}
function renderLeadsList() {
  const all = MockDB.getLeads();
  const filtered = all.filter((l) => {
    const matchesSearch = !leadSearch || l.fullName.toLowerCase().includes(leadSearch.toLowerCase()) || l.email.toLowerCase().includes(leadSearch.toLowerCase());
    const matchesStage = !stageFilter || l.stage === stageFilter;
    return matchesSearch && matchesStage;
  });
  return card(`
    <div class="flex items-center justify-between mb-4">
      <p class="text-sm text-white/50">Pipeline de Leads</p>
      <button id="new-lead" class="btn-ghost">+ Novo Lead</button>
    </div>
    <div class="flex flex-wrap items-center gap-3 mb-4">
      <input id="lead-search" class="field text-sm" style="max-width:260px;" placeholder="Buscar por nome ou email..." value="${leadSearch}" />
      <select id="stage-filter" class="field text-sm" style="max-width:220px;">
        <option value="">Todos os estágios</option>
        ${LEAD_STAGES.map((s) => `<option value="${s}" ${stageFilter === s ? 'selected' : ''}>${LEAD_STAGE_LABEL[s]}</option>`).join('')}
      </select>
      <span class="text-xs text-white/30">${filtered.length} de ${all.length}</span>
    </div>
    <div class="divide-y" style="border-color:var(--line);">
      ${filtered.length ? filtered.map(leadRow).join('') : '<p class="text-sm text-white/20 py-6">Nenhum lead encontrado.</p>'}
    </div>
  `, 'mb-8');
}
function dynamicCard(d) {
  const deltaPct = d.beforeCount ? Math.round(((d.afterCount - d.beforeCount) / d.beforeCount) * 100) : null;
  const positive = deltaPct !== null && deltaPct >= 0;
  return `
    <div class="py-3 border-b border-white/5 last:border-0">
      <div class="flex items-start justify-between gap-4">
        <div class="min-w-0">
          <p class="font-medium text-sm">${d.title}</p>
          <p class="text-xs text-white/30 mt-1">${formatDate(d.date)}${d.description ? ` · ${d.description}` : ''}</p>
          <p class="text-xs mt-1" style="color:var(--muted);">${d.metricLabel}: ${d.beforeCount} → ${d.afterCount}</p>
        </div>
        <div class="flex items-center gap-3 shrink-0">
          ${deltaPct !== null ? `<span class="text-sm font-medium" style="color:${positive ? 'var(--gold)' : 'var(--terracotta)'};">${positive ? '+' : ''}${deltaPct}%</span>` : ''}
          <button data-delete-dynamic="${d.id}" class="btn-text">Remover</button>
        </div>
      </div>
    </div>
  `;
}
function renderGroupDynamics() {
  const dynamics = MockDB.getGroupDynamics();
  return card(`
    <div class="flex items-center justify-between mb-4">
      <p class="text-sm text-white/50">Dinâmicas do Grupo VIP</p>
      <button id="new-dynamic" class="btn-ghost">+ Nova Dinâmica</button>
    </div>
    <p class="text-xs text-white/20 mb-4">Registre o que foi feito no grupo e o número de antes/depois — para ver se a dinâmica realmente moveu algo (ex.: uma aula de oratória gerando mais preenchimentos de ficha).</p>
    ${dynamics.length ? dynamics.map(dynamicCard).join('') : '<p class="text-sm" style="color:var(--muted);">Nenhuma dinâmica registrada ainda.</p>'}
  `);
}
function renderLeadsSection() {
  return `
    ${renderKPIs()}
    ${renderOnboardingPipeline()}
    ${renderLeadsList()}
    ${renderGroupDynamics()}
  `;
}

function openLeadModal() {
  const { el, close } = openModal({
    title: 'Novo Lead',
    bodyHtml: `
      <form id="lead-form" class="space-y-4">
        <div class="grid sm:grid-cols-2 gap-4">
          <div>
            <label class="text-xs text-white/40 block mb-1">Nome Completo</label>
            <input name="fullName" class="field" required />
          </div>
          <div>
            <label class="text-xs text-white/40 block mb-1">Programa de Interesse</label>
            <select name="interestedProgram" class="field">
              <option value="">Ainda não sabe</option>
              ${PROGRAMS.map((p) => `<option value="${p}">${PROGRAM_LABEL[p]}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="grid sm:grid-cols-2 gap-4">
          <div>
            <label class="text-xs text-white/40 block mb-1">Email</label>
            <input name="email" type="email" class="field" />
          </div>
          <div>
            <label class="text-xs text-white/40 block mb-1">WhatsApp</label>
            <input name="phone" class="field" placeholder="(31) 90000-0000" />
          </div>
        </div>
        <div class="grid sm:grid-cols-2 gap-4">
          <div>
            <label class="text-xs text-white/40 block mb-1">Origem</label>
            <select name="source" class="field">
              ${LEAD_SOURCES.map((s) => `<option value="${s}">${LEAD_SOURCE_LABEL[s]}</option>`).join('')}
            </select>
          </div>
          <div>
            <label class="text-xs text-white/40 block mb-1">Status no Grupo VIP</label>
            <select name="vipGroupStatus" class="field">
              ${VIP_GROUP_STATUSES.map((s) => `<option value="${s}" ${s === 'in_group' ? 'selected' : ''}>${VIP_GROUP_STATUS_LABEL[s]}</option>`).join('')}
            </select>
          </div>
        </div>
        <p class="text-xs uppercase mt-2" style="color:var(--muted); letter-spacing:.12em;">Redes Sociais</p>
        <div class="grid sm:grid-cols-2 gap-4">
          ${SOCIAL_PLATFORMS.map((p) => `
            <div>
              <label class="text-xs text-white/40 block mb-1">${SOCIAL_PLATFORM_LABEL[p]}</label>
              <input name="social_${p}" class="field" placeholder="https://..." />
            </div>
          `).join('')}
        </div>
        <div>
          <label class="text-xs text-white/40 block mb-1">Notas</label>
          <textarea name="notes" rows="2" class="field" placeholder="O que você já sabe sobre esse lead..."></textarea>
        </div>
        <div class="flex justify-end pt-2">
          <button type="submit" class="btn-primary" style="padding:9px 18px;font-size:12.5px;">Adicionar Lead</button>
        </div>
      </form>
    `,
  });
  el.querySelector('#lead-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const socialLinks = Object.fromEntries(SOCIAL_PLATFORMS.map((p) => [p, fd.get(`social_${p}`) || '']));
    MockDB.createLead({
      fullName: fd.get('fullName'), email: fd.get('email') || '', phone: fd.get('phone') || '',
      source: fd.get('source'), vipGroupStatus: fd.get('vipGroupStatus'),
      interestedProgram: fd.get('interestedProgram') || null, notes: fd.get('notes') || '', socialLinks,
    });
    close();
    toast('Lead adicionado.');
    render();
  });
}
function openDynamicModal() {
  const { el, close } = openModal({
    title: 'Nova Dinâmica do Grupo VIP',
    bodyHtml: `
      <form id="dynamic-form" class="space-y-4">
        <div>
          <label class="text-xs text-white/40 block mb-1">Título</label>
          <input name="title" class="field" placeholder="Ex.: Aula de Oratória ao Vivo" required />
        </div>
        <div class="grid sm:grid-cols-2 gap-4">
          <div>
            <label class="text-xs text-white/40 block mb-1">Data</label>
            <input name="date" type="date" class="field" value="${new Date().toISOString().slice(0, 10)}" required />
          </div>
          <div>
            <label class="text-xs text-white/40 block mb-1">O Que Foi Medido</label>
            <input name="metricLabel" class="field" placeholder="Ex.: Preenchimento da Ficha de Interesse" required />
          </div>
        </div>
        <div class="grid sm:grid-cols-2 gap-4">
          <div>
            <label class="text-xs text-white/40 block mb-1">Antes</label>
            <input name="beforeCount" type="number" min="0" class="field" required />
          </div>
          <div>
            <label class="text-xs text-white/40 block mb-1">Depois</label>
            <input name="afterCount" type="number" min="0" class="field" required />
          </div>
        </div>
        <div>
          <label class="text-xs text-white/40 block mb-1">Descrição</label>
          <textarea name="description" rows="2" class="field"></textarea>
        </div>
        <div class="flex justify-end pt-2">
          <button type="submit" class="btn-primary" style="padding:9px 18px;font-size:12.5px;">Registrar</button>
        </div>
      </form>
    `,
  });
  el.querySelector('#dynamic-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    MockDB.addGroupDynamic({
      title: fd.get('title'), date: fd.get('date'), description: fd.get('description'),
      metricLabel: fd.get('metricLabel'), beforeCount: Number(fd.get('beforeCount')), afterCount: Number(fd.get('afterCount')),
    });
    close();
    toast('Dinâmica registrada.');
    render();
  });
}

function render() {
  content.innerHTML = `
    <div class="mb-8">
      <p class="text-white/40 text-sm mb-1">Clientes</p>
      <h1 class="text-3xl font-serif">Clientes &amp; Leads</h1>
    </div>
    <div class="flex gap-1 mb-8 border-b border-white/10">
      <button data-section="clients" class="tab-btn ${section === 'clients' ? 'active' : ''}">Clientes</button>
      <button data-section="leads" class="tab-btn ${section === 'leads' ? 'active' : ''}">Leads</button>
    </div>
    ${section === 'clients' ? renderClientsSection() : renderLeadsSection()}
  `;

  content.querySelectorAll('[data-section]').forEach((btn) => {
    btn.addEventListener('click', () => {
      section = btn.dataset.section;
      history.replaceState(null, '', `crm.html?section=${section}`);
      render();
    });
  });

  if (section === 'clients') {
    const searchEl = content.querySelector('#client-search');
    searchEl.addEventListener('input', (e) => { clientSearch = e.target.value; render(); });
    searchEl.focus();
    searchEl.setSelectionRange(clientSearch.length, clientSearch.length);
  } else {
    const searchEl = content.querySelector('#lead-search');
    searchEl.addEventListener('input', (e) => { leadSearch = e.target.value; render(); });
    content.querySelector('#stage-filter').addEventListener('change', (e) => { stageFilter = e.target.value; render(); });
    searchEl.focus();
    searchEl.setSelectionRange(leadSearch.length, leadSearch.length);

    content.querySelector('#new-lead').addEventListener('click', openLeadModal);
    content.querySelector('#new-dynamic').addEventListener('click', openDynamicModal);
    content.querySelectorAll('[data-copy-link]').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.preventDefault();
        const lead = MockDB.getLead(btn.dataset.copyLink);
        const link = buildRegistrationLink(lead.registrationToken, location.pathname);
        try { await navigator.clipboard.writeText(link); toast('Link copiado — cole no WhatsApp da cliente.'); }
        catch { toast('Não foi possível copiar automaticamente.', { tone: 'error' }); }
        MockDB.markRegistrationSent(lead.id);
        render();
      });
    });
    content.querySelectorAll('[data-delete-dynamic]').forEach((btn) => {
      btn.addEventListener('click', () => {
        MockDB.deleteGroupDynamic(btn.dataset.deleteDynamic);
        toast('Dinâmica removida.');
        render();
      });
    });
  }
}

if (isProductionEnvironment()) {
  renderProductionCRM();
} else {
  render();
}
