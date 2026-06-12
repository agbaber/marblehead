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

  // Section 3: 2021 baseline scope
  h2s.some(t => t.toLowerCase().includes('2021 baseline'))
    ? ok('Section 3 h2 about the 2021 baseline')
    : fail('Section 3 h2', `not found in ${JSON.stringify(h2s)}`);

  const brownGap = await page.$('.sbm-brown-gap');
  brownGap ? ok('Brown-gap callout present (.sbm-brown-gap)') : fail('Brown-gap callout', 'missing');

  // Section 4: backlog chart
  const barChart = await page.$('svg.sbm-bar-chart');
  barChart ? ok('Bar chart SVG present') : fail('Bar chart SVG', 'missing .sbm-bar-chart');

  const caveatBanner = await page.$('.sbm-caveat-banner');
  caveatBanner ? ok('Bar chart caveat banner present') : fail('caveat banner', 'missing');

  // Building rows shown in chart
  const barLabels = await page.$$eval('.sbm-bar-label', els => els.map(e => e.textContent.trim()));
  ['High School', 'Veterans', 'Village', 'Glover', 'Brown'].every(b => barLabels.some(l => l.includes(b)))
    ? ok('All 5 operating schools appear as chart rows')
    : fail('chart rows', `expected 5 building labels, got ${JSON.stringify(barLabels)}`);

  const tableRows = await page.$$('.sbm-table tbody tr');
  tableRows.length >= 14
    ? ok(`Itemized table has ${tableRows.length} rows`)
    : fail('Itemized table', `expected >= 14 rows, got ${tableRows.length}`);

  body.includes('Tennis Courts')
    ? ok('Tennis Courts (HS item) appears in table')
    : fail('Tennis Courts', 'missing');

  h2s.some(t => t.toLowerCase().includes('former school buildings'))
    ? ok('Section 5 h2 about former school buildings')
    : fail('Section 5 h2', `not found in ${JSON.stringify(h2s)}`);

  body.includes('Harborlight Homes')
    ? ok('Coffin Adaptive Reuse / Harborlight reference present')
    : fail('Harborlight Homes', 'missing');

  body.includes('Eveleth')
    ? ok('Eveleth building referenced')
    : fail('Eveleth', 'missing');

  body.includes('buckets and mops')
    ? ok('Sarah Fox walking-tour direct quote present')
    : fail('walking-tour quote', 'missing');

  body.includes('weep holes') || body.includes('drainage holes')
    ? ok('Veterans D-wing contractor-error detail present')
    : fail('Veterans D-wing', 'missing');

  h2s.some(t => t.toLowerCase().includes('paid for') || t.toLowerCase().includes('how it gets paid'))
    ? ok('Section 7 h2 about funding')
    : fail('Section 7 h2', `not found in ${JSON.stringify(h2s)}`);

  body.includes('$500K') || body.includes('$500,000')
    ? ok('$500K/yr building capital fund (Tier 3) referenced')
    : fail('building capital fund', 'missing');

  body.includes('1.0 maintenance') || body.includes('maintenance position')
    ? ok('FY27 maintenance-position cut referenced')
    : fail('maintenance cut', 'missing');

  h2s.some(t => t.toLowerCase().includes("actually moving") || t.toLowerCase().includes("what's moving") || t.toLowerCase().includes("what is moving"))
    ? ok('Section 8 h2 about what is moving')
    : fail('Section 8 h2', `not found in ${JSON.stringify(h2s)}`);

  body.includes('summer 2026')
    ? ok('Summer 2026 HS roof construction referenced')
    : fail('summer 2026 roof', 'missing');

  await browser.close();
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
})();
