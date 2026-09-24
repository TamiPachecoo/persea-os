// Diagnóstico de Percepção de Valor — public lead-capture tool, no auth,
// no shell. Two independent axes (Clareza / Percepção), each scored from
// 6 questions, crossed into one of four states via a fixed 70-point
// cutoff. Scoring and classification happen entirely in
// diagnostico-submit — this file only collects answers and renders
// whatever that function (and diagnostico-request-meeting) return.
const SUBMIT_ENDPOINT = 'https://bletlyuptkppacjcbcvw.supabase.co/functions/v1/diagnostico-submit';
const MEETING_ENDPOINT = 'https://bletlyuptkppacjcbcvw.supabase.co/functions/v1/diagnostico-request-meeting';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_37D7JJzhUDCUwtHtYA4gjw_jiSXDMxu';

const REVENUE_OPTIONS = [
  { value: 'A', label: 'Até R$ 10 mil' },
  { value: 'B', label: 'R$ 10 mil a R$ 30 mil' },
  { value: 'C', label: 'R$ 30 mil a R$ 50 mil' },
  { value: 'D', label: 'R$ 50 mil a R$ 100 mil' },
  { value: 'E', label: 'Acima de R$ 100 mil' },
];

// 6 Clareza + 6 Percepção — pillar identity is never shown to the
// respondent mid-quiz, only the plain "N de 12" progress count.
const QUESTIONS = [
  { id: 'q1', text: 'Quando alguém pergunta o que diferencia seu trabalho de outras opções do mercado, você:', options: [
    'Tenho dificuldade para explicar o que realmente me diferencia.',
    'Consigo falar sobre meu trabalho, mas meus diferenciais ainda não são tão claros.',
    'Sei quais são meus principais diferenciais, embora nem sempre consiga traduzi-los de forma simples.',
    'Consigo explicar com clareza o que faço de diferente e por que isso importa para quem me escolhe.',
  ]},
  { id: 'q2', text: 'Hoje, quão claro está para você o lugar que quer ocupar no seu mercado?', options: [
    'Ainda estou tentando entender qual lugar faz mais sentido para mim.',
    'Tenho algumas ideias, mas ainda considero caminhos muito diferentes entre si.',
    'Tenho uma direção definida, mas ainda existem decisões importantes que preciso amadurecer.',
    'Sei claramente pelo que quero ser reconhecido e quais oportunidades quero atrair.',
  ]},
  { id: 'q3', text: 'Quando pensa no seu público, você consegue definir com clareza para quem seu trabalho faz mais sentido?', options: [
    'Quero atender pessoas diferentes e ainda não vejo necessidade de escolher um público específico.',
    'Tenho um público em mente, mas minha comunicação acaba alcançando pessoas bastante diferentes.',
    'Sei quem quero atrair, embora ainda adapte bastante minha comunicação para diferentes perfis.',
    'Sei exatamente para quem meu trabalho faz mais sentido e consigo tomar decisões pensando nesse público.',
  ]},
  { id: 'q4', text: 'Quando pensa no que vende hoje, o quanto está claro para você o valor da sua oferta?', options: [
    'Tenho dificuldade para explicar exatamente o que torna minha oferta valiosa.',
    'Sei explicar o que entrego, mas ainda tenho dificuldade para diferenciar entrega de valor.',
    'Consigo identificar o valor principal da minha oferta, mas ainda estou refinando como comunicá-lo.',
    'Sei exatamente qual transformação, experiência ou resultado minha oferta representa e por que ela merece ser escolhida.',
  ]},
  { id: 'q5', text: 'Quando precisa tomar uma decisão importante para o seu negócio, você costuma:', options: [
    'Mudar de direção conforme surgem novas ideias, referências ou oportunidades.',
    'Considerar muitas possibilidades antes de decidir e, às vezes, acabar fazendo várias coisas ao mesmo tempo.',
    'Ter critérios para decidir, mas ainda abrir muitas exceções ao longo do caminho.',
    'Usar uma direção clara como critério para decidir o que faz sentido manter, abandonar ou priorizar.',
  ]},
  { id: 'q6', text: 'Se alguém perguntasse hoje "pelo que você quer ser lembrado no seu mercado?", você:', options: [
    'Teria dificuldade para responder de forma objetiva.',
    'Conseguiria citar algumas características, mas provavelmente daria uma resposta ampla.',
    'Saberia o que gostaria que associassem ao seu nome, embora isso ainda não esteja totalmente consolidado.',
    'Conseguiria responder com poucas palavras e perceberia que isso orienta a forma como você se posiciona.',
  ]},
  { id: 'q7', text: 'Quando alguém entra em contato com seu perfil ou conhece seu trabalho pela primeira vez, o que você acredita que essa pessoa entende?', options: [
    'Provavelmente fica em dúvida sobre o que faço ou sobre o que me diferencia.',
    'Entende o que faço, mas precisa de mais tempo para perceber meu diferencial.',
    'Entende meu trabalho e identifica alguns elementos que me diferenciam.',
    'Consegue entender rapidamente o que faço, meu valor e por que deveria prestar atenção em mim.',
  ]},
  { id: 'q8', text: 'Quando você entra em um ambiente profissional com pessoas que ainda não conhece, normalmente:', options: [
    'Preciso de bastante tempo para me sentir à vontade e conseguir me posicionar.',
    'Consigo interagir, mas nem sempre consigo demonstrar meu nível profissional.',
    'Consigo circular, conversar e me apresentar de maneira adequada à maioria das situações.',
    'Consigo me adaptar a diferentes ambientes, estabelecer conexões e transmitir segurança sem precisar forçar uma imagem.',
  ]},
  { id: 'q9', text: 'Quando você conversa presencialmente com alguém que pode ser um cliente, parceiro ou contato importante, você sente que:', options: [
    'Minha comunicação nem sempre transmite a competência que tenho.',
    'Consigo conversar bem, mas tenho dificuldade para sustentar autoridade quando preciso falar sobre meu trabalho.',
    'Consigo demonstrar competência e criar conexão, embora algumas situações ainda me tirem da minha naturalidade.',
    'Consigo equilibrar competência, clareza e proximidade, mantendo segurança mesmo em conversas mais importantes.',
  ]},
  { id: 'q10', text: 'Quando observa sua imagem pessoal em relação ao nível do trabalho que entrega, você percebe que:', options: [
    'Minha imagem está bastante distante daquilo que gostaria que meu trabalho representasse.',
    'Minha imagem é adequada, mas ainda comunica menos valor do que meu trabalho entrega.',
    'Minha imagem já transmite profissionalismo e parte importante do meu posicionamento.',
    'Minha imagem é intencional e coerente com o nível, o posicionamento e o valor que quero que o mercado associe ao meu trabalho.',
  ]},
  { id: 'q11', text: 'Quando apresenta seu preço para alguém interessado, normalmente:', options: [
    'Sinto insegurança e tenho dificuldade para sustentar o valor apresentado.',
    'Consigo falar o preço, mas sinto necessidade de explicar ou justificar bastante.',
    'Apresento o preço com segurança, embora algumas reações ainda me façam questionar o valor.',
    'Consigo apresentar e sustentar meu preço com naturalidade, sem transformar a conversa em uma defesa do meu valor.',
  ]},
  { id: 'q12', text: 'Quando alguém demonstra interesse, mas apresenta uma objeção como "está caro", "vou pensar" ou "preciso conversar com alguém", você tende a:', options: [
    'Ficar sem saber como conduzir a conversa ou partir rapidamente para uma concessão.',
    'Explicar novamente tudo o que está sendo entregue para tentar convencer a pessoa.',
    'Fazer perguntas e tentar entender a objeção, embora ainda improvise em algumas situações.',
    'Investigar o que realmente está por trás da objeção e conduzir a conversa com segurança, sem pressionar nem diminuir o valor da oferta.',
  ]},
];

const STATE_QUADRANT = {
  ALVO: 'top-right', SUSTENTACAO: 'top-left', ESFORCO: 'bottom-right', DISPERSAO: 'bottom-left',
};

function maskPhone(v) {
  return v.replace(/\D/g, '').slice(0, 11)
    .replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{4,5})(\d{4})$/, '$1-$2');
}

const app = document.getElementById('app');
const progressFill = document.getElementById('progress-fill');

const TOTAL_STEPS = 5 + QUESTIONS.length;
let step = 0;
const data = { full_name: '', whatsapp: '', market: '', revenue_band: '', instagram: '', answers: {} };
let result = null;
let processing = false;
let submitError = '';
let showMeetingForm = false;
let meetingSubmitted = false;
let meetingError = '';

function setProgress() {
  if (step === 0 || result || processing || showMeetingForm || meetingSubmitted) {
    progressFill.style.width = (result || meetingSubmitted) ? '100%' : '0%';
    return;
  }
  progressFill.style.width = `${Math.min(100, (Math.max(0, step - 1) / TOTAL_STEPS) * 100)}%`;
}

function renderIntro() {
  app.innerHTML = `
    <div class="screen center">
      <p class="eyebrow serif">Diagnóstico</p>
      <h1 class="title">Diagnóstico de<br>Percepção de Valor</h1>
      <p class="lede"><strong>Quanto do valor que você entrega o mercado realmente consegue perceber?</strong></p>
      <p class="lede">Você pode ter competência, experiência e uma entrega excelente.</p>
      <p class="lede">Ainda assim, pode existir uma distância entre o valor que você possui e o valor que o mercado consegue enxergar.</p>
      <p class="lede">Este diagnóstico foi criado para identificar essa distância a partir de dois elementos: clareza e percepção.</p>
      <div class="nav-row" style="justify-content:flex-start;flex-direction:column;align-items:flex-start;gap:12px;">
        <button type="button" class="btn-primary" id="start">Começar diagnóstico</button>
        <p class="hint" style="margin:0;">12 perguntas · aproximadamente 4 minutos</p>
      </div>
    </div>
  `;
  app.querySelector('#start').addEventListener('click', () => { step = 1; render(); });
}

function renderTextField(opts) {
  const { title, hint, placeholder, value, type = 'text', mask, validate, onNext } = opts;
  app.innerHTML = `
    <div class="screen">
      <p class="q-num">${step} / ${TOTAL_STEPS}</p>
      <h2 class="q-title">${title}</h2>
      <input class="field" id="field-input" type="${type}" placeholder="${placeholder || ''}" value="${value || ''}" />
      ${hint ? `<p class="hint">${hint}</p>` : ''}
      <div class="nav-row">
        <button type="button" class="btn-back" id="back" ${step === 1 ? 'disabled' : ''}>Voltar</button>
        <button type="button" class="btn-primary" id="next" ${!(value && (!validate || validate(value))) ? 'disabled' : ''}>Continuar</button>
      </div>
    </div>
  `;
  const input = app.querySelector('#field-input');
  const nextBtn = app.querySelector('#next');
  const isValid = () => { const v = input.value.trim(); return !!v && (!validate || validate(v)); };
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
      <h2 class="q-title">Faturamento médio mensal nos últimos 6 meses</h2>
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

function renderQuestion(q, stepNum) {
  app.innerHTML = `
    <div class="screen">
      <p class="q-num">${stepNum} / ${TOTAL_STEPS}</p>
      <h2 class="q-title">${q.text}</h2>
      <div class="options">
        ${q.options.map((text, i) => `
          <button type="button" class="option ${data.answers[q.id] === 'ABCD'[i] ? 'selected' : ''}" data-value="${'ABCD'[i]}">${text}</button>
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
    btn.addEventListener('click', () => {
      data.answers[q.id] = btn.dataset.value;
      step += 1;
      render();
    });
  });
}

const PROCESSING_MESSAGES = [
  'Analisando suas respostas...',
  'Cruzando seus índices de clareza e percepção...',
  'Seu diagnóstico está pronto.',
];

let processingMessageIndex = 0;

async function runProcessingThenSubmit() {
  processing = true;
  processingMessageIndex = 0;
  render();
  const advance = async () => {
    processingMessageIndex += 1;
    if (processingMessageIndex < PROCESSING_MESSAGES.length) {
      render();
      setTimeout(advance, 900);
    } else {
      await submitDiagnostic();
    }
  };
  setTimeout(advance, 900);
}

function renderProcessing() {
  const idx = Math.min(processingMessageIndex, PROCESSING_MESSAGES.length - 1);
  app.innerHTML = `
    <div class="screen center">
      <p class="processing-text">${PROCESSING_MESSAGES[idx]}</p>
    </div>
  `;
}

async function submitDiagnostic() {
  try {
    const res = await fetch(SUBMIT_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`, apikey: SUPABASE_PUBLISHABLE_KEY },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!res.ok || json.error) { processing = false; submitError = json.error || 'Não foi possível calcular seu resultado agora.'; render(); return; }
    processing = false;
    result = json;
    render();
  } catch (e) {
    processing = false;
    submitError = 'Não foi possível conectar agora. Tente novamente em instantes.';
    render();
  }
}

function matrixHtml(classification) {
  const quad = STATE_QUADRANT[classification];
  const cell = (name, key) => `<div class="matrix-quad ${quad === key ? 'active' : ''}">${name}</div>`;
  return `
    <div class="matrix-outer">
      <span class="matrix-axis-label vertical">Percepção ↑</span>
      <div class="matrix">
        ${cell('Sustentação', 'top-left')}${cell('Alvo', 'top-right')}
        ${cell('Dispersão', 'bottom-left')}${cell('Esforço', 'bottom-right')}
      </div>
      <p class="matrix-axis-label">Clareza →</p>
    </div>
  `;
}

function renderResult() {
  app.innerHTML = `
    <div class="screen center">
      <p class="eyebrow serif">Seu diagnóstico</p>
      <div class="indices-grid">
        <div class="index-card">
          <p class="label">Índice de Clareza</p>
          <p class="value">${result.score_clareza}<span>/100</span></p>
        </div>
        <div class="index-card">
          <p class="label">Índice de Percepção</p>
          <p class="value">${result.score_percepcao}<span>/100</span></p>
        </div>
      </div>
      <div class="matrix-wrap">${matrixHtml(result.classification)}</div>
      <p class="state-name">Seu estado atual: ${result.classification === 'ESFORCO' ? 'Esforço' : result.classification === 'DISPERSAO' ? 'Dispersão' : result.classification === 'SUSTENTACAO' ? 'Sustentação' : 'Alvo'}</p>

      <h1 class="title" style="font-size:clamp(20px,5vw,26px); margin-top:32px;">${result.title}</h1>
      ${result.body.split('\n\n').map((p) => `<p class="lede">${p}</p>`).join('')}

      <p class="lede" style="margin-top:20px;"><strong>Seu diagnóstico mostra onde existe hoje a maior distância entre o valor que você possui e o valor que o mercado consegue perceber.</strong></p>
      <p class="lede">E essa distância pode ser trabalhada.</p>

      <div class="cta-card" style="margin-top:28px;">
        <h2>Quer entender o que precisa mudar?</h2>
        <p class="lede">Se você quer entender quais ajustes podem aproximar a forma como você é percebido do nível de valor que deseja sustentar no mercado, você pode solicitar uma reunião para analisarmos os seus primeiros passos.</p>
        <p class="lede">Nessa conversa, vamos olhar para o seu momento, identificar os principais pontos de ajuste e entender quais movimentos podem fazer sentido para o seu posicionamento.</p>
        <button type="button" class="btn-primary" id="want-meeting" style="margin-top:8px;">Quero solicitar uma reunião</button>
        <p class="fine-print"><strong>Importante:</strong> o preenchimento deste diagnóstico não garante uma reunião nem uma vaga em qualquer programa ou processo. Os pedidos passam por critérios de análise e seleção, considerando o momento profissional, o mercado de atuação e a aderência ao trabalho.</p>
      </div>
    </div>
  `;
  app.querySelector('#want-meeting').addEventListener('click', () => { showMeetingForm = true; render(); });
}

function renderMeetingForm() {
  app.innerHTML = `
    <div class="screen">
      <p class="eyebrow serif">Solicitação de reunião</p>
      <h2 class="q-title" style="margin-bottom:20px;">O que você gostaria de mudar na forma como o mercado percebe seu trabalho?</h2>
      <textarea class="field" id="answer-1" rows="4"></textarea>
      <h2 class="q-title" style="margin-top:24px;">Qual é hoje o principal desafio para sustentar o posicionamento que você deseja?</h2>
      <textarea class="field" id="answer-2" rows="4"></textarea>
      ${meetingError ? `<p class="hint" style="color:var(--terracotta);">${meetingError}</p>` : ''}
      <div class="nav-row">
        <button type="button" class="btn-back" id="back">Voltar</button>
        <button type="button" class="btn-primary" id="send-meeting">Solicitar reunião</button>
      </div>
    </div>
  `;
  app.querySelector('#back').addEventListener('click', () => { showMeetingForm = false; render(); });
  app.querySelector('#send-meeting').addEventListener('click', async () => {
    const a1 = app.querySelector('#answer-1').value.trim();
    const a2 = app.querySelector('#answer-2').value.trim();
    if (!a1 || !a2) { meetingError = 'Responda as duas perguntas para continuar.'; render(); return; }
    const btn = app.querySelector('#send-meeting');
    btn.disabled = true;
    try {
      const res = await fetch(MEETING_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`, apikey: SUPABASE_PUBLISHABLE_KEY },
        body: JSON.stringify({ id: result.id, meeting_answer_1: a1, meeting_answer_2: a2 }),
      });
      const json = await res.json();
      if (!res.ok || json.error) { meetingError = json.error || 'Não foi possível enviar agora.'; btn.disabled = false; render(); return; }
      meetingError = '';
      meetingSubmitted = true;
      render();
    } catch (e) {
      meetingError = 'Não foi possível conectar agora. Tente novamente.';
      btn.disabled = false;
      render();
    }
  });
}

function renderConfirmation() {
  app.innerHTML = `
    <div class="screen center">
      <div class="checkmark"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg></div>
      <p class="eyebrow serif">Pedido recebido</p>
      <h1 class="title">Pedido recebido</h1>
      <p class="lede">Seu pedido foi recebido.</p>
      <p class="lede">Agora vamos analisar suas respostas e verificar a aderência ao nosso processo.</p>
      <p class="lede">Caso seu perfil esteja dentro dos critérios desta etapa, entraremos em contato pelo WhatsApp informado.</p>
      <p class="fine-print"><strong>O envio da solicitação não representa confirmação de reunião ou garantia de vaga.</strong></p>
      <p class="lede" style="margin-top:20px;">Obrigada por compartilhar seu momento.</p>
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
  app.querySelector('#retry').addEventListener('click', () => { submitError = ''; runProcessingThenSubmit(); });
}

function render() {
  setProgress();
  if (meetingSubmitted) { renderConfirmation(); return; }
  if (showMeetingForm) { renderMeetingForm(); return; }
  if (submitError) { renderSubmitError(); return; }
  if (result) { renderResult(); return; }
  if (processing) { renderProcessing(); return; }
  if (step === 0) { renderIntro(); return; }
  if (step === 1) {
    renderTextField({ title: 'Nome', placeholder: 'Seu nome completo', value: data.full_name, validate: (v) => v.length > 1, onNext: (v) => { data.full_name = v; } });
    return;
  }
  if (step === 2) {
    renderTextField({
      title: 'WhatsApp', placeholder: '(00) 00000-0000', value: data.whatsapp, mask: maskPhone,
      validate: (v) => v.replace(/\D/g, '').length >= 10, onNext: (v) => { data.whatsapp = v; },
    });
    return;
  }
  if (step === 3) {
    renderTextField({ title: 'Mercado de atuação', placeholder: 'Em que área você atua?', value: data.market, validate: (v) => v.length > 1, onNext: (v) => { data.market = v; } });
    return;
  }
  if (step === 4) { renderRevenueField(); return; }
  if (step === 5) {
    renderTextField({ title: 'Instagram', placeholder: '@seuusuario', value: data.instagram, validate: (v) => v.length > 1, onNext: (v) => { data.instagram = v; } });
    return;
  }
  const qIndex = step - 6;
  if (qIndex >= 0 && qIndex < QUESTIONS.length) {
    renderQuestion(QUESTIONS[qIndex], step);
    return;
  }
  runProcessingThenSubmit();
}

render();
