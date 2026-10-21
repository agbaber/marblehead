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

// ---- gh plumbing -------------------------------------------------------

function gh(args, { json = true } = {}) {
  const out = execFileSync('gh', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] });
  return json ? JSON.parse(out) : out.trim();
}

function summarize(rollup) {
  const parts = (rollup ?? []).map((c) => `${c.name}: ${c.status === 'COMPLETED' ? c.conclusion : c.status}`);
  return parts.join(', ') || 'no checks reported';
}

function requiredChecks() {
  try {
    return gh(['api', REQUIRED_CHECKS_ENDPOINT]);
  } catch {
    console.log('::warning::could not read required checks from branch protection; treating every check as required');
    return null;
  }
}

function rerun(runId) {
  const attempts = [['run', 'rerun', String(runId), '--failed'], ['run', 'rerun', String(runId)]];
  for (const args of attempts) {
    try {
      gh(args, { json: false });
      console.log(`re-ran workflow run ${runId}${args.includes('--failed') ? ' (failed jobs)' : ' (all jobs)'}`);
      return;
    } catch (e) {
      console.log(`::warning::gh ${args.join(' ')} failed: ${String(e.message).split('\n')[0]}`);
    }
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const isoSeconds = () => new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');

export function gate(label) {
  const prs = gh(['pr', 'list', '--label', label, '--state', 'open',
    '--json', 'number,url,headRefName,createdAt,statusCheckRollup']);
  const { close, refuse } = gateDecision(prs);
  for (const p of refuse) {
    console.log(`::error::${p.url} carries the ${label} label but ${p.headRefName} is not a bot/ branch; leaving it alone`);
  }
  if (refuse.length) return 1;
  for (const p of close) {
    const comment = `Closing: this auto PR never merged (${summarize(p.statusCheckRollup)}). `
      + 'Today\'s refresh replaces it with current data. See scripts/ci/auto_pr.mjs.';
    gh(['pr', 'close', p.url, '--delete-branch', '--comment', comment], { json: false });
    console.log(`closed leftover ${p.url} (${p.headRefName}, opened ${p.createdAt})`);
  }
  if (!close.length) console.log(`no open ${label} PR; proceeding`);
  return 0;
}

export async function awaitMerge(ref, minutes) {
  const started = Date.now();
  const deadline = started + minutes * 60_000;
  const required = requiredChecks();
  let rerunDone = false;
  let rerunAt = null;
  for (;;) {
    const pr = gh(['pr', 'view', ref, '--json', 'url,state,mergeStateStatus,statusCheckRollup']);
    if (pr.state === 'MERGED') {
      console.log(`merged: ${pr.url}`);
      return 0;
    }
    if (pr.state !== 'OPEN') {
      console.log(`::error::${pr.url} is ${pr.state}; nothing to wait for`);
      return 1;
    }
    const names = required ?? [...new Set(pr.statusCheckRollup.map((c) => c.name))];
    const checks = classifyChecks(pr.statusCheckRollup, names, rerunAt);
    const next = decide(checks, { rerunDone });
    const elapsed = Math.round((Date.now() - started) / 1000);
    console.log(`[${elapsed}s] ${pr.mergeStateStatus}; ${summarize(pr.statusCheckRollup)}`);
    if (next.action === 'fail') {
      console.log(`::error::${pr.url} did not merge: ${next.reason}. Left open for diagnosis.`);
      return 1;
    }
    if (next.action === 'rerun') {
      for (const id of next.runIds) rerun(id);
      rerunDone = true;
      rerunAt = isoSeconds();
    }
    if (Date.now() >= deadline) {
      console.log(`::error::${pr.url} not merged after ${minutes} min (${summarize(pr.statusCheckRollup)}). Left open for diagnosis.`);
      return 1;
    }
    await sleep(POLL_MS);
  }
}

// ---- CLI -----------------------------------------------------------------

async function main(argv) {
  const [cmd, ref, ...rest] = argv;
  if (cmd === 'gate' && ref) return gate(ref);
  if (cmd === 'await-merge' && ref) {
    const i = rest.indexOf('--minutes');
    const minutes = i >= 0 ? Number(rest[i + 1]) : 15;
    if (!Number.isFinite(minutes) || minutes <= 0) {
      console.error('--minutes must be a positive number');
      return 2;
    }
    return awaitMerge(ref, minutes);
  }
  console.error('usage: auto_pr.mjs gate <label> | await-merge <pr-url-or-number> [--minutes N]');
  return 2;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = await main(process.argv.slice(2));
}
