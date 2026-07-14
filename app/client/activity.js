import { MockDB, DEFAULT_CLIENT_ID } from '../shared/mock-db.js';
import { renderShell, card, formatDateTime } from '../shared/ui.js';

document.body.innerHTML = renderShell({ role: 'client', active: 'activity.html', title: 'Atividade' });

const events = MockDB.getActivity(DEFAULT_CLIENT_ID);
document.getElementById('app-content').innerHTML = card(`
  <div class="space-y-4">
    ${events.map((e) => `
      <div class="flex items-start gap-4 py-3 border-b border-white/5 last:border-0">
        <div class="w-2 h-2 mt-2 rounded-full bg-[#e8c99b] shrink-0"></div>
        <div>
          <p>${e.text}</p>
          <p class="text-xs text-white/30 mt-1">${formatDateTime(e.at)}</p>
        </div>
      </div>
    `).join('')}
  </div>
`);
