/**
 * Crop character-select PORTRAIT busts out of a flat-magenta bust sheet.
 *
 * Handles sheets that have a baked-in name label under each bust: within every
 * grid cell we keep only the TOP connected band (the bust) and stop at the
 * magenta gap before the text, so the name never ends up in the portrait.
 *
 * Output: public/portraits/<name>.png — a square transparent PNG with the bust
 * centered (drawPaintedPortrait cover-fits it into the select card).
 *
 * Usage:
 *   node scripts/crop-busts.mjs <src.png> <cols> <rows> <name1,name2,...>
 *   (use "skip" for an empty cell)
 */
import fs from 'node:fs';
import { PNG } from 'pngjs';

const [, , src, colsA, rowsA, namesA] = process.argv;
const COLS = Number(colsA);
const ROWS = Number(rowsA);
const NAMES = (namesA || '').split(',').map((s) => s.trim());

const KEY_HIGH = 100;
const KEY_LOW = 32;
const ALPHA_MIN = 40;
const OUT = 420; // square portrait size
const FILL = 0.9; // bust occupies this fraction of the square
const MIN_ROW = 6; // opaque px in a row to count as "bust"
const MIN_COL = 3;
const GAP_ROWS = 10; // empty-row run that separates bust from the text below

const p = PNG.sync.read(fs.readFileSync(src));
const { width: W, height: H, data } = p;
const A = (x, y) => data[(y * W + x) * 4 + 3];

// Magenta chroma-key with de-spill (min(R,B)-G keeps blue/purple bodies safe).
for (let i = 0; i < data.length; i += 4) {
  const r = data[i];
  const g = data[i + 1];
  const b = data[i + 2];
  const m = Math.min(r, b) - g;
  if (m >= KEY_HIGH) { data[i + 3] = 0; continue; }
  if (m > KEY_LOW) data[i + 3] = Math.round(255 * (1 - (m - KEY_LOW) / (KEY_HIGH - KEY_LOW)));
  if (m > 0) { data[i] = Math.max(0, r - m * 0.9); data[i + 2] = Math.max(0, b - m * 0.9); }
}
// De-speckle stray divider lines.
for (let pass = 0; pass < 2; pass += 1) {
  const kill = [];
  for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) {
    if (A(x, y) <= ALPHA_MIN) continue;
    let n = 0;
    for (let dy = -1; dy <= 1; dy += 1) for (let dx = -1; dx <= 1; dx += 1)
      if ((dx || dy) && x + dx >= 0 && x + dx < W && y + dy >= 0 && y + dy < H && A(x + dx, y + dy) > ALPHA_MIN) n += 1;
    if (n < 3) kill.push((y * W + x) * 4 + 3);
  }
  kill.forEach((i) => { data[i] = 0; });
}

const cellW = W / COLS;
const cellH = H / ROWS;

// Largest connected component of opaque pixels within a cell = the bust body.
// This cleanly drops the small baked-in name-text letters (separate blobs).
function cropCell(col, row) {
  const x0 = Math.floor(col * cellW);
  const y0 = Math.floor(row * cellH);
  const x1 = Math.floor((col + 1) * cellW);
  const y1 = Math.floor((row + 1) * cellH);
  const seen = new Set();
  let best = null;
  for (let sy = y0; sy < y1; sy += 1) {
    for (let sx = x0; sx < x1; sx += 1) {
      const key0 = sy * W + sx;
      if (seen.has(key0) || A(sx, sy) <= ALPHA_MIN) continue;
      // Flood fill this component (4-neighbour is enough for solid busts).
      const stack = [key0];
      seen.add(key0);
      let n = 0;
      let minX = sx;
      let maxX = sx;
      let minY = sy;
      let maxY = sy;
      while (stack.length) {
        const k = stack.pop();
        const x = k % W;
        const y = (k - x) / W;
        n += 1;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
        const nb = [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]];
        for (const [nx, ny] of nb) {
          if (nx < x0 || nx >= x1 || ny < y0 || ny >= y1) continue;
          const nk = ny * W + nx;
          if (seen.has(nk) || A(nx, ny) <= ALPHA_MIN) continue;
          seen.add(nk);
          stack.push(nk);
        }
      }
      if (!best || n > best.n) best = { n, x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
    }
  }
  return best;
}

for (let row = 0; row < ROWS; row += 1) {
  for (let col = 0; col < COLS; col += 1) {
    const idx = row * COLS + col;
    const name = NAMES[idx];
    if (!name || name === 'skip') continue;
    const box = cropCell(col, row);
    if (!box) { console.log(`${name}: EMPTY cell`); continue; }
    const out = new PNG({ width: OUT, height: OUT });
    out.data.fill(0);
    const s = (OUT * FILL) / Math.max(box.w, box.h);
    const dw = box.w * s;
    const dh = box.h * s;
    const ox = (OUT - dw) / 2;
    const oy = (OUT - dh) / 2;
    for (let y = 0; y < dh; y += 1) for (let x = 0; x < dw; x += 1) {
      const sx = box.x + Math.floor(x / s);
      const sy = box.y + Math.floor(y / s);
      if (sx < 0 || sy < 0 || sx >= W || sy >= H) continue;
      const si = (sy * W + sx) * 4;
      if (data[si + 3] <= ALPHA_MIN) continue;
      const di = (Math.floor(oy + y) * OUT + Math.floor(ox + x)) * 4;
      out.data[di] = data[si];
      out.data[di + 1] = data[si + 1];
      out.data[di + 2] = data[si + 2];
      out.data[di + 3] = data[si + 3];
    }
    fs.writeFileSync(`public/portraits/${name}.png`, PNG.sync.write(out));
    console.log(`${name}: bust ${box.w}x${box.h} -> portraits/${name}.png`);
  }
}
