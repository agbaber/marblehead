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

  // Key stats
  const keyStatLabels = await page.$$eval('.key-stats .key-stat-label', els => els.map(e => e.textContent.trim()));
  keyStatLabels.length === 4
    ? ok('4 key stats present')
    : fail('key stats count', `expected 4, got ${keyStatLabels.length}`);

  const keyStatValues = await page.$$eval('.key-stats .key-stat-value', els => els.map(e => e.textContent.trim()));
  keyStatValues.includes('$42M')
    ? ok('$42M key stat present')
    : fail('$42M key stat', 'missing');
  keyStatValues.includes('FY27')
    ? ok('FY27 key stat present')
    : fail('FY27 key stat', 'missing');

  await browser.close();
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
})();
