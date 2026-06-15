import { verifyJWT, extractJWT, signJWT } from './jwt.js';
import { normalizeAddress, matchOwner } from './match.js';

const HASH_SALT = 'marblehead-verify-salt';

/**
 * Compute the resident identity hash. MUST match the recipe used by the
 * invite-handshake side at verify.html line ~347:
 *   SHA-256(name.toLowerCase().trim() + ':' +
 *           address.toLowerCase().trim() + ':' + salt)
 *
 * Both sides hash the address AS THE USER TYPED IT (after the shared
 * street typeahead), not the canonical assessor form -- so two different
 * doors land on the same identity_hash when the user types the same
 * "12 State Street" both times.
 */
export async function identityHash(displayName, claimedAddress) {
  const enc = new TextEncoder();
  const recipe =
    `${displayName.toLowerCase().trim()}:` +
    `${claimedAddress.toLowerCase().trim()}:` +
    `${HASH_SALT}`;
  const digest = await crypto.subtle.digest('SHA-256', enc.encode(recipe));
  return Array.from(new Uint8Array(digest))
    .map(b => b.toString(16).padStart(2, '0')).join('');
}

function jsonResponse(body, statusOrEnv, env) {
  if (statusOrEnv && typeof statusOrEnv === "object") {
    env = statusOrEnv;
    statusOrEnv = 200;
  }
  const status = statusOrEnv;
  // Mirror the CORS shape used by /api/streets etc. so the browser can
  // read responses from cross-origin XHR. Without these headers, fetch()
  // in the page on marbleheaddata.org throws a CORS error on every 4xx
  // and breaks the claim.js / profile.js controllers.
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': (env && env.ALLOWED_ORIGIN) || '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
  return new Response(JSON.stringify(body), { status: status || 200, headers });
}

// 24-hour windows for claim attempts. Spec: 5 per FB account, 20 per IP.
const CLAIM_WINDOW_MS = 24 * 60 * 60 * 1000;
const CLAIM_MAX_PER_FB = 5;
const CLAIM_MAX_PER_IP = 20;
const CLAIM_RATE_SALT = 'claim-rate-salt';

async function sha256Hex(s) {
  const buf = await crypto.subtle.digest(
    'SHA-256', new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Returns true if the bucket has room and increments it. False if exhausted.
 * Reuses the existing rate_limits table (ip_hash, section_id, window_start,
 * count). For the FB bucket we store the FB-id hash in ip_hash; the
 * section_id distinguishes "claim:fb" from "claim:ip".
 */
async function checkClaimBucket(env, bucketKey, sectionId, max) {
  const ipHash = await sha256Hex(`${bucketKey}:${CLAIM_RATE_SALT}`);
  const now = Date.now();
  const windowStart = Math.floor(now / CLAIM_WINDOW_MS) * CLAIM_WINDOW_MS;

  const existing = await env.DB.prepare(
    'SELECT count FROM rate_limits ' +
    'WHERE ip_hash = ? AND section_id = ? AND window_start = ?'
  ).bind(ipHash, sectionId, windowStart).first();

  if (existing && existing.count >= max) return false;

  if (existing) {
    await env.DB.prepare(
      'UPDATE rate_limits SET count = count + 1 ' +
      'WHERE ip_hash = ? AND section_id = ? AND window_start = ?'
    ).bind(ipHash, sectionId, windowStart).run();
  } else {
    await env.DB.prepare(
      'INSERT INTO rate_limits (ip_hash, section_id, window_start, count) ' +
      'VALUES (?, ?, ?, 1)'
    ).bind(ipHash, sectionId, windowStart).run();
  }
  return true;
}

/**
 * POST /api/claim/address
 * Body: { claimed_address: string }
 * Auth: Bearer JWT with pre_resident=true
 */
export async function handleClaimAddress(request, env) {
  const token = extractJWT(request);
  if (!token) return jsonResponse({ error: 'unauthenticated' }, 401, env);

  const payload = await verifyJWT(token, env.JWT_SECRET);
  if (!payload || !payload.pre_resident) {
    return jsonResponse({ error: 'forbidden — claim already finalized' }, 403, env);
  }

  const { claimed_address } = await request.json();
  if (!claimed_address) return jsonResponse({ error: 'missing claimed_address' }, 400, env);

  // Rate limit: 5 attempts per FB account per 24h, 20 per IP per 24h.
  const fbOk = await checkClaimBucket(
    env, payload.fb_user_id, 'claim:fb', CLAIM_MAX_PER_FB);
  if (!fbOk) {
    return jsonResponse({
      error: 'rate limited -- too many claim attempts from this account today',
    }, 429, env);
  }
  const clientIp = request.headers.get('CF-Connecting-IP') ||
                   request.headers.get('X-Forwarded-For') || 'unknown';
  const ipOk = await checkClaimBucket(
    env, clientIp, 'claim:ip', CLAIM_MAX_PER_IP);
  if (!ipOk) {
    return jsonResponse({
      error: 'rate limited -- too many claim attempts from this network today',
    }, 429, env);
  }

  const normalized = normalizeAddress(claimed_address);
  const parcel = await env.DB.prepare(
    'SELECT owner_name FROM parcel_owners WHERE address_normalized = ?'
  ).bind(normalized).first();

  if (!parcel) {
    return jsonResponse({
      status: 'no_match',
      vouch_link: '/verify-me#vouch',
    }, env);
  }

  const result = matchOwner(payload.fb_display_name, parcel.owner_name);

  if (result.status === 'match') {
    // Hash uses the user-typed claimed_address (not the normalized form)
    // so it collides with an invite-handshake hash for the same person.
    const hash = await identityHash(payload.fb_display_name, claimed_address);
    const now = Math.floor(Date.now() / 1000);

    // ON CONFLICT: a user who first joined via invite-handshake now also
    // signing in with FB lands on the same identity_hash. Don't fail --
    // attach the FB credentials to the existing row, preserve their
    // branch_root + invites_remaining, and upgrade claim_source to
    // 'assessor_match' (a live FB+assessor match is stronger than a
    // historical vouch). auth_source stays as it was; it records how
    // they FIRST came in, not how they're currently authed.
    await env.DB.prepare(
      'INSERT INTO residents (' +
      '  identity_hash, fb_user_id, display_name, fb_profile_url, ' +
      '  auth_source, claim_source, public_identity, created_at) ' +
      'VALUES (?, ?, ?, ?, \'self_serve\', \'assessor_match\', 0, ?) ' +
      'ON CONFLICT(identity_hash) DO UPDATE SET ' +
      '  fb_user_id = excluded.fb_user_id, ' +
      '  fb_profile_url = excluded.fb_profile_url, ' +
      '  claim_source = excluded.claim_source, ' +
      '  display_name = COALESCE(residents.display_name, excluded.display_name)'
    ).bind(
      hash, payload.fb_user_id, payload.fb_display_name,
      payload.fb_profile_url, now
    ).run();

    // Look up the (now-current) row to find the right branch_root for the JWT.
    const row = await env.DB.prepare(
      'SELECT branch_root FROM residents WHERE identity_hash = ?'
    ).bind(hash).first();

    // Mint a full-resident JWT so subsequent calls authenticate against
    // /api/profile etc. Front-end stores this in localStorage as verify_jwt
    // mirroring the existing invite-handshake convention.
    const newJwt = await signJWT({
      sub: hash, branch: row ? row.branch_root : null, auth_source: 'self_serve',
    }, env.JWT_SECRET);

    return jsonResponse({
      status: 'match',
      session_jwt: newJwt,
    }, env);
  }

  if (result.status === 'first_initial_mismatch') {
    return jsonResponse({
      status: 'first_initial_mismatch',
      alternatives: result.alternatives,
      vouch_link: '/verify-me#vouch',
    }, env);
  }

  return jsonResponse({
    status: 'name_mismatch',
    vouch_link: '/verify-me#vouch',
  }, env);
}
