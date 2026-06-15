import { describe, it, expect, beforeEach } from 'vitest';
import { handleClaimAddress, identityHash } from '../worker/src/claim.js';
import { signJWT } from '../worker/src/jwt.js';

const JWT_SECRET = 'jwt-secret';

function makeMockDb(initial = {}) {
  const parcels = new Map(Object.entries(initial.parcels || {}));
  const residents = new Map(Object.entries(initial.residents || {}));
  const rateLimits = new Map(); // key: `${ip_hash}|${section_id}|${window_start}`
  return {
    parcels, residents, rateLimits,
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
            if (sql.startsWith('SELECT count FROM rate_limits')) {
              const key = `${args[0]}|${args[1]}|${args[2]}`;
              const entry = rateLimits.get(key);
              return entry ? { count: entry } : null;
            }
            return null;
          },
          async run() {
            if (sql.startsWith('INSERT INTO residents')) {
              const [identity_hash, fb_user_id, display_name, profile_url, created_at] = args;
              residents.set(identity_hash, {
                identity_hash, fb_user_id, display_name,
                fb_profile_url: profile_url, created_at,
                auth_source: 'self_serve', claim_source: 'assessor_match',
                public_identity: 0,
              });
            }
            if (sql.startsWith('INSERT INTO rate_limits')) {
              // SQL literal sets count=1; bind args are (ip_hash, section_id, window_start).
              const key = `${args[0]}|${args[1]}|${args[2]}`;
              rateLimits.set(key, 1);
            }
            if (sql.startsWith('UPDATE rate_limits')) {
              const key = `${args[0]}|${args[1]}|${args[2]}`;
              rateLimits.set(key, (rateLimits.get(key) || 0) + 1);
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
    expect(typeof body.session_jwt).toBe('string');
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

describe('rate limiting', () => {
  let env;
  beforeEach(() => {
    env = { JWT_SECRET, DB: makeMockDb({
      parcels: { '12 STATE STREET': { owner_name: 'SMITH JOHN A' } },
    }) };
  });

  it('returns 429 after 5 attempts from the same FB account', async () => {
    const jwt = await preResidentJwt({ fb_display_name: 'Alice Jones' }); // mismatch
    // Five mismatch attempts succeed (each returns 200 with name_mismatch).
    for (let i = 0; i < 5; i++) {
      const r = await postClaim({ claimed_address: '12 State St' }, env, jwt);
      expect(r.status).toBe(200);
    }
    // Sixth hits the per-FB cap.
    const sixth = await postClaim({ claimed_address: '12 State St' }, env, jwt);
    expect(sixth.status).toBe(429);
  });

  it('429 message references the account vs the network bucket', async () => {
    const jwt = await preResidentJwt({ fb_display_name: 'Alice Jones' });
    for (let i = 0; i < 5; i++) {
      await postClaim({ claimed_address: '12 State St' }, env, jwt);
    }
    const r = await postClaim({ claimed_address: '12 State St' }, env, jwt);
    const body = await r.json();
    expect(body.error).toMatch(/account/);
  });
});

// Cross-door invariant: the self-serve identity hash MUST equal the hash
// the invite-handshake side produces (verify.html line ~347), so the same
// person lands on the same residents row regardless of which door they use.
describe('identityHash contract', () => {
  // Same recipe verify.html uses, computed independently here.
  async function inviteSideHash(name, address) {
    const enc = new TextEncoder();
    const input =
      name.toLowerCase().trim() + ':' +
      address.toLowerCase().trim() + ':' +
      'marblehead-verify-salt';
    const digest = await crypto.subtle.digest('SHA-256', enc.encode(input));
    return Array.from(new Uint8Array(digest))
      .map(b => b.toString(16).padStart(2, '0')).join('');
  }

  it('matches the invite-handshake recipe for the same name + address', async () => {
    const cases = [
      ['Andrew Baber', '12 State Street'],
      ['  Jane Smith ', '5 Beacon Avenue'],
      ['JOHN SMITH', '99 Solo Lane'],
    ];
    for (const [name, addr] of cases) {
      const self = await identityHash(name, addr);
      const invite = await inviteSideHash(name, addr);
      expect(self).toBe(invite);
    }
  });
});
