// Playbook de Marca Pessoal — Production Migration: Playbook + Quiz +
// Notes. Real Supabase via shared/playbook-model.js. Deliberately simpler
// than the MockDB/demo "book" experience (cover image, epigraph, narrative
// chapters, chapter-PDF) — that whole shell is fixture-only decorative
// content with no real per-client schema backing (see playbook-model.js's
// header comment) — this reads the real 13 published sections directly, no
// invented chapter prose. The format "vivenciar" experience and its
// completion tracking ARE real (playbook_experiences) and are preserved.
import { getCurrentClientContext } from '../shared/client-context.js';
import { renderShell, card, formatDate, formatDateTime, progressBar, toast, showMoodPrompt, initScrollReveal, enableTilt, initClientSwitcher } from '../shared/ui.js';
import { getPublishedPlaybook, getExperience, completeExperience, getQuizResult, SECTION_DEFS, SECTION_LABEL, FORMATS } from '../shared/playbook-model.js';

const __clientCtx = await getCurrentClientContext('../login.html', { page: 'playbook' });
if (!__clientCtx) throw new Error('not authorized');
const clientId = __clientCtx.clientId;
const client = __clientCtx.client;
document.body.innerHTML = renderShell({ role: 'client', active: 'playbook.html', title: 'Playbook de Marca Pessoal' });
initClientSwitcher();
const content = document.getElementById('app-content');

const playbook = await getPublishedPlaybook(clientId);
let experience = playbook ? await getExperience(clientId) : null;
let quizResult = playbook ? await getQuizResult(clientId) : null;

let view = 'toc'; // 'toc' | 'section'
let currentSectionKey = null;
let playerFormat = null;
let playerTimer = null;
let forceChoice = false;

function narrationLines() {
  if (!playbook) return [];
  return [playbook.sections.identity, playbook.sections.mission, playbook.sections.positioning, playbook.sections.pitch_30s].filter(Boolean);
}

function renderExperienceCard() {
  if (playerFormat) {
    const f = FORMATS[playerFormat];
    const lines = narrationLines();
    return card(`
      <p class="eyebrow mb-2">${f.icon} ${f.verb} como ${f.label}</p>
      <p id="caption" class="font-serif text-lg mb-5" style="min-height:3.2em;">${lines[0] || ''}</p>
      <div id="player-progress">${progressBar(0)}</div>
      <div class="flex items-center gap-3 mt-4">
        <button id="player-finish" class="btn-ghost">Concluir agora</button>
        <button id="player-cancel" class="btn-text">Cancelar</button>
      </div>
    `, 'mb-8');
  }

  if (!experience.completed_at || forceChoice) {
    return card(`
      <p class="eyebrow mb-2">Prefere vivenciar em vez de ler? ✨</p>
      <h2 class="pg-title mb-2" style="font-size:1.4rem;">Escolha um formato</h2>
      <p class="text-sm mb-2" style="color:var(--muted);">Uma forma alternativa de revisitar o essencial do seu playbook.</p>
      <div class="grid md:grid-cols-3 gap-3 mt-4">
        ${Object.entries(FORMATS).map(([key, f]) => `
          <button data-format="${key}" class="card tilt-card text-left" style="cursor:pointer;">
            <p style="font-size:1.6rem;" class="mb-2">${f.icon}</p>
            <p class="font-medium mb-1">${f.label}</p>
            <p class="text-xs" style="color:var(--muted);">${f.desc}</p>
          </button>
        `).join('')}
      </div>
    `, 'mb-8');
  }

  const f = FORMATS[experience.format];
  return card(`
    <div class="flex items-center justify-between flex-wrap gap-4">
      <div>
        <p class="eyebrow mb-1">${f.icon} Vivenciado em ${f.label}</p>
        <p class="text-sm" style="color:var(--muted);">em ${formatDate(experience.completed_at)}</p>
      </div>
      <div class="flex items-center gap-3">
        <button id="replay-experience" class="btn-ghost">Vivenciar em outro formato</button>
        ${quizResult
          ? `<a href="quiz.html" class="btn-primary" style="padding:9px 18px;font-size:12.5px;">Ver resultado do quiz (${quizResult.score}/${quizResult.total})</a>`
          : `<a href="quiz.html" class="btn-primary" style="padding:9px 18px;font-size:12.5px;">Fazer Quiz Rápido 🎯</a>`}
      </div>
    </div>
  `, 'mb-8');
}

function renderToc() {
  content.innerHTML = `
    <div class="mb-8">
      <p class="text-white/40 text-sm mb-1">Feito especialmente para ${client.full_name}${playbook.version.published_at ? ` · Publicado em ${formatDate(playbook.version.published_at)}` : ''}</p>
      <h1 class="text-3xl font-serif">Seu Playbook de Marca Pessoal</h1>
    </div>

    ${renderExperienceCard()}

    ${card(`
      <div class="flex items-center justify-between mb-2">
        <p class="text-sm text-white/50">Sumário</p>
        <button id="download-pdf" class="btn-ghost">Baixar PDF</button>
      </div>
      <p class="text-xs mb-2" style="color:var(--muted);">Escolha o que você quer ler agora — não precisa ser em ordem.</p>
      <div class="mt-2">
        ${SECTION_DEFS.map(([key, label], i) => `
          <div class="book-toc-item" data-section="${key}" ${!playbook.sections[key] ? 'style="opacity:.35; pointer-events:none;"' : ''}>
            <span class="num">${String(i + 1).padStart(2, '0')}</span>
            <div class="meta">
              <p class="ttl">${label}</p>
            </div>
          </div>
        `).join('')}
      </div>
    `)}
  `;

  content.querySelectorAll('[data-section]').forEach((el) => {
    el.addEventListener('click', () => {
      currentSectionKey = el.dataset.section;
      view = 'section';
      renderPage();
    });
  });
  wireExperienceEvents();
  content.querySelector('#download-pdf').addEventListener('click', downloadPdf);
}

function renderSection() {
  const idx = SECTION_DEFS.findIndex(([key]) => key === currentSectionKey);
  const [key, label] = SECTION_DEFS[idx];
  const total = SECTION_DEFS.length;

  content.innerHTML = `
    <button id="back-to-toc" class="btn-text mb-6">&larr; Voltar ao Sumário</button>
    <div class="book-page reveal">
      <p class="text-xs text-white/30 mb-2">${String(idx + 1).padStart(2, '0')} / ${String(total).padStart(2, '0')}</p>
      <h2 class="pg-title mt-2 mb-6">${label}</h2>
      <p style="white-space:pre-wrap; line-height:1.8;">${playbook.sections[key] || ''}</p>
    </div>
    <div class="flex items-center justify-between mt-10 max-w-2xl mx-auto">
      <button id="prev-section" class="btn-ghost" ${idx === 0 ? 'disabled' : ''}>&larr; Anterior</button>
      <span class="text-xs" style="color:var(--muted);">${idx + 1} / ${total}</span>
      <button id="next-section" class="btn-ghost" ${idx === total - 1 ? 'disabled' : ''}>Próxima &rarr;</button>
    </div>
  `;

  document.getElementById('back-to-toc').addEventListener('click', () => { view = 'toc'; renderPage(); });
  document.getElementById('prev-section').addEventListener('click', () => {
    if (idx > 0) { currentSectionKey = SECTION_DEFS[idx - 1][0]; renderPage(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  });
  document.getElementById('next-section').addEventListener('click', () => {
    if (idx < total - 1) { currentSectionKey = SECTION_DEFS[idx + 1][0]; renderPage(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  });
}

function wireExperienceEvents() {
  document.querySelectorAll('[data-format]').forEach((btn) => {
    btn.addEventListener('click', () => startPlayer(btn.dataset.format));
  });
  document.getElementById('replay-experience')?.addEventListener('click', () => { forceChoice = true; renderPage(); });
  document.getElementById('player-cancel')?.addEventListener('click', () => {
    clearInterval(playerTimer);
    playerFormat = null;
    renderPage();
  });
  document.getElementById('player-finish')?.addEventListener('click', () => finishPlayer());
  initScrollReveal();
  enableTilt();
}

function startPlayer(format) {
  playerFormat = format;
  forceChoice = false;
  renderPage();
  const lines = narrationLines();
  const totalMs = 9000;
  const stepMs = 150;
  let elapsed = 0;
  clearInterval(playerTimer);
  playerTimer = setInterval(() => {
    elapsed += stepMs;
    const pct = Math.min(100, Math.round((elapsed / totalMs) * 100));
    const track = document.getElementById('player-progress');
    if (track) track.innerHTML = progressBar(pct);
    const captionIdx = Math.min(lines.length - 1, Math.floor((elapsed / totalMs) * lines.length));
    const caption = document.getElementById('caption');
    if (caption && lines[captionIdx]) caption.textContent = lines[captionIdx];
    if (pct >= 100) finishPlayer();
  }, stepMs);
}

async function finishPlayer() {
  clearInterval(playerTimer);
  const format = playerFormat;
  playerFormat = null;
  try { await completeExperience(clientId, format); experience = await getExperience(clientId); }
  catch { toast('Não foi possível salvar agora.', { tone: 'error' }); }
  toast('Playbook concluído! Que tal um quiz rápido?');
  renderPage();
  showMoodPrompt({ label: 'Como você se sentiu vivenciando seu playbook?', onSelect: () => {} });
}

async function downloadPdf() {
  const btn = document.getElementById('download-pdf');
  btn.disabled = true;
  btn.textContent = 'Gerando…';
  try {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const margin = 64;
    const maxWidth = pageW - margin * 2;

    doc.setTextColor(20, 18, 16);
    doc.setFont('times', 'italic');
    doc.setFontSize(28);
    doc.text('Seu Playbook de Marca Pessoal', margin, 140);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(12);
    doc.text(`Feito especialmente para ${client.full_name}`, margin, 170);
    doc.setFontSize(10);
    doc.text('NAY MURTA | PERSEA', margin, 195);

    SECTION_DEFS.forEach(([key, label]) => {
      if (!playbook.sections[key]) return;
      doc.addPage();
      let y = margin;
      doc.setFont('times', 'italic');
      doc.setFontSize(20);
      doc.text(label, margin, y);
      y += 34;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(11);
      const lines = doc.splitTextToSize(playbook.sections[key], maxWidth);
      lines.forEach((line) => {
        if (y > pageH - margin) { doc.addPage(); y = margin; }
        doc.text(line, margin, y);
        y += 16;
      });
    });

    doc.save('Playbook-PERSEA.pdf');
    toast('PDF baixado!');
  } catch (e) {
    toast('Não foi possível gerar o PDF neste navegador.', { tone: 'error' });
  } finally {
    btn.disabled = false;
    btn.textContent = 'Baixar PDF';
  }
}

function renderPage() {
  if (!playbook) {
    content.innerHTML = card(`<p class="text-white/50">Seu Playbook ainda está sendo preparado.</p>`);
    return;
  }
  if (view === 'toc') renderToc();
  else renderSection();
}

renderPage();
