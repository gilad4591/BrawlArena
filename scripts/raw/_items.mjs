// Extract the 8 item icons from a 4x2 magenta-background sheet into transparent PNGs.
import { PNG } from 'pngjs';
import fs from 'node:fs';
import path from 'node:path';

const SRC = path.join(process.cwd(), 'scripts', 'raw', 'items_src.png');
const OUT = path.join(process.cwd(), 'public', 'ui', 'items');
fs.mkdirSync(OUT, { recursive: true });

// row-major names (map to item / powerup ids in items.js)
const NAMES = [
  'potion', 'energy', 'power', 'shield',
  'bat', 'sword', 'rock', 'crate',
];
const COLS = 4;
const ROWS = 2;
const PAD = 6; // px of transparent padding around trimmed content

function isMagenta(r, g, b) {
  // background is a bright pink/magenta: high R, high B, comparatively low G
  return r > 150 && b > 110 && g < 120 && (r - g) > 60 && (b - g) > 20;
}

const buf = fs.readFileSync(SRC);
const png = PNG.sync.read(buf);
const { width: W, height: H, data } = png;
const cw = Math.floor(W / COLS);
const ch = Math.floor(H / ROWS);

function px(x, y) {
  const i = (y * W + x) * 4;
  return [data[i], data[i + 1], data[i + 2], data[i + 3]];
}

for (let idx = 0; idx < NAMES.length; idx++) {
  const cx = (idx % COLS) * cw;
  const cy = Math.floor(idx / COLS) * ch;
  // build mask + bounding box
  let minX = cw, minY = ch, maxX = 0, maxY = 0, found = false;
  const alpha = new Uint8Array(cw * ch);
  for (let y = 0; y < ch; y++) {
    for (let x = 0; x < cw; x++) {
      const [r, g, b] = px(cx + x, cy + y);
      let a = 255;
      if (isMagenta(r, g, b)) {
        a = 0;
      } else {
        // soft edge de-spill: near-magenta partial transparency
        const d = Math.min(Math.abs(r - 238), 255) + Math.abs(b - 224) - g;
        if (r > 130 && b > 100 && g < 150 && (r - g) > 30) a = 90;
      }
      alpha[y * cw + x] = a;
      if (a > 30) {
        found = true;
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (!found) { console.log(`skip ${NAMES[idx]} (empty)`); continue; }
  const ow = maxX - minX + 1 + PAD * 2;
  const oh = maxY - minY + 1 + PAD * 2;
  const out = new PNG({ width: ow, height: oh });
  out.data.fill(0);
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const a = alpha[y * cw + x];
      if (a <= 0) continue;
      const [r, g, b] = px(cx + x, cy + y);
      const oi = ((y - minY + PAD) * ow + (x - minX + PAD)) * 4;
      out.data[oi] = r;
      out.data[oi + 1] = g;
      out.data[oi + 2] = b;
      out.data[oi + 3] = a;
    }
  }
  const file = path.join(OUT, `${NAMES[idx]}.png`);
  fs.writeFileSync(file, PNG.sync.write(out));
  console.log(`${NAMES[idx]}: ${ow}x${oh}`);
}

// share the red bottle for the hp powerup, green for energy already handled
fs.copyFileSync(path.join(OUT, 'potion.png'), path.join(OUT, 'hp.png'));
console.log('hp: copied from potion');
console.log('done ->', OUT);
