// Templates library (Canva links per deliverable) — Nay edits it on
// admin/assistente.js (Templates), the assistant reads it on
// assistant/templates.js. It used to live only in MockDB (this browser's
// localStorage), so a link Nay saved on her computer never reached the
// assistant's. In production it is the real template_items table
// (grouped by template_category_groups.category_key, same keys as
// TEMPLATE_CATEGORIES); demo/staging keeps MockDB. The seeded rows carry
// "PLACEHOLDER" Canva URLs — those count as "not set yet".
import { MockDB } from './mock-db.js';
import { supabase } from './supabase-client.js';
import { isProductionEnvironment } from './environment.js';

const isPlaceholder = (url) => !url || /PLACEHOLDER/i.test(url);

// → { [categoryKey]: { [itemKey]: url } }
export async function loadTemplateLibrary() {
  if (!isProductionEnvironment()) return MockDB.getTemplateLibrary();
  const { data, error } = await supabase.from('template_items').select('item_key, url, template_category_groups(category_key)');
  if (error) throw new Error(error.message);
  const library = {};
  (data || []).forEach((row) => {
    const cat = row.template_category_groups?.category_key;
    if (!cat) return;
    library[cat] = library[cat] || {};
    library[cat][row.item_key] = isPlaceholder(row.url) ? '' : row.url;
  });
  return library;
}

export async function saveTemplateLink(categoryKey, itemKey, url) {
  if (!isProductionEnvironment()) { MockDB.setTemplateLink(categoryKey, itemKey, url); return { ok: true }; }
  const { data: groups, error: gErr } = await supabase.from('template_category_groups').select('id').eq('category_key', categoryKey);
  if (gErr || !groups?.length) return { error: gErr?.message || 'Categoria não encontrada.' };
  const { data: updated, error } = await supabase.from('template_items')
    .update({ url: (url || '').trim() || null })
    .eq('item_key', itemKey).in('group_id', groups.map((g) => g.id))
    .select('id');
  if (error) return { error: error.message };
  if (!updated?.length) return { error: 'Modelo não encontrado.' };
  return { ok: true };
}
