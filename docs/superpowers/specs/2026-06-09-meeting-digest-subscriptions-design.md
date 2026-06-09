# Design: meeting-digest email subscriptions

**Status:** draft, awaiting review
**Date:** 2026-06-09
**Author:** Andrew Baber + Claude
**Builds on:**
- [2026-06-02-meeting-questions-and-subscriptions.md](2026-06-02-meeting-questions-and-subscriptions.md) — the broader spec that combines subscriptions with question routing; this design carves out **subscriptions only** as a v1.
- The Vimeo backfill + LLM enrichment work shipped in PR #797 (transcripts + summary_card + topic_segments in `_transcripts/`).
- community-pulse Worker/D1/transactional-mail infrastructure already running on marbleheaddata.org.

## Goal

Ship a weekly opt-in email digest of board-meeting summaries, gated by per-subscriber board and topic filters. **The newspaper writes for everyone; this writes for you.**

## Non-goals (v1)

- No real-time / per-transcript notifications. Friday weekly only.
- No passkey or password auth. Token-in-link is the only credential.
- No verified-resident gating. Any email can subscribe.
- No question routing (that's a separate spec).
- No free-text "watch Bouvier Road" searches.
- No newsletter archive page, no analytics, no engagement nudges.

These omissions are deliberate. Each can be layered on later without rearchitecting v1.

## What landed before this design

- `_transcripts/<slug>.md` Jekyll collection — 231 transcripts as of merge of PR #797
- Each transcript has `summary_card.{headline, summary, decisions, votes}` and `topic_segments[].{topic, headline, dek, summary, start_seconds, end_seconds}`
- Topic taxonomy locked at 13 slugs in `scripts/transcripts/lib/topics.mjs`
- `transcripts_subscribe` feature flag in `_config.yml`, currently `false` — flip when v1 ships

---

## Section 1: Scope and surfaces

**New surfaces on marbleheaddata.org:**

- `/subscribe/` — public landing page with email field and one-paragraph pitch. Default subscription explained inline.
- `/subscribe/confirm/?token=...` — handles the click on the confirmation email; on success, redirects to the preferences page.
- `/me/subscription/?token=...` — long-lived preferences and unsubscribe surface. Token in every email footer.
- New `_layouts/email-digest.html` — used by the Worker to render the Friday email.
- Sticky-footer subscribe affordance on `/meetings/` and individual `_transcripts/*` pages.

**Reused infrastructure:**

- Cloudflare Workers for the API endpoints + the Friday cron.
- Cloudflare D1 for subscriber rows and delivery logs.
- The existing transactional-mail provider already wired into community-pulse (Resend if a new one is needed).
- Cloudflare Turnstile token on the signup form (matches `feedback.html` precedent).

No new infrastructure. No new accounts to provision.

---

## Section 2: Subscription data model and filter logic

### D1 schema (subscriber)

```sql
CREATE TABLE subscriber (
  id                   TEXT PRIMARY KEY,            -- uuid
  email                TEXT NOT NULL UNIQUE,        -- lowercased on insert
  status               TEXT NOT NULL,               -- pending_confirmation | confirmed | unsubscribed | bounced | complained
  confirmation_token   TEXT,                        -- one-time, 24h expiry; cleared after confirm
  confirmation_expires INTEGER,                     -- unix epoch
  manage_token         TEXT NOT NULL,               -- opaque, long-lived; in every email footer
  boards               TEXT NOT NULL,               -- JSON array of board slugs
  topics               TEXT NOT NULL,               -- JSON array of topic slugs
  cadence              TEXT NOT NULL DEFAULT 'weekly',  -- reserved for v1.1
  created_at           INTEGER NOT NULL,
  confirmed_at         INTEGER,
  unsubscribed_at      INTEGER,
  last_sent_at         INTEGER
);

CREATE TABLE delivery_log (
  id                   TEXT PRIMARY KEY,
  subscriber_id        TEXT NOT NULL,
  sent_at              INTEGER NOT NULL,
  n_meetings           INTEGER NOT NULL,
  provider_message_id  TEXT,                        -- from mail provider response
  status               TEXT NOT NULL,               -- queued | delivered | bounced | complained | failed
  FOREIGN KEY (subscriber_id) REFERENCES subscriber(id)
);

CREATE INDEX idx_subscriber_status ON subscriber(status);
CREATE INDEX idx_subscriber_manage_token ON subscriber(manage_token);
CREATE INDEX idx_subscriber_confirmation_token ON subscriber(confirmation_token);
```

### Default on signup

- `boards = ["select-board", "school-committee", "finance-committee"]`
- `topics = []` (empty topic filter is treated as "match by board only")

Rationale: BoH and Town Meeting have high volume and low signal for most readers; opt-in keeps the default mailing volume in the 3–6 emails/month range.

### Filter logic — OR across axes

A meeting matches a subscriber if **either**:

1. `meeting.board ∈ subscriber.boards`, OR
2. `meeting.topic_segments[].topic ∩ subscriber.topics ≠ ∅`

Examples:

| Subscription | Sample meeting | Matches? |
|---|---|---|
| `boards=[select-board]`, `topics=[]` | Select Board Jun 10 | Yes (board match) |
| `boards=[select-board]`, `topics=[]` | School Committee Jun 9 with `school-budget` segment | No |
| `boards=[]`, `topics=[override]` | Any meeting with an `override` segment | Yes |
| `boards=[select-board]`, `topics=[40b-mbta]` | Planning Board (future) with a `40b-mbta` segment | Yes (topic match) |

### Validation rules

- Saving with `boards=[] AND topics=[]` is rejected at the preferences API with a 400. The UI surfaces an inline message: "Pick at least one board or topic — or use Unsubscribe."
- Empty weekly digests are silent. If a confirmed subscriber has zero matching meetings on Friday morning, no email goes out and `last_sent_at` is not updated.
- Duplicate signup with the same email re-sends the confirmation; it does not reset preferences.

---

## Section 3: Email shape

### Subject line generation

Chosen at send time based on what landed in the matched set:

| Meetings matched | Subject |
|---|---|
| 1 | `[MHD Data] <board>: <headline>` |
| 2–3 | `[MHD Data] N meetings this week: <up to 3 headlines, " · " separated>` |
| 4+ | `[MHD Data] N meetings this week: <top 3 headlines>...` |

Each headline pulled from `summary_card.headline`.

### Body (HTML + plain-text fallback)

Single column, no images, no tracking pixels.

```
Marblehead Data — Friday digest
Week ending Fri Jun 12, 2026

You filtered by: Select Board, School Committee,
Finance Committee + topic: override

3 meetings matched this week.

──────────────────────────────────────────────
SELECT BOARD · June 10, 2026
Board approves $5.43M Mary Allen contract
──────────────
{{ summary_card.summary }}   (2–4 sentences)

Matching segments:
 • Override (12:34) — Board signals support for
   Tier 2 ahead of next week's MOU vote
 • Bonding & capital (38:11) — Mary Allen funding
   path approved

Read on marbleheaddata.org →
──────────────────────────────────────────────

SCHOOL COMMITTEE · June 9, 2026
...

──────────────────────────────────────────────
Manage your subscription · Unsubscribe (one click)

AI-generated summaries · may contain errors ·
verify with the source video.
```

### Template rules

- `summary_card.summary` rendered as-is. Already neutral per the LLM-summary prompt.
- "Matching segments" listed only if the subscriber has a non-empty `topics` filter AND the meeting has segments matching that filter. Board-only subscribers see the main summary card without a segment list.
- Each segment links to `https://marbleheaddata.org/meetings/<slug>/#t=<start_seconds>`.
- Footer carries the manage and unsubscribe token URLs.
- One inline "Watch on MHTV →" link per meeting alongside the "Read" link.
- No images, no analytics beacon, no tracking pixel. Plain text version mirrors the HTML 1:1.

### Sender identity

- From: `Marblehead Data <meetings@marbleheaddata.org>`
- Reply-To: `agbaber@gmail.com` (Andrew's inbox; can change later if mail volume justifies a help mailbox)
- DKIM and SPF configured on the `meetings.` subdomain so it's isolated from any other mail (community-pulse, feedback bounces) and doesn't share reputation.

---

## Section 4: Signup flow

```
[/subscribe/]
  ┌─────────────────────────────────────────┐
  │  Friday morning: what's happening at    │
  │  Marblehead's board meetings.           │
  │                                         │
  │  You pick the boards and topics. We     │
  │  send you a digest of just those, with  │
  │  deep-links into the source video.      │
  │  Unsubscribe with one click.            │
  │                                         │
  │  [ email field         ]  [ Subscribe ] │
  │                                         │
  │  Default: Select Board, School          │
  │  Committee, Finance Committee.          │
  │  Customize after you confirm.           │
  └─────────────────────────────────────────┘
            │
            ▼
  POST /api/subscribe { email, turnstile_token }
            │
            ▼
  Worker:
    - validate Turnstile
    - normalize email (lowercase, trim)
    - lookup by email
      - existing confirmed → return 200 with neutral "Check your inbox"
        (no info leak); send a "manage your subscription" email
      - existing pending → resend confirmation email
      - none → INSERT subscriber row with defaults, status=pending_confirmation
    - send confirmation email
            │
            ▼
  ┌────────────────────────────────────────┐
  │ You asked to subscribe to Marblehead   │
  │ Data's meeting digest. Click to        │
  │ confirm:                               │
  │   [ Confirm subscription ]             │
  │ This link expires in 24 hours. If this │
  │ wasn't you, ignore this email — no     │
  │ account was created.                   │
  └────────────────────────────────────────┘
            │
            ▼
  GET /subscribe/confirm/?token=<confirmation_token>
            │
            ▼
  Worker:
    - lookup by confirmation_token
    - check confirmation_expires > now
    - set status=confirmed, confirmed_at=now, clear confirmation_token
    - redirect to /me/subscription/?token=<manage_token>&first=1
            │
            ▼
  Preferences page in welcome state ("You're subscribed.")
```

### Anti-abuse rules

- Turnstile token required on `POST /api/subscribe`.
- Rate limit at the Worker: 5 confirmations per IP per hour, 1 per email per minute. KV-backed.
- Pending rows older than 24h pruned by a daily worker (separate cron).
- Duplicate subscribe never leaks subscription state ("Check your inbox" regardless of whether the email was new, pending, or already confirmed).

---

## Section 5: Preferences page (`/me/subscription/?token=...`)

Token-in-link is the only credential. No login, no password.

```
┌──────────────────────────────────────────────────┐
│  Your subscription                               │
│  hi@example.com · subscribed since Jun 8 2026    │
│                                                  │
│  ── Boards ──────────────────────────────────    │
│  [✓] Select Board       (24 meetings/year)       │
│  [✓] School Committee   (~22 meetings/year)      │
│  [✓] Finance Committee  (~16 meetings/year)      │
│  [ ] Board of Health    (~30 meetings/year)      │
│  [ ] Town Meeting       (2–3 meetings/year)      │
│                                                  │
│  ── Topics (optional) ───────────────────────    │
│  Tick a topic to also get any meeting that       │
│  discussed it — even from boards you didn't      │
│  check above.                                    │
│                                                  │
│  [ ] Override / Prop 2½                          │
│  [ ] School budget                               │
│  [ ] Bonding & capital                           │
│  [ ] Permits & zoning                            │
│  [ ] Trash / DPW                                 │
│  [ ] Health insurance / GIC                      │
│  [ ] Labor & personnel                           │
│  [ ] Public safety                               │
│  [ ] 40B / MBTA Communities                      │
│  [ ] Elections / procedural                      │
│  [ ] Recreation & events                         │
│                                                  │
│  (admin-housekeeping and public-comment are      │
│  on almost every meeting; we don't offer them    │
│  as filters — but you'll see them inside any     │
│  meeting we send you.)                           │
│                                                  │
│  [ Save preferences ]   [ Unsubscribe ]          │
└──────────────────────────────────────────────────┘
```

### Behavior

- Token in URL throughout — no login. If a token leaks, the subscriber can click Unsubscribe and re-subscribe to mint a fresh one.
- Saving issues `POST /api/preferences/update { token, boards[], topics[] }`. Worker validates token, updates row, redirects back with `?saved=1` flash.
- Unsubscribe is **one click** → `POST /api/unsubscribe { token }` → `status=unsubscribed`. No confirmation dialog (industry expectation; one-click is the standard).
- The same page is accessible from any email footer.
- Topic list excludes `admin-housekeeping` and `public-comment` (same reasoning as the meeting-card chip filter — they'd match almost everything).
- Empty preferences (zero boards AND zero topics) rejected with inline error.

---

## Section 6: Delivery pipeline

```
Cron: Friday 7:00 AM ET → Cloudflare Worker `digest-sender`
  │
  ├─ Pull last 7 days of _transcripts/*.md via GitHub Contents API
  │  cached in Worker memory for the run.
  │  ~50 KB of data total per week; one read, all subscribers share.
  │
  ├─ Parse each transcript into:
  │  { slug, date, board, board_display, title, vimeo_url,
  │    summary_card: { headline, summary }, topic_segments: [...] }
  │
  └─ For each row in subscriber WHERE status='confirmed':
       matches = transcripts.filter(t =>
         subscriber.boards.includes(t.board) ||
         t.topic_segments.some(s => subscriber.topics.includes(s.topic))
       )
       if matches.length === 0:
         skip; no email; do not update last_sent_at
       else:
         html = render(email-digest.html, { matches, subscriber })
         text = render(email-digest.txt, { matches, subscriber })
         subject = pickSubject(matches)
         response = await mailProvider.send({ to, from, subject, html, text,
                                              headers: {'List-Unsubscribe': ...} })
         update subscriber.last_sent_at = now()
         INSERT delivery_log row
```

### Mail provider

- **Default: Resend.** Cheap, good DKIM/SPF docs, supports `List-Unsubscribe` headers (one-click unsubscribe at the email client level), webhook for bounces/complaints. Free tier 3K/mo covers v1 by 10×.
- If community-pulse already uses something different (Postmark, Mailgun), reuse that to avoid two providers.

### Bounce and complaint handling (minimum viable)

- Provider webhook → POST `/api/mail-event { provider_message_id, event_type, ... }`
- Hard bounce → `subscriber.status='bounced'`. No more sends. Delivery log updated.
- Spam complaint → `subscriber.status='complained'`. No more sends. Critical for reputation.
- Soft bounce → no special handling; provider retries on its own.

### Operational cost

At expected scale (~200 subscribers):

- Cloudflare Workers: free
- Cloudflare D1: free
- Resend: free (3K/mo tier)
- Total: $0/mo for v1. ~$1–5/mo if it grows to low thousands.

---

## Section 7: Out of scope / future iteration

Listed for completeness. None blocks v1.

- **Real-time / instant-publish notifications** — v1.1. Architecture: same Worker, triggered by GitHub webhook on `_transcripts/` push, instead of (or in addition to) the Friday cron.
- **Verified-resident gating via passkey network** — the original spec's prereq. v1 lets any email subscribe. If non-resident spam becomes a problem we add the gate later; a `subscriber.verified_resident_id` nullable column will hook in cleanly.
- **Question routing** — separate spec.
- **Per-meeting subscription** ("notify me if this transcript changes") — edge case; not building.
- **Full-text search subscriptions** ("watch Bouvier Road") — would need a saved-search data model; topic taxonomy already covers the high-value cases.
- **Newsletter archive page** at `/digest-archive/` — nice-to-have. The transcripts themselves are the archive.
- **Engagement analytics** — anti-pattern for civic info.
- **Multiple emails per household** — one email = one row.
- **Mobile push notifications** — never.

---

## Open questions for the human reviewer

1. **Mail provider** — confirm we want Resend on a new `meetings.marbleheaddata.org` subdomain. If community-pulse already uses Postmark or Mailgun, we should reuse it instead.
2. **Sender mailbox identity** — `meetings@marbleheaddata.org` (this design) or `digest@marbleheaddata.org` or something else? Has UX implications for the "from" label users see.
3. **Default subscription tweaking** — confirmed the SB / SC / FinCom default. If you'd rather start everyone empty and force a board pick at confirmation, that's a one-line change.
4. **`/subscribe/` form copy** — placeholder in this design ("Friday morning: what's happening..."). Real copy needs Andrew's voice; can be iterated post-launch.
5. **Confirmation email branding and content** — same.

## Success criteria

- ≥1 subscriber on the system within 7 days of launch.
- Friday digest sent on schedule for 4 consecutive Fridays without manual intervention.
- Less than 1% bounce + complaint rate.
- One resident has cited a digest link in a public-comment thread or social post (qualitative).

---

## Implementation handoff

Next step is the `superpowers:writing-plans` skill on this spec to break it into ordered tasks with file paths.

Pipeline scaffolding to expect:

- `functions/api/subscribe.js` (Worker handler for POST /api/subscribe)
- `functions/api/subscribe-confirm.js` (token redemption)
- `functions/api/preferences-update.js`
- `functions/api/unsubscribe.js`
- `functions/api/mail-event.js` (webhook from mail provider)
- `functions/cron/friday-digest.js` (the Friday 7 AM Worker)
- `_layouts/email-digest.html` + `email-digest.txt`
- `subscribe.html`, `subscribe/confirm.html`, `me/subscription.html` (static pages with light JS that hit the Worker endpoints)
- D1 migrations: `migrations/0001_subscriber.sql`
- Updates to `_config.yml` (flip `transcripts_subscribe` feature flag when ready) and `_includes/nav.html` (small "Subscribe" link)
