// Diagnóstico de Percepção de Valor — public lead-capture tool, no auth,
// no shell. Mirrors the one-question-per-screen wizard pattern already
// used by client/arquetipos.js, but standalone (this needs to work for
// people who aren't Persea clients yet). Scoring never happens here — see
// diagnostico-submit's own header comment for why: the client only
// collects answers and renders whatever the Edge Function returns.
const SUBMIT_ENDPOINT = 'https://bletlyuptkppacjcbcvw.supabase.co/functions/v1/diagnostico-submit';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_37D7JJzhUDCUwtHtYA4gjw_jiSXDMxu';
const WHATSAPP_NUMBER = '5531971564677';

// Single toggle per spec's own "opcional ou obrigatória conforme
// configuração" — flip to true if Nay wants Instagram required.
const INSTAGRAM_REQUIRED = false;

const REVENUE_OPTIONS = [
  { value: 'A', label: 'Até R$ 10 mil' },
  { value: 'B', label: 'De R$ 10 mil a R$ 30 mil' },
  { value: 'C', label: 'De R$ 30 mil a R$ 50 mil' },
  { value: 'D', label: 'De R$ 50 mil a R$ 100 mil' },
  { value: 'E', label: 'Acima de R$ 100 mil' },
  { value: 'F', label: 'Prefiro não informar' },
];

// 15 evaluative questions — 3 per pillar, shortened per Nay's own
// feedback after taking the quiz herself ("ficou cansativo, muito
// texto"). Pillar identity is never shown to the respondent mid-quiz.
// Keeping 3 questions per pillar (instead of the original 4/4/4/4/5)
// also means every pillar now normalizes the same way: min 3, max 12 —
// see diagnostico-submit's PILLARS map, which must stay in sync with
// this list's ids.
const QUESTIONS = [
  { id: 'q1', text: 'Quando alguém pergunta por que escolher você e não outra opção do mercado:', options: [
    'Tenho dificuldade para explicar.',
    'Explico, mas dependo da comparação com concorrentes.',
    'Explico meus diferenciais, mas sem clareza total de valor.',
    'Comunico com clareza por que meu trabalho merece ser escolhido.',
  ]},
  { id: 'q2', text: 'No meu mercado, hoje:', options: [
    'Poderia ser facilmente substituído.',
    'Tenho diferenciais, mas pouco percebidos.',
    'Sou reconhecido por características específicas.',
    'Tenho um território claro e sou lembrado por algo específico.',
  ]},
  { id: 'q3', text: 'Meu público ideal:', options: [
    'Ainda não está definido.',
    'Está definido de forma ampla.',
    'Sei quem quero atrair e o que essa pessoa busca.',
    'Sei exatamente quem atrair, o que valoriza e por quê.',
  ]},
  { id: 'q4', text: 'Minha imagem pessoal comunica o nível do meu trabalho?', options: [
    'Não, existe uma diferença clara.',
    'Comunica parte, mas não tudo.',
    'Comunica profissionalismo e boa parte do valor.',
    'Traduz intencionalmente o nível e o valor do meu trabalho.',
  ]},
  { id: 'q5', text: 'Minha forma de me vestir e me apresentar:', options: [
    'É automática, sem muita intenção.',
    'Busca adequação, mas sem intenção clara.',
    'Tenho consciência de como quero ser percebido.',
    'É usada intencionalmente para criar destaque.',
  ]},
  { id: 'q6', text: 'Em ambientes com pessoas da minha área:', options: [
    'Costumo passar despercebido.',
    'Sou percebido, mas raramente me destaco.',
    'Me destaco em algumas situações.',
    'Me destaco com frequência e atraio aproximações naturalmente.',
  ]},
  { id: 'q7', text: 'Minha comunicação nas redes sociais é:', options: [
    'Pouca ou sem intenção clara.',
    'Frequente, mas sem clareza do objetivo.',
    'Estratégica, com temas definidos.',
    'Intencional, fala direto com meu público e reforça meu posicionamento.',
  ]},
  { id: 'q8', text: 'Quando alguém conhece meu perfil pela primeira vez:', options: [
    'Não entende bem o que faço.',
    'Entende o que faço, mas não o diferencial.',
    'Entende o trabalho e alguns diferenciais.',
    'Entende rápido o que faço, para quem, e por que prestar atenção.',
  ]},
  { id: 'q9', text: 'Minha presença digital hoje:', options: [
    'Não representa meu nível.',
    'Representa parte, mas parece comum.',
    'É coerente, mas poderia gerar mais autoridade.',
    'Reforça minha autoridade e me diferencia.',
  ]},
  { id: 'q10', text: 'Ao conversar com alguém que não conheço:', options: [
    'Tenho dificuldade em iniciar e sustentar a conversa.',
    'Converso, mas sem criar conexão real.',
    'Crio conexão e demonstro interesse.',
    'Crio conexão natural, com interesse genuíno e clareza sobre mim.',
  ]},
  { id: 'q11', text: 'Profissionalmente, as pessoas tendem a:', options: [
    'Me respeitar, mas me achar distante.',
    'Me achar agradável, mas duvidar da minha competência.',
    'Me perceber como competente e agradável.',
    'Me perceber como competente, acessível e agradável.',
  ]},
  { id: 'q12', text: 'As oportunidades que chegam pelas minhas relações:', options: [
    'São raras.',
    'Vêm principalmente de quem já me conhece.',
    'Aparecem em algumas situações relevantes.',
    'São frequentes, com indicações e convites constantes.',
  ]},
  { id: 'q13', text: 'Ao definir meu preço:', options: [
    'Tenho dificuldade em definir um valor justo.',
    'Uso o mercado como referência principal.',
    'Cobro acima da média, mas nem sempre sustento.',
    'Defino pelo valor que entrego e pelo posicionamento construído.',
  ]},
  { id: 'q14', text: 'Ao apresentar meu preço:', options: [
    'Fico inseguro e tenho dificuldade em sustentar.',
    'Sinto necessidade de justificar bastante.',
    'Apresento com segurança, mas objeções me desestabilizam.',
    'Apresento com segurança e sustento o valor sem me justificar.',
  ]},
  { id: 'q15', text: 'Diante de "está caro" ou "vou pensar":', options: [
    'Fico sem saber o que responder.',
    'Tento explicar novamente o produto ou serviço.',
    'Respondo algumas objeções, mas improviso bastante.',
    'Investigo o que está por trás da objeção e conduzo sem pressão.',
  ]},
];

const MIRROR_QUESTION = {
  id: 'q_mirror',
  text: 'Depois de responder a este diagnóstico, qual afirmação mais representa sua realidade hoje?',
  options: [
    'Eu entrego mais valor do que o mercado consegue perceber.',
    'Meu valor é percebido, mas ainda existe uma distância entre o que entrego e o reconhecimento que recebo.',
    'Minha percepção de valor é boa, mas ainda não é consistente em todos os ambientes e pontos de contato.',
    'Meu posicionamento, imagem, visibilidade, conexão e vendas já trabalham juntos para sustentar meu valor.',
    'Meu valor é claramente percebido e convertido em reconhecimento, oportunidades e vendas acima da média do meu mercado.',
  ],
};

const app = document.getElementById('app');
const progressFill = document.getElementById('progress-fill');

// step 0 = intro, 1-4 = dados iniciais, 5-25 = QUESTIONS, 26 = mirror, 27 = submitting/result
const TOTAL_STEPS = 6 + QUESTIONS.length + 1;
let step = 0;
const data = { full_name: '', market: '', email: '', whatsapp: '', revenue_band: '', instagram: '', answers: {}, mirror_answer: '' };

function maskPhone(v) {
  return v.replace(/\D/g, '').slice(0, 11)
    .replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{4,5})(\d{4})$/, '$1-$2');
}
let result = null;
let submitError = '';

function setProgress() {
  const answered = Math.max(0, step - 1);
  progressFill.style.width = step === 0 || result ? (result ? '100%' : '0%') : `${Math.min(100, (answered / TOTAL_STEPS) * 100)}%`;
}

function letterFor(i) { return String.fromCharCode(65 + i); }

function renderIntro() {
  app.innerHTML = `
    <div class="screen center">
      <p class="eyebrow serif">Diagnóstico</p>
      <h1 class="title">Diagnóstico de<br>Percepção de Valor</h1>
      <p class="lede"><strong>Quanto do seu verdadeiro valor o mercado consegue perceber?</strong></p>
      <p class="lede">Este diagnóstico foi criado para identificar o quanto seu posicionamento, sua imagem, sua visibilidade, sua capacidade de conexão e sua forma de vender estão contribuindo para a percepção de valor do seu trabalho.</p>
      <p class="lede">Responda considerando sua realidade atual, especialmente os últimos 6 meses.</p>
      <p class="lede">Não existem respostas certas ou erradas. Existe a realidade que você está vivendo hoje.</p>
      <div class="nav-row" style="justify-content:flex-start;">
        <button type="button" class="btn-primary" id="start">Começar diagnóstico</button>
      </div>
    </div>
  `;
  app.querySelector('#start').addEventListener('click', () => { step = 1; render(); });
}

function renderTextField(opts) {
  const { title, hint, placeholder, value, required, type = 'text', mask, validate, onNext } = opts;
  app.innerHTML = `
    <div class="screen">
      <p class="q-num">${step} / ${TOTAL_STEPS}</p>
      <h2 class="q-title">${title}</h2>
      <input class="field" id="field-input" type="${type}" placeholder="${placeholder || ''}" value="${value || ''}" />
      ${hint ? `<p class="hint">${hint}</p>` : ''}
      <div class="nav-row">
        <button type="button" class="btn-back" id="back" ${step === 1 ? 'disabled' : ''}>Voltar</button>
        <button type="button" class="btn-primary" id="next" ${required && !(value && (!validate || validate(value))) ? 'disabled' : ''}>Continuar</button>
      </div>
    </div>
  `;
  const input = app.querySelector('#field-input');
  const nextBtn = app.querySelector('#next');
  const isValid = () => { const v = input.value.trim(); return !required || (!!v && (!validate || validate(v))); };
  input.addEventListener('input', () => {
    if (mask) input.value = mask(input.value);
    nextBtn.disabled = !isValid();
  });
  input.focus();
  app.querySelector('#back').addEventListener('click', () => { step -= 1; render(); });
  nextBtn.addEventListener('click', () => { onNext(input.value.trim()); step += 1; render(); });
}

function renderRevenueField() {
  app.innerHTML = `
    <div class="screen">
      <p class="q-num">${step} / ${TOTAL_STEPS}</p>
      <h2 class="q-title">Qual foi seu faturamento médio mensal nos últimos 6 meses?</h2>
      <div class="options">
        ${REVENUE_OPTIONS.map((o) => `
          <button type="button" class="option ${data.revenue_band === o.value ? 'selected' : ''}" data-value="${o.value}">${o.label}</button>
        `).join('')}
      </div>
      <div class="nav-row">
        <button type="button" class="btn-back" id="back">Voltar</button>
        <span></span>
      </div>
    </div>
  `;
  app.querySelector('#back').addEventListener('click', () => { step -= 1; render(); });
  app.querySelectorAll('.option').forEach((btn) => {
    btn.addEventListener('click', () => { data.revenue_band = btn.dataset.value; step += 1; render(); });
  });
}

function renderQuestion(q, stepNum, selectedValue, onSelect, letters) {
  const opts = letters || ['A', 'B', 'C', 'D'];
  app.innerHTML = `
    <div class="screen">
      <p class="q-num">${stepNum} / ${TOTAL_STEPS}</p>
      <h2 class="q-title">${q.text}</h2>
      <div class="options">
        ${q.options.map((text, i) => `
          <button type="button" class="option ${selectedValue === opts[i] ? 'selected' : ''}" data-value="${opts[i]}">${text}</button>
        `).join('')}
      </div>
      <div class="nav-row">
        <button type="button" class="btn-back" id="back">Voltar</button>
        <span></span>
      </div>
    </div>
  `;
  app.querySelector('#back').addEventListener('click', () => { step -= 1; render(); });
  app.querySelectorAll('.option').forEach((btn) => {
    btn.addEventListener('click', () => { onSelect(btn.dataset.value); step += 1; render(); });
  });
}

async function submitDiagnostic() {
  app.innerHTML = `
    <div class="screen center">
      <p class="lede">Calculando seu resultado...</p>
    </div>
  `;
  try {
    const res = await fetch(SUBMIT_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`, apikey: SUPABASE_PUBLISHABLE_KEY },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!res.ok || json.error) { submitError = json.error || 'Não foi possível calcular seu resultado agora.'; render(); return; }
    result = json;
    render();
  } catch (e) {
    submitError = 'Não foi possível conectar agora. Tente novamente em instantes.';
    render();
  }
}

function renderResult() {
  const waText = encodeURIComponent(`Olá! Acabei de fazer o Diagnóstico de Percepção de Valor e meu resultado foi: ${result.classification}. Quero entender melhor o que isso significa e solicitar minha análise estratégica.`);
  const waHref = `https://wa.me/${WHATSAPP_NUMBER}?text=${waText}`;
  app.innerHTML = `
    <div class="screen center">
      <p class="eyebrow serif">Seu resultado</p>
      <h1 class="result-band">${result.classification}</h1>
      <p class="lede">${result.classification_copy}</p>
      <div class="pillars">
        ${Object.entries(result.pillars).map(([name, val]) => `
          <div class="pillar-row">
            <div class="pillar-head"><span class="name">${name}</span><span class="val">${val}/100</span></div>
            <div class="pillar-track"><div class="pillar-fill" style="width:${val}%;"></div></div>
          </div>
        `).join('')}
      </div>
      ${result.main_opportunity ? `<p class="opportunity-note">Ponto crítico agora: <strong>${result.main_opportunity}</strong>. É aqui que seu valor está sendo perdido antes de chegar ao mercado.</p>` : ''}
      <p class="lede" style="margin-top:24px;">Quanto mais tempo esses pontos ficarem sem solução, maior o custo acumulado em oportunidades, autoridade e receita que você deveria estar capturando.</p>
      <p class="lede">Este número não é um diagnóstico definitivo, é um alerta. Se quiser entender exatamente o que está travando sua percepção de valor e o que precisa mudar primeiro, solicite sua análise estratégica agora.</p>
      <div class="nav-row" style="justify-content:flex-start;">
        <a class="wa-btn" href="${waHref}" target="_blank" rel="noopener">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12.001 2C6.478 2 2 6.477 2 12c0 1.913.532 3.752 1.539 5.352L2 22l4.766-1.499A9.953 9.953 0 0 0 12.001 22C17.523 22 22 17.523 22 12S17.523 2 12.001 2zm0 18.116a8.09 8.09 0 0 1-4.126-1.128l-.296-.176-3.06.962.977-2.99-.193-.307A8.104 8.104 0 0 1 3.884 12c0-4.478 3.643-8.116 8.117-8.116 4.473 0 8.116 3.638 8.116 8.116 0 4.478-3.643 8.116-8.116 8.116z"/></svg>
          Quero minha análise estratégica
        </a>
      </div>
    </div>
  `;
}

function renderSubmitError() {
  app.innerHTML = `
    <div class="screen center">
      <p class="lede">${submitError}</p>
      <div class="nav-row" style="justify-content:flex-start;">
        <button type="button" class="btn-primary" id="retry">Tentar novamente</button>
      </div>
    </div>
  `;
  app.querySelector('#retry').addEventListener('click', () => { submitError = ''; submitDiagnostic(); });
}

function render() {
  setProgress();
  if (submitError) { renderSubmitError(); return; }
  if (result) { renderResult(); return; }
  if (step === 0) { renderIntro(); return; }
  if (step === 1) {
    renderTextField({ title: 'Nome', placeholder: 'Seu nome completo', value: data.full_name, required: true, onNext: (v) => { data.full_name = v; } });
    return;
  }
  if (step === 2) {
    renderTextField({ title: 'Mercado de atuação', placeholder: 'Em que área você atua?', value: data.market, required: true, onNext: (v) => { data.market = v; } });
    return;
  }
  if (step === 3) {
    renderTextField({
      title: 'E-mail', placeholder: 'seu@email.com', value: data.email, required: true, type: 'email',
      validate: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), onNext: (v) => { data.email = v; },
    });
    return;
  }
  if (step === 4) {
    renderTextField({
      title: 'WhatsApp', placeholder: '(00) 00000-0000', value: data.whatsapp, required: true, mask: maskPhone,
      validate: (v) => v.replace(/\D/g, '').length >= 10, onNext: (v) => { data.whatsapp = v; },
    });
    return;
  }
  if (step === 5) { renderRevenueField(); return; }
  if (step === 6) {
    renderTextField({ title: 'Instagram', placeholder: '@seuusuario', value: data.instagram, required: INSTAGRAM_REQUIRED, hint: INSTAGRAM_REQUIRED ? '' : 'Opcional.', onNext: (v) => { data.instagram = v; } });
    return;
  }
  const qIndex = step - 7;
  if (qIndex >= 0 && qIndex < QUESTIONS.length) {
    const q = QUESTIONS[qIndex];
    renderQuestion(q, step, data.answers[q.id], (val) => { data.answers[q.id] = val; });
    return;
  }
  if (qIndex === QUESTIONS.length) {
    // Mirror question (q26) — selecting an option advances `step` past
    // this branch, so the next render() call falls through to submit.
    renderQuestion(MIRROR_QUESTION, step, data.mirror_answer, (val) => { data.mirror_answer = val; }, ['A', 'B', 'C', 'D', 'E']);
    return;
  }
  submitDiagnostic();
}

render();
