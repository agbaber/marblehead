import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
});
const page = await context.newPage();

for (const url of [
  'https://www.mass.gov/lists/recycling-solid-waste-data-for-massachusetts-cities-towns',
  'https://www.mass.gov/info-details/pay-as-you-throw-paytsave-money-and-reduce-trash-smart',
]) {
  await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(3000);

  const links = await page.evaluate(() => {
    return [...document.querySelectorAll('a')].map(a => ({
      href: a.href,
      text: (a.textContent || '').trim().slice(0, 160)
    })).filter(a => a.href && /xls|csv|pdf|download|payt|recycl|sanit|trash|solid/i.test(a.href + ' ' + a.text));
  });
  console.log('\n=== URL:', url);
  for (const l of links) console.log(' ', l.text, '\n     =>', l.href);
}

await browser.close();
