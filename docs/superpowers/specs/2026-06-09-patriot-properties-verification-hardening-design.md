# Patriot Properties ingestion + verification hardening

**Date:** 2026-06-09
**Owner:** Andrew Baber
**Status:** Draft (awaiting user review)

## Purpose

Today's Neighbor Verification Network (`community-pulse/worker/src/verify.js`, schema `0004_verification.sql`) accepts any name + free-form street as identity input — it only validates that the inviter and recipient independently produce the same `SHA-256(name+address+salt)` hash. Street autocomplete is OSM-derived; house numbers are never collected. The system has no link to authoritative Marblehead address data and no defense against one person spinning up many "verified residents" against the same address.

This spec hardens that path by:

1. **Ingesting** the Marblehead Patriot Properties database (`https://marblehead.patriotproperties.com/`) into the repo and into the worker's D1.
2. **Gating** verification on a real PP parcel + optional unit label.
3. **Capping** verifications per `(parcel, unit)` at 8 — soft cap, overage flagged for owner review, not blocked.
4. **Publishing** verified-population stats against multiple denominators (adults, registered voters, properties) on a dedicated stats page and as a homepage card.
5. **Adding** a self-attested "I'm a registered Marblehead voter" flag, surfaced in aggregate stats only.

## Non-goals

- **Owner-name authority.** PP `Owner1/2/3` is *not* checked against the verifying user's claimed name. PP serves only as an address registry and a cap-enforcement key. Renters and adult dependents must be able to verify.
- **Live-fetching from PP.** Worker never calls PP at runtime. All PP data is committed to the repo and loaded into D1 at deploy.
- **Per-unit data from PP.** PP exposes parcels, not units inside multi-unit buildings. The unit string is user-entered free text (e.g. "3B", "Rear"). Cap is enforced on the `(account_number, unit_label)` tuple; collisions catch themselves.
- **Per-precinct geographic stats.** PP exposes a neighborhood code (AM, OT, CL, …) which we use for the "geographic spread" stat. Mapping parcels to voting precincts is out of scope (would require GIS work).
- **Voter-roll verification.** Marblehead's town clerk does not publish the voter roll in a machine-readable form. The "registered voter" flag is self-attested; the system never validates it. Aggregate stat is labelled accordingly.
- **Public exposure of any individual's parcel or unit.** Verified records remain anonymous in all user-facing UI. Stored parcel/unit is visible only in the owner-side review queue.

## Editorial / privacy stance

- **Anonymity floor preserved.** Verified votes continue to appear as "N of M verified residents picked X." No address, neighborhood, or unit shown next to any individual vote.
- **Trust model shift acknowledged.** Today the worker stores an opaque `identity_hash` and knows nothing personal. After this change the worker also stores the chosen `account_number` and `unit_label`, which is effectively the address in cleartext (joinable against `parcels`). This is a real reduction in worker-side privacy, justified by the cap-enforcement need and acknowledged here so it's not silently introduced. JWT, request logs, and analytics remain unchanged.
- **Small-n suppression.** Any geographic or building-type breakdown displayed publicly suppresses cells with fewer than 5 verified residents. The neighborhood is listed but the count is hidden until the floor is met.
- **Stats are denominator-honest.** "X% of adults" uses ACS 2024 18+ population. "X% of registered voters" uses the most recent town clerk total. "X% of properties" uses the PP parcel count. All three labelled inline with their source.

## Architecture

### Repository layout additions

```
pull_parcels.mjs                                # repo-root scraper, peer of pull_meetings.mjs
data/parcels.json                               # scraped output, committed
data/parcels.json.example                       # 3-5 real parcels for PR review
data/PARCELS_README.md                          # how to re-run, refresh cadence, contact
community-pulse/worker/schema/0006_parcels.sql  # parcels table + residents column adds
community-pulse/worker/schema/0007_review.sql   # review_status / review_note columns
community-pulse/worker/scripts/load_parcels.mjs # one-shot loader: data/parcels.json → D1
community-pulse/worker/src/admin.js             # /admin/review.html + actions (shared-secret)
verified-stats.html                             # public stats page
assets/verified-stats.js                        # pulls /api/verify/stats and renders
```

`verify.html` and `assets/verify.js` (the client-side registration UI) are modified in place to swap the street typeahead for a two-step parcel + unit picker. The existing `assets/streets.json` is superseded by an autocomplete sourced from `parcels.json` (or from a `/api/verify/parcels?q=` endpoint, depending on bundle size — see "Open implementation questions").

### Data flow

```
PP web search form (POST SearchResults.asp per street)
    ↓  pull_parcels.mjs, run from owner's home IP
data/parcels.json  (committed to repo)
    ↓  load_parcels.mjs on deploy
D1 parcels table
    ↓  /api/verify/parcels?q=  +  /api/verify/register (POST)
verify.html (autocomplete + cap check + voter checkbox)
    ↓
D1 residents row gets account_number / unit_label / voter_self_attested / review_status
    ↓  if cap exceeded: review_status='flagged', email to owner
    ↓
/api/verify/stats (aggregates by neighborhood, building type, voter share)
    ↓
verified-stats.html (public) + homepage hero card
```

## 1. Data ingestion

### `pull_parcels.mjs`

A standalone Node script (Node 24, no external deps beyond what's in `package.json` already — uses native `fetch`, `node:fs`). Located at repo root, peer of `pull_meetings.mjs`. Run manually.

**Input:** `assets/streets.json` (the existing 667-street OSM list).

**Algorithm:**

```
for street in streets:
  body = SearchStreetName=<URL-encoded street>&SearchSubmitted=yes
  resp = POST https://marblehead.patriotproperties.com/SearchResults.asp body
  parse HTML table rows; for each row, extract:
    account_number, parcel_id, street_number, street_name,
    building_type, luc, luc_description, neighborhood,
    year_built (if present in row — else fetch from Summary.asp?AccountNumber=N),
    owners (Owner1, Owner2, Owner3 joined into array)
  derive estimated_units (see below)
  append to in-memory list
  sleep 1500ms
write data/parcels.json
```

**`estimated_units` derivation:**

| LUC range / building_type | Default `estimated_units` |
|---|---|
| `101` (ONE FAM), `103` (MOBIL HM), `124` (RECTORY), `130/131/132/140` (land) | 1 |
| `102` (CONDO — one parcel per unit) | 1 |
| `104` (2 FAMILY) | 2 |
| `105` (3 FAMILY) | 3 |
| `109` (MULT HS) | fetched from Summary.asp if parseable, else 6 |
| `111` (APT 4-8) | 8 |
| `112` (APT 9+UP) | 16 |
| `121-125` (BOARDING, FRAT, DORM, ASST LIVING) | 20 |
| all commercial / industrial / land LUCs | 0 (not residential, excluded from autocomplete) |

`estimated_units` is **never enforced as a hard ceiling** — it informs the review queue ("48 claimants on a building you estimated at 16 units → suspicious"). The actual cap is 8 per `(account_number, unit_label)` regardless.

**Politeness:**

- 1.5s delay between requests → ~17 min total for 667 streets.
- `User-Agent: marbleheaddata.org parcel sync (agbaber@gmail.com)`.
- Single sequential run, no parallelism.
- On HTTP 4xx/5xx: log, sleep 30s, retry once; if still failing, skip street and log.
- Designed to be re-run idempotently — output is a clean overwrite, not a merge.

**Where it runs:**

- **First run:** owner's home Mac on home wifi. Lowest-optics path. Output `data/parcels.json` is committed to a separate small PR after the script PR is merged.
- **Quarterly refresh:** either rerun manually from same home Mac, or a GitHub Actions workflow (Linux runner, public GitHub IP) on the first day of Jan/Apr/Jul/Oct. Worth deferring the Action until after the first run is in place — easier to ask for forgiveness if needed once the data is already on the site for legitimate public use.

### Storage in repo

`data/parcels.json` — flat array of parcel objects. Expected size: ~9,300 entries × ~250 bytes = ~2.3 MB uncompressed, gzip ~500 KB. Committed to the repo. Read at deploy by `load_parcels.mjs` and inserted into D1.

`data/PARCELS_README.md` — one-page document covering: source URL, refresh cadence, the exact command to re-run, the politeness rationale, what to do if PP's HTML format changes (the scraper should fail loudly, not silently), and the Marblehead Assessor's office contact if a CSV becomes available.

`data/parcels.json.example` — 3-5 real parcels (one single-family, one condo, one multi-family, one apartment building, one commercial) so PR reviewers can see the shape without the full 2.3 MB file in the diff.

## 2. D1 schema additions

### `0006_parcels.sql`

```sql
CREATE TABLE IF NOT EXISTS parcels (
  account_number  INTEGER PRIMARY KEY,
  parcel_id       TEXT NOT NULL,
  street_number   TEXT NOT NULL,        -- TEXT because PP uses "10A", "Rear"
  street_name     TEXT NOT NULL,
  building_type   TEXT,
  luc             TEXT,
  luc_description TEXT,
  neighborhood    TEXT,
  year_built      INTEGER,
  owners_json     TEXT NOT NULL,        -- JSON: ["NAME1","NAME2","NAME3"]
  estimated_units INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_parcels_street
  ON parcels(street_name, street_number);
CREATE INDEX IF NOT EXISTS idx_parcels_neighborhood
  ON parcels(neighborhood);

-- Residents binding
ALTER TABLE residents ADD COLUMN account_number INTEGER
  REFERENCES parcels(account_number);
ALTER TABLE residents ADD COLUMN unit_label TEXT;
ALTER TABLE residents ADD COLUMN voter_self_attested INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_residents_parcel_unit
  ON residents(account_number, unit_label);
```

### `0007_review.sql`

```sql
ALTER TABLE residents ADD COLUMN review_status TEXT NOT NULL DEFAULT 'ok';
  -- 'ok' | 'flagged' | 'approved' | 'rejected'
ALTER TABLE residents ADD COLUMN review_note TEXT;
ALTER TABLE residents ADD COLUMN reviewed_at INTEGER;
```

Kept as a separate migration so it can ship after the parcels load is verified in staging. Both migrations are forward-only.

### `load_parcels.mjs`

Reads `data/parcels.json`, batches into 100-row `INSERT OR REPLACE` statements via `wrangler d1 execute`, writes a summary log line ("Loaded N parcels into D1 community-pulse"). Run manually after each schema migration and after each quarterly refresh:

```
node community-pulse/worker/scripts/load_parcels.mjs --env production
node community-pulse/worker/scripts/load_parcels.mjs --env staging
```

`INSERT OR REPLACE` so re-runs are idempotent — parcels removed from PP between refreshes will become orphaned (a resident may reference a `account_number` that no longer exists). On loader run, log any orphaned `residents.account_number` values so the owner can decide manually; never auto-delete a resident.

## 3. Verification flow changes

### Client (`verify.html` + `assets/verify.js`)

Replace the single street-typeahead input with a **three-input cluster**:

```
┌──────────────────────────────────────┐
│ Street    [Pleasant St____________▾] │  ← typeahead, distinct street names from parcels
│ Number    [27_____________________▾] │  ← appears after street selected; numbers on that street only
│ Unit      [____________________________] │  ← appears only if selected parcel's LUC ∈ apartment/condo set
│           (apt/unit, e.g. "3B" — optional) │
└──────────────────────────────────────┘
```

The street and number selectors are populated from a new endpoint `/api/verify/parcels?street=<prefix>&limit=20` (since shipping all 9,300 parcels to every client is heavy). For the street-prefix typeahead, distinct street names are extracted from the parcels table on the server. The number picker queries `?street=<exact>` to fetch all numbers on the selected street.

On number selection:

- Display the parcel's building type as a confirmation hint ("This is a single-family on Pleasant Street, built 1924"). Helps users verify they picked the right entry.
- If the parcel's LUC is in `{102, 104, 105, 109, 111, 112, 121-125}` (any multi-unit), show the unit-label input. Otherwise hide it.
- Pre-fill owner names from `owners_json` as text below the form: "Per the assessor's records, this property is owned by Sullivan Thomas P Jr and Sullivan Miriam." This is informational; no requirement to match.

The new "registered voter" attestation appears below the address cluster:

```
☐ I am a registered Marblehead voter (self-attested — not verified)
```

Unchecked is fine. Stored as 0/1 on the resident row.

**Normalized address for hashing:**

```
address = `${street_number} ${street_name}` + (unit_label ? ` UNIT ${unit_label}` : '')
identity_hash = SHA-256(name + address + salt)
```

The hash continues to be computed client-side. Worker receives the hash, never the components.

**Request body** sent to `/api/verify/register` gains three fields:

```json
{
  "identity_hash": "…",
  "invite_token": "…",
  "account_number": 1574,
  "unit_label": "",
  "voter_self_attested": false
}
```

### Worker (`verify.js` and new `parcels.js`)

`handleRegister` (lines 168-207 today) gains:

1. **Validate parcel.** `SELECT 1 FROM parcels WHERE account_number = ?`. 400 if missing.
2. **Validate cap.** `SELECT COUNT(*) FROM residents WHERE account_number = ? AND COALESCE(unit_label,'') = COALESCE(?,'') AND revoked_at IS NULL`. If count ≥ 8, set `review_status='flagged'` and `review_note='Auto-flagged: {count+1}th resident at this parcel/unit'`. Verification still proceeds. Both writes happen later in `handlePasskeyRegister` (the atomic insertion point).
3. **Persist additions.** The `INSERT INTO residents` in `handlePasskeyRegister` (line 263 today) is extended to set `account_number`, `unit_label`, `voter_self_attested`, `review_status`, `review_note`.
4. **Notify on flag.** If `review_status='flagged'`, enqueue a worker `ctx.waitUntil(sendFlagEmail(env, …))` — see "Cap enforcement" below.

A new `/api/verify/parcels` GET endpoint handles autocomplete queries. Two modes:

- `?streetPrefix=<chars>` → returns distinct street names matching prefix, up to 20.
- `?street=<exact>` → returns `[{account_number, street_number, building_type, luc, owners}]` for that street, limited to ~300 entries (no street in Marblehead has more).

The endpoint is public, returns no resident data, just parcel facts. Cache headers: `Cache-Control: public, max-age=86400` since parcels change at most quarterly.

## 4. Cap enforcement + review queue

### Soft cap mechanics

When a (parcel, unit) reaches 9 or more verified residents:

1. New resident's row is created with `review_status='flagged'` and `review_note` containing the count.
2. Resident's verified votes count normally in aggregates *until and unless* the review_status becomes `'rejected'`.
3. An email is sent to the owner: subject `[verified] Flag: 9th resident at 47 PLEASANT ST`, body includes `parcel_id`, `building_type`, `estimated_units`, the count, and a direct link to `/admin/review.html?account=1574&unit=`.

### Email transport

Cloudflare Email Routing is configurable per Worker via `env.EMAIL` binding (D1 routes outbound via `send_email` action). Setup is one-time. Initially, fallback to a simpler scheme: write flagged events into a `review_queue` row and the owner polls a daily digest endpoint manually. Email is a v1.1 nice-to-have.

```sql
-- if we want a daily-digest model (v1.1)
CREATE TABLE IF NOT EXISTS review_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  identity_hash TEXT NOT NULL,
  account_number INTEGER NOT NULL,
  unit_label TEXT,
  count_at_flag INTEGER NOT NULL,
  estimated_units INTEGER,
  flagged_at INTEGER NOT NULL,
  resolved_at INTEGER
);
```

v1 just relies on `residents.review_status='flagged'` and an owner-side `/admin/review.html`.

### Owner review UI (`/admin/review.html`)

Shared-secret guarded — `?token=<env.ADMIN_TOKEN>`. Simple table:

| parcel_id | street | unit | est. units | count | flagged_at | actions |
|---|---|---|---|---|---|---|
| 126 8C 0 | 47 PLEASANT ST | 3B | 8 | 9 | 6/12 | [Approve] [Reject] |

Approve sets `review_status='approved'`, `reviewed_at=now`. Reject sets `review_status='rejected'`, `reviewed_at=now` — rejected residents' verified votes are excluded from all aggregate queries (`WHERE review_status != 'rejected'` added to stats SQL).

No appeal workflow. A rejected resident emails the owner; the owner flips the status back to `'approved'` via the same admin page.

## 5. Stats display

### `verified-stats.html` (new public page)

Four headline cards:

| Number | Label | Source |
|---|---|---|
| `N` | verified Marblehead residents | live count from D1 (excludes `rejected` and `revoked`) |
| `N / 16,500` (X%) | of adults (18+) | ACS 2024 5-year B19001, all-Marblehead, 18+ |
| `N / 15,200` (X%) | of registered voters (self-attested) | clerk's most recent published total |
| `N / 9,287` (X%) | of properties covered | distinct `account_number` in residents |

Below the cards:

- **Growth chart** — cumulative verified-count by week since 2026-04-16 launch.
- **Geographic spread** — "Verified residents in N of Marblehead's 19 neighborhoods (PP-defined)." Lists neighborhood codes. Per-neighborhood counts shown only for neighborhoods with ≥5 residents.
- **Building type breakdown** — horizontal bar of % residents by LUC family (single fam / condo / multi-fam / apartment / other). Aggregate only.
- **Voter attestation rate** — "X% of verified residents self-attest as registered Marblehead voters."

All citations follow the existing `<sup class="cite">` pattern via `assets/citations.js`.

Page uses `body_class: doc-page` for default markdown / responsive table styles per repo convention (`CLAUDE.md`).

### Homepage card

A small card placed adjacent to the existing verified-bar polling scanner injection (today in `assets/verify-bar.js`-ish — exact placement to be confirmed during implementation). Shows the headline count + one denominator:

> **324 verified Marblehead residents** — 2.0% of adults — [see breakdown](/verified-stats.html)

Re-uses the same `/api/verify/stats` endpoint; data is cached for 5 minutes at the worker.

### `/api/verify/stats` endpoint

Public, GET, no auth. Returns:

```json
{
  "as_of": 1717891234567,
  "total_verified": 324,
  "denominators": {
    "adults_acs_2024": 16500,
    "registered_voters_clerk": 15200,
    "properties_pp": 9287
  },
  "voter_self_attested_count": 281,
  "by_building_type": {
    "single_family": 253,
    "condo": 39,
    "multi_family": 18,
    "apartment": 11,
    "other": 3
  },
  "by_neighborhood": [
    {"code": "OT", "count": 47, "visible": true},
    {"code": "AM", "count": 3,  "visible": false}
  ],
  "growth_weekly": [
    {"week_start": "2026-04-13", "cumulative": 8},
    {"week_start": "2026-04-20", "cumulative": 27}
  ]
}
```

Worker caches the result for 300s using the Cache API keyed by `Date.now() >> 8` (or simpler: an in-module `globalThis` cache with TTL).

## 6. Migration (12 existing residents)

12 is small enough that no automated migration is needed.

**Path:** Wipe the existing `residents`, `passkey_credentials`, `recovery_keys`, `verified_votes`, `invites`, `branch_names`, `branch_name_votes` rows in production D1 after the new schema is deployed. The 12 affected people are personally known to the owner; a one-paragraph email goes out asking them to re-verify (they re-create from scratch — new passkey, new branch assignment). Their identity hashes change because the new normalized address is more specific.

If wiping is uncomfortable, the alternative is to leave the 12 old rows in place with `account_number=NULL` and add a banner on the verified UI prompting them to re-link to a parcel. Either choice is small enough not to constrain the design. **Default to wipe.** Less code, no banner debt.

## 7. Rollout plan (PRs)

Five PRs, in order, each independently mergeable and reviewable:

1. **`feat/parcels-scraper`** — `pull_parcels.mjs` + `data/PARCELS_README.md` + `data/parcels.json.example` + tests for the HTML parser (5-10 fixtures captured from PP). No data file yet, no worker changes.
2. **`feat/parcels-data`** — adds `data/parcels.json` (the ~2.3 MB output from owner's local run). Single-file PR. Auto-generated; minimal review needed.
3. **`feat/parcels-schema`** — `0006_parcels.sql` + `0007_review.sql` + `load_parcels.mjs` + admin scripts. Deployed to staging first; ship-blocking smoke test: load all parcels, query a known one round-trip.
4. **`feat/verify-flow-parcels`** — `verify.html` + `assets/verify.js` + worker `handleRegister` changes + `/api/verify/parcels` endpoint + tests. Includes the voter-attestation checkbox. Toggled on in staging; owner manually verifies one self-registration end-to-end before merge.
5. **`feat/verify-stats`** — `verified-stats.html` + `/api/verify/stats` endpoint + homepage card + `/admin/review.html`. Cap enforcement (`review_status` writes) lives here too, since it depends on the stats query joining on `review_status`.

After PR 5 merges: send the re-verify email to the 12 existing residents and wipe the production D1 verification tables in a maintenance window.

## 8. Open implementation questions (resolve during implementation)

- **Autocomplete delivery.** Ship `parcels.json` (~500KB gzipped) as a static asset for client-side filtering, or use the `/api/verify/parcels?streetPrefix=` server endpoint with caching? Server endpoint is the default in this spec because it scales to bigger updates and matches existing patterns; if Lighthouse complains about the JSON download, revisit.
- **Streets that resolve to >1 parcel at the same street_number** (e.g. "5 ABBOT ST" front + rear lot). Disambiguate by appending `parcel_id` or `building_type` to the dropdown entry. Doesn't need spec-level design; resolve when the data lands.
- **PP HTML format changes.** The scraper has a fixture-based test. When PP redesigns (every few years for these Patriot Properties WebPro sites), tests fail and the parser is patched. Catalogue the brittleness in `data/PARCELS_README.md`.
- **Voter denominator source.** Town clerk's published "registered voters" number changes after every state election. Treat it as a constant in `assets/site-config.js` (or similar) with the date of the last refresh, not a fetched value.

## 9. Out of scope

- Authenticating against actual voter rolls. Even if a clerk CSV becomes available, this spec does not consume it. The voter flag stays self-attested.
- Address-to-precinct mapping for per-precinct stats.
- Public neighborhood-level breakdowns of *stance* (the verified-vote bar continues to be town-wide only).
- Owner-side dashboard beyond the minimal review queue.
- Cap appeals workflow (manual email path is fine at this volume).
- Reverse-engineering PP's underlying CSV if the assessor declines to share it.

## 10. Success criteria

- `data/parcels.json` exists, contains ≥9,000 parcels, and the loader round-trips into D1.
- A new user can verify with `(real_pp_street, real_pp_number, optional_unit, name, voter_yes/no)` in under 90 seconds end-to-end.
- 9th verification at a known single-family triggers a `review_status='flagged'` row (verifiable via `wrangler d1 execute`).
- `/verified-stats.html` loads, shows all four headline numbers, and gracefully handles 0 verified residents.
- Existing verified-bar polling on ballot question pages continues to function unchanged.
- The `/api/verify/parcels` endpoint returns cached results within 50ms p95 for cached entries.
