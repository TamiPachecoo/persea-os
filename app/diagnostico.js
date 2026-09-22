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

// The 21 evaluative questions (q5–q25), verbatim, in pillar order —
// pillar identity itself is never shown to the respondent mid-quiz.
const QUESTIONS = [
  { id: 'q5', text: 'Quando alguém pergunta por que deveria escolher meu trabalho em vez de outra opção disponível no mercado:', options: [
    'Tenho dificuldade para explicar por que meu trabalho deveria ser escolhido.',
    'Consigo explicar o que faço, mas meu diferencial ainda depende muito da comparação com outras opções do mercado.',
    'Consigo explicar meus diferenciais, mas ainda tenho dificuldade para transformá-los em uma percepção clara de valor.',
    'Consigo comunicar com clareza por que meu trabalho é diferente, relevante e merece ser escolhido.',
  ]},
  { id: 'q6', text: 'Sobre o caminho que quero construir profissionalmente:', options: [
    'Ainda não tenho clareza sobre onde quero chegar.',
    'Tenho uma ideia, mas muitas vezes me sinto dividido entre possibilidades.',
    'Sei onde quero chegar, mas ainda tenho dúvidas sobre quais caminhos priorizar.',
    'Tenho clareza do que quero construir e das prioridades que precisam orientar minhas decisões.',
  ]},
  { id: 'q7', text: 'Quando penso no meu posicionamento no mercado:', options: [
    'Sinto que poderia ser substituído facilmente por outras pessoas da minha área.',
    'Sei que tenho diferenciais, mas eles ainda não são percebidos com clareza.',
    'Sou reconhecido por algumas características específicas do meu trabalho.',
    'Tenho um território claro no mercado e sou lembrado por algo específico.',
  ]},
  { id: 'q8', text: 'Meu público ideal:', options: [
    'Ainda não está claramente definido.',
    'Está definido de forma ampla, mas tento falar com públicos diferentes.',
    'Sei quem quero atrair e quais problemas essa pessoa busca resolver.',
    'Sei exatamente quem quero atrair, o que essa pessoa valoriza e por que meu trabalho é relevante para ela.',
  ]},
  { id: 'q9', text: 'Quando minha imagem pessoal é comparada ao nível do trabalho que entrego:', options: [
    'Existe uma diferença clara entre os dois.',
    'Minha imagem é adequada, mas não comunica tudo o que entrego.',
    'Minha imagem comunica profissionalismo e boa parte do meu valor.',
    'Minha imagem traduz intencionalmente o nível, o posicionamento e o valor do meu trabalho.',
  ]},
  { id: 'q10', text: 'Minha forma de me vestir, cuidar da aparência e me apresentar:', options: [
    'Acontece principalmente de forma automática ou conforme a ocasião.',
    'Busco estar adequado ao ambiente, mas sem muita intenção.',
    'Tenho consciência de como quero ser percebido e faço escolhas coerentes.',
    'Uso minha imagem de maneira intencional para criar destaque e reforçar a percepção que quero construir.',
  ]},
  { id: 'q11', text: 'Quando entro em um ambiente com outras pessoas da minha área:', options: [
    'Costumo passar despercebido.',
    'Sou percebido, mas raramente me destaco.',
    'Consigo me destacar em algumas situações.',
    'Consigo me destacar no meio de muitos, recebo olhares e percebo pessoas se aproximando naturalmente.',
  ]},
  { id: 'q12', text: 'Minha aparência, postura e forma de me apresentar estão:', options: [
    'Abaixo do nível de percepção que gostaria de transmitir.',
    'Dentro do esperado para minha área.',
    'Acima da média em alguns aspectos.',
    'Normalmente acima da média das outras pessoas, o que me coloca em um lugar de destaque.',
  ]},
  { id: 'q13', text: 'Quando publico ou me comunico nas redes sociais:', options: [
    'Publico pouco ou sem uma intenção clara.',
    'Publico com frequência, mas muitas vezes sem saber exatamente o que quero gerar.',
    'Tenho uma estratégia de conteúdo e sei quais temas quero associar ao meu trabalho.',
    'Minha comunicação é intencional, conversa diretamente com meu público ideal e reforça o posicionamento que quero ocupar.',
  ]},
  { id: 'q14', text: 'Quando alguém conhece meu perfil pela primeira vez:', options: [
    'Provavelmente não entende claramente o que faço ou para quem trabalho.',
    'Entende o que faço, mas não necessariamente percebe meu diferencial.',
    'Entende meu trabalho e consegue identificar alguns diferenciais.',
    'Entende rapidamente o que faço, para quem faço e por que deveria prestar atenção em mim.',
  ]},
  { id: 'q15', text: 'Sobre minha presença digital hoje:', options: [
    'Não representa o nível do profissional que sou.',
    'Representa parte do que faço, mas ainda parece comum.',
    'É coerente com meu trabalho, mas ainda poderia gerar mais autoridade e diferenciação.',
    'Reforça minha autoridade de maneira autêntica e me diferencia de outras pessoas da minha área.',
  ]},
  { id: 'q16', text: 'Quando me comunico, pessoalmente ou nas redes:', options: [
    'Sinto que muitas vezes estou tentando parecer algo que não sou.',
    'Consigo ser natural, mas nem sempre sei como direcionar essa comunicação.',
    'Consigo equilibrar naturalidade com intenção na maior parte das situações.',
    'Sei exatamente o que quero comunicar, mas faço isso de maneira natural, sem parecer artificial ou ensaiado.',
  ]},
  { id: 'q17', text: 'Quando converso com alguém que não conheço:', options: [
    'Tenho dificuldade para iniciar e sustentar uma conversa.',
    'Consigo conversar, mas muitas vezes não sei como criar uma conexão verdadeira.',
    'Consigo criar conexão e demonstrar interesse pela outra pessoa.',
    'Consigo criar conexão com naturalidade, demonstrando interesse genuíno sem perder clareza sobre quem sou e o que faço.',
  ]},
  { id: 'q18', text: 'Quando interajo profissionalmente, as pessoas tendem a:', options: [
    'Me respeitar, mas me perceber como distante.',
    'Me achar agradável, mas minha competência nem sempre fica evidente.',
    'Me perceber como competente e agradável.',
    'Me perceber como alguém competente, acessível e naturalmente agradável de estar por perto.',
  ]},
  { id: 'q19', text: 'Em ambientes sociais e profissionais, do mais simples ao mais sofisticado:', options: [
    'Muitas vezes me sinto deslocado ou inseguro sobre como me comportar.',
    'Sei me comportar bem em ambientes conhecidos, mas fico inseguro em contextos mais formais.',
    'Consigo me adaptar à maioria dos ambientes, embora nem sempre com total naturalidade.',
    'Transito com naturalidade entre diferentes ambientes, respeitando os códigos comportamentais de cada um, sem perder minha autenticidade.',
  ]},
  { id: 'q20', text: 'Sobre as oportunidades que chegam por meio das minhas relações:', options: [
    'Raramente sou lembrado ou indicado para oportunidades.',
    'Sou lembrado principalmente por pessoas que já conheço bem.',
    'Sou indicado ou convidado para algumas oportunidades relevantes.',
    'Sou frequentemente lembrado, indicado ou convidado para oportunidades relevantes na minha área.',
  ]},
  { id: 'q21', text: 'Quando defino o preço do meu produto ou serviço:', options: [
    'Tenho dificuldade para definir um preço que considere justo para mim e para o cliente.',
    'Costumo usar os preços praticados no mercado como principal referência.',
    'Cobro acima da média em algumas ofertas, mas ainda tenho dificuldade para sustentar essa diferença em todas as situações.',
    'Meu preço é definido principalmente pelo valor que entrego, pelo posicionamento que construí e pelo público que quero atender.',
  ]},
  { id: 'q22', text: 'Quando apresento meu preço:', options: [
    'Fico inseguro e tenho dificuldade para sustentar o valor.',
    'Sinto necessidade de justificar bastante o preço.',
    'Consigo apresentar com segurança, mas algumas objeções ainda me desestabilizam.',
    'Apresento meu preço com segurança e consigo sustentar o valor sem precisar me justificar excessivamente.',
  ]},
  { id: 'q23', text: 'Quando uma pessoa demonstra interesse, mas não compra imediatamente:', options: [
    'Sinto que preciso insistir para tentar fechar.',
    'Faço várias tentativas porque tenho medo de perder a oportunidade.',
    'Faço acompanhamento, mas nem sempre sei como conduzir a conversa.',
    'Sei acompanhar sem pressionar, entender o que está impedindo a decisão e conduzir a conversa de forma natural.',
  ]},
  { id: 'q24', text: 'Quando recebo uma objeção como "está caro", "vou pensar" ou "preciso falar com alguém":', options: [
    'Fico sem saber o que responder.',
    'Tento explicar novamente meu produto ou serviço.',
    'Consigo responder algumas objeções, mas ainda improviso bastante.',
    'Sei investigar o que realmente está por trás da objeção e conduzir a conversa sem pressão.',
  ]},
  { id: 'q25', text: 'Na hora de vender, minha segurança vem principalmente:', options: [
    'Da minha capacidade técnica ou da qualidade daquilo que entrego.',
    'Do fato de saber que meu produto ou serviço é bom.',
    'Da qualidade da minha entrega e da minha capacidade de conduzir uma boa conversa comercial.',
    'Da clareza sobre meu valor, meu posicionamento, minha oferta e minha capacidade de conduzir a decisão.',
  ]},
];

const MIRROR_QUESTION = {
  id: 'q26',
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
const TOTAL_STEPS = 4 + QUESTIONS.length + 1;
let step = 0;
const data = { full_name: '', market: '', revenue_band: '', instagram: '', answers: {}, mirror_answer: '' };
let result = null;
let submitError = '';

function setProgress() {
  const answered = Math.max(0, step - 1);
  progressFill.style.width = step === 0 || result ? (result ? '100%' : '0%') : `${Math.min(100, (answered / TOTAL_STEPS) * 100)}%`;
}

function letterFor(i) { return String.fromCharCode(65 + i); }

function renderIntro() {
  app.innerHTML = `
    <div class="screen">
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
  const { title, hint, placeholder, value, required, onNext } = opts;
  app.innerHTML = `
    <div class="screen">
      <p class="q-num">${step} / ${TOTAL_STEPS}</p>
      <h2 class="q-title">${title}</h2>
      <input class="field" id="field-input" type="text" placeholder="${placeholder || ''}" value="${value || ''}" />
      ${hint ? `<p class="hint">${hint}</p>` : ''}
      <div class="nav-row">
        <button type="button" class="btn-back" id="back" ${step === 1 ? 'disabled' : ''}>Voltar</button>
        <button type="button" class="btn-primary" id="next" ${required && !value ? 'disabled' : ''}>Continuar</button>
      </div>
    </div>
  `;
  const input = app.querySelector('#field-input');
  const nextBtn = app.querySelector('#next');
  input.addEventListener('input', () => { nextBtn.disabled = required && !input.value.trim(); });
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
    <div class="screen">
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
    <div class="screen">
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
    <div class="screen">
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
  if (step === 3) { renderRevenueField(); return; }
  if (step === 4) {
    renderTextField({ title: 'Instagram', placeholder: '@seuusuario', value: data.instagram, required: INSTAGRAM_REQUIRED, hint: INSTAGRAM_REQUIRED ? '' : 'Opcional.', onNext: (v) => { data.instagram = v; } });
    return;
  }
  const qIndex = step - 5;
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
