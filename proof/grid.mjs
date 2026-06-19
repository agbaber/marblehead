import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const cards = [
  'checkbook','town-budget','town-debt','where-has-the-money-gone',
  'senior-tax-relief','inside-school-staffing','school-building-maintenance',
  'org-chart','branches','meetings',
];

// Embed images as base64 data URIs so Playwright can render them
const imgTags = cards.map(c => {
  const buf = fs.readFileSync(path.join(ROOT, 'assets', 'og', `${c}.png`));
  const b64 = buf.toString('base64');
  return `<div><img src="data:image/png;base64,${b64}"/><div>${c}</div></div>`;
}).join('');

const html = `
<style>
  body{background:#0F2A3D;margin:0;padding:24px;font-family:sans-serif}
  .g{display:grid;grid-template-columns:1fr 1fr;gap:16px}
  .g img{width:100%;border-radius:8px}
  .g div{color:#fff;text-align:center;font-size:14px;margin-top:4px}
</style>
<div class="g">${imgTags}</div>
`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 3300 }, deviceScaleFactor: 2 });
await page.setContent(html);
await page.waitForLoadState('networkidle');
await page.screenshot({ path: path.join(ROOT, 'proof', 'og-cards-grid.png'), fullPage: true });
await browser.close();
console.log('wrote proof/og-cards-grid.png');
