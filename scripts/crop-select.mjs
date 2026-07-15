import fs from 'node:fs';
import jpeg from 'jpeg-js';
import { PNG } from 'pngjs';

const src = process.argv[2];
const raw = jpeg.decode(fs.readFileSync(src), { useTArray: true });
const { width: W, height: H, data } = raw;
const at = (x, y) => { const i = (y * W + x) * 4; return [data[i], data[i + 1], data[i + 2]]; };

// 5 columns x 2 rows. Portrait region of each card (excludes the name plate).
const COLS = 5; const ROWS = 2;
const marginX = 18; const gapX = 12;
const cardW = (W - marginX * 2 - gapX * (COLS - 1)) / COLS; // ~184
const rowTop = [46, 300];          // y of portrait top per row
const portraitH = 196;             // portrait height (before name plate)
const inset = 10;                  // trim the card frame border

const crop = (cx, cy, cw, ch) => {
  const out = new PNG({ width: cw, height: ch });
  for (let y = 0; y < ch; y += 1) {
    for (let x = 0; x < cw; x += 1) {
      const [r, g, b] = at(Math.min(W - 1, cx + x), Math.min(H - 1, cy + y));
      const o = (y * cw + x) * 4;
      out.data[o] = r; out.data[o + 1] = g; out.data[o + 2] = b; out.data[o + 3] = 255;
    }
  }
  return out;
};

// Contact montage of all 10 to verify geometry.
const CELL = 150; const mont = new PNG({ width: COLS * CELL, height: ROWS * CELL });
mont.data.fill(20); for (let i = 3; i < mont.data.length; i += 4) mont.data[i] = 255;

const cells = [];
for (let r = 0; r < ROWS; r += 1) {
  for (let c = 0; c < COLS; c += 1) {
    const cx = Math.round(marginX + c * (cardW + gapX) + inset);
    const cy = rowTop[r] + inset;
    const cw = Math.round(cardW - inset * 2);
    const ch = portraitH - inset;
    const png = crop(cx, cy, cw, ch);
    const name = `art-src/select_r${r}c${c}.png`;
    fs.writeFileSync(name, PNG.sync.write(png));
    cells.push(name);
    // downscale into montage cell
    for (let y = 0; y < CELL; y += 1) {
      for (let x = 0; x < CELL; x += 1) {
        const sx = Math.floor((x / CELL) * cw); const sy = Math.floor((y / CELL) * ch);
        const si = (sy * cw + sx) * 4; const di = ((r * CELL + y) * mont.width + (c * CELL + x)) * 4;
        mont.data[di] = png.data[si]; mont.data[di + 1] = png.data[si + 1];
        mont.data[di + 2] = png.data[si + 2]; mont.data[di + 3] = 255;
      }
    }
  }
}
fs.writeFileSync('art-src/select_contact.png', PNG.sync.write(mont));
console.log('wrote art-src/select_contact.png and', cells.length, 'cells');
