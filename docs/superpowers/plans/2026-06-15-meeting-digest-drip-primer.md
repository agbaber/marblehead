# Meeting digest drip primer — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Layer a per-subscriber primer drip onto the existing Monday digest. New subscribers receive primer card 1 on their first eligible digest; each subsequent eligible digest carries the next primer until the sequence is exhausted.

**Architecture:** New `_primers/` Jekyll collection (Worker reads at runtime via GitHub Contents API, same pattern as `_transcripts/`). New `subscriber.drip_week_index` column tracks how many primers a subscriber has received. Render appends a card below the meeting cards. Drip rides only on weeks the digest actually sends.

**Tech Stack:** Cloudflare Workers, D1 (SQLite), vitest with `@cloudflare/vitest-pool-workers`, Jekyll collection (no build output).

**Spec:** `docs/superpowers/specs/2026-06-15-meeting-digest-drip-primer-design.md`

**Working directory throughout this plan:** `/home/claude/marblehead/.worktrees/digest-drip-primer/`

---

## File map

| Path | Action | Responsibility |
|---|---|---|
| `meeting-digest/worker/schema/0002_drip_week_index.sql` | Create | D1 migration adding `drip_week_index` column. |
| `meeting-digest/worker/src/lib/primer.js` | Create | Parse, fetch, and pick primer markdown files. |
| `meeting-digest/worker/src/lib/render.js` | Modify | Accept optional `primer` arg; render primer card and add `withPrimerUtm` helper. |
| `meeting-digest/worker/src/scheduled.js` | Modify | Fetch primers per cron, pick per subscriber, bump `drip_week_index` on success. |
| `meeting-digest/tests/primer.test.js` | Create | Unit tests for parsing, fetching, picking primers. |
| `meeting-digest/tests/render.test.js` | Modify | Primer card render assertions. |
| `meeting-digest/tests/worker.test.js` | Modify | Add MIGRATION_0002; new `runScheduled` scenarios for drip flow. |
| `_config.yml` | Modify | Register `primers` collection with `output: false`. |
| `_primers/01-welcome.md` | Create | Welcome primer (week 1) — copy TBD with Andrew. |

Each task below is self-contained: write the failing test, run it, implement, run again, commit.

---

## Task 1: Schema migration

**Files:**
- Create: `meeting-digest/worker/schema/0002_drip_week_index.sql`
- Modify: `meeting-digest/tests/worker.test.js` (top-of-file migration block)

- [ ] **Step 1: Create the migration file**

Path: `meeting-digest/worker/schema/0002_drip_week_index.sql`

```sql
-- Adds drip_week_index counter to subscriber.
-- Semantics: count of primer cards already delivered to this subscriber.
-- 0 = no primer sent yet. Incremented atomically with a successful digest send
-- that included a primer card.

ALTER TABLE subscriber ADD COLUMN drip_week_index INTEGER NOT NULL DEFAULT 0;
```

- [ ] **Step 2: Register the migration in worker.test.js**

In `meeting-digest/tests/worker.test.js`, just below the existing `const MIGRATION_0001 = { ... }`, add:

```javascript
const MIGRATION_0002 = {
  name: '0002_drip_week_index',
  queries: [
    `ALTER TABLE subscriber ADD COLUMN drip_week_index INTEGER NOT NULL DEFAULT 0`
  ]
};
```

Then in the `beforeEach`, change:

```javascript
await applyD1Migrations(env.DB, [MIGRATION_0001]);
```

to:

```javascript
await applyD1Migrations(env.DB, [MIGRATION_0001, MIGRATION_0002]);
```

- [ ] **Step 3: Run the existing suite — should still pass**

```bash
cd /home/claude/marblehead/.worktrees/digest-drip-primer/meeting-digest
npm test
```

Expected: 55 passing, 0 failing. (No code reads or writes `drip_week_index` yet, so the new column is silent.)

- [ ] **Step 4: Commit**

```bash
cd /home/claude/marblehead/.worktrees/digest-drip-primer
git add meeting-digest/worker/schema/0002_drip_week_index.sql meeting-digest/tests/worker.test.js
git commit -m "digest: 0002 migration adds drip_week_index column"
```

---

## Task 2: Primer markdown parser

**Files:**
- Create: `meeting-digest/worker/src/lib/primer.js`
- Create: `meeting-digest/tests/primer.test.js`

- [ ] **Step 1: Write failing tests for `parsePrimer`**

Path: `meeting-digest/tests/primer.test.js`

```javascript
// meeting-digest/tests/primer.test.js
import { describe, it, expect } from 'vitest';
import { parsePrimer } from '../worker/src/lib/primer.js';

describe('parsePrimer', () => {
  it('parses a valid primer markdown into a primer object', () => {
    const md = `---
week_index: 1
title: "What this site is"
link_url: /about/
link_label: "About marbleheaddata.org"
---
First paragraph of body copy.

Second paragraph of body copy.
`;
    const p = parsePrimer('01-welcome.md', md);
    expect(p).toEqual({
      filename: '01-welcome.md',
      week_index: 1,
      title: 'What this site is',
      link_url: '/about/',
      link_label: 'About marbleheaddata.org',
      body_paragraphs: [
        'First paragraph of body copy.',
        'Second paragraph of body copy.'
      ]
    });
  });

  it('returns null when frontmatter is missing entirely', () => {
    expect(parsePrimer('bad.md', 'no frontmatter here')).toBeNull();
  });

  it('returns null when week_index is missing', () => {
    const md = `---
title: "x"
link_url: /a/
link_label: "b"
---
body
`;
    expect(parsePrimer('bad.md', md)).toBeNull();
  });

  it('returns null when week_index is non-numeric', () => {
    const md = `---
week_index: not-a-number
title: "x"
link_url: /a/
link_label: "b"
---
body
`;
    expect(parsePrimer('bad.md', md)).toBeNull();
  });

  it('returns null when any required string field is missing', () => {
    const md = `---
week_index: 2
title: "x"
link_url: /a/
---
body
`;
    expect(parsePrimer('bad.md', md)).toBeNull();
  });

  it('treats a single-paragraph body as one entry', () => {
    const md = `---
week_index: 3
title: "x"
link_url: /a/
link_label: "b"
---
Only one paragraph here.
`;
    const p = parsePrimer('03-x.md', md);
    expect(p.body_paragraphs).toEqual(['Only one paragraph here.']);
  });

  it('preserves body text verbatim (no HTML escaping at parse time)', () => {
    const md = `---
week_index: 4
title: "x"
link_url: /a/
link_label: "b"
---
Text with <angle> and & ampersand.
`;
    const p = parsePrimer('04-x.md', md);
    expect(p.body_paragraphs[0]).toBe('Text with <angle> and & ampersand.');
  });
});
```

- [ ] **Step 2: Run the test, expect failures**

```bash
cd /home/claude/marblehead/.worktrees/digest-drip-primer/meeting-digest
npx vitest run tests/primer.test.js
```

Expected: All 7 tests fail because `primer.js` doesn't exist.

- [ ] **Step 3: Implement `parsePrimer`**

Path: `meeting-digest/worker/src/lib/primer.js`

```javascript
// meeting-digest/worker/src/lib/primer.js
//
// Reads _primers/NN-slug.md from the marblehead Jekyll repo and turns each
// into a structured primer object the Worker can render into the digest.
//
// File contract (see spec docs/superpowers/specs/2026-06-15-...):
//   ---
//   week_index: 1                       (required integer)
//   title: "..."                        (required string)
//   link_url: /about/                   (required string)
//   link_label: "..."                   (required string)
//   ---
//   Body paragraph 1.
//
//   Body paragraph 2.
//
// Anything malformed returns null and the caller logs + skips.

function frontmatterAndBody(text) {
  if (typeof text !== 'string') return null;
  const m = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) return null;
  return { yaml: m[1], body: m[2] };
}

function scalar(yaml, key) {
  const re = new RegExp(`^${key}: (.+)$`, 'm');
  const m = yaml.match(re);
  if (!m) return undefined;
  return m[1].trim().replace(/^["']|["']$/g, '');
}

export function parsePrimer(filename, text) {
  const fb = frontmatterAndBody(text);
  if (!fb) return null;
  const { yaml, body } = fb;

  const rawWeekIndex = scalar(yaml, 'week_index');
  const title = scalar(yaml, 'title');
  const link_url = scalar(yaml, 'link_url');
  const link_label = scalar(yaml, 'link_label');
  if (rawWeekIndex === undefined || !title || !link_url || !link_label) return null;
  const week_index = Number.parseInt(rawWeekIndex, 10);
  if (!Number.isFinite(week_index) || week_index < 1) return null;

  const body_paragraphs = body
    .split(/\n{2,}/)
    .map(p => p.trim())
    .filter(p => p.length > 0);

  return { filename, week_index, title, link_url, link_label, body_paragraphs };
}
```

- [ ] **Step 4: Run the tests, expect pass**

```bash
npx vitest run tests/primer.test.js
```

Expected: 7 passing.

- [ ] **Step 5: Commit**

```bash
cd /home/claude/marblehead/.worktrees/digest-drip-primer
git add meeting-digest/worker/src/lib/primer.js meeting-digest/tests/primer.test.js
git commit -m "digest: parsePrimer for _primers/NN-slug.md files"
```

---

## Task 3: Fetch primers from GitHub

**Files:**
- Modify: `meeting-digest/worker/src/lib/primer.js`
- Modify: `meeting-digest/tests/primer.test.js`

- [ ] **Step 1: Write failing tests for `fetchPrimers`**

Append to `meeting-digest/tests/primer.test.js`:

```javascript
import { fetchPrimers } from '../worker/src/lib/primer.js';
import { fetchMock } from 'cloudflare:test';

const ENV = { GITHUB_REPO: 'agbaber/marblehead', GITHUB_BRANCH: 'main' };

function primerMd(weekIndex, title) {
  return `---
week_index: ${weekIndex}
title: "${title}"
link_url: /x/
link_label: "Read"
---
Body for ${title}.
`;
}

describe('fetchPrimers', () => {
  beforeEach(() => {
    fetchMock.activate();
    fetchMock.disableNetConnect();
  });

  it('returns an empty array when the directory is empty', async () => {
    fetchMock.get('https://api.github.com')
      .intercept({ path: /\/repos\/agbaber\/marblehead\/contents\/_primers\?ref=main/, method: 'GET' })
      .reply(200, JSON.stringify([]));
    const out = await fetchPrimers(ENV);
    expect(out).toEqual([]);
  });

  it('parses files and sorts by week_index ascending', async () => {
    fetchMock.get('https://api.github.com')
      .intercept({ path: /\/repos\/agbaber\/marblehead\/contents\/_primers\?ref=main/, method: 'GET' })
      .reply(200, JSON.stringify([
        { type: 'file', name: '03-debt.md',    download_url: 'https://example.com/p3.md' },
        { type: 'file', name: '01-welcome.md', download_url: 'https://example.com/p1.md' },
        { type: 'file', name: '02-org.md',     download_url: 'https://example.com/p2.md' }
      ]));
    fetchMock.get('https://example.com')
      .intercept({ path: '/p1.md', method: 'GET' }).reply(200, primerMd(1, 'Welcome'));
    fetchMock.get('https://example.com')
      .intercept({ path: '/p2.md', method: 'GET' }).reply(200, primerMd(2, 'Org chart'));
    fetchMock.get('https://example.com')
      .intercept({ path: '/p3.md', method: 'GET' }).reply(200, primerMd(3, 'Debt'));

    const out = await fetchPrimers(ENV);
    expect(out.map(p => p.week_index)).toEqual([1, 2, 3]);
    expect(out[0].title).toBe('Welcome');
  });

  it('skips files that fail to parse', async () => {
    fetchMock.get('https://api.github.com')
      .intercept({ path: /\/repos\/agbaber\/marblehead\/contents\/_primers\?ref=main/, method: 'GET' })
      .reply(200, JSON.stringify([
        { type: 'file', name: '01-welcome.md', download_url: 'https://example.com/p1.md' },
        { type: 'file', name: '02-bad.md',     download_url: 'https://example.com/p2.md' }
      ]));
    fetchMock.get('https://example.com')
      .intercept({ path: '/p1.md', method: 'GET' }).reply(200, primerMd(1, 'Welcome'));
    fetchMock.get('https://example.com')
      .intercept({ path: '/p2.md', method: 'GET' }).reply(200, 'no frontmatter');

    const out = await fetchPrimers(ENV);
    expect(out.length).toBe(1);
    expect(out[0].week_index).toBe(1);
  });

  it('throws when the directory listing fails (caller decides retry)', async () => {
    fetchMock.get('https://api.github.com')
      .intercept({ path: /\/repos\/agbaber\/marblehead\/contents\/_primers\?ref=main/, method: 'GET' })
      .reply(404, '');
    await expect(fetchPrimers(ENV)).rejects.toThrow(/_primers listing failed: 404/);
  });

  it('ignores non-markdown files in the directory', async () => {
    fetchMock.get('https://api.github.com')
      .intercept({ path: /\/repos\/agbaber\/marblehead\/contents\/_primers\?ref=main/, method: 'GET' })
      .reply(200, JSON.stringify([
        { type: 'file', name: '01-welcome.md', download_url: 'https://example.com/p1.md' },
        { type: 'file', name: 'README.txt',    download_url: 'https://example.com/r.txt' },
        { type: 'dir',  name: 'archived',      download_url: null }
      ]));
    fetchMock.get('https://example.com')
      .intercept({ path: '/p1.md', method: 'GET' }).reply(200, primerMd(1, 'Welcome'));

    const out = await fetchPrimers(ENV);
    expect(out.length).toBe(1);
  });

  it('when two files share a week_index, alphabetically-first filename wins', async () => {
    fetchMock.get('https://api.github.com')
      .intercept({ path: /\/repos\/agbaber\/marblehead\/contents\/_primers\?ref=main/, method: 'GET' })
      .reply(200, JSON.stringify([
        { type: 'file', name: '01-welcome.md', download_url: 'https://example.com/pw.md' },
        { type: 'file', name: '01-alt.md',     download_url: 'https://example.com/pa.md' }
      ]));
    fetchMock.get('https://example.com')
      .intercept({ path: '/pw.md', method: 'GET' }).reply(200, primerMd(1, 'Welcome'));
    fetchMock.get('https://example.com')
      .intercept({ path: '/pa.md', method: 'GET' }).reply(200, primerMd(1, 'Alt'));

    const out = await fetchPrimers(ENV);
    expect(out.length).toBe(1);
    expect(out[0].title).toBe('Alt');
    expect(out[0].filename).toBe('01-alt.md');
  });
});
```

Note: `beforeEach` is already imported at the top of the file from the vitest import you added in Task 2. If not, prepend:

```javascript
import { beforeEach } from 'vitest';
```

- [ ] **Step 2: Run, expect failures**

```bash
npx vitest run tests/primer.test.js
```

Expected: The 6 `fetchPrimers` tests fail with "fetchPrimers is not a function" or similar.

- [ ] **Step 3: Implement `fetchPrimers`**

Append to `meeting-digest/worker/src/lib/primer.js`:

```javascript
export async function fetchPrimers(env) {
  const dirUrl = `https://api.github.com/repos/${env.GITHUB_REPO}/contents/_primers?ref=${env.GITHUB_BRANCH}`;
  const dirResp = await fetch(dirUrl, {
    headers: { 'Accept': 'application/vnd.github.v3+json', 'User-Agent': 'marblehead-meeting-digest' }
  });
  if (!dirResp.ok) {
    throw new Error(`_primers listing failed: ${dirResp.status}`);
  }
  const entries = await dirResp.json();
  const candidates = entries
    .filter(e => e.type === 'file' && e.name.endsWith('.md'))
    .sort((a, b) => a.name.localeCompare(b.name));

  const parsed = [];
  for (const e of candidates) {
    let fileResp;
    try {
      fileResp = await fetch(e.download_url, { headers: { 'User-Agent': 'marblehead-meeting-digest' } });
    } catch {
      console.log(`[digest] _primers fetch error: ${e.name}`);
      continue;
    }
    if (!fileResp.ok) {
      console.log(`[digest] _primers fetch ${e.name}: ${fileResp.status}`);
      continue;
    }
    const text = await fileResp.text();
    const p = parsePrimer(e.name, text);
    if (!p) {
      console.log(`[digest] _primers parse failure: ${e.name}`);
      continue;
    }
    parsed.push(p);
  }

  // Sort by week_index, with alphabetical filename order as the tiebreaker.
  // The candidates list is already in filename order, so a stable sort here
  // means dups land in the right order before dedupe.
  parsed.sort((a, b) => a.week_index - b.week_index);

  // Dedupe by week_index — alphabetically-first filename wins.
  const seen = new Set();
  const out = [];
  for (const p of parsed) {
    if (seen.has(p.week_index)) {
      console.log(`[digest] _primers duplicate week_index ${p.week_index}: ignoring ${p.filename}`);
      continue;
    }
    seen.add(p.week_index);
    out.push(p);
  }
  return out;
}
```

- [ ] **Step 4: Run tests, expect pass**

```bash
npx vitest run tests/primer.test.js
```

Expected: 13 passing (7 from Task 2 + 6 new).

- [ ] **Step 5: Commit**

```bash
cd /home/claude/marblehead/.worktrees/digest-drip-primer
git add meeting-digest/worker/src/lib/primer.js meeting-digest/tests/primer.test.js
git commit -m "digest: fetchPrimers reads _primers/ from GitHub like _transcripts/"
```

---

## Task 4: Primer selection helper

**Files:**
- Modify: `meeting-digest/worker/src/lib/primer.js`
- Modify: `meeting-digest/tests/primer.test.js`

- [ ] **Step 1: Write failing tests for `pickPrimer`**

Append to `tests/primer.test.js`:

```javascript
import { pickPrimer } from '../worker/src/lib/primer.js';

describe('pickPrimer', () => {
  const primers = [
    { week_index: 1, title: 'A' },
    { week_index: 2, title: 'B' },
    { week_index: 3, title: 'C' }
  ];

  it('returns primer week 1 when dripWeekIndex is 0', () => {
    expect(pickPrimer(primers, 0)?.title).toBe('A');
  });
  it('returns primer week 2 when dripWeekIndex is 1', () => {
    expect(pickPrimer(primers, 1)?.title).toBe('B');
  });
  it('returns null when the next index does not exist', () => {
    expect(pickPrimer(primers, 3)).toBeNull();
  });
  it('returns null when the primer list is empty', () => {
    expect(pickPrimer([], 0)).toBeNull();
  });
  it('tolerates non-contiguous week_index values', () => {
    const sparse = [{ week_index: 1, title: 'A' }, { week_index: 3, title: 'C' }];
    expect(pickPrimer(sparse, 0)?.title).toBe('A');
    expect(pickPrimer(sparse, 1)).toBeNull();   // looking for week 2 — not present
    expect(pickPrimer(sparse, 2)?.title).toBe('C');
  });
});
```

- [ ] **Step 2: Run, expect failures**

```bash
npx vitest run tests/primer.test.js
```

Expected: 5 new failures.

- [ ] **Step 3: Implement `pickPrimer`**

Append to `meeting-digest/worker/src/lib/primer.js`:

```javascript
export function pickPrimer(primers, dripWeekIndex) {
  const target = dripWeekIndex + 1;
  return primers.find(p => p.week_index === target) || null;
}
```

- [ ] **Step 4: Run tests, expect pass**

```bash
npx vitest run tests/primer.test.js
```

Expected: 18 passing.

- [ ] **Step 5: Commit**

```bash
cd /home/claude/marblehead/.worktrees/digest-drip-primer
git add meeting-digest/worker/src/lib/primer.js meeting-digest/tests/primer.test.js
git commit -m "digest: pickPrimer selects next primer for drip_week_index"
```

---

## Task 5: Render primer card in email

**Files:**
- Modify: `meeting-digest/worker/src/lib/render.js`
- Modify: `meeting-digest/tests/render.test.js`

- [ ] **Step 1: Write failing tests for primer rendering**

In `meeting-digest/tests/render.test.js`, the existing top of file defines `SB_MATCH`, `SUB`, `ENV`. Add a primer constant and a `describe` block. Place after the existing `describe('renderHtml', ...)` block (or wherever `renderHtml` is currently exercised):

```javascript
const PRIMER_1 = {
  filename: '01-welcome.md',
  week_index: 1,
  title: 'What this site is',
  link_url: '/about/',
  link_label: 'About marbleheaddata.org',
  body_paragraphs: ['First para.', 'Second para.']
};

describe('renderHtml with primer', () => {
  it('omits the primer card when primer is null', () => {
    const html = renderHtml([SB_MATCH], SUB, ENV, '2026-06-15', null, 0);
    expect(html).not.toMatch(/Site primer/);
  });

  it('renders the primer card when primer is provided', () => {
    const html = renderHtml([SB_MATCH], SUB, ENV, '2026-06-15', PRIMER_1, 4);
    expect(html).toContain('Site primer · 1 of 4');
    expect(html).toContain('What this site is');
    expect(html).toContain('First para.');
    expect(html).toContain('Second para.');
    expect(html).toContain('About marbleheaddata.org');
  });

  it('UTM-tags the primer link with per-week campaign', () => {
    const html = renderHtml([SB_MATCH], SUB, ENV, '2026-06-15', PRIMER_1, 4);
    expect(html).toMatch(/href="https:\/\/marbleheaddata\.org\/about\/\?utm_source=digest&utm_medium=email&utm_campaign=primer-week-1"/);
  });

  it('HTML-escapes primer body content', () => {
    const angry = { ...PRIMER_1, body_paragraphs: ['<script>alert(1)</script>'] };
    const html = renderHtml([SB_MATCH], SUB, ENV, '2026-06-15', angry, 4);
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).not.toContain('<script>alert(1)</script>');
  });

  it('renders primer total of N when maxPrimerIndex is N', () => {
    const html = renderHtml([SB_MATCH], SUB, ENV, '2026-06-15', PRIMER_1, 7);
    expect(html).toContain('Site primer · 1 of 7');
  });
});

describe('renderText with primer', () => {
  it('omits the primer block when primer is null', () => {
    const text = renderText([SB_MATCH], SUB, ENV, '2026-06-15', null, 0);
    expect(text).not.toMatch(/SITE PRIMER/);
  });

  it('appends the primer block with a separator when primer is provided', () => {
    const text = renderText([SB_MATCH], SUB, ENV, '2026-06-15', PRIMER_1, 4);
    expect(text).toMatch(/\n---\n\nSITE PRIMER · 1 of 4\n/);
    expect(text).toContain('What this site is');
    expect(text).toContain('First para.');
    expect(text).toContain('Second para.');
    expect(text).toMatch(/About marbleheaddata\.org: https:\/\/marbleheaddata\.org\/about\/\?utm_source=digest&utm_medium=email&utm_campaign=primer-week-1/);
  });
});
```

No existing `renderHtml`/`renderText` test calls need updating — both new args default to `null` and `0`, so existing call sites continue to compile and pass unchanged.

- [ ] **Step 2: Run, expect failures**

```bash
npx vitest run tests/render.test.js
```

Expected: New primer-related tests fail (function signature doesn't accept the args, or output doesn't contain the strings).

- [ ] **Step 3: Add `withPrimerUtm` and primer rendering in `render.js`**

In `meeting-digest/worker/src/lib/render.js`, just below the existing `withUtm` helper, add:

```javascript
function withPrimerUtm(url, weekIndex, env) {
  const PRIMER_QUERY = `utm_source=digest&utm_medium=email&utm_campaign=primer-week-${weekIndex}`;
  // Primer link_url may be a path (/about/) or full URL. Resolve against SITE_BASE_URL.
  const absolute = url.startsWith('http') ? url : `${env.SITE_BASE_URL}${url}`;
  return absolute.includes('?') ? `${absolute}&${PRIMER_QUERY}` : `${absolute}?${PRIMER_QUERY}`;
}

function primerHtml(primer, maxPrimerIndex, env) {
  const linkUrl = withPrimerUtm(primer.link_url, primer.week_index, env);
  const bodyHtml = primer.body_paragraphs.map(p =>
    `<p class="mhd-body" style="margin: 0 0 12px; color: #2a3036; line-height: 1.55;">${escapeHtml(p)}</p>`
  ).join('');
  return `
  <hr class="mhd-hr" style="border: 0; border-top: 1px solid #e3e8ee; margin: 8px 0 24px;">
  <div style="margin: 0 0 8px;">
    <p class="mhd-muted" style="margin: 0 0 6px; font-size: 13px; color: #6c757d;">Site primer · ${primer.week_index} of ${maxPrimerIndex}</p>
    <h2 style="margin: 0 0 10px; font-size: 19px; line-height: 1.3; color: #1a1a1a; font-weight: 600;">${escapeHtml(primer.title)}</h2>
    ${bodyHtml}
    <p style="margin: 0; font-size: 14px;"><a class="mhd-link" href="${linkUrl}" style="color: #1B3A57; text-decoration: none; font-weight: 500;">${escapeHtml(primer.link_label)} &rarr;</a></p>
  </div>`;
}

function primerText(primer, maxPrimerIndex, env) {
  const linkUrl = withPrimerUtm(primer.link_url, primer.week_index, env);
  const body = primer.body_paragraphs.join('\n\n');
  // Returns a block that begins with `---\n\n` and ends with `\n\n` so the
  // existing renderText footer's `---` separator stays one blank line below.
  return `---\n\nSITE PRIMER · ${primer.week_index} of ${maxPrimerIndex}\n\n${primer.title}\n\n${body}\n\n${primer.link_label}: ${linkUrl}\n\n`;
}
```

Then modify the existing `renderHtml` signature and body. Change:

```javascript
export function renderHtml(matches, subscriber, env, weekEndingIso) {
```

to:

```javascript
export function renderHtml(matches, subscriber, env, weekEndingIso, primer = null, maxPrimerIndex = 0) {
```

In the `emailShell({ body: ... })` template literal, find the line that joins meeting cards (something like `${matches.map(m => meetingHtml(m, env)).join('')}`) and append the primer block right after it:

```javascript
${matches.map(m => meetingHtml(m, env)).join('')}
${primer ? primerHtml(primer, maxPrimerIndex, env) : ''}
```

For `renderText`, change the signature to:

```javascript
export function renderText(matches, subscriber, env, weekEndingIso, primer = null, maxPrimerIndex = 0) {
```

Then find this section of the existing template literal:

```javascript
${body}

---
Manage subscription: ${manageUrl}
```

Replace with:

```javascript
${body}

${primer ? primerText(primer, maxPrimerIndex, env) : ''}---
Manage subscription: ${manageUrl}
```

(Note: when `primer` is null, the output is unchanged — `${body}\n\n---\nManage subscription:...` exactly as before. When primer is present, `primerText` ends with `\n\n` so the existing `---` separator lands one blank line below the primer block.)

Check that `escapeHtml` is already in the file (it is — used by `meetingHtml`).

- [ ] **Step 4: Run tests, expect pass**

```bash
npx vitest run tests/render.test.js
```

Expected: All render tests passing (existing + new).

- [ ] **Step 5: Run the full suite to make sure nothing else broke**

```bash
npm test
```

Expected: all passing.

- [ ] **Step 6: Commit**

```bash
cd /home/claude/marblehead/.worktrees/digest-drip-primer
git add meeting-digest/worker/src/lib/render.js meeting-digest/tests/render.test.js
git commit -m "digest: render primer card below meeting cards (HTML + text)"
```

---

## Task 6: Wire `scheduled.js` to fetch, pick, and increment

**Files:**
- Modify: `meeting-digest/worker/src/scheduled.js`
- Modify: `meeting-digest/tests/worker.test.js`

- [ ] **Step 1: Write failing tests for the drip flow**

In `meeting-digest/tests/worker.test.js`, locate the `describe('runScheduled', ...)` block (around line 248). Add a helper at the top of the file (near the existing `confirmedSubscriber` if defined, else just add it next to the helpers used in this block):

```javascript
function primersDirResponse(filenames) {
  return JSON.stringify(filenames.map(name => ({
    type: 'file', name, download_url: `https://example.com/primers/${name}`
  })));
}

function primerMdFile(weekIndex, title) {
  return `---
week_index: ${weekIndex}
title: "${title}"
link_url: /p${weekIndex}/
link_label: "Read"
---
Body for ${title}.
`;
}

function stubGithubPrimers(filenames, weekTitlePairs) {
  fetchMock.get('https://api.github.com')
    .intercept({ path: /\/repos\/.*\/contents\/_primers\?ref=.*/, method: 'GET' })
    .reply(200, primersDirResponse(filenames));
  for (const [name, [w, t]] of weekTitlePairs) {
    fetchMock.get('https://example.com')
      .intercept({ path: `/primers/${name}`, method: 'GET' })
      .reply(200, primerMdFile(w, t));
  }
}

function stubGithubPrimersEmpty() {
  fetchMock.get('https://api.github.com')
    .intercept({ path: /\/repos\/.*\/contents\/_primers\?ref=.*/, method: 'GET' })
    .reply(200, '[]');
}

function stubGithubPrimersFail() {
  fetchMock.get('https://api.github.com')
    .intercept({ path: /\/repos\/.*\/contents\/_primers\?ref=.*/, method: 'GET' })
    .reply(500, '');
}
```

Existing tests already stub `_transcripts`; they will need a parallel `_primers` stub. The simplest fix is to call `stubGithubPrimersEmpty()` at the top of every existing test in `describe('runScheduled')` so they keep passing. Modify each existing test in this describe block:

Inside `it('skips silently when subscriber has zero matches', ...)`, **before** the `runScheduled` call, add:

```javascript
stubGithubPrimersEmpty();
```

Same for `it('skips subscribers whose last_sent_at is within the idempotency window', ...)`. (This test never reaches the primer fetch since it skips before any GitHub call, but adding the stub keeps fetchMock happy if the code is ever reordered.) Actually — the existing skip-by-idempotency test exits before any fetch happens; you can leave it without a stub. Only the tests that reach the primer-fetch path need it.

Inside `it('sends to subscribers whose last_sent_at is older than the idempotency window', ...)`, before the `runScheduled` call, add:

```javascript
stubGithubPrimers(['01-welcome.md'], [['01-welcome.md', [1, 'Welcome']]]);
```

And after the `runScheduled` call, **add a new assertion**:

```javascript
const after = await env.DB.prepare('SELECT drip_week_index FROM subscriber WHERE id = ?').bind(row.id).first();
expect(after.drip_week_index).toBe(1);
```

Now add the new drip-flow tests inside `describe('runScheduled', ...)`:

```javascript
it('new subscriber gets primer 1 and drip_week_index bumps to 1', async () => {
  const row = await confirmedSubscriber('new@example.com', { boards: ['select-board'], topics: [] });
  stubGithubPrimers(
    ['01-welcome.md', '02-org.md'],
    [['01-welcome.md', [1, 'Welcome']], ['02-org.md', [2, 'Org']]]
  );
  // Match: 1 transcript that the subscriber's filters match.
  const today = new Date().toISOString().slice(0, 10);
  fetchMock.get('https://api.github.com')
    .intercept({ path: /\/repos\/.*\/contents\/_transcripts\?ref=.*/, method: 'GET' })
    .reply(200, JSON.stringify([{ type: 'file', name: `select-board-${today}.md`, download_url: 'https://example.com/sb.md' }]));
  fetchMock.get('https://example.com')
    .intercept({ path: '/sb.md', method: 'GET' })
    .reply(200, `---
slug: select-board-${today}
board: select-board
board_display: "Select Board"
date: ${today}
title: "Select Board"
vimeo_url: "https://vimeo.com/0"
summary_card:
  headline: "Test"
  summary: "Test"
topic_segments:
---
`);

  const out = await runScheduled({}, env, { skipTimeGuard: true });
  expect(out.sent).toBe(1);
  const after = await env.DB.prepare('SELECT drip_week_index FROM subscriber WHERE id = ?').bind(row.id).first();
  expect(after.drip_week_index).toBe(1);
});

it('subscriber at week 4 with no week 5 primer gets digest only and index stays', async () => {
  const row = await confirmedSubscriber('done@example.com', { boards: ['select-board'], topics: [] });
  await env.DB.prepare('UPDATE subscriber SET drip_week_index = 4 WHERE id = ?').bind(row.id).run();
  stubGithubPrimers(
    ['01-welcome.md', '02-org.md', '03-debt.md', '04-spending.md'],
    [
      ['01-welcome.md', [1, 'A']],
      ['02-org.md',     [2, 'B']],
      ['03-debt.md',    [3, 'C']],
      ['04-spending.md',[4, 'D']]
    ]
  );
  const today = new Date().toISOString().slice(0, 10);
  fetchMock.get('https://api.github.com')
    .intercept({ path: /\/repos\/.*\/contents\/_transcripts\?ref=.*/, method: 'GET' })
    .reply(200, JSON.stringify([{ type: 'file', name: `select-board-${today}.md`, download_url: 'https://example.com/sb.md' }]));
  fetchMock.get('https://example.com')
    .intercept({ path: '/sb.md', method: 'GET' })
    .reply(200, `---
slug: select-board-${today}
board: select-board
board_display: "Select Board"
date: ${today}
title: "Select Board"
vimeo_url: "https://vimeo.com/0"
summary_card:
  headline: "Test"
  summary: "Test"
topic_segments:
---
`);

  const out = await runScheduled({}, env, { skipTimeGuard: true });
  expect(out.sent).toBe(1);
  const after = await env.DB.prepare('SELECT drip_week_index FROM subscriber WHERE id = ?').bind(row.id).first();
  expect(after.drip_week_index).toBe(4);  // unchanged — no primer to send
});

it('does not bump drip_week_index when there are zero meeting matches', async () => {
  const row = await confirmedSubscriber('quiet@example.com', { boards: ['town-meeting'], topics: [] });
  stubGithubPrimers(['01-welcome.md'], [['01-welcome.md', [1, 'Welcome']]]);
  fetchMock.get('https://api.github.com')
    .intercept({ path: /\/repos\/.*\/contents\/_transcripts\?ref=.*/, method: 'GET' })
    .reply(200, '[]');
  const out = await runScheduled({}, env, { skipTimeGuard: true });
  expect(out.sent).toBe(0);
  const after = await env.DB.prepare('SELECT drip_week_index FROM subscriber WHERE id = ?').bind(row.id).first();
  expect(after.drip_week_index).toBe(0);
});

it('when _primers/ fetch fails, sends digest without primer and does not bump', async () => {
  const row = await confirmedSubscriber('p-fail@example.com', { boards: ['select-board'], topics: [] });
  stubGithubPrimersFail();
  const today = new Date().toISOString().slice(0, 10);
  fetchMock.get('https://api.github.com')
    .intercept({ path: /\/repos\/.*\/contents\/_transcripts\?ref=.*/, method: 'GET' })
    .reply(200, JSON.stringify([{ type: 'file', name: `select-board-${today}.md`, download_url: 'https://example.com/sb.md' }]));
  fetchMock.get('https://example.com')
    .intercept({ path: '/sb.md', method: 'GET' })
    .reply(200, `---
slug: select-board-${today}
board: select-board
board_display: "Select Board"
date: ${today}
title: "Select Board"
vimeo_url: "https://vimeo.com/0"
summary_card:
  headline: "Test"
  summary: "Test"
topic_segments:
---
`);

  const out = await runScheduled({}, env, { skipTimeGuard: true });
  expect(out.sent).toBe(1);
  const after = await env.DB.prepare('SELECT drip_week_index FROM subscriber WHERE id = ?').bind(row.id).first();
  expect(after.drip_week_index).toBe(0);
});
```

- [ ] **Step 2: Run tests, expect failures**

```bash
npx vitest run tests/worker.test.js
```

Expected: New tests fail. Some existing tests may also fail because they don't stub `_primers/` (the production code will start calling it after Task 6). Adding the stubs above should keep existing tests green once Task 6 lands.

- [ ] **Step 3: Modify `scheduled.js`**

Open `meeting-digest/worker/src/scheduled.js`. Add an import at the top alongside the others:

```javascript
import { fetchPrimers, pickPrimer } from './lib/primer.js';
```

Inside `runScheduled`, right after the transcripts fetch (after the `console.log` that says `[digest] fetched transcripts ...`), add the primer fetch:

```javascript
let primers = [];
let maxPrimerIndex = 0;
try {
  primers = await fetchPrimers(env);
  maxPrimerIndex = primers.length > 0 ? primers[primers.length - 1].week_index : 0;
  console.log(`[digest] fetched primers: count=${primers.length} max_week_index=${maxPrimerIndex}`);
} catch (e) {
  console.log(`[digest] primers fetch failed (continuing without primer block): ${e.message}`);
  primers = [];
  maxPrimerIndex = 0;
}
```

Then expand the eligible-subscriber SELECT to include `drip_week_index`. Change:

```javascript
'SELECT id, email, manage_token, boards, topics FROM subscriber WHERE status = ? AND (last_sent_at IS NULL OR last_sent_at < ?)'
```

to:

```javascript
'SELECT id, email, manage_token, boards, topics, drip_week_index FROM subscriber WHERE status = ? AND (last_sent_at IS NULL OR last_sent_at < ?)'
```

In the per-subscriber loop, after computing `matches` but before rendering, add:

```javascript
const primer = pickPrimer(primers, s.drip_week_index || 0);
```

Change the `renderHtml` and `renderText` calls to pass primer args:

```javascript
const html = renderHtml(matches, { manage_token: s.manage_token, email: s.email }, env, weekEnding, primer, maxPrimerIndex);
const text = renderText(matches, { manage_token: s.manage_token, email: s.email }, env, weekEnding, primer, maxPrimerIndex);
```

In the success branch, change the `UPDATE` to conditionally bump `drip_week_index`. Replace:

```javascript
await env.DB.prepare('UPDATE subscriber SET last_sent_at = ? WHERE id = ?').bind(now, s.id).run();
```

with:

```javascript
if (primer) {
  await env.DB.prepare(
    'UPDATE subscriber SET last_sent_at = ?, drip_week_index = drip_week_index + 1 WHERE id = ?'
  ).bind(now, s.id).run();
} else {
  await env.DB.prepare(
    'UPDATE subscriber SET last_sent_at = ? WHERE id = ?'
  ).bind(now, s.id).run();
}
```

- [ ] **Step 4: Run tests, expect pass**

```bash
npx vitest run tests/worker.test.js
```

Expected: all worker.test.js tests passing.

- [ ] **Step 5: Run the full suite**

```bash
npm test
```

Expected: all green across all test files.

- [ ] **Step 6: Commit**

```bash
cd /home/claude/marblehead/.worktrees/digest-drip-primer
git add meeting-digest/worker/src/scheduled.js meeting-digest/tests/worker.test.js
git commit -m "digest: scheduled.js fetches primers, picks per subscriber, bumps drip_week_index"
```

---

## Task 7: Register `_primers/` Jekyll collection and ship the welcome primer

**Files:**
- Modify: `_config.yml`
- Create: `_primers/01-welcome.md`

- [ ] **Step 1: Add the collection to `_config.yml`**

Find the existing `collections:` block (or where collections like `transcripts` are configured). Add a `primers` entry with `output: false`:

```yaml
collections:
  primers:
    output: false
```

If a `collections:` key doesn't exist yet, add the whole block at the top level.

- [ ] **Step 2: Stop before writing primer copy — confirm with Andrew**

The spec says v1 ships with confirmed primer-1 copy. Before writing `_primers/01-welcome.md`, the executor must surface the proposed title, body (2–4 sentences), `link_url`, and `link_label` to Andrew and get sign-off. Default proposal (subject to change):

```yaml
---
week_index: 1
title: "What this site is"
link_url: /about/
link_label: "About marbleheaddata.org"
---
You just subscribed to a Monday email of summaries from Marblehead board meetings. It's a one-person, resident-built site that tries to make local government legible without picking a side.

Every number on the site traces back to a primary source. Charts, tools, and explainers cover the override, the budget, debt, staffing, and trash. Reply to this email if anything's wrong — corrections are how the site stays trustworthy.
```

If Andrew approves, save to `_primers/01-welcome.md`. If he proposes edits, apply them before saving.

- [ ] **Step 3: Verify Jekyll build does not output the collection**

```bash
cd /home/claude/marblehead/.worktrees/digest-drip-primer
bundle exec jekyll build 2>&1 | tail -10
ls _site/primers 2>&1
```

Expected:
- `jekyll build` succeeds.
- `ls _site/primers` errors with "No such file or directory" — the `output: false` keeps it out of the built site.

- [ ] **Step 4: Commit**

```bash
git add _config.yml _primers/01-welcome.md
git commit -m "site: register _primers collection + welcome primer for digest drip"
```

---

## Task 8: Final verification and PR

- [ ] **Step 1: Run the full meeting-digest test suite**

```bash
cd /home/claude/marblehead/.worktrees/digest-drip-primer/meeting-digest
npm test
```

Expected: all tests passing, no warnings about un-intercepted fetches.

- [ ] **Step 2: Push the branch**

```bash
cd /home/claude/marblehead/.worktrees/digest-drip-primer
git push -u origin digest-drip-primer
```

- [ ] **Step 3: Open the PR**

```bash
gh pr create --title "digest: per-subscriber drip primer (4-week extensible)" --body "$(cat <<'EOF'
## Summary

- Adds a `drip_week_index` column to `subscriber` and a `_primers/` Jekyll collection.
- Worker fetches `_primers/` on every Monday cron, picks the next primer for each subscriber, appends a primer card to the email, and bumps the counter on success.
- Drip rides only on weeks the digest sends. No primer on weeks with zero meeting matches.
- Ships with primer 1 (welcome). Weeks 2–4 ship as separate content PRs as copy is written.

## Preview URL

Cloudflare Pages preview will appear once the deploy completes. There is no UI to preview — this is a Worker + email render change. Verification is the test suite + the staging Worker on the next Monday cron after deploy.

## Test plan

- [ ] CI: meeting-digest vitest suite is green.
- [ ] After merge: apply `0002_drip_week_index.sql` to remote D1.
- [ ] After merge: `npm run deploy` for the Worker.
- [ ] After merge: confirm next Monday cron sends primer 1 to existing subscribers and bumps their `drip_week_index` to 1.
- [ ] After merge: confirm PostHog sees `utm_campaign=primer-week-1` clicks.

## Proof of Work

- Tests: all meeting-digest vitest tests passing (added primer.test.js, extended render.test.js and worker.test.js).
- Jekyll build: `_primers/` does NOT appear in `_site/` due to `output: false`.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 4: Confirm the PR is open**

```bash
gh pr view --json url,number,headRefName
```

Report the URL to the user.

- [ ] **Step 5: Apply the migration and deploy after merge**

This step runs only after Andrew merges the PR. From the parent worktree (per the memory `feedback_gh_pr_merge_from_worktree`):

```bash
cd /home/claude/marblehead/.worktrees/digest-drip-primer/meeting-digest
npx wrangler --config worker/wrangler.toml d1 execute meeting-digest --remote --file=worker/schema/0002_drip_week_index.sql
npm run deploy
```

Then verify next Monday's cron in D1:

```bash
npx wrangler --config worker/wrangler.toml d1 execute meeting-digest --remote --command="SELECT id, email, drip_week_index, last_sent_at FROM subscriber;"
```

Expected: each confirmed subscriber's `drip_week_index` advances from 0 to 1 after the Monday cron.

---

## Notes for the executor

- **Run all bash commands from the worktree.** `/home/claude/marblehead/.worktrees/digest-drip-primer/` for repo-wide commands; `cd meeting-digest` first for vitest.
- **No backwards-compat shims.** The `subscriber.drip_week_index` column starts at 0 for everyone via `DEFAULT 0`; nothing in the code assumes a missing column.
- **fetchMock cleanup is automatic** between tests in this suite (see existing `beforeEach`). Don't add manual cleanup.
- **Do NOT skip steps.** Each task ends with a green test run before the commit; do not batch task commits or skip verification.
- **If a hook fails** during commit, fix the issue and create a NEW commit (per box CLAUDE.md). Never `--amend` after a hook failure.
