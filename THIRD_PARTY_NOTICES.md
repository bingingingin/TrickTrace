# Third-party notices

TrickTrace original code and original assets are licensed under Apache-2.0.
Copyright 2026 TrickTrace contributors.

Third-party material retains its own copyright and license. The root LICENSE does not replace the notices below.

| Component | Distributed location | License / notice |
| --- | --- | --- |
| DDS, by Bo Haglund and Soren Hein | `vendor/dds/`, `public/dds/` | Apache-2.0; [license](public/dds/LICENSE.txt), [upstream](https://github.com/dds-bridge/dds). The Git submodule pins the source revision. |
| ONNX Runtime Web | `public/models/ort-wasm-*`, npm dependency | MIT; [license](public/licenses/onnxruntime.txt) |
| Tesseract.js | `public/ocr/worker.min.js`, npm dependency | Apache-2.0; [license](public/licenses/tesseract-js.txt) |
| Tesseract.js core | `public/ocr/tesseract-core-*.wasm.js` | Apache-2.0; [license](public/licenses/tesseract-core.txt) |
| Tesseract English language data | `public/ocr/eng.traineddata.gz` | Apache-2.0; [upstream](https://github.com/naptha/tessdata), [license](public/licenses/tessdata.txt) |
| Noto Sans SC | `public/fonts/` | SIL Open Font License 1.1; [license](public/fonts/OFL.txt). WOFF2 subsets are generated with fontTools. |

DDS is compiled through the project-specific wrapper in `native/bridge.cpp`; build flags are recorded in `scripts/build_dds.py`. Upstream license and copyright notices are preserved.

Additional npm dependency versions and licenses are recorded in `package-lock.json` and the installed packages, including React / React DOM (MIT) and Lucide (ISC). Preserve their notices when redistributing bundled code.

The glyph models in `public/models/glyphs*.onnx` are trained by this project from rendered synthetic characters. The accompanying JSON files record labels and training metadata. User screenshots are not training inputs. Training scripts reference locally installed fonts; the font files themselves are not distributed here.

The CCBA rule mapping is implemented by this project. Its reference document is attributed in [docs/ccba-inference.md](docs/ccba-inference.md); the original document is not bundled or relicensed by this project.
