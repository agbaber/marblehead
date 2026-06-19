// tests/og-cards.test.mjs
// Asserts every tool page in the list has og_title, og_description,
// og_image set in frontmatter, and that the referenced og_image PNG
// exists in the repo. Runs under `node --test`.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const PAGES = [
  'checkbook.html',
  'town-budget.html',
  'town-debt.html',
  'where-has-the-money-gone.html',
  'senior-tax-relief.html',
  'inside-school-staffing.html',
  'school-building-maintenance.html',
  'org-chart.html',
  'branches.html',
  'meetings.html',
];

function readFrontmatter(absPath) {
  const src = fs.readFileSync(absPath, 'utf8');
  const match = src.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};
  const out = {};
  for (const line of match[1].split('\n')) {
    const m = line.match(/^([a-z_]+):\s*(.+?)\s*$/);
    if (!m) continue;
    let value = m[2];
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    out[m[1]] = value;
  }
  return out;
}

for (const page of PAGES) {
  test(`${page} has complete OG frontmatter and image asset`, () => {
    const fm = readFrontmatter(path.join(ROOT, page));
    assert.ok(fm.og_title, `${page}: missing og_title`);
    assert.ok(fm.og_description, `${page}: missing og_description`);
    assert.ok(fm.og_image, `${page}: missing og_image`);

    const imgRel = fm.og_image.replace(/^\//, '');
    const imgAbs = path.join(ROOT, imgRel);
    assert.ok(
      fs.existsSync(imgAbs),
      `${page}: og_image points to ${fm.og_image} which does not exist`,
    );
  });
}
