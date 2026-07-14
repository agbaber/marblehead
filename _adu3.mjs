import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage();
const all = [];
p.on('request', r => all.push(r.url()));
await p.goto('https://www.mass.gov/info-details/accessory-dwelling-units', {waitUntil:'load', timeout:60000}).catch(()=>{});
await p.waitForTimeout(3000);
// try clicking anything that looks like a map trigger
for(let i=0;i<8;i++){ await p.mouse.wheel(0,1000); await p.waitForTimeout(800); }
await p.waitForTimeout(4000);
console.log('=== external hosts requested ===');
const hosts = [...new Set(all.map(u=>{try{return new URL(u).host}catch{return u}}))].filter(h=>!/mass\.gov$/.test(h));
hosts.forEach(h=>console.log(h));
console.log('=== interesting urls ===');
[...new Set(all)].filter(u=>/tableau|arcgis|google|felt|carto|mapbox|datawrapper|dwcdn|\.csv|\.json|\.geojson|storymap|lookerstudio/i.test(u)).forEach(u=>console.log(u));
await p.screenshot({path:'/home/claude/marblehead/_adu_shot.png', fullPage:true});
console.log('shot saved');
await b.close();
