// Compares js/aruco.js against OpenCV reference data (tests/out, made by make_cv_fixtures.py).
// Run: node tests/check.mjs   (needs the "pngjs" package resolvable via NODE_PATH)
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { buildMarkerMatrix, detectMarkers, getDictionary, loadDictionary } from '../js/aruco.js';

const require = createRequire(import.meta.url);
const { PNG } = require('pngjs');
const OUT = path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1')), 'out');

let fail = 0;
// 1) bit patterns
const bits = JSON.parse(fs.readFileSync(path.join(OUT, 'bits.json'), 'utf8'));
let checked = 0;
for (const [name, ids] of Object.entries(bits)) {
  const n = getDictionary(name).markerSize;
  for (const [id, expected] of Object.entries(ids)) {
    const m = buildMarkerMatrix(name, Number(id), 1, 0);
    let s = '';
    for (let r = 1; r <= n; r++) for (let c = 1; c <= n; c++) s += m.cells[r * m.total + c];
    checked++;
    if (s !== expected) {
      fail++;
      console.log('BIT MISMATCH', name, id);
    }
  }
}
console.log(`bits: ${checked} markers checked`);

// 1b) AprilTag 3: compare with the official images (tests/out/at3, transparent = unused cell)
await loadDictionary('AUTO');
const AT3 = { tag21_07: 'tagCircle21h7', tag49_12: 'tagCircle49h12', tag48_12: 'tagCustom48h12', tag41_12: 'tagStandard41h12', tag52_13: 'tagStandard52h13' };
const at3Dir = path.join(OUT, 'at3');
let at3Checked = 0;
for (const f of fs.existsSync(at3Dir) ? fs.readdirSync(at3Dir) : []) {
  const m = /^(tag\d+_\d+)_(\d+)\.png$/.exec(f);
  if (!m) continue;
  const png = PNG.sync.read(fs.readFileSync(path.join(at3Dir, f)));
  const mat = buildMarkerMatrix(AT3[m[1]], Number(m[2]), 1, 0);
  let bad = 0;
  for (let i = 0; i < png.width * png.height; i++) {
    const transparent = png.data[i * 4 + 3] < 128;
    if (transparent !== !!mat.unused[i]) bad++;
    else if (!transparent && (png.data[i * 4] > 127 ? 1 : 0) !== mat.cells[i]) bad++;
  }
  at3Checked++;
  if (bad || png.width !== mat.total) {
    fail++;
    console.log('AT3 IMAGE MISMATCH', f, bad);
  }
}
console.log(`apriltag3 images: ${at3Checked} compared with official PNGs`);

// 1c) markers without quiet zone: image is entirely the marker / marker touches the image edge
{
  const { DICTIONARIES } = await import('../js/aruco.js');
  const render = (mat, cell, W, H, ox, oy, invert = false) => {
    const data = new Uint8ClampedArray(W * H * 4).fill(255);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const c = Math.floor((x - ox) / cell);
        const r = Math.floor((y - oy) / cell);
        let v = 255;
        if (r >= 0 && c >= 0 && r < mat.total && c < mat.total) v = mat.cells[r * mat.total + c] ? 255 : 0;
        if (invert) v = 255 - v;
        const i = (y * W + x) * 4;
        data[i] = data[i + 1] = data[i + 2] = v;
      }
    }
    return { data, width: W, height: H };
  };
  let edgeChecked = 0;
  const ids = (count) => [0, 1, Math.floor(count / 2), count - 1];
  for (const d of DICTIONARIES) {
    for (const id of ids(d.count)) {
      const mat = buildMarkerMatrix(d.name, id, 1, 0);
      const cases = [
        ['full', render(mat, 25, mat.total * 25, mat.total * 25, 0, 0)],
        ['full-small', render(mat, 4, mat.total * 4, mat.total * 4, 0, 0)],
        ['top-left', render(mat, 20, 400, 300, 0, 0)],
        ['bottom-right', render(mat, 20, 400, 300, 400 - mat.total * 20, 300 - mat.total * 20)],
      ];
      for (const [label, img] of cases) {
        edgeChecked++;
        const found = detectMarkers(img, { dictionary: d.name });
        if (!found.some((f) => f.id === id)) {
          fail++;
          console.log(`NO-MARGIN MISSING ${d.name} #${id} (${label})`, found.map((f) => f.id));
        }
        if (label === 'full') {
          // AUTO: the right family must win, with no extra (wrong grid size / inner blob) detections
          edgeChecked++;
          const fam = getDictionary(d.name).family;
          const auto = detectMarkers(img, { dictionary: 'AUTO' });
          if (auto.length !== 1 || auto[0].family !== fam || auto[0].id !== id) {
            fail++;
            console.log(`NO-MARGIN AUTO WRONG ${d.name} #${id}`, auto.map((f) => `${f.family}#${f.id}`));
          }
        }
      }
      // inverted marker filling the image
      if (d.kind !== 'at3') {
        edgeChecked++;
        const inv = render(mat, 25, mat.total * 25, mat.total * 25, 0, 0, true);
        if (!detectMarkers(inv, { dictionary: d.name, detectInverted: true }).some((f) => f.id === id)) {
          fail++;
          console.log(`NO-MARGIN INVERTED MISSING ${d.name} #${id}`);
        }
      }
    }
  }
  // the reported image (DICT_APRILTAG_36h11 #0 without margin)
  const userImg = path.join(OUT, 'user_nomargin.png');
  if (fs.existsSync(userImg)) {
    const p = PNG.sync.read(fs.readFileSync(userImg));
    const r = detectMarkers({ data: p.data, width: p.width, height: p.height }, { dictionary: 'AUTO' });
    edgeChecked++;
    if (!r.some((f) => f.family === 'APRILTAG_36h11' && f.id === 0)) {
      fail++;
      console.log('USER IMAGE MISSING', r);
    }
  }
  console.log(`no-margin cases: ${edgeChecked} checked`);
}

// 2) detection
const scenes = JSON.parse(fs.readFileSync(path.join(OUT, 'scenes.json'), 'utf8'));
for (const sc of scenes) {
  const png = PNG.sync.read(fs.readFileSync(path.join(OUT, sc.file)));
  const img = { data: png.data, width: png.width, height: png.height };
  for (const mode of ['AUTO', 'SPECIFIC']) {
    const t0 = Date.now();
    let found = [];
    if (mode === 'AUTO') found = detectMarkers(img, { dictionary: 'AUTO' });
    else for (const t of sc.truth) found.push(...detectMarkers(img, { dictionary: t.dict }).map((f) => ({ ...f, _dict: t.dict })));
    const ms = Date.now() - t0;
    for (const t of sc.truth) {
      const fam = getDictionary(t.dict).family;
      const hit = found.find((f) => f.family === fam && f.id === t.id && (mode === 'AUTO' || f._dict === t.dict));
      if (!hit) {
        fail++;
        console.log(`${sc.file} ${mode}: MISSING ${t.dict} #${t.id}`);
        continue;
      }
      const err = Math.max(...t.corners.map(([x, y], i) => Math.hypot(hit.corners[i].x - x, hit.corners[i].y - y)));
      const ok = err < 4;
      if (!ok) fail++;
      console.log(`${sc.file} ${mode}: ${t.dict} #${t.id} cornerErr=${err.toFixed(2)}px ${ok ? 'OK' : 'BAD CORNERS'}`);
    }
    const extra = found.filter((f) => !sc.truth.some((t) => getDictionary(t.dict).family === f.family && t.id === f.id));
    if (extra.length) {
      fail++;
      console.log(`${sc.file} ${mode}: FALSE POSITIVES`, extra.map((e) => `${e.family}#${e.id}`));
    }
    console.log(`${sc.file} ${mode}: ${ms}ms (opencv found ${JSON.stringify(sc.opencv)})`);
  }
}
console.log(fail ? `FAILED (${fail})` : 'ALL PASSED');
process.exit(fail ? 1 : 0);
