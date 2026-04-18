import { chromium, devices } from '@playwright/test';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ ...devices['Pixel 7'], colorScheme: 'dark' });
const page = await context.newPage();
await page.goto('http://localhost:3000/how-it-works', { waitUntil: 'networkidle' });
await page.waitForTimeout(400);
const data = await page.evaluate(() => {
  const list = document.querySelector('[data-slot="tabs-list"]');
  const triggers = Array.from(document.querySelectorAll('[data-slot="tabs-trigger"]'));
  const rect = (el) => {
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
  };
  const stylePick = (el) => {
    const s = getComputedStyle(el);
    return {
      display: s.display,
      height: s.height,
      lineHeight: s.lineHeight,
      paddingTop: s.paddingTop,
      paddingBottom: s.paddingBottom,
      borderTop: s.borderTopWidth,
      borderBottom: s.borderBottomWidth,
      boxSizing: s.boxSizing,
      position: s.position,
      transform: s.transform,
      background: s.backgroundColor,
    };
  };
  return {
    list: list ? { rect: rect(list), className: list.className, style: stylePick(list)} : null,
    triggers: triggers.map((t) => ({ text: t.textContent?.trim(), state: t.getAttribute('data-state'), rect: rect(t), className: t.className, style: stylePick(t) })),
  };
});
console.log(JSON.stringify(data, null, 2));
await browser.close();
