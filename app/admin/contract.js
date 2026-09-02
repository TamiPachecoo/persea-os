// Contract generation/editing — admin or assistant prepares the real
// contract from the matching template + the client's own commercial terms
// (already gathered at lead activation), makes any minor edits, downloads it
// to run through an external e-signature platform (Autentique/Clicksign/
// DocuSign — whichever Nay uses; signing itself never happens inside this
// app), then uploads the signed file back here once it returns executed.
// Standalone page for now (not yet wired into the mock admin nav, since the
// rest of admin/assistant still runs on MockDB) — reach it directly via
// contract.html?client_id=<uuid>.
import { supabase } from '../shared/supabase-client.js';
import { getCurrentProfile, signOut } from '../shared/supabase-auth.js';
import { mergeContractTemplate } from '../shared/contract-merge.js';
import { renderContractPrintHtml } from '../shared/contract-print.js';
import { card, toast } from '../shared/ui.js';
// Reusing the same program/duration/payment-method vocabulary the rest of
// the app already uses (CRM lead conversion, mock onboarding) — just the
// plain constant lists/labels, nothing MockDB-stateful.
import { PROGRAMS, PROGRAM_LABEL, CONTRACT_DURATIONS, CONTRACT_DURATION_LABEL, PAYMENT_METHODS, PAYMENT_METHOD_LABEL } from '../shared/mock-db.js';

const content = document.getElementById('app-content');
const params = new URLSearchParams(location.search);
let clientId = params.get('client_id');
const legacyId = params.get('legacy_id');

const STATUS_LABEL = {
  info_pending: 'Aguardando informações', info_received: 'Informações recebidas',
  contract_prepared: 'Contrato preparado — pronto para baixar e assinar externamente',
  sent_for_signature: 'Enviado para assinatura externa', awaiting_signature: 'Aguardando assinatura',
  signed: 'Assinado', completed: 'Concluído',
};

const profile = await getCurrentProfile();
if (!profile || !['admin', 'assistant'].includes(profile.role)) {
  // Sign out before redirecting — see supabase-auth.js's requireProfile for
  // why: this stops a stale/racing session from bouncing us right back.
  await signOut();
  location.href = `../login.html?next=${encodeURIComponent(location.pathname + location.search)}`;
  throw new Error('not authorized');
}

// Linked in from the (still mock-based) admin client-detail page, which
// only knows the client's legacy mock id — resolve it here rather than
// teaching that mock page anything about Supabase.
if (!clientId && legacyId) {
  const { data: resolved } = await supabase.from('clients').select('id').eq('legacy_id', legacyId).maybeSingle();
  if (!resolved) {
    content.innerHTML = card(`<p class="text-sm" style="color:var(--terracotta);">Esta cliente ainda não existe no sistema real (Supabase) — apenas nos dados de exemplo.</p>`);
    throw new Error('client not found by legacy_id');
  }
  clientId = resolved.id;
}

if (!clientId) {
  content.innerHTML = card(`<p class="text-sm" style="color:var(--terracotta);">Falta o parâmetro ?client_id= ou ?legacy_id= na URL.</p>`);
  throw new Error('missing client_id');
}

async function load() {
  const [{ data: client }, { data: contract }] = await Promise.all([
    supabase.from('clients').select('id, full_name, email, program_slug, access_status, status, legacy_id').eq('id', clientId).maybeSingle(),
    supabase.from('contracts').select('*').eq('client_id', clientId).maybeSingle(),
  ]);
  if (contract) {
    const { data: paymentLines } = await supabase.from('contract_payment_lines').select('*').eq('contract_id', contract.id).order('seq');
    contract.payment_lines = paymentLines || [];
  }
  return { client, contract };
}

async function findTemplate(program, duration) {
  let query = supabase.from('contract_templates').select('*').eq('program', program);
  query = duration ? query.eq('duration', duration) : query.is('duration', null);
  const { data } = await query.maybeSingle();
  return data;
}

function openPrintableContract(bodyText, clientName) {
  const html = renderContractPrintHtml(bodyText, { title: `Contrato — ${clientName}` });
  const win = window.open('', '_blank');
  win.document.write(html);
  win.document.close();
}

// Everything the payment clause in the contract text is auto-generated
// from (see contract-merge.js's assembleCondicoesPagamento) — entered once,
// here, by whoever closed the deal, so nobody has to hand-type payment
// terms into the contract body afterward. Real deals rarely fit a rigid
// "entrada + N equal installments" shape — an extra Pix deposit between
// card installments, uneven amounts, a renegotiated date — so this is a
// free-form, ordered list: add as many payment lines as were actually
// agreed, each with its own amount/method/optional date, in any order.
// Valor Total is simply the sum of these lines, not a separate input, so
// the contract text and the total can never quietly disagree.
function paymentLineRowHtml(line = {}) {
  return `
    <div class="flex items-center gap-2 py-2 flex-wrap payment-line-row">
      <input type="number" min="0" step="0.01" class="field text-sm" style="width:110px;" data-line-amount placeholder="Valor R$" value="${line.amount_cents ? (line.amount_cents / 100).toFixed(2) : ''}" />
      <select class="field text-sm" style="width:160px;" data-line-method>
        <option value="">Forma —</option>
        ${PAYMENT_METHODS.map((m) => `<option value="${m}" ${line.method === m ? 'selected' : ''}>${PAYMENT_METHOD_LABEL[m]}</option>`).join('')}
      </select>
      <input type="date" class="field text-sm" style="width:150px;" data-line-date value="${line.due_date || ''}" />
      <input type="text" class="field text-sm" style="flex:1; min-width:120px;" data-line-label placeholder="Nota (opcional — ex.: Entrada)" value="${line.label || ''}" />
      <button type="button" class="btn-text" data-remove-line>Remover</button>
    </div>
  `;
}

function renderCommercialTermsForm(contract) {
  const lines = contract.payment_lines?.length ? contract.payment_lines : [{}];
  return card(`
    <p class="text-sm text-white/50 mb-1">Condições Comerciais</p>
    <p class="text-xs text-white/20 mb-4">Preencha o que foi acordado com a cliente — o texto do contrato é gerado automaticamente a partir disso, incluindo a cláusula de pagamento. Registre cada pagamento combinado (entrada, depósitos avulsos, parcelas) em qualquer combinação e ordem — não precisa ser um plano parcelado padrão.</p>
    <form id="terms-form" class="space-y-4">
      <div class="grid sm:grid-cols-2 gap-4">
        <div>
          <label class="text-xs text-white/40 block mb-1">Programa</label>
          <select name="program" class="field">
            <option value="">Selecione...</option>
            ${PROGRAMS.map((p) => `<option value="${p}" ${contract.program === p ? 'selected' : ''}>${PROGRAM_LABEL[p]}</option>`).join('')}
          </select>
        </div>
        <div>
          <label class="text-xs text-white/40 block mb-1">Duração <span class="text-white/20">(Persea)</span></label>
          <select name="duration" class="field" ${contract.program !== 'persea' ? 'disabled' : ''}>
            <option value="">Não aplicável</option>
            ${CONTRACT_DURATIONS.map((d) => `<option value="${d}" ${contract.duration === d ? 'selected' : ''}>${CONTRACT_DURATION_LABEL[d]}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="pt-2" style="border-top:1px solid var(--line);">
        <div class="flex items-center justify-between mb-2">
          <p class="text-xs text-white/40">Pagamentos Acordados</p>
          <p class="text-xs text-white/30">Total: <strong id="lines-total" style="color:var(--gold);">R$ 0,00</strong></p>
        </div>
        <div id="payment-lines">${lines.map((l) => paymentLineRowHtml(l)).join('')}</div>
        <button type="button" id="add-line" class="btn-text mt-1">+ Adicionar Pagamento</button>
      </div>
      <div class="flex justify-end pt-2">
        <button type="submit" class="btn-primary">Salvar Condições Comerciais</button>
      </div>
    </form>
  `);
}

function wireCommercialTermsForm(contract) {
  const form = document.getElementById('terms-form');
  const linesEl = form.querySelector('#payment-lines');
  const totalEl = form.querySelector('#lines-total');

  function recalcTotal() {
    let cents = 0;
    linesEl.querySelectorAll('[data-line-amount]').forEach((input) => { cents += Math.round((parseFloat(input.value) || 0) * 100); });
    totalEl.textContent = (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }
  linesEl.addEventListener('input', (e) => { if (e.target.matches('[data-line-amount]')) recalcTotal(); });
  linesEl.addEventListener('click', (e) => {
    if (!e.target.matches('[data-remove-line]')) return;
    const row = e.target.closest('.payment-line-row');
    if (linesEl.children.length > 1) row.remove();
    else row.querySelectorAll('input, select').forEach((el) => { el.value = ''; });
    recalcTotal();
  });
  form.querySelector('#add-line').addEventListener('click', () => {
    linesEl.insertAdjacentHTML('beforeend', paymentLineRowHtml());
  });
  form.querySelector('[name="program"]').addEventListener('change', (e) => {
    form.querySelector('[name="duration"]').disabled = e.target.value !== 'persea';
  });
  recalcTotal();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const program = fd.get('program') || null;
    const isPersea = program === 'persea';
    if (!program) { toast('Selecione o programa.', { tone: 'error' }); return; }
    if (isPersea && !fd.get('duration')) { toast('Selecione a duração para o programa Persea.', { tone: 'error' }); return; }

    const lines = [...linesEl.querySelectorAll('.payment-line-row')].map((row) => ({
      amount_cents: Math.round((parseFloat(row.querySelector('[data-line-amount]').value) || 0) * 100),
      method: row.querySelector('[data-line-method]').value || null,
      due_date: row.querySelector('[data-line-date]').value || null,
      label: row.querySelector('[data-line-label]').value.trim() || null,
    })).filter((l) => l.amount_cents > 0);
    if (!lines.length) { toast('Adicione ao menos um pagamento com valor.', { tone: 'error' }); return; }
    const valueCents = lines.reduce((s, l) => s + l.amount_cents, 0);

    const { error: cErr } = await supabase.from('contracts').update({
      program, duration: isPersea ? fd.get('duration') : null, value_cents: valueCents,
    }).eq('id', contract.id);
    if (cErr) { toast(cErr.message, { tone: 'error' }); return; }

    // Whole-plan replace, same convention as the CRM's own payment-plan
    // generator — simplest correct way to handle reordered/edited/removed
    // lines without needing stable per-line identity across edits.
    await supabase.from('contract_payment_lines').delete().eq('contract_id', contract.id);
    const { error: lErr } = await supabase.from('contract_payment_lines').insert(
      lines.map((l, i) => ({ contract_id: contract.id, seq: i, ...l })),
    );
    if (lErr) { toast(lErr.message, { tone: 'error' }); return; }

    toast('Condições comerciais salvas.');
    render();
  });
}

async function render() {
  const { client, contract } = await load();
  if (!client) { content.innerHTML = card(`<p class="text-sm" style="color:var(--terracotta);">Cliente não encontrada.</p>`); return; }
  if (!contract) { content.innerHTML = card(`<p class="text-sm" style="color:var(--terracotta);">Nenhum registro de contrato para esta cliente.</p>`); return; }

  const { data: partyInfo } = await supabase.from('party_info').select('*').eq('client_id', clientId).maybeSingle();

  const header = `
    <div class="mb-8">
      <p class="text-white/40 text-sm mb-1">Contrato</p>
      <h1 class="text-3xl font-serif mb-2">${client.full_name}</h1>
      <span class="badge badge-progress">${STATUS_LABEL[contract.status] || contract.status}</span>
    </div>
  `;

  // Demo/training clients (legacy_id prefixed "demo-") get simulated
  // send/sign buttons further down and skip the real invite e-mail here —
  // every real send/invite counts against a real, shared quota (Autentique's
  // monthly documents, Supabase's hourly email rate limit).
  const isDemo = !!client.legacy_id?.startsWith('demo-');

  const termsIncomplete = !contract.program || (contract.program === 'persea' && !contract.duration) || contract.value_cents == null;
  if (termsIncomplete) {
    content.innerHTML = header + renderCommercialTermsForm(contract);
    wireCommercialTermsForm(contract);
    return;
  }

  if (['signed', 'completed'].includes(contract.status) && contract.signed_file_path) {
    const [{ data: viewUrl }, { data: downloadUrl }] = await Promise.all([
      supabase.storage.from('signed-contracts').createSignedUrl(contract.signed_file_path, 3600),
      supabase.storage.from('signed-contracts').createSignedUrl(contract.signed_file_path, 3600, { download: contract.signed_file_name || true }),
    ]);
    content.innerHTML = header + card(`
      <p class="text-sm mb-4" style="color:var(--gold);">✓ Assinado${contract.signed_file_uploaded_at ? ` — enviado em ${new Date(contract.signed_file_uploaded_at).toLocaleString('pt-BR')}` : ''}</p>
      <div class="flex items-center gap-3">
        ${viewUrl ? `<a href="${viewUrl.signedUrl}" target="_blank" rel="noopener" class="btn-ghost inline-block">Visualizar ↗</a>` : ''}
        ${downloadUrl ? `<a href="${downloadUrl.signedUrl}" class="btn-primary inline-block">Baixar Contrato Assinado</a>` : ''}
      </div>
    `, 'mb-6') + card(`
      <p class="text-sm text-white/50 mb-3">Acesso da Cliente ao Sistema</p>
      ${client.access_status === 'created'
        ? `<p class="text-xs mb-3" style="color:var(--gold);">Convite já enviado.</p><button id="invite-client" class="btn-ghost">Reenviar Convite</button>`
        : `<p class="text-xs text-white/30 mb-3">Ela ainda não tem login real — envie o convite para que crie sua própria senha.</p><button id="invite-client" class="btn-primary">Convidar Cliente para Acesso</button>`}
    `);
    document.getElementById('invite-client')?.addEventListener('click', async (e) => {
      e.target.disabled = true;
      e.target.textContent = 'Enviando...';
      // Demo clients (legacy_id "demo-...") skip the real invite e-mail —
      // invite-client detects this itself, mock:true here is just explicit
      // — since Supabase's built-in sender has a strict per-hour rate limit
      // shared with every real invite.
      const { data, error } = await supabase.functions.invoke('invite-client', { body: { client_id: client.id, mock: isDemo } });
      if (error || data?.error) { toast(data?.error || error.message, { tone: 'error' }); e.target.disabled = false; e.target.textContent = 'Convidar Cliente para Acesso'; return; }
      toast(data.mock
        ? (data.resent ? 'Acesso (demo) já existia — nada a reenviar.' : 'Acesso criado (demo) — sem e-mail real enviado, mas o login já funciona de verdade.')
        : (data.resent ? 'Convite reenviado.' : 'Convite enviado — ela receberá um e-mail para criar a senha.'));
      render();
    });
    return;
  }

  if (!contract.body_text) {
    const template = await findTemplate(contract.program, contract.duration);
    content.innerHTML = header + card(`
      ${template
        ? `<p class="text-sm text-white/50 mb-4">Modelo encontrado: ${template.name}</p>
           <button id="generate" class="btn-primary">Gerar Contrato</button>`
        : `<p class="text-sm" style="color:var(--terracotta);">Nenhum modelo de contrato cadastrado para ${contract.program}${contract.duration ? ' / ' + contract.duration : ''}.</p>`}
    `);
    document.getElementById('generate')?.addEventListener('click', async () => {
      const body = mergeContractTemplate(template, { contract, partyInfo, clientFullName: client.full_name });
      const { error } = await supabase.from('contracts').update({ body_text: body, template_id: template.id, status: 'contract_prepared' }).eq('id', contract.id);
      if (error) { toast(error.message, { tone: 'error' }); return; }
      toast('Contrato gerado — revise, baixe e envie para assinatura externa.');
      render();
    });
    return;
  }

  const sentViaAutentique = !!contract.autentique_document_id;

  // Draft ready — edit, then either let Autentique handle the whole
  // send/track/retrieve loop automatically, or fall back to the manual
  // download-and-reupload path (any other e-sign platform, or if the
  // Autentique secret isn't configured yet).
  content.innerHTML = header + card(`
    <p class="text-sm text-white/50 mb-1">Revise o texto antes de enviar para assinatura.</p>
    <p class="text-xs text-white/20 mb-3">O texto abaixo é totalmente editável — para casos específicos (dispensar multa de cancelamento, ajustar uma cláusula para esta cliente, etc.), edite diretamente aqui e salve antes de enviar. Depois de enviado para assinatura, o texto já enviado não pode mais ser alterado por aqui.</p>
    <textarea id="body" rows="20" class="field" style="font-family:inherit; font-size:13px; line-height:1.6;">${escapeHtml(contract.body_text)}</textarea>
    <div class="flex items-center gap-3 mt-4">
      <button id="save" class="btn-ghost">Salvar Alterações</button>
      <button id="download" class="btn-ghost">Baixar Contrato (PDF)</button>
    </div>
  `, 'mb-6') + card(`
    <p class="text-sm text-white/50 mb-3">Assinatura via Autentique${isDemo ? ' <span style="color:var(--terracotta);">— Demonstração</span>' : ''}</p>
    ${isDemo ? `<p class="text-xs mb-3" style="color:var(--terracotta);">⚠ Cliente de demonstração — os botões abaixo simulam o fluxo. Nenhuma chamada real é feita à Autentique, nenhum documento é enviado, nenhuma cota é usada.</p>` : ''}
    ${sentViaAutentique
      ? `<p class="text-xs text-white/30 mb-3">Enviado em ${new Date(contract.sent_for_signature_at).toLocaleString('pt-BR')} — documento Autentique: ${contract.autentique_document_id}</p>
         <button id="${isDemo ? 'check-autentique-demo' : 'check-autentique'}" class="btn-primary">${isDemo ? 'Simular Assinatura Concluída' : 'Verificar Assinatura'}</button>`
      : `<button id="${isDemo ? 'send-autentique-demo' : 'send-autentique'}" class="btn-primary">${isDemo ? 'Simular Envio para Assinatura' : 'Enviar para Assinatura via Autentique'}</button>`}
  `, 'mb-6') + card(`
    <p class="text-sm text-white/50 mb-3">Ou registre manualmente (outra plataforma, ou já assinado fisicamente)</p>
    <input type="file" id="signed-file" accept=".pdf,.docx,.doc" class="field mb-3" />
    <button id="upload" class="btn-ghost">Enviar Contrato Assinado</button>
  `);

  document.getElementById('save').addEventListener('click', async () => {
    const body = document.getElementById('body').value;
    const { error } = await supabase.from('contracts').update({ body_text: body }).eq('id', contract.id);
    if (error) { toast(error.message, { tone: 'error' }); return; }
    toast('Alterações salvas.');
  });
  document.getElementById('download').addEventListener('click', () => {
    openPrintableContract(document.getElementById('body').value, client.full_name);
  });
  document.getElementById('send-autentique')?.addEventListener('click', async (e) => {
    e.target.disabled = true;
    e.target.textContent = 'Enviando...';
    const { data, error } = await supabase.functions.invoke('autentique-send', { body: { contract_id: contract.id } });
    if (error || data?.error) { toast(data?.error || error.message, { tone: 'error' }); e.target.disabled = false; e.target.textContent = 'Enviar para Assinatura via Autentique'; return; }
    toast('Enviado para assinatura via Autentique.');
    render();
  });
  document.getElementById('send-autentique-demo')?.addEventListener('click', async (e) => {
    e.target.disabled = true;
    e.target.textContent = 'Simulando envio...';
    const fakeDocId = `demo-${crypto.randomUUID().slice(0, 8)}`;
    const { error } = await supabase.from('contracts').update({
      autentique_document_id: fakeDocId, status: 'sent_for_signature', sent_for_signature_at: new Date().toISOString(),
    }).eq('id', contract.id);
    if (error) { toast(error.message, { tone: 'error' }); e.target.disabled = false; e.target.textContent = 'Simular Envio para Assinatura'; return; }
    toast('Envio simulado — nenhuma chamada real foi feita à Autentique.');
    render();
  });
  document.getElementById('check-autentique-demo')?.addEventListener('click', async (e) => {
    e.target.disabled = true;
    e.target.textContent = 'Simulando assinatura...';
    // Same end state a real signature produces (status completed + a
    // "signed file" in storage) so the rest of the page — including the
    // real "Convidar Cliente para Acesso" invite button — behaves exactly
    // as it would for a genuine signed contract. Only the file content
    // gives away that it's a demo.
    const path = `${clientId}/${Date.now()}-demo-assinado.txt`;
    const demoContent = new Blob([
      `CONTRATO DE DEMONSTRAÇÃO — ${client.full_name}\n\nEste arquivo simula um contrato assinado para fins de treinamento. Nenhum envio ou assinatura real ocorreu via Autentique.`,
    ], { type: 'text/plain' });
    const { error: upErr } = await supabase.storage.from('signed-contracts').upload(path, demoContent);
    if (upErr) { toast(upErr.message, { tone: 'error' }); e.target.disabled = false; e.target.textContent = 'Simular Assinatura Concluída'; return; }
    const { error } = await supabase.from('contracts').update({
      status: 'completed', signed_file_path: path, signed_file_name: 'contrato-demo-assinado.txt', signed_file_uploaded_at: new Date().toISOString(),
    }).eq('id', contract.id);
    if (error) { toast(error.message, { tone: 'error' }); return; }
    if (client.status !== 'active') await supabase.from('clients').update({ status: 'active' }).eq('id', clientId);
    await supabase.from('client_activity_log').insert({
      client_id: clientId, event_type: 'contract_signed',
      text: 'Contrato assinado (demonstração) — simulação sem envio real à Autentique.', occurred_at: new Date().toISOString(),
    });
    toast('Assinatura simulada — contrato concluído.');
    render();
  });
  document.getElementById('check-autentique')?.addEventListener('click', async (e) => {
    e.target.disabled = true;
    e.target.textContent = 'Verificando...';
    const { data, error } = await supabase.functions.invoke('autentique-status', { body: { contract_id: contract.id } });
    if (error || data?.error) { toast(data?.error || error.message, { tone: 'error' }); e.target.disabled = false; e.target.textContent = 'Verificar Assinatura'; return; }
    if (data.signed) { toast('Assinado! Contrato registrado.'); render(); }
    else { toast('Ainda pendente de assinatura.'); e.target.disabled = false; e.target.textContent = 'Verificar Assinatura'; }
  });
  document.getElementById('upload').addEventListener('click', async () => {
    const fileInput = document.getElementById('signed-file');
    const file = fileInput.files[0];
    if (!file) { toast('Escolha o arquivo assinado antes de enviar.', { tone: 'error' }); return; }
    const path = `${clientId}/${Date.now()}-${file.name}`;
    const { error: upErr } = await supabase.storage.from('signed-contracts').upload(path, file);
    if (upErr) { toast(upErr.message, { tone: 'error' }); return; }
    const { error } = await supabase.from('contracts').update({
      status: 'completed', signed_file_path: path, signed_file_name: file.name, signed_file_uploaded_at: new Date().toISOString(),
    }).eq('id', contract.id);
    if (error) { toast(error.message, { tone: 'error' }); return; }
    toast('Contrato assinado registrado.');
    render();
  });
}

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

render();
