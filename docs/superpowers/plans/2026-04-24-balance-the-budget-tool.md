# Balance the Budget Tool Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a new interactive page `balance-the-budget.html` that lets readers build their own FY27 cut plan against a selectable override tier target, shows live state-law consequences of the plan, and compares their plan side-by-side with the Town Administrator's proposed cuts.

**Architecture:** Static Jekyll page with client-side JavaScript. Two new JSON data files in `data/`. One new JS module in `assets/`. Reuses existing CSS patterns (`.cut-row`, `.calc-input`, `.already-decided`). No build step beyond Jekyll. Smoke test using Playwright against the Cloudflare Pages preview URL, matching existing `tests/smoke-test.mjs` pattern.

**Tech Stack:** HTML, vanilla client-side JS (IIFE pattern matching existing `assets/ballot.js`), CSS scoped to the page, Playwright for preview smoke testing, Node.js (csv-parse) for the one-time JSON generation script.

---

## File Structure

**Create:**
- `scripts/build_balance_budget_items.mjs` — one-time CSV-to-JSON converter. Re-runnable if the source CSV changes.
- `scripts/build_balance_budget_items.test.mjs` — node --test for the generator.
- `data/balance_budget_items.json` — generated from `override_town_line_items.csv`. Committed.
- `data/balance_budget_consequences.json` — hand-authored. 7 consequences per spec.
- `assets/balance-budget.js` — page runtime. Loads JSON, renders UI, handles interactions.
- `balance-the-budget.html` — the page itself, Jekyll frontmatter + markup.
- `tests/balance-budget-test.mjs` — Playwright smoke test against preview URL.

**Modify:**
- `assets/site.css` — add scoped `.bb-*` styles for the new page.
- `no-override-budget.html` — add cross-link to the new page.
- `what-is-the-override.html` — add cross-link to the new page.

## Data Model Reference

Pulled forward from the spec for convenience:

**Items file shape (`data/balance_budget_items.json`):**

```json
[
  {
    "id": "public_safety__sro",
    "category": "Public Safety",
    "department": "Police",
    "description": "Cut the Police Department School Resource Officer",
    "amounts": { "tier_1": 65482, "tier_2": 65482, "tier_3": 65482 },
    "type": "discrete",
    "consequences": ["sro_eliminated"]
  },
  {
    "id": "schools_cut",
    "category": "Schools",
    "department": "Schools",
    "description": "Your FY27 school cut (continuous)",
    "type": "scalar",
    "default": 1500000,
    "presets": [
      { "label": "Match town ($1.5M)", "value": 1500000 },
      { "label": "Cut more ($2.5M)", "value": 2500000 },
      { "label": "Cut less ($500K)", "value": 500000 },
      { "label": "Don't cut ($0)", "value": 0 }
    ],
    "consequences": [
      { "threshold_gt": 2500000, "id": "nss_floor_violation" }
    ]
  }
]
```

**Consequences file shape (`data/balance_budget_consequences.json`):**

```json
{
  "mblc_decertification": {
    "name": "Library loses MBLC state certification",
    "authority": "605 CMR 4.00; M.G.L. c. 78 ss 19A, 19B",
    "effect": "...",
    "links": [{ "label": "605 CMR 4.00", "url": "..." }]
  }
}
```

**Tier FY27 targets (from `data/override_draws_schedule.csv`):**
- Tier 1: $1,269,564
- Tier 2: $2,805,236
- Tier 3: $4,296,718

---

## Task 1: CSV-to-JSON generator with test

**Files:**
- Create: `scripts/build_balance_budget_items.mjs`
- Create: `scripts/build_balance_budget_items.test.mjs`
- Create: `data/balance_budget_items.json` (generated output)

- [ ] **Step 1: Write the failing test first**

Create `scripts/build_balance_budget_items.test.mjs`:

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildItems } from './build_balance_budget_items.mjs';

test('buildItems returns an array of town-side items plus a schools scalar', () => {
  const csv = readFileSync('data/override_town_line_items.csv', 'utf-8');
  const items = buildItems(csv);

  assert.ok(Array.isArray(items));
  assert.ok(items.length > 20, 'expected at least 20 items from the CSV plus the schools scalar');

  const schools = items.find(i => i.id === 'schools_cut');
  assert.ok(schools, 'schools_cut scalar item is required');
  assert.equal(schools.type, 'scalar');
  assert.equal(schools.default, 1500000);
});

test('Tier 1 amounts sum to the published Tier 1 FY27 draw', () => {
  const csv = readFileSync('data/override_town_line_items.csv', 'utf-8');
  const items = buildItems(csv);

  const discreteItems = items.filter(i => i.type === 'discrete');
  const tier1Sum = discreteItems.reduce((acc, i) => acc + i.amounts.tier_1, 0);

  // From data/override_draws_schedule.csv row 2: Tier 1 FY27 draw
  assert.equal(tier1Sum, 1269564);
});

test('every item has id, category, department, description, type', () => {
  const csv = readFileSync('data/override_town_line_items.csv', 'utf-8');
  const items = buildItems(csv);

  for (const item of items) {
    assert.ok(item.id, `item missing id: ${JSON.stringify(item)}`);
    assert.ok(item.category, `item missing category: ${item.id}`);
    assert.ok(item.department, `item missing department: ${item.id}`);
    assert.ok(item.description, `item missing description: ${item.id}`);
    assert.ok(['discrete', 'scalar'].includes(item.type), `item has bad type: ${item.id}`);
  }
});

test('consequence ids are strings referencing the consequences file', () => {
  const csv = readFileSync('data/override_town_line_items.csv', 'utf-8');
  const items = buildItems(csv);

  for (const item of items) {
    if (item.type === 'discrete' && item.consequences) {
      for (const cid of item.consequences) {
        assert.equal(typeof cid, 'string', `bad consequence id on ${item.id}: ${cid}`);
      }
    }
  }
});
```

- [ ] **Step 2: Run the test and see it fail**

Run: `node --test scripts/build_balance_budget_items.test.mjs`

Expected: FAIL with `Cannot find module './build_balance_budget_items.mjs'` or similar.

- [ ] **Step 3: Implement the generator**

Create `scripts/build_balance_budget_items.mjs`:

```javascript
import { parse } from 'csv-parse/sync';
import { readFileSync, writeFileSync } from 'node:fs';

// Map department name -> consequence IDs for discrete items.
// Keyed by substring match against description. Only a few items
// have consequences attached; everything else has an empty array.
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
  // Convert "Restore X Cut" or "Increase X" prose into "Cut X"-style wording
  // suitable for a checkbox that represents NOT making the restoration.
  // Examples:
  //   "Restore Police Department School Resource Officer Cut" -> "Cut: Police Department School Resource Officer"
  //   "Increase Police Department Staffing" -> "Skip: Police Department Staffing increase"
  //   "Restore Abbot Library Materials" -> "Cut: Abbot Library Materials"
  const trimmedCut = restoreDescription.replace(/ Cut$/i, '').replace(/ Cuts$/i, '');
  if (restoreDescription.startsWith('Restore ')) {
    return 'Cut: ' + trimmedCut.replace(/^Restore /, '');
  }
  if (restoreDescription.startsWith('Increase ')) {
    return 'Skip: ' + trimmedCut.replace(/^Increase /, '') + ' increase';
  }
  if (restoreDescription.startsWith('Reduction ')) {
    // The offset row: "Reduction to Unemployment with Restoration of Positions"
    return 'Cannot use this offset (negative cuts are not a lever)';
  }
  return restoreDescription;
}

export function buildItems(csvText) {
  const rows = parse(csvText, { columns: true, skip_empty_lines: true, trim: true });

  const items = [];

  for (const row of rows) {
    const amounts = {
      tier_1: Number(row.tier_1_9m) || 0,
      tier_2: Number(row.tier_2_12m) || 0,
      tier_3: Number(row.tier_3_15m) || 0
    };

    // Skip the negative offset row; it is not user-controllable.
    // It represents unemployment savings that would happen automatically
    // when positions get restored, not a cut the user can choose.
    if (row.category === 'Offset') continue;

    const description = cutDescription(row.description);
    const id = slugify(row.category + '__' + row.description);

    items.push({
      id,
      category: row.category,
      department: row.category, // For now; could refine if needed.
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

// Allow running as a CLI: `node scripts/build_balance_budget_items.mjs`
if (import.meta.url === `file://${process.argv[1]}`) {
  const csv = readFileSync('data/override_town_line_items.csv', 'utf-8');
  const items = buildItems(csv);
  writeFileSync('data/balance_budget_items.json', JSON.stringify(items, null, 2) + '\n');
  console.log(`Wrote ${items.length} items to data/balance_budget_items.json`);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test scripts/build_balance_budget_items.test.mjs`

Expected: all 4 tests PASS.

- [ ] **Step 5: Generate the JSON file**

Run: `node scripts/build_balance_budget_items.mjs`

Expected output: `Wrote N items to data/balance_budget_items.json` where N is at least 25.

- [ ] **Step 6: Spot-check the generated JSON**

Run: `cat data/balance_budget_items.json | head -80`

Expected: see items with real descriptions, amounts, and IDs. `schools_cut` present at the end.

- [ ] **Step 7: Commit**

```bash
git add scripts/build_balance_budget_items.mjs scripts/build_balance_budget_items.test.mjs data/balance_budget_items.json
git commit -m "$(cat <<'EOF'
Add balance-budget items generator and generated JSON

Generator converts data/override_town_line_items.csv into
data/balance_budget_items.json, the source of truth for the new
Balance the Budget tool. Also appends a schools_cut scalar item
representing the town's $1.5M FY27 school cut as a user-editable
value.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Consequences data file

**Files:**
- Create: `data/balance_budget_consequences.json`

- [ ] **Step 1: Write the failing structural test**

Add this block to `scripts/build_balance_budget_items.test.mjs`:

```javascript
test('consequences file parses and each entry has required fields', () => {
  const raw = readFileSync('data/balance_budget_consequences.json', 'utf-8');
  const consequences = JSON.parse(raw);

  const requiredIds = [
    'sro_eliminated',
    'mblc_decertification',
    'mblc_mer_violation',
    'nss_floor_violation',
    'opeb_skipped',
    'stabilization_skipped',
    'workers_comp_underfunded'
  ];

  for (const id of requiredIds) {
    assert.ok(consequences[id], `missing required consequence: ${id}`);
    assert.ok(consequences[id].name, `${id} missing name`);
    assert.ok(consequences[id].authority, `${id} missing authority`);
    assert.ok(consequences[id].effect, `${id} missing effect`);
    assert.ok(Array.isArray(consequences[id].links), `${id} missing links array`);
  }
});

test('every consequence id referenced by an item exists in consequences file', () => {
  const items = JSON.parse(readFileSync('data/balance_budget_items.json', 'utf-8'));
  const consequences = JSON.parse(readFileSync('data/balance_budget_consequences.json', 'utf-8'));

  const referenced = new Set();
  for (const item of items) {
    if (item.type === 'discrete') {
      for (const cid of item.consequences || []) referenced.add(cid);
    } else if (item.type === 'scalar') {
      for (const c of item.consequences || []) referenced.add(c.id);
    }
  }

  for (const cid of referenced) {
    assert.ok(consequences[cid], `item references undefined consequence: ${cid}`);
  }
});
```

- [ ] **Step 2: Run the test and see it fail**

Run: `node --test scripts/build_balance_budget_items.test.mjs`

Expected: FAIL with `ENOENT: no such file or directory` for the consequences JSON.

- [ ] **Step 3: Write the consequences JSON**

Create `data/balance_budget_consequences.json`:

```json
{
  "sro_eliminated": {
    "name": "School Resource Officer eliminated",
    "authority": "Town of Marblehead / Marblehead Police Department",
    "effect": "The School Resource Officer (SRO) position at Marblehead schools is eliminated. Not a state-law violation; a local policy choice with implications for school safety planning, after-hours school event coverage, and the police-school coordination the SRO role provides.",
    "links": []
  },
  "mblc_decertification": {
    "name": "Library loses MBLC state certification",
    "authority": "605 CMR 4.00; M.G.L. c. 78 ss 19A, 19B",
    "effect": "Abbot Public Library is decertified by the Massachusetts Board of Library Commissioners (MBLC) for failing to meet the Municipal Appropriation Requirement (MAR) staffing floor. Effects: NOBLE reciprocal borrowing suspended (residents cannot borrow from other Massachusetts libraries; other NOBLE libraries can refuse to lend to Marblehead); state aid to public libraries withheld; federal LSTA pass-through grants unavailable. The MBLC waiver process is discretionary and is not a planning tool.",
    "links": [
      { "label": "605 CMR 4.00 (MBLC regulations)", "url": "https://www.mass.gov/regulations/605-CMR-400-the-massachusetts-board-of-library-commissioners" },
      { "label": "M.G.L. c. 78", "url": "https://malegislature.gov/Laws/GeneralLaws/PartI/TitleXII/Chapter78" }
    ]
  },
  "mblc_mer_violation": {
    "name": "Library materials budget below Materials Expenditure Requirement",
    "authority": "605 CMR 4.01(7)",
    "effect": "Abbot Public Library's materials expenditure falls below the state Materials Expenditure Requirement (MER), a separate MBLC floor from MAR. MER is a percentage-of-budget requirement for physical and digital collection spending. MER violation is an independent trigger for MBLC decertification.",
    "links": [
      { "label": "605 CMR 4.00 (MBLC regulations)", "url": "https://www.mass.gov/regulations/605-CMR-400-the-massachusetts-board-of-library-commissioners" }
    ]
  },
  "nss_floor_violation": {
    "name": "School budget below Net School Spending floor",
    "authority": "M.G.L. c. 70; Chapter 12 of the Acts of 2010 (Achievement Gap Act)",
    "effect": "District spending falls below the Net School Spending (NSS) floor set by DESE under Chapter 70. Immediate consequence: DESE intervention, which may include escalating oversight, restricted access to certain grants, and in sustained cases Level 5 designation with a state-appointed receiver (as happened with Lawrence in 2011, Holyoke in 2015, and Southbridge in 2016). The receiver assumes full managerial authority over the district.",
    "links": [
      { "label": "Chapter 70 overview (DESE)", "url": "https://www.doe.mass.edu/finance/chapter70/" },
      { "label": "Chapter 12 of Acts of 2010", "url": "https://malegislature.gov/Laws/SessionLaws/Acts/2010/Chapter12" }
    ]
  },
  "opeb_skipped": {
    "name": "OPEB trust contribution skipped",
    "authority": "GASB 74/75; M.G.L. c. 32B s 20",
    "effect": "Town skips the annual contribution to the Other Post-Employment Benefits trust. Not a state-mandated payment, but a GASB disclosure item and a rating agency signal. Sustained underfunding raises the unfunded OPEB liability reported in the ACFR and can affect the town's bond rating, which drives future borrowing costs.",
    "links": [
      { "label": "M.G.L. c. 32B s 20", "url": "https://malegislature.gov/Laws/GeneralLaws/PartI/TitleIV/Chapter32B/Section20" }
    ]
  },
  "stabilization_skipped": {
    "name": "Stabilization fund transfer skipped",
    "authority": "M.G.L. c. 40 s 5B",
    "effect": "Town skips the transfer to the Stabilization Fund, reducing the buffer available for unanticipated expenses and revenue shortfalls. Not a mandate violation. Rating agencies (Moody's, S&P) use reserve levels as a key input for municipal credit ratings; a depleted stabilization fund pressures the town's rating and can raise future borrowing costs.",
    "links": [
      { "label": "M.G.L. c. 40 s 5B", "url": "https://malegislature.gov/Laws/GeneralLaws/PartI/TitleVII/Chapter40/Section5B" }
    ]
  },
  "workers_comp_underfunded": {
    "name": "Workers Compensation / Section 111F transfer reduced",
    "authority": "M.G.L. c. 152; M.G.L. c. 41 s 111F",
    "effect": "Town reduces funding for its Workers Compensation reserves and Section 111F (injured-on-duty police and fire benefits). Funding these obligations is statutorily required (c. 152 for general workers comp, c. 41 s 111F for public safety). Underfunding creates immediate liability exposure; claims still must be paid, and if reserves are insufficient the town must appropriate additional funds mid-year or face default on benefit payments.",
    "links": [
      { "label": "M.G.L. c. 152", "url": "https://malegislature.gov/Laws/GeneralLaws/PartI/TitleXXI/Chapter152" },
      { "label": "M.G.L. c. 41 s 111F", "url": "https://malegislature.gov/Laws/GeneralLaws/PartI/TitleVII/Chapter41/Section111F" }
    ]
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test scripts/build_balance_budget_items.test.mjs`

Expected: all tests PASS, including the two new consequences tests.

- [ ] **Step 5: Commit**

```bash
git add data/balance_budget_consequences.json scripts/build_balance_budget_items.test.mjs
git commit -m "$(cat <<'EOF'
Add balance-budget consequences JSON

Seven consequences, each with authority citation, effect text, and
primary-source links. Tests ensure that every consequence ID referenced
by an item exists and that all required consequences are present.

Sources for effect text: 605 CMR 4.00, M.G.L. c. 78, c. 70, c. 32B s 20,
c. 40 s 5B, c. 152, c. 41 s 111F, and GASB 74/75 (for OPEB framing).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Research primary-source numbers flagged in spec

The spec flags two numbers for primary-source verification: Abbot Library FY26 state aid dollar amount, and the FY27 NSS floor for Marblehead. Both appear in consequence effect text. Resolve these before the page ships so every number on the page traces to a primary source per `CLAUDE.md`.

- [ ] **Step 1: Look up Abbot Library FY26 state aid from MBLC**

Visit: https://mblc.state.ma.us/programs-and-support/state-aid/index.php

Find the "State Aid to Public Libraries Distribution" or similar PDF for FY26 or FY25 (most recent available). Find the Marblehead (Abbot Public Library) row.

If the number is available: update `mblc_decertification` effect text in `data/balance_budget_consequences.json` to include the specific dollar amount, and add a link to the MBLC distribution report.

If the number is not readily available: leave the effect text qualitative ("state aid withheld") without a dollar amount. Add a comment in the commit explaining.

- [ ] **Step 2: Look up Marblehead FY27 NSS requirement from DESE**

Visit: https://www.doe.mass.edu/finance/chapter70/

Find the FY27 Chapter 70 aid calculation spreadsheet (usually published as an Excel file). Find Marblehead's "Required Net School Spending" for FY27.

Compute the gap between Marblehead's FY27 proposed school spending ($47,620,287 per `FY27_Proposed_Budget_No_Override.txt`) and the required NSS. This is the maximum amount the user can cut from schools before triggering `nss_floor_violation`.

Update `nss_floor_violation` effect text with the specific threshold, and update `schools_cut` in `data/balance_budget_items.json` to use the computed threshold instead of the placeholder $2,500,000.

If the number is not readily available: keep the placeholder threshold at $2,500,000 and add a comment in the commit; a TODO file entry explains what to verify before publication.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
Verify primary-source numbers for Balance the Budget consequences

Abbot Library FY26 state aid: [verified amount OR 'qualitative text only, source not yet located']
Marblehead FY27 NSS floor: [verified amount OR 'placeholder $2.5M, see follow-up note']

Per CLAUDE.md, every number traces to a primary source.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Page skeleton HTML

**Files:**
- Create: `balance-the-budget.html`

- [ ] **Step 1: Create the skeleton page**

Create `balance-the-budget.html`:

```html
---
title: "Balance the FY27 budget"
scripts: [citations, deep-dive, balance-budget]
og_title: "Balance the FY27 budget without the override"
og_description: "Build your own FY27 cut plan against a selectable override tier target. See which state-law consequences your plan triggers, and how it compares to the Town Administrator's proposed no-override cuts."
og_url: https://marbleheaddata.org/balance-the-budget.html
---
<main class="page">
  <h1>Balance the FY27 budget without the override</h1>

  <section class="bb-preamble">
    <p>Each override tier adds permanent levy capacity over three years.
    The first-year slice &mdash; what the town actually draws in FY27 &mdash;
    is shown as each tier's target below. Pick a tier; check the cuts you
    would make from that tier's restoration list; see what falls out.</p>

    <p>Revenue is fixed to the no-override levy (Proposition 2&frac12; +
    new growth). No fee toggles, no meals-tax toggles. The question is
    narrow on purpose: <em>what, specifically, would you cut?</em></p>
  </section>

  <section class="bb-tier-selector" aria-label="Select override tier">
    <button class="bb-tier-btn" data-tier="1" aria-pressed="true">
      <span class="bb-tier-label">Tier 1</span>
      <span class="bb-tier-target">FY27 gap: $1.27M</span>
      <span class="bb-tier-context">($9M total over 3 years)</span>
    </button>
    <button class="bb-tier-btn" data-tier="2" aria-pressed="false">
      <span class="bb-tier-label">Tier 2</span>
      <span class="bb-tier-target">FY27 gap: $2.81M</span>
      <span class="bb-tier-context">($12M total over 3 years)</span>
    </button>
    <button class="bb-tier-btn" data-tier="3" aria-pressed="false">
      <span class="bb-tier-label">Tier 3</span>
      <span class="bb-tier-target">FY27 gap: $4.30M</span>
      <span class="bb-tier-context">($15M total over 3 years)</span>
    </button>
  </section>

  <section class="bb-status-bar" aria-live="polite">
    <div class="bb-status-target">
      <span class="bb-status-label">Target</span>
      <span class="bb-status-value" data-bind="target">$1,269,564</span>
    </div>
    <div class="bb-status-cuts">
      <span class="bb-status-label">Your cuts</span>
      <span class="bb-status-value" data-bind="cuts">$0</span>
    </div>
    <div class="bb-status-gap">
      <span class="bb-status-label">Gap remaining</span>
      <span class="bb-status-value" data-bind="gap">$1,269,564</span>
    </div>
  </section>

  <div class="bb-layout">
    <section class="bb-checklist" aria-label="Cuts checklist">
      <!-- Populated by balance-budget.js -->
    </section>

    <aside class="bb-consequences" aria-label="Consequences panel">
      <h2 class="bb-consequences-title">
        <span data-bind="consequence-count">0</span> consequences triggered
      </h2>
      <div class="bb-consequences-list">
        <!-- Populated by balance-budget.js -->
      </div>
    </aside>
  </div>

  <section class="bb-success" hidden aria-live="polite">
    <!-- Populated by balance-budget.js when gap <= 0 -->
  </section>

  <footer class="bb-footer">
    <button type="button" class="bb-reset">Reset plan</button>
    <nav class="bb-crosslinks">
      <a href="/no-override-budget.html">See what the town proposed instead &rarr;</a>
      <a href="/what-is-the-override.html">See what each tier would restore &rarr;</a>
    </nav>
  </footer>
</main>
```

- [ ] **Step 2: Commit**

```bash
git add balance-the-budget.html
git commit -m "$(cat <<'EOF'
Balance the Budget: add page skeleton

Static markup with Jekyll frontmatter. Tier selector, status bar,
checklist container, consequences aside, success section, and footer
in place. All interactive behavior wired up in subsequent commits.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Add tool-specific CSS

**Files:**
- Modify: `assets/site.css` (append scoped `.bb-*` rules at end of file)

- [ ] **Step 1: Read the existing site.css to find the right insertion point**

Run: `grep -n '^\/\* =' assets/site.css | tail -20`

Note the final `/* === */` section heading pattern so new rules follow the same convention.

- [ ] **Step 2: Append new CSS block**

Append to `assets/site.css`:

```css
/* =============================================================
   Balance the Budget tool (balance-the-budget.html)
   ============================================================= */

.bb-preamble {
  margin: 24px 0 32px;
  max-width: 72ch;
}
.bb-preamble p {
  margin: 0 0 12px;
  line-height: 1.6;
}

.bb-tier-selector {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 12px;
  margin: 0 0 20px;
}
.bb-tier-btn {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 14px 16px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  cursor: pointer;
  text-align: left;
  transition: border-color 120ms ease, background-color 120ms ease;
}
.bb-tier-btn[aria-pressed="true"] {
  border-color: var(--c-navy);
  background: color-mix(in srgb, var(--c-navy) 4%, var(--surface));
}
.bb-tier-label {
  font-weight: 700;
  font-size: 15px;
}
.bb-tier-target {
  font-size: 18px;
  font-weight: 600;
}
.bb-tier-context {
  font-size: 12px;
  color: var(--text-muted);
}
@media (max-width: 600px) {
  .bb-tier-selector { grid-template-columns: 1fr; }
}

.bb-status-bar {
  position: sticky;
  top: 0;
  z-index: 10;
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 16px;
  padding: 14px 18px;
  margin: 0 0 20px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  transition: background-color 200ms ease;
}
.bb-status-bar.bb-balanced {
  background: color-mix(in srgb, var(--c-deep) 6%, var(--surface));
  border-color: var(--c-deep);
}
.bb-status-label {
  display: block;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 1.2px;
  color: var(--text-muted);
}
.bb-status-value {
  font-size: 20px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.bb-layout {
  display: grid;
  grid-template-columns: 1fr 320px;
  gap: 28px;
  align-items: start;
}
@media (max-width: 900px) {
  .bb-layout { grid-template-columns: 1fr; }
}

.bb-checklist {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.bb-category {
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: 14px 16px;
}
.bb-category h3 {
  font-size: 14px;
  text-transform: uppercase;
  letter-spacing: 1.4px;
  color: var(--text-muted);
  margin: 0 0 8px;
}

.bb-item-row {
  display: grid;
  grid-template-columns: 22px 1fr auto;
  gap: 10px;
  align-items: baseline;
  padding: 6px 0;
  border-top: 1px dashed var(--border);
}
.bb-item-row:first-child { border-top: none; }
.bb-item-row input[type="checkbox"] {
  margin: 2px 0 0;
}
.bb-item-row-name { line-height: 1.45; }
.bb-item-row-flag {
  display: inline-block;
  margin-left: 6px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--c-buoy);
  vertical-align: middle;
}
.bb-item-row-dollar {
  font-variant-numeric: tabular-nums;
  font-weight: 600;
  white-space: nowrap;
}

.bb-scalar-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
  padding: 10px 0;
}
.bb-scalar-row label { font-weight: 600; }
.bb-scalar-row input[type="number"] {
  width: 140px;
  padding: 6px 10px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  font-variant-numeric: tabular-nums;
}
.bb-scalar-presets {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.bb-scalar-preset {
  padding: 4px 10px;
  font-size: 12px;
  background: color-mix(in srgb, var(--c-navy) 3%, var(--surface));
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  cursor: pointer;
}

.bb-consequences {
  position: sticky;
  top: 80px;
  max-height: calc(100vh - 100px);
  overflow-y: auto;
  padding: 14px 16px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: color-mix(in srgb, var(--c-buoy) 2%, var(--surface));
}
.bb-consequences-title {
  font-size: 14px;
  text-transform: uppercase;
  letter-spacing: 1.4px;
  margin: 0 0 10px;
}
.bb-consequence-card {
  padding: 10px 12px;
  border-left: 3px solid var(--c-buoy);
  background: var(--surface);
  border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
  margin-bottom: 10px;
}
.bb-consequence-card h4 {
  font-size: 14px;
  margin: 0 0 4px;
}
.bb-consequence-card .bb-cc-authority {
  font-size: 11px;
  color: var(--text-muted);
  margin: 0 0 6px;
}
.bb-consequence-card .bb-cc-effect {
  font-size: 13px;
  line-height: 1.5;
  margin: 0;
}

@media (max-width: 900px) {
  .bb-consequences {
    position: static;
    max-height: none;
  }
}

.bb-success {
  margin: 28px 0 20px;
  padding: 18px 22px;
  border: 1px solid var(--c-deep);
  border-radius: var(--radius-md);
  background: color-mix(in srgb, var(--c-deep) 4%, var(--surface));
}
.bb-success h2 { margin: 0 0 10px; }
.bb-success-comparison { margin: 12px 0; }
.bb-success-comparison table {
  width: 100%;
  border-collapse: collapse;
}
.bb-success-comparison th,
.bb-success-comparison td {
  padding: 6px 8px;
  text-align: left;
  border-bottom: 1px solid var(--border);
  font-size: 13px;
}

.bb-footer {
  margin: 28px 0 48px;
  display: flex;
  flex-wrap: wrap;
  gap: 18px;
  align-items: center;
  justify-content: space-between;
}
.bb-reset {
  padding: 8px 16px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  cursor: pointer;
}
.bb-crosslinks {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
}
.bb-crosslinks a { white-space: nowrap; }
```

- [ ] **Step 2: Commit**

```bash
git add assets/site.css
git commit -m "$(cat <<'EOF'
Balance the Budget: scoped .bb-* CSS

Adds styles for tier selector, sticky status bar, checklist rows,
scalar input with presets, sticky consequences panel (collapses to
inline on mobile), success block, and footer. Uses existing palette
tokens (--c-navy, --c-buoy, --c-deep); no green/red value judgments.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: JavaScript runtime - load data and render checklist

**Files:**
- Create: `assets/balance-budget.js`

- [ ] **Step 1: Create the JS file with data loading and render**

Create `assets/balance-budget.js`:

```javascript
/*
 * Balance the Budget tool runtime (balance-the-budget.html).
 *
 * Loads data/balance_budget_items.json and
 * data/balance_budget_consequences.json, renders a per-category
 * checklist with per-tier dollar amounts, and exposes getState() for
 * subsequent modules (status bar, consequences engine, success state)
 * to consume.
 *
 * Markup contract: section.bb-checklist is populated with
 * section.bb-category > div.bb-item-row for each item. section.bb-tier-
 * selector carries three buttons with data-tier="1|2|3".
 *
 * Pages without section.bb-checklist are early-returned.
 */

(function () {
  'use strict';

  const checklist = document.querySelector('.bb-checklist');
  if (!checklist) return;

  const TIER_TARGETS = { 1: 1269564, 2: 2805236, 3: 4296718 };

  const state = {
    tier: 1,
    checkedIds: new Set(),
    schoolsCut: 1500000
  };

  let itemsData = null;
  let consequencesData = null;

  function formatUSD(n) {
    if (n === 0) return '$0';
    const sign = n < 0 ? '-' : '';
    const abs = Math.abs(n);
    return sign + '$' + abs.toLocaleString('en-US');
  }

  async function loadData() {
    const [itemsRes, consRes] = await Promise.all([
      fetch('/data/balance_budget_items.json'),
      fetch('/data/balance_budget_consequences.json')
    ]);
    itemsData = await itemsRes.json();
    consequencesData = await consRes.json();
  }

  function groupByCategory(items) {
    const groups = new Map();
    for (const item of items) {
      if (!groups.has(item.category)) groups.set(item.category, []);
      groups.get(item.category).push(item);
    }
    return groups;
  }

  function renderDiscreteRow(item) {
    const amount = item.amounts[`tier_${state.tier}`];
    if (amount <= 0) return null; // Hide items with zero amount at this tier.

    const row = document.createElement('div');
    row.className = 'bb-item-row';
    row.dataset.id = item.id;

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = 'bb-' + item.id;
    checkbox.checked = state.checkedIds.has(item.id);
    checkbox.addEventListener('change', () => {
      if (checkbox.checked) state.checkedIds.add(item.id);
      else state.checkedIds.delete(item.id);
      document.dispatchEvent(new CustomEvent('bb:statechange'));
    });

    const nameLabel = document.createElement('label');
    nameLabel.className = 'bb-item-row-name';
    nameLabel.htmlFor = 'bb-' + item.id;
    nameLabel.textContent = item.description;
    if (item.consequences && item.consequences.length > 0) {
      const flag = document.createElement('span');
      flag.className = 'bb-item-row-flag';
      flag.title = 'Triggers a state-law or policy consequence';
      nameLabel.appendChild(flag);
    }

    const dollar = document.createElement('span');
    dollar.className = 'bb-item-row-dollar';
    dollar.textContent = formatUSD(amount);

    row.append(checkbox, nameLabel, dollar);
    return row;
  }

  function renderScalarRow(item) {
    const row = document.createElement('div');
    row.className = 'bb-scalar-row';

    const label = document.createElement('label');
    label.textContent = item.description + ': $';
    label.htmlFor = 'bb-' + item.id;

    const input = document.createElement('input');
    input.id = 'bb-' + item.id;
    input.type = 'number';
    input.min = '0';
    input.step = '10000';
    input.value = String(state.schoolsCut);
    input.addEventListener('input', () => {
      const v = Number(input.value);
      state.schoolsCut = isNaN(v) ? 0 : v;
      document.dispatchEvent(new CustomEvent('bb:statechange'));
    });

    row.append(label, input);

    if (item.presets && item.presets.length) {
      const presetsWrap = document.createElement('span');
      presetsWrap.className = 'bb-scalar-presets';
      for (const p of item.presets) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'bb-scalar-preset';
        btn.textContent = p.label;
        btn.addEventListener('click', () => {
          input.value = String(p.value);
          state.schoolsCut = p.value;
          document.dispatchEvent(new CustomEvent('bb:statechange'));
        });
        presetsWrap.appendChild(btn);
      }
      row.appendChild(presetsWrap);
    }

    return row;
  }

  function renderChecklist() {
    checklist.innerHTML = '';
    const groups = groupByCategory(itemsData);
    for (const [category, items] of groups) {
      const section = document.createElement('section');
      section.className = 'bb-category';
      const h3 = document.createElement('h3');
      h3.textContent = category;
      section.appendChild(h3);

      for (const item of items) {
        const row = item.type === 'discrete'
          ? renderDiscreteRow(item)
          : renderScalarRow(item);
        if (row) section.appendChild(row);
      }

      // Only append the category section if it has at least one visible row
      // beyond its heading.
      if (section.children.length > 1) {
        checklist.appendChild(section);
      }
    }
  }

  function initTierSelector() {
    const btns = document.querySelectorAll('.bb-tier-btn');
    btns.forEach(btn => {
      btn.addEventListener('click', () => {
        const newTier = Number(btn.dataset.tier);
        if (newTier === state.tier) return;

        const somethingChecked = state.checkedIds.size > 0 || state.schoolsCut !== 1500000;
        if (somethingChecked) {
          const ok = window.confirm('Switching tier will reset your plan. Continue?');
          if (!ok) return;
        }
        state.tier = newTier;
        state.checkedIds.clear();
        state.schoolsCut = 1500000;
        btns.forEach(b => b.setAttribute('aria-pressed', b === btn ? 'true' : 'false'));
        renderChecklist();
        document.dispatchEvent(new CustomEvent('bb:statechange'));
      });
    });
  }

  function initResetButton() {
    const reset = document.querySelector('.bb-reset');
    if (!reset) return;
    reset.addEventListener('click', () => {
      state.checkedIds.clear();
      state.schoolsCut = 1500000;
      renderChecklist();
      document.dispatchEvent(new CustomEvent('bb:statechange'));
    });
  }

  // Expose state accessor for other modules in this same IIFE chain.
  window.__bbState = {
    getTier: () => state.tier,
    getTarget: () => TIER_TARGETS[state.tier],
    getCuts: () => {
      let total = 0;
      for (const item of itemsData) {
        if (item.type === 'discrete' && state.checkedIds.has(item.id)) {
          total += item.amounts[`tier_${state.tier}`];
        }
      }
      total += state.schoolsCut;
      return total;
    },
    getCheckedIds: () => new Set(state.checkedIds),
    getSchoolsCut: () => state.schoolsCut,
    getItems: () => itemsData,
    getConsequences: () => consequencesData
  };

  loadData().then(() => {
    renderChecklist();
    initTierSelector();
    initResetButton();
    document.dispatchEvent(new CustomEvent('bb:statechange'));
  });
})();
```

- [ ] **Step 2: Commit**

```bash
git add assets/balance-budget.js
git commit -m "$(cat <<'EOF'
Balance the Budget: data loading and checklist rendering

Client-side runtime that loads items + consequences JSON, renders a
per-category checklist with tier-specific amounts, and handles tier
switching with a reset confirm. Dispatches bb:statechange events that
later tasks (status bar, consequences panel, success state) will
subscribe to.

Uses existing site IIFE pattern. Early-returns on pages without
.bb-checklist.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Status bar live update

**Files:**
- Modify: `assets/balance-budget.js` (add status-bar update handler)

- [ ] **Step 1: Append status-bar handler to balance-budget.js**

Append before the closing `})();` of the IIFE:

```javascript
  // ── Status bar ──
  const statusBar = document.querySelector('.bb-status-bar');
  const elTarget = document.querySelector('[data-bind="target"]');
  const elCuts = document.querySelector('[data-bind="cuts"]');
  const elGap = document.querySelector('[data-bind="gap"]');

  function updateStatusBar() {
    if (!statusBar) return;
    const target = TIER_TARGETS[state.tier];
    const cuts = window.__bbState.getCuts();
    const gap = target - cuts;

    elTarget.textContent = formatUSD(target);
    elCuts.textContent = formatUSD(cuts);
    elGap.textContent = gap >= 0 ? formatUSD(gap) : formatUSD(gap) + ' (over target)';

    statusBar.classList.toggle('bb-balanced', gap <= 0);
  }

  document.addEventListener('bb:statechange', updateStatusBar);
```

- [ ] **Step 2: Commit**

```bash
git add assets/balance-budget.js
git commit -m "$(cat <<'EOF'
Balance the Budget: live status bar updates

Status bar binds to target/cuts/gap from __bbState via bb:statechange
events. Balanced state (gap <= 0) triggers .bb-balanced class, which
shifts the bar to a neutral success tint (no green/red).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Consequences engine

**Files:**
- Modify: `assets/balance-budget.js` (add consequences computation and render)

- [ ] **Step 1: Append consequences engine to balance-budget.js**

Append before the closing `})();`:

```javascript
  // ── Consequences panel ──
  const consequencesList = document.querySelector('.bb-consequences-list');
  const consequencesCount = document.querySelector('[data-bind="consequence-count"]');

  function triggeredConsequences() {
    const triggered = new Set();

    for (const item of itemsData) {
      if (item.type === 'discrete') {
        // Discrete consequences fire when the item is UNCHECKED.
        // That means the user is restoring/funding the item, NOT cutting it.
        // For cut-semantics: discrete consequences fire when the item IS checked
        // (user is making this specific cut).
        if (state.checkedIds.has(item.id) && item.consequences) {
          for (const cid of item.consequences) triggered.add(cid);
        }
      } else if (item.type === 'scalar') {
        // Scalar consequences fire at threshold_gt.
        if (item.id === 'schools_cut' && item.consequences) {
          for (const c of item.consequences) {
            if (typeof c === 'object' && c.threshold_gt !== undefined && state.schoolsCut > c.threshold_gt) {
              triggered.add(c.id);
            }
          }
        }
      }
    }

    return Array.from(triggered);
  }

  function renderConsequences() {
    if (!consequencesList) return;
    const triggered = triggeredConsequences();
    consequencesCount.textContent = String(triggered.length);
    consequencesList.innerHTML = '';

    if (triggered.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'bb-consequence-empty';
      empty.textContent = 'No mandate or rating-agency consequences triggered by the current plan.';
      consequencesList.appendChild(empty);
      return;
    }

    for (const cid of triggered) {
      const cons = consequencesData[cid];
      if (!cons) continue;

      const card = document.createElement('div');
      card.className = 'bb-consequence-card';

      const h = document.createElement('h4');
      h.textContent = cons.name;
      card.appendChild(h);

      const authority = document.createElement('p');
      authority.className = 'bb-cc-authority';
      authority.textContent = cons.authority;
      card.appendChild(authority);

      const effect = document.createElement('p');
      effect.className = 'bb-cc-effect';
      effect.textContent = cons.effect;
      card.appendChild(effect);

      if (cons.links && cons.links.length) {
        const links = document.createElement('p');
        links.className = 'bb-cc-links';
        cons.links.forEach((l, i) => {
          const a = document.createElement('a');
          a.href = l.url;
          a.textContent = l.label;
          a.target = '_blank';
          a.rel = 'noopener';
          links.appendChild(a);
          if (i < cons.links.length - 1) links.appendChild(document.createTextNode(' · '));
        });
        card.appendChild(links);
      }

      consequencesList.appendChild(card);
    }
  }

  document.addEventListener('bb:statechange', renderConsequences);
```

**Semantics note for the implementer:** Every checkbox in this tool represents a **cut the user proposes to make**. The item data calls each entry "Cut: X" because checking it means the user is NOT funding/restoring X. Consequences therefore fire when the item IS checked (the cut has been made). Do not reverse this.

- [ ] **Step 2: Commit**

```bash
git add assets/balance-budget.js
git commit -m "$(cat <<'EOF'
Balance the Budget: live consequences engine

Consequences fire when a cut is made (discrete item checked) or a
scalar crosses its threshold (schools_cut > 2.5M triggers NSS floor
violation). Panel renders each triggered consequence as a card with
authority citation and effect text from the consequences JSON.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: Success state with town-plan comparison

**Files:**
- Modify: `assets/balance-budget.js` (add success render)

- [ ] **Step 1: Append success renderer to balance-budget.js**

Append before the closing `})();`:

```javascript
  // ── Success state ──
  const successSection = document.querySelector('.bb-success');

  function townPlanCutsForTier() {
    // Town's no-override plan: every discrete item is cut (not funded),
    // plus schools cut $1.5M.
    const townChecked = new Set();
    let townTotal = 0;
    for (const item of itemsData) {
      if (item.type === 'discrete') {
        const amount = item.amounts[`tier_${state.tier}`];
        if (amount > 0) {
          townChecked.add(item.id);
          townTotal += amount;
        }
      }
    }
    townTotal += 1500000; // schools
    return { townChecked, townTotal };
  }

  function renderSuccess() {
    if (!successSection) return;
    const target = TIER_TARGETS[state.tier];
    const cuts = window.__bbState.getCuts();
    if (cuts < target) {
      successSection.hidden = true;
      return;
    }

    const { townChecked, townTotal } = townPlanCutsForTier();
    const userChecked = state.checkedIds;

    const overlapIds = Array.from(userChecked).filter(id => townChecked.has(id));
    const userCutTownDidnt = Array.from(userChecked).filter(id => !townChecked.has(id));
    const userKeptTownCut = Array.from(townChecked).filter(id => !userChecked.has(id));

    const schoolsDelta = state.schoolsCut - 1500000;

    successSection.hidden = false;
    successSection.innerHTML = `
      <h2>Your plan closes the Tier ${state.tier} FY27 gap.</h2>
      <div class="bb-success-comparison">
        <table>
          <thead>
            <tr><th></th><th>Your plan</th><th>Town's no-override plan</th></tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">Total cuts</th>
              <td>${formatUSD(cuts)}</td>
              <td>${formatUSD(townTotal)}</td>
            </tr>
            <tr>
              <th scope="row">Schools cut</th>
              <td>${formatUSD(state.schoolsCut)}${schoolsDelta !== 0 ? ` (${schoolsDelta > 0 ? '+' : ''}${formatUSD(schoolsDelta)} vs town)` : ''}</td>
              <td>${formatUSD(1500000)}</td>
            </tr>
            <tr>
              <th scope="row">Item cuts shared with town</th>
              <td colspan="2">${overlapIds.length} items (${formatUSD(sumAmounts(overlapIds))})</td>
            </tr>
            <tr>
              <th scope="row">Items you cut, town protected</th>
              <td colspan="2">${userCutTownDidnt.length === 0 ? 'None' : userCutTownDidnt.length + ' items'}</td>
            </tr>
            <tr>
              <th scope="row">Items you kept, town cut</th>
              <td colspan="2">${userKeptTownCut.length === 0 ? 'None' : userKeptTownCut.length + ' items (' + formatUSD(sumAmounts(userKeptTownCut)) + ')'}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p class="bb-success-note">These are the legal, regulatory, and policy consequences of the plan above, not a judgment about whether the plan is good policy.</p>
    `;
  }

  function sumAmounts(ids) {
    let total = 0;
    const byId = new Map(itemsData.filter(i => i.type === 'discrete').map(i => [i.id, i]));
    for (const id of ids) {
      const item = byId.get(id);
      if (!item) continue;
      total += item.amounts[`tier_${state.tier}`];
    }
    return total;
  }

  document.addEventListener('bb:statechange', renderSuccess);
```

- [ ] **Step 2: Commit**

```bash
git add assets/balance-budget.js
git commit -m "$(cat <<'EOF'
Balance the Budget: success state with town-plan comparison

When user's cuts >= tier target, unfold a success block showing
side-by-side comparison: total cuts, schools cut delta, item overlap,
items cut only by the user, items kept that the town cut. Neutral
framing per STYLE_GUIDE. No judgment language.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: Cross-links from existing pages

**Files:**
- Modify: `no-override-budget.html` (add link near the end of the content)
- Modify: `what-is-the-override.html` (add link after the tier section)

- [ ] **Step 1: Read both target pages to find the best insertion points**

Run: `grep -nE '(<h2|<footer|<\/main|<section class=\"bb-footer)' no-override-budget.html | head -10`

Note the last `<h2>` or `<section>` before the main-element close. Insertion point is just before `</main>` or at the end of the last content section.

- [ ] **Step 2: Insert cross-link into no-override-budget.html**

Find the last `</section>` before `</main>` in `no-override-budget.html`. Just before that `</main>`, insert:

```html
<aside class="bb-crosslink-promo">
  <h3>Think you can do better?</h3>
  <p>Build your own FY27 cut plan and see which state-law consequences it triggers. <a href="/balance-the-budget.html">Balance the FY27 budget &rarr;</a></p>
</aside>
```

- [ ] **Step 3: Insert cross-link into what-is-the-override.html**

Find the end of the tier-card section (after the last tier card). Insert the same pattern:

```html
<aside class="bb-crosslink-promo">
  <h3>Think you can match these restorations without a levy increase?</h3>
  <p>Build your own FY27 cut plan against any tier's target. <a href="/balance-the-budget.html">Balance the FY27 budget &rarr;</a></p>
</aside>
```

- [ ] **Step 4: Add scoped CSS for the crosslink aside**

Append to `assets/site.css`:

```css
.bb-crosslink-promo {
  margin: 28px 0;
  padding: 16px 20px;
  border-left: 3px solid var(--c-navy);
  background: color-mix(in srgb, var(--c-navy) 3%, var(--surface));
  border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
}
.bb-crosslink-promo h3 {
  margin: 0 0 6px;
  font-size: 16px;
}
.bb-crosslink-promo p {
  margin: 0;
  line-height: 1.5;
}
```

- [ ] **Step 5: Commit**

```bash
git add no-override-budget.html what-is-the-override.html assets/site.css
git commit -m "$(cat <<'EOF'
Balance the Budget: cross-links from no-override and override pages

Both pages get a small .bb-crosslink-promo aside linking into the new
interactive tool. No changes to existing content.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 11: Smoke test using Playwright

**Files:**
- Create: `tests/balance-budget-test.mjs`

- [ ] **Step 1: Write the smoke test**

Create `tests/balance-budget-test.mjs`:

```javascript
/**
 * Smoke test for balance-the-budget.html
 *
 * Runs against a deployed URL (pass via SITE env var).
 * Matches the convention in tests/smoke-test.mjs: Playwright Chromium,
 * no test framework, direct node execution.
 *
 *   SITE=https://<preview-url> node tests/balance-budget-test.mjs
 */
import { chromium } from 'playwright';

const SITE = process.env.SITE || 'https://marbleheaddata.org';
const URL = SITE + '/balance-the-budget.html';

let passed = 0;
let failed = 0;
function ok(name) { passed++; console.log(`  PASS: ${name}`); }
function fail(name, detail) { failed++; console.log(`  FAIL: ${name} — ${detail}`); }

async function run() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  try {
    await page.goto(URL, { waitUntil: 'networkidle' });

    // Page loads.
    const h1 = await page.textContent('h1');
    h1 && h1.includes('Balance') ? ok('H1 renders') : fail('H1', `got "${h1}"`);

    // Tier selector has 3 buttons.
    const tierBtns = await page.$$('.bb-tier-btn');
    tierBtns.length === 3 ? ok('3 tier buttons') : fail('Tier buttons', `expected 3, got ${tierBtns.length}`);

    // Checklist renders items.
    const rows = await page.$$('.bb-item-row');
    rows.length >= 15 ? ok(`${rows.length} checklist rows`) : fail('Checklist rows', `expected >= 15, got ${rows.length}`);

    // Status bar shows target.
    const target = await page.textContent('[data-bind="target"]');
    target && target.includes('1,269,564') ? ok('Tier 1 target shown') : fail('Target', `got "${target}"`);

    // Checking a box updates the cuts total.
    await page.check('.bb-item-row input[type="checkbox"]', { force: true });
    await page.waitForTimeout(100);
    const cutsAfter = await page.textContent('[data-bind="cuts"]');
    cutsAfter && cutsAfter !== '$0' ? ok('Cuts total updates on check') : fail('Cuts update', `got "${cutsAfter}"`);

    // Switching tiers prompts a confirm. Accept the dialog.
    page.once('dialog', d => d.accept());
    await page.click('.bb-tier-btn[data-tier="2"]');
    await page.waitForTimeout(200);
    const tier2Target = await page.textContent('[data-bind="target"]');
    tier2Target && tier2Target.includes('2,805,236') ? ok('Tier 2 switch updates target') : fail('Tier 2 switch', `got "${tier2Target}"`);

    // Scalar input (schools) accepts a value.
    const schoolsInput = await page.$('#bb-schools_cut');
    schoolsInput ? ok('Schools scalar present') : fail('Schools scalar', 'not found');
    if (schoolsInput) {
      await schoolsInput.fill('3000000');
      await page.waitForTimeout(100);
      const cuts = await page.textContent('[data-bind="cuts"]');
      cuts && cuts.includes('3,') ? ok('Schools scalar updates cuts') : fail('Schools scalar update', `got "${cuts}"`);

      // NSS consequence fires above $2.5M.
      const count = await page.textContent('[data-bind="consequence-count"]');
      Number(count) >= 1 ? ok('NSS consequence triggers at high school cut') : fail('NSS consequence', `count=${count}`);
    }

    // Reset button clears plan.
    await page.click('.bb-reset');
    await page.waitForTimeout(100);
    const cutsReset = await page.textContent('[data-bind="cuts"]');
    cutsReset && cutsReset.includes('1,500,000') ? ok('Reset restores defaults') : fail('Reset', `got "${cutsReset}"`);
  } finally {
    await browser.close();
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

run().catch(err => {
  console.error(err);
  process.exit(2);
});
```

- [ ] **Step 2: Commit**

```bash
git add tests/balance-budget-test.mjs
git commit -m "$(cat <<'EOF'
Balance the Budget: add Playwright smoke test

Tests: page load, tier selector count, checklist rendering, status
bar updates on check, tier switch confirmation, schools scalar
input, NSS consequence threshold, reset behavior. Matches existing
tests/smoke-test.mjs conventions (Chromium, no framework, SITE env
var).

Does not run in CI; intended for manual execution against the
Cloudflare Pages preview URL before merging the PR.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 12: Push branch, open PR, run smoke test on preview

- [ ] **Step 1: Push the branch using the PAT**

Per `reference_github_auth` memory: use the PAT from `.env` GITHUB_TOKEN on the first push, not a fallback.

Run:

```bash
set -a; source /Users/agbaber/marblehead/.env; set +a
git push -u https://${GITHUB_TOKEN}@github.com/agbaber/marblehead.git claude/balance-budget-tool
```

- [ ] **Step 2: Open a PR**

Run:

```bash
gh pr create --title "Balance the Budget interactive tool" --body "$(cat <<'EOF'
## Summary

- New page `balance-the-budget.html` lets readers build their own FY27
  cut plan against a selectable override tier target ($1.27M / $2.81M
  / $4.30M — the FY27 draw amounts for Tiers 1/2/3).
- Live consequences panel shows which state-law or regulatory
  violations the current plan triggers (MBLC decertification, NSS
  floor, OPEB skip, Stabilization skip, Workers Comp, SRO, MBLC MER).
- Success state when the plan closes the gap shows a side-by-side
  comparison with the Town Administrator's proposed cuts.
- Cross-linked from `no-override-budget.html` and
  `what-is-the-override.html`.

Design spec: `docs/superpowers/specs/2026-04-24-balance-the-budget-tool-design.md`
Implementation plan: `docs/superpowers/plans/2026-04-24-balance-the-budget-tool.md`

## Test plan

- [ ] Wait for Cloudflare Pages preview deploy
- [ ] Run `SITE=<preview-url> node tests/balance-budget-test.mjs` and confirm all PASS
- [ ] Manually exercise on desktop: tier switch, checkbox interaction, scalar input, consequences render, success block
- [ ] Manually exercise on mobile (Safari iOS): consequences panel collapses inline, layout is readable, tap targets work
- [ ] Read full page copy against STYLE_GUIDE.md and CLAUDE.md (no em-dashes, no meta-narration, no editorial language)
- [ ] Confirm cross-links from no-override and override pages render and point correctly

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 3: Wait for the preview URL to appear on the PR**

Run:

```bash
gh pr view --json number,url
```

Note the PR number. Then poll for the preview comment:

```bash
PR_NUM=$(gh pr view --json number --jq .number)
gh api repos/agbaber/marblehead/issues/${PR_NUM}/comments --jq '.[] | select(.body | startswith("### Preview")) | .body' | head -30
```

Expected: see a comment body starting with `### Preview` containing `**Branch URL:**` and `**This commit:**` lines.

If the comment is not there yet, wait for the `preview` GitHub Actions workflow to complete (typically 1-3 minutes). Do not report a bare PR link; per `CLAUDE.md`, fetch the preview URL before asking for review.

- [ ] **Step 4: Run smoke test against the preview URL**

Run:

```bash
BRANCH_URL=$(gh api repos/agbaber/marblehead/issues/${PR_NUM}/comments --jq '.[] | select(.body | startswith("### Preview")) | .body' | grep -oE 'Branch URL.*https://[^ )]+' | grep -oE 'https://[^ )]+' | head -1)
echo "Branch URL: $BRANCH_URL"
SITE=$BRANCH_URL node tests/balance-budget-test.mjs
```

Expected: the script prints PASS for each check and `N passed, 0 failed` at the end.

If any check FAILs, diagnose the failure on the preview URL, fix in the local branch, commit, push, wait for preview redeploy, and re-run.

- [ ] **Step 5: Manually exercise in a real browser**

Open the preview URL in Chrome desktop:

- Click each tier button; confirm targets change.
- Check a box, see cuts total rise, gap fall.
- Uncheck; values return.
- Enter `3000000` in the schools scalar; confirm NSS consequence card appears.
- Click "Don't cut ($0)" preset; confirm cuts total drops.
- Build a plan that closes the gap; confirm success block unfolds with comparison table.
- Click Reset; confirm plan clears back to defaults.

Open the same URL in Safari on iOS (or Chrome mobile emulation in DevTools):

- Confirm tier buttons stack on narrow viewports.
- Confirm consequences panel moves from sidebar to inline block.
- Confirm status bar stays sticky.
- Confirm scalar input and preset buttons are readable and tappable.

- [ ] **Step 6: Full copy review against STYLE_GUIDE.md and CLAUDE.md**

Read `balance-the-budget.html` and all user-facing strings in `assets/balance-budget.js`. Verify:

- No em-dashes (`--`, `&mdash;`). Use commas, colons, or parens instead. (Per `feedback_no_emdash_in_edits` memory.)
- No meta-narration ("This page lets you...", "This tool helps you..."). (Per `CLAUDE.md` "No meta-narration" section.)
- No editorial language ("crisis", "shocking", "outrageous", etc.). (Per `CLAUDE.md` "Editorial stance.")
- No green/red value judgments in the success state. (Per `STYLE_GUIDE.md`.)
- Every dollar figure and legal citation traces to a primary source. Any number flagged "to verify" in Task 3 must be resolved before this step passes.

If any violations are found, fix them in place, commit, and push. Re-run the smoke test to confirm nothing regressed.

- [ ] **Step 7: Post the preview URL to the user and request review**

At this point the tool is shippable pending user review. Report to the user:
- The PR URL
- The preview Branch URL (copy-paste from the sticky preview comment)
- Confirmation that the smoke test passes and manual checks passed
- Any unresolved TODOs (particularly the primary-source number verification from Task 3)

Default to a manual merge after user approval (`gh pr merge <n> --squash --delete-branch`). Do NOT use `--auto` unless the user explicitly asks for fire-and-forget merge. Per `CLAUDE.md` on merge defaults.

---

## Self-review checklist

**Spec coverage:**
- Page concept and URL → Task 4 (HTML skeleton with frontmatter)
- Tier selector → Task 4 (markup), Task 6 (JS handlers)
- Running status bar → Task 4 (markup), Task 7 (JS)
- Cuts checklist → Task 6 (JS render)
- School scalar input with presets → Task 6 (JS scalar renderer)
- Consequences panel live → Task 8
- Success block with comparison → Task 9
- Reset button → Task 6 (initResetButton)
- Cross-links from no-override and override pages → Task 10
- Items JSON + consequences JSON → Tasks 1 and 2
- Primary-source verification of flagged numbers → Task 3
- Mobile responsive layout → Task 5 (CSS media queries) + Task 11 (manual mobile check)
- Smoke test on preview URL → Task 11 (script), Task 12 (execution)
- Preview URL posting per CLAUDE.md → Task 12 Step 7

**Placeholder scan:**
- No "TBD", "TODO", or "implement later" in code blocks.
- Task 3 has explicit fallback if primary-source numbers are not available (qualitative text, documented in commit). Not a placeholder; a researched open question.
- Every code step includes complete code blocks.

**Type consistency:**
- `state.checkedIds` (Set) used consistently across Tasks 6, 8, 9.
- `window.__bbState` accessor used consistently.
- `bb:statechange` event dispatched and subscribed in the same form across Tasks 6, 7, 8, 9.
- `TIER_TARGETS` constant defined once, used in Tasks 6, 7, 9.
- `formatUSD` defined once in Task 6, used in Tasks 7, 9.
- Item property shape (`amounts.tier_1`, `amounts.tier_2`, `amounts.tier_3`) consistent between generator (Task 1) and renderer (Task 6).

**Convention consistency with existing project:**
- JS in `assets/` with IIFE pattern matches `assets/ballot.js`.
- Data in `data/` (not `_data/`) matches `assets/catalog.js` fetch pattern.
- Tests in `tests/*.mjs` with Playwright, no framework, matches `tests/smoke-test.mjs`.
- CSS scoped to a `.bb-*` prefix, appended to `assets/site.css`, matches patterns in existing calculator pages.
- Frontmatter with `scripts: [...]` array matches existing pages.
