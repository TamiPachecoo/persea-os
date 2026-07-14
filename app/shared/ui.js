// Minimal shared UI helpers — stand-in for agency-framework/ui/components/*.
// Visual language matches the PERSEA brand deck: dark ground, terracotta/gold
// accents, Cormorant Garamond display type over Manrope body type.

export function formatDate(iso) {
  return new Date(iso).toLocaleDateString('pt-BR', { month: 'long', day: 'numeric', year: 'numeric' });
}

export function formatDateTime(iso) {
  return new Date(iso).toLocaleString('pt-BR', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export function toast(message, { tone = 'success' } = {}) {
  const el = document.createElement('div');
  el.className = 'toast';
  if (tone === 'error') el.style.borderColor = 'var(--error)';
  el.style.opacity = '0';
  el.textContent = message;
  document.body.appendChild(el);
  requestAnimationFrame(() => { el.style.opacity = '1'; });
  setTimeout(() => {
    el.style.opacity = '0';
    setTimeout(() => el.remove(), 300);
  }, 2600);
}

export function statusBadge(status) {
  const map = {
    completed: ['Concluído', 'badge-completed'],
    published: ['Publicado', 'badge-completed'],
    in_progress: ['Em Andamento', 'badge-progress'],
    draft: ['Rascunho', 'badge-progress'],
    available: ['Disponível', 'badge-progress'],
    locked: ['Bloqueado', 'badge-locked'],
    not_started: ['Não Iniciado', 'badge-locked'],
    pending: ['Pendente', 'badge-locked'],
  };
  const [label, cls] = map[status] || [status, 'badge-locked'];
  return `<span class="badge ${cls}">${label}</span>`;
}

const CLIENT_NAV = [
  ['dashboard.html', 'Painel'],
  ['questionnaire.html', 'Questionário'],
  ['playbook.html', 'Playbook'],
  ['pitch.html', 'Pitch'],
  ['homework.html', 'Tarefas'],
  ['notes.html', 'Notas'],
  ['activity.html', 'Atividade'],
];

const ADMIN_NAV = [
  ['dashboard.html', 'Painel'],
  ['client-detail.html', 'Clientes'],
];

export function renderParticles(count = 16) {
  let html = '<div class="particles">';
  for (let i = 0; i < count; i++) {
    const size = (Math.random() * 3 + 1.5).toFixed(1);
    const left = (Math.random() * 100).toFixed(1);
    const duration = (Math.random() * 30 + 55).toFixed(1);
    const delay = (Math.random() * -80).toFixed(1);
    const drift = (Math.random() * 40 - 20).toFixed(0);
    html += `<div class="particle" style="width:${size}px;height:${size}px;left:${left}%;--drift:${drift}px;animation-duration:${duration}s;animation-delay:${delay}s;"></div>`;
  }
  return html + '</div>';
}

export function renderShell({ role, active, tenantName = 'PERSEA', title }) {
  const nav = role === 'admin' ? ADMIN_NAV : CLIENT_NAV;
  const navHtml = nav.map(([href, label]) => `
    <a href="${href}" class="nav-link ${active === href ? 'active' : ''}">${label}</a>
  `).join('');

  return `
    <div class="ambient"></div>
    <div class="grain"></div>
    ${renderParticles(role === 'admin' ? 8 : 14)}
    <div class="app-shell">
      <header class="app-header">
        <div class="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div class="flex items-center gap-8">
            <span class="brand-mark">${tenantName}</span>
            <nav class="hidden md:flex items-center gap-1">${navHtml}</nav>
          </div>
          <div class="flex items-center gap-4">
            <span class="text-[10px] uppercase tracking-[.2em]" style="color:var(--muted);">Visão ${role === 'admin' ? 'Admin' : 'Cliente'}</span>
            <a href="../index.html" class="btn-text">Trocar perfil</a>
          </div>
        </div>
      </header>
      <main class="max-w-6xl mx-auto px-6 py-12">
        ${title ? `
          <div class="mb-10">
            <div class="divider mb-4"></div>
            <h1 class="pg-title">${title}</h1>
          </div>
        ` : ''}
        <div id="app-content"></div>
      </main>
    </div>
  `;
}

export function card(innerHtml, extraClass = '') {
  return `<div class="card ${extraClass}">${innerHtml}</div>`;
}

export function progressBar(pct) {
  return `
    <div class="progress-track">
      <div class="progress-fill" style="width:${pct}%;"></div>
    </div>
  `;
}

const TIER_LABEL = { premium: 'Jornada Premium', essential: 'Jornada Essential' };

export function renderPhaseTracker({ tier, phases, currentIndex }, { id = 'phase-tracker' } = {}) {
  const fillPct = phases.length > 1 ? (currentIndex / (phases.length - 1)) * 88 : 0;
  return `
    <div class="phase-tracker-card mb-10" id="${id}">
      <div class="flex items-center justify-between flex-wrap gap-2">
        <span class="phase-tier-label">${TIER_LABEL[tier] || tier}</span>
        <span class="text-xs" style="color:var(--muted);">Fase ${currentIndex + 1} de ${phases.length} · ${phases[currentIndex]}</span>
      </div>
      <div class="phase-tracker">
        <div class="phase-line"></div>
        <div class="phase-line-fill" style="width:${fillPct}%;"></div>
        ${phases.map((label, i) => {
          const state = i < currentIndex ? 'done' : i === currentIndex ? 'current' : 'locked';
          return `
            <button type="button" data-phase-index="${i}" data-phase-state="${state}" class="phase-node phase-${state}">
              <div class="phase-dot">${state === 'done' ? '&#10003;' : i + 1}</div>
              <div class="phase-label">${label}</div>
            </button>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

const MOOD_EMOJIS = [
  { value: 1, emoji: '😞' },
  { value: 2, emoji: '😕' },
  { value: 3, emoji: '😐' },
  { value: 4, emoji: '🙂' },
  { value: 5, emoji: '😄' },
];

// Small floating check-in — deliberately not a modal, so it never blocks the
// client from moving on. onSelect(moodValue) is called, then it dismisses
// itself. Kept UI-only: callers decide what to do with the chosen value
// (ui.js has no data-layer dependency).
export function showMoodPrompt({ label, onSelect }) {
  document.querySelectorAll('.mood-prompt').forEach((el) => el.remove());
  const el = document.createElement('div');
  el.className = 'mood-prompt';
  el.innerHTML = `
    <button class="mood-dismiss" aria-label="Dispensar">&times;</button>
    <p>${label}</p>
    <div class="mood-emoji-row">
      ${MOOD_EMOJIS.map((m) => `<button data-mood="${m.value}">${m.emoji}</button>`).join('')}
    </div>
  `;
  document.body.appendChild(el);
  el.querySelector('.mood-dismiss').addEventListener('click', () => el.remove());
  el.querySelectorAll('[data-mood]').forEach((btn) => {
    btn.addEventListener('click', () => {
      onSelect(Number(btn.dataset.mood));
      el.remove();
      toast('Obrigada por compartilhar como você está se sentindo.');
    });
  });
}
