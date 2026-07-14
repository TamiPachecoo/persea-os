import { MockDB } from '../shared/mock-db.js';
import { renderShell, card, formatDate } from '../shared/ui.js';

document.body.innerHTML = renderShell({ role: 'client', active: 'playbook.html', title: 'Personal Brand Playbook' });

const published = MockDB.getPublishedPlaybook();
const sectionDefs = MockDB.getSectionDefs();
const content = document.getElementById('app-content');

if (!published) {
  content.innerHTML = card(`
    <p class="text-white/50">Your playbook isn't published yet. Your consultant is still refining it — check back soon.</p>
  `);
} else {
  content.innerHTML = `
    <div class="mb-8 flex items-center justify-between">
      <p class="text-sm text-white/40">Version ${published.version} · Published ${formatDate(published.createdAt)}</p>
      <div class="hidden md:flex gap-1 flex-wrap justify-end">
        ${sectionDefs.map(([key, title]) => `<a href="#${key}" class="text-xs px-2 py-1 rounded-full border border-white/10 text-white/50 hover:text-white hover:border-white/30">${title}</a>`).join('')}
      </div>
    </div>
    <div class="space-y-6">
      ${sectionDefs.map(([key, title]) => `
        <div id="${key}" class="rounded-2xl border border-white/10 bg-white/[0.03] p-6 scroll-mt-24">
          <p class="text-xs uppercase tracking-wider text-white/40 mb-2">${title}</p>
          <p class="text-lg leading-relaxed font-serif">${published.sections[key]}</p>
        </div>
      `).join('')}
    </div>
  `;
}
