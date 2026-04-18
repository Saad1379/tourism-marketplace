import { chromium, devices } from '@playwright/test';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ ...devices['Pixel 7'], colorScheme: 'dark' });
const page = await context.newPage();

await page.goto('http://localhost:3000/how-it-works', { waitUntil: 'networkidle' });
await page.waitForTimeout(500);
await page.screenshot({ path: 'tests/artifacts/mobile-audit/how-it-works-dark.png', fullPage: true });

await page.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
await page.waitForTimeout(300);
await page.click('button[aria-label="Open menu"]');
await page.waitForTimeout(300);
await page.screenshot({ path: 'tests/artifacts/mobile-audit/root-dark-menu-open.png', fullPage: false });

await browser.close();
console.log('saved screenshots');
