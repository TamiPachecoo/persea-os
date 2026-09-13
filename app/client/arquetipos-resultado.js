// Seu Mapa de Arquétipos — Production Migration: Archetypes + Quiz. Reads
// only shared/archetype-model.js's loadArchetypeResults(clientId), which
// computes scores fresh from the client's real stored responses (see that
// module's header comment) — nothing here calculates or trusts a client-
// supplied score. If the visual set isn't known yet, asks the one-time
// question first (writes client_archetype_settings — see the new narrow
// client-write RLS policy added this batch).
import { getCurrentClientContext } from '../shared/client-context.js';
import {
  renderShell, card, toast, initClientSwitcher, formatDate,
  renderArchetypeRadar, archetypePortrait, archetypeIntensityBar, initScrollReveal,
} from '../shared/ui.js';
import { loadArchetypeResults, getLatestAttempt, needsVisualSetPrompt, setVisualSet } from '../shared/archetype-model.js';
import { supabase } from '../shared/supabase-client.js';

const __clientCtx = await getCurrentClientContext('../login.html', { page: 'arquetipos-resultado' });
if (!__clientCtx) throw new Error('not authorized');
const clientId = __clientCtx.clientId;
document.body.innerHTML = renderShell({ role: 'client', active: 'program.html', title: 'Seu Mapa de Arquétipos' });
initClientSwitcher();
const content = document.getElementById('app-content');

function renderIncomplete() {
  content.innerHTML = card(`
    <div style="text-align:center; padding:52px 24px;">
      <p class="font-serif" style="font-size:1.5rem;">Finalize o Teste de Arquétipos para visualizar seu resultado.</p>
      <a href="arquetipos.html" class="btn-primary inline-block mt-6" style="padding:11px 24px;font-size:13px;">Continuar o teste</a>
    </div>
  `, 'max-w-xl mx-auto mt-10');
}

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
    btn.addEventListener('click', async () => {
      try { await setVisualSet(clientId, btn.dataset.set); render(); }
      catch { toast('Não foi possível salvar agora.', { tone: 'error' }); }
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

// Personalized next-action (MockDB.getNextAction) depends on the full
// program/phase model, which isn't converted this batch — rather than
// invent a second one, this always points at Minha Jornada, exactly the
// same honest fallback the demo version itself falls back to when no next
// action is known.
function renderNextAction() {
  return `
    <div class="text-center mt-12">
      <a href="program.html" class="btn-primary inline-block" style="padding:12px 28px;font-size:13.5px;">Continuar minha jornada</a>
    </div>
  `;
}

async function render() {
  const latest = await getLatestAttempt(clientId);
  if (!latest || latest.status !== 'completed') { renderIncomplete(); return; }

  const { data: settings } = await supabase.from('client_archetype_settings').select('visual_set').eq('client_id', clientId).maybeSingle();
  if (needsVisualSetPrompt(settings)) { renderVisualSetPrompt(); return; }

  const results = await loadArchetypeResults(clientId);

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
    </div>
  `;
  initScrollReveal();
}

render();
