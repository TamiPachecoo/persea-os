// Final Core Production Architecture Pass — Part 1: the one place every
// client-facing page resolves "who is this." Reuses the existing, already-
// correct real-identity relationship (auth.users.id → profiles.id →
// profiles.client_id → clients.id — see shared/supabase-auth.js's
// requireProfile, already exercised for real by client/contract.js) rather
// than inventing a second identity system.
//
// Demo/staging keeps the existing MockDB client-switcher convenience — that
// is explicitly desired there (see shared/environment.js). Production
// resolves the real authenticated client and nothing else: a client can
// never choose who they are by editing localStorage in production, because
// nothing here ever reads localStorage for identity once isProductionEnvironment()
// is true. The actual access boundary is still each table's own RLS policy
// (already scoped to profiles.client_id for the tables that matter — see
// the Final Core Production Architecture Pass report for the audit of
// which ones) — this function only decides which id a well-behaved page
// asks for, it is not itself a security boundary.
import { MockDB, getActiveClientId } from './mock-db.js';
import { requireProfile } from './supabase-auth.js';
import { isProductionEnvironment } from './environment.js';

function renderNotice(message, detail) {
  document.body.innerHTML = `
    <div style="min-height:100vh; display:flex; align-items:center; justify-content:center; text-align:center; padding:24px; background:#161310; color:#eee2d3;">
      <div>
        <p style="font-size:1.1rem; margin-bottom:8px;">${message}</p>
        <p style="opacity:.6; font-size:.85rem;">${detail}</p>
      </div>
    </div>
  `;
}

// Client Painel removal: this was previously the last thing client/
// dashboard.js rendered (inside the shell, after renderShell already ran),
// since dashboard.html was guaranteed to be the first page every freshly-
// activated/invited client landed on. Now that no single client page is
// guaranteed to be "first" in that same way, this lives here instead — the
// one funnel every client page already calls before rendering anything —
// so it fires correctly regardless of which page she lands on. Renders
// before the shell (no nav/switcher yet — she hasn't really "entered" the
// app), same full-takeover convention as renderNotice above.
function renderAccessPendingGate(clientId) {
  document.body.innerHTML = `
    <div class="min-h-[60vh] flex items-center justify-center">
      <div class="max-w-md w-full text-center">
        <p class="eyebrow mb-4">Persea</p>
        <h1 class="font-serif text-3xl mb-4">Bem-vinda ao Persea</h1>
        <p class="text-sm mb-8" style="color:var(--muted); line-height:1.7;">Seu espaço está pronto. Crie seu acesso para começar sua jornada.</p>
        <button id="create-access" class="btn-primary" style="padding:12px 28px;font-size:13.5px;">Criar meu acesso</button>
      </div>
    </div>
  `;
  document.getElementById('create-access').addEventListener('click', () => {
    MockDB.createClientAccess(clientId);
    location.reload();
  });
}

// Returns { clientId, mode: 'demo' | 'production', profile } — profile is
// null in demo (no real session involved there). Returns null if this
// function has already redirected/rendered a stop state (no real session,
// wrong role, or a real client profile with no linked client_id yet) —
// callers should `throw new Error('not authorized')` immediately after a
// null result, same convention as requireProfile itself.
export async function getCurrentClientContext(loginPath = '../login.html') {
  let clientId;
  let profile = null;
  const mode = isProductionEnvironment() ? 'production' : 'demo';
  if (mode === 'demo') {
    clientId = getActiveClientId();
  } else {
    profile = await requireProfile('client', loginPath);
    if (!profile) return null; // requireProfile already redirected to login
    if (!profile.client_id) {
      renderNotice(
        'Sua conta ainda não está vinculada a um cadastro de cliente.',
        'Fale com a equipe PERSEA para concluir sua ativação.',
      );
      return null;
    }
    clientId = profile.client_id;
  }

  const client = MockDB.getClient(clientId);

  // Known, deliberate limitation (see the Final Core Production
  // Architecture Pass report): the rich client journey experience
  // (dashboard, program, questionnaire, playbook, etc.) still reads
  // through MockDB, which has nothing under a real Supabase client's UUID
  // — that per-page migration hasn't happened yet. Rather than let each of
  // those ~20 pages crash on `undefined.someProperty`, this is the one
  // place that catches it and shows an honest "not ready yet" notice
  // instead of a broken page. Remove this check page-by-page as each one
  // is actually converted to read its real Supabase equivalent. Demo mode
  // never hits this — every demo client always exists in MockDB.
  if (mode === 'production' && !client) {
    renderNotice(
      'Esta área ainda está sendo preparada para clientes reais.',
      'Volte em breve — a equipe PERSEA foi avisada.',
    );
    return null;
  }

  // Client Painel removal: this used to only ever fire on client/
  // dashboard.js, guaranteed to be the first page a freshly-activated
  // client saw. Checked here instead so it still fires correctly no matter
  // which client page she lands on first — see renderAccessPendingGate.
  if (client?.accessStatus === 'pending') {
    renderAccessPendingGate(clientId);
    return null;
  }

  return { clientId, mode, profile };
}
