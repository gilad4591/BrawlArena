import fs from 'node:fs';
import jpeg from 'jpeg-js';
import { PNG } from 'pngjs';

const file = process.argv[2];
const buf = fs.readFileSync(file);
const isPng = buf.slice(0, 4).toString('hex') === '89504e47';
let W;
let H;
let d;
let useAlpha = false;
if (isPng) {
  const p = PNG.sync.read(buf);
  W = p.width; H = p.height; d = p.data; useAlpha = true;
} else {
  const raw = jpeg.decode(buf, { useTArray: true });
  W = raw.width; H = raw.height; d = raw.data;
}
console.log('format:', isPng ? 'PNG (real alpha)' : 'JPEG (baked checkerboard, no alpha)');
console.log('dims:', `${W}x${H}`);

// content = not-checkerboard: saturated OR dark (JPEG) / opaque (PNG)
const content = (x, y) => {
  const i = (y * W + x) * 4;
  if (useAlpha) return d[i + 3] > 40;
  const r = d[i]; const g = d[i + 1]; const b = d[i + 2];
  const mx = Math.max(r, g, b); const mn = Math.min(r, g, b);
  return (mx - mn) > 28 || mx < 140;
};

// Row occupancy profile to find how many character rows there are
const rowHas = [];
for (let y = 0; y < H; y += 1) {
  let c = 0;
  for (let x = 0; x < W; x += 1) if (content(x, y)) c += 1;
  rowHas.push(c);
}
// find contiguous bands of rows with content
const bands = [];
let start = -1;
for (let y = 0; y < H; y += 1) {
  const on = rowHas[y] > W * 0.01;
  if (on && start < 0) start = y;
  if (!on && start >= 0) { bands.push([start, y - 1]); start = -1; }
}
if (start >= 0) bands.push([start, H - 1]);
console.log('content row-bands:', bands.length);
bands.forEach((b, i) => console.log(`  band ${i}: y ${b[0]}..${b[1]} (h=${b[1] - b[0] + 1})`));

// measure first blob in first band (top-left character)
if (bands.length) {
  const [y0, y1] = bands[0];
  let minx = 1e9; let maxx = 0; let miny = 1e9; let maxy = 0;
  const xLimit = Math.floor(W * 0.16);
  for (let y = y0; y <= y1; y += 1) {
    for (let x = 0; x < xLimit; x += 1) {
      if (content(x, y)) {
        if (x < minx) minx = x; if (x > maxx) maxx = x;
        if (y < miny) miny = y; if (y > maxy) maxy = y;
      }
    }
  }
  console.log('first character bbox:', `${minx},${miny} -> ${maxx},${maxy}  size ${maxx - minx}x${maxy - miny}`);
}
