// Smoke test: load the page, process a sample, export PNG. Usage: node tests/smoke.mjs [baseUrl]
import { createRequire } from 'module';
const pw = createRequire(import.meta.url)('playwright');
// BROWSER=firefox|webkit runs the same check in another engine (default chromium).
const engine = process.env.BROWSER || 'chromium';
const chromium = pw[engine];
const base = process.argv[2] || 'http://localhost:8765/';
const browser = await chromium.launch();
const page = await browser.newPage();
const logs = [];
page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
page.on('worker', (w) => w.on('console', (m) => logs.push(`[worker ${m.type()}] ${m.text()}`)));
page.on('requestfailed', (r) => logs.push(`[requestfailed] ${r.url()} ${r.failure()?.errorText}`));
await page.goto(base);
await page.waitForLoadState('networkidle');
await page.waitForTimeout(1500); // coi-serviceworker may reload once
console.log('crossOriginIsolated:', await page.evaluate(() => self.crossOriginIsolated));
await page.click('.sample[data-src="samples/astronaut.jpg"]');
const snapshot = () => page.evaluate(() => {
  const i = window.__obr?.state.items[0];
  return i ? {
    status: i.status, stage: i.stage, error: i.error, timings: i.timings, backend: i.backend || i.backendRunning,
    overlay: document.querySelector('#overlay-text')?.textContent, sub: document.querySelector('#overlay-sub')?.textContent,
    features: { offscreen: typeof OffscreenCanvas !== 'undefined', sab: typeof SharedArrayBuffer !== 'undefined', gpu: !!navigator.gpu },
  } : { status: 'no item' };
});
let timedOut = false;
try {
  await page.waitForFunction(() => window.__obr?.state.items[0]?.status === 'done' || window.__obr?.state.items[0]?.status === 'error', null, { timeout: +(process.env.SMOKE_TIMEOUT || 180000) });
} catch {
  timedOut = true;
}
const info = await snapshot();
if (timedOut) info.timedOut = true;
console.log(engine, info);
await page.screenshot({ path: process.env.SHOT || 'smoke.png' }).catch(() => {});
console.log(logs.join('\n'));
await browser.close();
process.exit(info.status === 'done' ? 0 : 1);
