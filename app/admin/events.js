// Eventos — real registrations for one-off events (PERSEA Experience today,
// any future event slug tomorrow), separate from the mentoring
// Clientes/Leads pipeline on purpose: an event attendee isn't going
// through onboarding/contract/activation, she's paying for a single day.
// Rows are written by the public event-registration-create Edge Function
// (naymurta.com's event landing page — a separate static site) and
// updated to 'pago' by sumup-webhook once SumUp confirms the charge. This
// page only ever reads/manually adjusts them — never creates a real
// SumUp checkout itself.
import { supabase } from '../shared/supabase-client.js';
import { requireProfile } from '../shared/supabase-auth.js';
import { renderShell, card, toast, formatDateTime } from '../shared/ui.js';

if (!(await requireProfile('admin'))) throw new Error('not authorized');
document.body.innerHTML = renderShell({ role: 'admin', active: 'events.html', title: 'Eventos' });
const content = document.getElementById('app-content');

const STATUS_LABEL = { interessada: 'Interessada', pago: 'Pago', falhou: 'Falhou', expirado: 'Expirado', cancelado: 'Cancelado' };
const STATUS_CLASS = { interessada: 'badge-progress', pago: 'badge-completed', falhou: 'badge-locked', expirado: 'badge-locked', cancelado: 'badge-locked' };
const statusBadge = (s) => `<span class="badge ${STATUS_CLASS[s] || 'badge-locked'}">${STATUS_LABEL[s] || s}</span>`;
const brl = (cents) => (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

let statusFilter = '';
let search = '';
let registrations = [];
let manualPaymentLinkUrl = '';

async function loadTenantManualLink() {
  const { data } = await supabase.from('tenant_settings').select('event_manual_payment_link_url').eq('id', 1).maybeSingle();
  return data?.event_manual_payment_link_url || '';
}

async function loadRegistrations() {
  const { data } = await supabase.from('event_registrations').select('*').order('created_at', { ascending: false });
  return data || [];
}

function registrationRow(r) {
  const waHref = r.phone ? `https://wa.me/55${r.phone.replace(/\D/g, '')}` : null;
  const social = [
    r.instagram ? `<a href="https://instagram.com/${r.instagram.replace(/^@/, '')}" target="_blank" rel="noopener" style="color:var(--gold);">@${r.instagram.replace(/^@/, '')}</a>` : '',
    r.linkedin ? `<a href="${/^https?:\/\//.test(r.linkedin) ? r.linkedin : `https://linkedin.com/in/${r.linkedin}`}" target="_blank" rel="noopener" style="color:var(--gold);">LinkedIn</a>` : '',
  ].filter(Boolean).join(' · ');
  return `
    <div class="flex items-start justify-between py-3 gap-3 flex-wrap">
      <div class="min-w-0" style="flex:1 1 240px;">
        <div class="flex items-center gap-2 flex-wrap">
          <p class="font-medium break-words">${r.full_name}</p>
          ${statusBadge(r.status)}
        </div>
        <p class="text-xs text-white/30 break-words">${r.email} · ${r.phone || 'sem telefone'}${r.age ? ` · ${r.age} anos` : ''}</p>
        ${social ? `<p class="text-xs mt-1">${social}</p>` : ''}
        <p class="text-xs text-white/20 mt-1">${brl(r.amount_cents)} · inscrita ${formatDateTime(r.created_at)}${r.paid_at ? ` · paga ${formatDateTime(r.paid_at)}` : ''}</p>
      </div>
      <div class="flex items-center gap-2 flex-wrap shrink-0">
        ${waHref ? `<a href="${waHref}" target="_blank" rel="noopener" class="btn-ghost" style="padding:6px 12px;font-size:11px;">WhatsApp</a>` : ''}
        <a href="mailto:${r.email}" class="btn-ghost" style="padding:6px 12px;font-size:11px;">E-mail</a>
        ${r.status !== 'pago'
          ? `<button type="button" data-mark-paid="${r.id}" class="btn-primary" style="padding:6px 12px;font-size:11px;">Marcar como Paga</button>`
          : `<button type="button" data-mark-unpaid="${r.id}" class="btn-text" style="font-size:11px;">Desfazer pagamento</button>`}
      </div>
    </div>
  `;
}

function render() {
  const interessadas = registrations.filter((r) => r.status === 'interessada').length;
  const pagas = registrations.filter((r) => r.status === 'pago').length;
  const receita = registrations.filter((r) => r.status === 'pago').reduce((s, r) => s + r.amount_cents, 0);

  const filtered = registrations.filter((r) => {
    const matchesSearch = !search || r.full_name.toLowerCase().includes(search.toLowerCase()) || r.email.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = !statusFilter || r.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  content.innerHTML = `
    <div class="mb-8">
      <p class="text-white/40 text-sm mb-1">Eventos</p>
      <h1 class="text-3xl font-serif">PERSEA Experience</h1>
    </div>
    <div class="grid sm:grid-cols-3 gap-4 mb-6">
      ${card(`<p class="text-xs text-white/30 mb-1">Interessadas</p><p class="text-2xl font-serif">${interessadas}</p>`)}
      ${card(`<p class="text-xs text-white/30 mb-1">Pagas</p><p class="text-2xl font-serif" style="color:var(--gold);">${pagas}</p>`)}
      ${card(`<p class="text-xs text-white/30 mb-1">Receita confirmada</p><p class="text-2xl font-serif" style="color:var(--gold);">${brl(receita)}</p>`)}
    </div>
    ${card(`
      <p class="text-sm text-white/50 mb-2">Link de pagamento com parcelamento</p>
      <p class="text-xs text-white/30 mb-4">Cole aqui um Link de Pagamento criado no app da SumUp (com parcelas e "Não repassar a taxa" configurados). Enquanto este campo estiver preenchido, toda nova inscrição é enviada para este link em vez de um checkout automático — isso significa que o pagamento não é confirmado sozinho: marque "Paga" manualmente aqui depois de conferir no seu app SumUp. Deixe em branco para voltar ao checkout automático (sem parcelamento).</p>
      <form id="manual-link-form" class="flex flex-wrap gap-2">
        <input name="manualLink" class="field text-sm" style="flex:1; min-width:260px;" value="${manualPaymentLinkUrl}" placeholder="https://pay.sumup.com/..." />
        <button type="submit" class="btn-primary" style="padding:8px 16px;font-size:12px;">Salvar</button>
      </form>
    `, 'mb-6')}
    ${card(`
      <div class="flex items-center justify-between mb-4">
        <p class="text-sm text-white/50">Inscrições</p>
        <span class="text-xs text-white/30">${filtered.length} de ${registrations.length}</span>
      </div>
      <div class="flex flex-wrap items-center gap-3 mb-4">
        <input id="reg-search" class="field text-sm" style="max-width:260px;" placeholder="Buscar por nome ou email..." value="${search}" />
        <select id="status-filter" class="field text-sm" style="max-width:200px;">
          <option value="">Todos os status</option>
          ${Object.entries(STATUS_LABEL).map(([v, l]) => `<option value="${v}" ${statusFilter === v ? 'selected' : ''}>${l}</option>`).join('')}
        </select>
      </div>
      <div class="divide-y" style="border-color:var(--line);">
        ${filtered.length ? filtered.map(registrationRow).join('') : '<p class="text-sm text-white/20 py-6">Nenhuma inscrição encontrada.</p>'}
      </div>
    `)}
  `;

  content.querySelector('#reg-search').addEventListener('input', (e) => { search = e.target.value; render(); });
  content.querySelector('#status-filter').addEventListener('change', (e) => { statusFilter = e.target.value; render(); });
  content.querySelector('#manual-link-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const url = new FormData(e.target).get('manualLink').trim();
    const { error } = await supabase.from('tenant_settings').update({ event_manual_payment_link_url: url || null }).eq('id', 1);
    if (error) { toast(error.message, { tone: 'error' }); return; }
    manualPaymentLinkUrl = url;
    toast(url ? 'Link salvo — novas inscrições vão para ele.' : 'Link removido — voltando ao checkout automático.');
  });

  content.querySelectorAll('[data-mark-paid]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const { error } = await supabase.from('event_registrations').update({
        status: 'pago', paid_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      }).eq('id', btn.dataset.markPaid);
      if (error) { toast(error.message, { tone: 'error' }); return; }
      toast('Marcada como paga.');
      await refresh();
    });
  });
  content.querySelectorAll('[data-mark-unpaid]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const { error } = await supabase.from('event_registrations').update({
        status: 'interessada', paid_at: null, updated_at: new Date().toISOString(),
      }).eq('id', btn.dataset.markUnpaid);
      if (error) { toast(error.message, { tone: 'error' }); return; }
      toast('Pagamento desfeito.');
      await refresh();
    });
  });
}

async function refresh() {
  [registrations, manualPaymentLinkUrl] = await Promise.all([loadRegistrations(), loadTenantManualLink()]);
  render();
}

await refresh();
