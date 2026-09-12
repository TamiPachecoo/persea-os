// Derived onboarding-status + next-action for a real client — computed
// from existing fields (clients.access_status, party_info.submitted,
// contracts.status, whether a profiles row exists), never a new status
// column. Shared by admin/crm.js and admin/client-onboarding.js so the
// logic can't drift between two hand-rolled copies.
export function deriveClientStatus({ accessStatus, partyInfoSubmitted, contractStatus }) {
  // access_status flips to 'created' only by invite-client, on a real
  // successful Supabase Auth invite — the one authoritative "she has an
  // account now" signal, already readable by both admin and assistant
  // (clients_staff_read) unlike `profiles` (admin-only RLS read) — using
  // this instead of a profiles lookup keeps this status derivable by
  // either role without hitting that boundary.
  if (accessStatus === 'created') {
    return { label: 'Ativa', badgeClass: 'badge-completed', nextAction: null };
  }
  if (['signed', 'completed'].includes(contractStatus)) {
    return { label: 'Contrato Assinado — Convite Pendente', badgeClass: 'badge-progress', nextAction: 'send_invite' };
  }
  if (['contract_prepared', 'sent_for_signature', 'awaiting_signature'].includes(contractStatus)) {
    return { label: 'Contrato em Assinatura', badgeClass: 'badge-progress', nextAction: 'await_signature' };
  }
  if (contractStatus === 'info_received' || (partyInfoSubmitted && contractStatus)) {
    return { label: 'Cadastro Recebido — Contrato Pendente', badgeClass: 'badge-progress', nextAction: 'prepare_contract' };
  }
  if (partyInfoSubmitted) {
    return { label: 'Cadastro Recebido — Contrato Pendente', badgeClass: 'badge-progress', nextAction: 'prepare_contract' };
  }
  return { label: 'Aguardando Cadastro', badgeClass: 'badge-locked', nextAction: 'send_registration_link' };
}

export const NEXT_ACTION_LABEL = {
  send_registration_link: 'Copiar link de cadastro',
  prepare_contract: 'Preparar contrato',
  await_signature: 'Aguardando assinatura',
  send_invite: 'Enviar convite de acesso',
};
