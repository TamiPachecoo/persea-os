import { renderParticles, toast, initScrollReveal, enableTilt } from './shared/ui.js';

document.getElementById('particles-mount').innerHTML = renderParticles(14);
initScrollReveal();
enableTilt();

const LEADS_KEY = 'persea_landing_leads';

// TEMPORARY test destination — swap for Nay's real inbox once confirmed working.
// FormSubmit requires a one-time click-to-confirm on the FIRST submission to a
// new address before it will actually deliver anything after that.
const FORMSUBMIT_ENDPOINT = 'https://formsubmit.co/ajax/pachecootami@gmail.com';

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
    if (!res.ok) throw new Error('FormSubmit request failed');

    saveLead({ name, email, whatsapp });
    form.classList.add('hidden');
    document.getElementById('lead-success').classList.remove('hidden');
    toast('Contato enviado com sucesso!');
  } catch (err) {
    toast('Não foi possível enviar agora. Tente novamente em instantes.', { tone: 'error' });
    submitBtn.disabled = false;
    submitBtn.textContent = 'Enviar';
  }
});
