// Anonymous feedback after the PERSEA Experience. Answers go to event_feedback via
// the event-feedback Edge Function (no name, contact or IP) and are summarised in
// the CRM's Eventos tab. Only a "sent" flag stays on the phone, to avoid repeats.
const ENDPOINT = 'https://bletlyuptkppacjcbcvw.supabase.co/functions/v1/event-feedback';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_37D7JJzhUDCUwtHtYA4gjw_jiSXDMxu';
const SENT = 'persea-feedback-enviado';
const TALKS = [
  ['talk_posicionamento', 'posicionamento', 'Posicionamento', 'Nay Murta'],
  ['talk_capital_visual', 'capital_visual', 'Capital Visual', 'Nay Murta'],
  ['talk_visibilidade', 'visibilidade', 'Comunicação e Visibilidade', 'Nay Murta'],
  ['talk_vendas', 'vendas', 'Vendas', 'Nay Murta'],
  ['talk_larissa', 'larissa', 'Oratória', 'Larissa Araújo'],
  ['talk_rejane', 'rejane', 'Presença Magnética', 'Rejane Soilho'],
];

const $ = (id) => document.getElementById(id);
const answers = { wish_more: [] };

$('talks').innerHTML = TALKS.map(([k, , title, who]) => `<div class="talk"><div><b>${title}</b><span>${who}</span></div><div class="stars" data-k="${k}"></div></div>`).join('');
$('fav').innerHTML = TALKS.map(([, v, title, who]) => `<button type="button" data-v="${v}">${title} · ${who.split(' ')[0]}</button>`).join('');

document.querySelectorAll('.stars').forEach((box) => {
  const k = box.dataset.k;
  box.innerHTML = [1, 2, 3, 4, 5].map((n) => `<button type="button" data-n="${n}" aria-label="${n} de 5">★</button>`).join('');
  box.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    const n = Number(b.dataset.n);
    answers[k] = answers[k] === n ? null : n; // tap again to clear
    [...box.children].forEach((c) => c.classList.toggle('on', answers[k] && Number(c.dataset.n) <= answers[k]));
  });
});
document.querySelectorAll('.scale').forEach((box) => {
  const k = box.dataset.k;
  box.innerHTML = Array.from({ length: 11 }, (_, n) => `<button type="button" data-n="${n}">${n}</button>`).join('');
  box.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    answers[k] = Number(b.dataset.n);
    [...box.children].forEach((c) => c.classList.toggle('on', c === b));
  });
});
document.querySelectorAll('[data-one]').forEach((box) => {
  const k = box.dataset.one;
  box.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    answers[k] = answers[k] === b.dataset.v ? null : b.dataset.v;
    [...box.children].forEach((c) => c.classList.toggle('on', c.dataset.v === answers[k]));
  });
});
document.querySelectorAll('[data-many]').forEach((box) => {
  box.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    const list = answers.wish_more, i = list.indexOf(b.dataset.v);
    if (i === -1) list.push(b.dataset.v); else list.splice(i, 1);
    b.classList.toggle('on', i === -1);
  });
});

function thanks() {
  $('fb').classList.add('hidden'); $('thanks').classList.remove('hidden');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

$('fb').addEventListener('submit', async (e) => {
  e.preventDefault();
  const err = $('err'); err.textContent = '';
  if (!answers.overall) {
    err.textContent = 'Dê pelo menos a nota geral do evento (primeira pergunta).';
    document.querySelector('[data-k="overall"]').scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }
  const body = { ...answers, website: $('website').value };
  ['location_note', 'food_note', 'wish_more_other', 'highlight', 'improve', 'suggestions'].forEach((id) => { body[id] = $(id).value.trim(); });
  const btn = $('go'); btn.disabled = true; btn.textContent = 'Enviando…';
  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`, apikey: SUPABASE_PUBLISHABLE_KEY },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Não foi possível enviar agora.');
    try { localStorage.setItem(SENT, '1'); } catch (e2) { /* private mode */ }
    thanks();
  } catch (e2) {
    err.textContent = `${e2.message} Tente de novo em instantes.`;
    btn.disabled = false; btn.textContent = 'Enviar respostas';
  }
});

try { if (localStorage.getItem(SENT)) thanks(); } catch (e) { /* ignore */ }
