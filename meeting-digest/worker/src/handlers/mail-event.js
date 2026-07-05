// Resend delivery webhook (Svix-signed): { type, data: { email_id, ... } }.
// Registered in the Resend dashboard against /api/mail-event with the
// signing secret stored as the RESEND_WEBHOOK_SECRET Worker secret.

const SIGNATURE_TOLERANCE_S = 5 * 60;

const STATUS_FOR_TYPE = {
  'email.delivered': 'delivered',
  'email.bounced': 'bounced',
  'email.complained': 'complained',
};

// Bounce/complaint flips the subscriber too, so future digests skip them.
const SUBSCRIBER_STATUS_FOR_TYPE = {
  'email.bounced': 'bounced',
  'email.complained': 'complained',
};

function base64ToBytes(b64) {
  return Uint8Array.from(atob(b64), c => c.charCodeAt(0));
}

function bytesToBase64(bytes) {
  return btoa(String.fromCharCode(...bytes));
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function verifySvix(request, rawBody, secret) {
  const id = request.headers.get('svix-id');
  const timestamp = request.headers.get('svix-timestamp');
  const signatureHeader = request.headers.get('svix-signature');
  if (!id || !timestamp || !signatureHeader) return false;

  const ts = Number(timestamp);
  const now = Math.floor(Date.now() / 1000);
  if (!Number.isFinite(ts) || Math.abs(now - ts) > SIGNATURE_TOLERANCE_S) return false;

  let secretBytes;
  try {
    secretBytes = base64ToBytes(secret.startsWith('whsec_') ? secret.slice(6) : secret);
  } catch {
    return false;
  }
  const key = await crypto.subtle.importKey('raw', secretBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${id}.${timestamp}.${rawBody}`));
  const expected = bytesToBase64(new Uint8Array(mac));

  // Header may carry several space-separated versioned signatures.
  return signatureHeader.split(' ').some(part => {
    const [version, sig] = part.split(',');
    return version === 'v1' && sig && timingSafeEqual(sig, expected);
  });
}

export async function handleMailEvent(request, env, corsHeaders) {
  if (!env.RESEND_WEBHOOK_SECRET) {
    return resp(503, { error: 'webhook secret not configured' }, corsHeaders);
  }

  const rawBody = await request.text();
  const verified = await verifySvix(request, rawBody, env.RESEND_WEBHOOK_SECRET);
  if (!verified) return resp(401, { error: 'invalid signature' }, corsHeaders);

  let evt;
  try { evt = JSON.parse(rawBody); } catch { return resp(400, { error: 'invalid body' }, corsHeaders); }
  const logStatus = evt && typeof evt.type === 'string' ? STATUS_FOR_TYPE[evt.type] : undefined;
  if (!logStatus) {
    return resp(200, { ok: true, ignored: true }, corsHeaders);
  }
  const messageId = evt.data?.email_id;
  if (!messageId) return resp(400, { error: 'missing email_id' }, corsHeaders);

  const dl = await env.DB.prepare('SELECT subscriber_id FROM delivery_log WHERE provider_message_id = ?').bind(messageId).first();
  if (!dl) return resp(200, { ok: true, ignored: true }, corsHeaders);

  const subscriberStatus = SUBSCRIBER_STATUS_FOR_TYPE[evt.type];
  if (subscriberStatus) {
    await env.DB.prepare('UPDATE subscriber SET status=? WHERE id=?').bind(subscriberStatus, dl.subscriber_id).run();
  }
  await env.DB.prepare('UPDATE delivery_log SET status=? WHERE provider_message_id=?').bind(logStatus, messageId).run();
  return resp(200, { ok: true }, corsHeaders);
}

function resp(status, body, corsHeaders) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
}
