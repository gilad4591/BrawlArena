// Slice the 4x3 UI icon sheet into individual PNGs.
//
// The sheet ships on a SOLID MAGENTA (#FF00FF) background, which we chroma-key
// out (soft edge + de-spill) — the same approach as scripts/raw/_gfx.mjs. Each
// icon is then trimmed to its bbox, squared, and padded so they line up in UI.
import { PNG } from 'pngjs';
import fs from 'node:fs';
import path from 'node:path';

const RAW = path.join(process.cwd(), 'scripts', 'raw');
const OUT = path.join(process.cwd(), 'public', 'ui', 'icons');
const COLS = 4;
const ROWS = 3;
const PAD = 10; // transparent margin baked around each icon
const ATRIM = 26; // alpha threshold for the trim bbox

// Reading order, left-to-right, top-to-bottom.
const NAMES = [
  'coin', 'coins', 'daily', 'quests',
  'achievements', 'skins', 'survival', 'arcade',
  'campaign', 'multiplayer', 'settings', 'help',
];

// Soft magenta key: high score when R&B >> G (magenta/pink); alpha = 1 - score.
const MAG_T0 = 6, MAG_T1 = 40;
function magentaAlpha(r, g, b) {
  const score = (Math.min(r, b) - g - MAG_T0) / (MAG_T1 - MAG_T0);
  if (score >= 1) return 0;
  if (score <= 0) return 255;
  const a = Math.round(255 * (1 - score));
  return a < 45 ? 0 : a;
}
// Pull residual pink spill toward neutral on kept pixels.
function despill(r, g, b) {
  const m = (r + b) / 2;
  if (m > g) { const o = Math.round((m - g) * 0.9); return [Math.max(0, r - o), g, Math.max(0, b - o)]; }
  return [r, g, b];
}

const png = PNG.sync.read(fs.readFileSync(path.join(RAW, 'icons_src.png')));
const { width: W, height: H, data } = png;
const cw = Math.floor(W / COLS);
const ch = Math.floor(H / ROWS);
fs.mkdirSync(OUT, { recursive: true });
const rgb = (x, y) => { const i = (y * W + x) * 4; return [data[i], data[i + 1], data[i + 2]]; };

for (let idx = 0; idx < NAMES.length; idx += 1) {
  const cx = (idx % COLS) * cw;
  const cy = Math.floor(idx / COLS) * ch;
  const alpha = new Uint16Array(cw * ch);
  for (let y = 0; y < ch; y += 1) {
    for (let x = 0; x < cw; x += 1) {
      const [r, g, b] = rgb(cx + x, cy + y);
      alpha[y * cw + x] = magentaAlpha(r, g, b);
    }
  }

  // The icon is one big connected blob; any baked-in text label sits below it as
  // separate, smaller blobs. Pick the largest connected component and use only
  // its bbox so the text is discarded automatically.
  const label = new Int32Array(cw * ch).fill(-1);
  const stack = [];
  let best = { count: 0, minX: cw, minY: ch, maxX: 0, maxY: 0 };
  for (let s = 0; s < cw * ch; s += 1) {
    if (label[s] !== -1 || alpha[s] <= ATRIM) continue;
    label[s] = idx;
    stack.length = 0;
    stack.push(s);
    let count = 0, minX = cw, minY = ch, maxX = 0, maxY = 0;
    while (stack.length) {
      const p = stack.pop();
      const px = p % cw, py = (p / cw) | 0;
      count += 1;
      if (px < minX) minX = px;
      if (py < minY) minY = py;
      if (px > maxX) maxX = px;
      if (py > maxY) maxY = py;
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          const nx = px + dx, ny = py + dy;
          if (nx < 0 || ny < 0 || nx >= cw || ny >= ch) continue;
          const np = ny * cw + nx;
          if (label[np] === -1 && alpha[np] > ATRIM) { label[np] = idx; stack.push(np); }
        }
      }
    }
    if (count > best.count) best = { count, minX, minY, maxX, maxY };
  }
  if (best.count === 0) { console.log(`skip ${NAMES[idx]}`); continue; }
  const { minX, minY, maxX, maxY } = best;

  // Square the crop so every icon shares one aspect ratio (centered).
  const bw = maxX - minX + 1;
  const bh = maxY - minY + 1;
  const side = Math.max(bw, bh) + PAD * 2;
  const out = new PNG({ width: side, height: side });
  out.data.fill(0);
  const offX = Math.floor((side - bw) / 2);
  const offY = Math.floor((side - bh) / 2);
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const a = alpha[y * cw + x];
      if (!a) continue;
      let [r, g, b] = rgb(cx + x, cy + y);
      [r, g, b] = despill(r, g, b);
      const oi = ((y - minY + offY) * side + (x - minX + offX)) * 4;
      out.data[oi] = r; out.data[oi + 1] = g; out.data[oi + 2] = b; out.data[oi + 3] = a;
    }
  }
  fs.writeFileSync(path.join(OUT, `${NAMES[idx]}.png`), PNG.sync.write(out));
  console.log(`ui/icons/${NAMES[idx]}.png: ${side}x${side}`);
}
console.log('done');
