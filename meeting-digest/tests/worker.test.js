import { describe, it, expect, beforeEach } from 'vitest';
import { env, fetchMock, SELF, applyD1Migrations } from 'cloudflare:test';
import { runScheduled } from '../worker/src/scheduled.js';

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

const MIGRATION_0002 = {
  name: '0002_drip_week_index',
  queries: [
    `ALTER TABLE subscriber ADD COLUMN drip_week_index INTEGER NOT NULL DEFAULT 0`
  ]
};

beforeEach(async () => {
  await applyD1Migrations(env.DB, [MIGRATION_0001, MIGRATION_0002]);
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

describe('GET /api/subscribe-confirm', () => {
  async function createPending(email) {
    const r = await SELF.fetch('https://worker/api/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, turnstileToken: 'TEST-OK' })
    });
    expect(r.status).toBe(200);
    return env.DB.prepare('SELECT * FROM subscriber WHERE email = ?').bind(email).first();
  }

  it('flips status to confirmed and redirects to manage URL', async () => {
    const row = await createPending('confirm-me@example.com');
    const r = await SELF.fetch(`https://worker/api/subscribe-confirm?token=${row.confirmation_token}`, { redirect: 'manual' });
    expect(r.status).toBe(302);
    expect(r.headers.get('Location')).toMatch(/\/me\/subscription\/\?token=/);
    const after = await env.DB.prepare('SELECT status, confirmed_at, confirmation_token FROM subscriber WHERE email = ?').bind('confirm-me@example.com').first();
    expect(after.status).toBe('confirmed');
    expect(after.confirmed_at).toBeGreaterThan(0);
    expect(after.confirmation_token).toBeNull();
  });

  it('rejects an expired token', async () => {
    const row = await createPending('expired@example.com');
    await env.DB.prepare('UPDATE subscriber SET confirmation_expires = 1 WHERE id = ?').bind(row.id).run();
    const r = await SELF.fetch(`https://worker/api/subscribe-confirm?token=${row.confirmation_token}`, { redirect: 'manual' });
    expect(r.status).toBe(400);
  });

  it('rejects an unknown token', async () => {
    const r = await SELF.fetch(`https://worker/api/subscribe-confirm?token=nope`, { redirect: 'manual' });
    expect(r.status).toBe(404);
  });
});

function primersDirResponse(filenames) {
  return JSON.stringify(filenames.map(name => ({
    type: 'file', name, download_url: `https://example.com/primers/${name}`
  })));
}

function primerMdFile(weekIndex, title) {
  return `---
week_index: ${weekIndex}
title: "${title}"
link_url: /p${weekIndex}/
link_label: "Read"
---
Body for ${title}.
`;
}

function stubGithubPrimers(filenames, weekTitlePairs) {
  fetchMock.get('https://api.github.com')
    .intercept({ path: /\/repos\/.*\/contents\/_primers\?ref=.*/, method: 'GET' })
    .reply(200, primersDirResponse(filenames));
  for (const [name, [w, t]] of weekTitlePairs) {
    fetchMock.get('https://example.com')
      .intercept({ path: `/primers/${name}`, method: 'GET' })
      .reply(200, primerMdFile(w, t));
  }
}

function stubGithubPrimersEmpty() {
  fetchMock.get('https://api.github.com')
    .intercept({ path: /\/repos\/.*\/contents\/_primers\?ref=.*/, method: 'GET' })
    .reply(200, '[]');
}

function stubGithubPrimersFail() {
  fetchMock.get('https://api.github.com')
    .intercept({ path: /\/repos\/.*\/contents\/_primers\?ref=.*/, method: 'GET' })
    .reply(500, '');
}

async function confirmedSubscriber(email, overrides = {}) {
  await SELF.fetch('https://worker/api/subscribe', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, turnstileToken: 'TEST-OK' })
  });
  const row = await env.DB.prepare('SELECT * FROM subscriber WHERE email = ?').bind(email).first();
  await env.DB.prepare(`UPDATE subscriber SET status='confirmed', confirmation_token=NULL, confirmation_expires=NULL, confirmed_at=? WHERE id=?`)
    .bind(Date.now(), row.id).run();
  if (overrides.boards || overrides.topics) {
    await env.DB.prepare('UPDATE subscriber SET boards=?, topics=? WHERE id=?')
      .bind(JSON.stringify(overrides.boards || []), JSON.stringify(overrides.topics || []), row.id).run();
  }
  return env.DB.prepare('SELECT * FROM subscriber WHERE id = ?').bind(row.id).first();
}

describe('GET /api/me/subscription', () => {
  it("returns the subscriber's preferences and available options", async () => {
    const row = await confirmedSubscriber('me@example.com');
    const r = await SELF.fetch(`https://worker/api/me/subscription?token=${row.manage_token}`);
    expect(r.status).toBe(200);
    const data = await r.json();
    expect(data.email).toBe('me@example.com');
    expect(data.boards).toEqual(['select-board', 'school-committee', 'finance-committee']);
    expect(data.topics).toEqual([]);
    expect(data.available.boards.length).toBe(5);
    const topicSlugs = data.available.topics.map(t => t.slug);
    expect(topicSlugs).not.toContain('admin-housekeeping');
    expect(topicSlugs).not.toContain('public-comment');
  });
  it('404s on unknown token', async () => {
    const r = await SELF.fetch(`https://worker/api/me/subscription?token=bogus`);
    expect(r.status).toBe(404);
  });
});

describe('POST /api/preferences-update', () => {
  it('updates boards and topics', async () => {
    const row = await confirmedSubscriber('pref@example.com');
    const r = await SELF.fetch('https://worker/api/preferences-update', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: row.manage_token, boards: ['select-board'], topics: ['override'] })
    });
    expect(r.status).toBe(200);
    const after = await env.DB.prepare('SELECT boards, topics FROM subscriber WHERE id = ?').bind(row.id).first();
    expect(JSON.parse(after.boards)).toEqual(['select-board']);
    expect(JSON.parse(after.topics)).toEqual(['override']);
  });
  it('rejects empty boards AND empty topics', async () => {
    const row = await confirmedSubscriber('empty@example.com');
    const r = await SELF.fetch('https://worker/api/preferences-update', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: row.manage_token, boards: [], topics: [] })
    });
    expect(r.status).toBe(400);
  });
  it('rejects unknown board / topic slugs', async () => {
    const row = await confirmedSubscriber('bad@example.com');
    const r = await SELF.fetch('https://worker/api/preferences-update', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: row.manage_token, boards: ['not-a-board'], topics: [] })
    });
    expect(r.status).toBe(400);
  });
  it('rejects subscribable=false topics (admin-housekeeping, public-comment)', async () => {
    const row = await confirmedSubscriber('noisy@example.com');
    const r = await SELF.fetch('https://worker/api/preferences-update', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: row.manage_token, boards: ['select-board'], topics: ['admin-housekeeping'] })
    });
    expect(r.status).toBe(400);
  });
});

describe('POST /api/unsubscribe', () => {
  it('one-click unsubscribes via token', async () => {
    const row = await confirmedSubscriber('bye@example.com');
    const r = await SELF.fetch('https://worker/api/unsubscribe', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: row.manage_token })
    });
    expect(r.status).toBe(200);
    const after = await env.DB.prepare('SELECT status, unsubscribed_at FROM subscriber WHERE id = ?').bind(row.id).first();
    expect(after.status).toBe('unsubscribed');
    expect(after.unsubscribed_at).toBeGreaterThan(0);
  });
  it('also accepts GET via List-Unsubscribe header for one-click compliance', async () => {
    const row = await confirmedSubscriber('byeget@example.com');
    const r = await SELF.fetch(`https://worker/api/unsubscribe?token=${row.manage_token}`);
    expect(r.status).toBe(200);
  });
});

describe('POST /api/mail-event', () => {
  it('marks bounced subscriber on hard bounce', async () => {
    const row = await confirmedSubscriber('bounced@example.com');
    await env.DB.prepare('INSERT INTO delivery_log (id, subscriber_id, sent_at, n_meetings, provider_message_id, status) VALUES (?, ?, ?, ?, ?, ?)')
      .bind('dl1', row.id, Date.now(), 1, 'pmid-1', 'queued').run();
    const r = await SELF.fetch('https://worker/api/mail-event', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'email.bounced', data: { email_id: 'pmid-1' } })
    });
    expect(r.status).toBe(200);
    const after = await env.DB.prepare('SELECT status FROM subscriber WHERE id = ?').bind(row.id).first();
    expect(after.status).toBe('bounced');
  });
});

describe('runScheduled', () => {
  it('skips silently when subscriber has zero matches', async () => {
    await confirmedSubscriber('quiet@example.com', { boards: ['town-meeting'], topics: [] });
    // Mock the GitHub Contents API to return zero recent files.
    fetchMock.get('https://api.github.com')
      .intercept({ path: /\/repos\/.*\/contents\/_transcripts\?ref=.*/, method: 'GET' })
      .reply(200, JSON.stringify([]));
    stubGithubPrimersEmpty();
    const out = await runScheduled({}, env, { skipTimeGuard: true });
    expect(out.ran).toBe(true);
    expect(out.sent).toBe(0);
    const log = await env.DB.prepare('SELECT count(*) AS n FROM delivery_log').first();
    expect(log.n).toBe(0);
  });

  it('skips subscribers whose last_sent_at is within the idempotency window', async () => {
    const row = await confirmedSubscriber('recent@example.com', { boards: ['select-board'], topics: [] });
    // Mark as just-sent (1 hour ago) — well inside the 5-day window. The
    // eligible-subscriber query should filter this row out before the
    // handler ever reaches the GitHub transcript fetch.
    const oneHourAgoMs = Date.now() - 60 * 60 * 1000;
    await env.DB.prepare('UPDATE subscriber SET last_sent_at = ? WHERE id = ?').bind(oneHourAgoMs, row.id).run();
    const out = await runScheduled({}, env, { skipTimeGuard: true });
    expect(out.ran).toBe(true);
    expect(out.sent).toBe(0);
    expect(out.transcripts).toBe(0);
    const log = await env.DB.prepare('SELECT count(*) AS n FROM delivery_log').first();
    expect(log.n).toBe(0);
  });

  it('sends to subscribers whose last_sent_at is older than the idempotency window', async () => {
    const row = await confirmedSubscriber('stale@example.com', { boards: ['select-board'], topics: [] });
    // Mark as sent 6 days ago — outside the 5-day window.
    const sixDaysAgoMs = Date.now() - 6 * 24 * 60 * 60 * 1000;
    await env.DB.prepare('UPDATE subscriber SET last_sent_at = ? WHERE id = ?').bind(sixDaysAgoMs, row.id).run();
    // Mock a matching transcript with valid frontmatter so the matcher sees it.
    const fakeTranscriptMd = `---
slug: select-board-${new Date().toISOString().slice(0, 10)}
board: select-board
board_display: "Select Board"
date: ${new Date().toISOString().slice(0, 10)}
title: "Select Board"
vimeo_url: "https://vimeo.com/0"
summary_card:
  headline: "Test headline"
  summary: "Test summary"
topic_segments:
---
`;
    fetchMock.get('https://api.github.com')
      .intercept({ path: /\/repos\/.*\/contents\/_transcripts\?ref=.*/, method: 'GET' })
      .reply(200, JSON.stringify([
        { type: 'file', name: `select-board-${new Date().toISOString().slice(0, 10)}.md`, download_url: 'https://example.com/sb.md' }
      ]));
    fetchMock.get('https://example.com')
      .intercept({ path: '/sb.md', method: 'GET' })
      .reply(200, fakeTranscriptMd);
    stubGithubPrimers(['01-welcome.md'], [['01-welcome.md', [1, 'Welcome']]]);
    const out = await runScheduled({}, env, { skipTimeGuard: true });
    expect(out.ran).toBe(true);
    expect(out.sent).toBe(1);
    const log = await env.DB.prepare('SELECT count(*) AS n FROM delivery_log').first();
    expect(log.n).toBe(1);
    const after = await env.DB.prepare('SELECT drip_week_index FROM subscriber WHERE id = ?').bind(row.id).first();
    expect(after.drip_week_index).toBe(1);
  });

  it('new subscriber gets primer 1 and drip_week_index bumps to 1', async () => {
    const row = await confirmedSubscriber('new@example.com', { boards: ['select-board'], topics: [] });
    stubGithubPrimers(
      ['01-welcome.md', '02-org.md'],
      [['01-welcome.md', [1, 'Welcome']], ['02-org.md', [2, 'Org']]]
    );
    const today = new Date().toISOString().slice(0, 10);
    fetchMock.get('https://api.github.com')
      .intercept({ path: /\/repos\/.*\/contents\/_transcripts\?ref=.*/, method: 'GET' })
      .reply(200, JSON.stringify([{ type: 'file', name: `select-board-${today}.md`, download_url: 'https://example.com/sb.md' }]));
    fetchMock.get('https://example.com')
      .intercept({ path: '/sb.md', method: 'GET' })
      .reply(200, `---
slug: select-board-${today}
board: select-board
board_display: "Select Board"
date: ${today}
title: "Select Board"
vimeo_url: "https://vimeo.com/0"
summary_card:
  headline: "Test"
  summary: "Test"
topic_segments:
---
`);

    const out = await runScheduled({}, env, { skipTimeGuard: true });
    expect(out.sent).toBe(1);
    const after = await env.DB.prepare('SELECT drip_week_index FROM subscriber WHERE id = ?').bind(row.id).first();
    expect(after.drip_week_index).toBe(1);
  });

  it('subscriber at week 4 with no week 5 primer gets digest only and index stays', async () => {
    const row = await confirmedSubscriber('done@example.com', { boards: ['select-board'], topics: [] });
    await env.DB.prepare('UPDATE subscriber SET drip_week_index = 4 WHERE id = ?').bind(row.id).run();
    stubGithubPrimers(
      ['01-welcome.md', '02-org.md', '03-debt.md', '04-spending.md'],
      [
        ['01-welcome.md', [1, 'A']],
        ['02-org.md',     [2, 'B']],
        ['03-debt.md',    [3, 'C']],
        ['04-spending.md',[4, 'D']]
      ]
    );
    const today = new Date().toISOString().slice(0, 10);
    fetchMock.get('https://api.github.com')
      .intercept({ path: /\/repos\/.*\/contents\/_transcripts\?ref=.*/, method: 'GET' })
      .reply(200, JSON.stringify([{ type: 'file', name: `select-board-${today}.md`, download_url: 'https://example.com/sb.md' }]));
    fetchMock.get('https://example.com')
      .intercept({ path: '/sb.md', method: 'GET' })
      .reply(200, `---
slug: select-board-${today}
board: select-board
board_display: "Select Board"
date: ${today}
title: "Select Board"
vimeo_url: "https://vimeo.com/0"
summary_card:
  headline: "Test"
  summary: "Test"
topic_segments:
---
`);

    const out = await runScheduled({}, env, { skipTimeGuard: true });
    expect(out.sent).toBe(1);
    const after = await env.DB.prepare('SELECT drip_week_index FROM subscriber WHERE id = ?').bind(row.id).first();
    expect(after.drip_week_index).toBe(4);  // unchanged — no primer to send
  });

  it('does not bump drip_week_index when there are zero meeting matches', async () => {
    const row = await confirmedSubscriber('quiet@example.com', { boards: ['town-meeting'], topics: [] });
    stubGithubPrimers(['01-welcome.md'], [['01-welcome.md', [1, 'Welcome']]]);
    fetchMock.get('https://api.github.com')
      .intercept({ path: /\/repos\/.*\/contents\/_transcripts\?ref=.*/, method: 'GET' })
      .reply(200, '[]');
    const out = await runScheduled({}, env, { skipTimeGuard: true });
    expect(out.sent).toBe(0);
    const after = await env.DB.prepare('SELECT drip_week_index FROM subscriber WHERE id = ?').bind(row.id).first();
    expect(after.drip_week_index).toBe(0);
  });

  it('when _primers/ fetch fails, sends digest without primer and does not bump', async () => {
    const row = await confirmedSubscriber('p-fail@example.com', { boards: ['select-board'], topics: [] });
    stubGithubPrimersFail();
    const today = new Date().toISOString().slice(0, 10);
    fetchMock.get('https://api.github.com')
      .intercept({ path: /\/repos\/.*\/contents\/_transcripts\?ref=.*/, method: 'GET' })
      .reply(200, JSON.stringify([{ type: 'file', name: `select-board-${today}.md`, download_url: 'https://example.com/sb.md' }]));
    fetchMock.get('https://example.com')
      .intercept({ path: '/sb.md', method: 'GET' })
      .reply(200, `---
slug: select-board-${today}
board: select-board
board_display: "Select Board"
date: ${today}
title: "Select Board"
vimeo_url: "https://vimeo.com/0"
summary_card:
  headline: "Test"
  summary: "Test"
topic_segments:
---
`);

    const out = await runScheduled({}, env, { skipTimeGuard: true });
    expect(out.sent).toBe(1);
    const after = await env.DB.prepare('SELECT drip_week_index FROM subscriber WHERE id = ?').bind(row.id).first();
    expect(after.drip_week_index).toBe(0);
  });
});
