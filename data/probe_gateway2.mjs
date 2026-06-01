// Trigger a Schedule A search for Marblehead FY24 — find downloadable form.
import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true });
const page = await (await browser.newContext({ userAgent: 'Mozilla/5.0', acceptDownloads: true })).newPage();
await page.goto('https://dlsgateway.dor.state.ma.us/gateway/DLSPublic/Search/Search', { waitUntil: 'networkidle' });
await page.waitForTimeout(3000);

// Look for form types
const forms = await page.evaluate(() => {
  const out = [];
  for (const sel of document.querySelectorAll('select')) {
    if (/form|type/i.test(sel.name || sel.id || '')) {
      out.push({ name: sel.name || sel.id, options: [...sel.options].slice(0, 60).map(o => ({ value: o.value, text: o.text })) });
    }
  }
  return out;
});
console.log('form selects:');
for (const s of forms) {
  console.log('  ', s.name);
  for (const o of s.options) {
    if (/schedule/i.test(o.text)) console.log('    *', o.value, o.text);
  }
}

// Look for all inputs to understand the form
const inputs = await page.evaluate(() => {
  return [...document.querySelectorAll('input, select')].map(el => ({ name: el.name, id: el.id, type: el.type, value: el.value }));
});
console.log('\nall form fields:');
for (const i of inputs.slice(0, 40)) console.log(' ', i);

await browser.close();
