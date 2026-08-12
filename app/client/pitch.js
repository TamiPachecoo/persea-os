import { MockDB, getActiveClientId } from '../shared/mock-db.js';
import { renderShell, card, toast, stepEyebrow, initScrollReveal, enableTilt, initClientSwitcher } from '../shared/ui.js';

const activeClientId = getActiveClientId();
document.body.innerHTML = renderShell({ role: 'client', active: 'pitch.html', title: 'Seu Pitch' });
initClientSwitcher();

const pitches = MockDB.getPitches(activeClientId);
const content = document.getElementById('app-content');

const LABELS = {
  pitch_10s: 'Pitch de 10 Segundos', pitch_30s: 'Pitch de 30 Segundos', pitch_60s: 'Pitch de 60 Segundos',
  pitch_networking: 'Versão para Networking', instagram_bio: 'Bio do Instagram', linkedin_summary: 'Resumo do LinkedIn',
};

if (!pitches) {
  content.innerHTML = card(`<p class="text-white/50">Suas variações de pitch ainda não foram geradas — elas aparecerão aqui assim que sua consultora publicá-las.</p>`);
} else {
  const entries = Object.entries(LABELS);
  content.innerHTML = `
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
  `;

  content.querySelectorAll('[data-copy]').forEach((btn) => {
    btn.addEventListener('click', () => {
      navigator.clipboard.writeText(pitches[btn.dataset.copy]);
      toast('Copiado para a área de transferência.');
    });
  });
  initScrollReveal();
  enableTilt();
}
