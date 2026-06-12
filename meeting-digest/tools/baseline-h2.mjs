#!/usr/bin/env node
// Pulls a one-shot snapshot of the four month-3 checkpoint metrics
// and prints them to stdout in markdown. Intended to be run once on
// Jun 12, 2026 and again on Sep 12, 2026 and Dec 12, 2026.
//
// Outputs:
//   - Email subscribers count (from the meeting-digest D1 database)
//   - Facebook page follower count (NOT automated, prompts user to
//     fill in manually)
//   - Monthly site traffic (NOT automated, prompts user to read off
//     PostHog dashboard manually)
//   - Channel mix percentage (NOT automated, prompts manually)
//
// Why partial automation: only the D1 subscriber count is reachable
// without OAuth scaffolding we do not have. Everything else is a
// two-minute human pull from PostHog and the FB page admin view.

import { execSync } from 'node:child_process';

function pullSubscriberCount() {
  // wrangler d1 execute against the meeting-digest DB. Requires the
  // user to be logged into wrangler.
  const cmd = `cd meeting-digest/worker && npx wrangler d1 execute meeting-digest --command "SELECT COUNT(*) as n FROM subscriber WHERE status = 'confirmed'" --json`;
  try {
    const out = execSync(cmd, { encoding: 'utf8' });
    const parsed = JSON.parse(out);
    return parsed?.[0]?.results?.[0]?.n ?? 'unknown';
  } catch (e) {
    return `error: ${e.message}`;
  }
}

const today = new Date().toISOString().slice(0, 10);
const subs = pullSubscriberCount();

const out = `# Baseline snapshot ${today}

Run via: \`node meeting-digest/tools/baseline-h2.mjs\`

| Metric | Value | Source |
|---|---|---|
| Email subscribers (confirmed) | ${subs} | D1 query, automated |
| Facebook page followers | FILL IN | FB page admin > Insights > Followers |
| Monthly site traffic (last 30 days unique visitors) | FILL IN | PostHog dashboard |
| Channel mix: FB + email as % of total traffic | FILL IN | PostHog acquisition |

## Notes

Compare against April 2026 baseline: 462 unique visitors, 26% Facebook.
Hand-edit this file with the manual numbers, then commit.
`;

console.log(out);
