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
  ['pitch.html', 'Discurso'],
  ['homework.html', 'Tarefas'],
  ['activity.html', 'Atividade'],
];

const ADMIN_NAV = [
  ['dashboard.html', 'Painel'],
  ['client-detail.html', 'Clientes'],
];

export function renderShell({ role, active, tenantName = 'PERSEA', title }) {
  const nav = role === 'admin' ? ADMIN_NAV : CLIENT_NAV;
  const navHtml = nav.map(([href, label]) => `
    <a href="${href}" class="nav-link ${active === href ? 'active' : ''}">${label}</a>
  `).join('');

  return `
    <div class="ambient"></div>
    <div class="grain"></div>
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
