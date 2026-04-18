import { chromium, devices } from '@playwright/test';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ ...devices['Pixel 7'], colorScheme: 'dark' });
const page = await context.newPage();
await page.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
await page.waitForTimeout(200);
await page.click('button[aria-label="Open menu"]');
await page.waitForTimeout(100);
const before = await page.evaluate(() => ({ y: window.scrollY, bodyOverflow: getComputedStyle(document.body).overflow }));
await page.mouse.wheel(0, 800);
await page.waitForTimeout(100);
const after = await page.evaluate(() => ({ y: window.scrollY, bodyOverflow: getComputedStyle(document.body).overflow }));
console.log(JSON.stringify({ before, after }, null, 2));
await browser.close();
