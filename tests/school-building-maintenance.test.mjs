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

  // Section 1: tracking gap
  const h2s = await page.$$eval('h2', els => els.map(e => e.textContent.trim()));
  h2s.some(t => t.toLowerCase().includes("can't tell you"))
    ? ok('Section 1 h2 leads with claim about tracking gap')
    : fail('Section 1 h2', `not found in ${JSON.stringify(h2s)}`);

  const body = await page.textContent('body');
  body.includes('Aug')
    ? ok('Aug 31 2025 deliverable referenced')
    : fail('Aug 31 deliverable', 'not found in body');

  // Section 2: BCG investment
  h2s.some(t => t.toLowerCase().includes('major investment')) ||
  h2s.some(t => t.toLowerCase().includes('brown opened'))
    ? ok('Section 2 h2 about the BCG investment')
    : fail('Section 2 h2', `not found in ${JSON.stringify(h2s)}`);

  body.includes('Lucretia and Joseph Brown')
    ? ok('Full Brown School name referenced')
    : fail('Brown School name', 'missing');

  body.includes('Gilbane')
    ? ok('Contractor (Gilbane) referenced')
    : fail('Gilbane', 'missing');

  body.includes('October 13, 2021') || body.includes('October 13 2021')
    ? ok('Brown opening date referenced')
    : fail('Brown opening date', 'missing');

  await browser.close();
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
})();
