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

    const fixedNote = await page.$('.bb-fixed-note');
    fixedNote ? ok('Schools fixed-context block renders') : fail('Schools fixed note', 'not found');

    const tierBtns = await page.$$('.bb-tier-btn');
    tierBtns.length === 4 ? ok('4 scenario buttons (No override + 3 tiers)') : fail('Tier buttons', `expected 4, got ${tierBtns.length}`);

    // Default tier is "No override".
    const defaultPressed = await page.getAttribute('.bb-tier-btn[data-tier="0"]', 'aria-pressed');
    defaultPressed === 'true' ? ok('No-override is the default') : fail('Default tier', `got aria-pressed="${defaultPressed}"`);

    // Wait for data fetch + initial render.
    await page.waitForSelector('.bb-item-row', { timeout: 5000 });
    const rows = await page.$$('.bb-item-row');
    rows.length === 37 ? ok(`${rows.length} discrete checklist rows render (35 town items + 2 creative levers)`) : fail('Checklist rows', `expected 37, got ${rows.length}`);

    // Service-impact lines render (one per item).
    const impacts = await page.$$('.bb-item-row-impact');
    impacts.length === rows.length ? ok(`${impacts.length} service-impact lines (one per item)`) : fail('Impact lines', `expected ${rows.length}, got ${impacts.length}`);

    // Items in town's plan pre-checked, creative levers (not in plan) unchecked.
    const checkedCount = await page.$$eval('.bb-item-row input[type="checkbox"]:checked', els => els.length);
    const expectedChecked = rows.length - 2;  // 2 creative items (meals tax, PAYT) start unchecked
    checkedCount === expectedChecked ? ok(`${checkedCount}/${rows.length} town's-plan items pre-checked (2 creative levers unchecked by design)`) : fail('Pre-check default', `expected ${expectedChecked}, got ${checkedCount}`);

    // Creative levers present
    const mealsTax = await page.$('#bb-creative_local_meals_tax');
    mealsTax ? ok('Local meals tax lever present') : fail('Meals tax', 'not found');
    const payt = await page.$('#bb-creative_payt_trash');
    payt ? ok('PAYT lever present') : fail('PAYT', 'not found');

    // Effort badges render on every row
    const effortBadges = await page.$$('.bb-item-row-effort');
    effortBadges.length >= rows.length ? ok(`${effortBadges.length} effort badges render`) : fail('Effort badges', `expected at least ${rows.length}, got ${effortBadges.length}`);

    // Effort levels present (low / medium / high distribution)
    const efforts = await page.$$eval('.bb-item-row-effort', els => els.map(e => Array.from(e.classList).find(c => c.startsWith('effort-'))));
    const hasLow = efforts.some(c => c === 'effort-low');
    const hasMedium = efforts.some(c => c === 'effort-medium');
    const hasHigh = efforts.some(c => c === 'effort-high');
    (hasLow && hasMedium && hasHigh) ? ok('All three effort levels (low/medium/high) appear') : fail('Effort levels', `low=${hasLow} medium=${hasMedium} high=${hasHigh}`);

    // No-override target = sum of tier_3 amounts (gross). The data sum is $4,889,079.
    const target = await page.textContent('[data-bind="target"]');
    target && target.includes('4,889,079') ? ok('No-override target is $4,889,079 (gross)') : fail('Target', `got "${target}"`);

    // Plan equals target → status is Balanced.
    const status = await page.textContent('[data-bind="status"]');
    status && status.trim().toLowerCase() === 'balanced' ? ok('Default status is Balanced') : fail('Default status', `got "${status}"`);

    // Status message refers to the town's plan.
    const message = await page.textContent('[data-bind="status-message"]');
    message && message.toLowerCase().includes("town") ? ok("Status message references town's plan at default") : fail('Status message', `got "${message}"`);

    // Switching to Tier 1: target drops, plan stays (over by ~$1.68M).
    await page.click('.bb-tier-btn[data-tier="1"]');
    await page.waitForTimeout(150);
    const t1Target = await page.textContent('[data-bind="target"]');
    t1Target && t1Target.includes('3,209,399') ? ok('Tier 1 target = $3,209,399 (gross-net)') : fail('Tier 1 target', `got "${t1Target}"`);
    const t1Status = await page.textContent('[data-bind="status"]');
    t1Status && t1Status.toLowerCase().startsWith('surplus') ? ok(`Tier 1 status starts "Surplus" (${t1Status.trim()})`) : fail('Tier 1 status', `got "${t1Status}"`);

    // Uncheck items adequately on Tier 1 and verify plan moves toward balanced.
    // (Uncheck enough items - clicking a few should move the plan amount.)
    const firstThreeCheckboxes = await page.$$('.bb-item-row input[type="checkbox"]:checked');
    if (firstThreeCheckboxes.length >= 3) {
      for (let i = 0; i < 3; i++) await firstThreeCheckboxes[i].click();
      await page.waitForTimeout(150);
      const planAfter = await page.textContent('[data-bind="cuts"]');
      planAfter && !planAfter.includes('4,889,079') ? ok('Plan total updates when items unchecked') : fail('Uncheck plan', `got "${planAfter}"`);
    }

    // Insurance share lever still present and functional.
    const insuranceInput = await page.$('#bb-insurance_share');
    insuranceInput ? ok('Insurance share lever present') : fail('Insurance share', 'not found');
    if (insuranceInput) {
      await insuranceInput.fill('3');
      await insuranceInput.dispatchEvent('input');
      await page.waitForTimeout(150);
      const consText = await page.textContent('.bb-consequences-list');
      (consText && consText.includes('Collective bargaining')) ? ok('CBA reopener consequence triggers when share shifted') : fail('CBA consequence', `got "${consText && consText.slice(0, 60)}"`);
    }

    // One-time funds lever still present.
    const oneTimeInput = await page.$('#bb-extra_one_time');
    oneTimeInput ? ok('One-time funds lever present') : fail('One-time funds', 'not found');

    // Reset to town's plan: all items re-checked, scalars zeroed, status balanced.
    await page.click('.bb-tier-btn[data-tier="0"]');
    await page.waitForTimeout(100);
    await page.click('.bb-reset');
    await page.waitForTimeout(150);
    const checkedAfterReset = await page.$$eval('.bb-item-row input[type="checkbox"]:checked', els => els.length);
    checkedAfterReset === rows.length ? ok('Reset re-checks all items (town\'s plan)') : fail('Reset count', `${checkedAfterReset}/${rows.length}`);
    const planReset = await page.textContent('[data-bind="cuts"]');
    planReset && planReset.includes('4,889,079') ? ok('Reset returns plan to $4,889,079') : fail('Reset plan', `got "${planReset}"`);
    const statusReset = await page.textContent('[data-bind="status"]');
    statusReset && statusReset.trim().toLowerCase() === 'balanced' ? ok('Reset returns status to Balanced') : fail('Reset status', `got "${statusReset}"`);

    // Consequences panel is renamed.
    const consTitle = await page.textContent('.bb-consequences-title');
    consTitle && consTitle.toLowerCase().includes('legal') ? ok('Consequences panel renamed (Legal/contract/rating)') : fail('Panel title', `got "${consTitle}"`);
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
