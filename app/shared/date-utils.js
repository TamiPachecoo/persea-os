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
