// Model mirrors: a mirror that serves tampered bytes, an HTML error page or
// nothing at all is skipped (hash/size check) and the next mirror is used.
// Usage: node tests/e2e6.mjs [baseUrl]
import { createRequire } from 'module';
const { chromium } = createRequire(import.meta.url)('playwright');
const base = process.argv[2] || 'http://localhost:8765/';
const browser = await chromium.launch();
let pass = 0, fail = 0;
async function check(name, fn) {
  try { const note = await fn(); pass++; console.log(`PASS  ${name}${note ? '  — ' + note : ''}`); }
  catch (e) { fail++; console.log(`FAIL  ${name}\n      ${e.message}`); }
}
const assert = (c, m) => { if (!c) throw new Error(m); };

// Each scenario gets a fresh context (empty model cache) and blocks the
// service worker so page.route() sees the worker's requests.
async function scenario(cdnHandler) {
  const ctx = await browser.newContext({ serviceWorkers: 'block' });
  const seen = { cdn: 0, local: 0 };
  await ctx.route('https://cdn.jsdelivr.net/**', (route) => { seen.cdn++; return cdnHandler(route); });
  await ctx.route('**/models/**', (route) => { if (route.request().url().startsWith(base)) seen.local++; return route.fallback(); });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(base);
  await page.selectOption('#model-select', 'fast');
  await page.click('.sample[data-src="samples/coffee.jpg"]');
  await page.waitForFunction(() => ['done', 'error'].includes(window.__obr?.state.items[0]?.status), null, { timeout: 120000 });
  const st = await page.evaluate(() => { const i = window.__obr.state.items[0]; return i.status + ' ' + i.error; });
  await ctx.close();
  return { st, seen, errors };
}

await check('tampered bytes from the CDN are rejected; the site copy is used', async () => {
  const r = await scenario((route) => route.fulfill({ status: 200, contentType: 'application/octet-stream', headers: { 'access-control-allow-origin': '*' }, body: Buffer.alloc(4574861, 7) }));
  assert(r.st.startsWith('done'), r.st);
  assert(r.seen.cdn >= 1 && r.seen.local >= 1, JSON.stringify(r.seen));
  return JSON.stringify(r.seen);
});

await check('an HTML error page from the CDN is skipped', async () => {
  const r = await scenario((route) => route.fulfill({ status: 200, contentType: 'text/html', headers: { 'access-control-allow-origin': '*' }, body: '<html>oops</html>' }));
  assert(r.st.startsWith('done'), r.st);
});

await check('a CDN that is down is skipped', async () => {
  const r = await scenario((route) => route.abort('connectionrefused'));
  assert(r.st.startsWith('done'), r.st);
});

await check('a good CDN response is used without touching the site copy', async () => {
  const fs = await import('fs');
  const good = fs.readFileSync(new URL('../models/u2netp.onnx', import.meta.url));
  const r = await scenario((route) => route.fulfill({ status: 200, contentType: 'application/octet-stream', headers: { 'access-control-allow-origin': '*' }, body: good }));
  assert(r.st.startsWith('done'), r.st);
  assert(r.seen.cdn >= 1 && r.seen.local === 0, JSON.stringify(r.seen));
});

console.log(`\n${pass}/${pass + fail} passed`);
await browser.close();
process.exit(fail ? 1 : 0);
