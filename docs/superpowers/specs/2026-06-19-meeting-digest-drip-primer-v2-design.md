# Design: digest drip primer v2 (weeks 2-6 + permanent footer + admin stats)

**Status:** draft, awaiting review
**Date:** 2026-06-19
**Author:** Andrew Baber + Claude
**Builds on:**
- [2026-06-15-meeting-digest-drip-primer-design.md](2026-06-15-meeting-digest-drip-primer-design.md) — the drip infrastructure shipped in PR #870 and currently live.
- The existing meeting-digest Worker at `meeting-digest/worker/`.

## Goal

Extend the drip primer from 1 week (welcome only) to 6 weeks (welcome + 4 topics + closer) by shipping 5 new `_primers/NN-*.md` files. Add two pieces of permanent email chrome: a reply-prompt in the footer of every digest, and an admin-only subscriber-stats block appended for one specific email address.

## Non-goals

- No new drip weeks beyond 6. The drip is extensible by design (just add `_primers/07-*.md` later), but this spec stops at 6.
- No change to subscriber preferences UI (`/me/subscription/`). Reply prompt and admin stats are render-side only.
- No PostHog dashboard for subscriber growth. Admin stats block reads D1 directly and inlines into your digest.
- No "subscribe yourself" automation. Andrew must subscribe via the existing public form for the admin block to ever render.
- No change to send cadence, subject line, or the meeting-card render.

## What landed before this design

- D1 `subscriber.drip_week_index` column (PR #870).
- `_primers/01-welcome.md` shipped and being sent to existing confirmed subscribers each Monday.
- `fetchPrimers`, `pickPrimer`, `parsePrimer` in `meeting-digest/worker/src/lib/primer.js`.
- `primerHtml`, `primerText`, `withPrimerUtm` in `meeting-digest/worker/src/lib/render.js`.
- `scheduled.js` already calls these helpers and bumps `drip_week_index` on successful send.
- 87/87 vitest tests passing as the baseline.

---

## Section 1: Primer sequence and copy

The drip becomes 6 weeks total. Each new primer file follows the existing `_primers/NN-slug.md` format: frontmatter with `week_index`, `title`, `link_url`, `link_label`, then a body of plain-text paragraphs.

### Week 1: trim the welcome primer

Edit `_primers/01-welcome.md`. The current body ends with a reply-to-correct line that becomes redundant once the permanent footer carries the same prompt. New body:

```
You just subscribed to a Monday email of summaries from Marblehead board meetings.

Every number on the site traces back to a primary source. Charts, tools, and explainers cover the override, the budget, debt, staffing, and trash.
```

Frontmatter unchanged: `week_index: 1`, `title: "What this site is"`, `link_url: /`, `link_label: "Browse marbleheaddata.org"`.

### Week 2: `_primers/02-org-chart.md`

```yaml
---
week_index: 2
title: "Who runs the town"
link_url: /org-chart/
link_label: "See the org chart"
---
Marblehead is actually two parallel administrations, each with its own elected board, each answerable to the town's registered voters. State law keeps them legally separate even though they pull from one tax base.

The chart lays out every department by FTE count, head title, and FY27 salary appropriation, plus the elected boards above them. Worth a look so the boards and departments that show up in meeting digests aren't abstractions.
```

### Week 3: `_primers/03-debt.md`

```yaml
---
week_index: 3
title: "What the town owes"
link_url: /town-debt/
link_label: "Open the debt page"
---
The town owes about $116 million. Voters approved every dollar of it, project by project, in 51 separate ballot questions since 1988. Voters said yes to 50 of those and no to one.

The debt page breaks out what each project costs, what the town pays each year, how Marblehead compares to similar towns, and how the debt relates to the operating override.
```

### Week 4: `_primers/04-spending.md`

```yaml
---
week_index: 4
title: "Where the money actually goes"
link_url: /checkbook/
link_label: "Open the checkbook"
---
The checkbook is a daily-refreshed dashboard of FY26 spending: budget vs. actual across every fund, department, category, division, and object code. Right now: $101M in vendor checks against a $206M budget.

Filter by vendor to see who got paid, or by department to see which budgets are running hot. Sourced directly from the town's open finance portals.
```

### Week 5: `_primers/05-action.md`

```yaml
---
week_index: 5
title: "What you can actually do"
link_url: /what-can-we-do/
link_label: "Open the working list"
---
The "what can we do" page is a working list of revenue ideas, spending ideas, and questions about how the town could make decisions differently. Some are widely shared, some contested, none of them free.

Most don't require a Town Meeting vote, which means they're things a board or staff could try without waiting for the next override cycle. The page is meant to be argued with. Reply with anything you'd add.
```

Note: `/what-you-can-do/` redirects to `/what-can-we-do.html`, so the primer points directly at the canonical URL.

### Week 6: `_primers/06-verify.md`

```yaml
---
week_index: 6
title: "Become a verified neighbor"
link_url: /verify-me/
link_label: "Verify yourself"
---
Some site features open up once neighbors verify they actually live in Marblehead: weighing in on open questions, vouching for renters, and reading community pulse as signal instead of noise.

Sign in with Facebook, and the site matches your name against the FY25 town assessor record. If your name is on the deed, you're verified on the spot. Otherwise, the site routes you to a neighbor who can vouch.
```

### File-naming policy

Files use two-digit zero-padded prefixes (`01-`, `02-`, …`06-`) for stable alphabetical sort. The Worker reads `week_index` from frontmatter; filename prefix is purely a convention for humans browsing the directory.

---

## Section 2: Permanent reply-prompt in digest footer

Every digest grows one new line above the existing manage/unsubscribe block. Same line in HTML and plain text.

### Plain text

Current (in `renderText`):

```
…meeting blocks…
{primer block if any}
---
Manage subscription: {url}
Unsubscribe: {url}

Summaries are AI-generated. Verify with the source video.
```

Becomes:

```
…meeting blocks…
{primer block if any}
---
Got a question or correction? Just reply to this email.

Manage subscription: {url}
Unsubscribe: {url}

Summaries are AI-generated. Verify with the source video.
```

### HTML

Current `renderHtml` chrome wraps everything in the existing `emailShell`. The new reply prompt sits inside the card-bottom footer block as a one-line `<p>`. Same `.mhd-muted` class as existing manage/unsubscribe lines so it inherits the existing dark-mode and Outlook fallback styling.

```html
<p class="mhd-muted" style="margin: 0 0 8px; font-size: 13px; color: #6c757d;">Got a question or correction? Just reply to this email.</p>
<p class="mhd-muted" style="margin: 0 0 6px; font-size: 13px; color: #6c757d;">Manage subscription: <a class="mhd-link" href="{manageUrl}">…</a></p>
…
```

### Where this line is appended

The `renderHtml` and `renderText` functions are the only places that emit the digest footer. The change is two single-line additions, one per renderer. No new helper needed.

### Why permanent vs. one-shot

A reply-prompt is infrastructure — always true, always useful, no campaign attached, doesn't expire. The `MAIL_REPLY_TO` env var is already wired to Andrew's address. Subscribers reading any week's digest can act on it. Conversion CTAs (verify yourself, browse a tool) belong in primer slots; communication channels belong in chrome.

---

## Section 3: Admin subscriber-stats block

When the per-subscriber loop in `scheduled.js` is rendering for the admin's address (matched against a new `ADMIN_EMAIL` env var), append a stats block under the existing primer card and before the footer. For every other subscriber, the block is omitted entirely.

### Block contents

HTML and plain-text versions of the same data. Example for week of 2026-06-22:

```
Admin · subscriber snapshot (week of Jun 22)
Confirmed: 2 (+0)
Pending: 4 (+1)
Unsubscribed: 0 (+0)
Bounced: 0
```

Format rules:
- "(week of {MMM D})" derived from the cron's scheduled time, formatted in Eastern Time. Same week label the digest already computes.
- Delta count `(+N)` shown next to Confirmed, Pending, and Unsubscribed.
- Bounced is count-only because the `subscriber` table has no `bounced_at` column.
- Confirmed / Pending / Unsubscribed / Bounced lines render unconditionally, even at zero count, so a previously-nonzero value falling to zero is visible.
- Complained is special-cased: render the line only when the count is > 0. Routine cron runs see no Complained line and don't lose signal.

### D1 query

One query per Monday cron, run once before the per-subscriber loop and cached:

```sql
SELECT
  status,
  COUNT(*) AS n,
  SUM(CASE
    WHEN status = 'confirmed'             AND confirmed_at   > ? THEN 1
    WHEN status = 'pending_confirmation'  AND created_at      > ? THEN 1
    WHEN status = 'unsubscribed'          AND unsubscribed_at > ? THEN 1
    ELSE 0
  END) AS n_new_this_week
FROM subscriber
GROUP BY status;
```

The `?` placeholder is bound three times with the same value: `weekAgoMs = nowMs - 7 * 24 * 60 * 60 * 1000`. SQLite supports positional parameters, so this is one parameter slot reused three times in the query string.

### Status-key normalization

The D1 `status` column stores `'pending_confirmation'`, not `'pending'`. The renderer maps:
- `confirmed` → "Confirmed"
- `pending_confirmation` → "Pending"
- `unsubscribed` → "Unsubscribed"
- `bounced` → "Bounced"
- `complained` → "Complained" (rare; only render if count > 0)

### Identification: `ADMIN_EMAIL` env var

Add to `[vars]` in `meeting-digest/worker/wrangler.toml`:

```toml
ADMIN_EMAIL = "agbaber@gmail.com"
```

(Same env-var pattern as `MAIL_FROM`, `MAIL_REPLY_TO`, `SITE_BASE_URL` — see existing wrangler.toml.) The Worker checks `s.email === env.ADMIN_EMAIL` inside the per-subscriber loop. No new D1 column, no new authentication concept, no leaking of the admin email in code.

### Subscribe-yourself prerequisite

For the admin stats block to ever render, Andrew must be a confirmed subscriber. He subscribes via the existing public form (`/subscribe/`) and confirms via the email handshake — same flow as any other subscriber. If he's not subscribed, the loop never picks his row, the stats block never renders, and the feature is dormant.

If he subscribes after this PR ships but before his row enters `confirmed` status, the next eligible Monday's digest will be his first stats-bearing email.

### Why not a separate admin-only email?

A second cron-triggered email would double the surface area: new template, separate render path, separate send. The current approach piggybacks on the digest the admin is already getting, with one conditional `if (s.email === env.ADMIN_EMAIL)` and ~10 lines of new render logic. If the volume grows past a digest-footer-sized block, refactor later.

---

## Section 4: Implementation surface

Files to change:

| Path | Change |
|---|---|
| `_primers/01-welcome.md` | Body trim to 2 paragraphs (drop reply line) |
| `_primers/02-org-chart.md` | New |
| `_primers/03-debt.md` | New |
| `_primers/04-spending.md` | New |
| `_primers/05-action.md` | New |
| `_primers/06-verify.md` | New |
| `meeting-digest/worker/wrangler.toml` | Add `ADMIN_EMAIL` var to `[vars]` and `[env.staging.vars]` |
| `meeting-digest/worker/src/lib/render.js` | Add reply-prompt to renderer footers; add `adminStatsHtml` / `adminStatsText` helpers |
| `meeting-digest/worker/src/lib/admin-stats.js` | New module: `fetchSubscriberStats(env, nowMs)` |
| `meeting-digest/worker/src/scheduled.js` | Call `fetchSubscriberStats` once per cron; pass result + admin email to renderers |
| `meeting-digest/tests/render.test.js` | Tests for reply-prompt line in both render outputs; tests for admin stats render |
| `meeting-digest/tests/admin-stats.test.js` | New: unit tests for stats query result shaping |
| `meeting-digest/tests/worker.test.js` | Integration test: admin's email triggers stats query + block render |

### Module boundary

`admin-stats.js` owns the D1 query and the result-shaping logic. `render.js` owns the HTML and plain-text formatting. `scheduled.js` orchestrates: ask `admin-stats.js` for the data once, pass it to the renderers as an optional argument alongside `primer` and `maxPrimerIndex`.

### Renderer signature changes

```javascript
renderHtml(matches, subscriber, env, weekEndingIso, primer, maxPrimerIndex, adminStats)
renderText(matches, subscriber, env, weekEndingIso, primer, maxPrimerIndex, adminStats)
```

`adminStats` defaults to `null`. When null, no stats block renders. When present, render the block. The decision to pass `adminStats` lives in `scheduled.js`: pass `stats` if `s.email === env.ADMIN_EMAIL`, else pass `null`.

### Why a single fetch per cron, not per-subscriber

`fetchSubscriberStats` runs one D1 aggregate query. The result is the same for every subscriber that cron sees — the stats are a snapshot in time, not per-recipient. So `scheduled.js` calls it once before the per-subscriber loop, caches the result, and passes it to the renderer only when the recipient is the admin.

In the (current) common case where the admin isn't subscribed yet, the cached stats are unused. The cost is one extra D1 query per Monday cron, ~5ms.

---

## Section 5: Tests and rollout

### New tests

`tests/admin-stats.test.js`:

- `fetchSubscriberStats` against an empty subscriber table returns all zeros, including deltas.
- With one confirmed (created 10 days ago, confirmed 5 days ago), one pending (created 2 days ago), one unsubscribed (created 30 days ago, unsubscribed 1 day ago):
  - Confirmed n=1 n_new=1 (confirmed_at within 7-day window)
  - Pending n=1 n_new=1
  - Unsubscribed n=1 n_new=1
- With confirmed but `confirmed_at` older than 7 days: n=1 n_new=0.
- Status not seen in the table is absent from results (renderer must handle missing keys as zero).

`tests/render.test.js` (extend):

- Both `renderHtml` and `renderText` include the reply-prompt line in their output, regardless of primer.
- When `adminStats` is null, no stats block renders.
- When `adminStats` is the stats object, both render outputs contain the formatted block:
  - "Admin · subscriber snapshot (week of …)"
  - "Confirmed: N (+M)"
  - "Pending: N (+M)"
  - "Unsubscribed: N (+M)"
  - "Bounced: N" (no delta)
- HTML stats block uses `.mhd-muted` / `.mhd-body` classes — no new CSS classes needed.

`tests/worker.test.js` (extend):

- When `env.ADMIN_EMAIL` matches one subscriber's email and that subscriber receives a digest, the rendered html contains "Admin · subscriber snapshot".
- When no subscriber matches `env.ADMIN_EMAIL`, no rendered output contains "Admin · subscriber snapshot".
- The stats query fires exactly once per cron, not per subscriber.

`tests/worker.test.js` (modify existing): the existing render assertion for the digest's plain-text footer needs to include the new reply-prompt line.

### Migration

None. No schema changes. The new `ADMIN_EMAIL` env var is wrangler config only — picked up at deploy time, no D1 touch.

### Rollout sequence after merge

1. `npm run deploy` for the Worker.
2. Subscribe via the public form to seed the admin row (if not already a subscriber).
3. Confirm the email handshake.
4. Next Monday cron: Andrew's confirmed row triggers the admin stats block; meanwhile every subscriber's `drip_week_index` advances through whatever primer week they're due for.

If Andrew is already a confirmed subscriber at deploy time, step 2 and 3 are no-ops.

### No feature flag

Same reasoning as the original drip-primer PR: 2 confirmed subscribers, deterministic content, easy to revert. Cost of a flag exceeds cost of a bad week.

### Backward compatibility

The renderer's new `adminStats` arg defaults to null, so any existing call site that doesn't pass it continues to work. Existing `worker.test.js` tests that render digests without admin context need only one assertion change (the new reply-prompt line in the rendered footer).

---

## Open implementation questions deferred to plan

- Exact week-of label format: "Jun 22" or "June 22, 2026"? Plan picks one and matches the existing digest's week header.
- Whether `adminStatsHtml` should sit inside the existing card's `<table>` chrome or after it. Plan should mock the rendered output once and pick the placement that looks least intrusive.
- Whether `fetchSubscriberStats` returns a fully-shaped renderable object or a raw row array. Plan should pick whichever keeps `render.js` simplest.

These are tactical, not architectural. The plan resolves them; the spec doesn't.
