import { MockDB } from '../shared/mock-db.js';
import { renderShell, card, toast } from '../shared/ui.js';

document.body.innerHTML = renderShell({ role: 'client', active: 'pitch.html', title: 'Your Pitch' });

const pitches = MockDB.getPitches();
const content = document.getElementById('app-content');

const LABELS = {
  pitch_10s: '10 Second Pitch', pitch_30s: '30 Second Pitch', pitch_60s: '60 Second Pitch',
  pitch_networking: 'Networking Version', instagram_bio: 'Instagram Bio', linkedin_summary: 'LinkedIn Summary',
};

if (!pitches) {
  content.innerHTML = card(`<p class="text-white/50">Your pitch variants haven't been generated yet — they'll appear here once your consultant publishes them.</p>`);
} else {
  content.innerHTML = `
    <div class="grid md:grid-cols-2 gap-6">
      ${Object.entries(LABELS).map(([key, label]) => `
        <div class="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          <div class="flex items-center justify-between mb-3">
            <p class="text-xs uppercase tracking-wider text-white/40">${label}</p>
            <button data-copy="${key}" class="text-xs text-white/40 hover:text-white">Copy</button>
          </div>
          <p class="leading-relaxed">${pitches[key]}</p>
        </div>
      `).join('')}
    </div>
  `;

  content.querySelectorAll('[data-copy]').forEach((btn) => {
    btn.addEventListener('click', () => {
      navigator.clipboard.writeText(pitches[btn.dataset.copy]);
      toast('Copied to clipboard.');
    });
  });
}
