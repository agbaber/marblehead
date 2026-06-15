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
