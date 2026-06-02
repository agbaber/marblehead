#!/usr/bin/env node
// Deterministic post-processing: map Pass 2's ad-hoc topic/attempt_type/deliberation
// values back to the canonical taxonomy. Input: data/catalog.csv. Output: data/catalog_normalized.csv.
// The ORIGINAL topic/attempt_type/deliberation are preserved as `topic_pass2`, etc., for audit.

import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const INPUT = resolve('data/catalog.csv');
const OUTPUT = resolve('data/catalog_normalized.csv');

const CANONICAL_TOPICS = new Set([
  'healthcare_gic', 'pensions_opeb', 'special_ed_collaborative',
  'structural_deficit_reserves', 'revenue_diversification', 'override_prop25',
  'regionalization_shared', 'capital_facilities_debt', 'solid_waste',
  'staffing_fte_bargaining', 'governance_organizational', 'other_candidate'
]);

const CANONICAL_ATTEMPT_TYPES = new Set(['vote', 'proposal', 'study', 'working_group', 'warrant_article']);
const CANONICAL_DELIBERATION = new Set(['discussed', 'routine', 'unknown']);

// Explicit mappings for observed non-canonical topic values
const TOPIC_MAP = {
  school_budget: 'structural_deficit_reserves',
  budget_operating: 'structural_deficit_reserves',
  budget_process: 'structural_deficit_reserves',
  budget_appropriation: 'structural_deficit_reserves',
  budget_general: 'structural_deficit_reserves',
  budget_fiscal: 'structural_deficit_reserves',
  budget_tradeoffs: 'structural_deficit_reserves',
  budget_operating_override: 'override_prop25',
  budget_override_or_debt_exclusion: 'override_prop25',
  budget_override_stabilization: 'override_prop25',
  budget_override_tax_levy: 'override_prop25',
  school_budget_override: 'override_prop25',
  override_debt_exclusion: 'override_prop25',
  override_or_debt_exclusion: 'override_prop25',
  facilities_capital: 'capital_facilities_debt',
  school_building_project: 'capital_facilities_debt',
  special_education: 'special_ed_collaborative',
  special_ed_funding: 'special_ed_collaborative',
  mental_health_social_emotional: 'special_ed_collaborative',
  town_governance_capacity: 'governance_organizational',
  governance_process: 'governance_organizational',
  governance_admin: 'governance_organizational',
  other: 'other_candidate',
};

// Keyword fallback for anything not explicitly mapped
function topicFallback(raw) {
  const s = raw.toLowerCase();
  if (s.includes('override') || s.includes('debt_exclusion')) return 'override_prop25';
  if (s.includes('budget') || s.includes('reserve') || s.includes('deficit') || s.includes('free_cash')) return 'structural_deficit_reserves';
  if (s.includes('capital') || s.includes('facility') || s.includes('building')) return 'capital_facilities_debt';
  if (s.includes('special') && (s.includes('ed') || s.includes('education'))) return 'special_ed_collaborative';
  if (s.includes('pension') || s.includes('opeb') || s.includes('retirement')) return 'pensions_opeb';
  if (s.includes('healthcare') || s.includes('insurance') || s.includes('gic')) return 'healthcare_gic';
  if (s.includes('staffing') || s.includes('fte') || s.includes('bargaining') || s.includes('cba')) return 'staffing_fte_bargaining';
  if (s.includes('governance') || s.includes('organizational') || s.includes('restructur')) return 'governance_organizational';
  if (s.includes('regional') || s.includes('consolidat')) return 'regionalization_shared';
  if (s.includes('trash') || s.includes('waste') || s.includes('refuse')) return 'solid_waste';
  if (s.includes('revenue') || s.includes('fee') || s.includes('pilot') || s.includes('new_growth')) return 'revenue_diversification';
  return 'other_candidate';
}

function normalizeTopic(raw) {
  const value = (raw || '').trim();
  if (!value) return 'other_candidate';
  if (CANONICAL_TOPICS.has(value)) return value;
  if (TOPIC_MAP[value]) return TOPIC_MAP[value];
  return topicFallback(value);
}

const ATTEMPT_TYPE_MAP = {
  discussion: 'proposal',
  report: 'study',
  announcement: 'proposal',
  plan: 'proposal',
  update: 'study',
  statement: 'proposal',
  presentation: 'study',
  debt_exclusion: 'warrant_article',
  directive: 'proposal',
  investigation: 'study',
  discussed: 'proposal',
  process: 'proposal',
  information_sharing: 'proposal',
  planning_document: 'study',
};

function normalizeAttemptType(raw) {
  const value = (raw || '').trim();
  if (!value) return 'proposal';
  if (CANONICAL_ATTEMPT_TYPES.has(value)) return value;
  return ATTEMPT_TYPE_MAP[value] || 'proposal';
}

const DELIBERATION_MAP = {
  voted: 'discussed',
  voted_passed: 'discussed',
  voted_yes: 'discussed',
  voted_without_discussion: 'routine',
  passed: 'discussed',
  adopted: 'discussed',
  mentioned: 'routine',
  brief: 'routine',
  brief_mention: 'routine',
  briefly_mentioned: 'routine',
  minimal: 'routine',
  noted: 'routine',
  announced: 'routine',
  reported: 'discussed',
  presented: 'discussed',
  debated: 'discussed',
};

function normalizeDeliberation(raw) {
  const value = (raw || '').trim();
  if (!value) return 'unknown';
  if (CANONICAL_DELIBERATION.has(value)) return value;
  return DELIBERATION_MAP[value] || 'unknown';
}

function main() {
  const rows = parse(readFileSync(INPUT, 'utf8'), { columns: true });

  const COLUMNS = [
    'entry_id', 'meeting_date', 'body', 'topic', 'topic_pass2', 'topic_other_label',
    'attempt_type', 'attempt_type_pass2', 'deliberation', 'deliberation_pass2',
    'importance', 'what_was_tried', 'outcome', 'evidence_quote', 'minutes_section',
    'confidence', 'pass2_notes', 'quote_verified'
  ];

  const out = rows.map(r => {
    const origTopic = r.topic;
    const origAttemptType = r.attempt_type;
    const origDeliberation = r.deliberation;
    return {
      ...r,
      topic: normalizeTopic(origTopic),
      topic_pass2: origTopic,
      attempt_type: normalizeAttemptType(origAttemptType),
      attempt_type_pass2: origAttemptType,
      deliberation: normalizeDeliberation(origDeliberation),
      deliberation_pass2: origDeliberation,
    };
  });

  const normalized = out.map(r => { const o = {}; for (const c of COLUMNS) o[c] = r[c] ?? ''; return o; });
  writeFileSync(OUTPUT, stringify(normalized, { header: true, columns: COLUMNS }));

  console.log(`Normalized ${rows.length} rows to ${OUTPUT}`);

  const countBy = (field) => {
    const m = new Map();
    for (const r of out) m.set(r[field], (m.get(r[field]) || 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  };

  console.log('\nNormalized topic distribution:');
  for (const [k, n] of countBy('topic')) console.log(`  ${k}: ${n}`);

  const changed = out.filter(r => r.topic !== r.topic_pass2).length;
  console.log(`\nRows with topic changed: ${changed} of ${out.length}`);
}

main();
