/**
 * Crops the 8 painted character busts out of the Choose-Your-Fighter mockup
 * screenshot into individual portrait PNGs used by the select screen / HUD.
 *
 * Usage: node scripts/crop-portraits.mjs
 */
import fs from 'node:fs';
import { PNG } from 'pngjs';

const src = PNG.sync.read(fs.readFileSync('art-src/select_mock.png'));
const { width: W } = src;

// Card grid in the 1024x924 mockup.
const colX = [123, 386, 649];
const cardW = 249;
const rowY = [96, 249, 402];
const cardH = 140;
const nameStrip = 44; // bottom area occupied by the name label
const padX = 13;
const padTop = 4;

const layout = [
  ['darryl', 0, 0],
  ['kaito', 0, 1],
  ['rico', 0, 2],
  ['zara', 1, 0],
  ['leon', 1, 1],
  ['maya', 1, 2],
  ['eliza', 2, 0],
  ['ranger', 2, 1],
];

fs.mkdirSync('public/portraits', { recursive: true });

function crop(cx, cy, cw, ch) {
  const out = new PNG({ width: cw, height: ch });
  for (let y = 0; y < ch; y += 1) {
    for (let x = 0; x < cw; x += 1) {
      const si = ((cy + y) * W + (cx + x)) * 4;
      const di = (y * cw + x) * 4;
      out.data[di] = src.data[si];
      out.data[di + 1] = src.data[si + 1];
      out.data[di + 2] = src.data[si + 2];
      out.data[di + 3] = 255;
    }
  }
  return out;
}

// montage for quick verification
const mCols = 4;
const mRows = 2;
const cellW = 130;
const cellH = 130;
const montage = new PNG({ width: cellW * mCols, height: cellH * mRows, fill: true });

layout.forEach(([id, r, c], i) => {
  const cx = colX[c] + padX;
  const cy = rowY[r] + padTop;
  const cw = cardW - padX * 2;
  const ch = cardH - nameStrip - padTop;
  const img = crop(cx, cy, cw, ch);
  fs.writeFileSync(`public/portraits/${id}.png`, PNG.sync.write(img));

  // draw into montage (scaled fit)
  const mc = i % mCols;
  const mr = Math.floor(i / mCols);
  const s = Math.min(cellW / cw, cellH / ch);
  const dw = Math.round(cw * s);
  const dh = Math.round(ch * s);
  const ox = mc * cellW + Math.round((cellW - dw) / 2);
  const oy = mr * cellH + Math.round((cellH - dh) / 2);
  for (let y = 0; y < dh; y += 1) {
    for (let x = 0; x < dw; x += 1) {
      const sx = Math.floor(x / s);
      const sy = Math.floor(y / s);
      const si = (sy * cw + sx) * 4;
      const di = ((oy + y) * montage.width + (ox + x)) * 4;
      montage.data[di] = img.data[si];
      montage.data[di + 1] = img.data[si + 1];
      montage.data[di + 2] = img.data[si + 2];
      montage.data[di + 3] = 255;
    }
  }
});

fs.writeFileSync('art-src/portraits_montage.png', PNG.sync.write(montage));
console.log(`Cropped ${layout.length} portraits into public/portraits/.`);
