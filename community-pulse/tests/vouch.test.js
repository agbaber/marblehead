import { describe, it, expect, beforeEach } from 'vitest';
import { handleVouchRequest, handleVouchStatus, handleVouchRespond } from '../worker/src/vouch.js';
import { signJWT } from '../worker/src/jwt.js';

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

const JWT_SECRET = 'jwt-secret';

async function getStatus(token, env) {
  const req = new Request(`https://x.example/api/verify/vouch-status?token=${token}`);
  return handleVouchStatus(req, env, JWT_SECRET);
}

// Extend the makeMockDb to also support vouch-status lookup queries.
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
