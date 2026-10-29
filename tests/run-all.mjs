// Runs every test suite in sequence against a running server and exits
// nonzero if any fails. Usage: node tests/run-all.mjs [baseUrl]
import { spawnSync } from 'child_process';
const base = process.argv[2] || 'http://localhost:8765/';
const suites = ['smoke', 'e2e', 'e2e2', 'e2e3', 'e2e4', 'e2e5', 'e2e6', 'offline'];
const failed = [];
for (const s of suites) {
  console.log(`\n===== ${s} =====`);
  const r = spawnSync(process.execPath, [new URL(`./${s}.mjs`, import.meta.url).pathname, base], {
    stdio: 'inherit',
    env: { ONLY_FAST: '1', ...process.env },
  });
  if (r.status !== 0) failed.push(s);
}
console.log(failed.length ? `\nFAILED: ${failed.join(', ')}` : '\nAll suites passed.');
process.exit(failed.length ? 1 : 0);
