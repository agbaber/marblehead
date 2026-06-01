import { chromium } from 'playwright';
import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  acceptDownloads: true
});
const page = await context.newPage();
await page.goto('https://www.mass.gov/lists/recycling-solid-waste-data-for-massachusetts-cities-towns', { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);

// Use page.evaluate to fetch a URL — this uses the browser context's cookies/headers.
async function fetchInBrowser(url) {
  return await page.evaluate(async (u) => {
    const r = await fetch(u, { credentials: 'include' });
    const buf = await r.arrayBuffer();
    const arr = new Uint8Array(buf);
    let bin = '';
    const chunk = 0x4000;
    for (let i = 0; i < arr.length; i += chunk) bin += String.fromCharCode(...arr.subarray(i, i+chunk));
    return { status: r.status, len: buf.byteLength, b64: btoa(bin) };
  }, url);
}

const files = [
  ['https://www.mass.gov/doc/2025-municipal-solid-waste-recycling-survey-responses/download', 'data/trash_analysis/2025_MSW_survey.xlsx'],
  ['https://www.mass.gov/doc/2024-municipal-solid-waste-recycling-survey-responses/download', 'data/trash_analysis/2024_MSW_survey.xlsx'],
];
for (const [url, dest] of files) {
  const r = await fetchInBrowser(url);
  console.log(url, '->', r.status, r.len);
  if (r.status === 200) {
    writeFileSync(dest, Buffer.from(r.b64, 'base64'));
  }
}

await browser.close();
