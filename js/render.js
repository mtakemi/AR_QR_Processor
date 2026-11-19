// Rendering helpers for module matrices (QR / markers) and downloads.

/**
 * Draws a square module matrix to a canvas.
 * @param {HTMLCanvasElement} canvas
 * @param {number} size  modules per side (without margin)
 * @param {(r:number,c:number)=>boolean} isDark
 * @param {{scale:number, margin:number, dark:string, light:string}} o
 */
export function drawMatrix(canvas, size, isDark, { scale, margin, dark = '#000', light = '#fff' }) {
  const total = size + margin * 2;
  canvas.width = canvas.height = total * scale;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = light;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = dark;
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (isDark(r, c)) ctx.fillRect((c + margin) * scale, (r + margin) * scale, scale, scale);
    }
  }
}

export function matrixToSVG(size, isDark, { margin, dark = '#000', light = '#fff', pixelSize }) {
  const total = size + margin * 2;
  let path = '';
  for (let r = 0; r < size; r++) {
    let c = 0;
    while (c < size) {
      if (isDark(r, c)) {
        let e = c;
        while (e < size && isDark(r, e)) e++;
        path += `M${c + margin} ${r + margin}h${e - c}v1h${c - e}z`;
        c = e;
      } else c++;
    }
  }
  const px = pixelSize || total * 8;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${px}" viewBox="0 0 ${total} ${total}" shape-rendering="crispEdges">` +
    `<rect width="${total}" height="${total}" fill="${light}"/><path fill="${dark}" d="${path}"/></svg>`
  );
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadCanvas(canvas, filename) {
  canvas.toBlob((b) => b && downloadBlob(b, filename), 'image/png');
}

export function downloadText(text, filename, type = 'image/svg+xml') {
  downloadBlob(new Blob([text], { type }), filename);
}
