import { chromium } from '@playwright/test';

const OUT = '/private/tmp/claude-501/-Users-nagyattila-dev-EXPERT-AI-TEAM/94fddcee-69d0-4486-91ba-0f1b811ed5f6/scratchpad';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });

const errors = [];
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
page.on('response', r => { if (r.status() >= 500) errors.push(`${r.status()} ${r.url()}`); });

await page.goto('http://localhost:3111/login', { waitUntil: 'networkidle' });
await page.fill('#email', 'demo@funnelintelligence.dev');
await page.fill('#password', 'demo1234');
await Promise.all([
  page.waitForURL('**/overview', { timeout: 30000 }).catch(() => {}),
  page.click('button[type=submit]'),
]);
await page.waitForTimeout(2500);
console.log('after login url:', page.url());

for (const [name, path] of [
  ['overview', '/overview'],
  ['funnels', '/funnels'],
  ['opportunities', '/opportunities'],
  ['attribution', '/attribution'],
  ['tracking-health', '/tracking-health'],
]) {
  const res = await page.goto('http://localhost:3111' + path, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
  const h1 = await page.locator('h1').first().textContent().catch(() => null);
  console.log(`${path.padEnd(18)} ${res?.status()}  h1="${(h1||'').trim()}"`);
}

if (errors.length) console.log('\nERRORS:\n' + errors.join('\n'));
else console.log('\nno page errors');
await browser.close();
