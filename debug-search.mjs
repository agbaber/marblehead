import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: {width:1280,height:800} });

  page.on('console', m => { if (m.type() === 'error') console.log('CONSOLE ERROR:', m.text()); });
  page.on('pageerror', e => console.log('PAGE ERROR:', e.message));

  await page.goto('http://localhost:9876/town-budget.html');
  await page.waitForSelector('.tb-row--function', {timeout:5000}).catch(() => null);

  // Simulate exact smoke test sequence

  // 1. Click Public Safety
  const psRow = await page.$('.tb-row[data-id="public_safety"]');
  if (psRow) {
    await psRow.click();
    await page.waitForTimeout(80);
  }

  // 2. Click Police
  const policeRow = await page.$('.tb-row[data-id="police"]');
  if (policeRow) {
    await policeRow.click();
    await page.waitForTimeout(80);
    const policeLines = await page.$$('.tb-row--line[data-parent="police"]');
    if (policeLines.length > 0) {
      await policeLines[0].click();
      await page.waitForTimeout(80);
    }
  }

  // 3. Expand-all
  const expandAll = await page.$('#tb-expand-all');
  if (expandAll) {
    await expandAll.click();
    await page.waitForTimeout(120);
    console.log('Clicked expand-all');
  }

  // 4. Open filters, click none, click schools, check, then click all
  const filterToggle = await page.$('#tb-filter-bar > summary');
  if (filterToggle) {
    await filterToggle.click();
    await page.waitForTimeout(60);
    console.log('Opened filters');

    const noneBtn = await page.$('[data-action="filter-functions-none"]');
    if (noneBtn) {
      await noneBtn.click();
      await page.waitForTimeout(60);
      console.log('Clicked none');

      const schoolsChip = await page.$('.tb-chip[data-function="schools"]');
      if (schoolsChip) {
        await schoolsChip.click();
        await page.waitForTimeout(60);
        console.log('Clicked schools chip');
      }
    }
  }

  // 5. Click fnAll
  const fnAllBtn = await page.$('[data-action="filter-functions-all"]');
  if (fnAllBtn) {
    await fnAllBtn.click();
    await page.waitForTimeout(60);
    console.log('Clicked all functions');
  }

  // 6. Count lines before search
  const linesBefore = await page.$$('.tb-row--line');
  console.log('Lines before search:', linesBefore.length);

  // 7. Search for insurance
  const search = await page.$('#tb-search');
  console.log('Search input found:', !!search);

  if (search) {
    await search.fill('insurance');
    await page.waitForTimeout(300);

    const result = await page.evaluate(() => {
      const lines = [...document.querySelectorAll('.tb-row--line')];
      const descs = lines.map(r => {
        const cells = r.querySelectorAll('td');
        return cells.length > 0 ? cells[0].textContent.trim() : r.textContent.trim().substring(0,50);
      });
      return { count: lines.length, descs };
    });
    console.log('Line rows after search:', result.count);
    result.descs.forEach(d => console.log('  -', d));

    // Check state
    const stateInfo = await page.evaluate(() => {
      return {
        searchQuery: window.stateDebug ? window.stateDebug.filters.searchQuery : 'unknown'
      };
    });
    console.log('State debug:', stateInfo);
  }

  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
