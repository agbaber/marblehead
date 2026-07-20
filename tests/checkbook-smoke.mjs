import { chromium, devices } from 'playwright';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const SITE = process.env.SITE || 'http://localhost:4000';
const URL = SITE + '/checkbook/';

// Read the nightly-refreshed data files the page renders from, so the
// assertions stay in lockstep with whatever fiscal year / month the data
// is currently at instead of hardcoding one snapshot's numbers.
const REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const budgetMeta = JSON.parse(readFileSync(path.join(REPO, '_data', 'budget.json'), 'utf8'));
const checkbookMeta = JSON.parse(readFileSync(path.join(REPO, '_data', 'checkbook.json'), 'utf8'));
const perfData = JSON.parse(readFileSync(path.join(REPO, 'data', 'checkbook_performance.json'), 'utf8'));
// Numeric part of e.g. "$129.7M" -> "129.7"
const operatingNum = String(budgetMeta.annual_operating_M).replace(/[^0-9.]/g, '');
// A real vendor from the current checkbook CSV (first data line without
// quoted fields, so a naive comma split is safe).
const csvText = readFileSync(path.join(REPO, 'data', checkbookMeta.csv_filename), 'utf8');
const vendorLine = csvText.split('\n').slice(1).find((l) => l.trim() && !l.startsWith('"'));
const testVendor = vendorLine.split(',')[0];

async function run() {
  const browser = await chromium.launch();
  const failures = [];
  const ok = (label) => console.log('  ✓', label);
  const fail = (label, err) => { failures.push(label + ': ' + err); console.log('  ✗', label, '-', err); };

  for (const profile of [
    { name: 'Desktop',  viewport: { width: 1280, height: 900 } },
    { name: 'Mobile',   viewport: devices['iPhone 13'].viewport },
  ]) {
    console.log('\n[' + profile.name + ']');
    const context = await browser.newContext({ viewport: profile.viewport });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (msg) => {
      if (msg.type() !== 'error') return;
      const t = msg.text();
      // Ignore third-party beacons that only fail when serving from localhost
      if (t.includes('cloudflareinsights.com')) return;
      if (t.includes('cdn-cgi')) return;
      if (t === 'Failed to load resource: net::ERR_FAILED') return; // beacon follow-up with no URL
      errors.push('console: ' + t);
    });

    try {
      await page.goto(URL, { waitUntil: 'networkidle' });
    } catch (e) {
      fail(profile.name + ' nav', e.message);
      await context.close();
      continue;
    }

    // 1. h1 present
    try {
      const h1 = await page.locator('h1').first().innerText();
      if (!h1.toLowerCase().includes('checkbook')) throw new Error('h1 was "' + h1 + '"');
      ok('h1 says Checkbook');
    } catch (e) { fail('h1', e.message); }

    // 2. hero card values rendered
    try {
      const heroVals = await page.locator('.hero-value').allInnerTexts();
      if (heroVals.length < 3) throw new Error('only ' + heroVals.length + ' hero values');
      if (!heroVals[0].includes(operatingNum)) throw new Error('first hero ≠ ' + operatingNum + ': ' + heroVals[0]);
      ok('hero card has ' + heroVals.length + ' stats, annual operating = ' + heroVals[0]);
    } catch (e) { fail('hero', e.message); }

    // 3. Budget vs Actual chart populates after data load
    try {
      await page.waitForSelector('.bva-row', { timeout: 8000 });
      const rowCount = await page.locator('.bva-row').count();
      if (rowCount < 5) throw new Error('only ' + rowCount + ' bva rows');
      const firstName = await page.locator('.bva-row .bva-name').first().innerText();
      if (!firstName.toLowerCase().includes('general fund')) throw new Error('first row was "' + firstName + '"');
      ok('budget-vs-actual chart shows ' + rowCount + ' rows, top = ' + firstName);
    } catch (e) { fail('bva-chart', e.message); }

    // 4. Switching breakdown updates rows
    try {
      await page.click('.breakdown-btn[data-breakdown="by_department"]');
      await page.waitForTimeout(150);
      const newFirst = await page.locator('.bva-row .bva-name').first().innerText();
      if (!/governmental|districtwide|school/i.test(newFirst)) throw new Error('after-switch first row: ' + newFirst);
      ok('breakdown switch updates chart (first now = ' + newFirst + ')');
    } catch (e) { fail('breakdown-switch', e.message); }

    // 5. Transaction table populated
    try {
      await page.waitForSelector('table.ck-table tbody tr td.vendor', { timeout: 12000 });
      const txnRows = await page.locator('table.ck-table tbody tr').count();
      if (txnRows < 10) throw new Error('only ' + txnRows + ' txn rows');
      const firstVendor = await page.locator('table.ck-table tbody tr td.vendor').first().innerText();
      ok('transaction table shows ' + txnRows + ' rows, top vendor = ' + firstVendor);
    } catch (e) { fail('table', e.message); }

    // 6. Pager info shows total
    try {
      const info = await page.locator('#pager-info').innerText();
      if (!info.includes('15,001') && !info.toLowerCase().includes('showing')) throw new Error('pager-info: ' + info);
      ok('pager info: ' + info);
    } catch (e) { fail('pager-info', e.message); }

    // 6b. Performance panels rendered
    try {
      await page.waitForSelector('#perf-vendor-list .perf-meter', { timeout: 8000 });
      const vendorBars = await page.locator('#perf-vendor-list .perf-meter').count();
      if (vendorBars < 5) throw new Error('only ' + vendorBars + ' top-vendor bars');
      const paretoText = await page.locator('#perf-pareto').innerText();
      if (!/top\s*10/i.test(paretoText) || !paretoText.includes('%')) throw new Error('pareto text: ' + paretoText);
      // Early in a fiscal year no department has exceeded its full-year
      // budget, so the over list legitimately renders an empty state.
      const overText = await page.locator('#perf-over-list').innerText();
      const overRows = await page.locator('#perf-over-list .perf-row').count();
      if (overRows === 0 && !/no department has exceeded/i.test(overText)) {
        throw new Error('over list has neither rows nor the empty state: ' + overText.slice(0, 80));
      }
      const expectedMonths = perfData.monthly_cadence.length;
      const cadenceBars = await page.locator('#perf-cadence-chart .cadence-bar').count();
      if (cadenceBars !== expectedMonths) throw new Error(cadenceBars + ' cadence bars, expected ' + expectedMonths);
      ok('performance: ' + vendorBars + ' vendor bars, ' + cadenceBars + ' cadence bars, pareto + over panels populated');
    } catch (e) { fail('performance-panels', e.message); }

    // 6c. Drill: click a drillable row in BVA -> expand appears, click again -> collapses
    try {
      // The breakdown-switch test left the chart on Department view; flip back to Fund
      await page.click('.breakdown-btn[data-breakdown="by_fund"]');
      await page.waitForTimeout(200);
      await page.locator('.bva-row--drillable').first().click();
      await page.waitForSelector('.bva-expand', { timeout: 3000 });
      await page.waitForSelector('.drill-card', { state: 'attached', timeout: 3000 });
      const drillCards = await page.locator('.bva-expand .drill-card').count();
      if (drillCards < 2) throw new Error('only ' + drillCards + ' drill cards');
      const ctaCount = await page.locator('.drill-cta-btn').count();
      if (ctaCount < 1) throw new Error('no CTA button');
      // Click again to collapse
      await page.locator('.bva-row--drillable').first().click();
      await page.waitForTimeout(150);
      const stillExpanded = await page.locator('.bva-expand').count();
      if (stillExpanded !== 0) throw new Error('expand persisted after second click');
      ok('drill expand+collapse on fund row (showed ' + drillCards + ' panels)');
    } catch (e) { fail('drill-expand', e.message); }

    // 6d. Drill CTA filters the transaction table to that fund
    try {
      await page.locator('.bva-row--drillable').first().click();
      await page.waitForSelector('.drill-cta-btn', { state: 'attached', timeout: 3000 });
      await page.locator('.drill-cta-btn').first().click();
      await page.waitForTimeout(400);
      const fundFilterValue = await page.locator('#f-fund').inputValue();
      if (!fundFilterValue.includes('GENERAL FUND - TOWN')) throw new Error('fund filter set to: ' + fundFilterValue);
      ok('drill CTA sets fund filter (' + fundFilterValue + ')');
      await page.click('#reset-filters');
      await page.waitForTimeout(150);
    } catch (e) { fail('drill-cta', e.message); }

    // 6g. Nested drill: click a category inside Fund drill -> breadcrumb appears + new sub-panels
    try {
      // Ensure we're at a clean by_fund root, collapsed. Since #833 preserves
      // drill state per breakdown, a prior test may have left the Fund tab
      // with an open drill; press Escape to clear it before we re-open.
      await page.click('.breakdown-btn[data-breakdown="by_department"]');
      await page.waitForTimeout(150);
      await page.click('.breakdown-btn[data-breakdown="by_fund"]');
      await page.waitForTimeout(150);
      // Defensively close any preserved drill so the next click reliably opens one.
      await page.keyboard.press('Escape');
      await page.waitForTimeout(150);
      await page.locator('.bva-row--drillable').first().click();
      await page.waitForSelector('.drill-bar-row--click', { state: 'attached', timeout: 3000 });
      // Since #831 the breadcrumb is always present once a drill is open
      // (even at root depth), so we only require a single crumb at this point.
      const beforeCrumbs = await page.locator('.drill-crumb').count();
      if (beforeCrumbs !== 1) throw new Error('expected 1 breadcrumb entry at root drill, got ' + beforeCrumbs);
      // Click the first drillable nested row
      await page.locator('.drill-bar-row--click').first().click();
      await page.waitForSelector('.drill-crumbs', { state: 'visible', timeout: 3000 });
      const crumbCount = await page.locator('.drill-crumb').count();
      if (crumbCount < 2) throw new Error('only ' + crumbCount + ' breadcrumb entries');
      const cur = await page.locator('.drill-crumb--current').innerText();
      ok('nested drill (' + crumbCount + '-crumb path; current=' + cur.replace(/\s+/g, ' ').slice(0, 40) + ')');
      // Pop back to root
      await page.locator('.drill-crumb-btn').first().click();
      await page.waitForTimeout(200);
      // With always-on breadcrumbs (#831), pop-to-root collapses the path
      // back to exactly one crumb (the root entry) rather than hiding it.
      const afterCrumbs = await page.locator('.drill-crumb').count();
      if (afterCrumbs !== 1) throw new Error('after pop expected 1 crumb, got ' + afterCrumbs);
      ok('breadcrumb pop returns to root');
    } catch (e) { fail('nested-drill', e.message); }

    // 6e. Click top vendor card row -> sets vendor filter
    try {
      await page.locator('[data-perf-vendor]').first().click();
      await page.waitForTimeout(300);
      const v = await page.locator('#f-vendor').inputValue();
      if (!v) throw new Error('vendor filter not set');
      ok('click-to-filter on top vendor (' + v.slice(0, 30) + ')');
      await page.click('#reset-filters');
      await page.waitForTimeout(150);
    } catch (e) { fail('perf-vendor-click', e.message); }

    // 6f. Click monthly bar -> sets date range
    try {
      await page.locator('[data-perf-month]').first().click();
      await page.waitForTimeout(300);
      const min = await page.locator('#f-date-min').inputValue();
      const max = await page.locator('#f-date-max').inputValue();
      if (!min || !max) throw new Error('date range not set: ' + min + ' / ' + max);
      ok('click-to-filter on month (' + min + ' to ' + max + ')');
      await page.click('#reset-filters');
      await page.waitForTimeout(150);
    } catch (e) { fail('perf-month-click', e.message); }

    // 7. Vendor filter works (vendor taken from the current CSV so this
    //    tracks the nightly data instead of assuming a specific payee)
    try {
      await page.fill('#f-vendor', testVendor);
      await page.waitForTimeout(300);
      // td.vendor shows the alias-merged display name; the raw ledger name
      // is in the cell's title attribute, so match against that.
      const firstCell = page.locator('table.ck-table tbody tr td.vendor').first();
      const filteredFirst = ((await firstCell.getAttribute('title')) || '') + ' ' + (await firstCell.innerText());
      if (!filteredFirst.toUpperCase().includes(testVendor.toUpperCase())) throw new Error('filtered first vendor: ' + filteredFirst);
      ok('vendor filter narrows to ' + testVendor);
    } catch (e) { fail('vendor-filter', e.message); }

    // 8. Reset filters
    try {
      await page.click('#reset-filters');
      await page.waitForTimeout(200);
      const v = await page.locator('#f-vendor').inputValue();
      if (v !== '') throw new Error('vendor still: ' + v);
      ok('reset clears filters');
    } catch (e) { fail('reset', e.message); }

    // 9. No console errors
    if (errors.length) fail('console errors', errors.join(' | '));
    else ok('no console errors');

    // 10. Data hub links to the tool (browse.html is now a redirect to /data/)
    if (profile.name === 'Desktop') {
      try {
        await page.goto(SITE + '/data/', { waitUntil: 'networkidle' });
        const links = await page.locator('a[href="/checkbook/"]').count();
        if (links < 2) throw new Error('only ' + links + ' links to /checkbook/ from /data/');
        ok('/data/ hub has ' + links + ' links to the checkbook tool');
      } catch (e) { fail('browse-link', e.message); }
    }

    await context.close();
  }

  await browser.close();
  if (failures.length) {
    console.log('\n' + failures.length + ' FAILURE(S):');
    failures.forEach(f => console.log('  - ' + f));
    process.exit(1);
  } else {
    console.log('\nAll smoke checks passed.');
  }
}

run().catch((e) => { console.error(e); process.exit(1); });
