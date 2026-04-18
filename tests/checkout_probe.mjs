import { chromium, devices } from '@playwright/test';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ ...devices['Pixel 7'] });
const page = await context.newPage();
const pageErrors = [];
const consoleErrors = [];
page.on('pageerror', (err) => pageErrors.push(String(err.message || err)));
page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
await page.goto('http://localhost:3000/checkout', { waitUntil: 'networkidle' });
await page.waitForTimeout(300);
console.log(JSON.stringify({ pageErrors, consoleErrors: consoleErrors.slice(0, 3) }, null, 2));
await browser.close();
