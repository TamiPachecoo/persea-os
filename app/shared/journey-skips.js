// Per-client journey adjustments: phases a client skips (clients.
// skipped_phases, 0-based like phase_index — e.g. [1] = "Fase 2 · Imagem e
// estratégia"). A skipped phase's encounters and activities don't apply to
// her: they're left out of her journey, her progress and her encounter
// sequence (E2 is followed by E4 when Fase 2 is skipped). Skipping Fase 2
// also drops the two image activities that only exist to feed it (Análise
// da Imagem Atual, Upload das Imagens) even though they sit in Fase 1.
// Set by Nay on the client's page (Jornada → "Fases da jornada dela").
export const IMAGE_PHASE = 1;
export const IMAGE_ACTIVITY_SLUGS = ['activity-guide', 'initial-images'];

export function skippedPhaseSet(client) {
  return new Set((client?.skipped_phases || []).map(Number));
}
export function isActivitySkipped(client, slug, phaseId) {
  const s = skippedPhaseSet(client);
  return s.has(Number(phaseId)) || (s.has(IMAGE_PHASE) && IMAGE_ACTIVITY_SLUGS.includes(slug));
}
// Encounter definitions that apply to her, in order (tier + skipped phases).
export function applicableEncounters(defs, client) {
  const s = skippedPhaseSet(client);
  return (defs || []).filter((d) => (client?.tier === 'premium' || !d.premium_only) && !s.has(Number(d.phase)));
}
