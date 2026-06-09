# Backing and Reps: Design

**Date:** 2026-06-09
**Scope:** A layer on top of the neighbor verification network that lets verified residents publicly back ideas on what-can-we-do.html and self-declare as reps ("I'll talk to others about this"). Includes an open onramp for non-verified visitors to request verification, with Facebook Login as the request-side identity layer and assessor records as a fast-path signal for verifiers.
**Status:** Draft for user review.
**Depends on:** Neighbor Verification Network ([2026-04-15-neighbor-verification-design.md](2026-04-15-neighbor-verification-design.md)). Frontend exists (`verify.html`, `assets/community-pulse/verified.js`); backend lives on the community-pulse Cloudflare Worker behind `/api/verify/*`.

## Problem

The site has accumulated 30+ concrete ideas about Marblehead's budget situation on `what-can-we-do.html` — cost reductions, revenue options, governance moves, and one-offs. Each is editorially careful (rough dollar guess, difficulty pill, who-pays section, research checklist). What's missing is the coordination layer: a resident who reads the page and thinks "yes, someone should pursue Medicare Advantage" has no way to signal that publicly, find others who agree, or volunteer to do anything about it.

Meanwhile, the verification network is invite-only by design — no open registration. A visitor who has no verified neighbor can't join even if they want to. That gap blocks new participation.

This spec threads both: a backing layer for ideas built on the existing verified-identity hashes, and an open onramp that uses Facebook Login as the request-side identity signal so verifiers can confirm strangers with a single DM.

## Goals

- Let verified residents back any idea card on what-can-we-do.html with one click, optionally showing their name publicly.
- Let backers opt up to a "rep" tier — public commitment to talk to others about the idea (no on-site tooling for v1; coordination happens offline).
- Show counts and opted-in names per idea, sitting visually below the existing editorial content (rough guess, who pays, research). Never let backing counts re-rank or re-frame the editorial content.
- Provide an open onramp at `/verify-me.html` where non-verified visitors can request verification from any verified resident who has opted into the public verifier list.
- Use Facebook Login on the request form to get verified FB identity (real account, real name, click-to-DM link) and — once the `user_friends` scope is approved by FB app review — surface mutual-friends-with-existing-verifieds as a trust-graph signal for verifiers.
- Use Marblehead assessor data as a fast-path signal in the verifier dashboard (✓ matches owner of record / no match / name mismatch).
- Preserve the site's editorial neutrality. Verified residents endorse ideas in their own name; the site itself never endorses an idea.

## Non-goals (v1)

- User-generated ideas. The 30+ existing cards are the v1 surface; resident submissions are deferred to a moderated phase later if v1 demonstrates demand.
- Town Meeting warrant article voting. The verified-ballot infrastructure was scoped for this in the original verification spec but is not actually shipped. Building it cleanly belongs in v2 (~Feb 2027, ahead of the 2027 Annual Town Meeting). See "Planned follow-ons" below.
- Curated yes/no/abstain polls on operational questions. Risky editorial surface (whoever writes the question shapes the answer); deferred to v3 at earliest, gated on whether warrant-article voting in v2 demonstrates the framing problem can be managed.
- On-site rep tooling — petition databases, signed PDFs for town meeting, verified-only DM inbox, per-idea discussion threads. Reps coordinate offline; the site provides only the public list.
- Public branch-level breakdowns per idea (e.g., "Lighthouse Branch: 8 backed, Necking Branch: 4 backed"). Inherits the verification spec's branch-privacy contract; branches show aggregate vote mix on ballot questions only, not per-idea engagement.
- Email collection, push notifications, "ideas you might back" recommendations, leaderboards, trending widgets, sort-by-backing.
- Replacing Facebook DM as the verifier confirmation channel. FB Login provides the identity signal and a click-to-DM link; the actual identity check still happens in DM out-of-band.

## Decisions and rationale

| Decision | Choice | Rationale |
|---|---|---|
| Back vs. rep | Two layered tiers | Back scales (one-click endorse), rep self-selects (the handful actually willing to act). Friction-as-feature memory: real signal needs real friction. |
| Identity visibility | Opt-in names for backers, required names for reps | Preserves verification spec's default-anonymity for skeptical neighbors. Reps can't be anonymous because the role exists to be a public contact point. |
| User-generated ideas | Not in v1 | Editorial bar on existing cards is high (primary sources, who-pays sections); UGC erodes that bar on day one. |
| Open onramp | Direct request to a named verifier | Matches user's wording ("ask people to verify you"). Verifier chooses how strict to be; creates a public "willing to help neighbors join" list as its own civic signal. |
| Assessor records | Fast-path signal, not a hard gate | ~25-30% renters + spouses-not-on-deed + recent buyers + Drew/Andrew name variance — a hard gate locks out a meaningful share of real residents. |
| FB integration | Sign in with Facebook on request form (`public_profile` at launch, `user_friends` once app review approves) | Verified FB identity is stronger than typed handle. Mutual-friends signal (once available) is exactly the trust-graph bootstrap mechanism a vouching system needs. |
| Scope | All categories of what-can-we-do.html | User explicitly opted into this; pattern is identical per category. |
| Warrants | Deferred to v2 (~Feb 2027) | No active warrants (post-2026 ATM); verified-ballot infra not actually shipped; v1 scope already substantial. |
| Architecture | Extend the existing community-pulse Worker | Reuses identity layer + JWT + D1; modest schema growth on the right Worker. |

## Architecture

```
Browser
  ├── what-can-we-do.html               [existing page + new engagement widget]
  ├── verify.html                       [existing — adds verifier dashboard]
  ├── verify-me.html                    [NEW: public onramp page]
  ├── privacy.html, terms.html          [NEW: FB app requirement + civic hygiene]
  ├── assets/community-pulse/
  │     ├── verified.js                 [existing — extended for FB OAuth + new endpoints]
  │     ├── engagement.js               [NEW: idea-card widget controller]
  │     └── verifier-dashboard.js       [NEW: verifier inbox UI]
  │
  └── HTTPS to *.marbleheaddata.org
       │
       ▼
Community-Pulse Cloudflare Worker
  ├── existing /api/verify/* (invite/register/me/branches)
  ├── NEW /api/verify/fb-login         (FB OAuth callback)
  ├── NEW /api/verifiers               (public list of opt-in verifiers)
  ├── NEW /api/verify/request          (POST a verification request)
  ├── NEW /api/verify/requests/*       (verifier inbox: list, approve, decline)
  ├── NEW /api/engagement/:idea_id     (GET counts + names per idea)
  ├── NEW /api/engagement              (POST/DELETE back/rep state changes)
  └── Cron Triggers:
        - hourly: expire pending requests > 7 days
        - nightly: purge resolved verification_request plaintext > 30 days
       │
       ▼
D1 (existing database)
  ├── existing tables: users, branches, invites, ...
  ├── ALTER users + display_name, fb_user_id, fb_profile_url, fb_picture_url
  ├── NEW idea_engagement
  ├── NEW verifier_optin
  ├── NEW verification_request
  ├── NEW fb_friendship                 (populated once user_friends approved)
  └── NEW parcel                        (assessor CSV, ingested at deploy time)
```

## Data model

### Schema migrations (D1)

```sql
-- Add to existing users table
ALTER TABLE users ADD COLUMN display_name TEXT;       -- null = anonymous default
ALTER TABLE users ADD COLUMN fb_user_id TEXT;         -- null until they sign in with FB
ALTER TABLE users ADD COLUMN fb_profile_url TEXT;
ALTER TABLE users ADD COLUMN fb_picture_url TEXT;
CREATE INDEX idx_users_fb_user_id ON users(fb_user_id);

-- Per-target engagement. v1 only writes target_type='idea'; the column exists
-- so v2 (warrant articles) and v3 (curated polls) can reuse the table without migration.
CREATE TABLE engagement (
  user_hash    TEXT NOT NULL,
  target_type  TEXT NOT NULL CHECK (target_type IN ('idea','warrant','poll')),
  target_id    TEXT NOT NULL,           -- e.g. 'idea-06', 'atm-2027-article-17'
  state        TEXT NOT NULL CHECK (state IN ('back_anon','back_named','rep')),
  created_at   INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL,
  PRIMARY KEY (user_hash, target_type, target_id)
);
CREATE INDEX idx_engagement_target ON engagement(target_type, target_id, state);

CREATE TABLE verifier_optin (
  user_hash    TEXT PRIMARY KEY,
  opted_in_at  INTEGER NOT NULL
);

CREATE TABLE verification_request (
  id                  TEXT PRIMARY KEY,       -- uuid
  requester_name      TEXT NOT NULL,          -- plaintext, auto-purged 30 days post-resolution
  requester_address   TEXT NOT NULL,
  requester_fb_user_id TEXT,                  -- null if user skipped FB login (shouldn't happen in v1)
  requester_fb_profile_url TEXT,
  requester_fb_picture_url TEXT,
  requester_note      TEXT,                   -- optional, max 280 chars
  verifier_user_hash  TEXT NOT NULL,
  assessor_match      TEXT CHECK (assessor_match IN ('match','no_match','name_mismatch')),
  status              TEXT NOT NULL CHECK (status IN ('pending','approved','declined','expired')),
  invite_token        TEXT,                   -- set when status='approved'
  created_at          INTEGER NOT NULL,
  resolved_at         INTEGER
);
CREATE INDEX idx_req_verifier ON verification_request(verifier_user_hash, status);

-- Populated lazily on each user_friends-scoped FB signin.
-- Both directions are stored explicitly for query simplicity (Worker has cheap writes).
CREATE TABLE fb_friendship (
  user_a_hash  TEXT NOT NULL,
  user_b_hash  TEXT NOT NULL,
  observed_at  INTEGER NOT NULL,
  PRIMARY KEY (user_a_hash, user_b_hash)
);
CREATE INDEX idx_friendship_b ON fb_friendship(user_b_hash);

-- Assessor table: rebuilt from CSV at deploy time. Address is the lookup key.
CREATE TABLE parcel (
  address_normalized TEXT PRIMARY KEY,        -- "12 STATE ST" — uppercased, normalized
  street_number      TEXT,
  street_name        TEXT,
  owner_name         TEXT,                    -- as published; may include "& Smith, Jane" etc.
  parcel_id          TEXT,
  updated_at         INTEGER NOT NULL
);
CREATE INDEX idx_parcel_street ON parcel(street_name, street_number);
```

### Key invariants

- **State is overwriting.** No append-only audit log for engagement state transitions. Backing → rep → backing → removed leaves no history; the row reflects the current state and was either created/updated/deleted by the user. This matches the like-button semantics most users expect.
- **Plaintext PII is opt-in or short-lived.** `users.display_name`, `users.fb_*` are written only when a user takes a name-visible action. `verification_request` plaintext is purged 30 days after resolution by a Cron Trigger. The verification graph itself (invites, branches) remains hash-only as the original spec defined.
- **Opting in as a verifier implies opting in to display your name publicly.** A nameless entry on the public verifier list is useless. The verifier-optin flow requires `display_name` to be set; if the user hasn't already opted in elsewhere, the verifier-optin form collects it at the same time.
- **`engagement.target_type` exists in v1 but is always `'idea'`.** This is a deliberate forward-compatibility move so the v2 warrant-article work doesn't need a schema migration.
- **Assessor data is best-effort, never used for denial.** Lookup is by normalized address; result is one of three states surfaced to the verifier as a hint.

## Open onramp flow

### Entry points

- New page `/verify-me.html` — linked from the main nav, the existing `verify.html`, and the "Verify to back this idea" button on any idea card (when the visitor is not currently signed in as verified).
- The verify-me request UI also appears as a modal on `what-can-we-do.html` when a non-verified visitor clicks back/rep — so the friction lives at the point of need, not as a separate journey.

### Requester flow

1. Visit `/verify-me.html` (or the embedded modal).
2. Page shows a short explainer and the public verifier list.
3. **Click "Sign in with Facebook"** → OAuth flow with `public_profile` scope.
   - At launch: `public_profile` only. App review not required.
   - After app review: `user_friends` scope is also requested.
4. After return from FB, the form pre-fills the name from FB profile data. Remaining fields:
   - **Street address** — autocomplete by street name (existing street list) + number
   - **Pick a verifier** — radio list (default: Andrew Baber)
   - **Short note (optional)** — 280 chars
5. Submit → `POST /api/verify/request`.
6. Worker:
   - Inserts row into `verification_request` (status=`pending`).
   - Looks up `requester_address` (normalized) against the `parcel` table.
   - Sets `assessor_match` to `'match'` (owner name contains the requester name fuzzy-match), `'name_mismatch'` (address exists but no name overlap), or `'no_match'` (address not in parcel table).
7. Confirmation page: "Request sent to [Verifier Name]. They'll DM you on Facebook to confirm. You can come back here to check status." A bookmarkable token URL lets the requester check `GET /api/verify/request/:token` for `{pending|approved|declined|expired}`.

### Verifier flow

1. Pending requests appear in the verified dashboard (extension of `verify.html`) with a count badge in the nav.
2. Each request shows:
   - Requester name + street address (plaintext, only visible to the named verifier)
   - FB profile link (clickable) + profile picture
   - **If `user_friends` approved:** mutual-friends count + names of up to 5 mutual verified residents
   - Optional note
   - **Assessor badge:** ✓ green (match), ⓘ gray (no_match — could be renter or recent sale), ⚠ amber (name_mismatch — address exists but a different name appears on the deed)
3. Verifier DMs the person on FB out-of-band, confirms identity however they want.
4. **Approve** click:
   - Worker computes the inviter-side hash from the typed name+address using the same salt/algorithm as the existing invite handshake.
   - Creates an `invites` row with that hash + a fresh one-time token.
   - Updates the request row: `status='approved'`, `invite_token=<token>`, `resolved_at=now`.
   - Returns the invite link to the verifier's dashboard with a "Copy link" button.
   - Verifier pastes the link into the same FB DM thread.
5. **Decline** → `status='declined'`, `resolved_at=now`. No notification to the requester. Status page reads "no longer pending."
6. **Defer** → no state change. Useful when the verifier is mid-asking-around.

### Edge cases and safeguards

- **Hash mismatch on redemption** (e.g., "Jane Smith" in request, "Jane K. Smith" on `verify.html`): show clear error on the redemption form: "the name or address doesn't match — type it exactly as you wrote it in the original request." Friction acceptable; prevents leaked links being redeemed by the wrong person.
- **Multiple requests from one person to different verifiers**: allowed. Verifier dashboard shows a "this person has another pending request with [verifier]" hint to prevent double-approve.
- **Rate limiting**: 3 requests per IP per day. Cloudflare Worker provides this natively. No CAPTCHA in v1.
- **Pending expiration**: 7 days via hourly Cron Trigger. Plaintext purged 30 days after `resolved_at` for any final state.
- **Spam protection**: rate limit + manual approve step + assessor cross-check + FB-real-account requirement. If actual spam appears, add proof-of-work or CAPTCHA in v1.5.
- **UX gap (documented honestly)**: requester has no programmatic notification channel — they have to revisit the status page or notice the verifier's DM. This is acceptable for v1 because verification is fundamentally a personal-vouching act; an "your request was denied" auto-email would be worse.

## Idea-card engagement widget UI

### Top inline strip

Adjacent to the existing `idea-num` line, a small subdued metadata strip:

```
06 · Retiree benefits   ·   12 backed · 3 reps
```

Click smooth-scrolls to the bottom engagement panel. Hidden if both counts are 0. No button, no color emphasis. Inherits text size and weight from the existing `idea-num` typography.

### Bottom engagement panel

A new block after `details.idea-research`, styled like the existing `idea-guess` / `idea-catch` blocks (inherits `data-cat` color as a subtle border accent):

```
+----------------------------------------+
| WHO'S BEHIND THIS                      |
|                                        |
| 12 verified residents have backed this.|
| Names shown for those who opted in:    |
|   Andrew Baber (Lighthouse Branch)     |
|   Jane Smith (Necking Branch)          |
|   Bob Jones (Lighthouse Branch)        |
|   + 9 anonymous                        |
|                                        |
| 3 reps say "I'll talk to others        |
| about this":                           |
|   Andrew Baber (Lighthouse Branch)     |
|   Jane Smith (Necking Branch)          |
|   Bob Jones (Lighthouse Branch)        |
|                                        |
| [Back this idea]                       |
+----------------------------------------+
```

If 0 backers: panel shows only the explainer sentence + action button ("No one has backed this yet — be the first").

### Button states

| Visitor state | Button text | Click action |
|---|---|---|
| Not verified | "Verify to back this idea" | Links to `/verify-me.html?return=/what-can-we-do.html#idea-06` (or opens the verify-me modal inline) |
| Verified, not backing | "Back this idea" | Opens engagement modal |
| Verified, backing (anon) | "Backing this — manage" | Opens modal pre-filled |
| Verified, rep | "You're a rep for this — manage" | Opens modal pre-filled |

### Engagement modal

```
+----------------------------------------+
| Back this idea                         |
| #06: Switch retiree health coverage    |
|      from the GIC to Group Medicare    |
|      Advantage                         |
|                                        |
| [ ] Show my name on this idea publicly |
|                                        |
| [ ] I'll talk to others about this     |
|     (become a rep — name shown         |
|     publicly is required for this)     |
|                                        |
| [ Save ]  [ Cancel ]                   |
| (if already backing: [ Remove ]  )     |
+----------------------------------------+
```

Logical lock: checking "rep" auto-checks and disables "show name" (rep ⇒ name shown). Modal is a centered overlay on desktop, bottom-sheet on mobile.

### Sunset / kill switch

A `_config.yml` flag (`engagement_widget: on|off`) and per-category override let the widget be turned off globally or per-section without removing the underlying data. If backing data ever starts producing misleading signal at scale, flip the flag.

## Editorial framing

### Line we hold

*Verified residents endorse ideas in their own name. The site itself never endorses an idea.*

### What we deliberately don't do

- No sort-by-backing. Ideas stay in editorial order.
- No "trending," "most backed," "popular," or "featured" treatments anywhere.
- No leaderboard or top-N view.
- No animations, badges, reactions, hearts, fires, count-ups. Plain typography.
- No backing counts in card headers, hero positions, or homepage promos.
- No push notifications, email digests, "ideas you might back" recommendations.

### Visibility hierarchy on each card

The bottom engagement panel sits *below* `details.idea-research` — deeper in the card than the editorial content (rough guess, difficulty, who pays). Typography is lighter than editorial content. The `data-cat` category color is a subtle border accent, not a hero color. Reading a card top-to-bottom, editorial substance lands before backing data, every time.

### Wording rules (codified in STYLE_GUIDE.md)

| Use | Avoid |
|---|---|
| "Backed by N verified residents" | "N residents support this" / "N votes for this" |
| "X says they'll talk to others about this" | "X is leading this" / "X champions" |
| "Who's behind this" (section header) | "Endorsements" / "Supporters" / "Trending" |
| "Be the first to back this" | "Be the first to support this idea" |

### Editorial note at the top of what-can-we-do.html

Added before the category jump-nav:

> Each card below ends with a "Who's behind this" panel — counts and names of verified residents who personally endorse the idea or volunteer to advocate for it. The site doesn't endorse any of these ideas. The editorial content (rough guess, difficulty, who pays, research notes) is the site speaking; the backing data is residents speaking for themselves.

A shorter version appears in the engagement modal: "Backing this idea is you endorsing it, not the site."

### Specific neutrality risks and mitigations

**Risk 1: Andrew-as-omnipresent-backer.** As the seed user, Andrew's name will appear on whatever ideas he backs. If he backs every idea, the page reads as "Andrew's policy platform with a comment thread."
**Mitigation:** Andrew abstains visibly. Only backs ideas he genuinely endorses. Some cards show "0 backers" with his name conspicuously absent. This legitimizes abstention as a real option for everyone else.

**Risk 2: Low-quality or ethically dicey ideas accumulating backers.** E.g., idea-14 (restructure part-time positions to avoid benefits) is explicitly labeled as ethically dicey on the existing card. If it accumulates backers, the "who pays" caveat must read with the same prominence.
**Mitigation:** Existing card content is never auto-rewritten or de-emphasized based on backing counts. The "who pays" section stays exactly where it is, in the same typography. Backing is a layer on top, not a replacement.

### STYLE_GUIDE.md updates included in v1

- New section: "Backing and rep wording rules" (the table above).
- Add to "What Not To Do": no sort-by-backing, no featured/trending of ideas, no advocacy verbs on engagement copy.
- Add to "Page types": "engagement panel" as a new component with its own style rules.

## Privacy and legal pages

Facebook App settings require live URLs for a privacy policy and terms of service before the app can be moved out of dev mode. Both are needed at launch regardless of Login functionality; they're also overdue for general civic hygiene.

- `/privacy.html` — covers: verified-resident identity hashes, opt-in plaintext display names, FB profile data cached at signin, verification_request plaintext + 30-day purge, engagement state, no cross-site tracking, no email collection, no third-party analytics that could re-identify residents.
- `/terms.html` — covers: acceptable use, no spamming the verification onramp, no impersonation, the site reserves the right to revoke verification for cause (e.g., confirmed impersonation), neutrality stance disclaimer.

Both go through the existing markdown-to-Jekyll pipeline. Plain language; no boilerplate-generator output.

## Planned follow-ons (forward compatibility)

### v1.1: `user_friends` light-up

When FB app review approves the `user_friends` scope:
- Re-request the scope from currently signed-in users on their next visit (existing JWT remains valid; we just prompt for the additional permission).
- On grant, fetch the friends list (only co-app users) and write `fb_friendship` rows.
- Verifier dashboard starts showing mutual-friends count + top 5 names for each pending request.

### v2 (~Feb 2027): Warrant article voting

The 2027 Annual Town Meeting warrants are typically posted ~February-March 2027. v2 should be ready before that.

- New page `/warrant-articles-2027.html` (and one per year going forward).
- Each article gets a card with the full warrant text, an editorial summary, sources for relevant ACFR/Finance Committee context, and a verified-only yes/no/abstain vote.
- Branch-level mix becomes visible (no individual attribution, inherits verification spec's branch-privacy contract).
- Reuses `engagement.target_type='warrant'` from the v1 schema — no migration needed.

### v3 (gated on v2 results): Curated operational polls

Only if v2 demonstrates that curated voting can be done without framing problems. Tight scoping:
- Yes/no/abstain on time-bounded operational questions ("Should the Select Board commission a Medicare Advantage feasibility study?")
- Sunset built in: poll closes once the relevant board acts (or after 90 days, whichever first).
- Result page always shows "N verified residents — not a scientific sample" alongside any number.
- Reuses `engagement.target_type='poll'`.

## Open questions

1. **Which existing verified residents (besides Andrew) opt into the verifier list at launch?** The spec assumes Andrew is the only seed verifier on day one. Recruiting 3-5 additional opt-in verifiers before launch would meaningfully reduce his bottleneck and make the "ask people to verify you" framing concrete from day one. Worth a short Facebook post pre-launch.
2. **Assessor CSV source.** Needs sourcing. Likely options: Vision Government Solutions (`gis.vgsi.com/marbleheadma/`), Marblehead Open Data portal, or a direct PRR to the Assessor's office. Decision on the source affects update cadence (annual vs. quarterly).
3. **FB App review submission timing.** `public_profile` works the day we ship. `user_friends` review submission can begin as soon as the privacy + terms pages are live and the OAuth flow is wired. Review takes 2-4 weeks; plan accordingly so v1.1 follows v1 by ~a month.
4. **Existing verified-ballot endpoint scope creep.** The original verification spec defined `/api/votes` for ballot questions but it isn't actually shipped. The v2 warrant-article work should pick up there, but if anyone has started prototyping it, this spec needs to coordinate.

## Risks

- **FB Login app review may take longer than estimated or deny `user_friends`.** Mitigation: launch with `public_profile` only; the verifier still gets real FB identity + click-to-DM. Mutual-friends signal is upside, not load-bearing.
- **Selection bias in backers.** Verified residents skew toward whoever Andrew and early seeds knew. Backing counts at low N will be misleading as a "what Marblehead thinks" signal. Mitigation: framing already addressed (count is "N verified residents," not "N Marbleheaders"), but worth re-evaluating once N > 100.
- **Editorial drift.** Site editorial neutrality could erode subtly as backing becomes prominent. Mitigation: the sunset clause + the STYLE_GUIDE.md updates + the explicit "not in v1" list. Periodic re-read of this spec when shipping new features.
- **Assessor data lag.** Public records can lag months behind actual ownership. A new owner shows "no match" until the next ingestion. Mitigation: assessor is signal not gate; verifier can still approve.
- **Verifier burnout.** If Andrew is the only verifier and requests pile up, the queue stalls. Mitigation: recruit additional verifiers before launch (open question #1); rate limit prevents per-IP flooding; defer state allows triage.
