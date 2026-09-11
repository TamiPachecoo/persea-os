// Production Data Migration — Batch 3: converted off MockDB onto the real
// `client_activity_log` (exact concept match — client_activity_log_client_read
// RLS already scoped to profiles.client_id; read-only for the client, same
// as before — this is a system/staff-generated feed, not something she
// edits).
import { getCurrentClientContext } from '../shared/client-context.js';
import { supabase } from '../shared/supabase-client.js';
import { renderShell, card, formatDateTime, initClientSwitcher } from '../shared/ui.js';

const __clientCtx = await getCurrentClientContext('../login.html', { page: 'activity' });
if (!__clientCtx) throw new Error('not authorized');
const activeClientId = __clientCtx.clientId;
document.body.innerHTML = renderShell({ role: 'client', active: 'activity.html', title: 'Atividade' });
initClientSwitcher();

const { data: events } = await supabase.from('client_activity_log').select('*').eq('client_id', activeClientId).order('occurred_at', { ascending: false });

document.getElementById('app-content').innerHTML = events && events.length ? card(`
  <div class="space-y-4">
    ${events.map((e, i) => `
      <div class="flex items-start gap-4 py-3 border-b border-white/5 last:border-0 reveal" style="animation-delay:${(i * 0.06).toFixed(2)}s;">
        <div class="w-2 h-2 mt-2 rounded-full bg-[#e8c99b] shrink-0"></div>
        <div>
          <p>${e.text}</p>
          <p class="text-xs text-white/30 mt-1">${formatDateTime(e.occurred_at)}</p>
        </div>
      </div>
    `).join('')}
  </div>
`) : card('<p class="text-sm" style="color:var(--muted);">Nenhuma atividade registrada ainda.</p>');
