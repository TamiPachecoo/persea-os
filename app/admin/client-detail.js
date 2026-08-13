import { MockDB, DEFAULT_CLIENT_ID, MOOD_SCALE, ONBOARDING_STAGES, ONBOARDING_STAGE_LABEL, WHATSAPP_STATUSES, WHATSAPP_STATUS_LABEL, CONTRACT_DURATIONS, CONTRACT_DURATION_LABEL, CONTRACT_DURATION_VALUE } from '../shared/mock-db.js';
import { renderShell, card, statusBadge, toast, formatDateTime, formatDate, renderPhaseTracker, isValidHttpUrl } from '../shared/ui.js';

const MOOD_EMOJI = Object.fromEntries(MOOD_SCALE.map((m) => [m.value, m.emoji]));
const CONTRACT_STATUS_CLASS = {
  info_pending: 'badge-locked', info_received: 'badge-progress', contract_prepared: 'badge-progress',
  sent_for_signature: 'badge-progress', awaiting_signature: 'badge-progress', signed: 'badge-progress', completed: 'badge-completed',
};
const WHATSAPP_STATUS_CLASS = { not_added: 'badge-locked', pending: 'badge-progress', added: 'badge-completed' };
const onboardingBadge = (status) => `<span class="badge ${CONTRACT_STATUS_CLASS[status] || 'badge-locked'}">${ONBOARDING_STAGE_LABEL[status] || status}</span>`;
const whatsappBadge = (status) => `<span class="badge ${WHATSAPP_STATUS_CLASS[status] || 'badge-locked'}">${WHATSAPP_STATUS_LABEL[status] || status}</span>`;

document.body.innerHTML = renderShell({ role: 'admin', active: 'client-detail.html' });

const clientId = new URLSearchParams(location.search).get('id') || DEFAULT_CLIENT_ID;
const client = MockDB.getClient(clientId);
const phaseProgress = MockDB.getPhaseProgress(clientId);
const TIER_LABEL = { premium: 'Premium', essential: 'Essential' };
const TABS = [
  ['onboarding', 'Onboarding'],
  ['brand-direction', 'Direção da Marca'],
  ['questionnaire', 'Questionário'],
  ['meeting', 'Reunião e Transcrição'],
  ['playbook', 'Editor de Playbook'],
  ['pitch', 'Editor de Pitch'],
  ['assessment', 'Avaliação'],
  ['homework', 'Tarefas'],
  ['meeting-prep', 'Preparação de Reunião'],
  ['activity', 'Atividade'],
];

let activeTab = 'onboarding';
const content = document.getElementById('app-content');

function shell(inner) {
  return `
    <a href="dashboard.html" class="btn-text mb-4 inline-block">&larr; Todos os clientes</a>
    <div class="mb-8 flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-serif">${client.fullName}</h1>
        <p class="text-white/40 text-sm">${client.email} · ${TIER_LABEL[client.tier] || client.tier}</p>
      </div>
      ${statusBadge(client.status)}
    </div>

    ${renderPhaseTracker(phaseProgress)}

    <div class="flex gap-1 mb-8 border-b border-white/10 overflow-x-auto">
      ${TABS.map(([key, label]) => `
        <button data-tab="${key}" class="tab-btn ${activeTab === key ? 'active' : ''}">${label}</button>
      `).join('')}
    </div>
    <div id="tab-content">${inner}</div>
  `;
}

function renderOnboardingTab() {
  const o = MockDB.getOnboarding(clientId);
  const info = o.clientInfo;
  const c = o.contract;
  const isPJ = info.partyType === 'PJ';

  return `
    ${card(`
      <p class="text-sm text-white/50 mb-4">Informações Enviadas pela Cliente</p>
      ${info.submitted ? `
        <div class="grid sm:grid-cols-2 gap-4 text-sm">
          <div><p class="text-white/40 text-xs mb-1">Nome Completo</p><p>${info.fullName}</p></div>
          <div><p class="text-white/40 text-xs mb-1">Tipo</p><p>${isPJ ? 'Pessoa Jurídica' : 'Pessoa Física'}</p></div>
          <div><p class="text-white/40 text-xs mb-1">${isPJ ? 'CNPJ' : 'CPF'}</p><p>${isPJ ? info.cnpj : info.cpf}</p></div>
          ${isPJ ? `<div><p class="text-white/40 text-xs mb-1">Empresa</p><p>${info.companyName || '—'}</p></div>` : ''}
          <div><p class="text-white/40 text-xs mb-1">Endereço</p><p>${info.address}</p></div>
          <div><p class="text-white/40 text-xs mb-1">Email</p><p>${info.email}</p></div>
          <div><p class="text-white/40 text-xs mb-1">WhatsApp</p><p>${info.whatsapp}</p></div>
        </div>
      ` : '<p class="text-sm" style="color:var(--muted);">A cliente ainda não enviou suas informações.</p>'}
    `, 'mb-6')}

    ${card(`
      <div class="flex items-center justify-between mb-4">
        <p class="text-sm text-white/50">Contrato</p>
        ${onboardingBadge(c.status)}
      </div>
      <div class="grid sm:grid-cols-2 gap-4 text-sm mb-4">
        <div>
          <p class="text-white/40 text-xs mb-1">Modelo de Contrato</p>
          <select id="contract-duration" class="field text-sm">
            <option value="">Não definido</option>
            ${CONTRACT_DURATIONS.map((d) => `<option value="${d}" ${c.duration === d ? 'selected' : ''}>${CONTRACT_DURATION_LABEL[d]} · R$ ${CONTRACT_DURATION_VALUE[d].toLocaleString('pt-BR')}</option>`).join('')}
          </select>
        </div>
        <div>
          <p class="text-white/40 text-xs mb-1">Avançar Status</p>
          <div class="flex gap-2">
            <select id="contract-status" class="field text-sm">
              ${ONBOARDING_STAGES.map((s) => `<option value="${s}" ${c.status === s ? 'selected' : ''}>${ONBOARDING_STAGE_LABEL[s]}</option>`).join('')}
            </select>
            <button id="update-contract-status" class="btn-ghost">Atualizar</button>
          </div>
        </div>
      </div>
      <p class="text-xs text-white/30 mb-4">Assinatura acontece em uma plataforma externa — este protótipo apenas rastreia o status, sem integração real.</p>
      <div class="flex items-center gap-3">
        <button id="upload-signed-contract" class="btn-ghost" ${!['signed', 'completed'].includes(c.status) ? 'disabled' : ''}>
          ${c.signedFileName ? 'Reenviar Contrato Assinado' : 'Simular Upload do Contrato Assinado'}
        </button>
        ${c.signedFileName ? `<span class="text-xs" style="color:var(--muted);">${c.signedFileName}</span>` : ''}
      </div>
    `, 'mb-6')}

    ${card(`
      <div class="flex items-center justify-between mb-4">
        <p class="text-sm text-white/50">Grupo de WhatsApp</p>
        ${whatsappBadge(o.whatsappGroup.status)}
      </div>
      <div class="flex items-center gap-2">
        <select id="whatsapp-status" class="field text-sm">
          ${WHATSAPP_STATUSES.map((s) => `<option value="${s}" ${o.whatsappGroup.status === s ? 'selected' : ''}>${WHATSAPP_STATUS_LABEL[s]}</option>`).join('')}
        </select>
        <button id="update-whatsapp-status" class="btn-ghost">Atualizar</button>
      </div>
      <p class="text-xs text-white/30 mt-3">Aulas e materiais iniciais são liberados para a cliente assim que este status estiver "Adicionada".</p>
    `)}
  `;
}

function renderBrandDirectionTab() {
  const bd = MockDB.getBrandDirection(clientId);
  return card(`
    <form id="brand-direction-form" class="space-y-4">
      <div>
        <label class="text-xs text-white/40 block mb-1">URL do Mural no Pinterest</label>
        <input name="pinterestUrl" class="field" value="${bd.pinterestUrl || ''}" placeholder="https://www.pinterest.com/..." />
        ${bd.pinterestUrl && !isValidHttpUrl(bd.pinterestUrl) ? '<p class="text-xs mt-1" style="color:var(--error);">O link salvo não parece válido.</p>' : ''}
      </div>
      <div>
        <label class="text-xs text-white/40 block mb-1">Resumo do Posicionamento</label>
        <textarea name="positioningSummary" rows="3" class="field">${bd.positioningSummary || ''}</textarea>
      </div>
      <div class="grid sm:grid-cols-2 gap-4">
        <div>
          <label class="text-xs text-white/40 block mb-1">Palavras-Chave / Atributos <span class="text-white/20">(uma por linha)</span></label>
          <textarea name="keywords" rows="4" class="field">${(bd.keywords || []).join('\n')}</textarea>
        </div>
        <div>
          <label class="text-xs text-white/40 block mb-1">Tom de Comunicação</label>
          <textarea name="tone" rows="4" class="field">${bd.tone || ''}</textarea>
        </div>
      </div>
      <div>
        <label class="text-xs text-white/40 block mb-1">Referências Visuais e de Conteúdo <span class="text-white/20">(uma por linha)</span></label>
        <textarea name="references" rows="3" class="field">${(bd.references || []).join('\n')}</textarea>
      </div>
      <div>
        <label class="text-xs text-white/40 block mb-1">Orientações e Observações da Nay</label>
        <textarea name="guidance" rows="3" class="field">${bd.guidance || ''}</textarea>
      </div>
      <div class="grid sm:grid-cols-2 gap-4">
        <div>
          <label class="text-xs text-white/40 block mb-1">O que pertence a esta marca <span class="text-white/20">(uma por linha)</span></label>
          <textarea name="belongs" rows="4" class="field">${(bd.belongs || []).join('\n')}</textarea>
        </div>
        <div>
          <label class="text-xs text-white/40 block mb-1">O que não pertence a esta marca <span class="text-white/20">(uma por linha)</span></label>
          <textarea name="doesntBelong" rows="4" class="field">${(bd.doesntBelong || []).join('\n')}</textarea>
        </div>
      </div>
      <div class="flex items-center justify-between pt-1">
        <p class="text-xs text-white/20">${bd.updatedAt ? `Atualizado em ${formatDate(bd.updatedAt)}` : 'Ainda não preenchido — a cliente vê um estado "em breve" até aqui ser salvo.'}</p>
        <button type="submit" class="btn-primary" style="padding:9px 18px;font-size:12.5px;">Salvar</button>
      </div>
    </form>
  `);
}

function renderQuestionnaireTab() {
  const q = MockDB.getQuestionnaire(clientId);
  const a = MockDB.getQuestionnaireAnalysis(clientId);
  return `
    ${card(`
      <p class="text-sm text-white/50 mb-4">Respostas da Cliente</p>
      <div class="space-y-4">
        ${q.questions.map((qu) => `
          <div class="pb-4 border-b border-white/5 last:border-0 last:pb-0">
            <p class="text-sm text-white/40 mb-1">${qu.text}</p>
            <p>${qu.answer}</p>
          </div>
        `).join('')}
      </div>
    `, 'mb-6')}
    ${card(`
      <div class="flex items-center justify-between mb-4">
        <p class="text-sm text-white/50">Análise de IA <span class="text-white/30">· v${a.version}</span></p>
        <button id="regen-qa" class="btn-ghost">Regenerar</button>
      </div>
      <div id="qa-body" class="space-y-4 text-sm">
        ${renderQABody(a)}
      </div>
    `)}
  `;
}

function renderQABody(a) {
  return `
    <div><p class="text-white/40 mb-1">Resumo Executivo</p><p>${a.executiveSummary}</p></div>
    <div><p class="text-white/40 mb-1">Pontos Fortes</p><ul class="list-disc list-inside space-y-1">${a.strengths.map((s) => `<li>${s}</li>`).join('')}</ul></div>
    <div><p class="text-white/40 mb-1">Objetivos</p><ul class="list-disc list-inside space-y-1">${a.goals.map((s) => `<li>${s}</li>`).join('')}</ul></div>
    <div><p class="text-white/40 mb-1">Pontos de Dor</p><ul class="list-disc list-inside space-y-1">${a.painPoints.map((s) => `<li>${s}</li>`).join('')}</ul></div>
    <div><p class="text-white/40 mb-1">Oportunidades</p><ul class="list-disc list-inside space-y-1">${a.opportunities.map((s) => `<li>${s}</li>`).join('')}</ul></div>
    <div><p class="text-white/40 mb-1">Perguntas Sugeridas</p><ul class="list-disc list-inside space-y-1">${a.suggestedQuestions.map((s) => `<li>${s}</li>`).join('')}</ul></div>
    <div><p class="text-white/40 mb-1">Maturidade do Negócio</p><p>${a.businessMaturity}</p></div>
  `;
}

function renderMeetingTab() {
  const meeting = MockDB.getMeeting(clientId);
  const ta = MockDB.getTranscriptAnalysis(clientId);
  return `
    ${card(`
      <div class="flex items-center justify-between mb-4">
        <p class="text-sm text-white/50">${meeting.title}</p>
        ${statusBadge(meeting.status)}
      </div>
      <p class="text-sm text-white/40 mb-4">Transcrição ${meeting.transcriptUploaded ? 'enviada' : 'não enviada'}. Este protótipo simula o upload/análise — nenhuma leitura real de arquivo ou chamada ao modelo acontece.</p>
      <div class="flex gap-3">
        <button id="upload-btn" class="btn-ghost" ${meeting.transcriptUploaded ? 'disabled' : ''}>Simular Envio de Transcrição</button>
        <button id="analyze-btn" class="btn-ghost" ${!meeting.transcriptUploaded ? 'disabled' : ''}>Analisar Transcrição</button>
      </div>
    `, 'mb-6')}
    ${card(`
      <p class="text-sm text-white/50 mb-4">Análise da Transcrição</p>
      <div id="ta-body" class="space-y-4 text-sm">${ta ? renderTABody(ta) : '<p class="text-white/30 text-sm">Ainda não analisada — envie e analise a transcrição acima.</p>'}</div>
    `)}
  `;
}

function renderTABody(ta) {
  return `
    <div><p class="text-white/40 mb-1">Resumo da Reunião</p><p>${ta.summary}</p></div>
    <div><p class="text-white/40 mb-1">Objetivos</p><ul class="list-disc list-inside space-y-1">${ta.goals.map((s) => `<li>${s}</li>`).join('')}</ul></div>
    <div><p class="text-white/40 mb-1">Desafios</p><ul class="list-disc list-inside space-y-1">${ta.challenges.map((s) => `<li>${s}</li>`).join('')}</ul></div>
    <div><p class="text-white/40 mb-1">Itens de Ação</p><ul class="list-disc list-inside space-y-1">${ta.actionItems.map((s) => `<li>${s}</li>`).join('')}</ul></div>
    <div><p class="text-white/40 mb-1">Tarefas</p><ul class="list-disc list-inside space-y-1">${ta.homework.map((s) => `<li>${s}</li>`).join('')}</ul></div>
    <div><p class="text-white/40 mb-1">Principais Insights</p><ul class="list-disc list-inside space-y-1">${ta.keyInsights.map((s) => `<li>${s}</li>`).join('')}</ul></div>
  `;
}

function renderPlaybookTab() {
  const pb = MockDB.getPlaybook(clientId);
  const latest = pb.versions[pb.versions.length - 1];
  const sectionDefs = MockDB.getSectionDefs();

  if (!latest) {
    return card(`
      <div class="flex items-center justify-between mb-2">
        <p class="text-sm text-white/50">Nenhuma versão gerada ainda</p>
        <button id="generate-pb" class="btn-ghost">Gerar Primeira Versão</button>
      </div>
      <p class="text-xs text-white/30">Requer questionário e transcrição analisados.</p>
    `);
  }

  return `
    <div class="flex items-center justify-between mb-4">
      <p class="text-sm text-white/50">Versão ${latest.version} ${statusBadge(latest.status)}</p>
      <div class="flex gap-3">
        <button id="generate-pb" class="btn-ghost">Gerar Nova Versão</button>
        <button id="publish-pb" class="btn-primary" style="padding:9px 18px;font-size:12.5px;" ${latest.status === 'published' ? 'disabled' : ''}>Publicar</button>
      </div>
    </div>
    <p class="text-xs text-white/30 mb-6">${pb.versions.length} versão(ões) no total — histórico completo preservado.</p>
    <div class="space-y-4">
      ${sectionDefs.map(([key, title]) => `
        <div class="card">
          <p class="text-xs uppercase tracking-wider text-white/40 mb-2">${title}</p>
          <textarea data-section="${key}" rows="2" class="field text-sm">${latest.sections[key]}</textarea>
        </div>
      `).join('')}
    </div>
  `;
}

function renderPitchTab() {
  const pitches = MockDB.getPitches(clientId);
  return `
    ${card(`
      <div class="flex items-center justify-between mb-4">
        <p class="text-sm text-white/50">Variações de Pitch</p>
        <button id="generate-pitch" class="btn-ghost">${pitches ? 'Regenerar' : 'Gerar'}</button>
      </div>
      <div id="pitch-body">
        ${pitches ? Object.entries(pitches).filter(([k]) => k !== 'version').map(([k, v]) => `
          <div class="mb-4 last:mb-0"><p class="text-xs text-white/40 mb-1 capitalize">${k.replace(/_/g, ' ')}</p><p class="text-sm">${v}</p></div>
        `).join('') : '<p class="text-white/30 text-sm">Ainda não gerado.</p>'}
      </div>
    `)}
  `;
}

function renderAssessmentTab() {
  const a = MockDB.getAssessment(clientId);
  return card(`
    <div class="flex items-center justify-between mb-3">
      <p class="font-medium">${a.title}</p>
      ${statusBadge(a.status)}
    </div>
    <p class="text-sm text-white/50 mb-4">${a.description}</p>
    <div class="flex items-center gap-3">
      <a href="${a.externalUrl}" target="_blank" class="btn-ghost">Abrir Teste Externo</a>
      <button id="mark-complete" class="btn-ghost" ${a.status === 'completed' ? 'disabled' : ''}>Marcar como Concluído</button>
    </div>
  `);
}

function renderHomeworkTab() {
  const tasks = MockDB.getHomework(clientId);
  const pct = MockDB.homeworkCompletionPct(clientId);
  return card(`
    <p class="text-sm text-white/50 mb-4">Conclusão: ${pct}%</p>
    <div class="space-y-3">
      ${tasks.map((t) => `
        <div class="py-3 border-b border-white/5 last:border-0">
          <div class="flex items-center justify-between">
            <span>${t.title}</span>
            ${statusBadge(t.status)}
          </div>
          ${t.type === 'media_upload' && (t.submissions || []).length ? `
            <div class="mt-3 space-y-2">
              ${t.submissions.map((s) => `
                <div class="rounded border p-3" style="border-color:var(--line);">
                  <p class="text-xs mb-2" style="color:var(--muted);">${s.name} · ${formatDateTime(s.uploadedAt)}</p>
                  ${s.url
                    ? (s.kind === 'video'
                        ? `<video src="${s.url}" controls class="w-full rounded" style="max-height:220px;"></video>`
                        : `<audio src="${s.url}" controls class="w-full"></audio>`)
                    : `<p class="text-xs italic" style="color:var(--muted);">Gravação de sessão anterior — não reproduzível neste protótipo.</p>`}
                </div>
              `).join('')}
            </div>
          ` : ''}
        </div>
      `).join('')}
    </div>
  `);
}

function renderMeetingPrepTab() {
  const q = MockDB.getQuestionnaire(clientId);
  const pct = MockDB.homeworkCompletionPct(clientId);
  const pb = MockDB.getPublishedPlaybook(clientId);
  const hw = MockDB.getHomework(clientId);
  const questionsSubmitted = hw.find((t) => t.id === 'h3')?.status === 'completed';
  const experience = MockDB.getPlaybookExperience(clientId);
  const quiz = MockDB.getQuiz(clientId);
  const attention = [];
  if (!pb) attention.push('Playbook ainda não publicado para a cliente');
  if (pct < 100) attention.push('Tarefas não totalmente concluídas');
  if (!questionsSubmitted) attention.push('Perguntas de reflexão não enviadas');
  if (pb && !experience.completedAt) attention.push('Cliente ainda não vivenciou o playbook (podcast/vídeo/audiobook)');
  if (pb && experience.completedAt && !quiz.completedAt) attention.push('Quiz do playbook ainda não feito');

  return `
    ${card(`
      <p class="text-sm text-white/50 mb-4">Checklist Pré-Reunião 2</p>
      <div class="grid md:grid-cols-2 gap-4 text-sm">
        <div class="flex justify-between py-2 border-b border-white/5"><span>Questionário</span>${statusBadge(q.status === 'submitted' ? 'completed' : 'pending')}</div>
        <div class="flex justify-between py-2 border-b border-white/5"><span>Tarefas</span><span>${pct}%</span></div>
        <div class="flex justify-between py-2 border-b border-white/5"><span>Playbook Publicado</span>${statusBadge(pb ? 'published' : 'draft')}</div>
        <div class="flex justify-between py-2 border-b border-white/5"><span>Perguntas Enviadas</span>${statusBadge(questionsSubmitted ? 'completed' : 'pending')}</div>
        <div class="flex justify-between py-2 border-b border-white/5"><span>Experiência do Playbook</span>${statusBadge(experience.completedAt ? 'completed' : 'pending')}</div>
        <div class="flex justify-between py-2 border-b border-white/5"><span>Quiz</span>${quiz.completedAt ? `<span class="text-xs">${quiz.score}/${quiz.total}</span>` : statusBadge('pending')}</div>
      </div>
    `, 'mb-6')}
    ${card(`
      <p class="text-sm text-white/50 mb-3">Áreas que Requerem Atenção</p>
      ${attention.length ? `<ul class="list-disc list-inside space-y-1 text-sm" style="color:var(--gold);">${attention.map((a) => `<li>${a}</li>`).join('')}</ul>` : '<p class="text-sm" style="color:var(--gold);">Tudo em dia.</p>'}
    `)}
  `;
}

function renderActivityTab() {
  const events = MockDB.getActivity(clientId);
  const moodLog = MockDB.getMoodLog(clientId).slice(-6).reverse();
  const requests = MockDB.getMeetingRequests(clientId);

  return `
    ${card(`
      <div class="space-y-4">
        ${events.map((e) => `
          <div class="flex items-start gap-4 py-3 border-b border-white/5 last:border-0">
            <div class="w-2 h-2 mt-2 rounded-full shrink-0" style="background:var(--terracotta);"></div>
            <div><p>${e.text}</p><p class="text-xs text-white/30 mt-1">${formatDateTime(e.at)}</p></div>
          </div>
        `).join('')}
      </div>
    `, 'mb-6')}
    ${card(`
      <p class="text-sm text-white/50 mb-4">Humor Recente</p>
      ${moodLog.length ? `
        <div class="flex items-center gap-3">
          ${moodLog.map((m) => `<span title="${m.context} · ${formatDateTime(m.at)}" style="font-size:1.4rem;">${MOOD_EMOJI[m.mood]}</span>`).join('')}
        </div>
      ` : '<p class="text-sm" style="color:var(--muted);">Sem registros ainda.</p>'}
    `, 'mb-6')}
    ${card(`
      <p class="text-sm text-white/50 mb-4">Solicitações de Reunião</p>
      ${requests.length ? requests.map((r) => `
        <div class="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
          <span class="text-sm">${r.reason}</span>
          ${statusBadge(r.status === 'done' ? 'completed' : r.status === 'assigned' ? 'in_progress' : 'pending')}
        </div>
      `).join('') : '<p class="text-sm" style="color:var(--muted);">Nenhuma solicitação.</p>'}
    `)}
  `;
}

const RENDERERS = {
  onboarding: renderOnboardingTab,
  'brand-direction': renderBrandDirectionTab,
  questionnaire: renderQuestionnaireTab,
  meeting: renderMeetingTab,
  playbook: renderPlaybookTab,
  pitch: renderPitchTab,
  assessment: renderAssessmentTab,
  homework: renderHomeworkTab,
  'meeting-prep': renderMeetingPrepTab,
  activity: renderActivityTab,
};

function wireTabEvents() {
  const tc = document.getElementById('tab-content');

  tc.querySelector('#contract-duration')?.addEventListener('change', (e) => {
    MockDB.setContractDuration(clientId, e.target.value);
    toast('Modelo de contrato atualizado.');
    render();
  });
  tc.querySelector('#update-contract-status')?.addEventListener('click', () => {
    const status = tc.querySelector('#contract-status').value;
    MockDB.advanceContractStatus(clientId, status);
    toast('Status do contrato atualizado.');
    render();
  });
  tc.querySelector('#upload-signed-contract')?.addEventListener('click', async (e) => {
    e.target.disabled = true; e.target.textContent = 'Enviando…';
    await MockDB.uploadSignedContract(clientId, `contrato-${clientId}-assinado.pdf`);
    toast('Contrato assinado enviado — visível no perfil da cliente.');
    render();
  });
  tc.querySelector('#update-whatsapp-status')?.addEventListener('click', () => {
    const status = tc.querySelector('#whatsapp-status').value;
    MockDB.setWhatsappStatus(clientId, status);
    toast('Status do grupo de WhatsApp atualizado.');
    render();
  });

  tc.querySelector('#brand-direction-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const splitLines = (v) => (v || '').split('\n').map((s) => s.trim()).filter(Boolean);
    MockDB.saveBrandDirection(clientId, {
      pinterestUrl: (fd.get('pinterestUrl') || '').trim() || null,
      positioningSummary: fd.get('positioningSummary'),
      keywords: splitLines(fd.get('keywords')),
      tone: fd.get('tone'),
      references: splitLines(fd.get('references')),
      guidance: fd.get('guidance'),
      belongs: splitLines(fd.get('belongs')),
      doesntBelong: splitLines(fd.get('doesntBelong')),
    });
    toast('Direção da Marca atualizada.');
    render();
  });

  tc.querySelector('#regen-qa')?.addEventListener('click', async (e) => {
    e.target.disabled = true; e.target.textContent = 'Gerando…';
    const a = await MockDB.regenerateQuestionnaireAnalysis(clientId);
    document.getElementById('qa-body').innerHTML = renderQABody(a);
    toast('Análise regenerada.');
    render();
  });

  tc.querySelector('#upload-btn')?.addEventListener('click', async (e) => {
    e.target.disabled = true; e.target.textContent = 'Enviando…';
    await MockDB.uploadTranscript(clientId);
    toast('Transcrição enviada.');
    render();
  });
  tc.querySelector('#analyze-btn')?.addEventListener('click', async (e) => {
    e.target.disabled = true; e.target.textContent = 'Analisando…';
    await MockDB.analyzeTranscript(clientId);
    toast('Transcrição analisada.');
    render();
  });

  tc.querySelector('#generate-pb')?.addEventListener('click', async (e) => {
    e.target.disabled = true; e.target.textContent = 'Gerando…';
    await MockDB.generatePlaybookDraft(clientId);
    toast('Novo rascunho de playbook gerado.');
    render();
  });
  tc.querySelector('#publish-pb')?.addEventListener('click', () => {
    const pb = MockDB.getPlaybook(clientId);
    const latest = pb.versions[pb.versions.length - 1];
    MockDB.publishPlaybook(clientId, latest.version);
    toast('Playbook publicado — cliente notificada.');
    render();
  });
  tc.querySelectorAll('[data-section]').forEach((el) => {
    el.addEventListener('blur', () => {
      const pb = MockDB.getPlaybook(clientId);
      const latest = pb.versions[pb.versions.length - 1];
      MockDB.saveSectionEdit(clientId, latest.version, el.dataset.section, el.value);
    });
  });

  tc.querySelector('#generate-pitch')?.addEventListener('click', async (e) => {
    e.target.disabled = true; e.target.textContent = 'Gerando…';
    await MockDB.generatePitches(clientId);
    toast('Pitches gerados.');
    render();
  });

  tc.querySelector('#mark-complete')?.addEventListener('click', () => {
    MockDB.markAssessmentComplete(clientId);
    toast('Avaliação marcada como concluída.');
    render();
  });
}

function render() {
  content.innerHTML = shell(RENDERERS[activeTab]());
  content.querySelectorAll('[data-tab]').forEach((btn) => {
    btn.addEventListener('click', () => { activeTab = btn.dataset.tab; render(); });
  });
  wireTabEvents();
}

render();
