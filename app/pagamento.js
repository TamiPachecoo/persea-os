// Payment options shown by the QR code at the end of the PERSEA Experience pitch.
// Step 1: name, WhatsApp and Instagram go to event_offer_signups (via the
// event-offer-signup Edge Function) so the team can follow up — listed in the
// CRM's Eventos tab. Step 2: Pix (key or the static "copia e cola" code, same as
// shared/assets/pix-qr-code.jpg) or card via SumUp; the chosen option is recorded too.
const ENDPOINT = 'https://bletlyuptkppacjcbcvw.supabase.co/functions/v1/event-offer-signup';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_37D7JJzhUDCUwtHtYA4gjw_jiSXDMxu';
const PIX_KEY = '+5531997078270';
const PIX_COPIA_E_COLA = '00020126360014br.gov.bcb.pix0114+55319970782705204000053039865802BR5920NAYANA MURTA MARTINS6009Sao Paulo62290525REC6AA9BE80877B26925890586304B9C2';
const KEY = 'persea-pagamento';

const $ = (id) => document.getElementById(id);
const toast = (msg) => { const t = $('toast'); t.textContent = msg; t.classList.add('on'); setTimeout(() => t.classList.remove('on'), 2600); };
const store = { get() { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { return null; } }, set(v) { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch (e) { /* private mode */ } } };

const post = (body) => fetch(ENDPOINT, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`, apikey: SUPABASE_PUBLISHABLE_KEY },
  body: JSON.stringify(body),
});

function showPay(saved) {
  $('who').classList.add('hidden'); $('leadForm').classList.add('hidden');
  $('pay').classList.remove('hidden'); $('leadPay').classList.remove('hidden');
  $('hello').textContent = saved && saved.name ? `Obrigada, ${saved.name.split(/\s+/)[0]}!` : '';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
function showForm() {
  $('pay').classList.add('hidden'); $('leadPay').classList.add('hidden');
  $('who').classList.remove('hidden'); $('leadForm').classList.remove('hidden');
}

$('who').addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = $('name').value.trim(), phone = $('phone').value.trim(), instagram = $('insta').value.trim();
  const err = $('err'); err.textContent = '';
  if (name.length < 2) { err.textContent = 'Escreva o seu nome.'; $('name').focus(); return; }
  if (phone.replace(/\D/g, '').length < 10) { err.textContent = 'Informe o seu WhatsApp com DDD.'; $('phone').focus(); return; }
  const btn = $('go'); btn.disabled = true; btn.textContent = 'Enviando…';
  let id = null;
  try {
    const res = await post({ name, phone, instagram, website: $('website').value });
    const data = await res.json().catch(() => ({}));
    if (!res.ok && res.status === 400) { err.textContent = data.error || 'Confira os dados.'; btn.disabled = false; btn.textContent = 'Continuar para o pagamento'; return; }
    id = data.id || null;
  } catch (e2) { /* offline or blocked: never stand between her and paying */ }
  const saved = { id, name, phone, instagram };
  store.set(saved);
  btn.disabled = false; btn.textContent = 'Continuar para o pagamento';
  showPay(saved);
});

const choose = (choice) => { const s = store.get(); if (s && s.id) post({ id: s.id, payment_choice: choice }).catch(() => {}); };

$('copyKey').addEventListener('click', async () => { choose('pix'); toast(await copy(PIX_KEY) ? 'Chave Pix copiada.' : 'Toque e segure a chave para copiar.'); });
$('copyCode').addEventListener('click', async () => { choose('pix'); toast(await copy(PIX_COPIA_E_COLA) ? 'Pix Copia e Cola copiado.' : 'Não foi possível copiar automaticamente.'); });
$('card').addEventListener('click', () => choose('cartao'));
$('edit').addEventListener('click', () => {
  const s = store.get() || {};
  $('name').value = s.name || ''; $('phone').value = s.phone || ''; $('insta').value = s.instagram || '';
  showForm();
});

async function copy(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch (e) {
    const ta = Object.assign(document.createElement('textarea'), { value: text });
    ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select();
    let ok = false; try { ok = document.execCommand('copy'); } catch (err) { ok = false; }
    ta.remove(); return ok;
  }
}

const saved = store.get();
if (saved && saved.name) showPay(saved);
