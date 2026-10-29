// Downloads every model part from each remote mirror in js/models.js and
// verifies size + SHA-256. Run where the internet is reachable (CI).
// Usage: node tests/check-mirrors.mjs
import { createHash } from 'crypto';
import { MODELS, MODEL_MIRRORS } from '../js/models.js';

let bad = 0;
for (const mirror of MODEL_MIRRORS.filter(Boolean)) {
  for (const [key, def] of Object.entries(MODELS)) {
    for (const part of def.files) {
      const url = mirror + part.path;
      const t0 = Date.now();
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const buf = Buffer.from(await res.arrayBuffer());
        const hash = createHash('sha256').update(buf).digest('hex');
        const cors = res.headers.get('access-control-allow-origin');
        if (buf.length !== part.bytes) throw new Error(`size ${buf.length} != ${part.bytes}`);
        if (hash !== part.sha256) throw new Error('sha256 mismatch');
        if (cors !== '*') throw new Error(`missing CORS header (got ${cors})`);
        console.log(`ok    ${key.padEnd(9)} ${part.path}  ${(buf.length / 1e6).toFixed(1)} MB in ${Date.now() - t0} ms`);
      } catch (e) {
        bad++;
        console.log(`FAIL  ${key.padEnd(9)} ${url}: ${e.message}`);
      }
    }
  }
}
console.log(bad ? `\n${bad} part(s) failed` : '\nAll mirror parts verified.');
process.exit(bad ? 1 : 0);
