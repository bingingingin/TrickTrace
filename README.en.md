# TrickTrace

[简体中文](README.md) | **English**

Follow the cards. Trace every trick.

TrickTrace is a browser-based bridge analysis tool with image recognition, DDS double-dummy solving, two-hand analysis, single-dummy opening-lead analysis, card-by-card replay, and optimal-line tracing. Recognition and solving run locally in your browser. The site serves the models, WASM, and fonts; no cloud AI API configuration is required.

[Try it online](https://tricktrace.pages.dev/) · [Apache-2.0 license](LICENSE) · [Third-party notices](THIRD_PARTY_NOTICES.md)

## Features

- **Board management**: enter cards with the card picker or hand text; import PBN, DLM, LIN, and project JSON; switch, export, and delete boards.
- **Image recognition**: upload, drop, or paste an image. ONNX glyph models and Tesseract identify candidate cards for review. Unknown hands remain unknown; missing cards are never filled in merely to complete the deck.
- **Double-dummy analysis**: calculate available tricks for all four declarers and five strains, plus Par; inspect legal plays, equally optimal choices, and trick losses.
- **Line tracing**: play cards, step back, and explore branches, or generate a complete optimal DDS line from the current position.
- **Two-hand analysis**: keep declarer and dummy fixed while sampling the defenders' hands under constraints. After choosing an opening lead, generate a complete conditional line with all four players' cards and each trick winner. Regenerate from the new position when actual play differs.
- **Single-dummy opening leads**: keep only the opening leader's hand fixed and sample the other three hands. Compare the probability of defeating the contract for every lead. Fast mode calculates defeat rates; exact mode also calculates average tricks.
- **Auction and hand constraints**: share HCP, suit-length, and advanced constraints between two-hand and opening-lead analysis. Selected CCBA v2.2 auction rules infer hand constraints, with manual overrides available.
- **Local saving and themes**: store boards and playback state in the browser, with light/dark themes and responsive layouts.
- **Chinese and English**: use `中 / EN` at the top to switch the interface, explanations, and messages. Chinese is the default, and your choice is remembered. Switching preserves boards, results, and playback progress; user-entered board names remain unchanged.

## Quick start

You need Node.js 22 LTS, npm, and Git. The repository includes the DDS WASM, OCR models, and fonts needed by the browser. Routine frontend development does not require retraining models or rebuilding those assets.

```sh
git clone --recurse-submodules https://github.com/bingingingin/TrickTrace.git
cd TrickTrace
npm ci
npm run dev
```

Open the local URL printed in the terminal, normally `http://127.0.0.1:5173/`. For an existing clone, run `git submodule update --init --recursive` to fetch the DDS source and test deals.

Build and preview:

```sh
npm run build
npm run preview
```

### Basic workflow

1. Import a deal, upload an image, or choose a seat and select cards. Hand text uses spades, hearts, diamonds, and clubs in that order, for example `AKQ.JT9.432.A765`. Use `-` for a void and `?` for an unknown hand.
2. Check the seats, hands, contract, declarer, and opening lead. Review image-recognition results manually before using them.
3. With a complete deal, inspect the double-dummy table. Click a cell showing at least seven tricks to set that contract, then play card by card or explore a complete optimal line.
4. For hidden-hand analysis, select two-hand or opening-lead analysis and configure sampling constraints. Results are estimates under those assumptions.

Clearing site data can remove saved boards. Export anything you want to keep. Deleting boards also deletes their playback branches.

## Development and validation

| Command | Purpose and prerequisites |
| --- | --- |
| `npm run dev` | Start the Vite development server |
| `npm run build` | Run TypeScript checks and build production assets in `dist/` |
| `npm test` | Run the full Vitest suite; requires the DDS submodule and native reference executable |
| `npm run build:dds` | Rebuild browser DDS; requires Emscripten in `.tools/emsdk` |
| `npm run test:lead` | Validate opening leads in the browser; start the local server and install Chrome first |
| `npm run test:ocr` | Run private-image regressions; supply images matching the annotations, as these images are not distributed with the repository |

For the full solver tests, install Python 3.11 and a C++20-capable `g++`, then run from the project root:

```sh
python scripts/build_dds.py --native
npm test
```

Tests invoke the native executable at `artifacts/native/dds-reference.exe`. See the [validation notes](docs/validation/status.md) for additional checks, synthetic OCR samples, and private-data boundaries. See the [Python development environment](docs/python-environment.md) for offline training and font tools. These supporting documents are currently in Chinese.

## Project structure

```text
src/core/       Board data, file formats, and rules of play
src/engine/     DDS, workers, sampling, auction constraints, and tactics
src/vision/     Browser image recognition
src/components/ UI components
src/i18n/       Language preferences and English UI/CCBA catalogs
native/         Native and WASM DDS bridge code
public/         Models, runtimes, fonts, and brand assets served by the site
tests/          Core rules, solver, and constrained-sampling tests
scripts/        Build, training, and validation tools
vendor/dds/     Pinned upstream DDS submodule
docs/           Feature boundaries and development notes
```

## Deployment

Deploy the `dist/` directory produced by `npm run build` to a static hosting service. For Cloudflare Pages, use `npm run build` as the build command and `dist` as the output directory, or upload the directory to your Pages project with Wrangler.

Preserve the COOP/COEP settings in `public/_headers`. On other hosts, configure equivalent response headers:

```text
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

Deploy only `dist/`, not the repository root. OCR and WASM assets are large; initial loading time depends on the network and device.

## Known limitations

- Low resolution, compression, rotation, and fanned layouts can cause missed or misidentified cards. Glyph-model scores are not calibrated probabilities of correctness.
- DDS assumes all four hands are known, and optimal lines may not be unique. Two-hand and opening-lead sampling still have model bias and strategy-fusion error; they do not prove a guaranteed win with hidden hands.
- CCBA inference maps selected conventions to hand constraints. It does not cover every competitive auction or continuation. Uncovered calls are flagged and can be handled manually. See [rule sources and coverage](docs/ccba-inference.md) and [constrained sampling](docs/lead-analysis-comparison.md).
- Tactic labels explain lines of play. Complex squeeze structures have not been comprehensively validated. See [feature scope](docs/feature-status.md).

## Contributing

Issues and improvements are welcome. Reports should include reproduction steps, browser version, and expected results. Only share deals or images that can be made public, and remove personal information. Run relevant tests and `npm run build` for code changes. Evaluate OCR changes separately on development samples and independent validation samples.

Private screenshots, original design materials, development logs, and machine-specific validation results are not distributed with the source. Do not force-add personal data or credentials excluded by `.gitignore`.

## License

Original code and original assets distributed with this repository are licensed under the [Apache License 2.0](LICENSE). Third-party code, runtimes, fonts, and data retain their own licenses. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for sources and licensing details.
