import { chromium } from 'playwright';
import fs from 'node:fs';

const URL =
  'https://dls-gw.dor.state.ma.us/reports/rdPage.aspx?rdReport=Prop2.5.ExcessLevyCapandOverride_10_pres&rdSubReport=True&rdResizeFrame=True';
const OUT_DIR = 'scripts/dls_scrape/downloads';
fs.mkdirSync(OUT_DIR, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({
  acceptDownloads: true,
  viewport: { width: 1400, height: 1200 },
  userAgent:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
});
const page = await ctx.newPage();
console.log('Navigating...');
await page.goto(URL, { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(2500);

// Step 1: Select all years (find iclYear "select all" or check each)
// There should be a check_all checkbox: id="iclYear_check_all"
const yearCheckAll = await page.$('#iclYear_check_all');
if (yearCheckAll) {
  console.log('Checking iclYear_check_all...');
  await yearCheckAll.click();
} else {
  console.log('No year check_all found, checking individuals');
  const yearChecks = await page.$$('input[name="iclYear"]');
  console.log(`  ${yearChecks.length} year checkboxes`);
  for (const cb of yearChecks) {
    const checked = await cb.evaluate((el) => el.checked);
    if (!checked) await cb.click();
  }
}

// Step 2: Select all towns
const muniCheckAll = await page.$('#iclMuni_check_all');
if (muniCheckAll) {
  console.log('Checking iclMuni_check_all...');
  await muniCheckAll.click();
} else {
  console.log('No muni check_all found, checking individuals');
  const muniChecks = await page.$$('input[name="iclMuni"]');
  console.log(`  ${muniChecks.length} muni checkboxes`);
  for (const cb of muniChecks) {
    const checked = await cb.evaluate((el) => el.checked);
    if (!checked) await cb.click();
  }
}

// Step 3: Submit
console.log('Submitting...');
const submit = await page.$('input[type="submit"], input[value="Submit"], button[type="submit"]');
if (!submit) {
  console.log('No submit button found, listing all submit-like elements:');
  const all = await page.$$('input[type="submit"], input[type="button"]');
  for (const a of all) {
    console.log('  ', await a.evaluate((el) => `${el.name}|${el.value}`));
  }
}
if (submit) {
  await Promise.all([page.waitForLoadState('networkidle'), submit.click()]);
}
await page.waitForTimeout(3000);
await page.screenshot({ path: 'scripts/dls_scrape/post_submit.png', fullPage: true });
console.log('Post-submit screenshot saved');

// Step 4: Try to export
const exportBtn = await page.$('input[name="btnTableExport"], #btnTableExport');
if (exportBtn) {
  console.log('Clicking export button...');
  // Set up download handler
  const downloadPromise = page.waitForEvent('download', { timeout: 30000 }).catch((e) => null);
  await exportBtn.click();
  const download = await downloadPromise;
  if (download) {
    const path = `${OUT_DIR}/dls_excess_levy_full.csv`;
    await download.saveAs(path);
    console.log(`Saved download to ${path}`);
  } else {
    console.log('No download fired; saving HTML instead');
    fs.writeFileSync(`${OUT_DIR}/post_export_attempt.html`, await page.content());
  }
}

// Save the post-submit HTML for table parsing
fs.writeFileSync(`${OUT_DIR}/post_submit.html`, await page.content());
console.log('Saved post_submit.html, size:', (await page.content()).length);

await browser.close();
