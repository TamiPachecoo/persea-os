// Minimal shared UI helpers — stand-in for agency-framework/ui/components/*.
// Visual language matches the PERSEA brand deck: dark ground, terracotta/gold
// accents, Playfair Display headline type over Poppins body type.

import { MockDB, getActiveClientId, setActiveClientId, PREMIUM_ONLY_PHASE_INDEX, ENCOUNTER_DEFS, ENCOUNTER_LABEL } from './mock-db.js';

// Gate for the handful of removable dev-only controls scattered through the
// prototype (state-forcing panels on value-analysis, recording-detail,
// etc.) — real auth (requireProfile) is what actually protects a page;
// this only decides whether a *convenience* shortcut renders at all, so
// none of them show up on a hosted preview or production URL, only on a
// developer's own machine.
export function isLocalDev() {
  return /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
}

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
    onboarding: ['Onboarding', 'badge-progress'],
  };
  const [label, cls] = map[status] || [status, 'badge-locked'];
  return `<span class="badge ${cls}">${label}</span>`;
}

// Consolidated around the Program Hub: the client's whole mentoring journey
// (onboarding, extraction, archetype test, guide, images, brand direction,
// pitch, content, business) now lives inside program.html, not as separate
// nav pages — see the Program Hub redesign notes. Their routes/data all
// still exist and are reachable via links from Painel/the Hub; they're just
// no longer top-level nav items. The Program Hub's own label is dynamic
// (the client's actual enrolled program name), computed in renderShell.
function clientNav() {
  const gated = MockDB.needsOnboardingCompletion(getActiveClientId());
  const lock = gated ? '🔒 ' : '';
  return [
    ['dashboard.html', 'Resumo'],
    ['program.html', `${lock}Minha Jornada`],
    ['encontros.html', 'Encontros'],
    ['content.html', `${lock}Conteúdos`],
    ['financial.html', 'Financeiro'],
  ];
}

// The one onboarding-completion prompt, shown at the top of every
// client-facing page's content (see renderShell) whenever the signed
// contract isn't archived yet — Seu Programa/Conteúdos themselves also hard
// -block their real content behind the same check (see program.js/
// content.js), this banner is just what makes the restriction visible
// everywhere else too. Suppressed on onboarding.html itself (no point
// telling her to go where she already is) and on dashboard.html (which
// already carries its own more finely-staged onboarding banner — see
// renderOnboardingBanner in client/dashboard.js).
function onboardingGateBanner(active) {
  if (active === 'onboarding.html' || active === 'dashboard.html') return '';
  const activeId = getActiveClientId();
  if (!MockDB.needsOnboardingCompletion(activeId)) return '';
  const stage = MockDB.getOnboarding(activeId).contract.status;
  const message = stage === 'info_pending' || stage === 'info_received'
    ? 'Complete suas informações de cadastro para prepararmos seu contrato.'
    : stage === 'signed'
      ? 'Contrato assinado recebido — nossa equipe está finalizando o arquivamento. Você já poderá acessar seu Programa e Conteúdos assim que isso for concluído.'
      : 'Falta assinar seu contrato para liberar seu Programa e os Conteúdos da mentoria.';
  return `
    <div class="gate-banner">
      <span class="gate-banner-icon" aria-hidden="true">🔒</span>
      <p class="gate-banner-text">${message}</p>
      <a href="onboarding.html" class="btn-primary gate-banner-cta" style="padding:8px 16px;font-size:12px;">Completar Onboarding</a>
    </div>
  `;
}

const ADMIN_NAV = [
  ['dashboard.html', 'Painel'],
  ['agenda.html', 'Agenda'],
  ['crm.html', 'CRM'],
  ['content.html', 'Conteúdos'],
  ['assistente.html', 'Assistente'],
  ['financial.html', 'Financeiro'],
  ['reports.html', 'Relatórios'],
];

// The assistant's own mirror of Nay's admin nav — same shape (Painel,
// Agenda, Clientes, Financeiro), scoped to her actual duties. Deliberately
// not the full admin CRM: no Leads, no business-wide revenue/Relatórios —
// Templates replaces those with her real day-to-day: the Canva source
// material she works from, per client-workspace, before uploading what she
// builds straight onto that client's own profile (no separate "delivered
// projects" library to browse — the client's CRM record is that record now).
const ASSISTANT_NAV = [
  ['queue.html', 'Painel'],
  ['agenda.html', 'Agenda'],
  ['leads.html', 'Cadastros'],
  ['clients.html', 'Clientes'],
  ['templates.html', 'Templates'],
  ['financial.html', 'Financeiro'],
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

function renderClientSwitcher() {
  const activeId = getActiveClientId();
  const clients = MockDB.listClients();
  return `
    <select id="client-switcher" class="field" style="width:auto; padding:6px 10px; font-size:12px;">
      ${clients.map((c) => `<option value="${c.id}" ${c.id === activeId ? 'selected' : ''}>${c.fullName}</option>`).join('')}
    </select>
  `;
}

// Call once after inserting renderShell's HTML into the page — wires the
// client-switcher <select> so picking a different client reloads the page
// acting as them. Only relevant on client-role pages.
export function initClientSwitcher() {
  document.getElementById('client-switcher')?.addEventListener('change', (e) => {
    setActiveClientId(e.target.value);
    location.reload();
  });
}

const ROLE_LABEL = { admin: 'Admin', assistant: 'Assistente', client: 'Cliente' };

export function renderShell({ role, active, tenantName = 'PERSEA', title }) {
  const nav = role === 'admin' ? ADMIN_NAV : role === 'assistant' ? ASSISTANT_NAV : clientNav();
  const navHtml = nav.map(([href, label]) => `
    <a href="${href}" class="nav-link ${active === href ? 'active' : ''}">${label}</a>
  `).join('');

  return `
    <div class="ambient"></div>
    <div class="grain"></div>
    ${renderParticles(role === 'client' ? 14 : 8)}
    <div class="app-shell">
      <header class="app-header">
        <div class="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div class="flex items-center gap-8">
            <span class="brand-mark">${tenantName}</span>
            <nav class="hidden md:flex items-center gap-1">${navHtml}</nav>
          </div>
          <div class="flex items-center gap-4">
            ${role === 'client' && isLocalDev() ? renderClientSwitcher() : ''}
            <span class="text-[10px] uppercase tracking-[.2em]" style="color:var(--muted);">Visão ${ROLE_LABEL[role] || role}</span>
            <a href="../index.html" class="btn-text">Trocar perfil</a>
          </div>
        </div>
      </header>
      <main class="max-w-6xl mx-auto px-6 py-12">
        ${role === 'client' ? onboardingGateBanner(active) : ''}
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

// Hard-blocks a page's real content behind the onboarding gate (see
// onboardingGateBanner) — used by program.js and content.js, the two pages
// explicitly restricted until the signed contract is archived. Other client
// pages stay reachable; they just carry the banner above.
export function lockedStateCard(title) {
  return card(`
    <div class="lock-state">
      <p class="lock-state-icon" aria-hidden="true">🔒</p>
      <p class="text-lg font-serif mb-2">${title}</p>
      <p class="text-sm text-white/40 max-w-sm mx-auto mb-6">Isso libera assim que seu onboarding for concluído — inclusive a assinatura do seu contrato.</p>
      <a href="onboarding.html" class="btn-primary inline-block" style="padding:10px 22px;font-size:13px;">Completar Onboarding</a>
    </div>
  `);
}

// --- Modal — detail/edit dialog (agenda items, resources, etc.) ---
// One at a time; caller supplies the body HTML and wires its own listeners
// against the returned `.el` after the modal is in the DOM.
export function openModal({ title = '', bodyHtml = '', onClose } = {}) {
  closeModal();
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.id = 'active-modal';
  backdrop.innerHTML = `
    <div class="modal-panel" role="dialog" aria-modal="true" aria-label="${title}">
      <div class="modal-head">
        <p class="modal-title">${title}</p>
        <button type="button" class="modal-close" aria-label="Fechar">&times;</button>
      </div>
      <div class="modal-body">${bodyHtml}</div>
    </div>
  `;
  document.body.appendChild(backdrop);
  requestAnimationFrame(() => backdrop.classList.add('open'));

  function escHandler(e) { if (e.key === 'Escape') close(); }
  function close() {
    backdrop.classList.remove('open');
    document.removeEventListener('keydown', escHandler);
    setTimeout(() => backdrop.remove(), 200);
    if (onClose) onClose();
  }
  document.addEventListener('keydown', escHandler);
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) close(); });
  backdrop.querySelector('.modal-close').addEventListener('click', close);

  return { el: backdrop.querySelector('.modal-body'), close };
}
export function closeModal() {
  document.getElementById('active-modal')?.remove();
}

// --- External-link safety ---
// Used before treating any admin-entered URL (Pinterest board, Hubla class
// link, online-meeting link) as clickable/embeddable.
export function isValidHttpUrl(value) {
  if (!value) return false;
  try {
    const u = new URL(value);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}
// href+target+rel attribute string for a validated external link, or ''
// (renders as a disabled-looking, non-navigating element) when invalid.
export function externalLinkAttrs(url) {
  return isValidHttpUrl(url) ? `href="${url}" target="_blank" rel="noopener noreferrer"` : '';
}

// A src/href is "usable" either as an admin-entered http(s)/data URL
// (isValidHttpUrl) or as a bundled local asset path shipped with the app
// itself (e.g. '../shared/assets/guia-atividades.pdf') — same trust level
// as book.coverImage. Use this instead of isValidHttpUrl for any field that
// may hold either kind of source (content-category covers, the Guia de
// Atividades PDF, etc).
export function isValidAssetSrc(value) {
  const src = value || '';
  return isValidHttpUrl(src) || src.startsWith('data:') || src.startsWith('.');
}
// href+target+rel attributes for a usable asset src (see isValidAssetSrc),
// local or external — unlike externalLinkAttrs this doesn't reject bundled
// local paths.
export function assetLinkAttrs(url) {
  return isValidAssetSrc(url) ? `href="${url}" target="_blank" rel="noopener noreferrer"` : '';
}

// --- Meeting recordings & transcripts (Google Meet prototype) — reusable
// display pieces shared by admin, assistant and client screens. Data
// always comes from MockDB's meeting-recording methods (see mock-db.js);
// these are presentation-only, so the same visual language can't drift
// between the three roles' pages.

// Generic status badge from any of the label/class map pairs mock-db.js
// exports (RECORDING_STATUS_LABEL+BADGE_CLASS, TRANSCRIPT_..., etc.) —
// avoids a bespoke badge function per status vocabulary.
export function badgeFromMaps(value, labelMap, classMap) {
  return `<span class="badge ${classMap[value] || 'badge-locked'}">${labelMap[value] || value}</span>`;
}

// Deterministic (same name -> same tone) initials avatar — stands in for a
// client photo, since no real photo upload exists in this prototype.
export function initialsAvatar(fullName, size = 36) {
  const initials = (fullName || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';
  return `<div class="avatar-initials" style="width:${size}px;height:${size}px;font-size:${Math.round(size * 0.38)}px;">${initials}</div>`;
}

// The recording/transcript block — same component whether it's rendered on
// the admin detail page, the assistant's view, or the client's Encontros
// page. `showCopyLink` is the only thing that varies by audience (clients
// don't need it); everything else reads directly off the meeting's own
// `recording` bundle so it can never say something the badges next to it
// don't already agree with.
export function renderRecordingBlock(meeting, { showCopyLink = false } = {}) {
  const r = meeting.recording;
  if (!r) return '';
  const lifecycle = meeting.lifecycleStatus;

  if (lifecycle !== 'finalizada') {
    return `<p class="text-sm" style="color:var(--muted);">A gravação será disponibilizada após a reunião.</p>`;
  }
  if (r.recordingStatus === 'sem_gravacao') {
    return `<p class="text-sm" style="color:var(--muted);">Este encontro não possui gravação.</p>`;
  }
  if (r.requiresAttention || r.recordingStatus === 'erro') {
    return `
      <p class="text-sm mb-1" style="color:var(--terracotta);">Não foi possível localizar os arquivos automaticamente.</p>
      ${r.attentionNote ? `<p class="text-xs text-white/30">${r.attentionNote}</p>` : ''}
    `;
  }
  if (r.recordingStatus === 'aguardando' || r.recordingStatus === 'processando') {
    return `<p class="text-sm" style="color:var(--muted);">O Google ainda está preparando esta gravação.</p>`;
  }

  // recordingStatus === 'disponivel' from here on.
  const rows = [];
  rows.push(`
    <div class="flex items-center justify-between flex-wrap gap-2 py-2">
      <span class="text-sm">Gravação disponível.</span>
      <div class="flex items-center gap-2">
        <a ${externalLinkAttrs(r.recordingUrl)} class="btn-primary" style="padding:8px 16px;font-size:12px;">Assistir gravação ↗</a>
        ${showCopyLink ? `<button type="button" data-copy-link="${r.recordingUrl}" class="btn-ghost" style="padding:8px 14px;font-size:12px;">Copiar link</button>` : ''}
      </div>
    </div>
  `);
  if (r.transcriptStatus === 'disponivel') {
    rows.push(`
      <div class="flex items-center justify-between flex-wrap gap-2 py-2">
        <span class="text-sm">Transcrição disponível.</span>
        <div class="flex items-center gap-2">
          <a ${externalLinkAttrs(r.transcriptUrl)} class="btn-ghost" style="padding:8px 16px;font-size:12px;">Abrir transcrição ↗</a>
          ${showCopyLink ? `<button type="button" data-copy-link="${r.transcriptUrl}" class="btn-ghost" style="padding:8px 14px;font-size:12px;">Copiar link</button>` : ''}
        </div>
      </div>
    `);
  } else if (r.transcriptStatus === 'aguardando') {
    rows.push(`<p class="text-sm mt-1" style="color:var(--muted);">Transcrição pendente — o Google ainda está gerando o texto.</p>`);
  }
  return `<div class="divide-y" style="border-color:var(--line);">${rows.join('')}</div>`;
}

// The client-facing "processing" copy is worded slightly warmer than the
// admin/assistant one (spec calls this out as its own exact string) — kept
// as a separate small helper rather than a branch inside renderRecordingBlock
// so neither copy has to compromise for the other's audience.
export function renderClientRecordingBlock(meeting) {
  const r = meeting.recording;
  if (!r) return '';
  if (meeting.lifecycleStatus !== 'finalizada') return '';
  if (r.recordingStatus === 'sem_gravacao') {
    return `<p class="text-sm" style="color:var(--muted);">Este encontro não possui gravação.</p>`;
  }
  if (r.recordingStatus === 'disponivel') {
    return `
      <div class="flex flex-wrap items-center gap-2">
        <a ${externalLinkAttrs(r.recordingUrl)} class="btn-primary" style="padding:9px 18px;font-size:12.5px;">Assistir gravação ↗</a>
        ${r.transcriptStatus === 'disponivel' ? `<a ${externalLinkAttrs(r.transcriptUrl)} class="btn-ghost">Abrir transcrição ↗</a>` : ''}
      </div>
    `;
  }
  // aguardando / processando / erro — the client only ever needs one calm
  // message; the distinction between "still processing" and "we hit an
  // error" is Nay's problem to solve, not something to alarm the client with.
  return `<p class="text-sm" style="color:var(--muted);">Sua gravação está sendo preparada. Assim que estiver disponível, ela aparecerá aqui.</p>`;
}

// Delegated click handler for every `[data-copy-link]` button inside a
// container — one implementation shared by every page that renders
// renderRecordingBlock with showCopyLink:true.
export function wireCopyLinkButtons(container) {
  container.querySelectorAll('[data-copy-link]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(btn.dataset.copyLink);
        toast('Link copiado.');
      } catch {
        toast('Não foi possível copiar o link.', { tone: 'error' });
      }
    });
  });
}

// Manual fallback — paste/edit/remove recording+transcript links by hand,
// or mark the meeting as never having had one. Shared by admin and
// assistant (both are allowed to do this); the assistant's own screen just
// never links to the fuller admin detail page this also gets used from.
export function openRecordingLinksModal(meeting, { onSaved } = {}) {
  const r = meeting.recording;
  const { el, close } = openModal({
    title: 'Editar Links da Gravação',
    bodyHtml: `
      <form id="recording-links-form" class="space-y-4">
        <div>
          <label class="text-xs text-white/40 block mb-1">Link da Gravação (Google Drive)</label>
          <input name="recordingUrl" class="field" placeholder="https://drive.google.com/..." value="${r.recordingUrl || ''}" />
        </div>
        <div>
          <label class="text-xs text-white/40 block mb-1">Link da Transcrição (Google Docs)</label>
          <input name="transcriptUrl" class="field" placeholder="https://docs.google.com/..." value="${r.transcriptUrl || ''}" />
        </div>
        <div class="flex items-center justify-between pt-2" style="border-top:1px solid var(--line);">
          <button type="button" id="mark-no-recording" class="btn-text">Marcar como sem gravação</button>
          <button type="submit" class="btn-primary" style="padding:9px 18px;font-size:12.5px;">Salvar</button>
        </div>
      </form>
    `,
  });
  el.querySelector('#recording-links-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    MockDB.setRecordingLinks(meeting.id, { recordingUrl: fd.get('recordingUrl').trim(), transcriptUrl: fd.get('transcriptUrl').trim() });
    close();
    toast('Links salvos.');
    onSaved?.();
  });
  el.querySelector('#mark-no-recording').addEventListener('click', () => {
    MockDB.markMeetingNoRecording(meeting.id);
    close();
    toast('Reunião marcada como sem gravação.');
    onSaved?.();
  });
}

// --- Teste de Arquétipos — reusable display pieces shared by the client
// quiz/results pages and Nay's admin Arquétipos tab. Data always comes from
// MockDB.calcArchetypeScores/getArchetypeResults (see mock-db.js); these are
// presentation-only, same split as the meeting-recording components above.

// 12-axis radar/spider chart, pure inline SVG (no charting library in this
// project) — one polygon tracing all 12 raw scores (0-20 scale) so nothing
// is ever visually hidden, per "everyone carries all 12" archetypes.
export function renderArchetypeRadar(scores, { size = 340 } = {}) {
  const n = scores.length;
  const cx = size / 2; const cy = size / 2;
  const maxR = size / 2 - 56; // leaves room for axis labels
  const angleFor = (i) => (Math.PI * 2 * i) / n - Math.PI / 2;
  const pointFor = (i, value) => {
    const r = (value / 20) * maxR;
    const a = angleFor(i);
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  };
  const ringLevels = [0.25, 0.5, 0.75, 1];
  const rings = ringLevels.map((level) => {
    const pts = scores.map((_, i) => pointFor(i, level * 20).join(',')).join(' ');
    return `<polygon points="${pts}" fill="none" stroke="rgba(242,236,224,.08)" stroke-width="1" />`;
  }).join('');
  const axes = scores.map((_, i) => {
    const [x, y] = pointFor(i, 20);
    return `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="rgba(242,236,224,.08)" stroke-width="1" />`;
  }).join('');
  const dataPts = scores.map((s, i) => pointFor(i, s.rawScore).join(',')).join(' ');
  const dots = scores.map((s, i) => {
    const [x, y] = pointFor(i, s.rawScore);
    return `<circle cx="${x}" cy="${y}" r="3.5" fill="var(--gold)" />`;
  }).join('');
  const labels = scores.map((s, i) => {
    const [x, y] = pointFor(i, 20 * 1.16);
    const anchor = Math.abs(x - cx) < 4 ? 'middle' : (x > cx ? 'start' : 'end');
    return `<text x="${x}" y="${y}" text-anchor="${anchor}" dominant-baseline="middle" font-size="11" fill="var(--muted)">${s.name}</text>`;
  }).join('');
  return `
    <svg viewBox="0 0 ${size} ${size}" style="width:100%; height:auto; max-width:${size}px;" role="img" aria-label="Mapa dos 12 arquétipos">
      ${rings}
      ${axes}
      <polygon points="${dataPts}" fill="rgba(184,134,58,.22)" stroke="var(--terracotta)" stroke-width="1.5" />
      ${dots}
      ${labels}
    </svg>
  `;
}

// Portrait or a graceful placeholder when the real asset isn't wired up yet
// (femaleImage/maleImage start null until the real files are dropped into
// app/assets/archetypes/ — see docs/13-archetype-quiz.md). Never distorts a
// real photo: object-fit:cover inside a fixed-ratio frame.
export function archetypePortrait(item, { size = 96 } = {}) {
  if (item.image) {
    return `<img src="${item.image}" alt="${item.name}" style="width:${size}px;height:${size}px;object-fit:cover;border-radius:8px;display:block;" />`;
  }
  return `<div style="width:${size}px;height:${size}px;border-radius:8px;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg, rgba(184,134,58,.35), rgba(220,199,168,.15)); border:1px solid rgba(220,199,168,.25);">
    <span style="font-family:'Playfair Display', serif; font-size:${Math.round(size * 0.32)}px; color:var(--cream);">${(item.name || '?')[0]}</span>
  </div>`;
}

// A single archetype's intensity as a bar — used alongside the percentage
// so scores are never communicated by color alone (accessibility).
export function archetypeIntensityBar(pct) {
  return `<div class="progress-track" style="height:6px;"><div class="progress-fill" style="width:${pct}%;"></div></div>`;
}

// Shared social-links display — same shape used by both leads and clients
// (see SOCIAL_PLATFORMS in mock-db.js), so profiles are one click away from
// Instagram/TikTok/LinkedIn/Facebook wherever they're shown.
const SOCIAL_ICON = { instagram: '📷', tiktok: '🎵', linkedin: '💼', facebook: '📘' };
const SOCIAL_LABEL = { instagram: 'Instagram', tiktok: 'TikTok', linkedin: 'LinkedIn', facebook: 'Facebook' };
export function renderSocialLinks(links, { emptyText = 'Nenhuma rede social cadastrada.' } = {}) {
  const entries = Object.entries(links || {}).filter(([, url]) => isValidHttpUrl(url));
  if (!entries.length) return `<p class="text-xs" style="color:var(--muted);">${emptyText}</p>`;
  return `
    <div class="flex items-center gap-2 flex-wrap">
      ${entries.map(([platform, url]) => `
        <a ${externalLinkAttrs(url)} class="btn-ghost" style="padding:6px 12px; font-size:12px;">${SOCIAL_ICON[platform] || ''} ${SOCIAL_LABEL[platform] || platform}</a>
      `).join('')}
    </div>
  `;
}

// --- Projetos / Guia de Produções reference-library card — shared so both
// pages read as one system (see assistant/projects.js and
// assistant/production-guides.js). One delivered deliverable: which client
// it came from, the brief the assistant left for her future self, the file,
// and the editable Canva source.
export function projectCard(p) {
  const fileOk = isValidAssetSrc(p.fileUrl);
  const canvaOk = isValidHttpUrl(p.canvaUrl);
  return card(`
    <div class="flex items-start justify-between gap-3 mb-2">
      <div>
        <p class="text-xs uppercase" style="color:var(--muted); letter-spacing:.1em;">${p.label}</p>
        <a href="client-workspace.html?id=${p.clientId}" class="text-lg font-serif hover:underline" style="color:var(--cream);">${p.clientName}</a>
      </div>
      ${p.deliveredAt ? `<span class="text-xs text-white/20 whitespace-nowrap">${formatDate(p.deliveredAt)}</span>` : ''}
    </div>
    <p class="text-sm text-white/50 mb-4">${p.summary || 'Sem resumo registrado — abra o arquivo para conferir o conteúdo.'}</p>
    <div class="flex items-center gap-3 flex-wrap">
      ${fileOk ? `<a ${assetLinkAttrs(p.fileUrl)} class="btn-ghost" style="padding:7px 14px;font-size:12px;">Ver arquivo ↗</a>` : ''}
      ${canvaOk ? `<a ${externalLinkAttrs(p.canvaUrl)} class="btn-ghost" style="padding:7px 14px;font-size:12px;">Abrir no Canva ↗</a>` : ''}
    </div>
  `);
}

// --- Conteúdos gateway cards — shared between the client-facing gateway
// (card = clickable <a> to Hubla) and the admin "Gerenciar conteúdos" panel
// (card = same visual, wrapped in a management toolbar instead of a link).
// A card without a real coverImage falls back to one of a small set of
// tasteful gradient tones (never a hotlinked third-party image).
const CONTENT_CARD_TONES = [
  'linear-gradient(165deg, rgba(66,46,32,.95), rgba(18,14,12,.98))',
  'linear-gradient(165deg, rgba(34,46,56,.95), rgba(15,18,21,.98))',
  'linear-gradient(165deg, rgba(50,41,33,.95), rgba(19,15,12,.98))',
  'linear-gradient(165deg, rgba(46,32,29,.95), rgba(17,13,11,.98))',
];
export function contentCardCoverStyle(cat) {
  if (isValidAssetSrc(cat.coverImage)) {
    return `background-image:linear-gradient(180deg, rgba(12,10,9,.1) 0%, rgba(12,10,9,.4) 55%, rgba(12,10,9,.92) 100%), url('${cat.coverImage}');`;
  }
  return `background-image:${CONTENT_CARD_TONES[(cat.coverTone || 0) % CONTENT_CARD_TONES.length]};`;
}
// Inner visual only (cover + title + description + CTA) — callers supply the
// clickable/interactive wrapper (an <a> for clients, a management div for
// admin) so this stays a single source of truth for the card's look.
export function contentCardInner(cat) {
  const linkOk = isValidHttpUrl(cat.hublaUrl);
  const hasImage = isValidAssetSrc(cat.coverImage);
  return `
    <div class="content-card-cover" style="${contentCardCoverStyle(cat)}">
      ${!hasImage ? '<div class="content-card-emblem" aria-hidden="true">❦</div>' : ''}
      <div class="content-card-overlay">
        <p class="content-card-title">${cat.title || 'Sem título'}</p>
        ${cat.description ? `<p class="content-card-desc">${cat.description}</p>` : ''}
        <span class="content-card-cta">
          ${linkOk ? 'Acessar na Hubla' : 'Em breve'}
          ${linkOk ? '<span class="content-card-ext" aria-hidden="true">↗</span>' : ''}
        </span>
      </div>
    </div>
  `;
}

// --- Pinterest board embed — shared between the client's Direção da Marca
// page (read-only workspace) and the admin's Direção da Marca editor tab
// (so Nay can see the actual board while editing it, not just the URL).
// See client/brand-direction.js's original notes on why the embed target
// is mounted in normal document flow (not hidden/off-screen) — Pinterest's
// widget skips elements it reads as not visible.
export function boardEmptyState() {
  return `
    <div class="board-state">
      <p class="font-serif" style="font-size:1.3rem;">O mural ainda não foi adicionado</p>
      <p class="text-xs text-white/40 max-w-sm">Assim que o board do Pinterest for definido, ele aparece bem aqui.</p>
    </div>
  `;
}
function boardLoadingState() {
  return `
    <div class="board-skeleton"></div>
    <div class="board-state" style="position:relative;">
      <p class="text-xs text-white/30">Carregando mural…</p>
    </div>
  `;
}
function boardErrorState(url, reason) {
  return `
    <div class="board-state">
      <p class="font-serif" style="font-size:1.3rem;">Não foi possível exibir o mural aqui</p>
      <p class="text-xs text-white/40 max-w-sm">${reason}</p>
      <a ${externalLinkAttrs(url)} class="btn-primary" style="padding:11px 22px;font-size:13px;">Abrir no Pinterest</a>
    </div>
  `;
}

// Mounts the Pinterest board into `container` (expected to have the
// `.board-area` class) via Pinterest's own oEmbed-derived iframe endpoint
// (assets.pinterest.com/ext/embed.html) — NOT the `pinit.js` "Save"
// widget/data-pin-do="embedBoard" script. That widget is what this page
// used before, and what most Pinterest widget-builder snippets still hand
// out (including third-party tools) — but it's a tracking-adjacent
// third-party script that ad blockers and browser tracking protection
// (Safari ITP, Brave, uBlock, etc.) commonly block outright, which is why
// boards kept failing to render regardless of the board being public.
// The embed.html endpoint below is what Pinterest's own oEmbed API
// (pinterest.com/oembed.json?url=...) resolves a board URL to — a plain,
// same-purpose-built-for-embedding iframe with no script/CSP/framing
// restrictions, confirmed by inspecting its response headers directly.
// Falls back to a polished card if the URL can't be parsed as a board path
// or the frame never loads (network-level block, offline, etc.).
export function mountPinterestBoard(container, url, { height = 420 } = {}) {
  let boardPath = '';
  try {
    boardPath = new URL(url).pathname.replace(/^\/+|\/+$/g, '');
  } catch {
    boardPath = '';
  }
  if (!boardPath) {
    container.innerHTML = boardErrorState(url, 'O link do Pinterest não parece apontar para um board válido (ex.: https://www.pinterest.com/usuario/nome-do-board/).');
    return;
  }

  const embedSrc = `https://assets.pinterest.com/ext/embed.html?grid=${boardPath}/&src=oembed`;
  container.innerHTML = `
    <div class="pin-embed-wrap">
      <iframe id="pin-embed-frame" src="${embedSrc}" width="100%" height="${height}" frameborder="0" scrolling="no" style="border:0; border-radius:6px; display:block; width:100%;" title="Mural do Pinterest"></iframe>
    </div>
    <div class="board-loading-overlay" id="board-loading-overlay">${boardLoadingState()}</div>
  `;
  const frame = document.getElementById('pin-embed-frame');
  let settled = false;
  // The iframe's `load` fires once its document finishes loading, whatever
  // that document turns out to be (real board grid or Pinterest's own "not
  // found" state for a private/removed board) — we can't inspect cross-origin
  // content, so this only confirms *something* loaded, not that it's the board.
  frame.addEventListener('load', () => {
    settled = true;
    document.getElementById('board-loading-overlay')?.remove();
  });
  setTimeout(() => {
    if (!settled) {
      container.innerHTML = boardErrorState(url, 'O Pinterest não respondeu a tempo — pode estar bloqueado por uma extensão do navegador, ou sem conexão. O link direto abaixo sempre funciona.');
    }
  }, 6000);
}

// --- CSV export — opens straight in Excel/Sheets. `headers` is an array of
// [dataKey, columnLabel] pairs; `rows` an array of plain objects. Values
// are read via headers' dataKey, so callers don't need to pre-shape rows
// beyond mapping any raw fields (booleans, dates) to display strings first.
export function downloadCSV(filename, headers, rows) {
  const escape = (v) => {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [
    headers.map(([, label]) => escape(label)).join(','),
    ...rows.map((row) => headers.map(([key]) => escape(row[key])).join(',')),
  ];
  // Leading BOM so Excel opens the accented Portuguese text as UTF-8 instead of guessing wrong.
  const blob = new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
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
          // The one phase a non-Premium tier can see but never enter (see
          // PREMIUM_ONLY_PHASE_INDEX) — shown locked with a 🔒, not folded
          // into the ordinary "not reached yet" state, so it reads as
          // "Premium content" rather than "coming up soon for you too".
          const premiumLocked = tier !== 'premium' && i === PREMIUM_ONLY_PHASE_INDEX;
          const state = premiumLocked ? 'premium' : i < currentIndex ? 'done' : i === currentIndex ? 'current' : 'locked';
          return `
            <button type="button" data-phase-index="${i}" data-phase-state="${state}" class="phase-node phase-${state}">
              <div class="phase-dot">${premiumLocked ? '&#128274;' : state === 'done' ? '&#10003;' : i + 1}</div>
              <div class="phase-label">${label}${premiumLocked ? ' <span class="premium-badge" style="font-size:9px; padding:1px 6px; vertical-align:1px;">Premium</span>' : ''}</div>
            </button>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

// Makes the phase tracker's nodes clickable — a completed phase takes her
// to the playbook/deliverables that were sent during it, the current phase
// to what she still needs to do, an upcoming one to its short preview.
// Each phase section (see client/program.js's renderPhaseSection) carries
// a matching `id="phase-section-<i>"`; if that section already lives in
// `root` (Seu Programa itself), clicking just opens + scrolls to it. If
// not (the Painel's copy of the tracker, which has no sections of its own),
// it follows `hrefBase` into Seu Programa with the phase in the hash.
export function wirePhaseTrackerNav(root, { hrefBase } = {}) {
  root.querySelectorAll('[data-phase-index]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const target = root.querySelector(`#phase-section-${btn.dataset.phaseIndex}`);
      if (target) {
        if (target.tagName === 'DETAILS') target.open = true;
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else if (hrefBase) {
        location.href = `${hrefBase}#phase-section-${btn.dataset.phaseIndex}`;
      }
    });
  });
}

// Encounter-scheduling requests — shared between Resumo (dashboard.js) and
// Encontros (encontros.js) so both ever show the exact same set/state for
// a request, never independently-drifting copies. Covers every open
// status: Nay's offered times to pick from, the decline-with-observation
// path when none work, and the two "waiting on Nay now" states, read-only.
export function renderEncounterRequestsCard(clientId) {
  const requests = MockDB.getEncounterRequests(clientId).filter((r) => !['confirmed', 'cancelled'].includes(r.status));
  if (!requests.length) return '';
  return card(`
    <p class="text-sm mb-1" style="color:var(--gold);">Solicitações de Agendamento</p>
    <div class="divide-y mt-3" style="border-color:var(--line);">
      ${requests.map((r) => {
        const def = ENCOUNTER_DEFS[r.encounterNumber - 1];
        const label = ENCOUNTER_LABEL[def.slug];
        if (r.status === 'awaiting_nay_confirmation') {
          return `
            <div class="py-4">
              <p class="text-sm font-medium mb-1">${label}</p>
              <p class="text-xs text-white/30">Horário escolhido: ${formatDateTime(r.selectedTime)} — aguardando confirmação.</p>
            </div>
          `;
        }
        if (r.status === 'client_unavailable') {
          return `
            <div class="py-4">
              <p class="text-sm font-medium mb-1">${label}</p>
              <p class="text-xs text-white/30">Observação enviada — aguardando novas opções de horário.</p>
            </div>
          `;
        }
        return `
          <div class="py-4">
            <p class="text-sm font-medium mb-2">${label}</p>
            <div class="space-y-2 mb-3">
              ${r.proposedTimes.map((t) => `
                <label class="flex items-center gap-2 text-sm">
                  <input type="radio" name="time-${r.id}" value="${t}" />
                  ${formatDateTime(t)}
                </label>
              `).join('')}
            </div>
            <div class="flex items-center gap-3 flex-wrap mb-3">
              <button type="button" data-select-time="${r.id}" class="btn-primary" style="padding:8px 16px;font-size:12.5px;">Confirmar Horário</button>
              <button type="button" data-toggle-decline="${r.id}" class="btn-text">Nenhum horário funciona</button>
            </div>
            <div class="hidden" data-decline-form="${r.id}">
              <textarea data-decline-note="${r.id}" rows="2" class="field text-sm" placeholder="Quando você costuma estar disponível?"></textarea>
              <button type="button" data-send-decline="${r.id}" class="btn-ghost mt-2">Enviar Observação</button>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `, 'mb-8');
}

// Wires the buttons rendered by renderEncounterRequestsCard — call once
// after inserting its HTML. onDone runs after either action succeeds
// (each page decides how to refresh: re-render or reload).
export function wireEncounterRequestForms(root, onDone) {
  root.querySelectorAll('[data-select-time]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.selectTime;
      const picked = root.querySelector(`input[name="time-${id}"]:checked`);
      if (!picked) { toast('Escolha um horário antes de confirmar.', { tone: 'error' }); return; }
      MockDB.selectEncounterMeetingTime(id, picked.value);
      toast('Horário enviado — aguardando confirmação.');
      onDone();
    });
  });
  root.querySelectorAll('[data-toggle-decline]').forEach((btn) => {
    btn.addEventListener('click', () => {
      root.querySelector(`[data-decline-form="${btn.dataset.toggleDecline}"]`)?.classList.toggle('hidden');
    });
  });
  root.querySelectorAll('[data-send-decline]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.sendDecline;
      const note = root.querySelector(`[data-decline-note="${id}"]`)?.value || '';
      MockDB.declineEncounterMeetingTimes(id, note.trim());
      toast('Observação enviada.');
      onDone();
    });
  });
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

// Numbered section header, e.g. "01 — 06 · PROGRESSO DA ETAPA" — the
// step-through, product-configurator feel from the Euveka reference.
export function stepEyebrow(current, total, label) {
  const pad = (n) => String(n).padStart(2, '0');
  return `
    <p class="eyebrow flex items-center gap-2">
      <span style="color:var(--gold);">${pad(current)} — ${pad(total)}</span>
      <span style="color:var(--terracotta); opacity:.6;">·</span>
      <span>${label}</span>
    </p>
  `;
}

// Scroll-triggered reveal: elements with .reveal-scroll stay hidden until
// they cross into view, then play the same rise-and-fade as the load-time
// .reveal animation. Call once after injecting HTML containing the class.
export function initScrollReveal(root = document) {
  const els = root.querySelectorAll('.reveal-scroll:not(.is-visible)');
  if (!('IntersectionObserver' in window)) {
    els.forEach((el) => el.classList.add('is-visible'));
    return;
  }
  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });
  els.forEach((el) => io.observe(el));
}

// Subtle magnetic/tilt effect on interactive cards — cursor-tracked, eases
// back to neutral on leave. Call once after injecting HTML containing
// .tilt-card elements.
export function enableTilt(root = document) {
  root.querySelectorAll('.tilt-card:not([data-tilt-bound])').forEach((el) => {
    el.setAttribute('data-tilt-bound', '1');
    el.addEventListener('pointermove', (e) => {
      const rect = el.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;
      el.style.transform = `perspective(900px) rotateY(${(x * 5).toFixed(2)}deg) rotateX(${(-y * 5).toFixed(2)}deg) translateY(-3px)`;
    });
    el.addEventListener('pointerleave', () => { el.style.transform = ''; });
  });
}

// Counts a number up from 0 with ease-out — used for stat callouts
// (percentages, scores) so the dashboard feels alive rather than static.
export function animateCount(el, target, { duration = 1100, suffix = '' } = {}) {
  const start = performance.now();
  function tick(now) {
    const p = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - p, 3);
    el.textContent = Math.round(target * eased) + suffix;
    if (p < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}
