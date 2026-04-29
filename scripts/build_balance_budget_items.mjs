import { parse } from 'csv-parse/sync';
import { readFileSync, writeFileSync } from 'node:fs';

// Map description substring -> consequence IDs for discrete items.
// Only items with a state-law / regulatory / rating-agency consequence
// have an entry; everything else has no consequences attached.
const CONSEQUENCE_MAP = [
  { match: 'School Resource Officer', consequences: ['sro_eliminated'] },
  { match: 'Library Staffing cuts for accreditation', consequences: ['mblc_decertification'] },
  { match: 'Abbot Library Materials', consequences: ['mblc_mer_violation'] },
  { match: 'Town Portion of OPEB Transfer', consequences: ['opeb_skipped'] },
  { match: 'Stabilization Transfer', consequences: ['stabilization_skipped'] },
  { match: 'Workers Comp', consequences: ['workers_comp_underfunded'] }
];

function slugify(s) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 60);
}

function consequencesFor(description) {
  for (const entry of CONSEQUENCE_MAP) {
    if (description.includes(entry.match)) {
      return entry.consequences;
    }
  }
  return [];
}

function cutDescription(restoreDescription) {
  // Convert the CSV's "Restore X Cut" / "Increase X" prose into
  // user-facing checkbox copy. Each checkbox represents the user
  // choosing to make this cut (or skip this funding increase).
  const trimmedCut = restoreDescription.replace(/ Cut$/i, '').replace(/ Cuts$/i, '');
  if (restoreDescription.startsWith('Restore ')) {
    return 'Cut: ' + trimmedCut.replace(/^Restore /, '');
  }
  if (restoreDescription.startsWith('Increase ')) {
    return 'Skip: ' + trimmedCut.replace(/^Increase /, '') + ' increase';
  }
  if (restoreDescription.startsWith('Recurring Capital funding')) {
    return 'Skip: ' + trimmedCut;
  }
  return restoreDescription;
}

export function buildItems(csvText) {
  const rows = parse(csvText, { columns: true, skip_empty_lines: true, trim: true });

  const items = [];

  for (const row of rows) {
    // Skip the unemployment offset row. It represents automatic savings
    // when restored positions reduce unemployment outlays. Not a cut the
    // user can choose; not user-controllable.
    if (row.category === 'Offset') continue;

    const amounts = {
      tier_1: Number(row.tier_1_9m) || 0,
      tier_2: Number(row.tier_2_12m) || 0,
      tier_3: Number(row.tier_3_15m) || 0
    };

    const description = cutDescription(row.description);
    const id = slugify(row.category + '__' + row.description);

    items.push({
      id,
      category: row.category,
      department: row.category,
      description,
      amounts,
      type: 'discrete',
      consequences: consequencesFor(row.description),
      source_description: row.description
    });
  }

  // Append the schools scalar.
  items.push({
    id: 'schools_cut',
    category: 'Schools',
    department: 'Schools',
    description: 'Your FY27 school cut',
    type: 'scalar',
    default: 1500000,
    presets: [
      { label: 'Match town ($1.5M)', value: 1500000 },
      { label: 'Cut more ($2.5M)', value: 2500000 },
      { label: 'Cut less ($500K)', value: 500000 },
      { label: "Don't cut ($0)", value: 0 }
    ],
    consequences: [
      { threshold_gt: 2500000, id: 'nss_floor_violation' }
    ],
    source_description: 'FY27 Proposed Budget No Override: schools line cut $1,500,000 from $49,120,287 (FY26) to $47,620,287 (FY27).'
  });

  return items;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const csv = readFileSync('data/override_town_line_items.csv', 'utf-8');
  const items = buildItems(csv);
  writeFileSync('data/balance_budget_items.json', JSON.stringify(items, null, 2) + '\n');
  console.log(`Wrote ${items.length} items to data/balance_budget_items.json`);
}
