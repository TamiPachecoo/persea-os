import { renderParticles, toast, initScrollReveal, enableTilt } from './shared/ui.js';

document.getElementById('particles-mount').innerHTML = renderParticles(14);
initScrollReveal();
enableTilt();

const LEADS_KEY = 'persea_landing_leads';

function saveLead(lead) {
  const leads = JSON.parse(localStorage.getItem(LEADS_KEY) || '[]');
  leads.push({ ...lead, at: new Date().toISOString() });
  localStorage.setItem(LEADS_KEY, JSON.stringify(leads));
}

const form = document.getElementById('lead-form');
form.addEventListener('submit', (e) => {
  e.preventDefault();
  const name = document.getElementById('lead-name').value.trim();
  const email = document.getElementById('lead-email').value.trim();
  const whatsapp = document.getElementById('lead-whatsapp').value.trim();

  if (!name || !email || !whatsapp) {
    toast('Preencha todos os campos antes de enviar.', { tone: 'error' });
    return;
  }

  saveLead({ name, email, whatsapp });
  form.classList.add('hidden');
  document.getElementById('lead-success').classList.remove('hidden');
  toast('Contato enviado com sucesso!');
});
