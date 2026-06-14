import { normalizeEmail, isValidEmail, randomToken } from '../lib/email.js';
import { DEFAULT_BOARDS_ON_SIGNUP } from '../lib/topics.js';
import { sendMail } from '../lib/mail.js';
import {
  confirmEmailSubject, renderConfirmEmailHtml, renderConfirmEmailText,
  manageEmailSubject,  renderManageEmailHtml,  renderManageEmailText
} from '../lib/auth-emails.js';

const CONFIRMATION_TTL_MS = 24 * 60 * 60 * 1000;

async function verifyTurnstile(token, env, ip) {
  if (env.TURNSTILE_TEST_BYPASS_TOKEN && token === env.TURNSTILE_TEST_BYPASS_TOKEN) return true;
  if (!env.TURNSTILE_SECRET) return false;
  const resp = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ secret: env.TURNSTILE_SECRET, response: token, remoteip: ip || '' })
  });
  const j = await resp.json();
  return !!j.success;
}

export async function handleSubscribe(request, env, corsHeaders) {
  let body;
  try { body = await request.json(); }
  catch { return jsonResp(400, { error: 'invalid body' }, corsHeaders); }

  const email = normalizeEmail(body.email);
  if (!isValidEmail(email)) return jsonResp(400, { error: 'invalid email' }, corsHeaders);

  const turnstileToken = typeof body.turnstileToken === 'string' ? body.turnstileToken : '';
  if (!turnstileToken) return jsonResp(400, { error: 'missing turnstile token' }, corsHeaders);
  const ip = request.headers.get('cf-connecting-ip') || '';
  const tsOk = await verifyTurnstile(turnstileToken, env, ip);
  if (!tsOk) return jsonResp(400, { error: 'turnstile verification failed' }, corsHeaders);

  const now = Date.now();
  const existing = await env.DB.prepare('SELECT id, status, confirmation_token, manage_token FROM subscriber WHERE email = ?').bind(email).first();

  let row;
  if (existing) {
    if (existing.status === 'confirmed') {
      await sendMail(env, {
        to: email,
        subject: manageEmailSubject(),
        html: renderManageEmailHtml(env, existing.manage_token),
        text: renderManageEmailText(env, existing.manage_token)
      });
      return jsonResp(200, { ok: true }, corsHeaders);  // neutral response, no info leak
    }
    // pending or other non-terminal: refresh the confirmation token
    const confirmation_token = randomToken();
    await env.DB.prepare('UPDATE subscriber SET confirmation_token=?, confirmation_expires=? WHERE id=?')
      .bind(confirmation_token, now + CONFIRMATION_TTL_MS, existing.id).run();
    row = { ...existing, confirmation_token };
  } else {
    const id = randomToken();
    const confirmation_token = randomToken();
    const manage_token = randomToken();
    await env.DB.prepare(`
      INSERT INTO subscriber (id, email, status, confirmation_token, confirmation_expires, manage_token, boards, topics, created_at)
      VALUES (?, ?, 'pending_confirmation', ?, ?, ?, ?, ?, ?)
    `).bind(id, email, confirmation_token, now + CONFIRMATION_TTL_MS, manage_token, JSON.stringify(DEFAULT_BOARDS_ON_SIGNUP), JSON.stringify([]), now).run();
    row = { id, confirmation_token, manage_token };
  }

  await sendMail(env, {
    to: email,
    subject: confirmEmailSubject(),
    html: renderConfirmEmailHtml(env, row.confirmation_token),
    text: renderConfirmEmailText(env, row.confirmation_token)
  });
  return jsonResp(200, { ok: true }, corsHeaders);
}

function jsonResp(status, body, corsHeaders) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
}
