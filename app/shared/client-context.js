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
import { supabase } from './supabase-client.js';
import { isProductionEnvironment } from './environment.js';

// Production Data Migration — Batch 1: pages converted off MockDB onto real
// Supabase tables (see each page's own comments for exactly which tables).
// A page not in this set still gets a real client identity/session check
// (so auth/RLS are exercised correctly either way) but is intentionally
// stopped with an honest "not available yet" notice rather than being
// allowed to fall through into MockDB — MockDB has no row under a real
// client's UUID, and a real client's data must NEVER silently come from
// MockDB in production (explicit product requirement). Add a page's own
// identifier here only once its render() genuinely reads its own Supabase
// tables end to end, never before.
const PRODUCTION_READY_PAGES = new Set(['encontros']);

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

// Returns { clientId, mode: 'demo' | 'production', profile, client } —
// profile is null in demo (no real session involved there); client is the
// MockDB shape in demo, or the real `clients` row (via a scoped Supabase
// query, protected by clients_self_read RLS) in production. Returns null
// if this function has already redirected/rendered a stop state (no real
// session, wrong role, a real client profile with no linked client_id yet,
// or a page not yet converted to real data) — callers should
// `throw new Error('not authorized')` immediately after a null result,
// same convention as requireProfile itself.
//
// `page` must be passed in production so this can tell an already-
// converted page from one that would otherwise fall through to MockDB —
// see PRODUCTION_READY_PAGES above. Optional in demo (ignored there).
export async function getCurrentClientContext(loginPath = '../login.html', { page } = {}) {
  if (!isProductionEnvironment()) {
    const clientId = getActiveClientId();
    const client = MockDB.getClient(clientId);
    // Client Painel removal: this used to only ever fire on client/
    // dashboard.js, guaranteed to be the first page a freshly-activated
    // client saw. Checked here instead so it still fires correctly no
    // matter which client page she lands on first — see
    // renderAccessPendingGate. Demo-only: a real production client only
    // ever reaches a client-role login after her real invite was already
    // accepted (see invite-client/autentique-status), so there is no
    // equivalent "pending" state to gate on in production.
    if (client?.accessStatus === 'pending') {
      renderAccessPendingGate(clientId);
      return null;
    }
    return { clientId, mode: 'demo', profile: null, client };
  }

  const profile = await requireProfile('client', loginPath);
  if (!profile) return null; // requireProfile already redirected to login
  if (!profile.client_id) {
    renderNotice(
      'Sua conta ainda não está vinculada a um cadastro de cliente.',
      'Fale com a equipe PERSEA para concluir sua ativação.',
    );
    return null;
  }
  const clientId = profile.client_id;

  // Real Supabase row, not MockDB — RLS (clients_self_read) already scopes
  // this to exactly her own row; no separate client-side filter needed.
  const { data: client, error } = await supabase.from('clients').select('*').eq('id', clientId).maybeSingle();
  if (error || !client) {
    renderNotice(
      'Não foi possível carregar seus dados agora.',
      'Tente novamente em instantes ou fale com a equipe PERSEA.',
    );
    return null;
  }

  // Production Data Migration: a page not yet converted off MockDB must
  // never be allowed to read it for a real client (MockDB has nothing
  // under a real UUID anyway, but this makes the boundary explicit and
  // intentional rather than incidental). Shown instead of a broken/blank
  // page — this is a feature-availability notice, not a "no data yet"
  // empty state (that distinction matters: the page genuinely isn't wired
  // to Supabase yet, it isn't that this specific client has nothing).
  if (!page || !PRODUCTION_READY_PAGES.has(page)) {
    renderNotice(
      'Esta área ainda está sendo preparada para clientes reais.',
      'Volte em breve — a equipe PERSEA foi avisada.',
    );
    return null;
  }

  return { clientId, mode: 'production', profile, client };
}
