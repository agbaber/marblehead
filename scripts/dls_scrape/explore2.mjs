import { chromium } from 'playwright';
import fs from 'node:fs';

const URL = 'https://dls-gw.dor.state.ma.us/reports/rdPage.aspx?rdReport=Prop2.5.ExcessLevyCapandOverride_10_pres&rdSubReport=True&rdResizeFrame=True';
const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1400, height: 1200 },
  userAgent:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
});
const page = await ctx.newPage();
console.log('Navigating to iframe URL...');
await page.goto(URL, { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(3000);
console.log('Title:', await page.title());
console.log('Final URL:', page.url());
await page.screenshot({ path: 'scripts/dls_scrape/explore2.png', fullPage: true });
const html = await page.content();
console.log('HTML size:', html.length);

const selects = await page.$$('select');
console.log('select count:', selects.length);
for (let i = 0; i < selects.length; i++) {
  const name = await selects[i].evaluate((el) => el.name || el.id || '?');
  const optCount = await selects[i].evaluate((el) => el.options.length);
  const opts = await selects[i].evaluate((el) =>
    Array.from(el.options)
      .slice(0, 8)
      .map((o) => `${o.text}|${o.value}`)
  );
  console.log(`  select[${i}] name=${name} count=${optCount} first8=${JSON.stringify(opts)}`);
}

const tables = await page.$$('table');
console.log('table count:', tables.length);

const inputs = await page.$$('input');
console.log('input count:', inputs.length);
for (let i = 0; i < Math.min(20, inputs.length); i++) {
  const desc = await inputs[i].evaluate((el) => `name=${el.name} type=${el.type} value=${el.value}`);
  console.log(`  input[${i}] ${desc}`);
}

fs.writeFileSync('scripts/dls_scrape/explore2.html', html);
console.log('saved explore2.html');
await browser.close();
