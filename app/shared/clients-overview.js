// Visão geral de Clientes — shared by Nay's Clientes (admin/crm.js) and the
// assistant's Clientes (assistant/clients.js), so both see exactly the same
// overview: who is where (E1–E8 timeline, admin/encounter-board.js),
// engagement, and the roster grouped by phase. View-only by itself — the
// controls (new client, reorder encounters…) stay on Nay's pages.
import { card, phaseChip, phaseColor } from './ui.js';
import { supabase } from './supabase-client.js';
import { deriveClientStatus, NEXT_ACTION_LABEL } from './client-status.js';
import { computeTeamNextStep } from './team-action-model.js';

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
export async function loadRealClients() {
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
  await Promise.all(withStatus.filter((c) => c._status.label === 'Acesso ativo').map(async (c) => {
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
  engajada: { label: 'Engajamento em dia', color: '#8fae8b' },
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
  if (!e || c._status.label !== 'Acesso ativo') return '';
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
export function engagementPanel(clients) {
  const active = clients.filter((c) => c._status.label === 'Acesso ativo' && !c.is_demo && c._eng);
  if (!active.length) return '';
  const counts = Object.fromEntries(Object.keys(ENG_LEVELS).map((k) => [k, active.filter((c) => c._eng.level === k).length]));
  const bar = Object.keys(ENG_LEVELS).filter((k) => counts[k]).map((k) => `<div title="${ENG_LEVELS[k].label}: ${counts[k]}" style="flex:${counts[k]};background:${ENG_LEVELS[k].color};height:10px;"></div>`).join('');
  const sorted = [...active].sort((a, b) => (b._eng.days ?? 9999) - (a._eng.days ?? 9999));
  const max = Math.max(1, ...sorted.map((c) => c._eng.days ?? 0), 30);
  const rows = sorted.map((c) => {
    const d = c._eng.days;
    const w = d == null ? 100 : Math.max(2, Math.round((d / max) * 100));
    return `<a href="/admin/client-onboarding.html?id=${c.id}" class="block hover:bg-white/5 -mx-2 px-2 py-1 rounded" title="${c.full_name}: ${daysText(d)}">
      <div class="flex items-baseline justify-between gap-3 text-sm"><span class="truncate">${c.full_name}</span><span class="text-xs shrink-0" style="color:${ENG_LEVELS[c._eng.level].color};">${d == null ? 'nunca' : `${d} ${d === 1 ? 'dia' : 'dias'}`}</span></div>
      <div style="height:4px;border-radius:4px;background:var(--line);margin-top:4px;"><div style="height:4px;border-radius:4px;width:${w}%;background:${ENG_LEVELS[c._eng.level].color};opacity:${d == null ? 0.45 : 0.9};"></div></div>
    </a>`;
  }).join('');
  return card(`
    <div class="flex items-baseline justify-between flex-wrap gap-2 mb-3">
      <p class="text-sm text-white/50">Engajamento de quem está ativo no programa</p>
      <p class="text-xs text-white/30">Interação = acesso à plataforma ou ação da própria pessoa (fotos, tarefas, questionários, pedidos de encontro)</p>
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
export function clientsByPhase(clients) {
  const onboarding = clients.filter((c) => c._status.label !== 'Acesso ativo');
  const active = clients.filter((c) => c._status.label === 'Acesso ativo');
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
    <a href="/admin/client-onboarding.html?id=${c.id}" class="flex items-center justify-between py-3 hover:bg-white/5 -mx-2 px-2 rounded-lg transition-colors flex-wrap gap-2" style="${c.phase_index != null && c._teamNextStep ? `border-left:3px solid ${phaseColor(c.phase_index)};padding-left:12px;` : ''}">
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

