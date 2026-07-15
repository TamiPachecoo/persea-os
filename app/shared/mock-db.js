// Mock data layer — stands in for agency-framework/*-engine/api.js + Supabase.
// Same shape/intent as the real engines: screens only ever call functions here,
// never touch storage directly. Swapping to Supabase later = rewriting this
// file's internals; screens stay untouched.
//
// Keyed by clientId throughout (client_id is a real FK in the schema — see
// docs/02-database-schema.md) so the admin side can hold several clients at
// once, each progressing through the journey independently.

const STORAGE_KEY = 'persea_mock_db_v7';
export const DEFAULT_CLIENT_ID = 'client-1';

// Mentoring program phases per tier — tenant-level config (persea/methodology/
// in the real build), not per-client. A client's progress is just an index
// into their tier's phase list.
export const TIER_PHASES = {
  premium: ['Identidade', 'Imagem', 'Comportamento', 'Visibilidade'],
  essential: ['Identidade', 'Imagem', 'Visibilidade'],
};

const SEED = {
  tenant: {
    name: 'PERSEA',
    brandColor: '#b8863a',
  },
  clients: {
    // --- Client 1: Marina — farthest along, playbook published, pitches ready ---
    'client-1': {
      profile: { id: 'client-1', fullName: 'Marina Alves', email: 'marina@example.com', status: 'active', tier: 'premium', phaseIndex: 1 },
      journey: {
        programName: 'Identidade',
        steps: [
          { key: 'questionnaire', title: 'Questionário de Identidade', status: 'completed' },
          { key: 'meeting_1', title: 'Reunião 1', status: 'completed' },
          { key: 'playbook_review', title: 'Playbook de Marca Pessoal', status: 'completed' },
          { key: 'assessment', title: 'Teste de Arquétipo', status: 'available' },
          { key: 'pitch', title: 'Gerador de Pitch', status: 'completed' },
          { key: 'homework', title: 'Tarefas', status: 'in_progress' },
        ],
        upcomingMeeting: { title: 'Reunião 2 — Aprofundamento de Posicionamento', date: '2026-07-22T15:00:00' },
      },
      questionnaire: {
        title: 'Questionário de Identidade',
        questions: [
          { id: 'q1', text: 'Pelo que você quer ser conhecida daqui a 3 anos?', type: 'long_text', answer: 'Ser a estrategista de referência para marcas pessoais premium na América Latina.' },
          { id: 'q2', text: 'O que parece mais verdadeiro sobre quem você é agora?', type: 'long_text', answer: 'Precisa, calorosa e alérgica a enrolação.' },
          { id: 'q3', text: 'Qual é a transformação que você ajuda as pessoas a fazerem?', type: 'long_text', answer: 'De especialista invisível a autoridade reconhecida.' },
          { id: 'q4', text: 'Avalie sua confiança atual na sua marca pessoal (1-10)', type: 'scale', answer: '5' },
        ],
        status: 'submitted',
      },
      questionnaireAnalysis: {
        version: 1,
        generatedAt: '2026-07-01T10:00:00',
        executiveSummary: 'Marina é uma profissional de alta competência cujo posicionamento externo ainda não acompanhou sua real expertise. Ela subestima sua autoridade por escrito, mas entrega além na prática.',
        strengths: ['Credibilidade técnica profunda', 'Ponto de vista claro quando provocada', 'Forte empatia com clientes'],
        goals: ['Ser reconhecida como autoridade de categoria, não generalista', 'Elevar o valor cobrado por meio de posicionamento percebido'],
        painPoints: ['Descreve-se com linguagem vaga e segura', 'Sem narrativa consistente entre plataformas'],
        opportunities: ['Um pilar de conteúdo com ponto de vista afiado', 'Uma metodologia própria que já usa informalmente'],
        suggestedQuestions: ['O que você parou de explicar porque acha que as pessoas "já deveriam entender"?', 'Quem você secretamente acha que faz isso pior do que você?'],
        businessMaturity: 'Profissional estabelecida, pré-marca — entrega forte, narrativa fraca.',
      },
      meeting: { title: 'Reunião 1', transcriptUploaded: true, status: 'analyzed' },
      transcriptAnalysis: {
        version: 1,
        summary: 'Marina descreveu um padrão de conquistar clientes por indicação, mas com dificuldade de converter públicos frios — o que remete a uma autodescrição genérica.',
        goals: ['Conseguir 3 palestras este ano', 'Aumentar os valores em 30% sem perder conversão'],
        challenges: ['Sensação de impostora ao "escolher um nicho"', 'Medo de afastar clientes antigos ao se especializar'],
        actionItems: ['Redigir uma declaração de posicionamento clara', 'Auditar os últimos 10 conteúdos quanto à consistência'],
        homework: ['Ler o Playbook v1', 'Gravar o pitch de 30 segundos em áudio ou vídeo', 'Responder às perguntas de reflexão'],
        keyInsights: ['O rótulo de "generalista" é um comportamento de segurança, não uma escolha estratégica.'],
      },
      playbook: {
        versions: [
          {
            version: 1,
            status: 'published',
            createdAt: '2026-07-05T09:00:00',
            publishedAt: '2026-07-06T11:00:00',
            sections: {
              identity: 'Uma estrategista de marca focada em precisão, que transforma expertise silenciosa em autoridade visível.',
              mission: 'Ajudar especialistas de alto nível a pararem de se subestimar em público.',
              vision: 'Um mundo onde competência e percepção nunca estão desalinhadas.',
              core_story: 'Começou como a pessoa a quem os clientes recorriam depois que o primeiro consultor falhava — percebeu que a lacuna nunca foi de habilidade, e sim de narrativa.',
              golden_circle: 'Por quê: o desalinhamento entre competência e percepção é um problema solucionável. Como: posicionamento de precisão + narrativa confiante. O quê: estratégia de marca para especialistas.',
              target_audience: 'Consultores e coaches estabelecidos, com forte entrega mas narrativa pública fraca.',
              value_proposition: 'Tornamos seu posicionamento tão afiado quanto sua real expertise.',
              positioning: 'A estrategista para especialistas cansados de soar como todo mundo.',
              brand_voice: 'Precisa, calorosa, sem enrolação, discretamente confiante.',
              communication_style: 'Direto, frases curtas, exemplos concretos em vez de abstrações.',
              goals: 'Conquistar 3 palestras. Aumentar os valores em 30%. Construir uma metodologia própria.',
              pitch_30s: 'Ajudo especialistas de alto nível a transformarem sua expertise silenciosa em uma marca que as pessoas realmente notam — sem soar como todo mundo na categoria.',
              action_plan: '1) Publicar a declaração de posicionamento. 2) Reconstruir a bio em todas as plataformas. 3) Buscar 3 oportunidades de palestra neste trimestre.',
            },
          },
        ],
      },
      assessment: {
        title: 'Teste de Arquétipo',
        description: 'Uma breve avaliação externa para identificar seu arquétipo de marca dominante.',
        externalUrl: 'https://example.com/archetype-test',
        status: 'not_started',
      },
      pitches: {
        version: 1,
        pitch_10s: 'Transformo especialistas invisíveis em autoridades reconhecidas.',
        pitch_30s: 'Ajudo especialistas de alto nível a transformarem sua expertise silenciosa em uma marca que as pessoas realmente notam — sem soar como todo mundo na categoria.',
        pitch_60s: 'A maioria dos especialistas que conheço é melhor do que sua reputação sugere. Eu ajudo a fechar essa lacuna — afiando o posicionamento, a história e o discurso — para que a percepção finalmente corresponda ao nível em que realmente atuam.',
        pitch_networking: 'Trabalho com especialistas que são ótimos no que fazem, mas esquecíveis em como se descrevem — eu resolvo a parte da descrição.',
        instagram_bio: 'Estrategista de marca para especialistas ✨ Transformando expertise silenciosa em autoridade visível.',
        linkedin_summary: 'Ajudo consultores e coaches estabelecidos a fecharem a lacuna entre sua real expertise e como são percebidos — com posicionamento mais afiado, uma história mais clara e um discurso que realmente convence.',
      },
      homework: [
        { id: 'h1', title: 'Ler o Playbook', type: 'boolean', status: 'completed' },
        { id: 'h2', title: 'Gravação do Pitch (áudio ou vídeo)', type: 'media_upload', status: 'completed', submissions: [
          { id: 'm1', kind: 'audio', name: 'pitch-treino-1.mp3', url: null, uploadedAt: '2026-07-07T10:00:00' },
        ] },
        { id: 'h3', title: 'Perguntas de Reflexão', type: 'text_submission', status: 'pending', submission: '' },
      ],
      activity: [
        { type: 'pitches_generated', text: 'Variações de pitch geradas', at: '2026-07-08T14:20:00' },
        { type: 'playbook_published', text: 'Playbook v1 publicado', at: '2026-07-06T11:00:00' },
        { type: 'playbook_draft_created', text: 'Rascunho do Playbook v1 gerado', at: '2026-07-05T09:00:00' },
        { type: 'meeting_analyzed', text: 'Transcrição da Reunião 1 analisada', at: '2026-07-04T16:10:00' },
        { type: 'questionnaire_submitted', text: 'Questionário de Identidade concluído', at: '2026-07-01T09:40:00' },
      ],
      playbookExperience: { format: 'podcast', completedAt: '2026-07-06T19:30:00' },
      quiz: { score: 4, total: 4, completedAt: '2026-07-06T19:45:00' },
      meetingRequests: [
        { id: 'mr1', reason: 'Tenho dúvida sobre como aplicar a Voz da Marca nas redes sociais.', status: 'assigned', assignedTo: 'nay', createdAt: '2026-07-09T10:00:00' },
      ],
      notes: 'Lembrar de perguntar sobre precificação na próxima reunião.',
      moodLog: [
        { context: 'questionnaire_submitted', mood: 4, at: '2026-07-01T09:41:00' },
        { context: 'playbook_experience', mood: 5, at: '2026-07-06T19:31:00' },
        { context: 'quiz_completed', mood: 5, at: '2026-07-06T19:46:00' },
      ],
      book: {
        title: 'Guia Imagético',
        subtitle: 'Mentoria PERSEA',
        author: 'NAY MURTA | FATOR N',
        coverImage: '../shared/assets/nay-cover.jpg',
        epigraph: {
          text: 'Porque ser admirável nunca é por acaso. É construção.',
          cite: 'Nay Murta — Mentoria PERSEA',
        },
        chapters: [
          {
            key: 'registro',
            number: 1,
            title: 'Registro Imagético Diário',
            eyebrow: 'Envio via WhatsApp',
            paragraphs: [
              'Para iniciarmos uma construção estratégica, funcional e inteligente, precisamos entender seu ponto de partida.',
              'Durante 10 dias, registre suas produções (ou faça simulações) e, junto à foto, conte para onde ia, como se sentiu ao se olhar no espelho e se foi fácil ou difícil escolher a roupa.',
              'Esse será o nosso raio-x inicial para criarmos juntas uma imagem que traduza sua essência e eleve sua percepção de valor.',
            ],
          },
          {
            key: 'sou-nunca-gostaria',
            number: 2,
            title: 'Sou, Nunca e Gostaria',
            eyebrow: 'Envio via WhatsApp',
            paragraphs: [
              'Selecione e envie referências visuais que representem:',
            ],
            list: [
              'Como eu sou e me visto hoje: escolha 5 imagens que traduzam a comunicação atual. Importante: olhe de fora, como se estivesse descrevendo outra pessoa. Não envie fotos suas.',
              'Como eu gostaria de ser: escolha 5 imagens que representem a mudança que você deseja alcançar.',
              'Como eu nunca seria: escolha 5 imagens que mostrem o que não tem nada a ver com você ou que jamais usaria.',
            ],
          },
          {
            key: 'estrutura-corporal',
            number: 3,
            title: 'Estrutura Corporal',
            eyebrow: 'Nem tudo que gostamos nos veste bem',
            paragraphs: [
              'Envie fotos de frente, costas e perfis, em postura ereta, usando lingerie ou biquíni, para validação da sua morfologia corporal.',
              'Peça para outra pessoa fazer o registro, com o celular na horizontal, na altura da linha do corpo, evitando ângulos inclinados (de cima para baixo ou de baixo para cima).',
            ],
          },
          {
            key: 'analise-facial',
            number: 4,
            title: 'Análise Facial',
            eyebrow: 'Visagismo e coloração pessoal',
            paragraphs: [
              'A seguir, as orientações detalhadas para o envio das fotos do seu rosto, que serão utilizadas como base para o seu projeto visagista e para a análise de coloração pessoal.',
              '4.1 — Visagismo: precisaremos de três fotos suas, todas feitas com a câmera traseira, em posição frontal, como uma foto 3x4 — cabelos soltos para frente dos ombros, cabelos soltos para trás dos ombros, e cabelos presos. As fotos devem ser novas, com boa distância da câmera, cabelo bem penteado e partido ao meio (de preferência), usando top ou blusa branca de alça/manga, encostada em uma parede clara.',
              'Como tirar as fotos: esteja sem maquiagem e sem acessórios; iluminação natural, feita durante o dia, evitando luz direta do sol e sem flash; peça para outra pessoa tirar a foto com a câmera traseira, a 1,5m de distância; confira se as duas orelhas estão visíveis na foto de frente.',
              '4.2 — Coloração Pessoal: a foto deve ser tirada bem de frente, com proximidade do rosto e colo totalmente à mostra, em ambiente iluminado naturalmente, numa janela sem entrada direta de sol, entre 11h e 14h, com o rosto completamente limpo, sem produto, maquiagem ou acessórios.',
            ],
            list: [
              'Posicione-se de frente para a janela para que o rosto receba iluminação uniforme.',
              'Não fique de lado para a janela — isso deixa um lado do rosto iluminado e o outro sombreado.',
              'Não deixe a janela ao fundo — isso cria sombras no rosto.',
              'Posicione o celular na altura do pescoço, evitando deixá-lo muito acima ou abaixo da cabeça.',
            ],
          },
          {
            key: 'complementares',
            number: 5,
            title: 'Informações Complementares',
            eyebrow: 'Mapeamento facial',
            paragraphs: [
              'Um formulário exclusivo para o seu mapeamento facial estará disponível na plataforma assim que sua consultora liberar esta etapa.',
            ],
          },
        ],
        backMatter: { studio: 'PERSEA', handle: '@naymutra', email: 'naymurta@fatorn.com.br' },
      },
    },

    // --- Client 2: Júlia — just starting out, nothing analyzed yet ---
    'client-2': {
      profile: { id: 'client-2', fullName: 'Júlia Ferreira', email: 'julia@example.com', status: 'active', tier: 'essential', phaseIndex: 0 },
      journey: {
        programName: 'Identidade',
        steps: [
          { key: 'questionnaire', title: 'Questionário de Identidade', status: 'completed' },
          { key: 'meeting_1', title: 'Reunião 1', status: 'available' },
          { key: 'playbook_review', title: 'Playbook de Marca Pessoal', status: 'locked' },
          { key: 'assessment', title: 'Teste de Arquétipo', status: 'locked' },
          { key: 'pitch', title: 'Gerador de Pitch', status: 'locked' },
          { key: 'homework', title: 'Tarefas', status: 'locked' },
        ],
        upcomingMeeting: { title: 'Reunião 1 — Levantamento Inicial', date: '2026-07-18T10:00:00' },
      },
      questionnaire: {
        title: 'Questionário de Identidade',
        questions: [
          { id: 'q1', text: 'Pelo que você quer ser conhecida daqui a 3 anos?', type: 'long_text', answer: 'Ser vista como referência em finanças para mulheres autônomas.' },
          { id: 'q2', text: 'O que parece mais verdadeiro sobre quem você é agora?', type: 'long_text', answer: 'Organizada, didática, mas ainda insegura para aparecer.' },
          { id: 'q3', text: 'Qual é a transformação que você ajuda as pessoas a fazerem?', type: 'long_text', answer: 'De confusão financeira para clareza e controle.' },
          { id: 'q4', text: 'Avalie sua confiança atual na sua marca pessoal (1-10)', type: 'scale', answer: '3' },
        ],
        status: 'submitted',
      },
      questionnaireAnalysis: {
        version: 1,
        generatedAt: '2026-07-10T09:15:00',
        executiveSummary: 'Júlia tem clareza técnica mas evita visibilidade — o principal obstáculo é exposição, não competência.',
        strengths: ['Didática natural', 'Organização impecável de conteúdo', 'Empatia com o público iniciante'],
        goals: ['Perder o medo de aparecer', 'Construir autoridade em finanças pessoais'],
        painPoints: ['Evita gravar vídeos e fazer lives', 'Se compara constantemente a outras referências do nicho'],
        opportunities: ['Formato de conteúdo escrito como porta de entrada antes do vídeo', 'Comunidade de clientes como prova social'],
        suggestedQuestions: ['O que aconteceria se você postasse mesmo com medo?', 'Quem você imagina te vendo pela primeira vez?'],
        businessMaturity: 'Início de carreira como autoridade — competência real, visibilidade ainda não construída.',
      },
      meeting: { title: 'Reunião 1', transcriptUploaded: false, status: 'scheduled' },
      transcriptAnalysis: null,
      playbook: { versions: [] },
      assessment: {
        title: 'Teste de Arquétipo',
        description: 'Uma breve avaliação externa para identificar seu arquétipo de marca dominante.',
        externalUrl: 'https://example.com/archetype-test',
        status: 'not_started',
      },
      pitches: null,
      homework: [
        { id: 'h1', title: 'Ler o Playbook', type: 'boolean', status: 'pending' },
        { id: 'h2', title: 'Gravação do Pitch (áudio ou vídeo)', type: 'media_upload', status: 'pending', submissions: [] },
        { id: 'h3', title: 'Perguntas de Reflexão', type: 'text_submission', status: 'pending', submission: '' },
      ],
      activity: [
        { type: 'questionnaire_submitted', text: 'Questionário de Identidade concluído', at: '2026-07-10T09:00:00' },
      ],
      playbookExperience: { format: null, completedAt: null },
      quiz: { score: null, total: null, completedAt: null },
      meetingRequests: [
        { id: 'mr2', reason: 'Fiquei perdida em uma pergunta do questionário, queria confirmar se respondi certo.', status: 'pending', assignedTo: null, createdAt: '2026-07-11T14:00:00' },
      ],
      notes: '',
      moodLog: [
        { context: 'questionnaire_submitted', mood: 3, at: '2026-07-10T09:01:00' },
      ],
    },

    // --- Client 3: Renata — mid-journey, playbook drafted but not published ---
    'client-3': {
      profile: { id: 'client-3', fullName: 'Renata Costa', email: 'renata@example.com', status: 'active', tier: 'premium', phaseIndex: 0 },
      journey: {
        programName: 'Identidade',
        steps: [
          { key: 'questionnaire', title: 'Questionário de Identidade', status: 'completed' },
          { key: 'meeting_1', title: 'Reunião 1', status: 'completed' },
          { key: 'playbook_review', title: 'Playbook de Marca Pessoal', status: 'in_progress' },
          { key: 'assessment', title: 'Teste de Arquétipo', status: 'completed' },
          { key: 'pitch', title: 'Gerador de Pitch', status: 'locked' },
          { key: 'homework', title: 'Tarefas', status: 'in_progress' },
        ],
        upcomingMeeting: { title: 'Reunião 2 — Revisão de Playbook', date: '2026-07-20T13:30:00' },
      },
      questionnaire: {
        title: 'Questionário de Identidade',
        questions: [
          { id: 'q1', text: 'Pelo que você quer ser conhecida daqui a 3 anos?', type: 'long_text', answer: 'Pela consultora que resolve o "caos operacional" de pequenos negócios.' },
          { id: 'q2', text: 'O que parece mais verdadeiro sobre quem você é agora?', type: 'long_text', answer: 'Prática, direta, sem paciência para teoria sem aplicação.' },
          { id: 'q3', text: 'Qual é a transformação que você ajuda as pessoas a fazerem?', type: 'long_text', answer: 'De operação bagunçada para processo replicável.' },
          { id: 'q4', text: 'Avalie sua confiança atual na sua marca pessoal (1-10)', type: 'scale', answer: '6' },
        ],
        status: 'submitted',
      },
      questionnaireAnalysis: {
        version: 1,
        generatedAt: '2026-06-28T11:00:00',
        executiveSummary: 'Renata já entrega resultado operacional forte, mas se posiciona como "faz-tudo" — o que dilui o valor percebido do seu trabalho mais estratégico.',
        strengths: ['Execução comprovada', 'Linguagem direta e confiável', 'Cases fortes de antes/depois'],
        goals: ['Ser vista como estrategista, não só executora', 'Cobrar por diagnóstico, não só por implementação'],
        painPoints: ['Aceita qualquer tipo de projeto', 'Portfólio comunica serviço, não transformação'],
        opportunities: ['Metodologia própria de diagnóstico operacional', 'Reposicionar cases como estudos de transformação'],
        suggestedQuestions: ['Que tipo de projeto você teria que recusar para subir de nível?', 'O que você faz que parece básico pra você mas é ouro pro cliente?'],
        businessMaturity: 'Operadora experiente, migrando para posicionamento estratégico.',
      },
      meeting: { title: 'Reunião 1', transcriptUploaded: true, status: 'analyzed' },
      transcriptAnalysis: {
        version: 1,
        summary: 'Renata relatou cansaço de aceitar projetos fora do seu foco só para manter a agenda cheia, e dificuldade de precificar diagnóstico como etapa separada da execução.',
        goals: ['Criar uma oferta de diagnóstico paga', 'Recusar 30% dos projetos fora do foco'],
        challenges: ['Medo de perder receita ao dizer não', 'Dificuldade de nomear a própria metodologia'],
        actionItems: ['Nomear a metodologia de diagnóstico', 'Criar página de portfólio por transformação, não por serviço'],
        homework: ['Ler o Playbook v1', 'Gravar o pitch de 30 segundos em áudio ou vídeo', 'Responder às perguntas de reflexão'],
        keyInsights: ['Aceitar tudo é o principal fator que mantém Renata no nível "executora".'],
      },
      playbook: {
        versions: [
          {
            version: 1,
            status: 'draft',
            createdAt: '2026-07-02T10:00:00',
            sections: {
              identity: 'Uma consultora operacional que transforma caos administrativo em processo replicável.',
              mission: 'Tirar pequenos negócios do improviso permanente.',
              vision: 'Um mercado onde operação forte é tão valorizada quanto estratégia de marca.',
              core_story: 'Começou organizando o próprio negócio da família — hoje aplica o mesmo método em dezenas de operações.',
              golden_circle: 'Por quê: negócios crescem e a operação não acompanha. Como: diagnóstico + processo replicável. O quê: consultoria operacional.',
              target_audience: 'Donos de pequenos negócios em crescimento rápido, sem processos definidos.',
              value_proposition: 'Transformamos operação improvisada em processo que funciona sem você por perto.',
              positioning: 'A consultora para quem já cresceu rápido demais para o próprio caos.',
              brand_voice: 'Direta, prática, sem rodeios.',
              communication_style: 'Frases curtas, exemplos concretos, pouca teoria.',
              goals: 'Lançar oferta de diagnóstico. Recusar 30% dos projetos fora de foco.',
              pitch_30s: 'Ajudo negócios que cresceram rápido demais a organizarem a operação antes que o caos vire prejuízo.',
              action_plan: '1) Nomear a metodologia. 2) Lançar oferta de diagnóstico paga. 3) Reposicionar portfólio por transformação.',
            },
          },
        ],
      },
      assessment: {
        title: 'Teste de Arquétipo',
        description: 'Uma breve avaliação externa para identificar seu arquétipo de marca dominante.',
        externalUrl: 'https://example.com/archetype-test',
        status: 'completed',
      },
      pitches: null,
      homework: [
        { id: 'h1', title: 'Ler o Playbook', type: 'boolean', status: 'completed' },
        { id: 'h2', title: 'Gravação do Pitch (áudio ou vídeo)', type: 'media_upload', status: 'pending', submissions: [] },
        { id: 'h3', title: 'Perguntas de Reflexão', type: 'text_submission', status: 'completed', submission: 'Os projetos que eu preciso recusar são os de organização de estoque pontual — não é o meu diagnóstico de fundo.' },
      ],
      activity: [
        { type: 'playbook_draft_created', text: 'Rascunho do Playbook v1 gerado', at: '2026-07-02T10:00:00' },
        { type: 'assessment_completed', text: 'Teste de Arquétipo concluído', at: '2026-06-30T15:00:00' },
        { type: 'meeting_analyzed', text: 'Transcrição da Reunião 1 analisada', at: '2026-06-29T16:00:00' },
        { type: 'questionnaire_submitted', text: 'Questionário de Identidade concluído', at: '2026-06-28T10:40:00' },
      ],
      playbookExperience: { format: null, completedAt: null },
      quiz: { score: null, total: null, completedAt: null },
      meetingRequests: [],
      notes: 'Verificar com a Nay se posso usar o playbook em uma proposta comercial antes da publicação.',
      moodLog: [
        { context: 'questionnaire_submitted', mood: 4, at: '2026-06-28T10:41:00' },
        { context: 'homework_task', mood: 3, at: '2026-07-03T09:00:00' },
      ],
    },
  },
};

function load() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    const seeded = structuredClone(SEED);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
    return seeded;
  }
  return JSON.parse(raw);
}

function save(db) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
}

function delay(ms = 500) {
  return new Promise((r) => setTimeout(r, ms));
}

function client(db, id) {
  return db.clients[id];
}

export const MockDB = {
  reset() {
    localStorage.removeItem(STORAGE_KEY);
    return load();
  },
  get() {
    return load();
  },

  logActivity(id, type, text) {
    const db = load();
    client(db, id).activity.unshift({ type, text, at: new Date().toISOString() });
    save(db);
  },

  // --- Clients / CRM ---
  listClients() {
    const db = load();
    return Object.values(db.clients).map((c) => {
      const completedSteps = c.journey.steps.filter((s) => s.status === 'completed').length;
      const journeyPct = Math.round((completedSteps / c.journey.steps.length) * 100);
      const homeworkPct = Math.round((c.homework.filter((t) => t.status === 'completed').length / c.homework.length) * 100);
      return { ...c.profile, journeyPct, homeworkPct };
    });
  },
  getClient(id = DEFAULT_CLIENT_ID) {
    return load().clients[id].profile;
  },
  getTenant() {
    return load().tenant;
  },
  getPhaseProgress(id = DEFAULT_CLIENT_ID) {
    const p = client(load(), id).profile;
    return { tier: p.tier, phases: TIER_PHASES[p.tier], currentIndex: p.phaseIndex };
  },

  // --- Journey ---
  getJourney(id = DEFAULT_CLIENT_ID) {
    return client(load(), id).journey;
  },

  // --- Questionnaire ---
  getQuestionnaire(id = DEFAULT_CLIENT_ID) {
    return client(load(), id).questionnaire;
  },
  saveAnswer(id, questionId, value) {
    const db = load();
    const q = client(db, id).questionnaire.questions.find((q) => q.id === questionId);
    if (q) q.answer = value;
    save(db);
  },
  submitQuestionnaire(id) {
    const db = load();
    client(db, id).questionnaire.status = 'submitted';
    save(db);
    this.logActivity(id, 'questionnaire_submitted', 'Questionário de Identidade concluído');
  },

  // --- AI: Questionnaire Analysis ---
  getQuestionnaireAnalysis(id = DEFAULT_CLIENT_ID) {
    return client(load(), id).questionnaireAnalysis;
  },
  async regenerateQuestionnaireAnalysis(id) {
    await delay(1200);
    const db = load();
    const c = client(db, id);
    c.questionnaireAnalysis = {
      ...c.questionnaireAnalysis,
      version: c.questionnaireAnalysis.version + 1,
      generatedAt: new Date().toISOString(),
      executiveSummary: c.questionnaireAnalysis.executiveSummary + ' (regenerado — conteúdo de exemplo, sem chamada real ao modelo neste protótipo)',
    };
    save(db);
    return c.questionnaireAnalysis;
  },

  // --- Meeting / Transcript ---
  getMeeting(id = DEFAULT_CLIENT_ID) {
    return client(load(), id).meeting;
  },
  getTranscriptAnalysis(id = DEFAULT_CLIENT_ID) {
    return client(load(), id).transcriptAnalysis;
  },
  async uploadTranscript(id) {
    await delay(800);
    const db = load();
    const c = client(db, id);
    c.meeting.transcriptUploaded = true;
    c.meeting.status = 'transcript_uploaded';
    save(db);
  },
  async analyzeTranscript(id) {
    await delay(1200);
    const db = load();
    const c = client(db, id);
    c.meeting.status = 'analyzed';
    if (!c.transcriptAnalysis) {
      c.transcriptAnalysis = {
        version: 1,
        summary: 'Resumo gerado a partir da transcrição enviada (conteúdo de exemplo — sem chamada real ao modelo neste protótipo).',
        goals: ['Objetivo identificado na conversa 1', 'Objetivo identificado na conversa 2'],
        challenges: ['Desafio mencionado pela cliente'],
        actionItems: ['Ação combinada em reunião'],
        homework: ['Ler o Playbook', 'Gravar o pitch'],
        keyInsights: ['Insight-chave extraído da conversa.'],
      };
    }
    save(db);
    this.logActivity(id, 'meeting_analyzed', 'Transcrição da reunião analisada');
    return c.transcriptAnalysis;
  },

  // --- Playbook ---
  getPlaybook(id = DEFAULT_CLIENT_ID) {
    return client(load(), id).playbook;
  },
  getSectionDefs() {
    return [
      ['identity', 'Identidade'], ['mission', 'Missão'], ['vision', 'Visão'],
      ['core_story', 'História Central'], ['golden_circle', 'Círculo Dourado'],
      ['target_audience', 'Público-Alvo'], ['value_proposition', 'Proposta de Valor'],
      ['positioning', 'Posicionamento'], ['brand_voice', 'Voz da Marca'],
      ['communication_style', 'Estilo de Comunicação'], ['goals', 'Objetivos'],
      ['pitch_30s', 'Pitch de 30 Segundos'], ['action_plan', 'Plano de Ação'],
    ];
  },
  async generatePlaybookDraft(id) {
    await delay(1500);
    const db = load();
    const c = client(db, id);
    const prior = c.playbook.versions[c.playbook.versions.length - 1];
    const newVersion = {
      version: prior ? prior.version + 1 : 1,
      status: 'draft',
      createdAt: new Date().toISOString(),
      sections: prior ? { ...prior.sections } : Object.fromEntries(this.getSectionDefs().map(([key]) => [key, 'Conteúdo de exemplo gerado pela IA — edite antes de publicar.'])),
    };
    c.playbook.versions.push(newVersion);
    save(db);
    this.logActivity(id, 'playbook_draft_created', `Rascunho do Playbook v${newVersion.version} gerado`);
    return newVersion;
  },
  saveSectionEdit(id, version, sectionKey, content) {
    const db = load();
    const v = client(db, id).playbook.versions.find((v) => v.version === version);
    if (v) v.sections[sectionKey] = content;
    save(db);
  },
  publishPlaybook(id, version) {
    const db = load();
    const c = client(db, id);
    c.playbook.versions.forEach((v) => {
      if (v.version === version) { v.status = 'published'; v.publishedAt = new Date().toISOString(); }
      else if (v.status === 'published') { v.status = 'archived'; }
    });
    save(db);
    this.logActivity(id, 'playbook_published', `Playbook v${version} publicado`);
  },
  getPublishedPlaybook(id = DEFAULT_CLIENT_ID) {
    const c = client(load(), id);
    return c.playbook.versions.find((v) => v.status === 'published') || null;
  },
  getBook(id = DEFAULT_CLIENT_ID) {
    return client(load(), id).book || null;
  },

  // --- Assessment ---
  getAssessment(id = DEFAULT_CLIENT_ID) {
    return client(load(), id).assessment;
  },
  markAssessmentComplete(id) {
    const db = load();
    client(db, id).assessment.status = 'completed';
    save(db);
    this.logActivity(id, 'assessment_completed', 'Teste de Arquétipo concluído');
  },

  // --- Pitch ---
  getPitches(id = DEFAULT_CLIENT_ID) {
    return client(load(), id).pitches;
  },
  async generatePitches(id) {
    await delay(1200);
    const db = load();
    const c = client(db, id);
    c.pitches = {
      version: 1,
      pitch_10s: 'Transformo especialistas invisíveis em autoridades reconhecidas.',
      pitch_30s: 'Ajudo especialistas de alto nível a transformarem sua expertise silenciosa em uma marca que as pessoas realmente notam — sem soar como todo mundo na categoria.',
      pitch_60s: 'A maioria dos especialistas que conheço é melhor do que sua reputação sugere. Eu ajudo a fechar essa lacuna — afiando o posicionamento, a história e o discurso — para que a percepção finalmente corresponda ao nível em que realmente atuam.',
      pitch_networking: 'Trabalho com especialistas que são ótimos no que fazem, mas esquecíveis em como se descrevem — eu resolvo a parte da descrição.',
      instagram_bio: 'Estrategista de marca para especialistas ✨ Transformando expertise silenciosa em autoridade visível.',
      linkedin_summary: 'Ajudo consultores e coaches estabelecidos a fecharem a lacuna entre sua real expertise e como são percebidos — com posicionamento mais afiado, uma história mais clara e um discurso que realmente convence.',
    };
    save(db);
    this.logActivity(id, 'pitches_generated', 'Variações de pitch geradas');
    return c.pitches;
  },

  // --- Homework ---
  getHomework(id = DEFAULT_CLIENT_ID) {
    return client(load(), id).homework;
  },
  toggleHomework(id, taskId) {
    const db = load();
    const t = client(db, id).homework.find((t) => t.id === taskId);
    if (t) t.status = t.status === 'completed' ? 'pending' : 'completed';
    save(db);
  },
  submitHomeworkText(id, taskId, text) {
    const db = load();
    const t = client(db, id).homework.find((t) => t.id === taskId);
    if (t) { t.submission = text; t.status = text.trim() ? 'completed' : 'pending'; }
    save(db);
  },
  homeworkCompletionPct(id = DEFAULT_CLIENT_ID) {
    const hw = client(load(), id).homework;
    return Math.round((hw.filter((t) => t.status === 'completed').length / hw.length) * 100);
  },

  // --- Pitch practice recordings ---
  // Uses object URLs (blob:...) so they play back within this browser tab/session.
  // A real build stores these in Supabase Storage instead; the URL only needs to
  // survive the session here, matching how far this prototype goes without a backend.
  addHomeworkMedia(id, taskId, file) {
    const db = load();
    const t = client(db, id).homework.find((t) => t.id === taskId);
    if (!t) return;
    if (!t.submissions) t.submissions = [];
    t.submissions.push({
      id: `m${Date.now()}`,
      kind: file.type.startsWith('video') ? 'video' : 'audio',
      name: file.name,
      url: URL.createObjectURL(file),
      uploadedAt: new Date().toISOString(),
    });
    t.status = 'completed';
    save(db);
    this.logActivity(id, 'pitch_recording_uploaded', 'Nova gravação de prática do pitch enviada');
  },
  removeHomeworkMedia(id, taskId, submissionId) {
    const db = load();
    const t = client(db, id).homework.find((t) => t.id === taskId);
    if (!t) return;
    t.submissions = (t.submissions || []).filter((s) => s.id !== submissionId);
    if (t.submissions.length === 0) t.status = 'pending';
    save(db);
  },

  // --- Playbook experience (podcast / video / audiobook) ---
  getPlaybookExperience(id = DEFAULT_CLIENT_ID) {
    return client(load(), id).playbookExperience;
  },
  completePlaybookExperience(id, format) {
    const db = load();
    client(db, id).playbookExperience = { format, completedAt: new Date().toISOString() };
    save(db);
    this.logActivity(id, 'playbook_experienced', `Playbook vivenciado em formato ${format}`);
  },

  // --- Quiz: short, fun check on what the client just learned ---
  getQuiz(id = DEFAULT_CLIENT_ID) {
    return client(load(), id).quiz;
  },
  buildQuizQuestions(id = DEFAULT_CLIENT_ID) {
    const published = this.getPublishedPlaybook(id);
    if (!published) return [];
    const s = published.sections;
    const DECOYS = {
      positioning: ['A opção mais barata do mercado para qualquer perfil de cliente.', 'Alguém que atende qualquer segmento, sem distinção.'],
      mission: ['Vender o máximo de serviços possível, independente do encaixe.', 'Ser conhecida por estar em todas as redes sociais ao mesmo tempo.'],
      target_audience: ['Qualquer pessoa disposta a pagar, sem critério de encaixe.', 'Apenas grandes empresas com equipes de marketing próprias.'],
      pitch_30s: ['Um resumo técnico do currículo, sem conexão com o cliente.', 'Uma lista de certificados e ferramentas dominadas.'],
    };
    const bank = [
      ['positioning', 'Qual é o seu posicionamento?'],
      ['mission', 'Qual é a sua missão?'],
      ['target_audience', 'Quem é o seu público-alvo?'],
      ['pitch_30s', 'Qual é o seu pitch de 30 segundos?'],
    ];
    return bank
      .filter(([key]) => s[key])
      .map(([key, question]) => {
        const options = shuffle([s[key], ...DECOYS[key]]);
        return { key, question, options, correct: s[key] };
      });
  },
  submitQuiz(id, score, total) {
    const db = load();
    client(db, id).quiz = { score, total, completedAt: new Date().toISOString() };
    save(db);
    this.logActivity(id, 'quiz_completed', `Quiz do playbook concluído (${score}/${total})`);
  },

  // --- Activity ---
  getActivity(id = DEFAULT_CLIENT_ID) {
    return client(load(), id).activity;
  },

  // --- Meeting requests ---
  getMeetingRequests(id = DEFAULT_CLIENT_ID) {
    return client(load(), id).meetingRequests;
  },
  requestMeeting(id, reason) {
    const db = load();
    const req = { id: `mr${Date.now()}`, reason, status: 'pending', assignedTo: null, createdAt: new Date().toISOString() };
    client(db, id).meetingRequests.unshift(req);
    save(db);
    this.logActivity(id, 'meeting_requested', 'Solicitou uma reunião para tirar dúvidas');
    return req;
  },
  listAllMeetingRequests() {
    const db = load();
    const all = [];
    Object.entries(db.clients).forEach(([id, c]) => {
      c.meetingRequests.forEach((r) => all.push({ ...r, clientId: id, clientName: c.profile.fullName }));
    });
    return all.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  },
  assignMeetingRequest(clientId, requestId, assignee) {
    const db = load();
    const r = client(db, clientId).meetingRequests.find((r) => r.id === requestId);
    if (r) { r.status = 'assigned'; r.assignedTo = assignee; }
    save(db);
  },
  resolveMeetingRequest(clientId, requestId) {
    const db = load();
    const r = client(db, clientId).meetingRequests.find((r) => r.id === requestId);
    if (r) r.status = 'done';
    save(db);
  },

  // --- Private client notepad ---
  getNotes(id = DEFAULT_CLIENT_ID) {
    return client(load(), id).notes;
  },
  saveNotes(id, text) {
    const db = load();
    client(db, id).notes = text;
    save(db);
  },

  // --- Mood check-ins (for later satisfaction/experience metrics) ---
  logMood(id, context, mood) {
    const db = load();
    client(db, id).moodLog.push({ context, mood, at: new Date().toISOString() });
    save(db);
  },
  getMoodLog(id = DEFAULT_CLIENT_ID) {
    return client(load(), id).moodLog;
  },
  getMoodStats(id = DEFAULT_CLIENT_ID) {
    return moodStatsFor(client(load(), id).moodLog);
  },
  getGlobalMoodStats() {
    const db = load();
    const all = Object.values(db.clients).flatMap((c) => c.moodLog);
    return moodStatsFor(all);
  },
};

export const MOOD_SCALE = [
  { value: 1, emoji: '😞', label: 'Muito mal' },
  { value: 2, emoji: '😕', label: 'Mal' },
  { value: 3, emoji: '😐', label: 'Neutro' },
  { value: 4, emoji: '🙂', label: 'Bem' },
  { value: 5, emoji: '😄', label: 'Ótimo' },
];

function moodStatsFor(entries) {
  const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  entries.forEach((e) => { distribution[e.mood] = (distribution[e.mood] || 0) + 1; });
  const count = entries.length;
  const avg = count ? entries.reduce((sum, e) => sum + e.mood, 0) / count : null;
  return { count, avg, distribution };
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
