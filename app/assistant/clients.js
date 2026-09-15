// Assistant's client list — one row per client with a quick read on what's
// still open in her checklist (see getAssistantChecklist in mock-db.js),
// linking into the per-client workspace where she actually does the work
// (that page orders the same checklist by priority — see client-workspace.js).
//
// Real E2E test found: this whole file was 100% MockDB, no environment
// branch at all — a real, activated client (is_demo=false, access_status
// ='created') never appeared here regardless of her real state, while she'd
// correctly stopped appearing in the real branch of assistant/leads.js's
// Cadastros (see that file) the moment she activated. Fixed with a real
// production path below: same access_status='created' criterion
// deriveClientStatus uses for "Ativa" (shared/client-status.js) and
// Cadastros' real branch excludes — so a real client falls into exactly one
// of the two tabs, never both, never neither. Staging/demo below this
// branch is unchanged — still the full MockDB client list.
import { MockDB, PROGRAM_LABEL, PROGRAM_LABEL_BY_SLUG } from '../shared/mock-db.js';
import { renderShell, card, formatDate, isProductionEnvironment } from '../shared/ui.js';
import { requireProfile } from '../shared/supabase-auth.js';
import { supabase } from '../shared/supabase-client.js';
import { computeTeamNextStep } from '../shared/team-action-model.js';

if (!(await requireProfile('assistant'))) throw new Error('not authorized');
document.body.innerHTML = renderShell({ role: 'assistant', active: 'clients.html', title: 'Clientes' });
const content = document.getElementById('app-content');

async function loadRealActiveClients() {
  const { data: clients } = await supabase.from('clients')
    .select('id, full_name, email, program_slug, tier')
    .eq('is_demo', false).eq('access_status', 'created')
    .order('full_name', { ascending: true });
  const rows = clients || [];
  const ids = rows.map((c) => c.id);
  // One bulk query for the whole visible list rather than N+1 — same
  // pattern loadRealStatuses uses in leads.js.
  const { data: meetings } = ids.length
    ? await supabase.from('agenda_items').select('related_student_id, item_date, title')
        .in('related_student_id', ids).eq('status', 'upcoming').order('item_date', { ascending: true })
    : { data: [] };
  const nextMeetingByClient = new Map(); // first write per client wins — already ordered soonest-first
  (meetings || []).forEach((m) => { if (!nextMeetingByClient.has(m.related_student_id)) nextMeetingByClient.set(m.related_student_id, m); });
  const withMeeting = rows.map((c) => ({ ...c, _nextMeeting: nextMeetingByClient.get(c.id) || null }));
  // Same real gap as admin/crm.js, same fix, same shared function — see
  // shared/team-action-model.js's own header for why this exists at all.
  await Promise.all(withMeeting.map(async (c) => { c._teamNextStep = await computeTeamNextStep(c, c.id); }));
  return withMeeting;
}

function productionClientRow(c) {
  const tierLabel = c.tier === 'premium' ? 'Premium' : 'Essential';
  const programLabel = PROGRAM_LABEL_BY_SLUG[c.program_slug] || 'Programa a definir';
  const meetingLabel = c._nextMeeting
    ? `Próximo encontro: ${formatDate(c._nextMeeting.item_date)}${c._nextMeeting.title ? ` · ${c._nextMeeting.title}` : ''}`
    : 'Nenhum encontro agendado';
  return `
    <a href="../admin/client-onboarding.html?id=${c.id}" class="flex items-center justify-between py-3 hover:bg-white/5 -mx-2 px-2 rounded-lg transition-colors flex-wrap gap-2">
      <div class="min-w-0">
        <p class="font-medium">${c.full_name}</p>
        <p class="text-xs text-white/30">${c.email || 'sem e-mail'} · ${tierLabel} · ${programLabel}</p>
        <p class="text-xs text-white/20 mt-1">${meetingLabel}</p>
        ${c._teamNextStep ? `<p class="text-xs mt-0.5 break-words" style="color:var(--gold);">→ ${c._teamNextStep.label}</p>` : ''}
      </div>
      <span class="badge badge-completed shrink-0">Ativa</span>
    </a>
  `;
}

async function renderProductionClientes() {
  const clients = await loadRealActiveClients();
  content.innerHTML = `
    <div class="mb-8">
      <p class="text-white/40 text-sm mb-1">Clientes</p>
      <h1 class="text-3xl font-serif">Suas Clientes</h1>
      <p class="text-sm text-white/40 mt-2 max-w-2xl">Clientes reais com acesso ativo ao Persea OS. Clique em uma cliente para abrir o workspace real dela.</p>
    </div>
    ${card(`<p class="text-sm text-white/50">${clients.length} cliente${clients.length === 1 ? '' : 's'} ativa${clients.length === 1 ? '' : 's'}</p>`, 'mb-6')}
    ${clients.length
      ? card(`<div class="divide-y" style="border-color:var(--line);">${clients.map(productionClientRow).join('')}</div>`)
      : card('<p class="text-sm" style="color:var(--muted);">Nenhuma cliente ativa no momento — assim que o acesso de uma cliente for criado em Cadastros, ela aparece aqui.</p>')}
  `;
}

function clientRow(c) {
  const checklist = MockDB.getAssistantChecklist(c.id);
  const openCount = checklist.filter((i) => !i.done).length;
  const urgent = checklist.some((i) => i.urgent);
  return `
    <a href="client-workspace.html?id=${c.id}" class="flex items-center justify-between py-3 hover:bg-white/5 -mx-2 px-2 rounded-lg transition-colors" ${urgent ? 'style="border-left:3px solid var(--terracotta); padding-left:9px;"' : ''}>
      <div>
        <p class="font-medium">${c.fullName}</p>
        <p class="text-xs text-white/30">${c.email} · ${c.program ? PROGRAM_LABEL[c.program] : 'Sem programa'}</p>
      </div>
      ${urgent
        ? '<span class="badge" style="background:rgba(196,90,60,.15); color:var(--terracotta); border-color:var(--terracotta);">⚠ Aguardando Informações</span>'
        : `<span class="badge ${openCount ? 'badge-progress' : 'badge-completed'}">${openCount ? `${openCount} pendência${openCount === 1 ? '' : 's'}` : 'Tudo em dia'}</span>`}
    </a>
  `;
}

function render() {
  const all = MockDB.listClients();
  content.innerHTML = `
    <div class="mb-8">
      <p class="text-white/40 text-sm mb-1">Clientes</p>
      <h1 class="text-3xl font-serif">Suas Clientes</h1>
      <p class="text-sm text-white/40 mt-2 max-w-2xl">Contrato, links de pagamento, WhatsApp, projeto de imagens, guias, Kit Digital e acesso à Hubla — tudo o que falta fazer para cada cliente, e o contexto para fazer bem.</p>
    </div>
    ${card(`<div class="divide-y" style="border-color:var(--line);">${all.map(clientRow).join('')}</div>`)}
  `;
}

if (isProductionEnvironment()) {
  renderProductionClientes();
} else {
  render();
}
