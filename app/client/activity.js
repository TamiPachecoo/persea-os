import { MockDB } from '../shared/mock-db.js';
import { getCurrentClientContext } from '../shared/client-context.js';
import { renderShell, card, formatDateTime, initClientSwitcher } from '../shared/ui.js';

const __clientCtx = await getCurrentClientContext();
if (!__clientCtx) throw new Error('not authorized');
const activeClientId = __clientCtx.clientId;
document.body.innerHTML = renderShell({ role: 'client', active: 'activity.html', title: 'Atividade' });
initClientSwitcher();

const events = MockDB.getActivity(activeClientId);
document.getElementById('app-content').innerHTML = card(`
  <div class="space-y-4">
    ${events.map((e, i) => `
      <div class="flex items-start gap-4 py-3 border-b border-white/5 last:border-0 reveal" style="animation-delay:${(i * 0.06).toFixed(2)}s;">
        <div class="w-2 h-2 mt-2 rounded-full bg-[#e8c99b] shrink-0"></div>
        <div>
          <p>${e.text}</p>
          <p class="text-xs text-white/30 mt-1">${formatDateTime(e.at)}</p>
        </div>
      </div>
    `).join('')}
  </div>
`);
