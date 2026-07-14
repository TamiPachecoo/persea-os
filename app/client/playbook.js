import { MockDB, DEFAULT_CLIENT_ID } from '../shared/mock-db.js';
import { renderShell, card, formatDate, progressBar, toast, showMoodPrompt } from '../shared/ui.js';

document.body.innerHTML = renderShell({ role: 'client', active: 'playbook.html', title: 'Playbook de Marca Pessoal' });

const published = MockDB.getPublishedPlaybook(DEFAULT_CLIENT_ID);
const sectionDefs = MockDB.getSectionDefs();
const content = document.getElementById('app-content');

const FORMATS = {
  podcast: { icon: '🎙️', label: 'Podcast', verb: 'Ouvindo', desc: 'Um episódio íntimo, narrado na voz da Nay, contando a sua própria história de marca.' },
  video: { icon: '🎬', label: 'Vídeo', verb: 'Assistindo', desc: 'Uma apresentação visual do seu playbook, seção por seção.' },
  audiobook: { icon: '📖', label: 'Audiobook', verb: 'Ouvindo', desc: 'O playbook inteiro narrado como um audiolivro, na ordem, do início ao fim.' },
};

let playerFormat = null;
let playerTimer = null;
let forceChoice = false;

function narrationLines(p) {
  return [p.sections.identity, p.sections.mission, p.sections.positioning, p.sections.pitch_30s];
}

function renderExperienceHero() {
  const exp = MockDB.getPlaybookExperience(DEFAULT_CLIENT_ID);
  const quiz = MockDB.getQuiz(DEFAULT_CLIENT_ID);

  if (playerFormat) {
    const f = FORMATS[playerFormat];
    const lines = narrationLines(published);
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
      <p class="eyebrow mb-2">Seu Playbook está pronto ✨</p>
      <h2 class="pg-title mb-2" style="font-size:1.6rem;">Como você quer conhecê-lo?</h2>
      <p class="text-sm mb-6" style="color:var(--muted);">Escolha um jeito de vivenciar sua nova marca — não precisa ser só leitura.</p>
      <div class="grid md:grid-cols-3 gap-3">
        ${Object.entries(FORMATS).map(([key, f]) => `
          <button data-format="${key}" class="card text-left" style="cursor:pointer;">
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

function wireHeroEvents() {
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
}

function startPlayer(format) {
  playerFormat = format;
  forceChoice = false;
  renderPage();
  const lines = narrationLines(published);
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
  MockDB.completePlaybookExperience(DEFAULT_CLIENT_ID, format);
  toast('Playbook concluído! Que tal um quiz rápido?');
  renderPage();
  showMoodPrompt({
    label: 'Como você se sentiu vivenciando seu playbook?',
    onSelect: (mood) => MockDB.logMood(DEFAULT_CLIENT_ID, 'playbook_experience', mood),
  });
}

function renderPage() {
  if (!published) {
    content.innerHTML = card(`
      <p class="text-white/50">Seu playbook ainda não foi publicado. Sua consultora ainda está refinando — volte em breve.</p>
    `);
    return;
  }

  content.innerHTML = `
    ${renderExperienceHero()}
    <div class="mb-8 flex items-center justify-between">
      <p class="text-sm text-white/40">Versão ${published.version} · Publicado em ${formatDate(published.createdAt)}</p>
      <div class="hidden md:flex gap-1 flex-wrap justify-end">
        ${sectionDefs.map(([key, title]) => `<a href="#${key}" class="text-xs px-2 py-1 rounded-full border border-white/10 text-white/50 hover:text-white hover:border-white/30">${title}</a>`).join('')}
      </div>
    </div>
    <div class="space-y-6">
      ${sectionDefs.map(([key, title], i) => `
        <div id="${key}" class="card scroll-mt-24 reveal" style="animation-delay:${(i * 0.06).toFixed(2)}s;">
          <p class="text-xs uppercase tracking-wider text-white/40 mb-2">${title}</p>
          <p class="text-lg leading-relaxed font-serif">${published.sections[key]}</p>
        </div>
      `).join('')}
    </div>
  `;
  wireHeroEvents();
}

renderPage();
