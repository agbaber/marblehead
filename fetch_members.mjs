import { chromium } from 'playwright';
const b = await chromium.launch();
const ctx = await b.newContext({ userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36' });
const urls = [
  ['BRISTOL', 'https://www.bristolcountyretirement.org/about-bcrs/pages/member-units'],
  ['BRISTOL2', 'https://www.bristolcountyretirement.org/members'],
  ['PLYMOUTH', 'https://www.pcr-ma.org/general/page/member-units'],
];
for (const [name, url] of urls) {
  const p = await ctx.newPage();
  try {
    await p.goto(url, { timeout: 45000, waitUntil: 'domcontentloaded' });
    await p.waitForTimeout(2500);
    const txt = await p.locator('body').innerText();
    console.log('=====' + name + '=====');
    // print lines mentioning Easton / Duxbury and general town list
    console.log(txt.split('\n').filter(l=>l.trim()).join('\n').slice(0, 4000));
  } catch (e) { console.log(name, 'FAILED', e.message); }
  await p.close();
}
await b.close();
