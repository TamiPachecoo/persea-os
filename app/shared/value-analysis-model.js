// Real Supabase persistence for Leitura Estratégica de Valor — the
// wizard's rendering/validation stays exactly as shared/value-analysis-
// schema.js already defines it (SECTIONS/OFFER_FIELDS/etc, unchanged, not
// duplicated); this module only replaces MockDB's in-memory read/write
// with real tables. The field-key naming convention is mechanically
// consistent across this whole schema (camelCase field.key <-> snake_case
// column, e.g. businessModel <-> business_model; every type:'currency'
// field's column additionally carries a _cents suffix and is stored as an
// integer, e.g. monthlyRevenue <-> monthly_revenue_cents) — verified
// against every real column before writing this, not assumed.
//
// Known, disclosed simplification: the wizard's per-field "Não sei
// informar" checkbox stores the sentinel string 'unknown' in MockDB. Real
// numeric/integer columns can't hold a string, and no per-field
// "_is_unknown" companion column exists in this schema (unlike
// monthlyRevenue, which has an explicit monthly_revenue_precision select –
// that one is unaffected). For every OTHER allowUnknown field, "unknown"
// is stored as NULL here — indistinguishable from "not answered yet". See
// the delivery report.
import { supabase } from './supabase-client.js';
import { SECTIONS, OFFER_FIELDS, FIXED_COST_FIELDS, VARIABLE_COST_FIELDS, REFERENCE_FIELDS } from './value-analysis-schema.js';

function toSnake(k) { return k.replace(/([A-Z])/g, '_$1').toLowerCase(); }
function toCamel(k) { return k.replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase()); }

// Every field.key across the whole schema that's type:'currency' — the
// _cents suffix + /100 (read) or *100 (write) scaling applies to exactly
// these, derived from the schema itself rather than a separately
// maintained list that could drift.
const CURRENCY_KEYS = new Set();
SECTIONS.forEach((s) => s.fields.forEach((f) => { if (f.type === 'currency') CURRENCY_KEYS.add(f.key); }));
[...OFFER_FIELDS, ...FIXED_COST_FIELDS, ...VARIABLE_COST_FIELDS, ...REFERENCE_FIELDS].forEach((f) => { if (f.type === 'currency') CURRENCY_KEYS.add(f.key); });

function columnFor(key) { return CURRENCY_KEYS.has(key) ? `${toSnake(key)}_cents` : toSnake(key); }
function fromDb(key, dbValue) {
  if (dbValue === null || dbValue === undefined) return dbValue;
  return CURRENCY_KEYS.has(key) ? dbValue / 100 : dbValue;
}
function toDb(key, uiValue) {
  if (uiValue === 'unknown') return null; // see module note above
  if (uiValue === null || uiValue === undefined) return null;
  return CURRENCY_KEYS.has(key) ? Math.round(Number(uiValue) * 100) : uiValue;
}
function rowToCamel(row) {
  if (!row) return {};
  const out = {};
  for (const [col, val] of Object.entries(row)) {
    if (col === 'assessment_id') continue;
    const key = toCamel(col);
    out[key] = fromDb(key, val);
  }
  return out;
}

const GROUP_TABLE = { offers: 'value_offers', fixedCosts: 'value_fixed_costs', variableCosts: 'value_variable_costs', references: 'value_references' };

export async function getValueAssessmentStatusAllowed(client) {
  // Real, stable product identifier (program_activity_access), not a
  // hardcoded tier-name check — mirrors exactly how client/program.js
  // already gates premium_preview activities.
  const { data } = await supabase.from('program_activity_access')
    .select('access').eq('program_slug', client.program_slug).eq('activity_slug', 'business').maybeSingle();
  return data?.access === 'included';
}

export async function loadValueAssessment(clientId) {
  const { data: assessment } = await supabase.from('value_assessments').select('*').eq('client_id', clientId).maybeSingle();
  if (!assessment) return null;

  const [s1, s2, s3, s4, s5, s6, offers, fixedCosts, variableCosts, references, deliverable] = await Promise.all([
    supabase.from('value_assessment_answers_s1').select('*').eq('assessment_id', assessment.id).maybeSingle(),
    supabase.from('value_assessment_answers_s2').select('*').eq('assessment_id', assessment.id).maybeSingle(),
    supabase.from('value_assessment_answers_s3').select('*').eq('assessment_id', assessment.id).maybeSingle(),
    supabase.from('value_assessment_answers_s4').select('*').eq('assessment_id', assessment.id).maybeSingle(),
    supabase.from('value_assessment_answers_s5').select('*').eq('assessment_id', assessment.id).maybeSingle(),
    supabase.from('value_assessment_answers_s6').select('*').eq('assessment_id', assessment.id).maybeSingle(),
    supabase.from('value_offers').select('*').eq('assessment_id', assessment.id),
    supabase.from('value_fixed_costs').select('*').eq('assessment_id', assessment.id),
    supabase.from('value_variable_costs').select('*').eq('assessment_id', assessment.id),
    supabase.from('value_references').select('*').eq('assessment_id', assessment.id),
    supabase.from('value_published_deliverables').select('*').eq('assessment_id', assessment.id).maybeSingle(),
  ]);

  return {
    id: assessment.id,
    status: assessment.status,
    submittedAt: assessment.submitted_at,
    updatedAt: assessment.updated_at,
    publishedDeliverable: deliverable.data ? rowToCamel(deliverable.data) : null,
    answers: {
      s1: rowToCamel(s1.data), s2: rowToCamel(s2.data), s3: rowToCamel(s3.data), s4: rowToCamel(s4.data), s5: rowToCamel(s5.data),
      s6: { ...rowToCamel(s6.data), references: (references.data || []).map(rowToCamel).map((r, i) => ({ ...r, id: references.data[i].id })) },
      offers: (offers.data || []).map((r) => ({ ...rowToCamel(r), id: r.id })),
      fixedCosts: (fixedCosts.data || []).map((r) => ({ ...rowToCamel(r), id: r.id })),
      variableCosts: (variableCosts.data || []).map((r) => ({ ...rowToCamel(r), id: r.id })),
    },
  };
}

export async function startValueAssessment(clientId) {
  const { data, error } = await supabase.from('value_assessments').insert({ client_id: clientId, status: 'in_progress', started_at: new Date().toISOString() }).select().single();
  if (error) throw error;
  // Seed the six per-section answer rows so later updates can always UPDATE
  // rather than needing to distinguish first-write-per-section from later ones.
  await Promise.all([1, 2, 3, 4, 5, 6].map((n) => supabase.from(`value_assessment_answers_s${n}`).insert({ assessment_id: data.id })));
  return data.id;
}

export async function submitValueAssessment(assessmentId) {
  const { error } = await supabase.from('value_assessments').update({ status: 'submitted', submitted_at: new Date().toISOString() }).eq('id', assessmentId);
  if (error) throw error;
}

// path is either "sectionKey.fieldKey" (section field) or
// "groupKey.itemId.fieldKey" (repeatable item field) — same shape
// commitField already builds in client/value-analysis.js.
export async function saveField(assessmentId, path, value) {
  const parts = path.split('.');
  if (parts.length === 3 && GROUP_TABLE[parts[0]]) {
    const [groupKey, itemId, fieldKey] = parts;
    const { error } = await supabase.from(GROUP_TABLE[groupKey]).update({ [columnFor(fieldKey)]: toDb(fieldKey, value) }).eq('id', itemId);
    if (error) throw error;
    return;
  }
  const [sectionKey, fieldKey] = parts;
  const { error } = await supabase.from(`value_assessment_answers_${sectionKey}`).update({ [columnFor(fieldKey)]: toDb(fieldKey, value) }).eq('assessment_id', assessmentId);
  if (error) throw error;
}

export async function addItem(assessmentId, groupKey, fields = {}) {
  const row = { assessment_id: assessmentId };
  for (const [k, v] of Object.entries(fields)) row[columnFor(k)] = toDb(k, v);
  const { data, error } = await supabase.from(GROUP_TABLE[groupKey]).insert(row).select().single();
  if (error) throw error;
  return data.id;
}

export async function removeItem(groupKey, itemId) {
  const { error } = await supabase.from(GROUP_TABLE[groupKey]).delete().eq('id', itemId);
  if (error) throw error;
}
