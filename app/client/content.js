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
// Ascensão da Marca (and any future non-Persea program): she gets the
// Hubla categories + whatever Nay/team specifically recommends to her
// (resource_assignments) — same as everyone — but never the Drive-hosted
// recorded classes (resources.general_audience), which are a Persea-only
// benefit per spec.
const isPersea = __clientCtx.client?.program_slug?.startsWith('persea') ?? true;
document.body.innerHTML = renderShell({ role: 'client', program: __clientCtx?.client?.program_slug, active: 'content.html', title: 'Conteúdos' });
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

// Aulas Gravadas — real gap found: resources_client_read RLS already
// grants any client SELECT the moment general_audience=true (confirmed
// via pg_policies), but nothing here ever queried for that — only
// per-client resource_assignments (above) was ever shown. This is what a
// class Nay records on Google Meet and links (via admin/content.js's
// Biblioteca de Aulas, real now — the same `resources` row, just
// general_audience=true instead of assigned to one client) actually looks
// like once a real client opens Conteúdos.
//
// Big, image-forward poster cards per explicit feedback ("feel like
// Netflix") — reuses the EXACT same real component the gateway cards
// above already use (contentCardInner + .content-card/.content-grid,
// shared/ui.js/theme.css) instead of a smaller, inconsistent card of its
// own: same 3:4 poster aspect ratio, gradient title overlay, hover lift,
// mobile horizontal-scroll-snap — one visual language for "premium card
// that opens something," not two. contentCardInner's shape
// (title/description/hublaUrl/coverImage) is mapped from the real columns
// exactly like categoryCard already does above.
function recordedClassCard(r) {
  const label = `Assistir "${r.title}"`;
  const shaped = { title: r.title, description: r.description, hublaUrl: r.hubla_url, coverImage: r.cover_image_url, coverTone: r.cover_tone };
  return `<a ${externalLinkAttrs(hublaHref(r.hubla_url))} class="content-card" aria-label="${label}">${contentCardInner(shaped, 'Assistir')}</a>`;
}

async function recordedClassesSection() {
  const { data: resources } = await supabase.from('resources').select('*').eq('general_audience', true).order('created_at', { ascending: false });
  if (!resources || !resources.length) return '';
  return `
    <div class="mb-10">
      <p class="text-sm text-white/50 mb-4">Aulas Gravadas</p>
      <div class="content-grid">${resources.map(recordedClassCard).join('')}</div>
    </div>
  `;
}

async function render() {
  const [{ data: categories }, { data: tenant }, recommendedHtml, recordedClassesHtml] = await Promise.all([
    supabase.from('content_categories').select('*').eq('is_visible', true).order('display_order'),
    supabase.from('tenant_settings').select('hubla_all_content_url').limit(1).maybeSingle(),
    recommendedSection(),
    isPersea ? recordedClassesSection() : Promise.resolve(''),
  ]);

  content.innerHTML = `
    <div class="mb-10">
      <p class="text-white/40 text-sm mb-1">Central de Conteúdos</p>
      <h1 class="text-3xl font-serif">${isPersea ? 'Conteúdos da Metodologia PERSEA' : 'Seus Conteúdos'}</h1>
      <p class="text-sm text-white/40 mt-2 mb-5 max-w-xl">Acesse suas aulas e materiais disponíveis na Hubla.</p>
      ${heroCta(tenant?.hubla_all_content_url)}
    </div>

    ${recommendedHtml}

    ${categories && categories.length ? `
      <div class="content-grid">${categories.map(categoryCard).join('')}</div>
    ` : card('<p class="text-sm text-white/30">Ainda não há conteúdos disponíveis — volte em breve.</p>')}

    ${recordedClassesHtml}
  `;
}

render();
