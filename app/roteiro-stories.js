// Oficina prática (PERSEA Experience · Visibilidade): the participant answers the
// diagnosis, and we hand the full strategist prompt, with her answers filled in,
// to ChatGPT or Claude. Answers stay only on her phone (localStorage).
const KEY = 'persea-roteiro-stories';
const IDS = ['q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7'];
const QUESTIONS = [
  'Qual é a minha profissão ou área de atuação?',
  'Quem é o público que quero atingir?',
  'O que esse público acredita que eu questiono ou considero incompleto?',
  'Que erro vejo esse público cometer repetidamente?',
  'O que ele costuma priorizar sem analisar outros critérios importantes?',
  'Qual pode ser a consequência dessa escolha?',
  'Como eu enxergo essa questão de maneira diferente? Qual é o meu critério profissional?',
  'Meu objetivo é gerar conversas no direct, identificar dores do público ou fortalecer autoridade?',
];

const PROMPT = (answers) => `Quero que você atue como meu estrategista de posicionamento e roteiros para Instagram.

Sua função é me ajudar a transformar meu conhecimento profissional em uma sequência de 6 stories que gere atenção, provoque uma reflexão relevante para o meu mercado e estimule uma interação com potencial de conversa no direct.

Eu já respondi ao diagnóstico abaixo. Se alguma resposta estiver vaga, me ajude a torná-la específica antes de finalizar o roteiro.

${answers}

Com base nas minhas respostas, crie uma sequência personalizada:

* Story 0 — Contexto: partir do fato de eu estar em um evento (a PERSEA Experience) e introduzir uma reflexão que me fez pensar sobre o meu mercado. Não invente falas ou acontecimentos que eu não relatei.
* Story 1 — Gancho: uma provocação forte, específica e relevante para o público.
* Story 2 — Argumento: explique por que questiono a crença apresentada.
* Story 3 — Consequência: mostre o que pode acontecer se o público continuar agindo da mesma maneira.
* Story 4 — Minha visão: revele meu raciocínio e o critério que orienta minha atuação.
* Story 5 — Ativação: crie uma enquete com duas opções curtas, naturais e relacionadas à narrativa, que ajudem a iniciar uma conversa no direct.

Para cada story, escreva o texto pronto para publicar e sugira um recurso visual simples.

No final, crie uma mensagem de direct para continuar a conversa com quem interagir.

Regras:

* Não use provocações genéricas que poderiam servir para qualquer profissão.
* Não invente polêmicas nem incentive ataques a colegas ou outras profissões.
* Não confunda volume de publicações com comunicação estratégica.
* Priorize autenticidade, clareza, personalidade e relevância para o público.
* Não entregue apenas frases de efeito: construa uma sequência lógica.`;

const $ = (id) => document.getElementById(id);
let goal = '';

const save = () => {
  try { localStorage.setItem(KEY, JSON.stringify({ answers: IDS.map((id) => $(id).value), goal })); } catch (e) { /* private mode */ }
};
const load = () => {
  try {
    const d = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (!d) return;
    IDS.forEach((id, i) => { $(id).value = d.answers[i] || ''; });
    goal = d.goal || '';
  } catch (e) { /* ignore */ }
};

const steps = $('steps');
IDS.concat('q8').forEach(() => steps.appendChild(document.createElement('i')));
const paint = () => {
  const filled = IDS.map((id) => !!$(id).value.trim()).concat(!!goal);
  [...steps.children].forEach((s, i) => s.classList.toggle('on', filled[i]));
  document.querySelectorAll('#q8 button').forEach((b) => b.classList.toggle('on', b.dataset.v === goal));
};

IDS.forEach((id) => $(id).addEventListener('input', () => { save(); paint(); $('err').classList.remove('on'); }));
document.querySelectorAll('#q8 button').forEach((b) => b.addEventListener('click', () => { goal = b.dataset.v; save(); paint(); $('err').classList.remove('on'); }));

const toast = (msg) => { const t = $('toast'); t.textContent = msg; t.classList.add('on'); setTimeout(() => t.classList.remove('on'), 2600); };

function buildPrompt() {
  const vals = IDS.map((id) => $(id).value.trim()).concat(goal);
  const missing = vals.findIndex((v) => !v);
  if (missing !== -1) {
    $('err').classList.add('on');
    const el = missing < IDS.length ? $(IDS[missing]) : $('q8');
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    if (el.focus) el.focus({ preventScroll: true });
    return null;
  }
  const answers = 'Aqui estão minhas respostas:\n\n' + QUESTIONS.map((q, i) => `${i + 1}. ${q}\n${vals[i]}`).join('\n\n');
  return PROMPT(answers);
}

async function copy(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch (e) {
    const ta = Object.assign(document.createElement('textarea'), { value: text });
    ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select();
    let ok = false; try { ok = document.execCommand('copy'); } catch (err) { ok = false; }
    ta.remove(); return ok;
  }
}

async function send(target) {
  const p = buildPrompt();
  if (!p) return;
  const ok = await copy(p);
  $('done').classList.add('on');
  if (!target) { toast(ok ? 'Comando copiado.' : 'Não foi possível copiar automaticamente.'); return; }
  const url = target === 'gpt'
    ? `https://chatgpt.com/?q=${encodeURIComponent(p)}`
    : `https://claude.ai/new?q=${encodeURIComponent(p)}`;
  window.location.href = url;
}

$('gpt').addEventListener('click', () => send('gpt'));
$('claude').addEventListener('click', () => send('claude'));
$('copy').addEventListener('click', () => send(null));

load();
paint();
