// Projeto de Imagem materials (image_guides, one row per client + slug).
//   E3 — what Nay chooses per student (client_encounter_plans.e3_items;
//        null = E3_DEFAULT). She can also add her own items (custom_…,
//        named in image_guides.label).
//   E4 — Ensaio Fotográfico (moodboard_ensaio): Pinterest moodboard, Canva
//        and/or PDF — whichever is filled shows to the student.
// The assistant prepares any of them; only Nay delivers (delivered_at,
// enforced by a database trigger), and the student reads a row only after.
export const GUIDE_LABELS = {
  paleta_cores: 'Cartela de Cores',
  guia_producoes_completo: 'Guia de Produções',
  guia_looks_mensal: 'Guia de Produções (Mensal)', // older, kept for existing rows
  ferramentas_nova_imagem: 'Ferramentas para Nova Imagem',
  moodboard_ensaio: 'Ensaio Fotográfico',
};
export const ENSAIO_SLUG = 'moodboard_ensaio';
// What Nay can tick for E3 (custom items come on top).
export const E3_OPTIONS = ['paleta_cores', 'guia_producoes_completo', 'ferramentas_nova_imagem'];
export const E3_DEFAULT = ['paleta_cores', 'guia_producoes_completo'];

export const guideLabel = (slug, row) => row?.label || GUIDE_LABELS[slug] || slug;
export const hasGuideContent = (row) => !!(row?.file_url || row?.canva_url || row?.file_path || row?.pinterest_url);

// The E3 slugs for this student, in order. Without a saved choice: the
// default plus any older item that already has material (so nothing a
// student already received disappears).
export function e3Slugs(plan, guideBySlug = {}) {
  if (Array.isArray(plan?.e3_items)) return plan.e3_items;
  const extra = Object.values(guideBySlug)
    .filter((g) => g && g.slug !== ENSAIO_SLUG && !E3_DEFAULT.includes(g.slug) && hasGuideContent(g))
    .map((g) => g.slug);
  return [...E3_DEFAULT, ...extra];
}

// Every link of a guide, for the student and the team: Pinterest, Canva,
// uploaded file (signedUrl) and the plain link.
const okUrl = (u) => /^https?:\/\//i.test(String(u || '').trim());
export function guideLinks(row, signedUrl = null) {
  const out = [];
  if (okUrl(row?.pinterest_url)) out.push({ kind: 'pinterest', label: 'Moodboard no Pinterest', url: row.pinterest_url });
  if (okUrl(row?.canva_url)) out.push({ kind: 'canva', label: 'Abrir no Canva', url: row.canva_url });
  if (signedUrl) out.push({ kind: 'file', label: /\.pdf$/i.test(row?.file_name || '') ? 'Abrir PDF' : 'Abrir arquivo', url: signedUrl });
  if (okUrl(row?.file_url)) out.push({ kind: 'link', label: 'Abrir link', url: row.file_url });
  return out;
}
