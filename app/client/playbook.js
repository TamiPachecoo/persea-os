import { MockDB, getActiveClientId } from '../shared/mock-db.js';
import { renderShell, card, formatDate, progressBar, toast, showMoodPrompt, stepEyebrow, initScrollReveal, enableTilt, initClientSwitcher } from '../shared/ui.js';

const activeClientId = getActiveClientId();
document.body.innerHTML = renderShell({ role: 'client', active: 'playbook.html', title: 'Playbook de Marca Pessoal' });
initClientSwitcher();

const client = MockDB.getClient(activeClientId);
const published = MockDB.getPublishedPlaybook(activeClientId);
const book = MockDB.getBook(activeClientId);
const content = document.getElementById('app-content');

const FORMATS = {
  podcast: { icon: '🎙️', label: 'Podcast', verb: 'Ouvindo', desc: 'Um episódio íntimo, narrado na voz da Nay, contando a sua própria história de marca.' },
  video: { icon: '🎬', label: 'Vídeo', verb: 'Assistindo', desc: 'Uma apresentação visual do seu playbook, seção por seção.' },
  audiobook: { icon: '📖', label: 'Audiobook', verb: 'Ouvindo', desc: 'O playbook inteiro narrado como um audiolivro, na ordem, do início ao fim.' },
};

// view: 'cover' | 'toc' | 'chapter'
let view = 'cover';
let currentChapterIndex = 0;
let playerFormat = null;
let playerTimer = null;
let forceChoice = false;

function narrationLines() {
  if (!published) return [];
  return [published.sections.identity, published.sections.mission, published.sections.positioning, published.sections.pitch_30s];
}

// --- Cover ---
function renderCover() {
  content.innerHTML = `
    <div class="book-stage">
      <div id="book-cover" class="book-cover" style="background-image:url('${book.coverImage}');">
        <span class="book-cover-hint">Toque para abrir</span>
        <div class="book-cover-content">
          <p class="book-cover-mark">PERSEA</p>
          <h1 class="book-cover-title">${book.title}</h1>
          <p class="book-cover-author">${book.author}</p>
        </div>
      </div>
    </div>
    <p class="text-center text-sm" style="color:var(--muted);">Feito especialmente para <span style="color:var(--cream);">${client.fullName}</span></p>
  `;
  document.getElementById('book-cover').addEventListener('click', openBook);
}

function openBook() {
  const cover = document.getElementById('book-cover');
  cover.classList.add('opening');
  setTimeout(() => {
    view = 'toc';
    renderPage();
  }, 550);
}

// --- Table of contents ---
function renderExperienceCard() {
  const exp = MockDB.getPlaybookExperience(activeClientId);
  const quiz = MockDB.getQuiz(activeClientId);

  if (playerFormat) {
    const f = FORMATS[playerFormat];
    const lines = narrationLines();
    return card(`
      <p class="eyebrow mb-2">${f.icon} ${f.verb} como ${f.label}</p>
      <p id="caption" class="font-serif text-lg mb-5" style="min-height:3.2em;">${lines[0]}</p>
      <div id="player-progress">${progressBar(0)}</div>
      <div class="flex items-center gap-3 mt-4">
        <button id="player-finish" class="btn-ghost">Concluir agora</button>
        <button id="player-cancel" class="btn-text">Cancelar</button>
      </div>
    `, 'mb-8');
  }

  if (!exp.completedAt || forceChoice) {
    return card(`
      <p class="eyebrow mb-2">Prefere vivenciar em vez de ler? ✨</p>
      <h2 class="pg-title mb-2" style="font-size:1.4rem;">Escolha um formato</h2>
      <p class="text-sm mb-2" style="color:var(--muted);">Disponível apenas aqui na plataforma — não faz parte do PDF para download.</p>
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

  const f = FORMATS[exp.format];
  return card(`
    <div class="flex items-center justify-between flex-wrap gap-4">
      <div>
        <p class="eyebrow mb-1">${f.icon} Vivenciado em ${f.label}</p>
        <p class="text-sm" style="color:var(--muted);">em ${formatDate(exp.completedAt)}</p>
      </div>
      <div class="flex items-center gap-3">
        <button id="replay-experience" class="btn-ghost">Vivenciar em outro formato</button>
        ${quiz.completedAt
          ? `<a href="quiz.html" class="btn-primary" style="padding:9px 18px;font-size:12.5px;">Ver resultado do quiz (${quiz.score}/${quiz.total})</a>`
          : `<a href="quiz.html" class="btn-primary" style="padding:9px 18px;font-size:12.5px;">Fazer Quiz Rápido 🎯</a>`}
      </div>
    </div>
  `, 'mb-8');
}

function renderToc() {
  content.innerHTML = `
    ${card(`
      <p class="font-serif text-xl mb-1" style="font-style:italic;">"${book.epigraph.text}"</p>
      <p class="text-xs" style="color:var(--muted);">${book.epigraph.cite}</p>
    `, 'mb-8')}

    ${renderExperienceCard()}

    ${card(`
      <div class="flex items-center justify-between mb-2">
        <p class="text-sm text-white/50">Sumário</p>
        <button id="download-pdf" class="btn-ghost">Baixar PDF</button>
      </div>
      <p class="text-xs mb-2" style="color:var(--muted);">Escolha o que você quer ler agora — não precisa ser em ordem.</p>
      <div class="mt-2">
        ${book.chapters.map((ch, i) => `
          <div class="book-toc-item" data-chapter="${i}">
            <span class="num">${String(ch.number).padStart(2, '0')}</span>
            <div class="meta">
              <p class="ttl">${ch.title}</p>
              <p class="sub">${ch.eyebrow}</p>
            </div>
          </div>
        `).join('')}
      </div>
    `)}
  `;

  document.querySelectorAll('[data-chapter]').forEach((el) => {
    el.addEventListener('click', () => {
      currentChapterIndex = Number(el.dataset.chapter);
      view = 'chapter';
      renderPage();
    });
  });
  wireExperienceEvents();
  document.getElementById('download-pdf').addEventListener('click', downloadPdf);
}

// --- Chapter reader ---
function renderChapter() {
  const ch = book.chapters[currentChapterIndex];
  const total = book.chapters.length;

  content.innerHTML = `
    <button id="back-to-toc" class="btn-text mb-6">&larr; Voltar ao Sumário</button>
    <div class="book-page reveal">
      ${stepEyebrow(ch.number, total, ch.eyebrow)}
      <h2 class="pg-title mt-2 mb-6">${ch.title}</h2>
      ${ch.paragraphs.map((p) => `<p>${p}</p>`).join('')}
      ${ch.list ? `<ul>${ch.list.map((li) => `<li>${li}</li>`).join('')}</ul>` : ''}
    </div>
    <div class="flex items-center justify-between mt-10 max-w-2xl mx-auto">
      <button id="prev-chapter" class="btn-ghost" ${currentChapterIndex === 0 ? 'disabled' : ''}>&larr; Capítulo Anterior</button>
      <span class="text-xs" style="color:var(--muted);">${currentChapterIndex + 1} / ${total}</span>
      <button id="next-chapter" class="btn-ghost" ${currentChapterIndex === total - 1 ? 'disabled' : ''}>Próximo Capítulo &rarr;</button>
    </div>
  `;

  document.getElementById('back-to-toc').addEventListener('click', () => { view = 'toc'; renderPage(); });
  document.getElementById('prev-chapter').addEventListener('click', () => {
    if (currentChapterIndex > 0) { currentChapterIndex -= 1; renderPage(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  });
  document.getElementById('next-chapter').addEventListener('click', () => {
    if (currentChapterIndex < total - 1) { currentChapterIndex += 1; renderPage(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  });
}

function wireExperienceEvents() {
  document.querySelectorAll('[data-format]').forEach((btn) => {
    btn.addEventListener('click', () => startPlayer(btn.dataset.format));
  });
  document.getElementById('replay-experience')?.addEventListener('click', () => {
    forceChoice = true;
    renderPage();
  });
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
    if (caption) caption.textContent = lines[captionIdx];
    if (pct >= 100) finishPlayer();
  }, stepMs);
}

function finishPlayer() {
  clearInterval(playerTimer);
  const format = playerFormat;
  playerFormat = null;
  MockDB.completePlaybookExperience(activeClientId, format);
  toast('Playbook concluído! Que tal um quiz rápido?');
  renderPage();
  showMoodPrompt({
    label: 'Como você se sentiu vivenciando seu playbook?',
    onSelect: (mood) => MockDB.logMood(activeClientId, 'playbook_experience', mood),
  });
}

// --- PDF export (written chapters only — the podcast/video/audiobook stay platform-exclusive) ---
async function toDataURL(url) {
  const res = await fetch(url);
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
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

    try {
      const imgData = await toDataURL(book.coverImage);
      doc.addImage(imgData, 'JPEG', 0, 0, pageW, pageH);
      doc.setFillColor(12, 10, 9);
      doc.setGState(new doc.GState({ opacity: 0.45 }));
      doc.rect(0, 0, pageW, pageH, 'F');
      doc.setGState(new doc.GState({ opacity: 1 }));
    } catch (e) { /* image embed failed — fall back to text-only cover */ }

    doc.setTextColor(242, 236, 224);
    doc.setFont('times', 'italic');
    doc.setFontSize(34);
    doc.text(book.title, margin, pageH - 160);
    doc.setFontSize(13);
    doc.setFont('helvetica', 'normal');
    doc.text(book.subtitle, margin, pageH - 130);
    doc.text(`Feito especialmente para ${client.fullName}`, margin, pageH - 100);
    doc.setFontSize(10);
    doc.text(book.author, margin, pageH - 70);

    book.chapters.forEach((ch) => {
      doc.addPage();
      doc.setTextColor(20, 18, 16);
      let y = margin;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.text(`${String(ch.number).padStart(2, '0')} · ${ch.eyebrow}`, margin, y);
      y += 26;
      doc.setFont('times', 'italic');
      doc.setFontSize(22);
      doc.text(ch.title, margin, y);
      y += 34;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(11);
      ch.paragraphs.forEach((p) => {
        const lines = doc.splitTextToSize(p, maxWidth);
        lines.forEach((line) => {
          if (y > pageH - margin) { doc.addPage(); y = margin; }
          doc.text(line, margin, y);
          y += 16;
        });
        y += 10;
      });
      if (ch.list) {
        ch.list.forEach((li) => {
          const lines = doc.splitTextToSize(`•  ${li}`, maxWidth - 14);
          lines.forEach((line, i) => {
            if (y > pageH - margin) { doc.addPage(); y = margin; }
            doc.text(line, margin + (i === 0 ? 0 : 14), y);
            y += 16;
          });
          y += 6;
        });
      }
    });

    doc.save(`${book.title.replace(/\s+/g, '-')}.pdf`);
    toast('PDF baixado!');
  } catch (e) {
    toast('Não foi possível gerar o PDF neste navegador.', { tone: 'error' });
  } finally {
    btn.disabled = false;
    btn.textContent = 'Baixar PDF';
  }
}

function renderPage() {
  if (!published || !book) {
    content.innerHTML = card(`
      <p class="text-white/50">Seu playbook ainda não foi publicado. Sua consultora ainda está refinando — volte em breve.</p>
    `);
    return;
  }
  if (view === 'cover') renderCover();
  else if (view === 'toc') renderToc();
  else renderChapter();
}

renderPage();
