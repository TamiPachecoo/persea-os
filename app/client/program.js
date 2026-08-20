// Program Hub — the client's complete mentoring journey in one place.
// Every activity card reads its status live from MockDB.getProgramActivities,
// which itself computes status from the *real* underlying feature (the
// questionnaire, the assessment step, brandDirection, value-analysis, etc.)
// — never a separate progress table. That's what keeps this page and the
// Painel from ever showing two different numbers for the same client.
import { MockDB, getActiveClientId } from '../shared/mock-db.js';
import {
  renderShell, card, progressBar, renderPhaseTracker, toast, formatDate,
  initClientSwitcher, isValidHttpUrl, externalLinkAttrs, lockedStateCard,
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

function renderPlaybookBonus() {
  const published = MockDB.getPublishedPlaybook(clientId);
  if (!published) return '';
  return `
    <p class="text-xs uppercase mt-10 mb-4" style="color:var(--muted); letter-spacing:.12em;">Também disponível</p>
    ${card(`
      <div class="flex items-center justify-between gap-4">
        <div>
          <p class="text-lg font-serif mb-1">Seu Playbook de Marca Pessoal</p>
          <p class="text-sm text-white/40">O livro construído a partir da sua Extração de Marca — identidade, missão, posicionamento e pitch, tudo em um só lugar.</p>
        </div>
        <a href="playbook.html" class="btn-ghost shrink-0">Abrir Playbook</a>
      </div>
    `, 'mb-5')}
  `;
}

function renderDevPanel() {
  const client = MockDB.getClient(clientId);
  const options = [
    ['persea-essential', 'Persea Essencial'], ['persea-premium', 'Persea Premium'], ['ascensao-imagem', 'Ascensão de Imagem'],
  ];
  return `
    <div class="dev-preview-panel">
      <p class="text-xs uppercase tracking-[.12em] mb-3" style="color:var(--muted);">🧪 Pré-visualização (dev, removível) — cliente ativa: ${client.fullName}</p>
      <div class="flex flex-wrap gap-2 mb-3">
        ${options.map(([slug, label]) => `<button type="button" data-dev-program="${slug}" class="btn-ghost" style="padding:6px 12px;font-size:11.5px;">${label}</button>`).join('')}
      </div>
      <div class="flex flex-wrap gap-2">
        <button type="button" data-dev-images="aguardando_envio" class="btn-ghost" style="padding:6px 12px;font-size:11.5px;">Imagens: aguardando envio</button>
        <button type="button" data-dev-images="enviado" class="btn-ghost" style="padding:6px 12px;font-size:11.5px;">Imagens: enviadas</button>
        <button type="button" data-dev-images="novas_solicitadas" class="btn-ghost" style="padding:6px 12px;font-size:11.5px;">Imagens: novas solicitadas</button>
        <button type="button" id="dev-fast-forward" class="btn-ghost" style="padding:6px 12px;font-size:11.5px;">Simular quase concluído</button>
        <a href="../admin/client-detail.html?id=${clientId}&tab=program" class="btn-ghost" style="padding:6px 12px;font-size:11.5px;">Abrir visão da Nay ↗</a>
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
  const activities = MockDB.getProgramActivities(clientId);
  const progress = MockDB.getProgramProgress(clientId);
  const phaseProgress = MockDB.getPhaseProgress(clientId);

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

    ${renderPhaseTracker(phaseProgress)}

    <p class="text-xs uppercase mb-4 mt-10" style="color:var(--muted); letter-spacing:.12em;">Sua Jornada</p>
    ${activities.map(activityCard).join('')}

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
}

render();
