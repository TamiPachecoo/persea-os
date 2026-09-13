// Production Migration: Playbook + Quiz + Notes — audited, NOT converted.
// This page is a private client journal (MockDB.getNotes/saveNotes, a
// single free-text blob per client). The real schema has no table for
// that: the only notes-shaped table is whatsapp_notes (client_id, text,
// created_at), which is staff-only by RLS (whatsapp_notes_staff_all,
// admin+assistant, no client policy at all) — it's Nay's own log of
// WhatsApp interactions, not a client-editable personal journal. Per the
// explicit instruction to report a missing model rather than invent unsafe
// schema, this page is intentionally NOT in PRODUCTION_READY_PAGES (see
// shared/client-context.js) — a real client hitting this page in
// production gets the existing honest "esta área ainda está sendo
// preparada" notice, same as any not-yet-converted page. Demo/staging is
// unaffected; this file still works exactly as before there.
import { MockDB } from '../shared/mock-db.js';
import { getCurrentClientContext } from '../shared/client-context.js';
import { renderShell, card, initClientSwitcher } from '../shared/ui.js';

const __clientCtx = await getCurrentClientContext('../login.html', { page: 'notes' });
if (!__clientCtx) throw new Error('not authorized');
const activeClientId = __clientCtx.clientId;
document.body.innerHTML = renderShell({ role: 'client', active: 'notes.html', title: 'Suas Notas' });
initClientSwitcher();

const notes = MockDB.getNotes(activeClientId);
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
    MockDB.saveNotes(activeClientId, field.value);
    status.textContent = 'Salvo.';
  }, 500);
});
