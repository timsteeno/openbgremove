// Model registry. Paths are relative to the site root; each file is split
// into parts of at most 20 MB (so free CDNs accept them) with a SHA-256 hash
// that is checked before the bytes are used or cached.
//
// ISNet files are our own conversions of the Apache-2.0 "isnet-general-use"
// weights from the DIS project (fp16 and dynamic 8-bit); see README.

// Where model parts are fetched from, in order. A mirror that fails or
// returns bytes with the wrong hash is skipped. Self-hosters can put their
// own CDN first or remove the jsDelivr entry.
export const MODEL_MIRRORS = [
  'https://cdn.jsdelivr.net/gh/timsteeno/openbgremove@models-v1/',
  '', // same origin as the app
];

export const MODELS = {
  fast: {
    label: 'Fast',
    description: 'U²-Netp · 4.6 MB · quick, softer edges',
    files: [
      { path: 'models/u2netp.onnx', bytes: 4574861, sha256: '309c8469258dda742793dce0ebea8e6dd393174f89934733ecc8b14c76f4ddd8' },
    ],
    bytes: 4574861,
    size: 320,
    norm: 'imagenet-max',
    out: 'minmax',
    gpuFriendly: true,
  },
  balanced: {
    label: 'Balanced',
    description: 'ISNet 8-bit · 46 MB · great quality',
    files: [
      { path: 'models/isnet-q8.onnx.part0', bytes: 20000000, sha256: 'bb8f96176c96098aae51e2cd7d5f195335697c326bf62395529356fa3473e8c9' },
      { path: 'models/isnet-q8.onnx.part1', bytes: 20000000, sha256: 'da30186530149038af1e99be6647ef7eaf2d0f560d209f6ebcaf06c25a974555' },
      { path: 'models/isnet-q8.onnx.part2', bytes: 6175506, sha256: '768dab2f567f0cbfb6d57cdfcb84eaf1ae0c3b9f0f95087fdaa3f5a42102bbb0' },
    ],
    bytes: 46175506,
    size: 1024,
    norm: 'isnet',
    out: 'raw',
    gpuFriendly: false,
  },
  best: {
    label: 'Best',
    description: 'ISNet fp16 · 90 MB · highest fidelity',
    files: [
      { path: 'models/isnet-fp16.onnx.part0', bytes: 20000000, sha256: '135c1e1105650b72a1285949cd4d76023d8c91f266e62762a3fa1fe8fbf69586' },
      { path: 'models/isnet-fp16.onnx.part1', bytes: 20000000, sha256: '085013f55a6dd048dc66c04f79dd905152d75f771b9f2aac1e5b4c3b1faa6b2d' },
      { path: 'models/isnet-fp16.onnx.part2', bytes: 20000000, sha256: '6491e05b7461514174e1eba4db7e8f6e3665350f5d3d5128d4b6766242f585e4' },
      { path: 'models/isnet-fp16.onnx.part3', bytes: 20000000, sha256: '6c60c9f1259a32b9ff5a0ecc949062d2d8e5b749cb6ca2152a18324c114fec54' },
      { path: 'models/isnet-fp16.onnx.part4', bytes: 10435479, sha256: '75d83b487ed576873fb11fde5099116bdb19bc0829d5987668ac9a725cc00953' },
    ],
    bytes: 90435479,
    size: 1024,
    norm: 'isnet',
    out: 'raw',
    gpuFriendly: true,
  },
};
export const DEFAULT_MODEL = 'balanced';
