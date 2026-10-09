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
// People who registered outside the system get the direct sign-up link
// (preparacao.html?c=<code>): their details + the preparation form create
// a 'confirmada' registration that shows up here once they finish.
// The mentee results survey (naymurta.com/resultados, mentee-results Edge
// Function → mentee_results) is listed here too, at the bottom.
import { supabase } from '../shared/supabase-client.js';
import { requireProfile } from '../shared/supabase-auth.js';
import { renderShell, card, toast, formatDateTime } from '../shared/ui.js';

// Also opened by the assistant (assistant/events.html loads this file).
// She runs the attendee list like Nay does; only the SumUp payment-link
// settings and "Gerar novo link" (which cancels the link already sent
// out) stay with Nay — those write tenant_settings, which is admin-only.
const role = location.pathname.includes('/assistant/') ? 'assistant' : 'admin';
const isAdmin = role === 'admin';
if (!(await requireProfile(role))) throw new Error('not authorized');
document.body.innerHTML = renderShell({ role, active: 'events.html', title: 'Eventos' });
const content = document.getElementById('app-content');

const STATUS_LABEL = { interessada: 'Interessada', pago: 'Pago', confirmada: 'Confirmada', falhou: 'Falhou', expirado: 'Expirado', cancelado: 'Cancelado' };
const STATUS_CLASS = { interessada: 'badge-progress', pago: 'badge-completed', confirmada: 'badge-completed', falhou: 'badge-locked', expirado: 'badge-locked', cancelado: 'badge-locked' };
const statusBadge = (s) => `<span class="badge ${STATUS_CLASS[s] || 'badge-locked'}">${STATUS_LABEL[s] || s}</span>`;
const brl = (cents) => (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

let statusFilter = '';
let search = '';
let registrations = [];
let manualPaymentLinkUrl = '';
let invitePaymentLinkUrl = '';
let inviteCodes = [];
let directSignupCode = '';
let menteeResults = [];
let photoUrls = {}; // storage path → signed URL, for the preparation photos

const EVENT_SITE = 'https://perseaexperience.naymurta.com';
const INVITE_PRICE = 'R$ 697,90';
const firstName = (n) => String(n || '').trim().split(/\s+/)[0] || '';
const inviteUrl = (code) => `${EVENT_SITE}/?convite=${encodeURIComponent(code)}`;
const prepUrl = (token) => `${EVENT_SITE}/preparacao.html?t=${token}`;
const directUrl = (code) => `${EVENT_SITE}/preparacao.html?c=${encodeURIComponent(code)}`;
// Attending = paid on the event page, or confirmed through the direct link.
const attending = (r) => r.status === 'pago' || r.status === 'confirmada';
const isDirect = (r) => r.provider === 'cadastro_direto';
// A direct sign-up only counts once she finishes the form; until then she
// is listed apart, so the main list stays the real attendee list.
const directInProgress = (r) => isDirect(r) && r.status === 'confirmada' && !r.prep_submitted_at;
const waLink = (phone, text) => `https://wa.me/55${String(phone || '').replace(/\D/g, '').replace(/^55(?=\d{10,11}$)/, '')}?text=${encodeURIComponent(text)}`;
// WhatsApp messages: *bold* and _italic_ are WhatsApp formatting; blank
// lines keep each idea on its own so it reads as a note, not a block.
const inviteMessage = (r, code) => [
  `Olá, ${firstName(r.full_name)}!`,
  '',
  'Que alegria ter você na *PERSEA Experience*.',
  '',
  `Como participante, você recebeu ${code.max_uses === 1 ? '*um convite exclusivo*' : `*${code.max_uses} convites exclusivos*`} para levar alguém especial com você, com uma condição especial de convidada.`,
  '',
  'É uma ótima oportunidade de viver esse dia ao lado de quem você admira.',
  '',
  'Para convidar, é só enviar este link:',
  inviteUrl(code.code),
  '',
  '_24 de outubro · Belo Horizonte_',
].join('\n');
const prepMessage = (r) => [
  `Olá, ${firstName(r.full_name)}!`,
  '',
  'Estamos preparando cada detalhe da *PERSEA Experience* para receber você.',
  '',
  'Para adaptarmos o espaço e o cardápio, precisamos saber se você tem alguma *alergia*, *restrição alimentar* ou *necessidade de acessibilidade*. Também queremos entender o que você espera viver neste dia.',
  '',
  'São 6 perguntas rápidas e, se puder, algumas fotos para uma dinâmica muito especial do dia: uma *foto sua de criança* e fotos de *pessoas especiais para você*.',
  '',
  'Acesse aqui:',
  prepUrl(r.prep_token),
  '',
  'Com carinho,',
  'Nay',
].join('\n');
// Same message for everyone who registered outside the system (one shared link).
const directMessage = (code) => [
  'Olá!',
  '',
  'Estou preparando cada detalhe da *PERSEA Experience* para receber você.',
  '',
  'Para confirmar a sua presença e adaptarmos o espaço e o cardápio, preciso de alguns dados seus e de saber se você tem alguma *alergia*, *restrição alimentar* ou *necessidade de acessibilidade*.',
  '',
  'Leva poucos minutos e, se puder, envie também uma *foto sua de criança* e fotos de *pessoas especiais para você*, para uma dinâmica muito especial do dia.',
  '',
  'Acesse aqui:',
  directUrl(code),
  '',
  'Com carinho,',
  'Nay',
].join('\n');
const RESULTS_URL = 'https://naymurta.com/resultados/';
const resultsMessage = () => [
  'Olá!',
  '',
  'Quero muito saber o que mudou para você desde que começamos o *PERSEA*.',
  '',
  'Preparei 6 perguntas rápidas sobre os seus resultados: faturamento, primeira venda, autoconfiança, visibilidade e percepção de valor. As suas respostas me ajudam a mostrar, com números reais, o que essa jornada é capaz de fazer.',
  '',
  'Responda aqui:',
  RESULTS_URL,
  '',
  'Com carinho,',
  'Nay',
].join('\n');
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
  const { data } = await supabase.from('tenant_settings').select('event_manual_payment_link_url, event_invite_payment_link_url, event_direct_signup_code').eq('id', 1).maybeSingle();
  return [data?.event_manual_payment_link_url || '', data?.event_invite_payment_link_url || '', data?.event_direct_signup_code || ''];
}
async function loadInviteCodes() {
  const { data } = await supabase.from('event_invite_codes').select('*').order('created_at');
  return data || [];
}

// Each participant gets her own soft tone (cycling, so neighbours always
// differ): a tinted card with a coloured edge, and her two panels (invite,
// preparation answers) a shade deeper, so scrolling a long list it's clear
// where one person's answers end and the next begins. Same on the mentee
// results list.
const TONES = [
  [220, 199, 168], // dourado
  [196, 132, 120], // rosé
  [138, 168, 140], // sálvia
  [124, 150, 186], // azul
  [168, 140, 186], // lavanda
];
const toneStyle = (i) => {
  const [r, g, b] = TONES[i % TONES.length];
  return `--tone-panel:rgba(${r},${g},${b},.11);--tone-line:rgba(${r},${g},${b},.32);background:rgba(${r},${g},${b},.06);border:1px solid rgba(${r},${g},${b},.25);border-left:4px solid rgb(${r},${g},${b});border-radius:6px;padding:16px 16px 16px 18px;`;
};

// The two things staff send each paid participant, as two labelled panels
// so the guest invite and the preparation form can't be confused.
const panel = (icon, title, status, body) => `
  <div class="p-3 rounded" style="background:var(--tone-panel, rgba(255,255,255,.03));border:1px solid var(--tone-line, var(--line));">
    <div class="flex items-center justify-between gap-2 flex-wrap mb-2">
      <p class="text-xs uppercase" style="color:var(--gold);letter-spacing:.14em;">${icon} ${title}</p>
      ${status}
    </div>
    ${body}
  </div>`;
const pill = (text, done) => `<span class="badge ${done ? 'badge-completed' : 'badge-progress'}" style="font-size:10px;">${text}</span>`;
const actionBtn = (attrs, label, primary = false) => `<button type="button" ${attrs} class="${primary ? 'btn-ghost' : 'btn-text'}" style="${primary ? 'padding:6px 12px;' : ''}font-size:11px;">${label}</button>`;
const waBtn = (phone, text, label) => phone ? `<a href="${waLink(phone, text)}" target="_blank" rel="noopener" class="btn-ghost" style="padding:6px 12px;font-size:11px;">${label}</a>` : '';

function inviteBlock(r) {
  const code = inviteCodes.find((c) => c.inviter_registration_id === r.id);
  if (!code) {
    return panel('✦', 'Convite para acompanhante', pill('Não gerado', false), `
      <p class="text-xs text-white/40 mb-2">Link pessoal para ela convidar alguém com a condição especial de convidada.</p>
      ${actionBtn(`data-gen-invite="${r.id}"`, 'Gerar convite', true)}`);
  }
  const guests = registrations.filter((g) => g.invite_code === code.code);
  return panel('✦', 'Convite para acompanhante',
    code.active ? pill(`${guests.length} de ${code.max_uses} usados`, guests.length >= code.max_uses) : '<span class="badge badge-locked" style="font-size:10px;">Desativado</span>', `
    <p class="text-xs text-white/40 mb-2">Código <span style="color:var(--gold);letter-spacing:.08em;">${esc(code.code)}</span> · limite de
      <input type="number" min="0" max="20" value="${code.max_uses}" data-invite-max="${code.id}" class="field text-xs" style="width:52px;padding:2px 6px;display:inline-block;" /> acompanhantes</p>
    <div class="flex items-center gap-2 flex-wrap">
      ${waBtn(r.phone, inviteMessage(r, code), 'Enviar convite no WhatsApp')}
      ${actionBtn(`data-copy-invite="${r.id}"`, 'Copiar convite')}
      ${actionBtn(`data-toggle-invite="${code.id}"`, code.active ? 'Desativar' : 'Reativar')}
    </div>
    ${guests.length ? `<p class="text-xs text-white/30 mt-2">Acompanhantes: ${guests.map((g) => `${esc(g.full_name)} (${STATUS_LABEL[g.status] || g.status})`).join(', ')}</p>` : ''}`);
}

// Childhood / special-people photos: thumbnails that open the full-size
// original (for printing). Shown whether or not the form was submitted —
// photos save on upload and may arrive before or after the answers.
function photosHtml(r) {
  const child = r.prep_child_photos || [], special = r.prep_special_photos || [];
  const row = (label, list) => `
    <div><p class="text-xs text-white/30 mb-1">${label} (${list.length})</p>
      ${list.length ? `<div class="flex gap-2 flex-wrap">${list.map((ph) => photoUrls[ph.path]
        ? `<a href="${photoUrls[ph.path]}" target="_blank" rel="noopener" title="Abrir em tamanho original"><img src="${photoUrls[ph.path]}" alt="" style="width:64px;height:64px;object-fit:cover;border-radius:4px;border:1px solid var(--line);"></a>`
        : '<span class="text-xs text-white/30">foto</span>').join('')}</div>` : '<p class="text-xs text-white/20">Nenhuma ainda</p>'}
    </div>`;
  return `<div class="grid sm:grid-cols-2 gap-3 mt-3 pt-3" style="border-top:1px solid var(--line);">${row('Foto de criança', child)}${row('Pessoas especiais', special)}</div>`;
}

function prepBlock(r) {
  const actions = `
    <div class="flex items-center gap-2 flex-wrap ${r.prep_submitted_at ? 'mt-3' : ''}">
      ${waBtn(r.phone, prepMessage(r), r.prep_submitted_at ? 'Reenviar formulário no WhatsApp' : 'Enviar formulário no WhatsApp')}
      ${actionBtn(`data-copy-prep="${r.id}"`, 'Copiar formulário')}
    </div>`;
  if (!r.prep_submitted_at) {
    return panel('✎', 'Formulário de preparação', pill('Pendente', false), `
      <p class="text-xs text-white/40 mb-2">Expectativas, alergias, restrições alimentares, acessibilidade, faturamento e fotos.</p>
      ${(r.prep_child_photos || []).length || (r.prep_special_photos || []).length ? photosHtml(r) : ''}
      ${actions}`);
  }
  const food = (r.prep_food_restrictions || []).join(', ') + (r.prep_food_note ? ` (${esc(r.prep_food_note)})` : '');
  const access = (r.prep_accessibility || []).filter((x) => x !== 'Não preciso');
  const item = (label, value) => `<div><p class="text-xs text-white/30">${label}</p><p class="text-sm">${value}</p></div>`;
  return panel('✎', 'Formulário de preparação', pill(`Respondido ${formatDateTime(r.prep_submitted_at)}`, true), `
    <div class="grid sm:grid-cols-2 gap-3">
      ${item('Expectativas', esc((r.prep_expectations || []).join(' · ')) + (r.prep_expectations_note ? `<br><span class="text-white/50">"${esc(r.prep_expectations_note)}"</span>` : ''))}
      ${item('Restrição alimentar', food || '—')}
      ${item('Alergias', r.prep_allergies ? `<span style="color:var(--terracotta);">${esc(r.prep_allergies)}</span>` : 'Nenhuma')}
      ${item('Acessibilidade', access.length ? `<span style="color:var(--terracotta);">${esc(access.join(', '))}${r.prep_accessibility_note ? ` (${esc(r.prep_accessibility_note)})` : ''}</span>` : (r.prep_accessibility ? 'Não precisa' : '—'))}
      ${item('Faturamento mensal', `${esc(r.prep_revenue_current || '—')} → meta ${esc(r.prep_revenue_goal || '—')}`)}
    </div>
    ${photosHtml(r)}
    ${actions}`);
}

async function loadMenteeResults() {
  const { data } = await supabase.from('mentee_results').select('*').order('created_at', { ascending: false });
  return data || [];
}

// One card: the link to send, the totals across everyone, then each answer.
function resultsCard() {
  const n = menteeResults.length;
  const avg = (k) => n ? (menteeResults.reduce((s, r) => s + r[k], 0) / n).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) : '—';
  const total = menteeResults.reduce((s, r) => s + Number(r.revenue_cents), 0);
  const shift = (label, k) => `<div><p class="text-xs text-white/30 mb-1">${label}</p><p class="text-lg font-serif">${avg(`${k}_before`)} <span class="text-white/30">→</span> <span style="color:var(--gold);">${avg(`${k}_after`)}</span></p></div>`;
  const scorePair = (label, r, k) => `<p class="text-sm"><span class="text-white/40">${label}:</span> ${r[`${k}_before`]} → <span style="color:var(--gold);">${r[`${k}_after`]}</span></p>`;
  const item = (r, i) => `
    <details style="${toneStyle(i)}">
      <summary class="cursor-pointer flex items-center justify-between gap-3 flex-wrap">
        <span class="font-medium">${esc(r.full_name)}</span>
        <span class="text-xs text-white/40">${brl(Number(r.revenue_cents))} · ${esc(r.first_sale)} · ${formatDateTime(r.created_at)}</span>
      </summary>
      <div class="mt-3 grid sm:grid-cols-3 gap-2">
        ${scorePair('Autoconfiança', r, 'confidence')}${scorePair('Visibilidade', r, 'visibility')}${scorePair('Percepção de valor', r, 'value')}
      </div>
      ${r.opportunities ? `<p class="text-xs text-white/30 mt-3">Oportunidades</p><p class="text-sm" style="white-space:pre-line;">${esc(r.opportunities)}</p>` : ''}
      <p class="text-xs text-white/30 mt-3">A principal mudança</p><p class="text-sm" style="white-space:pre-line;">${esc(r.transformation)}</p>
      <div class="mt-3">${actionBtn(`data-delete-result="${r.id}"`, 'Excluir resposta')}</div>
    </details>`;
  return card(`
    <div class="flex items-center justify-between gap-2 flex-wrap mb-2">
      <p class="text-sm text-white/50">Resultados das mentoradas</p>
      <span class="text-xs text-white/30">${n} ${n === 1 ? 'resposta' : 'respostas'}</span>
    </div>
    <p class="text-xs text-white/30 mb-4">Formulário independente para as mentoradas contarem os resultados: faturamento, primeira venda e notas de antes e de hoje (0 a 10).</p>
    <div class="flex flex-wrap gap-2 items-center mb-2">
      <input readonly class="field text-sm" style="flex:1; min-width:240px;" value="${RESULTS_URL}" onclick="this.select()" />
      ${actionBtn('data-copy-results-msg', 'Copiar mensagem', true)}
      ${actionBtn('data-copy-results-link', 'Copiar só o link')}
    </div>
    ${n ? `
    <div class="grid sm:grid-cols-4 gap-4 mt-6 mb-2">
      <div><p class="text-xs text-white/30 mb-1">Faturamento somado</p><p class="text-lg font-serif" style="color:var(--gold);">${brl(total)}</p></div>
      ${shift('Autoconfiança (média)', 'confidence')}${shift('Visibilidade (média)', 'visibility')}${shift('Percepção de valor (média)', 'value')}
    </div>
    <div class="space-y-3">${menteeResults.map(item).join('')}</div>` : '<p class="text-sm text-white/20 py-4">Nenhuma resposta ainda.</p>'}
  `, 'mt-6');
}

async function loadRegistrations() {
  const { data } = await supabase.from('event_registrations').select('*').order('created_at', { ascending: false });
  return data || [];
}

function registrationRow(r, i) {
  const waHref = r.phone ? `https://wa.me/55${r.phone.replace(/\D/g, '')}` : null;
  const social = [
    r.instagram ? `<a href="https://instagram.com/${r.instagram.replace(/^@/, '')}" target="_blank" rel="noopener" style="color:var(--gold);">@${r.instagram.replace(/^@/, '')}</a>` : '',
    r.linkedin ? `<a href="${/^https?:\/\//.test(r.linkedin) ? r.linkedin : `https://linkedin.com/in/${r.linkedin}`}" target="_blank" rel="noopener" style="color:var(--gold);">LinkedIn</a>` : '',
  ].filter(Boolean).join(' · ');
  return `
    <div class="flex items-start justify-between gap-3 flex-wrap" style="${toneStyle(i)}">
      <div class="min-w-0" style="flex:1 1 240px;">
        <div class="flex items-center gap-2 flex-wrap">
          <p class="font-medium break-words">${r.full_name}</p>
          ${statusBadge(r.status)}
          ${isDirect(r) ? '<span class="badge badge-locked" style="font-size:10px;">Cadastro direto</span>' : ''}
        </div>
        <p class="text-xs text-white/30 break-words">${r.email} · ${r.phone || 'sem telefone'}${r.age ? ` · ${r.age} anos` : ''}</p>
        ${social ? `<p class="text-xs mt-1">${social}</p>` : ''}
        <p class="text-xs text-white/20 mt-1">${isDirect(r) && !r.paid_at ? 'Pelo link de cadastro direto' : brl(r.amount_cents)} · inscrita ${formatDateTime(r.created_at)}${r.paid_at ? ` · paga ${formatDateTime(r.paid_at)}` : ''}</p>
        ${r.invited_by_registration_id || r.invite_code ? `<p class="text-xs mt-1" style="color:var(--gold);">Convidada por ${esc(registrations.find((x) => x.id === r.invited_by_registration_id)?.full_name || 'participante')} · código ${esc(r.invite_code || '')}</p>` : ''}
        ${attending(r) ? `<div class="mt-3 grid md:grid-cols-2 gap-3">${inviteBlock(r)}${prepBlock(r)}</div>` : ''}
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
  const confirmadas = registrations.filter((r) => r.status === 'confirmada' && !directInProgress(r)).length;
  const inProgress = registrations.filter(directInProgress);
  const receita = registrations.filter((r) => r.status === 'pago').reduce((s, r) => s + r.amount_cents, 0);

  const filtered = registrations.filter((r) => {
    if (directInProgress(r)) return false;
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
      ${card(`<p class="text-xs text-white/30 mb-1">Participantes</p><p class="text-2xl font-serif" style="color:var(--gold);">${pagas + confirmadas}</p><p class="text-xs text-white/30">${pagas} pagas${confirmadas ? ` · ${confirmadas} cadastro direto` : ''}</p>`)}
      ${card(`<p class="text-xs text-white/30 mb-1">Receita confirmada</p><p class="text-2xl font-serif" style="color:var(--gold);">${brl(receita)}</p>`)}
      ${card(`<p class="text-xs text-white/30 mb-1">Preparação respondida</p><p class="text-2xl font-serif">${registrations.filter((r) => attending(r) && r.prep_submitted_at).length} <span class="text-sm text-white/30">de ${pagas + confirmadas}</span></p>`)}
    </div>
    ${card(`
      <div class="flex items-center justify-between gap-2 flex-wrap mb-2">
        <p class="text-sm text-white/50">Link de cadastro direto</p>
        <span class="text-xs text-white/30">para quem não se inscreveu pelo site</span>
      </div>
      <p class="text-xs text-white/30 mb-4">Um único link para todas as pessoas que vão ao evento mas não passaram pela página de inscrição. Ela preenche os dados (nome, e-mail, WhatsApp, Instagram/LinkedIn, idade) e o formulário de preparação; quando termina, aparece na lista abaixo como <b>Confirmada · Cadastro direto</b>. Se o mesmo e-mail já estiver inscrito, as respostas vão para a inscrição existente.</p>
      ${directSignupCode ? `
      <div class="flex flex-wrap gap-2 items-center">
        <input readonly class="field text-sm" style="flex:1; min-width:260px;" value="${esc(directUrl(directSignupCode))}" onclick="this.select()" />
        ${actionBtn('data-copy-direct-msg', 'Copiar mensagem', true)}
        ${actionBtn('data-copy-direct-link', 'Copiar só o link')}
        ${isAdmin ? actionBtn('data-rotate-direct', 'Gerar novo link') : ''}
      </div>` : isAdmin ? actionBtn('data-rotate-direct', 'Criar link', true) : '<p class="text-xs text-white/40">A Nay ainda não criou este link.</p>'}
      ${inProgress.length ? `<p class="text-xs text-white/30 mt-4">Começaram e ainda não terminaram (${inProgress.length}): ${inProgress.map((r) => `${esc(r.full_name)}${r.phone ? ` <a href="${waLink(r.phone, `Olá, ${firstName(r.full_name)}! Vi que você começou o formulário da PERSEA Experience. Falta só um pouquinho para terminar: ${prepUrl(r.prep_token)}`)}" target="_blank" rel="noopener" style="color:var(--gold);">lembrar</a>` : ''}`).join(' · ')}</p>` : ''}
    `, 'mb-6')}
    ${isAdmin ? card(`
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
    `, 'mb-6') : ''}
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
      <div class="space-y-3">
        ${filtered.length ? filtered.map(registrationRow).join('') : '<p class="text-sm text-white/20 py-6">Nenhuma inscrição encontrada.</p>'}
      </div>
    `)}
    ${resultsCard()}
  `;

  content.querySelector('#reg-search').addEventListener('input', (e) => { search = e.target.value; render(); });
  content.querySelector('#status-filter').addEventListener('change', (e) => { statusFilter = e.target.value; render(); });
  content.querySelector('#manual-link-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const url = new FormData(e.target).get('manualLink').trim();
    const { error } = await supabase.from('tenant_settings').update({ event_manual_payment_link_url: url || null }).eq('id', 1);
    if (error) { toast(error.message, { tone: 'error' }); return; }
    manualPaymentLinkUrl = url;
    toast(url ? 'Link salvo — novas inscrições vão para ele.' : 'Link removido — voltando ao checkout automático.');
  });

  content.querySelector('#invite-link-form')?.addEventListener('submit', async (e) => {
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
  content.querySelector('[data-copy-direct-msg]')?.addEventListener('click', () => copyText(directMessage(directSignupCode)));
  content.querySelector('[data-copy-direct-link]')?.addEventListener('click', () => copyText(directUrl(directSignupCode)));
  // A new code switches the link off for anyone holding the old one.
  content.querySelector('[data-rotate-direct]')?.addEventListener('click', async () => {
    if (directSignupCode && !confirm('Gerar um novo link? O link atual deixa de funcionar para quem ainda não abriu.')) return;
    const code = crypto.randomUUID().replace(/-/g, '').slice(0, 16);
    const { error } = await supabase.from('tenant_settings').update({ event_direct_signup_code: code }).eq('id', 1);
    if (error) { toast(error.message, { tone: 'error' }); return; }
    directSignupCode = code;
    toast('Novo link criado.');
    render();
  });
  content.querySelector('[data-copy-results-msg]')?.addEventListener('click', () => copyText(resultsMessage()));
  content.querySelector('[data-copy-results-link]')?.addEventListener('click', () => copyText(RESULTS_URL));
  content.querySelectorAll('[data-delete-result]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const r = menteeResults.find((x) => x.id === btn.dataset.deleteResult);
      if (!r || !confirm(`Excluir a resposta de ${r.full_name}? Isto não pode ser desfeito.`)) return;
      const { error } = await supabase.from('mentee_results').delete().eq('id', r.id);
      if (error) { toast(error.message, { tone: 'error' }); return; }
      toast('Resposta excluída.');
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
  [registrations, links, inviteCodes, menteeResults] = await Promise.all([loadRegistrations(), loadTenantLinks(), loadInviteCodes(), loadMenteeResults()]);
  [manualPaymentLinkUrl, invitePaymentLinkUrl, directSignupCode] = links;
  const paths = registrations.flatMap((r) => [...(r.prep_child_photos || []), ...(r.prep_special_photos || [])].map((ph) => ph.path));
  photoUrls = {};
  if (paths.length) {
    const { data } = await supabase.storage.from('event-prep-photos').createSignedUrls(paths, 3600);
    (data || []).forEach((d) => { if (d.signedUrl) photoUrls[d.path] = d.signedUrl; });
  }
  render();
}

await refresh();
