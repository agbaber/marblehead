# Staging Environment

## URLs

- **Verify page:** https://marblehead-community-pulse-staging.agbaber.workers.dev/verify
- **Branches page:** https://marblehead-community-pulse-staging.agbaber.workers.dev/branches
- **API:** https://marblehead-community-pulse-staging.agbaber.workers.dev/api/
- **Invite link format:** https://marblehead-community-pulse-staging.agbaber.workers.dev/verify#invite=TOKEN&n=NUM&i=INITIAL

## Architecture

The staging worker serves both the API and the front-end pages from the same
origin. Pages pull CSS/fonts from the production site (marbleheaddata.org) so
they look like the real thing. In production, the pages are served by GitHub
Pages and the API by the worker.

## Infrastructure

- **Worker:** `marblehead-community-pulse-staging` (Cloudflare Workers)
- **D1 database:** `community-pulse-staging` (ID: `bf73e7fc-d8c2-42aa-96f6-133c3059b14c`)
- **ALLOWED_ORIGIN:** `*` (staging accepts requests from any origin)
- **JWT_SECRET:** `staging-secret-not-for-production`

## Deploying

```bash
cd community-pulse/worker
npx wrangler deploy --env staging
```

## Resetting the database

Full reset (clears all residents except SEED, resets the genesis invite):

```bash
cd community-pulse/worker

npx wrangler d1 execute community-pulse-staging --remote --env staging \
  --command "DELETE FROM residents WHERE identity_hash <> 'SEED'"
npx wrangler d1 execute community-pulse-staging --remote --env staging \
  --command "DELETE FROM recovery_keys"
npx wrangler d1 execute community-pulse-staging --remote --env staging \
  --command "DELETE FROM passkey_credentials"
npx wrangler d1 execute community-pulse-staging --remote --env staging \
  --command "DELETE FROM branch_names"
npx wrangler d1 execute community-pulse-staging --remote --env staging \
  --command "DELETE FROM branch_name_votes"
npx wrangler d1 execute community-pulse-staging --remote --env staging \
  --command "DELETE FROM verified_votes"
npx wrangler d1 execute community-pulse-staging --remote --env staging \
  --command "DELETE FROM invites WHERE token <> 'genesis-andrew-baber'"
npx wrangler d1 execute community-pulse-staging --remote --env staging \
  --command "UPDATE invites SET consumed_by = NULL, consumed_at = NULL WHERE token = 'genesis-andrew-baber'"
```

After resetting, delete old passkeys from your device (Settings > Passwords >
search "marblehead-community-pulse-staging") before registering again.

## Genesis invite

Andrew Baber, 16 Mystic Road:
- Identity hash: `b04f395cfca96d5e57657d5dafa711994da4aa32f2e98552e5011601001ea0c7`
- Token: `genesis-andrew-baber`
- Registration URL: `https://marblehead-community-pulse-staging.agbaber.workers.dev/verify#invite=genesis-andrew-baber`

## Applying migrations

```bash
cd community-pulse/worker
npx wrangler d1 execute community-pulse-staging --remote --env staging \
  --command "$(cat schema/NNNN_name.sql)"
```

Or for new migrations:
```bash
echo "y" | npx wrangler d1 migrations apply community-pulse-staging --remote --env staging
```

## Key differences from production

| | Staging | Production |
|---|---|---|
| Pages served by | Worker (inline HTML) | GitHub Pages (Jekyll) |
| ALLOWED_ORIGIN | `*` | `https://marbleheaddata.org` |
| JWT_SECRET | Hardcoded in wrangler.toml | Cloudflare secret |
| D1 database | `community-pulse-staging` | `community-pulse` |
| Passkey RP ID | `marblehead-community-pulse-staging.agbaber.workers.dev` | `marbleheaddata.org` |
| Nav | Simplified (Verify, Branches, theme toggle) | Full site nav |
