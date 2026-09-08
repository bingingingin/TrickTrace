import fs from 'node:fs/promises';
import assert from 'node:assert/strict';

const [beforePath, afterPath, output] = process.argv.slice(2);
assert(beforePath && afterPath && output, 'Usage: node scripts/compare_ocr_benchmarks.mjs BEFORE AFTER OUTPUT');
const before = JSON.parse(await fs.readFile(beforePath, 'utf8')).results;
const after = JSON.parse(await fs.readFile(afterPath, 'utf8')).results;
const key = r => `${r.dataset}/${r.file}/${r.width ?? 'original'}`;
assert.equal(new Set(before.map(key)).size, before.length, 'Duplicate baseline images');
assert.equal(new Set(after.map(key)).size, after.length, 'Duplicate candidate images');
assert.deepEqual(before.map(key).sort(), after.map(key).sort(), 'Datasets differ');
const errors = r => r.differences.flatMap(d => [
  ...d.missing.map(c => `${d.seat}:missing:${c}`), ...d.extra.map(c => `${d.seat}:extra:${c}`),
  ...(!d.unknownPreserved ? [`${d.seat}:unknown-overwritten`] : []),
]).concat(r.metadataExact ? [] : ['metadata']);
const rows = after.map(a => {
  const b = before.find(r => key(r) === key(a));
  const oldErrors = errors(b), newErrors = errors(a);
  return { image: key(a), dataset: a.dataset, beforeMs: b.elapsedMs, afterMs: a.elapsedMs,
    beforeErrors: oldErrors, afterErrors: newErrors,
    recovered: oldErrors.filter(e => !newErrors.includes(e)), regressions: newErrors.filter(e => !oldErrors.includes(e)) };
});
const median = values => {
  const sorted = [...values].sort((a, b) => a - b), mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};
const summary = [...new Set(rows.map(r => r.dataset))].map(dataset => {
  const group = rows.filter(r => r.dataset === dataset);
  const stats = prefix => ({
    exactImages: group.filter(r => !r[`${prefix}Errors`].length).length,
    missing: group.flatMap(r => r[`${prefix}Errors`]).filter(e => e.includes(':missing:')).length,
    missingJ: group.flatMap(r => r[`${prefix}Errors`]).filter(e => /:missing:[SHDC]J$/.test(e)).length,
    extra: group.flatMap(r => r[`${prefix}Errors`]).filter(e => e.includes(':extra:')).length,
    medianMs: median(group.map(r => r[`${prefix}Ms`])),
  });
  return { dataset, images: group.length, before: stats('before'), after: stats('after') };
});
const report = { note: 'Supplied, development, holdout and transformed supplied images are separate datasets. Batch elapsed times include other concurrent validation work; use isolated timing runs for speed claims.', summary,
  recoveredErrors: rows.reduce((n, r) => n + r.recovered.length, 0),
  regressionErrors: rows.reduce((n, r) => n + r.regressions.length, 0), rows };
await fs.writeFile(output, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(summary, null, 2));
assert.equal(report.regressionErrors, 0, `New errors: ${JSON.stringify(rows.filter(r => r.regressions.length))}`);
