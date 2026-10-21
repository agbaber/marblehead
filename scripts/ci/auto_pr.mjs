#!/usr/bin/env node
// Self-healing helpers for bot-authored "auto-*" data refresh PRs.
//
//   node scripts/ci/auto_pr.mjs gate <label>
//     Close every open PR carrying <label> whose head branch starts with
//     "bot/" (a leftover from a run that never merged), commenting with
//     its check results, then exit 0 so the refresh proceeds. A labeled
//     PR on any other branch belongs to a human: print ::error:: and
//     exit 1 without touching it.
//
//   node scripts/ci/auto_pr.mjs await-merge <pr-url-or-number> [--minutes N]
//     Poll until the PR is MERGED (default budget 15 minutes). Required
//     checks come from branch protection. A cancelled required check
//     (runner never acquired, apt mirror stall, ...) gets its workflow
//     run re-run once. A failed required check, a second cancellation,
//     or the deadline exits 1 with a ::error:: naming the PR, leaving
//     the PR open for diagnosis. Net effect: a green scheduled run means
//     the data landed on main.
//
// Why: PRs #1150, #1278 and #1287 each sat BLOCKED for 10-16 days after
// one cancelled required check, because nothing re-runs a cancelled
// check and the old gate only skipped (then, after #1179, alarmed).
//
// Node built-ins only; needs `gh` on PATH and GH_TOKEN in the env.
// Decision logic is pure and tested in auto_pr.test.mjs; the gh calls
// are a thin layer underneath.

import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PASSING = new Set(['SUCCESS', 'NEUTRAL', 'SKIPPED']);
const POLL_MS = 20_000;
const REQUIRED_CHECKS_ENDPOINT =
  'repos/{owner}/{repo}/branches/main/protection/required_status_checks/contexts';

// ---- pure decision logic ---------------------------------------------

export function runIdFromDetailsUrl(url) {
  const m = /\/actions\/runs\/(\d+)/.exec(url ?? '');
  return m ? Number(m[1]) : null;
}

// Sort the PR's statusCheckRollup into buckets, required checks only.
// Several check runs can share a name after a re-run: an in-flight one
// makes the name pending; otherwise the most recently completed one
// decides. Results completed at or before `rerunAt` are pre-re-run and
// count as pending.
export function classifyChecks(rollup, required, rerunAt = null) {
  const out = { pending: [], passing: [], cancelled: [], failed: [] };
  for (const name of required) {
    const runs = (rollup ?? []).filter((c) => c.name === name);
    if (runs.length === 0 || runs.some((c) => c.status !== 'COMPLETED')) {
      out.pending.push(name);
      continue;
    }
    const latest = runs.reduce((a, b) => ((b.completedAt ?? '') > (a.completedAt ?? '') ? b : a));
    if (rerunAt && (latest.completedAt ?? '') <= rerunAt) {
      out.pending.push(name);
    } else if (PASSING.has(latest.conclusion)) {
      out.passing.push(name);
    } else if (latest.conclusion === 'CANCELLED') {
      out.cancelled.push({ name, runId: runIdFromDetailsUrl(latest.detailsUrl) });
    } else {
      out.failed.push({ name, conclusion: latest.conclusion });
    }
  }
  return out;
}

// What await-merge does next for a PR that is still OPEN.
export function decide(checks, { rerunDone }) {
  if (checks.failed.length) {
    const reason = checks.failed.map((f) => `${f.name}: ${f.conclusion}`).join(', ');
    return { action: 'fail', reason };
  }
  if (checks.cancelled.length) {
    const names = checks.cancelled.map((c) => c.name).join(', ');
    if (rerunDone) return { action: 'fail', reason: `cancelled again after one re-run: ${names}` };
    const runIds = [...new Set(checks.cancelled.map((c) => c.runId).filter(Boolean))];
    return { action: 'rerun', runIds };
  }
  return { action: 'wait' };
}

export function gateDecision(prs) {
  const isBot = (p) => p.headRefName.startsWith('bot/');
  return { close: prs.filter(isBot), refuse: prs.filter((p) => !isBot(p)) };
}
