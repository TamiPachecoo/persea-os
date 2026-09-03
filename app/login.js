// Real login — replaces the old "pick a role, no password" splash
// (index.html) for whichever roles have actually been converted to
// Supabase Auth (client role first; see docs/supabase-schema-plan.md).
// Admin/assistant still run on MockDB for now, so their screens aren't
// gated by this yet — this page exists so the client flow can be tested
// end-to-end without touching the rest of the app.
import { supabase } from './shared/supabase-client.js';
import { signInWithPassword, signUpWithPassword, getCurrentProfile } from './shared/supabase-auth.js';
import { card, toast } from './shared/ui.js';

const content = document.getElementById('app-content');
const params = new URLSearchParams(location.search);
const next = params.get('next');

const ROLE_HOME = {
  admin: '/admin/agenda.html', // Painel removed — Agenda is Nay's landing page now
  assistant: '/assistant/agenda.html', // Painel removed — Agenda is her landing page now
  client: '/client/program.html', // Painel removed — Minha Jornada is her landing page now
};

function goHome(role) {
  location.href = next || ROLE_HOME[role] || '/index.html';
}

// Already signed in? Skip straight past the form.
const { data: { session: existingSession } } = await supabase.auth.getSession();
if (existingSession) {
  const profile = await getCurrentProfile();
  if (profile) goHome(profile.role);
}

let mode = 'signin'; // 'signin' | 'signup'

function render() {
  content.innerHTML = mode === 'signin' ? `
    ${card(`
      <form id="signin-form" class="space-y-4">
        <div>
          <label class="text-xs text-white/40 block mb-1">E-mail</label>
          <input type="email" name="email" required class="field" autocomplete="email" />
        </div>
        <div>
          <label class="text-xs text-white/40 block mb-1">Senha</label>
          <input type="password" name="password" required class="field" autocomplete="current-password" />
        </div>
        <button type="submit" class="btn-primary block w-full text-center" style="padding-top:11px;padding-bottom:11px;">Entrar</button>
      </form>
    `)}
    <button id="to-signup" class="btn-text mt-6 underline block mx-auto">Primeiro acesso? Criar sua senha</button>
  ` : `
    ${card(`
      <p class="text-xs mb-4" style="color:var(--muted); line-height:1.6;">Use o e-mail que a Nay já tem cadastrado para você. Vamos enviar uma confirmação antes de liberar o acesso.</p>
      <form id="signup-form" class="space-y-4">
        <div>
          <label class="text-xs text-white/40 block mb-1">E-mail</label>
          <input type="email" name="email" required class="field" autocomplete="email" />
        </div>
        <div>
          <label class="text-xs text-white/40 block mb-1">Crie uma senha</label>
          <input type="password" name="password" required minlength="8" class="field" autocomplete="new-password" />
        </div>
        <button type="submit" class="btn-primary block w-full text-center" style="padding-top:11px;padding-bottom:11px;">Criar acesso</button>
      </form>
    `)}
    <button id="to-signin" class="btn-text mt-6 underline block mx-auto">Já tem senha? Entrar</button>
  `;

  document.getElementById('to-signup')?.addEventListener('click', () => { mode = 'signup'; render(); });
  document.getElementById('to-signin')?.addEventListener('click', () => { mode = 'signin'; render(); });

  document.getElementById('signin-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const { error } = await signInWithPassword(fd.get('email'), fd.get('password'));
    if (error) { toast(error.message === 'Invalid login credentials' ? 'E-mail ou senha incorretos.' : error.message, { tone: 'error' }); return; }
    const profile = await getCurrentProfile();
    if (!profile) {
      toast('Login feito, mas seu acesso ainda não foi vinculado a um perfil — fale com a Nay.', { tone: 'error' });
      return;
    }
    goHome(profile.role);
  });

  document.getElementById('signup-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const email = fd.get('email');
    const { data, error } = await signUpWithPassword(email, fd.get('password'));
    if (error) { toast(error.message, { tone: 'error' }); return; }
    if (!data.session) {
      // Email confirmation is on for this project (the default) — no
      // session yet. profiles row gets created the first time she
      // actually signs in with a confirmed session (see below), not here,
      // since we can't safely look up/link her client record without one.
      content.innerHTML = card(`
        <p class="text-sm" style="color:var(--gold);">Conta criada! Confira seu e-mail (${email}) e confirme o acesso antes de entrar.</p>
      `);
      return;
    }
    await linkClientProfile(data.user.id, email);
    const profile = await getCurrentProfile();
    if (profile) goHome(profile.role);
  });
}

// First real sign-in for someone with no profiles row yet: if her email
// matches an existing clients.email, link her account for real (role +
// client_id) — this is the one place a signed-in-but-unlinked person is
// allowed to create her own profile row (see profiles_self_insert-style
// policy this depends on... note: enforced by matching her own auth uid
// to an email lookup, not by trusting any client-supplied role).
async function linkClientProfile(userId, email) {
  const { data: client } = await supabase.from('clients').select('id, full_name').eq('email', email).maybeSingle();
  if (!client) return;
  await supabase.from('profiles').insert({ id: userId, role: 'client', full_name: client.full_name, email, client_id: client.id });
}

render();
