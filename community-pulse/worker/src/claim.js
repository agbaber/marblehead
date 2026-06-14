import { verifyJWT, extractJWT, signJWT } from './jwt.js';
import { normalizeAddress, matchOwner } from './match.js';

const HASH_SALT = 'marblehead-verify-salt';

async function identityHash(displayName, normalizedAddress) {
  const enc = new TextEncoder();
  const data = enc.encode(`${displayName.toLowerCase()}:${normalizedAddress}:${HASH_SALT}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map(b => b.toString(16).padStart(2, '0')).join('');
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * POST /api/claim/address
 * Body: { claimed_address: string }
 * Auth: Bearer JWT with pre_resident=true
 */
export async function handleClaimAddress(request, env) {
  const token = extractJWT(request);
  if (!token) return jsonResponse({ error: 'unauthenticated' }, 401);

  const payload = await verifyJWT(token, env.JWT_SECRET);
  if (!payload || !payload.pre_resident) {
    return jsonResponse({ error: 'forbidden — claim already finalized' }, 403);
  }

  const { claimed_address } = await request.json();
  if (!claimed_address) return jsonResponse({ error: 'missing claimed_address' }, 400);

  const normalized = normalizeAddress(claimed_address);
  const parcel = await env.DB.prepare(
    'SELECT owner_name FROM parcel_owners WHERE address_normalized = ?'
  ).bind(normalized).first();

  if (!parcel) {
    return jsonResponse({
      status: 'no_match',
      vouch_link: '/verify-me#vouch',
    });
  }

  const result = matchOwner(payload.fb_display_name, parcel.owner_name);

  if (result.status === 'match') {
    const hash = await identityHash(payload.fb_display_name, normalized);
    const now = Math.floor(Date.now() / 1000);
    await env.DB.prepare(
      'INSERT INTO residents (' +
      '  identity_hash, fb_user_id, display_name, fb_profile_url, ' +
      '  auth_source, claim_source, public_identity, created_at) ' +
      'VALUES (?, ?, ?, ?, \'self_serve\', \'assessor_match\', 0, ?)'
    ).bind(
      hash, payload.fb_user_id, payload.fb_display_name,
      payload.fb_profile_url, now
    ).run();

    // Mint a full-resident JWT so subsequent calls authenticate against
    // /api/profile etc. Front-end stores this in localStorage as verify_jwt
    // mirroring the existing invite-handshake convention.
    const newJwt = await signJWT({
      sub: hash, branch: null, auth_source: 'self_serve',
    }, env.JWT_SECRET);

    return jsonResponse({
      status: 'match',
      session_jwt: newJwt,
    });
  }

  if (result.status === 'first_initial_mismatch') {
    return jsonResponse({
      status: 'first_initial_mismatch',
      alternatives: result.alternatives,
      vouch_link: '/verify-me#vouch',
    });
  }

  return jsonResponse({
    status: 'name_mismatch',
    vouch_link: '/verify-me#vouch',
  });
}
