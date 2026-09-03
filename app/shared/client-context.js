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

// Returns { clientId, mode: 'demo' | 'production', profile } — profile is
// null in demo (no real session involved there). Returns null if this
// function has already redirected/rendered a stop state (no real session,
// wrong role, or a real client profile with no linked client_id yet) —
// callers should `throw new Error('not authorized')` immediately after a
// null result, same convention as requireProfile itself.
export async function getCurrentClientContext(loginPath = '../login.html') {
  if (!isProductionEnvironment()) {
    return { clientId: getActiveClientId(), mode: 'demo', profile: null };
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
  // Known, deliberate limitation (see the Final Core Production
  // Architecture Pass report): the rich client journey experience
  // (dashboard, program, questionnaire, playbook, etc.) still reads
  // through MockDB, which has nothing under a real Supabase client's UUID
  // — that per-page migration hasn't happened yet. Rather than let each of
  // those ~20 pages crash on `undefined.someProperty`, this is the one
  // place that catches it and shows an honest "not ready yet" notice
  // instead of a broken page. Remove this check page-by-page as each one
  // is actually converted to read its real Supabase equivalent.
  if (!MockDB.getClient(profile.client_id)) {
    renderNotice(
      'Esta área ainda está sendo preparada para clientes reais.',
      'Volte em breve — a equipe PERSEA foi avisada.',
    );
    return null;
  }
  return { clientId: profile.client_id, mode: 'production', profile };
}
