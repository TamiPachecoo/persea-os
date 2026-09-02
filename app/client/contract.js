// Client's contract status — signing happens on an external e-signature
// platform, not in this app, so this page is read-only: what's happening
// with her contract, and a download link once the signed document is back.
import { supabase } from '../shared/supabase-client.js';
import { requireProfile } from '../shared/supabase-auth.js';
import { card } from '../shared/ui.js';

const content = document.getElementById('app-content');
const profile = await requireProfile('client');
if (!profile) throw new Error('not authorized');

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

async function render() {
  const { data: contract } = await supabase.from('contracts').select('*').eq('client_id', profile.client_id).maybeSingle();

  if (!contract || !contract.body_text) {
    content.innerHTML = card(`<p class="text-sm text-white/50">Seu contrato ainda está sendo preparado — volte aqui em breve.</p>`);
    return;
  }

  if (['signed', 'completed'].includes(contract.status) && contract.signed_file_path) {
    const [{ data: viewUrl }, { data: downloadUrl }] = await Promise.all([
      supabase.storage.from('signed-contracts').createSignedUrl(contract.signed_file_path, 3600),
      supabase.storage.from('signed-contracts').createSignedUrl(contract.signed_file_path, 3600, { download: contract.signed_file_name || true }),
    ]);
    content.innerHTML = `
      <div class="mb-8">
        <p class="text-white/40 text-sm mb-1">Contrato</p>
        <h1 class="text-3xl font-serif">Assinado ✓</h1>
      </div>
      ${card(`
        <p class="text-sm mb-4" style="color:var(--gold);">Seu contrato foi assinado e está disponível abaixo.</p>
        <div class="flex items-center gap-3">
          ${viewUrl ? `<a href="${viewUrl.signedUrl}" target="_blank" rel="noopener" class="btn-ghost inline-block">Visualizar ↗</a>` : ''}
          ${downloadUrl ? `<a href="${downloadUrl.signedUrl}" class="btn-primary inline-block">Baixar Contrato Assinado</a>` : ''}
        </div>
      `)}
    `;
    return;
  }

  if (['sent_for_signature', 'awaiting_signature'].includes(contract.status)) {
    content.innerHTML = `
      <div class="mb-8">
        <p class="text-white/40 text-sm mb-1">Contrato</p>
        <h1 class="text-3xl font-serif">Em processo de assinatura</h1>
      </div>
      ${card(`<p class="text-sm text-white/50">Seu contrato foi enviado para assinatura — assim que estiver concluído, o documento assinado aparecerá aqui.</p>`, 'mb-6')}
      ${card(`
        <p class="text-sm text-white/50 mb-3">Prévia do contrato</p>
        <div style="max-height:50vh; overflow-y:auto; border:1px solid var(--line); border-radius:8px; padding:16px;">
          <pre class="text-sm whitespace-pre-wrap" style="font-family:inherit; line-height:1.7;">${escapeHtml(contract.body_text)}</pre>
        </div>
      `)}
    `;
    return;
  }

  content.innerHTML = card(`<p class="text-sm text-white/50">Seu contrato está sendo finalizado pela equipe — assim que estiver pronto, você será avisada.</p>`);
}

render();
