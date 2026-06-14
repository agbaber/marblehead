import { verifyJWT, extractJWT } from './jwt.js';

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
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
  if (status !== 200) return jsonResponse({ error: 'unauthenticated' }, status);

  const r = await env.DB.prepare(
    'SELECT identity_hash, display_name, public_identity, claim_source, ' +
    '       auth_source, fb_user_id, fb_profile_url, branch_root ' +
    'FROM residents WHERE identity_hash = ?'
  ).bind(payload.sub).first();

  if (!r) return jsonResponse({ error: 'not found' }, 404);

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
  });
}

/**
 * POST /api/profile
 * Body: { display_name?: string, public_identity?: 0|1 }
 */
export async function handleProfilePost(request, env) {
  const { status, payload } = await authn(request, env);
  if (status !== 200) return jsonResponse({ error: 'unauthenticated' }, status);

  const body = await request.json();
  const fields = [];
  const args = [];

  if (typeof body.display_name === 'string') {
    if (body.display_name.length > 80) {
      return jsonResponse({ error: 'display_name too long' }, 400);
    }
    fields.push('display_name = ?');
    args.push(body.display_name);
  }

  if (body.public_identity === 0 || body.public_identity === 1) {
    fields.push('public_identity = ?');
    args.push(body.public_identity);
  }

  if (fields.length === 0) {
    return jsonResponse({ error: 'nothing to update' }, 400);
  }

  args.push(payload.sub);
  await env.DB.prepare(
    `UPDATE residents SET ${fields.join(', ')} WHERE identity_hash = ?`
  ).bind(...args).run();

  return jsonResponse({ ok: true });
}

/**
 * DELETE /api/claim
 * Soft-deletes the authenticated resident (sets revoked_at). Engagement
 * rows are left in place; they become unattributable.
 */
export async function handleClaimRelease(request, env) {
  const { status, payload } = await authn(request, env);
  if (status !== 200) return jsonResponse({ error: 'unauthenticated' }, status);

  const now = Math.floor(Date.now() / 1000);
  await env.DB.prepare(
    'UPDATE residents SET revoked_at = ? WHERE identity_hash = ?'
  ).bind(now, payload.sub).run();
  return jsonResponse({ ok: true });
}
