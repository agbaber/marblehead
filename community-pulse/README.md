# Community Pulse Worker

The Cloudflare Worker behind the verification network and self-serve
verification flow on marbleheaddata.org. Source lives in
`worker/src/`, schema in `worker/schema/`, staging notes in
[STAGING.md](STAGING.md).

## Self-Serve Verification setup

### Facebook OAuth

1. Register a Facebook developer app called "Marblehead Data" at
   <https://developers.facebook.com/apps/>.
2. Under the app's Login product, add the redirect URI
   `https://marblehead-community-pulse.agbaber.workers.dev/api/auth/fb/callback`
   (and the staging equivalent if different).
3. Set the Privacy Policy URL to `https://marbleheaddata.org/privacy.html`
   and the Terms of Service URL to `https://marbleheaddata.org/terms.html`.
4. Copy the App ID into `wrangler.toml` under both `[vars] FB_APP_ID`
   and `[env.staging.vars] FB_APP_ID`, replacing the
   `TODO_SET_IN_DASHBOARD` placeholder.
5. Set the App Secret as a Worker secret for each environment:
   `npx wrangler secret put FB_APP_SECRET` (and `--env staging` for the staging Worker).

### CORS + cookie deployment note

The FB callback sets the session JWT as an HttpOnly cookie with
`SameSite=Lax`. If the Worker is served at a different origin than
the site (e.g. `*.workers.dev` while the site is `marbleheaddata.org`),
the cookie will not travel on cross-origin XHR from the verify-me
claim form. Two deployment options:

1. (Preferred) Bind the Worker to a route on the same origin as the
   site, e.g. `marbleheaddata.org/api/*`, so the cookie is same-origin
   and `SameSite=Lax` is sufficient.
2. (Fallback) Change the cookie to `SameSite=None; Secure` in
   `community-pulse/worker/src/fb.js` and add
   `Access-Control-Allow-Credentials: true` to the relevant responses.
   Some browsers' third-party-cookie policies may still block the
   cookie under this setup.

Verify which path is in effect before declaring the self-serve flow
healthy in production.

### Parcel-owners sync

The Worker needs the gitignored `data/parcels_raw/parcels_full.csv`
from the marblehead repo present locally before running:

```
node scripts/sync_parcel_owners.mjs --db community-pulse-staging --remote
```

This truncates and reinserts `parcel_owners` in the named D1. Run it
any time the assessor CSV is refreshed. Omit `--remote` to sync the
local D1 instead.

## PostHog events captured for the verify flow

Client-side via `assets/community-pulse/claim.js` + `profile.js`. All
events use the `verify_` prefix. No PII (no addresses, names, or
identity hashes) is sent as event properties -- only status enums,
boolean flags, and HTTP status codes.

### `/verify-me.html` flow

| Event | Fires when | Properties |
|---|---|---|
| `verify_fb_start_clicked` | User clicks "Continue with Facebook" | -- |
| `verify_oauth_returned` | FB callback redirects back with a JWT in the URL fragment | `claim_intent` (bool) |
| `verify_claim_submitted` | User submits the claim form | -- |
| `verify_claim_result` | API returns a response | `status` (`match` / `first_initial_mismatch` / `name_mismatch` / `no_match` / `rate_limited` / `http_error` / `network_error`), `had_alternatives` (bool), `http_status` (number, on http_error only) |

### `/profile.html` flow

| Event | Fires when | Properties |
|---|---|---|
| `verify_profile_viewed` | Page loads | `state` (`signed_in` / `signed_out`), and when signed in: `claim_source`, `auth_source`, `has_facebook` (bool), `has_passkey` (bool), `public_identity` (bool) |
| `verify_signin_clicked` | Signed-out user clicks Sign in | `from` (`profile_page`) |
| `verify_display_name_saved` | User saves their display name | `is_empty` (bool) |
| `verify_public_identity_changed` | User toggles public/private | `value` (0 / 1) |
| `verify_claim_released` | User releases their claim | -- |

### Suggested funnels in PostHog

- **Landing -> verified**: `$pageview` (path=/verify-me.html) -> `verify_fb_start_clicked` -> `verify_oauth_returned` -> `verify_claim_submitted` -> `verify_claim_result` (status=match)
- **Assessor match rate**: `verify_claim_result` breakdown by `status`
- **Drop-off after OAuth**: `verify_oauth_returned` (claim_intent=true) -> `verify_claim_submitted` (cohort delta)
