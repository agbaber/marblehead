/**
 * Smoke test for school-building-maintenance.html
 *
 * Run with:
 *   node tests/school-building-maintenance.test.mjs
 *
 * Convention matches tests/smoke-test.mjs: bare Playwright, no test
 * framework, pass/fail counters.
 */
import { chromium } from 'playwright';

const SITE = process.env.SITE || 'http://localhost:4000';
const URL = SITE + '/school-building-maintenance.html';

let passed = 0;
let failed = 0;
function ok(name) { passed++; console.log(`  PASS: ${name}`); }
function fail(name, detail) { failed++; console.log(`  FAIL: ${name} — ${detail}`); }

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  await page.goto(URL, { waitUntil: 'domcontentloaded' });

  // Skeleton
  const h1 = await page.textContent('h1');
  h1 && h1.includes('School building maintenance')
    ? ok('h1 reads "School building maintenance"')
    : fail('h1', `expected "School building maintenance", got "${h1}"`);

  const pageLead = await page.$('.page-lead');
  pageLead ? ok('.page-lead present') : fail('.page-lead', 'missing');

  await browser.close();
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
})();
