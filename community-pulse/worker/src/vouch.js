// Peer-vouch-on-demand: handlers for the three /api/verify/vouch-* endpoints.
// See docs/superpowers/specs/2026-06-22-passkey-first-login-design.md

import { signJWT } from './jwt.js';

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
