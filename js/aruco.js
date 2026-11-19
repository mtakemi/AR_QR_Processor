// ArUco / AprilTag marker generation and detection (pure JS, no DOM dependency).
// Dictionary bit data comes from OpenCV 4.10.0 (see js/aruco-dicts.js).
import { DICT_SOURCES } from './aruco-dicts.js';
import { t } from './i18n.js';

// ---------------------------------------------------------------------------
// Dictionary definitions (same names / parameters as OpenCV's predefined dictionaries)
// maxCorrectionBits: value OpenCV uses for that dictionary.
// ---------------------------------------------------------------------------
export const DICTIONARIES = [
  { name: 'DICT_4X4_50', family: '4X4', count: 50, maxCorrectionBits: 1 },
  { name: 'DICT_4X4_100', family: '4X4', count: 100, maxCorrectionBits: 1 },
  { name: 'DICT_4X4_250', family: '4X4', count: 250, maxCorrectionBits: 1 },
  { name: 'DICT_4X4_1000', family: '4X4', count: 1000, maxCorrectionBits: 0 },
  { name: 'DICT_5X5_50', family: '5X5', count: 50, maxCorrectionBits: 3 },
  { name: 'DICT_5X5_100', family: '5X5', count: 100, maxCorrectionBits: 3 },
  { name: 'DICT_5X5_250', family: '5X5', count: 250, maxCorrectionBits: 2 },
  { name: 'DICT_5X5_1000', family: '5X5', count: 1000, maxCorrectionBits: 2 },
  { name: 'DICT_6X6_50', family: '6X6', count: 50, maxCorrectionBits: 6 },
  { name: 'DICT_6X6_100', family: '6X6', count: 100, maxCorrectionBits: 5 },
  { name: 'DICT_6X6_250', family: '6X6', count: 250, maxCorrectionBits: 5 },
  { name: 'DICT_6X6_1000', family: '6X6', count: 1000, maxCorrectionBits: 4 },
  { name: 'DICT_7X7_50', family: '7X7', count: 50, maxCorrectionBits: 9 },
  { name: 'DICT_7X7_100', family: '7X7', count: 100, maxCorrectionBits: 8 },
  { name: 'DICT_7X7_250', family: '7X7', count: 250, maxCorrectionBits: 8 },
  { name: 'DICT_7X7_1000', family: '7X7', count: 1000, maxCorrectionBits: 6 },
  { name: 'DICT_ARUCO_ORIGINAL', family: 'ARUCO', count: 1024, maxCorrectionBits: 0 },
  { name: 'DICT_ARUCO_MIP_36h12', family: 'ARUCO_MIP_36h12', count: 250, maxCorrectionBits: 12 },
  { name: 'DICT_APRILTAG_16h5', family: 'APRILTAG_16h5', count: 30, maxCorrectionBits: 0 },
  { name: 'DICT_APRILTAG_25h9', family: 'APRILTAG_25h9', count: 35, maxCorrectionBits: 0 },
  { name: 'DICT_APRILTAG_36h10', family: 'APRILTAG_36h10', count: 2320, maxCorrectionBits: 0 },
  { name: 'DICT_APRILTAG_36h11', family: 'APRILTAG_36h11', count: 587, maxCorrectionBits: 0 },
  // AprilTag 3 families (layout-based, reversed border). maxCorrectionBits = AprilTag's default (2).
  { name: 'tagStandard41h12', family: 'tagStandard41h12', count: 2115, maxCorrectionBits: 2, kind: 'at3' },
  { name: 'tagStandard52h13', family: 'tagStandard52h13', count: 48714, maxCorrectionBits: 2, kind: 'at3' },
  { name: 'tagCircle21h7', family: 'tagCircle21h7', count: 38, maxCorrectionBits: 2, kind: 'at3' },
  { name: 'tagCircle49h12', family: 'tagCircle49h12', count: 65535, maxCorrectionBits: 2, kind: 'at3' },
  { name: 'tagCustom48h12', family: 'tagCustom48h12', count: 42211, maxCorrectionBits: 2, kind: 'at3' },
];

export function isAprilTag3(name) {
  return DICTIONARIES.some((d) => d.name === name && d.kind === 'at3');
}

export function getDictionary(name) {
  const d = DICTIONARIES.find((x) => x.name === name);
  if (!d) throw new Error('Unknown dictionary: ' + name);
  if (d.kind === 'at3') return { ...d, markerSize: null };
  return { ...d, kind: 'opencv', markerSize: DICT_SOURCES[d.family].markerSize };
}

/**
 * Loads the data of AprilTag 3 families (lazy, they are large). OpenCV dictionaries are always available.
 * @param {string} name dictionary name, or 'AUTO' to load everything
 */
export async function loadDictionary(name) {
  const names = name === 'AUTO' ? DICTIONARIES.filter((d) => d.kind === 'at3').map((d) => d.name) : [name];
  await Promise.all(
    names.filter(isAprilTag3).map(async (n) => {
      if (familyCache.has(n)) return;
      const mod = await import(`./dicts/${n}.js`);
      familyCache.set(n, buildAT3Family(mod.default, mod.CODES_BASE64));
    })
  );
  if (name === 'AUTO') return null;
  const d = getDictionary(name);
  if (d.kind !== 'at3') return d;
  const f = familyCache.get(name);
  return { ...d, totalWidth: f.layout.T, widthAtBorder: f.layout.W, nbits: f.meta.nbits, h: f.meta.h };
}

// OpenCV uses errorCorrectionRate = 0.6 by default
const ERROR_CORRECTION_RATE = 0.6;

// ---------------------------------------------------------------------------
// Family data (lazy parsed)
// ---------------------------------------------------------------------------
const familyCache = new Map();

function hexToBits(hex, nbits) {
  let bin = '';
  for (const ch of hex) bin += parseInt(ch, 16).toString(2).padStart(4, '0');
  bin = bin.slice(bin.length - nbits);
  const bits = new Uint8Array(nbits);
  for (let i = 0; i < nbits; i++) bits[i] = bin.charCodeAt(i) === 49 ? 1 : 0;
  return bits;
}

function bitsToHiLo(bits) {
  let hi = 0;
  let lo = 0;
  for (let i = 0; i < bits.length; i++) {
    hi = hi * 2 + (lo >>> 31);
    lo = ((lo << 1) | bits[i]) >>> 0;
  }
  return [hi, lo];
}

function base64ToBytes(b64) {
  if (typeof atob === 'function') {
    const s = atob(b64);
    const out = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
    return out;
  }
  return Uint8Array.from(globalThis.Buffer.from(b64, 'base64'));
}

// cell types of an AprilTag 3 layout
const CELL_UNUSED = -1;
const CELL_BLACK = 0; // black ring
const CELL_WHITE = 1; // white ring
const CELL_BIT = 2;

function buildAT3Family(meta, b64) {
  const bytes = base64ToBytes(b64);
  const bpc = meta.bytesPerCode;
  const n = meta.count;
  const hi = new Uint32Array(n);
  const lo = new Uint32Array(n);
  const map = new Map();
  for (let i = 0; i < n; i++) {
    let h = 0;
    let l = 0;
    for (let b = 0; b < bpc; b++) {
      h = h * 256 + (l >>> 24);
      l = ((l << 8) | bytes[i * bpc + b]) >>> 0;
    }
    hi[i] = h;
    lo[i] = l;
    const key = h + ':' + l;
    if (!map.has(key)) map.set(key, i);
  }
  // layout (cells in absolute coordinates 0..T-1)
  const T = meta.totalWidth;
  const W = meta.widthAtBorder;
  const bs = (T - W) / 2;
  const type = new Int8Array(T * T).fill(CELL_UNUSED);
  if (meta.reversedBorder) {
    for (let r = 0; r < T; r++) {
      for (let c = 0; c < T; c++) {
        const rr = r - bs;
        const cc = c - bs;
        const inW = rr >= 0 && rr < W && cc >= 0 && cc < W;
        const onW = inW && (rr === 0 || cc === 0 || rr === W - 1 || cc === W - 1);
        const inB = rr >= -1 && rr <= W && cc >= -1 && cc <= W;
        const onB = inB && !inW;
        if (onW) type[r * T + c] = CELL_WHITE;
        else if (onB) type[r * T + c] = CELL_BLACK;
      }
    }
  } else {
    // classic layout: white outer ring, black border of width_at_border
    for (let r = 0; r < T; r++) {
      for (let c = 0; c < T; c++) {
        const rr = r - bs;
        const cc = c - bs;
        const inB = rr >= 0 && rr < W && cc >= 0 && cc < W;
        const onB = inB && (rr === 0 || cc === 0 || rr === W - 1 || cc === W - 1);
        const onWh = !inB && rr >= -1 && rr <= W && cc >= -1 && cc <= W;
        if (onB) type[r * T + c] = CELL_BLACK;
        else if (onWh) type[r * T + c] = CELL_WHITE;
      }
    }
  }
  const bitAbs = new Int32Array(meta.nbits);
  for (let i = 0; i < meta.nbits; i++) {
    const idx = (meta.bitY[i] + bs) * T + (meta.bitX[i] + bs);
    bitAbs[i] = idx;
    type[idx] = CELL_BIT;
  }
  return { kind: 'at3', family: meta.name, meta, count: n, hi, lo, map, layout: { T, W, bs, type, bitAbs, reversed: meta.reversedBorder } };
}

function at3CodeBit(f, id, i) {
  const p = f.meta.nbits - 1 - i;
  return p < 32 ? (f.lo[id] >>> p) & 1 : (f.hi[id] >>> (p - 32)) & 1;
}

function getAT3Family(family) {
  const f = familyCache.get(family);
  if (!f) throw new Error(t("mk.errNotLoaded", { family }));
  return f;
}

function getFamily(family) {
  let f = familyCache.get(family);
  if (f) return f;
  const src = DICT_SOURCES[family];
  const n = src.markerSize;
  const hexes = src.codes.split(' ');
  const hi = new Uint32Array(hexes.length);
  const lo = new Uint32Array(hexes.length);
  const map = new Map();
  const bitsList = [];
  hexes.forEach((h, id) => {
    const bits = hexToBits(h, n * n);
    bitsList.push(bits);
    const [a, b] = bitsToHiLo(bits);
    hi[id] = a;
    lo[id] = b;
    const key = a + ':' + b;
    if (!map.has(key)) map.set(key, id);
  });
  f = { family, markerSize: n, count: hexes.length, hi, lo, map, bitsList };
  familyCache.set(family, f);
  return f;
}

/** Returns the marker bit matrix (Uint8Array n*n, row-major, 1 = white). */
export function getMarkerBits(dictName, id) {
  const d = getDictionary(dictName);
  if (!Number.isInteger(id) || id < 0 || id >= d.count) {
    throw new Error(t("mk.errId", { max: d.count - 1 }));
  }
  return { bits: getFamily(d.family).bitsList[id], markerSize: d.markerSize };
}

// ---------------------------------------------------------------------------
// Generation
// ---------------------------------------------------------------------------
/**
 * Builds a cell matrix (1 = white) including black border and white quiet zone.
 * @returns {{cells: Uint8Array, total: number}}
 */
export function buildMarkerMatrix(dictName, id, borderBits = 1, quietZone = 1) {
  if (isAprilTag3(dictName)) return buildAT3Matrix(dictName, id, quietZone);
  const { bits, markerSize: n } = getMarkerBits(dictName, id);
  const total = n + 2 * borderBits + 2 * quietZone;
  const cells = new Uint8Array(total * total).fill(1);
  const off = quietZone;
  const inner = n + 2 * borderBits;
  for (let r = 0; r < inner; r++) {
    for (let c = 0; c < inner; c++) {
      const br = r - borderBits;
      const bc = c - borderBits;
      let v = 0; // border = black
      if (br >= 0 && br < n && bc >= 0 && bc < n) v = bits[br * n + bc];
      cells[(r + off) * total + (c + off)] = v;
    }
  }
  // detectSide: side length (in cells) between the detected corners
  return { cells, total, markerSize: n, detectSide: inner, offset: off, unused: null };
}

/**
 * AprilTag 3 layout matrix. Unused cells (e.g. corners of tagCircle) are rendered white and
 * flagged in `unused` (1 = unused) so that renderers may make them transparent.
 */
function buildAT3Matrix(dictName, id, quietZone) {
  const f = getAT3Family(dictName);
  if (!Number.isInteger(id) || id < 0 || id >= f.count) {
    throw new Error(t("mk.errId", { max: f.count - 1 }));
  }
  const { T, W, type, bitAbs } = f.layout;
  const total = T + 2 * quietZone;
  const cells = new Uint8Array(total * total).fill(1);
  const unused = new Uint8Array(total * total);
  const abs = new Int8Array(T * T);
  for (let i = 0; i < T * T; i++) abs[i] = type[i] === CELL_BLACK ? 0 : 1;
  for (let i = 0; i < bitAbs.length; i++) abs[bitAbs[i]] = at3CodeBit(f, id, i);
  for (let r = 0; r < T; r++) {
    for (let c = 0; c < T; c++) {
      const k = (r + quietZone) * total + (c + quietZone);
      cells[k] = abs[r * T + c];
      if (type[r * T + c] === CELL_UNUSED) unused[k] = 1;
    }
  }
  return { cells, total, markerSize: null, detectSide: W, offset: quietZone, unused };
}

export function markerToSVG(matrix, { sizeMm = null, sizePx = 400, label = '' } = {}) {
  const { cells, total } = matrix;
  const labelH = label ? Math.max(1, total * 0.12) : 0;
  const w = total;
  const h = total + labelH;
  let rects = '';
  for (let r = 0; r < total; r++) {
    // merge horizontal runs of black cells
    let c = 0;
    while (c < total) {
      if (cells[r * total + c] === 0) {
        let e = c;
        while (e < total && cells[r * total + e] === 0) e++;
        rects += `<rect x="${c}" y="${r}" width="${e - c}" height="1"/>`;
        c = e;
      } else c++;
    }
  }
  const unitW = sizeMm ? `${sizeMm}mm` : `${sizePx}`;
  const unitH = sizeMm ? `${(sizeMm * h) / w}mm` : `${(sizePx * h) / w}`;
  const text = label
    ? `<text x="${w / 2}" y="${total + labelH * 0.78}" font-family="sans-serif" font-size="${labelH * 0.8}" text-anchor="middle" fill="#000">${escapeXml(label)}</text>`
    : '';
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${unitW}" height="${unitH}" viewBox="0 0 ${w} ${h}" shape-rendering="crispEdges">` +
    `<rect width="${w}" height="${h}" fill="#fff"/><g fill="#000">${rects}</g>${text}</svg>`
  );
}

function escapeXml(s) {
  return String(s).replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[c]);
}

// ---------------------------------------------------------------------------
// Detection
// ---------------------------------------------------------------------------
const DX = [1, 1, 0, -1, -1, -1, 0, 1]; // E, SE, S, SW, W, NW, N, NE (clockwise, y down)
const DY = [0, 1, 1, 1, 0, -1, -1, -1];

function popcount32(v) {
  v = v - ((v >>> 1) & 0x55555555);
  v = (v & 0x33333333) + ((v >>> 2) & 0x33333333);
  return (((v + (v >>> 4)) & 0x0f0f0f0f) * 0x01010101) >>> 24;
}

function toGray(imageData, maxDim) {
  const { width: sw, height: sh, data } = imageData;
  const scale = Math.min(1, maxDim / Math.max(sw, sh));
  const w = Math.max(1, Math.round(sw * scale));
  const h = Math.max(1, Math.round(sh * scale));
  const gray = new Uint8Array(w * h);
  if (scale === 1) {
    for (let i = 0, j = 0; i < gray.length; i++, j += 4) {
      gray[i] = (data[j] * 77 + data[j + 1] * 150 + data[j + 2] * 29) >> 8;
    }
  } else {
    // box downsampling
    const inv = 1 / scale;
    for (let y = 0; y < h; y++) {
      const y0 = Math.floor(y * inv);
      const y1 = Math.min(sh, Math.max(y0 + 1, Math.floor((y + 1) * inv)));
      for (let x = 0; x < w; x++) {
        const x0 = Math.floor(x * inv);
        const x1 = Math.min(sw, Math.max(x0 + 1, Math.floor((x + 1) * inv)));
        let sum = 0;
        let cnt = 0;
        for (let yy = y0; yy < y1; yy++) {
          let j = (yy * sw + x0) * 4;
          for (let xx = x0; xx < x1; xx++, j += 4) {
            sum += (data[j] * 77 + data[j + 1] * 150 + data[j + 2] * 29) >> 8;
            cnt++;
          }
        }
        gray[y * w + x] = sum / cnt;
      }
    }
  }
  return { gray, w, h, scale };
}

function integralImage(gray, w, h) {
  const ii = new Float64Array((w + 1) * (h + 1));
  for (let y = 0; y < h; y++) {
    let row = 0;
    for (let x = 0; x < w; x++) {
      row += gray[y * w + x];
      ii[(y + 1) * (w + 1) + x + 1] = ii[y * (w + 1) + x + 1] + row;
    }
  }
  return ii;
}

function adaptiveThreshold(gray, w, h, ii, win, C) {
  const mask = new Uint8Array(w * h);
  const r = win >> 1;
  const W = w + 1;
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - r);
    const y1 = Math.min(h, y + r + 1);
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - r);
      const x1 = Math.min(w, x + r + 1);
      const sum = ii[y1 * W + x1] - ii[y0 * W + x1] - ii[y1 * W + x0] + ii[y0 * W + x0];
      const mean = sum / ((x1 - x0) * (y1 - y0));
      mask[y * w + x] = gray[y * w + x] < mean - C ? 1 : 0;
    }
  }
  return mask;
}

function otsuLevel(values) {
  const hist = new Float64Array(256);
  for (let i = 0; i < values.length; i++) hist[values[i] | 0]++;
  const total = values.length;
  let sum = 0;
  for (let i = 0; i < 256; i++) sum += i * hist[i];
  let sumB = 0;
  let wB = 0;
  let best = 0;
  let level = 127;
  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (!wB) continue;
    const wF = total - wB;
    if (!wF) break;
    sumB += t * hist[t];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const between = wB * wF * (mB - mF) * (mB - mF);
    if (between > best) {
      best = between;
      level = t;
    }
  }
  return level;
}

function globalThreshold(gray) {
  const level = otsuLevel(gray);
  const mask = new Uint8Array(gray.length);
  for (let i = 0; i < gray.length; i++) mask[i] = gray[i] <= level ? 1 : 0;
  return mask;
}

/** Connected components (8-connectivity) of mask==1; returns candidate seeds. */
function findComponents(mask, w, h, minSide, maxSide) {
  const labels = new Int32Array(w * h);
  const stack = new Int32Array(w * h);
  const comps = [];
  let next = 0;
  for (let i = 0; i < mask.length; i++) {
    if (!mask[i] || labels[i]) continue;
    next++;
    let sp = 0;
    stack[sp++] = i;
    labels[i] = next;
    let minX = w, minY = h, maxX = 0, maxY = 0, count = 0;
    while (sp) {
      const p = stack[--sp];
      const px = p % w;
      const py = (p - px) / w;
      count++;
      if (px < minX) minX = px;
      if (px > maxX) maxX = px;
      if (py < minY) minY = py;
      if (py > maxY) maxY = py;
      for (let d = 0; d < 8; d++) {
        const nx = px + DX[d];
        const ny = py + DY[d];
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const q = ny * w + nx;
        if (mask[q] && !labels[q]) {
          labels[q] = next;
          stack[sp++] = q;
        }
      }
    }
    const bw = maxX - minX + 1;
    const bh = maxY - minY + 1;
    if (bw >= minSide && bh >= minSide && bw <= maxSide && bh <= maxSide && count >= minSide * 2) {
      comps.push({ label: next, seed: i, minX, minY, maxX, maxY });
    }
  }
  return { labels, comps };
}

/** Moore-neighbour outer contour tracing. Returns flat array [x0,y0,x1,y1,...]. */
function traceContour(labels, w, h, seed, L, maxLen) {
  const sx = seed % w;
  const sy = (seed - sx) / w;
  const pts = [];
  let x = sx;
  let y = sy;
  let d = 0;
  let firstDir = -1;
  for (let iter = 0; iter < maxLen; iter++) {
    const start = d % 2 === 0 ? (d + 6) % 8 : (d + 7) % 8;
    let nd = -1;
    for (let k = 0; k < 8; k++) {
      const dd = (start + k) % 8;
      const nx = x + DX[dd];
      const ny = y + DY[dd];
      if (nx >= 0 && ny >= 0 && nx < w && ny < h && labels[ny * w + nx] === L) {
        nd = dd;
        break;
      }
    }
    if (nd < 0) break; // isolated pixel
    if (x === sx && y === sy) {
      if (firstDir < 0) firstDir = nd;
      else if (nd === firstDir) break; // Jacob's stopping criterion
    }
    pts.push(x, y);
    x += DX[nd];
    y += DY[nd];
    d = nd;
  }
  return pts;
}

function perpDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const len = Math.hypot(dx, dy);
  if (len === 0) return Math.hypot(px - ax, py - ay);
  return Math.abs(dx * (ay - py) - dy * (ax - px)) / len;
}

// Douglas-Peucker on an index range of a closed contour; returns indices of kept points
function dp(pts, n, i0, i1, eps, out) {
  // indices modulo n, i1 may exceed n
  let maxD = -1;
  let maxI = -1;
  const ax = pts[2 * (i0 % n)], ay = pts[2 * (i0 % n) + 1];
  const bx = pts[2 * (i1 % n)], by = pts[2 * (i1 % n) + 1];
  for (let i = i0 + 1; i < i1; i++) {
    const k = i % n;
    const dd = perpDist(pts[2 * k], pts[2 * k + 1], ax, ay, bx, by);
    if (dd > maxD) {
      maxD = dd;
      maxI = i;
    }
  }
  if (maxD > eps) {
    dp(pts, n, i0, maxI, eps, out);
    out.push(maxI % n);
    dp(pts, n, maxI, i1, eps, out);
  }
}

function approxPolygon(pts, eps) {
  const n = pts.length / 2;
  // start at point 0, split at the farthest point
  let far = 0;
  let farD = -1;
  for (let i = 1; i < n; i++) {
    const dd = Math.hypot(pts[2 * i] - pts[0], pts[2 * i + 1] - pts[1]);
    if (dd > farD) {
      farD = dd;
      far = i;
    }
  }
  const out = [0];
  dp(pts, n, 0, far, eps, out);
  out.push(far);
  dp(pts, n, far, n, eps, out);
  return out;
}

function fitLine(pts, n, a, b) {
  // indices a..b (b may wrap, b > a), returns {px,py,dx,dy} or null
  let sx = 0, sy = 0, cnt = 0;
  for (let i = a; i <= b; i++) {
    const k = i % n;
    sx += pts[2 * k];
    sy += pts[2 * k + 1];
    cnt++;
  }
  if (cnt < 3) return null;
  const mx = sx / cnt;
  const my = sy / cnt;
  let xx = 0, xy = 0, yy = 0;
  for (let i = a; i <= b; i++) {
    const k = i % n;
    const dx = pts[2 * k] - mx;
    const dy = pts[2 * k + 1] - my;
    xx += dx * dx;
    xy += dx * dy;
    yy += dy * dy;
  }
  const theta = 0.5 * Math.atan2(2 * xy, xx - yy);
  return { px: mx, py: my, dx: Math.cos(theta), dy: Math.sin(theta) };
}

function intersect(l1, l2) {
  const den = l1.dx * l2.dy - l1.dy * l2.dx;
  if (Math.abs(den) < 1e-6) return null;
  const t = ((l2.px - l1.px) * l2.dy - (l2.py - l1.py) * l2.dx) / den;
  return { x: l1.px + t * l1.dx, y: l1.py + t * l1.dy };
}

function quadFromContour(pts, w, h, minSide) {
  const n = pts.length / 2;
  if (n < minSide * 2) return null;
  let idx = null;
  for (const rate of [0.03, 0.05, 0.08]) {
    const res = approxPolygon(pts, Math.max(1.5, n * rate));
    if (res.length === 4) {
      idx = res;
      break;
    }
    if (res.length < 4) break;
  }
  if (!idx) return null;
  idx.sort((a, b) => a - b);
  let corners = idx.map((i) => ({ x: pts[2 * i], y: pts[2 * i + 1] }));

  // convexity
  let sign = 0;
  for (let i = 0; i < 4; i++) {
    const a = corners[i], b = corners[(i + 1) % 4], c = corners[(i + 2) % 4];
    const cr = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
    if (cr === 0) return null;
    const s = Math.sign(cr);
    if (sign && s !== sign) return null;
    sign = s;
  }
  // side length check
  for (let i = 0; i < 4; i++) {
    const a = corners[i], b = corners[(i + 1) % 4];
    if (Math.hypot(a.x - b.x, a.y - b.y) < minSide) return null;
  }

  // refine corners by fitting lines to each side
  const lines = [];
  for (let i = 0; i < 4; i++) {
    const a = idx[i];
    let b = idx[(i + 1) % 4];
    if (b <= a) b += n;
    const len = b - a;
    const trim = Math.floor(len * 0.15);
    lines.push(fitLine(pts, n, a + trim, b - trim));
  }
  if (lines.every(Boolean)) {
    const refined = [];
    for (let i = 0; i < 4; i++) {
      const p = intersect(lines[(i + 3) % 4], lines[i]);
      if (!p) break;
      const o = corners[i];
      if (Math.hypot(p.x - o.x, p.y - o.y) > Math.max(3, minSide * 0.5)) break;
      refined.push(p);
    }
    if (refined.length === 4) corners = refined;
  }

  // contour pixels are pixel centres on the dark side; shift to pixel-edge coordinates
  corners = corners.map((p) => ({ x: p.x + 0.5, y: p.y + 0.5 }));

  // order clockwise (y down): positive shoelace area
  let area = 0;
  for (let i = 0; i < 4; i++) {
    const a = corners[i], b = corners[(i + 1) % 4];
    area += a.x * b.y - b.x * a.y;
  }
  if (area < 0) corners.reverse();

  // reject quads touching the image border
  for (const p of corners) {
    if (p.x < 2 || p.y < 2 || p.x > w - 2 || p.y > h - 2) return null;
  }
  return corners;
}

/** Homography mapping the unit square (0,0),(1,0),(1,1),(0,1) to quad corners. */
function squareToQuad(q) {
  const [p0, p1, p2, p3] = q;
  const dx3 = p0.x - p1.x + p2.x - p3.x;
  const dy3 = p0.y - p1.y + p2.y - p3.y;
  let a, b, c, d, e, f, g, hh;
  if (Math.abs(dx3) < 1e-9 && Math.abs(dy3) < 1e-9) {
    a = p1.x - p0.x; b = p3.x - p0.x; c = p0.x;
    d = p1.y - p0.y; e = p3.y - p0.y; f = p0.y;
    g = 0; hh = 0;
  } else {
    const dx1 = p1.x - p2.x, dx2 = p3.x - p2.x;
    const dy1 = p1.y - p2.y, dy2 = p3.y - p2.y;
    const den = dx1 * dy2 - dx2 * dy1;
    g = (dx3 * dy2 - dx2 * dy3) / den;
    hh = (dx1 * dy3 - dx3 * dy1) / den;
    a = p1.x - p0.x + g * p1.x; b = p3.x - p0.x + hh * p3.x; c = p0.x;
    d = p1.y - p0.y + g * p1.y; e = p3.y - p0.y + hh * p3.y; f = p0.y;
  }
  return (u, v) => {
    const wv = g * u + hh * v + 1;
    return [(a * u + b * v + c) / wv, (d * u + e * v + f) / wv];
  };
}

function bilinear(gray, w, h, x, y) {
  x -= 0.5;
  y -= 0.5;
  const x0 = Math.max(0, Math.min(w - 1, Math.floor(x)));
  const y0 = Math.max(0, Math.min(h - 1, Math.floor(y)));
  const x1 = Math.min(w - 1, x0 + 1);
  const y1 = Math.min(h - 1, y0 + 1);
  const fx = Math.max(0, Math.min(1, x - x0));
  const fy = Math.max(0, Math.min(1, y - y0));
  const a = gray[y0 * w + x0], b = gray[y0 * w + x1];
  const c = gray[y1 * w + x0], d = gray[y1 * w + x1];
  return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy;
}

/**
 * Samples a T x T cell grid; returns cell values (0-255).
 * The quad spans `div` cells starting at cell `off` (cells outside the quad are extrapolated).
 */
function sampleGrid(gray, w, h, H, T, off = 0, div = T) {
  const vals = new Float64Array(T * T);
  const offs = [-0.2, 0, 0.2];
  for (let r = 0; r < T; r++) {
    for (let c = 0; c < T; c++) {
      let s = 0;
      for (const oy of offs) {
        for (const ox of offs) {
          const [x, y] = H((c - off + 0.5 + ox) / div, (r - off + 0.5 + oy) / div);
          s += bilinear(gray, w, h, x, y);
        }
      }
      vals[r * T + c] = s / 9;
    }
  }
  return vals;
}

function binarizeCells(vals) {
  let min = 255, max = 0;
  for (const v of vals) {
    if (v < min) min = v;
    if (v > max) max = v;
  }
  if (max - min < 25) return null;
  let t = (min + max) / 2;
  for (let it = 0; it < 6; it++) {
    let s0 = 0, n0 = 0, s1 = 0, n1 = 0;
    for (const v of vals) {
      if (v < t) { s0 += v; n0++; } else { s1 += v; n1++; }
    }
    if (!n0 || !n1) break;
    t = (s0 / n0 + s1 / n1) / 2;
  }
  const bits = new Uint8Array(vals.length);
  for (let i = 0; i < vals.length; i++) bits[i] = vals[i] >= t ? 1 : 0;
  bits.thr = t;
  return bits;
}

/**
 * Fraction of sample points (centre + 4 points near the cell corners) that agree with their
 * cell's majority colour. Close to 1 when the grid matches the real cell layout; a wrong grid
 * size makes many cells straddle cell boundaries.
 */
function gridPurity(gray, w, h, H, T, off, div, thr) {
  const offs = [[0, 0], [-0.32, -0.32], [0.32, -0.32], [-0.32, 0.32], [0.32, 0.32]];
  let agree = 0;
  for (let r = 0; r < T; r++) {
    for (let c = 0; c < T; c++) {
      let white = 0;
      for (const [ox, oy] of offs) {
        const [x, y] = H((c - off + 0.5 + ox) / div, (r - off + 0.5 + oy) / div);
        if (bilinear(gray, w, h, x, y) >= thr) white++;
      }
      agree += Math.max(white, offs.length - white);
    }
  }
  return agree / (T * T * offs.length);
}

const MIN_PURITY = 0.7;

function rotateBits(bits, n) {
  // same transform as OpenCV's rot1: out(row,col) = in(col, n-1-row)
  const out = new Uint8Array(n * n);
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) out[r * n + c] = bits[c * n + (n - 1 - r)];
  return out;
}

/**
 * Builds the matcher configuration.
 * @param {string} dictName 'AUTO' or a dictionary name
 */
function buildTargets(dictName) {
  const targets = [];
  const add = (d, dictNameOrNull) => {
    const maxCorr = d.kind === 'at3' ? d.maxCorrectionBits : Math.floor(d.maxCorrectionBits * ERROR_CORRECTION_RATE);
    const data = d.kind === 'at3' ? getAT3Family(d.family) : getFamily(d.family);
    targets.push({ family: d.family, count: d.count, maxCorr, dictName: dictNameOrNull, kind: d.kind || 'opencv', data });
  };
  if (dictName === 'AUTO') {
    const fams = new Map();
    for (const d of DICTIONARIES) {
      const cur = fams.get(d.family);
      if (!cur || d.count > cur.count) fams.set(d.family, d);
    }
    for (const d of fams.values()) add(d, d.kind === 'at3' ? d.name : null);
  } else {
    const d = getDictionary(dictName);
    add(d, d.name);
  }
  return targets;
}

/** Looks up the 4 rotations (hl = [[hi,lo] x4]) in a target dictionary, with error correction. */
function searchCodes(t, hl, best) {
  for (let r = 0; r < 4; r++) {
    const id = t.data.map.get(hl[r][0] + ':' + hl[r][1]);
    if (id !== undefined && id < t.count) {
      if (!best || best.distance > 0) best = { target: t, id, rotation: r, distance: 0, ties: [] };
      else best.ties.push({ target: t, id, rotation: r });
    }
  }
  if ((best && best.distance === 0) || t.maxCorr <= 0) return best;
  const { hi, lo } = t.data;
  let bestDist = (best ? Math.min(best.distance - 1, t.maxCorr) : t.maxCorr) + 1;
  for (let id = 0; id < t.count; id++) {
    const a = hi[id];
    const b = lo[id];
    for (let r = 0; r < 4; r++) {
      const dist = popcount32(a ^ hl[r][0]) + popcount32(b ^ hl[r][1]);
      if (dist < bestDist) {
        bestDist = dist;
        best = { target: t, id, rotation: r, distance: dist, ties: [] };
      }
    }
  }
  return best;
}

function matchBits(innerBits, n, targets) {
  const rots = [innerBits];
  for (let i = 1; i < 4; i++) rots.push(rotateBits(rots[i - 1], n));
  const hl = rots.map(bitsToHiLo);
  let best = null;
  for (const t of targets) {
    if (t.data.markerSize !== n) continue;
    best = searchCodes(t, hl, best);
  }
  return best;
}

/** AprilTag 3 decoding; H maps the unit square to the detection border (W cells). */
function matchAT3(gray, w, h, H, t) {
  const { T, W, bs, type, bitAbs } = t.data.layout;
  const vals = sampleGrid(gray, w, h, H, T, bs, W);
  // reference levels from the known white / black rings
  let sw = 0, nw = 0, sb = 0, nb = 0;
  for (let i = 0; i < T * T; i++) {
    if (type[i] === CELL_WHITE) { sw += vals[i]; nw++; }
    else if (type[i] === CELL_BLACK) { sb += vals[i]; nb++; }
  }
  const white = sw / nw;
  const black = sb / nb;
  if (white - black < 25) return null;
  const thr = (white + black) / 2;
  let err = 0;
  for (let i = 0; i < T * T; i++) {
    if (type[i] === CELL_WHITE && vals[i] < thr) err++;
    else if (type[i] === CELL_BLACK && vals[i] >= thr) err++;
  }
  if (err > Math.floor((nw + nb) * 0.1)) return null;
  let grid = new Uint8Array(T * T);
  for (let i = 0; i < T * T; i++) grid[i] = vals[i] >= thr ? 1 : 0;
  const hl = [];
  const bits = new Uint8Array(bitAbs.length);
  for (let r = 0; r < 4; r++) {
    for (let i = 0; i < bitAbs.length; i++) bits[i] = grid[bitAbs[i]];
    hl.push(bitsToHiLo(bits));
    grid = rotateBits(grid, T);
  }
  const m = searchCodes(t, hl, null);
  if (m) m.purity = gridPurity(gray, w, h, H, T, bs, W, thr);
  return m;
}

export function dictNamesContaining(family, id) {
  return DICTIONARIES.filter((d) => d.family === family && id < d.count).map((d) => d.name);
}

/** Finds convex quadrilateral outlines of dark regions in `gray`. */
function findQuads(gray, w, h, windows, minSide, maxSide) {
  const ii = integralImage(gray, w, h);
  const masks = [globalThreshold(gray), ...windows.map((win) => adaptiveThreshold(gray, w, h, ii, win, 7))];
  const quads = [];
  for (const mask of masks) {
    const { labels, comps } = findComponents(mask, w, h, minSide, maxSide);
    for (const comp of comps) {
      const maxLen = 4 * (comp.maxX - comp.minX + comp.maxY - comp.minY + 2) + 16;
      const pts = traceContour(labels, w, h, comp.seed, comp.label, maxLen);
      const quad = quadFromContour(pts, w, h, minSide);
      if (quad) quads.push(quad);
    }
  }
  return quads;
}

/**
 * Detects ArUco / AprilTag markers. For AprilTag 3 families call `await loadDictionary()` first.
 * @param {{data:Uint8ClampedArray,width:number,height:number}} imageData
 * @param {object} opts
 *   dictionary: 'AUTO' | dictionary name
 *   borderBits: number (default 1, OpenCV dictionaries only)
 *   detectInverted: boolean
 *   maxDim: max processing dimension (default 2000)
 * @returns {Array<{family,id,dictNames,corners,distance}>}
 */
export function detectMarkers(imageData, opts = {}) {
  const { dictionary = 'AUTO', borderBits = 1, detectInverted = false, maxDim = 2000 } = opts;
  const targets = buildTargets(dictionary);
  const ocvTargets = targets.filter((t) => t.kind === 'opencv');
  const at3Targets = targets.filter((t) => t.kind === 'at3');
  const sizes = [...new Set(ocvTargets.map((t) => t.data.markerSize))];
  const { gray: gRaw, w: w0, h: h0, scale } = toGray(imageData, maxDim);
  // Add a virtual white margin so that markers touching the image edge (no quiet zone,
  // or an image that is entirely a marker) still get a closed outline.
  const s0 = Math.max(w0, h0);
  const pad = Math.max(10, Math.round(s0 * 0.04));
  const w = w0 + 2 * pad;
  const h = h0 + 2 * pad;
  const padded = (src, invert) => {
    const out = new Uint8Array(w * h).fill(255);
    for (let y = 0; y < h0; y++) {
      const row = (y + pad) * w + pad;
      for (let x = 0; x < w0; x++) {
        const v = src[y * w0 + x];
        out[row + x] = invert ? 255 - v : v;
      }
    }
    return out;
  };
  const results = [];
  const variants = [];
  for (const invert of detectInverted ? [false, true] : [false]) {
    const g = padded(gRaw, invert);
    variants.push([g, g.map((v) => 255 - v)]);
  }

  const s = s0;
  const minSide = Math.max(8, Math.round(s * 0.01));
  const maxSide = Math.max(w, h) - 2;
  const odd = (v) => Math.max(3, Math.round(v) | 1);
  const windows = [...new Set([odd(s / 80), odd(s / 30), odd(s / 12)])];

  const push = (m, quad, vi) => {
    // rotate corners so that corners[0] is the marker's top-left
    if (m.purity < MIN_PURITY) return;
    const k = m.rotation;
    const corners = [0, 1, 2, 3].map((i) => quad[(i + k) % 4]).map((p) => ({ x: (p.x - pad) / scale, y: (p.y - pad) / scale }));
    results.push({
      family: m.target.family,
      id: m.id,
      dictNames: m.target.dictName ? [m.target.dictName] : dictNamesContaining(m.target.family, m.id),
      alternatives: m.ties.map((t) => ({ family: t.target.family, id: t.id })),
      corners,
      distance: m.distance,
      purity: m.purity,
      inverted: vi === 1,
    });
  };

  for (let vi = 0; vi < variants.length; vi++) {
    const [gray, grayInv] = variants[vi];
    // classic markers: black border => quads of dark regions
    if (ocvTargets.length) {
      for (const quad of findQuads(gray, w, h, windows, minSide, maxSide)) {
        const H = squareToQuad(quad);
        for (const n of sizes) {
          const T = n + 2 * borderBits;
          const vals = sampleGrid(gray, w, h, H, T);
          const cellBits = binarizeCells(vals);
          if (!cellBits) continue;
          // border check (must be black = 0)
          let borderCells = 0;
          let borderErr = 0;
          const inner = new Uint8Array(n * n);
          for (let r = 0; r < T; r++) {
            for (let c = 0; c < T; c++) {
              const isBorder = r < borderBits || c < borderBits || r >= T - borderBits || c >= T - borderBits;
              const v = cellBits[r * T + c];
              if (isBorder) {
                borderCells++;
                if (v) borderErr++;
              } else inner[(r - borderBits) * n + (c - borderBits)] = v;
            }
          }
          if (borderErr > Math.floor(borderCells * 0.15)) continue;
          const m = matchBits(inner, n, ocvTargets);
          if (!m) continue;
          m.purity = gridPurity(gray, w, h, H, T, 0, T, cellBits.thr);
          push(m, quad, vi);
        }
      }
    }
    // AprilTag 3 (reversed border): the detection border is a white square => quads of bright regions
    if (at3Targets.length) {
      for (const quad of findQuads(grayInv, w, h, windows, minSide, maxSide)) {
        const H = squareToQuad(quad);
        let best = null;
        for (const t of at3Targets) {
          const m = matchAT3(gray, w, h, H, t);
          if (m && (!best || matchScore(m) > matchScore(best))) best = m;
        }
        if (best) push(best, quad, vi);
      }
    }
  }
  return dedupe(results);
}

function centerOf(c) {
  return { x: (c[0].x + c[1].x + c[2].x + c[3].x) / 4, y: (c[0].y + c[1].y + c[2].y + c[3].y) / 4 };
}

function sideOf(c) {
  return (Math.hypot(c[0].x - c[1].x, c[0].y - c[1].y) + Math.hypot(c[1].x - c[2].x, c[1].y - c[2].y)) / 2;
}

function pointInQuad(p, q) {
  let sign = 0;
  for (let i = 0; i < 4; i++) {
    const a = q[i];
    const b = q[(i + 1) % 4];
    const cr = (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
    const sg = Math.sign(cr);
    if (sg === 0) continue;
    if (sign && sg !== sign) return false;
    sign = sg;
  }
  return true;
}

// higher is better: grid purity first, corrected bits as a small penalty
function matchScore(m) {
  return m.purity - 0.03 * m.distance;
}

function dedupe(results) {
  results.sort((a, b) => matchScore(b) - matchScore(a) || sideOf(b.corners) - sideOf(a.corners));
  const kept = [];
  for (const r of results) {
    const c = centerOf(r.corners);
    const s = sideOf(r.corners);
    // overlapping detections (same marker found twice, or a "marker" found inside another marker's
    // cells) are mutually exclusive: keep the better one
    const dup = kept.find((k) => {
      const kc = centerOf(k.corners);
      if (Math.hypot(kc.x - c.x, kc.y - c.y) < Math.max(s, sideOf(k.corners)) * 0.3) return true;
      return pointInQuad(c, k.corners) || pointInQuad(kc, r.corners);
    });
    if (dup) {
      dup.votes = (dup.votes || 1) + 1;
      continue;
    }
    kept.push(r);
  }
  return kept;
}
