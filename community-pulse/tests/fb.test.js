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
