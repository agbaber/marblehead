import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto('http://localhost:4001/charts/override_calculator.html', { waitUntil: 'networkidle' });

// Test 1: Default values
const defaultAv = await page.locator('#assessed-value').inputValue();
const defaultBill = await page.locator('#current-bill').inputValue();
console.log(`Default AV: ${defaultAv}, Default Bill: ${defaultBill}`);

// Test 2: Edit AV, check that bill updates
await page.locator('#assessed-value').fill('$2,000,000');
await page.locator('#assessed-value').blur();
await page.waitForTimeout(200);
const newBillFromAv = await page.locator('#current-bill').inputValue();
console.log(`After setting AV=$2M, bill = ${newBillFromAv}`);  // Should be ~$18,100

// Test 3: Edit bill, check that AV updates
await page.locator('#current-bill').fill('$5,000');
await page.locator('#current-bill').blur();
await page.waitForTimeout(200);
const newAvFromBill = await page.locator('#assessed-value').inputValue();
console.log(`After setting bill=$5,000, AV = ${newAvFromBill}`);  // Should be ~$552K

// Test 4: Verify scenario table updates for $5K bill case
const firstRowFY29 = await page.locator('.scenario-table tbody tr').first().locator('td').nth(3).innerText();
console.log(`At $5K bill, Tier 1 FY29 cell: ${firstRowFY29}`);

await browser.close();
