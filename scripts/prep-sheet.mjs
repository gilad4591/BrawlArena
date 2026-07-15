/**
 * Removes an AI-generated "fake transparency" checkerboard (or a flat/neutral
 * background) from a sprite sheet and writes a real RGBA PNG with alpha=0 on
 * the background. Preserves dark outlines and colored pixels.
 *
 * Usage:
 *   node scripts/prep-sheet.mjs art-src/gem1.png art-src/gem1_clean.png checker
 *   node scripts/prep-sheet.mjs art-src/gem2.png art-src/gem2_clean.png flat
 *
 * modes:
 *   checker  remove the two neutral grays of a transparency checker (luma ~70..150)
 *   flat     remove the dominant flat neutral background color (auto-sampled)
 */
import fs from 'node:fs';
import { PNG } from 'pngjs';

const [, , inFile, outFile, mode = 'checker', lumaMinArg, lumaMaxArg] = process.argv;
const LUMA_MIN = lumaMinArg ? Number(lumaMinArg) : 66;
const LUMA_MAX = lumaMaxArg ? Number(lumaMaxArg) : 158;
if (!inFile || !outFile) {
  console.error('Usage: node scripts/prep-sheet.mjs <in.png> <out.png> [checker|flat]');
  process.exit(1);
}

const png = PNG.sync.read(fs.readFileSync(inFile));
const { width: W, height: H, data } = png;

const luma = (r, g, b) => 0.299 * r + 0.587 * g + 0.114 * b;
const neutral = (r, g, b, tol = 16) =>
  Math.abs(r - g) <= tol && Math.abs(g - b) <= tol && Math.abs(r - b) <= tol;

let isBg;
if (mode === 'flat') {
  // sample border pixels for dominant bg color
  const samples = [];
  for (let x = 0; x < W; x += 7) {
    samples.push([x, 0], [x, H - 1]);
  }
  for (let y = 0; y < H; y += 7) {
    samples.push([0, y], [W - 1, y]);
  }
  let rs = 0;
  let gs = 0;
  let bs = 0;
  samples.forEach(([x, y]) => {
    const i = (y * W + x) * 4;
    rs += data[i];
    gs += data[i + 1];
    bs += data[i + 2];
  });
  const br = rs / samples.length;
  const bg = gs / samples.length;
  const bb = bs / samples.length;
  console.log(`flat bg ~ rgb(${br | 0},${bg | 0},${bb | 0})`);
  isBg = (r, g, b) => Math.hypot(r - br, g - bg, b - bb) < 40;
} else {
  // checker: two neutral grays in a mid luma band
  isBg = (r, g, b) => neutral(r, g, b, 18) && luma(r, g, b) >= LUMA_MIN && luma(r, g, b) <= LUMA_MAX;
}

let removed = 0;
for (let p = 0; p < W * H; p += 1) {
  const i = p * 4;
  if (isBg(data[i], data[i + 1], data[i + 2])) {
    data[i + 3] = 0;
    removed += 1;
  }
}

fs.writeFileSync(outFile, PNG.sync.write(png));
console.log(`Removed ${removed} bg px (${((removed / (W * H)) * 100).toFixed(1)}%). Wrote ${outFile}`);
