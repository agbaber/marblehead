// Facebook OAuth helpers. Pure functions where possible; fetch is the only
// I/O. All tests stub globalThis.fetch.

const FB_API_VERSION = 'v18.0';

/**
 * Build the URL the browser should be 302'd to so the user can authorize.
 *
 * @param {{appId: string, redirectUri: string, state: string}} opts
 * @returns {string}
 */
export function buildAuthorizeUrl({ appId, redirectUri, state }) {
  const url = new URL(`https://www.facebook.com/${FB_API_VERSION}/dialog/oauth`);
  url.searchParams.set('client_id', appId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('scope', 'public_profile');
  url.searchParams.set('state', state);
  return url.toString();
}

/**
 * Exchange an OAuth code for an access token. Returns null on failure.
 *
 * @param {{appId: string, appSecret: string, redirectUri: string, code: string}} opts
 * @returns {Promise<string|null>}
 */
export async function exchangeCode({ appId, appSecret, redirectUri, code }) {
  const url = new URL(`https://graph.facebook.com/${FB_API_VERSION}/oauth/access_token`);
  url.searchParams.set('client_id', appId);
  url.searchParams.set('client_secret', appSecret);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('code', code);
  const res = await fetch(url.toString());
  if (!res.ok) return null;
  const data = await res.json();
  return data.access_token || null;
}

/**
 * Fetch the user's public_profile data using an access token.
 * Returns a flat shape suitable for storing into residents.
 *
 * @param {string} accessToken
 * @returns {Promise<{fb_user_id: string, display_name: string, profile_url: string, picture_url: string}|null>}
 */
export async function fetchMe(accessToken) {
  const url = new URL(`https://graph.facebook.com/${FB_API_VERSION}/me`);
  // `link` was removed from public_profile in Graph API v17. The id we
  // get from /me is an app-scoped ID (ASID), not a public profile id, so
  // facebook.com/<id> 404s. Store profile_url as null until/unless we
  // ever ship the user_link permission via FB App Review (Phase 3+).
  url.searchParams.set('fields', 'id,name,picture.type(large)');
  url.searchParams.set('access_token', accessToken);
  const res = await fetch(url.toString());
  if (!res.ok) return null;
  const data = await res.json();
  return {
    fb_user_id: data.id,
    display_name: data.name,
    profile_url: null,
    picture_url: data.picture?.data?.url || null,
  };
}

import { signJWT } from './jwt.js';

const STATE_COOKIE = 'fb_oauth_state';

function randomState() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

function readCookie(req, name) {
  const header = req.headers.get('Cookie') || '';
  const m = header.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return m ? decodeURIComponent(m[1]) : null;
}

function originOf(req) {
  const url = new URL(req.url);
  return `${url.protocol}//${url.host}`;
}

/**
 * GET /api/auth/fb/start
 */
export async function handleFbStart(req, env) {
  const state = randomState();
  const redirectUri = `${originOf(req)}/api/auth/fb/callback`;
  const url = buildAuthorizeUrl({
    appId: env.FB_APP_ID, redirectUri, state,
  });
  return new Response(null, {
    status: 302,
    headers: {
      Location: url,
      'Set-Cookie': `${STATE_COOKIE}=${state}; ` +
                    `Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`,
    },
  });
}

/**
 * GET /api/auth/fb/callback?code=...&state=...
 */
export async function handleFbCallback(req, env) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const cookieState = readCookie(req, STATE_COOKIE);

  if (!code || !state || !cookieState || cookieState !== state) {
    return new Response('Invalid OAuth state', { status: 400 });
  }

  const redirectUri = `${originOf(req)}/api/auth/fb/callback`;
  const accessToken = await exchangeCode({
    appId: env.FB_APP_ID,
    appSecret: env.FB_APP_SECRET,
    redirectUri,
    code,
  });
  if (!accessToken) {
    return new Response('OAuth exchange failed', { status: 502 });
  }

  const me = await fetchMe(accessToken);
  if (!me) {
    return new Response('OAuth profile fetch failed', { status: 502 });
  }

  // Look up an existing resident keyed by fb_user_id (covers return logins).
  // If none, the session is "pre_resident" — pending a claim.
  const existing = await env.DB.prepare(
    'SELECT identity_hash, branch_root, revoked_at FROM residents WHERE fb_user_id = ?'
  ).bind(me.fb_user_id).first();

  let payload;
  if (existing && !existing.revoked_at) {
    payload = {
      sub: existing.identity_hash,
      branch: existing.branch_root,
      auth_source: 'self_serve',
    };
  } else {
    payload = {
      pre_resident: true,
      fb_user_id: me.fb_user_id,
      fb_display_name: me.display_name,
      fb_profile_url: me.profile_url,
      auth_source: 'self_serve',
    };
  }

  const jwt = await signJWT(payload, env.JWT_SECRET);

  // The site lives at a different origin than the Worker. Hand the JWT
  // to the site via the URL fragment (never sent to any server) so the
  // browser script can stash it in localStorage and use Authorization:
  // Bearer for the subsequent API calls. Fragments are cleared by the
  // client right after they're consumed; see assets/community-pulse/claim.js.
  const siteUrl = env.SITE_URL || originOf(req);
  const path = (existing && !existing.revoked_at) ? '/profile.html' : '/verify-me.html';
  const claimFlag = (existing && !existing.revoked_at) ? '' : '&claim=1';
  const redirect = `${siteUrl}${path}#token=${encodeURIComponent(jwt)}${claimFlag}`;

  // Clear the OAuth state cookie; no session cookie needed (token rides
  // in the fragment instead).
  const headers = new Headers({ Location: redirect });
  headers.append('Set-Cookie',
    `${STATE_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`);
  return new Response(null, { status: 302, headers });
}
