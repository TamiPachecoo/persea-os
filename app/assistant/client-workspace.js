// Assistant's per-client workspace — the "who is this client and what do I
// still owe her" view. Two halves: a read-only context bundle (so she never
// has to answer a question or prepare a deliverable blind) and a live
// checklist covering every responsibility Nay handed her for this client.
// Anything client-facing (image guides, Digital Kit) goes through Nay's
// review queue before it ever reaches the client — see submitForReview.
import {
  MockDB, DEFAULT_CLIENT_ID, ONBOARDING_STAGES, ONBOARDING_STAGE_LABEL,
  WHATSAPP_STATUSES, WHATSAPP_STATUS_LABEL, IMAGE_GUIDE_LABEL, GUIDE_STATUS_LABEL,
  HUBLA_STATUS_LABEL, PAYMENT_STATUS_LABEL, NF_STATUS_LABEL, PAYMENT_METHOD_LABEL,
  IMAGE_STATUS_LABEL, AGENDA_TYPE_LABEL,
} from '../shared/mock-db.js';
import { renderShell, card, toast, formatDate, formatDateTime, openModal, isValidHttpUrl, externalLinkAttrs, brl } from '../shared/ui.js';

const NF_BADGE_CLASS = { not_requested: 'badge-locked', requested: 'badge-progress', issued: 'badge-completed' };

const clientId = new URLSearchParams(location.search).get('id') || DEFAULT_CLIENT_ID;
document.body.innerHTML = renderShell({ role: 'assistant', active: 'clients.html' });
const content = document.getElementById('app-content');

// Small "at a glance" fact — a compact box, not another line in a long
// list, so the sidebar reads as a quick reference instead of an essay.
function factBox(label, value, extra = '') {
  return `
    <div class="ctx-box">
      <p class="ctx-box-label">${label}</p>
      <p class="ctx-box-value">${value}</p>
      ${extra}
    </div>
  `;
}

function renderContextBundle() {
  const b = MockDB.getClientContextBundle(clientId);
  const bd = b.brandDirection;
  const archetypeLabel = { not_started: 'Não iniciado', in_progress: 'Em andamento', completed: 'Concluído' }[b.archetypeAssessment.status] || 'Não iniciado';

  return card(`
    <p class="text-sm text-white/50 mb-4">Contexto da Cliente</p>
    <div class="ctx-grid">
      ${factBox('Primeira Reunião', b.firstMeeting ? formatDateTime(b.firstMeeting.date) : 'Ainda não realizada', b.firstMeeting && b.firstMeeting.topic ? `<p class="ctx-box-sub">${b.firstMeeting.topic}</p>` : '')}
      ${factBox('Teste de Arquétipos', archetypeLabel)}
      ${factBox('Mural de Inspiração', bd.pinterestUrl && isValidHttpUrl(bd.pinterestUrl) ? `<a ${externalLinkAttrs(bd.pinterestUrl)} class="btn-text" style="font-size:13px;">Abrir no Pinterest ↗</a>` : 'Sem mural ainda')}
      ${factBox('Fotos Enviadas', `${b.images.length} ${b.images.length === 1 ? 'foto' : 'fotos'}`, b.images.length ? '' : `<p class="ctx-box-sub">${IMAGE_STATUS_LABEL[b.imagesStatus] || ''}</p>`)}
    </div>
    ${bd.keywords && bd.keywords.length ? `<p class="text-xs text-white/30 mt-3">${bd.keywords.join(' · ')}</p>` : ''}
    ${b.images.length ? `
      <div class="grid grid-cols-4 gap-2 mt-4">
        ${b.images.slice(0, 8).map((img) => `<img src="${img.dataUrl}" alt="${img.fileName}" style="width:100%; aspect-ratio:3/4; object-fit:cover; border-radius:3px; border:1px solid var(--line);" />`).join('')}
      </div>
      ${b.images.length > 8 ? `<p class="text-xs text-white/20 mt-1">+${b.images.length - 8} foto${b.images.length - 8 === 1 ? '' : 's'}</p>` : ''}
    ` : ''}
    <div class="mt-5 pt-4" style="border-top:1px solid var(--line);">
      <p class="text-white/40 text-xs mb-1.5">Próximos Encontros</p>
      <div class="text-sm space-y-1">${renderUpcomingMeetings()}</div>
    </div>
    <div class="mt-4 pt-4" style="border-top:1px solid var(--line);">
      <p class="text-white/40 text-xs mb-1.5">Notas da Nay</p>
      <p class="text-sm ${b.privateNotes ? '' : 'text-white/20'}">${b.privateNotes || 'Nenhuma nota registrada.'}</p>
    </div>
  `, 'mb-6');
}

// Same calendar Nay/she both schedule on (see assistant/agenda.js) — shown
// here so a meeting about this client is never something she has to go
// hunting for on a separate page.
function renderUpcomingMeetings() {
  const items = MockDB.getAgendaItemsForClient(clientId).filter((a) => a.status === 'upcoming');
  if (!items.length) return '<p class="text-white/20">Nenhum encontro agendado.</p>';
  return items.slice(0, 3).map((a) => `
    <a href="agenda.html?item=${a.id}" class="block hover:underline">${AGENDA_TYPE_LABEL[a.type]} — ${formatDateTime(a.date)}</a>
  `).join('');
}

function reviewNoteHtml(item) {
  if (!item.review) return '';
  if (item.review.status === 'pending') return '<p class="text-xs mt-1" style="color:var(--gold);">Aguardando revisão da Nay</p>';
  if (item.review.status === 'changes_requested') return `<p class="text-xs mt-1" style="color:var(--terracotta);">Nay pediu ajustes: ${item.review.nayNote}</p>`;
  return '';
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Summary + Canva link ride along so there's a record of what was actually
// built for this client and why, captured here at submission time while
// the brief is still fresh — the Canva source template itself lives in
// Templates (see assistant/templates.js), not duplicated per-submission.
function openSubmitReviewModal(type, refSlug, title) {
  const { el, close } = openModal({
    title: `Enviar para revisão — ${title}`,
    bodyHtml: `
      <form id="review-form" class="space-y-4">
        <div>
          <label class="text-xs text-white/40 block mb-1">Arquivo (PDF ou imagem)</label>
          <input type="file" name="file" accept="application/pdf,image/*" class="field" />
        </div>
        <div>
          <label class="text-xs text-white/40 block mb-1">Ou link do arquivo <span class="text-white/20">(se já estiver hospedado em outro lugar)</span></label>
          <input name="fileUrl" class="field" placeholder="https://..." />
        </div>
        <div>
          <label class="text-xs text-white/40 block mb-1">Link editável no Canva <span class="text-white/20">(opcional)</span></label>
          <input name="canvaUrl" class="field" placeholder="https://www.canva.com/design/..." />
        </div>
        <div>
          <label class="text-xs text-white/40 block mb-1">Resumo <span class="text-white/20">(o que é, para referência futura em Projetos)</span></label>
          <textarea name="summary" rows="2" class="field" placeholder="Ex.: paleta outono profundo, terrosos e dourado envelhecido."></textarea>
        </div>
        <div>
          <label class="text-xs text-white/40 block mb-1">Nota para a Nay <span class="text-white/20">(opcional)</span></label>
          <textarea name="note" rows="2" class="field"></textarea>
        </div>
        <button type="submit" class="btn-primary" style="padding:9px 18px;font-size:12.5px;">Enviar para revisão</button>
      </form>
    `,
  });
  el.querySelector('#review-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const file = fd.get('file');
    if (file && file.size > 8 * 1024 * 1024) { toast('Arquivo passa de 8MB — use o link em vez do upload.', { tone: 'error' }); return; }
    const fileUrl = file && file.size ? await fileToDataUrl(file) : fd.get('fileUrl');
    if (!fileUrl) { toast('Envie um arquivo ou informe um link.', { tone: 'error' }); return; }
    MockDB.submitForReview(clientId, {
      type, refSlug, title, note: fd.get('note') || '', fileUrl,
      summary: fd.get('summary') || '', canvaUrl: fd.get('canvaUrl') || '',
    });
    close();
    toast('Enviado para revisão da Nay.');
    render();
  });
}

function openSendLinkModal(payment) {
  const { el, close } = openModal({
    title: `Enviar link de pagamento — ${brl(payment.amount)}`,
    bodyHtml: `
      <form id="link-form" class="space-y-4">
        <div>
          <label class="text-xs text-white/40 block mb-1">Link do SumUp</label>
          <input name="url" class="field" placeholder="https://pay.sumup.com/..." required />
        </div>
        <button type="submit" class="btn-primary" style="padding:9px 18px;font-size:12.5px;">Enviar</button>
      </form>
    `,
  });
  el.querySelector('#link-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    MockDB.sendPaymentLink(clientId, payment.id, fd.get('url'));
    close();
    toast('Link de pagamento enviado.');
    render();
  });
}

// A guide row shared by the two duties Nay called out by name (Guia de
// Produções, Mood Fotográfico) as well as the generic guides list below.
function guideRow(g) {
  return `
    <div class="flex items-center justify-between py-2.5">
      <div>
        <p class="text-sm">${g.label}</p>
        ${reviewNoteHtml(g)}
      </div>
      <div class="flex items-center gap-3">
        <span class="badge ${g.status === 'delivered' ? 'badge-completed' : g.status === 'in_review' ? 'badge-progress' : 'badge-locked'}">${GUIDE_STATUS_LABEL[g.status]}</span>
        ${g.status !== 'delivered' && g.status !== 'in_review' ? `<button data-submit-guide="${g.slug}" data-guide-label="${g.label}" class="btn-text">Enviar para revisão</button>` : ''}
        ${g.status === 'in_review' && g.review && g.review.status === 'changes_requested' ? `<button data-submit-guide="${g.slug}" data-guide-label="${g.label}" class="btn-text">Reenviar</button>` : ''}
      </div>
    </div>
  `;
}

// The assistant's fixed duty list for this client — but not in a fixed
// order. Each duty carries a base priority (roughly "how much else depends
// on this") and a live `pending` flag; pending duties float to the top in
// priority order, settled ones sink below in that same order, so what's
// actually urgent right now (a payment link to send, a contract to
// archive) is never buried under things that are already done.
function renderChecklist(client) {
  const o = MockDB.getOnboarding(clientId);
  const payments = MockDB.getPayments(clientId);
  const needsLink = payments.filter((p) => p.status !== 'paid' && !p.linkSentAt);
  const needsConfirmation = payments.filter((p) => p.status !== 'paid' && p.reportedPaidAt);
  const canReport = payments.filter((p) => p.status !== 'paid' && p.linkSentAt && !p.reportedPaidAt);
  const soldOnCard = (o.contract.paymentMethods && o.contract.paymentMethods.length ? o.contract.paymentMethods : [o.contract.paymentMethod]).includes('cartao_credito');
  // Nota Fiscal is owed whenever the client asked for one, or automatically
  // whenever the sale went through a credit card — regardless of request.
  const nfOwed = payments.filter((p) => p.nf.status !== 'issued' && (p.nf.status === 'requested' || soldOnCard));
  const guides = MockDB.getImageGuides(clientId);
  const kit = MockDB.getDigitalKit(clientId);
  const hubla = MockDB.getHublaAccess(clientId);
  const reminder = MockDB.getPhotoReminder(clientId);
  const whatsappNotes = MockDB.getWhatsappNotes(clientId);
  const productionGuide = guides.find((g) => g.slug === 'guia_looks_mensal');
  const moodGuide = guides.find((g) => g.slug === 'moodboard_ensaio');
  const otherGuides = guides.filter((g) => g.slug !== 'guia_looks_mensal' && g.slug !== 'moodboard_ensaio');

  const sections = [
    {
      weight: 1, pending: o.contract.status !== 'completed', html: card(`
        <p class="text-sm text-white/50 mb-4">Upload de Contrato Autenticado</p>
        <div class="flex items-center gap-2 mb-3">
          <select id="contract-status" class="field text-sm">
            ${ONBOARDING_STAGES.map((s) => `<option value="${s}" ${o.contract.status === s ? 'selected' : ''}>${ONBOARDING_STAGE_LABEL[s]}</option>`).join('')}
          </select>
          <button id="update-contract-status" class="btn-ghost">Atualizar status</button>
        </div>
        ${o.contract.status === 'completed'
          ? `<p class="text-xs" style="color:var(--gold);">Arquivado: ${o.contract.signedFileName || 'contrato-assinado.pdf'}</p>`
          : `<button id="upload-signed-contract" class="btn-primary" style="padding:9px 18px;font-size:12.5px;">Fazer upload do contrato autenticado</button>`}
        <p class="text-xs text-white/30 mt-3">Assinatura acontece na plataforma externa de assinatura — faça o upload assim que o contrato assinado (com as duas assinaturas) chegar. Isso libera o Programa e os Conteúdos para a cliente.</p>
      `),
    },
    {
      weight: 2, pending: needsLink.length > 0 || canReport.length > 0 || needsConfirmation.length > 0, html: card(`
        <div class="flex items-center justify-between mb-4">
          <p class="text-sm text-white/50">Links de Pagamento &amp; Confirmação</p>
        </div>
        ${needsLink.length ? `
          <p class="text-xs uppercase mb-2" style="color:var(--terracotta); letter-spacing:.1em;">Faltam enviar</p>
          <div class="space-y-2 mb-4">
            ${needsLink.map((p) => `
              <div class="flex items-center justify-between text-sm">
                <span>${brl(p.amount)} · vencimento ${formatDate(p.dueDate)}</span>
                <button data-send-link="${p.id}" class="btn-text">Enviar link</button>
              </div>
            `).join('')}
          </div>
        ` : ''}
        ${canReport.length ? `
          <p class="text-xs uppercase mb-2" style="color:var(--muted); letter-spacing:.1em;">Link enviado — aguardando pagamento</p>
          <div class="space-y-2 mb-4">
            ${canReport.map((p) => `
              <div class="flex items-center justify-between text-sm">
                <span>${brl(p.amount)} · vencimento ${formatDate(p.dueDate)}</span>
                <button data-report-received="${p.id}" class="btn-text">Reportar recebido</button>
              </div>
            `).join('')}
          </div>
        ` : ''}
        ${needsConfirmation.length ? `
          <p class="text-xs uppercase mb-2" style="color:var(--muted); letter-spacing:.1em;">Aguardando confirmação da Nay</p>
          <div class="space-y-1">
            ${needsConfirmation.map((p) => `<p class="text-sm text-white/50">${brl(p.amount)} — reportado em ${formatDate(p.reportedPaidAt)}</p>`).join('')}
          </div>
        ` : ''}
        ${!needsLink.length && !canReport.length && !needsConfirmation.length ? '<p class="text-sm" style="color:var(--gold);">Tudo em dia.</p>' : ''}
      `),
    },
    {
      weight: 3, pending: nfOwed.length > 0, html: card(`
        <p class="text-sm text-white/50 mb-1">Emitir Nota Fiscal</p>
        <p class="text-xs text-white/30 mb-4">Sempre que a cliente solicitar, ou automaticamente quando a venda for no cartão de crédito${(o.contract.paymentMethods && o.contract.paymentMethods.length) ? ` — forma${o.contract.paymentMethods.length > 1 ? 's' : ''} de pagamento desta cliente: <span style="color:var(--gold);">${o.contract.paymentMethods.map((m) => PAYMENT_METHOD_LABEL[m]).join(' + ')}</span>` : o.contract.paymentMethod ? ` — forma de pagamento desta cliente: <span style="color:var(--gold);">${PAYMENT_METHOD_LABEL[o.contract.paymentMethod]}</span>` : ''}.</p>
        ${payments.length ? `
          <div class="space-y-2">
            ${payments.map((p) => `
              <div class="flex items-center justify-between text-sm">
                <span>${brl(p.amount)} · vencimento ${formatDate(p.dueDate)}</span>
                <div class="flex items-center gap-2">
                  <span class="badge ${NF_BADGE_CLASS[p.nf.status]}" style="font-size:10px;">${NF_STATUS_LABEL[p.nf.status]}</span>
                  ${p.nf.status !== 'issued' && (p.nf.status === 'requested' || soldOnCard) ? `<button data-issue-nf="${p.id}" class="btn-text">Emitir</button>` : ''}
                </div>
              </div>
            `).join('')}
          </div>
        ` : '<p class="text-sm" style="color:var(--muted);">Nenhum pagamento registrado ainda.</p>'}
        ${!nfOwed.length && payments.length ? '<p class="text-xs mt-3" style="color:var(--gold);">Nada pendente de emissão.</p>' : ''}
      `),
    },
    // Three quick, single-fact duties that used to each be their own
    // full-width card (mostly empty space around one select or one button)
    // — bundled into small tiles instead, same "at a glance" box style as
    // Contexto da Cliente, so this reads as a quick reference, not three
    // near-empty rectangles.
    {
      weight: 4, pending: o.whatsappGroup.status !== 'added' || hubla.status !== 'granted' || kit.status !== 'delivered', html: card(`
        <p class="text-sm text-white/50 mb-4">Providências Rápidas</p>
        <div class="action-grid">
          <div class="action-box ${o.whatsappGroup.status !== 'added' ? 'action-box-pending' : ''}">
            <p class="ctx-box-label">Grupo do WhatsApp</p>
            <select id="whatsapp-status" class="field text-sm">
              ${WHATSAPP_STATUSES.map((s) => `<option value="${s}" ${o.whatsappGroup.status === s ? 'selected' : ''}>${WHATSAPP_STATUS_LABEL[s]}</option>`).join('')}
            </select>
            <button id="update-whatsapp-status" class="btn-ghost">Atualizar</button>
          </div>
          <div class="action-box ${hubla.status !== 'granted' ? 'action-box-pending' : ''}">
            <p class="ctx-box-label">Acesso à Hubla (Conteúdo)</p>
            <span class="badge ${hubla.status === 'granted' ? 'badge-completed' : 'badge-locked'}">${HUBLA_STATUS_LABEL[hubla.status]}</span>
            <button id="toggle-hubla" class="btn-ghost">${hubla.status === 'granted' ? 'Revogar acesso' : 'Enviar convite'}</button>
          </div>
          <div class="action-box ${kit.status !== 'delivered' ? 'action-box-pending' : ''}">
            <p class="ctx-box-label">Kit Digital</p>
            <span class="badge ${kit.status === 'delivered' ? 'badge-completed' : kit.status === 'in_review' ? 'badge-progress' : 'badge-locked'}">${GUIDE_STATUS_LABEL[kit.status]}</span>
            ${reviewNoteHtml(kit)}
            ${kit.status !== 'delivered' && kit.status !== 'in_review' ? '<button id="submit-kit" class="btn-text">Enviar para revisão</button>' : ''}
            ${kit.status === 'in_review' && kit.review && kit.review.status === 'changes_requested' ? '<button id="submit-kit" class="btn-text">Reenviar</button>' : ''}
          </div>
        </div>
      `),
    },
    {
      weight: 6, pending: client.imageProjectStatus !== 'created', html: card(`
        <div class="flex items-center justify-between mb-1">
          <p class="text-sm text-white/50">Elaboração de Projeto de Imagem</p>
          <span class="badge ${client.imageProjectStatus === 'created' ? 'badge-completed' : 'badge-locked'}">${client.imageProjectStatus === 'created' ? 'Criado' : 'Não criado'}</span>
        </div>
        <p class="text-xs text-white/30 mb-3">Depende das fotos enviadas pela cliente.</p>
        <div class="flex items-center gap-3 flex-wrap">
          ${client.imageProjectStatus !== 'created' ? '<button id="create-image-project" class="btn-ghost">Criar projeto</button>' : ''}
          <button id="remind-photos" class="btn-text">🔔 Lembrar cliente de enviar fotos</button>
        </div>
        ${reminder.sentAt ? `<p class="text-xs mt-2" style="color:var(--muted);">Último lembrete enviado em ${formatDateTime(reminder.sentAt)}.</p>` : ''}
      `),
    },
    ...(productionGuide ? [{
      weight: 7, pending: productionGuide.status !== 'delivered', html: card(`
        <p class="text-sm text-white/50 mb-1">Elaboração de Guia de Produções</p>
        <p class="text-xs text-white/30 mb-3">Depende das fotos enviadas pela cliente.</p>
        ${guideRow(productionGuide)}
      `),
    }] : []),
    ...(moodGuide ? [{
      weight: 8, pending: moodGuide.status !== 'delivered', html: card(`
        <p class="text-sm text-white/50 mb-1">Elaboração de Mood Fotográfico</p>
        <p class="text-xs text-white/30 mb-3">Depende das fotos enviadas pela cliente.</p>
        ${guideRow(moodGuide)}
      `),
    }] : []),
    ...(otherGuides.length ? [{
      weight: 9, pending: otherGuides.some((g) => g.status !== 'delivered'), html: card(`
        <p class="text-sm text-white/50 mb-4">Outros Guias de Imagem</p>
        <div class="divide-y" style="border-color:var(--line);">
          ${otherGuides.map(guideRow).join('')}
        </div>
      `),
    }] : []),
    {
      // Evergreen, never "done" — always settles last among pending items,
      // but still above fully-resolved ones isn't the point here; it's a
      // running log, not a task, so it just holds a stable spot near the end.
      weight: 11, pending: false, html: card(`
        <p class="text-sm text-white/50 mb-4">Acompanhamento de WhatsApp</p>
        <p class="text-xs text-white/30 mb-3">Registre aqui qualquer retorno importante das conversas — visível só para a equipe, nunca para a cliente.</p>
        <form id="whatsapp-note-form" class="flex items-start gap-2 mb-4">
          <textarea name="note" rows="2" class="field" placeholder="Ex.: cliente comentou que vai viajar semana que vem, pode atrasar o envio das fotos." required></textarea>
          <button type="submit" class="btn-ghost" style="white-space:nowrap;">Registrar</button>
        </form>
        ${whatsappNotes.length ? `
          <div class="space-y-2">
            ${whatsappNotes.map((n) => `
              <div class="text-sm" style="border-left:2px solid var(--line); padding-left:10px;">
                <p class="text-white/70">${n.text}</p>
                <p class="text-xs text-white/20 mt-0.5">${formatDateTime(n.at)}</p>
              </div>
            `).join('')}
          </div>
        ` : '<p class="text-xs text-white/20">Nenhuma nota registrada ainda.</p>'}
      `),
    },
  ];

  sections.sort((a, b) => (a.pending === b.pending ? a.weight - b.weight : a.pending ? -1 : 1));
  return sections.map((s) => `
    <div class="mb-6" ${s.pending ? 'style="border-left:3px solid var(--terracotta); border-radius:4px;"' : ''}>${s.html}</div>
  `).join('');
}

function render() {
  const client = MockDB.getClient(clientId);

  content.innerHTML = `
    <a href="clients.html" class="btn-text mb-6 inline-block">&larr; Clientes</a>
    <div class="mb-8">
      <p class="text-white/40 text-sm mb-1">Cliente</p>
      <h1 class="text-3xl font-serif">${client.fullName}</h1>
    </div>
    ${!MockDB.getOnboarding(clientId).clientInfo.submitted ? `
      <div class="mb-8" style="border-left:3px solid var(--terracotta); border-radius:4px;">${card(`
        <p class="text-sm" style="color:var(--terracotta);">⚠ Esta cliente ainda não preencheu as informações de cadastro — acompanhe até ela concluir antes de qualquer outra etapa.</p>
      `)}</div>
    ` : ''}
    <div class="workspace-layout">
      <div class="workspace-sidebar">${renderContextBundle()}</div>
      <div class="workspace-main">${renderChecklist(client)}</div>
    </div>
  `;

  content.querySelector('#update-contract-status')?.addEventListener('click', () => {
    MockDB.advanceContractStatus(clientId, content.querySelector('#contract-status').value);
    toast('Status do contrato atualizado.');
    render();
  });
  content.querySelector('#update-whatsapp-status')?.addEventListener('click', () => {
    MockDB.setWhatsappStatus(clientId, content.querySelector('#whatsapp-status').value);
    toast('Status do WhatsApp atualizado.');
    render();
  });
  content.querySelector('#toggle-hubla')?.addEventListener('click', () => {
    const current = MockDB.getHublaAccess(clientId).status;
    MockDB.setHublaAccess(clientId, current === 'granted' ? 'not_granted' : 'granted');
    toast('Acesso à Hubla atualizado.');
    render();
  });
  content.querySelector('#create-image-project')?.addEventListener('click', () => {
    MockDB.setImageProjectStatus(clientId, 'created');
    toast('Projeto de imagens criado.');
    render();
  });
  content.querySelector('#submit-kit')?.addEventListener('click', () => openSubmitReviewModal('digital_kit', null, 'Kit Digital'));
  content.querySelectorAll('[data-submit-guide]').forEach((btn) => {
    btn.addEventListener('click', () => openSubmitReviewModal('image_guide', btn.dataset.submitGuide, btn.dataset.guideLabel));
  });
  content.querySelectorAll('[data-send-link]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const payment = MockDB.getPayments(clientId).find((p) => p.id === btn.dataset.sendLink);
      openSendLinkModal(payment);
    });
  });
  content.querySelectorAll('[data-report-received]').forEach((btn) => {
    btn.addEventListener('click', () => {
      MockDB.reportPaymentReceived(clientId, btn.dataset.reportReceived);
      toast('Pagamento reportado — aguardando confirmação da Nay.');
      render();
    });
  });
  content.querySelectorAll('[data-issue-nf]').forEach((btn) => {
    btn.addEventListener('click', () => {
      MockDB.issueInvoice(clientId, btn.dataset.issueNf);
      toast('Nota fiscal emitida — disponível para a cliente.');
      render();
    });
  });
  content.querySelector('#upload-signed-contract')?.addEventListener('click', async (e) => {
    e.target.disabled = true; e.target.textContent = 'Enviando…';
    await MockDB.uploadSignedContract(clientId, `contrato-${clientId}-assinado.pdf`);
    toast('Contrato assinado enviado — Programa e Conteúdos liberados para a cliente.');
    render();
  });
  content.querySelector('#remind-photos')?.addEventListener('click', () => {
    MockDB.sendPhotoReminder(clientId, 'A equipe está aguardando suas fotos para seguir com o Projeto de Imagem, o Guia de Produções e o Mood Fotográfico.');
    toast('Lembrete enviado à cliente.');
    render();
  });
  content.querySelector('#whatsapp-note-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = new FormData(e.target).get('note');
    if (!text || !text.trim()) return;
    MockDB.addWhatsappNote(clientId, text.trim());
    toast('Nota registrada.');
    render();
  });
}

render();
