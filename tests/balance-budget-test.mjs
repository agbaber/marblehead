/**
 * Smoke test for balance-the-budget.html
 *
 * Runs against a deployed URL (pass via SITE env var).
 * Matches tests/smoke-test.mjs convention: Playwright Chromium, no
 * framework, direct node execution.
 *
 *   SITE=https://<preview-url> node tests/balance-budget-test.mjs
 */
import { chromium } from 'playwright';

const SITE = process.env.SITE || 'https://marbleheaddata.org';
const URL = SITE.replace(/\/$/, '') + '/balance-the-budget.html';

let passed = 0;
let failed = 0;
function ok(name) { passed++; console.log(`  PASS: ${name}`); }
function fail(name, detail) { failed++; console.log(`  FAIL: ${name} — ${detail}`); }

async function run() {
  console.log(`Testing: ${URL}\n`);
  const browser = await chromium.launch();
  const page = await browser.newPage();
  try {
    await page.goto(URL, { waitUntil: 'networkidle' });

    const h1 = await page.textContent('h1');
    h1 && h1.includes('Balance') ? ok('H1 renders') : fail('H1', `got "${h1}"`);

    const tierBtns = await page.$$('.bb-tier-btn');
    tierBtns.length === 4 ? ok('4 scenario buttons (No override + 3 tiers)') : fail('Tier buttons', `expected 4, got ${tierBtns.length}`);

    // Default tier is "No override" (data-tier="0").
    const defaultPressed = await page.getAttribute('.bb-tier-btn[data-tier="0"]', 'aria-pressed');
    defaultPressed === 'true' ? ok('No-override is the default') : fail('Default tier', `got aria-pressed="${defaultPressed}"`);

    // Wait for data fetch + initial render.
    await page.waitForSelector('.bb-item-row', { timeout: 5000 });
    const rows = await page.$$('.bb-item-row');
    rows.length >= 10 ? ok(`${rows.length} discrete checklist rows render`) : fail('Checklist rows', `expected >= 10, got ${rows.length}`);

    const impacts = await page.$$('.bb-item-row-impact');
    impacts.length === rows.length ? ok(`${impacts.length} service-impact lines render (one per item)`) : fail('Impact lines', `expected ${rows.length}, got ${impacts.length}`);

    const target = await page.textContent('[data-bind="target"]');
    target && target.includes('4,296,718') ? ok('No-override target is $4.30M') : fail('Target', `got "${target}"`);

    // Schools scalar default contributes $1.5M to "your plan" on initial render.
    const cutsInitial = await page.textContent('[data-bind="cuts"]');
    cutsInitial && cutsInitial.includes('1,500,000') ? ok('Schools scalar default included in plan') : fail('Initial plan', `got "${cutsInitial}"`);

    // Insurance share lever exists.
    const insuranceInput = await page.$('#bb-insurance_share');
    insuranceInput ? ok('Insurance share lever present') : fail('Insurance share', 'not found');

    // One-time funds lever exists.
    const oneTimeInput = await page.$('#bb-extra_one_time');
    oneTimeInput ? ok('One-time funds lever present') : fail('One-time funds', 'not found');

    // Bumping insurance share triggers savings hint and CBA consequence.
    if (insuranceInput) {
      await insuranceInput.fill('3');
      await insuranceInput.dispatchEvent('input');
      await page.waitForTimeout(150);
      const cuts = await page.textContent('[data-bind="cuts"]');
      // 3pp × $182K = $546K, plus existing $1.5M = $2,046,000
      cuts && cuts.includes('2,046,000') ? ok('Insurance share +3pp adds $546K to plan') : fail('Insurance share contribution', `got plan total "${cuts}"`);
      const consText = await page.textContent('.bb-consequences-list');
      (consText && consText.includes('Collective bargaining')) ? ok('CBA reopener consequence triggers when share shifted') : fail('CBA consequence', `got "${consText && consText.slice(0, 60)}"`);
      await insuranceInput.fill('0');
      await insuranceInput.dispatchEvent('input');
      await page.waitForTimeout(100);
    }

    // Check a discrete checkbox; cuts total should rise.
    await page.check('.bb-item-row input[type="checkbox"]', { force: true });
    await page.waitForTimeout(150);
    const cutsAfter = await page.textContent('[data-bind="cuts"]');
    cutsAfter && cutsAfter !== cutsInitial ? ok('Plan total updates on check') : fail('Plan update', `got "${cutsAfter}"`);

    // Switching tier prompts confirm; accept the dialog.
    page.once('dialog', d => d.accept());
    await page.click('.bb-tier-btn[data-tier="2"]');
    await page.waitForTimeout(250);
    const tier2Target = await page.textContent('[data-bind="target"]');
    tier2Target && tier2Target.includes('2,805,236') ? ok('Tier 2 switch updates target') : fail('Tier 2 switch', `got "${tier2Target}"`);

    // Schools scalar still present after tier switch.
    const schoolsInput = await page.$('#bb-schools_cut');
    schoolsInput ? ok('Schools scalar present after tier switch') : fail('Schools scalar', 'not found');
    if (schoolsInput) {
      // Enter a cut large enough to trigger NSS floor (> $21,894,870).
      await schoolsInput.fill('25000000');
      await schoolsInput.dispatchEvent('input');
      await page.waitForTimeout(200);
      const cuts = await page.textContent('[data-bind="cuts"]');
      cuts && cuts.includes('25,') ? ok('Schools scalar updates plan total') : fail('Schools scalar update', `got "${cuts}"`);

      const count = await page.textContent('[data-bind="consequence-count"]');
      Number(count) >= 1 ? ok('NSS consequence triggers above threshold') : fail('NSS consequence', `count=${count}`);
    }

    // Reset clears plan; cuts return to default $1.5M (schools).
    await page.click('.bb-reset');
    await page.waitForTimeout(150);
    const cutsReset = await page.textContent('[data-bind="cuts"]');
    cutsReset && cutsReset.includes('1,500,000') ? ok('Reset restores defaults') : fail('Reset', `got "${cutsReset}"`);
  } finally {
    await browser.close();
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

run().catch(err => {
  console.error(err);
  process.exit(2);
});
