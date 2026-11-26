// Staff OS sidebar (Nov 2026 redesign): every active student, grouped by
// program — Persea Premium, Persea Essencial, then Ascensão da Marca —
// with a search box. The open student (?id= on her page) is highlighted.
// Mounted lazily by renderShell for admin/assistant, so it never slows the
// page; demo clients (is_demo) stay out of it.
import { supabase } from './supabase-client.js';
import { icon } from './icons.js';

const GROUPS = [
  { key: 'premium', label: 'Persea Premium', test: (c) => c.program_slug === 'persea-premium' || (c.program_slug?.startsWith('persea') && c.tier === 'premium') },
  { key: 'essential', label: 'Persea Essencial', test: (c) => c.program_slug?.startsWith('persea') },
  { key: 'ascensao', label: 'Ascensão da Marca', test: (c) => c.program_slug === 'ascensao-marca' },
  { key: 'other', label: 'Outros', test: () => true },
];
const PROGRAM_SUB = { 'persea-premium': 'Persea Premium', 'persea-essential': 'Persea Essencial', 'ascensao-marca': 'Ascensão da Marca' };
const esc = (v) => String(v ?? '').replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
const initials = (n) => String(n || '?').trim().split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();

export function avatarHtml(c, size = 40) {
  const ok = /^https?:\/\//i.test(c.photo_url || '');
  return ok
    ? `<span class="os-avatar" style="width:${size}px;height:${size}px;"><img src="${esc(c.photo_url)}" alt="" loading="lazy" onerror="this.parentNode.textContent='${initials(c.full_name)}'"></span>`
    : `<span class="os-avatar" style="width:${size}px;height:${size}px;font-size:${Math.round(size * 0.36)}px;">${initials(c.full_name)}</span>`;
}

let clientsCache = null;
async function loadClients() {
  if (!clientsCache) {
    clientsCache = supabase.from('clients').select('id, full_name, program_slug, tier, status, photo_url, is_demo, access_status')
      .order('full_name').then(({ data }) => (data || []).filter((c) => !c.is_demo && c.status !== 'archived'));
  }
  return clientsCache;
}

export async function mountStaffSidebar(root, { role, clientHref }) {
  if (!root) return;
  const list = await loadClients();
  const activeId = new URLSearchParams(location.search).get('id');
  let query = '';
  const norm = (v) => String(v || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const draw = () => {
    const q = norm(query);
    const shown = list.filter((c) => !q || norm(c.full_name).includes(q));
    const used = new Set();
    const groups = GROUPS.map((g) => {
      const items = shown.filter((c) => !used.has(c.id) && g.test(c));
      items.forEach((c) => used.add(c.id));
      return { ...g, items };
    }).filter((g) => g.items.length);
    root.querySelector('[data-os-list]').innerHTML = groups.length ? groups.map((g) => `
      <div class="os-side-group">
        <p class="os-side-group-title">${g.label} <span>${g.items.length}</span></p>
        ${g.items.map((c) => `
          <a href="${clientHref(c.id)}" class="os-side-item ${c.id === activeId ? 'on' : ''}">
            ${avatarHtml(c, 38)}
            <span class="min-w-0">
              <span class="os-side-name">${esc(c.full_name)}</span>
              <span class="os-side-sub">${c.status === 'onboarding' ? '<i class="os-dot os-dot-gold"></i>Em cadastro' : esc(PROGRAM_SUB[c.program_slug] || c.program_slug || '')}</span>
            </span>
          </a>`).join('')}
      </div>`).join('') : `<p class="os-side-empty">${query ? 'Nenhum cliente com esse nome.' : 'Nenhum cliente ainda.'}</p>`;
  };
  root.innerHTML = `
    <div class="os-side-head">
      <p class="os-side-title">Clientes</p>
      ${role === 'admin' ? `<a href="/admin/crm.html?novo=1" class="os-icon-btn" title="Novo cliente">${icon('plus', 18)}</a>` : ''}
    </div>
    <label class="os-search">
      ${icon('search', 16)}
      <input type="search" placeholder="Buscar cliente…" data-os-search autocomplete="off" />
    </label>
    <div class="os-side-list" data-os-list></div>`;
  draw();
  root.querySelector('[data-os-search]').addEventListener('input', (e) => { query = e.target.value; draw(); });
  root.querySelector('.os-side-item.on')?.scrollIntoView({ block: 'nearest' });
}
