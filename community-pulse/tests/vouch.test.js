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
