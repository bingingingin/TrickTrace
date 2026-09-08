import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';

// Use the same browser, input order and machine for before/after measurements.
// Each recognition creates a fresh Worker, matching the application's uploads.
const output = process.argv[2] ?? 'artifacts/ocr-benchmark.json';
const parse = text => text === '?' ? null : text.split('.').flatMap((r, i) =>
  [...r.replace(/10/g, 'T').replace(/-/g, '')].map(rank => 'SHDC'[i] + rank));
const fixtures = JSON.parse(await fs.readFile('tests/fixtures/recognition.json', 'utf8'));
const tests = fixtures.map(f => ({ ...f, dataset: 'supplied', path: 'images', hands: Object.fromEntries([...'NESW'].map((s, i) => [s, parse(f.hands[i])])) }));
for (const dataset of ['independent', 'holdout']) {
  const path = `artifacts/ocr-${dataset}`;
  tests.push(...JSON.parse(await fs.readFile(`${path}/manifest.json`, 'utf8')).map(f => ({ ...f, dataset, path })));
}
tests.push(...tests.filter(t => t.dataset === 'supplied').flatMap(t => [960, 720].map(width => ({ ...t, dataset: 'variants', width }))));
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const results = process.env.OCR_RESUME ? JSON.parse(await fs.readFile(output, 'utf8')).results : [];
const pending = tests.filter(t => (!process.env.OCR_FILTER || `${t.dataset}/${t.file}`.includes(process.env.OCR_FILTER)) &&
  !results.some(r => r.dataset === t.dataset && r.file === t.file && r.width === t.width));
// Parallel pages are for accuracy regression only, never speed measurements.
const concurrency = Number(process.env.OCR_CONCURRENCY ?? 1);
if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 4) throw Error('OCR_CONCURRENCY must be 1–4');
let writes = Promise.resolve();
try {
  await Promise.all(Array.from({ length: concurrency }, async () => {
  const page = await browser.newPage();
  await page.route('http://127.0.0.1:5173/', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>OCR benchmark</title>' }));
  await page.goto('http://127.0.0.1:5173/');
  for (let t; (t = pending.shift());) {
    const { result, elapsedMs } = await page.evaluate(async t => {
      const { recognize } = await import(/* @vite-ignore */ t.module);
      let blob = await (await fetch(`/${t.path}/${encodeURIComponent(t.file)}`)).blob();
      if (t.width) {
        const bitmap = await createImageBitmap(blob);
        const canvas = document.createElement('canvas');
        canvas.width = t.width;
        canvas.height = Math.round(bitmap.height * t.width / bitmap.width);
        canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        bitmap.close();
        blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.85));
      }
      const start = performance.now();
      const result = await recognize(new File([blob], t.file, { type: blob.type }), () => {});
      return { result, elapsedMs: Math.round(performance.now() - start) };
    }, { ...t, module: process.env.OCR_MODULE ?? '/src/vision/recognize.ts' });
    const p = result.board.position;
    const differences = [...'NESW'].map(seat => {
      const expected = t.hands[seat], actual = p.hands[seat];
      return { seat, missing: (expected ?? []).filter(c => !actual?.includes(c)), extra: (actual ?? []).filter(c => !expected?.includes(c)), unknownPreserved: expected !== null || actual === null };
    });
    const metadataExact = (!t.contract || t.contract === `${p.contract.level}${p.contract.strain}${p.contract.declarer}`) &&
      (!t.current || JSON.stringify(t.current) === JSON.stringify(p.current.map(c => c.seat + c.card))) &&
      (!t.dealer || t.dealer === result.board.dealer) && (!t.vulnerability || t.vulnerability === result.board.vulnerability) && (!t.leader || t.leader === p.leader);
    const exact = metadataExact && differences.every(d => !d.missing.length && !d.extra.length && d.unknownPreserved);
    const metadata = {contract: `${p.contract.level}${p.contract.strain}${p.contract.declarer}`, dealer: result.board.dealer,
      vulnerability: result.board.vulnerability, leader: p.leader, current: p.current.map(c => c.seat + c.card)};
    results.push({ dataset: t.dataset, file: t.file, width: t.width, elapsedMs, exact, metadataExact, metadata, differences });
    writes = writes.then(() => fs.writeFile(output, JSON.stringify({ results }, null, 2) + '\n'));
    await writes;
    console.log(results.length, t.dataset, t.file, t.width ?? '', elapsedMs, exact ? 'exact' : JSON.stringify(differences.filter(d => d.missing.length || d.extra.length)));
  }
  await page.close();
  }));
} finally { await browser.close(); }
