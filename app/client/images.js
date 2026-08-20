// Imagens — mobile-friendly multi-image upload for the initial photos the
// team requested. Mock storage: files are read as data URLs and kept in
// localStorage (see MockDB.addClientImage) — clearly a prototype
// convention, same as homework.js's media submissions. A real build would
// swap this for real object storage without touching this screen's shape.
import { MockDB, getActiveClientId, IMAGE_STATUS_LABEL, GUIDE_STATUS_LABEL, HUBLA_STATUS_LABEL } from '../shared/mock-db.js';
import { renderShell, card, toast, initClientSwitcher, formatDateTime, isValidHttpUrl, externalLinkAttrs } from '../shared/ui.js';

const MAX_FILE_MB = 8;
const IMAGE_STATUS_BADGE = {
  aguardando_envio: 'badge-locked', envio_iniciado: 'badge-progress', enviado: 'badge-progress',
  em_analise: 'badge-progress', novas_solicitadas: 'badge-locked', aprovado: 'badge-completed',
};

const clientId = getActiveClientId();
document.body.innerHTML = renderShell({ role: 'client', active: 'program.html', title: 'Imagens' });
initClientSwitcher();
const content = document.getElementById('app-content');

let uploadingCount = 0;

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function handleFiles(fileList) {
  const { images: existing } = MockDB.getClientImages(clientId);
  const files = Array.from(fileList);
  for (const file of files) {
    if (!file.type.startsWith('image/')) { toast(`"${file.name}" não é uma imagem.`, { tone: 'error' }); continue; }
    if (file.size > MAX_FILE_MB * 1024 * 1024) { toast(`"${file.name}" passa de ${MAX_FILE_MB}MB.`, { tone: 'error' }); continue; }
    // Reduce accidental duplicates: same name + size already present.
    if (existing.some((i) => i.fileName === file.name)) { toast(`"${file.name}" já foi enviada.`, { tone: 'error' }); continue; }

    uploadingCount++;
    render();
    const dataUrl = await fileToDataUrl(file);
    // Brief, honest simulation of upload time — there's no real network
    // call happening in this prototype, but a 0ms "upload" reads as broken.
    await new Promise((r) => setTimeout(r, 500));
    MockDB.addClientImage(clientId, { dataUrl, fileName: file.name });
    uploadingCount--;
    render();
  }
  if (files.length) toast('Envio concluído!');
}

// Guides, Digital Kit and Hubla access — the assistant's deliverables built
// from these very photos. Only ever shows what's actually ready: in-review
// items stay invisible to the client until Nay approves them (see
// approveReview in mock-db.js), so there's nothing here to manage the
// client's expectations around — if it's on this page, it's hers to use.
function renderDeliveredMaterials() {
  const guides = MockDB.getImageGuides(clientId).filter((g) => g.status === 'delivered');
  const kit = MockDB.getDigitalKit(clientId);
  const hubla = MockDB.getHublaAccess(clientId);
  if (!guides.length && kit.status !== 'delivered' && hubla.status !== 'granted') return '';

  return card(`
    <p class="text-sm text-white/50 mb-4">Guias e Materiais da Nay</p>
    <div class="space-y-1">
      ${guides.filter((g) => isValidHttpUrl(g.fileUrl)).map((g) => `
        <a ${externalLinkAttrs(g.fileUrl)} class="flex items-center justify-between py-2 border-b border-white/5 last:border-0 hover:bg-white/5 -mx-2 px-2 rounded transition-colors">
          <span>${g.label}</span>
          <span class="badge badge-completed">${GUIDE_STATUS_LABEL.delivered}</span>
        </a>
      `).join('')}
      ${kit.status === 'delivered' && isValidHttpUrl(kit.fileUrl) ? `
        <a ${externalLinkAttrs(kit.fileUrl)} class="flex items-center justify-between py-2 border-b border-white/5 last:border-0 hover:bg-white/5 -mx-2 px-2 rounded transition-colors">
          <span>Kit Digital — template editável para o Instagram</span>
          <span class="badge badge-completed">${GUIDE_STATUS_LABEL.delivered}</span>
        </a>
      ` : ''}
      ${hubla.status === 'granted' ? `
        <div class="flex items-center justify-between py-2">
          <span>Acesso à plataforma Hubla</span>
          <span class="badge badge-completed">${HUBLA_STATUS_LABEL.granted}</span>
        </div>
      ` : ''}
    </div>
  `, 'mb-6');
}

function render() {
  const { images, status, note } = MockDB.getClientImages(clientId);
  const guide = MockDB.getActivityGuide();
  const reminder = MockDB.getPhotoReminder(clientId);

  content.innerHTML = `
    <a href="program.html" class="btn-text mb-6 inline-block">&larr; Seu Programa</a>
    ${renderDeliveredMaterials()}
    ${reminder.sentAt && status !== 'aprovado' ? card(`
      <p class="text-sm font-medium mb-1" style="color:var(--terracotta);">🔔 A equipe está aguardando suas fotos</p>
      <p class="text-sm text-white/50">${reminder.note || 'Envie suas fotos para que possamos seguir com o Projeto de Imagem, o Guia de Produções e o Mood Fotográfico.'}</p>
    `, 'mb-6') : ''}
    <div class="flex items-center justify-between flex-wrap gap-3 mb-2">
      <p class="text-sm text-white/40 max-w-xl">Envie as imagens solicitadas para que a equipe possa iniciar sua análise.</p>
      <span class="badge ${IMAGE_STATUS_BADGE[status]}">${IMAGE_STATUS_LABEL[status]}</span>
    </div>

    ${status === 'novas_solicitadas' ? card(`
      <p class="text-sm font-medium mb-1" style="color:var(--terracotta);">A equipe pediu novas imagens</p>
      <p class="text-sm text-white/50">${note || 'Envie novas fotos seguindo as orientações do guia.'}</p>
    `, 'mb-6') : ''}

    ${card(`
      <div class="flex items-center justify-between mb-3">
        <p class="text-sm text-white/50">Antes de enviar</p>
        <a href="activity-guide.html" class="btn-text">Ver Guia de Atividades</a>
      </div>
      <p class="text-xs text-white/30">O guia mostra como enquadrar, iluminar e preparar as fotos antes do envio.</p>
    `, 'mb-6')}

    ${card(`
      <label id="drop-zone" class="block text-center py-10 rounded cursor-pointer" style="border:1.5px dashed var(--line);">
        <input type="file" id="file-input" accept="image/*" multiple class="hidden" />
        <p class="text-lg font-serif mb-1">Toque para enviar imagens</p>
        <p class="text-xs text-white/30">Envie quantas imagens forem necessárias — JPG ou PNG, até ${MAX_FILE_MB}MB cada.</p>
      </label>
      ${uploadingCount > 0 ? `
        <div class="mt-4 flex items-center gap-3">
          <div class="progress-track flex-1"><div class="progress-fill" style="width:60%;"></div></div>
          <span class="text-xs text-white/30">Enviando ${uploadingCount}…</span>
        </div>
      ` : ''}
    `, 'mb-6')}

    ${images.length ? `
      <p class="text-xs uppercase mb-3" style="color:var(--muted); letter-spacing:.1em;">Enviadas (${images.length})</p>
      <div class="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
        ${images.map((img) => `
          <div class="relative" style="border-radius:4px; overflow:hidden; border:1px solid var(--line);">
            <img src="${img.dataUrl}" alt="${img.fileName}" style="width:100%; aspect-ratio:3/4; object-fit:cover; display:block;" />
            <button type="button" data-remove-image="${img.id}" class="absolute" style="top:6px; right:6px; width:24px; height:24px; border-radius:50%; background:rgba(12,10,9,.7); color:var(--cream); border:none; cursor:pointer; font-size:13px;" title="Remover" aria-label="Remover ${img.fileName}">×</button>
            <p class="absolute text-xs px-1.5 py-0.5" style="bottom:4px; left:4px; background:rgba(12,10,9,.7); border-radius:3px; color:var(--muted);">${formatDateTime(img.uploadedAt)}</p>
          </div>
        `).join('')}
      </div>
    ` : ''}

    ${card(`
      <label class="text-sm text-white/50 block mb-2">Alguma observação para a equipe? <span class="text-white/20 text-xs">(opcional)</span></label>
      <textarea id="images-note" rows="2" class="field" placeholder="Ex.: essas fotos foram tiradas com pouca luz, avisem se precisar refazer.">${note || ''}</textarea>
    `)}
  `;

  content.querySelector('#drop-zone').addEventListener('click', (e) => {
    if (e.target.id !== 'file-input') content.querySelector('#file-input').click();
  });
  content.querySelector('#file-input').addEventListener('change', (e) => { handleFiles(e.target.files); e.target.value = ''; });
  content.querySelectorAll('[data-remove-image]').forEach((btn) => {
    btn.addEventListener('click', () => { MockDB.removeClientImage(clientId, btn.dataset.removeImage); render(); });
  });
  content.querySelector('#images-note').addEventListener('blur', (e) => { MockDB.setClientImagesNote(clientId, e.target.value); });
}

render();
