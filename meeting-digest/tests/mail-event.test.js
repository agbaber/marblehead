import { describe, it, expect, beforeEach } from 'vitest';
import { env, applyD1Migrations } from 'cloudflare:test';
import { handleMailEvent } from '../worker/src/handlers/mail-event.js';

const MIGRATION_0001 = {
  name: '0001_subscriber',
  queries: [
    `CREATE TABLE IF NOT EXISTS subscriber (
  id                    TEXT PRIMARY KEY,
  email                 TEXT NOT NULL,
  status                TEXT NOT NULL CHECK (status IN ('pending_confirmation','confirmed','unsubscribed','bounced','complained')),
  confirmation_token    TEXT,
  confirmation_expires  INTEGER,
  manage_token          TEXT NOT NULL,
  boards                TEXT NOT NULL,
  topics                TEXT NOT NULL,
  cadence               TEXT NOT NULL DEFAULT 'weekly',
  created_at            INTEGER NOT NULL,
  confirmed_at          INTEGER,
  unsubscribed_at       INTEGER,
  last_sent_at          INTEGER
)`,
    `CREATE TABLE IF NOT EXISTS delivery_log (
  id                   TEXT PRIMARY KEY,
  subscriber_id        TEXT NOT NULL,
  sent_at              INTEGER NOT NULL,
  n_meetings           INTEGER NOT NULL,
  provider_message_id  TEXT,
  status               TEXT NOT NULL CHECK (status IN ('queued','delivered','bounced','complained','failed')),
  FOREIGN KEY (subscriber_id) REFERENCES subscriber(id)
)`
  ]
};

// Valid whsec_ secret: base64 of 32 bytes.
const SECRET = 'whsec_' + btoa('0123456789abcdef0123456789abcdef');

async function svixSignature(secret, id, timestamp, payload) {
  const raw = Uint8Array.from(atob(secret.slice('whsec_'.length)), c => c.charCodeAt(0));
  const key = await crypto.subtle.importKey('raw', raw, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${id}.${timestamp}.${payload}`));
  return 'v1,' + btoa(String.fromCharCode(...new Uint8Array(mac)));
}

async function signedRequest(body, { secret = SECRET, timestamp, id = 'msg_test1' } = {}) {
  const payload = JSON.stringify(body);
  const ts = timestamp ?? String(Math.floor(Date.now() / 1000));
  const signature = await svixSignature(secret, id, ts, payload);
  return new Request('https://worker/api/mail-event', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'svix-id': id,
      'svix-timestamp': ts,
      'svix-signature': signature
    },
    body: payload
  });
}

function testEnv(overrides = {}) {
  return { DB: env.DB, RESEND_WEBHOOK_SECRET: SECRET, ...overrides };
}

async function seed() {
  await env.DB.prepare('DELETE FROM delivery_log').run();
  await env.DB.prepare('DELETE FROM subscriber').run();
  await env.DB.prepare(`
    INSERT INTO subscriber (id, email, status, manage_token, boards, topics, created_at)
    VALUES ('sub1', 'a@example.com', 'confirmed', 'mtok', '[]', '[]', 1)
  `).run();
  await env.DB.prepare(`
    INSERT INTO delivery_log (id, subscriber_id, sent_at, n_meetings, provider_message_id, status)
    VALUES ('dl1', 'sub1', 1, 1, 'provider-msg-1', 'queued')
  `).run();
}

describe('handleMailEvent', () => {
  beforeEach(async () => {
    await applyD1Migrations(env.DB, [MIGRATION_0001]);
    await seed();
  });

  it('returns 503 when RESEND_WEBHOOK_SECRET is not configured', async () => {
    const req = await signedRequest({ type: 'email.delivered', data: { email_id: 'provider-msg-1' } });
    const r = await handleMailEvent(req, testEnv({ RESEND_WEBHOOK_SECRET: undefined }), {});
    expect(r.status).toBe(503);
  });

  it('rejects an invalid signature with 401 and changes nothing', async () => {
    const req = await signedRequest(
      { type: 'email.bounced', data: { email_id: 'provider-msg-1' } },
      { secret: 'whsec_' + btoa('another-secret-entirely-32-byte!') }
    );
    const r = await handleMailEvent(req, testEnv(), {});
    expect(r.status).toBe(401);
    const sub = await env.DB.prepare('SELECT status FROM subscriber WHERE id=?').bind('sub1').first();
    expect(sub.status).toBe('confirmed');
  });

  it('rejects a stale timestamp with 401', async () => {
    const stale = String(Math.floor(Date.now() / 1000) - 3600);
    const req = await signedRequest(
      { type: 'email.delivered', data: { email_id: 'provider-msg-1' } },
      { timestamp: stale }
    );
    const r = await handleMailEvent(req, testEnv(), {});
    expect(r.status).toBe(401);
  });

  it('marks the delivery_log row delivered on email.delivered', async () => {
    const req = await signedRequest({ type: 'email.delivered', data: { email_id: 'provider-msg-1' } });
    const r = await handleMailEvent(req, testEnv(), {});
    expect(r.status).toBe(200);
    const dl = await env.DB.prepare('SELECT status FROM delivery_log WHERE id=?').bind('dl1').first();
    expect(dl.status).toBe('delivered');
    const sub = await env.DB.prepare('SELECT status FROM subscriber WHERE id=?').bind('sub1').first();
    expect(sub.status).toBe('confirmed');
  });

  it('marks subscriber and delivery_log bounced on email.bounced', async () => {
    const req = await signedRequest({ type: 'email.bounced', data: { email_id: 'provider-msg-1' } });
    const r = await handleMailEvent(req, testEnv(), {});
    expect(r.status).toBe(200);
    const dl = await env.DB.prepare('SELECT status FROM delivery_log WHERE id=?').bind('dl1').first();
    expect(dl.status).toBe('bounced');
    const sub = await env.DB.prepare('SELECT status FROM subscriber WHERE id=?').bind('sub1').first();
    expect(sub.status).toBe('bounced');
  });

  it('ignores event types it does not track', async () => {
    const req = await signedRequest({ type: 'email.opened', data: { email_id: 'provider-msg-1' } });
    const r = await handleMailEvent(req, testEnv(), {});
    expect(r.status).toBe(200);
    expect((await r.json()).ignored).toBe(true);
  });

  it('ignores events for unknown message ids', async () => {
    const req = await signedRequest({ type: 'email.bounced', data: { email_id: 'nope' } });
    const r = await handleMailEvent(req, testEnv(), {});
    expect(r.status).toBe(200);
    expect((await r.json()).ignored).toBe(true);
  });
});
