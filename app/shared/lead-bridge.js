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
import { supabase } from './supabase-client.js';

function mapProgram(programSlug) {
  if (programSlug === 'ascensao-imagem') return { program: 'ascensao_imagem', duration: null, tier: 'premium' };
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

  const { data: client, error: clientErr } = await supabase.from('clients').insert({
    legacy_id: lead.id, full_name: fullName, email, status: 'onboarding', tier,
    program_slug: lead.program || 'persea-essential', access_status: 'pending',
  }).select('id').single();
  if (clientErr) return { error: clientErr.message };

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
