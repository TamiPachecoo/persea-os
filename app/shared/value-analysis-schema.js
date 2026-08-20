// Leitura Estratégica de Valor — question config + pure calculation engine
// for the premium business/sales/pricing assessment. Split out of
// mock-db.js because of sheer size (6 sections, ~100 fields): this file is
// the single source of truth for question text/options/conditions, shared
// verbatim by the client wizard (renders + validates) and the admin private
// workspace (renders read-only + review-status controls) — so the two
// screens can never drift out of sync on what a question actually says.
// mock-db.js owns storage/CRUD/access-gating; this file owns content + math.

export const VALUE_ASSESSMENT_STATUSES = [
  'locked_plan', 'upcoming', 'available', 'in_progress', 'submitted', 'in_analysis', 'published',
];
// Warm, client-friendly copy — never expose the raw status keys above in the UI.
export const VALUE_ASSESSMENT_STATUS_LABEL = {
  locked_plan: 'Exclusivo do Programa Premium',
  upcoming: 'Próximo',
  available: 'Disponível',
  in_progress: 'Em andamento',
  submitted: 'Enviado',
  in_analysis: 'Em análise',
  published: 'Devolutiva disponível',
};
export const VALUE_ASSESSMENT_STATUS_BADGE_CLASS = {
  locked_plan: 'badge-locked', upcoming: 'badge-locked', available: 'badge-progress',
  in_progress: 'badge-progress', submitted: 'badge-progress', in_analysis: 'badge-progress',
  published: 'badge-completed',
};

export const REVIEW_STATUSES = ['confirmado', 'estimado', 'precisa_esclarecer', 'nao_aplicavel'];
export const REVIEW_STATUS_LABEL = {
  confirmado: 'Confirmado', estimado: 'Estimado',
  precisa_esclarecer: 'Precisa esclarecer', nao_aplicavel: 'Não aplicável',
};

// --- Blank record shape ---------------------------------------------------
export function blankAssessmentAnswers() {
  return {
    s1: {
      profession: '', specialty: '', region: '', serviceMode: '', businessModel: '', businessModelOther: '',
      primaryOfferName: '', primaryOfferDescription: '', targetAudience: '', salesChannels: [], salesChannelsOther: '',
      mainProblem: '', desiredOutcome: '',
    },
    offers: [],
    s2: { monthlyRevenue: null, monthlyRevenuePrecision: '', monthlyClients: null, capacityUtilization: '' },
    fixedCosts: [],
    variableCosts: [],
    s3: { separatesFinances: '', tracksMonthly: '', variableCostNotes: '', seasonalNotes: '' },
    s4: {
      desiredWeeklyHours: null, adminHours: null, salesHours: null, marketingHours: null, planningHours: null,
      deliveryHoursAvailable: null, workDaysPerWeek: null, workloadPreference: '',
      deliverableVolumeCapacity: null, maxVolumeAchieved: null, wasSustainable: '', capacityLimiters: [], capacityLimitersOther: '',
      demandDoubleScenario: '', capacityIncreaseIdeas: '',
    },
    s5: {
      desiredMonthlyRevenue: null, desiredRevenueTimeframe: '', desiredProLabore: null, minPersonalExpenses: null,
      reserveEmergency: null, reserveReinvestment: null, reserveGrowth: null, reserveVacation: null, reserveOther: null,
      businessDebt: '', expansionGoal: '', safetyMargin: '', canCoverCostsToday: '', currentPriority: '',
    },
    s6: {
      experienceLevel: '', yearsInField: '', qualifications: '', differentiator: '', whyBestClientsChoose: '',
      transformationDelivered: '', extrasIncluded: '', commonObjections: '', priceQuestioned: '', lossReason: '',
      referencesIntro: '', knowsReferencePrices: '',
      references: [], desiredPerception: '', priceMatchesPositioning: '', priceMatchesPositioningWhy: '',
      demandLevel: '', waitlistExists: '', lostSalesDueToCapacity: '', believesCouldSustainHigherPrice: '', priceIncreaseDoubts: '',
    },
  };
}

export function blankOffer() {
  return {
    id: `off${Date.now()}${Math.random().toString(36).slice(2, 6)}`,
    name: '', currentPrice: null, deliveryType: '', deliveryTypeOther: '',
    deliveryMinutes: null, deliveryUnit: 'sessao', requiresPostWork: '', postWorkHours: null,
    avgMonthlySales: null, hasCapacityLimit: '', capacityLimit: null,
    paymentMethod: '', paymentMethodOther: '', installments: null,
    offersDiscount: '', discountNotes: '', paysCommission: '', commissionNotes: '',
    directCostPerSale: null, priceAssessment: '', priceLastChangedAt: '', priceChangeReason: '',
  };
}
export function blankFixedCost(category = '') {
  return { id: `fc${Date.now()}${Math.random().toString(36).slice(2, 6)}`, category, description: '', monthlyAmount: null, isEstimate: true };
}
export function blankVariableCost(category = '') {
  return {
    id: `vc${Date.now()}${Math.random().toString(36).slice(2, 6)}`, category, calculationType: 'monthly_estimate',
    amount: null, percentage: null, isEstimate: true,
  };
}
export function blankReference() {
  return { id: `ref${Date.now()}${Math.random().toString(36).slice(2, 6)}`, name: '', product: '', knownPrice: '', source: '' };
}

// --- Simple (non-repeatable) sections, config-driven for shared rendering.
export const DELIVERY_TYPES = ['Individual', 'Grupo', 'Presencial', 'Online', 'Híbrida', 'Produto físico', 'Produto digital', 'Outro'];
export const PAYMENT_METHODS_OFFER = ['À vista', 'Parcelado', 'Recorrente', 'Entrada + saldo', 'Outro'];
export const FIXED_COST_CATEGORIES = [
  'Aluguel ou espaço', 'Equipe, assistentes e prestadores recorrentes', 'Softwares e plataformas', 'Contabilidade',
  'Marketing e anúncios', 'Telefone e internet', 'Energia e estrutura', 'Seguros', 'Mensalidades profissionais', 'Outros custos fixos',
];
export const VARIABLE_COST_CATEGORIES = [
  'Impostos', 'Taxas de cartão', 'Comissões', 'Materiais e insumos', 'Embalagem', 'Entrega ou frete',
  'Deslocamento', 'Terceirização por serviço', 'Outros custos variáveis',
];
export const VARIABLE_COST_CALC_TYPES = ['fixed_per_sale', 'percentage', 'monthly_estimate'];
export const VARIABLE_COST_CALC_TYPE_LABEL = {
  fixed_per_sale: 'Valor fixo por venda', percentage: 'Percentual da venda', monthly_estimate: 'Estimativa mensal',
};

export const SECTIONS = [
  {
    key: 's1', num: 1, title: 'Seu negócio hoje', heading: 'Vamos entender seu momento atual',
    fields: [
      { key: 'profession', label: 'Qual é a sua profissão?', type: 'text', required: true },
      { key: 'specialty', label: 'Qual é a sua principal especialidade?', type: 'text', required: true },
      { key: 'region', label: 'Em qual cidade ou região você atua?', type: 'text', required: true },
      { key: 'serviceMode', label: 'Seu atendimento é:', type: 'select', options: ['Presencial', 'Online', 'Híbrido', 'Outro'], required: true },
      {
        key: 'businessModel', label: 'Como você descreveria seu modelo de negócio?', type: 'select', required: true,
        options: ['Serviços individuais', 'Serviços em grupo', 'Projetos', 'Produtos físicos', 'Produtos digitais', 'Assinatura ou recorrência', 'Combinação de modelos', 'Outro'],
      },
      { key: 'businessModelOther', label: 'Qual?', type: 'text', condition: (a) => a.s1.businessModel === 'Outro' },
      { key: 'primaryOfferName', label: 'Qual produto ou serviço você gostaria de analisar primeiro?', type: 'text', required: true },
      { key: 'primaryOfferDescription', label: 'Descreva brevemente esse produto ou serviço.', type: 'textarea' },
      { key: 'targetAudience', label: 'Para quem ele é vendido?', type: 'textarea', required: true },
      {
        key: 'salesChannels', label: 'Como você vende atualmente?', type: 'multiselect', required: true,
        options: ['Indicações', 'WhatsApp', 'Instagram', 'Site', 'Equipe comercial', 'Anúncios', 'Parcerias', 'Eventos', 'Outro'],
      },
      { key: 'salesChannelsOther', label: 'Qual outro canal?', type: 'text', condition: (a) => (a.s1.salesChannels || []).includes('Outro') },
      { key: 'mainProblem', label: 'Qual é o principal problema financeiro ou comercial que você percebe hoje?', type: 'textarea', required: true },
      { key: 'desiredOutcome', label: 'Qual resultado você espera alcançar com esta análise?', type: 'textarea', required: true },
    ],
  },
  {
    key: 's2', num: 2, title: 'Oferta e preço atual', heading: 'Como sua oferta funciona hoje?',
    repeatable: 'offers',
    fields: [
      { key: 'monthlyRevenue', label: 'Qual é seu faturamento mensal médio atualmente?', type: 'currency', required: true, allowUnknown: true },
      { key: 'monthlyRevenuePrecision', label: 'Esse valor é:', type: 'select', options: ['Exato', 'Aproximado', 'Não sei informar'], required: true },
      { key: 'monthlyClients', label: 'Quantas vendas ou clientes você atende em um mês comum?', type: 'number', allowUnknown: true },
      {
        key: 'capacityUtilization', label: 'Sua agenda ou capacidade costuma ficar:', type: 'select',
        options: ['Até 25% ocupada', 'Entre 26% e 50%', 'Entre 51% e 75%', 'Entre 76% e 90%', 'Acima de 90%', 'Não sei'],
      },
    ],
  },
  {
    key: 's3', num: 3, title: 'Custos da operação', heading: 'Quanto custa manter seu negócio funcionando?',
    repeatable: 'costs',
    fields: [
      { key: 'separatesFinances', label: 'Você separa as finanças pessoais e empresariais?', type: 'select', options: ['Sim', 'Não', 'Em parte'] },
      { key: 'tracksMonthly', label: 'Você acompanha seus custos todos os meses?', type: 'select', options: ['Sim', 'Não', 'Às vezes'] },
      { key: 'variableCostNotes', label: 'Existe algum custo importante que varia muito?', type: 'textarea' },
      { key: 'seasonalNotes', label: 'Há despesas sazonais que devemos considerar?', type: 'textarea' },
    ],
  },
  {
    key: 's4', num: 4, title: 'Tempo e capacidade', heading: 'Quanto você realmente consegue entregar?',
    intro: 'Capacidade não é quanto você gostaria de vender. É quanto consegue entregar com qualidade dentro da sua rotina atual.',
    fields: [
      { key: 'desiredWeeklyHours', label: 'Quantas horas por semana você deseja dedicar ao negócio?', type: 'number', required: true },
      { key: 'adminHours', label: 'Quantas horas por semana utiliza com administração?', type: 'number' },
      { key: 'salesHours', label: 'Quantas horas por semana utiliza com vendas e atendimento comercial?', type: 'number' },
      { key: 'marketingHours', label: 'Quantas horas por semana utiliza com produção de conteúdo ou marketing?', type: 'number' },
      { key: 'planningHours', label: 'Quantas horas por semana utiliza com estudo, planejamento ou gestão?', type: 'number' },
      { key: 'workDaysPerWeek', label: 'Quantos dias por semana você trabalha?', type: 'number', required: true },
      {
        key: 'workloadPreference', label: 'Você deseja manter essa carga de trabalho?', type: 'select',
        options: ['Sim', 'Gostaria de trabalhar menos', 'Poderia trabalhar mais temporariamente', 'Não sei'],
      },
      { key: 'deliverableVolumeCapacity', label: 'Quantos atendimentos, projetos ou entregas você consegue realizar por mês com qualidade?', type: 'number', required: true },
      { key: 'maxVolumeAchieved', label: 'Qual foi o maior volume que você já conseguiu entregar em um mês?', type: 'number' },
      { key: 'wasSustainable', label: 'Esse volume foi sustentável?', type: 'select', options: ['Sim', 'Não', 'Em parte'], condition: (a) => !!a.s4.maxVolumeAchieved },
      {
        key: 'capacityLimiters', label: 'O que limita sua capacidade atualmente?', type: 'multiselect',
        options: ['Tempo', 'Agenda', 'Equipe', 'Espaço físico', 'Produção', 'Energia pessoal', 'Demanda insuficiente', 'Processo comercial', 'Outro'],
      },
      { key: 'capacityLimitersOther', label: 'Qual outro fator?', type: 'text', condition: (a) => (a.s4.capacityLimiters || []).includes('Outro') },
      { key: 'demandDoubleScenario', label: 'Se a demanda dobrasse no próximo mês, o que aconteceria?', type: 'textarea' },
      { key: 'capacityIncreaseIdeas', label: 'O que poderia aumentar sua capacidade sem comprometer a qualidade?', type: 'textarea' },
    ],
  },
  {
    key: 's5', num: 5, title: 'Metas e remuneração', heading: 'Que resultado o negócio precisa gerar?',
    fields: [
      { key: 'desiredMonthlyRevenue', label: 'Qual faturamento mensal você deseja alcançar?', type: 'currency', required: true },
      { key: 'desiredRevenueTimeframe', label: 'Em quanto tempo deseja chegar a essa meta?', type: 'text' },
      { key: 'desiredProLabore', label: 'Qual valor mensal gostaria de retirar como pró-labore ou remuneração?', type: 'currency', required: true },
      { key: 'minPersonalExpenses', label: 'Quanto precisa retirar no mínimo para suas despesas pessoais?', type: 'currency' },
      { key: 'reserveEmergency', label: 'Reserva mensal — Emergências', type: 'currency' },
      { key: 'reserveReinvestment', label: 'Reserva mensal — Reinvestimento', type: 'currency' },
      { key: 'reserveGrowth', label: 'Reserva mensal — Crescimento', type: 'currency' },
      { key: 'reserveVacation', label: 'Reserva mensal — Férias e períodos de menor faturamento', type: 'currency' },
      { key: 'reserveOther', label: 'Reserva mensal — Outro', type: 'currency' },
      { key: 'businessDebt', label: 'Existe alguma dívida ou compromisso financeiro empresarial que precisa ser considerado?', type: 'textarea' },
      { key: 'expansionGoal', label: 'Existe uma meta de contratação, expansão ou investimento?', type: 'textarea' },
      { key: 'safetyMargin', label: 'Qual margem de segurança faria você se sentir confortável?', type: 'percent' },
      { key: 'canCoverCostsToday', label: 'Hoje, o negócio consegue pagar todos os custos e sua remuneração?', type: 'select', options: ['Sim', 'Parcialmente', 'Não', 'Não sei'], required: true },
      {
        key: 'currentPriority', label: 'Sua prioridade atual é:', type: 'select', required: true,
        options: ['Aumentar faturamento', 'Aumentar margem', 'Trabalhar menos', 'Aumentar volume', 'Elevar posicionamento', 'Criar recorrência', 'Reestruturar a oferta', 'Outra'],
      },
    ],
  },
  {
    key: 's6', num: 6, title: 'Mercado, posicionamento e percepção de valor', heading: 'Como o mercado percebe sua oferta?',
    fields: [
      { key: 'experienceLevel', label: 'Como você descreveria seu nível de experiência?', type: 'select', options: ['Iniciante', 'Intermediária', 'Experiente', 'Referência no mercado'] },
      { key: 'yearsInField', label: 'Há quanto tempo atua nessa área?', type: 'text', required: true },
      { key: 'qualifications', label: 'Quais formações, especializações ou experiências fortalecem sua oferta?', type: 'textarea' },
      { key: 'differentiator', label: 'O que diferencia seu trabalho?', type: 'textarea', required: true },
      { key: 'whyBestClientsChoose', label: 'Por que seus melhores clientes escolhem você?', type: 'textarea' },
      { key: 'transformationDelivered', label: 'Qual transformação ou resultado você entrega?', type: 'textarea', required: true },
      { key: 'extrasIncluded', label: 'O que está incluído na experiência além do serviço principal?', type: 'textarea' },
      { key: 'commonObjections', label: 'Quais são as objeções mais comuns antes da compra?', type: 'textarea' },
      { key: 'priceQuestioned', label: 'Os clientes costumam questionar seu preço?', type: 'select', options: ['Frequentemente', 'Às vezes', 'Raramente', 'Nunca'] },
      { key: 'lossReason', label: 'Quando uma venda não acontece, qual costuma ser o motivo?', type: 'textarea' },
      { key: 'referencesIntro', label: 'Quem você considera uma referência ou concorrente?', type: 'textarea' },
      { key: 'knowsReferencePrices', label: 'Você conhece os preços praticados por essas referências?', type: 'select', options: ['Sim', 'Não', 'Em parte'], insertReferencesAfter: true },
      { key: 'desiredPerception', label: 'Como você gostaria que sua marca fosse percebida?', type: 'textarea' },
      { key: 'priceMatchesPositioning', label: 'Seu preço atual combina com esse posicionamento?', type: 'select', options: ['Sim', 'Não', 'Em parte'] },
      { key: 'priceMatchesPositioningWhy', label: 'Por quê?', type: 'textarea' },
      {
        key: 'demandLevel', label: 'Como está a procura pelo seu trabalho?', type: 'select',
        options: ['Muito abaixo da capacidade', 'Abaixo da capacidade', 'Próxima da capacidade', 'Acima da capacidade', 'Não sei'],
      },
      { key: 'waitlistExists', label: 'Existem clientes esperando vaga?', type: 'select', options: ['Sim', 'Não'] },
      { key: 'lostSalesDueToCapacity', label: 'Você já perdeu vendas por não conseguir atender?', type: 'select', options: ['Sim', 'Não', 'Não sei'] },
      { key: 'believesCouldSustainHigherPrice', label: 'Você acredita que poderia sustentar um preço maior hoje?', type: 'select', options: ['Sim', 'Não', 'Talvez'] },
      { key: 'priceIncreaseDoubts', label: 'O que faz você ter dúvida ou insegurança sobre aumentar o preço?', type: 'textarea' },
    ],
  },
];

export const OFFER_FIELDS = [
  { key: 'name', label: 'Nome do produto ou serviço', type: 'text', required: true },
  { key: 'currentPrice', label: 'Preço atual', type: 'currency', required: true },
  { key: 'deliveryType', label: 'Forma de entrega', type: 'select', options: DELIVERY_TYPES, required: true },
  { key: 'deliveryTypeOther', label: 'Qual?', type: 'text', condition: (o) => o.deliveryType === 'Outro' },
  { key: 'deliveryMinutes', label: 'Minutos dedicados por venda/sessão/projeto', type: 'number', required: true },
  { key: 'requiresPostWork', label: 'Exige preparação ou trabalho depois da entrega?', type: 'select', options: ['Sim', 'Não'] },
  { key: 'postWorkHours', label: 'Quantas horas adicionais são necessárias?', type: 'number', condition: (o) => o.requiresPostWork === 'Sim' },
  { key: 'avgMonthlySales', label: 'Quantas unidades você vende, em média, por mês?', type: 'number', required: true },
  { key: 'hasCapacityLimit', label: 'Existe limite de vagas ou capacidade?', type: 'select', options: ['Sim', 'Não'] },
  { key: 'capacityLimit', label: 'Qual o limite?', type: 'number', condition: (o) => o.hasCapacityLimit === 'Sim' },
  { key: 'paymentMethod', label: 'Forma de pagamento', type: 'select', options: PAYMENT_METHODS_OFFER },
  { key: 'paymentMethodOther', label: 'Qual?', type: 'text', condition: (o) => o.paymentMethod === 'Outro' },
  { key: 'installments', label: 'Em quantas parcelas você oferece?', type: 'number', condition: (o) => o.paymentMethod === 'Parcelado' || o.paymentMethod === 'Entrada + saldo' },
  { key: 'offersDiscount', label: 'Você oferece descontos? Em quais situações?', type: 'text' },
  { key: 'paysCommission', label: 'Você paga comissão sobre essa venda?', type: 'text' },
  { key: 'directCostPerSale', label: 'Custo direto por venda (materiais, taxas, terceiros)', type: 'currency' },
  { key: 'priceAssessment', label: 'Você considera esse preço:', type: 'select', options: ['Muito baixo', 'Um pouco baixo', 'Adequado', 'Um pouco alto', 'Não sei avaliar'] },
  { key: 'priceLastChangedAt', label: 'Quando esse preço foi alterado pela última vez?', type: 'text' },
  { key: 'priceChangeReason', label: 'O que motivou a última alteração?', type: 'text' },
];

export const FIXED_COST_FIELDS = [
  { key: 'description', label: 'Descrição', type: 'text', required: true },
  { key: 'monthlyAmount', label: 'Valor mensal', type: 'currency', required: true },
];
export const VARIABLE_COST_FIELDS = [
  { key: 'description', label: 'Descrição', type: 'text' },
  { key: 'calculationType', label: 'Como calcular', type: 'select', options: VARIABLE_COST_CALC_TYPES, optionLabels: VARIABLE_COST_CALC_TYPE_LABEL },
  { key: 'amount', label: 'Valor por venda', type: 'currency', condition: (c) => c.calculationType === 'fixed_per_sale' },
  { key: 'percentage', label: 'Percentual da venda', type: 'percent', condition: (c) => c.calculationType === 'percentage' },
  { key: 'amount', label: 'Estimativa mensal', type: 'currency', condition: (c) => c.calculationType === 'monthly_estimate' },
];
export const REFERENCE_FIELDS = [
  { key: 'name', label: 'Nome', type: 'text' },
  { key: 'product', label: 'Produto/serviço semelhante', type: 'text' },
  { key: 'knownPrice', label: 'Preço conhecido', type: 'text' },
  { key: 'source', label: 'Fonte ou observação', type: 'text' },
];

// --- Formatting ------------------------------------------------------------
export function fmtBRL(v) {
  if (v === null || v === undefined || v === '') return '—';
  const n = Number(v);
  if (Number.isNaN(n)) return '—';
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
export function fmtPct(v) {
  if (v === null || v === undefined || v === '') return '—';
  const n = Number(v);
  if (Number.isNaN(n)) return '—';
  return `${n.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
}
function num(v) { const n = Number(v); return Number.isFinite(n) ? n : 0; }

// --- Calculation engine -----------------------------------------------------
// Every function here returns { value, formula, assumptions[] } so Nay's
// workspace can show exactly how a number was produced — "auditable
// calculations", per spec, not a black box.

export function calcFixedCostsTotal(fixedCosts = []) {
  const total = fixedCosts.reduce((sum, c) => sum + num(c.monthlyAmount), 0);
  return {
    value: total,
    formula: 'Soma de todos os custos fixos mensais informados.',
    assumptions: fixedCosts.filter((c) => c.isEstimate).map((c) => `"${c.description || c.category}" é uma estimativa.`),
  };
}

// Variable costs mix percentage-of-sale, fixed-per-sale and flat monthly
// estimates — normalized against monthly revenue so they can be summed
// without the client having to convert formats by hand.
export function calcVariableCostsSummary(variableCosts = [], monthlyRevenue) {
  const revenue = num(monthlyRevenue);
  let monthlyTotal = 0;
  let pctOfRevenue = 0;
  const assumptions = [];
  variableCosts.forEach((c) => {
    if (c.calculationType === 'monthly_estimate') {
      monthlyTotal += num(c.amount);
    } else if (c.calculationType === 'percentage') {
      const pct = Math.min(num(c.percentage), 100);
      pctOfRevenue += pct;
      monthlyTotal += revenue * (pct / 100);
      if (!revenue) assumptions.push(`"${c.description || c.category}" é um percentual, mas não há faturamento informado para convertê-lo — tratado como R$ 0 até que haja um valor.`);
    } else if (c.calculationType === 'fixed_per_sale') {
      assumptions.push(`"${c.description || c.category}" é por venda — considerado apenas dentro do cálculo por oferta, não somado aqui diretamente.`);
    }
    if (c.isEstimate) assumptions.push(`"${c.description || c.category}" é uma estimativa.`);
  });
  return {
    value: monthlyTotal, pctOfRevenue,
    formula: 'Estimativas mensais + (percentuais × faturamento mensal informado). Custos "por venda" entram no cálculo de cada oferta.',
    assumptions,
  };
}

// Capacity — hours actually available for delivery after admin/sales/
// marketing/planning are subtracted from the hours the client wants to work.
export function calcCapacity(s4 = {}) {
  const weekly = num(s4.desiredWeeklyHours);
  const nonDelivery = num(s4.adminHours) + num(s4.salesHours) + num(s4.marketingHours) + num(s4.planningHours);
  const deliveryHoursWeekly = Math.max(weekly - nonDelivery, 0);
  const deliveryHoursMonthly = deliveryHoursWeekly * 4.33;
  return {
    weeklyWorkingHours: weekly,
    nonDeliveryHoursWeekly: nonDelivery,
    deliveryHoursWeekly, deliveryHoursMonthly,
    formula: 'Horas de entrega/semana = horas semanais desejadas − (admin + vendas + marketing + planejamento). Horas de entrega/mês = horas de entrega/semana × 4,33.',
    assumptions: weekly < nonDelivery ? ['As horas não-comerciais informadas somam mais do que a carga semanal desejada — capacidade de entrega tratada como zero até revisão.'] : [],
  };
}

// Realistic maximum sales capacity per offer, from delivery time — kept
// per-offer (not one blended number) when there are several offers with
// different delivery times, per spec's explicit warning against that shortcut.
export function calcOfferCapacity(offer, capacity) {
  const minutesPerSale = num(offer.deliveryMinutes) + num(offer.postWorkHours) * 60;
  const monthlyMinutesAvailable = capacity.deliveryHoursMonthly * 60;
  const maxSalesByTime = minutesPerSale > 0 ? Math.floor(monthlyMinutesAvailable / minutesPerSale) : null;
  const hardLimit = offer.hasCapacityLimit === 'Sim' ? num(offer.capacityLimit) : null;
  const realisticMax = [maxSalesByTime, hardLimit].filter((v) => v !== null && v !== undefined).reduce((a, b) => Math.min(a, b), Infinity);
  return {
    minutesPerSale, monthlyMinutesAvailable,
    maxSalesByTime, hardLimit,
    realisticMax: Number.isFinite(realisticMax) ? realisticMax : null,
    formula: 'Capacidade máx. por tempo = horas de entrega disponíveis/mês ÷ minutos por venda (entrega + pós-entrega). Capacidade realista = mínimo entre isso e o limite de vagas informado.',
  };
}

// Monthly operating requirement — what the business needs to bill just to
// cover fixed costs + desired pró-labore + reserves + debt, grossed up for
// variable-cost percentage and taxes so it's a real "needs to invoice"
// number, not a naive sum. Percentages ≥100% are clamped to avoid dividing
// by zero/negative.
export function calcOperatingRequirement({ fixedCostsTotal, desiredProLabore, reserves, debt, variableCostPct, taxPct, revenueTarget }) {
  const baseNeed = num(fixedCostsTotal) + num(desiredProLabore) + num(reserves) + num(debt);
  const combinedPct = Math.min(num(variableCostPct) + num(taxPct), 95); // clamp: never let the divisor hit/cross zero
  const grossed = combinedPct > 0 ? baseNeed / (1 - combinedPct / 100) : baseNeed;
  return {
    baseNeed, combinedPct, grossedUpRequirement: grossed,
    revenueTarget: revenueTarget ? num(revenueTarget) : null,
    formula: 'Necessidade base = custos fixos + pró-labore desejado + reservas + dívidas. Necessidade bruta = necessidade base ÷ (1 − (% custos variáveis + % impostos)/100), limitado a 95% para evitar divisão por zero/negativo.',
    assumptions: (num(variableCostPct) + num(taxPct)) >= 95 ? ['Percentual de custos variáveis + impostos informado ultrapassa 95% — usado 95% como teto de segurança no cálculo.'] : [],
  };
}

export function calcPricingIndicators(offer, offerCapacity, operatingRequirementValue) {
  const currentPrice = num(offer.currentPrice);
  const directCost = num(offer.directCostPerSale);
  const contribution = currentPrice - directCost;
  const currentRealisticRevenue = offerCapacity.realisticMax !== null ? currentPrice * offerCapacity.realisticMax : null;
  const gapToTarget = currentRealisticRevenue !== null && operatingRequirementValue !== null
    ? operatingRequirementValue - currentRealisticRevenue : null;
  const mathematicalMinimum = offerCapacity.realisticMax ? operatingRequirementValue / offerCapacity.realisticMax : null;
  return {
    currentPrice, contribution, currentRealisticRevenue, gapToTarget, mathematicalMinimum,
    formula: 'Contribuição atual = preço − custo direto. Receita na capacidade realista = preço atual × capacidade realista. Preço mínimo matemático = necessidade operacional bruta ÷ capacidade realista de vendas.',
  };
}

export function projectScenario({ price, monthlyVolume, variableCostPct, directCostPerSale }) {
  const revenue = num(price) * num(monthlyVolume);
  const variableCost = revenue * (Math.min(num(variableCostPct), 100) / 100) + num(directCostPerSale) * num(monthlyVolume);
  const result = revenue - variableCost;
  return { revenue, variableCost, result };
}
