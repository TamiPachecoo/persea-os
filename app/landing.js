import { renderParticles, toast, initScrollReveal, enableTilt } from './shared/ui.js';

document.getElementById('particles-mount').innerHTML = renderParticles(14);
initScrollReveal();
enableTilt();

const LEADS_KEY = 'persea_landing_leads';

// FormSubmit requires a one-time click-to-confirm on the FIRST submission to a
// new address before it will actually deliver anything after that.
const FORMSUBMIT_ENDPOINT = 'https://formsubmit.co/ajax/naymurta@gmail.com';

function saveLead(lead) {
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

  // Always keep a local copy first — FormSubmit can reject (e.g. destination
  // not activated yet) while still returning HTTP 200, so this is the only
  // guaranteed record if the remote send silently fails.
  saveLead({ name, email, whatsapp });

  try {
    const res = await fetch(FORMSUBMIT_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        Nome: name,
        Email: email,
        WhatsApp: whatsapp,
        _subject: 'Novo contato — Landing Page PERSEA',
      }),
    });
    const data = await res.json().catch(() => ({}));
    // FormSubmit returns HTTP 200 even when it rejects the submission (e.g.
    // destination email not yet activated) — the real result is in the body.
    if (!res.ok || data.success === false || data.success === 'false') {
      throw new Error(data.message || 'FormSubmit request failed');
    }

    form.classList.add('hidden');
    document.getElementById('lead-success').classList.remove('hidden');
    toast('Contato enviado com sucesso!');
  } catch (err) {
    toast('Não foi possível enviar agora. Tente novamente em instantes ou fale direto pelo Instagram.', { tone: 'error' });
    submitBtn.disabled = false;
    submitBtn.textContent = 'Enviar';
  }
});
