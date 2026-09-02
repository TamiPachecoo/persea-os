// Bridges a fully-agreed lead (Condições Comerciais + Cadastro already done
// in the mock lead pipeline — see admin/lead-detail.js, client/registration.js)
// into a real Supabase client + contract + party_info + payment-line record,
// so the real contract page (admin/contract.js) opens with everything
// already filled in — program, duração, valor, payment lines, and the
// cadastro fields the CONTRATANTE clause is built from. Nobody re-types
// anything Nay/the assistant already collected.
//
// Idempotent: matched by clients.legacy_id = lead.id, so calling this again
// for the same lead (e.g. the assistant navigates back and clicks the
// button twice) finds the client it already created instead of duplicating
// rows or erroring.
//
// Production Audit Remediation Pass (Critical/High 5): the check-then-insert
// below is not atomic by itself — two near-simultaneous calls could both
// pass the lookup before either has inserted. The real backstop is a DB
// UNIQUE constraint on clients.legacy_id (clients_legacy_id_key, already
// present in the schema — legacy_id is the explicit source_lead_id-style
// relationship this app uses, so no new column was needed). That makes a
// true duplicate impossible at the database level regardless of what the
// application does; the loser of the race gets a 23505 unique-violation
// instead of a second row. insertClient() below catches exactly that case
// and re-fetches the winner's row instead of surfacing a raw DB error, so
// a race is transparently idempotent rather than a failure.
import { supabase } from './supabase-client.js';

function mapProgram(programSlug) {
  // Ascensão de Imagem removed (Production Audit Remediation Pass, High 8) —
  // only Persea Essencial/Premium remain, so any unrecognized slug now
  // falls back to Premium/anual, same as before.
  if (programSlug === 'persea-essential') return { program: 'persea', duration: 'semestral', tier: 'essential' };
  return { program: 'persea', duration: 'anual', tier: 'premium' }; // persea-premium, and any unrecognized fallback
}

export async function ensureRealClientForLead(lead) {
  const { data: existing, error: lookupErr } = await supabase.from('clients').select('id').eq('legacy_id', lead.id).maybeSingle();
  if (lookupErr) return { error: lookupErr.message };
  if (existing) return { clientId: existing.id, created: false };

  const reg = lead.registrationInfo || {};
  const ct = lead.commercialTerms || {};
  const { program, duration, tier } = mapProgram(lead.program);
  const fullName = reg.fullName || lead.fullName || 'Sem nome';
  const email = reg.email || lead.email || null;

  // Preserves the existing "demo-" prefixed test-lead convention used for
  // walkthroughs (demo-contract-1, lead-demo-signing, etc.) — those keep
  // auto-tagging as demo with zero behavior change. A real lead created
  // through the normal Condições Comerciais flow defaults to NOT demo, since
  // most future leads are real deals; is_demo is a real column now (not a
  // legacy_id string trick), so it can always be flipped later without
  // touching any id anything else depends on.
  const { data: client, error: clientErr } = await supabase.from('clients').insert({
    legacy_id: lead.id, full_name: fullName, email, status: 'onboarding', tier,
    program_slug: lead.program || 'persea-essential', access_status: 'pending',
    is_demo: lead.id.startsWith('demo-'),
  }).select('id').single();
  if (clientErr) {
    // 23505 = unique_violation. Someone else's call won the race for this
    // exact legacy_id between our lookup above and this insert — re-fetch
    // instead of treating it as a real failure, so a genuine race stays
    // idempotent rather than surfacing a confusing DB error to the assistant.
    if (clientErr.code === '23505') {
      const { data: winner } = await supabase.from('clients').select('id').eq('legacy_id', lead.id).maybeSingle();
      if (winner) return { clientId: winner.id, created: false };
    }
    return { error: clientErr.message };
  }

  const valueCents = Math.round((ct.agreedAmount || 0) * 100) || null;
  const { data: contract, error: contractErr } = await supabase.from('contracts').insert({
    client_id: client.id, program, duration, value_cents: valueCents, status: 'info_received',
  }).select('id').single();
  if (contractErr) return { error: contractErr.message };

  // party_info.lead_id and .client_id are mutually exclusive (DB check
  // constraint) — client_id is the one admin/contract.js actually reads
  // from, so that's the one this bridge sets.
  await supabase.from('party_info').insert({
    client_id: client.id, submitted: !!reg.submitted,
    full_name: reg.fullName || fullName, social_name: reg.socialName || null, birth_date: reg.birthDate || null,
    party_type: reg.partyType || 'PF', cpf: reg.cpf || null, rg: reg.rg || null, profession: reg.profession || null,
    nationality: reg.nationality || null, marital_status: reg.maritalStatus || null,
    cnpj: reg.cnpj || null, company_name: reg.companyName || null, email: reg.email || email,
    whatsapp: reg.whatsapp || null, cep: reg.cep || null, street: reg.street || null, number: reg.number || null,
    complement: reg.complement || null, neighborhood: reg.neighborhood || null, city: reg.city || null, state: reg.state || null,
  });

  const lines = (ct.paymentLines || []).filter((l) => l.amount > 0);
  if (lines.length) {
    await supabase.from('contract_payment_lines').insert(
      lines.map((l, i) => ({
        contract_id: contract.id, seq: i, amount_cents: Math.round(l.amount * 100),
        method: l.method || null, due_date: l.dueDate || null, label: l.label || null,
      })),
    );
  }

  return { clientId: client.id, created: true };
}
