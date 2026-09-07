import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';

// These are robustness probes derived from the supplied screenshots, not an
// independent dataset. Ground truth is kept outside the recognition Worker.
const fixtures = JSON.parse(await fs.readFile('tests/fixtures/recognition.json', 'utf8'));
const parse = text => text === '?' ? null : text.split('.').flatMap((r, i) =>
  [...r.replace(/-/g, '')].map(rank => 'SHDC'[i] + rank));
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const results = [];
try {
  const page = await browser.newPage();
  await page.goto('http://127.0.0.1:5173/');
  for (const fixture of fixtures) for (const width of [960, 720]) {
    const result = await page.evaluate(async ({ file, width }) => {
      const { recognize } = await import('/src/vision/recognize.ts');
      const bitmap = await createImageBitmap(await (await fetch('/images/' + encodeURIComponent(file))).blob());
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = Math.round(bitmap.height * width / bitmap.width);
      canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      bitmap.close();
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.85));
      return recognize(new File([blob], file, { type: 'image/jpeg' }), () => {});
    }, { file: fixture.file, width });
    const differences = [...'NESW'].map((seat, i) => {
      const expected = parse(fixture.hands[i]);
      const actual = result.board.position.hands[seat];
      return { seat, missing: (expected ?? []).filter(c => !actual?.includes(c)),
        extra: (actual ?? []).filter(c => !expected?.includes(c)),
        unknownPreserved: expected !== null || actual === null };
    });
    const p = result.board.position;
    const stateExact = (!fixture.contract || fixture.contract === `${p.contract.level}${p.contract.strain}${p.contract.declarer}`) &&
      (!fixture.current || JSON.stringify(fixture.current) === JSON.stringify(p.current.map(c => c.seat + c.card)));
    const exact = stateExact && differences.every(d => !d.missing.length && !d.extra.length && d.unknownPreserved);
    results.push({ file: fixture.file, width, jpegQuality: 0.85, exact, stateExact, differences });
    console.log(fixture.file, width, exact ? 'exact' : JSON.stringify(differences.filter(d => d.missing.length || d.extra.length)));
    await fs.writeFile('docs/validation/ocr-variants.json', JSON.stringify({
      dataset: 'Supplied screenshot resizes and JPEG recompression; not independent',
      images: results.length, exactImages: results.filter(r => r.exact).length, results,
    }, null, 2) + '\n');
  }
} finally { await browser.close(); }
