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

function assembleAddress(p) {
  if (p.address) return p.address;
  const parts = [p.street, p.number, p.complement, p.neighborhood, p.city, p.state].filter(Boolean);
  return parts.join(', ');
}

function assembleContratanteLine(partyInfo, fallbackFullName) {
  const p = partyInfo || {};
  const fullName = p.full_name || fallbackFullName || '';
  if (p.party_type === 'PJ' && p.company_name) {
    return `CONTRATANTE PJ: ${p.company_name}, pessoa jurídica inscrita no CNPJ sob o nº ${p.cnpj || '[CNPJ]'}, neste ato representada por ${fullName}, residente e domiciliado(a) em ${assembleAddress(p) || '[ENDEREÇO]'}, e-mail: ${p.email || '[E-MAIL]'}.`;
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
function assembleCondicoesPagamento(contract) {
  const methodLabel = (m) => PAYMENT_METHOD_LABEL[m] || m || '[FORMA DE PAGAMENTO]';
  const lines = contract.payment_lines;

  if (Array.isArray(lines) && lines.length) {
    const groups = [];
    for (const line of lines) {
      const last = groups[groups.length - 1];
      if (last && last.amount_cents === line.amount_cents && last.method === line.method && !line.due_date && !last.dates.length) {
        last.count += 1;
      } else {
        groups.push({ amount_cents: line.amount_cents, method: line.method, count: 1, dates: line.due_date ? [line.due_date] : [] });
      }
    }
    const phrases = groups.map((g) => {
      const amount = formatBRL(g.amount_cents);
      const method = methodLabel(g.method);
      const dateSuffix = g.dates.length === 1 ? ` em ${new Date(`${g.dates[0]}T00:00:00`).toLocaleDateString('pt-BR')}` : '';
      if (g.count > 1) return `${g.count} (${g.count === 12 ? 'doze' : g.count}) parcelas de ${amount}, sem juros, via ${method}`;
      return `${amount} via ${method}${dateSuffix}`;
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
    const perInstallment = formatBRL(Math.round(balance / installments));
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
