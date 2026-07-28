import { chromium } from 'playwright';
const b = await chromium.launch();
const ctx = await b.newContext({ userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36' });
const p = await ctx.newPage();
await p.goto('https://www.mass.gov/info-details/opeb-summary-reports', { timeout: 60000, waitUntil: 'domcontentloaded' }).catch(e=>console.log('goto err', e.message));
await p.waitForTimeout(3000);
const links = await p.$$eval('a', as => as.map(a => [a.textContent.trim(), a.href]).filter(x => /opeb|download|doc/i.test(x[1]) || /opeb|report/i.test(x[0])));
console.log(JSON.stringify(links, null, 1));
await b.close();
