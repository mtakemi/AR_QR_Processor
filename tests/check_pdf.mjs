// Verifies the PNGs rasterised from tests/out/batch_*.pdf (pdftoppm -r 300 -gray -png) with the
// JS detector: IDs per sheet, printed marker size (mm) and the white quiet zone inside each cut box.
// Run after:  pdftoppm -r 300 -gray -png tests/out/<name>.pdf tests/out/<name>_p
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { detectMarkers, loadDictionary } from '../js/aruco.js';

const { PNG } = createRequire(import.meta.url)('pngjs');
const OUT = path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1')), 'out');
const DPI = 300;
let fail = 0;
await loadDictionary('AUTO');
for (const s of JSON.parse(fs.readFileSync(path.join(OUT, 'batch_sheets.json'), 'utf8'))) {
  const base = s.file.replace(/\.pdf$/, '_p');
  const pngs = fs.readdirSync(OUT).filter((f) => f.startsWith(base + '-') && f.endsWith('.png')).sort();
  const found = [];
  const sides = [];
  let pageMm = null;
  let quietOk = true;
  for (const f of pngs) {
    const p = PNG.sync.read(fs.readFileSync(path.join(OUT, f)));
    pageMm = [Math.round((p.width / DPI) * 25.4), Math.round((p.height / DPI) * 25.4)];
    const img = { data: p.data, width: p.width, height: p.height };
    for (const m of detectMarkers(img, { dictionary: s.dict, maxDim: 4000 })) {
      found.push(m.id);
      const c = m.corners;
      const side = [0, 1, 2, 3].reduce((a, i) => a + Math.hypot(c[i].x - c[(i + 1) % 4].x, c[i].y - c[(i + 1) % 4].y), 0) / 4;
      sides.push((side / DPI) * 25.4);
      // quiet zone: a ring just outside the detection square (0.5 cell out) must be white
      if (!s.dict.startsWith('tag')) {
        const cx = (c[0].x + c[2].x) / 2;
        const cy = (c[0].y + c[2].y) / 2;
        let dark = 0;
        let n = 0;
        for (let k = 0; k < 4; k++) {
          for (let t = 0.1; t < 0.95; t += 0.1) {
            const a = c[k];
            const b = c[(k + 1) % 4];
            const x = a.x + (b.x - a.x) * t;
            const y = a.y + (b.y - a.y) * t;
            const dx = x - cx;
            const dy = y - cy;
            const len = Math.hypot(dx, dy);
            const px = Math.round(x + (dx / len) * side * 0.06);
            const py = Math.round(y + (dy / len) * side * 0.06);
            n++;
            if (p.data[(py * p.width + px) * 4] < 128) dark++;
          }
        }
        if (dark > 0) quietOk = false;
      }
    }
  }
  const ok =
    pngs.length === s.pages &&
    JSON.stringify(pageMm) === JSON.stringify(s.pageMm.map(Math.round)) &&
    JSON.stringify([...found].sort((a, b) => a - b)) === JSON.stringify([...s.ids].sort((a, b) => a - b)) &&
    sides.every((v) => Math.abs(v - s.markerMm) < 0.6) &&
    quietOk;
  if (!ok) fail++;
  console.log(
    `${s.file}: pages=${pngs.length}/${s.pages} paper=${pageMm} found=${found.length}/${s.ids.length} ` +
      `size=${Math.min(...sides).toFixed(2)}-${Math.max(...sides).toFixed(2)}mm (expect ${s.markerMm}) quiet=${quietOk ? 'white' : 'NG'} ${ok ? 'OK' : 'FAIL'}`
  );
}
console.log(fail ? 'PDF CHECK FAILED' : 'PDF CHECK PASSED');
process.exit(fail ? 1 : 0);
