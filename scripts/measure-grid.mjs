import fs from 'node:fs';
import { PNG } from 'pngjs';

const p = PNG.sync.read(fs.readFileSync('art-src/select_hq.png'));
const { width: W, height: H, data } = p;

const lum = (i) => 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];

// Column darkness profile across the top portrait band (row 0): the gaps
// BETWEEN cards are consistently dark top-to-bottom, whereas a portrait has
// bright facial pixels somewhere in the column.
function darkFractionCols(y0, y1, thr = 70) {
  const cols = [];
  for (let x = 0; x < W; x += 1) {
    let dark = 0; let n = 0;
    for (let y = y0; y < y1; y += 1) {
      const i = (y * W + x) * 4;
      if (lum(i) < thr) dark += 1;
      n += 1;
    }
    cols.push(dark / n);
  }
  return cols;
}

// find runs where darkFraction > 0.85 (a gap), return their center x
function gapCenters(cols, minFrac = 0.85, minRun = 4) {
  const centers = [];
  let start = -1;
  for (let x = 0; x <= cols.length; x += 1) {
    const isGap = x < cols.length && cols[x] > minFrac;
    if (isGap && start < 0) start = x;
    else if (!isGap && start >= 0) {
      if (x - start >= minRun) centers.push(Math.round((start + x - 1) / 2));
      start = -1;
    }
  }
  return centers;
}

const cols = darkFractionCols(20, 190);
const centers = gapCenters(cols);
console.log('gap-center columns (row0):', centers.join(', '));

// Row band detection: dark rows between the two portrait rows / name plates.
function darkFractionRows(x0, x1, thr = 70) {
  const rows = [];
  for (let y = 0; y < H; y += 1) {
    let dark = 0; let n = 0;
    for (let x = x0; x < x1; x += 1) {
      const i = (y * W + x) * 4;
      if (lum(i) < thr) dark += 1;
      n += 1;
    }
    rows.push(dark / n);
  }
  return rows;
}
const rows = darkFractionRows(0, W);
// print a compact profile every 8px to eyeball row bands
let prof = '';
for (let y = 0; y < H; y += 8) prof += rows[y] > 0.8 ? '#' : rows[y] > 0.5 ? '+' : '.';
console.log('row darkness (every 8px):');
console.log(prof);
