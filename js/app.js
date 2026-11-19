import { DICTIONARIES, buildMarkerMatrix, markerToSVG, getDictionary, detectMarkers, loadDictionary } from './aruco.js';
import { QR_MODES, generateQR, decodeQR, initZXing, formatSegments } from './qr.js';
import { drawMatrix, matrixToSVG, downloadCanvas, downloadText, downloadBlob } from './render.js';
import { parseIdList, computeLayout, buildMarkerPdf, drawSheetPreview } from './batch.js';
import { t, getLang, setLang, applyI18n, onLangChange } from './i18n.js';

applyI18n();

const $ = (id) => document.getElementById(id);
const COLORS = { qr: '#198754', aruco: '#0d6efd', april: '#fd7e14' };
const MAX_IMAGE_DIM = 4096;

// ---------------------------------------------------------------------------
// Common UI helpers
// ---------------------------------------------------------------------------
function toast(msg) {
  $('toastBody').textContent = msg;
  window.bootstrap.Toast.getOrCreateInstance($('toast'), { delay: 3500 }).show();
}

function el(tag, attrs = {}, ...children) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') e.className = v;
    else if (k === 'text') e.textContent = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (k === 'style') e.style.cssText = v;
    else e.setAttribute(k, v);
  }
  for (const c of children) if (c != null) e.append(c);
  return e;
}

function debounce(fn, ms) {
  let t;
  return (...a) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...a), ms);
  };
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    toast(t('common.copied'));
  } catch {
    toast(t('common.copyFailed'));
  }
}

async function copyCanvasImage(canvas) {
  try {
    if (!window.ClipboardItem) throw new Error();
    const blob = await new Promise((r) => canvas.toBlob(r, 'image/png'));
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
    toast(t('common.imageCopied'));
  } catch {
    toast(t('common.imageCopyUnsupported'));
  }
}

// forms are only used for layout; never submit (replaces inline onsubmit, which CSP forbids)
document.querySelectorAll('form').forEach((f) => f.addEventListener('submit', (e) => e.preventDefault()));

// theme
$('themeToggle').addEventListener('click', () => {
  const next = document.documentElement.getAttribute('data-bs-theme') === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-bs-theme', next);
  try {
    localStorage.setItem('theme', next);
  } catch {}
});

// ---------------------------------------------------------------------------
// Marker detection worker (falls back to main thread)
// ---------------------------------------------------------------------------
let worker = null;
let reqSeq = 0;
const pending = new Map();

function getWorker() {
  if (worker === null) {
    try {
      worker = new Worker(new URL('./aruco-worker.js', import.meta.url), { type: 'module' });
      worker.onmessage = (e) => {
        const p = pending.get(e.data.reqId);
        if (!p) return;
        pending.delete(e.data.reqId);
        if (e.data.error) p.reject(new Error(e.data.error));
        else p.resolve(e.data.markers);
      };
      worker.onerror = () => {
        worker = false;
        for (const p of pending.values()) p.reject(new Error('worker failed'));
        pending.clear();
      };
    } catch {
      worker = false;
    }
  }
  return worker || null;
}

async function runMarkerDetection(imageData, opts) {
  const w = getWorker();
  if (w) {
    try {
      return await new Promise((resolve, reject) => {
        const reqId = ++reqSeq;
        pending.set(reqId, { resolve, reject });
        w.postMessage({ reqId, imageData, opts, lang: getLang() });
      });
    } catch (e) {
      if (worker !== false) throw e;
    }
  }
  await loadDictionary(opts.dictionary);
  return detectMarkers(imageData, opts);
}

// ---------------------------------------------------------------------------
// Detection settings
// ---------------------------------------------------------------------------
function fillDictSelect(select, withAuto) {
  const prev = select.value;
  select.innerHTML = '';
  if (withAuto) select.append(el('option', { value: 'AUTO', text: t('dict.auto') }));
  const groups = [
    ['dict.groupAruco', (d) => /^DICT_\dX\d_/.test(d.name)],
    ['dict.groupArucoOther', (d) => d.name === 'DICT_ARUCO_ORIGINAL' || d.name === 'DICT_ARUCO_MIP_36h12'],
    ['dict.groupApril', (d) => d.name.startsWith('DICT_APRILTAG')],
    ['dict.groupAT3', (d) => d.kind === 'at3'],
  ];
  for (const [key, pred] of groups) {
    const og = el('optgroup', { label: t(key) });
    for (const d of DICTIONARIES.filter(pred)) {
      og.append(el('option', { value: d.name, text: t('dict.option', { name: d.name.replace('DICT_', ''), n: d.count.toLocaleString() }) }));
    }
    select.append(og);
  }
  if (prev) select.value = prev;
}

fillDictSelect($('optDict'), true);

function getDetectOpts() {
  return {
    qr: $('optQR').checked,
    marker: $('optMarker').checked,
    markerOpts: {
      dictionary: $('optDict').value,
      borderBits: Math.max(1, Math.min(4, Number($('optBorder').value) || 1)),
      detectInverted: $('optInverted').checked,
    },
  };
}

// ---------------------------------------------------------------------------
// Results: build items, overlay drawing, list rendering
// ---------------------------------------------------------------------------
function toItems(qrs, markers) {
  const items = [];
  for (const q of qrs) {
    items.push({
      kind: 'qr',
      key: 'qr:' + q.format + ':' + q.text,
      color: COLORS.qr,
      title: q.format === 'QRCode' ? t('res.qr') : q.format,
      corners: q.corners,
      data: q,
    });
  }
  for (const m of markers) {
    const april = m.family.startsWith('APRILTAG') || m.family.startsWith('tag');
    items.push({
      kind: 'marker',
      key: 'mk:' + m.family + ':' + m.id,
      color: april ? COLORS.april : COLORS.aruco,
      title: april ? 'AprilTag' : 'ArUco',
      corners: m.corners,
      data: m,
    });
  }
  return items;
}

function drawShapes(ctx, items, imgW, imgH, highlight = -1) {
  const lw = Math.max(2, Math.round(Math.max(imgW, imgH) / 350));
  const font = Math.max(12, Math.round(Math.max(imgW, imgH) / 45));
  items.forEach((it, i) => {
    const c = it.corners;
    ctx.save();
    ctx.beginPath();
    c.forEach((p, k) => (k ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.closePath();
    ctx.fillStyle = it.color + (i === highlight ? '55' : '22');
    ctx.fill();
    ctx.lineWidth = i === highlight ? lw * 2 : lw;
    ctx.strokeStyle = it.color;
    ctx.lineJoin = 'round';
    ctx.stroke();
    // corner 0 (top-left of the code)
    ctx.fillStyle = '#dc3545';
    ctx.beginPath();
    ctx.arc(c[0].x, c[0].y, lw * 2, 0, Math.PI * 2);
    ctx.fill();
    // label
    const cx = (c[0].x + c[1].x + c[2].x + c[3].x) / 4;
    const cy = (c[0].y + c[1].y + c[2].y + c[3].y) / 4;
    const label = it.kind === 'marker' ? `${i + 1}: ID ${it.data.id}` : `${i + 1}`;
    ctx.font = `600 ${font}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const tw = ctx.measureText(label).width;
    ctx.fillStyle = it.color;
    roundRect(ctx, cx - tw / 2 - font * 0.4, cy - font * 0.7, tw + font * 0.8, font * 1.4, font * 0.3);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.fillText(label, cx, cy + 1);
    ctx.restore();
  });
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function fmtCorners(c) {
  return c.map((p) => `(${Math.round(p.x)}, ${Math.round(p.y)})`).join(' ');
}

function renderResults(items, { live = false, errors = [] } = {}) {
  const box = $('results');
  box.innerHTML = '';
  $('resultCount').textContent = items.length;
  for (const err of errors) box.append(el('div', { class: 'alert alert-danger py-2 small mb-0', text: typeof err === 'function' ? err() : err }));
  if (!items.length) {
    box.append(el('div', { class: 'text-body-secondary small empty-msg', text: t(live ? 'an.noneLive' : 'an.none') }));
    return;
  }
  items.forEach((it, i) => {
    const head = el(
      'div',
      { class: 'd-flex align-items-center gap-2' },
      el('span', { class: 'result-num', text: String(i + 1) }),
      el('span', { class: 'fw-semibold', text: it.kind === 'qr' && it.data.format === 'QRCode' ? t('res.qr') : it.title })
    );
    const body = el('div');
    if (it.kind === 'qr') {
      const q = it.data;
      const meta = [
        q.version && t('res.version', { v: q.version }),
        q.ecLevel && t('res.ecl', { v: q.ecLevel }),
        q.contentType,
        q.isMirrored && t('res.mirrored'),
        q.isInverted && t('res.inverted'),
      ]
        .filter(Boolean)
        .join(' / ');
      head.append(el('span', { class: 'small text-body-secondary ms-auto', text: meta }));
      body.append(el('div', { class: 'result-text', text: q.text || t('res.empty') }));
      const actions = el('div', { class: 'd-flex gap-2 flex-wrap' });
      actions.append(
        el('button', { class: 'btn btn-sm btn-outline-secondary', type: 'button', onclick: () => copyText(q.text) }, el('i', { class: 'bi bi-clipboard me-1' }), t('common.copy'))
      );
      if (/^https?:\/\/\S+$/i.test(q.text.trim())) {
        actions.append(
          el('a', { class: 'btn btn-sm btn-outline-primary', href: q.text.trim(), target: '_blank', rel: 'noopener noreferrer' }, el('i', { class: 'bi bi-box-arrow-up-right me-1' }), t('res.openLink'))
        );
      }
      body.append(actions);
    } else {
      const m = it.data;
      head.append(el('span', { class: 'ms-auto marker-id', text: `ID ${m.id}` }));
      const dicts = m.dictNames.map((n) => n.replace('DICT_', '')).join(', ');
      body.append(el('div', { class: 'small mt-1', text: t('res.dict', { v: dicts }) }));
      const notes = [];
      if (m.distance) notes.push(t('res.corrected', { n: m.distance }));
      if (m.inverted) notes.push(t('res.invertedMarker'));
      if (m.alternatives && m.alternatives.length) notes.push(t('res.alternatives', { v: m.alternatives.map((a) => `${a.family}#${a.id}`).join(', ') }));
      if (notes.length) body.append(el('div', { class: 'small text-body-secondary', text: notes.join(' / ') }));
    }
    body.append(el('div', { class: 'small text-body-secondary mt-1', text: t('res.corners', { v: fmtCorners(it.corners) }) }));
    const item = el('div', { class: 'result-item', style: `--item-color:${it.color}` }, head, body);
    if (!live) {
      item.addEventListener('mouseenter', () => redrawStill(i));
      item.addEventListener('mouseleave', () => redrawStill(-1));
    }
    box.append(item);
  });
}

// ---------------------------------------------------------------------------
// Still image analysis
// ---------------------------------------------------------------------------
const stage = $('stage');
const viewCanvas = $('viewCanvas');
let still = null; // { imageData, items }
let analyzeSeq = 0;

function setBusy(on) {
  $('busy').classList.toggle('d-none', !on);
}

function showMode(mode) {
  // mode: 'empty' | 'still' | 'camera'
  $('dropHint').classList.toggle('d-none', mode !== 'empty');
  viewCanvas.classList.toggle('d-none', mode !== 'still');
  $('cameraWrap').classList.toggle('d-none', mode !== 'camera');
  $('cameraBar').classList.toggle('d-none', mode !== 'camera');
  stage.classList.toggle('has-content', mode !== 'empty');
  $('clearBtn').disabled = mode === 'empty';
}

// label: a file name, or { key } for a translated label
function labelText(label) {
  return typeof label === 'string' ? label : t(label.key);
}

function renderImageInfo() {
  if (camera.running) $('imageInfo').textContent = t('cam.live');
  else if (still) {
    const { label, srcW, srcH, imageData } = still;
    const scaled = imageData.width !== srcW;
    $('imageInfo').textContent =
      t('an.imageInfo', { label: labelText(label), w: srcW, h: srcH }) + (scaled ? t('an.downscaled', { w: imageData.width, h: imageData.height }) : '');
  } else $('imageInfo').textContent = '';
}

async function loadBlob(blob, label) {
  stopCamera();
  let bmp;
  try {
    bmp = await createImageBitmap(blob);
  } catch {
    toast(t('an.loadFailed'));
    return;
  }
  const scale = Math.min(1, MAX_IMAGE_DIM / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * scale);
  const h = Math.round(bmp.height * scale);
  viewCanvas.width = w;
  viewCanvas.height = h;
  const ctx = viewCanvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(bmp, 0, 0, w, h);
  still = { imageData: ctx.getImageData(0, 0, w, h), items: [], errors: [], label, srcW: bmp.width, srcH: bmp.height };
  renderImageInfo();
  bmp.close && bmp.close();
  showMode('still');
  await analyzeStill();
}

async function analyzeStill() {
  if (!still) return;
  const seq = ++analyzeSeq;
  const opts = getDetectOpts();
  setBusy(true);
  $('resultStatus').textContent = t('an.analyzing');
  const t0 = performance.now();
  const errors = [];
  const [qrs, markers] = await Promise.all([
    opts.qr
      ? decodeQR(still.imageData).catch((e) => {
          console.error(e);
          errors.push(() => qrErrorMessage(e));
          return [];
        })
      : [],
    opts.marker
      ? runMarkerDetection(still.imageData, opts.markerOpts).catch((e) => {
          console.error(e);
          errors.push(() => t('an.markerError', { msg: e.message }));
          return [];
        })
      : [],
  ]);
  if (seq !== analyzeSeq || !still) return;
  still.items = toItems(qrs, markers);
  still.errors = errors;
  redrawStill(-1);
  renderResults(still.items, { errors });
  $('resultStatus').textContent = `${Math.round(performance.now() - t0)} ms`;
  setBusy(false);
}

function qrErrorMessage(e) {
  if (location.protocol === 'file:') return t('an.qrFileProtocol');
  return t('an.qrError', { msg: e && e.message ? e.message : e });
}

function redrawStill(highlight) {
  if (!still) return;
  const ctx = viewCanvas.getContext('2d');
  ctx.putImageData(still.imageData, 0, 0);
  drawShapes(ctx, still.items, viewCanvas.width, viewCanvas.height, highlight);
}

function clearAll() {
  stopCamera();
  still = null;
  analyzeSeq++;
  setBusy(false);
  showMode('empty');
  $('imageInfo').textContent = '';
  $('resultStatus').textContent = '';
  $('resultCount').textContent = '0';
  renderNotYet();
}

function renderNotYet() {
  $('results').replaceChildren(el('div', { class: 'text-body-secondary small empty-msg', text: t('an.notYet') }));
}

// inputs
$('fileInput').addEventListener('change', (e) => {
  const f = e.target.files[0];
  if (f) loadBlob(f, f.name);
  e.target.value = '';
});
stage.addEventListener('click', () => {
  if (!stage.classList.contains('has-content')) $('fileInput').click();
});
stage.addEventListener('keydown', (e) => {
  if ((e.key === 'Enter' || e.key === ' ') && !stage.classList.contains('has-content')) {
    e.preventDefault();
    $('fileInput').click();
  }
});
['dragenter', 'dragover'].forEach((t) =>
  stage.addEventListener(t, (e) => {
    e.preventDefault();
    stage.classList.add('dragover');
  })
);
['dragleave', 'drop'].forEach((t) => stage.addEventListener(t, () => stage.classList.remove('dragover')));
stage.addEventListener('drop', (e) => {
  e.preventDefault();
  const f = [...(e.dataTransfer?.files || [])].find((x) => x.type.startsWith('image/'));
  if (f) loadBlob(f, f.name);
  else toast(t('an.dropImage'));
});
document.addEventListener('paste', (e) => {
  const items = [...(e.clipboardData?.items || [])];
  const img = items.find((i) => i.kind === 'file' && i.type.startsWith('image/'));
  if (!img) return;
  e.preventDefault();
  loadBlob(img.getAsFile(), { key: 'an.pasted' });
  document.getElementById('analyze').scrollIntoView({ behavior: 'smooth', block: 'start' });
});
$('pasteBtn').addEventListener('click', async () => {
  if (!navigator.clipboard?.read) {
    toast(t('an.pasteUnsupported'));
    return;
  }
  try {
    const clipItems = await navigator.clipboard.read();
    for (const ci of clipItems) {
      const type = ci.types.find((t) => t.startsWith('image/'));
      if (type) {
        await loadBlob(await ci.getType(type), { key: 'an.clipboardImage' });
        return;
      }
    }
    toast(t('an.noClipboardImage'));
  } catch {
    toast(t('an.clipboardFailed'));
  }
});
$('clearBtn').addEventListener('click', clearAll);
['optQR', 'optMarker', 'optInverted', 'optDict', 'optBorder'].forEach((id) =>
  $(id).addEventListener('change', () => {
    if (!camera.running) analyzeStill();
  })
);

// ---------------------------------------------------------------------------
// Camera (only started by explicit user action)
// ---------------------------------------------------------------------------
const video = $('video');
const overlay = $('videoOverlay');
const frameCanvas = document.createElement('canvas');
const camera = { stream: null, running: false, timer: 0, lastKeys: '' };

async function startCamera(deviceId) {
  if (!navigator.mediaDevices?.getUserMedia) {
    toast(t('cam.unavailable'));
    return;
  }
  stopCamera();
  const video0 = { width: { ideal: 1280 }, height: { ideal: 720 } };
  const constraints = {
    audio: false,
    video: deviceId ? { ...video0, deviceId: { exact: deviceId } } : { ...video0, facingMode: { ideal: 'environment' } },
  };
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia(constraints);
  } catch (e) {
    const msg =
      e.name === 'NotAllowedError'
        ? t('cam.denied')
        : e.name === 'NotFoundError'
          ? t('cam.notFound')
          : t('cam.failed', { msg: e.message });
    toast(msg);
    return;
  }
  camera.stream = stream;
  camera.running = true;
  camera.lastKeys = null;
  video.srcObject = stream;
  try {
    await video.play();
  } catch {}
  showMode('camera');
  $('cameraBtn').classList.add('active');
  renderImageInfo();
  $('resultStatus').textContent = '';
  renderResults([], { live: true });
  await fillCameraSelect(stream);
  cameraLoop();
}

async function fillCameraSelect(stream) {
  const sel = $('cameraSelect');
  try {
    const devices = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'videoinput');
    const currentId = stream.getVideoTracks()[0]?.getSettings().deviceId;
    sel.innerHTML = '';
    devices.forEach((d, i) => sel.append(el('option', { value: d.deviceId, text: d.label || t('cam.device', { n: i + 1 }) })));
    if (currentId) sel.value = currentId;
    sel.classList.toggle('d-none', devices.length < 2);
  } catch {
    sel.classList.add('d-none');
  }
}

function stopCamera() {
  if (!camera.running && !camera.stream) return;
  camera.running = false;
  clearTimeout(camera.timer);
  camera.stream?.getTracks().forEach((t) => t.stop());
  camera.stream = null;
  video.srcObject = null;
  $('cameraBtn').classList.remove('active');
  if (still) {
    showMode('still');
    redrawStill(-1);
    renderResults(still.items, { errors: still.errors });
  } else {
    showMode('empty');
  }
  renderImageInfo();
}

async function cameraLoop() {
  if (!camera.running) return;
  const t0 = performance.now();
  if (video.readyState >= 2 && video.videoWidth) {
    const scale = Math.min(1, 1280 / Math.max(video.videoWidth, video.videoHeight));
    const w = Math.round(video.videoWidth * scale);
    const h = Math.round(video.videoHeight * scale);
    frameCanvas.width = w;
    frameCanvas.height = h;
    const fctx = frameCanvas.getContext('2d', { willReadFrequently: true });
    fctx.drawImage(video, 0, 0, w, h);
    const img = fctx.getImageData(0, 0, w, h);
    const opts = getDetectOpts();
    const [qrs, markers] = await Promise.all([
      opts.qr ? decodeQR(img, { tryHarder: false }).catch(() => []) : [],
      opts.marker ? runMarkerDetection(img, { ...opts.markerOpts, maxDim: 1280 }).catch(() => []) : [],
    ]);
    if (!camera.running) return;
    const items = toItems(qrs, markers);
    overlay.width = w;
    overlay.height = h;
    const octx = overlay.getContext('2d');
    octx.clearRect(0, 0, w, h);
    drawShapes(octx, items, w, h);
    const keys = items.map((i) => i.key).join('|');
    if (keys !== camera.lastKeys) {
      camera.lastKeys = keys;
      renderResults(items, { live: true });
    }
    $('resultStatus').textContent = t('cam.perFrame', { ms: Math.round(performance.now() - t0) });
  }
  camera.timer = setTimeout(cameraLoop, 100);
}

$('cameraBtn').addEventListener('click', () => (camera.running ? stopCamera() : startCamera()));
$('stopCameraBtn').addEventListener('click', stopCamera);
$('cameraSelect').addEventListener('change', (e) => startCamera(e.target.value));
$('captureBtn').addEventListener('click', () => {
  if (!video.videoWidth) return;
  const c = document.createElement('canvas');
  c.width = video.videoWidth;
  c.height = video.videoHeight;
  c.getContext('2d').drawImage(video, 0, 0);
  c.toBlob((b) => b && loadBlob(b, { key: 'an.captured' }), 'image/png');
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden && camera.running) stopCamera();
});

// ---------------------------------------------------------------------------
// QR generation
// ---------------------------------------------------------------------------
const MASK_FORMULAS = [
  '(i + j) mod 2',
  'i mod 2',
  'j mod 3',
  '(i + j) mod 3',
  '(⌊i/2⌋ + ⌊j/3⌋) mod 2',
  'ij mod 2 + ij mod 3',
  '(ij mod 2 + ij mod 3) mod 2',
  '((i+j) mod 2 + ij mod 3) mod 2',
];
function fillQRSelects() {
  const keep = ['qrMode', 'qrVersion', 'qrMask'].map((id) => $(id).value);
  $('qrMode').replaceChildren(...Object.entries(QR_MODES).map(([v, key]) => el('option', { value: v, text: t(key) })));
  $('qrVersion').replaceChildren(el('option', { value: '0', text: t('common.auto') }));
  for (let v = 1; v <= 40; v++) $('qrVersion').append(el('option', { value: String(v), text: `${v} (${17 + 4 * v}×${17 + 4 * v})` }));
  $('qrMask').replaceChildren(el('option', { value: '-1', text: t('common.auto') }));
  MASK_FORMULAS.forEach((f, i) => $('qrMask').append(el('option', { value: String(i), text: `${i}: ${f}` })));
  ['qrMode', 'qrVersion', 'qrMask'].forEach((id, i) => keep[i] && ($(id).value = keep[i]));
}
fillQRSelects();

let lastQR = null;

function qrParams() {
  return {
    text: $('qrText').value,
    mode: $('qrMode').value,
    ecl: $('qrEcl').value,
    version: Number($('qrVersion').value),
    mask: Number($('qrMask').value),
    margin: Math.max(0, Math.min(20, Number($('qrMargin').value) || 0)),
    scale: Math.max(1, Math.min(50, Number($('qrScale').value) || 1)),
    dark: safeColor($('qrDark').value, '#000000'),
    light: safeColor($('qrLight').value, '#ffffff'),
  };
}

// colours end up in SVG attributes: accept only #rrggbb
function safeColor(v, fallback) {
  return /^#[0-9a-f]{6}$/i.test(v) ? v : fallback;
}

function luminance(hex) {
  const n = parseInt(hex.slice(1), 16);
  return 0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255);
}

function updateQR() {
  const p = qrParams();
  $('qrCount').textContent = t('qr.count', { c: [...p.text].length, b: new TextEncoder().encode(p.text).length });
  const errBox = $('qrError');
  try {
    const qr = generateQR(p);
    lastQR = { qr, p };
    drawMatrix($('qrCanvas'), qr.size, qr.get, p);
    const px = (qr.size + 2 * p.margin) * p.scale;
    $('qrInfo').textContent = t('qr.info', { v: qr.version, s: qr.size, e: qr.ecl, m: qr.mask, seg: formatSegments(qr.segments), px });
    const warns = [];
    if (luminance(p.dark) > luminance(p.light)) warns.push(t('qr.warnInverted'));
    else if (luminance(p.light) - luminance(p.dark) < 100) warns.push(t('qr.warnContrast'));
    if (p.margin < 4) warns.push(t('qr.warnMargin'));
    errBox.textContent = warns.join(' ');
    errBox.classList.toggle('d-none', !warns.length);
    errBox.classList.replace('alert-danger', 'alert-warning');
  } catch (e) {
    lastQR = null;
    const c = $('qrCanvas');
    c.getContext('2d').clearRect(0, 0, c.width, c.height);
    $('qrInfo').textContent = '';
    errBox.textContent = e.message;
    errBox.classList.replace('alert-warning', 'alert-danger');
    errBox.classList.remove('d-none');
  }
}

const updateQRDebounced = debounce(updateQR, 120);
$('qrForm').addEventListener('input', updateQRDebounced);
$('qrForm').addEventListener('change', updateQRDebounced);
$('qrPng').addEventListener('click', () => lastQR && downloadCanvas($('qrCanvas'), `qrcode_v${lastQR.qr.version}_${lastQR.qr.ecl}.png`));
$('qrSvg').addEventListener('click', () => {
  if (!lastQR) return;
  const { qr, p } = lastQR;
  const svg = matrixToSVG(qr.size, qr.get, { ...p, pixelSize: (qr.size + 2 * p.margin) * p.scale });
  downloadText(svg, `qrcode_v${qr.version}_${qr.ecl}.svg`);
});
$('qrCopy').addEventListener('click', () => lastQR && copyCanvasImage($('qrCanvas')));
$('qrAnalyze').addEventListener('click', () => analyzeCanvas($('qrCanvas'), { key: 'an.generatedQR' }, !!lastQR));

// ---------------------------------------------------------------------------
// Marker generation
// ---------------------------------------------------------------------------
fillDictSelect($('mkDict'), false);
let lastMarker = null;

let markerSeq = 0;

async function updateMarker() {
  const seq = ++markerSeq;
  const dictName = $('mkDict').value;
  const d = getDictionary(dictName);
  const isAT3 = d.kind === 'at3';
  const idInput = $('mkId');
  idInput.max = d.count - 1;
  $('mkIdRange').textContent = t('mk.idRange', { max: d.count - 1 });
  $('mkBorder').disabled = isAT3;
  $('mkBorder').title = isAT3 ? t('mk.borderAT3') : '';
  const errBox = $('mkError');
  try {
    let info3 = null;
    if (isAT3) {
      $('mkInfo').textContent = t('common.loadingDict');
      info3 = await loadDictionary(dictName);
      if (seq !== markerSeq) return;
    }
    const id = Number(idInput.value);
    const border = Math.max(1, Math.min(4, Number($('mkBorder').value) || 1));
    const quiet = Math.max(0, Math.min(10, Number($('mkQuiet').value) || 0));
    const cell = Math.max(1, Math.min(200, Number($('mkCell').value) || 1));
    const mm = Number($('mkMm').value) || 0;
    const showLabel = $('mkLabel').checked;
    const matrix = buildMarkerMatrix(dictName, id, border, quiet);
    const label = showLabel ? `${dictName.replace('DICT_', '')}  ID ${id}` : '';
    const inner = matrix.detectSide;

    const canvas = $('mkCanvas');
    const W = matrix.total * cell;
    const labelH = showLabel ? Math.max(14, Math.round(W * 0.12)) : 0;
    canvas.width = W;
    canvas.height = W + labelH;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#000';
    for (let r = 0; r < matrix.total; r++) {
      for (let c = 0; c < matrix.total; c++) {
        if (!matrix.cells[r * matrix.total + c]) ctx.fillRect(c * cell, r * cell, cell, cell);
      }
    }
    if (label) {
      ctx.font = `${Math.round(labelH * 0.6)}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, W / 2, W + labelH / 2);
    }
    lastMarker = { matrix, dictName, id, label, cell, mm, inner };
    const common = { d: inner, t: matrix.total, w: canvas.width, hh: canvas.height };
    let info = isAT3
      ? t('mk.infoAT3', { ...common, tw: info3.totalWidth, bits: info3.nbits, h: info3.h })
      : t('mk.info', { ...common, m: d.markerSize, b: border });
    if (mm) info += t('mk.infoMm', { basis: t(isAT3 ? 'mk.basisAT3' : 'mk.basisOuter'), mm, cell: (mm / inner).toFixed(2) });
    if (isAT3 && matrix.unused.some((v) => v)) info += t('mk.infoUnused');
    $('mkInfo').textContent = info;
    errBox.classList.toggle('d-none', quiet > 0);
    errBox.textContent = quiet > 0 ? '' : t('mk.warnQuiet');
  } catch (e) {
    lastMarker = null;
    errBox.textContent = e.message;
    errBox.classList.remove('d-none');
  }
}

$('mkForm').addEventListener('input', debounce(updateMarker, 80));
$('mkDict').addEventListener('change', () => {
  const d = getDictionary($('mkDict').value);
  if (Number($('mkId').value) >= d.count) $('mkId').value = 0;
  updateMarker();
});
$('mkRandom').addEventListener('click', () => {
  const d = getDictionary($('mkDict').value);
  $('mkId').value = Math.floor(Math.random() * d.count);
  updateMarker();
});
function markerFileBase() {
  return `${lastMarker.dictName.replace('DICT_', '')}_id${lastMarker.id}`;
}
$('mkPng').addEventListener('click', () => lastMarker && downloadCanvas($('mkCanvas'), markerFileBase() + '.png'));
$('mkSvg').addEventListener('click', () => {
  if (!lastMarker) return;
  const { matrix, label, cell, mm, inner } = lastMarker;
  const svg = markerToSVG(matrix, { sizeMm: mm ? (mm * matrix.total) / inner : null, sizePx: matrix.total * cell, label });
  downloadText(svg, markerFileBase() + '.svg');
});
$('mkCopy').addEventListener('click', () => lastMarker && copyCanvasImage($('mkCanvas')));
$('mkAnalyze').addEventListener('click', () => analyzeCanvas($('mkCanvas'), { key: 'an.generatedMarker' }, !!lastMarker));

// ---------------------------------------------------------------------------
// Batch sheet (PDF)
// ---------------------------------------------------------------------------
let batchSeq = 0;
let lastBatch = null;

function clampNum(id, min, max, def) {
  const v = Number($(id).value);
  return Number.isFinite(v) && $(id).value !== '' ? Math.max(min, Math.min(max, v)) : def;
}

async function updateBatch() {
  const seq = ++batchSeq;
  const warn = $('bWarn');
  const info = $('bInfo');
  const canvas = $('bCanvas');
  lastBatch = null;
  $('bPdf').disabled = true;
  try {
    const dictName = $('mkDict').value;
    const d = getDictionary(dictName);
    if (d.kind === 'at3') {
      info.textContent = t('common.loadingDict');
      await loadDictionary(dictName);
      if (seq !== batchSeq) return;
    }
    const ids = parseIdList($('bIds').value, d.count);
    const border = clampNum('mkBorder', 1, 4, 1);
    const quiet = clampNum('mkQuiet', 0, 10, 1);
    const sizeMm = clampNum('bMm', 5, 400, 50);
    const label = $('bLabel').checked;
    const paper = $('bPaper').value;
    const items = ids.map((id) => ({
      id,
      matrix: buildMarkerMatrix(dictName, id, border, quiet),
      label: label ? `${dictName.replace('DICT_', '')}  ID ${id}` : '',
    }));
    const m0 = items[0].matrix;
    const outerCells = m0.total - 2 * quiet; // marker without quiet zone
    // computeLayout works with the detection side; convert when the outer size is specified
    const markerMm = $('bBasis').value === 'outer' ? (sizeMm * m0.detectSide) / outerCells : sizeMm;
    const L = computeLayout({
      paper,
      landscape: $('bOrient').value === 'landscape',
      markerMm,
      marginMm: clampNum('bMargin', 0, 50, 10),
      gapMm: clampNum('bGap', 0, 50, 0),
      label,
      tileCells: m0.total,
      detectSide: m0.detectSide,
      quietCells: quiet,
      cutLines: $('bCut').checked,
    });
    if (L.perPage === 0) {
      throw new Error(t('b.noFit', { mm: sizeMm, paper }));
    }
    const pages = Math.ceil(items.length / L.perPage);
    info.textContent = t('b.info', {
      n: items.length,
      per: L.perPage,
      cols: L.cols,
      rows: L.rows,
      det: markerMm.toFixed(1),
      outer: L.bodyMm.toFixed(1),
      cell: L.cellMm.toFixed(2),
      tw: L.tileW.toFixed(1),
      th: L.tileH.toFixed(1),
      q: L.quietMm.toFixed(1),
      label,
    });
    const warns = [];
    if (pages > 1) warns.push(t('b.warnPages', { n: items.length, per: L.perPage, pages }));
    if (L.cellMm < 1) warns.push(t('b.warnCell', { cell: L.cellMm.toFixed(2) }));
    if (quiet === 0) warns.push(t('b.warnQuiet'));
    warn.innerHTML = '';
    warns.forEach((w) => warn.append(el('div', { text: w })));
    warn.classList.replace('alert-danger', 'alert-warning');
    warn.classList.toggle('d-none', !warns.length);
    drawSheetPreview(canvas, L, items, 0, 360);
    lastBatch = { L, items, dictName, markerMm, paper, pages };
    $('bPdf').disabled = false;
  } catch (e) {
    if (seq !== batchSeq) return;
    info.textContent = '';
    warn.textContent = e.message;
    warn.classList.replace('alert-warning', 'alert-danger');
    warn.classList.remove('d-none');
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
  }
}

const updateBatchDebounced = debounce(updateBatch, 200);
$('bForm').addEventListener('input', updateBatchDebounced);
$('bForm').addEventListener('change', updateBatchDebounced);
$('mkForm').addEventListener('input', updateBatchDebounced);
$('mkDict').addEventListener('change', updateBatchDebounced);
$('bPdf').addEventListener('click', () => {
  if (!lastBatch) return;
  const { L, items, dictName, markerMm, paper, pages } = lastBatch;
  const idText = $('bIds').value.replace(/\s+/g, '').slice(0, 60);
  const pdf = buildMarkerPdf({ layout: L, items, footer: `${dictName}   marker ${markerMm.toFixed(1)} mm   IDs ${idText}` });
  downloadBlob(new Blob([pdf], { type: 'application/pdf' }), `${dictName.replace('DICT_', '')}_${paper}_${items.length}markers.pdf`);
  if (pages > 1) toast(t('b.toastPages', { pages }));
});

function analyzeCanvas(canvas, label, ok) {
  if (!ok) return;
  canvas.toBlob((b) => {
    if (!b) return;
    loadBlob(b, label);
    document.getElementById('analyze').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 'image/png');
}

// ---------------------------------------------------------------------------
// init
// ---------------------------------------------------------------------------
updateQR();
updateMarker();
updateBatch();

// language switcher: re-render everything that is built in JS
$('langSelect').value = getLang();
$('langSelect').addEventListener('change', (e) => setLang(e.target.value));
onLangChange(() => {
  fillDictSelect($('optDict'), true);
  fillDictSelect($('mkDict'), false);
  fillQRSelects();
  updateQR();
  updateMarker();
  updateBatch();
  renderImageInfo();
  if (camera.running) camera.lastKeys = null;
  else if (still) renderResults(still.items, { errors: still.errors });
  else renderNotYet();
  $('resultStatus').textContent = '';
});
// preload the QR decoder in the background
setTimeout(() => initZXing().catch(() => {}), 300);
