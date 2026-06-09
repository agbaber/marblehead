import { describe, it, expect, beforeEach } from 'vitest';
import { env, fetchMock, SELF, applyD1Migrations } from 'cloudflare:test';

// Migration SQL split into individual statements for applyD1Migrations.
// Each entry must be a non-empty string (no blanks, no semicolons trailing).
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
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_subscriber_email ON subscriber(email)`,
    `CREATE INDEX IF NOT EXISTS idx_subscriber_status ON subscriber(status)`,
    `CREATE INDEX IF NOT EXISTS idx_subscriber_manage_token ON subscriber(manage_token)`,
    `CREATE INDEX IF NOT EXISTS idx_subscriber_confirmation_token ON subscriber(confirmation_token)`,
    `CREATE TABLE IF NOT EXISTS delivery_log (
  id                   TEXT PRIMARY KEY,
  subscriber_id        TEXT NOT NULL,
  sent_at              INTEGER NOT NULL,
  n_meetings           INTEGER NOT NULL,
  provider_message_id  TEXT,
  status               TEXT NOT NULL CHECK (status IN ('queued','delivered','bounced','complained','failed')),
  FOREIGN KEY (subscriber_id) REFERENCES subscriber(id)
)`,
    `CREATE INDEX IF NOT EXISTS idx_delivery_log_subscriber ON delivery_log(subscriber_id)`,
    `CREATE INDEX IF NOT EXISTS idx_delivery_log_provider_message_id ON delivery_log(provider_message_id)`
  ]
};

beforeEach(async () => {
  await applyD1Migrations(env.DB, [MIGRATION_0001]);
  // Clean slate between tests.
  await env.DB.prepare('DELETE FROM delivery_log').run();
  await env.DB.prepare('DELETE FROM subscriber').run();

  // Stub the mail provider — no real network call.
  env.MAIL_PROVIDER_API_KEY = 'test-key';
  fetchMock.activate();
  fetchMock.disableNetConnect();
  fetchMock.get('https://api.resend.com')
    .intercept({ path: '/emails', method: 'POST' })
    .reply(200, JSON.stringify({ id: 'msg_test_1' }))
    .persist();
});

describe('POST /api/subscribe', () => {
  it('creates a pending row and triggers a confirmation send', async () => {
    const r = await SELF.fetch('https://worker/api/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'Hi@Example.COM', turnstileToken: 'TEST-OK' })
    });
    expect(r.status).toBe(200);
    const { ok } = await r.json();
    expect(ok).toBe(true);

    const row = await env.DB.prepare('SELECT * FROM subscriber WHERE email = ?').bind('hi@example.com').first();
    expect(row).toBeTruthy();
    expect(row.status).toBe('pending_confirmation');
    expect(row.confirmation_token).toMatch(/^[A-Za-z0-9_-]{40,}$/);
    expect(JSON.parse(row.boards)).toEqual(['select-board', 'school-committee', 'finance-committee']);
    expect(JSON.parse(row.topics)).toEqual([]);
  });

  it('returns 400 on invalid email', async () => {
    const r = await SELF.fetch('https://worker/api/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'not-an-email', turnstileToken: 'TEST-OK' })
    });
    expect(r.status).toBe(400);
  });

  it('returns 400 when Turnstile token is missing', async () => {
    const r = await SELF.fetch('https://worker/api/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'a@b.com' })
    });
    expect(r.status).toBe(400);
  });

  it('does not create a second row for a duplicate email', async () => {
    const body = JSON.stringify({ email: 'dup@example.com', turnstileToken: 'TEST-OK' });
    const opts = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body };
    await SELF.fetch('https://worker/api/subscribe', opts);
    await SELF.fetch('https://worker/api/subscribe', opts);
    const { results } = await env.DB.prepare('SELECT id FROM subscriber WHERE email = ?').bind('dup@example.com').all();
    expect(results.length).toBe(1);
  });
});
