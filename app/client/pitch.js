// Production Data Migration — Batch 2: converted off MockDB onto the real
// `pitches` table (exact column match: pitch_10s/30s/60s, pitch_networking,
// instagram_bio, linkedin_summary — all admin-authored, one row per
// client). RLS confirmed (pitches_client_read, scoped to profiles.client_id)
// before writing this.
import { getCurrentClientContext } from '../shared/client-context.js';
import { supabase } from '../shared/supabase-client.js';
import { renderShell, card, toast, stepEyebrow, initScrollReveal, enableTilt, initClientSwitcher } from '../shared/ui.js';

const __clientCtx = await getCurrentClientContext('../login.html', { page: 'pitch' });
if (!__clientCtx) throw new Error('not authorized');
const activeClientId = __clientCtx.clientId;
document.body.innerHTML = renderShell({ role: 'client', active: 'pitch.html', title: 'Seu Pitch' });
initClientSwitcher();

const { data: pitches } = await supabase.from('pitches').select('*').eq('client_id', activeClientId).maybeSingle();
const content = document.getElementById('app-content');

const LABELS = {
  pitch_10s: 'Pitch de 10 Segundos', pitch_30s: 'Pitch de 30 Segundos', pitch_60s: 'Pitch de 60 Segundos',
  pitch_networking: 'Versão para Networking', instagram_bio: 'Bio do Instagram', linkedin_summary: 'Resumo do LinkedIn',
};

if (!pitches) {
  content.innerHTML = card(`<p class="text-white/50">Suas variações de pitch ainda não foram geradas — elas aparecerão aqui assim que sua consultora publicá-las.</p>`);
} else {
  const entries = Object.entries(LABELS).filter(([key]) => pitches[key]);
  content.innerHTML = entries.length ? `
    <div class="grid md:grid-cols-2 gap-6">
      ${entries.map(([key, label], i) => `
        <div class="card tilt-card reveal-scroll">
          <div class="flex items-center justify-between mb-3">
            ${stepEyebrow(i + 1, entries.length, label)}
            <button data-copy="${key}" class="text-xs text-white/40 hover:text-white">Copiar</button>
          </div>
          <p class="leading-relaxed">${pitches[key]}</p>
        </div>
      `).join('')}
    </div>
  ` : card(`<p class="text-white/50">Suas variações de pitch ainda não foram geradas — elas aparecerão aqui assim que sua consultora publicá-las.</p>`);

  content.querySelectorAll('[data-copy]').forEach((btn) => {
    btn.addEventListener('click', () => {
      navigator.clipboard.writeText(pitches[btn.dataset.copy]);
      toast('Copiado para a área de transferência.');
    });
  });
  initScrollReveal();
  enableTilt();
}
