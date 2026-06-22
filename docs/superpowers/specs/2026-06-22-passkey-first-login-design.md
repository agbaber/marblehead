# Passkey-First Login + Peer-Vouch-On-Demand: Design

**Date:** 2026-06-22
**Scope:** Reorder the `/verify-me.html` sign-in flow to surface passkeys before Facebook, add a passkey-save prompt at the end of FB-based onboarding, and add a third self-serve sign-up path (peer-vouch-on-demand) for residents who can't or won't use Facebook.
**Status:** Draft for user review.
**Depends on:** Neighbor Verification Network ([2026-04-15](2026-04-15-neighbor-verification-design.md)) and Self-Serve Verification ([2026-06-14](2026-06-14-self-serve-verification-design.md)), both shipped.

## Problem

`/verify-me.html` is the front door for new residents. Today it shows a single primary CTA: "Continue with Facebook." That works for first-time onboarding, but it's wrong in two ways:

1. **Returning users get the same big FB button as new users.** A resident who already verified — even one who saved a passkey on this device during the invite flow — sees no passkey path. They click "Continue with Facebook," bounce through OAuth, and end up signed in via a flow that takes 4 cross-origin redirects when it could have been one biometric tap. Most never realize the passkey path exists, because it's hidden on `/verify.html` behind an "Already verified?" card.

2. **Non-FB residents have no self-serve path.** If someone doesn't have Facebook, doesn't have a verified neighbor to send them an invite, and isn't willing to make a fake FB account, they're stuck. The only escape hatch today is a GitHub branch-request issue, which is high friction and limits adoption to people comfortable with GitHub.

Adding Google or Apple as alternative IdPs was considered and rejected: those providers give us no public audit surface, while Facebook's profile — even imperfectly — gives the community a thread to pull if a claim looks fraudulent. See "Why not Google/Apple" below.

## Goals

- Returning users with a passkey on this device sign in with one biometric tap, no FB redirect.
- New users still have FB self-serve as a fast onboarding path (preserves community audit signal).
- New users without FB have a self-serve alternative that doesn't require GitHub or postage.
- All FB-onboarded residents (existing and new) get the chance to save a passkey so subsequent sign-ins skip FB.
- No regressions to the existing invite-based registration flow.

## Non-goals

- Adding Google, Apple, or any other IdP. (See rationale.)
- Replacing the existing GitHub branch-request escape hatch — it remains for edge cases that fall through all three self-serve paths.
- Postcard-based verification (rejected: too slow and too expensive for the override timeline).
- Notification infrastructure (email, SMS, push). Peer-vouch v1 uses a shareable link, not a notification.
- Soft-publish / community-veto window on new claims. Tracked as a v2 enhancement; not in this scope.
- Changing the auth model on `/verify.html` (invite redemption stays as-is).

## Why not Google/Apple

Considered and explicitly rejected:

- **Spoofing bar is the same or worse.** Apple lets the user type any name into the consent dialog at sign-in time — zero connection to anything Apple verified. Google profile names are user-editable with no review. Facebook has marginal rate-limiting on name changes but it's defeated in 60 days.
- **No community audit surface.** Facebook's public profile lets a verified neighbor — or an admin spot-checking a suspicious claim — look at account age, friend count, post history, and tagged locations. Google profiles are mostly private; Apple profiles are completely opaque. There is no equivalent "is this a real person who lives in Marblehead?" check available.
- **Marginal coverage gain.** Marblehead's "no FB" population that nevertheless has Google/Apple and would prefer either to peer-vouch is small. Peer-vouch covers the actual gap (people without FB who have a verified neighbor) more cleanly.

If the community-audit assumption ever breaks down (e.g., the size of the verified roster makes manual spot-check infeasible), revisit.

## Product overview

### Sign-in flow on `/verify-me.html` (returning users)

1. Page loads. JavaScript calls `navigator.credentials.get({ mediation: 'conditional' })` to register a conditional-UI passkey request.
2. If the device has a passkey registered for marbleheaddata.org, the browser surfaces a native Touch ID / Face ID prompt (Safari: appears in the address bar autofill area; Chrome: a system sheet on first focus).
3. User authenticates → page receives the WebAuthn assertion → POSTs to `/api/verify/passkey/auth` → JWT returned → user lands on `/profile.html`.
4. If no passkey is available, the conditional UI shows nothing. The user sees the page with:
   - **Primary CTA:** "Continue with Facebook" (current path, unchanged)
   - **Secondary link below:** "No Facebook? Ask a neighbor to vouch."

### Sign-up flow for non-FB users (new path)

A new page `/vouch-request.html` and a corresponding `/vouch.html` redemption page. Pattern is the **invite system inverted**: the requester sends a verified neighbor a link asking to be vouched for, instead of the inviter sending a link to a recipient.

**Requester side:**

1. From `/verify-me.html`, the requester clicks "No Facebook? Ask a neighbor to vouch."
2. Lands on `/vouch-request.html`. Enters their name and street address (typeahead from `/api/streets`).
3. Client hashes locally: `hash(name + address + salt)` (same hash function as the invite system).
4. POSTs to `/api/verify/vouch-request` with the hash, name, and address.
5. Server creates a `vouch_requests` row with a fresh token, returns a shareable URL: `https://marbleheaddata.org/vouch.html?token=<token>`.
6. Requester is shown the URL and instructed: "Text or email this link to a Marblehead neighbor who already verified on this site. When they confirm, you'll be verified too."
7. Page shows a passive status check: "Waiting for a neighbor to confirm…" with a poll every 10 seconds to `/api/verify/vouch-status?token=<token>`. On confirmation, the page transitions to passkey-save (see below) using the JWT the server returns.

**Voucher side:**

1. Verified neighbor receives the link out-of-band (text, email, etc.).
2. Opens `/vouch.html?token=<token>`. If not signed in, the page first surfaces the passkey-conditional-UI prompt, then falls through to FB / invite options.
3. Once signed in, the page displays: "Sarah at 14 Elm asked you to vouch for them. Do you know this person and confirm they live at 14 Elm?" with Confirm / Decline buttons.
4. Confirm → POST to `/api/verify/vouch-respond` with the token and the voucher's session JWT → server marks the request verified, creates a `residents` row for the requester with `auth_source='peer_vouch'`, `claim_source='vouched'`, `invited_by=<voucher's identity_hash>`, returns success.
5. Decline → request marked declined. Requester can resend to a different neighbor.

**Constraints on the voucher side:**
- Voucher must have at least 1 invite remaining. The vouch consumes one slot, same as a regular invite, to bound the trust-graph fan-out.
- A request can only be confirmed once. Subsequent attempts return "already resolved."
- Requests expire after 7 days. Expired tokens can't be redeemed.
- A given requester hash can have at most one active (non-expired, non-resolved) request at a time. Prevents request-spamming.

### Passkey-save prompt (after any FB sign-in, when no passkey exists)

After a successful FB OAuth that produces a JWT for either a new resident (post-claim) or an existing FB-only resident, the receiving page checks: does this resident have any rows in `passkey_credentials` for their `identity_hash`?

- **None:** show a full-width card with two buttons:
  - Primary: "Save passkey (Touch ID / Face ID)" — runs WebAuthn registration via `@passwordless-id/webauthn`
  - Secondary: "Skip for now" — sets `localStorage.passkey_save_skipped_at` to today's date, dismisses the card
- **Has passkey already:** no card shown.
- **Re-prompt:** if `passkey_save_skipped_at` is older than 30 days at next sign-in, show the card again.

The card appears on `/profile.html` for existing residents and on the post-claim success state of `/verify-me.html` for newly-claimed residents.

## Architecture

### Frontend changes

| File | Change |
|---|---|
| `verify-me.html` | Add conditional-UI passkey call on page load. Add "No Facebook?" secondary link to `/vouch-request.html`. Wire passkey-save card into the post-claim success state. |
| `vouch-request.html` | **New page.** Form for name + address. Hashes locally. POSTs to `/api/verify/vouch-request`. Shows the shareable link and polls status. |
| `vouch.html` | **New page.** Reads token from URL. Requires sign-in (passkey conditional + FB fallback). Shows confirm/decline UI. POSTs to `/api/verify/vouch-respond`. |
| `profile.html` | Add passkey-save card (shows if no credential exists and `passkey_save_skipped_at` is unset or >30d old). |
| `assets/community-pulse/claim.js` | Add conditional-UI bootstrap (`navigator.credentials.get({ mediation: 'conditional' })`) on page load and authentication handler. |
| `assets/community-pulse/vouch.js` | **New file.** Drives `vouch-request.html` and `vouch.html`. |
| `assets/community-pulse/passkey-save.js` | **New file.** Reusable card+handler used by both `verify-me.html` (post-claim) and `profile.html`. |

### Worker changes (`community-pulse/worker/src/`)

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/verify/vouch-request` | POST | Requester creates a vouch request. Body: `{ identity_hash, name, address }`. Returns: `{ token, expires_at }`. |
| `/api/verify/vouch-status` | GET | Requester polls for resolution. Query: `?token=<token>`. Returns: `{ status: 'pending' \| 'verified' \| 'declined' \| 'expired', jwt?: string }`. JWT is only returned on `verified`. |
| `/api/verify/vouch-respond` | POST | Voucher confirms or declines. Body: `{ token, decision: 'confirm' \| 'decline' }`. Requires voucher's session JWT. Server side: decrement voucher's `invites_remaining`, create `residents` row on confirm, mint JWT for requester. |
| `/api/verify/passkey/has-credential` | GET | Frontend checks if the signed-in resident has at least one passkey credential. Returns: `{ has_credential: boolean }`. Used to decide whether to show the passkey-save card. |

The conditional-UI passkey sign-in piggybacks on the existing `/api/verify/passkey/auth-challenge` and `/api/verify/passkey/auth` endpoints — no Worker changes needed for the sign-in path itself.

### Database changes

New table `vouch_requests`:

```sql
CREATE TABLE IF NOT EXISTS vouch_requests (
  token              TEXT PRIMARY KEY,
  requester_hash     TEXT NOT NULL,
  requester_name     TEXT NOT NULL,
  requester_address  TEXT NOT NULL,
  status             TEXT NOT NULL DEFAULT 'pending',
  vouched_by         TEXT,
  created_at         INTEGER NOT NULL,
  expires_at         INTEGER NOT NULL,
  resolved_at        INTEGER
);

CREATE INDEX IF NOT EXISTS idx_vouch_requests_requester
  ON vouch_requests(requester_hash) WHERE status = 'pending';
```

`status` values: `pending`, `verified`, `declined`, `expired`. Enforced in Worker handlers (SQLite ALTER doesn't take CHECK constraints cleanly).

No changes to `residents`, `passkey_credentials`, or `invites`. The peer-vouch flow writes to `residents` with `auth_source='peer_vouch'`, a new value joining existing `invite` and `fb` values. Worker handlers enforce the enum.

### Data flow: peer-vouch happy path

```
Requester                Server (Worker + D1)              Voucher
---------                ----------------------            -------
verify-me.html
  click "No FB?"
  → vouch-request.html
  enter name+addr
  hash locally
  POST /api/verify/vouch-request
                          INSERT vouch_requests row
                          (status='pending')
                          ← { token, expires_at }
  show shareable URL
  poll /api/verify/vouch-status

  [out-of-band: text/email link to neighbor]
                                                          opens link
                                                          /vouch.html?token=...
                                                          sign in (passkey or FB)
                                                          see "Sarah at 14 Elm
                                                            asked you to vouch"
                                                          click Confirm
                                                          POST /api/verify/vouch-respond
                          UPDATE vouch_requests
                          SET status='verified'
                          INSERT residents
                          (auth_source='peer_vouch',
                           invited_by=voucher_hash)
                          UPDATE residents
                          SET invites_remaining = invites_remaining - 1
                          (voucher's row)
                          ← { ok: true, jwt: requester_jwt }
                                                          ← { ok: true }
  next poll returns
  { status: 'verified',
    jwt: <requester_jwt> }
  → passkey-save card
  → /profile.html
```

### Conditional-UI passkey: implementation notes

The `@passwordless-id/webauthn` library used in `verify.html` doesn't ship a conditional-UI helper. We'll either:

a) Use the lower-level `navigator.credentials.get()` API directly with `mediation: 'conditional'` and `allowCredentials: []` (the empty array is required — conditional UI is for *discoverable* credentials only).
b) Use the underlying `@simplewebauthn/browser` library (which the `@passwordless-id` wrapper is built on) if the wrapper exposes the right escape hatches.

Option (a) is what we'll do — `navigator.credentials.get()` is well-supported in Safari 16+ and Chrome 108+, both of which cover the target audience. The page silently does nothing if the browser doesn't support conditional UI (older Firefox, some in-app browsers); the FB button remains visible as the visible fallback.

### Error handling

- **Vouch request expired:** voucher opens link after 7 days → `/vouch.html` shows "This request has expired. Ask Sarah to start a new request." No DB write.
- **Vouch request already resolved:** voucher opens link after another voucher confirmed → "This request has already been confirmed." No DB write.
- **Voucher has no invites left:** "You're out of invites this cycle. Suggest Sarah ask another neighbor." No DB write.
- **Requester already a resident:** vouch-request endpoint checks `requester_hash` against existing `residents`. If a row exists and is not revoked, return `{ error: 'already_verified' }` and don't create a request.
- **Passkey conditional UI fails silently:** if `navigator.credentials.get()` throws or returns `null`, log to console, do nothing. The FB and vouch paths remain.
- **Passkey-save dismissed:** persisted as `localStorage.passkey_save_skipped_at`. Cleared on successful save.

### Testing

- **Worker unit tests** for the three new endpoints, mirroring `community-pulse/worker/tests/` patterns. Cover: happy path (create → poll-pending → respond-confirm → poll-verified), declined response, expired request, double-redemption, requester-already-verified, voucher-no-invites.
- **Schema migration test** verifying the new table is created idempotently and the index lookup works.
- **Playwright smoke test** (`tests/smoke-test.mjs`) extended to load `/vouch-request.html` and `/vouch.html` with a stubbed token, assert the forms render. Full end-to-end vouch flow is hard to smoke-test without WebAuthn mocking; that gap is acceptable since the Worker handlers carry the contract.
- **Manual test plan** in PR description: cold sign-in with passkey on test device, post-FB passkey-save prompt, vouch request → vouch confirm round trip via two browsers.

## What changes for residents

- **You already have a passkey on this device:** open the site, sign-in surfaces a Touch ID / Face ID prompt automatically. One tap. No redirect.
- **You verified via FB and never saved a passkey:** next sign-in on `/profile.html` (or after the next FB OAuth), see a card asking you to save one. Skip indefinitely if you want; we'll re-ask once a month.
- **You don't have Facebook and don't have an invite:** click "No Facebook? Ask a neighbor to vouch" on `/verify-me.html`, enter your name and address, send the resulting link to any verified Marblehead neighbor. When they confirm, you're in. Save a passkey on the spot.
- **You already verified via invite:** no change. Sign-in via passkey continues to work on `/verify.html` as it does today, and now also on `/verify-me.html` via conditional UI.

## Rollout

Single PR off main covering all four changes (schema migration, Worker endpoints, two new pages, passkey-conditional UI on existing pages). Cloudflare PR preview provides smoke-test surface. After merge:

- New schema migration runs on next deploy.
- No data backfill needed: existing residents continue working as-is. The passkey-save card appears the next time they sign in.
- Monitor `vouch_requests` table volume for the first week — if requests pile up unfulfilled, the assumption that requesters have neighbor channels to send the link through is wrong, and we revisit notification infrastructure.

## Open questions

- **Spam guard on `/vouch-request.html`:** the page is unauthenticated. A bad actor could create unlimited vouch requests with random names. The 1-active-request-per-hash constraint helps but doesn't fully prevent it. **Decision for v1:** rely on the constraint + Cloudflare rate limiting on the endpoint. Revisit if abuse appears.
- **Should the voucher see what the requester typed for name vs. assessor record?** Today the FB self-serve path silently checks `display_name` against `parcel_owners`. For peer-vouch, the voucher *is* the check — they're vouching that the person they know actually lives at that address. No silent assessor check; the voucher's judgment is the bar. (This is consistent with the invite flow.)
- **What happens to the passkey-save card on devices that can't make passkeys (older Android Chrome, locked-down corp laptops)?** Card still renders; clicking "Save passkey" surfaces the OS-native "this device can't" error. User can Skip. Worth feature-detecting `PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()` and hiding the card entirely if false — flagged for the implementation plan, not deciding here.
