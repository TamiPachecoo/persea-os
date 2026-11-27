// Program Hub — Production Migration: Program Hub (final consolidation
// batch). Real Supabase via shared/program-model.js. Every activity card
// reads its status from the activity's own real underlying table (see that
// module) — never a separate progress table, so this page can never show a
// number the feature it's summarizing would contradict.
//
// Two things MockDB's demo version had that are deliberately NOT here,
// both disclosed in program-model.js's header comment: the onboarding-
// in-progress lock (a real client can only ever log in once her contract
// is already signed — see shared/client-status.js — so there's no real
// "mid-onboarding" state to gate here) and the "O que estamos preparando
// para você" mentor-deliverable cards (no real per-client status exists
// for those anywhere in the schema).
import { getCurrentClientContext } from '../shared/client-context.js';
import { renderShell, card, progressBar, toast, formatDate, formatDateTime, initClientSwitcher, isValidHttpUrl, externalLinkAttrs, renderPhaseTracker, wirePhaseTrackerNav } from '../shared/ui.js';
import { loadProgramState, loadNextMeeting } from '../shared/program-model.js';
import { loadStudentTimeline, studentTimelineHtml, wireStudentTimeline } from '../shared/encounter-journey.js';
import { supabase } from '../shared/supabase-client.js';
import { icon } from '../shared/icons.js';
import { isProductionEnvironment } from '../shared/environment.js';
import { encounterNumber, loadEncounterMaterials } from '../shared/encounter-materials.js';
import { guideLabel, guideLinks } from '../shared/image-guides.js';

const __clientCtx = await getCurrentClientContext('../login.html', { page: 'program' });
if (!__clientCtx) throw new Error('not authorized');
const clientId = __clientCtx.clientId;
const client = __clientCtx.client;
document.body.innerHTML = renderShell({ role: 'client', program: __clientCtx?.client?.program_slug, active: 'program.html', title: 'Seu Programa' });
initClientSwitcher();
const content = document.getElementById('app-content');
content.innerHTML = card('<p class="text-sm" style="color:var(--muted);">Carregando seu programa…</p>');

function activityCard(a) {
  if (a.access !== 'included') return premiumPreviewCard(a);
  const actionable = a.status !== 'locked';
  const actionHtml = actionable
    ? `<a href="${a.route}" class="btn-primary inline-block" style="padding:9px 18px;font-size:12.5px;">${a.completed ? 'Ver' : 'Continuar'}</a>`
    : `<span class="text-xs text-white/40">🔒 ${a.lockedNote || 'Libera após a etapa anterior'}</span>`;

  return card(`
    <div class="flex items-start justify-between gap-4 mb-2">
      <p class="text-lg font-serif">${a.title}</p>
      <span class="badge ${a.badgeClass}">${a.statusLabel}</span>
    </div>
    <p class="text-sm text-white/40 ${a.note ? 'mb-2' : 'mb-5'} max-w-xl">${a.description}</p>
    ${a.note ? `<p class="text-xs mb-5 max-w-xl" style="color:var(--gold);">${a.note}</p>` : ''}
    ${actionHtml}
  `, `mb-5 ${!actionable ? 'opacity-70' : ''}`);
}

async function premiumPreviewCard(a) {
  const { data: interest } = await supabase.from('premium_upgrade_interests').select('id, status').eq('client_id', clientId).eq('source_activity_slug', a.slug).in('status', ['novo', 'em_conversa']).maybeSingle();
  return card(`
    <div class="flex items-center gap-3 mb-3">
      <span class="premium-badge">✦ Premium</span>
      <span style="color:var(--muted); font-size:1rem;" aria-hidden="true">🔒</span>
    </div>
    <p class="text-lg font-serif mb-1">${a.title}</p>
    <p class="text-xs uppercase tracking-[.1em] mb-3" style="color:var(--gold);">Experiência exclusiva do Persea Premium</p>
    <p class="text-sm text-white/50 mb-5 max-w-xl">Esta etapa faz parte do acompanhamento aprofundado do Persea Premium. Nela, Nay analisa aspectos estratégicos que não fazem parte do seu programa atual.</p>
    <p class="text-sm text-white/40 mb-5 max-w-xl">${a.premiumDescription || a.description}</p>
    ${interest
      ? '<p class="text-sm" style="color:var(--gold);">Interesse registrado. Nay poderá conversar com você sobre o Persea Premium e os próximos passos.</p>'
      : `<button type="button" data-upgrade-interest="${a.slug}" class="btn-primary" style="padding:9px 18px;font-size:12.5px;">Tenho interesse no Premium</button>`}
  `, 'mb-5');
}

function renderPhaseSection(phase, activityCardsHtml) {
  // A phase Nay took out of her journey (clients.skipped_phases).
  if (phase.status === 'skipped') {
    return `
      <div class="phase-section phase-section-upcoming" id="phase-section-${phase.id}" style="opacity:.6;">
        <div class="flex items-center justify-between gap-3 flex-wrap">
          <span class="phase-section-name">Fase ${phase.id + 1}</span>
          <span class="badge badge-locked">Não faz parte da sua jornada</span>
        </div>
        <p class="text-xs text-white/30 mt-2">Sua jornada segue direto para a fase seguinte.</p>
      </div>
    `;
  }
  if (phase.premiumLocked) {
    return `
      <details class="phase-section phase-section-upcoming" id="phase-section-${phase.id}">
        <summary>
          <span class="phase-section-name">🔒 Fase ${phase.id + 1}</span>
          <span class="premium-badge">✦ Premium</span>
        </summary>
        <p class="text-sm text-white/40 mt-3 max-w-xl">${phase.description}</p>
        <p class="text-xs text-white/20 mt-3">Esta fase faz parte do acompanhamento aprofundado do Persea Premium.</p>
      </details>
    `;
  }

  if (phase.status === 'upcoming') {
    return `
      <details class="phase-section phase-section-upcoming" id="phase-section-${phase.id}">
        <summary>
          <span class="phase-section-name">Fase ${phase.id + 1}</span>
          <span class="badge badge-locked">Em breve</span>
        </summary>
        <p class="text-sm text-white/40 mt-3 max-w-xl">${phase.description}</p>
        ${phase.activities.length ? `<p class="text-xs text-white/20 mt-3">${phase.activities.map((a) => a.title).join(' · ')}</p>` : ''}
        <p class="text-xs text-white/20 mt-3">Sua próxima fase será liberada em breve.</p>
      </details>
    `;
  }

  if (phase.status === 'completed') {
    return `
      <details class="phase-section phase-section-completed" id="phase-section-${phase.id}">
        <summary>
          <span class="phase-section-name">✓ Fase ${phase.id + 1}</span>
          <span class="badge badge-completed">Concluída</span>
        </summary>
        <p class="text-sm text-white/40 mt-3 mb-4 max-w-xl">${phase.description}</p>
        ${activityCardsHtml}
      </details>
    `;
  }

  return `
    <div class="phase-section phase-section-current" id="phase-section-${phase.id}">
      <div class="flex items-center justify-between gap-3 mb-1">
        <span class="phase-section-name">Fase ${phase.id + 1}</span>
        <span class="badge badge-progress">Fase Atual</span>
      </div>
      <p class="text-sm text-white/40 mb-2 max-w-xl">${phase.description}</p>
      <p class="text-xs mb-6" style="color:var(--muted);">${phase.progress.total ? `${phase.progress.completed} de ${phase.progress.total} atividades concluídas` : ''}</p>
      <p class="text-xs uppercase mb-4" style="color:var(--muted); letter-spacing:.12em;">Suas atividades</p>
      ${phase.includedActivities.length ? activityCardsHtml : card('<p class="text-sm" style="color:var(--muted);">Nenhuma atividade pendente nesta fase.</p>', 'mb-5')}
    </div>
  `;
}

function nextMeetingCard(meeting) {
  if (!meeting) {
    return card('<p class="text-sm" style="color:var(--muted);">Seu próximo encontro ainda não foi agendado.</p>', 'mb-8');
  }
  return card(`
    <p class="text-xs uppercase mb-2" style="color:var(--muted); letter-spacing:.12em;">Próximo Encontro</p>
    <p class="text-lg font-serif mb-1">${meeting.title || 'Encontro agendado'}</p>
    <p class="text-sm text-white/40 mb-2">${formatDateTime(meeting.item_date)}</p>
    ${meeting.online_link && isValidHttpUrl(meeting.online_link) ? `<a ${externalLinkAttrs(meeting.online_link)} class="btn-primary inline-block" style="padding:9px 18px;font-size:12.5px;">Entrar na reunião ↗</a>` : ''}
  `, 'mb-8');
}


// Her own contract decides how long she has (anual = 12 months, semestral =
// 6), e.g. an Essencial client with a year of access; the program's standard
// duration is the fallback when there's no contract yet.
const CONTRACT_MONTHS = { anual: 12, semestral: 6 };
async function loadContractMonths(id) {
  const { data } = await supabase.from('contracts').select('duration, status').eq('client_id', id)
    .neq('status', 'cancelled').order('created_at', { ascending: false }).limit(1).maybeSingle();
  return CONTRACT_MONTHS[data?.duration] || null;
}

async function render() {
  const [state, nextMeeting, contractMonths] = await Promise.all([
    loadProgramState(clientId, client),
    loadNextMeeting(clientId),
    loadContractMonths(clientId),
  ]);
  const { programDef, phases, progress } = state;
  // Encounter timeline with the homework before each one (Persea only).
  const timeline = await loadStudentTimeline(clientId, client, { programState: state });

  if (!programDef) {
    content.innerHTML = card('<p class="text-sm" style="color:var(--muted);">Seu programa ainda está sendo configurado — fale com a equipe PERSEA.</p>');
    return;
  }

  // Redesigned home (Nov 2026) for students on the encounter line.
  if (timeline && isProductionEnvironment()) { await renderJourneyHome({ state, nextMeeting, timeline, programDef }); return; }

  // Persea students follow the encounter timeline only — no "Fase" blocks.
  const phaseCardsHtml = timeline ? [] : await Promise.all(phases.map(async (phase) => {
    const cards = await Promise.all(phase.activities.map(activityCard));
    return renderPhaseSection(phase, cards.join(''));
  }));

  // Progresso geral follows the encounters held (E1–E8 in her plan), not the
  // app activities; programs without the encounter line keep the activities.
  const overall = (() => {
    if (!timeline?.nodes?.length) return { pct: progress.pct, note: '' };
    const total = timeline.nodes.length;
    const held = timeline.nodes.filter((n) => n.state === 'done').length;
    return { pct: Math.round((held / total) * 100), note: `${held} de ${total} encontros realizados` };
  })();

  content.innerHTML = `
    <div class="mb-4">
      <p class="text-white/40 text-sm mb-1">Seu Programa</p>
      <h1 class="text-3xl font-serif mb-3">${programDef.name}</h1>
      <p class="text-sm text-white/50 max-w-2xl mb-1">${programDef.description}</p>
      ${programDef.supporting_statement ? `<p class="text-xs text-white/30 mb-1">${programDef.supporting_statement}</p>` : ''}
      <p class="text-xs text-white/30">${(contractMonths || programDef.duration_months) ? `Duração: ${contractMonths || programDef.duration_months} meses` : 'Duração a confirmar com a Nay'}</p>
    </div>

    ${timeline ? '' : renderPhaseTracker({ phases: phases.map((p) => `Fase ${p.id + 1}${p.status === 'skipped' ? ' · não se aplica' : ''}`), currentIndex: client.phase_index || 0, tier: client.program_slug?.startsWith('persea') ? client.tier : programDef.name })}

    ${card(`
      <div class="grid sm:grid-cols-2 gap-6 mb-5">
        <div>
          <p class="text-xs text-white/30 mb-1">Progresso geral</p>
          <p class="text-2xl font-serif mb-2">${overall.pct}%</p>
          ${progressBar(overall.pct)}
          ${overall.note ? `<p class="text-xs text-white/30 mt-2">${overall.note}</p>` : ''}
        </div>
        <div>
          <p class="text-xs text-white/30 mb-1">Atividades</p>
          <p class="text-2xl font-serif">${progress.completedCount} <span class="text-sm text-white/30">de ${progress.totalIncluded} concluídas</span></p>
        </div>
      </div>
    `, 'mb-8')}

    ${nextMeetingCard(nextMeeting)}

    ${timeline ? studentTimelineHtml(timeline) : ''}

    ${timeline ? '' : `
    <p class="text-xs uppercase mb-4 mt-10" style="color:var(--muted); letter-spacing:.12em;">Sua Jornada</p>
    <div class="journey-phases">${phaseCardsHtml.join('')}</div>`}

  `;

  content.querySelectorAll('[data-upgrade-interest]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const { error } = await supabase.from('premium_upgrade_interests').insert({ client_id: clientId, source_activity_slug: btn.dataset.upgradeInterest, current_program_slug: client.program_slug, status: 'novo' });
      if (error) { toast('Não foi possível registrar agora.', { tone: 'error' }); return; }
      toast('Interesse registrado. Nay poderá conversar com você sobre o Persea Premium e os próximos passos.');
      render();
    });
  });
  if (!timeline) wirePhaseTrackerNav(content);
  if (timeline) wireStudentTimeline(content);
}

// --- Minha Jornada (Nov 2026 redesign) ----------------------------------
const esc = (v) => String(v ?? '').replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
const fmtDay = (iso) => { const d = new Date(iso); return `${d.getDate()} ${d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')}. ${d.getFullYear()}`; };
const fmtHour = (iso) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
const MONTHS = { mensal: 1, trimestral: 3, semestral: 6, anual: 12 };
let genFilter = 'all';

async function loadGenerated(meetings) {
  const ids = meetings.map((m) => m.id);
  const [{ data: arts }, { data: recs }, { data: guides }, materials] = await Promise.all([
    supabase.from('google_meet_drive_artifacts').select('*').eq('client_id', clientId),
    ids.length ? supabase.from('meeting_recordings').select('*').in('agenda_item_id', ids) : Promise.resolve({ data: [] }),
    supabase.from('image_guides').select('*').eq('client_id', clientId).not('delivered_at', 'is', null),
    loadEncounterMaterials(supabase, clientId),
  ]);
  const byId = new Map(meetings.map((m) => [m.id, m]));
  const out = [];
  // Encontros: recordings and transcriptions
  (recs || []).forEach((r) => {
    const m = byId.get(r.agenda_item_id);
    if (r.recording_url && r.recording_status === 'disponivel') out.push({ cat: 'enc', kind: 'video', title: `Gravação — ${m?.title || 'Encontro'}`, sub: `Encontro realizado em ${fmtDay(m?.item_date || r.created_at)}`, url: r.recording_url, at: m?.item_date });
    if (r.transcript_url && r.transcript_status === 'disponivel') out.push({ cat: 'enc', kind: 'doc', title: `Transcrição — ${m?.title || 'Encontro'}`, sub: `Encontro realizado em ${fmtDay(m?.item_date || r.created_at)}`, url: r.transcript_url, at: m?.item_date });
  });
  (arts || []).forEach((a) => {
    if (!isValidHttpUrl(a.web_view_link) || a.artifact_type === 'unknown') return;
    const m = byId.get(a.agenda_item_id);
    const video = a.artifact_type === 'recording';
    out.push({ cat: 'enc', kind: video ? 'video' : 'doc', title: `${video ? 'Gravação' : 'Transcrição'} — ${m?.title || a.name}`, sub: m ? `Encontro realizado em ${fmtDay(m.item_date)}` : `Adicionado em ${fmtDay(a.drive_created_time || a.discovered_at)}`, url: a.web_view_link, at: m?.item_date || a.drive_created_time || a.discovered_at });
  });
  // Entregáveis
  const sign = async (path) => { const { data } = await supabase.storage.from('client-shared-files').createSignedUrl(path, 3600); return data?.signedUrl || null; };
  for (const [key, label] of [['guia', 'Guia de Posicionamento'], ['kit', 'Kit Digital']]) {
    const mat = materials[key];
    if (mat?.row?.delivered_at && mat.url) out.push({ cat: 'ent', kind: mat.row.file_path ? 'file' : 'link', title: label, sub: `Entregável · Enviado em ${fmtDay(mat.row.delivered_at)}`, url: mat.url, at: mat.row.delivered_at });
  }
  for (const g of guides || []) {
    const links = guideLinks(g, g.file_path ? await sign(g.file_path) : null);
    links.forEach((l, i) => out.push({ cat: 'ent', kind: l.kind === 'file' ? 'file' : 'link', title: guideLabel(g.slug, g) + (links.length > 1 ? ` — ${l.label.replace(/^Abrir /, '')}` : ''), sub: `Entregável · Enviado em ${fmtDay(g.delivered_at)}`, url: l.url, at: g.delivered_at, n: i }));
  }
  // Materiais: links and files shared on her meetings
  const filePaths = meetings.flatMap((m) => (m.shared_files || []).map((f) => f.path));
  const signed = {};
  if (filePaths.length) {
    const { data } = await supabase.storage.from('client-shared-files').createSignedUrls(filePaths, 3600);
    (data || []).forEach((d) => { if (d.signedUrl) signed[d.path] = d.signedUrl; });
  }
  meetings.forEach((m) => {
    (Array.isArray(m.shared_links) ? m.shared_links : []).filter((l) => isValidHttpUrl(l.url)).forEach((l) => out.push({ cat: 'mat', kind: 'link', title: l.label || 'Link', sub: `Material de apoio · ${m.title}`, url: l.url, at: m.shared_updated_at || m.item_date }));
    (m.shared_files || []).forEach((f) => { if (signed[f.path]) out.push({ cat: 'mat', kind: 'file', title: f.name || 'Arquivo', sub: `Material de apoio · ${m.title}`, url: signed[f.path], at: m.shared_updated_at || m.item_date }); });
  });
  const seen = new Set();
  return out.filter((i) => (seen.has(i.url) ? false : seen.add(i.url))).sort((a, b) => new Date(b.at || 0) - new Date(a.at || 0));
}

const GEN_KIND = { video: ['calendarPlay', 'Vídeo', 'play', 'Assistir'], doc: ['file', 'Documento', 'external', 'Abrir'], file: ['box', 'Arquivo', 'download', 'Baixar'], link: ['link', 'Link', 'external', 'Acessar'] };
function generatedHtml(items) {
  const counts = { all: items.length, enc: items.filter((i) => i.cat === 'enc').length, ent: items.filter((i) => i.cat === 'ent').length, mat: items.filter((i) => i.cat === 'mat').length };
  const shown = genFilter === 'all' ? items : items.filter((i) => i.cat === genFilter);
  const pill = (k, l) => `<button type="button" data-gen="${k}" class="os-gen-pill ${genFilter === k ? 'on' : ''}">${l} (${counts[k]})</button>`;
  return `
    <section class="os-paper os-gen">
      <div class="flex items-center justify-between gap-3 flex-wrap mb-2">
        <h2 class="os-paper-title os-serif">Tudo o que já foi gerado para você</h2>
        <div class="flex gap-2 flex-wrap">${pill('all', 'Todos')}${pill('enc', 'Encontros')}${pill('ent', 'Entregáveis')}${pill('mat', 'Materiais')}</div>
      </div>
      ${shown.length ? `<ul class="os-gen-list">${shown.map((i) => {
        const [ic, label, aic, act] = GEN_KIND[i.kind] || GEN_KIND.link;
        return `<li>
          <span class="os-gen-ico">${icon(i.cat === 'ent' ? 'box' : ic, 26)}</span>
          <div class="os-gen-body"><p class="os-gen-title">${esc(i.title)}</p><p class="os-gen-sub">${esc(i.sub)}</p></div>
          <span class="os-gen-kind">${label}</span>
          <a ${externalLinkAttrs(i.url)} class="os-paper-btn os-gen-act">${icon(aic, 18)} ${act}</a>
        </li>`;
      }).join('')}</ul>` : '<p class="os-paper-sub py-4">Quando a Nay liberar gravações, entregáveis e materiais, eles aparecem aqui.</p>'}
    </section>`;
}

function ringHtml(pct) {
  const r = 34; const c = 2 * Math.PI * r;
  return `<div class="os-ring"><svg width="84" height="84" viewBox="0 0 84 84"><circle cx="42" cy="42" r="${r}" stroke="rgba(255,236,210,.1)" stroke-width="7" fill="none"/><circle cx="42" cy="42" r="${r}" stroke="url(#rg)" stroke-width="7" fill="none" stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - pct / 100)}" transform="rotate(-90 42 42)"/><defs><linearGradient id="rg"><stop stop-color="#f3d6a2"/><stop offset="1" stop-color="#d29a52"/></linearGradient></defs></svg><span>${pct}%</span></div>`;
}

async function renderJourneyHome({ state, nextMeeting, timeline, programDef }) {
  const [{ data: contract }, { data: meetingsRaw }] = await Promise.all([
    supabase.from('contracts').select('duration, status, created_at, signed_file_uploaded_at').eq('client_id', clientId).neq('status', 'cancelled').order('created_at', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('agenda_items').select('*').eq('related_student_id', clientId).order('item_date'),
  ]);
  const meetings = (meetingsRaw || []).filter((m) => m.status !== 'cancelled' && ['individual_meeting', 'class', 'checkpoint', 'group_meeting', 'online_event', 'photo_review'].includes(m.type));
  const generated = await loadGenerated(meetings);
  const months = MONTHS[contract?.duration] || programDef.duration_months || null;
  const start = contract?.signed_file_uploaded_at || contract?.created_at || null;
  const end = start && months ? (() => { const d = new Date(start); d.setMonth(d.getMonth() + months); return d.toISOString(); })() : null;
  const nodes = timeline.nodes;
  const held = nodes.filter((n) => n.state === 'done').length;
  const pct = nodes.length ? Math.round((held / nodes.length) * 100) : 0;
  const curIdx = nodes.findIndex((n) => n.state === 'current');
  const pend = (curIdx === -1 ? nodes : nodes.slice(0, curIdx + 1)).flatMap((n) => n.homework.filter((h) => !h.completed).map((h) => ({ ...h, enc: n.def.number, encName: n.def.name })));
  const meetingFor = (num) => meetings.filter((m) => m.type === 'individual_meeting' && encounterNumber(m.title) === num).sort((a, b) => new Date(b.item_date) - new Date(a.item_date))[0] || null;

  content.innerHTML = `
    <header class="os-chero">
      <p class="os-chero-kicker">Seu Programa</p>
      <h1 class="os-chero-title">${esc(programDef.name)}</h1>
      ${programDef.description ? `<p class="os-chero-desc">${esc(programDef.description)}</p>` : ''}
      <div class="os-hero-meta">
        <span>${icon('file', 17)} Contrato: ${contract?.status === 'completed' ? 'assinado' : contract ? 'em andamento' : '—'}</span>
        ${start ? `<span>${icon('calendar', 17)} Início: ${fmtDay(start)}</span>` : ''}
        ${end ? `<span>${icon('calendar', 17)} Término: ${fmtDay(end)}</span>` : ''}
        <span>${icon('hourglass', 17)} Duração: ${months ? `${months} ${months === 1 ? 'mês' : 'meses'}` : 'a confirmar'}</span>
      </div>
    </header>

    <section class="os-cstats">
      <div class="os-cstat">${ringHtml(pct)}<div class="min-w-0"><p class="os-cstat-h">Progresso da Jornada</p><p class="os-cstat-sub">${held} de ${nodes.length} encontros realizados</p><div class="os-bar"><i style="width:${pct}%"></i></div></div></div>
      <a href="encontros.html" class="os-cstat">${icon('calendar', 34)}<div class="min-w-0"><p class="os-cstat-sub">Próximo Encontro</p>${nextMeeting
        ? `<p class="os-cstat-h">${esc(nextMeeting.title || 'Encontro agendado')}</p><p class="os-cstat-gold">${fmtDay(nextMeeting.item_date)} • ${fmtHour(nextMeeting.item_date)}${isValidHttpUrl(nextMeeting.online_link) ? ' • Online' : ''}</p>`
        : '<p class="os-cstat-h">Ainda não agendado</p><p class="os-cstat-sub">A Nay avisa assim que marcar.</p>'}</div></a>
      <a href="#pendencias" class="os-cstat">${icon('bell', 32)}<div class="min-w-0"><p class="os-cstat-h">Suas Pendências</p><p class="os-cstat-sub">${pend.length ? `${pend.length} aç${pend.length === 1 ? 'ão' : 'ões'} em aberto` : 'Tudo em dia ✦'}</p></div>${icon('chevronRight', 20)}</a>
    </section>

    <section class="os-paper os-ctrack">
      <h2 class="os-paper-title os-serif">Sua jornada na PERSEA</h2>
      <div class="os-ctrack-row">
        ${nodes.map((n) => {
          const m = meetingFor(n.def.number);
          const date = n.state === 'done' ? m?.item_date : m && m.status === 'upcoming' ? m.item_date : null;
          return `<a href="encontros.html" class="os-cnode os-cnode-${n.state}">
            <span class="os-cnode-dot">${n.state === 'done' ? icon('check', 20) : `E${n.def.number}`}</span>
            <span class="os-cnode-name">${esc(n.def.name)}</span>
            ${date ? `<span class="os-cnode-date">${fmtDay(date)}</span>` : ''}
          </a>`;
        }).join('')}
      </div>
    </section>

    <h2 class="os-section-h">Acesso rápido</h2>
    <section class="os-quick">
      <a href="encontros.html" class="os-quick-card">${icon('calendar', 28)}<div><p>Meus Encontros</p><span>Revise tudo o que já definimos</span></div>${icon('chevronRight', 18)}</a>
      <a href="content.html" class="os-quick-card">${icon('layers', 28)}<div><p>Todos os Materiais</p><span>Aulas, arquivos, referências e links</span></div>${icon('chevronRight', 18)}</a>
      <a href="images.html" class="os-quick-card">${icon('box', 28)}<div><p>Meus Entregáveis</p><span>Materiais produzidos para você</span></div>${icon('chevronRight', 18)}</a>
      <a href="#pendencias" class="os-quick-card">${icon('checkCircle', 28)}<div><p>Minhas Pendências</p><span>Ações da sua jornada</span></div>${pend.length ? `<b class="os-cnav-badge">${pend.length}</b>` : icon('chevronRight', 18)}</a>
    </section>

    ${generatedHtml(generated)}

    <section class="os-paper" id="pendencias" style="margin-top:22px;">
      <h2 class="os-paper-title os-serif">Suas pendências</h2>
      <p class="os-paper-sub">Atividades para concluir antes do seu próximo encontro.</p>
      ${pend.length ? `<ul class="os-todo mt-3">${pend.map((h) => `
        <li><span class="os-todo-box"></span><a href="${esc(h.route || '#')}" class="os-todo-text" style="text-decoration:none;">${esc(h.title)} <small>antes do E${h.enc} · ${esc(h.encName)}</small></a><a href="${esc(h.route || '#')}" class="os-paper-btn">${h.status === 'in_progress' || h.statusLabel === 'Em andamento' ? 'Continuar' : 'Começar'}</a></li>`).join('')}</ul>`
        : '<p class="os-paper-sub mt-3">Nenhuma pendência agora. É só comparecer ao próximo encontro! ✦</p>'}
    </section>
  `;
  const wireGen = () => content.querySelectorAll('[data-gen]').forEach((b) => b.addEventListener('click', () => {
    genFilter = b.dataset.gen;
    content.querySelector('.os-gen').outerHTML = generatedHtml(generated);
    wireGen();
  }));
  wireGen();
  if (location.hash === '#pendencias') setTimeout(() => content.querySelector('#pendencias')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
}
window.addEventListener('hashchange', () => { if (location.hash === '#pendencias') document.getElementById('pendencias')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); });

try {
  await render();
} catch (err) {
  // Never leave the client on a blank/black screen: log the real error for
  // diagnosis, show a safe generic message with a retry action. See
  // shared/ui.js's clientNav()/onboardingGateBanner() for the shared-
  // bootstrap version of this same "never crash silently" guard.
  console.error('Program Hub render failed', err);
  content.innerHTML = card(`
    <p class="text-sm mb-4" style="color:var(--muted);">Não foi possível carregar seu programa. Tente novamente.</p>
    <button type="button" class="btn-primary" style="padding:9px 18px;font-size:12.5px;" data-reload>Recarregar</button>
  `);
}

if (location.hash.startsWith('#phase-section-')) {
  const target = content.querySelector(location.hash);
  if (target) {
    if (target.tagName === 'DETAILS') target.open = true;
    setTimeout(() => target.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
  }
}
