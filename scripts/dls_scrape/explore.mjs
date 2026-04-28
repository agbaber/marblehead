import { chromium } from 'playwright';
import fs from 'node:fs';

const URL = 'https://dls-gw.dor.state.ma.us/reports/rdPage.aspx?rdReport=Prop2.5.ExcessLevyCapandOverride_MAIN';
const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1400, height: 1000 },
  userAgent:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
});
const page = await ctx.newPage();
console.log('Navigating...');
await page.goto(URL, { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(2500);
console.log('Title:', await page.title());
console.log('Final URL:', page.url());
await page.screenshot({ path: 'scripts/dls_scrape/explore_landing.png', fullPage: true });
const html = await page.content();
console.log('HTML size:', html.length);
const selects = await page.$$('select');
console.log('select count:', selects.length);
for (let i = 0; i < selects.length; i++) {
  const name = await selects[i].evaluate((el) => el.name || el.id || '?');
  const opts = await selects[i].evaluate((el) =>
    Array.from(el.options)
      .slice(0, 10)
      .map((o) => o.text + '|' + o.value)
  );
  console.log(`  select[${i}] name=${name} first10=${JSON.stringify(opts)}`);
}
const tables = await page.$$('table');
console.log('table count:', tables.length);
fs.writeFileSync('scripts/dls_scrape/explore_landing.html', html);
console.log('saved explore_landing.html');
await browser.close();
