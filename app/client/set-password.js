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

function renderInvalidLink() {
  content.innerHTML = card(`<p class="text-sm" style="color:var(--terracotta);">Link inválido ou expirado. Peça para a Nay reenviar seu convite.</p>`);
}

function renderForm() {
  content.innerHTML = card(`
    <p class="text-sm text-white/50 mb-4">Crie a senha do seu acesso ao Persea.</p>
    <form id="set-password-form" class="space-y-4">
      <div>
        <label class="text-xs text-white/40 block mb-1">Nova senha</label>
        <input type="password" name="password" required minlength="8" class="field" autocomplete="new-password" />
      </div>
      <button type="submit" class="btn-primary block w-full text-center" style="padding-top:11px;padding-bottom:11px;">Entrar no Persea</button>
    </form>
  `);

  document.getElementById('set-password-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = e.target.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    const password = new FormData(e.target).get('password');

    // Real user action, right now — this is the one moment the token
    // actually gets consumed, never just from opening the link.
    if (tokenHash) {
      const { error: verifyError } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: otpType });
      if (verifyError) {
        submitBtn.disabled = false;
        renderInvalidLink();
        return;
      }
    }

    const { error } = await supabase.auth.updateUser({ password });
    if (error) { submitBtn.disabled = false; toast(error.message, { tone: 'error' }); return; }
    toast('Senha criada!');
    location.href = 'program.html'; // Painel removed — Minha Jornada is her landing page now
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
