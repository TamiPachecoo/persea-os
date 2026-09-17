import { renderParticles, toast, initScrollReveal, enableTilt } from './shared/ui.js';

document.getElementById('particles-mount').innerHTML = renderParticles(14);
initScrollReveal();
enableTilt();

const LEADS_KEY = 'persea_landing_leads';

// FormSubmit requires a one-time click-to-confirm on the FIRST submission to a
// new address before it will actually deliver anything after that.
const FORMSUBMIT_ENDPOINT = 'https://formsubmit.co/ajax/naymurta@gmail.com';

// Real database record — a landing-lead-capture Edge Function on the same
// Supabase project PERSEA OS runs on (app.naymurta.com, a separate
// deployment from this static site). It writes into the real `leads`
// table Nay's CRM already reads from, so a homepage submission shows up
// there automatically instead of only ever reaching a visitor's own
// localStorage or an email inbox. The table itself stays staff-only RLS —
// this function is the one narrow, validated door into it from the
// public site. The publishable key is safe to expose client-side; every
// real access rule is enforced server-side, not by keeping this secret.
const SUPABASE_URL = 'https://bletlyuptkppacjcbcvw.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_37D7JJzhUDCUwtHtYA4gjw_jiSXDMxu';
const LEAD_CAPTURE_ENDPOINT = `${SUPABASE_URL}/functions/v1/landing-lead-capture`;

function saveLeadLocally(lead) {
  const leads = JSON.parse(localStorage.getItem(LEADS_KEY) || '[]');
  leads.push({ ...lead, at: new Date().toISOString() });
  localStorage.setItem(LEADS_KEY, JSON.stringify(leads));
}

const form = document.getElementById('lead-form');
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = document.getElementById('lead-name').value.trim();
  const email = document.getElementById('lead-email').value.trim();
  const whatsapp = document.getElementById('lead-whatsapp').value.trim();

  if (!name || !email || !whatsapp) {
    toast('Preencha todos os campos antes de enviar.', { tone: 'error' });
    return;
  }

  const submitBtn = form.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Enviando…';

  // The real record: this is the one that has to succeed for the
  // submission to count — it's what makes the lead show up in Nay's CRM.
  let savedForReal = false;
  try {
    const res = await fetch(LEAD_CAPTURE_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: SUPABASE_PUBLISHABLE_KEY },
      body: JSON.stringify({ name, email, whatsapp }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.error) throw new Error(data.error || 'lead capture request failed');
    savedForReal = true;
  } catch (err) {
    // Last-resort safety net so nothing is silently lost if the function
    // or the database is briefly unreachable — not a substitute for the
    // real record, just a way to recover one by hand if this ever fires.
    saveLeadLocally({ name, email, whatsapp });
  }

  // Best-effort email ping — nice to have for an immediate heads-up, but
  // never blocks the success screen: the real record above already landed.
  try {
    await fetch(FORMSUBMIT_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        Nome: name,
        Email: email,
        WhatsApp: whatsapp,
        _subject: 'Novo contato — Landing Page PERSEA',
      }),
    });
  } catch (err) {
    // Silent — the lead is already safely recorded either way.
  }

  if (!savedForReal) {
    toast('Não foi possível enviar agora. Tente novamente em instantes ou fale direto pelo Instagram.', { tone: 'error' });
    submitBtn.disabled = false;
    submitBtn.textContent = 'Enviar';
    return;
  }

  form.classList.add('hidden');
  document.getElementById('lead-success').classList.remove('hidden');
  toast('Contato enviado com sucesso!');
});
