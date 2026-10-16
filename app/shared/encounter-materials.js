// Materials Nay releases at a specific encounter: Guia de Posicionamento
// at E2 and Kit Digital at E4. Each lives in its own one-row-per-client
// table (positioning_guides, digital_kits); an uploaded file goes to the
// private client-shared-files bucket under <client>/materials/, and
// delivered_at is "Liberado para a cliente" (admin-only, enforced in the
// database; the student only reads the row once it's set).
// Meetings are matched by title ("E2 — …"), the way agenda items are named.
export const ENCOUNTER_MATERIALS = {
  2: { key: 'guia', table: 'positioning_guides', label: 'Guia de Posicionamento' },
  4: { key: 'kit', table: 'digital_kits', label: 'Kit Digital' },
};
export const MATERIALS_BUCKET = 'client-shared-files';

export function encounterNumber(title) {
  const m = String(title || '').match(/^\s*E(\d+)\b/i);
  return m ? Number(m[1]) : null;
}

// → { guia: {row, url}, kit: {row, url} } — url = signed link to the
// uploaded file (1h), or the row's external link.
export async function loadEncounterMaterials(supabase, clientId) {
  const out = {};
  await Promise.all(Object.values(ENCOUNTER_MATERIALS).map(async (def) => {
    const { data: row } = await supabase.from(def.table).select('*').eq('client_id', clientId).maybeSingle();
    let url = null;
    if (row?.file_path) {
      const { data } = await supabase.storage.from(MATERIALS_BUCKET).createSignedUrl(row.file_path, 3600);
      url = data?.signedUrl || null;
    } else if (row?.file_url && /^https?:\/\//i.test(row.file_url)) {
      url = row.file_url;
    }
    out[def.key] = { row: row || null, url };
  }));
  return out;
}
