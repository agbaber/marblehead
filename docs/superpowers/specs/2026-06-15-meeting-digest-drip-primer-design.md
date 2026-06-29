# Design: weekly digest drip primer

**Status:** draft, awaiting review
**Date:** 2026-06-15
**Author:** Andrew Baber + Claude
**Builds on:**
- [2026-06-09-meeting-digest-subscriptions-design.md](2026-06-09-meeting-digest-subscriptions-design.md) — the v1 weekly digest the drip rides on.
- `meeting-digest/worker/` as deployed (PR #801, plus #855 idempotency and #863 UTM tagging).

## Goal

Layer a per-subscriber primer drip onto the existing Monday digest. Each new subscriber's first eligible digest carries primer card 1 ("what this site is"); each subsequent eligible digest carries the next primer until the available sequence is exhausted. The drip is extensible: shipping a new `_primers/NN-*.md` markdown PR adds a week without a Worker deploy.

## Non-goals

- No separate primer email. One email per subscriber per week, max.
- No re-enrollment loop. Once `drip_week_index >= max(week_index)`, no primer block until new primer files exist.
- No per-subscriber primer preferences (skip a week, pause drip). Drip is monotonic.
- No primer in confirmation email. The confirmation email keeps its current copy; the first primer rides on the first Monday digest after confirmation.
- No A/B testing of primer copy. The copy that lands on `_primers/NN-*.md` at cron time is what subscribers get.

## What landed before this design

- Confirmed-subscriber Monday digest with per-row `boards`/`topics` filtering (PR #801).
- Per-subscriber 5-day idempotency via `last_sent_at` (PR #855).
- UTM tagging on editorial links (`utm_source=digest&utm_medium=email&utm_campaign=weekly`, PR #863).
- `_transcripts/` Jekyll collection read at runtime by the Worker via GitHub Contents API (`fetchRecentTranscripts` in `worker/src/lib/transcripts.js`).
- Shared `emailShell` chrome with light/dark CSS classes (`.mhd-card`, `.mhd-body`, `.mhd-muted`, `.mhd-link`, `.mhd-hr`).

---

## Section 1: Data model and content source

### Schema change

One column on `subscriber`:

```sql
ALTER TABLE subscriber ADD COLUMN drip_week_index INTEGER NOT NULL DEFAULT 0;
```

Semantics: count of primer cards already delivered to this subscriber. `0` = none sent yet. Incremented atomically with the digest send when a primer card is included in the email.

Migration file: `meeting-digest/worker/schema/0002_drip_week_index.sql`. Idempotency comes from `DEFAULT 0` covering all existing rows — no data backfill required.

### `_primers/` Jekyll collection

New top-level collection. `_config.yml` entry:

```yaml
collections:
  primers:
    output: false
```

`output: false` keeps primer markdown out of the built site so the source files stay editorial-only (the email is the only rendering surface).

Each primer file: `_primers/NN-slug.md`. Example `_primers/01-welcome.md`:

```yaml
---
week_index: 1
title: "What this site is"
link_url: /about
link_label: "About marbleheaddata.org"
---
Plain-text body, 2 to 4 sentences. Renders as the primer card's dek
in the email. No HTML, no Liquid. The Worker reads the body, escapes
it for HTML output, and drops it into the card.
```

**Frontmatter fields (all required):**

| Field | Type | Purpose |
|---|---|---|
| `week_index` | int | Position in the drip. Worker matches `week_index === drip_week_index + 1`. |
| `title` | string | Primer card headline. |
| `link_url` | string | Path or full URL the CTA links to. UTM appended at render time. Plain pages take no trailing slash (a trailing slash 404s on the live site); the renderer drops one if present. |
| `link_label` | string | CTA link text, with `→` appended at render. |

Body: plain text, no markdown formatting. The Worker preserves paragraph breaks (`\n\n`) and escapes for HTML, then emits one `<p>` per paragraph.

**Adding a new week** = merge a markdown PR. No Worker deploy, no D1 migration. The next Monday cron fetches the new file, and any subscriber whose `drip_week_index + 1 === week_index` catches up.

---

## Section 2: Send-time logic

### `runScheduled` flow (changes in **bold**)

1. Existing time-guard and 5-day idempotency filter.
2. Fetch transcripts (existing `fetchRecentTranscripts`).
3. **Fetch `_primers/` directory once per cron via GitHub Contents API. Parse all files into a sorted-by-`week_index` array. Compute `maxPrimerIndex = max(week_index)`. Cache for the run.**
4. For each confirmed subscriber not sent in last 5 days:
   - Match transcripts to `boards`/`topics`. If zero matches → skip (no email; `drip_week_index` unchanged). This preserves the existing skip behavior.
   - **Select primer where `week_index === subscriber.drip_week_index + 1`. If none exists (subscriber has exhausted available primers), `primer = null`.**
   - Render HTML + text. **If `primer` non-null, append primer card to body (HTML and text variants).**
   - Send email via Resend.
   - On send success:
     - `UPDATE subscriber SET last_sent_at = ? WHERE id = ?` (existing).
     - **If a primer was included: `UPDATE subscriber SET drip_week_index = drip_week_index + 1 WHERE id = ?`.** Combine into a single statement when convenient.
   - Insert `delivery_log` row (existing).

### End-of-drip and catch-up

Once `drip_week_index === maxPrimerIndex`, primer block is omitted. Subscriber continues to get the meeting digest as before. When a new `_primers/NN-*.md` ships, the next eligible Monday cron sees `maxPrimerIndex` bump and that subscriber automatically catches up — no re-enrollment, no admin step.

### Existing subscribers at ship time

Migration's `DEFAULT 0` puts all currently confirmed subscribers (count: 2 per the Jun 12 baseline) at `drip_week_index = 0`. They receive primer 1 on the first eligible Monday after deploy. Rationale: primer 1 is "what this site is," which is useful context for any subscriber, not just brand-new ones.

### Edge cases

| Case | Behavior |
|---|---|
| `_primers/` GitHub fetch fails | Log error, send digest without primer card, do **not** bump `drip_week_index`. Subscriber retries next eligible Monday. |
| Primer markdown malformed (missing required frontmatter) | Log error, skip that primer (treat as if it doesn't exist for any week_index). Other primers still parse. Affected subscribers don't bump. |
| Two primers have the same `week_index` | Log error, use the alphabetically-first filename (`01-alt.md` beats `01-welcome.md`). Operator should rename one to resolve. |
| Send fails (Resend error) | Existing failure logging in `delivery_log`. No bump to `drip_week_index` since the send didn't succeed. |
| Subscriber unsubscribes mid-drip | `drip_week_index` frozen at current value. If they re-subscribe later, a new row is created with `drip_week_index = 0` (new row, same email is allowed by current schema since the unsubscribed row stays for audit). |
| Zero meeting matches that week | No email sent. `drip_week_index` unchanged. (Per Section 2 decision: drip rides on the digest; skip the week.) |

### Atomicity

`drip_week_index` is updated only after the Resend `sendMail` resolves successfully. A failed send leaves the index alone, so retries on a future Monday re-send the same primer. The chance of a Resend success followed by a D1 update failure is low; if it happens, the subscriber loses one primer (they see primer 1, then next week see primer 3). Acceptable for v1; no compensating logic.

---

## Section 3: Email render

### Position

Primer card sits **below** the meeting cards, above the existing card-bottom footer. Meeting content is the value the subscriber signed up for; primer is bonus context. The existing outer "marbleheaddata.org · Resident-built, primary-source data" footer line is unchanged.

### HTML structure

```html
[Hero bar — emailShell]
[1..N meeting cards — meetingHtml(), existing]
<hr class="mhd-hr" style="border: 0; border-top: 1px solid #e3e8ee; margin: 8px 0 24px;">
<div style="margin: 0 0 8px;">
  <p class="mhd-muted" style="margin: 0 0 6px; font-size: 13px; color: #6c757d;">
    Site primer · 1 of 4
  </p>
  <h2 style="margin: 0 0 10px; font-size: 19px; line-height: 1.3; color: #1a1a1a; font-weight: 600;">
    What this site is
  </h2>
  <p class="mhd-body" style="margin: 0 0 12px; color: #2a3036; line-height: 1.55;">
    {escaped body paragraph 1}
  </p>
  <p class="mhd-body" style="margin: 0 0 12px; color: #2a3036; line-height: 1.55;">
    {escaped body paragraph 2}
  </p>
  <p style="margin: 0; font-size: 14px;">
    <a class="mhd-link" href="{link_url with UTM}" style="color: #1B3A57; text-decoration: none; font-weight: 500;">
      {link_label} &rarr;
    </a>
  </p>
</div>
[Card-bottom footer — manage / unsub]
```

Reuses existing class names (`mhd-hr`, `mhd-muted`, `mhd-body`, `mhd-link`) so light/dark and Gmail/Outlook fallbacks come for free. No new CSS classes.

"`Site primer · N of M`" where `M` = `maxPrimerIndex` for the cron run. If a subscriber is on primer 4 of 4 today and a primer 5 ships next week, they see "5 of 5" next Monday — the total grows as the drip grows. Acceptable.

### Plain-text version

Inserted into `renderText` after the meeting blocks:

```
{meeting blocks in text}

---

SITE PRIMER · 1 of 4

What this site is

{body, paragraphs separated by blank lines}

{link_label}: {link_url with UTM}
```

### UTM tagging

Primer links use a per-week campaign so PostHog can measure clickthrough per primer:

```
?utm_source=digest&utm_medium=email&utm_campaign=primer-week-1
```

New helper `withPrimerUtm(url, weekIndex)` in `render.js`, parallel to the existing `withUtm(url)`. Existing meeting links keep `utm_campaign=weekly`.

### Subject line

Unchanged. Primer doesn't influence subject. Existing logic (single match → headline, multiple → count) wins.

---

## Section 4: Tests and rollout

### New tests

`tests/primer.test.js`:

- Parsing `_primers/NN-slug.md` markdown into `{ week_index, title, link_url, link_label, body }`.
- Sorting by `week_index`.
- Malformed frontmatter (missing `week_index`, missing `link_url`) is skipped with a log.
- Body text with `<` and `&` is HTML-escaped on render.
- Multiple paragraphs in body produce multiple `<p>` blocks.

`tests/render.test.js` (extend):

- Primer card present when `primer` arg non-null.
- Primer card absent when `primer` arg is null.
- Link contains `utm_campaign=primer-week-{N}`.
- "Site primer · N of M" reflects the passed `maxPrimerIndex`.
- Text version contains `--- ` separator and the link URL inline.

`tests/worker.test.js` (extend):

- New subscriber (`drip_week_index = 0`), matches present → digest + primer 1, post-send index = 1.
- Existing subscriber at week 3 → digest + primer 4.
- Subscriber at week 4 with no `_primers/05-*.md` → digest only, index stays at 4.
- Zero meeting matches → no email, no index change.
- `_primers/` fetch failure → digest only (no primer block), no index change, error logged.
- Malformed primer frontmatter for the subscriber's target week → digest only, no index change.
- Resend send failure → no index change.

### Existing tests to update

`worker.test.js` currently asserts the post-send `UPDATE` touches only `last_sent_at`. Update to assert the conditional `drip_week_index` bump path.

### Migration

`meeting-digest/worker/schema/0002_drip_week_index.sql`:

```sql
ALTER TABLE subscriber ADD COLUMN drip_week_index INTEGER NOT NULL DEFAULT 0;
```

Run before Worker deploy:

```
cd meeting-digest
npx wrangler --config worker/wrangler.toml d1 execute meeting-digest --remote --file=worker/schema/0002_drip_week_index.sql
```

Local miniflare D1 (`tests/`) uses the same `schema/` files; tests run against a fresh schema each invocation, so existing test setup picks up the new column automatically.

### Rollout sequence

1. PR opens with: schema migration, `_primers/` collection in `_config.yml`, `_primers/01-welcome.md`, Worker changes (`scheduled.js`, new `primer.js` lib, `render.js` extensions), tests, no feature flag.
2. Merge.
3. Apply D1 migration against the remote `meeting-digest` DB.
4. `npm run deploy` for the Worker.
5. Next Monday cron sends primer 1 to all eligible subscribers (currently 2 per Jun 12 baseline).
6. Subsequent weeks: ship `_primers/02-*.md`, `_primers/03-*.md`, `_primers/04-*.md` as separate content PRs as primer copy is written. Each one auto-extends the drip; subscribers catch up the next eligible Monday.

### No feature flag

Two confirmed subscribers (per Jun 12 baseline) and a deterministic SQL change. The cost of a flag (schema, plumbing, removal PR) exceeds the cost of a bad first-week send. If primer 1 is wrong, the fix is a content PR to `_primers/01-welcome.md`.

### v1 ship deliverable

- Schema migration.
- Worker changes (selection + render + UTM helper).
- `_primers/` collection registered in `_config.yml`.
- `_primers/01-welcome.md` with confirmed primer-1 copy.
- Tests.

Weeks 2–4 ship as separate content PRs after v1 lands, per the "TBD order, some work in flight" framing. Candidate topics from Andrew: org chart, debt, spending, action accountability ("acting").
