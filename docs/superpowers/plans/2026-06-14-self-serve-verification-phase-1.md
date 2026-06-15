# Self-Serve Verification — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a working self-serve verification door: a visitor signs in with Facebook, claims their Marblehead address from a typeahead, and is either auto-verified against the FY2025 assessor record (named owner match) or routed to the existing invite-handshake vouch flow as a fallback. Includes a new `/verify-me.html` front door, a new `/profile` page (identity controls only — engagement comes in Phase 2), and the worker plumbing behind both.

**Architecture:** Extend the existing community-pulse Cloudflare Worker with new endpoint groups: `/api/auth/fb/*` (OAuth), `/api/claim/address` (match against a private D1 `parcel_owners` table), and `/api/profile` (GET/POST). The match algorithm is a pure module with its own test file. A new `scripts/sync_parcel_owners.mjs` operator command imports the gitignored `data/parcels_raw/parcels_full.csv` into D1 at deploy time. Two new Jekyll pages (`verify-me.html`, `profile.html`) plus a thin JS controller (`assets/community-pulse/claim.js`) drive the client. The existing invite-handshake door at `/verify.html` is unchanged.

**Tech stack:** Cloudflare Workers + D1 + wrangler 4.x; vitest with the existing miniflare-style test harness in `community-pulse/tests/`; Jekyll (3.10) for HTML pages; vanilla JS for clients; Facebook OAuth via the `dialog/oauth` flow plus the Graph API `/me?fields=id,name,picture,link` endpoint.

**Prerequisites (NOT part of this plan):**

1. The `claude/patriot-parcel-ingestion` branch must be merged to main. That branch provides the gitignored `data/parcels_raw/parcels_full.csv` (~8,800 rows of MA FY2025 parcels with owner names and mailing addresses) and the `scripts/fetch_massgis_parcels.py` ingestion script. The operator must have `data/parcels_raw/parcels_full.csv` present locally before running Task 4 of this plan.
2. A Facebook developer app named "Marblehead Data" must be registered to the operator's FB developer account. The plan covers app *configuration* (redirect URI, scopes, privacy/terms URLs) but assumes the app shell exists.

**Spec:** [`docs/superpowers/specs/2026-06-14-self-serve-verification-design.md`](../specs/2026-06-14-self-serve-verification-design.md). Refer to it for the why and the broader context across all phases.

---

## File structure (Phase 1)

**New files:**

| Path | Purpose |
|---|---|
| `community-pulse/worker/schema/0006_self_serve_verification.sql` | ALTER residents (+5 columns), CREATE parcel_owners |
| `community-pulse/worker/src/match.js` | Pure functions: tokenize, normalizeAddress, matchOwner |
| `community-pulse/worker/src/fb.js` | FB OAuth: buildAuthorizeUrl, exchangeCode, fetchMe |
| `community-pulse/worker/src/claim.js` | `/api/claim/address` handler |
| `community-pulse/worker/src/profile.js` | `/api/profile` GET/POST, DELETE /api/claim |
| `community-pulse/tests/match.test.js` | Unit tests for the match module |
| `community-pulse/tests/claim.test.js` | Integration tests for `/api/claim/address` |
| `community-pulse/tests/fb.test.js` | Tests for FB OAuth helpers with stubbed fetch |
| `community-pulse/tests/profile.test.js` | Tests for `/api/profile` endpoints |
| `scripts/sync_parcel_owners.mjs` | Operator script: CSV → D1 |
| `scripts/test_sync_parcel_owners.mjs` | Tiny inline test for the row builder |
| `verify-me.html` | Self-serve front-door Jekyll page |
| `profile.html` | Profile Jekyll page (identity controls only in Phase 1) |
| `terms.html` | Required for FB app review |
| `assets/community-pulse/claim.js` | `verify-me.html` controller (FB OAuth bootstrap + claim form + result branching) |
| `assets/community-pulse/profile.js` | `profile.html` controller |

**Modified files:**

| Path | Change |
|---|---|
| `community-pulse/worker/src/index.js` | Route new endpoint groups; add `verifyJWT`-protected branches |
| `community-pulse/worker/src/jwt.js` | Support `pre_resident: true` payload (FB-signed-in but no claim yet) |
| `community-pulse/worker/wrangler.toml` | Add `FB_APP_ID`, declare `FB_APP_SECRET` env var |
| `assets/community-pulse/verified.js` | Tiny addition: a `signOut` exported helper used by `profile.js` |
| `privacy.html` | Add Facebook OAuth disclosure section |
| `_config.yml` | Add `engagement_widget: on` flag (used in Phase 2; harmless now) |
| `tests/smoke-test.mjs` | Add smoke for `/verify-me.html`, `/profile.html`, `/terms.html` |
| `community-pulse/README.md` | Document the FB OAuth setup and parcel sync command |

---

## Conventions used across all tasks

- **Test framework:** vitest. Existing tests at `community-pulse/tests/*.test.js` show the patterns — imports from `'../worker/src/...'`, in-memory `MockD1Database`, stubbed `crypto.subtle`. New tests follow the same shape.
- **Run a single test:** `cd community-pulse && npx vitest run tests/<file>.test.js -t '<test name>'`.
- **Run worker locally:** `cd community-pulse && npx wrangler dev --local`. The local D1 instance is created on first run.
- **Apply migrations locally:** `cd community-pulse && npx wrangler d1 migrations apply community-pulse-staging --local` for the staging DB. The new migration file gets picked up automatically by wrangler if named with the next available number.
- **Commit cadence:** every passing test gets a commit. No combining multiple features into one commit.
- **Branch for execution:** create off `main` as `claude/self-serve-verification-phase-1`. The spec lives on `spec/self-serve-verification`; merge that to main first so the spec is available as a reference for reviewers.

---

## Task 1: Schema migration

**Files:**
- Create: `community-pulse/worker/schema/0006_self_serve_verification.sql`

- [ ] **Step 1: Write the migration SQL**

Create `community-pulse/worker/schema/0006_self_serve_verification.sql`:

```sql
-- Self-serve verification: FB-authed residents + private parcel-owner table.
-- See docs/superpowers/specs/2026-06-14-self-serve-verification-design.md

-- Extend residents to support multiple auth/claim paths and FB identity.
-- All defaults preserve the behavior of existing invite-vouched residents.
ALTER TABLE residents ADD COLUMN auth_source     TEXT    NOT NULL DEFAULT 'invite';
ALTER TABLE residents ADD COLUMN claim_source    TEXT    NOT NULL DEFAULT 'vouched';
ALTER TABLE residents ADD COLUMN display_name    TEXT;
ALTER TABLE residents ADD COLUMN public_identity INTEGER NOT NULL DEFAULT 0;
ALTER TABLE residents ADD COLUMN fb_user_id      TEXT;
ALTER TABLE residents ADD COLUMN fb_profile_url  TEXT;
CREATE INDEX IF NOT EXISTS idx_residents_fb_user_id ON residents(fb_user_id);

-- Private. Owner names are PII. NEVER read by any GET endpoint.
-- Rebuilt at deploy time from the gitignored parcels_full.csv via
-- scripts/sync_parcel_owners.mjs.
CREATE TABLE IF NOT EXISTS parcel_owners (
  address_normalized TEXT PRIMARY KEY,
  owner_name         TEXT NOT NULL,
  parcel_id          TEXT,
  fy                 INTEGER,
  updated_at         INTEGER NOT NULL
);
```

- [ ] **Step 2: Apply migration to local D1 and confirm**

Run from repo root:

```bash
cd community-pulse && npx wrangler d1 migrations apply community-pulse-staging --local
```

Expected: wrangler lists `0006_self_serve_verification.sql` as applied.

Then verify the schema:

```bash
cd community-pulse && npx wrangler d1 execute community-pulse-staging --local \
  --command "SELECT name FROM sqlite_master WHERE type='table' AND name='parcel_owners';"
```

Expected output: `parcel_owners`.

```bash
cd community-pulse && npx wrangler d1 execute community-pulse-staging --local \
  --command "PRAGMA table_info(residents);"
```

Expected: rows for `auth_source`, `claim_source`, `display_name`, `public_identity`, `fb_user_id`, `fb_profile_url` are present in the output.

- [ ] **Step 3: Commit**

```bash
git add community-pulse/worker/schema/0006_self_serve_verification.sql
git commit -m "schema: extend residents + add parcel_owners for self-serve verify"
```

---

## Task 2: Match algorithm — tokenize

**Files:**
- Create: `community-pulse/worker/src/match.js`
- Create: `community-pulse/tests/match.test.js`

- [ ] **Step 1: Write the failing tokenize tests**

Create `community-pulse/tests/match.test.js`:

```javascript
import { describe, it, expect } from 'vitest';
import { tokenize } from '../worker/src/match.js';

describe('tokenize', () => {
  it('lowercases and splits on whitespace', () => {
    expect(tokenize('John Smith')).toEqual(['john', 'smith']);
  });

  it('strips trailing/leading punctuation per token', () => {
    expect(tokenize('J. Smith')).toEqual(['j', 'smith']);
    expect(tokenize('Smith, John')).toEqual(['smith', 'john']);
  });

  it('treats & and / as separators (co-owner joins)', () => {
    expect(tokenize('SMITH JOHN A & SMITH JANE M'))
      .toEqual(['smith', 'john', 'a', 'smith', 'jane', 'm']);
    expect(tokenize('SMITH/JONES')).toEqual(['smith', 'jones']);
  });

  it('drops the connector word "AND"', () => {
    expect(tokenize('SMITH JOHN AND SMITH JANE'))
      .toEqual(['smith', 'john', 'smith', 'jane']);
  });

  it('returns empty on empty input', () => {
    expect(tokenize('')).toEqual([]);
    expect(tokenize('   ')).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd community-pulse && npx vitest run tests/match.test.js
```

Expected: FAIL — `match.js` does not export `tokenize`.

- [ ] **Step 3: Implement tokenize**

Create `community-pulse/worker/src/match.js`:

```javascript
// Pure match module. No I/O, no globals. Used by /api/claim/address.

/**
 * Lowercase and split a name string into clean tokens.
 * Treats &, /, and the literal "AND" as separators (co-owner joins).
 * Strips leading/trailing punctuation per token.
 *
 * @param {string} s
 * @returns {string[]}
 */
export function tokenize(s) {
  if (!s) return [];
  return s
    .toLowerCase()
    .split(/[\s&/,]+/)
    .map(t => t.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, ''))
    .filter(t => t.length > 0 && t !== 'and');
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd community-pulse && npx vitest run tests/match.test.js
```

Expected: 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add community-pulse/worker/src/match.js community-pulse/tests/match.test.js
git commit -m "match: add tokenize helper with co-owner separator support"
```

---

## Task 3: Match algorithm — address normalization

**Files:**
- Modify: `community-pulse/worker/src/match.js`
- Modify: `community-pulse/tests/match.test.js`

- [ ] **Step 1: Write the failing normalizeAddress tests**

Append to `community-pulse/tests/match.test.js`:

```javascript
import { normalizeAddress } from '../worker/src/match.js';

describe('normalizeAddress', () => {
  it('uppercases and collapses whitespace', () => {
    expect(normalizeAddress('12 State St')).toBe('12 STATE STREET');
    expect(normalizeAddress('  12   state   st  ')).toBe('12 STATE STREET');
  });

  it('expands common abbreviations', () => {
    expect(normalizeAddress('5 Beacon Ave')).toBe('5 BEACON AVENUE');
    expect(normalizeAddress('77 Pleasant Rd')).toBe('77 PLEASANT ROAD');
    expect(normalizeAddress('3 Harbor Dr')).toBe('3 HARBOR DRIVE');
    expect(normalizeAddress('9 Maple Ln')).toBe('9 MAPLE LANE');
    expect(normalizeAddress('1 Court Pl')).toBe('1 COURT PLACE');
    expect(normalizeAddress('22 Foster Ct')).toBe('22 FOSTER COURT');
    expect(normalizeAddress('14 Memorial Blvd')).toBe('14 MEMORIAL BOULEVARD');
    expect(normalizeAddress('8 Sunset Ter')).toBe('8 SUNSET TERRACE');
    expect(normalizeAddress('100 Atlantic Hwy')).toBe('100 ATLANTIC HIGHWAY');
  });

  it('strips trailing unit suffixes', () => {
    expect(normalizeAddress('12 State St Unit 3')).toBe('12 STATE STREET');
    expect(normalizeAddress('12 State St Apt 2')).toBe('12 STATE STREET');
    expect(normalizeAddress('12 State St #5')).toBe('12 STATE STREET');
    expect(normalizeAddress('12 State St, #5')).toBe('12 STATE STREET');
  });

  it('strips trailing punctuation', () => {
    expect(normalizeAddress('12 State St.')).toBe('12 STATE STREET');
  });

  it('is idempotent', () => {
    const once = normalizeAddress('12 State St');
    expect(normalizeAddress(once)).toBe(once);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd community-pulse && npx vitest run tests/match.test.js -t normalizeAddress
```

Expected: FAIL — `normalizeAddress` not exported.

- [ ] **Step 3: Implement normalizeAddress**

Append to `community-pulse/worker/src/match.js`:

```javascript
const ABBREVIATIONS = {
  ST: 'STREET',
  AVE: 'AVENUE',
  RD: 'ROAD',
  DR: 'DRIVE',
  LN: 'LANE',
  CT: 'COURT',
  PL: 'PLACE',
  BLVD: 'BOULEVARD',
  TER: 'TERRACE',
  HWY: 'HIGHWAY',
  PKWY: 'PARKWAY',
  CIR: 'CIRCLE',
  SQ: 'SQUARE',
};

/**
 * Normalize a Marblehead address into a canonical form used for
 * parcel_owners lookups. Uppercases, expands standard street-type
 * abbreviations, and strips trailing unit suffixes.
 *
 * Examples:
 *   '12 State St'        -> '12 STATE STREET'
 *   '12 State St Unit 3' -> '12 STATE STREET'
 *
 * @param {string} s
 * @returns {string}
 */
export function normalizeAddress(s) {
  if (!s) return '';
  let out = s.toUpperCase().trim();
  // Strip trailing unit suffixes: ", #5" / "UNIT 3" / "APT 2" / "#5"
  out = out.replace(/[,\s]+(?:UNIT|APT|#)\s*\S+\s*$/u, '');
  // Strip trailing punctuation on the whole string.
  out = out.replace(/[^\p{L}\p{N}]+$/u, '');
  // Collapse whitespace.
  out = out.replace(/\s+/g, ' ');
  // Expand abbreviations as whole tokens.
  out = out
    .split(' ')
    .map(tok => {
      const bare = tok.replace(/[^\p{L}\p{N}]/gu, '');
      return ABBREVIATIONS[bare] || tok;
    })
    .join(' ');
  return out;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd community-pulse && npx vitest run tests/match.test.js
```

Expected: all tests in the file pass (tokenize + normalizeAddress).

- [ ] **Step 5: Commit**

```bash
git add community-pulse/worker/src/match.js community-pulse/tests/match.test.js
git commit -m "match: add normalizeAddress helper with abbreviation expansion"
```

---

## Task 4: Match algorithm — matchOwner

**Files:**
- Modify: `community-pulse/worker/src/match.js`
- Modify: `community-pulse/tests/match.test.js`

- [ ] **Step 1: Write the failing matchOwner tests (case table from spec)**

Append to `community-pulse/tests/match.test.js`:

```javascript
import { matchOwner } from '../worker/src/match.js';

describe('matchOwner', () => {
  const cases = [
    // [label, fb_name, owner_name, expectedStatus, expectedAlternatives?]
    ['full match on first co-owner',
     'John Smith', 'SMITH JOHN A & SMITH JANE M', 'match'],
    ['full match on second co-owner',
     'Jane Smith', 'SMITH JOHN A & SMITH JANE M', 'match'],
    ['surname matches, first name does not — surface alternatives',
     'Mike Smith', 'SMITH JOHN A', 'first_initial_mismatch', ['JOHN']],
    ['surname matches, first name does not — multiple alternatives',
     'Mike Smith', 'SMITH JOHN A & SMITH JANE M', 'first_initial_mismatch',
     ['JOHN', 'JANE']],
    ['surname tokens differ',
     'John Smith', 'JOHNSON JOHN', 'name_mismatch'],
    ['trust marker rejects all',
     'John Smith', 'SMITH FAMILY TRUST', 'name_mismatch'],
    ['LLC marker rejects all',
     'John Smith', 'SMITH PROPERTIES LLC', 'name_mismatch'],
    ['user-initial-only matches full deed first name',
     'J. Smith', 'SMITH JOHN A', 'match'],
    ['deed-initial-only matches full FB first name',
     'John Smith', 'SMITH J', 'match'],
    ['both initials ambiguous — accepted',
     'Jane Smith', 'SMITH J', 'match'],
    ['empty FB name -> mismatch',
     '', 'SMITH JOHN', 'name_mismatch'],
    ['single-token FB name -> mismatch',
     'Madonna', 'SMITH JOHN', 'name_mismatch'],
  ];

  it.each(cases)('%s', (_label, fb, owner, status, alts) => {
    const res = matchOwner(fb, owner);
    expect(res.status).toBe(status);
    if (alts !== undefined) expect(res.alternatives).toEqual(alts);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd community-pulse && npx vitest run tests/match.test.js -t matchOwner
```

Expected: FAIL — `matchOwner` not exported.

- [ ] **Step 3: Implement matchOwner**

Append to `community-pulse/worker/src/match.js`:

```javascript
const TRUST_MARKERS = new Set([
  'tr', 'trs', 'trust', 'trustee', 'trustees',
  'llc', 'lp', 'inc', 'corp', 'est', 'estate',
]);

/**
 * Match a Facebook display name against a Marblehead assessor owner string.
 *
 * Returns one of:
 *   { status: 'match' }
 *   { status: 'first_initial_mismatch', alternatives: string[] }
 *   { status: 'name_mismatch' }
 *
 * "first_initial_mismatch" means the surname matched but the first name did
 * not — the alternatives list contains the deed's other given-name tokens,
 * uppercased.
 *
 * @param {string} fbDisplayName
 * @param {string} ownerName
 * @returns {{status: string, alternatives?: string[]}}
 */
export function matchOwner(fbDisplayName, ownerName) {
  const fb = tokenize(fbDisplayName);
  const own = tokenize(ownerName);

  if (fb.length < 2 || own.length < 2) {
    return { status: 'name_mismatch' };
  }

  // Reject any trust/LLC/estate record.
  if (own.some(t => TRUST_MARKERS.has(t))) {
    return { status: 'name_mismatch' };
  }

  const fbFirst = fb[0];
  const fbLast = fb[fb.length - 1];

  if (!own.includes(fbLast)) {
    return { status: 'name_mismatch' };
  }

  // Given-name tokens are the tokens immediately following each occurrence
  // of the surname token on the deed.
  const givens = [];
  for (let i = 0; i < own.length; i++) {
    if (own[i] === fbLast && i + 1 < own.length) {
      givens.push(own[i + 1]);
    }
  }

  for (const gt of givens) {
    if (gt === fbFirst) return { status: 'match' };
    if (gt.length === 1 && gt === fbFirst[0]) return { status: 'match' };
    if (fbFirst.length === 1 && gt.startsWith(fbFirst)) return { status: 'match' };
  }

  return {
    status: 'first_initial_mismatch',
    alternatives: givens.map(g => g.toUpperCase()),
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd community-pulse && npx vitest run tests/match.test.js
```

Expected: all match tests pass (tokenize + normalizeAddress + matchOwner).

- [ ] **Step 5: Commit**

```bash
git add community-pulse/worker/src/match.js community-pulse/tests/match.test.js
git commit -m "match: add matchOwner with strict-with-tunables semantics"
```

---

## Task 5: Parcel sync script

**Files:**
- Create: `scripts/sync_parcel_owners.mjs`
- Create: `scripts/test_sync_parcel_owners.mjs`

- [ ] **Step 1: Write the failing test for buildRow**

Create `scripts/test_sync_parcel_owners.mjs`:

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildRow, parseCsv } from './sync_parcel_owners.mjs';

test('buildRow normalizes address and trims owner', () => {
  const r = buildRow({
    site_addr: ' 12 State St ',
    owner1: 'SMITH JOHN A  ',
    prop_id: '14 50 0',
    fy: '2025',
  });
  assert.equal(r.address_normalized, '12 STATE STREET');
  assert.equal(r.owner_name, 'SMITH JOHN A');
  assert.equal(r.parcel_id, '14 50 0');
  assert.equal(r.fy, 2025);
  assert.ok(typeof r.updated_at === 'number');
});

test('buildRow skips rows with missing address', () => {
  assert.equal(buildRow({ site_addr: '', owner1: 'X' }), null);
  assert.equal(buildRow({ owner1: 'X' }), null);
});

test('buildRow skips rows with missing owner', () => {
  assert.equal(buildRow({ site_addr: '12 State St', owner1: '' }), null);
});

test('parseCsv handles minimal header + row', () => {
  const csv = 'site_addr,owner1,prop_id,fy\n12 State St,SMITH JOHN,14 50 0,2025\n';
  const rows = parseCsv(csv);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].site_addr, '12 State St');
  assert.equal(rows[0].owner1, 'SMITH JOHN');
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
node --test scripts/test_sync_parcel_owners.mjs
```

Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement the script**

Create `scripts/sync_parcel_owners.mjs`:

```javascript
#!/usr/bin/env node
// Sync gitignored parcels_full.csv into D1.parcel_owners.
//
// Usage:
//   node scripts/sync_parcel_owners.mjs \
//        [--csv data/parcels_raw/parcels_full.csv] \
//        [--db community-pulse-staging] [--remote]
//
// Reads the gitignored full parcels CSV (owner name + mailing address),
// projects to {address_normalized, owner_name, parcel_id, fy, updated_at},
// drops trust/LLC/estate rows the matcher will never accept anyway, then
// truncates and reinserts the parcel_owners table via wrangler d1 execute.
//
// Module exports buildRow and parseCsv so they can be tested without I/O.

import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

const ABBREVIATIONS = {
  ST: 'STREET', AVE: 'AVENUE', RD: 'ROAD', DR: 'DRIVE', LN: 'LANE',
  CT: 'COURT', PL: 'PLACE', BLVD: 'BOULEVARD', TER: 'TERRACE',
  HWY: 'HIGHWAY', PKWY: 'PARKWAY', CIR: 'CIRCLE', SQ: 'SQUARE',
};

// Local copy of normalizeAddress so the script has no worker-side import.
// Kept in sync with community-pulse/worker/src/match.js — see Task 6 for the
// shared-helper consolidation that lands once tests anchor both copies.
function normalizeAddress(s) {
  if (!s) return '';
  let out = s.toUpperCase().trim();
  out = out.replace(/[,\s]+(?:UNIT|APT|#)\s*\S+\s*$/u, '');
  out = out.replace(/[^\p{L}\p{N}]+$/u, '');
  out = out.replace(/\s+/g, ' ');
  out = out.split(' ').map(tok => {
    const bare = tok.replace(/[^\p{L}\p{N}]/gu, '');
    return ABBREVIATIONS[bare] || tok;
  }).join(' ');
  return out;
}

export function parseCsv(csv) {
  const lines = csv.split(/\r?\n/).filter(l => l.length > 0);
  if (lines.length < 2) return [];
  const headers = lines[0].split(',');
  return lines.slice(1).map(line => {
    const cells = line.split(',');
    const row = {};
    headers.forEach((h, i) => { row[h.trim()] = (cells[i] ?? '').trim(); });
    return row;
  });
}

export function buildRow(r) {
  const site = (r.site_addr || '').trim();
  const owner = (r.owner1 || '').trim();
  if (!site) return null;
  if (!owner) return null;
  return {
    address_normalized: normalizeAddress(site),
    owner_name: owner,
    parcel_id: (r.prop_id || '').trim() || null,
    fy: r.fy ? Number(r.fy) : null,
    updated_at: Math.floor(Date.now() / 1000),
  };
}

function parseArgs(argv) {
  const args = { csv: 'data/parcels_raw/parcels_full.csv',
                 db: 'community-pulse-staging', remote: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--csv') args.csv = argv[++i];
    else if (a === '--db') args.db = argv[++i];
    else if (a === '--remote') args.remote = true;
  }
  return args;
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function sqlEscape(v) {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'number') return String(v);
  return `'${String(v).replace(/'/g, "''")}'`;
}

function main() {
  const args = parseArgs(process.argv);
  const csvPath = resolve(args.csv);
  const csv = readFileSync(csvPath, 'utf-8');
  const rows = parseCsv(csv).map(buildRow).filter(Boolean);
  console.log(`Read ${rows.length} parcel rows from ${csvPath}`);

  const wranglerArgs = ['wrangler', 'd1', 'execute', args.db];
  if (args.remote) wranglerArgs.push('--remote');
  else wranglerArgs.push('--local');
  wranglerArgs.push('--command');

  // Truncate first.
  execFileSync('npx', [...wranglerArgs, 'DELETE FROM parcel_owners;'],
               { stdio: 'inherit', cwd: 'community-pulse' });

  // Insert in chunks of 500 rows (D1 has a parameter limit; 500*5=2500).
  for (const batch of chunk(rows, 500)) {
    const values = batch.map(r =>
      `(${sqlEscape(r.address_normalized)},${sqlEscape(r.owner_name)},` +
      `${sqlEscape(r.parcel_id)},${sqlEscape(r.fy)},${sqlEscape(r.updated_at)})`
    ).join(',');
    const sql = `INSERT INTO parcel_owners ` +
      `(address_normalized, owner_name, parcel_id, fy, updated_at) ` +
      `VALUES ${values};`;
    execFileSync('npx', [...wranglerArgs, sql],
                 { stdio: 'inherit', cwd: 'community-pulse' });
  }
  console.log(`Inserted ${rows.length} rows into parcel_owners.`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
node --test scripts/test_sync_parcel_owners.mjs
```

Expected: 4 tests pass.

- [ ] **Step 5: Run the sync once against local D1 (manual, depends on CSV being present)**

```bash
# Confirm the gitignored CSV exists locally
ls data/parcels_raw/parcels_full.csv

# Run the sync against the local D1
node scripts/sync_parcel_owners.mjs

# Confirm row count
cd community-pulse && npx wrangler d1 execute community-pulse-staging --local \
  --command "SELECT COUNT(*) AS n FROM parcel_owners;"
```

Expected: 8000+ rows.

(If the CSV is not present locally, skip Step 5 — the unit tests cover the row-building logic. The sync run becomes a deploy-time prereq for whoever ships Phase 1.)

- [ ] **Step 6: Commit**

```bash
git add scripts/sync_parcel_owners.mjs scripts/test_sync_parcel_owners.mjs
git commit -m "scripts: sync_parcel_owners.mjs imports gitignored CSV into D1"
```

---

## Task 6: JWT extension — pre_resident state + auth_source claim

**Files:**
- Modify: `community-pulse/worker/src/jwt.js`
- Create or modify: `community-pulse/tests/jwt.test.js`

The existing `signJWT({ sub, branch }, secret)` returns a 24h token. We extend the payload to also carry `pre_resident` (true when the user is FB-signed-in but has not yet committed an `identity_hash` via `/api/claim/address`) and `auth_source` (`'invite' | 'self_serve'`).

- [ ] **Step 1: Write the failing tests**

Create `community-pulse/tests/jwt.test.js`:

```javascript
import { describe, it, expect } from 'vitest';
import { signJWT, verifyJWT } from '../worker/src/jwt.js';

const SECRET = 'test-secret';

describe('JWT pre_resident + auth_source', () => {
  it('round-trips a pre_resident payload', async () => {
    const token = await signJWT({
      pre_resident: true,
      fb_user_id: '123456',
      auth_source: 'self_serve',
    }, SECRET);
    const payload = await verifyJWT(token, SECRET);
    expect(payload.pre_resident).toBe(true);
    expect(payload.fb_user_id).toBe('123456');
    expect(payload.auth_source).toBe('self_serve');
  });

  it('round-trips an invite-vouched payload (legacy shape)', async () => {
    const token = await signJWT({
      sub: 'abc123',
      branch: 'xyz789',
    }, SECRET);
    const payload = await verifyJWT(token, SECRET);
    expect(payload.sub).toBe('abc123');
    expect(payload.branch).toBe('xyz789');
  });

  it('rejects tampered tokens', async () => {
    const token = await signJWT({ sub: 'abc' }, SECRET);
    const tampered = token.slice(0, -2) + 'XX';
    const payload = await verifyJWT(tampered, SECRET);
    expect(payload).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail (or partially pass)**

```bash
cd community-pulse && npx vitest run tests/jwt.test.js
```

Expected: round-trip with arbitrary fields likely fails depending on what the current `signJWT` does. Read `community-pulse/worker/src/jwt.js` and confirm the payload-handling code spreads the input.

- [ ] **Step 3: Update jwt.js if needed**

Inspect `community-pulse/worker/src/jwt.js`. The existing `signJWT(payload, secret)` already spreads `payload` into the body (`{ ...payload, iat, exp }`), so arbitrary fields like `pre_resident` and `auth_source` already round-trip. If a test fails, the only adjustment needed is to ensure no field is being stripped. Make no change if the tests pass as written.

- [ ] **Step 4: Re-run tests**

```bash
cd community-pulse && npx vitest run tests/jwt.test.js
```

Expected: 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add community-pulse/tests/jwt.test.js
git commit -m "test(jwt): verify pre_resident + auth_source round-trip"
```

---

## Task 7: FB OAuth helpers

**Files:**
- Create: `community-pulse/worker/src/fb.js`
- Create: `community-pulse/tests/fb.test.js`

- [ ] **Step 1: Write the failing tests**

Create `community-pulse/tests/fb.test.js`:

```javascript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildAuthorizeUrl, exchangeCode, fetchMe } from '../worker/src/fb.js';

describe('buildAuthorizeUrl', () => {
  it('includes app id, redirect uri, scope, and state', () => {
    const url = new URL(buildAuthorizeUrl({
      appId: 'APP123',
      redirectUri: 'https://example.com/api/auth/fb/callback',
      state: 'STATE_TOKEN',
    }));
    expect(url.origin).toBe('https://www.facebook.com');
    expect(url.pathname).toBe('/v18.0/dialog/oauth');
    expect(url.searchParams.get('client_id')).toBe('APP123');
    expect(url.searchParams.get('redirect_uri'))
      .toBe('https://example.com/api/auth/fb/callback');
    expect(url.searchParams.get('scope')).toBe('public_profile');
    expect(url.searchParams.get('state')).toBe('STATE_TOKEN');
  });
});

describe('exchangeCode + fetchMe', () => {
  beforeEach(() => { vi.restoreAllMocks(); });

  it('exchanges a code for an access token', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ access_token: 'FB_ACCESS_TOKEN', expires_in: 5183999 }),
    });
    const token = await exchangeCode({
      appId: 'APP123', appSecret: 'SECRET',
      redirectUri: 'https://example.com/cb', code: 'CODE',
    });
    expect(token).toBe('FB_ACCESS_TOKEN');
    expect(fetch).toHaveBeenCalledOnce();
    const calledUrl = new URL(fetch.mock.calls[0][0]);
    expect(calledUrl.searchParams.get('client_id')).toBe('APP123');
    expect(calledUrl.searchParams.get('client_secret')).toBe('SECRET');
    expect(calledUrl.searchParams.get('code')).toBe('CODE');
  });

  it('returns null when exchange fails', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: false, json: async () => ({ error: { message: 'bad code' } }),
    });
    const token = await exchangeCode({
      appId: 'APP123', appSecret: 'SECRET',
      redirectUri: 'https://example.com/cb', code: 'BAD',
    });
    expect(token).toBeNull();
  });

  it('fetches the user profile', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: '123456',
        name: 'John Smith',
        link: 'https://facebook.com/john.smith',
        picture: { data: { url: 'https://cdn.fb/john.jpg' } },
      }),
    });
    const me = await fetchMe('FB_ACCESS_TOKEN');
    expect(me).toEqual({
      fb_user_id: '123456',
      display_name: 'John Smith',
      profile_url: 'https://facebook.com/john.smith',
      picture_url: 'https://cdn.fb/john.jpg',
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd community-pulse && npx vitest run tests/fb.test.js
```

Expected: FAIL — `fb.js` does not exist.

- [ ] **Step 3: Implement fb.js**

Create `community-pulse/worker/src/fb.js`:

```javascript
// Facebook OAuth helpers. Pure functions where possible; fetch is the only
// I/O. All tests stub globalThis.fetch.

const FB_API_VERSION = 'v18.0';

/**
 * Build the URL the browser should be 302'd to so the user can authorize.
 *
 * @param {{appId: string, redirectUri: string, state: string}} opts
 * @returns {string}
 */
export function buildAuthorizeUrl({ appId, redirectUri, state }) {
  const url = new URL(`https://www.facebook.com/${FB_API_VERSION}/dialog/oauth`);
  url.searchParams.set('client_id', appId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('scope', 'public_profile');
  url.searchParams.set('state', state);
  return url.toString();
}

/**
 * Exchange an OAuth code for an access token. Returns null on failure.
 *
 * @param {{appId: string, appSecret: string, redirectUri: string, code: string}} opts
 * @returns {Promise<string|null>}
 */
export async function exchangeCode({ appId, appSecret, redirectUri, code }) {
  const url = new URL(`https://graph.facebook.com/${FB_API_VERSION}/oauth/access_token`);
  url.searchParams.set('client_id', appId);
  url.searchParams.set('client_secret', appSecret);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('code', code);
  const res = await fetch(url.toString());
  if (!res.ok) return null;
  const data = await res.json();
  return data.access_token || null;
}

/**
 * Fetch the user's public_profile data using an access token.
 * Returns a flat shape suitable for storing into residents.
 *
 * @param {string} accessToken
 * @returns {Promise<{fb_user_id: string, display_name: string, profile_url: string, picture_url: string}|null>}
 */
export async function fetchMe(accessToken) {
  const url = new URL(`https://graph.facebook.com/${FB_API_VERSION}/me`);
  url.searchParams.set('fields', 'id,name,link,picture.type(large)');
  url.searchParams.set('access_token', accessToken);
  const res = await fetch(url.toString());
  if (!res.ok) return null;
  const data = await res.json();
  return {
    fb_user_id: data.id,
    display_name: data.name,
    profile_url: data.link || `https://facebook.com/${data.id}`,
    picture_url: data.picture?.data?.url || null,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd community-pulse && npx vitest run tests/fb.test.js
```

Expected: all 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add community-pulse/worker/src/fb.js community-pulse/tests/fb.test.js
git commit -m "fb: add OAuth helpers (authorize URL, exchange, fetchMe)"
```

---

## Task 8: FB OAuth routes — /api/auth/fb/start + /api/auth/fb/callback

**Files:**
- Modify: `community-pulse/worker/src/index.js`
- Modify: `community-pulse/worker/src/fb.js` (export the route handlers)
- Modify: `community-pulse/worker/wrangler.toml`
- Modify: `community-pulse/tests/fb.test.js`

- [ ] **Step 1: Write the failing route handler tests**

Append to `community-pulse/tests/fb.test.js`:

```javascript
import { handleFbStart, handleFbCallback } from '../worker/src/fb.js';

function mockEnv(over = {}) {
  return {
    FB_APP_ID: 'APP123',
    FB_APP_SECRET: 'SECRET',
    JWT_SECRET: 'jwt-secret',
    DB: makeMockDb(),
    ...over,
  };
}
function makeMockDb() {
  const rows = new Map();
  return {
    prepare(sql) {
      return {
        bind(...args) { return { sql, args, rows, async run() { return {}; },
                                  async first() { return null; } }; },
      };
    },
    rows,
  };
}

describe('handleFbStart', () => {
  it('returns 302 with state cookie and FB authorize URL', async () => {
    const req = new Request('https://x.example/api/auth/fb/start');
    const res = await handleFbStart(req, mockEnv());
    expect(res.status).toBe(302);
    const loc = res.headers.get('Location');
    expect(loc.startsWith('https://www.facebook.com/')).toBe(true);
    const cookie = res.headers.get('Set-Cookie');
    expect(cookie).toMatch(/fb_oauth_state=/);
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/Secure/);
  });
});

describe('handleFbCallback', () => {
  beforeEach(() => { vi.restoreAllMocks(); });

  it('rejects callback with missing state cookie', async () => {
    globalThis.fetch = vi.fn();
    const req = new Request('https://x.example/api/auth/fb/callback?code=C&state=S');
    const res = await handleFbCallback(req, mockEnv());
    expect(res.status).toBe(400);
  });

  it('rejects callback with mismatched state', async () => {
    const req = new Request('https://x.example/api/auth/fb/callback?code=C&state=OTHER',
      { headers: { Cookie: 'fb_oauth_state=ORIGINAL' } });
    const res = await handleFbCallback(req, mockEnv());
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd community-pulse && npx vitest run tests/fb.test.js -t handleFbStart
cd community-pulse && npx vitest run tests/fb.test.js -t handleFbCallback
```

Expected: FAIL — handlers not exported.

- [ ] **Step 3: Implement the handlers**

Append to `community-pulse/worker/src/fb.js`:

```javascript
import { signJWT } from './jwt.js';

const STATE_COOKIE = 'fb_oauth_state';
const SESSION_COOKIE = 'verify_jwt';

function randomState() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

function readCookie(req, name) {
  const header = req.headers.get('Cookie') || '';
  const m = header.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return m ? decodeURIComponent(m[1]) : null;
}

function originOf(req) {
  const url = new URL(req.url);
  return `${url.protocol}//${url.host}`;
}

/**
 * GET /api/auth/fb/start
 */
export async function handleFbStart(req, env) {
  const state = randomState();
  const redirectUri = `${originOf(req)}/api/auth/fb/callback`;
  const url = buildAuthorizeUrl({
    appId: env.FB_APP_ID, redirectUri, state,
  });
  return new Response(null, {
    status: 302,
    headers: {
      Location: url,
      'Set-Cookie': `${STATE_COOKIE}=${state}; ` +
                    `Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`,
    },
  });
}

/**
 * GET /api/auth/fb/callback?code=...&state=...
 */
export async function handleFbCallback(req, env) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const cookieState = readCookie(req, STATE_COOKIE);

  if (!code || !state || !cookieState || cookieState !== state) {
    return new Response('Invalid OAuth state', { status: 400 });
  }

  const redirectUri = `${originOf(req)}/api/auth/fb/callback`;
  const accessToken = await exchangeCode({
    appId: env.FB_APP_ID,
    appSecret: env.FB_APP_SECRET,
    redirectUri,
    code,
  });
  if (!accessToken) {
    return new Response('OAuth exchange failed', { status: 502 });
  }

  const me = await fetchMe(accessToken);
  if (!me) {
    return new Response('OAuth profile fetch failed', { status: 502 });
  }

  // Look up an existing resident keyed by fb_user_id (covers return logins).
  // If none, the session is "pre_resident" — pending a claim.
  const existing = await env.DB.prepare(
    'SELECT identity_hash, branch_root FROM residents WHERE fb_user_id = ?'
  ).bind(me.fb_user_id).first();

  let payload;
  if (existing && !existing.revoked_at) {
    payload = {
      sub: existing.identity_hash,
      branch: existing.branch_root,
      auth_source: 'self_serve',
    };
  } else {
    payload = {
      pre_resident: true,
      fb_user_id: me.fb_user_id,
      fb_display_name: me.display_name,
      fb_profile_url: me.profile_url,
      auth_source: 'self_serve',
    };
  }

  const jwt = await signJWT(payload, env.JWT_SECRET);
  const redirect = existing ? '/profile' : '/verify-me#claim';

  return new Response(null, {
    status: 302,
    headers: {
      Location: redirect,
      'Set-Cookie': [
        `${SESSION_COOKIE}=${jwt}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=86400`,
        `${STATE_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`,
      ].join(', '),
    },
  });
}
```

- [ ] **Step 4: Wire the routes into index.js**

Modify `community-pulse/worker/src/index.js`. Find the existing routing section (after the `/api/verify/` block) and add:

```javascript
import { handleFbStart, handleFbCallback } from './fb.js';

// ... inside handleRequest, after the existing /api/verify/ block:

if (url.pathname === '/api/auth/fb/start' && request.method === 'GET') {
  return handleFbStart(request, env);
}
if (url.pathname === '/api/auth/fb/callback' && request.method === 'GET') {
  return handleFbCallback(request, env);
}
```

- [ ] **Step 5: Declare env vars in wrangler.toml**

Modify `community-pulse/worker/wrangler.toml`. Add (under the `[vars]` section for both `staging` and production environments):

```toml
FB_APP_ID = "TODO_SET_IN_DASHBOARD"
```

Then document the secret in the README:

```
The Worker requires two secrets:
  - JWT_SECRET   (set via `wrangler secret put JWT_SECRET`)
  - FB_APP_SECRET (set via `wrangler secret put FB_APP_SECRET`)
```

Replace `TODO_SET_IN_DASHBOARD` with the actual FB app id from the operator's Facebook developer dashboard (currently `1234567890123456` is a placeholder — the operator fills in the real value before deploying).

- [ ] **Step 6: Run tests**

```bash
cd community-pulse && npx vitest run tests/fb.test.js
```

Expected: all tests pass (8 total in fb.test.js).

- [ ] **Step 7: Commit**

```bash
git add community-pulse/worker/src/fb.js \
        community-pulse/worker/src/index.js \
        community-pulse/worker/wrangler.toml \
        community-pulse/tests/fb.test.js
git commit -m "fb: add /api/auth/fb/{start,callback} OAuth routes"
```

---

## Task 9: /api/claim/address endpoint

**Files:**
- Create: `community-pulse/worker/src/claim.js`
- Create: `community-pulse/tests/claim.test.js`
- Modify: `community-pulse/worker/src/index.js`

- [ ] **Step 1: Write the failing tests**

Create `community-pulse/tests/claim.test.js`:

```javascript
import { describe, it, expect, beforeEach } from 'vitest';
import { handleClaimAddress } from '../worker/src/claim.js';
import { signJWT } from '../worker/src/jwt.js';

const JWT_SECRET = 'jwt-secret';

function makeMockDb(initial = {}) {
  const parcels = new Map(Object.entries(initial.parcels || {}));
  const residents = new Map(Object.entries(initial.residents || {}));
  return {
    parcels, residents,
    prepare(sql) {
      return {
        bind: (...args) => ({
          async first() {
            if (sql.startsWith('SELECT owner_name')) {
              const row = parcels.get(args[0]);
              return row || null;
            }
            if (sql.startsWith('SELECT identity_hash FROM residents WHERE fb_user_id')) {
              for (const r of residents.values()) {
                if (r.fb_user_id === args[0]) return r;
              }
              return null;
            }
            return null;
          },
          async run() {
            if (sql.startsWith('INSERT INTO residents')) {
              const [identity_hash, fb_user_id, display_name, profile_url] = args;
              residents.set(identity_hash, {
                identity_hash, fb_user_id, display_name,
                fb_profile_url: profile_url,
                auth_source: 'self_serve', claim_source: 'assessor_match',
              });
            }
            return {};
          },
        }),
      };
    },
  };
}

async function preResidentJwt(over = {}) {
  return signJWT({
    pre_resident: true,
    fb_user_id: '123456',
    fb_display_name: 'John Smith',
    fb_profile_url: 'https://facebook.com/john.smith',
    auth_source: 'self_serve',
    ...over,
  }, JWT_SECRET);
}

async function postClaim(body, env, jwt) {
  const req = new Request('https://x.example/api/claim/address', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${jwt}`,
    },
    body: JSON.stringify(body),
  });
  return handleClaimAddress(req, env);
}

describe('handleClaimAddress', () => {
  let env;
  beforeEach(() => {
    env = { JWT_SECRET, DB: makeMockDb({
      parcels: {
        '12 STATE STREET': { owner_name: 'SMITH JOHN A & SMITH JANE M' },
        '5 BEACON AVENUE': { owner_name: 'JONES MARY' },
        '99 SOLO LANE':    { owner_name: 'SOLO HAN' },
      },
    }) };
  });

  it('match -> 200 with status=match, commits resident row', async () => {
    const jwt = await preResidentJwt();
    const res = await postClaim({ claimed_address: '12 State St' }, env, jwt);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('match');
    expect(env.DB.residents.size).toBe(1);
    const row = Array.from(env.DB.residents.values())[0];
    expect(row.claim_source).toBe('assessor_match');
    expect(row.auth_source).toBe('self_serve');
  });

  it('first_initial_mismatch -> 200 with alternatives', async () => {
    const jwt = await preResidentJwt({ fb_display_name: 'Mike Smith' });
    const res = await postClaim({ claimed_address: '12 State St' }, env, jwt);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('first_initial_mismatch');
    expect(body.alternatives).toEqual(['JOHN', 'JANE']);
    expect(env.DB.residents.size).toBe(0);
  });

  it('name_mismatch -> 200 with vouch_link', async () => {
    const jwt = await preResidentJwt({ fb_display_name: 'Alice Jones' });
    const res = await postClaim({ claimed_address: '12 State St' }, env, jwt);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('name_mismatch');
    expect(body.vouch_link).toBe('/verify-me#vouch');
    expect(env.DB.residents.size).toBe(0);
  });

  it('no_match -> 200 with vouch_link', async () => {
    const jwt = await preResidentJwt();
    const res = await postClaim({ claimed_address: '777 Phantom St' }, env, jwt);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('no_match');
    expect(body.vouch_link).toBe('/verify-me#vouch');
  });

  it('rejects requests without a pre_resident JWT', async () => {
    const fullJwt = await signJWT({ sub: 'existing-hash', branch: null }, JWT_SECRET);
    const res = await postClaim({ claimed_address: '12 State St' }, env, fullJwt);
    expect(res.status).toBe(403);
  });

  it('rejects requests with no JWT', async () => {
    const req = new Request('https://x.example/api/claim/address', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ claimed_address: '12 State St' }),
    });
    const res = await handleClaimAddress(req, env);
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd community-pulse && npx vitest run tests/claim.test.js
```

Expected: FAIL — `claim.js` not found.

- [ ] **Step 3: Implement claim.js**

Create `community-pulse/worker/src/claim.js`:

```javascript
import { verifyJWT, extractJWT, signJWT } from './jwt.js';
import { normalizeAddress, matchOwner } from './match.js';

const HASH_SALT = 'marblehead-verify-salt';

async function identityHash(displayName, normalizedAddress) {
  const enc = new TextEncoder();
  const data = enc.encode(`${displayName.toLowerCase()}:${normalizedAddress}:${HASH_SALT}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map(b => b.toString(16).padStart(2, '0')).join('');
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * POST /api/claim/address
 * Body: { claimed_address: string }
 * Auth: Bearer JWT with pre_resident=true
 */
export async function handleClaimAddress(request, env) {
  const token = extractJWT(request);
  if (!token) return jsonResponse({ error: 'unauthenticated' }, 401);

  const payload = await verifyJWT(token, env.JWT_SECRET);
  if (!payload || !payload.pre_resident) {
    return jsonResponse({ error: 'forbidden — claim already finalized' }, 403);
  }

  const { claimed_address } = await request.json();
  if (!claimed_address) return jsonResponse({ error: 'missing claimed_address' }, 400);

  const normalized = normalizeAddress(claimed_address);
  const parcel = await env.DB.prepare(
    'SELECT owner_name FROM parcel_owners WHERE address_normalized = ?'
  ).bind(normalized).first();

  if (!parcel) {
    return jsonResponse({
      status: 'no_match',
      vouch_link: '/verify-me#vouch',
    });
  }

  const result = matchOwner(payload.fb_display_name, parcel.owner_name);

  if (result.status === 'match') {
    const hash = await identityHash(payload.fb_display_name, normalized);
    const now = Math.floor(Date.now() / 1000);
    await env.DB.prepare(
      'INSERT INTO residents (' +
      '  identity_hash, fb_user_id, display_name, fb_profile_url, ' +
      '  auth_source, claim_source, public_identity, created_at) ' +
      'VALUES (?, ?, ?, ?, \'self_serve\', \'assessor_match\', 0, ?)'
    ).bind(
      hash, payload.fb_user_id, payload.fb_display_name,
      payload.fb_profile_url, now
    ).run();

    // Mint a full-resident JWT so subsequent calls authenticate against
    // /api/profile etc. Front-end stores this in localStorage as verify_jwt
    // mirroring the existing invite-handshake convention.
    const newJwt = await signJWT({
      sub: hash, branch: null, auth_source: 'self_serve',
    }, env.JWT_SECRET);

    return jsonResponse({
      status: 'match',
      session_jwt: newJwt,
    });
  }

  if (result.status === 'first_initial_mismatch') {
    return jsonResponse({
      status: 'first_initial_mismatch',
      alternatives: result.alternatives,
      vouch_link: '/verify-me#vouch',
    });
  }

  return jsonResponse({
    status: 'name_mismatch',
    vouch_link: '/verify-me#vouch',
  });
}
```

- [ ] **Step 4: Wire the route in index.js**

Modify `community-pulse/worker/src/index.js`. Add the import:

```javascript
import { handleClaimAddress } from './claim.js';
```

And inside `handleRequest`, add (after the `/api/auth/fb/*` block):

```javascript
if (url.pathname === '/api/claim/address' && request.method === 'POST') {
  return handleClaimAddress(request, env);
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd community-pulse && npx vitest run tests/claim.test.js
```

Expected: 6 tests pass.

- [ ] **Step 6: Commit**

```bash
git add community-pulse/worker/src/claim.js \
        community-pulse/worker/src/index.js \
        community-pulse/tests/claim.test.js
git commit -m "claim: /api/claim/address handler with assessor-match auto-verify"
```

---

## Task 10: /api/profile GET

**Files:**
- Create: `community-pulse/worker/src/profile.js`
- Create: `community-pulse/tests/profile.test.js`
- Modify: `community-pulse/worker/src/index.js`

- [ ] **Step 1: Write the failing tests**

Create `community-pulse/tests/profile.test.js`:

```javascript
import { describe, it, expect, beforeEach } from 'vitest';
import { handleProfileGet, handleProfilePost } from '../worker/src/profile.js';
import { signJWT } from '../worker/src/jwt.js';

const JWT_SECRET = 'jwt-secret';

function makeDb(rows = {}) {
  const residents = new Map(Object.entries(rows));
  return {
    residents,
    prepare(sql) {
      return {
        bind: (...args) => ({
          async first() {
            if (sql.startsWith('SELECT')) {
              return residents.get(args[args.length - 1]) || null;
            }
            return null;
          },
          async run() {
            if (sql.startsWith('UPDATE residents')) {
              // args are (display_name, public_identity, identity_hash)
              const hash = args[args.length - 1];
              const r = residents.get(hash);
              if (r) {
                if (sql.includes('display_name')) r.display_name = args[0];
                if (sql.includes('public_identity')) {
                  r.public_identity = args[sql.includes('display_name') ? 1 : 0];
                }
              }
            }
            return {};
          },
        }),
      };
    },
  };
}

async function bearer(hash) {
  return signJWT({ sub: hash, branch: null, auth_source: 'self_serve' }, JWT_SECRET);
}

describe('handleProfileGet', () => {
  it('returns the profile for the authenticated resident', async () => {
    const env = { JWT_SECRET, DB: makeDb({
      'abc123': {
        identity_hash: 'abc123',
        display_name: 'Andrew Baber',
        public_identity: 0,
        claim_source: 'assessor_match',
        auth_source: 'self_serve',
        fb_user_id: '999',
        fb_profile_url: 'https://facebook.com/andrew',
        branch_root: null,
      },
    }) };
    const jwt = await bearer('abc123');
    const req = new Request('https://x/api/profile', {
      headers: { Authorization: `Bearer ${jwt}` },
    });
    const res = await handleProfileGet(req, env);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.display_name).toBe('Andrew Baber');
    expect(body.public_identity).toBe(0);
    expect(body.claim_source).toBe('assessor_match');
    expect(body.auth_source).toBe('self_serve');
    expect(body.has_passkey).toBe(false); // no passkey rows in this mock
  });

  it('returns 401 with no JWT', async () => {
    const env = { JWT_SECRET, DB: makeDb() };
    const req = new Request('https://x/api/profile');
    const res = await handleProfileGet(req, env);
    expect(res.status).toBe(401);
  });

  it('returns 404 for a JWT pointing at a missing resident', async () => {
    const env = { JWT_SECRET, DB: makeDb() };
    const jwt = await bearer('ghost');
    const req = new Request('https://x/api/profile', {
      headers: { Authorization: `Bearer ${jwt}` },
    });
    const res = await handleProfileGet(req, env);
    expect(res.status).toBe(404);
  });
});

describe('handleProfilePost', () => {
  it('updates display_name when provided', async () => {
    const env = { JWT_SECRET, DB: makeDb({
      'abc123': {
        identity_hash: 'abc123',
        display_name: 'Old Name',
        public_identity: 0,
      },
    }) };
    const jwt = await bearer('abc123');
    const req = new Request('https://x/api/profile', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${jwt}`,
      },
      body: JSON.stringify({ display_name: 'New Name' }),
    });
    const res = await handleProfilePost(req, env);
    expect(res.status).toBe(200);
    expect(env.DB.residents.get('abc123').display_name).toBe('New Name');
  });

  it('updates public_identity when provided', async () => {
    const env = { JWT_SECRET, DB: makeDb({
      'abc123': { identity_hash: 'abc123', display_name: 'X', public_identity: 0 },
    }) };
    const jwt = await bearer('abc123');
    const req = new Request('https://x/api/profile', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${jwt}`,
      },
      body: JSON.stringify({ public_identity: 1 }),
    });
    const res = await handleProfilePost(req, env);
    expect(res.status).toBe(200);
    expect(env.DB.residents.get('abc123').public_identity).toBe(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd community-pulse && npx vitest run tests/profile.test.js
```

Expected: FAIL — `profile.js` not found.

- [ ] **Step 3: Implement profile.js**

Create `community-pulse/worker/src/profile.js`:

```javascript
import { verifyJWT, extractJWT } from './jwt.js';

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function authn(request, env) {
  const token = extractJWT(request);
  if (!token) return { status: 401, payload: null };
  const payload = await verifyJWT(token, env.JWT_SECRET);
  if (!payload || !payload.sub) return { status: 401, payload: null };
  return { status: 200, payload };
}

/**
 * GET /api/profile
 * Returns the authenticated resident's profile shape.
 */
export async function handleProfileGet(request, env) {
  const { status, payload } = await authn(request, env);
  if (status !== 200) return jsonResponse({ error: 'unauthenticated' }, status);

  const r = await env.DB.prepare(
    'SELECT identity_hash, display_name, public_identity, claim_source, ' +
    '       auth_source, fb_user_id, fb_profile_url, branch_root ' +
    'FROM residents WHERE identity_hash = ?'
  ).bind(payload.sub).first();

  if (!r) return jsonResponse({ error: 'not found' }, 404);

  const pkRow = await env.DB.prepare(
    'SELECT 1 FROM passkey_credentials WHERE identity_hash = ? LIMIT 1'
  ).bind(payload.sub).first();

  return jsonResponse({
    identity_hash: r.identity_hash,
    display_name: r.display_name,
    public_identity: r.public_identity,
    claim_source: r.claim_source,
    auth_source: r.auth_source,
    has_facebook: !!r.fb_user_id,
    fb_profile_url: r.fb_profile_url,
    has_passkey: !!pkRow,
    branch_root: r.branch_root,
  });
}

/**
 * POST /api/profile
 * Body: { display_name?: string, public_identity?: 0|1 }
 */
export async function handleProfilePost(request, env) {
  const { status, payload } = await authn(request, env);
  if (status !== 200) return jsonResponse({ error: 'unauthenticated' }, status);

  const body = await request.json();
  const fields = [];
  const args = [];

  if (typeof body.display_name === 'string') {
    if (body.display_name.length > 80) {
      return jsonResponse({ error: 'display_name too long' }, 400);
    }
    fields.push('display_name = ?');
    args.push(body.display_name);
  }

  if (body.public_identity === 0 || body.public_identity === 1) {
    fields.push('public_identity = ?');
    args.push(body.public_identity);
  }

  if (fields.length === 0) {
    return jsonResponse({ error: 'nothing to update' }, 400);
  }

  args.push(payload.sub);
  await env.DB.prepare(
    `UPDATE residents SET ${fields.join(', ')} WHERE identity_hash = ?`
  ).bind(...args).run();

  return jsonResponse({ ok: true });
}
```

- [ ] **Step 4: Wire the routes in index.js**

Modify `community-pulse/worker/src/index.js`. Add import:

```javascript
import { handleProfileGet, handleProfilePost } from './profile.js';
```

And inside `handleRequest`, after the `/api/claim/address` block:

```javascript
if (url.pathname === '/api/profile') {
  if (request.method === 'GET') return handleProfileGet(request, env);
  if (request.method === 'POST') return handleProfilePost(request, env);
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd community-pulse && npx vitest run tests/profile.test.js
```

Expected: 5 tests pass.

- [ ] **Step 6: Commit**

```bash
git add community-pulse/worker/src/profile.js \
        community-pulse/worker/src/index.js \
        community-pulse/tests/profile.test.js
git commit -m "profile: /api/profile GET + POST (display_name, public_identity)"
```

---

## Task 11: DELETE /api/claim (release)

**Files:**
- Modify: `community-pulse/worker/src/profile.js`
- Modify: `community-pulse/tests/profile.test.js`
- Modify: `community-pulse/worker/src/index.js`

- [ ] **Step 1: Write the failing test**

Append to `community-pulse/tests/profile.test.js`:

```javascript
import { handleClaimRelease } from '../worker/src/profile.js';

describe('handleClaimRelease', () => {
  it('soft-deletes the resident and returns 200', async () => {
    const env = { JWT_SECRET, DB: makeDb({
      'abc123': { identity_hash: 'abc123', revoked_at: null },
    }) };
    const jwt = await bearer('abc123');
    const req = new Request('https://x/api/claim', {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${jwt}` },
    });
    const res = await handleClaimRelease(req, env);
    expect(res.status).toBe(200);
    expect(env.DB.residents.get('abc123').revoked_at).toBeTypeOf('number');
  });

  it('returns 401 without a JWT', async () => {
    const env = { JWT_SECRET, DB: makeDb() };
    const req = new Request('https://x/api/claim', { method: 'DELETE' });
    const res = await handleClaimRelease(req, env);
    expect(res.status).toBe(401);
  });
});
```

Extend the `makeDb` helper in `profile.test.js` to handle the soft-delete UPDATE:

```javascript
// Inside makeDb's prepare(sql).bind(...args).run():
if (sql.startsWith('UPDATE residents SET revoked_at')) {
  const hash = args[args.length - 1];
  const r = residents.get(hash);
  if (r) r.revoked_at = args[0];
}
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd community-pulse && npx vitest run tests/profile.test.js -t handleClaimRelease
```

Expected: FAIL — `handleClaimRelease` not exported.

- [ ] **Step 3: Implement handleClaimRelease**

Append to `community-pulse/worker/src/profile.js`:

```javascript
/**
 * DELETE /api/claim
 * Soft-deletes the authenticated resident (sets revoked_at). Engagement
 * rows are left in place; they become unattributable.
 */
export async function handleClaimRelease(request, env) {
  const { status, payload } = await authn(request, env);
  if (status !== 200) return jsonResponse({ error: 'unauthenticated' }, status);

  const now = Math.floor(Date.now() / 1000);
  await env.DB.prepare(
    'UPDATE residents SET revoked_at = ? WHERE identity_hash = ?'
  ).bind(now, payload.sub).run();
  return jsonResponse({ ok: true });
}
```

Wire the route in `community-pulse/worker/src/index.js`. Add to the imports:

```javascript
import { handleProfileGet, handleProfilePost, handleClaimRelease } from './profile.js';
```

And inside `handleRequest`:

```javascript
if (url.pathname === '/api/claim' && request.method === 'DELETE') {
  return handleClaimRelease(request, env);
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd community-pulse && npx vitest run tests/profile.test.js
```

Expected: 7 tests pass (5 prior + 2 new).

- [ ] **Step 5: Commit**

```bash
git add community-pulse/worker/src/profile.js \
        community-pulse/worker/src/index.js \
        community-pulse/tests/profile.test.js
git commit -m "profile: DELETE /api/claim soft-deletes the resident"
```

---

## Task 12: Privacy + Terms pages (required for FB app review)

**Files:**
- Modify: `privacy.html`
- Create: `terms.html`

- [ ] **Step 1: Read the existing privacy.html**

Read `privacy.html`. It is a Jekyll page using the standard `layout: page` (defaulted in `_config.yml`). The existing copy is generic — there is no Facebook section.

- [ ] **Step 2: Append the Facebook OAuth disclosure**

Edit `privacy.html`. Find the closing `</div>` of the main content `.page` block and insert this section just before it (use the Edit tool to insert after the last existing `<h2>` section):

```html
<h2>Facebook sign-in</h2>
<p>
  Marbleheaddata.org offers Facebook as an optional way to sign in and
  claim your address as a verified resident. When you sign in with
  Facebook we receive:
</p>
<ul>
  <li>Your Facebook user ID — a stable identifier we use to recognize you
    on return visits.</li>
  <li>Your Facebook display name — used to match against the assessor
    record for your claimed address, and as your editable default
    display name on the site.</li>
  <li>Your Facebook profile URL — stored so a human verifier can DM you
    in the fallback case where your name does not match the assessor
    record.</li>
  <li>Your profile picture URL.</li>
</ul>
<p>
  We do not receive your friends list, posts, photos, or email at this
  time. Your Facebook access token is used only to fetch the data above
  and is then discarded — we never store it. You can sign out at any
  time from your profile page, which clears your session and stops the
  site from showing you as signed in.
</p>
<p>
  Your claimed address is visible only to you on your own profile page.
  It is never shown to other users, never published, and never returned
  by any public endpoint.
</p>
```

- [ ] **Step 3: Create terms.html**

Create `terms.html`:

```html
---
layout: page
title: Terms of Use
body_class: doc-page
---

<div class="page">
<h1>Terms of Use</h1>

<p><em>Last updated: 2026-06-14</em></p>

<h2>What this site is</h2>
<p>
  Marbleheaddata.org is a volunteer-run civic data site about the Town of
  Marblehead, Massachusetts. It compiles primary-source documents,
  budgets, and meeting records, and lets verified residents back ideas
  and weigh in on questions about the town's finances.
</p>

<h2>Acceptable use</h2>
<p>By using this site you agree:</p>
<ul>
  <li>You will not impersonate another Marblehead resident.</li>
  <li>You will not abuse the verification system to inflate the apparent
    count of voices on any side of a debate.</li>
  <li>You will not submit content that is illegal, threatening, or
    intended to harass any individual.</li>
</ul>

<h2>Verification</h2>
<p>
  Verified-resident status confirms you have a Marblehead address. It
  is not an endorsement of your views, and it does not commit the site
  to anything you say. The site never publishes individual votes or
  claims; only aggregate counts and the names of residents who explicitly
  opt in per action.
</p>

<h2>Content and accuracy</h2>
<p>
  We try hard to source every number to a primary document, but the site
  is run by humans and mistakes happen. If you spot one, please open an
  issue at our GitHub repository.
</p>

<h2>No warranty</h2>
<p>
  The site is provided as-is. We make no warranty about its accuracy,
  availability, or fitness for any particular purpose.
</p>

<h2>Contact</h2>
<p>
  Send questions or report issues at
  <a href="https://github.com/agbaber/marblehead/issues">our GitHub issues page</a>.
</p>

</div>
```

- [ ] **Step 4: Sanity-build Jekyll locally**

```bash
bundle exec jekyll build
```

Expected: build succeeds, `_site/privacy.html` and `_site/terms.html` both exist.

- [ ] **Step 5: Commit**

```bash
git add privacy.html terms.html
git commit -m "privacy/terms: add FB OAuth disclosure + new terms page for app review"
```

---

## Task 13: /verify-me.html scaffold

**Files:**
- Create: `verify-me.html`

- [ ] **Step 1: Create the page HTML**

Create `verify-me.html`:

```html
---
layout: page
title: Verify yourself as a Marblehead resident
permalink: /verify-me.html
---

<div class="page">
<h1>Verify yourself</h1>

<p class="lead">
  Marbleheaddata.org lets verified residents back ideas and weigh in on
  the town's open questions. You have two ways to verify:
</p>

<section class="verify-doors">
  <div class="verify-door verify-door--primary">
    <h2>Sign in with Facebook + claim your address</h2>
    <p>
      We'll check your name against the FY2025 Marblehead assessor record
      for the address you claim. If your name matches the named owner,
      you're verified on the spot. If not — renter, recent buyer, spouse
      not on the deed — we'll route you to a neighbor who can confirm.
    </p>
    <a href="/api/auth/fb/start" class="btn btn--primary">
      Continue with Facebook
    </a>
    <p class="verify-door__note">
      <a href="/privacy.html#facebook-sign-in">What we receive from Facebook</a>
    </p>
  </div>

  <div class="verify-door verify-door--secondary">
    <h2>Have an invite from a neighbor?</h2>
    <p>
      Some Marbleheaders are already verified and can vouch for you with a
      one-time invite link. If a neighbor sent you one, use it here.
    </p>
    <a href="/verify.html" class="btn btn--secondary">
      Open an invite link
    </a>
  </div>
</section>

<!-- Claim form is hidden by default. claim.js reveals it when
     the URL hash is #claim (set by the FB callback redirect). -->
<section id="claim-form-section" hidden>
  <h2>Claim your address</h2>
  <p>
    Signed in as <strong id="claim-fb-name"></strong>. Pick the Marblehead
    address you live at:
  </p>
  <form id="claim-form">
    <label>
      Street
      <input list="streets" id="claim-street" name="street" required autocomplete="off">
      <datalist id="streets"></datalist>
    </label>
    <label>
      House number
      <input id="claim-number" name="number" required autocomplete="off">
    </label>
    <button type="submit" class="btn btn--primary">Claim this address</button>
  </form>
  <div id="claim-result"></div>
</section>

<script type="module" src="/assets/community-pulse/claim.js"></script>
</div>

<style>
  .verify-doors { display: grid; gap: 1.5rem; margin: 2rem 0; }
  @media (min-width: 720px) {
    .verify-doors { grid-template-columns: 1fr 1fr; }
  }
  .verify-door { padding: 1.5rem; border: 1px solid var(--rule);
                  border-radius: 6px; }
  .verify-door--primary { border-color: var(--accent); }
  .verify-door__note { font-size: 0.875rem; color: var(--muted);
                       margin-top: 0.75rem; }
  #claim-result { margin-top: 1.5rem; }
  #claim-result .ok { color: var(--success); }
  #claim-result .err { color: var(--danger); }
</style>
```

- [ ] **Step 2: Build and inspect**

```bash
bundle exec jekyll build
ls _site/verify-me.html
```

Expected: file exists.

- [ ] **Step 3: Commit**

```bash
git add verify-me.html
git commit -m "verify-me: scaffold self-serve front door page"
```

---

## Task 14: assets/community-pulse/claim.js controller

**Files:**
- Create: `assets/community-pulse/claim.js`

- [ ] **Step 1: Implement the controller**

Create `assets/community-pulse/claim.js`:

```javascript
// /verify-me.html controller.
// Drives FB OAuth bootstrap, the claim form, and result branching.

const VERIFY_API = (location.hostname === 'localhost')
  ? 'http://localhost:8787'
  : 'https://marblehead-community-pulse.agbaber.workers.dev';

async function loadStreets() {
  try {
    const res = await fetch(`${VERIFY_API}/api/streets`);
    if (!res.ok) return [];
    return res.json();
  } catch (e) {
    return [];
  }
}

async function decodeJwtPayload(jwt) {
  try {
    const b64 = jwt.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
    return JSON.parse(atob(padded));
  } catch (e) { return null; }
}

function readSessionJwt() {
  // FB callback sets verify_jwt as an HttpOnly cookie. The callback also
  // returns a copy in the redirect-target body? No — for module simplicity
  // we mirror the JWT into localStorage on a successful claim, matching the
  // existing invite-handshake convention.
  return localStorage.getItem('verify_jwt');
}

function setSessionJwt(jwt) {
  localStorage.setItem('verify_jwt', jwt);
}

async function fetchSelf() {
  const jwt = readSessionJwt();
  if (!jwt) return null;
  const res = await fetch(`${VERIFY_API}/api/profile`, {
    headers: { Authorization: `Bearer ${jwt}` },
  });
  if (!res.ok) return null;
  return res.json();
}

function show(el) { el.hidden = false; }
function hide(el) { el.hidden = true; }

async function init() {
  const params = new URL(location.href);
  const isClaimStep = params.hash === '#claim';

  // The FB callback sets verify_jwt as HttpOnly so JS cannot read it.
  // We re-fetch /api/profile to check whether the session is "pre-resident"
  // (the cookie's JWT carries pre_resident=true). If the profile endpoint
  // returns 401, we are not signed in. If it returns 200, we are already
  // a full resident — redirect to /profile.
  const profile = await fetchSelf();

  if (profile && profile.identity_hash) {
    location.href = '/profile';
    return;
  }

  if (!isClaimStep) {
    // Not signed in and not in the post-callback claim step — show the
    // two-door landing. The form section stays hidden.
    return;
  }

  // The FB callback redirected here with #claim. Show the form.
  const section = document.getElementById('claim-form-section');
  show(section);

  // Streets typeahead.
  const datalist = document.getElementById('streets');
  const streets = await loadStreets();
  for (const s of streets) {
    const opt = document.createElement('option');
    opt.value = s;
    datalist.appendChild(opt);
  }

  // The FB display name is in the JWT cookie which JS can't read directly;
  // the easiest place to surface it is via a second tiny endpoint that
  // returns the pre-resident metadata. For Phase 1 we read it from
  // /api/profile when pre_resident=true. handleProfileGet returns 404 on
  // pre-resident sessions, so add a fallback path:
  const preRes = await fetch(`${VERIFY_API}/api/profile?pre_resident=1`, {
    credentials: 'include',
  });
  if (preRes.ok) {
    const meta = await preRes.json();
    document.getElementById('claim-fb-name').textContent = meta.fb_display_name || '';
  }

  document.getElementById('claim-form').addEventListener('submit', onSubmit);
}

async function onSubmit(e) {
  e.preventDefault();
  const street = document.getElementById('claim-street').value.trim();
  const number = document.getElementById('claim-number').value.trim();
  const claimed_address = `${number} ${street}`;
  const result = document.getElementById('claim-result');
  result.textContent = 'Checking…';

  const res = await fetch(`${VERIFY_API}/api/claim/address`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ claimed_address }),
  });

  if (!res.ok) {
    result.innerHTML = `<p class="err">Couldn't claim that address (HTTP ${res.status}). Try again.</p>`;
    return;
  }

  const body = await res.json();
  switch (body.status) {
    case 'match':
      if (body.session_jwt) setSessionJwt(body.session_jwt);
      result.innerHTML = `<p class="ok">✓ You're verified as a Marblehead resident.<br>
        <a href="/profile" class="btn btn--primary">Go to your profile</a></p>`;
      break;
    case 'first_initial_mismatch':
      result.innerHTML = `
        <p>${escape(claimed_address)} is on record for a household whose named owners
        are <strong>${body.alternatives.join(', ')}</strong>. Are you a member of this
        household?</p>
        <p>
          <a class="btn btn--primary" href="${body.vouch_link}">
            Yes — request a vouch
          </a>
        </p>`;
      break;
    case 'name_mismatch':
      result.innerHTML = `
        <p>${escape(claimed_address)} is in our records but listed under a different
        owner. If you rent, recently bought, or your name isn't on the deed:</p>
        <p><a class="btn btn--primary" href="${body.vouch_link}">Request a vouch</a></p>`;
      break;
    case 'no_match':
      result.innerHTML = `
        <p>We don't have ${escape(claimed_address)} in our records. Recheck the
        spelling, or:</p>
        <p><a class="btn btn--primary" href="${body.vouch_link}">Request a vouch</a></p>`;
      break;
    default:
      result.innerHTML = `<p class="err">Unexpected response.</p>`;
  }
}

function escape(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'
  }[c]));
}

init();
```

- [ ] **Step 2: Note the pre_resident endpoint is needed**

The controller calls `/api/profile?pre_resident=1` to get the FB display name during the claim step. Since this endpoint shape doesn't exist yet, document a follow-up task right now — but to keep the file compilable in Phase 1, defer to a small `/api/me/pre` endpoint added in Task 15.

- [ ] **Step 3: Commit**

```bash
git add assets/community-pulse/claim.js
git commit -m "claim.js: verify-me controller (FB bootstrap + claim form + branching)"
```

---

## Task 15: /api/me/pre endpoint — surface FB display name for the claim form

**Files:**
- Modify: `community-pulse/worker/src/profile.js`
- Modify: `community-pulse/tests/profile.test.js`
- Modify: `community-pulse/worker/src/index.js`
- Modify: `assets/community-pulse/claim.js`

- [ ] **Step 1: Write the failing test**

Append to `community-pulse/tests/profile.test.js`:

```javascript
import { handleMePre } from '../worker/src/profile.js';

describe('handleMePre', () => {
  it('returns the pre_resident metadata from the JWT', async () => {
    const jwt = await signJWT({
      pre_resident: true,
      fb_user_id: '999',
      fb_display_name: 'John Smith',
      fb_profile_url: 'https://facebook.com/john',
    }, JWT_SECRET);
    const env = { JWT_SECRET, DB: makeDb() };
    const req = new Request('https://x/api/me/pre', {
      headers: { Authorization: `Bearer ${jwt}` },
    });
    const res = await handleMePre(req, env);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.fb_display_name).toBe('John Smith');
    expect(body.fb_user_id).toBe('999');
  });

  it('returns 403 when the session is already a full resident', async () => {
    const jwt = await bearer('abc123');
    const env = { JWT_SECRET, DB: makeDb() };
    const req = new Request('https://x/api/me/pre', {
      headers: { Authorization: `Bearer ${jwt}` },
    });
    const res = await handleMePre(req, env);
    expect(res.status).toBe(403);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd community-pulse && npx vitest run tests/profile.test.js -t handleMePre
```

Expected: FAIL — `handleMePre` not exported.

- [ ] **Step 3: Implement handleMePre**

Append to `community-pulse/worker/src/profile.js`:

```javascript
/**
 * GET /api/me/pre
 * Used by the verify-me claim form to display the FB name without
 * exposing the JWT to JS (the cookie is HttpOnly).
 */
export async function handleMePre(request, env) {
  const token = extractJWT(request);
  if (!token) return jsonResponse({ error: 'unauthenticated' }, 401);
  const payload = await verifyJWT(token, env.JWT_SECRET);
  if (!payload || !payload.pre_resident) {
    return jsonResponse({ error: 'forbidden — not a pre-resident session' }, 403);
  }
  return jsonResponse({
    fb_user_id: payload.fb_user_id,
    fb_display_name: payload.fb_display_name,
    fb_profile_url: payload.fb_profile_url,
  });
}
```

Add the import in `profile.js`:

```javascript
import { verifyJWT, extractJWT } from './jwt.js';
```

(may already be present).

- [ ] **Step 4: Wire the route in index.js**

Modify `community-pulse/worker/src/index.js`:

```javascript
import { handleProfileGet, handleProfilePost, handleClaimRelease, handleMePre } from './profile.js';

// Inside handleRequest, alongside the other profile routes:
if (url.pathname === '/api/me/pre' && request.method === 'GET') {
  return handleMePre(request, env);
}
```

- [ ] **Step 5: Update claim.js to call /api/me/pre**

Modify `assets/community-pulse/claim.js`. Replace the block that calls `/api/profile?pre_resident=1` with:

```javascript
const preRes = await fetch(`${VERIFY_API}/api/me/pre`, { credentials: 'include' });
if (preRes.ok) {
  const meta = await preRes.json();
  document.getElementById('claim-fb-name').textContent = meta.fb_display_name || '';
}
```

(The earlier code already had this shape; only the path changes.)

- [ ] **Step 6: Run tests**

```bash
cd community-pulse && npx vitest run tests/profile.test.js
```

Expected: 9 tests pass.

- [ ] **Step 7: Commit**

```bash
git add community-pulse/worker/src/profile.js \
        community-pulse/worker/src/index.js \
        community-pulse/tests/profile.test.js \
        assets/community-pulse/claim.js
git commit -m "profile: /api/me/pre surfaces FB display name for claim form"
```

---

## Task 16: /profile.html page + controller

**Files:**
- Create: `profile.html`
- Create: `assets/community-pulse/profile.js`

- [ ] **Step 1: Create profile.html**

Create `profile.html`:

```html
---
layout: page
title: Your profile
permalink: /profile.html
---

<div class="page">
<h1>Profile</h1>

<div id="profile-root">
  <p>Loading…</p>
</div>

<script type="module" src="/assets/community-pulse/profile.js"></script>
</div>

<style>
  #profile-root .verified-badge {
    display: inline-block; padding: 0.25rem 0.75rem;
    background: var(--success-bg, #d1fae5); color: var(--success, #065f46);
    border-radius: 4px; font-weight: 600;
  }
  #profile-root .danger-zone { margin-top: 2rem; padding-top: 1rem;
                               border-top: 1px solid var(--rule); }
  #profile-root .danger-zone button {
    background: transparent; color: var(--danger, #991b1b);
    border: 1px solid var(--danger, #991b1b); padding: 0.5rem 1rem;
    border-radius: 4px; cursor: pointer;
  }
</style>
```

- [ ] **Step 2: Create profile.js**

Create `assets/community-pulse/profile.js`:

```javascript
const VERIFY_API = (location.hostname === 'localhost')
  ? 'http://localhost:8787'
  : 'https://marblehead-community-pulse.agbaber.workers.dev';

function readJwt() { return localStorage.getItem('verify_jwt'); }

async function fetchProfile() {
  const jwt = readJwt();
  if (!jwt) return null;
  const res = await fetch(`${VERIFY_API}/api/profile`, {
    headers: { Authorization: `Bearer ${jwt}` },
  });
  if (!res.ok) return null;
  return res.json();
}

async function postProfile(body) {
  const jwt = readJwt();
  return fetch(`${VERIFY_API}/api/profile`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${jwt}`,
    },
    body: JSON.stringify(body),
  });
}

async function releaseClaim() {
  const jwt = readJwt();
  await fetch(`${VERIFY_API}/api/claim`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${jwt}` },
  });
  localStorage.removeItem('verify_jwt');
  location.href = '/';
}

function describeClaimSource(profile) {
  if (profile.claim_source === 'assessor_match') return 'matched to assessor record';
  return 'vouched by a neighbor';
}

function render(profile) {
  const root = document.getElementById('profile-root');
  if (!profile) {
    root.innerHTML = `
      <p>You're not signed in.</p>
      <p><a href="/verify-me.html" class="btn btn--primary">Sign in</a></p>`;
    return;
  }

  const name = profile.display_name || 'verified resident';
  const publicNow = profile.public_identity === 1;
  const claimDesc = describeClaimSource(profile);
  const fbBadge = profile.has_facebook
    ? `<li>Facebook <a href="${profile.fb_profile_url}" rel="noopener">view profile</a></li>` : '';
  const pkBadge = profile.has_passkey
    ? '<li>Passkey installed</li>'
    : '<li>No passkey yet — <a href="/verify.html#add-passkey">add one</a> for faster sign-in</li>';

  root.innerHTML = `
    <p><span class="verified-badge">✓ Verified resident</span></p>
    <p><strong>${escape(name)}</strong></p>
    <p>Verified by: ${claimDesc}</p>

    <h2>Identity</h2>
    <label>
      Display name
      <input id="display-name" value="${escape(profile.display_name || '')}">
    </label>
    <button id="save-name" class="btn">Save name</button>

    <p style="margin-top:1rem">
      <label>
        <input type="checkbox" id="public-toggle" ${publicNow ? 'checked' : ''}>
        Show my name publicly on the site
      </label><br>
      <small>When off, you appear as "verified resident" everywhere.
      You can override this per back/rep action when you click it.</small>
    </p>

    <h3>Sign-in methods</h3>
    <ul>
      ${fbBadge}
      ${pkBadge}
    </ul>

    <div class="danger-zone">
      <h3>Release this claim</h3>
      <p>Sign out and disconnect this verified identity from your sessions.</p>
      <button id="release">Release and sign out</button>
    </div>`;

  document.getElementById('save-name').addEventListener('click', async () => {
    const v = document.getElementById('display-name').value.trim();
    const r = await postProfile({ display_name: v });
    if (r.ok) alert('Saved');
  });

  document.getElementById('public-toggle').addEventListener('change', async (e) => {
    await postProfile({ public_identity: e.target.checked ? 1 : 0 });
  });

  document.getElementById('release').addEventListener('click', async () => {
    if (confirm('Release this claim and sign out?')) await releaseClaim();
  });
}

function escape(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'
  }[c]));
}

fetchProfile().then(render);
```

- [ ] **Step 3: Build Jekyll and confirm output**

```bash
bundle exec jekyll build
ls _site/profile.html _site/assets/community-pulse/profile.js
```

Expected: both files exist.

- [ ] **Step 4: Commit**

```bash
git add profile.html assets/community-pulse/profile.js
git commit -m "profile.html: identity controls (name, public toggle, release)"
```

---

## Task 17: Smoke tests for new pages

**Files:**
- Modify: `tests/smoke-test.mjs`

- [ ] **Step 1: Read the existing smoke-test.mjs to learn the pattern**

```bash
head -60 tests/smoke-test.mjs
```

Existing tests use Playwright and assert HTTP 200 + selected element existence. Mirror the same pattern.

- [ ] **Step 2: Add three new smoke assertions**

Append to `tests/smoke-test.mjs` (inside the existing test list):

```javascript
{ url: '/verify-me.html',
  description: 'Verify-me front-door page loads',
  assertions: [
    async (page) => {
      await expectVisible(page, 'h1', 'Verify yourself');
      await expectVisible(page, '.btn--primary', 'Continue with Facebook');
    },
  ],
},
{ url: '/profile.html',
  description: 'Profile page loads and shows the not-signed-in state',
  assertions: [
    async (page) => {
      await expectVisible(page, '#profile-root', '');
      // While signed out, the controller renders a "sign in" prompt.
      // Wait briefly for the controller to run.
      await page.waitForSelector('#profile-root a[href="/verify-me.html"]',
        { timeout: 3000 });
    },
  ],
},
{ url: '/terms.html',
  description: 'Terms page loads',
  assertions: [
    async (page) => {
      await expectVisible(page, 'h1', 'Terms of Use');
    },
  ],
},
```

Conform to the exact helper names in the existing file — if the existing file uses `assert(await page.locator(...).isVisible())` instead of `expectVisible`, mirror that style.

- [ ] **Step 3: Run the local test suite**

```bash
npm run test:local
```

Expected: existing 52 tests pass + 3 new tests pass = 55 pass / 0 fail.

- [ ] **Step 4: Commit**

```bash
git add tests/smoke-test.mjs
git commit -m "smoke: cover verify-me, profile, and terms pages"
```

---

## Task 18: Documentation

**Files:**
- Modify: `community-pulse/README.md`
- Modify: `README.md`

- [ ] **Step 1: Add an FB OAuth + parcel sync section to community-pulse/README.md**

Append to `community-pulse/README.md`:

```markdown
## Self-Serve Verification setup

### Facebook OAuth

1. Register a Facebook developer app called "Marblehead Data" at
   <https://developers.facebook.com/apps/>.
2. Under the app's Login product, add the redirect URI
   `https://marblehead-community-pulse.agbaber.workers.dev/api/auth/fb/callback`
   (and the staging equivalent if different).
3. Set the Privacy Policy URL to `https://marbleheaddata.org/privacy.html`
   and the Terms of Service URL to `https://marbleheaddata.org/terms.html`.
4. Copy the App ID into `wrangler.toml` under `[vars] FB_APP_ID`.
5. Set the App Secret as a Worker secret:
   `wrangler secret put FB_APP_SECRET`.

### Parcel-owners sync

The worker needs the gitignored `data/parcels_raw/parcels_full.csv` from
the marblehead repo to be present locally before running:

```
node scripts/sync_parcel_owners.mjs --db community-pulse-staging --remote
```

This truncates and reinserts `parcel_owners` in the named D1. Run it any
time the assessor CSV is refreshed.
```

- [ ] **Step 2: Add a "what's live" note to the main README**

In the top-level `README.md`, find the relevant "Verified-resident network" section (or add one near the existing community pulse note) and add:

```markdown
### Self-serve verification (Phase 1)

A second door at <https://marbleheaddata.org/verify-me.html> lets new
residents claim verification by signing in with Facebook and matching
their name against the FY2025 assessor record. The existing invite-link
flow at `/verify.html` remains as the fallback for renters, recent
buyers, and spouses not on the deed.
```

- [ ] **Step 3: Commit**

```bash
git add community-pulse/README.md README.md
git commit -m "docs: document FB OAuth setup and parcel-owners sync"
```

---

## Task 19: Manual end-to-end test against the local Worker

This task is exploratory: no test code, just confirming the pieces stitch together against a real local Worker + D1.

- [ ] **Step 1: Start the worker locally**

```bash
cd community-pulse && npx wrangler dev --local --port 8787
```

- [ ] **Step 2: Seed one test parcel**

```bash
cd community-pulse && npx wrangler d1 execute community-pulse-staging --local \
  --command "INSERT INTO parcel_owners (address_normalized, owner_name, parcel_id, fy, updated_at) VALUES ('12 STATE STREET','BABER ANDREW G','TEST',2025,strftime('%s','now'));"
```

- [ ] **Step 3: Build and serve Jekyll**

```bash
# In a separate terminal
bundle exec jekyll serve --port 4000
```

- [ ] **Step 4: Walk the flow manually**

Open <http://localhost:4000/verify-me.html>. The page should show two doors. Click "Continue with Facebook". You will hit `/api/auth/fb/start` on the live worker URL embedded in `claim.js` — adjust the const at the top of the file to point at `http://localhost:8787` for local testing, then rebuild Jekyll.

Expected manual flow:

1. `/verify-me.html` shows two doors.
2. Click FB CTA → 302 to FB OAuth dialog.
3. After FB auth → redirected to `/verify-me#claim`.
4. Claim form appears with your FB name in the header strip.
5. Type "State" in the street field; suggestion list shows State Street.
6. Submit "12" + "State Street".
7. Response status `match`. Profile redirect.
8. `/profile.html` shows you as verified resident, name editable, public toggle off.

- [ ] **Step 5: Capture a screenshot**

```bash
mkdir -p proof
npx playwright screenshot \
  --browser=chromium \
  --viewport-size=1440,900 \
  --device-scale-factor=2 \
  http://localhost:4000/verify-me.html \
  "proof/$(git branch --show-current).png"
git add proof/*.png
git commit -m "proof: verify-me page screenshot"
```

- [ ] **Step 6: Note any gaps**

If the manual walk surfaces a bug, write it up as a follow-up issue or commit before opening the PR. Common gotchas to watch for:

- FB callback redirects to the worker host, not the Jekyll dev host, in local. Workaround: temporarily point `claim.js` at `http://localhost:8787` and use the worker-served homepage at `http://localhost:8787/`.
- The HttpOnly verify_jwt cookie set by the FB callback is on the worker host, not the Jekyll host. In production both share `marbleheaddata.org` so this is fine; in local you'll need to use the worker-served pages.

---

## Self-review checklist (run after writing all tasks)

The plan author runs this; the executing engineer can ignore it.

- [ ] **Spec coverage:** Every Phase 1 section of the spec maps to at least one task.
  - Schema migrations → Task 1
  - Match algorithm + address normalize → Tasks 2–4
  - parcel_owners ingestion → Task 5
  - JWT extension → Task 6
  - FB OAuth helpers + routes → Tasks 7–8
  - `/api/claim/address` → Task 9
  - `/api/profile` GET/POST → Tasks 10, 11
  - `/api/me/pre` (added during plan writing because claim.js needs it) → Task 15
  - Privacy + Terms → Task 12
  - `verify-me.html` + `claim.js` → Tasks 13–14
  - `profile.html` + `profile.js` → Task 16
  - Smoke tests → Task 17
  - Docs → Task 18
  - Manual end-to-end → Task 19

- [ ] **Placeholder scan:** No "TODO" / "TBD" / "fill in" left in any task body.

- [ ] **Type/name consistency:**
  - `matchOwner` returns `{ status, alternatives? }` — same shape in tests and impl.
  - `handleClaimAddress` / `handleProfileGet` / `handleProfilePost` / `handleClaimRelease` / `handleMePre` — names match between tests, impl, and router.
  - `address_normalized` is the column name everywhere (not `normalized_address`).
  - `fb_user_id` is the FK shape everywhere (not `facebook_id`).

- [ ] **Phase 1 cutline:** Engagement endpoints, idea-card widget, verifier dashboard, FB user_friends, and warrant-article voting are all explicitly NOT in this plan. They land in Phase 2/3/4 plans written later.
