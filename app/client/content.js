// Production Data Migration — Batch 3, Priority 5: converted off MockDB
// onto real Supabase metadata. Still a pure gateway to Hubla — PERSEA does
// not host course content — but the category cards/recommendations now
// come from real `content_categories`/`resources`/`resource_assignments`/
// `tenant_settings` instead of MockDB fixtures. Every access CTA still
// routes through hublaHref() (falls back to https://app.hub.la/ when a
// specific category/resource has no configured link yet) — never a fake
// internal lesson page.
import { getCurrentClientContext } from '../shared/client-context.js';
import { supabase } from '../shared/supabase-client.js';
import {
  renderShell, card, initClientSwitcher, externalLinkAttrs,
  contentCardInner, hublaHref,
} from '../shared/ui.js';

const __clientCtx = await getCurrentClientContext('../login.html', { page: 'content' });
if (!__clientCtx) throw new Error('not authorized');
const activeClientId = __clientCtx.clientId;
document.body.innerHTML = renderShell({ role: 'client', active: 'content.html', title: 'Conteúdos' });
initClientSwitcher();

const content = document.getElementById('app-content');

function heroCta(url) {
  return `<a ${externalLinkAttrs(hublaHref(url))} class="btn-primary inline-block">Abrir todos os conteúdos na Hubla</a>`;
}

function categoryCard(cat) {
  const label = `Acessar ${cat.title} na Hubla (abre em nova aba)`;
  // contentCardInner reads cat.hublaUrl/coverImage (its established shape)
  // — mapped from the real columns here rather than changing that shared
  // helper's contract, which admin/content.js also depends on.
  const shaped = { title: cat.title, description: cat.description, hublaUrl: cat.hubla_url, coverImage: cat.cover_image_url, coverTone: cat.cover_tone };
  return `<a ${externalLinkAttrs(hublaHref(cat.hubla_url))} class="content-card" aria-label="${label}">${contentCardInner(shaped)}</a>`;
}

async function recommendedSection() {
  const { data: assignments } = await supabase.from('resource_assignments')
    .select('*, resources(*)').eq('client_id', activeClientId).eq('completed', false);
  if (!assignments || !assignments.length) return '';
  return `
    <div class="mb-10">
      <p class="text-sm text-white/50 mb-4">Recomendado para você</p>
      <div class="grid md:grid-cols-2 gap-4">
        ${assignments.map((a) => card(`
          <p class="font-medium text-sm mb-1">${a.resources?.title || ''}</p>
          ${a.reason ? `<p class="text-xs text-white/40 mb-3">${a.reason}</p>` : ''}
          <a ${externalLinkAttrs(hublaHref(a.resources?.hubla_url))} class="btn-ghost inline-block" style="padding:8px 14px; font-size:12px;">Abrir na Hubla ↗</a>
        `)).join('')}
      </div>
    </div>
  `;
}

async function render() {
  const [{ data: categories }, { data: tenant }, recommendedHtml] = await Promise.all([
    supabase.from('content_categories').select('*').eq('is_visible', true).order('display_order'),
    supabase.from('tenant_settings').select('hubla_all_content_url').limit(1).maybeSingle(),
    recommendedSection(),
  ]);

  content.innerHTML = `
    <div class="mb-10">
      <p class="text-white/40 text-sm mb-1">Central de Conteúdos</p>
      <h1 class="text-3xl font-serif">Conteúdos da Metodologia PERSEA</h1>
      <p class="text-sm text-white/40 mt-2 mb-5 max-w-xl">Acesse suas aulas e materiais disponíveis na Hubla.</p>
      ${heroCta(tenant?.hubla_all_content_url)}
    </div>

    ${recommendedHtml}

    ${categories && categories.length ? `
      <div class="content-grid">${categories.map(categoryCard).join('')}</div>
    ` : card('<p class="text-sm text-white/30">Ainda não há conteúdos disponíveis — volte em breve.</p>')}
  `;
}

render();
