// Tests the batch sheet: ID parsing, layout and PDF output (PDFs are written to tests/out/*.pdf
// and verified by tests/check_pdf.py with poppler + OpenCV).  Run: node tests/batch.mjs
import fs from 'node:fs';
import path from 'node:path';
import { parseIdList, computeLayout, buildMarkerPdf } from '../js/batch.js';
import { buildMarkerMatrix, getDictionary, loadDictionary } from '../js/aruco.js';

const OUT = path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1')), 'out');
let fail = 0;
const eq = (a, b, msg) => {
  if (JSON.stringify(a) !== JSON.stringify(b)) {
    fail++;
    console.log('FAIL', msg, JSON.stringify(a), '!=', JSON.stringify(b));
  }
};
const throws = (fn, msg) => {
  try {
    fn();
    fail++;
    console.log('FAIL (no error)', msg);
  } catch {}
};

// parsing
eq(parseIdList('1-5', 50), [1, 2, 3, 4, 5], '1-5');
eq(parseIdList('1,2-4,7', 50), [1, 2, 3, 4, 7], '1,2-4,7');
eq(parseIdList(' 7 , 3-1 ,3', 50), [7, 1, 2, 3], 'reverse range (expanded ascending) + dup');
eq(parseIdList('１，２〜３', 50), [1, 2, 3], 'full-width');
eq(parseIdList('0-49', 50).length, 50, 'whole dict');
throws(() => parseIdList('', 50), 'empty');
throws(() => parseIdList('1-50', 50), 'out of range');
throws(() => parseIdList('a', 50), 'garbage');
throws(() => parseIdList('1-3-5', 50), 'bad range');

// layout: 50 mm 4x4 marker with 1-cell quiet zone -> tile 50*8/6 = 66.7 mm
const mat = buildMarkerMatrix('DICT_4X4_50', 0, 1, 1);
const base = { paper: 'A4', landscape: false, markerMm: 50, marginMm: 10, gapMm: 0, label: true, tileCells: mat.total, detectSide: mat.detectSide, quietCells: 1 };
const L = computeLayout(base);
// each cut box = 50 mm marker + 2 x 8.33 mm quiet zone (+ 5 mm label strip) = 66.7 x 71.7 mm
eq([Math.round(L.tileW * 10) / 10, Math.round(L.tileH * 10) / 10], [66.7, 71.7], 'cut box size');
eq([L.cols, L.rows, L.perPage], [2, 3, 6], 'A4 portrait 50mm, margin 10');
eq(computeLayout({ ...base, marginMm: 5 }).perPage, 9, 'A4 margin 5 -> 3x3');
eq(computeLayout({ ...base, marginMm: 5, label: false }).perPage, 12, 'A4 margin 5, no label -> 3x4');
eq(computeLayout({ ...base, paper: 'A3' }).perPage, 20, 'A3 portrait 50mm -> 4x5');
eq(computeLayout({ ...base, gapMm: 5 }).perPage, 6, 'gap 5');
const Lbig = computeLayout({ ...base, markerMm: 200 });
eq(Lbig.perPage, 0, 'too big for A4');

// PDFs for raster verification
const sheets = [];
function make(name, dictName, idText, opts) {
  const d = getDictionary(dictName);
  const ids = parseIdList(idText, d.count);
  const items = ids.map((id) => ({ id, matrix: buildMarkerMatrix(dictName, id, 1, 1), label: `${dictName} ID ${id}` }));
  const lay = computeLayout({ ...base, ...opts, tileCells: items[0].matrix.total, detectSide: items[0].matrix.detectSide });
  const pdf = buildMarkerPdf({ layout: lay, items, footer: dictName });
  fs.writeFileSync(path.join(OUT, name), pdf);
  sheets.push({ file: name, dict: dictName, ids, markerMm: opts.markerMm ?? base.markerMm, pages: Math.ceil(ids.length / lay.perPage), pageMm: [lay.pw, lay.ph] });
}
await loadDictionary('tagStandard41h12');
make('batch_a4.pdf', 'DICT_4X4_50', '1,2-4,7', {});
make('batch_a3_land.pdf', 'DICT_6X6_250', '10-29', { paper: 'A3', landscape: true, markerMm: 40 });
make('batch_multi.pdf', 'DICT_APRILTAG_36h11', '0-12', {}); // 13 > 9 per page (3x3) -> 2 pages
make('batch_at3.pdf', 'tagStandard41h12', '100-105', { markerMm: 45 });
fs.writeFileSync(path.join(OUT, 'batch_sheets.json'), JSON.stringify(sheets, null, 1));
console.log(fail ? `FAILED (${fail})` : 'batch unit tests PASSED', sheets.map((s) => `${s.file}:${s.pages}p`).join(' '));
process.exit(fail ? 1 : 0);
