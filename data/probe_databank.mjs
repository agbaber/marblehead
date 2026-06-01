import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
});
const page = await context.newPage();
await page.goto('https://www.mass.gov/lists/schedule-a-reports-revenues-expenditures-and-more', { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(3000);

const all = await page.evaluate(() => {
  return [...document.querySelectorAll('a')].map(a => ({
    href: a.href,
    text: (a.textContent || '').trim().slice(0, 160)
  })).filter(a => a.href && /xls|csv|aspx|download|schedule|sanit|object/i.test(a.href + ' ' + a.text));
});
console.log('Matching links:', all.length);
for (const a of all) console.log('  ', a.text, '\n     =>', a.href);

await browser.close();
