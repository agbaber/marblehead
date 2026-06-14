# Meeting-digest deploy handoff

This branch (`worktree-feat-digest`, PR #801) ships the code for v1 of the
weekly board-meeting email subscription system. Tests pass, Jekyll builds,
preview deploys. **What's left is the Cloudflare infrastructure setup**,
which needs real secrets and DNS — so it has to happen on a machine where
you're logged into Cloudflare and Resend.

If you want, you can paste the prompt at the end of this file into a fresh
Claude Code session locally, and it'll walk you through everything.

## What's already done

- `meeting-digest/worker/` — Cloudflare Worker, 5 libs + 5 handlers + 1 cron,
  51/51 tests passing under `@cloudflare/vitest-pool-workers`.
- D1 schema at `meeting-digest/worker/schema/0001_subscriber.sql`.
- Jekyll pages: `subscribe.html`, `subscribe/confirm.html`, `me/subscription.html`.
- Nav link, `transcripts_subscribe: true`, scoped CSS.
- Cloudflare Pages preview is live at the branch URL on PR #801; the form
  fails on submit because the Worker hasn't been deployed yet.

## What you need before starting

| Thing | Where to get it |
|---|---|
| Cloudflare API token | https://dash.cloudflare.com/profile/api-tokens — "Edit Cloudflare Workers" template is fine; add D1:Edit if it's missing |
| Cloudflare account ID | Right sidebar of any zone in the dashboard |
| Resend API key | https://resend.com/api-keys — free tier handles us 10× over |
| Turnstile site key + secret | https://dash.cloudflare.com/?to=/:account/turnstile — new widget, hostname `marbleheaddata.org` + `*.marbleheaddata-preview.pages.dev` |
| Verified Resend sender domain | Add `meetings.marbleheaddata.org` in Resend; copy the MX/SPF/DKIM records into Cloudflare DNS |

## Manual steps (if not using the prompt)

All commands run from the worktree at the path where this file lives
(`meeting-digest/`).

### 1. Authenticate wrangler

```bash
export CLOUDFLARE_API_TOKEN=<your token>
npx wrangler whoami   # confirm it shows your email
```

### 2. Create the staging D1 database

```bash
npx wrangler --config worker/wrangler.toml d1 create meeting-digest-staging
```

It prints a `database_id` UUID. Open `worker/wrangler.toml`, find the
`[[env.staging.d1_databases]]` block, and replace the placeholder
`00000000-0000-0000-0000-000000000000` with the real UUID.

### 3. Apply migrations to staging D1

```bash
npx wrangler --config worker/wrangler.toml d1 migrations apply meeting-digest-staging --remote
```

### 4. Set staging secrets

```bash
echo "$RESEND_API_KEY"   | npx wrangler --config worker/wrangler.toml secret put MAIL_PROVIDER_API_KEY --env staging
echo "$TURNSTILE_SECRET" | npx wrangler --config worker/wrangler.toml secret put TURNSTILE_SECRET --env staging
```

### 5. Deploy staging

```bash
npx wrangler --config worker/wrangler.toml deploy --env staging
```

It prints the staging Worker URL, something like
`https://marblehead-meeting-digest-staging.<account>.workers.dev`.
Save this URL — you'll paste it into the Jekyll pages next.

### 6. Update the Jekyll pages with the real Worker URL

From the repo root:

```bash
WORKER=https://marblehead-meeting-digest-staging.<account>.workers.dev
for f in subscribe.html subscribe/confirm.html me/subscription.html; do
  sed -i.bak "s|https://marblehead-meeting-digest\.workers\.dev|$WORKER|g" "$f"
  rm "$f.bak"
done
```

Also set the Turnstile site key in `subscribe.html`'s frontmatter:

```bash
sed -i.bak 's|turnstile_site_key: ""|turnstile_site_key: "0x4..."|' subscribe.html && rm subscribe.html.bak
```

Commit and push:

```bash
git add subscribe.html subscribe/confirm.html me/subscription.html meeting-digest/worker/wrangler.toml meeting-digest/DEPLOY.md
git commit -m "digest: point Jekyll pages at staging Worker URL"
git push
```

### 7. Smoke test

Watch the new commit deploy on Cloudflare Pages (~1–2 min). Then in a browser:

1. Visit `https://worktree-feat-digest.marbleheaddata-preview.pages.dev/subscribe/`
2. Enter your real email, solve the Turnstile widget, click Subscribe.
3. Expect "Check your inbox — a confirmation link is on its way."
4. Open the email, click "Confirm subscription" — expect redirect to the
   preferences page with the welcome banner.
5. Tick / untick boards and topics, hit Save preferences. Verify "Saved."
6. Click Unsubscribe. Verify the page says "You are unsubscribed."

If steps 1–3 work but the email doesn't arrive: check the Resend dashboard
→ Logs to see if it was delivered, bounced, or rejected by DKIM. The
verified-domain step is the usual culprit.

### 8. Production (when staging looks good)

Repeat steps 2–5 without `--env staging`:

```bash
npx wrangler --config worker/wrangler.toml d1 create meeting-digest
# paste UUID into [[d1_databases]] block
npx wrangler --config worker/wrangler.toml d1 migrations apply meeting-digest --remote
echo "$RESEND_API_KEY"   | npx wrangler --config worker/wrangler.toml secret put MAIL_PROVIDER_API_KEY
echo "$TURNSTILE_SECRET" | npx wrangler --config worker/wrangler.toml secret put TURNSTILE_SECRET
npx wrangler --config worker/wrangler.toml deploy
```

Update the three Jekyll pages a second time to point at the production
Worker URL (instead of staging), commit, push, merge the PR.

### 9. Wire the Resend webhook

In the Resend dashboard → Webhooks: add the production Worker's
`/api/mail-event` endpoint. Subscribe to `email.bounced` and
`email.complained` events. This drives the subscriber-status updates on
bounce/spam complaint so the Monday cron stops sending to bad addresses.

### 10. Trigger the first Monday digest manually

To test the cron without waiting for Monday morning, use the Cloudflare
dashboard → Workers & Pages → marblehead-meeting-digest → Triggers →
"Send Test" on the scheduled trigger.

Watch the Worker logs (`npx wrangler tail` from `meeting-digest/`) — you
should see `transcripts: N` and `sent: M` lines if you have at least one
confirmed subscriber and a recent transcript.

---

## Prompt for a fresh local Claude Code session

Paste this into Claude Code (or your assistant of choice) on your local
machine, after `git pull`ing `worktree-feat-digest` to your laptop:

````
I'm on branch `worktree-feat-digest` of agbaber/marblehead. PR #801 ships
v1 of a Cloudflare Worker + D1 + Jekyll-Pages subscription system at
`meeting-digest/`. All code is done; tests pass; preview is live. The only
remaining work is the Cloudflare infrastructure setup, which I'm now
doing locally.

Read `meeting-digest/DEPLOY.md` end-to-end. That document has the full
sequence of `wrangler` commands and what to do after each one.

Required env vars (I'll provide them as you ask, do NOT echo them back):
- CLOUDFLARE_API_TOKEN
- CLOUDFLARE_ACCOUNT_ID  (only needed for occasional dashboard API calls;
  wrangler auto-discovers from the token in most cases)
- RESEND_API_KEY
- TURNSTILE_SITE_KEY  (public, can be embedded in HTML)
- TURNSTILE_SECRET    (server-side only)

Work through DEPLOY.md sections 1–7 first (the staging cycle). Stop after
section 7 and verify with me that the smoke test passed in the browser
before proceeding to production.

Three rules:
1. Never commit a secret. The `.env` file is gitignored; use it.
2. The three Jekyll pages (`subscribe.html`, `subscribe/confirm.html`,
   `me/subscription.html`) need their `worker_base:` frontmatter changed
   from the placeholder URL to whatever real Worker URL wrangler printed.
   Do this with an `Edit` or `sed`, not by rewriting the file.
3. After each section, paste the command output back to me so I can see
   it worked. Especially for `wrangler d1 create` (I need the UUID) and
   `wrangler deploy` (I need the Worker URL).

Don't push to a different branch or open a new PR — keep adding commits
to `worktree-feat-digest` which is what PR #801 tracks.

If anything fails or returns an unexpected response, stop and tell me
what happened instead of guessing.
````

That's the whole handoff. Paste it, attach DEPLOY.md as context if your
client doesn't auto-read repo files, and you should be deployed in 15–20
minutes.
