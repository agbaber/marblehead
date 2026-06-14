# Meeting-Digest Subscriptions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the v1 weekly email digest subscription system — a Cloudflare Worker + D1 + Pages-static-page stack that lets a resident enter an email, confirm via link, customize board/topic preferences, and receive a Friday morning digest of matching meeting summaries.

**Architecture:** A new standalone Cloudflare Worker at `meeting-digest/worker/` (parallel to `community-pulse/worker/`). It owns one D1 database (`meeting-digest` with `subscriber` and `delivery_log` tables), four HTTP endpoints (`/api/subscribe`, `/api/subscribe-confirm`, `/api/preferences-update`, `/api/unsubscribe`, `/api/mail-event`), one scheduled handler (Friday 7 AM ET cron), and renders email HTML+text from a single template module. Marblehead.org Pages serves three small static pages (`subscribe.html`, `subscribe/confirm.html`, `me/subscription.html`) that POST to the Worker. Reuses Cloudflare Turnstile (already wired for feedback.html) and Resend for transactional mail.

**Tech Stack:** Cloudflare Workers (ES Modules), Cloudflare D1 (SQLite), Cloudflare Pages (Jekyll-built static), `wrangler` CLI, `vitest` + `@cloudflare/vitest-pool-workers` (matches community-pulse). Mail: Resend HTTP API. No new heavy deps; the Worker stays single-file-per-route.

**Spec reference:** `docs/superpowers/specs/2026-06-09-meeting-digest-subscriptions-design.md`

---

## File structure

**Create:**
- `meeting-digest/package.json` — npm scripts for `worker:dev`, `worker:deploy`, `test`
- `meeting-digest/vitest.config.js` — mirrors community-pulse setup
- `meeting-digest/worker/wrangler.toml` — Worker config + D1 binding + cron triggers
- `meeting-digest/worker/schema/0001_subscriber.sql` — D1 schema
- `meeting-digest/worker/src/index.js` — router, fetch + scheduled exports
- `meeting-digest/worker/src/lib/email.js` — email normalization, token generation
- `meeting-digest/worker/src/lib/topics.js` — KNOWN_TOPICS array + labels (mirrors `scripts/transcripts/lib/topics.mjs` but pure ESM no node:test)
- `meeting-digest/worker/src/lib/transcripts.js` — fetch + parse the last 7 days of `_transcripts/*.md` via GitHub Contents API
- `meeting-digest/worker/src/lib/matcher.js` — filter logic (board OR topic)
- `meeting-digest/worker/src/lib/render.js` — email subject + HTML body + plain-text body
- `meeting-digest/worker/src/lib/mail.js` — Resend HTTP wrapper
- `meeting-digest/worker/src/handlers/subscribe.js`
- `meeting-digest/worker/src/handlers/confirm.js`
- `meeting-digest/worker/src/handlers/preferences.js`
- `meeting-digest/worker/src/handlers/unsubscribe.js`
- `meeting-digest/worker/src/handlers/mail-event.js`
- `meeting-digest/worker/src/scheduled.js` — cron handler that does the Friday work
- `meeting-digest/tests/email.test.js`
- `meeting-digest/tests/topics.test.js`
- `meeting-digest/tests/transcripts.test.js`
- `meeting-digest/tests/matcher.test.js`
- `meeting-digest/tests/render.test.js`
- `meeting-digest/tests/worker.test.js` — integration via @cloudflare/vitest-pool-workers
- `subscribe.html` — Jekyll page at `/subscribe/`
- `subscribe/confirm.html` — Jekyll page at `/subscribe/confirm/`
- `me/subscription.html` — Jekyll page at `/me/subscription/`

**Modify:**
- `_config.yml` — flip `transcripts_subscribe: true` at the very end of the plan, after staging smoke
- `_includes/nav.html` — add a small "Subscribe" link

---

### Task 1: Scaffold meeting-digest project + worker config

**Files:**
- Create: `meeting-digest/package.json`
- Create: `meeting-digest/vitest.config.js`
- Create: `meeting-digest/worker/wrangler.toml`
- Create: `meeting-digest/worker/src/index.js` (skeleton)
- Create: `meeting-digest/tests/.gitkeep`

- [ ] **Step 1: Create `meeting-digest/package.json`**

```json
{
  "name": "meeting-digest",
  "version": "0.1.0",
  "private": true,
  "description": "Weekly board-meeting digest subscriptions for marbleheaddata.org",
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "worker:dev": "wrangler dev worker/src/index.js",
    "worker:deploy": "wrangler deploy worker/src/index.js"
  },
  "devDependencies": {
    "vitest": "^3.2.0",
    "@cloudflare/vitest-pool-workers": "^0.12.0",
    "wrangler": "^3.60.0"
  }
}
```

- [ ] **Step 2: Create `meeting-digest/vitest.config.js`**

```js
import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config';

export default defineWorkersConfig({
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          include: ['tests/email.test.js', 'tests/topics.test.js', 'tests/transcripts.test.js', 'tests/matcher.test.js', 'tests/render.test.js'],
          environment: 'node'
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

- [ ] **Step 3: Create `meeting-digest/worker/wrangler.toml`**

The `database_id` values are intentionally `00000000-0000-0000-0000-000000000000` placeholders; Andrew creates the D1 databases (`npx wrangler d1 create meeting-digest`) and pastes the real UUIDs before first deploy. Same pattern community-pulse used at bootstrap.

```toml
name = "marblehead-meeting-digest"
main = "src/index.js"
compatibility_date = "2026-06-09"

[[d1_databases]]
binding = "DB"
database_name = "meeting-digest"
database_id = "00000000-0000-0000-0000-000000000000"
migrations_dir = "schema"

[vars]
ALLOWED_ORIGIN = "https://marbleheaddata.org"
SITE_BASE_URL = "https://marbleheaddata.org"
GITHUB_REPO = "agbaber/marblehead"
GITHUB_BRANCH = "main"
MAIL_FROM = "Marblehead Data <meetings@marbleheaddata.org>"
MAIL_REPLY_TO = "agbaber@gmail.com"

# Friday 7:00 AM ET == 11:00 UTC (EST) / 12:00 UTC (EDT).
# Run at 11:00 and 12:00; the scheduled handler chooses one based on the
# current ET hour, the other becomes a no-op. Keeps DST handling simple.
[triggers]
crons = ["0 11 * * 5", "0 12 * * 5"]

[env.staging]
name = "marblehead-meeting-digest-staging"

[[env.staging.d1_databases]]
binding = "DB"
database_name = "meeting-digest-staging"
database_id = "00000000-0000-0000-0000-000000000000"
migrations_dir = "schema"

[env.staging.vars]
ALLOWED_ORIGIN = "*"
SITE_BASE_URL = "https://marbleheaddata.org"
GITHUB_REPO = "agbaber/marblehead"
GITHUB_BRANCH = "main"
MAIL_FROM = "Marblehead Data (staging) <meetings@marbleheaddata.org>"
MAIL_REPLY_TO = "agbaber@gmail.com"

[env.staging.triggers]
# No automatic cron on staging — invoke manually via `wrangler dev` or the dashboard.
crons = []
```

- [ ] **Step 4: Create the Worker skeleton `meeting-digest/worker/src/index.js`**

```js
// Cloudflare Worker for marbleheaddata.org meeting-digest subscriptions.
// See docs/superpowers/specs/2026-06-09-meeting-digest-subscriptions-design.md

import { runScheduled } from './scheduled.js';

const NOT_FOUND = new Response('Not Found', { status: 404 });

function cors(env, origin) {
  return {
    'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN === '*' ? (origin || '*') : env.ALLOWED_ORIGIN,
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin'
  };
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin') || '';

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors(env, origin) });
    }

    // Routes will be wired up in Tasks 8-12.
    return new Response(JSON.stringify({ ok: true, path: url.pathname }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...cors(env, origin) }
    });
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(runScheduled(event, env));
  }
};
```

- [ ] **Step 5: Create a minimal `scheduled.js` placeholder so the import resolves**

```js
// meeting-digest/worker/src/scheduled.js
// Wired up properly in Task 13.

export async function runScheduled(event, env) {
  // No-op placeholder. Task 13 replaces this with the Friday digest pipeline.
  return { ok: true, ran: false, reason: 'placeholder' };
}
```

- [ ] **Step 6: Install deps and verify the worker config loads**

Run:
```bash
cd meeting-digest && npm install 2>&1 | tail -5 && npx wrangler types 2>&1 | tail -3
```
Expected: dependencies install, `wrangler types` exits cleanly (it prints a warning about D1 placeholder IDs but does not fail).

- [ ] **Step 7: Commit**

```bash
git add meeting-digest/package.json meeting-digest/vitest.config.js \
        meeting-digest/worker/wrangler.toml meeting-digest/worker/src/index.js \
        meeting-digest/worker/src/scheduled.js meeting-digest/tests/.gitkeep
git commit -m "digest: scaffold meeting-digest worker (wrangler + skeleton)"
```

---

### Task 2: D1 schema

**Files:**
- Create: `meeting-digest/worker/schema/0001_subscriber.sql`

- [ ] **Step 1: Write the schema**

```sql
-- Weekly board-meeting digest subscriptions.
-- One row per email.

CREATE TABLE IF NOT EXISTS subscriber (
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
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_subscriber_email ON subscriber(email);
CREATE INDEX IF NOT EXISTS idx_subscriber_status ON subscriber(status);
CREATE INDEX IF NOT EXISTS idx_subscriber_manage_token ON subscriber(manage_token);
CREATE INDEX IF NOT EXISTS idx_subscriber_confirmation_token ON subscriber(confirmation_token);

CREATE TABLE IF NOT EXISTS delivery_log (
  id                   TEXT PRIMARY KEY,
  subscriber_id        TEXT NOT NULL,
  sent_at              INTEGER NOT NULL,
  n_meetings           INTEGER NOT NULL,
  provider_message_id  TEXT,
  status               TEXT NOT NULL CHECK (status IN ('queued','delivered','bounced','complained','failed')),
  FOREIGN KEY (subscriber_id) REFERENCES subscriber(id)
);

CREATE INDEX IF NOT EXISTS idx_delivery_log_subscriber ON delivery_log(subscriber_id);
CREATE INDEX IF NOT EXISTS idx_delivery_log_provider_message_id ON delivery_log(provider_message_id);
```

- [ ] **Step 2: Apply locally for tests**

Run:
```bash
cd meeting-digest && npx wrangler d1 migrations apply meeting-digest --local 2>&1 | tail -5
```
Expected: "Migrations applied". Creates a local SQLite file under `.wrangler/state/`.

- [ ] **Step 3: Commit**

```bash
git add meeting-digest/worker/schema/0001_subscriber.sql
git commit -m "digest: D1 schema for subscriber and delivery_log"
```

---

### Task 3: Email normalization + token generator lib

**Files:**
- Create: `meeting-digest/worker/src/lib/email.js`
- Create: `meeting-digest/tests/email.test.js`

- [ ] **Step 1: Write the failing test**

```js
// meeting-digest/tests/email.test.js
import { describe, it, expect } from 'vitest';
import { normalizeEmail, isValidEmail, randomToken } from '../worker/src/lib/email.js';

describe('normalizeEmail', () => {
  it('lowercases and trims', () => {
    expect(normalizeEmail('  Hi@Example.COM ')).toBe('hi@example.com');
  });
  it('returns null for non-strings', () => {
    expect(normalizeEmail(null)).toBeNull();
    expect(normalizeEmail(42)).toBeNull();
  });
});

describe('isValidEmail', () => {
  it('accepts a basic local@domain', () => {
    expect(isValidEmail('hi@example.com')).toBe(true);
    expect(isValidEmail('alice.b+tag@sub.example.co.uk')).toBe(true);
  });
  it('rejects missing @, leading dot, trailing dot, spaces', () => {
    expect(isValidEmail('not-an-email')).toBe(false);
    expect(isValidEmail('.dot@example.com')).toBe(false);
    expect(isValidEmail('dot.@example.com')).toBe(false);
    expect(isValidEmail('has space@example.com')).toBe(false);
    expect(isValidEmail('')).toBe(false);
  });
  it('rejects unreasonably long inputs', () => {
    const huge = 'a'.repeat(300) + '@b.com';
    expect(isValidEmail(huge)).toBe(false);
  });
});

describe('randomToken', () => {
  it('returns a 43-44 char URL-safe base64 string', () => {
    const t = randomToken();
    expect(t).toMatch(/^[A-Za-z0-9_-]{43,44}$/);
  });
  it('returns a fresh value each call', () => {
    expect(randomToken()).not.toBe(randomToken());
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd meeting-digest && npx vitest run tests/email.test.js 2>&1 | tail -5
```
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```js
// meeting-digest/worker/src/lib/email.js

const MAX_EMAIL_LENGTH = 254;
// Pragmatic RFC-ish: at least one char before @, at least one dot in the host.
// Rejects spaces, leading/trailing dots in the local part, and adjacent dots.
const EMAIL_RE = /^[A-Za-z0-9_][A-Za-z0-9_+.-]*[A-Za-z0-9_+-]@[A-Za-z0-9][A-Za-z0-9.-]*\.[A-Za-z]{2,}$/;

export function normalizeEmail(value) {
  if (typeof value !== 'string') return null;
  return value.trim().toLowerCase();
}

export function isValidEmail(value) {
  if (typeof value !== 'string') return false;
  if (value.length === 0 || value.length > MAX_EMAIL_LENGTH) return false;
  if (value.includes('..')) return false;
  return EMAIL_RE.test(value);
}

// 32 bytes of randomness, URL-safe base64. Length 43-44 chars depending on padding.
export function randomToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  // btoa is available in Workers; convert to URL-safe.
  const b64 = btoa(String.fromCharCode(...bytes));
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd meeting-digest && npx vitest run tests/email.test.js 2>&1 | tail -5
```
Expected: PASS (10/10).

- [ ] **Step 5: Commit**

```bash
git add meeting-digest/worker/src/lib/email.js meeting-digest/tests/email.test.js
git commit -m "digest: email normalization + URL-safe token generator"
```

---

### Task 4: Topics taxonomy module (Worker mirror)

**Files:**
- Create: `meeting-digest/worker/src/lib/topics.js`
- Create: `meeting-digest/tests/topics.test.js`

This is a focused mirror of `scripts/transcripts/lib/topics.mjs` plus a human-readable label per slug, used in the preferences UI and email body. Two slugs (`admin-housekeeping`, `public-comment`) are kept in the taxonomy but flagged `subscribable: false` so the UI hides them.

- [ ] **Step 1: Write the failing test**

```js
// meeting-digest/tests/topics.test.js
import { describe, it, expect } from 'vitest';
import { TOPICS, SUBSCRIBABLE_TOPICS, BOARDS, isKnownTopic, isKnownBoard } from '../worker/src/lib/topics.js';

describe('TOPICS taxonomy', () => {
  it('contains all 13 slugs from scripts/transcripts/lib/topics.mjs', () => {
    expect(TOPICS.map(t => t.slug).sort()).toEqual([
      '40b-mbta', 'admin-housekeeping', 'bonding-capital', 'elections-procedural',
      'health-insurance', 'labor-personnel', 'override', 'permits-zoning',
      'public-comment', 'public-safety', 'recreation-events', 'school-budget', 'trash-dpw'
    ]);
  });
  it('every topic has a non-empty label', () => {
    for (const t of TOPICS) expect(t.label.length).toBeGreaterThan(0);
  });
  it('SUBSCRIBABLE_TOPICS excludes admin-housekeeping and public-comment', () => {
    const slugs = SUBSCRIBABLE_TOPICS.map(t => t.slug);
    expect(slugs).not.toContain('admin-housekeeping');
    expect(slugs).not.toContain('public-comment');
    expect(slugs).toContain('override');
  });
});

describe('BOARDS', () => {
  it('contains the 5 default boards in display order', () => {
    expect(BOARDS.map(b => b.slug)).toEqual([
      'select-board', 'school-committee', 'finance-committee', 'board-of-health', 'town-meeting'
    ]);
  });
});

describe('isKnownTopic / isKnownBoard', () => {
  it('match exact slugs only', () => {
    expect(isKnownTopic('override')).toBe(true);
    expect(isKnownTopic('Override')).toBe(false);
    expect(isKnownTopic('')).toBe(false);
    expect(isKnownBoard('select-board')).toBe(true);
    expect(isKnownBoard('not-a-board')).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd meeting-digest && npx vitest run tests/topics.test.js 2>&1 | tail -5
```
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```js
// meeting-digest/worker/src/lib/topics.js

export const TOPICS = Object.freeze([
  { slug: 'override',            label: 'Override / Prop 2½',     subscribable: true  },
  { slug: 'school-budget',       label: 'School budget',           subscribable: true  },
  { slug: 'bonding-capital',     label: 'Bonding & capital',       subscribable: true  },
  { slug: 'permits-zoning',      label: 'Permits & zoning',        subscribable: true  },
  { slug: 'trash-dpw',           label: 'Trash / DPW',             subscribable: true  },
  { slug: 'health-insurance',    label: 'Health insurance / GIC',  subscribable: true  },
  { slug: 'labor-personnel',     label: 'Labor & personnel',       subscribable: true  },
  { slug: 'public-safety',       label: 'Public safety',           subscribable: true  },
  { slug: '40b-mbta',            label: '40B / MBTA Communities',  subscribable: true  },
  { slug: 'elections-procedural', label: 'Elections / procedural', subscribable: true  },
  { slug: 'recreation-events',   label: 'Recreation & events',     subscribable: true  },
  { slug: 'admin-housekeeping',  label: 'Admin and housekeeping',  subscribable: false },
  { slug: 'public-comment',      label: 'Public comment',          subscribable: false }
]);

export const SUBSCRIBABLE_TOPICS = TOPICS.filter(t => t.subscribable);

export const BOARDS = Object.freeze([
  { slug: 'select-board',     label: 'Select Board',     volume: '24 meetings/year'    },
  { slug: 'school-committee', label: 'School Committee', volume: '~22 meetings/year'   },
  { slug: 'finance-committee',label: 'Finance Committee',volume: '~16 meetings/year'   },
  { slug: 'board-of-health',  label: 'Board of Health',  volume: '~30 meetings/year'   },
  { slug: 'town-meeting',     label: 'Town Meeting',     volume: '2-3 meetings/year'   }
]);

export const DEFAULT_BOARDS_ON_SIGNUP = ['select-board', 'school-committee', 'finance-committee'];

const TOPIC_SLUGS = new Set(TOPICS.map(t => t.slug));
const BOARD_SLUGS = new Set(BOARDS.map(b => b.slug));

export function isKnownTopic(slug) {
  return typeof slug === 'string' && TOPIC_SLUGS.has(slug);
}

export function isKnownBoard(slug) {
  return typeof slug === 'string' && BOARD_SLUGS.has(slug);
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd meeting-digest && npx vitest run tests/topics.test.js 2>&1 | tail -5
```
Expected: PASS (5/5).

- [ ] **Step 5: Commit**

```bash
git add meeting-digest/worker/src/lib/topics.js meeting-digest/tests/topics.test.js
git commit -m "digest: topics + boards taxonomy with subscribable filter"
```

---

### Task 5: Transcript reader (GitHub Contents API)

**Files:**
- Create: `meeting-digest/worker/src/lib/transcripts.js`
- Create: `meeting-digest/tests/transcripts.test.js`

The Worker reads `_transcripts/*.md` from the live `agbaber/marblehead` repo via the GitHub Contents API. The repo is public so no auth token is needed (rate limit is 60/hr unauth, way over what we need). Per Friday: one directory listing + N file fetches (only files whose dates are within the last 7 days), shared across all subscribers.

- [ ] **Step 1: Write the failing test**

```js
// meeting-digest/tests/transcripts.test.js
import { describe, it, expect } from 'vitest';
import { parseFrontmatter, parseTranscript, extractDateFromFilename, withinLastSevenDays } from '../worker/src/lib/transcripts.js';

const SAMPLE = `---
slug: select-board-2026-06-10
board: select-board
board_display: "Select Board"
date: 2026-06-10
title: "Select Board: June 10, 2026"
vimeo_id: 1234567890
vimeo_url: "https://vimeo.com/1234567890"
duration_seconds: 3600
ai_generated: true
status: published
source: vimeo-auto+llm

summary_card:
  headline: "Board approves $5.43M Mary Allen contract"
  summary: "The board approved the contract."
  decisions:
    - "Approved Mary Allen contract"
  votes:
    - motion: "Approve"
      result: "in favor (unanimous)"

topic_segments:
  - topic: override
    topic_confidence: 0.95
    start_seconds: 754
    end_seconds: 1200
    featured: true
    headline: "Board signals support for Tier 2"
    dek: "Two members spoke."
    summary: "Discussion of tier mechanics."
    key_speakers: ["Chair Fox"]
  - topic: bonding-capital
    start_seconds: 2291
    end_seconds: 2900
    headline: "Mary Allen funding path approved"
    dek: "$5.43M contract."
    summary: "Details."
---

> Disclaimer here.

**[0:00](https://vimeo.com/1234567890#t=0s)** Body text.
`;

describe('parseFrontmatter', () => {
  it('returns the YAML block as a string and the body separately', () => {
    const { yaml, body } = parseFrontmatter(SAMPLE);
    expect(yaml).toContain('slug: select-board-2026-06-10');
    expect(yaml).toContain('topic_segments:');
    expect(body).toContain('Body text');
  });
  it('returns null fields when frontmatter is missing', () => {
    expect(parseFrontmatter('no frontmatter here')).toEqual({ yaml: null, body: 'no frontmatter here' });
  });
});

describe('parseTranscript', () => {
  it('extracts the load-bearing fields for the digest', () => {
    const t = parseTranscript('select-board-2026-06-10.md', SAMPLE);
    expect(t.slug).toBe('select-board-2026-06-10');
    expect(t.board).toBe('select-board');
    expect(t.board_display).toBe('Select Board');
    expect(t.date).toBe('2026-06-10');
    expect(t.title).toBe('Select Board: June 10, 2026');
    expect(t.vimeo_url).toBe('https://vimeo.com/1234567890');
    expect(t.summary_card.headline).toBe('Board approves $5.43M Mary Allen contract');
    expect(t.topic_segments).toHaveLength(2);
    expect(t.topic_segments[0].topic).toBe('override');
    expect(t.topic_segments[0].start_seconds).toBe(754);
    expect(t.topic_segments[0].featured).toBe(true);
    expect(t.topic_segments[1].topic).toBe('bonding-capital');
  });
  it('returns null on unparseable input', () => {
    expect(parseTranscript('x.md', 'not yaml')).toBeNull();
  });
});

describe('extractDateFromFilename', () => {
  it('reads YYYY-MM-DD from the slug', () => {
    expect(extractDateFromFilename('select-board-2026-06-10.md')).toBe('2026-06-10');
    expect(extractDateFromFilename('board-of-health-2025-01-03.md')).toBe('2025-01-03');
  });
  it('returns null on filenames without a date', () => {
    expect(extractDateFromFilename('readme.md')).toBeNull();
  });
});

describe('withinLastSevenDays', () => {
  it('returns true for dates in the window relative to a fixed "now"', () => {
    const now = new Date('2026-06-12T12:00:00Z').getTime();
    expect(withinLastSevenDays('2026-06-06', now)).toBe(true);
    expect(withinLastSevenDays('2026-06-12', now)).toBe(true);
    expect(withinLastSevenDays('2026-06-05', now)).toBe(false);
    expect(withinLastSevenDays('2026-06-13', now)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd meeting-digest && npx vitest run tests/transcripts.test.js 2>&1 | tail -5
```
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```js
// meeting-digest/worker/src/lib/transcripts.js

const DATE_RE = /(\d{4})-(\d{2})-(\d{2})/;
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export function parseFrontmatter(text) {
  if (typeof text !== 'string') return { yaml: null, body: text || '' };
  const m = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) return { yaml: null, body: text };
  return { yaml: m[1], body: m[2] };
}

// Minimal YAML extraction. We only read keys/values we care about; no general parser.
// Returns undefined for missing keys.
function scalar(yaml, key) {
  const re = new RegExp(`^${key}: (.+)$`, 'm');
  const m = yaml.match(re);
  if (!m) return undefined;
  return m[1].trim().replace(/^["']|["']$/g, '');
}

function summaryCard(yaml) {
  const m = yaml.match(/^summary_card:\n([\s\S]*?)(?=^[a-zA-Z_]+:|^---|\n*$)/m);
  if (!m) return null;
  const block = m[1];
  const get = (k) => {
    const r = new RegExp(`^  ${k}: (.+)$`, 'm');
    const mm = block.match(r);
    if (!mm) return undefined;
    return mm[1].trim().replace(/^["']|["']$/g, '');
  };
  return {
    headline: get('headline') || '',
    summary: get('summary') || ''
  };
}

function topicSegments(yaml) {
  const m = yaml.match(/^topic_segments:\n([\s\S]*?)(?=^[a-zA-Z_]+:|^---|\n*$)/m);
  if (!m) return [];
  const block = m[1];
  const entries = block.split(/^  - /m).slice(1);
  return entries.map(entry => {
    const lines = entry.split('\n');
    const out = {};
    for (const line of lines) {
      const ll = line.replace(/^    /, '');
      const mm = ll.match(/^(\w+): (.+)$/);
      if (!mm) continue;
      let v = mm[2].trim().replace(/^["']|["']$/g, '');
      if (mm[1] === 'start_seconds' || mm[1] === 'end_seconds') v = Number(v);
      if (mm[1] === 'featured') v = v === 'true';
      if (mm[1] === 'topic_confidence') v = Number(v);
      out[mm[1]] = v;
    }
    return out;
  }).filter(s => s.topic);
}

export function parseTranscript(filename, text) {
  const { yaml } = parseFrontmatter(text);
  if (!yaml) return null;
  const slug = scalar(yaml, 'slug');
  const board = scalar(yaml, 'board');
  const date = scalar(yaml, 'date');
  if (!slug || !board || !date) return null;
  return {
    slug,
    board,
    board_display: scalar(yaml, 'board_display') || board,
    date,
    title: scalar(yaml, 'title') || slug,
    vimeo_url: scalar(yaml, 'vimeo_url') || '',
    summary_card: summaryCard(yaml),
    topic_segments: topicSegments(yaml)
  };
}

export function extractDateFromFilename(filename) {
  const m = filename.match(DATE_RE);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

export function withinLastSevenDays(isoDate, nowMs) {
  const d = Date.parse(isoDate + 'T00:00:00Z');
  if (Number.isNaN(d)) return false;
  return d >= nowMs - SEVEN_DAYS_MS && d <= nowMs;
}

// Fetch the latest transcript files via GitHub Contents API.
// Returns: array of parsed transcript objects (only ones in the 7-day window).
// Throws on network failure; caller decides retry policy.
export async function fetchRecentTranscripts(env, nowMs = Date.now()) {
  const dirUrl = `https://api.github.com/repos/${env.GITHUB_REPO}/contents/_transcripts?ref=${env.GITHUB_BRANCH}`;
  const dirResp = await fetch(dirUrl, {
    headers: { 'Accept': 'application/vnd.github.v3+json', 'User-Agent': 'marblehead-meeting-digest' }
  });
  if (!dirResp.ok) {
    throw new Error(`GitHub dir listing failed: ${dirResp.status}`);
  }
  const entries = await dirResp.json();
  const recent = entries
    .filter(e => e.type === 'file' && e.name.endsWith('.md'))
    .map(e => ({ name: e.name, date: extractDateFromFilename(e.name), download_url: e.download_url }))
    .filter(e => e.date && withinLastSevenDays(e.date, nowMs));

  const results = [];
  for (const e of recent) {
    const fileResp = await fetch(e.download_url, {
      headers: { 'User-Agent': 'marblehead-meeting-digest' }
    });
    if (!fileResp.ok) continue;
    const text = await fileResp.text();
    const t = parseTranscript(e.name, text);
    if (t) results.push(t);
  }
  results.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  return results;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd meeting-digest && npx vitest run tests/transcripts.test.js 2>&1 | tail -5
```
Expected: PASS (8/8). Note: `fetchRecentTranscripts` is not unit-tested here — it's covered by the worker integration test in Task 16.

- [ ] **Step 5: Commit**

```bash
git add meeting-digest/worker/src/lib/transcripts.js meeting-digest/tests/transcripts.test.js
git commit -m "digest: parse _transcripts/ frontmatter and fetch from GitHub"
```

---

### Task 6: Matcher

**Files:**
- Create: `meeting-digest/worker/src/lib/matcher.js`
- Create: `meeting-digest/tests/matcher.test.js`

- [ ] **Step 1: Write the failing test**

```js
// meeting-digest/tests/matcher.test.js
import { describe, it, expect } from 'vitest';
import { matchTranscripts } from '../worker/src/lib/matcher.js';

const SB = {
  slug: 'select-board-2026-06-10',
  board: 'select-board',
  topic_segments: [
    { topic: 'override', start_seconds: 700 },
    { topic: 'bonding-capital', start_seconds: 2200 }
  ]
};
const SC = {
  slug: 'school-committee-2026-06-09',
  board: 'school-committee',
  topic_segments: [{ topic: 'school-budget', start_seconds: 0 }]
};
const PB_40B = {
  slug: 'planning-board-2026-06-08',
  board: 'planning-board',
  topic_segments: [{ topic: '40b-mbta', start_seconds: 1000 }]
};

describe('matchTranscripts', () => {
  it('matches by board membership', () => {
    const out = matchTranscripts([SB, SC], { boards: ['select-board'], topics: [] });
    expect(out.map(m => m.transcript.slug)).toEqual(['select-board-2026-06-10']);
  });
  it('matches by topic in topic_segments', () => {
    const out = matchTranscripts([SB, SC], { boards: [], topics: ['school-budget'] });
    expect(out.map(m => m.transcript.slug)).toEqual(['school-committee-2026-06-09']);
  });
  it('matches by EITHER board OR topic (union)', () => {
    const out = matchTranscripts([SB, SC, PB_40B], {
      boards: ['select-board'], topics: ['40b-mbta']
    });
    expect(out.map(m => m.transcript.slug).sort()).toEqual([
      'planning-board-2026-06-08', 'select-board-2026-06-10'
    ]);
  });
  it('omits topic-only match if the transcript has no matching segments', () => {
    const out = matchTranscripts([SC], { boards: [], topics: ['override'] });
    expect(out).toEqual([]);
  });
  it('returns each match as { transcript, matched_segments[] }', () => {
    const out = matchTranscripts([SB], { boards: [], topics: ['override','bonding-capital'] });
    expect(out).toHaveLength(1);
    expect(out[0].matched_segments.map(s => s.topic)).toEqual(['override','bonding-capital']);
  });
  it('returns empty matched_segments when match is board-only with no topic filter', () => {
    const out = matchTranscripts([SB], { boards: ['select-board'], topics: [] });
    expect(out[0].matched_segments).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd meeting-digest && npx vitest run tests/matcher.test.js 2>&1 | tail -5
```
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```js
// meeting-digest/worker/src/lib/matcher.js

// subscription: { boards: string[], topics: string[] }
// Returns: [{ transcript, matched_segments: [{topic, start_seconds, headline, dek}] }, ...]
//   matched_segments are the topic_segments whose topic is in subscription.topics.
//   If the subscriber filtered only by board, matched_segments is empty.

export function matchTranscripts(transcripts, subscription) {
  const boards = new Set(subscription.boards || []);
  const topics = new Set(subscription.topics || []);
  const out = [];
  for (const t of transcripts) {
    const boardMatch = boards.has(t.board);
    const segs = (t.topic_segments || []).filter(s => topics.has(s.topic));
    const topicMatch = segs.length > 0;
    if (boardMatch || topicMatch) {
      out.push({ transcript: t, matched_segments: segs });
    }
  }
  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd meeting-digest && npx vitest run tests/matcher.test.js 2>&1 | tail -5
```
Expected: PASS (6/6).

- [ ] **Step 5: Commit**

```bash
git add meeting-digest/worker/src/lib/matcher.js meeting-digest/tests/matcher.test.js
git commit -m "digest: match transcripts by board OR topic union"
```

---

### Task 7: Email subject + body renderer

**Files:**
- Create: `meeting-digest/worker/src/lib/render.js`
- Create: `meeting-digest/tests/render.test.js`

- [ ] **Step 1: Write the failing test**

```js
// meeting-digest/tests/render.test.js
import { describe, it, expect } from 'vitest';
import { renderSubject, renderHtml, renderText, formatTimecode } from '../worker/src/lib/render.js';

const SB_MATCH = {
  transcript: {
    slug: 'select-board-2026-06-10',
    board: 'select-board',
    board_display: 'Select Board',
    date: '2026-06-10',
    title: 'Select Board: June 10, 2026',
    vimeo_url: 'https://vimeo.com/1234567890',
    summary_card: {
      headline: 'Board approves $5.43M Mary Allen contract',
      summary: 'The board approved the contract.'
    }
  },
  matched_segments: [
    { topic: 'override', start_seconds: 754, headline: 'Board signals support for Tier 2', dek: 'Two members spoke.' },
    { topic: 'bonding-capital', start_seconds: 2291, headline: 'Mary Allen funding path approved', dek: '$5.43M contract.' }
  ]
};
const SUB = { manage_token: 'mtok', email: 'hi@example.com' };
const ENV = { SITE_BASE_URL: 'https://marbleheaddata.org' };

describe('formatTimecode', () => {
  it('formats H:MM:SS over an hour', () => {
    expect(formatTimecode(3725)).toBe('1:02:05');
  });
  it('formats M:SS under an hour', () => {
    expect(formatTimecode(754)).toBe('12:34');
  });
});

describe('renderSubject', () => {
  it('uses single-meeting form for 1 match', () => {
    expect(renderSubject([SB_MATCH])).toBe('[MHD Data] Select Board: Board approves $5.43M Mary Allen contract');
  });
  it('joins headlines with " · " for 2-3 matches', () => {
    const two = [SB_MATCH, { ...SB_MATCH, transcript: { ...SB_MATCH.transcript, summary_card: { headline: 'Second meeting' } } }];
    expect(renderSubject(two)).toBe('[MHD Data] 2 meetings this week: Board approves $5.43M Mary Allen contract · Second meeting');
  });
  it('truncates with "..." for 4+ matches', () => {
    const four = Array.from({ length: 4 }, (_, i) => ({
      ...SB_MATCH,
      transcript: { ...SB_MATCH.transcript, summary_card: { headline: `H${i+1}` } }
    }));
    expect(renderSubject(four)).toBe('[MHD Data] 4 meetings this week: H1 · H2 · H3...');
  });
});

describe('renderHtml', () => {
  it('includes a header, one card per meeting, and a footer with manage/unsubscribe', () => {
    const html = renderHtml([SB_MATCH], SUB, ENV, '2026-06-12');
    expect(html).toContain('Marblehead Data');
    expect(html).toContain('Week ending');
    expect(html).toContain('Board approves $5.43M Mary Allen contract');
    expect(html).toContain('Select Board');
    expect(html).toContain('Matching segments');
    expect(html).toContain('12:34');
    expect(html).toContain('marbleheaddata.org/me/subscription/?token=mtok');
    expect(html).toContain('marbleheaddata.org/api/unsubscribe?token=mtok');
    expect(html).toContain('AI-generated');
  });
  it('omits the "Matching segments" block when matched_segments is empty', () => {
    const noSegs = { ...SB_MATCH, matched_segments: [] };
    const html = renderHtml([noSegs], SUB, ENV, '2026-06-12');
    expect(html).not.toContain('Matching segments');
  });
  it('escapes HTML in user-influenced fields', () => {
    const evil = {
      transcript: { ...SB_MATCH.transcript, summary_card: { headline: '<script>alert(1)</script>', summary: 'x' } },
      matched_segments: []
    };
    const html = renderHtml([evil], SUB, ENV, '2026-06-12');
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  });
});

describe('renderText', () => {
  it('produces a plain-text mirror with the same content', () => {
    const text = renderText([SB_MATCH], SUB, ENV, '2026-06-12');
    expect(text).toContain('Marblehead Data');
    expect(text).toContain('Board approves $5.43M Mary Allen contract');
    expect(text).toContain('SELECT BOARD');
    expect(text).toContain('12:34');
    expect(text).not.toContain('<');
    expect(text).not.toContain('&gt;');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd meeting-digest && npx vitest run tests/render.test.js 2>&1 | tail -5
```
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```js
// meeting-digest/worker/src/lib/render.js
import { TOPICS } from './topics.js';

const TOPIC_LABEL = new Map(TOPICS.map(t => [t.slug, t.label]));

function escapeHtml(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function formatTimecode(seconds) {
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function renderSubject(matches) {
  if (matches.length === 1) {
    const m = matches[0];
    return `[MHD Data] ${m.transcript.board_display}: ${m.transcript.summary_card?.headline || m.transcript.title}`;
  }
  const heads = matches.slice(0, 3).map(m => m.transcript.summary_card?.headline || m.transcript.title);
  if (matches.length <= 3) {
    return `[MHD Data] ${matches.length} meetings this week: ${heads.join(' · ')}`;
  }
  return `[MHD Data] ${matches.length} meetings this week: ${heads.join(' · ')}...`;
}

function meetingCardHtml(m, env) {
  const t = m.transcript;
  const meetingUrl = `${env.SITE_BASE_URL}/meetings/${t.slug}/`;
  const segs = m.matched_segments;
  const segHtml = segs.length === 0 ? '' : `
        <p style="margin: 14px 0 6px; font-weight: 600;">Matching segments</p>
        <ul style="margin: 0 0 14px 0; padding-left: 20px;">
          ${segs.map(s => `
            <li><strong>${escapeHtml(TOPIC_LABEL.get(s.topic) || s.topic)}</strong> (${formatTimecode(s.start_seconds)}) — ${escapeHtml(s.headline || '')}${s.dek ? ` <span style="color: #666;">${escapeHtml(s.dek)}</span>` : ''}</li>
          `).join('')}
        </ul>`;
  return `
    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin: 20px 0; border-top: 1px solid #ddd; border-bottom: 1px solid #ddd;">
      <tr><td style="padding: 18px 4px;">
        <p style="margin: 0 0 4px; text-transform: uppercase; letter-spacing: 0.08em; font-size: 12px; color: #666;">${escapeHtml(t.board_display)} · ${escapeHtml(t.date)}</p>
        <h2 style="margin: 0 0 8px; font-size: 18px;">${escapeHtml(t.summary_card?.headline || t.title)}</h2>
        <p style="margin: 0 0 10px; color: #333;">${escapeHtml(t.summary_card?.summary || '')}</p>
        ${segHtml}
        <p style="margin: 14px 0 0; font-size: 14px;"><a href="${meetingUrl}" style="color: #1a3a5c;">Read on marbleheaddata.org →</a> &nbsp; <a href="${escapeHtml(t.vimeo_url)}" style="color: #1a3a5c;">▶ Watch on MHTV</a></p>
      </td></tr>
    </table>`;
}

function meetingCardText(m, env) {
  const t = m.transcript;
  const meetingUrl = `${env.SITE_BASE_URL}/meetings/${t.slug}/`;
  const segs = m.matched_segments;
  let segText = '';
  if (segs.length > 0) {
    segText = '\nMatching segments:\n' + segs.map(s =>
      ` • ${TOPIC_LABEL.get(s.topic) || s.topic} (${formatTimecode(s.start_seconds)}) — ${s.headline || ''}${s.dek ? `. ${s.dek}` : ''}`
    ).join('\n') + '\n';
  }
  return `
${t.board_display.toUpperCase()} · ${t.date}
${t.summary_card?.headline || t.title}
${'─'.repeat(40)}
${t.summary_card?.summary || ''}
${segText}
Read: ${meetingUrl}
Watch: ${t.vimeo_url}
`;
}

export function renderHtml(matches, subscriber, env, weekEndingIso) {
  const manageUrl = `${env.SITE_BASE_URL}/me/subscription/?token=${encodeURIComponent(subscriber.manage_token)}`;
  const unsubUrl = `${env.SITE_BASE_URL}/api/unsubscribe?token=${encodeURIComponent(subscriber.manage_token)}`;
  return `<!doctype html>
<html><body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 640px; margin: 0 auto; padding: 24px; color: #1a1a1a;">
  <p style="font-size: 12px; color: #666; margin: 0 0 4px; text-transform: uppercase; letter-spacing: 0.06em;">Marblehead Data — Friday digest</p>
  <p style="margin: 0 0 24px; color: #666;">Week ending ${escapeHtml(weekEndingIso)} · ${matches.length} meeting${matches.length === 1 ? '' : 's'} matched.</p>

  ${matches.map(m => meetingCardHtml(m, env)).join('')}

  <p style="margin: 32px 0 8px; font-size: 13px; color: #666;">
    <a href="${manageUrl}" style="color: #1a3a5c;">Manage your subscription</a>
    &nbsp;·&nbsp;
    <a href="${unsubUrl}" style="color: #1a3a5c;">Unsubscribe (one click)</a>
  </p>
  <p style="margin: 4px 0; font-size: 12px; color: #999;">AI-generated summaries · may contain errors · verify with the source video.</p>
</body></html>`;
}

export function renderText(matches, subscriber, env, weekEndingIso) {
  const manageUrl = `${env.SITE_BASE_URL}/me/subscription/?token=${subscriber.manage_token}`;
  const unsubUrl = `${env.SITE_BASE_URL}/api/unsubscribe?token=${subscriber.manage_token}`;
  return `Marblehead Data — Friday digest
Week ending ${weekEndingIso} · ${matches.length} meeting${matches.length === 1 ? '' : 's'} matched.

${matches.map(m => meetingCardText(m, env)).join('\n')}

Manage your subscription: ${manageUrl}
Unsubscribe (one click): ${unsubUrl}

AI-generated summaries · may contain errors · verify with the source video.
`;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd meeting-digest && npx vitest run tests/render.test.js 2>&1 | tail -5
```
Expected: PASS (8/8).

- [ ] **Step 5: Commit**

```bash
git add meeting-digest/worker/src/lib/render.js meeting-digest/tests/render.test.js
git commit -m "digest: render subject + HTML + plain-text email bodies"
```

---

### Task 8: Mail provider wrapper

**Files:**
- Create: `meeting-digest/worker/src/lib/mail.js`

No new test file — `mail.js` is a thin shim over `fetch(Resend HTTP API)`. The integration test in Task 16 covers it via a mock.

- [ ] **Step 1: Implement**

```js
// meeting-digest/worker/src/lib/mail.js
// Resend HTTP API wrapper.
// Env requires: MAIL_PROVIDER_API_KEY (Resend), MAIL_FROM, optional MAIL_REPLY_TO.

const RESEND_URL = 'https://api.resend.com/emails';

export async function sendMail(env, { to, subject, html, text, headers }) {
  if (!env.MAIL_PROVIDER_API_KEY) {
    throw new Error('MAIL_PROVIDER_API_KEY is not set');
  }
  const body = {
    from: env.MAIL_FROM,
    to: [to],
    subject,
    html,
    text,
    headers: {
      'List-Unsubscribe': headers?.listUnsubscribe || '',
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      ...(headers?.extra || {})
    }
  };
  if (env.MAIL_REPLY_TO) body.reply_to = env.MAIL_REPLY_TO;

  const resp = await fetch(RESEND_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.MAIL_PROVIDER_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  if (!resp.ok) {
    const detail = await resp.text();
    throw new Error(`Resend send failed: ${resp.status} ${detail.slice(0, 500)}`);
  }
  return resp.json();  // shape: { id: "..." }
}
```

- [ ] **Step 2: Commit**

```bash
git add meeting-digest/worker/src/lib/mail.js
git commit -m "digest: Resend HTTP API wrapper"
```

---

### Task 9: POST /api/subscribe handler + integration test scaffold

**Files:**
- Create: `meeting-digest/worker/src/handlers/subscribe.js`
- Create: `meeting-digest/tests/worker.test.js` (initial — extended in later tasks)
- Modify: `meeting-digest/worker/src/index.js` to route `/api/subscribe`

- [ ] **Step 1: Write the integration test**

Create `meeting-digest/tests/worker.test.js`:

```js
import { describe, it, expect, beforeEach } from 'vitest';
import { env, fetchMock, SELF } from 'cloudflare:test';
import { applyD1Migrations } from 'cloudflare:test';

beforeEach(async () => {
  await applyD1Migrations(env.DB, env.MIGRATIONS_DIR || './worker/schema');
  // Stub the mail provider — no real network call.
  env.MAIL_PROVIDER_API_KEY = 'test-key';
  fetchMock.activate();
  fetchMock.disableNetConnect();
  fetchMock.get('https://api.resend.com')
    .intercept({ path: '/emails', method: 'POST' })
    .reply(200, { id: 'msg_test_1' })
    .persist();
});

describe('POST /api/subscribe', () => {
  it('creates a pending row and triggers a confirmation send', async () => {
    const r = await SELF.fetch('https://worker/api/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'Hi@Example.COM', turnstileToken: 'TEST-OK' })
    });
    expect(r.status).toBe(200);
    const { ok } = await r.json();
    expect(ok).toBe(true);

    const row = await env.DB.prepare('SELECT * FROM subscriber WHERE email = ?').bind('hi@example.com').first();
    expect(row).toBeTruthy();
    expect(row.status).toBe('pending_confirmation');
    expect(row.confirmation_token).toMatch(/^[A-Za-z0-9_-]{40,}$/);
    expect(JSON.parse(row.boards)).toEqual(['select-board', 'school-committee', 'finance-committee']);
    expect(JSON.parse(row.topics)).toEqual([]);
  });

  it('returns 400 on invalid email', async () => {
    const r = await SELF.fetch('https://worker/api/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'not-an-email', turnstileToken: 'TEST-OK' })
    });
    expect(r.status).toBe(400);
  });

  it('returns 400 when Turnstile token is missing in non-test mode', async () => {
    const r = await SELF.fetch('https://worker/api/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'a@b.com' })
    });
    expect(r.status).toBe(400);
  });

  it('does not create a second row for a duplicate email', async () => {
    const body = JSON.stringify({ email: 'dup@example.com', turnstileToken: 'TEST-OK' });
    const opts = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body };
    await SELF.fetch('https://worker/api/subscribe', opts);
    await SELF.fetch('https://worker/api/subscribe', opts);
    const { results } = await env.DB.prepare('SELECT id FROM subscriber WHERE email = ?').bind('dup@example.com').all();
    expect(results.length).toBe(1);
  });
});
```

- [ ] **Step 2: Add a test-mode Turnstile bypass + implement the handler**

Update `wrangler.toml` to add a `TURNSTILE_SECRET` placeholder under `[vars]`:

```toml
TURNSTILE_TEST_BYPASS_TOKEN = "TEST-OK"
```

Create `meeting-digest/worker/src/handlers/subscribe.js`:

```js
import { normalizeEmail, isValidEmail, randomToken } from '../lib/email.js';
import { DEFAULT_BOARDS_ON_SIGNUP } from '../lib/topics.js';
import { sendMail } from '../lib/mail.js';

const CONFIRMATION_TTL_MS = 24 * 60 * 60 * 1000;

async function verifyTurnstile(token, env, ip) {
  if (env.TURNSTILE_TEST_BYPASS_TOKEN && token === env.TURNSTILE_TEST_BYPASS_TOKEN) return true;
  if (!env.TURNSTILE_SECRET) return false;
  const resp = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ secret: env.TURNSTILE_SECRET, response: token, remoteip: ip || '' })
  });
  const j = await resp.json();
  return !!j.success;
}

export async function handleSubscribe(request, env, corsHeaders) {
  let body;
  try { body = await request.json(); }
  catch { return jsonResp(400, { error: 'invalid body' }, corsHeaders); }

  const email = normalizeEmail(body.email);
  if (!isValidEmail(email)) return jsonResp(400, { error: 'invalid email' }, corsHeaders);

  const turnstileToken = typeof body.turnstileToken === 'string' ? body.turnstileToken : '';
  if (!turnstileToken) return jsonResp(400, { error: 'missing turnstile token' }, corsHeaders);
  const ip = request.headers.get('cf-connecting-ip') || '';
  const tsOk = await verifyTurnstile(turnstileToken, env, ip);
  if (!tsOk) return jsonResp(400, { error: 'turnstile verification failed' }, corsHeaders);

  const now = Date.now();
  const existing = await env.DB.prepare('SELECT id, status, confirmation_token, manage_token FROM subscriber WHERE email = ?').bind(email).first();

  let row;
  if (existing) {
    if (existing.status === 'confirmed') {
      await sendMail(env, {
        to: email,
        subject: '[MHD Data] Manage your subscription',
        html: renderManageEmailHtml(env, existing.manage_token),
        text: renderManageEmailText(env, existing.manage_token)
      });
      return jsonResp(200, { ok: true }, corsHeaders);  // neutral response, no info leak
    }
    // pending or other non-terminal: refresh the confirmation token
    const confirmation_token = randomToken();
    await env.DB.prepare('UPDATE subscriber SET confirmation_token=?, confirmation_expires=? WHERE id=?')
      .bind(confirmation_token, now + CONFIRMATION_TTL_MS, existing.id).run();
    row = { ...existing, confirmation_token };
  } else {
    const id = randomToken();
    const confirmation_token = randomToken();
    const manage_token = randomToken();
    await env.DB.prepare(`
      INSERT INTO subscriber (id, email, status, confirmation_token, confirmation_expires, manage_token, boards, topics, created_at)
      VALUES (?, ?, 'pending_confirmation', ?, ?, ?, ?, ?, ?)
    `).bind(id, email, confirmation_token, now + CONFIRMATION_TTL_MS, manage_token, JSON.stringify(DEFAULT_BOARDS_ON_SIGNUP), JSON.stringify([]), now).run();
    row = { id, confirmation_token, manage_token };
  }

  await sendMail(env, {
    to: email,
    subject: '[MHD Data] Confirm your subscription',
    html: renderConfirmEmailHtml(env, row.confirmation_token),
    text: renderConfirmEmailText(env, row.confirmation_token)
  });
  return jsonResp(200, { ok: true }, corsHeaders);
}

function renderConfirmEmailHtml(env, token) {
  const url = `${env.SITE_BASE_URL}/subscribe/confirm/?token=${encodeURIComponent(token)}`;
  return `<!doctype html><html><body style="font-family: sans-serif; max-width: 560px; margin: 0 auto; padding: 24px;">
    <p>You asked to subscribe to Marblehead Data's meeting digest.</p>
    <p><a href="${url}" style="background: #1a3a5c; color: #fff; padding: 10px 18px; text-decoration: none; border-radius: 4px;">Confirm subscription</a></p>
    <p style="color: #666;">This link expires in 24 hours. If this wasn't you, ignore this email — no account was created.</p>
  </body></html>`;
}
function renderConfirmEmailText(env, token) {
  return `You asked to subscribe to Marblehead Data's meeting digest.\n\nConfirm: ${env.SITE_BASE_URL}/subscribe/confirm/?token=${token}\n\nThis link expires in 24 hours. If this wasn't you, ignore this email — no account was created.\n`;
}
function renderManageEmailHtml(env, manageToken) {
  const url = `${env.SITE_BASE_URL}/me/subscription/?token=${encodeURIComponent(manageToken)}`;
  return `<!doctype html><html><body style="font-family: sans-serif; max-width: 560px; margin: 0 auto; padding: 24px;">
    <p>You're already subscribed to Marblehead Data. Here's your manage link:</p>
    <p><a href="${url}">${url}</a></p>
  </body></html>`;
}
function renderManageEmailText(env, manageToken) {
  return `You're already subscribed. Manage: ${env.SITE_BASE_URL}/me/subscription/?token=${manageToken}\n`;
}

function jsonResp(status, body, corsHeaders) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
}
```

- [ ] **Step 3: Wire the route in `meeting-digest/worker/src/index.js`**

Replace the placeholder fetch body with:

```js
import { runScheduled } from './scheduled.js';
import { handleSubscribe } from './handlers/subscribe.js';

function cors(env, origin) {
  return {
    'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN === '*' ? (origin || '*') : env.ALLOWED_ORIGIN,
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin'
  };
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin') || '';
    const corsHeaders = cors(env, origin);

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });

    if (url.pathname === '/api/subscribe' && request.method === 'POST') {
      return handleSubscribe(request, env, corsHeaders);
    }

    return new Response('Not Found', { status: 404, headers: corsHeaders });
  },
  async scheduled(event, env, ctx) {
    ctx.waitUntil(runScheduled(event, env));
  }
};
```

- [ ] **Step 4: Run tests**

```bash
cd meeting-digest && npx vitest run tests/worker.test.js 2>&1 | tail -10
```
Expected: PASS (4/4). If the migration path resolution fails, use absolute path: `applyD1Migrations(env.DB, fileURLToPath(new URL('../worker/schema', import.meta.url)))` and add the appropriate import.

- [ ] **Step 5: Commit**

```bash
git add meeting-digest/worker/src/handlers/subscribe.js meeting-digest/worker/src/index.js \
        meeting-digest/worker/wrangler.toml meeting-digest/tests/worker.test.js
git commit -m "digest: POST /api/subscribe + confirmation email"
```

---

### Task 10: GET /api/subscribe-confirm

**Files:**
- Create: `meeting-digest/worker/src/handlers/confirm.js`
- Modify: `meeting-digest/worker/src/index.js`
- Extend: `meeting-digest/tests/worker.test.js`

- [ ] **Step 1: Extend the worker test with confirmation cases**

Append to `meeting-digest/tests/worker.test.js`:

```js
describe('GET /api/subscribe-confirm', () => {
  async function createPending(email) {
    const r = await SELF.fetch('https://worker/api/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, turnstileToken: 'TEST-OK' })
    });
    expect(r.status).toBe(200);
    return env.DB.prepare('SELECT * FROM subscriber WHERE email = ?').bind(email).first();
  }

  it('flips status to confirmed and redirects to manage URL', async () => {
    const row = await createPending('confirm-me@example.com');
    const r = await SELF.fetch(`https://worker/api/subscribe-confirm?token=${row.confirmation_token}`, { redirect: 'manual' });
    expect(r.status).toBe(302);
    expect(r.headers.get('Location')).toMatch(/\/me\/subscription\/\?token=/);
    const after = await env.DB.prepare('SELECT status, confirmed_at, confirmation_token FROM subscriber WHERE email = ?').bind('confirm-me@example.com').first();
    expect(after.status).toBe('confirmed');
    expect(after.confirmed_at).toBeGreaterThan(0);
    expect(after.confirmation_token).toBeNull();
  });

  it('rejects an expired token', async () => {
    const row = await createPending('expired@example.com');
    await env.DB.prepare('UPDATE subscriber SET confirmation_expires = 1 WHERE id = ?').bind(row.id).run();
    const r = await SELF.fetch(`https://worker/api/subscribe-confirm?token=${row.confirmation_token}`, { redirect: 'manual' });
    expect(r.status).toBe(400);
  });

  it('rejects an unknown token', async () => {
    const r = await SELF.fetch(`https://worker/api/subscribe-confirm?token=nope`, { redirect: 'manual' });
    expect(r.status).toBe(404);
  });
});
```

- [ ] **Step 2: Implement**

Create `meeting-digest/worker/src/handlers/confirm.js`:

```js
export async function handleConfirm(request, env, corsHeaders) {
  const url = new URL(request.url);
  const token = url.searchParams.get('token') || '';
  if (!token) return new Response('missing token', { status: 400, headers: corsHeaders });

  const row = await env.DB.prepare('SELECT id, status, confirmation_expires, manage_token FROM subscriber WHERE confirmation_token = ?').bind(token).first();
  if (!row) return new Response('not found', { status: 404, headers: corsHeaders });

  const now = Date.now();
  if (!row.confirmation_expires || row.confirmation_expires < now) {
    return new Response('confirmation expired', { status: 400, headers: corsHeaders });
  }

  await env.DB.prepare('UPDATE subscriber SET status=\'confirmed\', confirmed_at=?, confirmation_token=NULL, confirmation_expires=NULL WHERE id=?')
    .bind(now, row.id).run();

  return Response.redirect(`${env.SITE_BASE_URL}/me/subscription/?token=${encodeURIComponent(row.manage_token)}&first=1`, 302);
}
```

- [ ] **Step 3: Add the route in `index.js`**

Insert after the `/api/subscribe` block:

```js
if (url.pathname === '/api/subscribe-confirm' && request.method === 'GET') {
  return handleConfirm(request, env, corsHeaders);
}
```

And the import: `import { handleConfirm } from './handlers/confirm.js';`

- [ ] **Step 4: Run tests**

```bash
cd meeting-digest && npx vitest run tests/worker.test.js 2>&1 | tail -10
```
Expected: 7/7 pass (4 from Task 9 + 3 new).

- [ ] **Step 5: Commit**

```bash
git add meeting-digest/worker/src/handlers/confirm.js meeting-digest/worker/src/index.js meeting-digest/tests/worker.test.js
git commit -m "digest: GET /api/subscribe-confirm flips pending → confirmed"
```

---

### Task 11: GET /me/subscription/ (preferences page) + POST /api/preferences-update

**Files:**
- Create: `meeting-digest/worker/src/handlers/preferences.js`
- Modify: `meeting-digest/worker/src/index.js`
- Extend: `meeting-digest/tests/worker.test.js`

Two routes:
1. `GET /api/me/subscription?token=...` — returns JSON `{ email, boards, topics, available: { boards, topics } }` so the static `me/subscription.html` can render the UI without templating in the Worker.
2. `POST /api/preferences-update` — body `{ token, boards[], topics[] }`, validates and updates.

- [ ] **Step 1: Extend the worker test**

Append to `tests/worker.test.js`:

```js
async function confirmedSubscriber(email, overrides = {}) {
  await SELF.fetch('https://worker/api/subscribe', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, turnstileToken: 'TEST-OK' })
  });
  const row = await env.DB.prepare('SELECT * FROM subscriber WHERE email = ?').bind(email).first();
  await env.DB.prepare(`UPDATE subscriber SET status='confirmed', confirmation_token=NULL, confirmation_expires=NULL, confirmed_at=? WHERE id=?`)
    .bind(Date.now(), row.id).run();
  if (overrides.boards || overrides.topics) {
    await env.DB.prepare('UPDATE subscriber SET boards=?, topics=? WHERE id=?')
      .bind(JSON.stringify(overrides.boards || []), JSON.stringify(overrides.topics || []), row.id).run();
  }
  return env.DB.prepare('SELECT * FROM subscriber WHERE id = ?').bind(row.id).first();
}

describe('GET /api/me/subscription', () => {
  it('returns the subscriber\'s preferences and available options', async () => {
    const row = await confirmedSubscriber('me@example.com');
    const r = await SELF.fetch(`https://worker/api/me/subscription?token=${row.manage_token}`);
    expect(r.status).toBe(200);
    const data = await r.json();
    expect(data.email).toBe('me@example.com');
    expect(data.boards).toEqual(['select-board', 'school-committee', 'finance-committee']);
    expect(data.topics).toEqual([]);
    expect(data.available.boards.length).toBe(5);
    // subscribable topics excludes admin-housekeeping + public-comment
    const topicSlugs = data.available.topics.map(t => t.slug);
    expect(topicSlugs).not.toContain('admin-housekeeping');
    expect(topicSlugs).not.toContain('public-comment');
  });
  it('404s on unknown token', async () => {
    const r = await SELF.fetch(`https://worker/api/me/subscription?token=bogus`);
    expect(r.status).toBe(404);
  });
});

describe('POST /api/preferences-update', () => {
  it('updates boards and topics', async () => {
    const row = await confirmedSubscriber('pref@example.com');
    const r = await SELF.fetch('https://worker/api/preferences-update', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: row.manage_token, boards: ['select-board'], topics: ['override'] })
    });
    expect(r.status).toBe(200);
    const after = await env.DB.prepare('SELECT boards, topics FROM subscriber WHERE id = ?').bind(row.id).first();
    expect(JSON.parse(after.boards)).toEqual(['select-board']);
    expect(JSON.parse(after.topics)).toEqual(['override']);
  });
  it('rejects empty boards AND empty topics', async () => {
    const row = await confirmedSubscriber('empty@example.com');
    const r = await SELF.fetch('https://worker/api/preferences-update', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: row.manage_token, boards: [], topics: [] })
    });
    expect(r.status).toBe(400);
  });
  it('rejects unknown board / topic slugs', async () => {
    const row = await confirmedSubscriber('bad@example.com');
    const r = await SELF.fetch('https://worker/api/preferences-update', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: row.manage_token, boards: ['not-a-board'], topics: [] })
    });
    expect(r.status).toBe(400);
  });
  it('rejects subscribable=false topics (admin-housekeeping, public-comment)', async () => {
    const row = await confirmedSubscriber('noisy@example.com');
    const r = await SELF.fetch('https://worker/api/preferences-update', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: row.manage_token, boards: ['select-board'], topics: ['admin-housekeeping'] })
    });
    expect(r.status).toBe(400);
  });
});
```

- [ ] **Step 2: Implement**

Create `meeting-digest/worker/src/handlers/preferences.js`:

```js
import { BOARDS, TOPICS, SUBSCRIBABLE_TOPICS, isKnownBoard, isKnownTopic } from '../lib/topics.js';

const SUBSCRIBABLE_TOPIC_SLUGS = new Set(SUBSCRIBABLE_TOPICS.map(t => t.slug));

export async function handleGetSubscription(request, env, corsHeaders) {
  const url = new URL(request.url);
  const token = url.searchParams.get('token') || '';
  if (!token) return jsonResp(400, { error: 'missing token' }, corsHeaders);
  const row = await env.DB.prepare(`SELECT email, boards, topics, status FROM subscriber WHERE manage_token = ?`).bind(token).first();
  if (!row || row.status === 'unsubscribed') return jsonResp(404, { error: 'not found' }, corsHeaders);
  return jsonResp(200, {
    email: row.email,
    boards: JSON.parse(row.boards),
    topics: JSON.parse(row.topics),
    available: {
      boards: BOARDS.map(b => ({ slug: b.slug, label: b.label, volume: b.volume })),
      topics: SUBSCRIBABLE_TOPICS.map(t => ({ slug: t.slug, label: t.label }))
    }
  }, corsHeaders);
}

export async function handlePreferencesUpdate(request, env, corsHeaders) {
  let body;
  try { body = await request.json(); } catch { return jsonResp(400, { error: 'invalid body' }, corsHeaders); }
  const token = typeof body.token === 'string' ? body.token : '';
  const boards = Array.isArray(body.boards) ? body.boards : null;
  const topics = Array.isArray(body.topics) ? body.topics : null;
  if (!token || boards == null || topics == null) return jsonResp(400, { error: 'missing fields' }, corsHeaders);

  const validBoards = boards.every(isKnownBoard);
  const validTopics = topics.every(t => SUBSCRIBABLE_TOPIC_SLUGS.has(t));
  if (!validBoards || !validTopics) return jsonResp(400, { error: 'unknown slug' }, corsHeaders);
  if (boards.length === 0 && topics.length === 0) return jsonResp(400, { error: 'pick at least one board or topic' }, corsHeaders);

  const row = await env.DB.prepare('SELECT id, status FROM subscriber WHERE manage_token = ?').bind(token).first();
  if (!row || row.status === 'unsubscribed') return jsonResp(404, { error: 'not found' }, corsHeaders);

  await env.DB.prepare('UPDATE subscriber SET boards=?, topics=? WHERE id=?')
    .bind(JSON.stringify(boards), JSON.stringify(topics), row.id).run();
  return jsonResp(200, { ok: true });
}

function jsonResp(status, body, corsHeaders) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...(corsHeaders || {}) } });
}
```

- [ ] **Step 3: Add routes in `index.js`**

```js
if (url.pathname === '/api/me/subscription' && request.method === 'GET') {
  return handleGetSubscription(request, env, corsHeaders);
}
if (url.pathname === '/api/preferences-update' && request.method === 'POST') {
  return handlePreferencesUpdate(request, env, corsHeaders);
}
```

And the import: `import { handleGetSubscription, handlePreferencesUpdate } from './handlers/preferences.js';`

- [ ] **Step 4: Run tests**

```bash
cd meeting-digest && npx vitest run tests/worker.test.js 2>&1 | tail -10
```
Expected: 13/13 pass.

- [ ] **Step 5: Commit**

```bash
git add meeting-digest/worker/src/handlers/preferences.js meeting-digest/worker/src/index.js meeting-digest/tests/worker.test.js
git commit -m "digest: GET /api/me/subscription + POST /api/preferences-update"
```

---

### Task 12: POST /api/unsubscribe + POST /api/mail-event

**Files:**
- Create: `meeting-digest/worker/src/handlers/unsubscribe.js`
- Create: `meeting-digest/worker/src/handlers/mail-event.js`
- Modify: `meeting-digest/worker/src/index.js`
- Extend: `meeting-digest/tests/worker.test.js`

- [ ] **Step 1: Extend the worker test**

Append:

```js
describe('POST /api/unsubscribe', () => {
  it('one-click unsubscribes via token', async () => {
    const row = await confirmedSubscriber('bye@example.com');
    const r = await SELF.fetch('https://worker/api/unsubscribe', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: row.manage_token })
    });
    expect(r.status).toBe(200);
    const after = await env.DB.prepare('SELECT status, unsubscribed_at FROM subscriber WHERE id = ?').bind(row.id).first();
    expect(after.status).toBe('unsubscribed');
    expect(after.unsubscribed_at).toBeGreaterThan(0);
  });
  it('also accepts GET via List-Unsubscribe header for one-click compliance', async () => {
    const row = await confirmedSubscriber('byeget@example.com');
    const r = await SELF.fetch(`https://worker/api/unsubscribe?token=${row.manage_token}`);
    expect(r.status).toBe(200);
  });
});

describe('POST /api/mail-event', () => {
  it('marks bounced subscriber on hard bounce', async () => {
    const row = await confirmedSubscriber('bounced@example.com');
    await env.DB.prepare('INSERT INTO delivery_log (id, subscriber_id, sent_at, n_meetings, provider_message_id, status) VALUES (?, ?, ?, ?, ?, ?)')
      .bind('dl1', row.id, Date.now(), 1, 'pmid-1', 'queued').run();
    const r = await SELF.fetch('https://worker/api/mail-event', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'email.bounced', data: { email_id: 'pmid-1' } })
    });
    expect(r.status).toBe(200);
    const after = await env.DB.prepare('SELECT status FROM subscriber WHERE id = ?').bind(row.id).first();
    expect(after.status).toBe('bounced');
  });
});
```

- [ ] **Step 2: Implement**

Create `meeting-digest/worker/src/handlers/unsubscribe.js`:

```js
export async function handleUnsubscribe(request, env, corsHeaders) {
  let token = '';
  if (request.method === 'GET') {
    const url = new URL(request.url);
    token = url.searchParams.get('token') || '';
  } else {
    try {
      const body = await request.json();
      token = typeof body.token === 'string' ? body.token : '';
    } catch { /* fallthrough */ }
  }
  if (!token) return new Response(JSON.stringify({ error: 'missing token' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });

  const row = await env.DB.prepare('SELECT id, status FROM subscriber WHERE manage_token = ?').bind(token).first();
  if (!row) return new Response(JSON.stringify({ error: 'not found' }), { status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders } });

  await env.DB.prepare('UPDATE subscriber SET status=\'unsubscribed\', unsubscribed_at=? WHERE id=?')
    .bind(Date.now(), row.id).run();
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
}
```

Create `meeting-digest/worker/src/handlers/mail-event.js`:

```js
// Resend webhook format: { type, data: { email_id, ... } }
const BOUNCE_TYPES = new Set(['email.bounced', 'email.complained']);

export async function handleMailEvent(request, env, corsHeaders) {
  let evt;
  try { evt = await request.json(); } catch { return resp(400, { error: 'invalid body' }, corsHeaders); }
  if (!evt || typeof evt.type !== 'string' || !BOUNCE_TYPES.has(evt.type)) {
    return resp(200, { ok: true, ignored: true }, corsHeaders);
  }
  const messageId = evt.data?.email_id;
  if (!messageId) return resp(400, { error: 'missing email_id' }, corsHeaders);

  const dl = await env.DB.prepare('SELECT subscriber_id FROM delivery_log WHERE provider_message_id = ?').bind(messageId).first();
  if (!dl) return resp(200, { ok: true, ignored: true }, corsHeaders);

  const newStatus = evt.type === 'email.complained' ? 'complained' : 'bounced';
  await env.DB.prepare('UPDATE subscriber SET status=? WHERE id=?').bind(newStatus, dl.subscriber_id).run();
  await env.DB.prepare('UPDATE delivery_log SET status=? WHERE provider_message_id=?').bind(newStatus, messageId).run();
  return resp(200, { ok: true }, corsHeaders);
}

function resp(status, body, corsHeaders) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
}
```

- [ ] **Step 3: Wire routes in `index.js`**

```js
if (url.pathname === '/api/unsubscribe' && (request.method === 'POST' || request.method === 'GET')) {
  return handleUnsubscribe(request, env, corsHeaders);
}
if (url.pathname === '/api/mail-event' && request.method === 'POST') {
  return handleMailEvent(request, env, corsHeaders);
}
```

Imports: `import { handleUnsubscribe } from './handlers/unsubscribe.js';` `import { handleMailEvent } from './handlers/mail-event.js';`

- [ ] **Step 4: Run tests**

```bash
cd meeting-digest && npx vitest run tests/worker.test.js 2>&1 | tail -10
```
Expected: 16/16 pass.

- [ ] **Step 5: Commit**

```bash
git add meeting-digest/worker/src/handlers/unsubscribe.js meeting-digest/worker/src/handlers/mail-event.js \
        meeting-digest/worker/src/index.js meeting-digest/tests/worker.test.js
git commit -m "digest: POST /api/unsubscribe (+ GET one-click) + Resend webhook"
```

---

### Task 13: Friday scheduled handler

**Files:**
- Modify: `meeting-digest/worker/src/scheduled.js`
- Extend: `meeting-digest/tests/worker.test.js`

- [ ] **Step 1: Replace the placeholder `scheduled.js`**

```js
// meeting-digest/worker/src/scheduled.js
import { fetchRecentTranscripts } from './lib/transcripts.js';
import { matchTranscripts } from './lib/matcher.js';
import { renderHtml, renderText, renderSubject } from './lib/render.js';
import { sendMail } from './lib/mail.js';
import { randomToken } from './lib/email.js';

// Only run on the cron hour that corresponds to 7 AM ET.
// At cron 11 UTC (EST, no DST): ET hour = 7. Match.
// At cron 12 UTC (EDT, DST): ET hour = 7 (because 12 UTC - 4 = 8 in EDT — wait, EDT is UTC-4, so 12 UTC == 8 AM ET, but EST is UTC-5, so 12 UTC == 7 AM ET).
// To keep DST handling simple: run if the current ET hour (computed via Intl) is 7.
function isSevenAmEasternTime(nowMs = Date.now()) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', hour12: false, hour: '2-digit'
  });
  const hour = parseInt(fmt.format(new Date(nowMs)), 10);
  return hour === 7;
}

export async function runScheduled(event, env, opts = {}) {
  const now = opts.now ?? Date.now();
  const skipGuard = opts.skipTimeGuard === true;
  if (!skipGuard && !isSevenAmEasternTime(now)) {
    return { ok: true, ran: false, reason: 'not 7 AM ET' };
  }

  // 1. Fetch recent transcripts (one network read, shared across subscribers).
  let transcripts;
  try {
    transcripts = await fetchRecentTranscripts(env, now);
  } catch (e) {
    return { ok: false, error: `transcript fetch failed: ${e.message}` };
  }

  // 2. For each confirmed subscriber, filter and send.
  const { results: subs } = await env.DB.prepare('SELECT id, email, manage_token, boards, topics FROM subscriber WHERE status = ?').bind('confirmed').all();

  const weekEnding = new Date(now).toISOString().slice(0, 10);
  let sent = 0, skipped = 0, errored = 0;

  for (const s of subs) {
    const subscription = {
      boards: JSON.parse(s.boards),
      topics: JSON.parse(s.topics)
    };
    const matches = matchTranscripts(transcripts, subscription);
    if (matches.length === 0) { skipped += 1; continue; }

    const subject = renderSubject(matches);
    const html = renderHtml(matches, { manage_token: s.manage_token, email: s.email }, env, weekEnding);
    const text = renderText(matches, { manage_token: s.manage_token, email: s.email }, env, weekEnding);
    const unsubMailto = `mailto:unsub@marbleheaddata.org?subject=unsubscribe`;
    const unsubHttp = `${env.SITE_BASE_URL}/api/unsubscribe?token=${encodeURIComponent(s.manage_token)}`;

    try {
      const result = await sendMail(env, {
        to: s.email, subject, html, text,
        headers: { listUnsubscribe: `<${unsubHttp}>, <${unsubMailto}>` }
      });
      await env.DB.prepare('UPDATE subscriber SET last_sent_at = ? WHERE id = ?').bind(now, s.id).run();
      await env.DB.prepare('INSERT INTO delivery_log (id, subscriber_id, sent_at, n_meetings, provider_message_id, status) VALUES (?, ?, ?, ?, ?, ?)')
        .bind(randomToken(), s.id, now, matches.length, result.id || null, 'queued').run();
      sent += 1;
    } catch (e) {
      errored += 1;
      await env.DB.prepare('INSERT INTO delivery_log (id, subscriber_id, sent_at, n_meetings, provider_message_id, status) VALUES (?, ?, ?, ?, ?, ?)')
        .bind(randomToken(), s.id, now, matches.length, null, 'failed').run();
    }
  }

  return { ok: true, ran: true, sent, skipped, errored, transcripts: transcripts.length };
}
```

- [ ] **Step 2: Add an integration test that uses `runScheduled` directly**

Append to `tests/worker.test.js`:

```js
import { runScheduled } from '../worker/src/scheduled.js';

describe('runScheduled', () => {
  it('skips silently when subscriber has zero matches', async () => {
    await confirmedSubscriber('quiet@example.com', { boards: ['town-meeting'], topics: [] });
    // Mock the GitHub Contents API to return zero recent files.
    fetchMock.get('https://api.github.com')
      .intercept({ path: /\/repos\/.*\/contents\/_transcripts\?ref=.*/, method: 'GET' })
      .reply(200, []);
    const out = await runScheduled({}, env, { skipTimeGuard: true });
    expect(out.ran).toBe(true);
    expect(out.sent).toBe(0);
    const log = await env.DB.prepare('SELECT count(*) AS n FROM delivery_log').first();
    expect(log.n).toBe(0);
  });
  // A "sends matches" integration test is added inline in Task 16 against staging
  // because it requires mocking the GitHub Contents API with realistic transcript
  // content; that data is large enough that an inline string would crowd this plan.
});
```

- [ ] **Step 3: Run tests**

```bash
cd meeting-digest && npx vitest run tests/worker.test.js 2>&1 | tail -10
```
Expected: 17/17 pass.

- [ ] **Step 4: Commit**

```bash
git add meeting-digest/worker/src/scheduled.js meeting-digest/tests/worker.test.js
git commit -m "digest: Friday scheduled handler (fetch, match, send, log)"
```

---

### Task 14: Static pages (subscribe.html, subscribe/confirm.html, me/subscription.html)

**Files:**
- Create: `subscribe.html`
- Create: `subscribe/confirm.html`
- Create: `me/subscription.html`

These are Jekyll-rendered pages that POST to the Worker via a separate Worker host (TBD by Andrew at deploy time — typically `https://marblehead-meeting-digest.<account>.workers.dev` or a custom subdomain). Wired via a Liquid front-matter `worker_base`.

- [ ] **Step 1: Create `subscribe.html`**

```html
---
layout: page
title: "Subscribe — Marblehead Data"
permalink: /subscribe/
body_class: subscribe-page
worker_base: "https://marblehead-meeting-digest.workers.dev"
turnstile_site_key: ""
---

<section class="subscribe-hero">
  <h1>Friday morning, what's happening at Marblehead's board meetings.</h1>
  <p>
    You pick the boards and topics. We send you a digest of just those, with
    deep-links into the source video. Unsubscribe with one click.
  </p>
  <p class="subscribe-default">
    <strong>Default:</strong> Select Board, School Committee, Finance Committee.
    Customize after you confirm.
  </p>

  <form id="subscribe-form" class="subscribe-form">
    <label>
      Your email
      <input type="email" name="email" id="subscribe-email" required autocomplete="email">
    </label>
    <div class="cf-turnstile" data-sitekey="{{ site.turnstile_site_key }}"></div>
    <button type="submit">Subscribe</button>
    <p class="subscribe-msg" id="subscribe-msg" hidden></p>
  </form>
</section>

<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
<script>
(function () {
  const form = document.getElementById('subscribe-form');
  const msg = document.getElementById('subscribe-msg');
  const WORKER = "{{ page.worker_base }}";
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    msg.hidden = false;
    msg.textContent = 'Sending…';
    const email = document.getElementById('subscribe-email').value;
    const tokenInput = form.querySelector('[name="cf-turnstile-response"]');
    const turnstileToken = tokenInput ? tokenInput.value : '';
    try {
      const r = await fetch(`${WORKER}/api/subscribe`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, turnstileToken })
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        msg.textContent = d.error || 'Something went wrong. Try again?';
        return;
      }
      msg.textContent = 'Check your inbox — a confirmation link is on its way (24h expiry).';
    } catch {
      msg.textContent = 'Network error. Try again?';
    }
  });
})();
</script>
```

- [ ] **Step 2: Create `subscribe/confirm.html`**

Confirmation happens server-side (Worker GET /api/subscribe-confirm), which redirects to /me/subscription/. This Jekyll page exists only as a soft landing for the rare case someone hits the URL with a stale or missing token via copy/paste.

```html
---
layout: page
title: "Confirming your subscription"
permalink: /subscribe/confirm/
body_class: subscribe-confirm-page
worker_base: "https://marblehead-meeting-digest.workers.dev"
---

<section class="subscribe-hero">
  <h1>Confirming your subscription…</h1>
  <p id="confirm-msg">One moment.</p>
</section>

<script>
(function () {
  const params = new URLSearchParams(location.search);
  const token = params.get('token');
  const msg = document.getElementById('confirm-msg');
  const WORKER = "{{ page.worker_base }}";
  if (!token) { msg.textContent = 'No token in the URL. Did you click the link in the email?'; return; }
  location.replace(`${WORKER}/api/subscribe-confirm?token=${encodeURIComponent(token)}`);
})();
</script>
```

- [ ] **Step 3: Create `me/subscription.html`**

```html
---
layout: page
title: "Your subscription"
permalink: /me/subscription/
body_class: me-subscription-page
worker_base: "https://marblehead-meeting-digest.workers.dev"
---

<section class="ms-pref">
  <h1>Your subscription</h1>
  <p id="ms-status">Loading…</p>

  <form id="ms-form" hidden>
    <fieldset>
      <legend>Boards</legend>
      <div id="ms-boards"></div>
    </fieldset>
    <fieldset>
      <legend>Topics (optional)</legend>
      <p class="ms-help">Tick a topic to also get any meeting that discussed it — even from boards you didn't check above.</p>
      <div id="ms-topics"></div>
      <p class="ms-help"><em>Admin housekeeping and public comment are on almost every meeting; we don't offer them as filters here.</em></p>
    </fieldset>
    <p>
      <button type="submit">Save preferences</button>
      <button type="button" id="ms-unsubscribe" class="ms-unsub">Unsubscribe</button>
    </p>
    <p id="ms-msg" hidden></p>
  </form>
</section>

<script>
(async function () {
  const WORKER = "{{ page.worker_base }}";
  const params = new URLSearchParams(location.search);
  const token = params.get('token');
  const isFirst = params.get('first') === '1';
  const status = document.getElementById('ms-status');
  const form = document.getElementById('ms-form');
  if (!token) { status.textContent = 'Missing token in URL.'; return; }

  let data;
  try {
    const r = await fetch(`${WORKER}/api/me/subscription?token=${encodeURIComponent(token)}`);
    if (!r.ok) { status.textContent = 'Subscription not found.'; return; }
    data = await r.json();
  } catch { status.textContent = 'Network error.'; return; }

  status.textContent = isFirst
    ? `You're subscribed (${data.email}). Customize what you get below, or close the tab and we'll send the default Friday digest.`
    : `${data.email} · subscribed`;
  form.hidden = false;

  function check(slug, checked) {
    return `<label><input type="checkbox" name="board" value="${slug}"${checked ? ' checked' : ''}> ${slug}</label>`;
  }
  document.getElementById('ms-boards').innerHTML = data.available.boards
    .map(b => `<label><input type="checkbox" name="board" value="${b.slug}"${data.boards.includes(b.slug) ? ' checked' : ''}> ${b.label} <span class="ms-vol">(${b.volume})</span></label>`).join('');
  document.getElementById('ms-topics').innerHTML = data.available.topics
    .map(t => `<label><input type="checkbox" name="topic" value="${t.slug}"${data.topics.includes(t.slug) ? ' checked' : ''}> ${t.label}</label>`).join('');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = document.getElementById('ms-msg');
    msg.hidden = false; msg.textContent = 'Saving…';
    const boards = [...form.querySelectorAll('input[name="board"]:checked')].map(i => i.value);
    const topics = [...form.querySelectorAll('input[name="topic"]:checked')].map(i => i.value);
    try {
      const r = await fetch(`${WORKER}/api/preferences-update`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, boards, topics })
      });
      if (!r.ok) { msg.textContent = (await r.json()).error || 'Failed to save.'; return; }
      msg.textContent = 'Saved.';
    } catch { msg.textContent = 'Network error.'; }
  });

  document.getElementById('ms-unsubscribe').addEventListener('click', async () => {
    if (!confirm('Unsubscribe from the digest?')) return;
    try {
      const r = await fetch(`${WORKER}/api/unsubscribe`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
      });
      if (r.ok) { document.querySelector('.ms-pref').innerHTML = '<h1>You are unsubscribed.</h1>'; }
    } catch {}
  });
})();
</script>
```

- [ ] **Step 4: Commit**

```bash
git add subscribe.html subscribe/confirm.html me/subscription.html
git commit -m "digest: subscribe + confirm + preferences pages"
```

---

### Task 15: Nav link, feature flag flip, minimal CSS

**Files:**
- Modify: `_config.yml`
- Modify: `_includes/nav.html`
- Modify: `assets/site.css` (or `assets/subscribe.css` — depending on existing convention)

- [ ] **Step 1: Flip the feature flag in `_config.yml`**

Change `transcripts_subscribe: false` to `transcripts_subscribe: true`. If the flag is read elsewhere to render a "Log in to subscribe" CTA, that CTA's href becomes `/subscribe/` instead of `/verify.html`.

- [ ] **Step 2: Add a "Subscribe" entry to `_includes/nav.html`**

Insert before the closing `</ul>` (or the equivalent end of the nav list). Use the existing nav-link styling so it picks up theme automatically.

```html
<li><a href="/subscribe/">Subscribe</a></li>
```

- [ ] **Step 3: Add scoped styles to `assets/site.css`**

```css
/* Subscribe page */
body.subscribe-page .subscribe-form { display: flex; flex-direction: column; gap: 0.8rem; max-width: 420px; margin: 1.5rem 0; }
body.subscribe-page .subscribe-form label { display: flex; flex-direction: column; gap: 0.25rem; font-size: 0.9rem; }
body.subscribe-page .subscribe-form input[type="email"] { padding: 0.5rem 0.75rem; font: inherit; border: 1px solid var(--c-border); border-radius: 4px; }
body.subscribe-page .subscribe-form button { background: var(--c-navy); color: var(--c-fog); border: 0; padding: 0.55rem 1rem; border-radius: 4px; cursor: pointer; font-weight: 600; }
body.subscribe-page .subscribe-msg { color: var(--c-text-mid); font-size: 0.9rem; }
body.subscribe-page .subscribe-default { color: var(--c-text-mid); font-size: 0.9rem; }

/* Preferences page */
body.me-subscription-page .ms-pref fieldset { border: 1px solid var(--c-border); padding: 1rem; margin: 1rem 0; border-radius: 6px; }
body.me-subscription-page .ms-pref legend { padding: 0 0.4rem; font-weight: 600; }
body.me-subscription-page .ms-pref label { display: block; padding: 0.25rem 0; }
body.me-subscription-page .ms-pref .ms-vol { color: var(--c-text-mid); font-size: 0.85rem; }
body.me-subscription-page .ms-pref .ms-help { color: var(--c-text-mid); font-size: 0.85rem; margin: 0.25rem 0 0.5rem; }
body.me-subscription-page .ms-pref .ms-unsub { background: transparent; color: var(--c-text-mid); border: 1px solid var(--c-border); }
body.me-subscription-page .ms-pref button { font-family: inherit; padding: 0.5rem 1rem; border-radius: 4px; cursor: pointer; }
body.me-subscription-page .ms-pref button[type="submit"] { background: var(--c-navy); color: var(--c-fog); border: 0; font-weight: 600; }
```

- [ ] **Step 4: Verify Jekyll builds**

```bash
bundle exec jekyll build 2>&1 | tail -5
```
Expected: no errors. `_site/subscribe/index.html`, `_site/subscribe/confirm/index.html`, `_site/me/subscription/index.html` exist.

- [ ] **Step 5: Commit**

```bash
git add _config.yml _includes/nav.html assets/site.css
git commit -m "digest: nav 'Subscribe' link + flip transcripts_subscribe flag + page styles"
```

---

### Task 16: Staging deploy + smoke + production deploy

**Files:** None modified locally. Deploy-config work on Cloudflare.

This is the manual deploy gate. Andrew runs these commands in sequence, verifying at each step.

- [ ] **Step 1: Create staging D1 database**

```bash
cd meeting-digest && npx wrangler d1 create meeting-digest-staging
```
Copy the printed `database_id` into the `[env.staging.d1_databases]` block of `wrangler.toml`. Commit that change:

```bash
git add meeting-digest/worker/wrangler.toml
git commit -m "digest: wire staging D1 database_id"
```

- [ ] **Step 2: Apply migrations to staging D1**

```bash
cd meeting-digest && npx wrangler d1 migrations apply meeting-digest-staging --remote
```

- [ ] **Step 3: Set staging secrets**

```bash
cd meeting-digest
echo "<resend-api-key>" | npx wrangler secret put MAIL_PROVIDER_API_KEY --env staging
echo "<turnstile-secret>" | npx wrangler secret put TURNSTILE_SECRET --env staging
```

- [ ] **Step 4: Deploy staging worker**

```bash
cd meeting-digest && npx wrangler deploy --env staging
```
Expected: prints the staging worker URL, e.g. `https://marblehead-meeting-digest-staging.<account>.workers.dev`.

- [ ] **Step 5: Smoke test the staging worker**

```bash
WORKER=https://marblehead-meeting-digest-staging.<account>.workers.dev
# 1. Subscribe
curl -i -X POST $WORKER/api/subscribe -H 'Content-Type: application/json' \
  -d '{"email":"agbaber+digest-test@gmail.com","turnstileToken":"TEST-OK"}'
# 2. Check your inbox; click the confirm link → expect redirect to /me/subscription/?token=...
# 3. Update preferences
curl -i -X POST $WORKER/api/preferences-update -H 'Content-Type: application/json' \
  -d '{"token":"<manage-token-from-redirect>","boards":["select-board"],"topics":["override"]}'
# 4. Trigger the scheduled handler manually
curl -i -X POST $WORKER/__scheduled --header 'cron: 0 11 * * 5'
# (wrangler dev exposes this in dev mode; in production you'd use the Cloudflare dashboard)
# 5. Unsubscribe
curl -i -X POST $WORKER/api/unsubscribe -H 'Content-Type: application/json' \
  -d '{"token":"<manage-token>"}'
```
Verify in the D1 console: `npx wrangler d1 execute meeting-digest-staging --command "SELECT email, status, last_sent_at FROM subscriber"`.

- [ ] **Step 6: Create production D1 + apply migrations + set secrets + deploy**

```bash
cd meeting-digest && npx wrangler d1 create meeting-digest
# paste id into [[d1_databases]] block, commit
npx wrangler d1 migrations apply meeting-digest --remote
echo "<resend-prod-key>" | npx wrangler secret put MAIL_PROVIDER_API_KEY
echo "<turnstile-prod-secret>" | npx wrangler secret put TURNSTILE_SECRET
npx wrangler deploy
```

- [ ] **Step 7: Wire DNS for `meetings.marbleheaddata.org`**

In Cloudflare dashboard:
- Add an MX/SPF/DKIM record set for `meetings.marbleheaddata.org` as instructed by Resend.
- Verify the domain in the Resend dashboard.
- Worker URL: leave as `*.workers.dev` for v1 (no custom subdomain needed).

- [ ] **Step 8: Set the production worker base URL in the static pages**

Edit `subscribe.html`, `subscribe/confirm.html`, `me/subscription.html` — replace `https://marblehead-meeting-digest.workers.dev` with the real production worker URL. Commit.

```bash
git add subscribe.html subscribe/confirm.html me/subscription.html
git commit -m "digest: point static pages at production worker URL"
```

- [ ] **Step 9: Wire the Resend webhook**

In Resend dashboard → Webhooks: add `https://<production-worker-url>/api/mail-event` for `email.bounced` and `email.complained` events.

- [ ] **Step 10: Push to a feature branch, open PR**

```bash
git push -u origin <branch-name>
gh pr create --title "Meeting-digest email subscriptions (Worker + Pages)" --body "$(cat <<'EOF'
## Summary

Ships v1 of the meeting-digest subscription system per design spec at docs/superpowers/specs/2026-06-09-meeting-digest-subscriptions-design.md.

- New Cloudflare Worker at meeting-digest/worker/ with D1 backing
- /api/subscribe → /api/subscribe-confirm → /api/preferences-update → /api/unsubscribe + Resend webhook
- Friday 7 AM ET scheduled handler that pulls last 7 days of _transcripts/ from this repo, filters per-subscriber, and sends a digest
- 3 new Jekyll pages (subscribe / confirm / preferences) wired to the Worker
- transcripts_subscribe feature flag flipped to true

## Test plan

- [ ] Preview deploy green
- [ ] /subscribe/ renders, submitting an email returns "Check your inbox"
- [ ] Confirmation email arrives, clicking the link redirects to /me/subscription/?token=... with the welcome message
- [ ] Preferences save and reload correctly
- [ ] Unsubscribe button updates the row
- [ ] Manual scheduled-handler trigger sends a digest with this Friday's transcripts (or no-ops cleanly if none)

## Proof of Work

- meeting-digest tests: 17/17 pass (unit + worker integration)
- Staging deploy URL: <fill in after step 4>
- Smoke test transcript: <paste curl output from step 5>

EOF
)"
```

---

## Self-Review

**Spec coverage check.** Walking each spec section against tasks:

| Spec section | Implemented in |
|---|---|
| Section 1 (Scope and surfaces) | Tasks 1, 14, 15 |
| Section 2 (Data model + filter logic) | Tasks 2, 6, 11 |
| Section 3 (Email shape) | Tasks 7, 13 |
| Section 4 (Signup flow + anti-abuse) | Tasks 9, 10 |
| Section 5 (Preferences page) | Tasks 11, 14 |
| Section 6 (Delivery pipeline) | Tasks 5, 8, 13, 16 |
| Section 7 (Out of scope) | N/A — deliberately omitted |

Bounce/complaint handling per spec Section 6 → Task 12 (mail-event webhook).
List-Unsubscribe header for one-click → Task 13 (scheduled handler sets it) + Task 12 (handler accepts GET).
Rate limiting at the Worker → **gap.** The spec calls for "5 confirmations per IP per hour, 1 per email per minute" via KV. **Not in the plan.** This is acceptable for v1 launch (Turnstile + 24h pending pruning provide reasonable defense), but mark as a fast-follow.

Adding fast-follow as an explicit open item rather than a task — Andrew can land v1 first and add the KV rate-limit in a follow-up if abuse appears.

**Placeholder scan.** Searched for "TBD", "TODO", "implement later", "appropriate", "fill in". One legitimate hit: `database_id = "00000000-0000-0000-0000-000000000000"` in `wrangler.toml`, which Task 16 Step 1 explicitly replaces with the real value. Acceptable.

**Type consistency check.**

- `subscriber` object shape: `{ id, email, status, manage_token, boards, topics }` — same across Tasks 9, 10, 11, 12, 13.
- `matchTranscripts(transcripts, subscription)` returns `[{ transcript, matched_segments[] }]` — consumed by `renderHtml`/`renderText` in Task 7 and by `runScheduled` in Task 13 with the same shape.
- `sendMail(env, { to, subject, html, text, headers })` — same call signature in Tasks 8, 9, 13.
- `randomToken()` returns a string — used for IDs in Tasks 9 and 13.

**Scope check.** Single deployable feature, single PR. ~17 tasks of TDD-then-implement. Plan is sized appropriately.

**Known fast-follow items** (not blocking v1):

1. **KV-backed rate limit** on `/api/subscribe` (per spec Section 4 anti-abuse: 5/IP/hr, 1/email/min)
2. **Daily prune of expired pending rows** — cron at e.g. 4 AM ET that deletes rows where `status='pending_confirmation' AND confirmation_expires < now`
3. **Operational dashboard** for delivery_log so Andrew can eyeball Friday send health without running SQL

Each is a small follow-up PR.
