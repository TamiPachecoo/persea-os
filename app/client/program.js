// Program Hub — the client's complete mentoring journey in one place.
// Every activity card reads its status live from MockDB.getProgramActivities,
// which itself computes status from the *real* underlying feature (the
// questionnaire, the assessment step, brandDirection, value-analysis, etc.)
// — never a separate progress table. That's what keeps this page and the
// Painel from ever showing two different numbers for the same client.
import { MockDB, getActiveClientId, TIER_PHASES } from '../shared/mock-db.js';
import {
  renderShell, card, progressBar, toast, formatDate,
  initClientSwitcher, isValidHttpUrl, externalLinkAttrs, lockedStateCard, isNonProduction,
} from '../shared/ui.js';

const clientId = getActiveClientId();
document.body.innerHTML = renderShell({ role: 'client', active: 'program.html', title: 'Seu Programa' });
initClientSwitcher();
const content = document.getElementById('app-content');

function activityCard(a) {
  if (a.access === 'premium_preview') return premiumPreviewCard(a);

  const isExternal = a.activityType === 'external_assessment';
  const assessment = isExternal ? MockDB.getAssessment(clientId) : null;
  const externalOk = isExternal && isValidHttpUrl(assessment && assessment.externalUrl);
  const actionable = a.status !== 'locked';

  let actionHtml;
  if (!actionable) {
    actionHtml = '<span class="text-xs text-white/20">Libera após a etapa anterior</span>';
  } else if (isExternal) {
    actionHtml = externalOk
      ? `<a ${externalLinkAttrs(assessment.externalUrl)} class="btn-primary inline-block" style="padding:9px 18px;font-size:12.5px;">${a.primaryActionLabel} ↗</a>`
      : '<span class="text-xs text-white/30">Link em breve</span>';
  } else {
    actionHtml = `<a href="${a.route}" class="btn-primary inline-block" style="padding:9px 18px;font-size:12.5px;">${a.primaryActionLabel}</a>`;
  }

  return card(`
    <div class="flex items-start justify-between gap-4 mb-2">
      <p class="text-lg font-serif">${a.title}</p>
      <span class="badge ${a.badgeClass}">${a.statusLabel}</span>
    </div>
    <p class="text-sm text-white/40 mb-5 max-w-xl">${a.description}</p>
    ${actionHtml}
  `, `mb-5 ${!actionable ? 'opacity-70' : ''}`);
}

function premiumPreviewCard(a) {
  const interested = MockDB.getPremiumUpgradeInterests()
    .some((i) => i.clientId === clientId && i.sourceActivitySlug === a.slug && ['novo', 'em_conversa'].includes(i.status));
  return card(`
    <div class="flex items-center gap-3 mb-3">
      <span class="premium-badge">✦ Premium</span>
      <span style="color:var(--muted); font-size:1rem;" aria-hidden="true">🔒</span>
    </div>
    <p class="text-lg font-serif mb-1">${a.title}</p>
    <p class="text-xs uppercase tracking-[.1em] mb-3" style="color:var(--gold);">Experiência exclusiva do Persea Premium</p>
    <p class="text-sm text-white/50 mb-5 max-w-xl">Esta etapa faz parte do acompanhamento aprofundado do Persea Premium. Nela, Nay analisa aspectos estratégicos que não fazem parte do seu programa atual.</p>
    <p class="text-sm text-white/40 mb-5 max-w-xl">${a.premiumDescription || a.description}</p>
    ${interested
      ? '<p class="text-sm" style="color:var(--gold);">Interesse registrado. Nay poderá conversar com você sobre o Persea Premium e os próximos passos.</p>'
      : `<button type="button" data-upgrade-interest="${a.slug}" class="btn-primary" style="padding:9px 18px;font-size:12.5px;">Tenho interesse no Premium</button>`}
  `, 'mb-5');
}

const MENTOR_STATUS_BADGE_CLASS = { em_preparacao: 'badge-progress', pronto: 'badge-progress', entregue: 'badge-completed' };
const MENTOR_STATUS_LABEL = { em_preparacao: 'Em preparação', pronto: 'Pronto', entregue: 'Entregue' };

// "O que estamos preparando para você" — the team's own responsibility,
// visually distinct from her activity cards above so she never reads one
// of these as something she needs to go do herself (see mentorDeliverable
// in mock-db.js — these are always derived from an existing tracked fact).
function mentorDeliverableCard(d) {
  return `
    <div class="mentor-deliverable-card">
      <div class="flex items-start justify-between gap-3 mb-1">
        <p class="text-sm font-medium">${d.label}</p>
        <span class="badge ${MENTOR_STATUS_BADGE_CLASS[d.status]}">${MENTOR_STATUS_LABEL[d.status]}</span>
      </div>
      <p class="text-xs text-white/40">${d.description}</p>
    </div>
  `;
}

// One encounter row — gentle, never punitive, when it hasn't been
// scheduled yet (see the phase-4 "Encontro Adaptativo" special-case: those
// two deliberately never get a fixed subject).
function encounterRow(e) {
  const isAdaptive = e.name === 'Encontro Adaptativo';
  return `
    <div class="encounter-row">
      <div class="flex items-center justify-between gap-3 mb-1">
        <p class="text-sm font-medium">E${e.number} — ${e.name}</p>
        ${e.status === 'completed' ? '<span class="badge badge-completed">Realizado</span>' : e.status === 'upcoming' ? '<span class="badge badge-progress">Agendado</span>' : ''}
      </div>
      ${isAdaptive ? '<p class="text-xs text-white/40">Conteúdo definido de acordo com sua evolução e suas necessidades atuais.</p>' : ''}
      ${e.status === 'upcoming' ? `
        <p class="text-xs text-white/40">${formatDate(e.date)}${e.onlineLink && isValidHttpUrl(e.onlineLink) ? ' · <a ' + externalLinkAttrs(e.onlineLink) + ' class="btn-text" style="display:inline;">Entrar na reunião ↗</a>' : ''}</p>
      ` : e.status === 'not_scheduled' ? `
        <p class="text-xs text-white/30">Estamos preparando seu encontro. Conclua as atividades desta fase para aproveitarmos melhor esse momento.</p>
      ` : ''}
    </div>
  `;
}

// One phase of the journey. Current = fully open (activities + what the
// team is preparing + the encounter); completed = collapsed summary,
// reopenable; upcoming = visible but collapsed, so she knows where she's
// going without a wall of future tasks (see the "organize by phase" ask).
function renderPhaseSection(phase) {
  const includedActivities = phase.activities.filter((a) => a.access === 'included');
  const previewActivities = phase.activities.filter((a) => a.access === 'premium_preview');

  // Fase 4 on a non-Premium program — visible, never just filtered out, but
  // clearly marked as Premium content rather than "coming up for you too"
  // (see PREMIUM_ONLY_PHASE_INDEX + premiumPreviewCard's same treatment for
  // individual activities).
  if (phase.premiumLocked) {
    return `
      <details class="phase-section phase-section-upcoming" id="phase-section-${phase.id}">
        <summary>
          <span class="phase-section-name">🔒 ${phase.name}</span>
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
          <span class="phase-section-name">${phase.name}</span>
          <span class="badge badge-locked">Em breve</span>
        </summary>
        <p class="text-sm text-white/40 mt-3 max-w-xl">${phase.description}</p>
        ${includedActivities.length || previewActivities.length ? `
          <p class="text-xs text-white/20 mt-3">${[...includedActivities, ...previewActivities].map((a) => a.title).join(' · ')}</p>
        ` : ''}
        <p class="text-xs text-white/20 mt-3">Sua próxima fase será liberada em breve.</p>
      </details>
    `;
  }

  if (phase.status === 'completed') {
    return `
      <details class="phase-section phase-section-completed" id="phase-section-${phase.id}">
        <summary>
          <span class="phase-section-name">✓ ${phase.name}</span>
          <span class="badge badge-completed">Concluída</span>
        </summary>
        <p class="text-sm text-white/40 mt-3 mb-4 max-w-xl">${phase.description}</p>
        ${includedActivities.map(activityCard).join('')}
      </details>
    `;
  }

  // Current phase — fully open.
  return `
    <div class="phase-section phase-section-current" id="phase-section-${phase.id}">
      <div class="flex items-center justify-between gap-3 mb-1">
        <span class="phase-section-name">${phase.name}</span>
        <span class="badge badge-progress">Fase Atual</span>
      </div>
      <p class="text-sm text-white/40 mb-2 max-w-xl">${phase.description}</p>
      <p class="text-xs mb-6" style="color:var(--muted);">${phase.progress.total ? `${phase.progress.completed} de ${phase.progress.total} atividades concluídas` : ''}</p>

      <p class="text-xs uppercase mb-4" style="color:var(--muted); letter-spacing:.12em;">Suas atividades</p>
      ${includedActivities.length ? includedActivities.map(activityCard).join('') : `${card('<p class="text-sm" style="color:var(--muted);">Nenhuma atividade pendente nesta fase.</p>', 'mb-5')}`}
      ${includedActivities.length && phase.progress.completed === phase.progress.total && phase.mentorDeliverables.some((d) => d.status !== 'entregue')
        ? card('<p class="text-sm" style="color:var(--gold);">Você concluiu suas atividades desta etapa. Agora nossa equipe está preparando os próximos passos.</p>', 'mb-5')
        : ''}
      ${previewActivities.map(activityCard).join('')}

      ${phase.mentorDeliverables.length ? `
        <p class="text-xs uppercase mb-4 mt-8" style="color:var(--muted); letter-spacing:.12em;">O que estamos preparando para você</p>
        <div class="mentor-deliverable-grid">${phase.mentorDeliverables.map(mentorDeliverableCard).join('')}</div>
      ` : ''}

      ${phase.encounters.length ? `
        <p class="text-xs uppercase mb-4 mt-8" style="color:var(--muted); letter-spacing:.12em;">Próximo encontro</p>
        ${phase.encounters.map(encounterRow).join('')}
      ` : ''}
    </div>
  `;
}

// Both playbooks are links Nay pastes in herself (see admin's E4/E6 briefs)
// — never auto-generated — so this only ever shows once she's actually
// delivered one, never a placeholder inviting the client to open something
// that isn't ready.
function renderPlaybookBonus() {
  const links = MockDB.getPlaybookLinks(clientId);
  if (!links.personalPlaybookUrl && !links.businessPlaybookUrl) return '';
  return `
    <p class="text-xs uppercase mt-10 mb-4" style="color:var(--muted); letter-spacing:.12em;">Também disponível</p>
    ${links.personalPlaybookUrl ? card(`
      <div class="flex items-center justify-between gap-4">
        <div>
          <p class="text-lg font-serif mb-1">Seu Playbook de Marca Pessoal</p>
          <p class="text-sm text-white/40">Identidade, missão, posicionamento e pitch, tudo em um só lugar.</p>
        </div>
        <a ${externalLinkAttrs(links.personalPlaybookUrl)} class="btn-ghost shrink-0">Abrir Playbook ↗</a>
      </div>
    `, 'mb-5') : ''}
    ${links.businessPlaybookUrl ? card(`
      <div class="flex items-center justify-between gap-4">
        <div>
          <p class="text-lg font-serif mb-1">Seu Business Playbook</p>
          <p class="text-sm text-white/40">A análise do seu negócio e os pontos de foco para você perseguir.</p>
        </div>
        <a ${externalLinkAttrs(links.businessPlaybookUrl)} class="btn-ghost shrink-0">Abrir ↗</a>
      </div>
    `, 'mb-5') : ''}
  `;
}

// Gated to non-production (local dev + demo/staging) — see isNonProduction in shared/environment.js.
function renderDevPanel() {
  if (!isNonProduction()) return '';
  const client = MockDB.getClient(clientId);
  const options = [
    ['persea-essential', 'Persea Essencial'], ['persea-premium', 'Persea Premium'],
  ];
  return `
    <div class="dev-preview-panel">
      <p class="text-xs uppercase tracking-[.12em] mb-3" style="color:var(--muted);">🧪 Pré-visualização (dev, removível) — cliente ativa: ${client.fullName}</p>
      <div class="flex flex-wrap gap-2 mb-3">
        ${options.map(([slug, label]) => `<button type="button" data-dev-program="${slug}" class="btn-ghost" style="padding:6px 12px;font-size:11.5px;">${label}</button>`).join('')}
      </div>
      <div class="flex flex-wrap gap-2 mb-3">
        <button type="button" data-dev-images="aguardando_envio" class="btn-ghost" style="padding:6px 12px;font-size:11.5px;">Imagens: aguardando envio</button>
        <button type="button" data-dev-images="enviado" class="btn-ghost" style="padding:6px 12px;font-size:11.5px;">Imagens: enviadas</button>
        <button type="button" data-dev-images="novas_solicitadas" class="btn-ghost" style="padding:6px 12px;font-size:11.5px;">Imagens: novas solicitadas</button>
        <button type="button" id="dev-fast-forward" class="btn-ghost" style="padding:6px 12px;font-size:11.5px;">Simular quase concluído</button>
        <a href="../admin/client-detail.html?id=${clientId}&tab=program" class="btn-ghost" style="padding:6px 12px;font-size:11.5px;">Abrir visão da Nay ↗</a>
      </div>
      <p class="text-xs text-white/20 mb-2">Jornada — fase atual:</p>
      <div class="flex flex-wrap gap-2">
        ${(TIER_PHASES[client.tier] || TIER_PHASES.essential).map((_, i) => `<button type="button" data-dev-phase="${i}" class="btn-ghost" style="padding:6px 12px;font-size:11.5px;">Fase ${i + 1}</button>`).join('')}
      </div>
    </div>
  `;
}

function render() {
  if (MockDB.needsOnboardingCompletion(clientId)) {
    content.innerHTML = lockedStateCard('Seu Programa');
    return;
  }

  const program = MockDB.getClientProgram(clientId);
  const progress = MockDB.getProgramProgress(clientId);
  const journey = MockDB.getClientJourney(clientId);

  content.innerHTML = `
    <div class="mb-4">
      <p class="text-white/40 text-sm mb-1">Seu Programa</p>
      <h1 class="text-3xl font-serif mb-3">${program.name}</h1>
      <p class="text-sm text-white/50 max-w-2xl mb-1">${program.description}</p>
      ${program.supportingStatement ? `<p class="text-xs text-white/30 mb-1">${program.supportingStatement}</p>` : ''}
      <p class="text-xs text-white/30">${program.durationMonths ? `Duração: ${program.durationMonths} meses` : 'Duração a confirmar com a Nay'}</p>
    </div>

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

    <p class="text-xs uppercase mb-4 mt-10" style="color:var(--muted); letter-spacing:.12em;">Sua Jornada</p>
    <div class="journey-phases">${journey.phases.map(renderPhaseSection).join('')}</div>

    ${renderPlaybookBonus()}

    ${renderDevPanel()}
  `;

  content.querySelectorAll('[data-upgrade-interest]').forEach((btn) => {
    btn.addEventListener('click', () => {
      MockDB.createPremiumUpgradeInterest(clientId, btn.dataset.upgradeInterest);
      toast('Interesse registrado. Nay poderá conversar com você sobre o Persea Premium e os próximos passos.');
      render();
    });
  });
  content.querySelectorAll('[data-dev-program]').forEach((btn) => {
    btn.addEventListener('click', () => {
      MockDB.devSetProgram(clientId, btn.dataset.devProgram);
      // Full reload, not just render() — the nav bar's program label is
      // computed once at initial shell render, same as the client-switcher
      // dropdown above; a soft re-render would leave it stale.
      location.reload();
    });
  });
  content.querySelectorAll('[data-dev-images]').forEach((btn) => {
    btn.addEventListener('click', () => { MockDB.setClientImagesStatus(clientId, btn.dataset.devImages); render(); });
  });
  content.querySelector('#dev-fast-forward')?.addEventListener('click', () => { MockDB.devFastForwardProgress(clientId); render(); });
  content.querySelectorAll('[data-dev-phase]').forEach((btn) => {
    btn.addEventListener('click', () => { MockDB.setClientPhase(clientId, Number(btn.dataset.devPhase)); render(); });
  });
}

render();

// Arriving from the Painel's tracker (or any link with #phase-section-N) —
// open that phase's section and scroll to it once the page has settled.
if (location.hash.startsWith('#phase-section-')) {
  const target = content.querySelector(location.hash);
  if (target) {
    if (target.tagName === 'DETAILS') target.open = true;
    setTimeout(() => target.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
  }
}
