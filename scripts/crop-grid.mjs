import fs from 'node:fs';
import jpeg from 'jpeg-js';
import { PNG } from 'pngjs';

const src = process.argv[2];
const buf = fs.readFileSync(src);
const isPng = buf.slice(0, 4).toString('hex') === '89504e47';
let W; let H; let data;
if (isPng) { const p = PNG.sync.read(buf); W = p.width; H = p.height; data = p.data; }
else { const r = jpeg.decode(buf, { useTArray: true }); W = r.width; H = r.height; data = r.data; }

// tuned for the 1024x574 generated select screen (5 cols x 3 rows)
const cols = 5; const rows = 3;
const marginX = 44; const gapX = 14;
const cardW = (W - marginX * 2 - gapX * (cols - 1)) / cols;
const rowTop = [104, 244, 388];   // portrait top per row
const portH = 108;                 // portrait height (excludes name plate)
const inset = 12;

const crop = (cx, cy, cw, ch) => {
  const out = new PNG({ width: cw, height: ch });
  for (let y = 0; y < ch; y += 1) {
    for (let x = 0; x < cw; x += 1) {
      const sx = Math.min(W - 1, Math.max(0, cx + x));
      const sy = Math.min(H - 1, Math.max(0, cy + y));
      const si = (sy * W + sx) * 4; const di = (y * cw + x) * 4;
      out.data[di] = data[si]; out.data[di + 1] = data[si + 1]; out.data[di + 2] = data[si + 2]; out.data[di + 3] = 255;
    }
  }
  return out;
};

const CELL = 150; const mont = new PNG({ width: cols * CELL, height: rows * CELL });
mont.data.fill(18); for (let i = 3; i < mont.data.length; i += 4) mont.data[i] = 255;
for (let r = 0; r < rows; r += 1) {
  for (let c = 0; c < cols; c += 1) {
    const cx = Math.round(marginX + c * (cardW + gapX) + inset);
    const cy = rowTop[r];
    const cw = Math.round(cardW - inset * 2);
    const png = crop(cx, cy, cw, portH);
    fs.writeFileSync(`art-src/gen_r${r}c${c}.png`, PNG.sync.write(png));
    for (let y = 0; y < CELL; y += 1) {
      for (let x = 0; x < CELL; x += 1) {
        const sx = Math.floor((x / CELL) * cw); const sy = Math.floor((y / CELL) * portH);
        const si = (sy * cw + sx) * 4; const di = ((r * CELL + y) * mont.width + (c * CELL + x)) * 4;
        mont.data[di] = png.data[si]; mont.data[di + 1] = png.data[si + 1]; mont.data[di + 2] = png.data[si + 2]; mont.data[di + 3] = 255;
      }
    }
  }
}
fs.writeFileSync('art-src/gen_contact.png', PNG.sync.write(mont));
console.log('wrote art-src/gen_contact.png + 15 cells');
