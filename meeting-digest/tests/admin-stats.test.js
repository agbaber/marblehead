// meeting-digest/tests/admin-stats.test.js
import { describe, it, expect, beforeEach } from 'vitest';
import { env, applyD1Migrations } from 'cloudflare:test';
import { fetchSubscriberStats } from '../worker/src/lib/admin-stats.js';

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
)`
  ]
};
const MIGRATION_0002 = {
  name: '0002_drip_week_index',
  queries: [
    `ALTER TABLE subscriber ADD COLUMN drip_week_index INTEGER NOT NULL DEFAULT 0`
  ]
};

const DAY_MS = 24 * 60 * 60 * 1000;

beforeEach(async () => {
  await applyD1Migrations(env.DB, [MIGRATION_0001, MIGRATION_0002]);
  await env.DB.prepare('DELETE FROM subscriber').run();
});

async function insertRow(opts) {
  await env.DB.prepare(`
    INSERT INTO subscriber (id, email, status, manage_token, boards, topics, created_at, confirmed_at, unsubscribed_at)
    VALUES (?, ?, ?, ?, '[]', '[]', ?, ?, ?)
  `).bind(
    opts.id,
    opts.email,
    opts.status,
    opts.manage_token || 'mtok',
    opts.created_at,
    opts.confirmed_at || null,
    opts.unsubscribed_at || null
  ).run();
}

describe('fetchSubscriberStats', () => {
  it('returns zeros for every status when the table is empty', async () => {
    const now = Date.now();
    const stats = await fetchSubscriberStats(env, now);
    expect(stats.confirmed).toEqual({ n: 0, n_new: 0 });
    expect(stats.pending_confirmation).toEqual({ n: 0, n_new: 0 });
    expect(stats.unsubscribed).toEqual({ n: 0, n_new: 0 });
    expect(stats.bounced).toEqual({ n: 0, n_new: 0 });
    expect(stats.complained).toEqual({ n: 0, n_new: 0 });
  });

  it('counts confirmed rows whose confirmed_at is inside the 7-day window as new', async () => {
    const now = Date.now();
    await insertRow({
      id: 'a', email: 'a@x', status: 'confirmed',
      created_at: now - 10 * DAY_MS, confirmed_at: now - 3 * DAY_MS
    });
    const stats = await fetchSubscriberStats(env, now);
    expect(stats.confirmed).toEqual({ n: 1, n_new: 1 });
  });

  it('does not count confirmed rows whose confirmed_at is older than 7 days as new', async () => {
    const now = Date.now();
    await insertRow({
      id: 'a', email: 'a@x', status: 'confirmed',
      created_at: now - 30 * DAY_MS, confirmed_at: now - 10 * DAY_MS
    });
    const stats = await fetchSubscriberStats(env, now);
    expect(stats.confirmed).toEqual({ n: 1, n_new: 0 });
  });

  it('counts pending_confirmation rows whose created_at is inside the window as new', async () => {
    const now = Date.now();
    await insertRow({
      id: 'a', email: 'a@x', status: 'pending_confirmation',
      created_at: now - 2 * DAY_MS
    });
    const stats = await fetchSubscriberStats(env, now);
    expect(stats.pending_confirmation).toEqual({ n: 1, n_new: 1 });
  });

  it('counts unsubscribed rows whose unsubscribed_at is inside the window as new', async () => {
    const now = Date.now();
    await insertRow({
      id: 'a', email: 'a@x', status: 'unsubscribed',
      created_at: now - 40 * DAY_MS, unsubscribed_at: now - 1 * DAY_MS
    });
    const stats = await fetchSubscriberStats(env, now);
    expect(stats.unsubscribed).toEqual({ n: 1, n_new: 1 });
  });

  it('counts bounced rows but never marks them new (no bounced_at column)', async () => {
    const now = Date.now();
    await insertRow({
      id: 'a', email: 'a@x', status: 'bounced',
      created_at: now - 2 * DAY_MS, confirmed_at: now - 2 * DAY_MS
    });
    const stats = await fetchSubscriberStats(env, now);
    expect(stats.bounced).toEqual({ n: 1, n_new: 0 });
  });

  it('counts complained rows but never marks them new', async () => {
    const now = Date.now();
    await insertRow({
      id: 'a', email: 'a@x', status: 'complained',
      created_at: now - 2 * DAY_MS
    });
    const stats = await fetchSubscriberStats(env, now);
    expect(stats.complained).toEqual({ n: 1, n_new: 0 });
  });

  it('aggregates a mixed table correctly', async () => {
    const now = Date.now();
    // 2 confirmed (one new, one old)
    await insertRow({ id: 'a', email: 'a@x', status: 'confirmed', created_at: now - 30 * DAY_MS, confirmed_at: now - 2 * DAY_MS });
    await insertRow({ id: 'b', email: 'b@x', status: 'confirmed', created_at: now - 90 * DAY_MS, confirmed_at: now - 60 * DAY_MS });
    // 3 pending (one new, two old)
    await insertRow({ id: 'c', email: 'c@x', status: 'pending_confirmation', created_at: now - 1 * DAY_MS });
    await insertRow({ id: 'd', email: 'd@x', status: 'pending_confirmation', created_at: now - 10 * DAY_MS });
    await insertRow({ id: 'e', email: 'e@x', status: 'pending_confirmation', created_at: now - 30 * DAY_MS });

    const stats = await fetchSubscriberStats(env, now);
    expect(stats.confirmed).toEqual({ n: 2, n_new: 1 });
    expect(stats.pending_confirmation).toEqual({ n: 3, n_new: 1 });
    expect(stats.unsubscribed).toEqual({ n: 0, n_new: 0 });
    expect(stats.bounced).toEqual({ n: 0, n_new: 0 });
  });
});
