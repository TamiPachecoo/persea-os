// Where the invite email link (and the "forgot password" recovery link)
// land. Real incident: Gmail's own link-scanning ("Reduzir Proteções")
// silently pre-fetches every link in an email to check it for threats —
// including Supabase's old-style {{ .ConfirmationURL }}, which is a
// one-time-use GET that fully consumes the token the instant ANYTHING
// fetches it. That meant a real client's invite could be burned by
// Gmail's own scanner minutes after sending, before she ever opened the
// email herself — she'd click a link that looks perfectly fine and land
// on "Link inválido ou expirado" with no way to tell why. Confirmed via
// Supabase's own auth repo (github.com/supabase/auth#1214) as a known,
// common failure mode with email-embedded confirmation URLs generally.
//
// The fix, per Supabase's own documented pattern: the email link now
// carries an inert token_hash + type (see email-templates/invite.html and
// reset-password.html) pointing straight at this page — no Supabase
// endpoint is hit just by opening the link, so a scanner fetching it does
// nothing. The token is only ever actually consumed (via verifyOtp) at
// the moment she submits this page's own password form — a real,
// deliberate user action a background scanner won't perform. Old links
// already sent before this fix still carry the previous fragment-based
// format and are handled by the legacy fallback below so nothing already
// in an inbox breaks.
import { supabase } from '../shared/supabase-client.js';
import { resetPasswordForEmail, getCurrentProfile } from '../shared/supabase-auth.js';
import { card, toast } from '../shared/ui.js';

const content = document.getElementById('app-content');
const params = new URLSearchParams(location.search);
const tokenHash = params.get('token_hash');
const otpType = params.get('type') || 'invite';

async function waitForLegacySession(retries = 10) {
  for (let i = 0; i < retries; i++) {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) return session;
    await new Promise((r) => setTimeout(r, 300));
  }
  return null;
}

// Access links expire (Supabase default: 1 hour), and an older email in the
// inbox is always invalid once a newer one was sent. Rather than a dead end
// that needs me to resend by hand, she can request a fresh link right here —
// it goes through the same password-reset email, which lands back on this
// page with a new token and also confirms her account.
function renderInvalidLink() {
  content.innerHTML = card(`
    <p class="text-sm mb-1" style="color:var(--gold);">Este link expirou</p>
    <p class="text-sm text-white/60 mb-5">Por segurança, os links de acesso valem por pouco tempo. Digite o seu e-mail e eu envio um novo link agora mesmo.</p>
    <form id="new-link-form" class="space-y-4">
      <div>
        <label class="text-xs text-white/40 block mb-1">Seu e-mail</label>
        <input type="email" name="email" required class="field" autocomplete="email" />
      </div>
      <button type="submit" class="btn-primary block w-full text-center" style="padding-top:11px;padding-bottom:11px;">Receber um novo link</button>
    </form>
  `);
  document.getElementById('new-link-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    const email = new FormData(e.target).get('email').trim();
    btn.disabled = true; btn.textContent = 'Enviando…';
    const { error } = await resetPasswordForEmail(email);
    if (error) {
      btn.disabled = false; btn.textContent = 'Receber um novo link';
      toast(/rate|seconds|segundos/i.test(error.message) ? 'Aguarde um minuto e tente de novo.' : 'Não foi possível enviar agora. Tente de novo em instantes.', { tone: 'error' });
      return;
    }
    content.innerHTML = card(`
      <p class="text-sm mb-1" style="color:var(--gold);">Novo link enviado</p>
      <p class="text-sm text-white/60">Enviei um novo link para <b style="color:var(--cream)">${email.replace(/[<>&"]/g, '')}</b>. Abra o e-mail e toque em "Criar minha senha" assim que receber, porque o link vale por pouco tempo. Se não aparecer em alguns minutos, olhe também a caixa de spam.</p>
    `);
  });
}

// Real incident (assistant's first access): the only rule — 8+ characters —
// was never shown, and the browser's own minlength bubble (in English, and
// often not shown at all on iPhone / WhatsApp's in-app browser) silently
// blocked the button, so "it doesn't let me create my password". The rule
// is now on screen, checked here with Portuguese messages, with a confirm
// field and a show/hide toggle; server errors are translated too.
const MIN_PASSWORD = 8;
let linkVerified = false;
function translateAuthError(message = '') {
  if (/at least|characters|short/i.test(message)) return `A senha precisa ter pelo menos ${MIN_PASSWORD} caracteres.`;
  if (/weak|pwned|leaked|common/i.test(message)) return 'Essa senha é muito comum. Escolha outra, misturando letras e números.';
  if (/different from the old|same password/i.test(message)) return 'Escolha uma senha diferente da anterior.';
  if (/rate|seconds/i.test(message)) return 'Muitas tentativas seguidas. Aguarde um minuto e tente de novo.';
  return 'Não foi possível criar a senha agora. Tente de novo em instantes.';
}

function renderForm() {
  content.innerHTML = card(`
    <p class="text-sm text-white/60 mb-1">Crie a senha do seu acesso ao Persea.</p>
    <p class="text-xs mb-5" style="color:var(--muted);">Use pelo menos <b style="color:var(--cream);">${MIN_PASSWORD} caracteres</b>. Pode ser uma frase curta, letras e números.</p>
    <form id="set-password-form" class="space-y-4" novalidate>
      <div>
        <label class="text-xs text-white/40 block mb-1" for="pw1">Nova senha</label>
        <input type="password" id="pw1" name="password" class="field" autocomplete="new-password" />
        <p class="text-xs mt-1" id="pw-count" style="color:var(--muted);">0 de ${MIN_PASSWORD} caracteres</p>
      </div>
      <div>
        <label class="text-xs text-white/40 block mb-1" for="pw2">Repita a senha</label>
        <input type="password" id="pw2" name="confirm" class="field" autocomplete="new-password" />
      </div>
      <label class="flex items-center gap-2 text-xs" style="color:var(--muted);"><input type="checkbox" id="show-pw" /> Mostrar senha</label>
      <p class="text-sm" id="pw-error" role="alert" style="color:var(--terracotta);min-height:1.2em;"></p>
      <button type="submit" class="btn-primary block w-full text-center" style="padding-top:11px;padding-bottom:11px;">Criar senha e entrar</button>
    </form>
  `);

  const form = document.getElementById('set-password-form');
  const pw1 = document.getElementById('pw1'), pw2 = document.getElementById('pw2');
  const errEl = document.getElementById('pw-error'), countEl = document.getElementById('pw-count');
  pw1.addEventListener('input', () => {
    const n = pw1.value.length;
    countEl.textContent = n >= MIN_PASSWORD ? '✓ Tamanho ok' : `${n} de ${MIN_PASSWORD} caracteres`;
    countEl.style.color = n >= MIN_PASSWORD ? 'var(--gold)' : 'var(--muted)';
    errEl.textContent = '';
  });
  pw2.addEventListener('input', () => { errEl.textContent = ''; });
  document.getElementById('show-pw').addEventListener('change', (e) => { pw1.type = pw2.type = e.target.checked ? 'text' : 'password'; });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = form.querySelector('button[type="submit"]');
    const password = pw1.value;
    if (password.length < MIN_PASSWORD) { errEl.textContent = `A senha precisa ter pelo menos ${MIN_PASSWORD} caracteres (agora tem ${password.length}).`; pw1.focus(); return; }
    if (password !== pw2.value) { errEl.textContent = 'As duas senhas não estão iguais. Digite de novo.'; pw2.focus(); return; }
    submitBtn.disabled = true; submitBtn.textContent = 'Criando…';

    // Real user action, right now — this is the one moment the token
    // actually gets consumed, never just from opening the link.
    // Only once: if the password itself is then rejected (too common…),
    // a retry reuses the session already opened instead of re-spending the
    // one-time token and wrongly landing on "Este link expirou".
    if (tokenHash && !linkVerified) {
      const { error: verifyError } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: otpType });
      if (verifyError) {
        submitBtn.disabled = false;
        renderInvalidLink();
        return;
      }
      linkVerified = true;
    }

    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      submitBtn.disabled = false; submitBtn.textContent = 'Criar senha e entrar';
      errEl.textContent = translateAuthError(error.message);
      return;
    }
    toast('Senha criada!');
    // Same page serves students and the team (invite-staff links land here
    // too) — send each to her own home.
    const profile = await getCurrentProfile();
    location.href = { admin: '/admin/agenda.html', assistant: '/assistant/agenda.html' }[profile?.role] || 'program.html';
  });
}

if (tokenHash) {
  // New-style link: nothing has been consumed yet, just show the form.
  renderForm();
} else {
  // Legacy fragment-based link (sent before this fix) — detectSessionInUrl
  // already exchanged it by the time this page's JS runs.
  const session = await waitForLegacySession();
  if (!session) { renderInvalidLink(); throw new Error('no session from invite link'); }
  renderForm();
}
