"""Rebuild models/isnet-fp16.* and models/isnet-q8.* from the Apache-2.0
ISNet "isnet-general-use" weights.

Usage:
    pip install onnx onnxruntime onnxconverter-common
    python3 tools/convert_isnet.py path/to/isnet-general-use.onnx

The input is rembg's published export (md5 fc16ebd8b0c10d971d3513d564d01e29),
e.g. from https://github.com/danielgatis/rembg/releases/download/v0.0.0/isnet-general-use.onnx
Writes into models/ (or $OUT_DIR/models) and prints the part list (path, bytes, sha256) to paste into js/models.js.
"""
import hashlib
import os
import sys
import tempfile

import onnx
from onnxruntime.quantization import QuantType, quantize_dynamic
from onnxruntime.transformers.float16 import convert_float_to_float16

EXPECTED_MD5 = 'fc16ebd8b0c10d971d3513d564d01e29'
PART = 20_000_000  # jsDelivr serves files up to 20 MB from GitHub
ROOT = os.environ.get('OUT_DIR') or os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')


def main(src):
    md5 = hashlib.md5(open(src, 'rb').read()).hexdigest()
    if md5 != EXPECTED_MD5:
        sys.exit(f'unexpected md5 {md5} (expected {EXPECTED_MD5})')
    tmp = tempfile.mkdtemp()
    model = onnx.load(src)
    # Keep only the main output; the side outputs are training heads.
    main_out = model.graph.output[0]
    del model.graph.output[:]
    model.graph.output.append(main_out)
    # Drop the nodes that only fed the removed outputs.
    model = onnx.utils.Extractor(model).extract_model([model.graph.input[0].name], [main_out.name])
    trimmed = os.path.join(tmp, 'fp32.onnx')
    onnx.save(model, trimmed)

    fp16 = os.path.join(tmp, 'fp16.onnx')
    onnx.save(convert_float_to_float16(onnx.load(trimmed), keep_io_types=True), fp16)
    q8 = os.path.join(tmp, 'q8.onnx')
    quantize_dynamic(trimmed, q8, weight_type=QuantType.QUInt8)

    for path, name in [(q8, 'isnet-q8.onnx'), (fp16, 'isnet-fp16.onnx')]:
        data = open(path, 'rb').read()
        print(f'{name}: {len(data)} bytes')
        for i in range(0, len(data), PART):
            chunk = data[i:i + PART]
            rel = f'models/{name}.part{i // PART}'
            os.makedirs(os.path.join(ROOT, 'models'), exist_ok=True)
            open(os.path.join(ROOT, rel), 'wb').write(chunk)
            print(f"  {{ path: '{rel}', bytes: {len(chunk)}, sha256: '{hashlib.sha256(chunk).hexdigest()}' }},")


if __name__ == '__main__':
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(sys.argv[1])
