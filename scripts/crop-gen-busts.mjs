import fs from 'node:fs';
import { PNG } from 'pngjs';

const p = PNG.sync.read(fs.readFileSync('art-src/gen_select.png'));
const { width: W, height: H, data } = p;

// grid geometry (matches crop-grid.mjs): 5 cols x 3 rows
const marginX = 44; const gapX = 14; const cardW = (W - marginX * 2 - gapX * 4) / 5; // 176
const colLeft = (c) => marginX + c * (cardW + gapX);
const rowTop = [104, 244, 388];

// only the cells that generated cleanly + match our sprite element/design
const MAP = [
  { id: 'blaze', r: 0, c: 0 },
  { id: 'tide', r: 0, c: 3 },
  { id: 'volt', r: 0, c: 4 },
  { id: 'shade', r: 1, c: 0 },
  { id: 'nox', r: 1, c: 1 },
  { id: 'sylva', r: 1, c: 2 },
  { id: 'golem', r: 2, c: 2 },
  { id: 'aurex', r: 2, c: 3 },
  { id: 'sage', r: 2, c: 4 },
];

const SIDE = 102; // near-square bust; excludes the empty name-pill at the card bottom

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

for (const { id, r, c } of MAP) {
  const cx = Math.round(colLeft(c) + cardW / 2 - SIDE / 2);
  const cy = Math.round(rowTop[r] - 6);
  const png = cropSquare(cx, cy);
  fs.writeFileSync(`public/portraits/${id}.png`, PNG.sync.write(png));
  console.log(`wrote public/portraits/${id}.png from r${r}c${c}`);
}
console.log('kept existing frost.png (its generated cell was broken)');
