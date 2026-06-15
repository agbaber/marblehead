import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildAuthorizeUrl, exchangeCode, fetchMe } from '../worker/src/fb.js';

describe('buildAuthorizeUrl', () => {
  it('includes app id, redirect uri, scope, and state', () => {
    const url = new URL(buildAuthorizeUrl({
      appId: 'APP123',
      redirectUri: 'https://example.com/api/auth/fb/callback',
      state: 'STATE_TOKEN',
    }));
    expect(url.origin).toBe('https://www.facebook.com');
    expect(url.pathname).toBe('/v18.0/dialog/oauth');
    expect(url.searchParams.get('client_id')).toBe('APP123');
    expect(url.searchParams.get('redirect_uri'))
      .toBe('https://example.com/api/auth/fb/callback');
    expect(url.searchParams.get('scope')).toBe('public_profile');
    expect(url.searchParams.get('state')).toBe('STATE_TOKEN');
  });
});

describe('exchangeCode + fetchMe', () => {
  beforeEach(() => { vi.restoreAllMocks(); });

  it('exchanges a code for an access token', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ access_token: 'FB_ACCESS_TOKEN', expires_in: 5183999 }),
    });
    const token = await exchangeCode({
      appId: 'APP123', appSecret: 'SECRET',
      redirectUri: 'https://example.com/cb', code: 'CODE',
    });
    expect(token).toBe('FB_ACCESS_TOKEN');
    expect(fetch).toHaveBeenCalledOnce();
    const calledUrl = new URL(fetch.mock.calls[0][0]);
    expect(calledUrl.searchParams.get('client_id')).toBe('APP123');
    expect(calledUrl.searchParams.get('client_secret')).toBe('SECRET');
    expect(calledUrl.searchParams.get('code')).toBe('CODE');
  });

  it('returns null when exchange fails', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: false, json: async () => ({ error: { message: 'bad code' } }),
    });
    const token = await exchangeCode({
      appId: 'APP123', appSecret: 'SECRET',
      redirectUri: 'https://example.com/cb', code: 'BAD',
    });
    expect(token).toBeNull();
  });

  it('fetches the user profile', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: '123456',
        name: 'John Smith',
        link: 'https://facebook.com/john.smith',
        picture: { data: { url: 'https://cdn.fb/john.jpg' } },
      }),
    });
    const me = await fetchMe('FB_ACCESS_TOKEN');
    expect(me).toEqual({
      fb_user_id: '123456',
      display_name: 'John Smith',
      profile_url: 'https://facebook.com/john.smith',
      picture_url: 'https://cdn.fb/john.jpg',
    });
  });
});

import { handleFbStart, handleFbCallback } from '../worker/src/fb.js';

function makeMockDb() {
  return {
    prepare(sql) {
      return {
        bind: (...args) => ({
          async first() { return null; },
          async run() { return {}; },
        }),
      };
    },
  };
}
function mockEnv(over = {}) {
  return {
    FB_APP_ID: 'APP123',
    FB_APP_SECRET: 'SECRET',
    JWT_SECRET: 'jwt-secret',
    DB: makeMockDb(),
    ...over,
  };
}

describe('handleFbStart', () => {
  it('returns 302 with state cookie and FB authorize URL', async () => {
    const req = new Request('https://x.example/api/auth/fb/start');
    const res = await handleFbStart(req, mockEnv());
    expect(res.status).toBe(302);
    const loc = res.headers.get('Location');
    expect(loc.startsWith('https://www.facebook.com/')).toBe(true);
    const cookie = res.headers.get('Set-Cookie');
    expect(cookie).toMatch(/fb_oauth_state=/);
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/Secure/);
  });
});

describe('handleFbCallback', () => {
  beforeEach(() => { vi.restoreAllMocks(); });

  it('rejects callback with missing state cookie', async () => {
    globalThis.fetch = vi.fn();
    const req = new Request('https://x.example/api/auth/fb/callback?code=C&state=S');
    const res = await handleFbCallback(req, mockEnv());
    expect(res.status).toBe(400);
  });

  it('rejects callback with mismatched state', async () => {
    const req = new Request('https://x.example/api/auth/fb/callback?code=C&state=OTHER',
      { headers: { Cookie: 'fb_oauth_state=ORIGINAL' } });
    const res = await handleFbCallback(req, mockEnv());
    expect(res.status).toBe(400);
  });

  it('redirects to SITE_URL with the JWT in the URL fragment', async () => {
    // Stub FB token exchange + profile fetch.
    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 'FBT' }) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: '777',
          name: 'Jane Doe',
          link: 'https://facebook.com/jane',
          picture: { data: { url: 'https://cdn.fb/j.jpg' } },
        }),
      });

    const env = mockEnv({ SITE_URL: 'https://marbleheaddata.org' });
    const req = new Request(
      'https://x.example/api/auth/fb/callback?code=C&state=ABC',
      { headers: { Cookie: 'fb_oauth_state=ABC' } });
    const res = await handleFbCallback(req, env);

    expect(res.status).toBe(302);
    const loc = res.headers.get('Location');
    // New-user path: lands on /verify-me.html with the claim flag and a token.
    expect(loc.startsWith('https://marbleheaddata.org/verify-me.html#')).toBe(true);
    expect(loc).toMatch(/token=/);
    expect(loc).toMatch(/claim=1/);
    // No session cookie set; only the OAuth state cookie is cleared.
    const setCookies = res.headers.getSetCookie
      ? res.headers.getSetCookie()
      : [res.headers.get('Set-Cookie')];
    expect(setCookies.some(c => c && c.startsWith('fb_oauth_state=;'))).toBe(true);
    expect(setCookies.some(c => c && c.startsWith('verify_jwt='))).toBe(false);
  });
});
