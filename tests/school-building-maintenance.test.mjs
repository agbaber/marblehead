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

  // Three top-level sections after restructure: Schools / Former / Open / Find
  const h2s = await page.$$eval('h2', els => els.map(e => e.textContent.trim()));
  h2s.some(t => t.toLowerCase().includes("5 operating schools"))
    ? ok('Section "The 5 operating schools" present')
    : fail('Schools section', `not found in ${JSON.stringify(h2s)}`);
  h2s.some(t => t.toLowerCase().includes("former school"))
    ? ok('Section "Four former school buildings" present')
    : fail('Former section', `not found in ${JSON.stringify(h2s)}`);
  h2s.some(t => t.toLowerCase().includes("open questions") || t.toLowerCase().includes("what we don't know"))
    ? ok('Open-questions section present')
    : fail('Open-questions section', `not found in ${JSON.stringify(h2s)}`);
  h2s.some(t => t.toLowerCase().includes("find out"))
    ? ok('"Find out" section present')
    : fail('Find-out section', `not found in ${JSON.stringify(h2s)}`);

  // Hero: 5 operating-school cards
  const schoolCards = await page.$$('.sbm-school-cards .sbm-card');
  schoolCards.length === 5
    ? ok(`Hero: 5 operating-school cards present`)
    : fail('school cards count', `expected 5, got ${schoolCards.length}`);

  const schoolCardHeadings = await page.$$eval('.sbm-school-cards .sbm-card h3', els => els.map(e => e.textContent.trim()));
  ['Marblehead High School', 'Veterans Middle School', 'Village Elementary', 'Glover Elementary', 'Lucretia and Joseph Brown'].every(
    name => schoolCardHeadings.some(h => h.includes(name))
  )
    ? ok('All 5 expected school names appear as card headings')
    : fail('school card headings', `got ${JSON.stringify(schoolCardHeadings)}`);

  // Former-buildings cards
  const formerCards = await page.$$('.sbm-cards .sbm-card');
  formerCards.length === 4
    ? ok(`Former-buildings card grid has ${formerCards.length} cards`)
    : fail('former cards count', `expected 4, got ${formerCards.length}`);

  // Body content checks
  const body = await page.textContent('body');

  body.includes('EBI Consulting')
    ? ok('EBI Consulting (firm name) referenced')
    : fail('EBI Consulting', 'missing');

  body.includes('Harborlight Homes')
    ? ok('Coffin Adaptive Reuse / Harborlight reference present')
    : fail('Harborlight Homes', 'missing');

  body.includes('Eveleth')
    ? ok('Eveleth building referenced')
    : fail('Eveleth', 'missing');

  body.includes('Aug')
    ? ok('Aug 31 2025 deliverable referenced')
    : fail('Aug 31 deliverable', 'missing');

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

  // Glover HVAC ambiguity (now in the Glover card and Open Questions)
  body.includes('Glover') && (body.includes('condenser') || body.includes('20%'))
    ? ok('Glover HVAC scope ambiguity surfaced')
    : fail('Glover HVAC', 'condenser/20% scope ambiguity not on page');

  await browser.close();
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
})();
