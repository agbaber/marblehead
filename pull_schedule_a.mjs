import { chromium } from 'playwright';
import { writeFileSync } from 'fs';

const URL = 'https://dls-gw.dor.state.ma.us/reports/rdPage.aspx?rdReport=ScheduleA.GenFund_MAIN';

const TOWNS = new Set([
  'Arlington', 'Brookline', 'Cohasset', 'Framingham', 'Hingham',
  'Lexington', 'Marblehead', 'Melrose', 'Natick', 'Needham',
  'Stoneham', 'Swampscott', 'Wellesley', 'Winchester'
]);

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
  });
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
  });
  const page = await context.newPage();

  console.log('Loading Schedule A General Fund page...');
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(8000);

  const frame = page.frames().find(f => f.url().includes('ScheduleA.GeneralFund'));
  if (!frame) throw new Error('Could not find Schedule A iframe');

  // Discover available years
  const years = await frame.evaluate(() => {
    const result = [];
    const cbs = document.querySelectorAll('input[name="islYear"]');
    for (const cb of cbs) {
      if (cb.id.includes('All')) continue;
      const label = document.querySelector('label[for="' + cb.id + '"]');
      if (label) result.push({ id: cb.id, year: label.textContent.trim() });
    }
    return result;
  });
  console.log('Available years:', years.map(y => y.year).join(', '));

  // For each view (Revenues, Expenditures), for each year, scrape data
  const allRevRows = [];
  const allExpRows = [];

  for (const view of ['Revenues', 'Expenditures']) {
    console.log('\n========== ' + view.toUpperCase() + ' ==========');
    const allRows = view === 'Revenues' ? allRevRows : allExpRows;

    for (const yearInfo of years) {
      const yr = yearInfo.year;
      console.log('\n--- ' + view + ' FY' + yr + ' ---');

      // Select only this year (uncheck all, check this one)
      await frame.evaluate((yearId) => {
        const allCb = document.querySelector('input[id="islYear_rdListAll"]');
        if (allCb && allCb.checked) allCb.click();
        // Uncheck everything
        const cbs = document.querySelectorAll('input[name="islYear"]');
        for (const cb of cbs) {
          if (cb.checked && !cb.id.includes('All')) cb.click();
        }
        // Check just this year
        const target = document.getElementById(yearId);
        if (target && !target.checked) target.click();
      }, yearInfo.id);

      // Select the view (Revenues or Expenditures)
      await frame.evaluate((viewName) => {
        const selects = document.querySelectorAll('select');
        for (const sel of selects) {
          for (const opt of sel.options) {
            if (opt.text.includes(viewName)) {
              sel.value = opt.value;
              sel.dispatchEvent(new Event('change'));
              return;
            }
          }
        }
      }, view);

      // Submit
      await frame.evaluate(() => {
        const buttons = document.querySelectorAll('input[type="submit"], input[type="image"]');
        for (const btn of buttons) {
          const text = (btn.value || btn.alt || '').toLowerCase();
          if (text.includes('submit') || btn.type === 'image') {
            btn.click();
            return;
          }
        }
      });
      await frame.waitForTimeout(4000);

      // Reset to page 1 (pagination sticks on last page after re-submit)
      await frame.evaluate(() => {
        const links = document.querySelectorAll('a');
        for (const a of links) {
          if (a.textContent.trim() === '<<') { a.click(); return; }
        }
      });
      await frame.waitForTimeout(2500);

      // Scrape all pages for this year
      const rows = await scrapeAllPages(frame);
      console.log('  Total rows for FY' + yr + ': ' + rows.length);
      for (const row of rows) allRows.push(row);
    }
  }

  // Filter to peer towns and save
  saveCSV(allRevRows, 'data/peer_schedule_a_revenues.csv', 'revenues');
  saveCSV(allExpRows, 'data/peer_schedule_a_expenditures.csv', 'expenditures');

  // Also save combined summary
  buildSummary(allRevRows, allExpRows);

  await browser.close();
}

function saveCSV(rows, filename, label) {
  if (rows.length === 0) {
    console.log('No ' + label + ' data to save.');
    return;
  }
  // Filter to peer towns (municipality is column index 1)
  const filtered = rows.filter(r => TOWNS.has(r[1]));
  console.log('\n' + label + ': ' + rows.length + ' total rows, ' + filtered.length + ' peer town rows');

  const lines = [];
  // Use first row pattern for header
  lines.push('dor_code,municipality,fiscal_year,taxes,service_charges,licenses_permits,federal_revenue,state_revenue,other_govt_revenue,special_assessments,fines,miscellaneous,other_financing,transfers,total');
  for (const r of filtered) {
    lines.push(r.map(c => '"' + c.replace(/"/g, '""') + '"').join(','));
  }
  writeFileSync(filename, lines.join('\n'));
  console.log('Saved to ' + filename);
}

function buildSummary(revRows, expRows) {
  // Build a simple town/year -> total revenue/expenditure lookup
  const revMap = {};
  for (const r of revRows) {
    if (!TOWNS.has(r[1])) continue;
    const key = r[1] + '|' + r[2];
    revMap[key] = r[r.length - 1]; // last column = Total
  }
  const expMap = {};
  for (const r of expRows) {
    if (!TOWNS.has(r[1])) continue;
    const key = r[1] + '|' + r[2];
    expMap[key] = r[r.length - 1];
  }

  // Build combined CSV
  const lines = ['municipality,fiscal_year,total_revenues,total_expenditures'];
  const keys = new Set([...Object.keys(revMap), ...Object.keys(expMap)]);
  const sorted = Array.from(keys).sort();
  for (const key of sorted) {
    const [town, fy] = key.split('|');
    lines.push([town, fy, revMap[key] || '', expMap[key] || ''].join(','));
  }
  writeFileSync('data/peer_gf_rev_exp_summary.csv', lines.join('\n'));
  console.log('Saved summary to data/peer_gf_rev_exp_summary.csv');
}

async function scrapeAllPages(frame) {
  const allRows = [];

  for (let pg = 1; pg <= 20; pg++) {
    const rows = await frame.evaluate(() => {
      const table = document.getElementById('xtGenFund');
      if (!table) return [];
      const trs = table.querySelectorAll('tr');
      const result = [];
      for (let i = 1; i < trs.length; i++) { // skip header row
        const cells = trs[i].querySelectorAll('td');
        if (cells.length >= 3) {
          result.push(Array.from(cells).map(c => c.textContent.trim()));
        }
      }
      return result;
    });

    if (rows.length === 0) break;
    for (const row of rows) allRows.push(row);

    const hasNext = await frame.evaluate(() => {
      const links = document.querySelectorAll('a');
      for (const a of links) {
        if (a.textContent.trim() === '>') { a.click(); return true; }
      }
      return false;
    });

    if (!hasNext) break;
    await frame.waitForTimeout(2500);
  }

  return allRows;
}

main().catch(console.error);
