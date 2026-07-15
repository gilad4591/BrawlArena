/**
 * Removes the light "glow/aura" halo that flood-fill key-out leaves around
 * figures (bright, near-neutral pixels hugging the transparent edge). Operates
 * in-place on already-cleaned RGBA PNGs.
 *
 * It only erodes pixels that are (a) opaque, (b) light + low-saturation (white
 * glow / leftover checkerboard), and (c) touching a transparent pixel — peeling
 * the halo ring inward without touching the coloured body interior.
 *
 * Usage: node scripts/dehalo.mjs <file.png> [iterations=6] [lumaMin=150] [satMax=95]
 */
import fs from 'node:fs';
import { PNG } from 'pngjs';

const [, , file, iterArg, lumaArg, satArg] = process.argv;
if (!file) { console.error('Usage: node scripts/dehalo.mjs <file.png> [iters] [lumaMin] [satMax]'); process.exit(1); }
const ITERS = iterArg ? Number(iterArg) : 6;
const LUMA_MIN = lumaArg ? Number(lumaArg) : 150;
const SAT_MAX = satArg ? Number(satArg) : 95;

const p = PNG.sync.read(fs.readFileSync(file));
const { width: W, height: H, data } = p;
const luma = (r, g, b) => 0.299 * r + 0.587 * g + 0.114 * b;
const haloish = (i) => {
  const r = data[i]; const g = data[i + 1]; const b = data[i + 2];
  return luma(r, g, b) >= LUMA_MIN && (Math.max(r, g, b) - Math.min(r, g, b)) <= SAT_MAX;
};
const transparent = (x, y) => {
  if (x < 0 || y < 0 || x >= W || y >= H) return true;
  return data[(y * W + x) * 4 + 3] <= 20;
};

let totalRemoved = 0;
for (let it = 0; it < ITERS; it += 1) {
  const kill = [];
  for (let y = 0; y < H; y += 1) {
    for (let x = 0; x < W; x += 1) {
      const i = (y * W + x) * 4;
      if (data[i + 3] <= 20) continue;
      if (!haloish(i)) continue;
      if (transparent(x - 1, y) || transparent(x + 1, y) || transparent(x, y - 1) || transparent(x, y + 1)) {
        kill.push(i);
      }
    }
  }
  if (!kill.length) break;
  for (const i of kill) data[i + 3] = 0;
  totalRemoved += kill.length;
}
fs.writeFileSync(file, PNG.sync.write(p));
console.log(`${file}: removed ${totalRemoved} halo px`);
