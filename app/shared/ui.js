// Minimal shared UI helpers — stand-in for agency-framework/ui/components/*.

export function formatDate(iso) {
  return new Date(iso).toLocaleDateString('pt-BR', { month: 'long', day: 'numeric', year: 'numeric' });
}

export function formatDateTime(iso) {
  return new Date(iso).toLocaleString('pt-BR', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export function toast(message, { tone = 'success' } = {}) {
  const el = document.createElement('div');
  const tones = {
    success: 'bg-emerald-900/90 text-emerald-50 border-emerald-700',
    error: 'bg-red-900/90 text-red-50 border-red-700',
  };
  el.className = `fixed bottom-6 right-6 px-5 py-3 rounded-xl border shadow-lg text-sm font-medium z-50 transition-opacity duration-300 ${tones[tone]}`;
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
    completed: ['Concluído', 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'],
    published: ['Publicado', 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'],
    in_progress: ['Em Andamento', 'bg-amber-500/15 text-amber-300 border-amber-500/30'],
    draft: ['Rascunho', 'bg-amber-500/15 text-amber-300 border-amber-500/30'],
    available: ['Disponível', 'bg-sky-500/15 text-sky-300 border-sky-500/30'],
    locked: ['Bloqueado', 'bg-white/5 text-white/40 border-white/10'],
    not_started: ['Não Iniciado', 'bg-white/5 text-white/40 border-white/10'],
    pending: ['Pendente', 'bg-white/5 text-white/40 border-white/10'],
  };
  const [label, cls] = map[status] || [status, 'bg-white/5 text-white/40 border-white/10'];
  return `<span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${cls}">${label}</span>`;
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
    <a href="${href}" class="px-3 py-2 rounded-lg text-sm font-medium transition-colors ${active === href ? 'bg-white/10 text-white' : 'text-white/60 hover:text-white hover:bg-white/5'}">${label}</a>
  `).join('');

  return `
    <div class="min-h-screen bg-[#0e0d0c] text-white/90 font-[system-ui]">
      <header class="border-b border-white/10 sticky top-0 bg-[#0e0d0c]/90 backdrop-blur z-40">
        <div class="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div class="flex items-center gap-8">
            <span class="text-lg font-serif tracking-wide" style="letter-spacing:0.08em;">${tenantName}</span>
            <nav class="hidden md:flex items-center gap-1">${navHtml}</nav>
          </div>
          <div class="flex items-center gap-4">
            <span class="text-xs uppercase tracking-wider text-white/40">Visão ${role === 'admin' ? 'Admin' : 'Cliente'}</span>
            <a href="../index.html" class="text-xs text-white/40 hover:text-white/70">Trocar perfil</a>
          </div>
        </div>
      </header>
      <main class="max-w-6xl mx-auto px-6 py-10">
        ${title ? `<h1 class="text-2xl font-serif mb-8">${title}</h1>` : ''}
        <div id="app-content"></div>
      </main>
    </div>
  `;
}

export function card(innerHtml, extraClass = '') {
  return `<div class="rounded-2xl border border-white/10 bg-white/[0.03] p-6 ${extraClass}">${innerHtml}</div>`;
}

export function progressBar(pct) {
  return `
    <div class="w-full h-2 rounded-full bg-white/10 overflow-hidden">
      <div class="h-full rounded-full transition-all duration-700" style="width:${pct}%; background:linear-gradient(90deg,#b9925f,#e8c99b);"></div>
    </div>
  `;
}
