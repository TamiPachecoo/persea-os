// Final Core Production Architecture Pass, Part 3 — the ONE place "A
// Receber"/"Em Atraso" get computed for real Supabase contracts, so
// admin/financial.js (tenant-wide), admin/client-detail.js (per-client),
// and admin/payments.js never compute this three different ways.
//
// Corrects the prior pass's assumption (A Receber = payments where status
// is pending/overdue): a contractual obligation exists even if Nay never
// generated a SumUp checkout for it. The real source of truth is
// contract_payment_lines belonging to a contract's CURRENT signed version
// (payment_plan_versions.status = 'active' — never 'draft', which isn't
// signed yet, and never 'superseded', which is a past version no longer in
// effect) minus payment_allocations from confirmed ('paid') payments.
import { supabase } from './supabase-client.js';
import { deriveLineEffectiveState } from './date-utils.js';

// contractId: scope to one contract (per-client Financeiro). excludeDemo:
// true for tenant-wide KPIs (never let demo/test clients inflate real
// numbers, same is_demo rule used everywhere else in this app).
export async function loadActiveObligations({ contractId = null, excludeDemo = false } = {}) {
  let query = supabase.from('contract_payment_lines').select(
    'id, contract_id, amount_cents, due_date, method, label, seq, payment_plan_versions!inner(status, version_number), contracts!inner(client_id, value_cents, clients!inner(is_demo, full_name))',
  ).eq('payment_plan_versions.status', 'active');
  if (contractId) query = query.eq('contract_id', contractId);
  if (excludeDemo) query = query.eq('contracts.clients.is_demo', false);

  const { data: lines, error } = await query;
  if (error) return { error: error.message };
  if (!lines?.length) return { lines: [] };

  // Allocated totals come only from CONFIRMED payments — an allocation
  // against a still-pending payment must never reduce what's shown as owed.
  const lineIds = lines.map((l) => l.id);
  const { data: allocations, error: allocErr } = await supabase
    .from('payment_allocations')
    .select('payment_line_id, amount_cents, payments!inner(status)')
    .eq('payments.status', 'paid')
    .in('payment_line_id', lineIds);
  if (allocErr) return { error: allocErr.message };

  const allocatedByLine = {};
  (allocations || []).forEach((a) => {
    allocatedByLine[a.payment_line_id] = (allocatedByLine[a.payment_line_id] || 0) + a.amount_cents;
  });

  const enriched = lines.map((l) => {
    const allocated_cents = allocatedByLine[l.id] || 0;
    const outstanding_cents = l.amount_cents - allocated_cents;
    const { status } = deriveLineEffectiveState({ amount_cents: l.amount_cents, allocated_cents, outstanding_cents, due_date: l.due_date });
    return { ...l, allocated_cents, outstanding_cents, effective_status: status };
  });
  return { lines: enriched };
}

// aReceberCents never nets a negative outstanding against a positive one
// across lines (Math.max(0, ...) per line) — an overpaid line (shouldn't
// exist given enforce_allocation_limits, but defensive regardless) never
// silently offsets another line's real balance.
export function summarizeObligations(lines) {
  const aReceberCents = lines.reduce((s, l) => s + Math.max(0, l.outstanding_cents), 0);
  const emAtrasoCents = lines
    .filter((l) => l.effective_status === 'overdue' || l.effective_status === 'partially_paid_overdue')
    .reduce((s, l) => s + Math.max(0, l.outstanding_cents), 0);
  return { aReceberCents, emAtrasoCents };
}
