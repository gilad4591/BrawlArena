/**
 * Removes the light "fake transparency" checkerboard from an AI sprite sheet and
 * writes a real RGBA PNG. Accepts JPEG or PNG input.
 *
 * Strategy: flood-fill from the sheet borders through "background-like" pixels
 * (near-neutral gray AND fairly bright). This clears the checkerboard plus its
 * anti-aliased halo, while leaving light neutral pixels *inside* the character
 * (not border-connected) untouched.
 *
 * Usage: node scripts/keyout.mjs <in.(jpg|png)> <out.png> [lumaMin] [tol]
 */
import fs from 'node:fs';
import jpeg from 'jpeg-js';
import { PNG } from 'pngjs';

const [, , inFile, outFile, lumaMinArg, tolArg] = process.argv;
if (!inFile || !outFile) {
  console.error('Usage: node scripts/keyout.mjs <in> <out.png> [lumaMin=165] [tol=24]');
  process.exit(1);
}
const LUMA_MIN = lumaMinArg ? Number(lumaMinArg) : 165;
const TOL = tolArg ? Number(tolArg) : 24;

const buf = fs.readFileSync(inFile);
const isPng = buf.slice(0, 4).toString('hex') === '89504e47';
let W;
let H;
let src;
if (isPng) {
  const p = PNG.sync.read(buf);
  W = p.width; H = p.height; src = p.data;
} else {
  const raw = jpeg.decode(buf, { useTArray: true });
  W = raw.width; H = raw.height; src = raw.data;
}

const out = new PNG({ width: W, height: H });
out.data.set(src);

const luma = (r, g, b) => 0.299 * r + 0.587 * g + 0.114 * b;
const bgLike = (i) => {
  const r = src[i]; const g = src[i + 1]; const b = src[i + 2];
  const mx = Math.max(r, g, b); const mn = Math.min(r, g, b);
  return (mx - mn) <= TOL && luma(r, g, b) >= LUMA_MIN;
};

// Flood-fill from every border pixel through bg-like pixels.
const seen = new Uint8Array(W * H);
const stack = [];
const pushIf = (x, y) => {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const p = y * W + x;
  if (seen[p]) return;
  if (!bgLike(p * 4)) return;
  seen[p] = 1;
  stack.push(x, y);
};
for (let x = 0; x < W; x += 1) { pushIf(x, 0); pushIf(x, H - 1); }
for (let y = 0; y < H; y += 1) { pushIf(0, y); pushIf(W - 1, y); }
while (stack.length) {
  const y = stack.pop();
  const x = stack.pop();
  pushIf(x + 1, y); pushIf(x - 1, y); pushIf(x, y + 1); pushIf(x, y - 1);
  pushIf(x + 1, y + 1); pushIf(x - 1, y - 1); pushIf(x + 1, y - 1); pushIf(x - 1, y + 1);
}

let cleared = 0;
for (let p = 0; p < W * H; p += 1) {
  if (seen[p]) { out.data[p * 4 + 3] = 0; cleared += 1; } else out.data[p * 4 + 3] = 255;
}

fs.writeFileSync(outFile, PNG.sync.write(out));
console.log(`Cleared ${cleared} bg px (${((cleared / (W * H)) * 100).toFixed(1)}%). Wrote ${outFile} (${W}x${H})`);
