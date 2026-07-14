import { MockDB, DEFAULT_CLIENT_ID } from '../shared/mock-db.js';
import { renderShell, card } from '../shared/ui.js';

document.body.innerHTML = renderShell({ role: 'client', active: 'notes.html', title: 'Suas Notas' });

const notes = MockDB.getNotes(DEFAULT_CLIENT_ID);
const content = document.getElementById('app-content');

content.innerHTML = card(`
  <p class="text-xs mb-4" style="color:var(--muted);">
    Um espaço só seu — privado, visível apenas para você. Use para anotar dúvidas, insights ou lembretes ao longo da jornada.
  </p>
  <textarea id="notes-field" rows="14" class="field" style="line-height:1.7;" placeholder="Escreva aqui...">${notes}</textarea>
  <div class="flex items-center justify-between mt-3">
    <span id="save-status" class="text-xs" style="color:var(--muted);">&nbsp;</span>
  </div>
`);

const field = document.getElementById('notes-field');
const status = document.getElementById('save-status');
let saveTimer = null;

field.addEventListener('input', () => {
  status.textContent = 'Salvando…';
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    MockDB.saveNotes(DEFAULT_CLIENT_ID, field.value);
    status.textContent = 'Salvo.';
  }, 500);
});
