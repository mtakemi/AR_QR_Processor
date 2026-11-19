// QR code generation (node-qrcode bundled as window.QRLib) and decoding (zxing-wasm as window.ZXingWASM).

import { t } from './i18n.js';

/** Encoding mode value -> i18n key of its label. */
export const QR_MODES = {
  auto: 'qr.modeAuto',
  numeric: 'qr.modeNumeric',
  alphanumeric: 'qr.modeAlphanumeric',
  byte: 'qr.modeByte',
  kanji: 'qr.modeKanji',
};

const SEGMENT_LABEL = { Numeric: 'qr.segNumeric', Alphanumeric: 'qr.segAlphanumeric', Byte: 'qr.segByte', Kanji: 'qr.segKanji' };

/**
 * @param {object} p
 *  text, mode, ecl ('L'|'M'|'Q'|'H'), version (0 = auto), mask (-1 = auto)
 * @returns {{size:number, get:(r,c)=>boolean, version:number, ecl:string, mask:number, segments:string[]}}
 */
export function generateQR(p) {
  const { QRLib } = window;
  if (!p.text) throw new Error(t('qr.errEmpty'));
  const opts = { errorCorrectionLevel: p.ecl, toSJISFunc: QRLib.toSJIS };
  if (p.version > 0) opts.version = p.version;
  if (p.mask >= 0) opts.maskPattern = p.mask;
  const data = p.mode === 'auto' ? p.text : [{ data: p.text, mode: p.mode }];
  let qr;
  try {
    qr = QRLib.create(data, opts);
  } catch (e) {
    throw new Error(translateError(e.message, p));
  }
  const m = qr.modules;
  return {
    size: m.size,
    get: (r, c) => !!m.get(r, c),
    version: qr.version,
    ecl: p.ecl,
    mask: qr.maskPattern,
    segments: qr.segments.map((s) => ({ mode: s.mode.id, length: s.getLength() })),
  };
}

function translateError(msg, p) {
  if (/minimum version required/i.test(msg) || /too big/i.test(msg) || /amount of data/i.test(msg)) {
    const m = msg.match(/minimum version required to store current data is: (\d+)/i);
    return m ? t('qr.errVersion', { v: p.version, min: m[1] }) : t('qr.errTooBig');
  }
  if (/cannot be encoded with mode/i.test(msg)) {
    return t('qr.errMode', { mode: t(QR_MODES[p.mode]) });
  }
  return msg;
}

/** Human-readable segment list, e.g. "Byte(12) + Numeric(8)". */
export function formatSegments(segments) {
  const ja = t('qr.segByte') !== 'Byte';
  return segments.map((s) => `${SEGMENT_LABEL[s.mode] ? t(SEGMENT_LABEL[s.mode]) : s.mode}${ja ? `(${s.length})` : ` (${s.length})`}`).join(' + ');
}

// ---------------------------------------------------------------------------
// Decoding
// ---------------------------------------------------------------------------
let zxingReady = null;

export function initZXing() {
  if (!zxingReady) {
    const wasmUrl = new URL('../vendor/zxing-wasm/zxing_reader.wasm', import.meta.url).href;
    zxingReady = window.ZXingWASM.prepareZXingModule({
      overrides: { locateFile: (path, prefix) => (path.endsWith('.wasm') ? wasmUrl : prefix + path) },
      fireImmediately: true,
    });
  }
  return zxingReady;
}

/**
 * @param {ImageData} imageData
 * @param {{formats?:string[], tryHarder?:boolean}} opts
 */
export async function decodeQR(imageData, opts = {}) {
  await initZXing();
  const results = await window.ZXingWASM.readBarcodes(imageData, {
    formats: opts.formats || ['QRCode', 'MicroQRCode', 'rMQRCode'],
    tryHarder: opts.tryHarder ?? true,
    tryInvert: true,
    tryRotate: true,
    tryDownscale: true,
    maxNumberOfSymbols: 255,
  });
  return results
    .filter((r) => r.isValid)
    .map((r) => ({
      format: r.format,
      text: r.text,
      bytes: r.bytes,
      version: r.version,
      ecLevel: r.ecLevel,
      contentType: r.contentType,
      isMirrored: r.isMirrored,
      isInverted: r.isInverted,
      corners: [r.position.topLeft, r.position.topRight, r.position.bottomRight, r.position.bottomLeft],
    }));
}
