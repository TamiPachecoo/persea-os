// Where Supabase's "Reset Password" email link lands (see
// resetPasswordForEmail in shared/supabase-auth.js). Same mechanism as
// client/set-password.js — Supabase's client picks up a session from the
// URL automatically (detectSessionInUrl: true) — but this page is
// role-agnostic (admin/assistant/client all sign in with a password on the
// same login.html), so it sends her home via her real profile role instead
// of hardcoding client/program.html the way the invite-only page does.
import { supabase } from './shared/supabase-client.js';
import { getCurrentProfile } from './shared/supabase-auth.js';
import { card, toast } from './shared/ui.js';

const content = document.getElementById('app-content');

const ROLE_HOME = {
  admin: '/admin/agenda.html',
  assistant: '/assistant/agenda.html',
  client: '/client/program.html',
};

async function waitForSession(retries = 10) {
  for (let i = 0; i < retries; i++) {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) return session;
    await new Promise((r) => setTimeout(r, 300));
  }
  return null;
}

const session = await waitForSession();
if (!session) {
  content.innerHTML = card(`<p class="text-sm" style="color:var(--terracotta);">Link inválido ou expirado. Peça um novo link na tela de entrar.</p>`);
  throw new Error('no session from recovery link');
}

content.innerHTML = card(`
  <p class="text-sm text-white/50 mb-4">Crie uma nova senha para o seu acesso ao Persea.</p>
  <form id="reset-password-form" class="space-y-4">
    <div>
      <label class="text-xs text-white/40 block mb-1">Nova senha</label>
      <input type="password" name="password" required minlength="8" class="field" autocomplete="new-password" />
    </div>
    <button type="submit" class="btn-primary block w-full text-center" style="padding-top:11px;padding-bottom:11px;">Salvar nova senha</button>
  </form>
`);

document.getElementById('reset-password-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const password = new FormData(e.target).get('password');
  const { error } = await supabase.auth.updateUser({ password });
  if (error) { toast(error.message, { tone: 'error' }); return; }
  toast('Senha redefinida!');
  const profile = await getCurrentProfile();
  location.href = ROLE_HOME[profile?.role] || '/login.html';
});
