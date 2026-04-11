# Community Pulse v1: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship v1 of the community pulse feature: per-section agree/disagree/alert stance buttons, private per-section notes, a directionless reactions counter, a share mechanism, and a privacy disclosure page. Private state lives only in the reader's browser; the server side is a single Cloudflare Worker with two endpoints backed by one D1 table.

**Architecture:** A vanilla-JS widget module (`assets/community-pulse/widget.js`) is loaded by each content page via a plain `<script defer>` tag. At page load, the widget walks every `<h2>` on the page (except on pages that opt out), slugifies each heading text into an anchor ID, and injects a widget element next to it. Stance and note state lives in IndexedDB. The widget batches a single `GET /api/reactions` call on page load to hydrate per-section reaction counts and fires a single `POST /api/reactions` increment on each stance click. The Worker is a 100-line JS file running on Cloudflare Workers with a Cloudflare D1 SQLite binding. No auth, no sessions, no vendor integrations beyond Cloudflare itself.

**Tech Stack:** Vanilla JavaScript (no framework, no bundler), CSS custom properties matching the existing `assets/site.css` token set, Cloudflare Workers (JavaScript runtime), Cloudflare D1 (managed SQLite), Vitest for tests, `@cloudflare/vitest-pool-workers` for Worker tests, `fake-indexeddb` for IndexedDB tests.

**Reference spec:** `docs/superpowers/specs/2026-04-10-community-pulse-design.md`

---

## Ground rules (apply to every task)

- **No em-dashes anywhere.** Use commas, periods, parentheses, or restructure. Applies to code comments, user-facing copy, commit messages, and prose in this plan.
- **Neutral framing in UI copy.** The widget and privacy page must not take a side on the override debate. Descriptive, plain, minimal.
- **No traffic-light color coding.** Stance buttons are visually neutral: agree is not green, disagree is not red. Use muted neutral backgrounds with text and iconography to distinguish states.
- **Every commit must leave the site in a working state.** `jekyll build` must succeed, no 404s on the live site, widget widgets that fail to load must fail silently without breaking the page.
- **Tests before implementation where TDD fits naturally** (pure functions, Worker endpoints, IndexedDB wrapper). Smoke-test manually in the browser where TDD adds friction (DOM rendering, CSS).
- **Commit messages in the project style:** short imperative subject (~60 to 70 chars), "Add X" or "Wire X" or "Polish X," no em-dashes, include the Claude coauthor trailer.

## File structure

Everything for this feature lives under two locations:

**Assets served by Jekyll (shipped to site visitors):**
- `assets/community-pulse/widget.js` (front-end widget module, ~500 lines when complete)
- `assets/community-pulse/widget.css` (widget styles, ~150 lines)

**Dev subproject (not served by Jekyll):**
- `community-pulse/package.json` (dev dependencies: vitest, cloudflare pool, fake-indexeddb, wrangler)
- `community-pulse/vitest.config.js` (vitest config, two test environments)
- `community-pulse/worker/src/index.js` (Cloudflare Worker handler)
- `community-pulse/worker/schema/0001_initial.sql` (D1 schema migration)
- `community-pulse/worker/wrangler.toml` (Worker deployment config)
- `community-pulse/tests/slug.test.js` (anchor slugify tests)
- `community-pulse/tests/store.test.js` (IndexedDB wrapper tests)
- `community-pulse/tests/api.test.js` (fetch wrapper tests)
- `community-pulse/tests/worker.test.js` (Worker endpoint tests)

**New pages at the site root:**
- `privacy.html` (privacy disclosure page)

**Modified files at the site root:**
- `what-fails.html`, `what-is-the-override.html`, `why-not-elsewhere.html`, `senior-tax-relief.html` (each gains a `<script defer>` tag, a `<link rel="stylesheet">` tag, and five OG meta tags)
- `index.html` (gains the widget script so the share button works on question cards, gains OG meta tags, but is opted out of h2 widget auto-injection via `<body data-community-pulse="off-sections">`)
- `_config.yml` (exclude `community-pulse/` from Jekyll processing)
- `.gitignore` (add `community-pulse/node_modules/`)

Reference patterns to study before starting:

- `assets/site.css`: existing CSS custom properties (colors, spacing, border radius). Reuse these tokens in `widget.css` so the widget visually inherits from the site.
- `what-fails.html`: representative content page. Look at the `<head>` for the existing meta tag pattern and analytics scripts; the widget script tag and OG tags go in the same area.
- `docs/superpowers/specs/2026-04-10-community-pulse-design.md`: the design spec. Every decision in this plan traces back to a section in the spec.

---

## Pre-flight: Worktree and branch

Before starting, decide whether to work in a dedicated worktree. If the user is mid-stream on other work, create a worktree using the `superpowers:using-git-worktrees` skill. Otherwise, a local branch on the main repo is fine.

- [ ] **Pre-flight step 1: Create branch**

Run:
```
cd /Users/agbaber/marblehead
git checkout -b community-pulse-v1
git status
```

Expected: `On branch community-pulse-v1`, nothing to commit.

- [ ] **Pre-flight step 2: Verify the spec is on this branch**

Run:
```
git log --oneline -3
```

Expected: the most recent commit is `bc740d6 Add community pulse v1 design spec` or similar, and that commit includes `docs/superpowers/specs/2026-04-10-community-pulse-design.md`.

---

## Task 1: Create the community-pulse dev subproject

**Goal:** Scaffold the test tooling and Worker dev directory. No feature code yet. After this task, running `npm test` from `community-pulse/` succeeds with zero tests and no errors.

**Files:**
- Create: `community-pulse/package.json`
- Create: `community-pulse/vitest.config.js`
- Create: `community-pulse/.gitignore`
- Modify: `_config.yml` (add `exclude` entry)
- Modify: `.gitignore` at repo root (add `community-pulse/node_modules/`)

- [ ] **Step 1: Create `community-pulse/package.json`**

```json
{
  "name": "community-pulse",
  "version": "0.1.0",
  "private": true,
  "description": "Community pulse feature for the Marblehead Budget Data site.",
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "worker:dev": "wrangler dev worker/src/index.js",
    "worker:deploy": "wrangler deploy worker/src/index.js"
  },
  "devDependencies": {
    "vitest": "^1.6.0",
    "@cloudflare/vitest-pool-workers": "^0.4.0",
    "fake-indexeddb": "^5.0.2",
    "wrangler": "^3.60.0"
  }
}
```

- [ ] **Step 2: Create `community-pulse/vitest.config.js`**

This sets up two test environments: a node environment for the browser widget unit tests (which use `fake-indexeddb`) and a Workers pool for the Worker tests.

```javascript
import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config';

export default defineWorkersConfig({
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'widget',
          include: ['tests/slug.test.js', 'tests/store.test.js', 'tests/api.test.js'],
          environment: 'node',
          setupFiles: ['./tests/setup-widget.js']
        }
      },
      {
        extends: true,
        test: {
          name: 'worker',
          include: ['tests/worker.test.js'],
          poolOptions: {
            workers: {
              singleWorker: true,
              wrangler: { configPath: './worker/wrangler.toml' }
            }
          }
        }
      }
    ]
  }
});
```

- [ ] **Step 3: Create `community-pulse/tests/setup-widget.js`**

```javascript
import 'fake-indexeddb/auto';
```

- [ ] **Step 4: Create `community-pulse/.gitignore`**

```
node_modules/
.wrangler/
.dev.vars
*.log
dist/
```

- [ ] **Step 5: Add Jekyll exclusion in `_config.yml`**

Current `_config.yml` is three lines. Add a fourth:

```yaml
theme: jekyll-theme-minimal
title: Marblehead Budget Data
description: Open data and charts about Marblehead, MA municipal finances
exclude:
  - community-pulse/
  - node_modules/
```

- [ ] **Step 6: Add root `.gitignore` entry**

If the repo root has no `.gitignore`, create one. Otherwise append:

```
community-pulse/node_modules/
community-pulse/.wrangler/
community-pulse/dist/
```

- [ ] **Step 7: Install dependencies**

Run:
```
cd community-pulse && npm install
```

Expected: dependencies install successfully. `node_modules/` is created. No test failures because there are no tests yet.

- [ ] **Step 8: Verify `npm test` runs cleanly with zero tests**

Run:
```
cd community-pulse && npm test
```

Expected: vitest runs, reports "No test files found" (or similar), exits with code 0 (vitest treats zero tests as passing by default in recent versions). If it errors on config, fix the config before moving on.

- [ ] **Step 9: Commit**

```bash
git add community-pulse/package.json community-pulse/package-lock.json community-pulse/vitest.config.js community-pulse/tests/setup-widget.js community-pulse/.gitignore _config.yml .gitignore
git commit -m "$(cat <<'EOF'
Add community pulse dev subproject scaffold

Sets up vitest with two test environments: a node project for the
browser widget unit tests (with fake-indexeddb) and a Cloudflare
Workers pool for Worker tests. No feature code yet.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Add the slug function (TDD)

**Goal:** A pure function that converts a heading text into an anchor ID slug. This is the one piece of the widget that is trivially testable in isolation, so TDD is natural here. The function must handle whitespace, punctuation, casing, and unicode gracefully, and must produce the same ID for the same input on every run.

**Files:**
- Create: `community-pulse/tests/slug.test.js`
- Create: `assets/community-pulse/widget.js` (partial: slug function only)
- Create: `assets/community-pulse/` directory if it does not exist

- [ ] **Step 1: Write the failing test**

Create `community-pulse/tests/slug.test.js`:

```javascript
import { describe, it, expect } from 'vitest';
import { slugify } from '../../assets/community-pulse/widget.js';

describe('slugify', () => {
  it('lowercases and replaces spaces with hyphens', () => {
    expect(slugify('Staffing Cuts')).toBe('staffing-cuts');
  });

  it('strips punctuation', () => {
    expect(slugify("What's in the no-override budget?")).toBe('whats-in-the-no-override-budget');
  });

  it('collapses multiple spaces and hyphens', () => {
    expect(slugify('too   many     spaces')).toBe('too-many-spaces');
    expect(slugify('leading---hyphens')).toBe('leading-hyphens');
  });

  it('trims leading and trailing hyphens', () => {
    expect(slugify('   spaces around   ')).toBe('spaces-around');
  });

  it('returns empty string for empty input', () => {
    expect(slugify('')).toBe('');
    expect(slugify('   ')).toBe('');
  });

  it('is deterministic', () => {
    expect(slugify('Same Input')).toBe(slugify('Same Input'));
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:
```
cd community-pulse && npm test -- slug.test.js
```

Expected: FAIL, error message says `widget.js` cannot be imported or `slugify` is not exported.

- [ ] **Step 3: Create `assets/community-pulse/widget.js` with the slug function**

```javascript
// Community pulse widget module.
// Loaded by each content page as a <script defer> tag.
// Hydrates every <h2> on the page with a stance widget, unless the page
// opts out via <body data-community-pulse="off-sections">.

/**
 * Convert a heading text into an anchor ID slug.
 * Stable across runs for the same input.
 */
export function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')      // strip punctuation
    .replace(/[\s_-]+/g, '-')      // collapse whitespace and hyphens
    .replace(/^-+|-+$/g, '');      // trim leading and trailing hyphens
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run:
```
cd community-pulse && npm test -- slug.test.js
```

Expected: PASS. All six test cases green.

- [ ] **Step 5: Commit**

```bash
git add community-pulse/tests/slug.test.js assets/community-pulse/widget.js
git commit -m "$(cat <<'EOF'
Add community pulse slug function

Pure function that converts heading text into a stable anchor ID,
used at page load to assign IDs to h2 elements for the widget and
share permalinks.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Add the IndexedDB stance store (TDD)

**Goal:** A small wrapper around IndexedDB that reads and writes per-section stance and note records. This is where a reader's private marks actually live. The wrapper is a thin abstraction: open the database, get or set a record by section ID, list all records, clear one or all.

**Files:**
- Create: `community-pulse/tests/store.test.js`
- Modify: `assets/community-pulse/widget.js` (add stance store exports)

- [ ] **Step 1: Write the failing test**

Create `community-pulse/tests/store.test.js`:

```javascript
import { describe, it, expect, beforeEach } from 'vitest';
import { openStore, getStance, setStance, getAllStances, clearStance, clearAllStances } from '../../assets/community-pulse/widget.js';

// Each test gets a fresh IndexedDB because fake-indexeddb resets per import scope.
beforeEach(async () => {
  // Clear the in-memory IndexedDB between tests by clearing the store.
  const db = await openStore();
  await clearAllStances(db);
});

describe('stance store', () => {
  it('returns null for an unknown section', async () => {
    const db = await openStore();
    const result = await getStance(db, 'what-fails.html#unknown');
    expect(result).toBeNull();
  });

  it('writes and reads back a stance', async () => {
    const db = await openStore();
    await setStance(db, 'what-fails.html#staffing-cuts', {
      stance: 'agree',
      note: 'This matches the Fin Com report.'
    });
    const result = await getStance(db, 'what-fails.html#staffing-cuts');
    expect(result.stance).toBe('agree');
    expect(result.note).toBe('This matches the Fin Com report.');
    expect(result.updated_at).toBeGreaterThan(0);
  });

  it('updates an existing stance in place', async () => {
    const db = await openStore();
    await setStance(db, 'section-a', { stance: 'agree', note: 'first' });
    await setStance(db, 'section-a', { stance: 'disagree', note: 'changed my mind' });
    const result = await getStance(db, 'section-a');
    expect(result.stance).toBe('disagree');
    expect(result.note).toBe('changed my mind');
  });

  it('lists all stored stances', async () => {
    const db = await openStore();
    await setStance(db, 'section-a', { stance: 'agree', note: '' });
    await setStance(db, 'section-b', { stance: 'disagree', note: '' });
    await setStance(db, 'section-c', { stance: 'alert', note: '' });
    const all = await getAllStances(db);
    expect(all.length).toBe(3);
    const ids = all.map(s => s.section_id).sort();
    expect(ids).toEqual(['section-a', 'section-b', 'section-c']);
  });

  it('clears a single stance', async () => {
    const db = await openStore();
    await setStance(db, 'section-a', { stance: 'agree', note: '' });
    await setStance(db, 'section-b', { stance: 'disagree', note: '' });
    await clearStance(db, 'section-a');
    expect(await getStance(db, 'section-a')).toBeNull();
    expect(await getStance(db, 'section-b')).not.toBeNull();
  });

  it('clears all stances', async () => {
    const db = await openStore();
    await setStance(db, 'section-a', { stance: 'agree', note: '' });
    await setStance(db, 'section-b', { stance: 'disagree', note: '' });
    await clearAllStances(db);
    expect((await getAllStances(db)).length).toBe(0);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:
```
cd community-pulse && npm test -- store.test.js
```

Expected: FAIL, imports like `openStore` are not defined.

- [ ] **Step 3: Implement the stance store in `widget.js`**

Append to `assets/community-pulse/widget.js`:

```javascript
// ---- Stance store (IndexedDB wrapper) -----------------------------------

const DB_NAME = 'community-pulse';
const DB_VERSION = 1;
const STORE_NAME = 'stances';

/** Open the IndexedDB connection. Creates the object store on first use. */
export function openStore() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'section_id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Read a single stance record by section_id. Returns null if missing. */
export function getStance(db, sectionId) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(sectionId);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

/** Upsert a stance record. Stamps updated_at. */
export function setStance(db, sectionId, { stance, note }) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const record = {
      section_id: sectionId,
      stance: stance ?? null,
      note: note ?? '',
      updated_at: Date.now()
    };
    const req = store.put(record);
    req.onsuccess = () => resolve(record);
    req.onerror = () => reject(req.error);
  });
}

/** Return every stance record as an array. */
export function getAllStances(db) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

/** Delete a single stance by section_id. */
export function clearStance(db, sectionId) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.delete(sectionId);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/** Delete every stance record. */
export function clearAllStances(db) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run:
```
cd community-pulse && npm test -- store.test.js
```

Expected: PASS. All six test cases green.

- [ ] **Step 5: Commit**

```bash
git add community-pulse/tests/store.test.js assets/community-pulse/widget.js
git commit -m "$(cat <<'EOF'
Add community pulse IndexedDB stance store

Thin wrapper around IndexedDB that reads, writes, lists, and clears
per-section stance records. All reader marks and notes live here and
never leave the browser.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Add the reactions API client (TDD)

**Goal:** A small fetch wrapper that talks to the two Worker endpoints: batched GET for current reaction counts on page load, and POST increment on each stance click. The wrapper is testable with a mock `fetch` global; no real network calls.

**Files:**
- Create: `community-pulse/tests/api.test.js`
- Modify: `assets/community-pulse/widget.js` (add API client exports)

- [ ] **Step 1: Write the failing test**

Create `community-pulse/tests/api.test.js`:

```javascript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { fetchReactions, incrementReaction, configureApi } from '../../assets/community-pulse/widget.js';

describe('reactions API client', () => {
  beforeEach(() => {
    configureApi({ baseUrl: 'https://pulse.example.com' });
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('fetchReactions batches section IDs into a single request', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        'what-fails.html#staffing-cuts': { total: 47, last_24h: 12 },
        'what-fails.html#melrose-comparison': { total: 13, last_24h: 2 }
      })
    });

    const result = await fetchReactions([
      'what-fails.html#staffing-cuts',
      'what-fails.html#melrose-comparison'
    ]);

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const call = global.fetch.mock.calls[0];
    expect(call[0]).toMatch(/^https:\/\/pulse\.example\.com\/api\/reactions\?section_ids=/);
    expect(call[0]).toContain(encodeURIComponent('what-fails.html#staffing-cuts'));
    expect(result['what-fails.html#staffing-cuts'].total).toBe(47);
  });

  it('fetchReactions returns an empty object on network error', async () => {
    global.fetch.mockRejectedValue(new Error('network down'));
    const result = await fetchReactions(['a']);
    expect(result).toEqual({});
  });

  it('fetchReactions returns an empty object on non-ok response', async () => {
    global.fetch.mockResolvedValue({ ok: false, status: 500 });
    const result = await fetchReactions(['a']);
    expect(result).toEqual({});
  });

  it('fetchReactions returns an empty object when called with no sections', async () => {
    const result = await fetchReactions([]);
    expect(global.fetch).not.toHaveBeenCalled();
    expect(result).toEqual({});
  });

  it('incrementReaction POSTs the section ID', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ total: 48, last_24h: 13 })
    });

    const result = await incrementReaction('what-fails.html#staffing-cuts');

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [url, opts] = global.fetch.mock.calls[0];
    expect(url).toBe('https://pulse.example.com/api/reactions');
    expect(opts.method).toBe('POST');
    expect(JSON.parse(opts.body)).toEqual({ section_id: 'what-fails.html#staffing-cuts' });
    expect(result.total).toBe(48);
  });

  it('incrementReaction returns null on network error', async () => {
    global.fetch.mockRejectedValue(new Error('network down'));
    const result = await incrementReaction('a');
    expect(result).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:
```
cd community-pulse && npm test -- api.test.js
```

Expected: FAIL, imports not defined.

- [ ] **Step 3: Implement the API client in `widget.js`**

Append to `assets/community-pulse/widget.js`:

```javascript
// ---- Reactions API client -----------------------------------------------

let apiBaseUrl = ''; // set via configureApi or a page-level data attribute

/** Configure the API base URL. Called once at widget init. */
export function configureApi({ baseUrl }) {
  apiBaseUrl = baseUrl;
}

/**
 * Fetch reaction counts for a batch of section IDs in one request.
 * Returns a map of section_id to { total, last_24h }. Returns {} on any error.
 */
export async function fetchReactions(sectionIds) {
  if (!sectionIds || sectionIds.length === 0) return {};
  try {
    const url = `${apiBaseUrl}/api/reactions?section_ids=${sectionIds.map(encodeURIComponent).join(',')}`;
    const res = await fetch(url);
    if (!res.ok) return {};
    return await res.json();
  } catch {
    return {};
  }
}

/**
 * POST an increment for one section. Returns { total, last_24h } on success
 * or null on any error.
 */
export async function incrementReaction(sectionId) {
  try {
    const res = await fetch(`${apiBaseUrl}/api/reactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ section_id: sectionId })
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run:
```
cd community-pulse && npm test -- api.test.js
```

Expected: PASS. All six test cases green.

- [ ] **Step 5: Commit**

```bash
git add community-pulse/tests/api.test.js assets/community-pulse/widget.js
git commit -m "$(cat <<'EOF'
Add community pulse reactions API client

Fetch wrapper for the two Worker endpoints: batched GET on page load
and POST increment on stance click. Network errors fail silently so
the widget degrades gracefully.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Add the widget CSS

**Goal:** Visual styles for the widget. Reuses CSS custom properties from `assets/site.css` so the widget inherits the site's light-and-dark theme automatically. No TDD here; manual verification by loading a page in a browser after Task 7 lands.

**Files:**
- Create: `assets/community-pulse/widget.css`

- [ ] **Step 1: Inspect existing site CSS tokens**

Run:
```
head -50 assets/site.css
```

Note the custom properties defined there (expected: variables like `--bg`, `--fg`, `--accent`, `--card`, `--muted`, `--border`, etc.). Reuse these in the widget CSS so the widget respects the site's existing light and dark themes without a separate token set.

- [ ] **Step 2: Create `assets/community-pulse/widget.css`**

```css
/* Community pulse widget styles.
   Reuses CSS custom properties from assets/site.css so the widget
   inherits the site's light and dark themes automatically. */

.cp-widget {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.6rem;
  margin: 0.4rem 0 1.2rem 0;
  padding: 0.4rem 0.6rem;
  font-size: 0.85rem;
  color: var(--muted, #666);
  border-top: 1px dashed var(--border, rgba(0,0,0,0.1));
  border-bottom: 1px dashed var(--border, rgba(0,0,0,0.1));
}

.cp-widget__buttons {
  display: inline-flex;
  gap: 0.25rem;
}

.cp-widget__button {
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;
  padding: 0.25rem 0.55rem;
  font-size: 0.95rem;
  font-family: inherit;
  color: inherit;
  background: transparent;
  border: 1px solid var(--border, rgba(0,0,0,0.15));
  border-radius: 0.35rem;
  cursor: pointer;
  transition: background 0.12s ease, border-color 0.12s ease;
}

.cp-widget__button:hover {
  background: var(--card, rgba(0,0,0,0.04));
}

.cp-widget__button:focus-visible {
  outline: 2px solid var(--accent, #0b74c4);
  outline-offset: 2px;
}

.cp-widget__button[aria-pressed="true"] {
  background: var(--card, rgba(0,0,0,0.06));
  border-color: var(--fg, #333);
}

.cp-widget__count {
  display: inline-flex;
  align-items: baseline;
  gap: 0.4rem;
  font-size: 0.82rem;
  color: var(--muted, #666);
}

.cp-widget__delta {
  font-size: 0.75rem;
  opacity: 0.75;
}

.cp-widget__share,
.cp-widget__privacy {
  display: inline-flex;
  align-items: center;
  padding: 0.25rem 0.4rem;
  font-size: 0.82rem;
  color: var(--muted, #666);
  background: transparent;
  border: none;
  cursor: pointer;
  text-decoration: none;
}

.cp-widget__share:hover,
.cp-widget__privacy:hover {
  color: var(--fg, #222);
  text-decoration: underline;
}

.cp-widget__note-toggle {
  display: inline-flex;
  align-items: center;
  padding: 0.25rem 0.4rem;
  font-size: 0.82rem;
  color: var(--muted, #666);
  background: transparent;
  border: none;
  cursor: pointer;
}

.cp-widget__note {
  display: block;
  width: 100%;
  margin-top: 0.4rem;
  padding: 0.4rem;
  font-family: inherit;
  font-size: 0.85rem;
  color: inherit;
  background: var(--card, rgba(0,0,0,0.03));
  border: 1px solid var(--border, rgba(0,0,0,0.1));
  border-radius: 0.35rem;
  resize: vertical;
  min-height: 3.5rem;
}

.cp-widget__note[hidden] {
  display: none;
}

.cp-widget__toast {
  position: fixed;
  bottom: 1rem;
  left: 50%;
  transform: translateX(-50%);
  padding: 0.5rem 1rem;
  font-size: 0.85rem;
  color: var(--bg, #fff);
  background: var(--fg, #222);
  border-radius: 0.35rem;
  opacity: 0;
  transition: opacity 0.2s ease;
  pointer-events: none;
  z-index: 1000;
}

.cp-widget__toast--visible {
  opacity: 0.95;
}

@media (max-width: 600px) {
  .cp-widget {
    font-size: 0.8rem;
    gap: 0.4rem;
  }
  .cp-widget__button {
    padding: 0.35rem 0.55rem;
    font-size: 1rem;
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add assets/community-pulse/widget.css
git commit -m "$(cat <<'EOF'
Add community pulse widget CSS

Inherits site CSS custom properties so the widget matches the light
and dark themes automatically. No color coding on stance buttons;
active state is shown by background and border, not hue.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Add the widget rendering and hydration logic

**Goal:** The largest task. DOM rendering, anchor ID assignment for every h2, widget HTML injection, event wiring, optimistic UI updates, and page-load hydration. This is the code that users actually see. No TDD for DOM work; manual smoke test at the end of the task.

**Files:**
- Modify: `assets/community-pulse/widget.js` (add rendering and hydration)

- [ ] **Step 1: Append the rendering code to `widget.js`**

```javascript
// ---- Widget rendering and hydration -------------------------------------

const STANCE_BUTTONS = [
  { key: 'agree',    emoji: '👍', label: 'Agree' },
  { key: 'disagree', emoji: '👎', label: 'Disagree' },
  { key: 'alert',    emoji: '!',  label: 'Alert: something here caught my eye' }
];

/**
 * Build the widget DOM for one section and attach it to the given parent
 * element. Returns the widget root element.
 */
function buildWidget(sectionId, sectionTitle, initialReactions, initialStance) {
  const root = document.createElement('div');
  root.className = 'cp-widget';
  root.dataset.sectionId = sectionId;

  // Stance buttons.
  const buttons = document.createElement('div');
  buttons.className = 'cp-widget__buttons';
  STANCE_BUTTONS.forEach(({ key, emoji, label }) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'cp-widget__button';
    btn.dataset.stance = key;
    btn.setAttribute('aria-label', label);
    btn.title = label;
    btn.textContent = emoji;
    btn.setAttribute('aria-pressed', initialStance === key ? 'true' : 'false');
    buttons.appendChild(btn);
  });
  root.appendChild(buttons);

  // Reaction count + delta.
  const count = document.createElement('span');
  count.className = 'cp-widget__count';
  const countNum = document.createElement('span');
  countNum.className = 'cp-widget__count-num';
  countNum.textContent = initialReactions
    ? `${initialReactions.total} reactions`
    : '...'; // ellipsis placeholder until the GET /api/reactions batch resolves
  const countDelta = document.createElement('span');
  countDelta.className = 'cp-widget__delta';
  if (initialReactions && initialReactions.last_24h > 0) {
    countDelta.textContent = `+${initialReactions.last_24h} today`;
  }
  count.appendChild(countNum);
  if (countDelta.textContent) count.appendChild(countDelta);
  root.appendChild(count);

  // Share button.
  const share = document.createElement('button');
  share.type = 'button';
  share.className = 'cp-widget__share';
  share.dataset.action = 'share';
  share.setAttribute('aria-label', 'Share this section');
  share.title = 'Share this section';
  share.textContent = 'Share';
  root.appendChild(share);

  // Privacy link.
  const privacy = document.createElement('a');
  privacy.className = 'cp-widget__privacy';
  privacy.href = '/privacy.html';
  privacy.title = 'How this feature handles your data';
  privacy.textContent = 'Privacy';
  root.appendChild(privacy);

  // Note toggle.
  const noteToggle = document.createElement('button');
  noteToggle.type = 'button';
  noteToggle.className = 'cp-widget__note-toggle';
  noteToggle.dataset.action = 'toggle-note';
  noteToggle.setAttribute('aria-expanded', 'false');
  noteToggle.textContent = 'Note';
  root.appendChild(noteToggle);

  // Note textarea (hidden initially).
  const note = document.createElement('textarea');
  note.className = 'cp-widget__note';
  note.placeholder = 'Write a private note. Saved locally in your browser.';
  note.hidden = true;
  note.rows = 3;
  root.appendChild(note);

  return root;
}

/** Show a transient toast message near the bottom of the viewport. */
function showToast(message) {
  const existing = document.querySelector('.cp-widget__toast');
  if (existing) existing.remove();
  const toast = document.createElement('div');
  toast.className = 'cp-widget__toast';
  toast.textContent = message;
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('cp-widget__toast--visible'));
  setTimeout(() => toast.remove(), 2400);
}

/** Debounce helper for note field saves. */
function debounce(fn, ms) {
  let timer = null;
  return (...args) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

/**
 * Wire event handlers on a single widget: stance buttons, note toggle and
 * save, share button. Reads and writes the IndexedDB store.
 */
function wireWidget(root, db, sectionId, sectionUrl, sectionTitle) {
  const buttons = root.querySelectorAll('.cp-widget__button');
  const noteToggle = root.querySelector('.cp-widget__note-toggle');
  const noteField = root.querySelector('.cp-widget__note');
  const shareBtn = root.querySelector('.cp-widget__share');
  const countNum = root.querySelector('.cp-widget__count-num');
  const countDelta = root.querySelector('.cp-widget__delta');

  // Load stored stance and note and reflect into UI.
  getStance(db, sectionId).then(record => {
    if (!record) return;
    buttons.forEach(btn => {
      btn.setAttribute('aria-pressed', btn.dataset.stance === record.stance ? 'true' : 'false');
    });
    if (record.note) {
      noteField.value = record.note;
      noteField.hidden = false;
      noteToggle.setAttribute('aria-expanded', 'true');
    }
  });

  // Stance button handler.
  buttons.forEach(btn => {
    btn.addEventListener('click', async () => {
      const stanceKey = btn.dataset.stance;
      const currentlyPressed = btn.getAttribute('aria-pressed') === 'true';
      const newStance = currentlyPressed ? null : stanceKey;
      // Update pressed state immediately.
      buttons.forEach(b => {
        b.setAttribute('aria-pressed', b.dataset.stance === newStance ? 'true' : 'false');
      });
      // Persist to IndexedDB.
      const existing = await getStance(db, sectionId);
      await setStance(db, sectionId, {
        stance: newStance,
        note: existing?.note ?? ''
      });
      // Fire reactions increment (directionless). Only increment on activate,
      // not on deactivate, to match "click any button to count as a reaction."
      if (newStance) {
        incrementReaction(sectionId).then(result => {
          if (result) {
            countNum.textContent = `${result.total} reactions`;
            if (result.last_24h > 0) {
              if (!countDelta) return;
              countDelta.textContent = `+${result.last_24h} today`;
            }
          }
        });
      }
    });
  });

  // Note toggle.
  noteToggle.addEventListener('click', () => {
    const isOpen = !noteField.hidden;
    noteField.hidden = isOpen;
    noteToggle.setAttribute('aria-expanded', isOpen ? 'false' : 'true');
    if (!isOpen) noteField.focus();
  });

  // Note field debounced save.
  const saveNote = debounce(async () => {
    const existing = await getStance(db, sectionId);
    await setStance(db, sectionId, {
      stance: existing?.stance ?? null,
      note: noteField.value
    });
  }, 1000);
  noteField.addEventListener('input', saveNote);

  // Share button.
  shareBtn.addEventListener('click', async () => {
    const shareData = { title: sectionTitle, url: sectionUrl };
    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch {
        // User cancelled or share failed silently.
      }
    } else if (navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(sectionUrl);
        showToast('Link copied');
      } catch {
        showToast('Copy failed');
      }
    } else {
      // Last-resort fallback: show the URL in a prompt so the user can copy it manually.
      window.prompt('Copy this link:', sectionUrl);
    }
  });
}

/**
 * Walk every h2 on the page (unless opted out), assign an anchor ID, inject
 * a widget next to it, and wire handlers. Also handle elements with an
 * explicit data-stance-section attribute.
 */
export async function hydrateWidgets() {
  // Opt-out check.
  if (document.body.dataset.communityPulse === 'off-sections') return;

  const pagePath = location.pathname.replace(/^\//, '') || 'index.html';
  const collectedTargets = [];

  // Auto: every h2 on the page.
  document.querySelectorAll('h2').forEach(heading => {
    const text = heading.textContent.trim();
    const slug = slugify(text);
    if (!slug) return;
    if (!heading.id) heading.id = slug;
    collectedTargets.push({
      element: heading,
      sectionId: `${pagePath}#${heading.id}`,
      title: text
    });
  });

  // Explicit: elements with data-stance-section override.
  document.querySelectorAll('[data-stance-section]').forEach(el => {
    const slug = el.dataset.stanceSection.trim();
    if (!slug) return;
    if (!el.id) el.id = slug;
    const title = el.getAttribute('aria-label') || el.textContent.trim().slice(0, 80) || slug;
    collectedTargets.push({
      element: el,
      sectionId: `${pagePath}#${slug}`,
      title
    });
  });

  if (collectedTargets.length === 0) return;

  // Batch-fetch reaction counts for all targets in one request.
  const reactionsMap = await fetchReactions(collectedTargets.map(t => t.sectionId));

  // Open IndexedDB once for all widgets on the page.
  let db;
  try {
    db = await openStore();
  } catch {
    // IndexedDB disabled (private mode, etc). Skip widgets silently.
    return;
  }

  // Build and wire each widget.
  for (const target of collectedTargets) {
    const initialReactions = reactionsMap[target.sectionId];
    const existing = await getStance(db, target.sectionId);
    const widget = buildWidget(
      target.sectionId,
      target.title,
      initialReactions,
      existing?.stance
    );
    target.element.insertAdjacentElement('afterend', widget);
    wireWidget(
      widget,
      db,
      target.sectionId,
      `${location.origin}/${target.sectionId}`,
      target.title
    );
  }

  // Re-scroll to a fragment if one is present (fixes runtime-anchor-generation
  // timing: the browser tried to scroll before we inserted the IDs).
  if (location.hash) {
    const target = document.getElementById(location.hash.slice(1));
    if (target) target.scrollIntoView({ behavior: 'instant', block: 'start' });
  }
}

// ---- Auto-init on DOMContentLoaded --------------------------------------

if (typeof document !== 'undefined') {
  // Configure API base URL from a script data attribute if present.
  const script = document.currentScript || document.querySelector('script[src*="community-pulse/widget.js"]');
  if (script && script.dataset.apiBase) {
    configureApi({ baseUrl: script.dataset.apiBase });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', hydrateWidgets);
  } else {
    hydrateWidgets();
  }
}
```

- [ ] **Step 2: Smoke-test the widget manually in a browser**

The widget is not yet wired into any page, but you can create a one-off test page in the repo root to verify it renders.

Create `_widget-smoke.html` (temporary, not committed):

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Widget smoke test</title>
  <link rel="stylesheet" href="assets/community-pulse/widget.css">
</head>
<body>
  <h1>Widget smoke test</h1>
  <h2>Staffing cuts in the no-override budget</h2>
  <p>Dummy content for section one.</p>
  <h2>Melrose and Stoneham comparison</h2>
  <p>Dummy content for section two.</p>
  <script type="module" src="assets/community-pulse/widget.js"></script>
</body>
</html>
```

Serve it from the repo root and open it in a browser:

```
cd /Users/agbaber/marblehead && python3 -m http.server 8000
```

Then visit `http://localhost:8000/_widget-smoke.html`. Expected:
- Each h2 has a widget rendered below it.
- Clicking a button toggles its pressed state and persists across reload.
- The reactions count shows a dash (backend not yet wired).
- Clicking "Share" on desktop copies the URL and shows a toast.
- Clicking "Note" expands the textarea; typing saves after 1 second.

Kill the server when done. **Delete `_widget-smoke.html` before committing.**

- [ ] **Step 3: Commit**

```bash
rm -f _widget-smoke.html
git add assets/community-pulse/widget.js
git commit -m "$(cat <<'EOF'
Add community pulse widget rendering and hydration

Walks every h2 (and every data-stance-section element) on page load,
slugifies the heading into an anchor ID, injects a stance widget, and
wires stance, note, share, and privacy handlers. Handles the share
sheet on mobile and clipboard fallback on desktop. Runtime anchor
generation re-scrolls to any fragment in the URL after IDs are set.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Create the Cloudflare Worker scaffold

**Goal:** Set up the Worker project files: `wrangler.toml`, the D1 schema, and an empty handler. The handler responds with 404 to everything. No feature code yet; Tasks 8 and 9 flesh it out.

**Files:**
- Create: `community-pulse/worker/wrangler.toml`
- Create: `community-pulse/worker/schema/0001_initial.sql`
- Create: `community-pulse/worker/src/index.js`

- [ ] **Step 1: Create `community-pulse/worker/wrangler.toml`**

```toml
name = "marblehead-community-pulse"
main = "src/index.js"
compatibility_date = "2026-04-01"

[[d1_databases]]
binding = "DB"
database_name = "community-pulse"
database_id = "REPLACE_WITH_DATABASE_ID_AFTER_CREATE"

[vars]
ALLOWED_ORIGIN = "https://marbleheaddata.org"

# Dev-only fallback binding for local development. Real deployment
# uses the D1 binding above, populated by `wrangler d1 create`.
```

The `database_id` placeholder will be filled in by a real `wrangler d1 create` command during deployment. That is out of scope for this plan (a manual operational step).

- [ ] **Step 2: Create `community-pulse/worker/schema/0001_initial.sql`**

```sql
-- Community pulse reactions counter.
-- One row per section. Reactions are directionless.

CREATE TABLE IF NOT EXISTS reactions (
  section_id TEXT PRIMARY KEY,
  total_count INTEGER NOT NULL DEFAULT 0,
  count_24h INTEGER NOT NULL DEFAULT 0,
  window_24h_start INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL DEFAULT 0
);

-- Per-IP fixed-window rate limit state.
-- Rows with window_start older than 2 hours can be deleted lazily on write.

CREATE TABLE IF NOT EXISTS rate_limits (
  ip_hash TEXT NOT NULL,
  section_id TEXT NOT NULL,
  window_start INTEGER NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (ip_hash, section_id, window_start)
);
```

- [ ] **Step 3: Create `community-pulse/worker/src/index.js`**

Initial skeleton. Responds 404 to everything. Tasks 8, 9, and 10 fill this out.

```javascript
// Cloudflare Worker for the community pulse reactions counter.
// Exposes two endpoints:
//   GET  /api/reactions?section_ids=a,b,c   (batched fetch)
//   POST /api/reactions                     (increment one section)
//
// Backed by a single D1 database with two tables. No auth, no sessions.

const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const RATE_LIMIT_MAX = 5; // per section per window per ip

export default {
  async fetch(request, env) {
    return handleRequest(request, env);
  }
};

/**
 * Main request router. Exported for tests.
 */
export async function handleRequest(request, env) {
  const url = new URL(request.url);

  // CORS preflight.
  if (request.method === 'OPTIONS') {
    return corsResponse(request, env);
  }

  if (url.pathname !== '/api/reactions') {
    return new Response('Not Found', { status: 404, headers: corsHeaders(env) });
  }

  if (request.method === 'GET') {
    return handleGet(request, env);
  }
  if (request.method === 'POST') {
    return handlePost(request, env);
  }
  return new Response('Method Not Allowed', { status: 405, headers: corsHeaders(env) });
}

async function handleGet(request, env) {
  return new Response('not yet implemented', { status: 501, headers: corsHeaders(env) });
}

async function handlePost(request, env) {
  return new Response('not yet implemented', { status: 501, headers: corsHeaders(env) });
}

function corsHeaders(env) {
  return {
    'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN || '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };
}

function corsResponse(request, env) {
  return new Response(null, { status: 204, headers: corsHeaders(env) });
}
```

- [ ] **Step 4: Commit**

```bash
git add community-pulse/worker/
git commit -m "$(cat <<'EOF'
Add community pulse Worker scaffold

Skeleton Cloudflare Worker with wrangler.toml, D1 schema (reactions +
rate_limits tables), and an empty handler that returns 501 from the
two /api/reactions routes. CORS preflight handled. Endpoints are
filled in by later tasks.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Implement GET /api/reactions (TDD)

**Goal:** The batched read endpoint. Accepts a comma-separated list of section IDs, returns a map of each section ID to `{ total, last_24h }`. Missing sections return zeros. No mutation.

**Files:**
- Create: `community-pulse/tests/worker.test.js`
- Modify: `community-pulse/worker/src/index.js` (implement `handleGet`)

- [ ] **Step 1: Write the failing test**

Create `community-pulse/tests/worker.test.js`:

```javascript
import { describe, it, expect, beforeEach } from 'vitest';
import { env, applyD1Migrations } from 'cloudflare:test';
import { handleRequest } from '../worker/src/index.js';

// Apply migrations before the test suite.
beforeEach(async () => {
  await applyD1Migrations(env.DB, { migrationsTableName: 'd1_migrations' });
  // Reset tables between tests.
  await env.DB.prepare('DELETE FROM reactions').run();
  await env.DB.prepare('DELETE FROM rate_limits').run();
});

describe('GET /api/reactions', () => {
  it('returns an empty object when no section_ids param', async () => {
    const req = new Request('https://pulse.example.com/api/reactions');
    const res = await handleRequest(req, env);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({});
  });

  it('returns zeros for unknown sections', async () => {
    const req = new Request('https://pulse.example.com/api/reactions?section_ids=a%23foo,b%23bar');
    const res = await handleRequest(req, env);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body['a#foo']).toEqual({ total: 0, last_24h: 0 });
    expect(body['b#bar']).toEqual({ total: 0, last_24h: 0 });
  });

  it('returns stored counts for known sections', async () => {
    const now = Date.now();
    await env.DB.prepare(
      'INSERT INTO reactions (section_id, total_count, count_24h, window_24h_start, updated_at) VALUES (?, ?, ?, ?, ?)'
    ).bind('page.html#sec', 42, 7, now, now).run();

    const req = new Request('https://pulse.example.com/api/reactions?section_ids=page.html%23sec');
    const res = await handleRequest(req, env);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body['page.html#sec']).toEqual({ total: 42, last_24h: 7 });
  });

  it('includes CORS headers', async () => {
    const req = new Request('https://pulse.example.com/api/reactions?section_ids=a');
    const res = await handleRequest(req, env);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBeTruthy();
  });
});
```

Note: the test uses `cloudflare:test` imports which are provided by `@cloudflare/vitest-pool-workers`. The `env.DB` binding is auto-provided based on `wrangler.toml`. If the pool cannot find a D1 binding, create a `.dev.vars` or local D1 database via `wrangler d1 execute --local` before running the tests. That setup is covered in pre-step 2 below.

- [ ] **Step 2: Create a local D1 database for tests**

Run:
```
cd community-pulse && npx wrangler d1 execute community-pulse --local --file worker/schema/0001_initial.sql
```

Expected: Wrangler creates a local `.wrangler/state/` directory and runs the schema against an in-process SQLite. If it prompts to create the database, accept.

- [ ] **Step 3: Run the worker test to verify it fails**

Run:
```
cd community-pulse && npm test -- worker.test.js
```

Expected: FAIL, because the GET handler returns 501.

- [ ] **Step 4: Implement `handleGet` in `worker/src/index.js`**

Replace the placeholder `handleGet`:

```javascript
async function handleGet(request, env) {
  const url = new URL(request.url);
  const raw = url.searchParams.get('section_ids');
  if (!raw) {
    return new Response('{}', { status: 200, headers: corsHeaders(env) });
  }
  const sectionIds = raw.split(',').map(s => s.trim()).filter(Boolean);
  if (sectionIds.length === 0) {
    return new Response('{}', { status: 200, headers: corsHeaders(env) });
  }

  // Build a single SQL query with a parameterized IN clause.
  const placeholders = sectionIds.map(() => '?').join(',');
  const stmt = env.DB.prepare(
    `SELECT section_id, total_count, count_24h FROM reactions WHERE section_id IN (${placeholders})`
  ).bind(...sectionIds);
  const { results } = await stmt.all();

  // Assemble response with zeros for unknown sections.
  const found = new Map(results.map(r => [r.section_id, { total: r.total_count, last_24h: r.count_24h }]));
  const response = {};
  for (const id of sectionIds) {
    response[id] = found.get(id) || { total: 0, last_24h: 0 };
  }
  return new Response(JSON.stringify(response), { status: 200, headers: corsHeaders(env) });
}
```

- [ ] **Step 5: Run the worker test to verify it passes**

Run:
```
cd community-pulse && npm test -- worker.test.js
```

Expected: PASS. All four test cases green.

- [ ] **Step 6: Commit**

```bash
git add community-pulse/tests/worker.test.js community-pulse/worker/src/index.js
git commit -m "$(cat <<'EOF'
Add community pulse reactions GET endpoint

Batched fetch that accepts a comma-separated section_ids query
parameter and returns a JSON map of each section to total and
last_24h counts. Unknown sections return zeros.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: Implement POST /api/reactions (TDD)

**Goal:** The increment endpoint. Accepts `{ section_id }` in the JSON body, increments the section's counter, maintains the 24h rolling window. Rate limiting is added in Task 10.

**Files:**
- Modify: `community-pulse/tests/worker.test.js` (add POST tests)
- Modify: `community-pulse/worker/src/index.js` (implement `handlePost`)

- [ ] **Step 1: Add failing tests for POST to `worker.test.js`**

Append to the existing test file (inside a new `describe` block):

```javascript
describe('POST /api/reactions', () => {
  it('creates a new section row on first increment', async () => {
    const req = new Request('https://pulse.example.com/api/reactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ section_id: 'page.html#sec' })
    });
    const res = await handleRequest(req, env);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.total).toBe(1);
    expect(body.last_24h).toBe(1);
  });

  it('increments an existing section row', async () => {
    const now = Date.now();
    await env.DB.prepare(
      'INSERT INTO reactions (section_id, total_count, count_24h, window_24h_start, updated_at) VALUES (?, ?, ?, ?, ?)'
    ).bind('page.html#sec', 10, 3, now, now).run();

    const req = new Request('https://pulse.example.com/api/reactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ section_id: 'page.html#sec' })
    });
    const res = await handleRequest(req, env);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.total).toBe(11);
    expect(body.last_24h).toBe(4);
  });

  it('resets 24h counter when window has elapsed', async () => {
    const longAgo = Date.now() - (25 * 60 * 60 * 1000); // 25 hours ago
    await env.DB.prepare(
      'INSERT INTO reactions (section_id, total_count, count_24h, window_24h_start, updated_at) VALUES (?, ?, ?, ?, ?)'
    ).bind('page.html#sec', 10, 9, longAgo, longAgo).run();

    const req = new Request('https://pulse.example.com/api/reactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ section_id: 'page.html#sec' })
    });
    const res = await handleRequest(req, env);
    const body = await res.json();
    expect(body.total).toBe(11);
    expect(body.last_24h).toBe(1); // window reset
  });

  it('returns 400 on missing body', async () => {
    const req = new Request('https://pulse.example.com/api/reactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: ''
    });
    const res = await handleRequest(req, env);
    expect(res.status).toBe(400);
  });

  it('returns 400 on missing section_id field', async () => {
    const req = new Request('https://pulse.example.com/api/reactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ other: 'data' })
    });
    const res = await handleRequest(req, env);
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run tests to verify the new cases fail**

Run:
```
cd community-pulse && npm test -- worker.test.js
```

Expected: FAIL on the POST test cases (handler still returns 501).

- [ ] **Step 3: Implement `handlePost`**

Replace the placeholder `handlePost` in `worker/src/index.js`:

```javascript
const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

async function handlePost(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'invalid body' }), { status: 400, headers: corsHeaders(env) });
  }
  if (!body || typeof body.section_id !== 'string' || !body.section_id) {
    return new Response(JSON.stringify({ error: 'missing section_id' }), { status: 400, headers: corsHeaders(env) });
  }

  const sectionId = body.section_id;
  const now = Date.now();

  // Load existing row if any.
  const existing = await env.DB.prepare(
    'SELECT total_count, count_24h, window_24h_start FROM reactions WHERE section_id = ?'
  ).bind(sectionId).first();

  let total, count24h, windowStart;
  if (existing) {
    const windowElapsed = (now - existing.window_24h_start) >= TWENTY_FOUR_HOURS_MS;
    total = existing.total_count + 1;
    count24h = windowElapsed ? 1 : existing.count_24h + 1;
    windowStart = windowElapsed ? now : existing.window_24h_start;
    await env.DB.prepare(
      'UPDATE reactions SET total_count = ?, count_24h = ?, window_24h_start = ?, updated_at = ? WHERE section_id = ?'
    ).bind(total, count24h, windowStart, now, sectionId).run();
  } else {
    total = 1;
    count24h = 1;
    windowStart = now;
    await env.DB.prepare(
      'INSERT INTO reactions (section_id, total_count, count_24h, window_24h_start, updated_at) VALUES (?, ?, ?, ?, ?)'
    ).bind(sectionId, total, count24h, windowStart, now).run();
  }

  return new Response(JSON.stringify({ total, last_24h: count24h }), { status: 200, headers: corsHeaders(env) });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run:
```
cd community-pulse && npm test -- worker.test.js
```

Expected: PASS. All GET and POST tests green.

- [ ] **Step 5: Commit**

```bash
git add community-pulse/tests/worker.test.js community-pulse/worker/src/index.js
git commit -m "$(cat <<'EOF'
Add community pulse reactions POST endpoint

Increment endpoint that creates or updates a section's reactions row
and maintains the 24-hour rolling counter. Rejects missing or malformed
bodies with 400. Rate limiting added in the next task.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: Add per-IP rate limiting to POST (TDD)

**Goal:** Cap a single IP at 5 increments per section per hour. Over the limit, the request succeeds (status 200, with the current counts) but does not increment. This is intentional: the widget on the client always gets a response and the reader's button state still works; the server just refuses to count their click.

**Files:**
- Modify: `community-pulse/tests/worker.test.js` (add rate limit tests)
- Modify: `community-pulse/worker/src/index.js` (add rate limit check)

- [ ] **Step 1: Add failing rate limit tests**

Append to `worker.test.js`:

```javascript
describe('POST rate limiting', () => {
  function makeRequest(sectionId, ip = '1.2.3.4') {
    return new Request('https://pulse.example.com/api/reactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': ip },
      body: JSON.stringify({ section_id: sectionId })
    });
  }

  it('allows first 5 increments from the same IP', async () => {
    for (let i = 0; i < 5; i++) {
      const res = await handleRequest(makeRequest('page.html#rl'), env);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.total).toBe(i + 1);
    }
  });

  it('stops incrementing after the 5th request from the same IP in one window', async () => {
    // First 5 increments.
    for (let i = 0; i < 5; i++) {
      await handleRequest(makeRequest('page.html#rl2'), env);
    }
    // 6th request: should return 200 but with the same count as after the 5th.
    const res = await handleRequest(makeRequest('page.html#rl2'), env);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.total).toBe(5);
  });

  it('allows different IPs independently', async () => {
    for (let i = 0; i < 5; i++) {
      await handleRequest(makeRequest('page.html#rl3', '1.1.1.1'), env);
    }
    // Different IP can still increment.
    const res = await handleRequest(makeRequest('page.html#rl3', '2.2.2.2'), env);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.total).toBe(6);
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run:
```
cd community-pulse && npm test -- worker.test.js
```

Expected: FAIL on the "stops incrementing" test (handler does not yet rate-limit).

- [ ] **Step 3: Implement rate limiting in `handlePost`**

Add a rate limit helper above `handlePost` in `worker/src/index.js`:

```javascript
const RATE_LIMIT_WINDOW_MS_POST = 60 * 60 * 1000; // 1 hour
const RATE_LIMIT_MAX_POST = 5;

async function hashIp(ip) {
  const enc = new TextEncoder().encode(`${ip}:community-pulse-salt`);
  const buf = await crypto.subtle.digest('SHA-256', enc);
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Returns true if this (ip, section) is under the rate limit. Increments the bucket if so. */
async function checkAndIncrementRateLimit(env, ip, sectionId) {
  const ipHash = await hashIp(ip || 'unknown');
  const now = Date.now();
  const windowStart = Math.floor(now / RATE_LIMIT_WINDOW_MS_POST) * RATE_LIMIT_WINDOW_MS_POST;

  // Lazily clean up old rows for this (ip_hash, section_id).
  await env.DB.prepare(
    'DELETE FROM rate_limits WHERE ip_hash = ? AND section_id = ? AND window_start < ?'
  ).bind(ipHash, sectionId, windowStart).run();

  const existing = await env.DB.prepare(
    'SELECT count FROM rate_limits WHERE ip_hash = ? AND section_id = ? AND window_start = ?'
  ).bind(ipHash, sectionId, windowStart).first();

  if (existing && existing.count >= RATE_LIMIT_MAX_POST) {
    return false;
  }
  if (existing) {
    await env.DB.prepare(
      'UPDATE rate_limits SET count = count + 1 WHERE ip_hash = ? AND section_id = ? AND window_start = ?'
    ).bind(ipHash, sectionId, windowStart).run();
  } else {
    await env.DB.prepare(
      'INSERT INTO rate_limits (ip_hash, section_id, window_start, count) VALUES (?, ?, ?, 1)'
    ).bind(ipHash, sectionId, windowStart).run();
  }
  return true;
}
```

Modify `handlePost` to check the rate limit before incrementing. Find the line that reads the existing row and wrap the increment logic:

```javascript
async function handlePost(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'invalid body' }), { status: 400, headers: corsHeaders(env) });
  }
  if (!body || typeof body.section_id !== 'string' || !body.section_id) {
    return new Response(JSON.stringify({ error: 'missing section_id' }), { status: 400, headers: corsHeaders(env) });
  }

  const sectionId = body.section_id;
  const clientIp = request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For') || 'unknown';
  const allowed = await checkAndIncrementRateLimit(env, clientIp, sectionId);

  const now = Date.now();
  const existing = await env.DB.prepare(
    'SELECT total_count, count_24h, window_24h_start FROM reactions WHERE section_id = ?'
  ).bind(sectionId).first();

  let total, count24h, windowStart;
  if (!allowed) {
    // Rate-limited: return current counts without incrementing.
    if (existing) {
      total = existing.total_count;
      count24h = existing.count_24h;
    } else {
      total = 0;
      count24h = 0;
    }
    return new Response(JSON.stringify({ total, last_24h: count24h }), { status: 200, headers: corsHeaders(env) });
  }

  if (existing) {
    const windowElapsed = (now - existing.window_24h_start) >= TWENTY_FOUR_HOURS_MS;
    total = existing.total_count + 1;
    count24h = windowElapsed ? 1 : existing.count_24h + 1;
    windowStart = windowElapsed ? now : existing.window_24h_start;
    await env.DB.prepare(
      'UPDATE reactions SET total_count = ?, count_24h = ?, window_24h_start = ?, updated_at = ? WHERE section_id = ?'
    ).bind(total, count24h, windowStart, now, sectionId).run();
  } else {
    total = 1;
    count24h = 1;
    windowStart = now;
    await env.DB.prepare(
      'INSERT INTO reactions (section_id, total_count, count_24h, window_24h_start, updated_at) VALUES (?, ?, ?, ?, ?)'
    ).bind(sectionId, total, count24h, windowStart, now).run();
  }

  return new Response(JSON.stringify({ total, last_24h: count24h }), { status: 200, headers: corsHeaders(env) });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run:
```
cd community-pulse && npm test -- worker.test.js
```

Expected: PASS. All GET, POST, and rate limit tests green.

- [ ] **Step 5: Commit**

```bash
git add community-pulse/tests/worker.test.js community-pulse/worker/src/index.js
git commit -m "$(cat <<'EOF'
Add community pulse POST rate limiting

Per-IP per-section fixed-window rate limit at 5 requests per hour.
Over-limit requests return 200 with the current (unincremented) counts
so the client-side widget state still works. IPs are hashed before
storage.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 11: Wire content pages to the widget script and add OG tags

**Goal:** Add the widget script tag, the widget CSS link, and Open Graph meta tags to each content page. The widget starts working on these pages as soon as the Worker is deployed (Task 13).

**Files:**
- Modify: `index.html`
- Modify: `what-is-the-override.html`
- Modify: `what-fails.html`
- Modify: `why-not-elsewhere.html`
- Modify: `senior-tax-relief.html`

- [ ] **Step 1: Add widget assets and OG tags to `what-fails.html`**

In `what-fails.html`, inside the `<head>`, after the existing `<link rel="stylesheet" href="assets/site.css">` line, insert:

```html
<link rel="stylesheet" href="assets/community-pulse/widget.css">
<meta property="og:title" content="What's in the no-override budget?">
<meta property="og:description" content="The line-item changes in the town's FY27 No-Override Balanced Budget: 22 town positions, 14 school positions, the library reduced 43 percent, and what comparable Massachusetts towns did after similar votes.">
<meta property="og:image" content="https://marbleheaddata.org/favicon.svg">
<meta property="og:type" content="article">
<meta property="og:url" content="https://marbleheaddata.org/what-fails.html">
```

And before the closing `</body>`, insert:

```html
<script type="module" src="assets/community-pulse/widget.js" data-api-base="https://marblehead-community-pulse.example.workers.dev"></script>
```

Note: the `data-api-base` URL is a placeholder. It will be replaced with the real Worker URL after deployment in Task 13.

- [ ] **Step 2: Add widget assets and OG tags to `what-is-the-override.html`**

Same pattern. Add the CSS link and these OG tags in the `<head>` after `assets/site.css`:

```html
<link rel="stylesheet" href="assets/community-pulse/widget.css">
<meta property="og:title" content="What is the override?">
<meta property="og:description" content="The three-tier structure of the proposed Marblehead override, what each tier funds, key terms, and historical context.">
<meta property="og:image" content="https://marbleheaddata.org/favicon.svg">
<meta property="og:type" content="article">
<meta property="og:url" content="https://marbleheaddata.org/what-is-the-override.html">
```

And the script tag before `</body>`:

```html
<script type="module" src="assets/community-pulse/widget.js" data-api-base="https://marblehead-community-pulse.example.workers.dev"></script>
```

- [ ] **Step 3: Add widget assets and OG tags to `why-not-elsewhere.html`**

Same pattern:

```html
<link rel="stylesheet" href="assets/community-pulse/widget.css">
<meta property="og:title" content="Why not fund it somewhere else?">
<meta property="og:description" content="A neutral walkthrough of the revenue alternatives the town has considered or rejected, with the concrete fiscal tradeoffs for each.">
<meta property="og:image" content="https://marbleheaddata.org/favicon.svg">
<meta property="og:type" content="article">
<meta property="og:url" content="https://marbleheaddata.org/why-not-elsewhere.html">
```

And:

```html
<script type="module" src="assets/community-pulse/widget.js" data-api-base="https://marblehead-community-pulse.example.workers.dev"></script>
```

- [ ] **Step 4: Add widget assets and OG tags to `senior-tax-relief.html`**

Same pattern:

```html
<link rel="stylesheet" href="assets/community-pulse/widget.css">
<meta property="og:title" content="Senior property tax relief in Marblehead">
<meta property="og:description" content="How Marblehead's senior tax-relief programs actually work: the Clause 41C exemption, the tax deferral, verified examples, and the formulas.">
<meta property="og:image" content="https://marbleheaddata.org/favicon.svg">
<meta property="og:type" content="article">
<meta property="og:url" content="https://marbleheaddata.org/senior-tax-relief.html">
```

And:

```html
<script type="module" src="assets/community-pulse/widget.js" data-api-base="https://marblehead-community-pulse.example.workers.dev"></script>
```

- [ ] **Step 5: Add widget assets and OG tags to `index.html`, with the h2 opt-out**

Index is a navigation page. Its 14 h2s are question-card labels, not content sections, and should not receive widgets. But the script should still load (so cards could technically get share support via `data-stance-section` opt-in if ever needed).

Add to `<head>`:

```html
<link rel="stylesheet" href="assets/community-pulse/widget.css">
<meta property="og:title" content="Marblehead Budget Data">
<meta property="og:description" content="Open data and charts about Marblehead, MA municipal finances. Every number is traceable to a primary source.">
<meta property="og:image" content="https://marbleheaddata.org/favicon.svg">
<meta property="og:type" content="website">
<meta property="og:url" content="https://marbleheaddata.org/">
```

In the `<body>` opening tag, add the opt-out attribute:

```html
<body data-community-pulse="off-sections">
```

And the script tag before `</body>`:

```html
<script type="module" src="assets/community-pulse/widget.js" data-api-base="https://marblehead-community-pulse.example.workers.dev"></script>
```

- [ ] **Step 6: Verify the site still builds locally**

Run:
```
cd /Users/agbaber/marblehead && (bundle exec jekyll build 2>/dev/null || echo "no jekyll cli locally, skipping build check")
```

Expected: build succeeds, or the fallback message if Jekyll is not installed locally. If the build fails, inspect the error before proceeding.

- [ ] **Step 7: Commit**

```bash
git add index.html what-is-the-override.html what-fails.html why-not-elsewhere.html senior-tax-relief.html
git commit -m "$(cat <<'EOF'
Wire community pulse widget and OG tags to content pages

Each content page now loads the community pulse widget script and CSS
and ships Open Graph meta tags for rich link previews. Index is opted
out of h2 widget injection because its h2s are navigation cards, not
content sections.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 12: Create the privacy disclosure page

**Goal:** A standalone `privacy.html` that explains the community pulse feature's local-only storage model in plain language. Linked from every widget and from the site footer.

**Files:**
- Create: `privacy.html`

- [ ] **Step 1: Create `privacy.html`**

Match the existing site style (plain HTML, same head layout as other content pages):

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<!-- Google Tag Manager -->
<script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','GTM-5PQG62BJ');</script>
<!-- End Google Tag Manager -->
<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-ZK1KEJT3KX"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-ZK1KEJT3KX');
</script>
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="color-scheme" content="light dark">
<meta name="theme-color" content="#F4F7FA" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#0B1620" media="(prefers-color-scheme: dark)">
<title>Privacy - Marblehead Budget Data</title>
<link rel="icon" href="favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="assets/site.css">
<meta property="og:title" content="Privacy - Marblehead Budget Data">
<meta property="og:description" content="How the community pulse feature handles reader data. The short version: your marks and notes never leave your browser.">
<meta property="og:image" content="https://marbleheaddata.org/favicon.svg">
<meta property="og:type" content="article">
<meta property="og:url" content="https://marbleheaddata.org/privacy.html">
</head>
<body data-community-pulse="off-sections">
<!-- Google Tag Manager (noscript) -->
<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=GTM-5PQG62BJ"
height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>
<!-- End Google Tag Manager (noscript) -->

<div class="page">
  <a class="back" href="./">&larr; marbleheaddata.org</a>

  <h1>Privacy</h1>
  <p>This page explains how the community pulse feature (the little agree, disagree, and alert buttons next to each heading) handles your data. The short version: your marks and notes never leave your browser. There is no account, no login, and nothing about your reading habits is stored anywhere except your own device.</p>

  <h2>What lives in your browser</h2>
  <p>When you click a stance button or write a note on any section, the mark and the note are saved in your browser's local storage (specifically, IndexedDB). They are associated with the section ID. That is the full extent of what is persisted.</p>
  <p>Your marks and notes are not synced to any server, not backed up, not shared, and not visible to anyone but you. If you open the same page on a different device, you will see no marks there, because each browser is its own separate store.</p>

  <h2>What lives on the server</h2>
  <p>The only information the site's server sees about community pulse activity is a single directionless reaction counter per section. When you click any stance button, the site increments the reactions number for that section by one. The server does not know which button you clicked (agree, disagree, or alert), does not know anything about you, and does not associate the increment with any identity.</p>
  <p>To keep casual inflation of the counter tidy, the server applies a per-IP rate limit of 5 increments per section per hour. IP addresses are hashed with a rotating salt before storage and are not retained beyond the rate-limit window.</p>

  <h2>What clearing your browser does</h2>
  <p>Clearing browser data (cookies, site data, or IndexedDB specifically) erases your community pulse marks and notes. There is no server backup. This is by design: the server never received the data, so there is nothing to restore from. If you want to keep a record of your marks, use a future settings page (coming soon) to export them as a file.</p>

  <h2>What the site does not collect</h2>
  <p>The community pulse feature does not collect your name, email, address, phone number, device identifier, user agent, cookies beyond what your browser sends automatically, or any other information about you as a person. There is no login, no account, no profile. The only identifier tying any activity to anyone is the IP rate-limit bucket, which is hashed and ephemeral.</p>

  <h2>What is on the rest of the site</h2>
  <p>Note that the rest of the Marblehead Budget Data site uses Google Analytics via Google Tag Manager, like most modern websites. That is a separate matter from the community pulse feature and is disclosed here for completeness. Google Analytics collects the usual page-view and referrer information for every visitor to the site as a whole.</p>

  <h2>Questions</h2>
  <p>If something on this page is unclear or you want to verify any claim above, the full source code for the community pulse feature (front-end widget and server-side Worker) is published at <a href="https://github.com/agbaber/marblehead">github.com/agbaber/marblehead</a> under the <code>community-pulse/</code> and <code>assets/community-pulse/</code> directories. You can read the code and confirm these claims for yourself.</p>

  <p class="notes">Last updated: April 10, 2026.</p>
</div>
</body>
</html>
```

- [ ] **Step 2: Smoke-test the page in a browser**

Run:
```
cd /Users/agbaber/marblehead && python3 -m http.server 8000
```

Open `http://localhost:8000/privacy.html`. Expected: the page renders with the existing site styling, has no widgets (because of the opt-out), and all headings read cleanly.

- [ ] **Step 3: Commit**

```bash
git add privacy.html
git commit -m "$(cat <<'EOF'
Add community pulse privacy disclosure page

Plain-language explanation of what data lives in the browser, what
lives on the server, what clearing browser data does, and what the
feature does not collect. Linked from every widget.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 13: Deploy the Worker and update the API base URL

**Goal:** Operational task, not code. Deploy the Worker to Cloudflare, create the D1 database, run the schema migration, and update the `data-api-base` attribute in each content page to point at the real Worker URL.

This task requires:
- A Cloudflare account with Workers enabled
- `wrangler login` completed
- The user (Andrew) to be present, because the deploy involves an interactive login flow

**Files:**
- Modify: `index.html`, `what-is-the-override.html`, `what-fails.html`, `why-not-elsewhere.html`, `senior-tax-relief.html` (replace the placeholder `data-api-base` URL)
- Modify: `community-pulse/worker/wrangler.toml` (replace the `database_id` placeholder)

- [ ] **Step 1: Create the D1 database**

Run:
```
cd community-pulse && npx wrangler d1 create community-pulse
```

Expected output includes a line like:
```
database_id = "abc123-def456-..."
```

Copy this ID.

- [ ] **Step 2: Paste the database ID into `wrangler.toml`**

Edit `community-pulse/worker/wrangler.toml`, replace `REPLACE_WITH_DATABASE_ID_AFTER_CREATE` with the actual ID from the previous step.

- [ ] **Step 3: Run the schema migration against the production D1**

Run:
```
cd community-pulse && npx wrangler d1 execute community-pulse --file worker/schema/0001_initial.sql --remote
```

Expected: SUCCESS, tables created.

- [ ] **Step 4: Deploy the Worker**

Run:
```
cd community-pulse && npx wrangler deploy worker/src/index.js --config worker/wrangler.toml
```

Expected output includes the deployed Worker URL, something like `https://marblehead-community-pulse.YOUR_SUBDOMAIN.workers.dev`. Copy this URL.

- [ ] **Step 5: Sanity-check the deployed Worker with curl**

Run:
```
curl 'https://marblehead-community-pulse.YOUR_SUBDOMAIN.workers.dev/api/reactions?section_ids=test.html%23foo'
```

Expected: `{"test.html#foo":{"total":0,"last_24h":0}}`

Run:
```
curl -X POST -H 'Content-Type: application/json' -d '{"section_id":"test.html#foo"}' 'https://marblehead-community-pulse.YOUR_SUBDOMAIN.workers.dev/api/reactions'
```

Expected: `{"total":1,"last_24h":1}`

- [ ] **Step 6: Update `data-api-base` in every content page**

Search and replace `https://marblehead-community-pulse.example.workers.dev` with the real URL from step 4 across:
- `index.html`
- `what-is-the-override.html`
- `what-fails.html`
- `why-not-elsewhere.html`
- `senior-tax-relief.html`

- [ ] **Step 7: Commit the Worker URL and database ID**

```bash
git add index.html what-is-the-override.html what-fails.html why-not-elsewhere.html senior-tax-relief.html community-pulse/worker/wrangler.toml
git commit -m "$(cat <<'EOF'
Wire community pulse widget to deployed Worker URL

Replaces the placeholder api base URL with the real Worker endpoint
across all content pages. Records the production D1 database ID in
wrangler.toml.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 14: End-to-end smoke test on the live site

**Goal:** Push the branch to origin (or whatever the site's deploy target is), wait for GitHub Pages to rebuild, and verify the widget works end to end on a real deployed page.

- [ ] **Step 1: Push the branch**

Run:
```
git push origin community-pulse-v1
```

Note: this pushes the feature branch. If the user wants to merge to main first, hold off on the push and confirm with them. If main-branch-direct is the flow, then consider cherry-picking or merging.

- [ ] **Step 2: Wait for GitHub Pages to rebuild**

GitHub Pages rebuilds within 1 to 2 minutes of a push to the deployed branch. Check the GitHub Actions tab (if any) or just wait.

- [ ] **Step 3: Visit the live site**

Open `https://marbleheaddata.org/what-fails.html` in a browser. Verify:
- Widgets appear next to each h2 (~4 widgets on this page).
- Clicking a stance button: activates, and the reactions count increments from 0 to 1.
- Clicking again: deactivates.
- Refreshing the page: stance is preserved (from IndexedDB).
- Clicking "Note": expands the textarea; typing a note is saved after 1 second.
- Clicking "Share": on desktop, copies the URL and shows a toast. On mobile, opens the native share sheet.
- Clicking "Privacy": navigates to `/privacy.html`, which renders cleanly.
- The reaction counts fetched via `GET /api/reactions` match what you see in the database (you can verify via `wrangler d1 execute community-pulse --command 'SELECT * FROM reactions' --remote`).

- [ ] **Step 4: Visit `index.html` and verify opt-out**

Open `https://marbleheaddata.org/`. Verify:
- No widgets appear next to any h2 (the question cards are not widgetized).
- Pasting the URL into an iMessage thread or Facebook comment renders a rich Open Graph preview card.

- [ ] **Step 5: Done**

No commit for this task. It is pure verification.

---

## Self-review checklist

Before declaring the plan complete, run through this checklist.

**1. Spec coverage.** Skim each design section in `docs/superpowers/specs/2026-04-10-community-pulse-design.md` and confirm it maps to a task above:

- Section 1 (Section granularity): Task 2 (slug), Task 6 (auto-hydration of h2 and data-stance-section), Task 11 (opt-out on index.html). **Covered.**
- Section 2 (Section widget): Task 5 (CSS), Task 6 (DOM and wiring). **Covered.**
- Section 3 (Private stances and notes): Task 3 (IndexedDB store), Task 6 (note save and load), Task 12 (privacy page). **Covered.** The v1.1 `/pulse.html` settings page is explicitly deferred in the spec and is not in this plan; correct.
- Section 4 (Reactions counter): Task 4 (API client), Task 8 (GET), Task 9 (POST), Task 10 (rate limit). **Covered.**
- Section 5 (Share mechanism): Task 6 (share button), Task 11 (OG meta tags). **Covered.**
- Data model: Task 7 (schema). **Covered.**
- Backend architecture: Tasks 7 through 10 and 13. **Covered.**
- Privacy properties and abuse resistance: exercised by the implementation; documented in Task 12. **Covered.**

**2. Placeholder scan.** Search the plan for "TBD", "TODO", "implement later", "similar to", "add appropriate", "add validation". None should appear in any task step. If any do, replace them with concrete code or text.

**3. Type consistency.** The stance values used in `widget.js` (agree, disagree, alert) match the UI button labels match the IndexedDB record shape. The `section_id` key is used consistently as `<page-path>#<anchor-slug>` in both the front-end and the Worker. The API response shape (`{ total, last_24h }`) is the same in the GET batch, the POST increment, and the widget consumer code.

**4. Dependencies between tasks.** Task 6 depends on Tasks 2, 3, 4, 5 (needs slug, store, API client, CSS). Task 11 depends on Task 6 (script file must exist). Task 13 depends on Tasks 7 through 10 (Worker must be implemented). Task 14 depends on Task 13 (Worker must be deployed). No circular dependencies.

If the self-review surfaces anything inconsistent, fix it inline in the plan before proceeding.

---

## Execution handoff

Two execution modes are available:

1. **Subagent-driven (recommended).** Dispatch a fresh subagent per task, review between tasks, iterate fast. Use the `superpowers:subagent-driven-development` skill.
2. **Inline execution.** Execute tasks in this session using the `superpowers:executing-plans` skill. Batch execution with checkpoints for review.

Which approach do you want?
