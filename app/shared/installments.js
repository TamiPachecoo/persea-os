// Splits a total into N equal installments, one month apart. Cents that
// don't divide evenly go one each to the first installments, so the sum is
// always exactly the total (R$ 1.000 in 3x → 333,34 + 333,33 + 333,33).
// Dates keep the first due day; in shorter months they fall on the last day
// (31/01 → 28/02 → 31/03).
export function addMonthsISO(iso, months) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, last));
  return target.toISOString().slice(0, 10);
}

export function splitInstallments(totalCents, count, { firstDue = '', method = 'pix', label = '' } = {}) {
  const n = Math.max(1, Math.floor(count));
  const base = Math.floor(totalCents / n);
  const extra = totalCents - base * n;
  return Array.from({ length: n }, (_, i) => ({
    amount_cents: base + (i < extra ? 1 : 0),
    method,
    due_date: firstDue ? addMonthsISO(firstDue, i) : '',
    label: n > 1 ? `${label || 'Parcela'} ${i + 1}/${n}` : (label || ''),
  }));
}
