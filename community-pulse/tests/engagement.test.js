import { describe, it, expect, beforeEach } from 'vitest';
import { env } from 'cloudflare:test';
import { handleRequest } from '../worker/src/index.js';
import { signJWT } from '../worker/src/jwt.js';

const SECRET = env.JWT_SECRET || 'dev-secret-not-for-production';

// Seed two residents; return a signed JWT for the first.
async function seedResident(hash, branchRoot, displayName = null) {
  const now = Date.now();
  await env.DB.prepare(
    'INSERT OR REPLACE INTO residents (identity_hash, invited_by, branch_root, invites_remaining, created_at, display_name) VALUES (?, NULL, ?, 3, ?, ?)'
  ).bind(hash, branchRoot, now, displayName).run();
  return signJWT({ sub: hash, branch: branchRoot }, SECRET);
}

function authHeaders(jwt) {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}` };
}

async function postEngagement(jwt, body) {
  const req = new Request('https://pulse.example.com/api/engagement', {
    method: 'POST',
    headers: authHeaders(jwt),
    body: JSON.stringify(body),
  });
  return handleRequest(req, env);
}

async function getEngagement(targetIds, jwt) {
  const headers = jwt ? { Authorization: `Bearer ${jwt}` } : {};
  const req = new Request(
    `https://pulse.example.com/api/engagement?target_type=idea&target_ids=${targetIds.join(',')}`,
    { headers }
  );
  return handleRequest(req, env);
}

beforeEach(async () => {
  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS residents (
      identity_hash TEXT PRIMARY KEY,
      invited_by TEXT,
      branch_root TEXT,
      invites_remaining INTEGER NOT NULL DEFAULT 3,
      created_at INTEGER NOT NULL,
      revoked_at INTEGER,
      display_name TEXT
    )
  `).run();
  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS engagement (
      identity_hash TEXT NOT NULL,
      target_type   TEXT NOT NULL CHECK (target_type IN ('idea','warrant','poll')),
      target_id     TEXT NOT NULL,
      state         TEXT NOT NULL CHECK (state IN ('back_anon','back_named','rep')),
      created_at    INTEGER NOT NULL,
      updated_at    INTEGER NOT NULL,
      PRIMARY KEY (identity_hash, target_type, target_id)
    )
  `).run();
  // resolveBranchName() joins these; create them so branch labels resolve to null
  // (no proposed names) rather than throwing.
  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS branch_names (
      branch_root TEXT NOT NULL,
      proposed_name TEXT NOT NULL,
      proposed_by TEXT NOT NULL,
      proposed_at INTEGER NOT NULL,
      PRIMARY KEY (branch_root, proposed_name)
    )
  `).run();
  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS branch_name_votes (
      identity_hash TEXT NOT NULL,
      branch_root TEXT NOT NULL,
      voted_name TEXT NOT NULL,
      voted_at INTEGER NOT NULL,
      PRIMARY KEY (identity_hash, branch_root)
    )
  `).run();
  await env.DB.prepare('DELETE FROM engagement').run();
  await env.DB.prepare('DELETE FROM residents').run();
});

describe('GET /api/engagement', () => {
  it('returns zeroed entries for ideas with no engagement', async () => {
    const res = await getEngagement(['idea-01', 'idea-02']);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body['idea-01']).toEqual({ back_count: 0, rep_count: 0, anon_count: 0, named_backers: [], reps: [] });
    expect(body['idea-02'].back_count).toBe(0);
  });

  it('counts anonymous backers without exposing names', async () => {
    const jwt = await seedResident('h1', 'b1');
    await postEngagement(jwt, { target_type: 'idea', target_id: 'idea-01', state: 'back_anon' });

    const res = await getEngagement(['idea-01']);
    const body = await res.json();
    expect(body['idea-01'].back_count).toBe(1);
    expect(body['idea-01'].anon_count).toBe(1);
    expect(body['idea-01'].named_backers).toEqual([]);
    expect(body['idea-01'].rep_count).toBe(0);
  });

  it('exposes names for named backers and reps; reps count toward backing', async () => {
    const jwt1 = await seedResident('h1', 'b1', 'Andrew Baber');
    const jwt2 = await seedResident('h2', 'b2', 'Jane Smith');
    const jwt3 = await seedResident('h3', 'b1');
    await postEngagement(jwt1, { target_type: 'idea', target_id: 'idea-06', state: 'rep' });
    await postEngagement(jwt2, { target_type: 'idea', target_id: 'idea-06', state: 'back_named' });
    await postEngagement(jwt3, { target_type: 'idea', target_id: 'idea-06', state: 'back_anon' });

    const res = await getEngagement(['idea-06']);
    const body = await res.json();
    const e = body['idea-06'];
    expect(e.back_count).toBe(3);
    expect(e.rep_count).toBe(1);
    expect(e.anon_count).toBe(1);
    expect(e.named_backers.map(b => b.name).sort()).toEqual(['Andrew Baber', 'Jane Smith']);
    expect(e.reps.map(r => r.name)).toEqual(['Andrew Baber']);
  });

  it('excludes backing from revoked residents', async () => {
    const jwt = await seedResident('h1', 'b1', 'Andrew Baber');
    await postEngagement(jwt, { target_type: 'idea', target_id: 'idea-01', state: 'back_named' });
    await env.DB.prepare('UPDATE residents SET revoked_at = ? WHERE identity_hash = ?')
      .bind(Date.now(), 'h1').run();

    const res = await getEngagement(['idea-01']);
    const body = await res.json();
    expect(body['idea-01'].back_count).toBe(0);
    expect(body['idea-01'].named_backers).toEqual([]);
  });

  it('includes my_state for an authenticated caller', async () => {
    const jwt = await seedResident('h1', 'b1', 'Andrew Baber');
    await postEngagement(jwt, { target_type: 'idea', target_id: 'idea-01', state: 'rep' });
    const res = await getEngagement(['idea-01'], jwt);
    const body = await res.json();
    expect(body['idea-01'].my_state).toBe('rep');
  });
});

describe('POST /api/engagement', () => {
  it('rejects unauthenticated writes', async () => {
    const req = new Request('https://pulse.example.com/api/engagement', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target_type: 'idea', target_id: 'idea-01', state: 'back_anon' }),
    });
    const res = await handleRequest(req, env);
    expect(res.status).toBe(401);
  });

  it('rejects an invalid state', async () => {
    const jwt = await seedResident('h1', 'b1');
    const res = await postEngagement(jwt, { target_type: 'idea', target_id: 'idea-01', state: 'love' });
    expect(res.status).toBe(400);
  });

  it('rejects back_named/rep when the resident has no display_name and none is provided', async () => {
    const jwt = await seedResident('h1', 'b1');
    const res = await postEngagement(jwt, { target_type: 'idea', target_id: 'idea-01', state: 'rep' });
    expect(res.status).toBe(400);
  });

  it('accepts a display_name in the body and persists it on the resident', async () => {
    const jwt = await seedResident('h1', 'b1');
    const res = await postEngagement(jwt, { target_type: 'idea', target_id: 'idea-01', state: 'back_named', display_name: 'Bob Jones' });
    expect(res.status).toBe(200);
    const row = await env.DB.prepare('SELECT display_name FROM residents WHERE identity_hash = ?').bind('h1').first();
    expect(row.display_name).toBe('Bob Jones');
  });

  it('overwrites state (back -> rep -> remove)', async () => {
    const jwt = await seedResident('h1', 'b1', 'Andrew Baber');
    await postEngagement(jwt, { target_type: 'idea', target_id: 'idea-01', state: 'back_anon' });
    await postEngagement(jwt, { target_type: 'idea', target_id: 'idea-01', state: 'rep' });

    let body = await (await getEngagement(['idea-01'])).json();
    expect(body['idea-01'].rep_count).toBe(1);
    expect(body['idea-01'].back_count).toBe(1);

    const res = await postEngagement(jwt, { target_type: 'idea', target_id: 'idea-01', state: 'none' });
    expect(res.status).toBe(200);
    body = await (await getEngagement(['idea-01'])).json();
    expect(body['idea-01'].back_count).toBe(0);
  });

  it('returns the updated counts for the target', async () => {
    const jwt = await seedResident('h1', 'b1', 'Andrew Baber');
    const res = await postEngagement(jwt, { target_type: 'idea', target_id: 'idea-01', state: 'rep' });
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.engagement.back_count).toBe(1);
    expect(body.engagement.rep_count).toBe(1);
    expect(body.engagement.my_state).toBe('rep');
  });
});
