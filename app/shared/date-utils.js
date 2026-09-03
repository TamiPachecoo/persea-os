// Production Audit Remediation Pass (Medium — "Em Atraso" real derivation).
// Tiny, dependency-free module (importable from both mock-db.js and the
// real-Supabase admin pages without creating a circular import — ui.js
// already imports from mock-db.js, so mock-db.js can't import from ui.js).
//
// "Overdue" must be a computed view, never a manually-set flag that can go
// stale: a payment is overdue exactly when it's still pending/unpaid AND
// its due date has passed, using Brazil's calendar day (America/Sao_Paulo),
// not the server/browser's local timezone or a raw timestamp compare.

// YYYY-MM-DD for "today" in Brazil, so a due date of today is never
// prematurely treated as overdue regardless of what timezone this code
// happens to run in (browser or Deno edge function).
export function todayISOInBrazil() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
}

// dueDateISO must be a plain 'YYYY-MM-DD' date (never a full timestamp —
// string comparison relies on that). Only ever elevates 'pending' to
// 'overdue'; every other status (paid, failed, cancelled, refunded,
// expired, or an already-'overdue' row) passes through untouched — this
// derives, it never invents a status the underlying data doesn't already
// support.
export function deriveEffectiveStatus(status, dueDateISO) {
  if (status === 'pending' && dueDateISO && dueDateISO < todayISOInBrazil()) return 'overdue';
  return status;
}

// Final Core Production Architecture Pass, Part 3: the contractual-
// obligation-level equivalent of deriveEffectiveStatus above — takes a row
// from contract_payment_lines_effective (amount_cents, allocated_cents,
// outstanding_cents, due_date) and derives its real state from the
// obligation itself, not from whether a SumUp checkout happens to exist.
// Never invents a new stored status — 'partially_paid_overdue' is a
// derived UI label, nothing is ever written back as that string.
export function deriveLineEffectiveState(line) {
  const outstanding = line.outstanding_cents ?? (line.amount_cents - (line.allocated_cents || 0));
  const partiallyPaid = (line.allocated_cents || 0) > 0 && outstanding > 0;
  if (outstanding <= 0) return { status: 'paid', outstandingCents: 0 };
  const isPastDue = !!line.due_date && line.due_date < todayISOInBrazil();
  if (isPastDue) return { status: partiallyPaid ? 'partially_paid_overdue' : 'overdue', outstandingCents: outstanding };
  return { status: partiallyPaid ? 'partially_paid' : 'pending', outstandingCents: outstanding };
}
