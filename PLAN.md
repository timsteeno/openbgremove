# Open BG Remover — Planning / Resume Document

Goal: an open-source, self-hostable, 100% in-browser replacement for remove.bg
(which is shutting down as a public resource in December 2026).

**If you are resuming work: read this file top to bottom, check the task
checklist, then continue with the first unchecked item.** Update this file
after every meaningful step and commit it.

## Constraints discovered
- Dev sandbox can only reach the npm registry (no CDNs / HuggingFace / GitHub
  downloads). All assets therefore come from npm packages and are vendored
  into this repo so the site works offline / on any static host.
- Repo: `timsteeno/openbgremove` (public, branch `main`). History before
  the move was developed under `bg-remover/` in `timsteeno/final_finance`.
- Hosting: GitHub Pages from `main` / root; `.nojekyll` is present.
  App code relicensed to The Unlicense (public domain) per the owner.

## Architecture
- Static site, no build step. Open `index.html` via any static server
  (`python3 -m http.server` in the repo root). ES modules + module Web Worker.
- Inference: onnxruntime-web 1.22.0 (MIT), `ort.webgpu.min.mjs` (WebGPU EP
  with WASM fallback) in `vendor/ort/`.
- `vendor/coi-serviceworker.js` (MIT) enables cross-origin isolation on plain
  static hosts so multi-threaded WASM works.
- Models (in `models/`):
  - `u2netp.onnx` (4.6 MB, Apache-2.0, U²-Netp) — "Fast". 320x320 input,
    ImageNet mean/std with max-normalization, output min-max normalized.
    Source: npm `@planby-tech/rmbg-webgpu@0.2.1`.
  - `isnet_quint8.onnx` (44 MB) — "Balanced" (default). ISNet (DIS), 1024x1024
    input, `(x-128)/256`, output already 0..1 in `output`.
  - `isnet_fp16.onnx.part*` (88 MB split into <50MB parts) — "Best".
    ISNet models from npm `@imgly/background-removal-data@1.4.5` (AGPL-3.0
    package; reassembled from its chunk files via resources.json).
- Pipeline: decode image -> resize to model input -> worker inference ->
  mask upscale (bilinear) -> optional edge refine + foreground color
  decontamination -> RGBA cutout.
- Editor: full-res mask kept as Uint8Array; erase/restore brushes edit it;
  undo/redo; backgrounds (transparent / color / image / blurred original);
  drop shadow; auto-crop to subject with padding; export PNG/JPG/WebP,
  original or preview size.
- Batch: queue of many images, sequential processing, ZIP download
  (own store-only zip writer, `js/zip.js`).

## Feature checklist (remove.bg parity)
- [x] Upload: file picker, drag & drop, paste (Ctrl+V), image URL, multiple files
- [x] Automatic background removal (3 model quality levels)
- [x] Progress / status UI, model download progress + caching (Cache API)
- [x] Result view on checkerboard, before/after compare slider
- [x] Download PNG full resolution
- [x] Download JPG / WebP, with chosen background
- [x] Background: transparent, color picker + presets, custom image, blur original
- [x] Erase / restore brush with size + hardness, undo/redo, zoom
- [x] Drop shadow effect
- [x] Auto crop to subject + padding; preset canvas sizes optional
- [x] Batch processing + "Download all (ZIP)"
- [x] Edge refinement (foreground color estimation / decontamination)
- [x] Mobile-friendly responsive layout, dark mode
- [x] Keyboard shortcuts
- [x] README with self-hosting instructions + licenses
- [x] Automated Playwright tests: tests/smoke.mjs, tests/e2e.mjs (56 checks; ONLY_FAST=1 skips Best), tests/quality/* (model/matting analysis tools)

## Iteration log
- 2026-10-28: Investigated sandbox network, picked models, verified ISNet
  quint8 in Python onnxruntime on skimage sample images (good cutouts).
- 2026-10-28: v1 implemented. Smoke test passes
  in headless Chromium: astronaut sample processed with Balanced model,
  wasm x3 threads, crossOriginIsolated=true.
- NEXT: spawn sub-agents to (a) write a full Playwright E2E suite and report
  bugs, (b) review cut-out quality / edge handling, (c) UX + mobile review.
  Fix findings, re-test, repeat.

## How to test
    python3 -m http.server 8765 &   # from the repo root
    node tests/smoke.mjs http://localhost:8765/
Playwright is preinstalled globally in the dev container (require via
createRequire, see tests/smoke.mjs).
- 2026-10-28: UX sub-agent review done; applied fixes (mobile overflow, sticky
  download footer, cancel/timer, error actions, a11y roles, contrast, pinch
  anchor, restore ghost, crop edge margin). Committed.
  Pending: E2E agent report, quality agent report. Remaining UX ideas not yet
  done: mobile bottom tool tray for brushing, drag/scale photo backgrounds,
  aspect-ratio canvas presets, gradient backgrounds.
- 2026-10-28: Quality agent: models verified against Python reference (MAD
  <1.2/255 for ISNet). Fixed tile-seam bug in matting.js; added guided-filter
  upsampling + contrast curve (js/upscale.js) when "Clean edge colors" is on;
  blur radii now 45/3. E2E agent: 56-check suite; fixed removing the active
  item leaving the viewer on a closed bitmap. e2e passes 55/55 (ONLY_FAST).
- NEXT ideas: small-island removal for Fast model; mobile bottom tool tray;
  drag/scale photo backgrounds; aspect-ratio canvas presets; gradient bgs;
  brush size in image px option; second round of agent testing.
- 2026-10-28: Round-2 bug hunt (tests/e2e2.mjs, 9 checks). Fixed: removeIslands
  now uses hysteresis (keeps whiskers/thin structures), input alpha preserved
  (and processed over white), model label after mid-run switch, negative zoom
  label, viewBox-only SVG, semi-transparent blur edges, double download,
  worker auto-restart on crash, memory (inactive items release canvases),
  mobile toast placement. Default model = Best when WebGPU exists.
  Added: mobile floating brush tray, gradient backgrounds, aspect presets.
  e2e 56/56, e2e2 9/9.
- NEXT ideas: drag/scale photo backgrounds; brush size in image px option;
  PWA manifest for install/offline; i18n; round-3 agent testing on real-world
  photo categories (products, cars, hair, animals, graphics/logos).
- 2026-10-28: PWA: manifest + icon, coi-serviceworker extended with network-first
  shell cache; ?url= / share-target loading. tests/offline.mjs passes.
- 2026-10-28: Round-3 code review (tests/e2e3.mjs, 9 checks). Fixed: filename
  sanitising (zip-slip via ?url=), worker respawn loop (hello handshake +
  unsupported-browser message), corrupt model bytes cached forever (size check,
  html check, evict on parse failure), crop view shifting mid-stroke, restore
  over input-transparent pixels, ZIP double-run / items changing mid-ZIP,
  stroke + item switch, malformed % in URL, export cap 16 MP, SW waitUntil +
  no-cache revalidation + query-less navigation keys, small leaks.
  All suites pass: e2e 56/56, e2e2 9/9, e2e3 9/9, offline OK.
- 2026-10-28: Memory hibernation done: inactive items keep the cutout as a
  PNG blob and drop decoded bitmaps; wake() re-decodes on select/ZIP/apply-all;
  queued items decode on demand and processing starts after the first decode.
  tests/e2e4.mjs (hibernation, 10 x 6 MP batch) passes; all suites green.
- NEXT ideas: drag/scale photo backgrounds; brush size in image px option;
  i18n; more agent rounds on real-world photo categories when test photos
  are available.
- 2026-10-28: Moved to its own public repo timsteeno/openbgremove; app code
  released into the public domain (Unlicense).
- 2026-10-28: User report: "Re-run removal" ran for minutes with no feedback.
  Not reproducible on CPU (re-run ~9 s); likely a stalled WebGPU run (untested
  here, no GPU) or a first-time model download. Added: overlay shows model +
  CPU/GPU, expected time learned from this device's past runs, time-based
  progress bar; watchdog retries on CPU when the GPU stalls (>4x expected or
  >30 s; engine start >45 s) and remembers it for the session; "Use Fast model
  instead" button on slow runs. tests/e2e5.mjs. All suites pass.
- OPEN QUESTION: which model/browser/GPU the user had — real GPU testing still
  needed.

## Phase 0 (stabilize) — started 2026-10-29
Roadmap doc: https://claude.ai/artifact/7cb9mqxouPJ61fBF2EHGHm
- [x] Replace AGPL ISNet files with our own conversions of the Apache-2.0
      original. Source verified: npm `isnet-background-removal@1.0.2` ships
      `isnet-general-use.onnx` whose md5 fc16ebd8b0c10d971d3513d564d01e29
      equals rembg 2.0.86's pinned checksum for the official file. Converted
      with onnxruntime.transformers.float16 (keep_io_types) and
      quantize_dynamic(QUInt8) after trimming side outputs. Masks vs fp32:
      fp16 MAE <=0.02/255; q8 0.1-6.6/255 (same as imgly q8).
- [x] Models in <=20 MB chunks with sha256, loaded from mirrors
      (jsDelivr GitHub tag, then same origin) with hash verification.
      tools/convert_isnet.py reproduces the parts byte-for-byte; tests/e2e6.mjs
      covers tampered/HTML/down/good mirrors. Mirror pinned to commit 7d505b9a45cbc913ee24a7dca82950a24f0b802c (tag pushes are refused from the dev sandbox).
- [x] CI: .github/workflows/test.yml — all suites on Chromium (tests/run-all.mjs),
      smoke on Firefox + WebKit (non-blocking until verified).
- [x] Device self-test page (diagnostics.html): env + WebGPU adapter, per
      model x CPU/GPU first/warm timings, shape check, GPU-vs-CPU mask diff,
      copyable JSON report. Linked from About.
- HUMAN NEEDED: run diagnostics on real devices; confirm jsDelivr serves the
  tag (sandbox can't reach CDNs); approve workflow push if GitHub refuses.

### Real-device results
| Date | Device | Browser | Model | CPU warm | GPU | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| 2026-10-29 | MacBook (8 cores, 32 GB, Apple Metal 3, shader-f16) | Chrome 156 | Fast | 0.38 s | hung | wasm x4; first run 3.1 s |
| 2026-10-29 | same | same | Balanced | 2.87 s | hung | first run 5.8 s |
| 2026-10-29 | same | same | Best | 2.52 s | hung | first run 19 s incl. 90 MB download |
| 2026-10-29 | Android 10 phone (8 cores, 8 GB, Mali Valhall, shader-f16) | Chrome 156 | Fast | 0.89 s | not run | wasm x4; first 5.0 s |
| 2026-10-29 | same | same | Balanced | 7.36 s | not run | first 8.6 s |
| 2026-10-29 | same | same | Best | 7.55 s | not run | first 16.6 s |
| 2026-10-29 | GitHub runner (4 vCPU) | Firefox 142 | Balanced | — | — | 47 s inference vs ~11 s Chromium: Firefox WASM much slower |

Decision (2026-10-29): WebGPU is opt-in ("GPU (WebGPU, experimental)");
"auto" now means CPU, and the app no longer auto-selects Best on GPU
machines. diagnostics.html reports hangs (no engine message for 60 s,
`?hang=ms` to override) with the stage instead of freezing.
Observation: on both ARM devices Best (fp16) is as fast as Balanced (8-bit)
on CPU (Mac 2.5 vs 2.9 s, Android 7.6 vs 7.4 s) while giving cleaner masks;
on the x86 runner Balanced is faster (~11 vs ~16 s). Candidate Phase 2
change: pick Best by default on ARM, or speed up the 8-bit model.
NEXT: get a report from a Windows/NVIDIA PC; investigate the Metal hang
(session create vs run; try ORT newer than 1.22, fp32 vs fp16, numThreads=1).
