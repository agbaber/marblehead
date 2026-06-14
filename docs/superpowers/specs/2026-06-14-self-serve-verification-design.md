# Self-Serve Verification: Design

**Date:** 2026-06-14
**Scope:** A second door into verified-resident status that uses Facebook Login plus the assessor parcel dataset to auto-verify the common case (named owner of record), with the existing invite-handshake flow as the fallback for renters, recent buyers, spouses-not-on-deed, and other name-mismatch cases. Includes the full backing/reps engagement layer on `what-can-we-do.html` per the June 9 spec, the new `/profile` page, and the `/verify-me.html` onramp.
**Status:** Draft for user review.
**Depends on:**
- Neighbor Verification Network ([2026-04-15-neighbor-verification-design.md](2026-04-15-neighbor-verification-design.md)) — already shipped.
- Patriot/MassGIS parcel ingestion ([2026-06-10-patriot-parcel-ingestion-design.md](2026-06-10-patriot-parcel-ingestion-design.md)) — landed on `claude/patriot-parcel-ingestion`, not yet merged. `data/parcels.csv` ships de-identified; `data/parcels_raw/parcels_full.csv` (gitignored) carries owner + mailing for local use.
- Backing and Reps ([2026-06-09-backing-and-reps-design.md](2026-06-09-backing-and-reps-design.md)) — this spec is the implementation-ready successor that incorporates self-serve verification as the front door.

## Problem

The existing verification network is invite-only by design: a verified resident hands a one-time link to a neighbor, both sides agree on the same name + address hash, and a passkey ties the identity to a device. That works for the social fabric we have, but it has two limitations.

First, it does not scale to interested visitors who arrive cold with no verified neighbor to ask. They hit a closed door.

Second, the assessor data needed to bootstrap the trust graph was not in hand when the April 15 spec shipped. It is now: the MassGIS parcel ingestion landed FY2025 records for 8,805 Marblehead parcels, including a gitignored full CSV with owner name plus mailing address. With that data, the common case ("I am the named owner of 12 State St") can be self-verified without any human in the loop.

The June 9 backing/reps spec proposed an open onramp at `/verify-me.html` that used Facebook Login plus assessor data as a hint for a human verifier. This spec pushes further: the assessor record itself is the verification authority for matched names. Human verification stays as the fallback path, not the primary one.

## Goals

- Add a self-serve front door at `/verify-me.html` that takes a visitor from cold landing to verified-resident status in one session, with no inviter and no DM ping required, when the name on their Facebook profile matches the named owner of the claimed address.
- Add a `/profile` page where any verified resident — self-serve or invite-vouched — can manage their identity, see what they have backed or repped, control their public-versus-anonymous default, add a passkey, or release the claim.
- Add Facebook Login as a registration and return-visit auth method, complementing the existing passkey + invite system. Both doors resolve to the same `identity_hash` and the same downstream rights.
- Default every verified resident to anonymous public display ("verified resident"). Surfacing a display name is opt-in either globally on the profile or per-action on a back/rep click.
- When self-serve verification fails (name mismatch, address mismatch, no parcel match), route into the existing invite-handshake flow as a fallback. Pre-fill what we can.
- Ship the full June 9 backing/reps engagement layer on `what-can-we-do.html`. Idea cards get a counts strip and a "who's behind this" panel; verified residents can back or rep any idea.

## Non-goals

- Replacing the invite-handshake door. It remains available and is the only path for renters, recent buyers, name-mismatches, and households where the named owner is the only one on the deed.
- Surfacing assessor owner names anywhere on the public site. Owner names are PII, live only in a private D1 table, and never appear in a response body beyond a match/mismatch verdict for the requesting authenticated user.
- Showing claimed addresses publicly. Each user's claimed address is visible only to that user on their own profile.
- Removing the `branches` concept. Branches stay as an invite-handshake-only abstraction. Self-serve residents are branchless.
- User-generated ideas, town meeting warrant article voting, curated yes/no polls. Each remains deferred per June 9.
- Surfacing `user_friends` data at launch. We can request `public_profile` only on FB app review. If `user_friends` ever ships, that is a separate spec that layers a mutual-friends signal onto the verifier dashboard.
- Cross-device passkey re-prompt UX changes. The current behavior carries over from the April 15 spec.

## Decisions and rationale

| Decision | Choice | Rationale |
|---|---|---|
| Relation to existing invite system | Coexist as two doors | Renters, recent buyers, name-mismatches, and spouses-not-on-deed materially exist in Marblehead. Killing the invite path would lock them out. |
| Auto-verify match strictness | Strict-with-tunables (first-initial + last-name match) | Loose matching lets any "John Smith" claim any Smith parcel; pure strict locks out spouses. The tunable surfaces "claim under a household member's name" as a one-click route into the vouch path, not silent failure. |
| Self-serve auth | Facebook required at registration; passkey optional after | FB display name is the signal that backs the assessor match. Passkey alone has no name to compare. Optional passkey post-registration gives recovery and faster returns without forcing it. |
| Default public identity | Off (everyone shows as "verified resident") | Marblehead residents skew privacy-cautious. Default-anonymous matches the existing invite-handshake spec's contract and avoids surprising the first cohort of self-serve users. |
| Per-action override | Yes — each back/rep click has a "show my name on this idea" toggle | Lets someone be anonymous on one idea and named on another without flipping their global setting. |
| Reps and name visibility | Rep state forces `show_name=1` for that action | Reps exist to be public contact points; an anonymous rep is contradictory. The action-level toggle is forced, not the profile global. |
| Branch assignment for self-serve | None — branch_root is NULL | A "self-verified" megabranch would dwarf the small invited branches and break the public branch breakdown. Branches stay invite-only. |
| Where owner names live | Private D1 table, populated at deploy time from gitignored CSV | The data is too sensitive for git but too useful to omit. D1 keeps it server-side and out of any response body. |
| Match algorithm | Token-based with adjacency check (first-initial adjacent to last name in owner string) | MA owner records use formats like `SMITH JOHN A & SMITH JANE M`. Adjacency disambiguates "John Smith at SMITH JOHN" (match) from "John Smith at JOHNSON JOHN" (mismatch — surname is JOHNSON not SMITH). |
| Identity hash | Same SHA-256(name + address + salt) regardless of door | One row per adult across both paths. Migrating between doors (e.g., re-claiming via vouch after FB account loss) lands on the same `identity_hash` and preserves prior votes/backings. |
| Display name source on FB-authed users | FB profile name at sign-in, editable later | FB returns a real-looking name with no parsing needed. Lets the user override if their FB name is "Mr. Smith" or similar. |

## Architecture

```
Browser
  ├── /verify-me.html           [NEW: self-serve front door]
  ├── /verify.html              [existing: invite-handshake door, unchanged]
  ├── /profile                  [NEW: identity + engagement management]
  ├── /what-can-we-do.html      [existing page + engagement widget per June 9]
  ├── privacy.html, terms.html  [NEW: required for FB app review + civic hygiene]
  └── assets/community-pulse/
        ├── verified.js          [existing: extended with FB OAuth bootstrap]
        ├── claim.js             [NEW: self-serve claim form + match result UI]
        ├── profile.js           [NEW: /profile controller]
        ├── engagement.js        [NEW: idea-card widget controller]
        └── verifier-dashboard.js [NEW: verifier inbox per June 9, extended]
         │
         ▼  HTTPS to marbleheaddata.org
Cloudflare Worker (community-pulse)
  ├── existing /api/verify/*    [invite/register/me/branches — unchanged]
  ├── NEW /api/auth/fb/start
  ├── NEW /api/auth/fb/callback
  ├── NEW /api/claim/address
  ├── NEW /api/claim/release
  ├── NEW /api/profile           [GET, POST]
  ├── NEW /api/passkey/link      [reuses existing passkey infra under a new path]
  ├── NEW /api/engagement/:id    [GET counts, POST/DELETE state]
  ├── NEW /api/verifiers         [public opt-in verifier list]
  ├── NEW /api/verify/request    [vouch request — June 9]
  ├── NEW /api/verify/requests/* [verifier inbox — June 9]
  └── Cron Triggers:
        - hourly: expire pending verification_request rows older than 7 days
        - nightly: purge resolved verification_request plaintext after 30 days
         │
         ▼
D1 database
  ├── existing tables (residents, invites, passkey_credentials, recovery_keys,
  │                    verified_votes, branch_names, branch_name_votes)
  ├── ALTER residents: add auth_source, claim_source, display_name,
  │                    public_identity, fb_user_id, fb_profile_url
  ├── NEW engagement
  ├── NEW verifier_optin
  ├── NEW verification_request
  └── NEW parcel_owners          [private, name+address, rebuilt at deploy]
```

## Data model

### Schema migrations

```sql
-- Residents grow new columns. NO existing columns change shape.
-- All defaults preserve the behavior of existing invite-vouched residents:
-- auth_source='invite', claim_source='vouched', public_identity=0.
ALTER TABLE residents ADD COLUMN auth_source     TEXT    NOT NULL DEFAULT 'invite';
ALTER TABLE residents ADD COLUMN claim_source    TEXT    NOT NULL DEFAULT 'vouched';
ALTER TABLE residents ADD COLUMN display_name    TEXT;            -- nullable
ALTER TABLE residents ADD COLUMN public_identity INTEGER NOT NULL DEFAULT 0;
ALTER TABLE residents ADD COLUMN fb_user_id      TEXT;            -- nullable
ALTER TABLE residents ADD COLUMN fb_profile_url  TEXT;            -- nullable
CREATE INDEX idx_residents_fb_user_id ON residents(fb_user_id);

-- CHECK constraints (added inline if D1 supports; otherwise enforced in Worker)
--   auth_source  IN ('invite', 'self_serve', 'recovered')
--   claim_source IN ('vouched', 'assessor_match', 'self_serve_vouched')

-- Engagement: one row per (resident, target). State is overwriting, no history.
CREATE TABLE engagement (
  identity_hash TEXT    NOT NULL REFERENCES residents(identity_hash),
  target_type   TEXT    NOT NULL,  -- v1 only writes 'idea'
  target_id     TEXT    NOT NULL,  -- e.g. 'idea-06'
  state         TEXT    NOT NULL,  -- 'back' | 'rep'
  show_name     INTEGER NOT NULL DEFAULT 0,
  created_at    INTEGER NOT NULL,
  updated_at    INTEGER NOT NULL,
  PRIMARY KEY (identity_hash, target_type, target_id)
);
CREATE INDEX idx_engagement_target ON engagement(target_type, target_id, state);

-- Verifier opt-in. Display name is required before opt-in (enforced in handler).
CREATE TABLE verifier_optin (
  identity_hash TEXT PRIMARY KEY REFERENCES residents(identity_hash),
  opted_in_at   INTEGER NOT NULL
);

-- Pending and resolved vouch requests. Plaintext purged 30 days post-resolution.
CREATE TABLE verification_request (
  id                       TEXT PRIMARY KEY,    -- uuid
  requester_name           TEXT NOT NULL,
  requester_address        TEXT NOT NULL,
  requester_fb_user_id     TEXT,
  requester_fb_profile_url TEXT,
  requester_note           TEXT,                -- max 280 chars
  verifier_identity_hash   TEXT NOT NULL REFERENCES residents(identity_hash),
  assessor_match           TEXT,                -- 'match' | 'first_initial_mismatch'
                                                -- | 'name_mismatch' | 'no_match'
  status                   TEXT NOT NULL,       -- 'pending' | 'approved'
                                                -- | 'declined' | 'expired'
  invite_token             TEXT,                -- set when status='approved'
  created_at               INTEGER NOT NULL,
  resolved_at              INTEGER
);
CREATE INDEX idx_req_verifier ON verification_request(verifier_identity_hash, status);

-- Private. Rebuilt at deploy time from data/parcels_raw/parcels_full.csv.
-- Never exposed via any GET endpoint. Owner names never leave the Worker
-- except as the verdict ('match'/'mismatch'/'no_match'/...) or as the
-- explicit alternatives list returned for first-initial mismatches.
CREATE TABLE parcel_owners (
  address_normalized TEXT PRIMARY KEY,  -- e.g. '12 STATE ST'
  owner_name         TEXT NOT NULL,     -- raw, may include '&', 'TR', etc.
  parcel_id          TEXT,
  fy                 INTEGER,
  updated_at         INTEGER NOT NULL
);
CREATE INDEX idx_parcel_owners_street ON parcel_owners(address_normalized);
```

### Key invariants

- One `identity_hash` per adult across both doors. A self-serve resident hashes name + claimed address with the existing salt and algorithm. If the same person later receives an invite-handshake invite for the same name + address, the hash collides and the system treats it as an existing identity (no duplicate row, no new branch assignment).
- `residents.display_name` is nullable. NULL means "no editable display name yet" — typically only true for legacy invite-vouched residents before they visit the new profile page. Effective public name resolves to the literal string `verified resident` whenever `display_name IS NULL` OR `public_identity = 0`.
- `residents.public_identity = 0` is the default. The profile page is the only place that flips it. Per-action `engagement.show_name = 1` overrides without touching the global.
- `engagement.state = 'rep'` implies `show_name = 1`. Enforced server-side in the POST handler — repping forces the per-action visibility on. Downgrading from rep to back does not auto-clear `show_name`; we keep the per-action choice the user made.
- `verification_request.requester_*` plaintext fields are short-lived. A nightly Cron Trigger nulls them out for any row 30 days past `resolved_at`. The structural columns (status, verifier, created_at, resolved_at) remain for audit.
- `parcel_owners` is never read by a GET endpoint. Reads happen only inside `/api/claim/address` and only from the authenticated, FB-signed-in flow.

## API surface

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/auth/fb/start` | None | Set a `state` cookie, 302 to Facebook OAuth dialog. `redirect_uri` is fixed to `/api/auth/fb/callback`. |
| GET | `/api/auth/fb/callback` | OAuth state cookie | Exchange code for FB token, fetch `me` (id, name, picture). Upsert into `residents` if first time (no `identity_hash` yet — provisional row keyed on `fb_user_id`), or attach FB to an existing resident if already invite-verified. Set 24h session JWT. 302 to `/verify-me` or `/profile` based on prior state. |
| POST | `/api/claim/address` | Session JWT (FB-signed-in, no `identity_hash` yet) | Body: `{ claimed_address }`. Worker normalizes the address, looks up `parcel_owners`, runs the match algorithm against the resident's FB display name, returns one of `{ status: 'match' | 'first_initial_mismatch' | 'name_mismatch' | 'no_match', alternatives? : [string], vouch_link? : string }`. On `match`, commits the `identity_hash`, `claim_source='assessor_match'`, `auth_source='self_serve'`, and writes any default verifier opt-in. |
| POST | `/api/passkey/link` | Session JWT | Reuses the existing `/api/verify/passkey/*` infrastructure under a new path. Adds a passkey to the current resident. Available to any door. |
| DELETE | `/api/claim` | Session JWT | Release the claim. Soft-deletes the resident row (sets `revoked_at`) and clears the session. Engagement rows stay (no orphan deletion); they become unattributable. |
| GET | `/api/profile` | Session JWT | Returns the full profile: `{ display_name, public_identity, claim_source, claimed_address (only to self), auth_source, has_passkey, engagement: [{idea_id, state, show_name}], is_verifier }`. |
| POST | `/api/profile` | Session JWT | Body: `{ display_name?, public_identity? }`. Updates editable fields. |
| GET | `/api/engagement/:idea_id` | None | Public. Returns `{ back_count, rep_count, named_backers: [string], named_reps: [string] }`. Names are only the residents who opted in for this idea. |
| POST | `/api/engagement/:idea_id` | Session JWT | Body: `{ state, show_name }`. Creates or updates the row. If `state='rep'`, forces `show_name=1`. |
| DELETE | `/api/engagement/:idea_id` | Session JWT | Removes the row. |
| GET | `/api/verifiers` | None | Public list of `verifier_optin` residents who have a non-null `display_name` and `public_identity=1`. Renders the verify-me onramp's "pick a verifier" step. |
| POST | `/api/verifiers/optin` | Session JWT | Adds the current resident to `verifier_optin`. Requires `display_name` and forces `public_identity=1`. |
| DELETE | `/api/verifiers/optin` | Session JWT | Removes from the verifier list. Existing pending requests they own remain assigned to them. |
| POST | `/api/verify/request` | Session JWT (FB-signed-in, no `identity_hash` yet) | Vouch request — June 9 spec. Pre-filled from FB profile and the most recent claim attempt. |
| GET | `/api/verify/requests` | Session JWT (verifier) | Pending requests assigned to the current verifier. |
| POST | `/api/verify/requests/:id/approve` | Session JWT (verifier) | Worker computes inviter-side hash for the requester's typed name + address, issues an invite token, transitions to `approved`. Verifier copies the link into FB DM. |
| POST | `/api/verify/requests/:id/decline` | Session JWT (verifier) | Transitions to `declined`. No notification. |

Existing endpoints (`/api/verify/register`, `/api/verify/passkey/*`, `/api/verify/me`, `/api/verify/vote`, `/api/verify/branches`, etc.) are unchanged.

## Match algorithm

```python
def match(fb_display_name: str, owner_name: str) -> MatchResult:
    fb = tokenize(fb_display_name)        # ['john', 'smith']
    own = tokenize(owner_name)            # ['smith', 'john', 'a', 'smith', 'jane', 'm']

    if len(fb) < 2:
        return MatchResult('name_mismatch')

    fb_first = fb[0]
    fb_last  = fb[-1]

    if fb_last not in own:
        return MatchResult('name_mismatch')

    # Owner-record convention is "LASTNAME FIRSTNAME MIDDLE", possibly joined
    # with '&' or 'AND' or '/' for co-owners. We look for the user's first
    # initial in the token immediately following any occurrence of their
    # last name. Trust/LLC keywords ('TR','TRUST','LLC','TRUSTEE','EST')
    # in the owner string short-circuit to name_mismatch — those records
    # never auto-verify.
    if has_trust_or_entity_marker(own):
        return MatchResult('name_mismatch')

    for i, token in enumerate(own):
        if token == fb_last and i + 1 < len(own):
            adjacent = own[i + 1]
            if adjacent.startswith(fb_first[0]):
                return MatchResult('match')

    # Same surname, no first-initial match. Collect the other given-name
    # tokens that follow occurrences of fb_last as alternatives.
    alternatives = []
    for i, token in enumerate(own):
        if token == fb_last and i + 1 < len(own):
            alternatives.append(own[i + 1].upper())
    return MatchResult('first_initial_mismatch', alternatives=alternatives)
```

### Cases

| FB display name | Owner record | Result |
|---|---|---|
| `John Smith` | `SMITH JOHN A & SMITH JANE M` | `match` |
| `Jane Smith` | `SMITH JOHN A & SMITH JANE M` | `match` |
| `Jane Smith` | `SMITH JOHN A` | `first_initial_mismatch`, alternatives=`['JOHN']` |
| `John Smith` | `JOHNSON JOHN` | `name_mismatch` (surname tokens differ) |
| `John Smith` | `SMITH FAMILY TRUST` | `name_mismatch` (trust marker present) |
| `J. Smith` | `SMITH JOHN A` | `match` |
| `Andrew Baber` | (address not present) | `no_match` |

The algorithm intentionally rejects all trust, LLC, and "owner of record" rows. Most such records are owned by named adults who can still take the vouch path; auto-approving anything off a trust opens the door to anyone with the surname claiming a multi-million-dollar trust property.

### Address normalization

Both the parcel-owners table and the user-typed claim run through the same normalizer:

1. Uppercase.
2. Collapse multiple spaces to one. Strip leading/trailing whitespace.
3. Expand standard abbreviations: `ST→STREET`, `AVE→AVENUE`, `RD→ROAD`, `DR→DRIVE`, `LN→LANE`, `CT→COURT`, `PL→PLACE`, `BLVD→BOULEVARD`, `TER→TERRACE`, `HWY→HIGHWAY`, etc. (full list in the implementation).
4. Strip trailing unit suffixes (`UNIT 3`, `APT 2`, `#5`). Multi-unit claims share an `address_normalized` key with the building; the match still succeeds if the FB name appears anywhere on any unit's owner record at that address.
5. Result: `'12 STATE STREET'` regardless of `'12 State St'` or `'12 state st.'` input.

The address autocomplete on `/verify-me.html` ships with the same normalized form as its suggestion labels, so the typed value almost always matches a parcel-owners row exactly on first try.

## User flows

### A. First-time self-serve verification

```
1. Visit /verify-me.html (header CTA, deep link, or June 9 backing modal).
   Page shows two doors, FB CTA primary:
   ┌────────────────────────────────────────────────────────────────┐
   │ Sign in with Facebook + claim your address       [recommended] │
   │ Or: Have an invite link from a neighbor?  → /verify            │
   └────────────────────────────────────────────────────────────────┘

2. Click FB CTA. Browser hits /api/auth/fb/start, gets 302 to Facebook OAuth
   with public_profile scope. User authorizes.

3. Facebook 302s to /api/auth/fb/callback?code=...&state=...
   Worker exchanges code, fetches { id, name, picture, profile_url }, upserts
   a provisional resident row (no identity_hash yet, fb_user_id set), sets a
   24h session JWT cookie, 302s to /verify-me#claim.

4. /verify-me page renders the claim form pre-filled with FB name in the
   read-only header strip:
   ┌────────────────────────────────────────┐
   │ Signed in as John Smith                │
   │ Claim your Marblehead address:         │
   │   [Street typeahead from 667 streets]  │
   │   [House #]                            │
   │   [ Claim ]                            │
   └────────────────────────────────────────┘

5. Submit. Browser POSTs { claimed_address } to /api/claim/address.
   Worker normalizes, looks up parcel_owners, runs match algorithm.

6. Branch on response:

   match:
     ┌────────────────────────────────────────┐
     │ ✓ You're verified                      │
     │   Welcome, verified resident at        │
     │   12 State Street.                     │
     │   (Your name is shown as 'verified     │
     │   resident' by default. You can opt    │
     │   in on your profile.)                 │
     │   [Add a passkey for faster sign-in]   │
     │   [Skip — continue to profile]         │
     └────────────────────────────────────────┘

   first_initial_mismatch:
     ┌──────────────────────────────────────────────────┐
     │ 12 State St is on record for the SMITH household │
     │ but the named owner is JOHN. Are you a household │
     │ member?                                          │
     │  [Yes — ask Jane Smith (JOHN) to vouch for me]   │
     │  [I typed the wrong address]                     │
     └──────────────────────────────────────────────────┘
     "Yes" pre-fills the vouch flow with the requester's name and address
     and pins JOHN SMITH as the verifier-reference name. The request lands
     in the existing verifier dashboard for any opted-in verifier (default
     Andrew); the verifier sees the assessor signal as 'name_mismatch
     within household' and confirms via FB DM. NB: the alternatives list
     surfaces the assessor first-name tokens (JOHN), not full owner strings,
     to keep PII exposure minimal.

   name_mismatch:
     ┌─────────────────────────────────────────────────┐
     │ 12 State St is in our records but listed under  │
     │ a different name. If you rent, recently bought, │
     │ or your name isn't on the deed:                 │
     │  [Request a vouch from a verifier]              │
     │  [I typed the wrong address]                    │
     └─────────────────────────────────────────────────┘

   no_match:
     ┌─────────────────────────────────────────────────┐
     │ We don't have that address. Recheck the         │
     │ spelling, or [Request a vouch].                 │
     └─────────────────────────────────────────────────┘

7. On a successful match path, the resident lands on /profile (with the
   optional passkey-add prompt inline). On vouch paths, they land on a
   status page that tells them a verifier will FB-DM them shortly.
```

### B. Return-visit sign-in

A header button "Sign in" opens a small menu:

```
┌────────────────────────────────────────┐
│ [Continue with Facebook]               │
│ [Use my passkey]                       │
│ [I have an invite link]                │
└────────────────────────────────────────┘
```

FB and passkey both resolve to the same session JWT and the same `/profile`.

### C. The profile page

```
┌────────────────────────────────────────────────────────┐
│ Profile                                                │
│                                                        │
│ Andrew Baber  (signed in via Facebook + passkey)       │
│ ✓ Verified resident at 12 State Street                 │
│   Verified by: matched to assessor record              │
│                                                        │
│ Identity                                               │
│  Display name:       Andrew Baber                      │
│                                            [Edit]      │
│  Public on the site: OFF                               │
│  └ When off, you appear as "verified resident"         │
│    everywhere. You can override per back/rep action.   │
│                                            [Turn on]   │
│                                                        │
│  Sign-in methods:                                      │
│   · Facebook       [Sign out of Facebook]              │
│   · Passkey        [Manage]                            │
│                                                        │
│ Ideas you back (4)                                     │
│  · #06 Retiree benefits                                │
│  · #11 Trash fee model                                 │
│  · #14 Free cash discipline                            │
│  · #18 Capital project triage                          │
│                                            [Manage]    │
│                                                        │
│ You're a rep for (1)                                   │
│  · #06 Retiree benefits                                │
│                                                        │
│ Civic role                                             │
│  [Become a verifier — help new neighbors join]         │
│                                                        │
│ Danger zone                                            │
│  [Release this claim and sign out]                     │
└────────────────────────────────────────────────────────┘
```

Verification-source line varies:

- `matched to assessor record` — self-serve match
- `vouched by Andrew Baber` (named) — invite-handshake or self-serve-vouch with the verifier's display name
- `vouched (anonymous verifier)` — invite-handshake where the inviter has `public_identity=0` (treated as anonymous even on the verifiee's own profile, for inviter privacy)

Claimed address is only visible to the user on their own profile. It does not appear in any public listing, in any API response to another user, or in the verified tally.

### D. Vouch path (unchanged from June 9 except the entry point)

Self-serve fallback flows route into the same verifier dashboard the June 9 spec described. The Worker pre-fills `verification_request` with the requester's FB profile data and computed assessor signal. The verifier UI surfaces the assessor badge — `match`, `first_initial_mismatch (alternatives=['JOHN'])`, `name_mismatch`, `no_match` — as a hint, not as a gate. Verifier confirms identity via FB DM out-of-band and approves or declines.

### E. Engagement on what-can-we-do.html (unchanged from June 9)

The "Verify to back this idea" CTA on a non-verified visitor opens `/verify-me.html?return=/what-can-we-do.html#idea-06` (or, on mobile, an inline modal that runs the same flow). On return, the visitor lands back at the idea card with the back/rep modal already open and ready to confirm.

Per-action `show_name` toggle:

```
┌────────────────────────────────────────┐
│ Back this idea                         │
│ #06: Switch retiree health coverage    │
│      from the GIC to Group Medicare    │
│      Advantage                         │
│                                        │
│ [ ] Show my name on this idea publicly │
│                                        │
│ [ ] I'll talk to others about this     │
│     (become a rep — name will be       │
│     shown publicly for this idea)      │
│                                        │
│ [ Save ]  [ Cancel ]                   │
└────────────────────────────────────────┘
```

Default values come from `residents.public_identity` (acts as the default for `show_name`) and the engagement-row state for repeat clicks.

## Parcel data ingestion at deploy time

The `parcel_owners` table is rebuilt at deploy time, not at runtime. The community-pulse Worker repo gains a `scripts/sync_parcel_owners.mjs` that reads the gitignored `data/parcels_raw/parcels_full.csv` from the marbleheaddata.org repo (path provided via an environment variable in the deploy pipeline), normalizes addresses, and writes to D1 via the wrangler API.

Specifics:

- The sync script runs as a `wrangler deploy` post-step or as a separate command, gated on the operator having the raw CSV present locally.
- The raw CSV stays gitignored; only its parsed-and-normalized form lands in D1, and only after manual operator action. There is no GitHub Actions step that reads the raw CSV.
- On each sync, the script `TRUNCATE`s and reinserts. The dataset is small enough (~8,800 rows × a few hundred bytes) that full replacement is simpler than incremental upserts and avoids stale-row bugs.
- The de-identified `data/parcels.csv` on the site repo is unrelated to this sync — it remains the public dataset.

## Facebook OAuth specifics

- **App configuration:** A Facebook developer app named "Marblehead Data" registered to Andrew's FB developer account.
- **Scopes at launch:** `public_profile` only. This returns `id`, `name`, `picture`, `profile_url` without any app review.
- **`user_friends` is explicitly NOT requested at launch.** The June 9 spec keeps that scope as a future enhancement, gated on FB app review. Until then, no mutual-friends signal in the verifier dashboard. The `fb_friendship` table is deferred to a follow-up spec.
- **Privacy policy + Terms URL:** FB app review requires public URLs for both. New static pages `privacy.html` and `terms.html` are part of this spec's scope.
- **App secret:** Stored as a Cloudflare Worker secret via `wrangler secret put FB_APP_SECRET`. Never in `wrangler.toml`.
- **State CSRF:** The OAuth `state` parameter is a 32-byte random value stored in an HttpOnly cookie and verified on callback.
- **What we store:** `fb_user_id` (long, stable), `fb_profile_url`, and the user's FB display name (copied into `residents.display_name` only when `public_identity=1` or when the user is creating a verifier-optin). The FB access token is not stored beyond the immediate callback handler — we use it to fetch `me` and then discard.
- **FB-DM as the verifier handoff channel:** The verifier-dashboard "Open in Messenger" link uses `fb_profile_url` and opens the requester's FB profile in a new tab; the verifier sends a DM from there. We do not request `pages_messaging` or any DM-sending scope.

## Privacy properties

- Owner names are PII; they live only in `parcel_owners` in D1 and are never returned via any GET endpoint. The only place they touch a response body is the `alternatives` list returned from `/api/claim/address` to the authenticated requester whose surname matched — and even then, only the given-name tokens (not full owner strings or co-owner lists).
- Each user's own claimed address is visible only to themselves on their own profile. It is not returned in the public verified tally, the engagement endpoints, or to other authenticated users.
- Public engagement listings show only the names of residents who opted in for that specific action. Default for everyone, self-serve and invite-vouched alike, is anonymous.
- FB-supplied profile URLs are stored but never appear in a public listing. They surface only inside the verifier dashboard, for the verifier handling that user's vouch request.
- The Worker logs no PII. Standard request logging captures method, path, and status; no body content.

## Abuse resistance

- **Fake Facebook accounts:** FB has its own real-name policy and integrity systems. A new account with no friends and no posts will look suspicious to a human verifier on the fallback path. On the self-serve match path, the assessor record already constrains who can pass — you have to find a named owner on the assessor list who shares your FB name's first initial + last name. That is a small attack surface.
- **Address typos:** Autocomplete from the canonical street list reduces typos to a minimum. On a normalized miss, the user gets a clear "did you mean…" suggestion or routes to vouching.
- **Multiple claims per FB account:** Hard-prevented. `residents.fb_user_id` is unique-indexed; the second `/api/claim/address` POST from the same FB account fails at write time if the first one succeeded.
- **Claim spam (cycling through addresses):** Rate-limited at `/api/claim/address`: 5 attempts per FB account per 24h, 20 per IP per 24h. Beyond the limit, the only path is the vouch fallback.
- **Trust/LLC abuse:** Match algorithm rejects all trust and entity markers; those records can only be reached via the vouch path.
- **Compromised FB account:** Standard FB account-recovery applies. From the site's perspective, a hostile FB account holder can change `display_name`, toggle `public_identity`, and back/unback ideas — but cannot view the original holder's claimed address or any other claimed address. Cascade revocation (existing privileged endpoint) lets Andrew revoke a compromised account out-of-band.
- **Vouch-path abuse:** Inherits the June 9 spec's defenses — rate limiting per IP, manual approval, FB-real-account requirement, assessor cross-check as a hint, plaintext purge after 30 days.

## Costs

- Facebook Login: free.
- D1 storage for `parcel_owners` (~8,800 rows): negligible.
- Worker compute increase: minimal. The FB callback and claim endpoints are low-frequency.
- No new third-party vendors beyond Facebook.

## Implementation phasing

The spec lands as one design but the implementation plan should phase it. The first three phases must all ship together for the feature to be usable; the rest can ship serially.

1. **Phase 1 (must ship before anything visible):**
   - Schema migrations on residents and the four new tables.
   - `parcel_owners` ingestion script and one-time sync.
   - `/api/auth/fb/start` and `/api/auth/fb/callback` + FB app registration + privacy/terms pages.
   - `/api/claim/address` with match algorithm + tests.
   - `/verify-me.html` with the two-door landing + claim form + result branching.
   - `/profile` GET endpoint and minimal profile page (identity, sign-out).

2. **Phase 2 (engagement layer):**
   - `/api/engagement/:idea_id` endpoints.
   - Idea-card widget JS (counts strip + "who's behind this" panel + modal).
   - Profile page additions: backed-ideas list, reps list.

3. **Phase 3 (verifier surface for the vouch fallback):**
   - `/api/verifiers`, `/api/verifiers/optin` endpoints.
   - `/api/verify/request`, `/api/verify/requests/*` endpoints (June 9 spec).
   - Verifier dashboard UI in `verify.html`.
   - First-initial-mismatch and name-mismatch routing from `/verify-me.html` into the vouch flow.

4. **Phase 4 (polish + nice-to-haves):**
   - Passkey link from the profile page (the endpoint exists; the UI does not).
   - Verifier opt-in toggle on the profile page.
   - Privacy policy and terms page copy polish.
   - Soft-release flow (DELETE /api/claim) and confirmation modal.

`engagement_widget: on|off` config flag (per the June 9 spec) ships in Phase 2 as a kill switch.

## Testing strategy

- **Unit tests on the match algorithm:** the case table in the "Match algorithm" section becomes the test fixture. Adds a separate fixture for address normalization round-trips.
- **Worker integration tests:** vitest against a local miniflare D1, exercising `/api/auth/fb/callback` with a stubbed FB token-exchange, `/api/claim/address` against a seeded `parcel_owners`, `/api/engagement/*` round-trips.
- **Playwright smoke (`tests/smoke-test.mjs`):** new tests for `/verify-me.html` (page loads, FB CTA visible), `/profile` (redirects to verify-me when not signed in), and the engagement widget on `what-can-we-do.html` (counts strip visible on a card with seeded engagement).
- **Manual:** FB OAuth round-trip against the test FB app, claim with a seeded `parcel_owners` entry matching Andrew's name + address.

## What is deferred to future specs

- `user_friends` scope and mutual-friends signal in the verifier dashboard. Pending FB app review.
- Town Meeting warrant article voting on the engagement table (v2 per June 9, ahead of Feb 2027 ATM).
- Curated yes/no/abstain polls on operational questions (v3 per June 9).
- User-generated ideas on `what-can-we-do.html`.
- On-site rep coordination tooling (petition signing, per-idea threads, verified-only inbox).
- Branch-level breakdowns per idea.
- Email or push notifications for verification status changes.
- Recovery flow that lets a resident move from self-serve to invite-vouched (or vice versa) without losing engagement history. Phase 1 supports moving in one direction by virtue of the shared `identity_hash`; the UX is deferred.
