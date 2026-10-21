import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyChecks, decide, gateDecision, runIdFromDetailsUrl } from './auto_pr.mjs';

const REQUIRED = ['smoke', 'Secret scan', 'Content guardrails'];

// One entry of a PR's statusCheckRollup as `gh pr view --json` returns it.
function run(name, { status = 'COMPLETED', conclusion = 'SUCCESS',
  completedAt = '2026-10-09T17:09:00Z', runId = 100 } = {}) {
  return {
    __typename: 'CheckRun', name, status, conclusion, completedAt,
    detailsUrl: `https://github.com/agbaber/marblehead/actions/runs/${runId}/job/${runId * 10}`,
  };
}

const empty = { pending: [], passing: [], cancelled: [], failed: [] };

test('runIdFromDetailsUrl pulls the workflow run id out of a job URL', () => {
  assert.equal(runIdFromDetailsUrl(
    'https://github.com/agbaber/marblehead/actions/runs/37964064899/job/113933858629'), 37964064899);
  assert.equal(runIdFromDetailsUrl('https://example.com/no-run-here'), null);
  assert.equal(runIdFromDetailsUrl(undefined), null);
});

test('a required check with no check run yet is pending', () => {
  const c = classifyChecks([run('smoke')], REQUIRED);
  assert.deepEqual(c.passing, ['smoke']);
  assert.deepEqual(c.pending, ['Secret scan', 'Content guardrails']);
});

test('an in-progress required check is pending', () => {
  const c = classifyChecks([run('smoke', { status: 'IN_PROGRESS', conclusion: null, completedAt: null })], REQUIRED);
  assert.ok(c.pending.includes('smoke'));
  assert.deepEqual(c.passing, []);
});

test('non-required checks are ignored even when they fail', () => {
  const rollup = [...REQUIRED.map((n) => run(n)), run('preview', { conclusion: 'FAILURE' })];
  const c = classifyChecks(rollup, REQUIRED);
  assert.deepEqual(c.failed, []);
  assert.deepEqual(c.passing, REQUIRED);
});

test('a cancelled required check is reported with its workflow run id', () => {
  const c = classifyChecks([run('smoke', { conclusion: 'CANCELLED', runId: 37964064899 })], REQUIRED);
  assert.deepEqual(c.cancelled, [{ name: 'smoke', runId: 37964064899 }]);
});

test('a failed required check is reported with its conclusion', () => {
  const c = classifyChecks([run('smoke', { conclusion: 'TIMED_OUT' })], REQUIRED);
  assert.deepEqual(c.failed, [{ name: 'smoke', conclusion: 'TIMED_OUT' }]);
});

test('results completed before the re-run are stale and count as pending', () => {
  const rollup = [run('smoke', { conclusion: 'CANCELLED', completedAt: '2026-10-09T17:18:09Z' })];
  const c = classifyChecks(rollup, REQUIRED, '2026-10-09T17:20:00Z');
  assert.deepEqual(c.cancelled, []);
  assert.ok(c.pending.includes('smoke'));
});

test('after a re-run, the newest completed run of a name decides', () => {
  const rollup = [
    run('smoke', { conclusion: 'CANCELLED', completedAt: '2026-10-09T17:18:09Z' }),
    run('smoke', { conclusion: 'SUCCESS', completedAt: '2026-10-09T17:24:00Z', runId: 200 }),
  ];
  const c = classifyChecks(rollup, REQUIRED, '2026-10-09T17:20:00Z');
  assert.deepEqual(c.passing, ['smoke']);
  assert.deepEqual(c.cancelled, []);
});

test('an in-flight re-run attempt beats an older cancelled result', () => {
  const rollup = [
    run('smoke', { conclusion: 'CANCELLED', completedAt: '2026-10-09T17:18:09Z' }),
    run('smoke', { status: 'IN_PROGRESS', conclusion: null, completedAt: null }),
  ];
  const c = classifyChecks(rollup, REQUIRED);
  assert.ok(c.pending.includes('smoke'));
  assert.deepEqual(c.cancelled, []);
});

test('decide: a failed required check fails immediately, even alongside a cancelled one', () => {
  const next = decide({ ...empty,
    cancelled: [{ name: 'smoke', runId: 1 }],
    failed: [{ name: 'Secret scan', conclusion: 'FAILURE' }] }, { rerunDone: false });
  assert.equal(next.action, 'fail');
  assert.match(next.reason, /Secret scan: FAILURE/);
});

test('decide: cancelled checks trigger one re-run per distinct workflow run', () => {
  const next = decide({ ...empty, cancelled: [
    { name: 'Secret scan', runId: 7 }, { name: 'Content guardrails', runId: 7 },
    { name: 'smoke', runId: 8 }, { name: 'odd', runId: null },
  ] }, { rerunDone: false });
  assert.deepEqual(next, { action: 'rerun', runIds: [7, 8] });
});

test('decide: a check cancelled again after the re-run fails', () => {
  const next = decide({ ...empty, cancelled: [{ name: 'smoke', runId: 9 }] }, { rerunDone: true });
  assert.equal(next.action, 'fail');
  assert.match(next.reason, /again/);
});

test('decide: pending or all-passing means keep waiting', () => {
  assert.deepEqual(decide({ ...empty, pending: ['smoke'] }, { rerunDone: false }), { action: 'wait' });
  assert.deepEqual(decide({ ...empty, passing: REQUIRED }, { rerunDone: false }), { action: 'wait' });
});

test('gateDecision closes bot branches and refuses everything else', () => {
  const bot = { number: 1287, headRefName: 'bot/checkbook-refresh-2026-10-09-1707' };
  const human = { number: 1179, headRefName: 'fix/checkbook-gate' };
  assert.deepEqual(gateDecision([bot, human]), { close: [bot], refuse: [human] });
  assert.deepEqual(gateDecision([]), { close: [], refuse: [] });
});
