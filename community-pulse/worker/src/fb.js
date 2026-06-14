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
  url.searchParams.set('fields', 'id,name,link,picture.type(large)');
  url.searchParams.set('access_token', accessToken);
  const res = await fetch(url.toString());
  if (!res.ok) return null;
  const data = await res.json();
  return {
    fb_user_id: data.id,
    display_name: data.name,
    profile_url: data.link || `https://facebook.com/${data.id}`,
    picture_url: data.picture?.data?.url || null,
  };
}
