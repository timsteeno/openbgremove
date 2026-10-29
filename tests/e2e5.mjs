// Processing feedback + watchdog: progress text/bar, automatic CPU retry when
// the GPU stalls, and the "Use Fast model instead" escape for slow runs.
// Usage: node tests/e2e5.mjs [baseUrl]
import { createRequire } from 'module';
const { chromium } = createRequire(import.meta.url)('playwright');
const base = process.argv[2] || 'http://localhost:8765/';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
let pass = 0, fail = 0;
async function check(name, fn) {
  try { const note = await fn(); pass++; console.log(`PASS  ${name}${note ? '  — ' + note : ''}`); }
  catch (e) { fail++; console.log(`FAIL  ${name}\n      ${e.message}`); }
}
const assert = (c, m) => { if (!c) throw new Error(m); };
const S = (fn, arg) => page.evaluate(fn, arg);
const item = () => S(() => { const i = window.__obr.state.items[0]; return { s: i.status, stage: i.stage, b: i.backend, model: i.modelUsed, force: !!i.forceCpu }; });
const waitDone = () => page.waitForFunction(() => window.__obr.state.items[0]?.status === 'done', null, { timeout: 180000 });
const waitStage = (st) => page.waitForFunction((st) => window.__obr.state.items[0]?.stage === st && window.__obr.state.items[0]?.status === 'processing', st, { timeout: 120000, polling: 50 });
const rerun = async () => { await S(() => { document.querySelector('#sect-advanced').open = true; }); await page.click('#reprocess-btn'); };

await page.goto(base);
await page.waitForTimeout(2000);
await page.selectOption('#model-select', 'balanced');
await page.click('.sample[data-src="samples/astronaut.jpg"]');
await waitDone();

await check('re-run shows model, processor, expected time and a progress bar', async () => {
  await rerun();
  await waitStage('inference');
  await page.waitForTimeout(1200);
  const text = await page.textContent('#overlay-text');
  const sub = await page.textContent('#overlay-sub');
  const barShown = await page.isVisible('#overlay-progress');
  const width = await S(() => parseFloat(document.querySelector('#overlay-bar').style.width));
  assert(/Balanced model on CPU/.test(text), 'text: ' + text);
  assert(/usually about \d+ s/.test(sub), 'sub: ' + sub);
  assert(barShown && width > 0 && width <= 99, 'bar ' + width);
  await waitDone();
  return `"${text}" / "${sub}"`;
});

await check('a stalled GPU run is retried on the CPU automatically', async () => {
  // GPU is opt-in, so pick it (headless has no adapter; the run is marked as GPU below).
  await S(() => { const d = document.querySelector('#device-select'); d.value = 'gpu'; d.dispatchEvent(new Event('change')); });
  await rerun();
  await waitStage('inference');
  // Pretend this run is on the GPU and has been stuck for a minute.
  await S(() => { const i = window.__obr.state.items[0]; i.backendRunning = 'webgpu'; i.stageAt = performance.now() - 60000; });
  await page.waitForFunction(() => window.__obr.state.items[0].forceCpu === true, null, { timeout: 5000 });
  const toastText = await page.textContent('#toast');
  assert(/retried on the CPU/.test(toastText), 'toast: ' + toastText);
  await waitDone();
  const it = await item();
  assert(it.b.startsWith('wasm'), 'backend ' + it.b);
});

await check('"Use Fast model instead" appears on a slow run and switches models', async () => {
  await rerun();
  await waitStage('inference');
  await S(() => { window.__obr.state.items[0].stageAt = performance.now() - 120000; });
  await page.waitForSelector('[data-act="fast"]', { timeout: 3000 });
  assert(/taking longer than usual/.test(await page.textContent('#overlay-sub')), 'slow note');
  await page.click('[data-act="fast"]');
  await waitDone();
  const it = await item();
  assert(it.model === 'fast', 'model ' + it.model);
  assert(await page.inputValue('#model-select') === 'fast', 'select updated');
});

await check('a stalled multi-threaded CPU run restarts single-threaded and remembers it', async () => {
  await S(() => { document.querySelector('#device-select').value = 'cpu'; document.querySelector('#device-select').dispatchEvent(new Event('change')); });
  await page.selectOption('#model-select', 'fast');
  await rerun();
  await waitStage('inference');
  const before = await S(() => window.__obr.state.items[0].backendRunning);
  assert(/^wasm x\d/.test(before), 'expected a threaded run first, got ' + before);
  await S(() => { window.__obr.state.items[0].stageAt = performance.now() - 300000; });
  await page.waitForFunction(() => /single-threaded/.test(document.querySelector('#toast').textContent), null, { timeout: 5000 });
  await waitDone();
  const it = await item();
  assert(it.b === 'wasm', 'backend after restart ' + it.b);
  const saved = await S(() => JSON.parse(localStorage.getItem('obr-prefs') || '{}').singleThread);
  assert(saved === true, 'remembered: ' + saved);
  return `${before} → ${it.b}`;
});

await check('no uncaught page errors', async () => { assert(!errors.length, errors.join(' | ')); });
console.log(`\n${pass}/${pass + fail} passed`);
await browser.close();
process.exit(fail ? 1 : 0);
