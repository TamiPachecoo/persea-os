// Seu Mapa de Arquétipos — the client's results page. Reads only
// MockDB.getArchetypeResults(clientId), which already resolves the correct
// gender-appropriate portrait set and computes scores fresh from stored
// responses (see mock-db.js) — nothing here calculates or trusts a
// client-supplied score. If the visual set isn't known yet (no profile
// gender, never corrected by Nay), asks the one-time question first.
import { MockDB, getActiveClientId, ARCHETYPE_VISUAL_SET_LABEL } from '../shared/mock-db.js';
import {
  renderShell, card, toast, initClientSwitcher, formatDate,
  renderArchetypeRadar, archetypePortrait, archetypeIntensityBar, initScrollReveal, isNonProduction,
} from '../shared/ui.js';

const clientId = getActiveClientId();
document.body.innerHTML = renderShell({ role: 'client', active: 'program.html', title: 'Seu Mapa de Arquétipos' });
initClientSwitcher();

// Dev-only preview controls — see arquetipos.js's identical panel for why.
// Gated to non-production (local dev + demo/staging) — see isNonProduction in shared/environment.js.
function renderDevPanel() {
  if (!isNonProduction()) return '';
  return `
    <div class="dev-preview-panel max-w-4xl mx-auto">
      <p class="text-xs uppercase tracking-[.12em] mb-3" style="color:var(--muted);">🧪 Controles da demonstração (dev, removível)</p>
      <div class="flex flex-wrap gap-2">
        <button type="button" data-dev="completed" class="btn-ghost" style="padding:6px 12px;font-size:11.5px;">Simular resultado concluído</button>
        <button type="button" data-dev="tie" class="btn-ghost" style="padding:6px 12px;font-size:11.5px;">Simular resultado com empate</button>
        <button type="button" data-dev="female" class="btn-ghost" style="padding:6px 12px;font-size:11.5px;">Coleção feminina</button>
        <button type="button" data-dev="male" class="btn-ghost" style="padding:6px 12px;font-size:11.5px;">Coleção masculina</button>
        <button type="button" data-dev="reset" class="btn-ghost" style="padding:6px 12px;font-size:11.5px;">Reiniciar teste</button>
      </div>
    </div>
  `;
}
function wireDevPanel() {
  document.querySelectorAll('[data-dev]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const action = btn.dataset.dev;
      if (action === 'completed') MockDB.devSimulateArchetypeCompleted(clientId, { withTie: false });
      if (action === 'tie') MockDB.devSimulateArchetypeCompleted(clientId, { withTie: true });
      if (action === 'female') MockDB.setArchetypeVisualSet(clientId, 'female');
      if (action === 'male') MockDB.setArchetypeVisualSet(clientId, 'male');
      if (action === 'reset') { MockDB.devResetArchetypeQuiz(clientId); location.href = 'arquetipos.html'; return; }
      toast('Estado da demonstração atualizado.');
      // Scroll back to top before re-rendering — otherwise, if this was
      // clicked from the panel at the bottom of the page, the featured
      // cards near the top stay scrolled out of view and their
      // .reveal-scroll fade-in never triggers (IntersectionObserver only
      // fires once they're actually visible; see initScrollReveal).
      window.scrollTo(0, 0);
      render();
    });
  });
}
const content = document.getElementById('app-content');

function renderVisualSetPrompt() {
  content.innerHTML = `
    <div class="max-w-md mx-auto text-center py-10">
      <h1 class="text-2xl font-serif mb-6">Qual coleção visual representa melhor você?</h1>
      <div class="flex items-center justify-center gap-3">
        <button type="button" data-set="female" class="btn-primary" style="padding:11px 22px;font-size:13px;">Feminina</button>
        <button type="button" data-set="male" class="btn-ghost" style="padding:11px 22px;font-size:13px;">Masculina</button>
      </div>
    </div>
  `;
  content.querySelectorAll('[data-set]').forEach((btn) => {
    btn.addEventListener('click', () => {
      MockDB.setArchetypeVisualSet(clientId, btn.dataset.set);
      render();
    });
  });
}

function featuredCard(item) {
  return `
    <div class="reveal-scroll">${card(`
      <div class="flex flex-col items-center text-center">
        ${archetypePortrait(item, { size: 140 })}
        <p class="text-xl font-serif mt-4">${item.name}</p>
        <p class="text-sm mt-1" style="color:var(--gold);">${item.rawScore}/20 · ${item.percentage}%</p>
        <p class="text-sm text-white/50 mt-4 max-w-xs">${item.centralDesire}</p>
        <p class="text-xs text-white/30 mt-3 max-w-xs">${item.potentials}</p>
      </div>
    `, 'h-full')}</div>
  `;
}

function gridCard(item) {
  return `
    <details class="value-item-card">
      <summary class="flex items-center gap-3 cursor-pointer" style="list-style:none;">
        ${archetypePortrait(item, { size: 48 })}
        <div class="flex-1 min-w-0">
          <div class="flex items-center justify-between gap-2">
            <p class="text-sm font-medium">${item.name}</p>
            <span class="text-xs text-white/30">#${item.rank}</span>
          </div>
          <p class="text-xs text-white/30 mt-0.5">${item.rawScore}/20 · ${item.percentage}%</p>
          <div class="mt-2">${archetypeIntensityBar(item.percentage)}</div>
        </div>
      </summary>
      <div class="mt-4 pt-4 space-y-2 text-xs text-white/50" style="border-top:1px solid var(--line);">
        <p><strong class="text-white/70">Desejo central:</strong> ${item.centralDesire}</p>
        <p><strong class="text-white/70">Potenciais:</strong> ${item.potentials}</p>
        <p><strong class="text-white/70">Ponto de atenção:</strong> ${item.caution}</p>
        <p><strong class="text-white/70">Direção visual:</strong> ${item.visualDirection}</p>
      </div>
    </details>
  `;
}

function combinationParagraph(featured) {
  const names = featured.map((f) => f.name);
  const namesList = names.length > 1
    ? `${names.slice(0, -1).join(', ')} e ${names[names.length - 1]}`
    : names[0];
  const desires = featured.map((f) => f.centralDesire.replace(/\.$/, '').toLowerCase());
  return `
    <p class="text-sm text-white/60 leading-relaxed mb-3">Você não é apenas um arquétipo isolado — a combinação entre <strong class="text-white/80">${namesList}</strong> é o que dá forma única à sua marca pessoal hoje.</p>
    <p class="text-sm text-white/60 leading-relaxed mb-3">${featured.map((f, i) => `${f.name} traz o desejo de ${desires[i]}`).join('; ')}. Juntas, essas energias orientam decisões sobre sua imagem pessoal, sua comunicação, o posicionamento da sua marca, o conteúdo que você produz e a experiência que você oferece.</p>
    <p class="text-sm text-white/60 leading-relaxed">Na sua mentoria com a Nay, vocês vão aprofundar como essa combinação específica aparece no seu dia a dia — e como usá-la a seu favor, com mais consciência e coerência.</p>
  `;
}

function renderNextAction() {
  const next = MockDB.getNextAction(clientId);
  const label = next ? next.label : 'Continuar minha jornada';
  const route = next ? next.route : 'program.html';
  return `
    <div class="text-center mt-12">
      <a href="${route}" class="btn-primary inline-block" style="padding:12px 28px;font-size:13.5px;">${label}</a>
    </div>
  `;
}

function render() {
  const quiz = MockDB.getClientArchetypeQuiz(clientId);
  const hasCompleted = quiz.attempts.some((a) => a.status === 'completed');
  if (!hasCompleted) {
    location.replace('arquetipos.html');
    return;
  }
  if (MockDB.needsArchetypeVisualSetPrompt(clientId)) {
    renderVisualSetPrompt();
    return;
  }

  const results = MockDB.getArchetypeResults(clientId);

  content.innerHTML = `
    <div class="max-w-4xl mx-auto">
      <div class="mb-10 text-center">
        <p class="text-white/40 text-sm mb-1">Concluído em ${formatDate(results.completedAt)}</p>
        <h1 class="text-3xl font-serif mb-4">Seu mapa de arquétipos</h1>
        <p class="text-sm text-white/50 max-w-xl mx-auto leading-relaxed">Você carrega os 12 arquétipos. Este mapa mostra quais energias aparecem com mais intensidade hoje e como elas podem orientar sua imagem, sua comunicação e seu posicionamento.</p>
      </div>

      ${results.hasTie ? `
        <div class="mb-8" style="border-left:3px solid var(--gold); border-radius:4px;">${card(`
          <p class="text-sm" style="color:var(--gold);">Há um empate na faixa de destaque. Esses arquétipos devem ser considerados juntos na leitura com Nay.</p>
        `)}</div>
      ` : ''}

      <p class="text-xs uppercase mb-4" style="color:var(--muted); letter-spacing:.12em;">Seus Arquétipos em Destaque</p>
      <div class="grid sm:grid-cols-2 lg:grid-cols-${Math.min(results.featured.length, 4)} gap-5 mb-14">
        ${results.featured.map(featuredCard).join('')}
      </div>

      <p class="text-xs uppercase mb-4 mt-14" style="color:var(--muted); letter-spacing:.12em;">Mapa Completo — Os 12 Arquétipos</p>
      ${card(`
        <div class="flex justify-center mb-8">${renderArchetypeRadar(results.scores)}</div>
      `, 'mb-6')}
      <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-14">
        ${results.scores.map(gridCard).join('')}
      </div>
      <p class="text-xs text-white/20 mb-14 max-w-xl">O resultado não define uma personagem que você precisa interpretar. Ele oferece uma linguagem para traduzir sua essência com mais consciência e coerência.</p>

      <p class="text-xs uppercase mb-4" style="color:var(--muted); letter-spacing:.12em;">Sua Combinação de Destaque</p>
      ${card(combinationParagraph(results.featured), 'mb-14')}

      ${renderNextAction()}

      <p class="text-xs text-white/20 mt-10 mb-10 text-center max-w-md mx-auto">Este teste é uma ferramenta de reflexão e direcionamento de marca pessoal. Ele não é uma avaliação psicológica ou diagnóstico clínico.</p>

      ${renderDevPanel()}
    </div>
  `;
  initScrollReveal();
  wireDevPanel();
}

render();
