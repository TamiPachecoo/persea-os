// Real Supabase-backed Hubla access queue. Hubla itself exposes no API to
// grant/create member access (checked directly against their docs — only
// webhooks out, a manual dashboard "Adicionar membro(s)" action, and an
// embedded-iframe flow that needs a live browser session) — so PERSEA
// can't perform the grant. What it CAN do is remove the manual tracking
// around it: tell Nay/Ju exactly who's waiting, hand them a ready-to-copy
// email, and — once hubla-webhook receives the resulting
// customer.member_added event — confirm it happened automatically instead
// of relying on someone remembering to check.
import { supabase } from './supabase-client.js';

// "Ready for Hubla" = an active, real (non-demo) client who hasn't been
// granted access yet. Not just hubla_access_status:'not_granted' alone —
// someone still mid-onboarding (status:'onboarding') hasn't necessarily
// earned content access yet, so she stays out of this queue until her
// status flips to 'active'. is_demo excluded the same way financial.js
// already excludes demo/test fixtures from its real-data totals.
export async function loadHublaPendingClients() {
  const { data, error } = await supabase.from('clients')
    .select('id, full_name, email, created_at')
    .eq('status', 'active')
    .eq('hubla_access_status', 'not_granted')
    .eq('is_demo', false)
    .order('created_at', { ascending: true });
  if (error) return { clients: [], error: error.message };
  return { clients: data || [], error: null };
}

// Manual confirmation for when Nay/Ju add someone in Hubla directly and
// don't want to wait on (or don't trust) the webhook round-trip — e.g. if
// the rule isn't scoped to catch it, or she's confirming a much older
// grant that predates this integration entirely.
export function markHublaAccessGranted(clientId) {
  return supabase.from('clients').update({
    hubla_access_status: 'granted',
    hubla_access_granted_at: new Date().toISOString(),
  }).eq('id', clientId);
}

export function markHublaAccessRevoked(clientId) {
  return supabase.from('clients').update({
    hubla_access_status: 'not_granted',
    hubla_access_granted_at: null,
  }).eq('id', clientId);
}
