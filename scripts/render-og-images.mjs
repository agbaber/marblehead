#!/usr/bin/env node
/*
 * Render the static OG card for where-candidates-stand.html.
 *
 * Runs headless Chromium against a local Jekyll preview so the canvas
 * has access to /favicon-192.png, /assets/lighthouse/lighthouse.svg,
 * and the Libre Franklin webfont. Writes
 *   assets/og-where-candidates-stand.png   (1200 x 630)
 *
 * Re-run any time the design or election date changes.
 *
 * Usage:
 *   npm run dev    # in another terminal
 *   node scripts/render-og-images.mjs --base http://localhost:4000
 *
 * Or pass a different base URL to render against a preview deploy.
 */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const argBase = process.argv.find(a => a.startsWith('--base='));
const BASE = argBase ? argBase.slice(7) : (process.env.SITE || 'http://localhost:4000');

const W = 1200, H = 630;

const RACES = [
  { name: 'Select Board',                 accent: '#8AB0C4' },
  { name: 'School Committee',             accent: '#6FB3C7' },
  { name: 'Moderator',                    accent: '#B08AB4' },
  { name: 'Recreation & Park Commission', accent: '#9DBC7A' },
  { name: 'Cemetery Commission',          accent: '#E4B363' },
  { name: 'Housing Authority',            accent: '#8AB0C4' }
];

const HTML = `<!doctype html>
<html><head>
  <meta charset="utf-8">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Libre+Franklin:wght@500;600;700&display=swap" rel="stylesheet">
</head><body style="margin:0;background:#222;font-family:'Libre Franklin'">
  <canvas id="og" width="${W}" height="${H}"></canvas>
  <img id="logo" src="/favicon-192.png">
  <script>
    const HEAD = '"Libre Franklin", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
    const SANS = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
    const RACES = ${JSON.stringify(RACES)};
    const D = { bg:'#0B1620', navBg:'#0F1B26', text:'#E6ECF1', textMid:'#AFBCC7', textSub:'#7D8C99', hairline:'#22303C' };

    function tracked(c, text, x, y, ls) { let cx = x; for (let i = 0; i < text.length; i++) { c.fillText(text[i], cx, y); cx += c.measureText(text[i]).width + ls; } }
    function chip(c, x, y, w, h, fill, stroke) { c.fillStyle = fill; c.strokeStyle = stroke; c.lineWidth = 1; const r = h/2; c.beginPath(); c.moveTo(x+r,y); c.arcTo(x+w,y,x+w,y+h,r); c.arcTo(x+w,y+h,x,y+h,r); c.arcTo(x,y+h,x,y,r); c.arcTo(x,y,x+w,y,r); c.closePath(); c.fill(); c.stroke(); }
    function blend(hex, otherHex, t) { const a = parseHex(hex), b = parseHex(otherHex); return '#' + [0,1,2].map(i => Math.round(a[i]*t + b[i]*(1-t)).toString(16).padStart(2,'0')).join(''); }
    function parseHex(h) { h = h.replace('#',''); return [parseInt(h.substr(0,2),16), parseInt(h.substr(2,2),16), parseInt(h.substr(4,2),16)]; }

    let houseImg = null;
    async function loadHouse(color) {
      const res = await fetch('/assets/lighthouse/lighthouse.svg');
      const txt = (await res.text()).replace(/currentColor/g, color);
      const blob = new Blob([txt], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);
      const img = new Image();
      await new Promise((resolve, reject) => { img.onload = resolve; img.onerror = reject; img.src = url; });
      houseImg = img;
    }
    function drawHouseWatermark(c, x, y, w, h, alpha) { if (!houseImg) return; c.save(); c.globalAlpha = alpha; c.drawImage(houseImg, x, y, w, h); c.restore(); }

    function render() {
      const c = document.getElementById('og').getContext('2d');
      const W = ${W}, H = ${H};
      c.textBaseline = 'alphabetic';
      c.fillStyle = D.bg; c.fillRect(0, 0, W, H);
      drawHouseWatermark(c, W - 540, -80, 720, 1080, 0.095);

      const navH = 72;
      c.fillStyle = D.navBg; c.fillRect(0, 0, W, navH);
      c.strokeStyle = D.hairline; c.lineWidth = 1;
      c.beginPath(); c.moveTo(0, navH); c.lineTo(W, navH); c.stroke();
      const logo = document.getElementById('logo');
      if (logo.complete) c.drawImage(logo, 36, 16, 42, 42);
      c.fillStyle = D.text;
      c.font = '700 22px ' + HEAD;
      c.fillText('MHD Data', 90, 44);

      const PAD = 80;
      let y = navH + 88;
      const ruleW = 28;
      c.fillStyle = D.text;
      c.fillRect(PAD, y - 6, ruleW, 3);
      c.fillStyle = D.textSub;
      c.font = '700 14px ' + SANS;
      tracked(c, 'MARBLEHEAD \\u00B7 JUNE 9, 2026 ELECTION', PAD + ruleW + 14, y, 2);

      y += 76;
      c.fillStyle = D.text;
      c.font = '700 72px ' + HEAD;
      c.fillText('Where the candidates stand', PAD, y);

      y += 60;
      c.fillStyle = D.textMid;
      c.font = '500 22px ' + SANS;
      c.fillText('Six contested races. What every candidate said about', PAD, y);
      y += 32;
      c.fillText('the override, schools, and trash.', PAD, y);

      y += 76;
      let cx = PAD;
      const gap = 14;
      c.font = '700 14px ' + SANS;
      RACES.forEach(r => {
        const tw = c.measureText(r.name).width;
        const padX = 20, chipH = 34;
        const w = tw + padX * 2 + 14;
        if (cx + w > W - PAD) { cx = PAD; y += chipH + gap; }
        chip(c, cx, y, w, chipH, blend(r.accent, D.bg, 0.18), blend(r.accent, D.bg, 0.34));
        c.fillStyle = r.accent;
        c.beginPath(); c.arc(cx + padX + 4, y + chipH / 2, 4, 0, Math.PI * 2); c.fill();
        c.fillStyle = D.text;
        c.fillText(r.name, cx + padX + 16, y + chipH / 2 + 5);
        cx += w + gap;
      });

      const footY = H - 42;
      c.fillStyle = D.text;
      c.font = '700 22px ' + HEAD;
      c.fillText('marbleheaddata.org', PAD, footY);
      c.fillStyle = D.textSub;
      c.font = '500 14px ' + SANS;
      const tag = 'Drawn from candidates\\u2019 own published answers';
      const tagW = c.measureText(tag).width;
      c.fillText(tag, W - PAD - tagW, footY);
    }

    async function run() {
      const logo = document.getElementById('logo');
      await Promise.all([
        document.fonts.load('700 72px "Libre Franklin"'),
        document.fonts.load('700 22px "Libre Franklin"'),
        document.fonts.ready,
        logo.complete ? Promise.resolve() : new Promise(r => logo.addEventListener('load', r)),
        loadHouse('#E6ECF1')
      ]);
      render();
      window.__renderDone = true;
    }
    run();
  </script>
</body></html>`;

(async () => {
  const sitePath = '_site/__og-gen.html';
  fs.writeFileSync(sitePath, HTML);

  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on('pageerror', err => console.error('[pageerror]', err.message));
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warn') console.error(`[console-${m.type()}]`, m.text()); });
  page.on('requestfailed', r => console.error('[request-failed]', r.url(), r.failure()?.errorText));
  await page.goto(`${BASE}/__og-gen.html`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__renderDone === true, { timeout: 15000 });

  const dataUrl = await page.evaluate(() => document.getElementById('og').toDataURL('image/png'));
  const out = path.resolve('assets/og-where-candidates-stand.png');
  fs.writeFileSync(out, Buffer.from(dataUrl.replace(/^data:image\/png;base64,/, ''), 'base64'));
  console.log('wrote', out);

  fs.unlinkSync(sitePath);
  await browser.close();
})();
