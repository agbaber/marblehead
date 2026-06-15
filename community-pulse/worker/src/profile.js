import { verifyJWT, extractJWT } from './jwt.js';

function jsonResponse(body, statusOrEnv, env) {
  // Accept either (body, status, env) or (body, env). Mirrors the CORS
  // headers used by /api/streets etc. so the browser can read responses
  // from cross-origin XHR. Without these headers, fetch() in the page on
  // marbleheaddata.org throws on every 4xx and breaks the controllers.
  if (statusOrEnv && typeof statusOrEnv === 'object') {
    env = statusOrEnv;
    statusOrEnv = 200;
  }
  const status = statusOrEnv || 200;
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': (env && env.ALLOWED_ORIGIN) || '*',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
  return new Response(JSON.stringify(body), { status, headers });
}

async function authn(request, env) {
  const token = extractJWT(request);
  if (!token) return { status: 401, payload: null };
  const payload = await verifyJWT(token, env.JWT_SECRET);
  if (!payload || !payload.sub) return { status: 401, payload: null };
  return { status: 200, payload };
}

/**
 * GET /api/profile
 * Returns the authenticated resident's profile shape.
 */
export async function handleProfileGet(request, env) {
  const { status, payload } = await authn(request, env);
  if (status !== 200) return jsonResponse({ error: 'unauthenticated' }, status, env);

  const r = await env.DB.prepare(
    'SELECT identity_hash, display_name, public_identity, claim_source, ' +
    '       auth_source, fb_user_id, fb_profile_url, branch_root ' +
    'FROM residents WHERE identity_hash = ?'
  ).bind(payload.sub).first();

  if (!r) return jsonResponse({ error: 'not found' }, 404, env);

  const pkRow = await env.DB.prepare(
    'SELECT 1 FROM passkey_credentials WHERE identity_hash = ? LIMIT 1'
  ).bind(payload.sub).first();

  return jsonResponse({
    identity_hash: r.identity_hash,
    display_name: r.display_name,
    public_identity: r.public_identity,
    claim_source: r.claim_source,
    auth_source: r.auth_source,
    has_facebook: !!r.fb_user_id,
    fb_profile_url: r.fb_profile_url,
    has_passkey: !!pkRow,
    branch_root: r.branch_root,
  }, env);
}

/**
 * POST /api/profile
 * Body: { display_name?: string, public_identity?: 0|1 }
 */
export async function handleProfilePost(request, env) {
  const { status, payload } = await authn(request, env);
  if (status !== 200) return jsonResponse({ error: 'unauthenticated' }, status, env);

  const body = await request.json();
  const fields = [];
  const args = [];

  if (typeof body.display_name === 'string') {
    if (body.display_name.length > 80) {
      return jsonResponse({ error: 'display_name too long' }, 400, env);
    }
    fields.push('display_name = ?');
    args.push(body.display_name);
  }

  if (body.public_identity === 0 || body.public_identity === 1) {
    fields.push('public_identity = ?');
    args.push(body.public_identity);
  }

  if (fields.length === 0) {
    return jsonResponse({ error: 'nothing to update' }, 400, env);
  }

  args.push(payload.sub);
  await env.DB.prepare(
    `UPDATE residents SET ${fields.join(', ')} WHERE identity_hash = ?`
  ).bind(...args).run();

  return jsonResponse({ ok: true }, env);
}

/**
 * DELETE /api/claim
 * Soft-deletes the authenticated resident (sets revoked_at). Engagement
 * rows are left in place; they become unattributable.
 */
export async function handleClaimRelease(request, env) {
  const { status, payload } = await authn(request, env);
  if (status !== 200) return jsonResponse({ error: 'unauthenticated' }, status, env);

  const now = Math.floor(Date.now() / 1000);
  await env.DB.prepare(
    'UPDATE residents SET revoked_at = ? WHERE identity_hash = ?'
  ).bind(now, payload.sub).run();
  return jsonResponse({ ok: true }, env);
}

/**
 * GET /api/me/pre
 * Used by the verify-me claim form to display the FB name without
 * exposing the JWT to JS (the cookie is HttpOnly).
 */
export async function handleMePre(request, env) {
  const token = extractJWT(request);
  if (!token) return jsonResponse({ error: 'unauthenticated' }, 401, env);
  const payload = await verifyJWT(token, env.JWT_SECRET);
  if (!payload || !payload.pre_resident) {
    return jsonResponse({ error: 'forbidden — not a pre-resident session' }, 403, env);
  }
  return jsonResponse({
    fb_user_id: payload.fb_user_id,
    fb_display_name: payload.fb_display_name,
    fb_profile_url: payload.fb_profile_url,
  }, env);
}
