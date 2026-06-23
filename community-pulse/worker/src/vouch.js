// Peer-vouch-on-demand: handlers for the three /api/verify/vouch-* endpoints.
// See docs/superpowers/specs/2026-06-22-passkey-first-login-design.md

import { signJWT, verifyJWT, extractJWT } from './jwt.js';

const VOUCH_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function json(body, env, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': (env && env.ALLOWED_ORIGIN) || '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * POST /api/verify/vouch-request
 * Body: { identity_hash, name, address }
 * Returns: { token, expires_at } | { error }
 */
export async function handleVouchRequest(request, env) {
  let body;
  try { body = await request.json(); }
  catch { return json({ error: 'invalid_json' }, env, 400); }

  const { identity_hash, name, address } = body;
  if (!identity_hash || !name || !address) {
    return json({ error: 'missing_fields' }, env, 400);
  }

  // Reject if requester is already a verified (non-revoked) resident.
  const existing = await env.DB.prepare(
    'SELECT identity_hash FROM residents WHERE identity_hash = ? AND revoked_at IS NULL'
  ).bind(identity_hash).first();
  if (existing) return json({ error: 'already_verified' }, env, 400);

  // Reject if requester already has a pending active request.
  const active = await env.DB.prepare(
    `SELECT token FROM vouch_requests WHERE requester_hash = ?
     AND status = 'pending' AND expires_at > ?`
  ).bind(identity_hash, Date.now()).first();
  if (active) return json({ error: 'active_request_exists', existing_token: active.token }, env, 400);

  const token = randomToken();
  const now = Date.now();
  const expires_at = now + VOUCH_TTL_MS;

  await env.DB.prepare(
    `INSERT INTO vouch_requests
     (token, requester_hash, requester_name, requester_address, created_at, expires_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).bind(token, identity_hash, name, address, now, expires_at).run();

  return json({ token, expires_at }, env);
}

/**
 * GET /api/verify/vouch-status?token=<token>
 * Returns: { status: 'pending'|'verified'|'declined'|'expired', jwt?: string }
 *          | 404 if token unknown
 */
export async function handleVouchStatus(request, env, secret) {
  const url = new URL(request.url);
  const token = url.searchParams.get('token');
  if (!token) return json({ error: 'missing_token' }, env, 400);

  const row = await env.DB.prepare(
    'SELECT token, requester_hash, status, expires_at, vouched_by FROM vouch_requests WHERE token = ?'
  ).bind(token).first();

  if (!row) return json({ error: 'unknown_token' }, env, 404);

  if (row.status === 'pending' && row.expires_at <= Date.now()) {
    return json({ status: 'expired' }, env);
  }
  if (row.status === 'verified') {
    const resident = await env.DB.prepare(
      'SELECT branch_root FROM residents WHERE identity_hash = ?'
    ).bind(row.requester_hash).first();
    const branch = resident ? resident.branch_root : null;
    const jwt = await signJWT({
      sub: row.requester_hash,
      branch,
      auth_source: 'peer_vouch',
    }, secret || env.JWT_SECRET);
    return json({ status: 'verified', jwt }, env);
  }
  return json({ status: row.status }, env);
}

/**
 * POST /api/verify/vouch-respond
 * Body: { token, decision: 'confirm' | 'decline' }
 * Auth: Bearer <voucher's session JWT>
 * Returns: { ok: true } | { error }
 */
export async function handleVouchRespond(request, env, secret) {
  const jwtSecret = secret || env.JWT_SECRET;

  const jwt = extractJWT(request);
  if (!jwt) return json({ error: 'missing_auth' }, env, 401);
  let payload;
  try { payload = await verifyJWT(jwt, jwtSecret); }
  catch { return json({ error: 'invalid_auth' }, env, 401); }
  if (!payload || !payload.sub) return json({ error: 'invalid_auth' }, env, 401);

  let body;
  try { body = await request.json(); }
  catch { return json({ error: 'invalid_json' }, env, 400); }
  const { token, decision } = body;
  if (!token || !['confirm', 'decline'].includes(decision)) {
    return json({ error: 'missing_or_bad_fields' }, env, 400);
  }

  const row = await env.DB.prepare(
    'SELECT token, requester_hash, requester_name, requester_address, status, expires_at FROM vouch_requests WHERE token = ?'
  ).bind(token).first();
  if (!row) return json({ error: 'unknown_token' }, env, 404);
  if (row.status !== 'pending') return json({ error: 'already_resolved' }, env, 400);
  if (row.expires_at <= Date.now()) return json({ error: 'expired' }, env, 400);

  const voucher = await env.DB.prepare(
    'SELECT identity_hash, branch_root, invites_remaining FROM residents WHERE identity_hash = ?'
  ).bind(payload.sub).first();
  if (!voucher) return json({ error: 'voucher_not_found' }, env, 403);

  const now = Date.now();

  if (decision === 'decline') {
    await env.DB.prepare(
      `UPDATE vouch_requests SET status = ?, vouched_by = ?, resolved_at = ? WHERE token = ?`
    ).bind('declined', voucher.identity_hash, now, token).run();
    return json({ ok: true }, env);
  }

  // Confirm.
  if (voucher.invites_remaining <= 0) {
    return json({ error: 'no_invites_remaining' }, env, 400);
  }

  // Create the resident under the voucher's branch.
  await env.DB.prepare(
    `INSERT INTO residents
     (identity_hash, invited_by, branch_root, created_at, auth_source, claim_source)
     VALUES (?, ?, ?, ?, 'peer_vouch', 'vouched')`
  ).bind(row.requester_hash, voucher.identity_hash, voucher.branch_root, now).run();

  await env.DB.prepare(
    'UPDATE residents SET invites_remaining = invites_remaining - 1 WHERE identity_hash = ?'
  ).bind(voucher.identity_hash).run();

  await env.DB.prepare(
    `UPDATE vouch_requests SET status = ?, vouched_by = ?, resolved_at = ? WHERE token = ?`
  ).bind('verified', voucher.identity_hash, now, token).run();

  return json({ ok: true }, env);
}
