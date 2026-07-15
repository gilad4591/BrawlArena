/**
 * Renders chosen blob frames anchored bottom-center on a shared baseline so we
 * can confirm feet alignment + pose before committing to frames.json.
 * Usage: node scripts/preview-frames.mjs <clean.png> <blobs.json> "0,4,5,6,7" <out.png> [scale]
 */
import fs from 'node:fs';
import { PNG } from 'pngjs';

const [, , cleanFile, blobsFile, idxStr, outFile, scaleArg] = process.argv;
const S = scaleArg ? Number(scaleArg) : 2;
const png = PNG.sync.read(fs.readFileSync(cleanFile));
const { width: W, data } = png;
const blobs = JSON.parse(fs.readFileSync(blobsFile, 'utf8'));
const idxs = idxStr.split(',').map((s) => Number(s.trim()));

const CELL_W = 150;
const CELL_H = 210;
const baseline = CELL_H - 14;
const cols = idxs.length;
const out = new PNG({ width: cols * CELL_W, height: CELL_H });
out.data.fill(24);
for (let p = 3; p < out.data.length; p += 4) out.data[p] = 255;

const put = (X, Y, r, g, b) => {
  if (X < 0 || Y < 0 || X >= out.width || Y >= out.height) return;
  const i = (Y * out.width + X) * 4;
  out.data[i] = r; out.data[i + 1] = g; out.data[i + 2] = b; out.data[i + 3] = 255;
};
const FONT = {
  0: ['111', '101', '101', '101', '111'], 1: ['010', '110', '010', '010', '111'],
  2: ['111', '001', '111', '100', '111'], 3: ['111', '001', '111', '001', '111'],
  4: ['101', '101', '111', '001', '001'], 5: ['111', '100', '111', '001', '111'],
  6: ['111', '100', '111', '101', '111'], 7: ['111', '001', '010', '010', '010'],
  8: ['111', '101', '111', '101', '111'], 9: ['111', '101', '111', '001', '111'],
};
const drawNum = (n, X, Y) => String(n).split('').forEach((ch, k) => {
  const gg = FONT[ch]; if (!gg) return;
  for (let ry = 0; ry < 5; ry += 1) for (let rx = 0; rx < 3; rx += 1) if (gg[ry][rx] === '1') for (let dy = 0; dy < 2; dy += 1) for (let dx = 0; dx < 2; dx += 1) put(X + k * 8 + rx * 2 + dx, Y + ry * 2 + dy, 255, 220, 60);
});

idxs.forEach((idx, col) => {
  const b = blobs[idx];
  const cx = col * CELL_W + CELL_W / 2;
  const dw = b.w * S; const dh = b.h * S;
  const ox = Math.round(cx - dw / 2);
  const oy = Math.round(baseline - dh);
  for (let y = 0; y < dh; y += 1) {
    for (let x = 0; x < dw; x += 1) {
      const srcX = b.x + Math.floor(x / S);
      const srcY = b.y + Math.floor(y / S);
      const si = (srcY * W + srcX) * 4;
      if (data[si + 3] <= 60) continue;
      put(ox + x, oy + y, data[si], data[si + 1], data[si + 2]);
    }
  }
  // baseline marker + label
  for (let x = col * CELL_W; x < (col + 1) * CELL_W; x += 1) put(x, baseline, 80, 80, 90);
  drawNum(idx, col * CELL_W + 4, 4);
});

fs.writeFileSync(outFile, PNG.sync.write(out));
console.log(`wrote ${outFile}`);
