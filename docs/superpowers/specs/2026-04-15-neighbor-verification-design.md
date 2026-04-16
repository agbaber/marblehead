# Neighbor Verification Network: Design

**Date:** 2026-04-15
**Scope:** A trust-graph identity layer for verified Marblehead residents, built on the existing community-pulse Cloudflare Worker and D1 database. Unlocks a deduplicated verified tally alongside the existing anonymous reactions.
**Status:** Draft for user review.
**Depends on:** Community Pulse v1 (shipped).

## Problem

The community pulse anonymous reactions are a useful engagement signal but carry no identity guarantee. A single person can inflate counts from multiple browsers. The directionless design makes this mostly harmless for reactions, but ballot-question picks (`/api/votes`) are directional — and IP-based deduplication is a weak proxy for "one household, one voice."

Meanwhile, the original community pulse spec deferred a full civic polling layer (postcard verification via Lob, Stripe-backed challenge fees, credential tables). That was the right call — it was a multi-month build betting on engagement before evidence existed.

This design threads the gap with a lighter approach that fits Marblehead's actual social fabric: **neighbor vouching with street-address identity and passkey auth.** No postcards (everyone in town is seven degrees of Baber). No Stripe. No email. Just addresses, invite links, and the trust graph that already exists offline.

## Goals

- Let verified Marblehead residents cast deduplicated, one-per-adult votes on ballot questions and section stances.
- Show a verified tally alongside (not replacing) the existing anonymous reactions.
- Build the trust graph organically through invite links — each verified resident vouches for neighbors by sharing one-time-use links.
- Use passkeys for cross-device auth so verification survives browser changes.
- Show branch-level aggregate results publicly (size, vote mix) without revealing individual picks.
- Let branches name themselves via internal vote.
- Preserve the site's neutrality: no individual attribution, no branch-founder identity, no mechanisms that create social pressure before someone has formed their own opinion.

## Non-goals

- Postcard verification, Lob integration, or any physical-mail ceremony.
- Email collection, accounts, passwords, or password reset flows.
- Stripe integration or any payment/challenge-fee mechanism.
- Individual-level public attribution of picks.
- Cross-device sync of anonymous community pulse data (notes, stances). Verification is a separate identity layer.
- Replacing or deprecating the existing anonymous reactions. They remain as-is.

## Product overview

**Registration (one-time, via invite link only — two-sided handshake):**

There is no open registration. Every resident — including the first — enters the system through an invite link. The genesis invite is a one-time token seeded directly in the database before launch; from that point forward, it's invites all the way down.

**Inviter side (creating the invite):**

1. Inviter clicks "Invite a neighbor" in their verified dashboard.
2. Inviter enters the recipient's name and street address.
3. The client hashes both fields locally: `hash(name + address + salt)`.
4. The hash is sent to `POST /api/verify/invite` along with the inviter's session JWT.
5. The server stores the hash with a new one-time invite token and returns the invite link.
6. The inviter shares the link with their neighbor (text, in person, email — any channel).

**Recipient side (redeeming the invite):**

1. Recipient opens the invite link.
2. Recipient enters their own name and street address.
3. The client hashes both fields locally with the same algorithm.
4. The hash is sent to `POST /api/verify/register` along with the invite token.
5. **The server compares the recipient's hash against the hash the inviter stored.** Match = proceed. Mismatch = invite fails ("this invite wasn't created for this name/address").
6. On match, the server creates the resident record and returns a WebAuthn challenge.
7. The browser prompts to create a passkey for marbleheaddata.org.
8. The resident receives 3 one-time invite links of their own.

This two-sided handshake means both parties must independently agree on the same name + address. The inviter can't create a phantom resident; the recipient can't hijack someone else's invite. A leaked link is useless without knowing exactly what the inviter typed. No plain-text PII ever reaches the server — it only sees and compares hashes.

**Invite delivery (share prompt):**

After the inviter enters the neighbor's name + address and the invite is created, the UI prompts immediate delivery:

*Mobile (`navigator.share` available):*

1. Modal appears: "Invite created for Jane Smith. Send it now?"
2. Big "Send invite" button triggers `navigator.share()` with:
   - **text:** "I'm a verified Marblehead resident on marbleheaddata.org — here's your invite to join"
   - **url:** the one-time invite link
3. Native share sheet opens — iMessage is typically first on iOS (likely 80%+ of Marblehead). WhatsApp, email, and other installed apps are all available.
4. If they dismiss without sharing: "Link copied to clipboard" fallback + "You can find your pending invites in your dashboard anytime."

*Desktop (no `navigator.share`):*

1. Same modal, but with two buttons: "Copy link" and "Copy message + link" (the pre-written message plus the URL, ready to paste into email/text/Slack/whatever).
2. Link remains accessible in the inviter's dashboard under "Pending invites."

The pre-written share message is the default but editable by the OS share sheet. The inviter can reword it before sending. The invite link is the only required part — the message is a convenience.

**Bonus invites:** When a resident's "grandchild count" (people invited by their invitees) reaches 3, they earn 3 additional invite links. Checked lazily on each new registration that affects the grandparent's subtree.

**Voting (ongoing, after verification):**

1. On any page with community pulse widgets, a verified resident sees a "Verified resident" indicator and can cast a verified vote (separate from anonymous reactions).
2. Verified votes are deduplicated by identity hash — one vote per adult per question, server-side enforced.
3. Changing a verified vote updates the tally (no double-counting, no history of changes exposed).

**Branch visibility (public):**

1. Every branch (the tree rooted at a seed resident's direct invitees) is displayed publicly with: branch name, member count, and aggregate vote mix per question.
2. Individual picks are never shown publicly.
3. Branch names are chosen by branch members via internal vote — most popular name at any given moment wins. Names can change.
4. Minimum branch size to show vote breakdown: 5 verified residents. Below that, the branch shows only "N verified residents — voted" with no mix.

**Cross-device (passkey):**

1. On a new device, "Sign in as verified resident" triggers a passkey prompt.
2. The passkey resolves to the identity hash, restoring verified status.
3. No email, no password, no recovery flow beyond the passkey ecosystem (iCloud Keychain, Google Password Manager, etc.).

## Design

### 1. Identity: name + street address

A resident's identity is their name combined with their street address, hashed with a deployment salt. Neither the plain-text name nor address is stored server-side.

```
identity_hash = SHA-256(normalize(name) || ":" || normalize(street_address) || ":marblehead-verify-salt")
```

**Normalization via address autocomplete:** Both the inviter and recipient address fields use an address autocomplete (Google Places API or a static lookup against Marblehead assessor/voter data). When the user starts typing, the field suggests canonical addresses. Selecting a suggestion fills the field with a normalized form — same casing, same abbreviations, same formatting every time. This eliminates the "123 Elm St" vs "123 elm street" mismatch problem: both sides pick from the same canonical list, so the hashes always match.

Fallback if autocomplete isn't available: lowercase, collapse whitespace, strip trailing punctuation, normalize common abbreviations (St/Street, Ave/Avenue, etc.). But the autocomplete path is strongly preferred because it guarantees hash agreement without relying on users typing identically.

**One hash = one adult.** Two adults at the same address are two verified residents with two separate votes. The address proves Marblehead residency; the name distinguishes individuals within a household. A couple who disagree on Q1 both get a voice.

**The name and address are entered once at registration.** Both are hashed client-side before transmission, so the server never sees plain-text PII. The combined hash is stored in the `residents` table and used as the primary key for all verified operations.

### 2. Invite tree

Each verified resident gets 3 one-time invite tokens. Each token is a random 128-bit value, URL-safe base64 encoded.

```
Invite URL: https://marbleheaddata.org/verify#invite=<token>
```

When a token is used (a new resident registers with it), the token is marked as consumed. Reusing a consumed token returns an error.

**Bonus invites:** When a resident's "grandchild count" (residents invited by their direct invitees) reaches 3, they receive 3 additional invite tokens. This is checked and granted lazily on each new registration that affects the grandparent's subtree.

**Invite tree structure:**

```
Seed (Andrew)
├── Invitee A (3 invites)
│   ├── A's invitee 1  ← grandchild of Seed
│   ├── A's invitee 2  ← grandchild of Seed
│   └── A's invitee 3  ← grandchild of Seed (→ Seed earns +3 invites)
├── Invitee B (3 invites)
│   └── B's invitee 1  ← grandchild of Seed
└── Invitee C (3 invites)
```

### 3. Branches

A **branch** is the subtree rooted at each direct invitee of a seed resident. In the example above, Invitee A and their downstream invitees form one branch; Invitee B and theirs form another.

Branches are the public unit of identity. The site displays:

- Branch name (voted on by members)
- Member count
- Aggregate vote mix per question (only if branch size ≥ 5)

**Branch naming:** Any branch member can propose a name (free text, max 30 characters, no profanity filter in v1 — the social graph self-moderates because every member was personally invited). Each member can vote for one name. The name with the most votes at any given moment is the current branch name. Ties are broken by earliest proposal. Names update in real time as votes shift.

### 4. Passkey authentication

WebAuthn/passkeys are used for cross-device authentication. The flow:

**Registration (during invite redemption):**

1. Resident enters their name and street address.
2. Client hashes both fields locally, sends identity hash + invite token to `POST /api/verify/register`.
3. Server compares hash against the inviter's stored recipient hash (two-sided handshake). On match, creates resident record and returns a WebAuthn challenge.
4. Browser prompts passkey creation ("Create a passkey for marbleheaddata.org?").
5. Client sends the attestation back to `POST /api/verify/passkey/register`.
6. Server stores the credential ID and public key, associated with the identity hash.

**Authentication (return visit or new device):**

1. Resident clicks "Sign in as verified resident."
2. Client calls `POST /api/verify/passkey/auth-challenge`.
3. Server returns a WebAuthn challenge (allowCredentials includes all registered credential IDs — since we don't know which resident is authenticating, this is a resident-side discoverable credential flow).
4. Browser prompts passkey (Face ID / fingerprint / PIN).
5. Client sends the assertion to `POST /api/verify/passkey/auth`.
6. Server verifies the signature, looks up the credential → identity hash, returns a short-lived session token (JWT, 24h expiry, stored in memory/sessionStorage, not localStorage).

**Why passkeys and not a simpler token-in-localStorage approach:** localStorage tokens don't cross devices. The whole point of verification is that your identity persists — "I'm a verified resident" should work on your phone and your laptop without re-inviting yourself. Passkeys solve this natively via the platform's credential sync (iCloud Keychain, Google Password Manager).

**Cross-device sync behavior:**

*Same ecosystem (automatic, invisible):*
- iPhone → Mac/iPad: iCloud Keychain syncs passkeys in seconds. No action needed.
- Android → Chrome on any OS: Google Password Manager syncs automatically.
- Windows → Windows: Microsoft Hello syncs via Microsoft account.

iPhone + Mac is the dominant combo for Marblehead. This just works.

*Cross ecosystem (QR code bridge):*
- iPhone → Windows PC, or Android → Mac: the desktop browser shows a QR code. The user scans it with their phone and authenticates via Face ID / fingerprint. The phone acts as the authenticator. This is the FIDO2 "hybrid transport" spec — every major browser supports it. One extra step, but it works.

**Passkey loss recovery (new phone, switched ecosystems, no cloud restore):**

Four recovery paths, in order of preference:

1. **Proactive: register multiple passkeys.** The verified dashboard has an "Add this device" button that creates a second passkey tied to the same identity hash. Residents should do this on each device they use. This is the happy path — no recovery needed because redundant credentials already exist.
2. **Recovery key at registration.** At the end of the registration flow, the system generates a one-time recovery code (a random 128-bit value, displayed as a human-readable string like `MBLHD-XXXX-XXXX-XXXX`). The resident is prompted: "Write this down or screenshot it. If you lose access to all your devices, this code lets you re-register." The recovery key is stored server-side as a hash (same as a password — never in plain text). Using it lets the resident register a new passkey against their existing identity. One-time use: once redeemed, a new recovery key is issued.
3. **Inviter-initiated recovery.** The person who invited you can issue a one-time recovery token from their dashboard. The token lets you re-register a new passkey against your existing identity hash. No invite is consumed — it's a passkey reset, not a new registration. The inviter is re-vouching for you.
4. **Site operator recovery.** Andrew can issue a recovery token directly via a privileged endpoint. Backstop for edge cases where the inviter is also locked out or unreachable.

### 5. Verified tally

The verified tally is a separate count from anonymous reactions. On pages with community pulse widgets, verified residents see both:

```
47 reactions  ·  12 verified residents (3 branches)
```

On ballot questions (index.html picks), the verified tally shows:

```
Anonymous:  A: 45  B: 32  C: 18  Not sure: 12
Verified:   A: 8   B: 5   C: 2   Not sure: 1  (16 residents across 4 branches)
```

**Deduplication:** Verified votes are keyed by `(identity_hash, topic)` or `(identity_hash, section_id)`. One vote per adult per question. Changing your vote updates the row; the tally always reflects current state, not cumulative.

**Stricter rules vs. anonymous:**

- One vote per identity hash per question (server-enforced, not IP-based).
- No clearing and re-voting from a different browser — the passkey resolves to the same identity hash.
- Vote changes are allowed but the tally only ever counts each adult once.

### 6. Cascade revocation

If a resident is challenged and removed, every resident they invited (and their invitees, recursively) loses verified status. This is the anti-abuse mechanism.

**v1 challenge mechanism:** Manual. Andrew (as site operator) can revoke any resident via a privileged endpoint. Revocation cascades automatically through the invite tree. This is sufficient for a small-town network where abuse is socially visible.

**Future:** A community-driven challenge mechanism where any verified resident can challenge another, with some cost (reputation, invite count) to prevent frivolous challenges. Deferred because the manual approach works at the expected scale.

### 7. Network visibility: show after you pick

To prevent anchoring (seeing how your branch voted before you've decided), branch vote breakdowns are only visible to a resident **after they've cast their own verified vote** on that question.

Before voting: "12 verified residents across 3 branches have weighed in."
After voting: Full branch-by-branch breakdown appears.

This turns the reveal into a "compare notes" moment rather than a "follow the leader" signal.

## Data model

New tables added to the existing D1 database alongside `reactions` and `rate_limits`:

```sql
-- Verified residents. One row per adult.
CREATE TABLE residents (
  identity_hash TEXT PRIMARY KEY,
  invited_by TEXT REFERENCES residents(identity_hash),
  branch_root TEXT,  -- identity_hash of the branch founder (direct invitee of seed)
  created_at INTEGER NOT NULL,
  revoked_at INTEGER  -- NULL if active, timestamp if cascade-revoked
);

-- Passkey credentials. Multiple per resident (one per device).
CREATE TABLE passkey_credentials (
  credential_id TEXT PRIMARY KEY,
  identity_hash TEXT NOT NULL REFERENCES residents(identity_hash),
  public_key TEXT NOT NULL,  -- base64-encoded
  sign_count INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

-- One-time invite tokens. Stores the inviter's hash of the recipient
-- for the two-sided handshake (recipient must produce a matching hash).
CREATE TABLE invites (
  token TEXT PRIMARY KEY,
  created_by TEXT NOT NULL REFERENCES residents(identity_hash),
  recipient_hash TEXT NOT NULL,  -- hash(name + address) entered by inviter
  consumed_by TEXT REFERENCES residents(identity_hash),  -- NULL if unused
  created_at INTEGER NOT NULL,
  consumed_at INTEGER
);

-- Recovery keys. One active key per resident, hashed (never plain text).
CREATE TABLE recovery_keys (
  identity_hash TEXT PRIMARY KEY REFERENCES residents(identity_hash),
  key_hash TEXT NOT NULL,  -- SHA-256 of the recovery key
  created_at INTEGER NOT NULL
);

-- Verified votes. One per adult per topic/section.
CREATE TABLE verified_votes (
  identity_hash TEXT NOT NULL REFERENCES residents(identity_hash),
  topic TEXT NOT NULL,  -- e.g., "override", "trash", or a section_id
  answer TEXT NOT NULL,  -- 'a','b','c','u' for ballot; 'agree','disagree','alert' for sections
  voted_at INTEGER NOT NULL,
  PRIMARY KEY (identity_hash, topic)
);

-- Branch name proposals and votes.
CREATE TABLE branch_names (
  branch_root TEXT NOT NULL,
  proposed_name TEXT NOT NULL,
  proposed_by TEXT NOT NULL REFERENCES residents(identity_hash),
  proposed_at INTEGER NOT NULL,
  PRIMARY KEY (branch_root, proposed_name)
);

CREATE TABLE branch_name_votes (
  identity_hash TEXT NOT NULL REFERENCES residents(identity_hash),
  branch_root TEXT NOT NULL,
  voted_name TEXT NOT NULL,
  voted_at INTEGER NOT NULL,
  PRIMARY KEY (identity_hash, branch_root)
);
```

The existing `reactions`, `rate_limits`, and `votes` tables are untouched. Anonymous and verified systems coexist.

## API endpoints

New endpoints on the existing community-pulse worker, all under `/api/verify/`:

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/verify/register` | Invite token | Register with identity hash + invite token. Server compares against inviter's recipient hash. Returns WebAuthn challenge on match. |
| POST | `/api/verify/passkey/register` | Mid-registration | Complete passkey registration with attestation. |
| POST | `/api/verify/passkey/auth-challenge` | None | Request a WebAuthn authentication challenge. |
| POST | `/api/verify/passkey/auth` | None | Authenticate with passkey assertion. Returns session JWT. |
| GET | `/api/verify/me` | Session JWT | Return resident status, branch, invite count, available invites. |
| POST | `/api/verify/invite` | Session JWT | Create an invite for a specific neighbor. Body: `{ recipient_hash }`. Stores hash with a new token. Returns the invite link. |
| POST | `/api/verify/vote` | Session JWT | Cast or update a verified vote. Body: `{ topic, answer }`. |
| GET | `/api/verify/branches` | None | Public. Returns all branches with names, sizes, and aggregate vote mixes (respects min-size rule). |
| GET | `/api/verify/branches/:root/votes?topic=X` | Session JWT | Returns branch breakdown for a topic. Only returns data if the requesting resident has voted on that topic. |
| POST | `/api/verify/branch-name/propose` | Session JWT | Propose a name for your branch. |
| POST | `/api/verify/branch-name/vote` | Session JWT | Vote for a branch name. |
| POST | `/api/verify/passkey/add-device` | Session JWT | Register an additional passkey for the current resident (multi-device). |
| POST | `/api/verify/recovery/create` | Session JWT | Inviter creates a recovery token for one of their invitees. |
| POST | `/api/verify/recovery/redeem` | Recovery token | Re-register a new passkey against an existing identity hash. Issues a new recovery key. |
| POST | `/api/verify/recovery/use-key` | Recovery key | Redeem the recovery key issued at registration. Re-register passkey, issue new recovery key. |
| POST | `/api/verify/revoke` | Privileged (seed only) | Revoke a resident. Cascades to all downstream invitees. |

**Session JWT:** Short-lived (24h), signed with a worker-level secret. Contains `{ identity_hash, branch_root, exp }`. Stored in sessionStorage on the client. Passkey re-auth refreshes it.

## Front-end changes

### Verification entry points

- **Invite link landing:** `/verify.html` — a new page. Detects `#invite=<token>` in the URL. Walks through: enter street address → create passkey → welcome screen showing branch and invite links.
- **Return sign-in:** A small "Verified resident" button in the site header (next to existing nav). Triggers passkey auth. On success, the header shows a green checkmark and the resident's branch name.

### Widget changes

When a resident is authenticated:

- Community pulse widgets show a second row: the verified tally alongside anonymous reactions.
- Ballot question picks show both anonymous and verified breakdowns.
- Branch breakdown appears after the resident has voted on that question.

When not authenticated, the verified tally shows as a single number: "N verified residents have weighed in" — no breakdown, no branch detail.

### Branch page

`/branches.html` — a new page listing all branches publicly:

```
🌳 The Harbor Rats (12 residents)
🌳 Pleasant Street Posse (8 residents)
🌳 Branch C (3 residents) — naming in progress
```

Each branch links to its aggregate vote profile (only topics where the branch has ≥5 members show the mix). Branch name vote UI is accessible to branch members when authenticated.

## Abuse resistance

**Duplicate registrations:** The identity hash (name + address) is the primary key. Same person at the same address can't register twice. Two different adults at the same address are two distinct identity hashes — both valid.

**Fake addresses:** The invite tree is the defense. You can only register with a one-time invite link given to you by someone who knows you. If you register with a fake address, your inviter's reputation is on the line (cascade revocation reaches them). Social pressure in a small town does the rest.

**Bot registration:** Each invite token is one-time-use, created by a verified human. There is no open registration endpoint. A bot would need to compromise a real resident's invite links — and each resident only has 3-6.

**Passkey theft:** Passkeys are hardware-bound or platform-bound. Stealing one requires device access. Standard WebAuthn security model applies.

**Branch name trolling:** Any branch member can propose and vote on names. With 3+ people in each branch who all know each other personally, troll names get outvoted. If needed, seed operator can override (manual, deferred).

## Privacy properties

**What the server stores:**
- A SHA-256 hash of each verified resident's name + street address (not the plain-text name or address).
- The invite tree structure (who invited whom, by identity hash).
- Passkey credential IDs and public keys.
- Verified votes keyed by identity hash.
- Branch name proposals and votes.

**What the server does NOT store:**
- Plain-text street addresses.
- Names, emails, phone numbers, or any PII beyond the identity hash.
- Anonymous community pulse stances or notes (unchanged from v1).
- IP addresses of verified residents (the session JWT replaces IP-based identity).

**What is publicly visible:**
- Branch names, sizes, and aggregate vote mixes (≥5 members only).
- Total verified resident count.
- Nothing about individual residents, their addresses, or their individual votes.

## Costs

- Passkey/WebAuthn: free (browser-native API, no vendor).
- D1 storage: negligible increase (hundreds of rows, not millions).
- Worker compute: minimal increase for auth endpoints.
- No Lob, no Stripe, no third-party vendors.

**Total additional cost: $0.**

## Implementation phasing

1. **Schema migration** — add the 7 new tables to D1 (residents, passkey_credentials, invites, recovery_keys, verified_votes, branch_names, branch_name_votes).
2. **Registration + invite endpoints** — `/api/verify/register`, token generation, invite redemption. Test with CLI/curl.
3. **Passkey endpoints** — WebAuthn registration and authentication. Requires a WebAuthn library compatible with Cloudflare Workers (e.g., `@simplewebauthn/server`).
4. **Verified vote endpoint** — `POST /api/verify/vote`, deduplication logic, tally queries.
5. **Branch endpoints** — branch listing, aggregate tallies, min-size filtering.
6. **Branch naming** — propose/vote endpoints, real-time name resolution.
7. **`/verify.html` front-end** — invite landing page, address entry, passkey creation flow.
8. **Widget integration** — verified tally display alongside anonymous reactions, "show after you pick" gating.
9. **`/branches.html` front-end** — public branch listing page.
10. **Cascade revocation** — privileged revoke endpoint, recursive downstream revocation.
11. **Seed bootstrap** — Insert a genesis invite token directly in D1. Andrew uses it like any other invite link. No special registration path.

## Branch creation requests

New branches originate from new seed invites. Since every branch traces back to a genesis invite, someone who wants to start their own branch (rather than joining an existing one) needs a seed-level invite from the site operator.

**v1 flow (manual vetting):**

1. Resident visits `/verify.html` without an invite link.
2. The page shows: "Know someone who's verified? Ask them for an invite link. Want to start a new branch? Request one." with a link to a GitHub issue template.
3. The GitHub issue template asks for: name, street address (used only for vetting, not stored in the issue), and why they want to start a branch (e.g., "I'm on Beacon St and nobody in my neighborhood is verified yet").
4. Andrew vets the request. First-pass check: cross-reference the name and address against the Marblehead assessor database (public, searchable by property owner) and/or the town voter registration list (covers renters). This confirms someone actually lives where they claim. Second-pass: "do I know this person, or do I know someone who knows them" — a mutual-acquaintance confirmation. In a town of 20k, one of these two checks almost always resolves it.
5. If approved, Andrew inserts a genesis invite token in D1 and sends the link to the requestor privately (email, text, in person).
6. The requestor uses the invite link like anyone else. They become the root of a new branch.

**Why manual:** At Marblehead scale, branch creation is a rare event (maybe a few per week at peak). The vetting cost is a 2-minute "do I recognize this name" check, not a bureaucratic process. Automating this would require either trusting self-attestation (gameable) or building an address-validation pipeline against town records (overengineered for the volume). The friction is a feature — it self-selects for people who actually care enough to ask.

**Future:** If the network grows large enough that manual vetting becomes a bottleneck, a "vouch for a new seed" mechanism could let N existing branch roots collectively approve a new seed. Deferred.

## What is deferred

- Community-driven challenge mechanism (any resident can challenge another). Manual revocation by seed operator is sufficient at launch scale.
- Profanity filter on branch names. Social graph self-moderates.
- Branch merge/split operations.
- Verified resident badge or flair on shared links.
- Export of verified vote data.
- Automated seed vetting (see "Branch creation requests" below for the manual v1 approach).
- Multiple autonomous seed residents without vetting.
