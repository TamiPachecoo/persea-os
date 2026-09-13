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
import { loadProgramState, loadNextMeeting, loadPlaybookSummary } from '../shared/program-model.js';
import { supabase } from '../shared/supabase-client.js';

const __clientCtx = await getCurrentClientContext('../login.html', { page: 'program' });
if (!__clientCtx) throw new Error('not authorized');
const clientId = __clientCtx.clientId;
const client = __clientCtx.client;
document.body.innerHTML = renderShell({ role: 'client', active: 'program.html', title: 'Seu Programa' });
initClientSwitcher();
const content = document.getElementById('app-content');

function activityCard(a) {
  if (a.access !== 'included') return premiumPreviewCard(a);
  const actionable = a.status !== 'locked';
  const actionHtml = actionable
    ? `<a href="${a.route}" class="btn-primary inline-block" style="padding:9px 18px;font-size:12.5px;">${a.completed ? 'Ver' : 'Continuar'}</a>`
    : '<span class="text-xs text-white/20">Libera após a etapa anterior</span>';

  return card(`
    <div class="flex items-start justify-between gap-4 mb-2">
      <p class="text-lg font-serif">${a.title}</p>
      <span class="badge ${a.badgeClass}">${a.statusLabel}</span>
    </div>
    <p class="text-sm text-white/40 mb-5 max-w-xl">${a.description}</p>
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

function playbookBonusCard() {
  if (!client.personal_playbook_url && !client.business_playbook_url) return '';
  return `
    <p class="text-xs uppercase mt-10 mb-4" style="color:var(--muted); letter-spacing:.12em;">Também disponível</p>
    ${client.personal_playbook_url ? card(`
      <div class="flex items-center justify-between gap-4">
        <div>
          <p class="text-lg font-serif mb-1">Seu Playbook de Marca Pessoal</p>
          <p class="text-sm text-white/40">Identidade, missão, posicionamento e pitch, tudo em um só lugar.</p>
        </div>
        <a ${externalLinkAttrs(client.personal_playbook_url)} class="btn-ghost shrink-0">Abrir Playbook ↗</a>
      </div>
    `, 'mb-5') : ''}
    ${client.business_playbook_url ? card(`
      <div class="flex items-center justify-between gap-4">
        <div>
          <p class="text-lg font-serif mb-1">Seu Business Playbook</p>
          <p class="text-sm text-white/40">A análise do seu negócio e os pontos de foco para você perseguir.</p>
        </div>
        <a ${externalLinkAttrs(client.business_playbook_url)} class="btn-ghost shrink-0">Abrir ↗</a>
      </div>
    `, 'mb-5') : ''}
  `;
}

async function render() {
  const [state, nextMeeting] = await Promise.all([
    loadProgramState(clientId, client),
    loadNextMeeting(clientId),
  ]);
  const { programDef, phases, progress } = state;

  if (!programDef) {
    content.innerHTML = card('<p class="text-sm" style="color:var(--muted);">Seu programa ainda está sendo configurado — fale com a equipe PERSEA.</p>');
    return;
  }

  const phaseCardsHtml = await Promise.all(phases.map(async (phase) => {
    const cards = await Promise.all(phase.activities.map(activityCard));
    return renderPhaseSection(phase, cards.join(''));
  }));

  content.innerHTML = `
    <div class="mb-4">
      <p class="text-white/40 text-sm mb-1">Seu Programa</p>
      <h1 class="text-3xl font-serif mb-3">${programDef.name}</h1>
      <p class="text-sm text-white/50 max-w-2xl mb-1">${programDef.description}</p>
      ${programDef.supporting_statement ? `<p class="text-xs text-white/30 mb-1">${programDef.supporting_statement}</p>` : ''}
      <p class="text-xs text-white/30">${programDef.duration_months ? `Duração: ${programDef.duration_months} meses` : 'Duração a confirmar com a Nay'}</p>
    </div>

    ${renderPhaseTracker({ phases: phases.map((p) => `Fase ${p.id + 1}`), currentIndex: client.phase_index || 0, tier: client.tier })}

    ${card(`
      <div class="grid sm:grid-cols-3 gap-6 mb-5">
        <div>
          <p class="text-xs text-white/30 mb-1">Progresso geral</p>
          <p class="text-2xl font-serif mb-2">${progress.pct}%</p>
          ${progressBar(progress.pct)}
        </div>
        <div>
          <p class="text-xs text-white/30 mb-1">Atividades</p>
          <p class="text-2xl font-serif">${progress.completedCount} <span class="text-sm text-white/30">de ${progress.totalIncluded} concluídas</span></p>
        </div>
        <div>
          <p class="text-xs text-white/30 mb-1">Próxima etapa</p>
          <p class="text-lg font-serif">${progress.nextActivity ? progress.nextActivity.title : 'Tudo em dia ✦'}</p>
        </div>
      </div>
    `, 'mb-8')}

    ${nextMeetingCard(nextMeeting)}

    <p class="text-xs uppercase mb-4 mt-10" style="color:var(--muted); letter-spacing:.12em;">Sua Jornada</p>
    <div class="journey-phases">${phaseCardsHtml.join('')}</div>

    ${playbookBonusCard()}
  `;

  content.querySelectorAll('[data-upgrade-interest]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const { error } = await supabase.from('premium_upgrade_interests').insert({ client_id: clientId, source_activity_slug: btn.dataset.upgradeInterest, current_program_slug: client.program_slug, status: 'novo' });
      if (error) { toast('Não foi possível registrar agora.', { tone: 'error' }); return; }
      toast('Interesse registrado. Nay poderá conversar com você sobre o Persea Premium e os próximos passos.');
      render();
    });
  });
  wirePhaseTrackerNav(content);
}

await render();

if (location.hash.startsWith('#phase-section-')) {
  const target = content.querySelector(location.hash);
  if (target) {
    if (target.tagName === 'DETAILS') target.open = true;
    setTimeout(() => target.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
  }
}
