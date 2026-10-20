import { MockDB } from './shared/mock-db.js';
import { renderParticles } from './shared/ui.js';
document.getElementById('particles-mount').innerHTML = renderParticles(14);

// The role-shortcut picker below (direct, unauthenticated links into
// admin/assistant, plus a sample-data reset button) is a local-dev
// convenience only — every admin/assistant page now enforces real
// Supabase auth on its own (see shared/supabase-auth.js's
// requireProfile), so these links can't actually bypass anything
// anymore even if reached. But a public "wipe the sample data" button
// has no legitimate use for an anonymous visitor on a hosted preview or
// production URL, so this whole picker only ever renders on localhost —
// anywhere else, the root page is just the real login screen, no
// detour through a picker at all.
const isLocalDev = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
const root = document.getElementById('root-body');

if (isLocalDev) {
  root.innerHTML = `
    <p class="eyebrow mb-4">Sistema Operacional — Protótipo (dev local)</p>
    <h1 class="font-serif mb-3" style="font-size:3rem; text-shadow:0 0 40px rgba(184,134,58,.35);">PERSEA</h1>
    <div class="divider mx-auto mb-6"></div>
    <p class="mb-10 text-sm" style="color:var(--muted); line-height:1.7;">Atalhos de desenvolvimento — cada página abaixo ainda exige login real correspondente ao papel (admin/assistente); isto só pula a tela inicial.</p>
    <div class="space-y-3">
      <a href="login.html" class="btn-primary block w-full text-center" style="padding-top:13px;padding-bottom:13px;">Entrar</a>
      <a href="admin/agenda.html" class="btn-ghost block w-full text-center" style="padding-top:12px;padding-bottom:12px;">Ir para Admin</a>
      <a href="assistant/agenda.html" class="btn-ghost block w-full text-center" style="padding-top:12px;padding-bottom:12px;">Ir para Assistente</a>
    </div>
    <button id="reset-btn" class="btn-text mt-8 underline">Redefinir dados de exemplo</button>
    <p class="mt-4"><a href="landing.html" class="btn-text underline">Ver Landing Page</a></p>
  `;
  document.getElementById('reset-btn').addEventListener('click', () => {
    MockDB.reset();
    alert('Dados de exemplo redefinidos.');
  });
} else {
  root.innerHTML = `
    <h1 class="font-serif mb-3" style="font-size:3rem; text-shadow:0 0 40px rgba(184,134,58,.35);">PERSEA</h1>
    <div class="divider mx-auto mb-6"></div>
    <a href="login.html" class="btn-primary block w-full text-center" style="padding-top:13px;padding-bottom:13px;">Entrar</a>
  `;
}
