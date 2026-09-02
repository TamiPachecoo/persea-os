// Pure merge-field logic for contract_templates.body_template — no Supabase
// dependency, so it's safely reusable from both the admin generation screen
// and (if ever needed) a server-side function later. Only client identity +
// payment terms vary contract-to-contract; everything else lives fixed in
// the template text itself (see docs/... — Nay edits the template row
// directly if her own business details ever change).
const PAYMENT_METHOD_LABEL = {
  cartao_credito: 'Cartão de Crédito', boleto: 'Boleto', pix: 'Pix', transferencia: 'Transferência',
};
const MONTHS_PT = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];

function formatBRL(cents) {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDateExtenso(d = new Date()) {
  return `${d.getDate()} de ${MONTHS_PT[d.getMonth()]} de ${d.getFullYear()}`;
}

// Production Audit Remediation Pass (Low — cent-perfect splitting): naive
// `total / n` division (and then rounding each share the same way)
// systematically loses or gains cents whenever the total isn't evenly
// divisible — 3 shares of R$100,00 at "R$33,33 each" only add up to
// R$99,99, a real cent quietly missing from the contract's own arithmetic.
// This always sums to exactly `totalCents`: divide in integer cents, then
// hand the remainder (never more than a few cents) one extra cent each to
// the first `remainder` shares — the standard exact-split algorithm, no
// floating point involved anywhere.
function splitCentsExact(totalCents, n) {
  const base = Math.floor(totalCents / n);
  const remainder = totalCents - base * n;
  return Array.from({ length: n }, (_, i) => base + (i < remainder ? 1 : 0));
}

function assembleAddress(p) {
  if (p.address) return p.address;
  const parts = [p.street, p.number, p.complement, p.neighborhood, p.city, p.state].filter(Boolean);
  return parts.join(', ');
}

// Production Audit Remediation Pass (High 6): this used to silently fall
// through to the PF template whenever party_type was 'PJ' but company_name
// was empty — a real risk, since the registration form itself used to
// allow submitting PJ with those fields blank (fixed separately in
// client/registration.js). A contract generated this way would carry PF
// wording for a client who selected PJ, with nothing on screen to say so.
// Now it fails loudly instead: throws, so the caller can show Admin a clear
// error and require the missing data before a contract is generated, per
// the spec's explicit "fail visibly and require correction rather than
// generating PF wording."
function assembleContratanteLine(partyInfo, fallbackFullName) {
  const p = partyInfo || {};
  const fullName = p.full_name || fallbackFullName || '';
  if (p.party_type === 'PJ') {
    if (!p.company_name || !p.cnpj) {
      throw new Error('Cadastro marcado como Pessoa Jurídica mas sem nome da empresa e/ou CNPJ preenchidos — corrija o cadastro antes de gerar o contrato.');
    }
    return `CONTRATANTE PJ: ${p.company_name}, pessoa jurídica inscrita no CNPJ sob o nº ${p.cnpj}, neste ato representada por ${fullName}, residente e domiciliado(a) em ${assembleAddress(p) || '[ENDEREÇO]'}, e-mail: ${p.email || '[E-MAIL]'}.`;
  }
  return `CONTRATANTE PF: ${fullName || '[NOME COMPLETO]'}, inscrito(a) no CPF sob o nº ${p.cpf || '[CPF]'}, residente e domiciliado(a) em ${assembleAddress(p) || '[ENDEREÇO]'}${p.cep ? `, CEP ${p.cep}` : ''}, telefone/WhatsApp: ${p.whatsapp || '[TELEFONE]'}, e-mail: ${p.email || '[E-MAIL]'}.`;
}

// Real deals rarely fit "entrada + N equal installments, one method for
// each part" — extra deposits land between card installments, amounts and
// methods vary line to line, dates get renegotiated. contract.payment_lines
// is a free-form, ordered list (see contract_payment_lines table) — each
// line just an amount + method + optional date — with no assumption about
// shape. Consecutive lines that share the same amount+method are grouped
// into "Nx de R$X via M" for readability; everything else is spelled out.
// Falls back to the legacy single-method fields when no lines exist, so
// contracts generated before this table existed still render unchanged.
// True when consecutive due dates are each exactly one calendar month after
// the previous one, same day-of-month (year rollover included) — the
// pattern a real "6 parcelas mensais, com vencimento todo dia 10" plan
// actually follows. Anything else (uneven gaps, shifted days for month-end
// clamping, a renegotiated date out of sequence) returns false, so it's
// spelled out line by line instead of asserting a cadence that isn't
// really there — preserving exactly the detail the spec asked not to lose.
function isMonthlyCadence(datesISO) {
  if (datesISO.length < 2) return false;
  for (let i = 1; i < datesISO.length; i++) {
    const prev = new Date(`${datesISO[i - 1]}T00:00:00`);
    const cur = new Date(`${datesISO[i]}T00:00:00`);
    const expected = new Date(prev);
    expected.setMonth(expected.getMonth() + 1);
    if (cur.getFullYear() !== expected.getFullYear() || cur.getMonth() !== expected.getMonth() || cur.getDate() !== expected.getDate()) return false;
  }
  return true;
}

function assembleCondicoesPagamento(contract) {
  const methodLabel = (m) => PAYMENT_METHOD_LABEL[m] || m || '[FORMA DE PAGAMENTO]';
  const lines = contract.payment_lines;

  if (Array.isArray(lines) && lines.length) {
    // Production Audit Remediation Pass (Medium — installment wording):
    // groups purely by (amount_cents, method) first, due_date or not — the
    // old logic excluded any dated line from grouping at all, so a real
    // monthly plan (every installment naturally has its own due date) never
    // grouped and always got spelled out one line per month. Whether a
    // candidate group actually reads as "N parcelas mensais" now depends on
    // isMonthlyCadence, checked per group below — irregular dates/amounts/
    // methods still never merge.
    const groups = [];
    for (const line of lines) {
      const last = groups[groups.length - 1];
      if (last && last.amount_cents === line.amount_cents && last.method === line.method) {
        last.dates.push(line.due_date || null);
        last.count += 1;
      } else {
        groups.push({ amount_cents: line.amount_cents, method: line.method, count: 1, dates: [line.due_date || null] });
      }
    }
    const phrases = groups.map((g) => {
      const amount = formatBRL(g.amount_cents);
      const method = methodLabel(g.method);
      const allDated = g.dates.every(Boolean);
      if (g.count === 1) {
        const dateSuffix = g.dates[0] ? ` em ${new Date(`${g.dates[0]}T00:00:00`).toLocaleDateString('pt-BR')}` : '';
        return `${amount} via ${method}${dateSuffix}`;
      }
      if (allDated && isMonthlyCadence(g.dates)) {
        const first = new Date(`${g.dates[0]}T00:00:00`);
        const day = first.getDate();
        return `${g.count} (${g.count === 12 ? 'doze' : g.count}) parcelas mensais de ${amount} via ${method}, com início em ${first.toLocaleDateString('pt-BR')} e vencimento todo dia ${day}`;
      }
      if (!allDated && g.dates.every((d) => !d)) {
        return `${g.count} (${g.count === 12 ? 'doze' : g.count}) parcelas de ${amount}, sem juros, via ${method}`;
      }
      // Same amount/method but dates don't form a clean monthly cadence
      // (or only some lines carry one) — never assert a pattern that isn't
      // really there; fall back to spelling each one out individually.
      return g.dates.map((d) => `${amount} via ${method}${d ? ` em ${new Date(`${d}T00:00:00`).toLocaleDateString('pt-BR')}` : ''}`).join(', ');
    });
    if (phrases.length === 1) return phrases[0];
    return `${phrases.slice(0, -1).join(', ')} e ${phrases[phrases.length - 1]}`;
  }

  // Legacy path — no payment_lines recorded, fall back to the old flat
  // down-payment + equal-installments fields.
  const down = contract.down_payment_cents || 0;
  const installments = contract.installments || (down > 0 ? 0 : 1);
  const balance = Math.max(0, (contract.value_cents || 0) - down);
  const installmentsClause = () => {
    if (installments <= 0) return null;
    if (installments === 1) return `${formatBRL(balance)} via ${methodLabel(contract.payment_method)}`;
    // Cent-exact (see splitCentsExact) — the old `Math.round(balance /
    // installments)` repeated the same rounded figure for every
    // installment, which for a non-evenly-divisible total quietly summed to
    // a cent more or less than the actual contract value (Production Audit
    // Remediation Pass, Low). This is forward-looking only, per the spec —
    // it never touches an already-signed contract's stored text.
    const shares = splitCentsExact(balance, installments);
    const allEqual = shares.every((c) => c === shares[0]);
    const perInstallment = allEqual ? formatBRL(shares[0]) : `${formatBRL(shares[0])} (a última de ${formatBRL(shares[shares.length - 1])})`;
    return `${installments} (${installments === 12 ? 'doze' : installments}) parcelas de ${perInstallment}, sem juros, via ${methodLabel(contract.payment_method)}`;
  };
  if (down > 0) {
    const downClause = `entrada de ${formatBRL(down)} via ${methodLabel(contract.down_payment_method)}`;
    const rest = installmentsClause();
    return rest ? `${downClause}, seguida de ${rest}` : downClause;
  }
  return installments <= 1 ? `pagamento único via ${methodLabel(contract.payment_method)}` : (installmentsClause() || `pagamento único via ${methodLabel(contract.payment_method)}`);
}

// contract: row from `contracts` (needs value_cents, payment_method, installments).
// partyInfo: row from `party_info` for this client (may be null/incomplete —
// unresolved tokens are left as bracketed placeholders, visible in the
// editable draft so Nay/assistant can't miss filling them by hand).
export function mergeContractTemplate(template, { contract, partyInfo, clientFullName }) {
  const tokens = {
    CONTRATANTE_LINE: assembleContratanteLine(partyInfo, clientFullName),
    CONTRATANTE_NOME: (partyInfo && partyInfo.full_name) || clientFullName || '[NOME DO(A) CONTRATANTE]',
    VALOR_TOTAL: contract.value_cents != null ? formatBRL(contract.value_cents) : '[VALOR]',
    CONDICOES_PAGAMENTO: contract.value_cents != null ? assembleCondicoesPagamento(contract) : '[CONDIÇÕES DE PAGAMENTO]',
    CIDADE: 'Belo Horizonte',
    DATA_ASSINATURA: formatDateExtenso(),
  };
  return template.body_template.replace(/\{\{(\w+)\}\}/g, (_, key) => tokens[key] ?? `{{${key}}}`);
}
