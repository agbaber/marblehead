# Style-rule enforcement PR 1a: Linter architecture + Bucket 1 (chart anatomy) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Node-based content linter (`scripts/lint-content.mjs`) with full architecture (file walker, parser, rule registry, severity model, GitHub Actions reporter), plus all 8 rules from Bucket 1 (chart anatomy) implemented as the smoke-test bucket. Ship as a third job in `.github/workflows/lint.yml` running every rule at warn-severity. CI does not fail on any violation; output is GitHub PR annotations.

**Architecture:** ESM Node (matches existing `scripts/minutes/` conventions). One CLI entry point `scripts/lint-content.mjs` orchestrates: walk → parse → run rules → report. Rules live as plain objects in `scripts/lint-content/rules/<bucket>.mjs`, exporting an array. Tests use the built-in `node --test` runner with `.test.mjs` extension, matching the existing `test:minutes` script pattern. HTML parsing via `cheerio`; frontmatter via `gray-matter`. No build step, no transpilation.

**Tech Stack:** Node 24 LTS, ESM, `cheerio` (HTML parsing), `gray-matter` (frontmatter), `node --test` (test runner), GitHub Actions workflow commands for PR annotations.

---

## File Structure

**Create:**
- `scripts/lint-content.mjs` — CLI entry point. Parses argv, loads rules, walks files, runs checks, emits annotations.
- `scripts/lint-content/parse.mjs` — `parseFile(path)` returns `{frontmatter, html, $ (cheerio), text, lines}`.
- `scripts/lint-content/walk.mjs` — `findSiteFacingFiles()` returns the list of `.html`/`.md` paths to lint, with classification (`'chart' | 'explainer' | 'doc-page' | 'home' | 'utility'`).
- `scripts/lint-content/diff.mjs` — `getAddedLines(baseRef, files)` returns a `Map<file, Set<lineNumber>>` of lines added in the current diff.
- `scripts/lint-content/runner.mjs` — `runRules(file, rules, options)` returns `Violation[]`.
- `scripts/lint-content/severity.mjs` — defines severity levels and the PR-1 mode that downgrades all `block` to `warn`.
- `scripts/lint-content/report.mjs` — formats violations as GitHub Actions workflow commands.
- `scripts/lint-content/rules/index.mjs` — exports the combined rule list from all buckets.
- `scripts/lint-content/rules/bucket1-charts.mjs` — Bucket 1 rules.
- `scripts/lint-content/rules/test/fixtures/` — small HTML fixtures for rule tests.
- `scripts/lint-content/rules/test/bucket1-charts.test.mjs` — Bucket 1 tests.
- `scripts/lint-content/rules/test/walk.test.mjs` — file-walker tests.
- `scripts/lint-content/rules/test/parse.test.mjs` — parser tests.
- `scripts/lint-content/rules/test/severity.test.mjs` — severity-mode tests.
- `scripts/lint-content/rules/test/report.test.mjs` — reporter tests.

**Modify:**
- `package.json` — add `cheerio` and `gray-matter` deps; add `lint:content` and `test:lint` scripts.
- `.github/workflows/lint.yml` — add a third job `content-rules` that runs the new linter.

---

## Task 1: Project scaffolding + dependencies

**Files:**
- Modify: `package.json`
- Create: `scripts/lint-content/.gitkeep`
- Create: `scripts/lint-content/rules/.gitkeep`
- Create: `scripts/lint-content/rules/test/fixtures/.gitkeep`

- [ ] **Step 1: Install runtime deps**

```bash
npm install --save cheerio@^1.0.0 gray-matter@^4.0.3
```

Expected: `package.json` `dependencies` gains `cheerio` and `gray-matter`. `package-lock.json` updates. No errors.

- [ ] **Step 2: Create directory structure**

```bash
mkdir -p scripts/lint-content/rules/test/fixtures
touch scripts/lint-content/.gitkeep scripts/lint-content/rules/.gitkeep scripts/lint-content/rules/test/fixtures/.gitkeep
```

- [ ] **Step 3: Add npm scripts**

Modify `package.json` `"scripts"` block, add two entries:

```json
"lint:content": "node scripts/lint-content.mjs",
"test:lint": "node --test scripts/lint-content/rules/test/*.test.mjs scripts/lint-content/rules/test/**/*.test.mjs"
```

The double pattern catches both top-level test files and nested ones. (Node's test runner handles missing patterns silently when one doesn't match.)

- [ ] **Step 4: Verify scripts run without error**

Run: `npm run lint:content -- --help`
Expected: error like `Cannot find module '.../lint-content.mjs'` (we haven't created it yet — that's the expected failure).

Run: `npm run test:lint`
Expected: `tests 0 / pass 0 / fail 0` (no tests yet, runner exits clean).

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json scripts/lint-content/
git commit -m "Scaffold scripts/lint-content directory and deps (cheerio, gray-matter)"
```

---

## Task 2: Parser wrapper

A single function that loads a file and returns frontmatter, HTML body, a Cheerio handle, and a line-numbered text array. Every rule consumes this shape; nothing else parses raw files.

**Files:**
- Create: `scripts/lint-content/parse.mjs`
- Create: `scripts/lint-content/rules/test/parse.test.mjs`
- Create: `scripts/lint-content/rules/test/fixtures/explainer-minimal.html`
- Create: `scripts/lint-content/rules/test/fixtures/chart-minimal.html`
- Create: `scripts/lint-content/rules/test/fixtures/no-frontmatter.html`

- [ ] **Step 1: Create test fixtures**

`scripts/lint-content/rules/test/fixtures/explainer-minimal.html`:
```html
---
title: "Test page"
og_title: "Test"
og_description: "Test page description for fixtures."
og_url: https://example.com/test.html
---
<h1>Test page</h1>
<p class="page-lead">A short lead paragraph.</p>
<h2 id="first" data-stance-section="first">First section</h2>
<p>Some prose.</p>
```

`scripts/lint-content/rules/test/fixtures/chart-minimal.html`:
```html
---
title: "Test Chart"
scripts: [chart-tooltip]
---
<h1 class="h-center">Test Chart</h1>
<p class="subtitle h-center">A test chart.</p>
<div class="chart-wrapper">
  <svg class="chart" viewBox="0 0 400 200" aria-label="Test chart axis labels.">
    <line class="axis-base" x1="40" y1="160" x2="360" y2="160"/>
    <text class="tick-label" x="40" y="180">A</text>
    <text class="tick-label" x="360" y="180">B</text>
  </svg>
</div>
```

`scripts/lint-content/rules/test/fixtures/no-frontmatter.html`:
```html
<h1>No frontmatter at all</h1>
<p>Just HTML.</p>
```

- [ ] **Step 2: Write the failing tests**

`scripts/lint-content/rules/test/parse.test.mjs`:
```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseFile } from '../../parse.mjs';

const fixturePath = (name) => new URL(`./fixtures/${name}`, import.meta.url).pathname;

test('parseFile reads frontmatter from YAML block', async () => {
  const f = await parseFile(fixturePath('explainer-minimal.html'));
  assert.equal(f.frontmatter.title, 'Test page');
  assert.equal(f.frontmatter.og_title, 'Test');
});

test('parseFile returns empty frontmatter object for files without it', async () => {
  const f = await parseFile(fixturePath('no-frontmatter.html'));
  assert.deepEqual(f.frontmatter, {});
});

test('parseFile returns the HTML body separated from frontmatter', async () => {
  const f = await parseFile(fixturePath('explainer-minimal.html'));
  assert.match(f.html, /<h1>Test page<\/h1>/);
  assert.doesNotMatch(f.html, /^---/);
});

test('parseFile returns a Cheerio handle that can query the body', async () => {
  const f = await parseFile(fixturePath('explainer-minimal.html'));
  assert.equal(f.$('h1').text(), 'Test page');
  assert.equal(f.$('h2').attr('id'), 'first');
});

test('parseFile returns lines array with 1-based indexing', async () => {
  const f = await parseFile(fixturePath('explainer-minimal.html'));
  // Line 1 is `---`, frontmatter ends ~line 6, h1 around line 7-8.
  assert.ok(f.lines[0].startsWith('---'));
  // Sanity check: total lines reasonable
  assert.ok(f.lines.length >= 9);
});

test('parseFile classifies file path: chart pages get kind=chart', async () => {
  const f = await parseFile(fixturePath('chart-minimal.html'));
  assert.equal(f.kind, 'chart');
});
```

Note: the `kind` field comes from the path (anything under `charts/` is `chart`). For fixtures we'll need a separate mechanism — see Step 4.

- [ ] **Step 3: Run tests to confirm they fail**

Run: `npm run test:lint`
Expected: All six tests fail with `Cannot find module './../../parse.mjs'`.

- [ ] **Step 4: Implement parseFile**

`scripts/lint-content/parse.mjs`:
```javascript
import { readFile } from 'node:fs/promises';
import { relative, sep } from 'node:path';
import matter from 'gray-matter';
import * as cheerio from 'cheerio';

export function classifyKind(absPath, repoRoot = process.cwd()) {
  const rel = relative(repoRoot, absPath).split(sep).join('/');
  if (rel.startsWith('charts/')) return 'chart';
  if (rel === 'index.html') return 'home';
  if (rel.endsWith('.md') && rel.startsWith('data/')) return 'doc-page';
  if (/^(about|privacy|feedback|404|sitemap)\.html$/.test(rel)) return 'utility';
  if (rel.endsWith('.html')) return 'explainer';
  if (rel.endsWith('.md')) return 'doc-page';
  return 'other';
}

export async function parseFile(absPath, opts = {}) {
  const raw = await readFile(absPath, 'utf8');
  // gray-matter handles files with and without frontmatter; missing block returns {}.
  const parsed = matter(raw);
  const frontmatter = parsed.data || {};
  const html = parsed.content;
  // Cheerio loads as a document fragment (xmlMode false; we want lenient HTML parsing).
  const $ = cheerio.load(html, { xmlMode: false });
  const lines = raw.split('\n');
  const kind = opts.kindOverride || classifyKind(absPath, opts.repoRoot);
  return { path: absPath, frontmatter, html, $, lines, kind, raw };
}
```

For fixture tests, the path includes `fixtures/` so `classifyKind` returns `'other'`. The test expects `'chart'` for `chart-minimal.html` based on filename — but since the fixture is under `rules/test/fixtures/`, not `charts/`, the simple path check fails. Update the test or the fixture lookup:

Update the test at Step 2 to use `kindOverride`:
```javascript
test('parseFile classifies file path: chart pages get kind=chart', async () => {
  const f = await parseFile(fixturePath('chart-minimal.html'), { kindOverride: 'chart' });
  assert.equal(f.kind, 'chart');
});
```

- [ ] **Step 5: Run tests to confirm they pass**

Run: `npm run test:lint`
Expected: All six tests pass.

- [ ] **Step 6: Commit**

```bash
git add scripts/lint-content/parse.mjs scripts/lint-content/rules/test/parse.test.mjs scripts/lint-content/rules/test/fixtures/
git commit -m "Add parseFile wrapper for frontmatter + Cheerio + lines"
```

---

## Task 3: File walker + classifier

Walks the repo, returns the list of `.html` and `.md` files that count as "site-facing" (matches the existing `lint.yml` PATHSPEC exclusions).

**Files:**
- Create: `scripts/lint-content/walk.mjs`
- Create: `scripts/lint-content/rules/test/walk.test.mjs`

- [ ] **Step 1: Write the failing test**

`scripts/lint-content/rules/test/walk.test.mjs`:
```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findSiteFacingFiles, isSiteFacing } from '../../walk.mjs';

test('isSiteFacing accepts root-level html', () => {
  assert.equal(isSiteFacing('how-we-got-here.html'), true);
  assert.equal(isSiteFacing('charts/healthcare_costs.html'), true);
});

test('isSiteFacing rejects excluded paths', () => {
  assert.equal(isSiteFacing('README.md'), false);
  assert.equal(isSiteFacing('STYLE_GUIDE.md'), false);
  assert.equal(isSiteFacing('CLAUDE.md'), false);
  assert.equal(isSiteFacing('docs/superpowers/specs/anything.md'), false);
  assert.equal(isSiteFacing('community-pulse/anything.html'), false);
  assert.equal(isSiteFacing('.github/workflows/anything.yml'), false);
  assert.equal(isSiteFacing('data/is-the-board-trying.md'), false);
  assert.equal(isSiteFacing('data/what-have-we-tried.md'), false);
  assert.equal(isSiteFacing('data/minutes_catalog_001.md'), false);
});

test('isSiteFacing accepts data/*.md that is not catalog/excluded', () => {
  assert.equal(isSiteFacing('data/case_studies.md'), true);
  assert.equal(isSiteFacing('data/SOURCE_LOOKUP.md'), true);
});

test('isSiteFacing rejects build artifacts and node_modules', () => {
  assert.equal(isSiteFacing('_site/index.html'), false);
  assert.equal(isSiteFacing('node_modules/foo/bar.html'), false);
  assert.equal(isSiteFacing('proof/branch.png'), false);
});

test('findSiteFacingFiles returns repo files matching the rule', async () => {
  const files = await findSiteFacingFiles();
  // Sanity: at least the homepage is in there.
  assert.ok(files.some(f => f.endsWith('/index.html')), 'expected index.html');
  // And README is not.
  assert.ok(!files.some(f => f.endsWith('/README.md')), 'expected NOT README.md');
});
```

- [ ] **Step 2: Run tests to confirm they fail**

Run: `npm run test:lint`
Expected: walk tests fail with `Cannot find module '.../walk.mjs'`.

- [ ] **Step 3: Implement walk.mjs**

Mirrors the PATHSPEC exclusions from `.github/workflows/lint.yml`:

```javascript
import { readdir } from 'node:fs/promises';
import { resolve, relative, join, sep } from 'node:path';

const EXCLUDED_FILES = new Set([
  'README.md',
  'STYLE_GUIDE.md',
  'CLAUDE.md',
  'data/is-the-board-trying.md',
  'data/what-have-we-tried.md',
]);

const EXCLUDED_PREFIXES = [
  'docs/',
  'community-pulse/',
  '.github/',
  '_site/',
  'node_modules/',
  '.git/',
  'proof/',
];

export function isSiteFacing(relPath) {
  const norm = relPath.split(sep).join('/');
  if (EXCLUDED_FILES.has(norm)) return false;
  for (const prefix of EXCLUDED_PREFIXES) {
    if (norm.startsWith(prefix)) return false;
  }
  if (/^data\/minutes_catalog/.test(norm)) return false;
  if (!norm.endsWith('.html') && !norm.endsWith('.md')) return false;
  return true;
}

export async function findSiteFacingFiles(repoRoot = process.cwd()) {
  const result = [];
  async function walk(dir) {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const e of entries) {
      const full = join(dir, e.name);
      const rel = relative(repoRoot, full);
      // Prune excluded directories early.
      if (e.isDirectory()) {
        if (EXCLUDED_PREFIXES.some(p => (rel + '/').startsWith(p))) continue;
        await walk(full);
        continue;
      }
      if (isSiteFacing(rel)) result.push(resolve(full));
    }
  }
  await walk(repoRoot);
  return result.sort();
}
```

- [ ] **Step 4: Run tests to confirm they pass**

Run: `npm run test:lint`
Expected: all walk tests pass.

- [ ] **Step 5: Commit**

```bash
git add scripts/lint-content/walk.mjs scripts/lint-content/rules/test/walk.test.mjs
git commit -m "Add findSiteFacingFiles walker matching lint.yml PATHSPEC"
```

---

## Task 4: Severity model + rule runner

The runner accepts a parsed file and a list of rule objects, calls each rule's `check(file)`, collects violations, applies the severity mode (PR-1 = downgrade everything to warn), and returns the result.

**Files:**
- Create: `scripts/lint-content/severity.mjs`
- Create: `scripts/lint-content/runner.mjs`
- Create: `scripts/lint-content/rules/test/severity.test.mjs`
- Create: `scripts/lint-content/rules/test/runner.test.mjs`

- [ ] **Step 1: Write severity tests**

`scripts/lint-content/rules/test/severity.test.mjs`:
```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applySeverityMode } from '../../severity.mjs';

test('strict mode preserves block severity', () => {
  const v = { ruleId: '2.1', severity: 'block', message: 'x' };
  assert.equal(applySeverityMode(v, 'strict').severity, 'block');
});

test('warn-only mode downgrades block to warn', () => {
  const v = { ruleId: '2.1', severity: 'block', message: 'x' };
  assert.equal(applySeverityMode(v, 'warn-only').severity, 'warn');
});

test('warn-only mode preserves warn severity unchanged', () => {
  const v = { ruleId: '3.1', severity: 'warn', message: 'x' };
  assert.equal(applySeverityMode(v, 'warn-only').severity, 'warn');
});
```

- [ ] **Step 2: Write runner tests**

`scripts/lint-content/rules/test/runner.test.mjs`:
```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runRules } from '../../runner.mjs';
import { parseFile } from '../../parse.mjs';

const fixturePath = (name) => new URL(`./fixtures/${name}`, import.meta.url).pathname;

const passingRule = {
  id: '0.1',
  name: 'always-passes',
  bucket: 'test',
  severity: 'warn',
  appliesTo: () => true,
  check: () => [],
};

const failingRule = {
  id: '0.2',
  name: 'always-fails',
  bucket: 'test',
  severity: 'block',
  appliesTo: () => true,
  check: (file) => [{ line: 1, message: 'always-fails fired' }],
};

const skippedRule = {
  id: '0.3',
  name: 'never-applies',
  bucket: 'test',
  severity: 'warn',
  appliesTo: () => false,
  check: () => [{ line: 1, message: 'should not appear' }],
};

test('runRules collects violations from rules that fire', async () => {
  const file = await parseFile(fixturePath('explainer-minimal.html'));
  const violations = runRules(file, [passingRule, failingRule], { mode: 'strict' });
  assert.equal(violations.length, 1);
  assert.equal(violations[0].ruleId, '0.2');
  assert.equal(violations[0].severity, 'block');
});

test('runRules skips rules whose appliesTo returns false', async () => {
  const file = await parseFile(fixturePath('explainer-minimal.html'));
  const violations = runRules(file, [skippedRule], { mode: 'strict' });
  assert.equal(violations.length, 0);
});

test('runRules in warn-only mode downgrades block severity', async () => {
  const file = await parseFile(fixturePath('explainer-minimal.html'));
  const violations = runRules(file, [failingRule], { mode: 'warn-only' });
  assert.equal(violations[0].severity, 'warn');
});

test('runRules tags violations with file path and rule metadata', async () => {
  const file = await parseFile(fixturePath('explainer-minimal.html'));
  const violations = runRules(file, [failingRule], { mode: 'strict' });
  assert.equal(violations[0].file, file.path);
  assert.equal(violations[0].ruleName, 'always-fails');
  assert.equal(violations[0].bucket, 'test');
});
```

- [ ] **Step 3: Run tests to confirm they fail**

Run: `npm run test:lint`
Expected: severity + runner tests fail with `Cannot find module`.

- [ ] **Step 4: Implement severity.mjs**

`scripts/lint-content/severity.mjs`:
```javascript
// Severity model.
//
// A rule's static severity is what it would block on if released to its
// final form. The runtime mode determines how the linter actually treats
// the violation.
//
// - 'strict' mode: severity reported as-is (used post-PR-9, after the
//   final rollout flips block-marked rules to actually-blocking).
// - 'warn-only' mode: every violation reported as 'warn' regardless of
//   the rule's static severity (used during PR 1 so we get the inventory
//   without breaking CI).

export const MODES = ['strict', 'warn-only'];

export function applySeverityMode(violation, mode) {
  if (mode === 'warn-only') {
    return { ...violation, severity: 'warn' };
  }
  return violation;
}
```

- [ ] **Step 5: Implement runner.mjs**

`scripts/lint-content/runner.mjs`:
```javascript
import { applySeverityMode } from './severity.mjs';

export function runRules(file, rules, options = {}) {
  const mode = options.mode || 'strict';
  const violations = [];
  for (const rule of rules) {
    if (!rule.appliesTo(file)) continue;
    const ruleViolations = rule.check(file, options) || [];
    for (const v of ruleViolations) {
      const tagged = {
        ruleId: rule.id,
        ruleName: rule.name,
        bucket: rule.bucket,
        severity: rule.severity,
        file: file.path,
        line: v.line ?? 1,
        message: v.message,
      };
      violations.push(applySeverityMode(tagged, mode));
    }
  }
  return violations;
}
```

- [ ] **Step 6: Run tests to confirm they pass**

Run: `npm run test:lint`
Expected: all severity + runner tests pass.

- [ ] **Step 7: Commit**

```bash
git add scripts/lint-content/severity.mjs scripts/lint-content/runner.mjs \
       scripts/lint-content/rules/test/severity.test.mjs \
       scripts/lint-content/rules/test/runner.test.mjs
git commit -m "Add rule runner with severity-mode support (warn-only / strict)"
```

---

## Task 5: GitHub Actions reporter

Formats violations as GitHub Actions workflow commands so they appear as inline PR annotations.

**Files:**
- Create: `scripts/lint-content/report.mjs`
- Create: `scripts/lint-content/rules/test/report.test.mjs`

- [ ] **Step 1: Write the failing tests**

`scripts/lint-content/rules/test/report.test.mjs`:
```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatViolation, summarize } from '../../report.mjs';

test('formatViolation emits ::warning format for warn severity', () => {
  const v = {
    ruleId: '1.2', ruleName: 'chart-aria-label-required', bucket: 'chart-anatomy',
    severity: 'warn', file: '/abs/path/charts/x.html', line: 12,
    message: 'svg missing aria-label',
  };
  const out = formatViolation(v, '/abs');
  assert.match(out, /^::warning /);
  assert.match(out, /file=path\/charts\/x\.html/);
  assert.match(out, /line=12/);
  assert.match(out, /title=\[1\.2 chart-aria-label-required\]/);
  assert.match(out, /::svg missing aria-label$/);
});

test('formatViolation emits ::error format for block severity', () => {
  const v = {
    ruleId: '2.1', ruleName: 'h2-id-required', bucket: 'section-structure',
    severity: 'block', file: '/abs/foo.html', line: 5, message: 'h2 needs id',
  };
  const out = formatViolation(v, '/abs');
  assert.match(out, /^::error /);
});

test('summarize counts violations by severity', () => {
  const violations = [
    { severity: 'warn' }, { severity: 'warn' }, { severity: 'block' },
  ];
  const s = summarize(violations);
  assert.equal(s.warn, 2);
  assert.equal(s.block, 1);
  assert.equal(s.total, 3);
});

test('formatViolation escapes special chars in message', () => {
  const v = {
    ruleId: '0.0', ruleName: 'x', bucket: 'y', severity: 'warn',
    file: '/abs/foo.html', line: 1,
    message: 'has\nnewline and %colon : equals=',
  };
  const out = formatViolation(v, '/abs');
  // Newlines must be encoded as %0A; colons inside the title block are OK
  // but in the body they need %3A. The body is everything after the final ::.
  assert.match(out, /%0A/);
  // No literal newline in output (output is one line).
  assert.equal(out.split('\n').length, 1);
});
```

- [ ] **Step 2: Run tests to confirm they fail**

Run: `npm run test:lint`
Expected: report tests fail.

- [ ] **Step 3: Implement report.mjs**

```javascript
import { relative } from 'node:path';

// GitHub Actions workflow commands need %-encoding for : , % and \r \n.
// Reference: https://docs.github.com/en/actions/using-workflows/workflow-commands-for-github-actions
function encodeProperty(s) {
  return String(s).replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A').replace(/:/g, '%3A').replace(/,/g, '%2C');
}
function encodeData(s) {
  return String(s).replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
}

export function formatViolation(violation, repoRoot = process.cwd()) {
  const cmd = violation.severity === 'block' ? 'error' : 'warning';
  const relPath = relative(repoRoot, violation.file);
  const title = `[${violation.ruleId} ${violation.ruleName}]`;
  const props = [
    `file=${encodeProperty(relPath)}`,
    `line=${violation.line}`,
    `title=${encodeProperty(title)}`,
  ].join(',');
  return `::${cmd} ${props}::${encodeData(violation.message)}`;
}

export function summarize(violations) {
  const s = { warn: 0, block: 0, total: 0 };
  for (const v of violations) {
    s[v.severity] = (s[v.severity] || 0) + 1;
    s.total += 1;
  }
  return s;
}
```

- [ ] **Step 4: Run tests to confirm they pass**

Run: `npm run test:lint`
Expected: all report tests pass.

- [ ] **Step 5: Commit**

```bash
git add scripts/lint-content/report.mjs scripts/lint-content/rules/test/report.test.mjs
git commit -m "Add GitHub Actions reporter (workflow commands for PR annotations)"
```

---

## Task 6: Bucket 1 (chart anatomy) — all 8 rules

The first bucket of real rules. Each rule is a small object exporting `{id, name, bucket, severity, appliesTo, check}`. All eight from the spec.

**Files:**
- Create: `scripts/lint-content/rules/bucket1-charts.mjs`
- Create: `scripts/lint-content/rules/index.mjs`
- Create: `scripts/lint-content/rules/test/bucket1-charts.test.mjs`
- Create: `scripts/lint-content/rules/test/fixtures/chart-no-aria.html`
- Create: `scripts/lint-content/rules/test/fixtures/chart-inline-svg-style.html`
- Create: `scripts/lint-content/rules/test/fixtures/chart-no-axis.html`
- Create: `scripts/lint-content/rules/test/fixtures/chart-page-style-block.html`
- Create: `scripts/lint-content/rules/test/fixtures/chart-narrow-wrapper.html`
- Create: `scripts/lint-content/rules/test/fixtures/chart-bad-casing.html`

- [ ] **Step 1: Create failing fixtures**

`chart-no-aria.html` (rule 1.2 fixture — svg missing aria-label):
```html
---
title: "Test Chart"
---
<h1 class="h-center">Test Chart</h1>
<svg class="chart" viewBox="0 0 400 200">
  <line class="axis-base" x1="40" y1="160" x2="360" y2="160"/>
  <text class="tick-label" x="40" y="180">A</text>
  <text class="tick-label" x="360" y="180">B</text>
</svg>
```

`chart-inline-svg-style.html` (rule 1.5 fixture — inline style on svg child):
```html
---
title: "Test Chart"
---
<h1 class="h-center">Test Chart</h1>
<svg class="chart" viewBox="0 0 400 200" aria-label="x">
  <line class="axis-base" x1="40" y1="160" x2="360" y2="160"/>
  <text class="tick-label" x="40" y="180">A</text>
  <text class="tick-label" x="360" y="180">B</text>
  <line class="annotation-line" x1="200" y1="20" x2="200" y2="160" style="stroke-dasharray: 2 4"/>
</svg>
```

`chart-no-axis.html` (rule 1.6 fixture — svg missing axis-base + tick-labels):
```html
---
title: "Test Chart"
---
<h1 class="h-center">Test Chart</h1>
<svg class="chart" viewBox="0 0 400 200" aria-label="x">
  <polyline class="data-line" points="40,160 360,40"/>
</svg>
```

`chart-page-style-block.html` (rule 1.3 fixture — page-local methodology styling):
```html
---
title: "Test Chart"
---
<style>
details.notes summary { font-weight: 700; color: var(--text); padding: 8px 0; }
details.notes p { font-size: 12px; }
</style>
<h1 class="h-center">Test Chart</h1>
<svg class="chart" viewBox="0 0 400 200" aria-label="x">
  <line class="axis-base" x1="40" y1="160" x2="360" y2="160"/>
  <text class="tick-label" x="40" y="180">A</text>
  <text class="tick-label" x="360" y="180">B</text>
</svg>
```

`chart-bad-casing.html` (rule 1.8 fixture — frontmatter title doesn't match h1 casing):
```html
---
title: "test chart"
---
<h1 class="h-center">Test Chart</h1>
<svg class="chart" viewBox="0 0 400 200" aria-label="x">
  <line class="axis-base" x1="40" y1="160" x2="360" y2="160"/>
  <text class="tick-label" x="40" y="180">A</text>
  <text class="tick-label" x="360" y="180">B</text>
</svg>
```

- [ ] **Step 2: Write tests for all 8 rules**

`scripts/lint-content/rules/test/bucket1-charts.test.mjs`:
```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseFile } from '../../parse.mjs';
import { runRules } from '../../runner.mjs';
import bucket1 from '../bucket1-charts.mjs';

const fp = (name) => new URL(`./fixtures/${name}`, import.meta.url).pathname;

async function load(name, kind = 'chart') {
  return parseFile(fp(name), { kindOverride: kind });
}

function rule(id) { return bucket1.find(r => r.id === id); }

test('rule 1.2 — chart sub-section without aria-label flags', async () => {
  const file = await load('chart-no-aria.html');
  const v = runRules(file, [rule('1.2')], { mode: 'strict' });
  assert.equal(v.length, 1);
  assert.match(v[0].message, /aria-label/);
});

test('rule 1.2 — chart with aria-label passes', async () => {
  const file = await load('chart-minimal.html');
  const v = runRules(file, [rule('1.2')], { mode: 'strict' });
  assert.equal(v.length, 0);
});

test('rule 1.3 — page-local <style> defining details.notes flags', async () => {
  const file = await load('chart-page-style-block.html');
  const v = runRules(file, [rule('1.3')], { mode: 'strict' });
  assert.equal(v.length, 1);
});

test('rule 1.3 — chart without per-page methodology style passes', async () => {
  const file = await load('chart-minimal.html');
  const v = runRules(file, [rule('1.3')], { mode: 'strict' });
  assert.equal(v.length, 0);
});

test('rule 1.5 — inline style on svg child element flags', async () => {
  const file = await load('chart-inline-svg-style.html');
  const v = runRules(file, [rule('1.5')], { mode: 'strict' });
  assert.equal(v.length, 1);
  assert.match(v[0].message, /style=/);
});

test('rule 1.5 — clean svg passes', async () => {
  const file = await load('chart-minimal.html');
  const v = runRules(file, [rule('1.5')], { mode: 'strict' });
  assert.equal(v.length, 0);
});

test('rule 1.6 — chart svg without axis-base or tick-labels flags', async () => {
  const file = await load('chart-no-axis.html');
  const v = runRules(file, [rule('1.6')], { mode: 'strict' });
  assert.equal(v.length, 1);
});

test('rule 1.6 — chart with axis and tick-labels passes', async () => {
  const file = await load('chart-minimal.html');
  const v = runRules(file, [rule('1.6')], { mode: 'strict' });
  assert.equal(v.length, 0);
});

test('rule 1.8 — frontmatter title casing not matching h1 flags', async () => {
  const file = await load('chart-bad-casing.html');
  const v = runRules(file, [rule('1.8')], { mode: 'strict' });
  assert.equal(v.length, 1);
});

test('rule 1.8 — matching casing passes', async () => {
  const file = await load('chart-minimal.html');
  const v = runRules(file, [rule('1.8')], { mode: 'strict' });
  assert.equal(v.length, 0);
});

test('rule 1.1 — chart page without {% include chart.html %} flags warn', async () => {
  // This rule warns when a chart page hand-rolls the wrapping markup.
  // For PR 1a we detect "chart page that has an SVG but no chart-include
  // marker comment" — phase-1 detection only. The fixture chart-minimal
  // pre-dates the include, so it should flag.
  const file = await load('chart-minimal.html');
  const v = runRules(file, [rule('1.1')], { mode: 'strict' });
  assert.equal(v.length, 1, 'expected warn for not using chart include');
});

test('rule 1.4 — chart-source class not present on chart page flags', async () => {
  const file = await load('chart-minimal.html');
  const v = runRules(file, [rule('1.4')], { mode: 'strict' });
  // Source-line rule warns when the chart page has no .chart-source element.
  assert.equal(v.length, 1);
});

test('rule 1.7 — chart-wrapper without overflow-x rule warns (one violation per page max)', async () => {
  // Detection: page has a chart-wrapper but no css class that would scroll
  // it. Phase-1: warn once per page if a .chart-wrapper exists. (CSS lands
  // in PR 3; this rule is dormant until then but still emits inventory.)
  const file = await load('chart-minimal.html');
  const v = runRules(file, [rule('1.7')], { mode: 'strict' });
  assert.equal(v.length, 1);
});
```

Notes on rules that overlap with future PRs:
- Rule 1.1 (chart-include-required) detects "no `{% include chart.html %}` in source" — looking for the literal string `include chart.html`. Until PR 3 adds the include, every chart page will warn. That's the *intent* — it inventories who needs migration.
- Rule 1.4 (chart-source class) detects absence of `.chart-source` class. Same logic — until PR 3 adds the CSS class, this is the inventory of charts that need migration.
- Rule 1.7 (mobile chart wrapper overflow) — the CSS rule lives in PR 3. The lint rule warns now to inventory which charts need testing.

- [ ] **Step 3: Run tests to confirm they fail**

Run: `npm run test:lint`
Expected: bucket1 tests fail with `Cannot find module './bucket1-charts.mjs'`.

- [ ] **Step 4: Implement Bucket 1 rules**

`scripts/lint-content/rules/bucket1-charts.mjs`:
```javascript
// Bucket 1: chart anatomy.
// Spec: docs/superpowers/specs/2026-05-02-style-rule-enforcement-design.md
//
// Each rule is appliesTo a "chart" file. Standalone chart pages live under
// charts/. Embedded charts inside explainer pages are out of scope for this
// bucket's appliesTo (they fall under 'explainer'); rule 1.2 (aria-label)
// will catch them in bucket 2 cross-cutting passes if needed.

const isChart = (file) => file.kind === 'chart';

// Helper: locate a Cheerio node and return its 1-based source line by
// matching the unique attribute combo or fallback to scanning. Cheerio
// does not carry source positions; we find the line by re-scanning the
// raw text. Best-effort: the message identifies the rule, the line is
// approximate.
function lineForElement($el, rawLines, fallback = 1) {
  const html = $el.toString().split('\n')[0];
  const needle = html.slice(0, 80);
  for (let i = 0; i < rawLines.length; i++) {
    if (rawLines[i].includes(needle.slice(0, 30))) return i + 1;
  }
  return fallback;
}

const rules = [
  {
    id: '1.1',
    name: 'chart-include-required',
    bucket: 'chart-anatomy',
    severity: 'warn',
    appliesTo: isChart,
    check(file) {
      // Until PR 3 lands the include, chart pages hand-roll the wrapping.
      // This rule inventories charts that need migration.
      if (file.raw.includes('include chart.html')) return [];
      // Only flag if the page actually has a chart svg (otherwise it's not
      // a chart sub-section, just a chart-page wrapper without a chart).
      if (file.$('svg.chart').length === 0) return [];
      return [{ line: 1, message: 'Chart page does not use {% include chart.html %} (PR 3 introduces the include; this is an inventory warn).' }];
    },
  },
  {
    id: '1.2',
    name: 'chart-aria-label-required',
    bucket: 'chart-anatomy',
    severity: 'block',
    appliesTo: isChart,
    check(file) {
      const violations = [];
      file.$('svg.chart').each((_, el) => {
        const $el = file.$(el);
        const label = ($el.attr('aria-label') || '').trim();
        if (!label) {
          violations.push({
            line: lineForElement($el, file.lines),
            message: '<svg class="chart"> requires a non-empty aria-label.',
          });
        }
      });
      return violations;
    },
  },
  {
    id: '1.3',
    name: 'chart-no-page-local-methodology-style',
    bucket: 'chart-anatomy',
    severity: 'warn',
    appliesTo: isChart,
    check(file) {
      const violations = [];
      file.$('style').each((_, el) => {
        const css = file.$(el).text();
        // Phase-1 detection: a per-page style block defining details.notes
        // or dl.defined-terms means the page is reinventing the methodology
        // drawer. PR 3 moves this into site.css.
        if (/details\.notes\b|dl\.defined-terms\b/.test(css)) {
          violations.push({
            line: lineForElement(file.$(el), file.lines),
            message: 'Per-page <style> block defining methodology drawer (details.notes / dl.defined-terms). Move to assets/site.css when PR 3 lands.',
          });
        }
      });
      return violations;
    },
  },
  {
    id: '1.4',
    name: 'chart-source-class-required',
    bucket: 'chart-anatomy',
    severity: 'warn',
    appliesTo: isChart,
    check(file) {
      // Phase-1: warn if a chart page has no .chart-source element. PR 3
      // adds the canonical class; the include in PR 3 emits it.
      if (file.$('svg.chart').length === 0) return [];
      if (file.$('.chart-source').length > 0) return [];
      return [{
        line: 1,
        message: 'Chart page has no .chart-source element (canonical source line treatment lands in PR 3).',
      }];
    },
  },
  {
    id: '1.5',
    name: 'chart-no-inline-svg-style',
    bucket: 'chart-anatomy',
    severity: 'warn',
    appliesTo: isChart,
    check(file) {
      const violations = [];
      file.$('svg.chart').each((_, svg) => {
        file.$(svg).find('[style]').each((_, child) => {
          const $c = file.$(child);
          violations.push({
            line: lineForElement($c, file.lines),
            message: `Inline style="" on <${child.tagName}> inside <svg class="chart"> — use a CSS class instead.`,
          });
        });
      });
      return violations;
    },
  },
  {
    id: '1.6',
    name: 'chart-axis-baseline-and-ticks-required',
    bucket: 'chart-anatomy',
    severity: 'warn',
    appliesTo: isChart,
    check(file) {
      const violations = [];
      file.$('svg.chart').each((_, svg) => {
        const $svg = file.$(svg);
        const hasAxis = $svg.find('line.axis-base').length >= 1;
        const tickLabelCount = $svg.find('text.tick-label').length;
        if (!hasAxis || tickLabelCount < 2) {
          violations.push({
            line: lineForElement($svg, file.lines),
            message: '<svg class="chart"> needs at least one <line class="axis-base"> and ≥2 <text class="tick-label"> elements.',
          });
        }
      });
      return violations;
    },
  },
  {
    id: '1.7',
    name: 'chart-wrapper-mobile-overflow-inventory',
    bucket: 'chart-anatomy',
    severity: 'warn',
    appliesTo: isChart,
    check(file) {
      // Phase-1: inventory which chart pages have .chart-wrapper. PR 3
      // adds the overflow-x:auto CSS rule that all .chart-wrapper inherit.
      // After PR 3 this rule's check() returns []; until then, every
      // chart with a wrapper warns once so we know the surface area.
      if (file.$('.chart-wrapper').length === 0) return [];
      return [{
        line: 1,
        message: 'Chart page uses .chart-wrapper. Mobile overflow CSS lands in PR 3; this is an inventory warn.',
      }];
    },
  },
  {
    id: '1.8',
    name: 'chart-frontmatter-title-h1-casing-match',
    bucket: 'chart-anatomy',
    severity: 'warn',
    appliesTo: isChart,
    check(file) {
      const fmTitle = (file.frontmatter.title || '').trim();
      const $h1 = file.$('h1').first();
      if (!fmTitle || $h1.length === 0) return [];
      const h1Text = $h1.text().trim();
      // Style guide: chart pages use Title Case. Detect casing mismatch
      // by checking whether one is all-lowercase first-word and the
      // other is initial-caps first-word.
      const fmFirstWordCap = /^[A-Z]/.test(fmTitle);
      const h1FirstWordCap = /^[A-Z]/.test(h1Text);
      if (fmFirstWordCap !== h1FirstWordCap) {
        return [{
          line: 1,
          message: `Frontmatter title "${fmTitle}" casing does not match <h1> "${h1Text}".`,
        }];
      }
      return [];
    },
  },
];

export default rules;
```

- [ ] **Step 5: Implement rules/index.mjs**

`scripts/lint-content/rules/index.mjs`:
```javascript
import bucket1 from './bucket1-charts.mjs';

export default [
  ...bucket1,
];
```

(Subsequent plans add bucket2, bucket3, etc. to the spread.)

- [ ] **Step 6: Run tests to confirm they pass**

Run: `npm run test:lint`
Expected: all 14 bucket-1 assertion-blocks pass; previous tests still pass.

If a test fails, the most likely cause is the `lineForElement` heuristic returning an unexpected line number. Loosen the test (`assert.ok(v[0].line > 0)`) only if the rule's logic is correct and the line is the only mismatch.

- [ ] **Step 7: Commit**

```bash
git add scripts/lint-content/rules/bucket1-charts.mjs \
       scripts/lint-content/rules/index.mjs \
       scripts/lint-content/rules/test/bucket1-charts.test.mjs \
       scripts/lint-content/rules/test/fixtures/chart-no-aria.html \
       scripts/lint-content/rules/test/fixtures/chart-inline-svg-style.html \
       scripts/lint-content/rules/test/fixtures/chart-no-axis.html \
       scripts/lint-content/rules/test/fixtures/chart-page-style-block.html \
       scripts/lint-content/rules/test/fixtures/chart-bad-casing.html
git commit -m "Add Bucket 1 (chart anatomy): 8 rules + fixtures + tests"
```

---

## Task 7: CLI entry point

The script that GitHub Actions invokes. Walks site-facing files, parses each, runs rules in warn-only mode (PR-1 default), prints workflow commands.

**Files:**
- Create: `scripts/lint-content.mjs`

- [ ] **Step 1: Implement the CLI**

`scripts/lint-content.mjs`:
```javascript
#!/usr/bin/env node
// Content linter for marbleheaddata.org.
//
// Spec: docs/superpowers/specs/2026-05-02-style-rule-enforcement-design.md
//
// Usage:
//   node scripts/lint-content.mjs              # warn-only mode (PR-1 default)
//   node scripts/lint-content.mjs --strict     # strict mode (post-PR-9)
//   node scripts/lint-content.mjs --files a.html b.html  # only these files

import { parseArgs } from 'node:util';
import process from 'node:process';
import { findSiteFacingFiles } from './lint-content/walk.mjs';
import { parseFile } from './lint-content/parse.mjs';
import { runRules } from './lint-content/runner.mjs';
import { formatViolation, summarize } from './lint-content/report.mjs';
import allRules from './lint-content/rules/index.mjs';

const { values: opts } = parseArgs({
  options: {
    strict: { type: 'boolean', default: false },
    files: { type: 'string', multiple: true },
    help: { type: 'boolean', short: 'h' },
  },
});

if (opts.help) {
  console.log('Usage: node scripts/lint-content.mjs [--strict] [--files a.html b.html]');
  process.exit(0);
}

const mode = opts.strict ? 'strict' : 'warn-only';
const repoRoot = process.cwd();

async function main() {
  const files = opts.files && opts.files.length
    ? opts.files.map(f => new URL(`file://${repoRoot}/${f}`).pathname)
    : await findSiteFacingFiles(repoRoot);

  const allViolations = [];
  for (const path of files) {
    const file = await parseFile(path, { repoRoot });
    const violations = runRules(file, allRules, { mode });
    allViolations.push(...violations);
  }

  for (const v of allViolations) {
    console.log(formatViolation(v, repoRoot));
  }

  const summary = summarize(allViolations);
  console.log(`\nLint summary: ${summary.total} violations (${summary.block} block, ${summary.warn} warn) across ${files.length} files.`);

  // In warn-only mode, exit 0 regardless of violations. In strict mode,
  // exit 1 if any block-severity violation fired.
  if (mode === 'strict' && summary.block > 0) process.exit(1);
}

await main();
```

- [ ] **Step 2: Smoke-test against the real repo**

Run: `npm run lint:content`

Expected:
- Outputs a series of `::warning ...` lines, one per chart page that has an SVG without aria-label, missing axis labels, missing chart-source class, etc.
- Final summary line: `Lint summary: N violations (0 block, N warn) across M files.` where M is roughly the count of `*.html` + `*.md` files at the root + `charts/` + relevant `data/`.
- Exit code 0.

If it crashes:
- Check the file currently choking by adding `console.error('Parsing', path)` at the top of the loop, re-running, and noting the last filename printed.
- Most likely culprits: a file with frontmatter `---` not closed properly, or a rule's Cheerio query throwing on unusual markup.

- [ ] **Step 3: Confirm against the existing four_town_rates fixture**

Run: `npm run lint:content -- --files charts/four_town_rates.html`

Expected: at minimum, rule 1.3 fires (page has a `<style>` block defining `details.notes`) and rule 1.5 fires (svg has inline `style="stroke-dasharray:2 4"` annotations).

This is the smoke test that the architecture works against real production code.

- [ ] **Step 4: Commit**

```bash
git add scripts/lint-content.mjs
git commit -m "Add scripts/lint-content.mjs CLI entry point (warn-only by default)"
```

---

## Task 8: GitHub Actions integration

Add a third job to the existing `.github/workflows/lint.yml` that runs the new linter on PRs.

**Files:**
- Modify: `.github/workflows/lint.yml`

- [ ] **Step 1: Read the current workflow**

Read `.github/workflows/lint.yml`. Confirm jobs are `secrets` and `content`. The new job adds alongside, not inside.

- [ ] **Step 2: Add the new job**

Append at the end of the `jobs:` block, before the file ends:

```yaml
  content-rules:
    name: Content style rules
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
          ref: ${{ github.event.pull_request.head.sha }}

      - name: Use Node.js 24
        uses: actions/setup-node@v4
        with:
          node-version: '24'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run content linter (warn-only mode)
        run: npm run lint:content
```

The workflow already has `permissions: contents: read`, which is enough — workflow commands (`::warning ...`) don't need additional permissions.

- [ ] **Step 3: Run tests locally one more time**

Run: `npm run test:lint`
Expected: all tests pass.

Run: `npm run lint:content`
Expected: outputs warnings, exits 0.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/lint.yml
git commit -m "Run scripts/lint-content.mjs as third Lint job in CI"
```

- [ ] **Step 5: Push and open PR**

```bash
git push -u origin worktree-bridge-cse_01EVjhhyHasB3yoNh6Vu7Mdk
```

Then open a PR with title `Add content linter (Bucket 1: chart anatomy)`. PR body must include:

- **Summary**: scaffolding for the content linter; Bucket 1 (chart anatomy) rules implemented; runs as a new CI job in warn-only mode (does not fail CI).
- **Test plan**: list each rule (1.1–1.8) with how to verify locally (`npm run test:lint`).
- **Proof of Work**: paste the local `npm run lint:content` summary line, e.g. `Lint summary: 47 violations (0 block, 47 warn) across 51 files.`
- **Preview URL**: not applicable for a CI-only change; note explicitly.

The PR's CI run will produce a flood of inline `::warning` annotations against the existing repo content. That is the **inventory deliverable** — copy the summary count into the PR body so we can compare across follow-up plans (Buckets 2–6) as the rule set expands.

---

## Self-Review

After completing all tasks above, run this checklist:

**1. Spec coverage:** every Bucket 1 rule in `docs/superpowers/specs/2026-05-02-style-rule-enforcement-design.md` (1.1 through 1.8) has an entry in `bucket1-charts.mjs` and at least one passing + one failing test in `bucket1-charts.test.mjs`. The architecture (parser, walker, runner, severity, reporter) supports the remaining buckets without further changes.

**2. Type consistency:** every rule object exports `{id, name, bucket, severity, appliesTo, check}`. Every violation object has `{ruleId, ruleName, bucket, severity, file, line, message}`. The runner enforces this shape via Step 5 of Task 4.

**3. Placeholder scan:** no `TODO`, `TBD`, `placeholder` strings in any committed file. Verify with `grep -rn 'TODO\|TBD\|placeholder' scripts/lint-content/`.

**4. Tests run clean:** `npm run test:lint` passes; `npm run lint:content` exits 0 with a non-empty summary.

---

## What's deferred to follow-up plans

This plan is scoped to **PR 1a**: linter architecture + Bucket 1. Follow-up plans:

- **PR 1b**: Bucket 2 (section structure, 8 rules). Adds `bucket2-sections.mjs`, fixtures, tests.
- **PR 1c**: Bucket 3 (reading flow, 8 rules).
- **PR 1d**: Bucket 4 (tables, 6 rules).
- **PR 1e**: Bucket 5 (callouts, 7 rules).
- **PR 1f**: Bucket 6 (page chrome, 7 rules).

After 1a–1f land, the original spec's:

- **PR 2** (rule revisions based on inventory) — written then.
- **PR 3** (Liquid includes + CSS) — separate plan.
- **PRs 4–8** (page migrations) — one plan each.
- **PR 9** (severity flip from warn to block) — final plan.

Each follow-up plan reuses the architecture from this one. The pattern in Task 6 (fixtures + tests + rule object) is the template for every subsequent bucket.
