import { MockDB } from '../shared/mock-db.js';
import { renderShell, card, toast } from '../shared/ui.js';

document.body.innerHTML = renderShell({ role: 'client', active: 'pitch.html', title: 'Seu Discurso' });

const pitches = MockDB.getPitches();
const content = document.getElementById('app-content');

const LABELS = {
  pitch_10s: 'Discurso de 10 Segundos', pitch_30s: 'Discurso de 30 Segundos', pitch_60s: 'Discurso de 60 Segundos',
  pitch_networking: 'Versão para Networking', instagram_bio: 'Bio do Instagram', linkedin_summary: 'Resumo do LinkedIn',
};

if (!pitches) {
  content.innerHTML = card(`<p class="text-white/50">Suas variações de discurso ainda não foram geradas — elas aparecerão aqui assim que sua consultora publicá-las.</p>`);
} else {
  content.innerHTML = `
    <div class="grid md:grid-cols-2 gap-6">
      ${Object.entries(LABELS).map(([key, label]) => `
        <div class="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          <div class="flex items-center justify-between mb-3">
            <p class="text-xs uppercase tracking-wider text-white/40">${label}</p>
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
}
