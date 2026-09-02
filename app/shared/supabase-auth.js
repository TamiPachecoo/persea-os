// Real auth helpers — thin wrappers over Supabase Auth + the `profiles`
// table (role + client_id live there, not on the auth user itself).
// Converted role-by-role: today only the client role actually depends on
// this; admin/assistant screens still run on MockDB until they're converted.
import { supabase } from './supabase-client.js';

export async function signUpWithPassword(email, password) {
  return supabase.auth.signUp({ email, password });
}

export async function signInWithPassword(email, password) {
  return supabase.auth.signInWithPassword({ email, password });
}

export async function signOut() {
  await supabase.auth.signOut();
}

export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

// One row per authenticated person — role drives which shell renders;
// client_id (set only when role='client') is the FK into the real client
// record, replacing the old getActiveClientId() localStorage stand-in.
export async function getCurrentProfile() {
  const session = await getSession();
  if (!session) return null;
  const { data, error } = await supabase
    .from('profiles')
    .select('id, role, full_name, email, client_id')
    .eq('id', session.user.id)
    .maybeSingle();
  if (error || !data) return null;
  return data;
}

// Call at the top of a page that requires a real session. Redirects to the
// shared login page (loginPath is relative to the calling page, e.g.
// '../login.html' from app/client/*.html) if there's no session or the
// signed-in person isn't the expected role. Returns the profile otherwise.
//
// Signs out before redirecting on failure — deliberately, not just a
// cleanup step. login.html's own top-of-page check only auto-bounces a
// visitor back to the page they came from when IT independently finds a
// valid session+profile; if this page's check and login's check ever
// disagree on the same browser state (a stale/racing token, multiple tabs
// each holding their own Supabase client, etc.), that disagreement is
// exactly what produces an infinite login↔page redirect loop. Clearing the
// session here means login.html can never be fooled into bouncing back —
// worst case the person re-enters her password once, which beats a loop.
export async function requireProfile(role, loginPath = '../login.html') {
  const profile = await getCurrentProfile();
  if (!profile || (role && profile.role !== role)) {
    await signOut();
    location.href = `${loginPath}?next=${encodeURIComponent(location.pathname + location.search)}`;
    return null;
  }
  return profile;
}
