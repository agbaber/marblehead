# Community Pulse: Design

**Date:** 2026-04-10
**Scope:** A section-level private reading tool with a lightweight directionless engagement counter and a share mechanism, layered across every page of the Marblehead Budget Data site.
**Status:** Draft for user review.

## Problem

The site today presents data and analysis well but offers no way for residents to engage with it as readers. There is no mechanism to mark sections that are persuasive, alert on claims that seem striking or wrong, attach private notes while reading, or see that other residents are looking at the same material. Every visitor reads in isolation, and the site has no way of knowing which sections matter to people.

A comment thread or a public for-and-against tally would undermine the site's neutrality positioning and attract brigading from both sides of the override debate. A full civic polling layer with verified residents and postcards is a multi-month build that bets on engagement before there is evidence engagement will happen.

This design threads the gap at the simplest possible level. It gives every reader a private reading tool and surfaces one public number per section, "reactions," that is designed to be alive and warm without being weaponizable. It does not try to build civic polling in v1. The civic polling path is documented as a deferred future phase so the work done here is compatible with that larger ambition if and when it becomes warranted.

## Goals

- Let any reader mark sections as agree, disagree, or alert (something here), and attach private notes, as a reading aid.
- Show a per-section engagement signal that feels alive without taking sides or being weaponizable.
- Let a reader forward any section to a friend via the device's native share mechanism, with rich link previews wherever the URL is pasted.
- Stay entirely anonymous and privacy-preserving: the server never learns any resident's identity, stance, or note content.
- Ship quickly, in a few days of engineering, with low ongoing operational burden.
- Preserve the site's existing neutrality positioning: no comments, no partisan UI framing, no displayed numbers that can lie about which way residents lean.
- Leave a clean path for a future verified-residency tally (postcards, vouching, challenges) without locking it in now.

## Non-goals

- Public comments, discussion threads, replies, or any reply-capable interaction surface.
- A public for-against tally of any kind in v1.
- Postcard verification, vouching, challenges, or any civic polling machinery in v1. These are deferred to a future phase explicitly.
- Real-name identity, user profiles, or accounts.
- Cross-device sync of private notes or stances. Clearing browser data loses the local state.
- A production mobile app. All flows must work in a mobile browser without installation.
- Cryptographic protocols beyond what is trivially reviewable (no blind signatures, no zero-knowledge proofs, no on-chain anything).
- Any feature that puts the site owner in a moderation or editorial role for user-authored content.

## Product overview

The reader experience in five bullets:

1. Same site the reader sees today. Pages of charts and analysis, visually unchanged.
2. Next to every heading, three small buttons: agree (👍), disagree (👎), alert (!). The alert button is a reader-reaction gesture meaning "something striking here" or "wait, this caught my eye," not a moderation flag. Plus a small notes field the reader can type into.
3. Clicks and notes are saved locally in the reader's browser. Nobody else sees them. This is a reading tool, not a poll.
4. On each section, the reader sees one public number: "47 reactions." It is a directionless engagement count, incremented when anyone clicks any stance button on that section. It feels alive but takes no side.
5. Every section has a share icon. Clicking it forwards the section link to a friend via the device's native share sheet on mobile, or copies the link to the clipboard on desktop. Links render with rich previews wherever they are pasted.

That's the whole product.

## Design

### 1. Section granularity

A section is the unit a reader can mark, note, share, and see a reaction count for.

Sections are created by two mechanisms on every page:

**Automatic: one section per `<h2>` heading.** At page load (via the widget's client-side JavaScript), every `<h2>` element on every content page is assigned an anchor ID derived from its heading text and hydrated with a stance widget. `<h3>` and deeper headings are NOT auto-instrumented, because content pages use h3 for sub-points within an argument, and per-h3 instrumentation produces interrogation-level widget density (over 20 widgets on the longest page). Runtime anchor generation was chosen over a Jekyll plugin because the site is deployed through GitHub Pages' default build, which runs in safe mode and does not execute custom plugins; adding a CI pipeline just for this feature would have been disproportionate. Shared links remain stable as long as heading text is stable, which is the same constraint any auto-anchor scheme carries.

**Index page excluded.** `index.html` is not auto-instrumented. Its `<h2>` elements are the question/link cards that navigate to other pages, not content sections worth stance capture.

**Expected automatic widget count at current content volume:**

- `index.html`: 0 (excluded)
- `senior-tax-relief.html`: 5
- `what-fails.html`: 4
- `what-is-the-override.html`: 5
- `why-not-elsewhere.html`: 5
- Site total: ~19 widgets from automatic instrumentation.

**Explicit: author-marked blocks.** Any element can opt into being a section by adding the attribute `data-stance-section="unique-slug"`. Used for mid-paragraph claims where there is no heading, for `<h3>` sub-points worth individual capture, or where the heading is the wrong granularity. Expected author effort: curate 2 to 5 of these per content page as needed. Total explicit count site-wide: probably 10 to 15 widgets, bringing the grand total to roughly 25 to 35 widgets site-wide.

Both mechanisms produce the same runtime behavior. Section IDs are canonical strings of the form `<page-path>#<anchor-slug>`, for example `what-fails.html#staffing-cuts`. This is the key used for reactions, local stance storage, and share URLs.

### 2. Section widget

The widget is a small inline component rendered next to (or below) the section's anchor element. It contains:

- Three stance buttons: agree (👍), disagree (👎), alert (!). Large enough to tap on mobile. The alert button's visible tooltip and aria-label read "Alert: something here caught my eye."
- A reaction count: "47 reactions" (optionally with a 24-hour delta: "47 reactions, 12 today").
- A share icon that invokes the OS share sheet on mobile or copies the permalink on desktop.
- A collapsible notes field, initially collapsed, that expands inline when the reader taps it.

When a reader clicks a stance button, three things happen:

1. The button state updates locally (the clicked button becomes the "active" one for this section).
2. The stance and any current note text are written to IndexedDB under the section ID.
3. A single lightweight request is fired to `POST /api/reactions` with only the section ID. The server increments the count; the widget updates optimistically.

There is no network traffic related to stance content. The server never learns which direction the reader clicked.

### 3. Private stances and notes

**Storage.** All stance and note data lives in the browser's IndexedDB, in a single object store keyed by section ID.

**Schema (client-side):**

```javascript
// IndexedDB object store: "stances"
// Key: section_id (e.g., "what-fails.html#staffing-cuts")
// Value:
{
  section_id: "what-fails.html#staffing-cuts",
  stance: "agree" | "disagree" | "alert" | null,
  note: "string, up to a few kilobytes",
  updated_at: <unix_ms>
}
```

**Properties.**

- Writes happen on every stance change and on debounced note field changes (e.g., one save per second of idle).
- No data ever leaves the browser. No keypair, no sync, no server copy, no export API.
- Clearing browser data loses everything. This is documented in the settings area so the reader is not surprised.
- The only outbound traffic caused by stance activity is the directionless reaction increment, which carries no stance or note content.

**Privacy disclosure.** Every widget includes a small link (next to the share icon) labeled "Privacy" that points to `/privacy.html`, a standalone page explaining the local-only storage model in plain language: what is stored, where it lives, what leaves the browser (nothing but the directionless reactions increment), what clearing browser data does (loses everything, because there is no server backup), and how to export a local copy if desired. The privacy page is the canonical disclosure for this feature and is linked from the widget, the site footer, and any other place a reader might reasonably look for it.

**Settings area is deferred to v1.1.** A follow-up page at `/pulse.html` will give the reader a view of all sections they have marked, with the ability to clear individual marks, clear all marks, or export the entire local state as a JSON file for their own records. Not in v1 to keep the initial surface small. Local state is still accessible via browser devtools in the meantime for anyone who needs it.

### 4. Reactions counter

Each section has one integer: its total reaction count. Optionally, the endpoint also returns a "reactions in the last 24 hours" delta for a sense of liveness.

**Increment flow.**

1. Reader clicks any stance button on any section.
2. Client fires `POST /api/reactions` with `{ section_id }`. No identity, no direction, no keypair, no signature, no user-agent beyond what the browser sends automatically.
3. Server applies a per-IP rate limit of 5 increments per section per hour. Over the limit, the increment is silently dropped (the client still updates optimistically, so the reader sees their button state change regardless).
4. Server increments the reaction count for that section and returns the new value.

**Display.** The reaction number is rendered alongside the stance buttons in a visually distinct style (smaller, lower contrast). It is never framed as a vote or a poll, just as an engagement signal. Copy example: *"47 reactions."* Optionally: *"47 reactions, 12 in the last day."*

**Why this is safe to display.** The counter has no direction. An attacker who inflates it makes a section look more popular, which is politically neutral. Both sides of the override debate would be symmetrically advantaged (or disadvantaged) by brigading the count, so brigading serves no purpose. The rate limit is a nice-to-have, not the core defense.

### 5. Share mechanism

Every section widget has a share icon. Clicking it:

- **On mobile** (`navigator.share` available): invokes the OS share sheet with the section title and permalink URL. The user picks iMessage, WhatsApp, email, or any installed share target.
- **On desktop** (no `navigator.share`): copies the permalink to the clipboard and shows a brief "link copied" toast.

The permalink is the canonical section URL: `<page-path>#<anchor-slug>`.

The share mechanism carries no stance data. It is purely content forwarding. The sender's private marks and notes are never included in the shared URL.

**Open Graph metadata.** Every page in the site has `og:title`, `og:description`, and `og:image` meta tags in its `<head>`. The `og:image` points to the page's primary chart image or a site-wide default. When a shared link is pasted into Facebook, iMessage, Slack, Nextdoor, or any other link-preview-capable surface, it renders as a rich card with the correct title and image. This is independent of the share icon and applies to all sharing, including manual URL copy-paste.

OG tags are added as a pre-existing editorial task: the site owner writes one short description per page. No per-section OG is needed in v1; section anchors inherit the page's card.

## Data model

The backend needs exactly one table.

```sql
-- One row per section, tracking lifetime and rolling 24h reaction counts.
CREATE TABLE reactions (
  section_id TEXT PRIMARY KEY,
  total_count INTEGER NOT NULL DEFAULT 0,
  count_24h INTEGER NOT NULL DEFAULT 0,
  window_24h_start INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
```

The 24h count is maintained lazily: on every increment, if the current time is more than 24 hours past `window_24h_start`, the 24h count is reset and the window start is moved forward. This is not perfectly accurate (a true rolling window would require hourly buckets) but it is close enough for a liveness signal and cheap to implement.

An optional second table for per-IP rate limiting, using a simple fixed-window scheme:

```sql
CREATE TABLE rate_limits (
  ip_hash TEXT NOT NULL,
  section_id TEXT NOT NULL,
  window_start INTEGER NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (ip_hash, section_id, window_start)
);
```

The `ip_hash` is `SHA256(ip || deployment_salt)`. Old rows are cleaned up lazily on write (any row with `window_start` older than 2 hours is deleted).

No other server-side tables exist. No credentials, no stances, no notes, no challenges, no vouches, no postcards, no payments, no user records.

## Backend architecture

**Runtime:** Cloudflare Workers.
**Database:** Cloudflare D1 (managed SQLite), one database for the site.
**Static front-end:** the existing Jekyll site continues to deploy to GitHub Pages unchanged. The stance widget is a small vanilla-JS module bundled into `assets/` and loaded on every page. No SPA framework, no React, no build-system change beyond one small JS file and corresponding CSS.

**Endpoints.**

- `GET /api/reactions?section_ids=a,b,c` — batched fetch of reaction counts and 24h deltas for all sections on the current page. Called once per page load. Returns `{section_id: {total, last_24h}, ...}`.
- `POST /api/reactions` — increment a single section's counter. Body: `{ section_id }`. Rate-limited per IP per section. Returns the new total and last_24h.

That's the entire API surface. Two endpoints. No authentication, no session state, no webhooks.

**Why this stack.**

- Cloudflare Workers free tier (100k requests/day) is far beyond what this feature will need.
- D1 free tier (5 GB) is a rounding error for this data.
- One vendor, one deployment command (`wrangler deploy`), zero infrastructure to think about.
- No payments, no mail, no third-party vendors at all. The only external service is Cloudflare itself.

**Front-end responsibilities.**

- On page load: find all section anchors, fetch their reaction counts in one batch, hydrate each section with a widget.
- Read and write local stances and notes via IndexedDB.
- On stance button click: update IndexedDB, fire reaction increment, update widget optimistically.
- On share click: call `navigator.share` or fall back to clipboard copy.
- Debounced save of note text on change.

## Abuse resistance

There is very little to defend. The only public signal is a directionless integer per section. Every other piece of data is either nonexistent on the server (stances, notes) or derived from a public URL (shared links).

**Layered defenses, weakest to strongest:**

1. **Per-IP rate limit** on reaction increments (5 per section per hour). Catches casual bot inflation. Bypassable with VPNs.
2. **Cloudflare's built-in DDoS protection** on the Worker endpoint. Free, global, always on.
3. **The counter is directionless.** Even if an attacker bypasses the rate limit and inflates a section to 10 million reactions, the signal they've created is "this section looks popular," which takes no side in the debate. There is no winning move for an attacker.

No Turnstile, no per-IP address claim limits, no captcha. The feature is too low-stakes to warrant that friction.

## Privacy properties

What the server knows about a reader:

- An ephemeral hash of their IP address, used only for rate-limiting and reset every rolling window. No long-term storage of IP.
- The fact that at some point, some request hit the reactions endpoint for some section. No linkage of increments to any identity.

What the server does not know:

- The reader's name, email, address, or any identifying information.
- Any stance or note content.
- Which way the reader leaned on any section (because the reaction endpoint is directionless).
- Any history of their activity beyond the integer counter.

**The entire server-side trust story fits in one sentence:** the server stores a number per section and a short-lived per-IP rate limit bucket. It does not store anything else.

Reviewers of the Worker source can verify this directly. The code is small enough to read in one sitting.

## Costs and operations

Fixed:

- Domain: already owned.
- Cloudflare Workers + D1: $0 at expected volume (free tier).

Variable: none. No vendor costs, no payment processing, no postal costs, no per-user cost of any kind.

**Estimated human time commitment:** under 30 minutes per week once steady state is reached. Mostly for occasional log review and uptime checks.

## Open source and audit

Published alongside the site:

- The Cloudflare Worker source (single JS file, maybe 100 lines).
- The front-end widget source (single JS + CSS module, maybe 300 lines).
- The D1 schema migration.
- A `PRIVACY.md` documenting the minimal server-side footprint.
- A brief `README` describing what the feature does.

The entire implementation is small enough that a reader can audit it in 20 minutes of skimming. No obfuscation, no minification in source, no dependencies beyond Web APIs and the Cloudflare Workers runtime.

## Implementation phasing

This scope is small enough to ship in a single implementation plan without sub-phasing. A rough breakdown for the writing-plans step:

1. Build the front-end widget (buttons, reactions display, share, notes field) with local IndexedDB storage and no backend wiring. Shippable on its own as a pure reading tool. The reactions counter shows a placeholder "-" until backend wiring lands.
2. Ship the widget's runtime anchor-generation logic: it walks every `<h2>` on the current page (excluding pages marked no-pulse), slugifies the heading text into an anchor ID, and injects the widget DOM. The `data-stance-section` attribute override works on any element. Curate explicit widgets on any h3 or mid-paragraph claim worth capture.
3. Add Open Graph meta tags to every existing page with a one-line description per page.
4. Build the Cloudflare Worker with the two reactions endpoints and the D1 schema. Deploy.
5. Wire the front-end widget to the Worker (batch fetch on page load, increment on click).
6. Write `/privacy.html` covering the local-only storage model in plain language. Add the "Privacy" link to every widget and to the site footer. This is the canonical disclosure for how the community pulse feature handles reader data.
7. Polish: 24h delta display, loading states, error handling, accessibility, mobile styling.

Each step is independently reviewable and most can be done in an hour or two. Total engineering time is days, not weeks.

## What is deferred to a future phase

**v1.1 follow-up** (small, local scope):
- `/pulse.html` settings page for browsing, clearing, and exporting a reader's local marks in one place.

**Later future phase** (the large civic polling layer):
The original design discussion explored a much larger system with postcard verification, vouching, challenges, cascade revocation, Stripe integration, Lob integration, and a verified per-section agree/disagree/alert tally. All of that is deferred.

If and when participation evidence shows there is real demand for a verified civic polling layer, the future phase would add:

- Postcard verification via Lob, backed by a credentials table and a stance submission endpoint.
- A verified agree/disagree/alert tally rendered alongside (not replacing) the reactions counter.
- Neighbor vouching with cascade revocation on successful challenge.
- Challenge mechanism via Stripe Checkout for the challenge fee.
- All the data model and operational machinery that implies.

None of this infrastructure exists in v1. The v1 data model, API surface, and widget layout are designed to be forward-compatible: adding a verified tally later is additive and does not require reworking what v1 ships.

## Out of scope for v1, permanently or nearly so

- Public comments, discussion threads, or any reply-capable surface.
- Real-name identity, accounts, profiles, or email addresses.
- Cross-device sync of private notes.
- Passkey or WebAuthn-backed credentials.
- Image export of a reader's marks as a shareable card.
- Localization or multi-language support.
- On-chain identity of any kind.

## Decisions locked during walkthrough

All implementation-detail questions have been resolved:

1. **Anchor ID generation: runtime JavaScript at page load.** Derives anchor IDs by slugifying each h2's heading text. Chosen over a Jekyll plugin because GitHub Pages' default build runs in safe mode and does not execute custom plugins; adding CI for this one feature is disproportionate. Shared links stay stable as long as heading text stays stable (the same constraint any auto-anchor scheme carries).
2. **Widget placement: inline next to the heading, small and low-contrast.** Visible on arrival, not visually dominant.
3. **24-hour delta: plus-delta text (e.g., `+12 today`).** No sparkline in v1.
4. **`/pulse.html` settings page: deferred to v1.1.** Not required to ship the core feature. Readers can access local state via browser devtools in the interim.
5. **Privacy disclosure: dedicated `/privacy.html` page.** Linked from every widget and the site footer. Not a tooltip, not a footnote.
