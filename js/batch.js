// Batch marker sheet: ID list parsing, page layout and a minimal vector PDF writer (no library).

import { t } from './i18n.js';
export const PAPER = { A4: [210, 297], A3: [297, 420] }; // mm, portrait
const PT = 72 / 25.4; // mm -> pt
const FOOTER_MM = 8;
const MAX_IDS = 2000;

/**
 * Parses "1-5" / "1,2-4,7" style lists. Keeps the given order, removes duplicates.
 * @param {string} text
 * @param {number} count number of IDs in the dictionary (valid: 0..count-1)
 */
export function parseIdList(text, count) {
  const tokens = String(text)
    .split(/[,、，]/)
    .map((t) => t.trim())
    .filter(Boolean);
  if (!tokens.length) throw new Error(t('b.errEmpty'));
  const ids = [];
  const seen = new Set();
  for (const tok of tokens) {
    const m = /^(\d+)(?:\s*[-~〜–]\s*(\d+))?$/.exec(tok.normalize('NFKC'));
    if (!m) throw new Error(t('b.errParse', { t: tok }));
    let a = Number(m[1]);
    let b = m[2] !== undefined ? Number(m[2]) : a;
    if (a > b) [a, b] = [b, a];
    if (b >= count) throw new Error(t('b.errRange', { id: b, max: count - 1 }));
    if (b - a + 1 + ids.length > MAX_IDS * 2) throw new Error(t('b.errTooMany', { max: MAX_IDS }));
    for (let i = a; i <= b; i++) {
      if (!seen.has(i)) {
        seen.add(i);
        ids.push(i);
      }
    }
  }
  if (ids.length > MAX_IDS) throw new Error(t('b.errTooManyN', { max: MAX_IDS, n: ids.length }));
  return ids;
}

/**
 * @param {object} p
 *   paper 'A4'|'A3', landscape, markerMm (detection side), marginMm, gapMm, label (bool),
 *   tileCells (matrix.total), detectSide (matrix.detectSide)
 */
export function computeLayout(p) {
  let [pw, ph] = PAPER[p.paper];
  if (p.landscape) [pw, ph] = [ph, pw];
  const quietCells = p.quietCells ?? 0;
  const cellMm = p.markerMm / p.detectSide;
  const bodyMm = cellMm * (p.tileCells - 2 * quietCells); // printed marker without quiet zone
  const quietMm = cellMm * quietCells;
  // Each marker owns its required white quiet zone, so it can be cut out along the dashed box.
  // The label strip sits inside the box, below the quiet zone (it never intrudes into it).
  const labelMm = p.label ? 5 : 0;
  const tileW = bodyMm + 2 * quietMm;
  const tileH = tileW + labelMm;
  const gap = Math.max(0, p.gapMm); // space between cut boxes (0 = boxes share the cut line)
  const usableW = pw - 2 * p.marginMm;
  const usableH = ph - 2 * p.marginMm - FOOTER_MM;
  const eps = 1e-6;
  const cols = Math.max(0, Math.floor((usableW + gap + eps) / (tileW + gap)));
  const rows = Math.max(0, Math.floor((usableH + gap + eps) / (tileH + gap)));
  const gridW = cols * tileW + Math.max(0, cols - 1) * gap;
  return {
    pw,
    ph,
    cellMm,
    bodyMm,
    quietMm,
    quietCells,
    labelMm,
    tileW,
    tileH,
    gap,
    cols,
    rows,
    perPage: cols * rows,
    x0: (pw - gridW) / 2,
    y0: p.marginMm,
    marginMm: p.marginMm,
    cutLines: p.cutLines !== false,
  };
}

/** Position (mm, top-left origin) of the i-th cut box; the marker body starts quietMm inside it. */
function slotPos(L, i) {
  const k = i % L.perPage;
  const r = Math.floor(k / L.cols);
  const c = k % L.cols;
  return { page: Math.floor(i / L.perPage), x: L.x0 + c * (L.tileW + L.gap), y: L.y0 + r * (L.tileH + L.gap) };
}

/** Label centre y (mm) for a cut box whose top is at y. */
function labelCenterY(L, y) {
  return y + L.tileW + L.labelMm / 2;
}

function pdfEscape(s) {
  return String(s).replace(/[^\x20-\x7e]/g, '?').replace(/([\\()])/g, '\\$1');
}

// Helvetica width estimate (per 1pt font size) for centring short ASCII labels
function textWidth(s, size) {
  let w = 0;
  for (const ch of s) w += /[0-9]/.test(ch) ? 0.556 : /[A-Z]/.test(ch) ? 0.667 : ch === ' ' ? 0.278 : ch === '_' ? 0.556 : 0.5;
  return w * size;
}

const f = (v) => (Math.round(v * 1000) / 1000).toString();

/**
 * Builds the PDF.
 * @param {object} o
 *   layout (computeLayout result), items: [{id, matrix, label}], footer: string
 * @returns {Uint8Array}
 */
export function buildMarkerPdf({ layout: L, items, footer }) {
  const pages = Math.max(1, Math.ceil(items.length / L.perPage));
  const H = L.ph * PT;
  const contents = Array.from({ length: pages }, () => []);
  items.forEach((it, i) => {
    const { page, x, y } = slotPos(L, i);
    const out = contents[page];
    const { cells, total } = it.matrix;
    const cs = L.cellMm * PT;
    // the matrix includes the quiet zone, so its origin is the cut box origin (white cells are not drawn)
    const ox = x * PT;
    const oy = H - y * PT; // top edge in PDF coordinates
    if (L.cutLines) {
      out.push(`q 0.55 G 0.4 w [2 2] 0 d ${f(ox)} ${f(oy - L.tileH * PT)} ${f(L.tileW * PT)} ${f(L.tileH * PT)} re S Q`);
    }
    for (let r = 0; r < total; r++) {
      let c = 0;
      while (c < total) {
        if (cells[r * total + c] === 0) {
          let e = c;
          while (e < total && cells[r * total + e] === 0) e++;
          // slight overlap avoids hairline gaps between adjacent rectangles in some viewers
          out.push(`${f(ox + c * cs)} ${f(oy - (r + 1) * cs - 0.01)} ${f((e - c) * cs + 0.01)} ${f(cs + 0.02)} re f`);
          c = e;
        } else c++;
      }
    }
    if (it.label) {
      const size = 8;
      const tw = textWidth(it.label, size);
      const tx = (x + L.tileW / 2) * PT - tw / 2;
      const ty = H - (labelCenterY(L, y) + 1) * PT; // baseline ~1 mm below the label centre
      out.push(`BT /F1 ${size} Tf ${f(tx)} ${f(ty)} Td (${pdfEscape(it.label)}) Tj ET`);
    }
  });
  contents.forEach((out, p) => {
    const text = `${footer}   -   page ${p + 1}/${pages}   -   Print at 100% (actual size)`;
    out.push(`0.4 g BT /F1 7 Tf ${f(L.x0 * PT)} ${f((L.marginMm + 2) * PT)} Td (${pdfEscape(text)}) Tj ET 0 g`);
  });

  // ---- assemble objects
  const objs = [];
  objs[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  objs[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';
  const kids = [];
  contents.forEach((out, p) => {
    const pageId = 4 + p * 2;
    const contId = pageId + 1;
    kids.push(`${pageId} 0 R`);
    objs[pageId] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${f(L.pw * PT)} ${f(H)}] ` +
      `/Resources << /Font << /F1 3 0 R >> >> /Contents ${contId} 0 R >>`;
    const stream = out.join('\n');
    objs[contId] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
  });
  objs[2] = `<< /Type /Pages /Kids [${kids.join(' ')}] /Count ${pages} >>`;

  let pdf = '%PDF-1.4\n';
  const offsets = [];
  for (let i = 1; i < objs.length; i++) {
    offsets[i] = pdf.length;
    pdf += `${i} 0 obj\n${objs[i]}\nendobj\n`;
  }
  const xref = pdf.length;
  pdf += `xref\n0 ${objs.length}\n0000000000 65535 f \n`;
  for (let i = 1; i < objs.length; i++) pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objs.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  // all content is ASCII, so string length == byte length
  const bytes = new Uint8Array(pdf.length);
  for (let i = 0; i < pdf.length; i++) bytes[i] = pdf.charCodeAt(i);
  return bytes;
}

/** Draws page `page` of the sheet into a canvas (preview). */
export function drawSheetPreview(canvas, L, items, page = 0, widthPx = 320) {
  const s = widthPx / L.pw;
  canvas.width = Math.round(L.pw * s);
  canvas.height = Math.round(L.ph * s);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  // printable area guide (preview only)
  ctx.strokeStyle = 'rgba(13,110,253,0.3)';
  ctx.setLineDash([4, 3]);
  const m = L.marginMm * s;
  ctx.strokeRect(m, m, canvas.width - 2 * m, canvas.height - 2 * m);
  ctx.setLineDash([]);
  items.forEach((it, i) => {
    const pos = slotPos(L, i);
    if (pos.page !== page) return;
    const { cells, total } = it.matrix;
    const cs = L.cellMm * s;
    const ox = pos.x * s;
    const oy = pos.y * s;
    if (L.cutLines) {
      ctx.save();
      ctx.strokeStyle = '#8c8c8c';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.strokeRect(Math.round(ox) + 0.5, Math.round(oy) + 0.5, Math.round(L.tileW * s), Math.round(L.tileH * s));
      ctx.restore();
    }
    ctx.fillStyle = '#000';
    for (let r = 0; r < total; r++) {
      for (let c = 0; c < total; c++) {
        if (cells[r * total + c] === 0) ctx.fillRect(ox + c * cs, oy + r * cs, Math.ceil(cs), Math.ceil(cs));
      }
    }
    if (it.label && L.labelMm * s > 5) {
      ctx.font = `${Math.max(6, L.labelMm * s * 0.55)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(it.label, (pos.x + L.tileW / 2) * s, labelCenterY(L, pos.y) * s);
    }
  });
}
