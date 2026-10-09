// Diagnóstico Estratégico de Entrada — the first questionnaire a student
// answers (it replaced "Extração de Marca" in Oct 2026). Questions are
// copied onto each client's own questionnaire_questions rows when she
// first opens it (client/questionnaire.js), together with their section,
// help text and 0–10 labels, so editing this file only changes it for
// students who haven't opened it yet. Older questionnaires keep the
// questions they were created with.
export const DIAGNOSTIC_TITLE = 'Diagnóstico Estratégico de Entrada';
export const DIAGNOSTIC_SUBTITLE = 'O ponto de partida da nossa jornada';
export const DIAGNOSTIC_INTRO = [
  'Antes da nossa primeira reunião, quero conhecer você, entender o momento atual do seu negócio, reconhecer os diferenciais que construiu e compreender o que deseja conquistar.',
  'Responda com sinceridade e, sempre que possível, traga exemplos concretos. Não existem respostas certas ou erradas. Quanto mais clareza tivermos sobre o seu momento atual, mais estratégica será a nossa jornada.',
];
export const DIAGNOSTIC_TIME = 'Tempo estimado de preenchimento: 10 a 12 minutos.';
export const DIAGNOSTIC_CLOSING = [
  'Obrigado por compartilhar essas informações.',
  'Este é o nosso ponto de partida. Na primeira reunião, vamos aprofundar os pontos mais relevantes do seu diagnóstico e identificar onde estão as principais oportunidades para fortalecer seu posicionamento, ampliar a percepção de valor e aproximar seus resultados dos objetivos que deseja alcançar.',
];
// Shown above the first 0–10 question of section 4.
export const SECTION_NOTES = {
  'Sua imagem e sua percepção de valor': 'Nas próximas três perguntas, dê uma nota de 0 a 10, considerando sua realidade atual.',
};

const S1 = 'Quem é você?';
const S2 = 'Seu negócio hoje';
const S3 = 'Seus diferenciais e suas razões para acreditar';
const S4 = 'Sua imagem e sua percepção de valor';
const S5 = 'Seus objetivos com a mentoria';

export const DIAGNOSTIC_QUESTIONS = [
  { section: S1, question_type: 'long_text', question_text: 'Quem é você além do profissional?',
    help: 'O que você ama fazer, quais são seus interesses, suas paixões e o que faz de você uma pessoa única? O que as pessoas próximas admiram em você?' },
  { section: S2, question_type: 'long_text', question_text: 'Quais serviços ou produtos você oferece atualmente e quanto cobra por cada um?',
    help: 'Liste suas principais ofertas e informe os respectivos valores.' },
  { section: S2, question_type: 'long_text', question_text: 'Quem é o cliente que você atende e qual problema ele procura resolver ao contratar você?',
    help: 'Descreva o perfil do seu cliente ideal e a principal necessidade que o leva até você.' },
  { section: S2, question_type: 'long_text', question_text: 'Quais resultados concretos você já ajudou seus clientes a alcançar?',
    help: 'Considere resultados financeiros, profissionais, técnicos ou pessoais. Se possível, traga números, exemplos, depoimentos ou outras evidências.' },
  { section: S3, question_type: 'long_text', question_text: 'Por que um cliente deveria escolher você em vez de outro profissional que oferece algo semelhante?',
    help: 'Considere sua experiência, formação, método de trabalho, conhecimento técnico, atendimento e tudo o que torna sua entrega diferente.' },
  { section: S3, question_type: 'long_text', question_text: 'Além da sua especialidade profissional, quais são seus interesses, habilidades ou assuntos pelos quais você tem curiosidade ou paixão? Sobre o que as pessoas costumam procurar você para pedir ajuda, conselhos ou opiniões?',
    help: 'Pense também naquilo que você faz naturalmente bem, mesmo que não faça parte do seu trabalho.' },
  { section: S3, question_type: 'long_text', question_text: 'Além do resultado técnico, quais mudanças seu trabalho proporciona na vida ou no negócio dos seus clientes?',
    help: 'Considere benefícios práticos e emocionais, como segurança, tranquilidade, confiança, reconhecimento, autonomia, liberdade ou redução de preocupações.' },
  { section: S3, question_type: 'long_text', question_text: 'Quais evidências sustentam sua credibilidade profissional?',
    help: 'Considere formação, especializações, experiência, projetos realizados, resultados, depoimentos, indicações, método próprio, publicações ou outros elementos que comprovem sua capacidade.' },
  { section: S4, question_type: 'scale', question_text: 'Como você avalia sua autoconfiança para falar sobre o próprio trabalho, defender suas ideias e negociar seus honorários?',
    help: null, min_label: 'nenhuma confiança', max_label: 'total confiança' },
  { section: S4, question_type: 'scale', question_text: 'Como você avalia sua visibilidade e exposição digital hoje?',
    help: 'Considere a clareza da sua comunicação, a frequência com que aparece, a qualidade do seu conteúdo e se as pessoas certas conhecem seu trabalho.',
    min_label: 'praticamente invisível para o público que desejo alcançar', max_label: 'muito visível para o público que desejo alcançar' },
  { section: S4, question_type: 'scale', question_text: 'Quanto você acredita que seu nome é reconhecido e associado a valor pelo mercado que deseja alcançar?',
    help: 'Considere se as pessoas lembram de você, reconhecem sua especialidade, indicam seu trabalho e procuram você pelas razões certas.',
    min_label: 'meu nome ainda é pouco reconhecido', max_label: 'meu nome é amplamente reconhecido e associado ao valor que entrego' },
  { section: S4, question_type: 'long_text', question_text: 'O que mais dificulta você cobrar o valor que gostaria pelo seu trabalho hoje?',
    help: 'Pode ser dificuldade de comunicar seus diferenciais, insegurança, comparação com concorrentes, falta de demanda, perfil dos clientes, dificuldade de negociar ou outro motivo.' },
  { section: S5, question_type: 'long_text', question_text: 'O que você deseja conquistar com esta mentoria nos próximos 3 a 6 meses?',
    help: 'Seja específico. Considere faturamento, honorários, clientes, reconhecimento, convites, oportunidades, posicionamento ou expansão do negócio.' },
  { section: S5, question_type: 'long_text', question_text: 'Ao final da nossa jornada, o que precisará ter mudado concretamente para você considerar que a mentoria valeu a pena?',
    help: 'Imagine os resultados que fariam você reconhecer que avançou profissionalmente e que o investimento trouxe retorno para sua vida ou seu negócio.' },
];

// Sections in order with their questions (keeps each row's own index).
// Rows from older questionnaires have no section: they come back as one
// untitled group.
export function groupBySection(questions) {
  const groups = [];
  questions.forEach((q, i) => {
    const name = q.section || '';
    let g = groups[groups.length - 1];
    if (!g || g.name !== name) { g = { name, items: [] }; groups.push(g); }
    g.items.push({ q, n: i + 1 });
  });
  return groups;
}
