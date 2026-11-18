// How each team member introduces herself and signs the messages the system
// prepares (WhatsApp / e-mail). Model (Tami):
//
//   Olá, Will! Aqui é a Tami, do departamento de tecnologia e inovação da Nay. ✨
//   …
//   Com carinho,
//   Tami Pacheco
//
//   Tech • Inovação
//   PERSEA
//   ⚜️
//
// Stored per person in staff_signatures (each edits her own in "Minha
// assinatura"). Without one, the old short sign-off stays.
import { supabase } from './supabase-client.js';
import { openModal, toast } from './ui.js';

const clean = (s) => String(s || '').replace(/\(.*?\)/g, '').replace(/\s+/g, ' ').trim();
// "Assistente (Tami)" → "Tami": a role word with the real name in parentheses.
const personName = (s) => {
  const inner = String(s || '').match(/\(([^)]+)\)/)?.[1];
  return inner && /^(assistente|equipe|admin)$/i.test(clean(s)) ? clean(inner) : clean(s);
};
const esc = (v) => String(v ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

let cache = null;
export async function loadSignature(profile) {
  if (cache && cache.profile_id === profile?.id) return cache;
  let row = null;
  if (profile?.id) {
    const { data } = await supabase.from('staff_signatures').select('*').eq('profile_id', profile.id).maybeSingle();
    row = data || null;
  }
  cache = { ...(row || {}), profile_id: profile?.id, _saved: !!row, _profile: profile };
  return cache;
}

// Normalized voice for a profile + its saved signature.
export function voice(profile, sig = cache) {
  const isNay = profile?.role === 'admin';
  const full = clean(sig?.display_name) || personName(profile?.full_name) || (isNay ? 'Nay' : 'Equipe PERSEA');
  const first = full.split(' ')[0];
  const intro = clean(sig?.intro) || 'da equipe da Nay';
  const title = clean(sig?.title) || 'Equipe';
  const saved = !!sig?._saved;
  // Without a saved signature everyone keeps the previous short sign-off
  // (Nay: "Com carinho, Nay"; assistants: "Com carinho, <Nome> · Equipe
  // PERSEA"). The full block below is the model for whoever saved one (Tami).
  return {
    isNay, first, full,
    hello: (to, { emoji = false } = {}) => (isNay && !saved ? `Olá, ${to}!` : `Olá, ${to}! Aqui é a ${first}, ${intro}.`) + (emoji ? ' ✨' : ''),
    sign: saved ? `Com carinho,\n${full}\n\n${title}\nPERSEA\n⚜️` : isNay ? 'Com carinho,\nNay' : `Com carinho,\n${first} · Equipe PERSEA`,
  };
}

// "Minha assinatura" editor. onSaved re-renders the caller.
export async function openSignatureModal(profile, { onSaved } = {}) {
  const sig = await loadSignature(profile);
  const v = voice(profile, sig);
  const { el, close } = openModal({
    title: 'Minha assinatura nas mensagens',
    bodyHtml: `
      <form id="sig-form" class="space-y-4">
        <div>
          <label class="text-xs text-white/40 block mb-1">Seu nome completo</label>
          <input name="display_name" class="field" maxlength="80" value="${esc(sig.display_name || personName(profile.full_name))}" placeholder="Ex.: Tami Pacheco" />
        </div>
        <div>
          <label class="text-xs text-white/40 block mb-1">Como você se apresenta (depois de “Aqui é a ${esc(v.first)},”)</label>
          <input name="intro" class="field" maxlength="120" value="${esc(sig.intro || '')}" placeholder="da equipe da Nay" />
        </div>
        <div>
          <label class="text-xs text-white/40 block mb-1">Sua área (aparece embaixo do nome)</label>
          <input name="title" class="field" maxlength="60" value="${esc(sig.title || '')}" placeholder="Ex.: Tech • Inovação" />
        </div>
        <div>
          <p class="text-xs text-white/40 mb-1">Como fica</p>
          <pre id="sig-preview" class="field text-sm" style="white-space:pre-wrap;font-family:inherit;line-height:1.6;"></pre>
        </div>
        <div class="flex justify-end gap-2">
          <button type="button" class="btn-ghost" data-cancel style="padding:9px 18px;font-size:12.5px;">Cancelar</button>
          <button type="submit" class="btn-primary" style="padding:9px 18px;font-size:12.5px;">Salvar</button>
        </div>
      </form>`,
  });
  const form = el.querySelector('#sig-form');
  const preview = () => {
    const fd = new FormData(form);
    const draft = voice(profile, { display_name: fd.get('display_name'), intro: fd.get('intro'), title: fd.get('title'), _saved: true });
    el.querySelector('#sig-preview').textContent = `${draft.hello('Ana', { emoji: true })}\n\n…\n\n${draft.sign}`;
  };
  form.addEventListener('input', preview); preview();
  el.querySelector('[data-cancel]').addEventListener('click', close);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const row = { profile_id: profile.id, display_name: clean(fd.get('display_name')) || null, intro: clean(fd.get('intro')) || null, title: clean(fd.get('title')) || null, updated_at: new Date().toISOString() };
    const { error } = await supabase.from('staff_signatures').upsert(row);
    if (error) { toast(`Não foi possível salvar: ${error.message}`, { tone: 'error' }); return; }
    cache = { ...row, _saved: true, _profile: profile };
    close(); toast('Assinatura salva.'); onSaved?.();
  });
}

// --- Link de cadastro: the message that goes with it ------------------------
// Same voice as the invite (see voice()); used by "+ Novo Cliente" (crm.js)
// and "Gerar link de cadastro" on the client page (client-onboarding.js).
export function registrationMessage({ name, url, expiresAt, profile }) {
  const v = voice(profile);
  const first = String(name || '').trim().split(/\s+/)[0] || '';
  const until = expiresAt ? new Date(expiresAt).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' }) : null;
  return [
    v.hello(first, { emoji: true }),
    '',
    'Que alegria ter você com a gente! Para prepararmos o seu contrato e o seu acesso ao app *PERSEA*, precisamos de alguns dados seus.',
    '',
    'Toque no link abaixo para preencher o seu cadastro (leva poucos minutos):',
    url,
    '',
    `O link é pessoal e só pode ser usado uma vez${until ? ` — vale até ${until}` : ''}.`,
    '',
    v.sign,
  ].join('\n');
}

// Modal: the link + the ready message, with WhatsApp (to her number when we
// have it, otherwise WhatsApp opens to pick the contact) and copy buttons.
export async function openRegistrationMessageModal({ title = 'Link de cadastro', name, url, expiresAt, phone, profile, note }) {
  if (profile) await loadSignature(profile).catch(() => null);
  const msg = registrationMessage({ name, url, expiresAt, profile });
  const digits = String(phone || '').replace(/\D/g, '').replace(/^55(?=\d{10,11}$)/, '');
  const wa = `https://wa.me/${digits.length >= 10 ? `55${digits}` : ''}?text=${encodeURIComponent(msg)}`;
  const { el } = openModal({
    title,
    bodyHtml: `
      <p class="text-xs text-white/40 mb-3">${esc(note || 'Envie esta mensagem com o link de cadastro.')}</p>
      <textarea id="reg-msg" class="field text-sm" rows="13" style="line-height:1.55;">${esc(msg)}</textarea>
      <div class="flex gap-2 flex-wrap mt-3">
        <a id="reg-wa" href="${wa}" target="_blank" rel="noopener" class="btn-primary" style="padding:9px 18px;font-size:12.5px;">Abrir WhatsApp</a>
        <button type="button" id="copy-reg-msg" class="btn-ghost" style="padding:9px 18px;font-size:12.5px;">Copiar mensagem</button>
        <button type="button" id="copy-reg-link" class="btn-text" style="font-size:12px;">Copiar só o link</button>
      </div>`,
  });
  const ta = el.querySelector('#reg-msg');
  ta.addEventListener('input', () => { el.querySelector('#reg-wa').href = wa.replace(/text=.*$/, `text=${encodeURIComponent(ta.value)}`); });
  const copy = async (text, ok) => { try { await navigator.clipboard.writeText(text); toast(ok); } catch { window.prompt('Copie:', text); } };
  el.querySelector('#copy-reg-msg').addEventListener('click', () => copy(ta.value, 'Mensagem copiada.'));
  el.querySelector('#copy-reg-link').addEventListener('click', () => copy(url, 'Link copiado.'));
}
