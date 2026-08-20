// Lead detail — single lead's profile, contact/interaction log, and the
// "Converter em Cliente" hand-off into the real onboarding pipeline.
import {
  MockDB, LEAD_STAGES, LEAD_STAGE_LABEL, LEAD_SOURCES, LEAD_SOURCE_LABEL,
  VIP_GROUP_STATUSES, VIP_GROUP_STATUS_LABEL, PROGRAMS, PROGRAM_LABEL, SOCIAL_PLATFORMS, SOCIAL_PLATFORM_LABEL,
} from '../shared/mock-db.js';
import { renderShell, card, toast, formatDate, formatDateTime, openModal, renderSocialLinks } from '../shared/ui.js';

document.body.innerHTML = renderShell({ role: 'admin', active: 'leads.html' });
const content = document.getElementById('app-content');

const leadId = new URLSearchParams(location.search).get('id');
const STAGE_CLASS = {
  novo: 'badge-locked', engajado: 'badge-progress', em_conversa: 'badge-progress',
  proposta_enviada: 'badge-progress', convertido: 'badge-completed', perdido: 'badge-locked',
};
const stageBadge = (stage) => `<span class="badge ${STAGE_CLASS[stage] || 'badge-locked'}">${LEAD_STAGE_LABEL[stage] || stage}</span>`;

function renderHeader(lead) {
  return `
    <a href="leads.html" class="btn-text mb-4 inline-block">&larr; Todos os leads</a>
    <div class="mb-6 flex items-start justify-between flex-wrap gap-3">
      <div>
        <h1 class="text-2xl font-serif">${lead.fullName || '(sem nome)'}</h1>
        <p class="text-white/40 text-sm">${lead.email || 'sem email'} · ${lead.phone || 'sem telefone'}</p>
      </div>
      ${stageBadge(lead.stage)}
    </div>
    ${card(renderSocialLinks(lead.socialLinks, { emptyText: 'Nenhuma rede social cadastrada ainda — adicione abaixo.' }), 'mb-6')}
  `;
}

function renderConvertCard(lead) {
  if (lead.stage === 'convertido' && lead.convertedToClientId) {
    return card(`
      <p class="text-sm text-white/50 mb-3">Convertida em Cliente</p>
      <p class="text-sm mb-4">Esta lead virou cliente em ${formatDate(lead.convertedAt)}.</p>
      <a href="client-detail.html?id=${lead.convertedToClientId}" class="btn-primary" style="padding:9px 18px;font-size:12.5px;">Ver Perfil de Cliente</a>
    `, 'mb-6');
  }
  return card(`
    <div class="flex items-center justify-between mb-3">
      <p class="text-sm text-white/50">Converter em Cliente</p>
    </div>
    <p class="text-xs text-white/20 mb-4">Cria um novo perfil de cliente em onboarding, já com nome, email, WhatsApp e redes sociais preenchidos — o resto do fluxo continua normalmente em Clientes.</p>
    <div class="flex items-center gap-3">
      <select id="convert-tier" class="field text-sm" style="max-width:180px;">
        <option value="essential">Jornada Essential</option>
        <option value="premium">Jornada Premium</option>
      </select>
      <button id="convert-lead" class="btn-primary" style="padding:9px 18px;font-size:12.5px;">Converter em Cliente</button>
    </div>
  `, 'mb-6');
}

function renderInfoForm(lead) {
  return card(`
    <p class="text-sm text-white/50 mb-4">Informações do Lead</p>
    <form id="lead-info-form" class="space-y-4">
      <div class="grid sm:grid-cols-2 gap-4">
        <div>
          <label class="text-xs text-white/40 block mb-1">Nome Completo</label>
          <input name="fullName" class="field" value="${lead.fullName}" required />
        </div>
        <div>
          <label class="text-xs text-white/40 block mb-1">Programa de Interesse</label>
          <select name="interestedProgram" class="field">
            <option value="">Ainda não sabe</option>
            ${PROGRAMS.map((p) => `<option value="${p}" ${lead.interestedProgram === p ? 'selected' : ''}>${PROGRAM_LABEL[p]}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="grid sm:grid-cols-2 gap-4">
        <div>
          <label class="text-xs text-white/40 block mb-1">Email</label>
          <input name="email" type="email" class="field" value="${lead.email}" />
        </div>
        <div>
          <label class="text-xs text-white/40 block mb-1">WhatsApp</label>
          <input name="phone" class="field" value="${lead.phone}" />
        </div>
      </div>
      <div class="grid sm:grid-cols-3 gap-4">
        <div>
          <label class="text-xs text-white/40 block mb-1">Origem</label>
          <select name="source" class="field">
            ${LEAD_SOURCES.map((s) => `<option value="${s}" ${lead.source === s ? 'selected' : ''}>${LEAD_SOURCE_LABEL[s]}</option>`).join('')}
          </select>
        </div>
        <div>
          <label class="text-xs text-white/40 block mb-1">Status no Grupo VIP</label>
          <select name="vipGroupStatus" class="field">
            ${VIP_GROUP_STATUSES.map((s) => `<option value="${s}" ${lead.vipGroupStatus === s ? 'selected' : ''}>${VIP_GROUP_STATUS_LABEL[s]}</option>`).join('')}
          </select>
        </div>
        <div>
          <label class="text-xs text-white/40 block mb-1">Estágio</label>
          <select name="stage" class="field">
            ${LEAD_STAGES.map((s) => `<option value="${s}" ${lead.stage === s ? 'selected' : ''}>${LEAD_STAGE_LABEL[s]}</option>`).join('')}
          </select>
        </div>
      </div>
      <p class="text-xs uppercase mt-2" style="color:var(--muted); letter-spacing:.12em;">Redes Sociais</p>
      <div class="grid sm:grid-cols-2 gap-4">
        ${SOCIAL_PLATFORMS.map((p) => `
          <div>
            <label class="text-xs text-white/40 block mb-1">${SOCIAL_PLATFORM_LABEL[p]}</label>
            <input name="social_${p}" class="field" value="${lead.socialLinks?.[p] || ''}" placeholder="https://..." />
          </div>
        `).join('')}
      </div>
      <div>
        <label class="text-xs text-white/40 block mb-1">Notas</label>
        <textarea name="notes" rows="3" class="field">${lead.notes || ''}</textarea>
      </div>
      <div class="flex justify-end pt-1">
        <button type="submit" class="btn-primary" style="padding:9px 18px;font-size:12.5px;">Salvar</button>
      </div>
    </form>
  `, 'mb-6');
}

function renderInteractions(lead) {
  return card(`
    <div class="flex items-center justify-between mb-4">
      <p class="text-sm text-white/50">Contatos Diretos</p>
      <button id="new-interaction" class="btn-ghost">+ Registrar Contato</button>
    </div>
    <p class="text-xs text-white/20 mb-4">Assim que houver contato mais direto com essa lead, registre aqui o que foi conversado.</p>
    ${lead.interactions.length ? `
      <div class="space-y-4">
        ${lead.interactions.map((i) => `
          <div class="pb-4 border-b border-white/5 last:border-0 last:pb-0">
            <p class="text-xs" style="color:var(--muted);">${formatDateTime(i.date)}</p>
            <p class="text-sm mt-1">${i.summary}</p>
          </div>
        `).join('')}
      </div>
    ` : '<p class="text-sm" style="color:var(--muted);">Nenhum contato direto registrado ainda.</p>'}
  `);
}

function openInteractionModal() {
  const { el, close } = openModal({
    title: 'Registrar Contato Direto',
    bodyHtml: `
      <form id="interaction-form" class="space-y-4">
        <div>
          <label class="text-xs text-white/40 block mb-1">Data e Hora</label>
          <input name="date" type="datetime-local" class="field" value="${new Date().toISOString().slice(0, 16)}" required />
        </div>
        <div>
          <label class="text-xs text-white/40 block mb-1">O Que Foi Conversado</label>
          <textarea name="summary" rows="3" class="field" required></textarea>
        </div>
        <div class="flex justify-end pt-2">
          <button type="submit" class="btn-primary" style="padding:9px 18px;font-size:12.5px;">Registrar</button>
        </div>
      </form>
    `,
  });
  el.querySelector('#interaction-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    MockDB.addLeadInteraction(leadId, { date: fd.get('date'), summary: fd.get('summary') });
    close();
    toast('Contato registrado.');
    render();
  });
}

function render() {
  const lead = MockDB.getLead(leadId);
  if (!lead) {
    content.innerHTML = `<a href="leads.html" class="btn-text">&larr; Todos os leads</a><p class="mt-6 text-sm" style="color:var(--muted);">Lead não encontrada.</p>`;
    return;
  }

  content.innerHTML = `
    ${renderHeader(lead)}
    ${renderConvertCard(lead)}
    ${renderInfoForm(lead)}
    ${renderInteractions(lead)}
  `;

  content.querySelector('#lead-info-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const socialLinks = Object.fromEntries(SOCIAL_PLATFORMS.map((p) => [p, fd.get(`social_${p}`) || '']));
    MockDB.updateLead(leadId, {
      fullName: fd.get('fullName'), email: fd.get('email'), phone: fd.get('phone'),
      interestedProgram: fd.get('interestedProgram') || null, source: fd.get('source'),
      vipGroupStatus: fd.get('vipGroupStatus'), stage: fd.get('stage'), notes: fd.get('notes'), socialLinks,
    });
    toast('Lead atualizada.');
    render();
  });

  content.querySelector('#new-interaction')?.addEventListener('click', openInteractionModal);

  content.querySelector('#convert-lead')?.addEventListener('click', () => {
    const tier = content.querySelector('#convert-tier').value;
    const clientId = MockDB.convertLeadToClient(leadId, { tier });
    toast('Lead convertida em cliente!');
    location.href = `client-detail.html?id=${clientId}`;
  });
}

render();
