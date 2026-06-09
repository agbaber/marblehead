import { chromium, devices } from 'playwright';

const URL = 'http://localhost:4001/charts/checkbook.html';

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
      if (heroVals.length < 4) throw new Error('only ' + heroVals.length + ' hero values');
      if (!heroVals[0].includes('206')) throw new Error('first hero ≠ 206M: ' + heroVals[0]);
      ok('hero card has 4 stats with budget amounts');
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
      const overText = await page.locator('#perf-over-list').innerText();
      if (!/light|snow/i.test(overText)) throw new Error('expected light/snow in over list: ' + overText.slice(0, 80));
      const cadenceBars = await page.locator('#perf-cadence-chart .cadence-bar').count();
      if (cadenceBars < 10) throw new Error('only ' + cadenceBars + ' cadence bars');
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
      // Ensure we're at a clean by_fund root, collapsed
      await page.click('.breakdown-btn[data-breakdown="by_department"]');
      await page.waitForTimeout(150);
      await page.click('.breakdown-btn[data-breakdown="by_fund"]');
      await page.waitForTimeout(150);
      await page.locator('.bva-row--drillable').first().click();
      await page.waitForSelector('.drill-bar-row--click', { state: 'attached', timeout: 3000 });
      const before = await page.locator('.drill-crumbs').count();
      if (before !== 0) throw new Error('breadcrumb showed at root, expected none');
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
      const after = await page.locator('.drill-crumbs').count();
      if (after !== 0) throw new Error('breadcrumb still visible after pop');
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

    // 7. Vendor filter works
    try {
      await page.fill('#f-vendor', 'AMAZON');
      await page.waitForTimeout(300);
      const filteredFirst = await page.locator('table.ck-table tbody tr td.vendor').first().innerText();
      if (!filteredFirst.toUpperCase().includes('AMAZON')) throw new Error('filtered first vendor: ' + filteredFirst);
      ok('vendor filter narrows to AMAZON');
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

    // 10. Browse page links to the new tool
    if (profile.name === 'Desktop') {
      try {
        await page.goto('http://localhost:4001/browse.html', { waitUntil: 'networkidle' });
        const links = await page.locator('a[href="charts/checkbook.html"]').count();
        if (links < 2) throw new Error('only ' + links + ' links to checkbook from browse');
        ok('browse.html has ' + links + ' links to the checkbook tool');
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
