import fs from 'node:fs';
import { PNG } from 'pngjs';

const p = PNG.sync.read(fs.readFileSync('art-src/select_hq.png'));
const { width: W, height: H, data } = p;

// 5 cols x 2 rows, roster order top-left -> bottom-right
const IDS = [
  ['blaze', 'frost', 'tide', 'volt', 'sylva'],
  ['shade', 'nox', 'golem', 'aurex', 'sage'],
];

// --- geometry (tuned to the 1024x625 sheet) ---
const marginX = 8;
const gapX = 10;
const cols = 5;
const cardW = (W - marginX * 2 - gapX * (cols - 1)) / cols;
const rowTop = [14, 318];   // portrait-region top for each row
const SIDE = 178;           // square bust side — must stay < card width (~186) so it never bleeds into the neighbouring card
const install = process.argv.includes('--install');

const colCenter = (c) => marginX + c * (cardW + gapX) + cardW / 2;

function cropSquare(cx, cy) {
  const out = new PNG({ width: SIDE, height: SIDE });
  for (let y = 0; y < SIDE; y += 1) {
    for (let x = 0; x < SIDE; x += 1) {
      const sx = Math.min(W - 1, Math.max(0, cx + x));
      const sy = Math.min(H - 1, Math.max(0, cy + y));
      const si = (sy * W + sx) * 4; const di = (y * SIDE + x) * 4;
      out.data[di] = data[si]; out.data[di + 1] = data[si + 1];
      out.data[di + 2] = data[si + 2]; out.data[di + 3] = 255;
    }
  }
  return out;
}

// verification montage
const CELL = 150; const mont = new PNG({ width: cols * CELL, height: 2 * CELL });
mont.data.fill(12); for (let i = 3; i < mont.data.length; i += 4) mont.data[i] = 255;

IDS.forEach((rowIds, r) => {
  rowIds.forEach((id, c) => {
    const cx = Math.round(colCenter(c) - SIDE / 2);
    const cy = Math.round(rowTop[r]);
    const png = cropSquare(cx, cy);
    if (install) {
      fs.writeFileSync(`public/portraits/${id}.png`, PNG.sync.write(png));
      console.log(`wrote public/portraits/${id}.png`);
    }
    for (let y = 0; y < CELL; y += 1) {
      for (let x = 0; x < CELL; x += 1) {
        const sx = Math.floor((x / CELL) * SIDE); const sy = Math.floor((y / CELL) * SIDE);
        const si = (sy * SIDE + sx) * 4; const di = ((r * CELL + y) * mont.width + (c * CELL + x)) * 4;
        mont.data[di] = png.data[si]; mont.data[di + 1] = png.data[si + 1];
        mont.data[di + 2] = png.data[si + 2]; mont.data[di + 3] = 255;
      }
    }
  });
});
fs.writeFileSync('art-src/hq_contact.png', PNG.sync.write(mont));
console.log(install ? 'installed 10 busts + wrote art-src/hq_contact.png' : 'wrote art-src/hq_contact.png (preview only)');
