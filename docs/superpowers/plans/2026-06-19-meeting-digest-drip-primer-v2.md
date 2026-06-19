# Drip primer v2 implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship 5 new `_primers/NN-*.md` files (weeks 2-6), trim the welcome primer, add a permanent reply-prompt to every digest footer, and append an admin-only subscriber-stats block to the digest sent to a specific email address.

**Architecture:** Six file additions/edits in `_primers/`, two new lines of footer chrome in `render.js`, one new `admin-stats.js` module that runs a single D1 aggregate query per cron, and a conditional integration in `scheduled.js` that passes stats to the renderer only when `s.email === env.ADMIN_EMAIL`.

**Tech Stack:** Cloudflare Workers, D1 (SQLite), vitest with `@cloudflare/vitest-pool-workers`, Jekyll `_primers/` collection (no build output).

**Spec:** `docs/superpowers/specs/2026-06-19-meeting-digest-drip-primer-v2-design.md`

**Working directory throughout this plan:** `/home/claude/marblehead/.worktrees/drip-v2/`

---

## File map

| Path | Action | Responsibility |
|---|---|---|
| `meeting-digest/worker/wrangler.toml` | Modify | Add `ADMIN_EMAIL = "agbaber@gmail.com"` to `[vars]` and `[env.staging.vars]`. |
| `_primers/01-welcome.md` | Modify | Trim body — drop the redundant reply line. |
| `_primers/02-org-chart.md` | Create | Week 2 primer. |
| `_primers/03-debt.md` | Create | Week 3 primer. |
| `_primers/04-spending.md` | Create | Week 4 primer. |
| `_primers/05-action.md` | Create | Week 5 primer. |
| `_primers/06-verify.md` | Create | Week 6 primer. |
| `meeting-digest/worker/src/lib/render.js` | Modify | Add reply-prompt line to HTML + text footers; add `adminStatsHtml` and `adminStatsText` helpers; thread an optional `adminStats` arg into `renderHtml`/`renderText`. |
| `meeting-digest/worker/src/lib/admin-stats.js` | Create | Exports `fetchSubscriberStats(env, nowMs)` — one D1 aggregate query, returns shaped stats object. |
| `meeting-digest/worker/src/scheduled.js` | Modify | Fetch stats once per cron via `fetchSubscriberStats`; pass `adminStats` to renderers only when `s.email === env.ADMIN_EMAIL`. |
| `meeting-digest/tests/admin-stats.test.js` | Create | Unit tests for `fetchSubscriberStats`. |
| `meeting-digest/tests/render.test.js` | Modify | Tests for footer reply-prompt + admin stats render. |
| `meeting-digest/tests/worker.test.js` | Modify | Integration test: admin email triggers stats block; non-admin doesn't. |
| `meeting-digest/vitest.config.js` | Modify | Register `tests/admin-stats.test.js` in the unit project's `include` array. |

Existing 87/87 vitest baseline. Final target: 87 + ~14 new tests = ~101 passing.

---

## Task 1: Add `ADMIN_EMAIL` env var to wrangler.toml

**Files:**
- Modify: `meeting-digest/worker/wrangler.toml`

- [ ] **Step 1: Edit `[vars]` block (production)**

In `meeting-digest/worker/wrangler.toml`, find the existing `[vars]` block. After the line `MAIL_REPLY_TO = "agbaber@gmail.com"`, add:

```toml
ADMIN_EMAIL = "agbaber@gmail.com"
```

- [ ] **Step 2: Edit `[env.staging.vars]` block (staging)**

Find the `[env.staging.vars]` block. After its `MAIL_REPLY_TO = "agbaber@gmail.com"` line, add:

```toml
ADMIN_EMAIL = "agbaber@gmail.com"
```

- [ ] **Step 3: Verify tests still pass**

```bash
cd /home/claude/marblehead/.worktrees/drip-v2/meeting-digest
npm test 2>&1 | tail -5
```

Expected: 87 passing, 0 failing. No tests read `env.ADMIN_EMAIL` yet.

- [ ] **Step 4: Commit**

```bash
cd /home/claude/marblehead/.worktrees/drip-v2
git add meeting-digest/worker/wrangler.toml
git commit -m "digest: declare ADMIN_EMAIL env var (prod + staging)"
```

---

## Task 2: Primer content batch (trim welcome + 5 new files)

**Files:**
- Modify: `_primers/01-welcome.md`
- Create: `_primers/02-org-chart.md`
- Create: `_primers/03-debt.md`
- Create: `_primers/04-spending.md`
- Create: `_primers/05-action.md`
- Create: `_primers/06-verify.md`

This is pure content. No tests. The Worker reads `_primers/` from GitHub at cron time, so a content-only change is reflected the next Monday after merge.

- [ ] **Step 1: Trim `_primers/01-welcome.md`**

Read the file first. Then replace the body (the two-paragraph section after the closing `---` of the frontmatter) with:

```
You just subscribed to a Monday email of summaries from Marblehead board meetings.

Every number on the site traces back to a primary source. Charts, tools, and explainers cover the override, the budget, debt, staffing, and trash.
```

Frontmatter stays unchanged: `week_index: 1`, `title: "What this site is"`, `link_url: /`, `link_label: "Browse marbleheaddata.org"`.

- [ ] **Step 2: Create `_primers/02-org-chart.md`**

```markdown
---
week_index: 2
title: "Who runs the town"
link_url: /org-chart/
link_label: "See the org chart"
---
Marblehead is actually two parallel administrations, each with its own elected board, each answerable to the town's registered voters. State law keeps them legally separate even though they pull from one tax base.

The chart lays out every department by FTE count, head title, and FY27 salary appropriation, plus the elected boards above them. Worth a look so the boards and departments that show up in meeting digests aren't abstractions.
```

- [ ] **Step 3: Create `_primers/03-debt.md`**

```markdown
---
week_index: 3
title: "What the town owes"
link_url: /town-debt/
link_label: "Open the debt page"
---
The town owes about $116 million. Voters approved every dollar of it, project by project, in 51 separate ballot questions since 1988. Voters said yes to 50 of those and no to one.

The debt page breaks out what each project costs, what the town pays each year, how Marblehead compares to similar towns, and how the debt relates to the operating override.
```

- [ ] **Step 4: Create `_primers/04-spending.md`**

```markdown
---
week_index: 4
title: "Where the money actually goes"
link_url: /checkbook/
link_label: "Open the checkbook"
---
The checkbook is a daily-refreshed dashboard of FY26 spending: budget vs. actual across every fund, department, category, division, and object code. Right now: $101M in vendor checks against a $206M budget.

Filter by vendor to see who got paid, or by department to see which budgets are running hot. Sourced directly from the town's open finance portals.
```

- [ ] **Step 5: Create `_primers/05-action.md`**

```markdown
---
week_index: 5
title: "What you can actually do"
link_url: /what-can-we-do/
link_label: "Open the working list"
---
The "what can we do" page is a working list of revenue ideas, spending ideas, and questions about how the town could make decisions differently. Some are widely shared, some contested, none of them free.

Most don't require a Town Meeting vote, which means they're things a board or staff could try without waiting for the next override cycle. The page is meant to be argued with. Reply with anything you'd add.
```

- [ ] **Step 6: Create `_primers/06-verify.md`**

```markdown
---
week_index: 6
title: "Become a verified neighbor"
link_url: /verify-me/
link_label: "Verify yourself"
---
Some site features open up once neighbors verify they actually live in Marblehead: weighing in on open questions, vouching for renters, and reading community pulse as signal instead of noise.

Sign in with Facebook, and the site matches your name against the FY25 town assessor record. If your name is on the deed, you're verified on the spot. Otherwise, the site routes you to a neighbor who can vouch.
```

- [ ] **Step 7: Verify Jekyll build still excludes _primers/**

```bash
cd /home/claude/marblehead/.worktrees/drip-v2
bundle exec jekyll build 2>&1 | tail -5
ls _site/primers 2>&1
```

Expected: Jekyll build succeeds; `_site/primers/` does not exist.

- [ ] **Step 8: Verify tests still pass**

```bash
cd /home/claude/marblehead/.worktrees/drip-v2/meeting-digest
npm test 2>&1 | tail -5
```

Expected: 87 passing, 0 failing.

- [ ] **Step 9: Commit**

```bash
cd /home/claude/marblehead/.worktrees/drip-v2
git add _primers/
git commit -m "site: trim welcome primer + add weeks 2-6 (org chart, debt, spending, action, verify)"
```

---

## Task 3: Add reply-prompt to digest footer

**Files:**
- Modify: `meeting-digest/worker/src/lib/render.js`
- Modify: `meeting-digest/tests/render.test.js`

- [ ] **Step 1: Write failing tests for the reply-prompt line**

Add to `meeting-digest/tests/render.test.js`, in a new `describe` block placed AFTER the existing `describe('renderText with primer', ...)` block:

```javascript
describe('renderHtml footer reply prompt', () => {
  it('includes "Got a question or correction? Just reply to this email." in the HTML footer', () => {
    const html = renderHtml([SB_MATCH], SUB, ENV, '2026-06-15');
    expect(html).toContain('Got a question or correction? Just reply to this email.');
  });
});

describe('renderText footer reply prompt', () => {
  it('includes "Got a question or correction? Just reply to this email." above the manage line in the text footer', () => {
    const text = renderText([SB_MATCH], SUB, ENV, '2026-06-15');
    expect(text).toContain('Got a question or correction? Just reply to this email.');
    // Reply prompt must come before "Manage subscription" line
    const replyIdx = text.indexOf('Got a question or correction?');
    const manageIdx = text.indexOf('Manage subscription:');
    expect(replyIdx).toBeGreaterThan(-1);
    expect(manageIdx).toBeGreaterThan(replyIdx);
  });
});
```

- [ ] **Step 2: Run, expect failures**

```bash
cd /home/claude/marblehead/.worktrees/drip-v2/meeting-digest
npx vitest run tests/render.test.js
```

Expected: 2 new tests fail (text doesn't contain the prompt).

- [ ] **Step 3: Add the reply-prompt to `renderHtml`**

In `meeting-digest/worker/src/lib/render.js`, `renderHtml`'s template literal contains this footer block (around lines 113-118):

```javascript
  <hr class="mhd-hr" style="border: none; border-top: 1px solid #e5e5e5; margin: 8px 0 16px;">
  <p style="margin: 0 0 6px; font-size: 13px; color: #6c757d;">
    <a class="mhd-link" href="${manageUrl}" style="color: #1B3A57; text-decoration: none;">Manage subscription</a>
    &nbsp;·&nbsp;
    <a class="mhd-link" href="${unsubUrl}" style="color: #1B3A57; text-decoration: none;">Unsubscribe</a>
  </p>
  <p class="mhd-muted" style="margin: 0; font-size: 12px; color: #8a949c;">Summaries are AI-generated. Verify with the source video.</p>
```

Insert a new `<p>` for the reply-prompt directly AFTER the `<hr>` and BEFORE the manage/unsubscribe `<p>`. Final block:

```javascript
  <hr class="mhd-hr" style="border: none; border-top: 1px solid #e5e5e5; margin: 8px 0 16px;">
  <p style="margin: 0 0 8px; font-size: 13px; color: #6c757d;">Got a question or correction? Just reply to this email.</p>
  <p style="margin: 0 0 6px; font-size: 13px; color: #6c757d;">
    <a class="mhd-link" href="${manageUrl}" style="color: #1B3A57; text-decoration: none;">Manage subscription</a>
    &nbsp;·&nbsp;
    <a class="mhd-link" href="${unsubUrl}" style="color: #1B3A57; text-decoration: none;">Unsubscribe</a>
  </p>
  <p class="mhd-muted" style="margin: 0; font-size: 12px; color: #8a949c;">Summaries are AI-generated. Verify with the source video.</p>
```

`email-shell.js` is the outer card chrome (navy hero bar + footer disclaimer) — do not modify it. The renderable footer with manage/unsub lives inside `renderHtml`'s body template.

- [ ] **Step 4: Add the reply-prompt to `renderText`**

In `renderText`, find the existing footer block:

```
---
Manage subscription: ${manageUrl}
Unsubscribe: ${unsubUrl}

Summaries are AI-generated. Verify with the source video.
```

Change to:

```
---
Got a question or correction? Just reply to this email.

Manage subscription: ${manageUrl}
Unsubscribe: ${unsubUrl}

Summaries are AI-generated. Verify with the source video.
```

(One new line + one new blank line between the prompt and "Manage subscription".)

- [ ] **Step 5: Run tests, expect pass**

```bash
npx vitest run tests/render.test.js
```

Expected: all render tests passing (existing + 2 new).

- [ ] **Step 6: Run the full suite to make sure nothing else broke**

```bash
npm test
```

Expected: 89 passing (87 prior + 2 new). If any existing `worker.test.js` test was asserting the exact text of the footer and now breaks, update it to include the new reply-prompt line — the production footer permanently includes this line going forward.

- [ ] **Step 7: Commit**

```bash
cd /home/claude/marblehead/.worktrees/drip-v2
git add meeting-digest/worker/src/lib/render.js meeting-digest/tests/render.test.js
git commit -m "digest: add permanent reply-prompt to every digest footer"
```

---

## Task 4: `fetchSubscriberStats` D1 query module

**Files:**
- Create: `meeting-digest/worker/src/lib/admin-stats.js`
- Create: `meeting-digest/tests/admin-stats.test.js`
- Modify: `meeting-digest/vitest.config.js`

- [ ] **Step 1: Register the new test file**

In `meeting-digest/vitest.config.js`, find the `unit` project's `include` array (currently lists `email.test.js`, `topics.test.js`, `transcripts.test.js`, `matcher.test.js`, `render.test.js`, `primer.test.js`). Add `'tests/admin-stats.test.js'` to the array.

- [ ] **Step 2: Write failing tests**

Create `meeting-digest/tests/admin-stats.test.js`:

```javascript
// meeting-digest/tests/admin-stats.test.js
import { describe, it, expect, beforeEach } from 'vitest';
import { env, applyD1Migrations } from 'cloudflare:test';
import { fetchSubscriberStats } from '../worker/src/lib/admin-stats.js';

const MIGRATION_0001 = {
  name: '0001_subscriber',
  queries: [
    `CREATE TABLE IF NOT EXISTS subscriber (
  id                    TEXT PRIMARY KEY,
  email                 TEXT NOT NULL,
  status                TEXT NOT NULL CHECK (status IN ('pending_confirmation','confirmed','unsubscribed','bounced','complained')),
  confirmation_token    TEXT,
  confirmation_expires  INTEGER,
  manage_token          TEXT NOT NULL,
  boards                TEXT NOT NULL,
  topics                TEXT NOT NULL,
  cadence               TEXT NOT NULL DEFAULT 'weekly',
  created_at            INTEGER NOT NULL,
  confirmed_at          INTEGER,
  unsubscribed_at       INTEGER,
  last_sent_at          INTEGER
)`
  ]
};
const MIGRATION_0002 = {
  name: '0002_drip_week_index',
  queries: [
    `ALTER TABLE subscriber ADD COLUMN drip_week_index INTEGER NOT NULL DEFAULT 0`
  ]
};

const DAY_MS = 24 * 60 * 60 * 1000;

beforeEach(async () => {
  await applyD1Migrations(env.DB, [MIGRATION_0001, MIGRATION_0002]);
  await env.DB.prepare('DELETE FROM subscriber').run();
});

async function insertRow(opts) {
  await env.DB.prepare(`
    INSERT INTO subscriber (id, email, status, manage_token, boards, topics, created_at, confirmed_at, unsubscribed_at)
    VALUES (?, ?, ?, ?, '[]', '[]', ?, ?, ?)
  `).bind(
    opts.id,
    opts.email,
    opts.status,
    opts.manage_token || 'mtok',
    opts.created_at,
    opts.confirmed_at || null,
    opts.unsubscribed_at || null
  ).run();
}

describe('fetchSubscriberStats', () => {
  it('returns zeros for every status when the table is empty', async () => {
    const now = Date.now();
    const stats = await fetchSubscriberStats(env, now);
    expect(stats.confirmed).toEqual({ n: 0, n_new: 0 });
    expect(stats.pending_confirmation).toEqual({ n: 0, n_new: 0 });
    expect(stats.unsubscribed).toEqual({ n: 0, n_new: 0 });
    expect(stats.bounced).toEqual({ n: 0, n_new: 0 });
    expect(stats.complained).toEqual({ n: 0, n_new: 0 });
  });

  it('counts confirmed rows whose confirmed_at is inside the 7-day window as new', async () => {
    const now = Date.now();
    await insertRow({
      id: 'a', email: 'a@x', status: 'confirmed',
      created_at: now - 10 * DAY_MS, confirmed_at: now - 3 * DAY_MS
    });
    const stats = await fetchSubscriberStats(env, now);
    expect(stats.confirmed).toEqual({ n: 1, n_new: 1 });
  });

  it('does not count confirmed rows whose confirmed_at is older than 7 days as new', async () => {
    const now = Date.now();
    await insertRow({
      id: 'a', email: 'a@x', status: 'confirmed',
      created_at: now - 30 * DAY_MS, confirmed_at: now - 10 * DAY_MS
    });
    const stats = await fetchSubscriberStats(env, now);
    expect(stats.confirmed).toEqual({ n: 1, n_new: 0 });
  });

  it('counts pending_confirmation rows whose created_at is inside the window as new', async () => {
    const now = Date.now();
    await insertRow({
      id: 'a', email: 'a@x', status: 'pending_confirmation',
      created_at: now - 2 * DAY_MS
    });
    const stats = await fetchSubscriberStats(env, now);
    expect(stats.pending_confirmation).toEqual({ n: 1, n_new: 1 });
  });

  it('counts unsubscribed rows whose unsubscribed_at is inside the window as new', async () => {
    const now = Date.now();
    await insertRow({
      id: 'a', email: 'a@x', status: 'unsubscribed',
      created_at: now - 40 * DAY_MS, unsubscribed_at: now - 1 * DAY_MS
    });
    const stats = await fetchSubscriberStats(env, now);
    expect(stats.unsubscribed).toEqual({ n: 1, n_new: 1 });
  });

  it('counts bounced rows but never marks them new (no bounced_at column)', async () => {
    const now = Date.now();
    await insertRow({
      id: 'a', email: 'a@x', status: 'bounced',
      created_at: now - 2 * DAY_MS, confirmed_at: now - 2 * DAY_MS
    });
    const stats = await fetchSubscriberStats(env, now);
    expect(stats.bounced).toEqual({ n: 1, n_new: 0 });
  });

  it('aggregates a mixed table correctly', async () => {
    const now = Date.now();
    // 2 confirmed (one new, one old)
    await insertRow({ id: 'a', email: 'a@x', status: 'confirmed', created_at: now - 30 * DAY_MS, confirmed_at: now - 2 * DAY_MS });
    await insertRow({ id: 'b', email: 'b@x', status: 'confirmed', created_at: now - 90 * DAY_MS, confirmed_at: now - 60 * DAY_MS });
    // 3 pending (one new, two old)
    await insertRow({ id: 'c', email: 'c@x', status: 'pending_confirmation', created_at: now - 1 * DAY_MS });
    await insertRow({ id: 'd', email: 'd@x', status: 'pending_confirmation', created_at: now - 10 * DAY_MS });
    await insertRow({ id: 'e', email: 'e@x', status: 'pending_confirmation', created_at: now - 30 * DAY_MS });

    const stats = await fetchSubscriberStats(env, now);
    expect(stats.confirmed).toEqual({ n: 2, n_new: 1 });
    expect(stats.pending_confirmation).toEqual({ n: 3, n_new: 1 });
    expect(stats.unsubscribed).toEqual({ n: 0, n_new: 0 });
    expect(stats.bounced).toEqual({ n: 0, n_new: 0 });
  });
});
```

- [ ] **Step 3: Run, expect failures**

```bash
npx vitest run tests/admin-stats.test.js
```

Expected: all 7 tests fail because `admin-stats.js` doesn't exist.

- [ ] **Step 4: Implement `fetchSubscriberStats`**

Create `meeting-digest/worker/src/lib/admin-stats.js`:

```javascript
// meeting-digest/worker/src/lib/admin-stats.js
//
// One D1 aggregate query that returns subscriber counts per status with
// a delta count for rows that transitioned into that status in the last
// 7 days. Caller (scheduled.js) runs this once per cron and passes the
// result to the renderer when the recipient matches env.ADMIN_EMAIL.

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

const ALL_STATUSES = [
  'confirmed',
  'pending_confirmation',
  'unsubscribed',
  'bounced',
  'complained'
];

export async function fetchSubscriberStats(env, nowMs) {
  const cutoff = nowMs - SEVEN_DAYS_MS;
  const { results } = await env.DB.prepare(`
    SELECT
      status,
      COUNT(*) AS n,
      SUM(CASE
        WHEN status = 'confirmed'             AND confirmed_at    > ? THEN 1
        WHEN status = 'pending_confirmation'  AND created_at      > ? THEN 1
        WHEN status = 'unsubscribed'          AND unsubscribed_at > ? THEN 1
        ELSE 0
      END) AS n_new
    FROM subscriber
    GROUP BY status
  `).bind(cutoff, cutoff, cutoff).all();

  // Initialize every status to zero so the renderer can rely on key presence.
  const out = {};
  for (const status of ALL_STATUSES) {
    out[status] = { n: 0, n_new: 0 };
  }
  for (const row of results) {
    if (out[row.status]) {
      out[row.status] = {
        n: Number(row.n) || 0,
        n_new: Number(row.n_new) || 0
      };
    }
  }
  return out;
}
```

- [ ] **Step 5: Run tests, expect pass**

```bash
npx vitest run tests/admin-stats.test.js
```

Expected: 7 passing.

- [ ] **Step 6: Run full suite**

```bash
npm test
```

Expected: 96 passing (89 prior + 7 new).

- [ ] **Step 7: Commit**

```bash
cd /home/claude/marblehead/.worktrees/drip-v2
git add meeting-digest/worker/src/lib/admin-stats.js meeting-digest/tests/admin-stats.test.js meeting-digest/vitest.config.js
git commit -m "digest: fetchSubscriberStats returns per-status counts + 7d deltas"
```

---

## Task 5: Render admin stats block

**Files:**
- Modify: `meeting-digest/worker/src/lib/render.js`
- Modify: `meeting-digest/tests/render.test.js`

- [ ] **Step 1: Write failing tests**

Add to `meeting-digest/tests/render.test.js`, in new `describe` blocks placed after the existing footer-reply-prompt tests:

```javascript
const SAMPLE_STATS = {
  confirmed:            { n: 2, n_new: 0 },
  pending_confirmation: { n: 4, n_new: 1 },
  unsubscribed:         { n: 0, n_new: 0 },
  bounced:              { n: 0, n_new: 0 },
  complained:           { n: 0, n_new: 0 }
};

const STATS_WITH_COMPLAINT = {
  ...SAMPLE_STATS,
  complained: { n: 1, n_new: 0 }
};

describe('renderHtml with adminStats', () => {
  it('omits the admin block when adminStats is null', () => {
    const html = renderHtml([SB_MATCH], SUB, ENV, '2026-06-22', null, 0, null);
    expect(html).not.toMatch(/Admin · subscriber snapshot/);
  });

  it('renders the admin block when adminStats is provided', () => {
    const html = renderHtml([SB_MATCH], SUB, ENV, '2026-06-22', null, 0, SAMPLE_STATS);
    expect(html).toContain('Admin · subscriber snapshot');
    expect(html).toContain('Confirmed: 2 (+0)');
    expect(html).toContain('Pending: 4 (+1)');
    expect(html).toContain('Unsubscribed: 0 (+0)');
    expect(html).toContain('Bounced: 0');
    // No delta on Bounced line
    expect(html).not.toMatch(/Bounced: 0 \(\+/);
  });

  it('omits the Complained line when complained count is 0', () => {
    const html = renderHtml([SB_MATCH], SUB, ENV, '2026-06-22', null, 0, SAMPLE_STATS);
    expect(html).not.toContain('Complained');
  });

  it('renders the Complained line when complained count is > 0', () => {
    const html = renderHtml([SB_MATCH], SUB, ENV, '2026-06-22', null, 0, STATS_WITH_COMPLAINT);
    expect(html).toContain('Complained: 1');
    // Complained line, like Bounced, has no delta
    expect(html).not.toMatch(/Complained: 1 \(\+/);
  });

  it('includes a "week of …" label derived from weekEndingIso', () => {
    const html = renderHtml([SB_MATCH], SUB, ENV, '2026-06-22', null, 0, SAMPLE_STATS);
    expect(html).toMatch(/Admin · subscriber snapshot \(week of Jun 22\)/);
  });
});

describe('renderText with adminStats', () => {
  it('omits the admin block when adminStats is null', () => {
    const text = renderText([SB_MATCH], SUB, ENV, '2026-06-22', null, 0, null);
    expect(text).not.toMatch(/Admin · subscriber snapshot/);
  });

  it('renders the admin block when adminStats is provided', () => {
    const text = renderText([SB_MATCH], SUB, ENV, '2026-06-22', null, 0, SAMPLE_STATS);
    expect(text).toContain('Admin · subscriber snapshot (week of Jun 22)');
    expect(text).toContain('Confirmed: 2 (+0)');
    expect(text).toContain('Pending: 4 (+1)');
    expect(text).toContain('Unsubscribed: 0 (+0)');
    expect(text).toContain('Bounced: 0');
  });

  it('places the admin block after the primer (when present) and before the footer in text', () => {
    const PRIMER_2 = {
      filename: '02-org-chart.md',
      week_index: 2,
      title: 'Who runs the town',
      link_url: '/org-chart/',
      link_label: 'See the org chart',
      body_paragraphs: ['Para1.']
    };
    const text = renderText([SB_MATCH], SUB, ENV, '2026-06-22', PRIMER_2, 6, SAMPLE_STATS);
    const primerIdx = text.indexOf('SITE PRIMER · 2 of 6');
    const adminIdx = text.indexOf('Admin · subscriber snapshot');
    const manageIdx = text.indexOf('Manage subscription:');
    expect(primerIdx).toBeGreaterThan(-1);
    expect(adminIdx).toBeGreaterThan(primerIdx);
    expect(manageIdx).toBeGreaterThan(adminIdx);
  });
});
```

- [ ] **Step 2: Run, expect failures**

```bash
npx vitest run tests/render.test.js
```

Expected: new tests fail (adminStats arg ignored, block not rendered).

- [ ] **Step 3: Add `adminStatsHtml` / `adminStatsText` helpers and a `weekOfLabel` util**

In `meeting-digest/worker/src/lib/render.js`, add these helpers AFTER the existing `primerText` helper (which is currently the last private helper before `renderHtml`):

```javascript
// Format a week-ending ISO date (YYYY-MM-DD) as "Jun 22" — no year, no comma.
// Used for the admin stats label so it matches the digest's existing week framing.
function weekOfLabel(weekEndingIso) {
  if (typeof weekEndingIso !== 'string' || weekEndingIso.length < 10) return '';
  const mi = parseInt(weekEndingIso.slice(5, 7), 10) - 1;
  const d = parseInt(weekEndingIso.slice(8, 10), 10);
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  if (Number.isNaN(mi) || Number.isNaN(d) || mi < 0 || mi > 11) return '';
  return `${MONTHS[mi]} ${d}`;
}

// Status display name + whether the line shows a delta. Bounced and Complained
// have no transition timestamp, so they're count-only.
const ADMIN_STATUS_LINES = [
  { key: 'confirmed',            label: 'Confirmed',    withDelta: true,  alwaysRender: true  },
  { key: 'pending_confirmation', label: 'Pending',      withDelta: true,  alwaysRender: true  },
  { key: 'unsubscribed',         label: 'Unsubscribed', withDelta: true,  alwaysRender: true  },
  { key: 'bounced',              label: 'Bounced',      withDelta: false, alwaysRender: true  },
  { key: 'complained',           label: 'Complained',   withDelta: false, alwaysRender: false }
];

function adminStatsLines(stats) {
  const lines = [];
  for (const cfg of ADMIN_STATUS_LINES) {
    const entry = stats[cfg.key] || { n: 0, n_new: 0 };
    if (!cfg.alwaysRender && entry.n <= 0) continue;
    if (cfg.withDelta) {
      lines.push(`${cfg.label}: ${entry.n} (+${entry.n_new})`);
    } else {
      lines.push(`${cfg.label}: ${entry.n}`);
    }
  }
  return lines;
}

function adminStatsHtml(stats, weekEndingIso) {
  const label = weekOfLabel(weekEndingIso);
  const header = label ? `Admin · subscriber snapshot (week of ${label})` : 'Admin · subscriber snapshot';
  const lines = adminStatsLines(stats);
  const lineHtml = lines.map(line =>
    `<p class="mhd-body" style="margin: 0 0 4px; color: #2a3036; line-height: 1.55; font-variant-numeric: tabular-nums;">${escapeHtml(line)}</p>`
  ).join('');
  return `
  <hr class="mhd-hr" style="border: 0; border-top: 1px solid #e3e8ee; margin: 8px 0 24px;">
  <div style="margin: 0 0 8px;">
    <p class="mhd-muted" style="margin: 0 0 8px; font-size: 13px; color: #6c757d;">${escapeHtml(header)}</p>
    ${lineHtml}
  </div>`;
}

function adminStatsText(stats, weekEndingIso) {
  const label = weekOfLabel(weekEndingIso);
  const header = label ? `Admin · subscriber snapshot (week of ${label})` : 'Admin · subscriber snapshot';
  const lines = adminStatsLines(stats);
  // Block opens with `---\n\n` and ends with `\n\n` for the same reason
  // primerText does: keeps the existing footer `---` separator clean below.
  return `---\n\n${header}\n${lines.join('\n')}\n\n`;
}
```

- [ ] **Step 4: Extend `renderHtml` signature and template**

Change the `renderHtml` signature from:

```javascript
export function renderHtml(matches, subscriber, env, weekEndingIso, primer = null, maxPrimerIndex = 0) {
```

to:

```javascript
export function renderHtml(matches, subscriber, env, weekEndingIso, primer = null, maxPrimerIndex = 0, adminStats = null) {
```

Inside the `emailShell({ body: ... })` template literal, find the line(s) that render the primer block:

```javascript
${primer ? primerHtml(primer, maxPrimerIndex, env) : ''}
```

Add the admin stats block immediately after the primer block:

```javascript
${primer ? primerHtml(primer, maxPrimerIndex, env) : ''}
${adminStats ? adminStatsHtml(adminStats, weekEndingIso) : ''}
```

- [ ] **Step 5: Extend `renderText` signature and template**

Change the `renderText` signature similarly:

```javascript
export function renderText(matches, subscriber, env, weekEndingIso, primer = null, maxPrimerIndex = 0, adminStats = null) {
```

Inside `renderText`'s template literal, locate where `primerText` is invoked:

```javascript
${primer ? primerText(primer, maxPrimerIndex, env) : ''}---
Got a question or correction? Just reply to this email.

Manage subscription: ${manageUrl}
```

Insert the admin stats text block between primer and the footer `---`. Since both `primerText` and `adminStatsText` end with `\n\n` and start with `---\n\n`, simply concatenate:

```javascript
${primer ? primerText(primer, maxPrimerIndex, env) : ''}${adminStats ? adminStatsText(adminStats, weekEndingIso) : ''}---
Got a question or correction? Just reply to this email.

Manage subscription: ${manageUrl}
```

When both `primer` and `adminStats` are present, the rendered output is `body\n\n---\n\nPRIMER…\n\n---\n\nADMIN…\n\n---\nGot a question…` — three separators, primer above admin, admin above footer, exactly what the integration test expects.

- [ ] **Step 6: Run tests, expect pass**

```bash
npx vitest run tests/render.test.js
```

Expected: all render tests passing.

- [ ] **Step 7: Run full suite**

```bash
npm test
```

Expected: 105 passing (96 prior + 9 new). If any existing `worker.test.js` integration test was asserting an exact rendered string and now mismatches by virtue of the new optional arg position, it should still pass because `adminStats` defaults to null.

- [ ] **Step 8: Commit**

```bash
cd /home/claude/marblehead/.worktrees/drip-v2
git add meeting-digest/worker/src/lib/render.js meeting-digest/tests/render.test.js
git commit -m "digest: render admin subscriber-stats block when adminStats arg is set"
```

---

## Task 6: Wire `scheduled.js` to fetch stats and pass to renderer

**Files:**
- Modify: `meeting-digest/worker/src/scheduled.js`
- Modify: `meeting-digest/tests/worker.test.js`

- [ ] **Step 1: Write failing tests in `worker.test.js`**

The render-side assertions for the admin block are covered exhaustively in `tests/render.test.js`. The wiring tests here verify that `scheduled.js` correctly identifies the admin and passes a non-null `adminStats` to the renderer for that subscriber only. To inspect the rendered email per-recipient, we use `vi.spyOn` on the renderer module.

Add to the top of `meeting-digest/tests/worker.test.js` (alongside the existing imports):

```javascript
import * as renderModule from '../worker/src/lib/render.js';
import { vi } from 'vitest';

vi.mock('../worker/src/lib/render.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    renderHtml: vi.fn(actual.renderHtml),
    renderText: vi.fn(actual.renderText)
  };
});
```

Then add to the bottom of the existing `describe('runScheduled', ...)` block:

```javascript
it('passes adminStats to renderHtml only for the subscriber matching env.ADMIN_EMAIL', async () => {
  await confirmedSubscriber('admin@example.com', { boards: ['select-board'], topics: [] });
  await confirmedSubscriber('normal@example.com', { boards: ['select-board'], topics: [] });
  env.ADMIN_EMAIL = 'admin@example.com';

  stubGithubPrimersEmpty();
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

  renderModule.renderHtml.mockClear();
  const out = await runScheduled({}, env, { skipTimeGuard: true });
  expect(out.sent).toBe(2);

  // renderHtml is called once per subscriber. Find the call for each address.
  // Args: (matches, subscriber, env, weekEndingIso, primer, maxPrimerIndex, adminStats)
  const adminCall = renderModule.renderHtml.mock.calls.find(args => args[1].email === 'admin@example.com');
  const normalCall = renderModule.renderHtml.mock.calls.find(args => args[1].email === 'normal@example.com');
  expect(adminCall).toBeTruthy();
  expect(normalCall).toBeTruthy();
  expect(adminCall[6]).not.toBeNull();
  expect(adminCall[6].confirmed.n).toBe(2);  // both subscribers are confirmed
  expect(normalCall[6]).toBeNull();
});

it('passes null adminStats when no subscriber matches env.ADMIN_EMAIL', async () => {
  await confirmedSubscriber('normal@example.com', { boards: ['select-board'], topics: [] });
  env.ADMIN_EMAIL = 'not-subscribed@example.com';

  stubGithubPrimersEmpty();
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

  renderModule.renderHtml.mockClear();
  const out = await runScheduled({}, env, { skipTimeGuard: true });
  expect(out.sent).toBe(1);

  const normalCall = renderModule.renderHtml.mock.calls.find(args => args[1].email === 'normal@example.com');
  expect(normalCall).toBeTruthy();
  expect(normalCall[6]).toBeNull();
});
```

Important: `vi.mock` is hoisted by vitest, so the existing tests in `worker.test.js` will also see the spied versions. The `vi.fn(actual.renderHtml)` wrapper preserves the original behavior, so existing tests that don't inspect the spy continue to pass. The spies are not cleared between tests by default — each new test calls `mockClear()` before running scheduled to reset its own call log.

- [ ] **Step 2: Run, expect failures**

```bash
npx vitest run tests/worker.test.js
```

Expected: the two new tests fail (admin block is never rendered because scheduled.js doesn't pass adminStats).

- [ ] **Step 3: Modify `scheduled.js`**

Open `meeting-digest/worker/src/scheduled.js`. Add to the imports near the top, alongside the existing primer import:

```javascript
import { fetchSubscriberStats } from './lib/admin-stats.js';
```

After the existing primer-fetch block (right after the `console.log` that says `[digest] fetched primers: ...`), add a stats fetch. This runs once per cron, irrespective of whether any subscriber matches `ADMIN_EMAIL` — the cost is one D1 aggregate (~5ms) and shipping the result to the renderer only when the admin is the recipient is simpler than checking eligibility before deciding to fetch:

```javascript
let adminStats = null;
try {
  adminStats = await fetchSubscriberStats(env, now);
  console.log(`[digest] fetched admin stats: confirmed=${adminStats.confirmed.n} pending=${adminStats.pending_confirmation.n}`);
} catch (e) {
  console.log(`[digest] admin stats fetch failed (continuing without block): ${e.message}`);
  adminStats = null;
}
```

In the per-subscriber loop, the existing render calls currently look like:

```javascript
const html = renderHtml(matches, { manage_token: s.manage_token, email: s.email }, env, weekEnding, primer, maxPrimerIndex);
const text = renderText(matches, { manage_token: s.manage_token, email: s.email }, env, weekEnding, primer, maxPrimerIndex);
```

Change to pass `adminStats` only when this subscriber is the admin:

```javascript
const isAdmin = env.ADMIN_EMAIL && s.email === env.ADMIN_EMAIL;
const adminStatsForRecipient = isAdmin ? adminStats : null;
const html = renderHtml(matches, { manage_token: s.manage_token, email: s.email }, env, weekEnding, primer, maxPrimerIndex, adminStatsForRecipient);
const text = renderText(matches, { manage_token: s.manage_token, email: s.email }, env, weekEnding, primer, maxPrimerIndex, adminStatsForRecipient);
```

- [ ] **Step 4: Run tests, expect pass**

```bash
npx vitest run tests/worker.test.js
```

Expected: all worker.test.js tests passing.

- [ ] **Step 5: Run full suite**

```bash
npm test
```

Expected: 107 passing (105 prior + 2 new).

- [ ] **Step 6: Commit**

```bash
cd /home/claude/marblehead/.worktrees/drip-v2
git add meeting-digest/worker/src/scheduled.js meeting-digest/tests/worker.test.js
git commit -m "digest: scheduled.js fetches admin stats and passes to renderer for ADMIN_EMAIL subscriber"
```

---

## Task 7: Final verification and PR

- [ ] **Step 1: Run the full meeting-digest test suite**

```bash
cd /home/claude/marblehead/.worktrees/drip-v2/meeting-digest
npm test 2>&1 | tail -15
```

Confirm: ~107 passing (87 baseline + 2 footer + 7 stats + 9 render + 2 worker integration = 107). Zero failing. No un-intercepted fetch warnings.

- [ ] **Step 2: Push the branch**

```bash
cd /home/claude/marblehead/.worktrees/drip-v2
git push -u origin digest-drip-primer-v2 2>&1 | tail -5
```

If push fails for any reason, STOP and report BLOCKED with the error. Do not retry.

- [ ] **Step 3: Open the PR**

```bash
cd /home/claude/marblehead/.worktrees/drip-v2
gh pr create --title "digest: drip primer v2 (weeks 2-6, reply-prompt footer, admin stats)" --body "$(cat <<'EOF'
## Summary

- Ships 5 new primer files: weeks 2-6 (org chart, debt, spending, action, verify).
- Trims week 1 (welcome) by dropping the redundant reply line.
- Adds a permanent reply-prompt line to every digest's footer: "Got a question or correction? Just reply to this email."
- Adds an admin-only subscriber-stats block, appended to the digest sent to ``env.ADMIN_EMAIL``.

## Preview URL

Cloudflare Pages preview will appear once the deploy completes. The drip-primer changes are Worker plus email render only, with no UI to preview. The five new _primers/ markdown files do show on GitHub.

## Test plan

- [ ] CI: meeting-digest vitest suite is green (target ~107 passing).
- [ ] After merge: ``npm run deploy`` for the Worker (no D1 migration required).
- [ ] After merge: subscribe via the public form using ``agbaber@gmail.com`` if not already a confirmed subscriber.
- [ ] After merge: on next Monday cron, expect the digest to include the reply-prompt footer line for every subscriber, and the admin stats block only for ``agbaber@gmail.com``.
- [ ] After merge: confirm PostHog sees clicks on ``utm_campaign=primer-week-2`` through ``primer-week-6`` over the next 5 weeks.

## Proof of Work

- Tests: full meeting-digest vitest suite passing locally (107/107 expected).
- Jekyll build: ``_primers/`` continues to be excluded from ``_site/`` via the existing ``output: false`` collection config.

Spec: ``docs/superpowers/specs/2026-06-19-meeting-digest-drip-primer-v2-design.md``
Plan: ``docs/superpowers/plans/2026-06-19-meeting-digest-drip-primer-v2.md``

Generated with [Claude Code](https://claude.ai/code)
via [Happy](https://happy.engineering)
EOF
)" 2>&1 | tail -3
```

- [ ] **Step 4: Confirm PR is open**

```bash
gh pr view --json url,number,headRefName 2>&1
```

Report the URL.

---

## Notes for the executor

- **Run all bash commands from the worktree.** `/home/claude/marblehead/.worktrees/drip-v2/` for repo-wide commands; `cd meeting-digest` first for vitest.
- **No D1 migration required.** This is the first feature in a while that doesn't touch the schema.
- **Existing primer tests still pass unchanged.** The `adminStats` arg defaults to null on both renderers, so primer-only tests don't need to thread it through.
- **The Resend stub override pattern** (`cleanMocks()` before re-registering) is in `tests/worker.test.js` already from the previous PR. Reuse it for the "captures sent bodies" test in Task 6.
- **No feature flag.** Per spec rationale: 2 confirmed subscribers, deterministic content, low blast radius.
- **If you find a test asserting the exact text of the footer** (whole-string comparison), update it to include the new reply-prompt line. Don't try to preserve the old text — the new line is now permanent chrome.
- **If a hook fails** during commit, fix the issue and create a NEW commit. Never `--amend` after a hook failure.
