import { chromium, devices } from '@playwright/test';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const workdir = '/Users/touristicatours/Downloads/v0-touristica-tours';
const baseUrl = 'http://localhost:3000';

const pageFilesRaw = execSync("find app -name 'page.tsx' | sort", { cwd: workdir, encoding: 'utf8' });
const pageFiles = pageFilesRaw.trim().split('\n').filter(Boolean);

const routeFromFile = (file) => {
  let route = file
    .replace(/^app/, '')
    .replace(/\/page\.tsx$/, '')
    .replace(/\[id\]/g, 'sample-id');
  if (route === '') route = '/';
  return route;
};

const routes = pageFiles.map(routeFromFile);
const outDir = path.join(workdir, 'tests', 'artifacts', 'mobile-audit');
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  ...devices['Pixel 7'],
  locale: 'en-US',
});

const results = [];

for (const route of routes) {
  const page = await context.newPage();
  const pageErrors = [];
  const consoleErrors = [];
  const requestFailures = [];

  page.on('pageerror', (err) => pageErrors.push(String(err.message || err)));
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('requestfailed', (req) => requestFailures.push(`${req.method()} ${req.url()} :: ${req.failure()?.errorText || 'failed'}`));

  let status = null;
  let finalUrl = null;

  try {
    const response = await page.goto(`${baseUrl}${route}`, { waitUntil: 'networkidle', timeout: 45000 });
    status = response ? response.status() : null;
    finalUrl = page.url();

    await page.waitForTimeout(300);

    const metrics = await page.evaluate(() => {
      const doc = document.documentElement;
      const body = document.body;
      const width = window.innerWidth;
      const overflowX = Math.max(doc.scrollWidth, body.scrollWidth) - width;

      const fixedLarge = Array.from(document.querySelectorAll('*')).filter((el) => {
        const style = window.getComputedStyle(el);
        if (style.position !== 'fixed') return false;
        const rect = el.getBoundingClientRect();
        return rect.width > width * 0.35 && rect.height > 40;
      }).length;

      const stickyTop = Array.from(document.querySelectorAll('*')).filter((el) => {
        const style = window.getComputedStyle(el);
        return style.position === 'sticky' && (style.top === '0px' || style.top === '0');
      }).length;

      const h1 = document.querySelector('h1');
      const h1Top = h1 ? Math.round(h1.getBoundingClientRect().top) : null;

      return {
        title: document.title,
        overflowX,
        fixedLarge,
        stickyTop,
        h1Top,
        bodyClass: body.className,
      };
    });

    const safeName = route === '/' ? 'root' : route.replace(/^\//, '').replace(/\//g, '__');
    await page.screenshot({
      path: path.join(outDir, `${safeName}.png`),
      fullPage: true,
    });

    results.push({ route, status, finalUrl, pageErrors, consoleErrors, requestFailures, ...metrics });
  } catch (err) {
    results.push({ route, status, finalUrl, fatal: String(err), pageErrors, consoleErrors, requestFailures });
  } finally {
    await page.close();
  }
}

await browser.close();

const reportPath = path.join(outDir, 'report.json');
fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));

const summary = {
  totalRoutes: results.length,
  withOverflow: results.filter((r) => typeof r.overflowX === 'number' && r.overflowX > 1).map((r) => ({ route: r.route, overflowX: r.overflowX })),
  withConsoleErrors: results.filter((r) => (r.consoleErrors || []).length > 0).map((r) => ({ route: r.route, count: r.consoleErrors.length })),
  withPageErrors: results.filter((r) => (r.pageErrors || []).length > 0).map((r) => ({ route: r.route, count: r.pageErrors.length })),
  redirects: results.filter((r) => r.finalUrl && !r.finalUrl.endsWith(r.route)).map((r) => ({ route: r.route, finalUrl: r.finalUrl, status: r.status })),
};

console.log(JSON.stringify(summary, null, 2));
console.log(`Report: ${reportPath}`);
