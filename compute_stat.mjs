import { chromium } from 'playwright';
const b = await chromium.launch();
const ctx = await b.newContext({ userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36' });
const p = await ctx.newPage();
await p.goto('https://www.mass.gov/info-details/funded-ratios', { timeout: 60000, waitUntil: 'domcontentloaded' });
await p.waitForTimeout(3500);
const seen = new Map();
for (let i=0;i<40;i++){
  const rows = await p.$$eval('table tbody tr', trs => trs.map(tr => Array.from(tr.querySelectorAll('td')).map(td=>td.innerText.trim())).filter(r=>r.length>=3));
  for (const r of rows) seen.set(r[0], r);
  const nextEls = await p.$$('a, button');
  let clicked=false;
  for (const el of nextEls){ const t=(await el.innerText().catch(()=>'')).trim(); const cls=(await el.getAttribute('class').catch(()=>''))||'';
    if((t==='›'||t==='Next'||t==='»')&&!cls.includes('disabled')){ const before=rows[0]?rows[0][0]:''; await el.click().catch(()=>{}); await p.waitForTimeout(600);
      const after=await p.$$eval('table tbody tr',trs=>trs[0]?.querySelector('td')?.innerText.trim()||''); if(after&&after!==before){clicked=true;break;} } }
  if(!clicked) break;
}
const vals = [...seen.values()].map(r=>parseFloat(r[1])).filter(v=>!isNaN(v)).sort((a,c)=>a-c);
const n=vals.length;
const median = n%2? vals[(n-1)/2] : (vals[n/2-1]+vals[n/2])/2;
const mean = vals.reduce((s,v)=>s+v,0)/n;
console.log('N systems:', n);
console.log('MEDIAN:', median.toFixed(1));
console.log('MEAN:', mean.toFixed(1));
console.log('MIN:', vals[0], 'MAX:', vals[n-1]);
await b.close();
