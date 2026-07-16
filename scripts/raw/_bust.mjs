/**
 * Crop a single square bust portrait out of a flat-chroma (green/magenta)
 * 1:1 source image. Chroma-keys the background, de-spills the edge, keeps the
 * largest connected component (the bust — drops stray sparkles/labels), then
 * centers it on its centroid into a transparent OUT x OUT square that matches
 * the rest of public/portraits/*.png.
 *
 * Usage: node scripts/raw/_bust.mjs <src.png> <name> <green|magenta>
 */
import fs from 'node:fs';
import { PNG } from 'pngjs';

const [, , src, name, keyA] = process.argv;
if (!src || !name) {
  console.error('Usage: node scripts/raw/_bust.mjs <src.png> <name> <green|magenta>');
  process.exit(1);
}
const KEY = (keyA || 'green').toLowerCase();
const KEY_HIGH = Number(process.env.KEY_HIGH) || 90;
const KEY_LOW = Number(process.env.KEY_LOW) || 28;
const ALPHA_MIN = 40;
const OUT = 420;
const FILL_H = 1.02; // fill the square by bust height (a touch of headroom)
const CAP_W = 1.25; // limit horizontal overflow for wide shoulders
const V_BIAS = 0.52; // 0=top, 1=bottom — keep the head from floating

const metric = (r, g, b) => (KEY === 'green' ? g - Math.max(r, b) : Math.min(r, b) - g);

const p = PNG.sync.read(fs.readFileSync(src));
const { width: W, height: H, data } = p;
const A = (x, y) => data[(y * W + x) * 4 + 3];

for (let i = 0; i < data.length; i += 4) {
  const r = data[i];
  const g = data[i + 1];
  const b = data[i + 2];
  const m = metric(r, g, b);
  if (m >= KEY_HIGH) { data[i + 3] = 0; continue; }
  if (m > KEY_LOW) data[i + 3] = Math.round(255 * (1 - (m - KEY_LOW) / (KEY_HIGH - KEY_LOW)));
  if (m > 0) {
    if (KEY === 'green') data[i + 1] = Math.max(0, g - m * 0.9);
    else { data[i] = Math.max(0, r - m * 0.9); data[i + 2] = Math.max(0, b - m * 0.9); }
  }
}
// De-speckle stray specks / sparkle bits.
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

// Largest connected component = the bust body.
const seen = new Uint8Array(W * H);
let best = null;
for (let sy = 0; sy < H; sy += 1) {
  for (let sx = 0; sx < W; sx += 1) {
    const k0 = sy * W + sx;
    if (seen[k0] || A(sx, sy) <= ALPHA_MIN) continue;
    const stack = [k0];
    seen[k0] = 1;
    let n = 0; let minX = sx; let maxX = sx; let minY = sy; let maxY = sy;
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
        if (nx < 0 || nx >= W || ny < 0 || ny >= H) continue;
        const nk = ny * W + nx;
        if (seen[nk] || A(nx, ny) <= ALPHA_MIN) continue;
        seen[nk] = 1;
        stack.push(nk);
      }
    }
    if (!best || n > best.n) best = { n, x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
  }
}
if (!best) { console.error(`${name}: no body found`); process.exit(1); }

const out = new PNG({ width: OUT, height: OUT });
out.data.fill(0);
const s = Math.min((OUT * FILL_H) / best.h, (OUT * CAP_W) / best.w);
const dw = best.w * s;
const dh = best.h * s;
let sumX = 0; let cnt = 0;
for (let y = best.y; y < best.y + best.h; y += 1) for (let x = best.x; x < best.x + best.w; x += 1) {
  if (A(x, y) > ALPHA_MIN) { sumX += x; cnt += 1; }
}
const cxSrc = cnt ? sumX / cnt : best.x + best.w / 2;
const ox = OUT / 2 - (cxSrc - best.x) * s;
const oy = (OUT - dh) * V_BIAS;
for (let y = 0; y < dh; y += 1) for (let x = 0; x < dw; x += 1) {
  const sxp = best.x + Math.floor(x / s);
  const syp = best.y + Math.floor(y / s);
  if (sxp < 0 || syp < 0 || sxp >= W || syp >= H) continue;
  const si = (syp * W + sxp) * 4;
  if (data[si + 3] <= ALPHA_MIN) continue;
  const dx = Math.floor(ox + x);
  const dy = Math.floor(oy + y);
  if (dx < 0 || dy < 0 || dx >= OUT || dy >= OUT) continue;
  const di = (dy * OUT + dx) * 4;
  out.data[di] = data[si];
  out.data[di + 1] = data[si + 1];
  out.data[di + 2] = data[si + 2];
  out.data[di + 3] = data[si + 3];
}
fs.writeFileSync(`public/portraits/${name}.png`, PNG.sync.write(out));
console.log(`${name}: bust ${best.w}x${best.h} -> portraits/${name}.png`);
