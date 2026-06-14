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
            if (sql.startsWith('SELECT identity_hash, display_name')) {
              return residents.get(args[0]) || null;
            }
            if (sql.startsWith('SELECT 1 FROM passkey_credentials')) {
              return null; // no passkeys in this mock
            }
            return null;
          },
          async run() {
            if (sql.startsWith('UPDATE residents SET revoked_at')) {
              const hash = args[args.length - 1];
              const r = residents.get(hash);
              if (r) r.revoked_at = args[0];
              return {};
            }
            if (sql.startsWith('UPDATE residents')) {
              const hash = args[args.length - 1];
              const r = residents.get(hash);
              if (r) {
                if (sql.includes('display_name = ?')) {
                  r.display_name = args[0];
                  if (sql.includes('public_identity = ?')) {
                    r.public_identity = args[1];
                  }
                } else if (sql.includes('public_identity = ?')) {
                  r.public_identity = args[0];
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
    expect(body.has_passkey).toBe(false);
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
    expect(typeof env.DB.residents.get('abc123').revoked_at).toBe('number');
  });

  it('returns 401 without a JWT', async () => {
    const env = { JWT_SECRET, DB: makeDb() };
    const req = new Request('https://x/api/claim', { method: 'DELETE' });
    const res = await handleClaimRelease(req, env);
    expect(res.status).toBe(401);
  });
});

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
