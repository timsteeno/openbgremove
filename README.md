# Open BG Remover

A free, open-source, **100% in-browser** background remover — a self-hostable
replacement for remove.bg. Images never leave your device; there are no
accounts, credits, watermarks or resolution limits (up to ~16 MP, the iOS
canvas limit).

## Features
- Upload by file picker, drag & drop, paste (Ctrl/⌘+V) or image URL; multiple files at once
- Three AI models: **Fast** (U²-Netp, 4.6 MB), **Balanced** (ISNet 8-bit, 46 MB), **Best** (ISNet fp16, 90 MB)
- WebGPU acceleration when available, multi-threaded WASM otherwise
- Edge colour decontamination for clean hair/soft edges on new backgrounds
- Before/after compare slider, zoom & pan (wheel, pinch, space-drag)
- Erase / Restore brushes with size + hardness, undo/redo
- Backgrounds: transparent, colour (presets + picker), your own photo, blurred original
- Drop shadow, crop-to-subject with margin
- Export PNG / JPG / WebP at full or reduced size; batch “ZIP all”
- Installable PWA that works fully offline after the first visit (app shell + models cached)
- Share-target / `?url=` link support to open an image directly

## Run it
It is a static site with no build step:

```sh
python3 -m http.server 8000
# open http://localhost:8000
```

### Free hosting on GitHub Pages
Settings → Pages → *Deploy from a branch* → `main` / `(root)` → Save. The site
appears at `https://<user>.github.io/openbgremove/` a minute later. Netlify,
Cloudflare Pages or any static web server work too — just copy the files. `coi-serviceworker.js` enables
cross-origin isolation automatically so multi-threaded WASM works even on hosts
where you can't set COOP/COEP headers. If you can set headers, serve:

```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

## Tests
```sh
python3 -m http.server 8765 &
node tests/smoke.mjs http://localhost:8765/
ONLY_FAST=1 node tests/e2e.mjs http://localhost:8765/   # full functional suite
node tests/e2e2.mjs http://localhost:8765/              # regression checks
node tests/e2e3.mjs http://localhost:8765/              # review regressions
node tests/e2e4.mjs http://localhost:8765/              # memory / hibernation
node tests/e2e5.mjs http://localhost:8765/              # progress feedback / GPU watchdog
node tests/e2e6.mjs http://localhost:8765/              # model mirrors + hash checks
node tests/offline.mjs http://localhost:8765/           # offline/PWA check
```

## Licenses
- App code: public domain (The Unlicense, see `LICENSE`) — use it for anything, no attribution needed
- onnxruntime-web: MIT (`licenses/onnxruntime-web-MIT.txt`)
- coi-serviceworker: MIT (`licenses/coi-serviceworker-MIT.txt`)
- U²-Netp model: Apache-2.0 (`licenses/Apache-2.0.txt`), via npm `@planby-tech/rmbg-webgpu`
- ISNet models: Apache-2.0 (`licenses/Apache-2.0.txt`). Our own fp16 and 8-bit
  conversions of the "isnet-general-use" weights from the DIS project by
  Xuebin Qin et al. Source file: `isnet-general-use.onnx` as published by
  rembg (MIT), md5 `fc16ebd8b0c10d971d3513d564d01e29` (the checksum rembg
  pins), obtained via npm `isnet-background-removal@1.0.2`. Commits before
  this change shipped AGPL-3.0 copies from `@imgly/background-removal-data`;
  those files are no longer included.

## Model hosting
Models are split into parts of at most 20 MB, each with a SHA-256 hash in
`js/models.js`. The app tries the mirrors in `MODEL_MIRRORS` in order (by
default jsDelivr serving the `models-v1` tag of this repo, then the site
itself) and only accepts bytes whose hash matches. This keeps bandwidth off
GitHub Pages. If you change a model file, publish a new tag (e.g.
`models-v2`) and update the mirror URL and hashes together.
- Sample images: from scikit-image's bundled data (public domain / CC0).
