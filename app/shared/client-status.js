// Derived onboarding-status label for a real client — computed from
// existing fields (clients.access_status, party_info.submitted,
// contracts.status), never a new status column. Shared between admin/crm.js
// and any future page that needs the same "where is she in onboarding"
// read, so the logic can't drift between two hand-rolled copies.
export function deriveClientStatus({ accessStatus, partyInfoSubmitted, contractStatus }) {
  if (accessStatus === 'created') return { label: 'Ativa', badgeClass: 'badge-completed' };
  if (!partyInfoSubmitted) return { label: 'Aguardando Cadastro', badgeClass: 'badge-locked' };
  if (!contractStatus || contractStatus === 'info_pending') return { label: 'Cadastro Recebido — Contrato Pendente', badgeClass: 'badge-progress' };
  if (['contract_prepared', 'sent_for_signature', 'awaiting_signature'].includes(contractStatus)) {
    return { label: 'Contrato em Assinatura', badgeClass: 'badge-progress' };
  }
  if (['signed', 'completed'].includes(contractStatus)) return { label: 'Contrato Concluído — Convite Pendente', badgeClass: 'badge-progress' };
  return { label: 'Onboarding', badgeClass: 'badge-locked' };
}
