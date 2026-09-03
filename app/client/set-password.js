// Where the invite email link lands. Supabase's client picks up the
// session from the URL automatically (detectSessionInUrl: true, set on the
// shared client) — this page just needs to wait for that session and let
// her choose her own password. Nobody ever generates or transmits one.
import { supabase } from '../shared/supabase-client.js';
import { card, toast } from '../shared/ui.js';

const content = document.getElementById('app-content');

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
  content.innerHTML = card(`<p class="text-sm" style="color:var(--terracotta);">Link inválido ou expirado. Peça para a Nay reenviar seu convite.</p>`);
  throw new Error('no session from invite link');
}

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
  const password = new FormData(e.target).get('password');
  const { error } = await supabase.auth.updateUser({ password });
  if (error) { toast(error.message, { tone: 'error' }); return; }
  toast('Senha criada!');
  location.href = 'program.html'; // Painel removed — Minha Jornada is her landing page now
});
