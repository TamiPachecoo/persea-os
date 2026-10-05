// Eventos — real registrations for one-off events (PERSEA Experience today,
// any future event slug tomorrow), separate from the mentoring
// Clientes/Leads pipeline on purpose: an event attendee isn't going
// through onboarding/contract/activation, she's paying for a single day.
// Rows are written by the public event-registration-create Edge Function
// (naymurta.com's event landing page — a separate static site) and
// updated to 'pago' by sumup-webhook once SumUp confirms the charge. This
// page only ever reads/manually adjusts them — never creates a real
// SumUp checkout itself. It also issues each paying participant's
// personal invite code (event_invite_codes, guest price via
// event-registration-create) and shows her answers to the preparation
// form (event-prep, preparacao.html on the event site).
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
let invitePaymentLinkUrl = '';
let inviteCodes = [];

const EVENT_SITE = 'https://perseaexperience.naymurta.com';
const INVITE_PRICE = 'R$ 697,90';
const firstName = (n) => String(n || '').trim().split(/\s+/)[0] || '';
const inviteUrl = (code) => `${EVENT_SITE}/?convite=${encodeURIComponent(code)}`;
const prepUrl = (token) => `${EVENT_SITE}/preparacao.html?t=${token}`;
const waLink = (phone, text) => `https://wa.me/55${String(phone || '').replace(/\D/g, '').replace(/^55(?=\d{10,11}$)/, '')}?text=${encodeURIComponent(text)}`;
const inviteMessage = (r, code) => `Oi, ${firstName(r.full_name)}! Como você vai viver a Experiência PERSEA, você ganhou ${code.max_uses === 1 ? 'um convite' : `${code.max_uses} convites`} para levar alguém especial com um valor exclusivo de convidada: ${INVITE_PRICE} (em vez de R$ 997). É só enviar este link para quem você quer convidar: ${inviteUrl(code.code)}`;
const prepMessage = (r) => `Oi, ${firstName(r.full_name)}! Que alegria ter você na Experiência PERSEA. Para prepararmos o seu dia, responda estas 5 perguntas rápidas (leva 1 minuto): ${prepUrl(r.prep_token)}`;
const esc = (v) => String(v ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// Personal code from her first name, e.g. MARY-PERSEA, MARY2-PERSEA if taken.
function suggestCode(r) {
  const base = firstName(r.full_name).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z]/g, '').toUpperCase() || 'CONVITE';
  const taken = new Set(inviteCodes.map((c) => c.code));
  for (let n = 1; ; n++) { const c = `${base}${n > 1 ? n : ''}-PERSEA`; if (!taken.has(c)) return c; }
}

async function copyText(text) {
  try { await navigator.clipboard.writeText(text); toast('Mensagem copiada.'); }
  catch { window.prompt('Copie a mensagem:', text); }
}

async function loadTenantLinks() {
  const { data } = await supabase.from('tenant_settings').select('event_manual_payment_link_url, event_invite_payment_link_url').eq('id', 1).maybeSingle();
  return [data?.event_manual_payment_link_url || '', data?.event_invite_payment_link_url || ''];
}
async function loadInviteCodes() {
  const { data } = await supabase.from('event_invite_codes').select('*').order('created_at');
  return data || [];
}

function inviteBlock(r) {
  const code = inviteCodes.find((c) => c.inviter_registration_id === r.id);
  if (!code) {
    return r.status === 'pago'
      ? `<button type="button" data-gen-invite="${r.id}" class="btn-ghost" style="padding:6px 12px;font-size:11px;">Gerar convite</button>`
      : '';
  }
  const guests = registrations.filter((g) => g.invite_code === code.code);
  return `
    <div class="flex items-center gap-2 flex-wrap">
      <span class="text-xs" style="color:var(--gold);letter-spacing:.08em;">${esc(code.code)}</span>
      <span class="text-xs text-white/40">${guests.length} de
        <input type="number" min="0" max="20" value="${code.max_uses}" data-invite-max="${code.id}" class="field text-xs" style="width:52px;padding:2px 6px;display:inline-block;" />
        convites usados${code.active ? '' : ' · <span style="color:var(--terracotta);">desativado</span>'}</span>
      <button type="button" data-copy-invite="${r.id}" class="btn-text" style="font-size:11px;">Copiar mensagem</button>
      ${r.phone ? `<a href="${waLink(r.phone, inviteMessage(r, code))}" target="_blank" rel="noopener" class="btn-text" style="font-size:11px;">Enviar no WhatsApp</a>` : ''}
      <button type="button" data-toggle-invite="${code.id}" class="btn-text" style="font-size:11px;">${code.active ? 'Desativar' : 'Reativar'}</button>
    </div>
    ${guests.length ? `<p class="text-xs text-white/30 mt-1">Convidadas: ${guests.map((g) => `${esc(g.full_name)} (${STATUS_LABEL[g.status] || g.status})`).join(', ')}</p>` : ''}`;
}

function prepBlock(r) {
  if (!r.prep_submitted_at) {
    return `
      <div class="flex items-center gap-2 flex-wrap">
        <span class="text-xs text-white/40">Formulário de preparação: pendente</span>
        <button type="button" data-copy-prep="${r.id}" class="btn-text" style="font-size:11px;">Copiar link</button>
        ${r.phone ? `<a href="${waLink(r.phone, prepMessage(r))}" target="_blank" rel="noopener" class="btn-text" style="font-size:11px;">Enviar no WhatsApp</a>` : ''}
      </div>`;
  }
  const food = (r.prep_food_restrictions || []).join(', ') + (r.prep_food_note ? ` (${esc(r.prep_food_note)})` : '');
  const item = (label, value) => `<div><p class="text-xs text-white/30">${label}</p><p class="text-sm">${value}</p></div>`;
  return `
    <div class="mt-1 p-3 rounded" style="background:rgba(255,255,255,.03);border:1px solid var(--line);">
      <p class="text-xs mb-2" style="color:var(--gold);">Preparação respondida ${formatDateTime(r.prep_submitted_at)}</p>
      <div class="grid sm:grid-cols-2 gap-3">
        ${item('Expectativas', esc((r.prep_expectations || []).join(' · ')) + (r.prep_expectations_note ? `<br><span class="text-white/50">"${esc(r.prep_expectations_note)}"</span>` : ''))}
        ${item('Restrição alimentar', food || '—')}
        ${item('Alergias', r.prep_allergies ? `<span style="color:var(--terracotta);">${esc(r.prep_allergies)}</span>` : 'Nenhuma')}
        ${item('Faturamento mensal', `${esc(r.prep_revenue_current || '—')} → meta ${esc(r.prep_revenue_goal || '—')}`)}
      </div>
      <button type="button" data-copy-prep="${r.id}" class="btn-text mt-2" style="font-size:11px;">Copiar link do formulário</button>
    </div>`;
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
        ${r.invited_by_registration_id || r.invite_code ? `<p class="text-xs mt-1" style="color:var(--gold);">Convidada por ${esc(registrations.find((x) => x.id === r.invited_by_registration_id)?.full_name || 'participante')} · código ${esc(r.invite_code || '')}</p>` : ''}
        ${r.status === 'pago' ? `<div class="mt-2 flex flex-col gap-2">${inviteBlock(r)}${prepBlock(r)}</div>` : ''}
      </div>
      <div class="flex items-center gap-2 flex-wrap shrink-0">
        ${waHref ? `<a href="${waHref}" target="_blank" rel="noopener" class="btn-ghost" style="padding:6px 12px;font-size:11px;">WhatsApp</a>` : ''}
        <a href="mailto:${r.email}" class="btn-ghost" style="padding:6px 12px;font-size:11px;">E-mail</a>
        ${r.status !== 'pago'
          ? `<button type="button" data-mark-paid="${r.id}" class="btn-primary" style="padding:6px 12px;font-size:11px;">Marcar como Paga</button>`
          : `<button type="button" data-mark-unpaid="${r.id}" class="btn-text" style="font-size:11px;">Desfazer pagamento</button>`}
        ${r.status !== 'pago' ? `<button type="button" data-delete-reg="${r.id}" class="btn-text" style="font-size:11px;color:var(--terracotta);">Excluir</button>` : ''}
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
    <div class="grid sm:grid-cols-4 gap-4 mb-6">
      ${card(`<p class="text-xs text-white/30 mb-1">Interessadas</p><p class="text-2xl font-serif">${interessadas}</p>`)}
      ${card(`<p class="text-xs text-white/30 mb-1">Pagas</p><p class="text-2xl font-serif" style="color:var(--gold);">${pagas}</p>`)}
      ${card(`<p class="text-xs text-white/30 mb-1">Receita confirmada</p><p class="text-2xl font-serif" style="color:var(--gold);">${brl(receita)}</p>`)}
      ${card(`<p class="text-xs text-white/30 mb-1">Preparação respondida</p><p class="text-2xl font-serif">${registrations.filter((r) => r.status === 'pago' && r.prep_submitted_at).length} <span class="text-sm text-white/30">de ${pagas}</span></p>`)}
    </div>
    ${card(`
      <p class="text-sm text-white/50 mb-2">Link de pagamento com parcelamento</p>
      <p class="text-xs text-white/30 mb-4">Cole aqui um Link de Pagamento criado no app da SumUp (com parcelas e "Não repassar a taxa" configurados). Enquanto este campo estiver preenchido, toda nova inscrição é enviada para este link em vez de um checkout automático — isso significa que o pagamento não é confirmado sozinho: marque "Paga" manualmente aqui depois de conferir no seu app SumUp. Deixe em branco para voltar ao checkout automático (sem parcelamento).</p>
      <form id="manual-link-form" class="flex flex-wrap gap-2">
        <input name="manualLink" class="field text-sm" style="flex:1; min-width:260px;" value="${manualPaymentLinkUrl}" placeholder="https://pay.sumup.com/..." />
        <button type="submit" class="btn-primary" style="padding:8px 16px;font-size:12px;">Salvar</button>
      </form>
      <p class="text-sm text-white/50 mt-6 mb-2">Link de pagamento de convidadas (${INVITE_PRICE})</p>
      <p class="text-xs text-white/30 mb-4">Quem chega por um convite válido é enviada para este link com o valor de convidada. Gere o convite de cada participante paga na lista abaixo.</p>
      <form id="invite-link-form" class="flex flex-wrap gap-2">
        <input name="inviteLink" class="field text-sm" style="flex:1; min-width:260px;" value="${invitePaymentLinkUrl}" placeholder="https://pay.sumup.com/..." />
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

  content.querySelector('#invite-link-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const url = new FormData(e.target).get('inviteLink').trim();
    const { error } = await supabase.from('tenant_settings').update({ event_invite_payment_link_url: url || null }).eq('id', 1);
    if (error) { toast(error.message, { tone: 'error' }); return; }
    invitePaymentLinkUrl = url;
    toast(url ? 'Link de convidadas salvo.' : 'Link de convidadas removido — convites ficam indisponíveis.');
  });
  content.querySelectorAll('[data-gen-invite]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const r = registrations.find((x) => x.id === btn.dataset.genInvite);
      btn.disabled = true;
      const { error } = await supabase.from('event_invite_codes').insert({ event_slug: r.event_slug, code: suggestCode(r), inviter_registration_id: r.id, max_uses: 2 });
      if (error) { toast(error.message, { tone: 'error' }); btn.disabled = false; return; }
      toast('Convite criado.');
      await refresh();
    });
  });
  content.querySelectorAll('[data-copy-invite]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const r = registrations.find((x) => x.id === btn.dataset.copyInvite);
      copyText(inviteMessage(r, inviteCodes.find((c) => c.inviter_registration_id === r.id)));
    });
  });
  content.querySelectorAll('[data-invite-max]').forEach((input) => {
    input.addEventListener('change', async () => {
      const n = Math.max(0, Math.min(20, Number(input.value) || 0));
      const { error } = await supabase.from('event_invite_codes').update({ max_uses: n }).eq('id', input.dataset.inviteMax);
      if (error) { toast(error.message, { tone: 'error' }); return; }
      toast(`Limite atualizado: ${n} ${n === 1 ? 'convite' : 'convites'}.`);
      await refresh();
    });
  });
  content.querySelectorAll('[data-toggle-invite]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const code = inviteCodes.find((c) => c.id === btn.dataset.toggleInvite);
      const { error } = await supabase.from('event_invite_codes').update({ active: !code.active }).eq('id', code.id);
      if (error) { toast(error.message, { tone: 'error' }); return; }
      toast(code.active ? 'Convite desativado.' : 'Convite reativado.');
      await refresh();
    });
  });
  content.querySelectorAll('[data-copy-prep]').forEach((btn) => {
    btn.addEventListener('click', () => copyText(prepMessage(registrations.find((x) => x.id === btn.dataset.copyPrep))));
  });

  // Removes test or duplicate sign-ups. Never offered for a paid one (undo
  // the payment first), so a real attendee can't be lost by a stray click.
  content.querySelectorAll('[data-delete-reg]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const r = registrations.find((x) => x.id === btn.dataset.deleteReg);
      if (!r || r.status === 'pago') return;
      if (!confirm(`Excluir a inscrição de ${r.full_name} (${r.email})? Isto não pode ser desfeito.`)) return;
      const { error } = await supabase.from('event_registrations').delete().eq('id', r.id).neq('status', 'pago');
      if (error) { toast(error.message, { tone: 'error' }); return; }
      toast('Inscrição excluída.');
      await refresh();
    });
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
  let links;
  [registrations, links, inviteCodes] = await Promise.all([loadRegistrations(), loadTenantLinks(), loadInviteCodes()]);
  [manualPaymentLinkUrl, invitePaymentLinkUrl] = links;
  render();
}

await refresh();
