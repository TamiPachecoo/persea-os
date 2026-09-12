// Cadastro público (pré-ativação).
//
// Production Migration Batch 4: production now uses a real secure token
// flow, replacing MockDB's lead-token concept — but ONLY on
// app.naymurta.com. Staging (workers.dev/pages.dev) keeps the original
// MockDB lead-token demo flow (admin/lead-detail.js's
// MockDB.generateRegistrationLink still generates those links there), per
// explicit instruction not to delete staging fixtures.
//
// Production path deliberately does NOT query any table directly with the
// anon key — every read/write goes through two public Edge Functions
// (registration-token-info / registration-submit), which validate the
// token server-side (via a service-role client, never exposed here) and
// return only the minimum safe context.
//
// No shell/nav on either path — this is reached before any authentication
// exists, by design.
import { MockDB, PROGRAM_LABEL_BY_SLUG } from '../shared/mock-db.js';
import { renderParticles, toast, isProductionEnvironment } from '../shared/ui.js';
import { supabase } from '../shared/supabase-client.js';

const token = new URLSearchParams(location.search).get('token') || '';

document.body.innerHTML = `
  <div class="ambient"></div>
  <div class="grain"></div>
  <div id="particles-mount"></div>
  <div class="min-h-screen flex items-center justify-center px-4 py-12" style="position:relative; z-index:1;">
    <div class="w-full max-w-lg" id="reg-root"></div>
  </div>
`;
document.getElementById('particles-mount').innerHTML = renderParticles(14);
const root = document.getElementById('reg-root');

function maskCpf(v) {
  return v.replace(/\D/g, '').slice(0, 11)
    .replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}
function maskCnpj(v) {
  return v.replace(/\D/g, '').slice(0, 14)
    .replace(/(\d{2})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1/$2').replace(/(\d{4})(\d{1,2})$/, '$1-$2');
}
function maskPhone(v) {
  return v.replace(/\D/g, '').slice(0, 11)
    .replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{4,5})(\d{4})$/, '$1-$2');
}
function maskCep(v) {
  return v.replace(/\D/g, '').slice(0, 8).replace(/(\d{5})(\d{1,3})$/, '$1-$2');
}

function wireMasks() {
  root.querySelector('input[name="cpf"]')?.addEventListener('input', (e) => { e.target.value = maskCpf(e.target.value); });
  root.querySelector('input[name="cnpj"]')?.addEventListener('input', (e) => { e.target.value = maskCnpj(e.target.value); });
  root.querySelector('input[name="whatsapp"]')?.addEventListener('input', (e) => { e.target.value = maskPhone(e.target.value); });
  root.querySelector('input[name="cep"]')?.addEventListener('input', (e) => { e.target.value = maskCep(e.target.value); });
}

function confirmationView(fullName) {
  root.innerHTML = `
    <div class="card text-center">
      <p class="eyebrow mb-3">Cadastro recebido</p>
      <h1 class="font-serif text-2xl mb-4">Obrigada${fullName ? `, ${fullName.split(' ')[0]}` : ''}.</h1>
      <p class="text-sm" style="color:var(--muted); line-height:1.7;">Nossa equipe recebeu suas informações e seguirá com a preparação do seu contrato. Em breve você recebe os próximos passos.</p>
    </div>
  `;
}

function field(label, name, value, { type = 'text', required = true, placeholder = '', extra = '' } = {}) {
  return `
    <div>
      <label class="text-xs text-white/40 block mb-1">${label}</label>
      <input name="${name}" type="${type}" class="field" value="${value || ''}" placeholder="${placeholder}" ${required ? 'required' : ''} ${extra} />
    </div>
  `;
}

function formShell(headerEyebrow, info, fullNameFallback, emailFallback, idPrefix) {
  const isPJ = info.partyType === 'PJ' || info.party_type === 'PJ';
  return `
    <div class="card">
      <p class="eyebrow mb-2">${headerEyebrow}</p>
      <h1 class="font-serif text-2xl mb-2">Vamos finalizar seu cadastro</h1>
      <p class="text-sm mb-8" style="color:var(--muted); line-height:1.7;">Precisamos de alguns dados para preparar seu contrato e organizar sua entrada no Persea. Leva apenas alguns minutos.</p>

      <form id="registration-form" class="space-y-8">
        <div>
          <p class="text-xs uppercase mb-4" style="color:var(--gold); letter-spacing:.12em;">Seus dados</p>
          <div class="space-y-4">
            ${field('Nome completo', `${idPrefix}fullName`, info.fullName || info.full_name || fullNameFallback)}
            ${field('Nome social', `${idPrefix}socialName`, info.socialName || info.social_name, { required: false })}
            <div class="grid sm:grid-cols-2 gap-4">
              ${field('Data de nascimento', `${idPrefix}birthDate`, info.birthDate || info.birth_date, { type: 'date' })}
              <div>
                <label class="text-xs text-white/40 block mb-1">Tipo</label>
                <select name="${idPrefix}partyType" id="party-type" class="field">
                  <option value="PF" ${!isPJ ? 'selected' : ''}>Pessoa Física</option>
                  <option value="PJ" ${isPJ ? 'selected' : ''}>Pessoa Jurídica</option>
                </select>
              </div>
            </div>
            <div class="grid sm:grid-cols-2 gap-4">
              ${field('CPF', 'cpf', info.cpf, { placeholder: '000.000.000-00' })}
              ${field('RG', 'rg', info.rg, { required: false })}
            </div>
            <div id="company-field" style="display:${isPJ ? 'block' : 'none'};">
              <p class="text-xs mb-3" style="color:var(--muted);">Pessoa Jurídica exige razão social e CNPJ para o contrato.</p>
              ${field('Nome da empresa', `${idPrefix}companyName`, info.companyName || info.company_name, { required: isPJ })}
              ${field('CNPJ', 'cnpj', info.cnpj, { required: isPJ, placeholder: '00.000.000/0000-00' })}
            </div>
            <div class="grid sm:grid-cols-3 gap-4">
              ${field('Profissão', 'profession', info.profession)}
              ${field('Nacionalidade', 'nationality', info.nationality)}
              ${field('Estado civil', `${idPrefix}maritalStatus`, info.maritalStatus || info.marital_status, { required: false })}
            </div>
          </div>
        </div>

        <div>
          <p class="text-xs uppercase mb-4" style="color:var(--gold); letter-spacing:.12em;">Contato</p>
          <div class="grid sm:grid-cols-2 gap-4">
            ${field('Email', 'email', info.email || emailFallback, { type: 'email' })}
            ${field('WhatsApp', 'whatsapp', info.whatsapp, { placeholder: '(00) 00000-0000' })}
          </div>
        </div>

        <div>
          <p class="text-xs uppercase mb-4" style="color:var(--gold); letter-spacing:.12em;">Endereço</p>
          <div class="grid sm:grid-cols-2 gap-4 mb-4">
            ${field('CEP', 'cep', info.cep, { placeholder: '00000-000' })}
            ${field('Cidade', 'city', info.city)}
          </div>
          <div class="grid sm:grid-cols-[1fr_auto] gap-4 mb-4">
            ${field('Rua', 'street', info.street)}
            ${field('Número', 'number', info.number)}
          </div>
          <div class="grid sm:grid-cols-2 gap-4 mb-4">
            ${field('Complemento', 'complement', info.complement, { required: false })}
            ${field('Bairro', 'neighborhood', info.neighborhood)}
          </div>
          ${field('Estado', 'state', info.state, { placeholder: 'UF' })}
        </div>

        <button type="submit" class="btn-primary block w-full text-center" style="padding-top:13px;padding-bottom:13px;">Enviar meus dados</button>
      </form>
    </div>
  `;
}

// ==================== DEMO/STAGING — unchanged MockDB flow ====================
function invalidLinkViewDemo() {
  root.innerHTML = `
    <div class="card text-center">
      <p class="text-lg font-serif mb-2">Link inválido</p>
      <p class="text-sm" style="color:var(--muted);">Este link de cadastro não é válido ou já não está mais ativo. Fale com a equipe PERSEA para receber um novo link.</p>
    </div>
  `;
}

function formViewDemo(lead) {
  const info = lead.registrationInfo || {};
  const programLabel = lead.program ? (PROGRAM_LABEL_BY_SLUG[lead.program] || lead.program) : null;
  root.innerHTML = formShell(programLabel ? `Persea — ${programLabel}` : 'Persea', info, lead.fullName, lead.email, '');

  document.getElementById('party-type').addEventListener('change', (e) => { syncCompanyFieldRequired(e.target.value === 'PJ'); });
  function syncCompanyFieldRequired(isPJNow) {
    document.getElementById('company-field').style.display = isPJNow ? 'block' : 'none';
    document.querySelector('input[name="companyName"]').required = isPJNow;
    document.querySelector('input[name="cnpj"]').required = isPJNow;
  }
  syncCompanyFieldRequired(info.partyType === 'PJ');
  wireMasks();

  document.getElementById('registration-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const payload = Object.fromEntries(fd.entries());
    if (payload.partyType === 'PJ' && (!payload.companyName?.trim() || !payload.cnpj?.trim())) {
      toast('Pessoa Jurídica exige nome da empresa e CNPJ preenchidos.', { tone: 'error' });
      return;
    }
    MockDB.submitRegistration(token, payload);
    confirmationView(payload.fullName);
  });
}

function renderDemo() {
  const lead = MockDB.getLeadByToken(token);
  if (!lead) { invalidLinkViewDemo(); return; }
  if (lead.alreadySubmitted) { confirmationView(lead.registrationInfo?.fullName || lead.fullName); return; }
  formViewDemo(lead);
}

// ==================== PRODUCTION — real secure Edge Function flow ====================
function invalidLinkViewProduction(reason) {
  const detail = reason === 'expired'
    ? 'Este link expirou.'
    : reason === 'consumed'
      ? 'Este cadastro já foi enviado — se precisar alterar algo, fale com a equipe PERSEA.'
      : 'Este link de cadastro não é válido ou já não está mais ativo.';
  root.innerHTML = `
    <div class="card text-center">
      <p class="text-lg font-serif mb-2">${reason === 'consumed' ? 'Cadastro recebido' : 'Link inválido'}</p>
      <p class="text-sm" style="color:var(--muted);">${detail} Fale com a equipe PERSEA para receber um novo link, se necessário.</p>
    </div>
  `;
}

function formViewProduction(client, partyInfo) {
  const info = partyInfo || {};
  root.innerHTML = formShell('Persea', info, client.full_name, client.email, '');

  document.getElementById('party-type').addEventListener('change', (e) => { syncCompanyFieldRequired(e.target.value === 'PJ'); });
  function syncCompanyFieldRequired(isPJNow) {
    document.getElementById('company-field').style.display = isPJNow ? 'block' : 'none';
    document.querySelector('input[name="companyName"]').required = isPJNow;
    document.querySelector('input[name="cnpj"]').required = isPJNow;
  }
  syncCompanyFieldRequired(info.party_type === 'PJ');
  wireMasks();

  document.getElementById('registration-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const raw = Object.fromEntries(fd.entries());
    if (raw.partyType === 'PJ' && (!raw.companyName?.trim() || !raw.cnpj?.trim())) {
      toast('Pessoa Jurídica exige nome da empresa e CNPJ preenchidos.', { tone: 'error' });
      return;
    }
    // registration-submit's ALLOWED_FIELDS uses snake_case (real party_info
    // column names) — remap the shared form's camelCase field names here
    // rather than changing the Edge Function's contract to match one caller.
    const payload = {
      full_name: raw.fullName, social_name: raw.socialName, birth_date: raw.birthDate,
      party_type: raw.partyType, cpf: raw.cpf, rg: raw.rg, profession: raw.profession,
      nationality: raw.nationality, marital_status: raw.maritalStatus, cnpj: raw.cnpj,
      company_name: raw.companyName, email: raw.email, whatsapp: raw.whatsapp,
      cep: raw.cep, street: raw.street, number: raw.number, complement: raw.complement,
      neighborhood: raw.neighborhood, city: raw.city, state: raw.state,
    };
    const submitBtn = e.target.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    const { data, error } = await supabase.functions.invoke('registration-submit', { body: { token, ...payload } });
    submitBtn.disabled = false;
    if (error || data?.error) {
      toast(data?.error || 'Não foi possível enviar seus dados agora. Tente novamente.', { tone: 'error' });
      return;
    }
    confirmationView(data.full_name);
  });
}

async function renderProduction() {
  if (!token) { invalidLinkViewProduction(); return; }
  const { data, error } = await supabase.functions.invoke('registration-token-info', { body: { token } });
  if (error || !data?.valid) { invalidLinkViewProduction(data?.reason); return; }
  formViewProduction(data.client, data.party_info);
}

if (isProductionEnvironment()) {
  renderProduction();
} else {
  renderDemo();
}
