// Payment options shown by the QR code at the end of the PERSEA Experience pitch:
// Pix (key or the static "copia e cola" code, same as shared/assets/pix-qr-code.jpg) or card via SumUp.
const PIX_KEY = '+5531997078270';
const PIX_COPIA_E_COLA = '00020126360014br.gov.bcb.pix0114+55319970782705204000053039865802BR5920NAYANA MURTA MARTINS6009Sao Paulo62290525REC6AA9BE80877B26925890586304B9C2';

const $ = (id) => document.getElementById(id);
const toast = (msg) => { const t = $('toast'); t.textContent = msg; t.classList.add('on'); setTimeout(() => t.classList.remove('on'), 2600); };

async function copy(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch (e) {
    const ta = Object.assign(document.createElement('textarea'), { value: text });
    ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select();
    let ok = false; try { ok = document.execCommand('copy'); } catch (err) { ok = false; }
    ta.remove(); return ok;
  }
}

$('copyKey').addEventListener('click', async () => toast(await copy(PIX_KEY) ? 'Chave Pix copiada.' : 'Toque e segure a chave para copiar.'));
$('copyCode').addEventListener('click', async () => toast(await copy(PIX_COPIA_E_COLA) ? 'Pix Copia e Cola copiado.' : 'Não foi possível copiar automaticamente.'));
