// Pure logic for the Town Meeting warrant corpus: CSV parsing, title
// normalization across year-to-year renames, series grouping, and kind
// assignment. No I/O; CLIs in build_warrant_series.mjs and
// sync_warrant_corpus.mjs wrap this. Tested from
// community-pulse/tests/warrant-lib.test.js.

// Variant normalized title -> canonical normalized title. Every entry
// was observed in data/town_meeting_results.csv or the FinCom extraction
// (data/town_meeting_warrant_articles.csv); do not invent merges.
export const ALIASES = {
  'expense of several departments': 'expenses of several departments',
  'storm drain construction': 'storm drainage construction',
  'stormwater construction': 'storm drainage construction',
  'revolving fund': 'departmental revolving funds',
  'capital improvements public buildings': 'capital improvements for public buildings',
  'available funds appropriated to reduce the tax rate': 'available funds appropriate to reduce tax rate',
  'financial assistance conservation': 'financial assistance for conservation',
  'contracts for more than three years': 'contracts in excess of three years',
  'transfer of funds to special education stabilization account': 'transfer funds to special education stabilization account',
  'reclassification and pay schedule (administrative)': 'proposed reclassification and pay schedule (administrative)',
  'pay schedule and reclassification (administrative)': 'proposed reclassification and pay schedule (administrative)',
  'reclassification and pay schedule (traffic supervisors)': 'proposed reclassification and pay schedule (traffic supervisors)',
  'proposed pay schedule and reclassification (traffic supervisors)': 'proposed reclassification and pay schedule (traffic supervisors)',
  'reclassification and pay schedule (seasonal and temporary)': 'proposed reclassification and pay schedule (seasonal and temporary personnel)',
  'proposed reclassification and pay schedule (seasonal and temporary)': 'proposed reclassification and pay schedule (seasonal and temporary personnel)',
  'supplemental appropriation and expenses for the schools': 'supplemental appropriation for the schools',
  'supplemental appropriation for several departments': 'supplemental expenses of several departments',
  'supplemental appropriation and expenses of several departments': 'supplemental expenses of several departments',
  'collective bargaining, police': 'collective bargaining (police)',
  'mwra local water system assistance program (interest-free loan)': 'mwra local water system assistance program',
};

// Slug -> kind. Anything not listed is 'other_article'. budget_line
// series (omnibus decomposition by department) are a later corpus pass.
export const KIND_BY_SLUG = {
  // The town's own consent bundles plus the pre-2025 housekeeping that
  // moved into them.
  'consent-articles': 'consent',
  'consent-articles-water-and-sewer': 'consent',
  'articles-in-numerical-order': 'consent',
  'reports-of-town-officers-and-committees': 'consent',
  'assume-liability': 'consent',
  'accept-trust-property': 'consent',
  'lease-town-property': 'consent',
  'contracts-in-excess-of-three-years': 'consent',
  'water-and-sewer-commission-claims': 'consent',
  // Recurring money articles.
  'expenses-of-several-departments': 'money_article',
  'purchase-of-equipment-of-several-departments': 'money_article',
  'capital-improvements-for-public-buildings': 'money_article',
  'walls-and-fences': 'money_article',
  'storm-drainage-construction': 'money_article',
  'water-department-construction': 'money_article',
  'sewer-department-construction': 'money_article',
  'unpaid-accounts': 'money_article',
  'available-funds-appropriate-to-reduce-tax-rate': 'money_article',
  'essex-north-shore-agricultural-and-technical-school-district': 'money_article',
  'mwra-local-water-system-assistance-program': 'money_article',
  'lease-purchase': 'money_article',
  'departmental-revolving-funds': 'money_article',
  'collective-bargaining-fire': 'money_article',
  'collective-bargaining-police': 'money_article',
  'collective-bargaining-iuecwa-local-1776': 'money_article',
  'proposed-reclassification-and-pay-schedule-administrative': 'money_article',
  'proposed-reclassification-and-pay-schedule-traffic-supervisors': 'money_article',
  'proposed-reclassification-and-pay-schedule-seasonal-and-temporary-personnel': 'money_article',
  'compensation-town-officers': 'money_article',
  'ratification-of-salary-bylaw': 'money_article',
  'financial-assistance-for-conservation': 'money_article',
  'transfer-funds-to-special-education-stabilization-account': 'money_article',
  'supplemental-appropriation-for-the-schools': 'money_article',
  'supplemental-expenses-of-several-departments': 'money_article',
  'school-capital-needs': 'money_article',
  'medicaid-reimbursement-money': 'money_article',
  'capital-transfers': 'money_article',
  'debt-exclusion-premium': 'money_article',
  'release-funds-from-transportation-network': 'money_article',
  'affordable-housing-tax-title-foreclosures': 'money_article',
};

export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];

    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field); field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.length > 1 || row[0] !== '') rows.push(row);
      row = [];
    } else {
      field += c;
    }
  }

  if (field !== '' || row.length > 0) { row.push(field); rows.push(row); }
  if (rows.length < 2) return [];

  const headers = rows[0];
  return rows.slice(1).map(cells =>
    Object.fromEntries(headers.map((h, i) => [h, cells[i] ?? ''])));
}

export function normalizeTitle(rawTitle) {
  let t = String(rawTitle).toLowerCase().trim();
  t = t.replace(/[^a-z0-9() ]+/g, ' ');
  t = t.replace(/\s+/g, ' ').trim();
  return ALIASES[t] || t;
}

export function slugify(normalizedTitle) {
  return normalizedTitle.replace(/[()]/g, '').replace(/\s+/g, ' ').trim().replace(/ /g, '-');
}

export function deriveKind(slug) {
  return KIND_BY_SLUG[slug] || 'other_article';
}

/**
 * Group result rows (objects with meeting_year and title) into series.
 * Display title per series: the title of the most recent instance.
 */
export function buildSeries(resultRows) {
  const bySlug = new Map();
  const mapEntries = new Map();

  for (const row of resultRows) {
    const year = Number(row.meeting_year);

    // Raw normalize (without alias)
    let rawNormalized = String(row.title).toLowerCase().trim();
    rawNormalized = rawNormalized.replace(/[^a-z0-9() ]+/g, ' ');
    rawNormalized = rawNormalized.replace(/\s+/g, ' ').trim();

    // Apply alias for canonical form
    const normalized = ALIASES[rawNormalized] || rawNormalized;
    const slug = slugify(normalized);
    mapEntries.set(rawNormalized, slug);

    const existing = bySlug.get(slug);
    if (!existing) {
      bySlug.set(slug, {
        slug,
        title: row.title,
        kind: deriveKind(slug),
        first_year: year,
        last_year: year,
        notes: '',
        _titleYear: year,
      });
      continue;
    }

    existing.first_year = Math.min(existing.first_year, year);
    existing.last_year = Math.max(existing.last_year, year);
    if (year >= existing._titleYear) {
      existing.title = row.title;
      existing._titleYear = year;
    }
  }

  const series = [...bySlug.values()]
    .map(({ _titleYear, ...s }) => s)
    .sort((a, b) => a.slug.localeCompare(b.slug));
  const map = [...mapEntries.entries()]
    .map(([normalized_title, slug]) => ({ normalized_title, slug }))
    .sort((a, b) => a.normalized_title.localeCompare(b.normalized_title));
  return { series, map };
}
