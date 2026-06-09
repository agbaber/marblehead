import { normalizeEmail, isValidEmail, randomToken } from '../lib/email.js';
import { DEFAULT_BOARDS_ON_SIGNUP } from '../lib/topics.js';
import { sendMail } from '../lib/mail.js';

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
        subject: '[MHD Data] Manage your subscription',
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
    subject: '[MHD Data] Confirm your subscription',
    html: renderConfirmEmailHtml(env, row.confirmation_token),
    text: renderConfirmEmailText(env, row.confirmation_token)
  });
  return jsonResp(200, { ok: true }, corsHeaders);
}

function renderConfirmEmailHtml(env, token) {
  const url = `${env.SITE_BASE_URL}/subscribe/confirm/?token=${encodeURIComponent(token)}`;
  return `<!doctype html><html><body style="font-family: sans-serif; max-width: 560px; margin: 0 auto; padding: 24px;">
    <p>You asked to subscribe to Marblehead Data's meeting digest.</p>
    <p><a href="${url}" style="background: #1a3a5c; color: #fff; padding: 10px 18px; text-decoration: none; border-radius: 4px;">Confirm subscription</a></p>
    <p style="color: #666;">This link expires in 24 hours. If this wasn't you, ignore this email — no account was created.</p>
  </body></html>`;
}
function renderConfirmEmailText(env, token) {
  return `You asked to subscribe to Marblehead Data's meeting digest.\n\nConfirm: ${env.SITE_BASE_URL}/subscribe/confirm/?token=${token}\n\nThis link expires in 24 hours. If this wasn't you, ignore this email — no account was created.\n`;
}
function renderManageEmailHtml(env, manageToken) {
  const url = `${env.SITE_BASE_URL}/me/subscription/?token=${encodeURIComponent(manageToken)}`;
  return `<!doctype html><html><body style="font-family: sans-serif; max-width: 560px; margin: 0 auto; padding: 24px;">
    <p>You're already subscribed to Marblehead Data. Here's your manage link:</p>
    <p><a href="${url}">${url}</a></p>
  </body></html>`;
}
function renderManageEmailText(env, manageToken) {
  return `You're already subscribed. Manage: ${env.SITE_BASE_URL}/me/subscription/?token=${manageToken}\n`;
}

function jsonResp(status, body, corsHeaders) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
}
