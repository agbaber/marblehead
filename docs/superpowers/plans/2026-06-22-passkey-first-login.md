# Passkey-First Login + Peer-Vouch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `/verify-me.html` surface a passkey sign-in prompt automatically for returning residents who have one on this device, prompt FB-onboarded residents to save a passkey, and add a peer-vouch-on-demand sign-up path for residents without Facebook.

**Architecture:** Three changes that compose: (1) a passkey conditional-UI bootstrap on `/verify-me.html`, (2) a new pair of pages (`/vouch-request.html`, `/vouch.html`) backed by three new Cloudflare Worker endpoints and a `vouch_requests` D1 table, and (3) a reusable "save passkey" card that hooks into both the post-FB-claim success state and the existing `/profile.html`.

**Tech Stack:** Cloudflare Workers + D1 (SQLite), Jekyll (static HTML), vanilla JS, `@passwordless-id/webauthn` for WebAuthn, Vitest for Worker tests, Playwright for smoke tests.

**Spec:** [`docs/superpowers/specs/2026-06-22-passkey-first-login-design.md`](../specs/2026-06-22-passkey-first-login-design.md)

---

## File Structure

### Created

- `community-pulse/worker/schema/0007_vouch_requests.sql` — D1 migration adding the `vouch_requests` table.
- `community-pulse/worker/src/vouch.js` — Worker handlers for the three new endpoints.
- `community-pulse/tests/vouch.test.js` — Vitest unit tests for vouch handlers.
- `vouch-request.html` — Jekyll page: the requester's "ask a neighbor" form and waiting state.
- `vouch.html` — Jekyll page: the voucher's "confirm or decline" page.
- `assets/community-pulse/vouch.js` — Controller for both new pages.
- `assets/community-pulse/passkey-save.js` — Reusable WebAuthn registration card, used by `claim.js` (post-FB-claim) and `profile.js`.
- `assets/community-pulse/passkey-signin.js` — Conditional-UI WebAuthn sign-in bootstrap, used by `claim.js`.

### Modified

- `community-pulse/worker/src/index.js` — Add routes for `/api/verify/vouch-*` paths.
- `verify-me.html` — Add "No Facebook? Ask a neighbor to vouch" link below the FB CTA; load `passkey-signin.js` on page load.
- `assets/community-pulse/claim.js` — On init, invoke `passkey-signin.js`. After a successful claim, mount the `passkey-save` card before redirecting to `/profile.html`.
- `assets/community-pulse/profile.js` — Replace the inline "Add for faster sign-in" link with the `passkey-save` card when `profile.has_passkey === false`.
- `tests/smoke-test.mjs` — Add assertions for the two new pages loading without console errors.

---

## Task 1: Add the `vouch_requests` D1 table

**Files:**
- Create: `community-pulse/worker/schema/0007_vouch_requests.sql`

- [ ] **Step 1: Write the migration file**

Create `community-pulse/worker/schema/0007_vouch_requests.sql`:

```sql
-- Peer-vouch-on-demand: lets a non-FB resident generate a shareable link
-- that any verified neighbor can confirm to vouch for them.
-- See docs/superpowers/specs/2026-06-22-passkey-first-login-design.md

CREATE TABLE IF NOT EXISTS vouch_requests (
  token              TEXT PRIMARY KEY,
  requester_hash     TEXT NOT NULL,
  requester_name     TEXT NOT NULL,
  requester_address  TEXT NOT NULL,
  status             TEXT NOT NULL DEFAULT 'pending',
  vouched_by         TEXT,
  created_at         INTEGER NOT NULL,
  expires_at         INTEGER NOT NULL,
  resolved_at        INTEGER
);

-- Status enum (enforced in Worker handlers since SQLite ALTER doesn't
-- accept CHECK on added columns): 'pending', 'verified', 'declined', 'expired'.

-- Lookup index for the "one active request per requester" guard.
CREATE INDEX IF NOT EXISTS idx_vouch_requests_requester
  ON vouch_requests(requester_hash) WHERE status = 'pending';
```

- [ ] **Step 2: Verify the migration applies locally**

Run from `community-pulse/`:

```bash
npx wrangler d1 migrations apply community-pulse --local
```

Expected: a line in the output mentioning `0007_vouch_requests.sql` applied. No errors.

- [ ] **Step 3: Commit**

```bash
git add community-pulse/worker/schema/0007_vouch_requests.sql
git commit -m "Add vouch_requests D1 migration"
```

---

## Task 2: Implement `handleVouchRequest` (create a new vouch request)

**Files:**
- Create: `community-pulse/worker/src/vouch.js`
- Create: `community-pulse/tests/vouch.test.js`

- [ ] **Step 1: Write the failing test**

Create `community-pulse/tests/vouch.test.js` with this initial content:

```javascript
import { describe, it, expect, beforeEach } from 'vitest';
import { handleVouchRequest } from '../worker/src/vouch.js';

function makeMockDb(initial = {}) {
  const residents = new Map(Object.entries(initial.residents || {}));
  const vouchRequests = new Map(Object.entries(initial.vouchRequests || {}));
  return {
    residents, vouchRequests,
    prepare(sql) {
      return {
        bind: (...args) => ({
          async first() {
            if (sql.startsWith('SELECT identity_hash FROM residents WHERE identity_hash')) {
              const r = residents.get(args[0]);
              return (r && !r.revoked_at) ? { identity_hash: args[0] } : null;
            }
            if (sql.startsWith('SELECT token FROM vouch_requests WHERE requester_hash')) {
              for (const r of vouchRequests.values()) {
                if (r.requester_hash === args[0] && r.status === 'pending' && r.expires_at > Date.now()) {
                  return { token: r.token };
                }
              }
              return null;
            }
            return null;
          },
          async run() {
            if (sql.startsWith('INSERT INTO vouch_requests')) {
              const [token, requester_hash, requester_name, requester_address, created_at, expires_at] = args;
              vouchRequests.set(token, {
                token, requester_hash, requester_name, requester_address,
                status: 'pending', created_at, expires_at,
              });
            }
            return {};
          },
        }),
      };
    },
  };
}

async function postRequest(body, env) {
  const req = new Request('https://x.example/api/verify/vouch-request', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return handleVouchRequest(req, env);
}

describe('handleVouchRequest', () => {
  let env;
  beforeEach(() => { env = { DB: makeMockDb() }; });

  it('creates a new request and returns a token + expires_at', async () => {
    const res = await postRequest({
      identity_hash: 'h1',
      name: 'Sarah Smith',
      address: '14 Elm Street',
    }, env);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(typeof body.token).toBe('string');
    expect(body.token.length).toBeGreaterThan(10);
    expect(typeof body.expires_at).toBe('number');
    expect(body.expires_at).toBeGreaterThan(Date.now());
    expect(env.DB.vouchRequests.size).toBe(1);
  });

  it('rejects missing fields', async () => {
    const res = await postRequest({ identity_hash: 'h1' }, env);
    expect(res.status).toBe(400);
  });

  it('rejects when requester is already a verified resident', async () => {
    env.DB.residents.set('h1', { identity_hash: 'h1' });
    const res = await postRequest({
      identity_hash: 'h1', name: 'Sarah', address: '14 Elm',
    }, env);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('already_verified');
  });

  it('rejects a second active request from the same requester', async () => {
    env.DB.vouchRequests.set('tok1', {
      token: 'tok1', requester_hash: 'h1', status: 'pending',
      expires_at: Date.now() + 86400000,
    });
    const res = await postRequest({
      identity_hash: 'h1', name: 'Sarah', address: '14 Elm',
    }, env);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('active_request_exists');
    expect(body.existing_token).toBe('tok1');
  });
});
```

- [ ] **Step 2: Run the test, see it fail**

Run from `community-pulse/`:

```bash
npx vitest run tests/vouch.test.js
```

Expected: FAIL — `Cannot find module '../worker/src/vouch.js'`.

- [ ] **Step 3: Implement `handleVouchRequest`**

Create `community-pulse/worker/src/vouch.js`:

```javascript
// Peer-vouch-on-demand: handlers for the three /api/verify/vouch-* endpoints.
// See docs/superpowers/specs/2026-06-22-passkey-first-login-design.md

const VOUCH_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * POST /api/verify/vouch-request
 * Body: { identity_hash, name, address }
 * Returns: { token, expires_at } | { error }
 */
export async function handleVouchRequest(request, env) {
  let body;
  try { body = await request.json(); }
  catch { return json({ error: 'invalid_json' }, 400); }

  const { identity_hash, name, address } = body;
  if (!identity_hash || !name || !address) {
    return json({ error: 'missing_fields' }, 400);
  }

  // Reject if requester is already a verified (non-revoked) resident.
  const existing = await env.DB.prepare(
    'SELECT identity_hash FROM residents WHERE identity_hash = ? AND revoked_at IS NULL'
  ).bind(identity_hash).first();
  if (existing) return json({ error: 'already_verified' }, 400);

  // Reject if requester already has a pending active request.
  const active = await env.DB.prepare(
    `SELECT token FROM vouch_requests WHERE requester_hash = ?
     AND status = 'pending' AND expires_at > ?`
  ).bind(identity_hash, Date.now()).first();
  if (active) return json({ error: 'active_request_exists', existing_token: active.token }, 400);

  const token = randomToken();
  const now = Date.now();
  const expires_at = now + VOUCH_TTL_MS;

  await env.DB.prepare(
    `INSERT INTO vouch_requests
     (token, requester_hash, requester_name, requester_address, created_at, expires_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).bind(token, identity_hash, name, address, now, expires_at).run();

  return json({ token, expires_at });
}
```

- [ ] **Step 4: Run the tests, see them pass**

```bash
npx vitest run tests/vouch.test.js
```

Expected: 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add community-pulse/worker/src/vouch.js community-pulse/tests/vouch.test.js
git commit -m "Add handleVouchRequest endpoint with create/dedupe/already-verified checks"
```

---

## Task 3: Implement `handleVouchStatus` (requester polls for resolution)

**Files:**
- Modify: `community-pulse/worker/src/vouch.js`
- Modify: `community-pulse/tests/vouch.test.js`

- [ ] **Step 1: Write the failing tests**

Append to `community-pulse/tests/vouch.test.js`:

```javascript
import { handleVouchStatus } from '../worker/src/vouch.js';
import { signJWT } from '../worker/src/jwt.js';

const JWT_SECRET = 'jwt-secret';

async function getStatus(token, env) {
  const req = new Request(`https://x.example/api/verify/vouch-status?token=${token}`);
  return handleVouchStatus(req, env, JWT_SECRET);
}

// Extend the makeMockDb to also support vouch-status lookup queries.
// (Add the missing branch to the prepare() switch.)
function makeStatusDb(initial = {}) {
  const residents = new Map(Object.entries(initial.residents || {}));
  const vouchRequests = new Map(Object.entries(initial.vouchRequests || {}));
  return {
    residents, vouchRequests,
    prepare(sql) {
      return {
        bind: (...args) => ({
          async first() {
            if (sql.startsWith('SELECT token, requester_hash, status, expires_at, vouched_by FROM vouch_requests WHERE token')) {
              return vouchRequests.get(args[0]) || null;
            }
            if (sql.startsWith('SELECT branch_root FROM residents WHERE identity_hash')) {
              const r = residents.get(args[0]);
              return r ? { branch_root: r.branch_root } : null;
            }
            return null;
          },
          async run() { return {}; },
        }),
      };
    },
  };
}

describe('handleVouchStatus', () => {
  it('returns pending for an unresolved request', async () => {
    const env = {
      JWT_SECRET, DB: makeStatusDb({
        vouchRequests: { tok1: {
          token: 'tok1', requester_hash: 'h1',
          status: 'pending', expires_at: Date.now() + 86400000,
        } },
      }),
    };
    const res = await getStatus('tok1', env);
    const body = await res.json();
    expect(body.status).toBe('pending');
    expect(body.jwt).toBeUndefined();
  });

  it('returns verified + JWT once status flipped', async () => {
    const env = {
      JWT_SECRET, DB: makeStatusDb({
        residents: { h1: { identity_hash: 'h1', branch_root: 'root1' } },
        vouchRequests: { tok1: {
          token: 'tok1', requester_hash: 'h1', status: 'verified',
          expires_at: Date.now() + 86400000, vouched_by: 'v1',
        } },
      }),
    };
    const res = await getStatus('tok1', env);
    const body = await res.json();
    expect(body.status).toBe('verified');
    expect(typeof body.jwt).toBe('string');
  });

  it('returns declined when voucher declined', async () => {
    const env = {
      JWT_SECRET, DB: makeStatusDb({
        vouchRequests: { tok1: {
          token: 'tok1', requester_hash: 'h1', status: 'declined',
          expires_at: Date.now() + 86400000,
        } },
      }),
    };
    const res = await getStatus('tok1', env);
    const body = await res.json();
    expect(body.status).toBe('declined');
  });

  it('returns expired when ttl has passed', async () => {
    const env = {
      JWT_SECRET, DB: makeStatusDb({
        vouchRequests: { tok1: {
          token: 'tok1', requester_hash: 'h1', status: 'pending',
          expires_at: Date.now() - 1000,
        } },
      }),
    };
    const res = await getStatus('tok1', env);
    const body = await res.json();
    expect(body.status).toBe('expired');
  });

  it('returns 404 for unknown token', async () => {
    const env = { JWT_SECRET, DB: makeStatusDb() };
    const res = await getStatus('nope', env);
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 2: Run the tests, see them fail**

```bash
npx vitest run tests/vouch.test.js
```

Expected: 5 new tests fail with "handleVouchStatus is not exported".

- [ ] **Step 3: Implement `handleVouchStatus`**

Append to `community-pulse/worker/src/vouch.js`:

```javascript
import { signJWT } from './jwt.js';

/**
 * GET /api/verify/vouch-status?token=<token>
 * Returns: { status: 'pending'|'verified'|'declined'|'expired', jwt?: string }
 *          | 404 if token unknown
 */
export async function handleVouchStatus(request, env, secret) {
  const url = new URL(request.url);
  const token = url.searchParams.get('token');
  if (!token) return json({ error: 'missing_token' }, 400);

  const row = await env.DB.prepare(
    'SELECT token, requester_hash, status, expires_at, vouched_by FROM vouch_requests WHERE token = ?'
  ).bind(token).first();

  if (!row) return json({ error: 'unknown_token' }, 404);

  if (row.status === 'pending' && row.expires_at <= Date.now()) {
    return json({ status: 'expired' });
  }
  if (row.status === 'verified') {
    const resident = await env.DB.prepare(
      'SELECT branch_root FROM residents WHERE identity_hash = ?'
    ).bind(row.requester_hash).first();
    const branch = resident ? resident.branch_root : null;
    const jwt = await signJWT({
      sub: row.requester_hash,
      branch,
      auth_source: 'peer_vouch',
    }, secret || env.JWT_SECRET);
    return json({ status: 'verified', jwt });
  }
  return json({ status: row.status });
}
```

- [ ] **Step 4: Run the tests, see them pass**

```bash
npx vitest run tests/vouch.test.js
```

Expected: 9 tests pass.

- [ ] **Step 5: Commit**

```bash
git add community-pulse/worker/src/vouch.js community-pulse/tests/vouch.test.js
git commit -m "Add handleVouchStatus polling endpoint"
```

---

## Task 4: Implement `handleVouchRespond` (voucher confirms or declines)

**Files:**
- Modify: `community-pulse/worker/src/vouch.js`
- Modify: `community-pulse/tests/vouch.test.js`

- [ ] **Step 1: Write the failing tests**

Append to `community-pulse/tests/vouch.test.js`:

```javascript
import { handleVouchRespond } from '../worker/src/vouch.js';

async function postRespond(body, env, jwt) {
  const req = new Request('https://x.example/api/verify/vouch-respond', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${jwt}`,
    },
    body: JSON.stringify(body),
  });
  return handleVouchRespond(req, env, JWT_SECRET);
}

function makeRespondDb(initial = {}) {
  const residents = new Map(Object.entries(initial.residents || {}));
  const vouchRequests = new Map(Object.entries(initial.vouchRequests || {}));
  return {
    residents, vouchRequests,
    prepare(sql) {
      return {
        bind: (...args) => ({
          async first() {
            if (sql.startsWith('SELECT token, requester_hash, requester_name, requester_address, status, expires_at FROM vouch_requests WHERE token')) {
              return vouchRequests.get(args[0]) || null;
            }
            if (sql.startsWith('SELECT identity_hash, branch_root, invites_remaining FROM residents WHERE identity_hash')) {
              return residents.get(args[0]) || null;
            }
            return null;
          },
          async run() {
            if (sql.startsWith('UPDATE vouch_requests SET status')) {
              const [status, vouched_by, resolved_at, token] = args;
              const row = vouchRequests.get(token);
              if (row) { row.status = status; row.vouched_by = vouched_by; row.resolved_at = resolved_at; }
            }
            if (sql.startsWith('INSERT INTO residents')) {
              const [identity_hash, invited_by, branch_root, created_at] = args;
              residents.set(identity_hash, {
                identity_hash, invited_by, branch_root,
                invites_remaining: 3, created_at,
                auth_source: 'peer_vouch', claim_source: 'vouched',
              });
            }
            if (sql.startsWith('UPDATE residents SET invites_remaining')) {
              const r = residents.get(args[0]);
              if (r) r.invites_remaining -= 1;
            }
            return {};
          },
        }),
      };
    },
  };
}

describe('handleVouchRespond', () => {
  let env;
  beforeEach(() => {
    env = {
      JWT_SECRET,
      DB: makeRespondDb({
        residents: { voucher1: {
          identity_hash: 'voucher1', branch_root: 'root1', invites_remaining: 3,
        } },
        vouchRequests: { tok1: {
          token: 'tok1', requester_hash: 'requester1',
          requester_name: 'Sarah', requester_address: '14 Elm',
          status: 'pending', expires_at: Date.now() + 86400000,
        } },
      }),
    };
  });

  it('confirm creates the resident row and marks the request verified', async () => {
    const voucherJwt = await signJWT({ sub: 'voucher1', branch: 'root1' }, JWT_SECRET);
    const res = await postRespond({ token: 'tok1', decision: 'confirm' }, env, voucherJwt);
    expect(res.status).toBe(200);
    expect(env.DB.residents.size).toBe(2);
    const r = env.DB.residents.get('requester1');
    expect(r.auth_source).toBe('peer_vouch');
    expect(r.invited_by).toBe('voucher1');
    expect(env.DB.residents.get('voucher1').invites_remaining).toBe(2);
    expect(env.DB.vouchRequests.get('tok1').status).toBe('verified');
  });

  it('decline marks the request declined without creating a resident', async () => {
    const voucherJwt = await signJWT({ sub: 'voucher1', branch: 'root1' }, JWT_SECRET);
    const res = await postRespond({ token: 'tok1', decision: 'decline' }, env, voucherJwt);
    expect(res.status).toBe(200);
    expect(env.DB.residents.size).toBe(1);
    expect(env.DB.vouchRequests.get('tok1').status).toBe('declined');
  });

  it('rejects already-resolved tokens', async () => {
    env.DB.vouchRequests.get('tok1').status = 'verified';
    const voucherJwt = await signJWT({ sub: 'voucher1', branch: 'root1' }, JWT_SECRET);
    const res = await postRespond({ token: 'tok1', decision: 'confirm' }, env, voucherJwt);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('already_resolved');
  });

  it('rejects when voucher has no invites left', async () => {
    env.DB.residents.get('voucher1').invites_remaining = 0;
    const voucherJwt = await signJWT({ sub: 'voucher1', branch: 'root1' }, JWT_SECRET);
    const res = await postRespond({ token: 'tok1', decision: 'confirm' }, env, voucherJwt);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('no_invites_remaining');
  });

  it('rejects unauthenticated requests', async () => {
    const res = await postRespond({ token: 'tok1', decision: 'confirm' }, env, 'bad-jwt');
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 2: Run the tests, see them fail**

```bash
npx vitest run tests/vouch.test.js
```

Expected: 5 new tests fail with "handleVouchRespond is not exported".

- [ ] **Step 3: Implement `handleVouchRespond`**

Append to `community-pulse/worker/src/vouch.js`:

```javascript
import { verifyJWT, extractJWT } from './jwt.js';

/**
 * POST /api/verify/vouch-respond
 * Body: { token, decision: 'confirm' | 'decline' }
 * Auth: Bearer <voucher's session JWT>
 * Returns: { ok: true } | { error }
 */
export async function handleVouchRespond(request, env, secret) {
  const jwtSecret = secret || env.JWT_SECRET;

  const jwt = extractJWT(request);
  if (!jwt) return json({ error: 'missing_auth' }, 401);
  let payload;
  try { payload = await verifyJWT(jwt, jwtSecret); }
  catch { return json({ error: 'invalid_auth' }, 401); }
  if (!payload || !payload.sub) return json({ error: 'invalid_auth' }, 401);

  let body;
  try { body = await request.json(); }
  catch { return json({ error: 'invalid_json' }, 400); }
  const { token, decision } = body;
  if (!token || !['confirm', 'decline'].includes(decision)) {
    return json({ error: 'missing_or_bad_fields' }, 400);
  }

  const row = await env.DB.prepare(
    `SELECT token, requester_hash, requester_name, requester_address, status, expires_at
     FROM vouch_requests WHERE token = ?`
  ).bind(token).first();
  if (!row) return json({ error: 'unknown_token' }, 404);
  if (row.status !== 'pending') return json({ error: 'already_resolved' }, 400);
  if (row.expires_at <= Date.now()) return json({ error: 'expired' }, 400);

  const voucher = await env.DB.prepare(
    'SELECT identity_hash, branch_root, invites_remaining FROM residents WHERE identity_hash = ?'
  ).bind(payload.sub).first();
  if (!voucher) return json({ error: 'voucher_not_found' }, 403);

  const now = Date.now();

  if (decision === 'decline') {
    await env.DB.prepare(
      `UPDATE vouch_requests SET status = ?, vouched_by = ?, resolved_at = ? WHERE token = ?`
    ).bind('declined', voucher.identity_hash, now, token).run();
    return json({ ok: true });
  }

  // Confirm.
  if (voucher.invites_remaining <= 0) {
    return json({ error: 'no_invites_remaining' }, 400);
  }

  // Create the resident under the voucher's branch.
  await env.DB.prepare(
    `INSERT INTO residents
     (identity_hash, invited_by, branch_root, created_at, auth_source, claim_source)
     VALUES (?, ?, ?, ?, 'peer_vouch', 'vouched')`
  ).bind(row.requester_hash, voucher.identity_hash, voucher.branch_root, now).run();

  await env.DB.prepare(
    'UPDATE residents SET invites_remaining = invites_remaining - 1 WHERE identity_hash = ?'
  ).bind(voucher.identity_hash).run();

  await env.DB.prepare(
    `UPDATE vouch_requests SET status = ?, vouched_by = ?, resolved_at = ? WHERE token = ?`
  ).bind('verified', voucher.identity_hash, now, token).run();

  return json({ ok: true });
}
```

If the existing `INSERT INTO residents` schema requires additional columns, fall back to listing all required columns explicitly. Check `community-pulse/worker/schema/0004_verification.sql` for the residents table definition before running tests.

- [ ] **Step 4: Run the tests, see them pass**

```bash
npx vitest run tests/vouch.test.js
```

Expected: 14 tests pass total.

- [ ] **Step 5: Commit**

```bash
git add community-pulse/worker/src/vouch.js community-pulse/tests/vouch.test.js
git commit -m "Add handleVouchRespond endpoint with confirm/decline + invite-slot consumption"
```

---

## Task 5: Wire vouch routes into the Worker router

**Files:**
- Modify: `community-pulse/worker/src/index.js`

- [ ] **Step 1: Add the import**

In `community-pulse/worker/src/index.js`, near the other imports at the top:

```javascript
import { handleVouchRequest, handleVouchStatus, handleVouchRespond } from './vouch.js';
```

- [ ] **Step 2: Add the route handlers**

In `community-pulse/worker/src/index.js`, find the existing `if (url.pathname.startsWith('/api/verify/'))` block (around line 50). Insert these three route checks **immediately before** that block, so the vouch routes are matched first and never fall through to `handleVerify`:

```javascript
  if (url.pathname === '/api/verify/vouch-request' && request.method === 'POST') {
    return handleVouchRequest(request, env);
  }
  if (url.pathname === '/api/verify/vouch-status' && request.method === 'GET') {
    return handleVouchStatus(request, env, env.JWT_SECRET || 'dev-secret-not-for-production');
  }
  if (url.pathname === '/api/verify/vouch-respond' && request.method === 'POST') {
    return handleVouchRespond(request, env, env.JWT_SECRET || 'dev-secret-not-for-production');
  }

  // Neighbor verification network endpoints. (existing block continues below)
  if (url.pathname.startsWith('/api/verify/')) {
    const verifyResponse = await handleVerify(request, env, url);
    if (verifyResponse) return verifyResponse;
  }
```

(The last `if (url.pathname.startsWith('/api/verify/'))` block already exists — leave it in place.)

- [ ] **Step 3: Add an integration test for the router**

Append to `community-pulse/tests/vouch.test.js`:

```javascript
import { handleRequest } from '../worker/src/index.js';

describe('router wiring', () => {
  it('POST /api/verify/vouch-request hits handleVouchRequest', async () => {
    const env = { JWT_SECRET, DB: makeMockDb() };
    const req = new Request('https://x.example/api/verify/vouch-request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identity_hash: 'h1', name: 'S', address: '14 Elm' }),
    });
    const res = await handleRequest(req, env);
    expect(res.status).toBe(200);
  });
});
```

- [ ] **Step 4: Run all worker tests, see them pass**

```bash
npx vitest run
```

Expected: all tests pass (existing + new).

- [ ] **Step 5: Commit**

```bash
git add community-pulse/worker/src/index.js community-pulse/tests/vouch.test.js
git commit -m "Wire vouch endpoints into worker router"
```

---

## Task 6: Build `assets/community-pulse/vouch.js` (shared controller for both pages)

**Files:**
- Create: `assets/community-pulse/vouch.js`

- [ ] **Step 1: Write the controller**

Create `assets/community-pulse/vouch.js`. This file is loaded by both `/vouch-request.html` (where it drives the request form + waiting state) and `/vouch.html` (where it drives the confirm/decline UI). It detects which page it's on by looking for distinct DOM IDs.

```javascript
// Drives both /vouch-request.html (requester side) and /vouch.html (voucher side).

const VERIFY_API = (location.hostname === 'localhost')
  ? 'http://localhost:8787'
  : 'https://marblehead-community-pulse.agbaber.workers.dev';

const JWT_KEY = 'verify_jwt';
const POLL_INTERVAL_MS = 10000;
const SALT = 'marblehead-verify-salt';

function readJwt() { return localStorage.getItem(JWT_KEY); }
function setJwt(jwt) { localStorage.setItem(JWT_KEY, jwt); }

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'
  }[c]));
}

async function computeHash(name, address) {
  const input = name.toLowerCase().trim() + ':' + address.toLowerCase().trim() + ':' + SALT;
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function api(method, path, body, jwt) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (jwt) opts.headers.Authorization = `Bearer ${jwt}`;
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${VERIFY_API}${path}`, opts);
  let data = null;
  try { data = await res.json(); } catch {}
  return { status: res.status, body: data };
}

// ── Requester side: /vouch-request.html ────────────────────────────────

async function initRequester() {
  const form = document.getElementById('vr-form');
  if (!form) return false; // not this page

  // If an active request token is already in localStorage, jump to waiting state.
  const savedToken = localStorage.getItem('vouch_request_token');
  if (savedToken) { startPolling(savedToken); return true; }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('vr-name').value.trim();
    const number = document.getElementById('vr-number').value.trim();
    const street = document.getElementById('vr-street').value.trim();
    const address = `${number} ${street}`;
    if (!name || !number || !street) return;

    const submitBtn = document.getElementById('vr-submit');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Creating request';

    const identity_hash = await computeHash(name, address);
    const { status, body } = await api('POST', '/api/verify/vouch-request', {
      identity_hash, name, address,
    });

    if (status === 200) {
      localStorage.setItem('vouch_request_token', body.token);
      startPolling(body.token);
    } else if (body && body.error === 'active_request_exists') {
      localStorage.setItem('vouch_request_token', body.existing_token);
      startPolling(body.existing_token);
    } else if (body && body.error === 'already_verified') {
      renderError('You are already verified. Redirecting to your profile.');
      setTimeout(() => { location.href = '/profile.html'; }, 1500);
    } else {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Request a vouch';
      renderError('Could not create the request. Please try again.');
    }
  });
  return true;
}

function startPolling(token) {
  const formSection = document.getElementById('vr-form-section');
  const waitingSection = document.getElementById('vr-waiting-section');
  if (formSection) formSection.hidden = true;
  if (waitingSection) waitingSection.hidden = false;

  const linkEl = document.getElementById('vr-link');
  const link = `${location.origin}/vouch.html?token=${encodeURIComponent(token)}`;
  if (linkEl) {
    linkEl.value = link;
    linkEl.addEventListener('focus', () => linkEl.select());
  }
  const copyBtn = document.getElementById('vr-copy');
  if (copyBtn) {
    copyBtn.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(link); copyBtn.textContent = 'Copied'; }
      catch { copyBtn.textContent = 'Copy failed'; }
      setTimeout(() => { copyBtn.textContent = 'Copy link'; }, 1500);
    });
  }

  poll(token);
}

async function poll(token) {
  const { status, body } = await api('GET', `/api/verify/vouch-status?token=${encodeURIComponent(token)}`);
  if (status === 404) {
    localStorage.removeItem('vouch_request_token');
    renderError('This request is no longer valid.');
    return;
  }
  if (status !== 200) {
    setTimeout(() => poll(token), POLL_INTERVAL_MS);
    return;
  }
  if (body.status === 'verified') {
    if (body.jwt) setJwt(body.jwt);
    localStorage.removeItem('vouch_request_token');
    renderVerified();
    return;
  }
  if (body.status === 'declined') {
    localStorage.removeItem('vouch_request_token');
    renderDeclined();
    return;
  }
  if (body.status === 'expired') {
    localStorage.removeItem('vouch_request_token');
    renderExpired();
    return;
  }
  setTimeout(() => poll(token), POLL_INTERVAL_MS);
}

function renderError(msg) {
  const el = document.getElementById('vr-result');
  if (el) el.innerHTML = `<div class="vm-card vm-card--warn"><p>${escapeHtml(msg)}</p></div>`;
}
function renderVerified() {
  const el = document.getElementById('vr-result');
  if (el) {
    el.innerHTML = `<div class="vm-card vm-card--success">
      <h3>Verified</h3>
      <p>Your neighbor confirmed. Continuing to your profile.</p>
    </div>`;
  }
  setTimeout(() => { location.href = '/profile.html#passkey-save'; }, 1500);
}
function renderDeclined() {
  const el = document.getElementById('vr-result');
  if (el) {
    el.innerHTML = `<div class="vm-card vm-card--warn">
      <h3>Not confirmed</h3>
      <p>Your neighbor did not confirm this request. You can ask a different neighbor or
         <a href="/verify-me.html">start over</a>.</p>
    </div>`;
  }
}
function renderExpired() {
  const el = document.getElementById('vr-result');
  if (el) {
    el.innerHTML = `<div class="vm-card vm-card--warn">
      <h3>Request expired</h3>
      <p>This request was not confirmed within 7 days. <a href="/vouch-request.html">Start a new request.</a></p>
    </div>`;
  }
}

// ── Voucher side: /vouch.html ──────────────────────────────────────────

async function initVoucher() {
  const root = document.getElementById('vc-root');
  if (!root) return false; // not this page

  const params = new URLSearchParams(location.search);
  const token = params.get('token');
  if (!token) { root.innerHTML = renderTokenError('No token provided.'); return true; }

  const jwt = readJwt();
  if (!jwt) {
    root.innerHTML = `<div class="vm-card vm-card--info">
      <h3>Sign in to vouch</h3>
      <p>You must be a verified resident to confirm this request.</p>
      <p><a class="vm-card-cta" href="/verify-me.html">Sign in</a></p>
    </div>`;
    return true;
  }

  const { status, body } = await api('GET', `/api/verify/vouch-status?token=${encodeURIComponent(token)}`);
  if (status === 404 || (body && body.error === 'unknown_token')) {
    root.innerHTML = renderTokenError('This vouch request was not found.');
    return true;
  }
  if (body.status !== 'pending') {
    root.innerHTML = renderTokenError(
      body.status === 'verified' ? 'This request has already been confirmed.' :
      body.status === 'declined' ? 'This request has already been declined.' :
                                   'This request has expired.'
    );
    return true;
  }

  // We need name + address to show the voucher. Fetch them from a small helper
  // endpoint added in the next step — for now, the voucher page renders them
  // from URL fragments embedded by the requester. (See vouch-request.html.)
  const name = decodeURIComponent(params.get('n') || '');
  const address = decodeURIComponent(params.get('a') || '');

  root.innerHTML = `
    <div class="vm-card vm-card--info">
      <h3>Vouch request</h3>
      <p><strong>${escapeHtml(name) || 'Someone'}</strong> at
         <strong>${escapeHtml(address) || 'a Marblehead address'}</strong>
         is asking you to vouch for them.</p>
      <p>Do you know this person and confirm they live at that address?</p>
      <div style="display:flex; gap:12px; margin-top:16px;">
        <button class="vm-submit" id="vc-confirm">Confirm</button>
        <button class="vm-submit" id="vc-decline" style="background:var(--text-faint)">Decline</button>
      </div>
      <div id="vc-result" style="margin-top:16px"></div>
    </div>`;

  document.getElementById('vc-confirm').addEventListener('click', () => respond('confirm', token, jwt));
  document.getElementById('vc-decline').addEventListener('click', () => respond('decline', token, jwt));
  return true;
}

async function respond(decision, token, jwt) {
  document.getElementById('vc-confirm').disabled = true;
  document.getElementById('vc-decline').disabled = true;
  const { status, body } = await api('POST', '/api/verify/vouch-respond', { token, decision }, jwt);
  const result = document.getElementById('vc-result');
  if (status === 200) {
    result.innerHTML = decision === 'confirm'
      ? `<p style="color:var(--c-sage)"><strong>Confirmed.</strong> Your neighbor is now verified.</p>`
      : `<p>Declined. They'll be able to ask someone else.</p>`;
  } else if (body && body.error === 'no_invites_remaining') {
    result.innerHTML = `<p>You're out of invites this cycle. Suggest the requester ask another neighbor.</p>`;
  } else {
    result.innerHTML = `<p>Could not record your response. Please try again.</p>`;
    document.getElementById('vc-confirm').disabled = false;
    document.getElementById('vc-decline').disabled = false;
  }
}

function renderTokenError(msg) {
  return `<div class="vm-card vm-card--warn"><h3>Request unavailable</h3><p>${escapeHtml(msg)}</p></div>`;
}

// ── Entry ──────────────────────────────────────────────────────────────

(async function init() {
  if (await initRequester()) return;
  await initVoucher();
})();
```

- [ ] **Step 2: Commit**

```bash
git add assets/community-pulse/vouch.js
git commit -m "Add shared vouch.js controller for /vouch-request.html and /vouch.html"
```

---

## Task 7: Build `/vouch-request.html`

**Files:**
- Create: `vouch-request.html`

- [ ] **Step 1: Write the page**

Create `vouch-request.html`. Mirror the visual style of `verify-me.html` (reuse the `vm-*` CSS classes already defined globally; do not duplicate the inline `<style>` block).

```html
---
layout: page
title: Ask a neighbor to vouch
permalink: /vouch-request.html
---

<section class="vm-hero">
  <p class="vm-eye">No Facebook? <span class="dot">&middot;</span> Get verified by a neighbor</p>
  <h1 class="vm-big">Ask a Marblehead neighbor to vouch for you.</h1>
  <p class="vm-cap">Enter your name and address. We'll give you a link to send to any verified neighbor &mdash; text, email, in person, however you reach them. When they confirm, you're verified.</p>
</section>

<section id="vr-form-section" class="vm-claim">
  <p class="vm-claim-eye">Step 1</p>
  <h2>Tell us who you are</h2>

  <form id="vr-form" autocomplete="off">
    <div class="vm-field">
      <label for="vr-name">Your full name</label>
      <input class="vm-input" id="vr-name" name="name" type="text"
             required autocomplete="off" placeholder="First Last">
    </div>
    <div class="vm-field">
      <label for="vr-street">Street</label>
      <input class="vm-input" id="vr-street" name="street" type="text" required autocomplete="off">
    </div>
    <div class="vm-field">
      <label for="vr-number">House number</label>
      <input class="vm-input" id="vr-number" name="number" type="text" inputmode="numeric" required autocomplete="off">
    </div>
    <button class="vm-submit" type="submit" id="vr-submit">
      Request a vouch
      <span class="vm-submit-arrow" aria-hidden="true">&rarr;</span>
    </button>
  </form>
</section>

<section id="vr-waiting-section" class="vm-claim" hidden>
  <p class="vm-claim-eye">Step 2</p>
  <h2>Send this link to a verified neighbor</h2>
  <p>Anyone in Marblehead who has already verified on this site can confirm. The link works once, expires in 7 days.</p>

  <div class="vm-field">
    <label for="vr-link">Your vouch link</label>
    <input class="vm-input" id="vr-link" type="text" readonly>
    <button class="vm-submit" id="vr-copy" type="button" style="margin-top:8px;max-width:200px">Copy link</button>
  </div>

  <p class="vm-loading" style="margin-top:24px">Waiting for a neighbor to confirm</p>

  <div id="vr-result" style="margin-top:24px"></div>
</section>

<script type="module" src="/assets/community-pulse/vouch.js"></script>
```

- [ ] **Step 2: Confirm the page builds with jekyll**

```bash
bundle exec jekyll build
```

Expected: no errors. `_site/vouch-request.html` exists.

- [ ] **Step 3: Commit**

```bash
git add vouch-request.html
git commit -m "Add /vouch-request.html for the requester side of peer-vouch"
```

---

## Task 8: Build `/vouch.html`

**Files:**
- Create: `vouch.html`

- [ ] **Step 1: Write the page**

Note: a `verify.html` page already exists at the repo root for invite redemption. The new page is `vouch.html` (singular, no -y) and is the **voucher confirmation** page.

Create `vouch.html`:

```html
---
layout: page
title: Vouch for a neighbor
permalink: /vouch.html
---

<section class="vm-hero">
  <p class="vm-eye">Vouch for a neighbor</p>
  <h1 class="vm-big">Confirm that you know this person and they live in Marblehead.</h1>
</section>

<div id="vc-root">
  <p class="vm-loading">Loading vouch request</p>
</div>

<script type="module" src="/assets/community-pulse/vouch.js"></script>
```

- [ ] **Step 2: Confirm the page builds**

```bash
bundle exec jekyll build
```

Expected: no errors. `_site/vouch.html` exists.

- [ ] **Step 3: Commit**

```bash
git add vouch.html
git commit -m "Add /vouch.html for the voucher side of peer-vouch"
```

---

## Task 9: Pass the requester's name + address to the vouch link

The voucher page needs to show the requester's name and address. The token alone doesn't carry them (and we don't want an unauthenticated endpoint that returns PII by token).

**Files:**
- Modify: `assets/community-pulse/vouch.js`

- [ ] **Step 1: Update `startPolling` to embed name+address in the shareable link**

In `assets/community-pulse/vouch.js`, modify `initRequester` to remember the name and address locally:

Replace the `submit` handler with this version (replacing the existing one):

```javascript
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('vr-name').value.trim();
    const number = document.getElementById('vr-number').value.trim();
    const street = document.getElementById('vr-street').value.trim();
    const address = `${number} ${street}`;
    if (!name || !number || !street) return;

    const submitBtn = document.getElementById('vr-submit');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Creating request';

    const identity_hash = await computeHash(name, address);
    const { status, body } = await api('POST', '/api/verify/vouch-request', {
      identity_hash, name, address,
    });

    if (status === 200) {
      localStorage.setItem('vouch_request_token', body.token);
      localStorage.setItem('vouch_request_name', name);
      localStorage.setItem('vouch_request_address', address);
      startPolling(body.token, name, address);
    } else if (body && body.error === 'active_request_exists') {
      localStorage.setItem('vouch_request_token', body.existing_token);
      startPolling(body.existing_token,
                   localStorage.getItem('vouch_request_name') || '',
                   localStorage.getItem('vouch_request_address') || '');
    } else if (body && body.error === 'already_verified') {
      renderError('You are already verified. Redirecting to your profile.');
      setTimeout(() => { location.href = '/profile.html'; }, 1500);
    } else {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Request a vouch';
      renderError('Could not create the request. Please try again.');
    }
  });
```

Also update the resumption path at the top of `initRequester`:

```javascript
  const savedToken = localStorage.getItem('vouch_request_token');
  if (savedToken) {
    startPolling(
      savedToken,
      localStorage.getItem('vouch_request_name') || '',
      localStorage.getItem('vouch_request_address') || ''
    );
    return true;
  }
```

And update `startPolling` to accept and append name+address as URL params on the shareable link:

```javascript
function startPolling(token, name, address) {
  const formSection = document.getElementById('vr-form-section');
  const waitingSection = document.getElementById('vr-waiting-section');
  if (formSection) formSection.hidden = true;
  if (waitingSection) waitingSection.hidden = false;

  const linkEl = document.getElementById('vr-link');
  const params = new URLSearchParams({ token });
  if (name) params.set('n', name);
  if (address) params.set('a', address);
  const link = `${location.origin}/vouch.html?${params.toString()}`;
  if (linkEl) {
    linkEl.value = link;
    linkEl.addEventListener('focus', () => linkEl.select());
  }
  const copyBtn = document.getElementById('vr-copy');
  if (copyBtn) {
    copyBtn.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(link); copyBtn.textContent = 'Copied'; }
      catch { copyBtn.textContent = 'Copy failed'; }
      setTimeout(() => { copyBtn.textContent = 'Copy link'; }, 1500);
    });
  }

  poll(token);
}
```

The voucher-side already reads `n` and `a` from `location.search` (in `initVoucher`), so no change needed there.

- [ ] **Step 2: Build and smoke-check**

```bash
bundle exec jekyll build
```

Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add assets/community-pulse/vouch.js
git commit -m "Embed requester name+address in vouch link so voucher page can render them"
```

---

## Task 10: Add `passkey-signin.js` (conditional-UI sign-in bootstrap)

**Files:**
- Create: `assets/community-pulse/passkey-signin.js`

- [ ] **Step 1: Write the module**

Create `assets/community-pulse/passkey-signin.js`:

```javascript
// Surfaces a passkey sign-in via WebAuthn conditional UI.
// On supporting browsers (Safari 16+, Chrome 108+), this triggers the
// OS biometric sheet if the device has a passkey registered for this
// origin. If the user has no passkey, the call resolves to null and
// nothing visible happens — the FB CTA stays as the visible fallback.

import { client } from 'https://cdn.jsdelivr.net/npm/@passwordless-id/webauthn@2.3.5/dist/esm/index.js';

const VERIFY_API = (location.hostname === 'localhost')
  ? 'http://localhost:8787'
  : 'https://marblehead-community-pulse.agbaber.workers.dev';

const JWT_KEY = 'verify_jwt';

function setJwt(jwt) { localStorage.setItem(JWT_KEY, jwt); }

async function api(method, path, body) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${VERIFY_API}${path}`, opts);
  if (!res.ok) return null;
  return res.json();
}

/**
 * Attempt a conditional-UI passkey sign-in. Returns the resulting profile,
 * or null if no passkey was used / available.
 */
export async function tryConditionalPasskey() {
  // Feature-detect conditional UI support.
  if (!window.PublicKeyCredential ||
      !PublicKeyCredential.isConditionalMediationAvailable) return null;
  let available = false;
  try { available = await PublicKeyCredential.isConditionalMediationAvailable(); }
  catch { return null; }
  if (!available) return null;

  // Request a challenge from the server.
  const challenge = await api('POST', '/api/verify/passkey/auth-challenge');
  if (!challenge || !challenge.challenge) return null;

  // Invoke the WebAuthn library with conditional mediation.
  // The @passwordless-id/webauthn client does not expose a `mediation`
  // option directly, so we drop to the underlying navigator API.
  let auth;
  try {
    const browserChallenge = challenge.challenge.split('.')[0];
    const credential = await navigator.credentials.get({
      mediation: 'conditional',
      publicKey: {
        challenge: Uint8Array.from(atob(
          browserChallenge.replace(/-/g, '+').replace(/_/g, '/')
        ), c => c.charCodeAt(0)),
        userVerification: 'preferred',
        // Empty allowCredentials lets the browser show ALL discoverable
        // credentials in the autofill prompt — this is the conditional-UI
        // shape.
        allowCredentials: [],
      },
    });
    if (!credential) return null;
    auth = client._formatAuthentication
      ? client._formatAuthentication(credential)
      : formatAuth(credential);
  } catch (err) {
    // User dismissed or the browser surfaced nothing — silently return.
    return null;
  }

  const r = await api('POST', '/api/verify/passkey/auth', {
    authentication: auth, challenge: challenge.challenge,
  });
  if (!r || !r.ok || !r.token) return null;
  setJwt(r.token);
  return r;
}

function formatAuth(credential) {
  // Minimal formatter mirroring @passwordless-id/webauthn's expected shape
  // when we have to call navigator.credentials.get directly.
  const toB64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return {
    id: credential.id,
    rawId: toB64(credential.rawId),
    type: credential.type,
    authenticatorAttachment: credential.authenticatorAttachment || null,
    response: {
      authenticatorData: toB64(credential.response.authenticatorData),
      clientDataJSON: toB64(credential.response.clientDataJSON),
      signature: toB64(credential.response.signature),
      userHandle: credential.response.userHandle ? toB64(credential.response.userHandle) : null,
    },
    clientExtensionResults: credential.getClientExtensionResults
      ? credential.getClientExtensionResults() : {},
  };
}
```

> ⚠ **Verify the `_formatAuthentication` private path before relying on it.** If the `@passwordless-id/webauthn` 2.3.5 build does not expose that helper, the local `formatAuth` fallback is what runs. Test on a real device with a saved passkey before declaring this task done.

- [ ] **Step 2: Commit**

```bash
git add assets/community-pulse/passkey-signin.js
git commit -m "Add passkey-signin.js with WebAuthn conditional-UI bootstrap"
```

---

## Task 11: Add `passkey-save.js` (the reusable save-passkey card)

**Files:**
- Create: `assets/community-pulse/passkey-save.js`

- [ ] **Step 1: Write the module**

Create `assets/community-pulse/passkey-save.js`:

```javascript
// Renders a "save passkey" card and runs the WebAuthn add-device flow.
// Used by /verify-me.html (post-FB-claim) and /profile.html.

import { client } from 'https://cdn.jsdelivr.net/npm/@passwordless-id/webauthn@2.3.5/dist/esm/index.js';

const VERIFY_API = (location.hostname === 'localhost')
  ? 'http://localhost:8787'
  : 'https://marblehead-community-pulse.agbaber.workers.dev';

const JWT_KEY = 'verify_jwt';
const SKIP_KEY = 'passkey_save_skipped_at';
const SKIP_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function readJwt() { return localStorage.getItem(JWT_KEY); }
function setJwt(jwt) { localStorage.setItem(JWT_KEY, jwt); }
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'
  }[c]));
}

/**
 * Returns true if the save-passkey card should be shown for this user/device.
 * Caller is responsible for knowing whether the user already has a passkey
 * (`profile.has_passkey`). This function only enforces the skip cool-off.
 */
export function shouldPromptPasskeySave() {
  const skipped = localStorage.getItem(SKIP_KEY);
  if (!skipped) return true;
  return (Date.now() - parseInt(skipped, 10)) > SKIP_TTL_MS;
}

/**
 * Feature-detect: does this device have a platform authenticator
 * (Touch ID / Face ID / Windows Hello)?
 */
async function platformAuthAvailable() {
  if (!window.PublicKeyCredential ||
      !PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable) return false;
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch { return false; }
}

/**
 * Mount the card into the given container. Returns a promise that
 * resolves when the user has either saved a passkey or skipped.
 */
export async function mountPasskeySaveCard(container, opts = {}) {
  const { onSaved, onSkipped, headline = 'Save a passkey for faster sign-in' } = opts;

  if (!(await platformAuthAvailable())) {
    // Device cannot make a passkey — render nothing and resolve as skipped.
    if (onSkipped) onSkipped({ reason: 'unsupported' });
    return;
  }

  container.innerHTML = `
    <div class="vm-card vm-card--info">
      <h3>${escapeHtml(headline)}</h3>
      <p>Next time, sign in with Touch ID or Face ID instead of Facebook. Stored on this device only.</p>
      <div style="display:flex; gap:12px; margin-top:14px; flex-wrap:wrap;">
        <button class="vm-submit" id="pks-save" style="max-width:260px">Save passkey</button>
        <button class="vm-submit" id="pks-skip" type="button"
                style="max-width:140px; background:transparent; color:var(--text-muted); box-shadow:none;">
          Skip for now
        </button>
      </div>
      <p id="pks-status" style="margin-top:12px; color:var(--text-muted); font-size:14px;"></p>
    </div>`;

  const saveBtn = container.querySelector('#pks-save');
  const skipBtn = container.querySelector('#pks-skip');
  const status = container.querySelector('#pks-status');

  skipBtn.addEventListener('click', () => {
    localStorage.setItem(SKIP_KEY, String(Date.now()));
    container.innerHTML = '';
    if (onSkipped) onSkipped({ reason: 'user' });
  });

  saveBtn.addEventListener('click', async () => {
    saveBtn.disabled = true;
    skipBtn.disabled = true;
    status.textContent = 'Awaiting biometric…';
    try {
      // Get a challenge from the server (uses the same shape as
      // /api/verify/register's challenge response).
      const challengeRes = await fetch(`${VERIFY_API}/api/verify/passkey/auth-challenge`, {
        method: 'POST',
      });
      const challengeBody = await challengeRes.json();
      const browserChallenge = challengeBody.challenge.split('.')[0];

      const reg = await client.register({
        challenge: browserChallenge,
        user: 'verified-resident',
      });

      const r = await fetch(`${VERIFY_API}/api/verify/passkey/add-device`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${readJwt()}`,
        },
        body: JSON.stringify({ registration: reg, challenge: challengeBody.challenge }),
      });
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${r.status}`);
      }
      const body = await r.json();
      if (body.token) setJwt(body.token);
      localStorage.removeItem(SKIP_KEY);
      container.innerHTML = `
        <div class="vm-card vm-card--success">
          <h3>Passkey saved</h3>
          <p>Next time you visit, you'll be signed in with Touch ID / Face ID automatically.</p>
        </div>`;
      if (onSaved) onSaved();
    } catch (err) {
      saveBtn.disabled = false;
      skipBtn.disabled = false;
      status.textContent = 'Could not save the passkey. ' + (err.message || '');
    }
  });
}
```

> The `client.register` call above uses the existing `/api/verify/passkey/add-device` flow (already wired in `verify.js:95`). The server expects `registration` and `challenge` in the body. Verify against `community-pulse/worker/src/verify.js`'s `handleAddDevice` if shapes do not match.

- [ ] **Step 2: Commit**

```bash
git add assets/community-pulse/passkey-save.js
git commit -m "Add passkey-save.js reusable card with skip cool-off + platform-auth feature detection"
```

---

## Task 12: Wire passkey-signin and "No Facebook?" link into `verify-me.html`

**Files:**
- Modify: `verify-me.html`
- Modify: `assets/community-pulse/claim.js`

- [ ] **Step 1: Add the "No Facebook?" link to `verify-me.html`**

In `verify-me.html`, find the existing `<p class="vm-fallback">` block (around line 374) and add a second fallback path below the existing "Have an invite link from a neighbor?" line. Replace:

```html
<p class="vm-fallback">
  Have an invite link from a neighbor?
  <a href="/verify.html">Open it here</a>.
</p>
```

With:

```html
<p class="vm-fallback">
  Have an invite link from a neighbor?
  <a href="/verify.html">Open it here</a>.
</p>

<p class="vm-fallback" style="margin-top:10px">
  No Facebook account?
  <a href="/vouch-request.html">Ask a neighbor to vouch for you</a>.
</p>
```

- [ ] **Step 2: Wire the passkey-signin bootstrap into `claim.js`**

In `assets/community-pulse/claim.js`, modify the imports/init section. At the top of the file (after the existing module declarations but before `init()`), add:

```javascript
import { tryConditionalPasskey } from './passkey-signin.js';
```

(claim.js is currently loaded as a non-module `<script type="module">` per `verify-me.html:408`, so ES imports work.)

Then modify `init()` to call `tryConditionalPasskey` early — but only when there's no existing JWT and no OAuth fragment in flight (otherwise we'd race with the FB callback handling):

Replace the existing `async function init() { ... }` with:

```javascript
async function init() {
  const oauth = consumeOAuthFragment();
  const isClaimStep = (oauth && oauth.claim) || location.hash === '#claim';

  // If we don't have a session and we're not handling an OAuth callback,
  // try conditional-UI passkey sign-in in parallel. The browser surfaces
  // a biometric prompt only if a passkey exists for this origin; otherwise
  // it does nothing visible.
  if (!readJwt() && !oauth) {
    tryConditionalPasskey().then(r => {
      if (r && r.token) location.href = '/profile.html';
    });
  }

  const profile = await fetchSelf();
  if (profile && profile.identity_hash) {
    location.href = '/profile.html';
    return;
  }

  if (!isClaimStep) return;

  $('claim-form-section').hidden = false;
  const primary = $('primary-cta');
  if (primary) primary.hidden = true;
  const or = document.querySelector('.vm-or');
  if (or) or.hidden = true;
  const fallback = document.querySelectorAll('.vm-fallback');
  fallback.forEach(el => { el.hidden = true; });
  document.querySelectorAll('.vm-hero .vm-cap, .vm-hero .vm-cap-sub')
    .forEach(el => { el.hidden = true; });

  const input = $('claim-street');
  const suggest = $('claim-suggest');
  const streets = await fetchStreets();
  if (streets.length) setupAutocomplete(input, suggest, streets);

  const pre = await fetchPreResident();
  if (pre && pre.fb_display_name) {
    $('claim-fb-name').textContent = pre.fb_display_name;
    $('claim-signed-in').hidden = false;
  }

  $('claim-form').addEventListener('submit', onSubmit);
}
```

Note the change in the fallback-hiding logic: it now queries all `.vm-fallback` elements (plural) since we added a second one.

- [ ] **Step 3: Build and visually inspect**

```bash
npm run dev  # starts jekyll serve on :4000
```

Open `http://localhost:4000/verify-me.html` in a browser. Expected:
- Page renders with FB button as primary.
- "Have an invite link from a neighbor? Open it here." and "No Facebook account? Ask a neighbor to vouch for you." both appear in the fallback area.
- No console errors.
- On a device with a passkey for `localhost`, biometric prompt appears (cannot verify on fresh dev box).

- [ ] **Step 4: Commit**

```bash
git add verify-me.html assets/community-pulse/claim.js
git commit -m "Add passkey conditional-UI sign-in + No-FB peer-vouch link to /verify-me.html"
```

---

## Task 13: Wire passkey-save card into post-claim success state

**Files:**
- Modify: `assets/community-pulse/claim.js`
- Modify: `verify-me.html`

- [ ] **Step 1: Add a mount container in `verify-me.html`**

In `verify-me.html`, find the existing `<div class="vm-result" id="claim-result"></div>` (around line 405). Add a sibling container BELOW it for the passkey-save card:

```html
<div class="vm-result" id="claim-result"></div>
<div id="claim-passkey-save"></div>
```

- [ ] **Step 2: Modify the `match` case in `claim.js`**

In `assets/community-pulse/claim.js`, add an import at the top:

```javascript
import { mountPasskeySaveCard, shouldPromptPasskeySave } from './passkey-save.js';
```

Then modify the `onSubmit` switch-case for `'match'` (around line 263). Replace:

```javascript
    case 'match':
      if (body.session_jwt) setJwt(body.session_jwt);
      result.innerHTML = renderSuccess(claimed);
      setTimeout(() => { location.href = '/profile.html'; }, 1500);
      break;
```

With:

```javascript
    case 'match':
      if (body.session_jwt) setJwt(body.session_jwt);
      result.innerHTML = renderSuccess(claimed);
      // Offer to save a passkey before redirecting.
      if (shouldPromptPasskeySave()) {
        const container = document.getElementById('claim-passkey-save');
        await mountPasskeySaveCard(container, {
          onSaved: () => { setTimeout(() => { location.href = '/profile.html'; }, 1200); },
          onSkipped: () => { setTimeout(() => { location.href = '/profile.html'; }, 800); },
        });
        // If the card was suppressed (unsupported device), still redirect.
        if (!container.innerHTML) {
          setTimeout(() => { location.href = '/profile.html'; }, 1500);
        }
      } else {
        setTimeout(() => { location.href = '/profile.html'; }, 1500);
      }
      break;
```

- [ ] **Step 3: Visually inspect**

Open `http://localhost:4000/verify-me.html` and walk through a real FB claim flow (only possible on a deployed PR preview, since the FB OAuth callback URL is the Worker, not local).

For now, just verify the page renders with both containers present and no JS errors.

- [ ] **Step 4: Commit**

```bash
git add verify-me.html assets/community-pulse/claim.js
git commit -m "Mount passkey-save card after successful FB claim"
```

---

## Task 14: Wire passkey-save card into `/profile.html`

**Files:**
- Modify: `assets/community-pulse/profile.js`

- [ ] **Step 1: Add the import and update `renderProfile`**

In `assets/community-pulse/profile.js`, add at the top:

```javascript
import { mountPasskeySaveCard, shouldPromptPasskeySave } from './passkey-save.js';
```

Then in `renderProfile`, immediately after the line `renderProfile(root, profile);` is called from `init()`, run the passkey-save logic. The simplest hook: append a mount point inside `renderProfile` and call `mountPasskeySaveCard` after `root.innerHTML = ...`.

Inside `renderProfile`, find the existing "Sign-in methods" section and replace the passkey row to use a card mount instead of the inline link when no passkey exists:

Replace:

```javascript
      <div class="pf-method">
        <span class="pf-method-icon" aria-hidden="true">&#x1F511;</span>
        <span class="pf-method-name">Passkey</span>
        <span class="pf-method-state">
          ${profile.has_passkey
            ? '<span class="pf-method-state--on">Connected</span>'
            : '<a href="/verify.html#add-passkey">Add for faster sign-in</a>'}
        </span>
      </div>
```

With:

```javascript
      <div class="pf-method">
        <span class="pf-method-icon" aria-hidden="true">&#x1F511;</span>
        <span class="pf-method-name">Passkey</span>
        <span class="pf-method-state">
          ${profile.has_passkey
            ? '<span class="pf-method-state--on">Connected</span>'
            : '<span class="pf-method-state">Not connected</span>'}
        </span>
      </div>
      <div id="pf-passkey-save" style="margin-top:18px"></div>
```

Then at the bottom of `renderProfile`, after all existing event wiring, add:

```javascript
  // Offer to save a passkey if the user does not have one yet and has not
  // recently skipped the prompt.
  if (!profile.has_passkey && shouldPromptPasskeySave()) {
    const container = document.getElementById('pf-passkey-save');
    mountPasskeySaveCard(container, {
      onSaved: () => { /* card replaces itself with success state */ },
      onSkipped: () => { /* card clears itself */ },
    });
  }
```

- [ ] **Step 2: Visually inspect**

Open `http://localhost:4000/profile.html` while signed in. Expected:
- If you have a passkey: passkey row shows "Connected". No card.
- If you don't have a passkey: passkey row shows "Not connected" and a card below offering to save one.

- [ ] **Step 3: Commit**

```bash
git add assets/community-pulse/profile.js
git commit -m "Show passkey-save card on /profile.html when not yet saved"
```

---

## Task 15: Extend the Playwright smoke tests

**Files:**
- Modify: `tests/smoke-test.mjs`

The smoke suite uses plain Playwright + `ok()` / `fail()` helpers — there is no test framework. Test functions are `async function testXxxx(page)` and are called from the IIFE at the bottom of the file.

- [ ] **Step 1: Add two new test functions**

Add the following functions to `tests/smoke-test.mjs`, immediately after the existing `testProfilePageLoads` function:

```javascript
async function testVouchRequestPageLoads(page) {
  console.log('\n── /vouch-request.html ──');
  const resp = await page.goto(`${SITE}/vouch-request.html`, { waitUntil: 'domcontentloaded' });
  if (resp.status() !== 200) {
    fail('vouch-request.html load', `HTTP ${resp.status()}`);
    return;
  }
  ok('vouch-request.html returns 200');

  const h1 = await page.$('h1');
  const h1Text = h1 ? (await h1.textContent()).trim() : '';
  h1Text.length > 0
    ? ok(`vouch-request h1 renders: "${h1Text.slice(0, 60)}"`)
    : fail('vouch-request h1', 'h1 empty');

  const form = await page.$('#vr-form');
  form ? ok('#vr-form present') : fail('#vr-form', 'missing');

  const nameInput = await page.$('#vr-name');
  const streetInput = await page.$('#vr-street');
  const numberInput = await page.$('#vr-number');
  (nameInput && streetInput && numberInput)
    ? ok('vouch-request form has name, street, and number inputs')
    : fail('vouch-request inputs', 'one or more of #vr-name, #vr-street, #vr-number missing');
}

async function testVouchPageLoads(page) {
  console.log('\n── /vouch.html ──');
  const resp = await page.goto(`${SITE}/vouch.html?token=fake-smoke-token&n=Test&a=12+Smoke+Street`, {
    waitUntil: 'domcontentloaded',
  });
  if (resp.status() !== 200) {
    fail('vouch.html load', `HTTP ${resp.status()}`);
    return;
  }
  ok('vouch.html returns 200');

  const root = await page.$('#vc-root');
  root ? ok('#vc-root present') : fail('#vc-root', 'missing');

  // The page will render either a "sign in to vouch" prompt (no jwt) or an
  // "unknown token" error. Either is fine for smoke; we just want it to
  // not throw. Wait briefly for the controller to settle.
  await page.waitForTimeout(500);
  const html = await page.content();
  html.includes('vm-card')
    ? ok('vouch.html renders some card state (sign-in prompt or error)')
    : fail('vouch.html card state', 'no .vm-card rendered after 500ms');
}
```

- [ ] **Step 2: Wire them into the runner**

In the IIFE at the bottom of `tests/smoke-test.mjs`, add the two new calls immediately after `await testProfilePageLoads(page1);`:

```javascript
    await testProfilePageLoads(page1);
    await testVouchRequestPageLoads(page1);
    await testVouchPageLoads(page1);
    await testTermsPageLoads(page1);
```

- [ ] **Step 3: Run the smoke tests against a local build**

```bash
npm run test:local
```

Expected: all existing tests still pass, plus the new tests for `/vouch-request.html` and `/vouch.html`. Final line should read `=== N passed, 0 failed ===` where N is the previous count plus the new assertions (roughly 6 added).

- [ ] **Step 4: Commit**

```bash
git add tests/smoke-test.mjs
git commit -m "Smoke-test /vouch-request.html and /vouch.html"
```

---

## Task 16: Full-stack verification + open PR

**Files:** none (verification only)

- [ ] **Step 1: Run the full worker test suite**

```bash
cd community-pulse && npx vitest run
```

Expected: all tests pass. Note the count for the PR description.

- [ ] **Step 2: Run the Playwright smoke tests**

```bash
npm run test:local
```

Expected: 52+ tests pass.

- [ ] **Step 3: Capture proof screenshots**

```bash
mkdir -p proof
npm run dev &
sleep 5
npx playwright screenshot \
  --browser=chromium \
  --viewport-size=1440,900 \
  --device-scale-factor=2 \
  "http://localhost:4000/verify-me.html" \
  "proof/$(git branch --show-current)-verify-me.png"
npx playwright screenshot \
  --browser=chromium \
  --viewport-size=1440,900 \
  --device-scale-factor=2 \
  "http://localhost:4000/vouch-request.html" \
  "proof/$(git branch --show-current)-vouch-request.png"
kill %1
git add proof/*.png
git commit -m "Add proof-of-work screenshots"
```

- [ ] **Step 4: Push the branch and open a PR**

```bash
git push -u origin "$(git branch --show-current)"
gh pr create --title "Passkey-first login with peer-vouch fallback" \
  --body-file <(cat <<'EOF'
## Summary

- `/verify-me.html` now surfaces a passkey sign-in prompt automatically (WebAuthn conditional UI) for returning residents who have a passkey on this device. Facebook stays as the primary visible CTA for new users.
- Peer-vouch-on-demand: residents without Facebook can generate a shareable link at `/vouch-request.html`, send it to any verified Marblehead neighbor, and get verified when the neighbor opens `/vouch.html` and confirms. Schema migration adds `vouch_requests`.
- Post-FB-claim and `/profile.html` now show a "Save a passkey" card with a 30-day skip cool-off.

Spec: `docs/superpowers/specs/2026-06-22-passkey-first-login-design.md`

## Preview URL

Preview not yet available — Cloudflare Pages preview will appear once the deploy completes (~5 min). Will edit this body when it's green.

## Things to verify on the preview

- `/verify-me.html`
  - On a device with a saved passkey for `*.pages.dev`, the OS biometric prompt should appear automatically. (Note: passkeys are per-origin, so a passkey saved for marbleheaddata.org will not surface on the preview URL — verify on prod after merge.)
  - "No Facebook account? Ask a neighbor to vouch for you." link is visible.
  - FB CTA still works end-to-end.
- `/vouch-request.html`
  - Form requires name, street, house number.
  - Submit creates a request and switches to the "send this link" waiting state.
  - The shareable link copies to the clipboard.
- `/vouch.html?token=<token-from-above>&n=<name>&a=<address>`
  - When opened by an unauthenticated user: prompts to sign in.
  - When opened by a verified resident: shows the requester's name and address with Confirm/Decline buttons.
  - Confirm marks the requester verified; the requester's polling page transitions to "Verified" within ~10s.
- `/profile.html`
  - If `has_passkey` is false: "Save passkey" card appears below the Sign-in methods section.
  - Save flow registers a new credential and the card transitions to "Passkey saved" state.

## Edge cases worth poking

- Vouch flow with two browsers: open `/vouch-request.html` in one, open the generated link in another as a verified resident, confirm, watch the first page flip to verified.
- Skip the passkey-save card, confirm it doesn't re-appear on next visit (within 30 days).
- Open a vouch link after the request has been confirmed by someone else → "already confirmed" state.

## Proof of Work

Screenshots committed under `proof/`. Preview URL pending; will edit when ready.
EOF
)
```

- [ ] **Step 5: Mark complete**

The work is done when:

- All worker tests pass.
- All smoke tests pass.
- PR is open with screenshots committed and a proper body.
- After Cloudflare Pages preview is up, PR body is edited to include the preview URL.

Do not declare done before the preview URL is in the PR body. Per `CLAUDE.md`, "I've finished" without proof is forbidden.
