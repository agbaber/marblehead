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
  keyStatValues.includes('$55M')
    ? ok('$55M key stat present')
    : fail('$55M key stat', 'missing');
  keyStatValues.includes('FY27')
    ? ok('FY27 key stat present')
    : fail('FY27 key stat', 'missing');

  // Three top-level sections: Know / Don't Know / Find Out
  const h2s = await page.$$eval('h2', els => els.map(e => e.textContent.trim()));
  h2s.some(t => t.toLowerCase().includes("what we know"))
    ? ok('Section "Here\'s what we know" present')
    : fail('Know section', `not found in ${JSON.stringify(h2s)}`);
  h2s.some(t => t.toLowerCase().includes("open questions") || t.toLowerCase().includes("what we don't know"))
    ? ok('Open-questions section present')
    : fail('Open-questions section', `not found in ${JSON.stringify(h2s)}`);
  h2s.some(t => t.toLowerCase().includes("find out"))
    ? ok('Section "Here\'s how we\'ll find out" present')
    : fail('Find-out section', `not found in ${JSON.stringify(h2s)}`);

  // Body content checks
  const body = await page.textContent('body');

  body.includes('Lucretia and Joseph Brown')
    ? ok('Full Brown School name referenced')
    : fail('Brown name', 'missing');

  body.includes('EBI Consulting')
    ? ok('EBI Consulting (firm name) referenced')
    : fail('EBI Consulting', 'missing');

  body.includes('Aug')
    ? ok('Aug 31 2025 deliverable referenced (in don\'t-know list)')
    : fail('Aug 31 deliverable', 'missing');

  // Brown-gap callout
  const brownGap = await page.$('.sbm-brown-gap');
  brownGap ? ok('Brown-gap callout present (.sbm-brown-gap)') : fail('Brown-gap', 'missing');

  // Backlog bar chart still visible
  const barChart = await page.$('svg.sbm-bar-chart');
  barChart ? ok('Bar chart SVG present') : fail('Bar chart SVG', 'missing');

  const caveatBanner = await page.$('.sbm-caveat-banner');
  caveatBanner ? ok('Bar chart caveat banner present') : fail('caveat banner', 'missing');

  const barLabels = await page.$$eval('svg.sbm-bar-chart text', els => els.map(e => e.textContent.trim()));
  ['High School', 'Veterans', 'Village', 'Glover', 'Brown'].every(b => barLabels.some(l => l.includes(b)))
    ? ok('All 5 operating schools appear as chart rows')
    : fail('chart rows', `expected 5 building labels, got ${JSON.stringify(barLabels)}`);

  // Former-buildings cards
  const cards = await page.$$('.sbm-cards .sbm-card');
  cards.length === 4
    ? ok(`Former-buildings card grid has ${cards.length} cards`)
    : fail('cards count', `expected 4, got ${cards.length}`);

  body.includes('Harborlight Homes')
    ? ok('Coffin Adaptive Reuse / Harborlight reference present')
    : fail('Harborlight Homes', 'missing');

  body.includes('Eveleth')
    ? ok('Eveleth building referenced')
    : fail('Eveleth', 'missing');

  // Sarah Fox blockquote
  body.includes('buckets and mops')
    ? ok('Sarah Fox walking-tour direct quote present')
    : fail('walking-tour quote', 'missing');

  const blockquote = await page.$('blockquote.quote');
  blockquote ? ok('blockquote.quote pattern used (site quote class)') : fail('blockquote.quote', 'missing');

  // Funding facts
  body.includes('$500K') || body.includes('$500,000')
    ? ok('$500K/yr building capital fund (Tier 3) referenced')
    : fail('building capital fund', 'missing');

  body.includes('summer 2026')
    ? ok('Summer 2026 HS roof construction referenced')
    : fail('summer 2026 roof', 'missing');

  // Glover HVAC ambiguity (the new finding worth flagging)
  body.includes('Glover') && (body.includes('condenser') || body.includes('20%'))
    ? ok('Glover HVAC scope ambiguity surfaced')
    : fail('Glover HVAC', 'condenser/20% scope ambiguity not on page');

  await browser.close();
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
})();
