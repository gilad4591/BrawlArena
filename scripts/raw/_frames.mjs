// Slice the 3x2 themed portrait-FRAME sheet into individual PNGs.
// Ships on solid MAGENTA (#FF00FF) with hollow magenta centers, so keying magenta
// leaves a transparent middle (the character shows through the frame).
import { PNG } from 'pngjs';
import fs from 'node:fs';
import path from 'node:path';

const RAW = path.join(process.cwd(), 'scripts', 'raw');
const OUT = path.join(process.cwd(), 'public', 'ui', 'frames');
const COLS = 3;
const ROWS = 2;
const PAD = 6;
const ATRIM = 40;
const NAMES = ['inferno', 'frost', 'storm', 'toxic', 'divine', 'void'];

const MAG_T0 = 8, MAG_T1 = 46;
function magentaAlpha(r, g, b) {
  const score = (Math.min(r, b) - g - MAG_T0) / (MAG_T1 - MAG_T0);
  if (score >= 1) return 0;
  if (score <= 0) return 255;
  const a = Math.round(255 * (1 - score));
  return a < 40 ? 0 : a;
}
function despill(r, g, b) {
  const m = (r + b) / 2;
  if (m > g) { const o = Math.round((m - g) * 0.85); return [Math.max(0, r - o), g, Math.max(0, b - o)]; }
  return [r, g, b];
}

const png = PNG.sync.read(fs.readFileSync(path.join(RAW, 'frames_src.png')));
const { width: W, height: H, data } = png;
const cw = Math.floor(W / COLS);
const ch = Math.floor(H / ROWS);
fs.mkdirSync(OUT, { recursive: true });
const rgb = (x, y) => { const i = (y * W + x) * 4; return [data[i], data[i + 1], data[i + 2]]; };

for (let idx = 0; idx < NAMES.length; idx += 1) {
  const ox = (idx % COLS) * cw;
  const oy = Math.floor(idx / COLS) * ch;
  const alpha = new Uint16Array(cw * ch);
  let minX = cw, minY = ch, maxX = 0, maxY = 0, found = false;
  for (let y = 0; y < ch; y += 1) {
    for (let x = 0; x < cw; x += 1) {
      const [r, g, b] = rgb(ox + x, oy + y);
      const a = magentaAlpha(r, g, b);
      alpha[y * cw + x] = a;
      if (a > ATRIM) {
        found = true;
        if (x < minX) minX = x; if (y < minY) minY = y;
        if (x > maxX) maxX = x; if (y > maxY) maxY = y;
      }
    }
  }
  if (!found) { console.log(`skip ${NAMES[idx]}`); continue; }
  const bw = maxX - minX + 1;
  const bh = maxY - minY + 1;
  const out = new PNG({ width: bw + PAD * 2, height: bh + PAD * 2 });
  out.data.fill(0);
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const a = alpha[y * cw + x];
      if (!a) continue;
      let [r, g, b] = rgb(ox + x, oy + y);
      [r, g, b] = despill(r, g, b);
      const oi = ((y - minY + PAD) * (bw + PAD * 2) + (x - minX + PAD)) * 4;
      out.data[oi] = r; out.data[oi + 1] = g; out.data[oi + 2] = b; out.data[oi + 3] = a;
    }
  }
  fs.writeFileSync(path.join(OUT, `frame_${NAMES[idx]}.png`), PNG.sync.write(out));
  console.log(`ui/frames/frame_${NAMES[idx]}.png: ${bw + PAD * 2}x${bh + PAD * 2}`);
}
console.log('done');
