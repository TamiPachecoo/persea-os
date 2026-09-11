// Production Data Migration — Batch 3, Priority 3: converted off MockDB
// mock-storage (data URLs in localStorage) onto real Supabase Storage +
// the real `images` table.
//   - Uploads go to the private `client-uploads` bucket (RLS added this
//     pass), path `${clientId}/images/${timestamp}-${filename}` — the
//     client_id path segment is exactly what storage RLS checks.
//   - `images` table stores the STORAGE PATH in file_url (not a public
//     URL — the bucket is private), one row per uploaded file.
//   - Since the bucket is private, display uses a short-lived signed URL
//     (createSignedUrl) per thumbnail rather than a public/direct URL.
//   - The overall request status/note (aguardando_envio, novas_solicitadas,
//     etc.) has no separate table — it's real columns directly on
//     `clients` (images_status, images_note), already available via
//     client-context.js's real `client` row.
//   - image_guides/digital_kits have no explicit status column in the real
//     schema; "delivered" is delivered_at IS NOT NULL — the closest honest
//     real-data equivalent of MockDB's status === 'delivered' check.
//   - Hubla access status: clients.hubla_access_status (also already on
//     the real client row).
import { getCurrentClientContext } from '../shared/client-context.js';
import { supabase } from '../shared/supabase-client.js';
import { renderShell, card, toast, initClientSwitcher, formatDateTime, isValidHttpUrl, externalLinkAttrs, hublaHref } from '../shared/ui.js';

const MAX_FILE_MB = 8;
const IMAGE_STATUS_LABEL = {
  aguardando_envio: 'Aguardando Envio', envio_iniciado: 'Envio Iniciado', enviado: 'Enviado',
  em_analise: 'Em Análise', novas_solicitadas: 'Novas Solicitadas', aprovado: 'Aprovado',
};
const IMAGE_STATUS_BADGE = {
  aguardando_envio: 'badge-locked', envio_iniciado: 'badge-progress', enviado: 'badge-progress',
  em_analise: 'badge-progress', novas_solicitadas: 'badge-locked', aprovado: 'badge-completed',
};

const __clientCtx = await getCurrentClientContext('../login.html', { page: 'images' });
if (!__clientCtx) throw new Error('not authorized');
const clientId = __clientCtx.clientId;
const client = __clientCtx.client;
document.body.innerHTML = renderShell({ role: 'client', active: 'program.html', title: 'Imagens' });
initClientSwitcher();
const content = document.getElementById('app-content');

let uploadingCount = 0;
const BUCKET = 'client-uploads';

async function loadImages() {
  const { data } = await supabase.from('images').select('*').eq('client_id', clientId).order('uploaded_at', { ascending: false });
  const rows = data || [];
  const signed = await Promise.all(rows.map((r) => supabase.storage.from(BUCKET).createSignedUrl(r.file_url, 3600)));
  return rows.map((r, i) => ({ ...r, signedUrl: signed[i]?.data?.signedUrl || null }));
}

async function handleFiles(fileList) {
  const files = Array.from(fileList);
  for (const file of files) {
    if (!file.type.startsWith('image/')) { toast(`"${file.name}" não é uma imagem.`, { tone: 'error' }); continue; }
    if (file.size > MAX_FILE_MB * 1024 * 1024) { toast(`"${file.name}" passa de ${MAX_FILE_MB}MB.`, { tone: 'error' }); continue; }

    uploadingCount++;
    render();
    const path = `${clientId}/images/${Date.now()}-${file.name}`;
    const { error: uploadErr } = await supabase.storage.from(BUCKET).upload(path, file);
    if (uploadErr) {
      toast(`Não foi possível enviar "${file.name}".`, { tone: 'error' });
      uploadingCount--;
      render();
      continue;
    }
    const { error: insertErr } = await supabase.from('images').insert({ client_id: clientId, file_name: file.name, file_url: path });
    if (insertErr) toast(`"${file.name}" foi enviada, mas houve um erro ao registrá-la.`, { tone: 'error' });
    uploadingCount--;
    render();
  }
  if (files.length) toast('Envio concluído!');
}

// Guides, Digital Kit and Hubla access — the assistant's deliverables built
// from these very photos. Only ever shows what's actually ready.
async function renderDeliveredMaterials() {
  const [{ data: guides }, { data: kit }] = await Promise.all([
    supabase.from('image_guides').select('*').eq('client_id', clientId).not('delivered_at', 'is', null),
    supabase.from('digital_kits').select('*').eq('client_id', clientId).maybeSingle(),
  ]);
  const hublaGranted = client.hubla_access_status === 'granted';
  if (!(guides && guides.length) && !kit?.delivered_at && !hublaGranted) return '';

  return card(`
    <p class="text-sm text-white/50 mb-4">Guias e Materiais da Nay</p>
    <div class="space-y-1">
      ${(guides || []).filter((g) => isValidHttpUrl(g.file_url)).map((g) => `
        <a ${externalLinkAttrs(g.file_url)} class="flex items-center justify-between py-2 border-b border-white/5 last:border-0 hover:bg-white/5 -mx-2 px-2 rounded transition-colors">
          <span>${g.summary || g.slug}</span>
          <span class="badge badge-completed">Entregue</span>
        </a>
      `).join('')}
      ${kit?.delivered_at && isValidHttpUrl(kit.file_url) ? `
        <a ${externalLinkAttrs(kit.file_url)} class="flex items-center justify-between py-2 border-b border-white/5 last:border-0 hover:bg-white/5 -mx-2 px-2 rounded transition-colors">
          <span>Kit Digital — template editável para o Instagram</span>
          <span class="badge badge-completed">Entregue</span>
        </a>
      ` : ''}
      ${hublaGranted ? `
        <a ${externalLinkAttrs(hublaHref())} class="flex items-center justify-between py-2 hover:bg-white/5 -mx-2 px-2 rounded transition-colors">
          <span>Acesso à plataforma Hubla</span>
          <span class="badge badge-completed">Concedido ↗</span>
        </a>
      ` : ''}
    </div>
  `, 'mb-6');
}

async function loadPhotoReminder() {
  const { data } = await supabase.from('photo_reminders').select('*').eq('client_id', clientId).maybeSingle();
  return data;
}

async function render() {
  const [images, reminder, deliveredMaterialsHtml] = await Promise.all([loadImages(), loadPhotoReminder(), renderDeliveredMaterials()]);
  const status = client.images_status || 'aguardando_envio';
  const note = client.images_note;

  content.innerHTML = `
    <a href="program.html" class="btn-text mb-6 inline-block">&larr; Seu Programa</a>
    ${deliveredMaterialsHtml}
    ${reminder?.sent_at && status !== 'aprovado' ? card(`
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
            ${img.signedUrl
              ? `<img src="${img.signedUrl}" alt="${img.file_name}" style="width:100%; aspect-ratio:3/4; object-fit:cover; display:block;" />`
              : `<div style="width:100%; aspect-ratio:3/4; display:flex; align-items:center; justify-content:center; background:var(--card); color:var(--muted); font-size:11px;">Pré-visualização indisponível</div>`}
            <button type="button" data-remove-image="${img.id}" data-remove-path="${img.file_url}" class="absolute" style="top:6px; right:6px; width:24px; height:24px; border-radius:50%; background:rgba(12,10,9,.7); color:var(--cream); border:none; cursor:pointer; font-size:13px;" title="Remover" aria-label="Remover ${img.file_name}">×</button>
            <p class="absolute text-xs px-1.5 py-0.5" style="bottom:4px; left:4px; background:rgba(12,10,9,.7); border-radius:3px; color:var(--muted);">${formatDateTime(img.uploaded_at)}</p>
          </div>
        `).join('')}
      </div>
    ` : '<p class="text-sm" style="color:var(--muted);" class="mb-6">Nenhuma imagem enviada ainda.</p>'}

    ${note ? card(`
      <p class="text-sm text-white/50 mb-2">Observação registrada</p>
      <p class="text-sm text-white/70">${note}</p>
    `) : ''}
  `;

  content.querySelector('#drop-zone').addEventListener('click', (e) => {
    if (e.target.id !== 'file-input') content.querySelector('#file-input').click();
  });
  content.querySelector('#file-input').addEventListener('change', (e) => { handleFiles(e.target.files); e.target.value = ''; });
  content.querySelectorAll('[data-remove-image]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      await supabase.storage.from(BUCKET).remove([btn.dataset.removePath]);
      await supabase.from('images').delete().eq('id', btn.dataset.removeImage);
      render();
    });
  });
  // Client-submitted notes here were, until now, freeform (MockDB). The
  // real column (clients.images_note) sits on the broad `clients` table,
  // which has no client-self-write policy anywhere in this schema
  // (correctly — that table holds far more than this one field). Rather
  // than grant a wide write just for this, the note is shown read-only
  // (set by staff) until a narrow, explicit policy for this one column is
  // deliberately added — see the report for this pass.
}

render();
