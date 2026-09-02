// Cadastros — the assistant's slice of the post-sale pipeline. Nay closes
// the deal and sends the registration link (see admin/leads.js); from the
// moment the client fills it in, prepping the contract and activating her
// access are the assistant's job. One card per lead, ordered so whoever is
// one click from activation is always on top — same "crucial thing near
// the top" rule as her client checklist (see getAssistantOnboardingQueue).
import {
  MockDB, ONBOARDING_STAGES, ONBOARDING_STAGE_LABEL, LEAD_ONBOARDING_STATUS_BADGE_CLASS, PROGRAM_LABEL_BY_SLUG,
  PAYMENT_METHOD_LABEL,
} from '../shared/mock-db.js';
import { renderShell, card, toast, formatDate } from '../shared/ui.js';
import { ensureRealClientForLead } from '../shared/lead-bridge.js';
import { getCurrentProfile, requireProfile } from '../shared/supabase-auth.js';
import { supabase } from '../shared/supabase-client.js';

const REAL_STATUS_LABEL = {
  info_pending: 'Aguardando informações', info_received: 'Informações recebidas',
  contract_prepared: 'Contrato preparado', sent_for_signature: 'Enviado para assinatura',
  awaiting_signature: 'Aguardando assinatura', signed: 'Assinado', completed: 'Assinado e concluído',
};
const REAL_STATUS_CLASS = {
  contract_prepared: 'badge-progress', sent_for_signature: 'badge-progress', awaiting_signature: 'badge-progress',
  signed: 'badge-completed', completed: 'badge-completed',
};

// Once a lead's contract exists in the real system (see shared/lead-bridge.js),
// that real contract/access status — not the old mock onboardingStatus field
// — is the source of truth for whether she's signed and whether her login
// exists yet. One bulk query for the whole visible queue rather than N+1.
async function loadRealStatuses(leadIds) {
  if (!leadIds.length) return new Map();
  const { data } = await supabase.from('clients')
    .select('id, legacy_id, access_status, contracts(id, status, autentique_document_id)')
    .in('legacy_id', leadIds);
  const map = new Map();
  (data || []).forEach((c) => {
    const contract = Array.isArray(c.contracts) ? c.contracts[0] : c.contracts;
    map.set(c.legacy_id, {
      clientId: c.id, accessStatus: c.access_status,
      contractId: contract?.id, contractStatus: contract?.status, autentiqueDocId: contract?.autentique_document_id,
    });
  });
  return map;
}

// Demo/training clients (legacy_id prefixed "demo-") live entirely in the
// real Supabase tables — no mock lead record backs them, so they show up
// here even without pasting anything into localStorage first. Real leads
// are unaffected; this only ever adds synthetic queue entries for rows
// that don't already have a mock lead with the same id.
async function loadDemoLeads(existingIds) {
  const { data } = await supabase.from('clients')
    .select('id, legacy_id, full_name, email, program_slug, contracts(value_cents, contract_payment_lines(amount_cents, method, due_date, label))')
    .ilike('legacy_id', 'demo-%');
  return (data || [])
    .filter((c) => c.legacy_id && !existingIds.has(c.legacy_id))
    .map((c) => {
      const contract = Array.isArray(c.contracts) ? c.contracts[0] : c.contracts;
      const lines = contract?.contract_payment_lines || [];
      return {
        id: c.legacy_id, fullName: c.full_name, email: c.email, program: c.program_slug,
        onboardingStatus: 'registration_completed', pipelineLabel: 'Cadastro Recebido — Contrato Pendente',
        registrationCompletedAt: new Date().toISOString(),
        registrationInfo: { submitted: true, fullName: c.full_name, email: c.email },
        commercialTerms: lines.length ? {
          paymentLines: lines.map((l) => ({ amount: l.amount_cents / 100, method: l.method, dueDate: l.due_date, label: l.label })),
          agreedAmount: contract?.value_cents ? contract.value_cents / 100 : null,
        } : null,
        contractStatus: null,
      };
    });
}

if (!(await requireProfile('assistant'))) throw new Error('not authorized');
document.body.innerHTML = renderShell({ role: 'assistant', active: 'leads.html', title: 'Cadastros' });
const content = document.getElementById('app-content');

function registrationSummary(info) {
  if (!info || !info.submitted) return '<p class="text-sm" style="color:var(--muted);">Ainda não preenchido.</p>';
  const rows = [
    ['Nome completo', info.fullName], ['Nome social', info.socialName], ['Nascimento', info.birthDate && formatDate(info.birthDate)],
    ['CPF', info.cpf], ['RG', info.rg], ['Profissão', info.profession], ['Nacionalidade', info.nationality], ['Estado civil', info.maritalStatus],
    ['Email', info.email], ['WhatsApp', info.whatsapp],
    ['Endereço', [info.street && `${info.street}, ${info.number || 's/n'}`, info.complement, info.neighborhood, info.city && info.state && `${info.city} - ${info.state}`, info.cep].filter(Boolean).join(' · ')],
  ].filter(([, v]) => v);
  return `<div class="grid sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">${rows.map(([l, v]) => `<div><p class="text-xs text-white/30">${l}</p><p>${v}</p></div>`).join('')}</div>`;
}

// What Nay agreed with the client on the closing call (see admin/lead-
// detail.js's Condições Comerciais) — surfaced here, before contract
// creation, specifically so any special request or requested change
// (waived fee, adjusted clause, custom wording) is visible to whoever
// prepares the contract instead of living only on Nay's side. The real
// contract text is still free-editable after generation (contract.html) —
// this is what tells the assistant *what* to go edit there.
function commercialSummary(ct) {
  if (!ct) return '';
  const lines = ct.paymentLines || [];
  return `
    <div class="mb-4 pb-4" style="border-bottom:1px solid var(--line);">
      <p class="text-xs uppercase mb-2" style="color:var(--muted); letter-spacing:.1em;">Condições Comerciais</p>
      ${lines.length ? `
        <div class="space-y-1 mb-3">
          ${lines.map((pl) => `
            <p class="text-sm">R$ ${Number(pl.amount).toLocaleString('pt-BR')}${pl.method ? ` via ${PAYMENT_METHOD_LABEL[pl.method] || pl.method}` : ''}${pl.dueDate ? ` · ${formatDate(pl.dueDate)}` : ''}${pl.label ? ` · ${pl.label}` : ''}</p>
          `).join('')}
        </div>
      ` : ''}
      ${ct.commercialNotes ? `
        <div style="border-left:3px solid var(--gold); border-radius:4px; padding:8px 12px; background:rgba(220,199,168,.06);">
          <p class="text-xs mb-1" style="color:var(--gold);">⚠ Pedido especial / observações da Nay</p>
          <p class="text-sm">${ct.commercialNotes}</p>
        </div>
      ` : ''}
    </div>
  `;
}

// Once a real client/contract exists (see shared/lead-bridge.js), that's
// the actual source of truth for signature + access — not the old mock
// contractStatus field, which the real system never touches. This is also
// the answer to "where does the assistant create the login": right here,
// the moment the real contract shows signed/completed but access_status is
// still 'pending', calling the same invite-client function contract.html
// uses — no trip to a different page required to find it.
function realContractSection(l, real) {
  const gold = 'style="color:var(--gold);"';
  // Demo clients (legacy_id "demo-...") never actually reach Autentique, so
  // the real "Verificar Assinatura" button (which calls the real Autentique
  // API) would just fail here — offer the same simulated sign-off contract.html
  // has instead, so the whole walkthrough can stay on this one tab.
  const isDemo = l.id.startsWith('demo-');
  const canSign = real.autentiqueDocId && !['completed'].includes(real.contractStatus);
  return `
    <div class="pt-4" style="border-top:1px solid var(--line);">
      <div class="flex items-center justify-between mb-3">
        <p class="text-xs uppercase" style="color:var(--muted); letter-spacing:.1em;">Contrato (Sistema Real)${isDemo ? ' <span style="color:var(--terracotta);">— Demonstração</span>' : ''}</p>
        <span class="badge ${REAL_STATUS_CLASS[real.contractStatus] || 'badge-locked'}">${REAL_STATUS_LABEL[real.contractStatus] || real.contractStatus}</span>
      </div>
      <div class="flex items-center gap-2 flex-wrap mb-1">
        <a href="../admin/contract.html?legacy_id=${l.id}" class="btn-ghost">Abrir Contrato →</a>
        ${canSign
          ? (isDemo
              ? `<button data-simulate-signature="${l.id}" class="btn-ghost">Simular Assinatura Concluída</button>`
              : `<button data-verify-signature="${l.id}" class="btn-ghost">Verificar Assinatura</button>`)
          : ''}
      </div>
      ${['signed', 'completed'].includes(real.contractStatus) ? `
        <div class="mt-3 pt-3" style="border-top:1px solid var(--line);">
          ${real.accessStatus === 'created' ? `
            <p class="text-sm mb-2" ${gold}>✓ Acesso criado — convite já enviado.</p>
            <button data-create-access="${l.id}" class="btn-text">Reenviar Convite</button>
          ` : `
            <p class="text-sm mb-2" ${gold}>Contrato assinado — falta criar o acesso dela ao Persea OS.</p>
            <button data-create-access="${l.id}" class="btn-primary" style="padding:9px 18px;font-size:12.5px;">Criar Acesso</button>
          `}
        </div>
      ` : ''}
    </div>
  `;
}

function leadCard(l, real) {
  const status = l.contractStatus || 'info_pending';
  const ready = l.onboardingStatus === 'ready_for_activation';
  return card(`
    <div class="flex items-center justify-between flex-wrap gap-2 mb-1">
      <p class="font-medium">${l.fullName}</p>
      <span class="badge ${LEAD_ONBOARDING_STATUS_BADGE_CLASS[l.onboardingStatus] || 'badge-locked'}">${l.pipelineLabel}</span>
    </div>
    <p class="text-xs text-white/30 mb-4">${PROGRAM_LABEL_BY_SLUG[l.program] || 'Programa a definir'} · cadastro recebido em ${formatDate(l.registrationCompletedAt)}</p>

    <details class="mb-4">
      <summary class="text-xs cursor-pointer" style="color:var(--muted); list-style:none;">▸ Ver dados do cadastro</summary>
      <div class="mt-3">${registrationSummary(l.registrationInfo)}</div>
    </details>

    ${commercialSummary(l.commercialTerms)}

    ${real ? realContractSection(l, real) : `
      <div class="pt-4" style="border-top:1px solid var(--line);">
        <p class="text-xs uppercase mb-3" style="color:var(--muted); letter-spacing:.1em;">Contrato</p>
        ${status === 'completed' ? `
          <p class="text-sm" style="color:var(--gold);">Arquivado: ${l.signedFileName || 'contrato-assinado.pdf'}</p>
        ` : `
          <button data-prepare-contract="${l.id}" class="btn-primary" style="padding:9px 18px;font-size:12.5px;">Preparar Contrato →</button>
          <p class="text-xs text-white/30 mt-2 mb-4">Leva para o contrato real desta cliente, já preenchido com o programa, valor e forma(s) de pagamento acordados.${l.commercialTerms?.commercialNotes ? ' Aplique o pedido especial acima diretamente no texto antes de enviar para assinatura.' : ' É só revisar e enviar para assinatura via Autentique.'}</p>
          <details>
            <summary class="text-xs cursor-pointer" style="color:var(--muted); list-style:none;">▸ Assinatura fora da Autentique (fluxo manual)</summary>
            <div class="mt-3">
              <div class="flex items-center gap-2 mb-3">
                <select data-contract-status="${l.id}" class="field text-sm">
                  ${ONBOARDING_STAGES.map((s) => `<option value="${s}" ${status === s ? 'selected' : ''}>${ONBOARDING_STAGE_LABEL[s]}</option>`).join('')}
                </select>
                <button data-update-contract="${l.id}" class="btn-ghost">Atualizar</button>
              </div>
              <button data-upload-contract="${l.id}" class="btn-ghost">Fazer upload do contrato autenticado</button>
              <p class="text-xs text-white/30 mt-3">Use apenas se a assinatura aconteceu fora da Autentique (ex.: assinatura física). O upload aqui não ativa o acesso dela automaticamente — use "Ativar Cliente" abaixo depois.</p>
            </div>
          </details>
        `}
      </div>
    `}

    ${ready && !real ? `
      <div class="mt-4 pt-4" style="border-top:1px solid var(--line);">
        <p class="text-sm mb-1" style="color:var(--gold);">Pronta para ativação</p>
        <p class="text-xs text-white/20 mb-3">Cria o perfil dela com tudo já preenchido e libera o acesso ao Persea OS — ela usa o email já cadastrado e cria a própria senha no primeiro acesso.</p>
        <button data-activate="${l.id}" class="btn-primary" style="padding:10px 20px;font-size:13px;">Ativar Cliente</button>
      </div>
    ` : ''}
  `, 'mb-6');
}

async function render() {
  const mockQueue = MockDB.getAssistantOnboardingQueue();
  const demoLeads = await loadDemoLeads(new Set(mockQueue.map((l) => l.id)));
  const queue = [...mockQueue, ...demoLeads];
  const realStatuses = await loadRealStatuses(queue.map((l) => l.id));
  content.innerHTML = `
    <div class="mb-8">
      <p class="text-white/40 text-sm mb-1">Cadastros</p>
      <h1 class="text-3xl font-serif">Contrato e Ativação</h1>
      <p class="text-sm text-white/40 mt-2 max-w-2xl">Assim que uma lead preenche o cadastro que a Nay enviou, ela aparece aqui — prepare e faça upload do contrato assinado, depois ative o acesso dela.</p>
    </div>
    ${queue.length ? queue.map((l) => leadCard(l, realStatuses.get(l.id))).join('') : card('<p class="text-sm" style="color:var(--muted);">Nenhum cadastro pendente agora.</p>')}
  `;

  content.querySelectorAll('[data-prepare-contract]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.prepareContract;
      const lead = MockDB.getLead(id);
      const profile = await getCurrentProfile();
      if (!profile || !['admin', 'assistant'].includes(profile.role)) {
        toast('Faça login no sistema real (login.html) antes de preparar o contrato.', { tone: 'error' });
        return;
      }
      btn.disabled = true; btn.textContent = 'Preparando...';
      const result = await ensureRealClientForLead(lead);
      if (result.error) { toast(result.error, { tone: 'error' }); btn.disabled = false; btn.textContent = 'Preparar Contrato →'; return; }
      location.href = `../admin/contract.html?legacy_id=${id}`;
    });
  });
  content.querySelectorAll('[data-update-contract]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.updateContract;
      const status = content.querySelector(`[data-contract-status="${id}"]`).value;
      MockDB.advanceLeadContractStatus(id, status);
      toast('Status do contrato atualizado.');
      render();
    });
  });
  content.querySelectorAll('[data-upload-contract]').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      const id = btn.dataset.uploadContract;
      e.target.disabled = true; e.target.textContent = 'Enviando…';
      await MockDB.uploadLeadSignedContract(id, `contrato-${id}-assinado.pdf`);
      toast('Contrato assinado enviado — pronta para ativação.');
      render();
    });
  });
  content.querySelectorAll('[data-activate]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.activate;
      const result = MockDB.activateLead(id);
      if (!result.ok) { toast('Não foi possível ativar — verifique cadastro e contrato.', { tone: 'error' }); return; }
      toast('Cliente ativada — acesso ao Persea OS liberado!');
      location.href = `client-workspace.html?id=${result.clientId}`;
    });
  });
  content.querySelectorAll('[data-verify-signature]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.verifySignature;
      const real = realStatuses.get(id);
      btn.disabled = true; btn.textContent = 'Verificando...';
      const { data, error } = await supabase.functions.invoke('autentique-status', { body: { contract_id: real.contractId } });
      if (error || data?.error) { toast(data?.error || error.message, { tone: 'error' }); btn.disabled = false; btn.textContent = 'Verificar Assinatura'; return; }
      toast(data.signed ? 'Assinado! Contrato registrado.' : 'Ainda pendente de assinatura.');
      render();
    });
  });
  content.querySelectorAll('[data-simulate-signature]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.simulateSignature;
      const real = realStatuses.get(id);
      const lead = queue.find((l) => l.id === id);
      btn.disabled = true; btn.textContent = 'Simulando...';
      // Mirrors contract.html's own demo sign-off exactly — a placeholder
      // file (never a real Autentique signature) that still produces the
      // same end state a genuine one does, so "Criar Acesso" below behaves
      // identically either way.
      const path = `${real.clientId}/${Date.now()}-demo-assinado.txt`;
      const demoContent = new Blob([
        `CONTRATO DE DEMONSTRAÇÃO — ${lead?.fullName || ''}\n\nEste arquivo simula um contrato assinado para fins de treinamento. Nenhum envio ou assinatura real ocorreu via Autentique.`,
      ], { type: 'text/plain' });
      const { error: upErr } = await supabase.storage.from('signed-contracts').upload(path, demoContent);
      if (upErr) { toast(upErr.message, { tone: 'error' }); btn.disabled = false; btn.textContent = 'Simular Assinatura Concluída'; return; }
      const { error } = await supabase.from('contracts').update({
        status: 'completed', signed_file_path: path, signed_file_name: 'contrato-demo-assinado.txt', signed_file_uploaded_at: new Date().toISOString(),
      }).eq('id', real.contractId);
      if (error) { toast(error.message, { tone: 'error' }); return; }
      await supabase.from('clients').update({ status: 'active' }).eq('id', real.clientId);
      await supabase.from('client_activity_log').insert({
        client_id: real.clientId, event_type: 'contract_signed',
        text: 'Contrato assinado (demonstração) — simulação sem envio real à Autentique.', occurred_at: new Date().toISOString(),
      });
      toast('Assinatura simulada — contrato concluído.');
      render();
    });
  });
  content.querySelectorAll('[data-create-access]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.createAccess;
      const real = realStatuses.get(id);
      btn.disabled = true; btn.textContent = 'Enviando...';
      // Demo clients skip the real invite e-mail (invite-client detects this
      // itself from legacy_id, mock:true here is just explicit) — Supabase's
      // built-in sender has a strict per-hour rate limit shared with every
      // real invite, so repeated demo runs would otherwise burn through it.
      const { data, error } = await supabase.functions.invoke('invite-client', { body: { client_id: real.clientId, mock: id.startsWith('demo-') } });
      if (error || data?.error) { toast(data?.error || error.message, { tone: 'error' }); btn.disabled = false; btn.textContent = 'Criar Acesso'; return; }
      toast(data.mock
        ? (data.resent ? 'Acesso (demo) já existia — nada a reenviar.' : 'Acesso criado (demo) — sem e-mail real enviado, mas o login já funciona de verdade.')
        : (data.resent ? 'Convite reenviado.' : 'Acesso criado — ela receberá um e-mail para criar a senha.'));
      render();
    });
  });
}

render();
