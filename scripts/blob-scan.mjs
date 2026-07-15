/**
 * Scans a cleaned (transparent-bg) concept sheet for individual pose blobs and
 * builds an indexed "contact sheet" so a human can map blob index -> action.
 *
 * Usage: node scripts/blob-scan.mjs art-src/bruiser_clean.png art-src/bruiser_scan
 * Writes:
 *   <out>.montage.png  – every qualifying blob in a numbered grid (row-major)
 *   <out>.blobs.json   – [{i,x,y,w,h,area}] in the same order as the montage
 */
import fs from 'node:fs';
import { PNG } from 'pngjs';

const [, , inFile, outBase] = process.argv;
if (!inFile || !outBase) {
  console.error('Usage: node scripts/blob-scan.mjs <cleaned.png> <outBase>');
  process.exit(1);
}

const png = PNG.sync.read(fs.readFileSync(inFile));
const { width: W, height: H, data } = png;
const A = (x, y) => data[(y * W + x) * 4 + 3];

// ---- find all 4-connected opaque blobs ----
const seen = new Uint8Array(W * H);
const stack = [];
const blobs = [];
for (let sy = 0; sy < H; sy += 1) {
  for (let sx = 0; sx < W; sx += 1) {
    if (seen[sy * W + sx] || A(sx, sy) <= 60) continue;
    let minX = sx;
    let minY = sy;
    let maxX = sx;
    let maxY = sy;
    let count = 0;
    stack.length = 0;
    stack.push(sx, sy);
    seen[sy * W + sx] = 1;
    while (stack.length) {
      const y = stack.pop();
      const x = stack.pop();
      count += 1;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      const nb = [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]];
      for (const [nx, ny] of nb) {
        if (nx < 0 || nx >= W || ny < 0 || ny >= H) continue;
        const idx = ny * W + nx;
        if (seen[idx] || A(nx, ny) <= 60) continue;
        seen[idx] = 1;
        stack.push(nx, ny);
      }
    }
    blobs.push({ x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1, area: count });
  }
}

// ---- keep only body-sized blobs (drop label text and tiny FX sparks) ----
const bodies = blobs.filter(
  (b) => b.h >= 62 && b.h <= 220 && b.w >= 22 && b.area >= 900 && b.w / b.h <= 2.4,
);
// reading order: top-to-bottom in bands, then left-to-right
bodies.sort((a, b) => {
  const band = Math.round(a.y / 45) - Math.round(b.y / 45);
  return band !== 0 ? band : a.x - b.x;
});
bodies.forEach((b, i) => (b.i = i));

// ---- montage: each blob in a numbered grid cell ----
const COLS = 8;
const CELL = 150;
const rows = Math.ceil(bodies.length / COLS);
const mont = new PNG({ width: COLS * CELL, height: rows * CELL });
mont.data.fill(20); // dark bg
for (let p = 3; p < mont.data.length; p += 4) mont.data[p] = 255;

// tiny 3x5 digit font for the index labels
const FONT = {
  0: ['111', '101', '101', '101', '111'], 1: ['010', '110', '010', '010', '111'],
  2: ['111', '001', '111', '100', '111'], 3: ['111', '001', '111', '001', '111'],
  4: ['101', '101', '111', '001', '001'], 5: ['111', '100', '111', '001', '111'],
  6: ['111', '100', '111', '101', '111'], 7: ['111', '001', '010', '010', '010'],
  8: ['111', '101', '111', '101', '111'], 9: ['111', '101', '111', '001', '111'],
};
const putPx = (X, Y, r, g, bl) => {
  if (X < 0 || Y < 0 || X >= mont.width || Y >= mont.height) return;
  const i = (Y * mont.width + X) * 4;
  mont.data[i] = r; mont.data[i + 1] = g; mont.data[i + 2] = bl; mont.data[i + 3] = 255;
};
const drawNum = (n, X, Y) => {
  const s = String(n);
  s.split('').forEach((ch, k) => {
    const g = FONT[ch];
    for (let ry = 0; ry < 5; ry += 1) {
      for (let rx = 0; rx < 3; rx += 1) {
        if (g[ry][rx] === '1') {
          for (let dy = 0; dy < 2; dy += 1) for (let dx = 0; dx < 2; dx += 1) putPx(X + k * 8 + rx * 2 + dx, Y + ry * 2 + dy, 255, 220, 60);
        }
      }
    }
  });
};

bodies.forEach((b, i) => {
  const cx = (i % COLS) * CELL;
  const cy = Math.floor(i / COLS) * CELL;
  const scale = Math.min((CELL - 16) / b.w, (CELL - 24) / b.h, 1.6);
  const dw = Math.round(b.w * scale);
  const dh = Math.round(b.h * scale);
  const ox = cx + Math.round((CELL - dw) / 2);
  const oy = cy + CELL - 6 - dh;
  for (let y = 0; y < dh; y += 1) {
    for (let x = 0; x < dw; x += 1) {
      const srcX = b.x + Math.floor(x / scale);
      const srcY = b.y + Math.floor(y / scale);
      if (A(srcX, srcY) <= 60) continue;
      const si = (srcY * W + srcX) * 4;
      putPx(ox + x, oy + y, data[si], data[si + 1], data[si + 2]);
    }
  }
  drawNum(i, cx + 4, cy + 4);
});

fs.writeFileSync(`${outBase}.montage.png`, PNG.sync.write(mont));
fs.writeFileSync(`${outBase}.blobs.json`, JSON.stringify(bodies, null, 0));
console.log(`Found ${bodies.length} body blobs (of ${blobs.length} total). Wrote ${outBase}.montage.png`);
