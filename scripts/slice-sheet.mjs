/**
 * Auto-slices a sprite sheet with sprites on a (near) black background using
 * connected-component labeling (flood fill). Each separated blob becomes one
 * frame box. Blobs are then grouped into rows and ordered left-to-right.
 *
 * Usage:  node scripts/slice-sheet.mjs public/sprites/volt.png [lumaBg] [minArea]
 *
 * Writes <name>.frames.json:
 *   { image, sheetW, sheetH, frames: [ {x,y,w,h}, ... ], rows: [count,...] }
 */
import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';

const file = process.argv[2];
if (!file) {
  console.error('Usage: node scripts/slice-sheet.mjs <sheet.png> [lumaBg] [minArea]');
  process.exit(1);
}
const LUMA_BG = Number(process.argv[3] || 26);
const MIN_AREA = Number(process.argv[4] || 130);
const MERGE_DIST = Number(process.argv[5] ?? 0); // 0 = no merge

const png = PNG.sync.read(fs.readFileSync(file));
const { width: W, height: H, data } = png;

const mask = new Uint8Array(W * H);
for (let y = 0; y < H; y += 1) {
  for (let x = 0; x < W; x += 1) {
    const i = (y * W + x) * 4;
    const a = data[i + 3];
    const luma = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    mask[y * W + x] = a >= 24 && luma >= LUMA_BG ? 1 : 0;
  }
}

// 8-connected flood fill
const labels = new Int32Array(W * H).fill(0);
let next = 0;
const boxes = [];
const stack = [];
for (let s = 0; s < W * H; s += 1) {
  if (!mask[s] || labels[s]) continue;
  next += 1;
  let minX = W;
  let minY = H;
  let maxX = 0;
  let maxY = 0;
  let area = 0;
  stack.push(s);
  labels[s] = next;
  while (stack.length) {
    const p = stack.pop();
    const px = p % W;
    const py = (p / W) | 0;
    area += 1;
    if (px < minX) minX = px;
    if (px > maxX) maxX = px;
    if (py < minY) minY = py;
    if (py > maxY) maxY = py;
    for (let dy = -1; dy <= 1; dy += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        if (!dx && !dy) continue;
        const nx = px + dx;
        const ny = py + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const np = ny * W + nx;
        if (mask[np] && !labels[np]) {
          labels[np] = next;
          stack.push(np);
        }
      }
    }
  }
  if (area >= MIN_AREA) {
    boxes.push({ x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1, area });
  }
}

// merge boxes that are very close (detached hair tips, effects near body)
function gap(a, b) {
  const dx = Math.max(0, Math.max(a.x - (b.x + b.w), b.x - (a.x + a.w)));
  const dy = Math.max(0, Math.max(a.y - (b.y + b.h), b.y - (a.y + a.h)));
  return Math.max(dx, dy);
}
let merged = true;
while (merged) {
  merged = false;
  for (let i = 0; i < boxes.length; i += 1) {
    for (let j = i + 1; j < boxes.length; j += 1) {
      if (gap(boxes[i], boxes[j]) < MERGE_DIST) {
        const a = boxes[i];
        const b = boxes[j];
        const nx = Math.min(a.x, b.x);
        const ny = Math.min(a.y, b.y);
        const nX = Math.max(a.x + a.w, b.x + b.w);
        const nY = Math.max(a.y + a.h, b.y + b.h);
        a.x = nx; a.y = ny; a.w = nX - nx; a.h = nY - ny; a.area += b.area;
        boxes.splice(j, 1);
        merged = true;
        break;
      }
    }
    if (merged) break;
  }
}

// group into rows by vertical overlap, order rows top->bottom, cells left->right
boxes.sort((a, b) => a.y - b.y);
const rows = [];
for (const b of boxes) {
  let row = rows.find((r) => b.y < r.y + r.h * 0.6 && b.y + b.h > r.y + r.h * 0.4);
  if (!row) {
    row = { y: b.y, h: b.h, items: [] };
    rows.push(row);
  }
  row.items.push(b);
  row.y = Math.min(row.y, b.y);
  row.h = Math.max(row.h, b.h);
}
rows.forEach((r) => r.items.sort((a, b) => a.x - b.x));

const frames = [];
const rowCounts = [];
rows.forEach((r) => {
  rowCounts.push(r.items.length);
  r.items.forEach((b) => frames.push({ x: b.x, y: b.y, w: b.w, h: b.h }));
});

const out = { image: path.basename(file), sheetW: W, sheetH: H, frames, rows: rowCounts };
const jsonPath = file.replace(/\.png$/i, '.frames.json');
fs.writeFileSync(jsonPath, JSON.stringify(out, null, 2));
console.log(`Detected ${frames.length} frames (${W}x${H}). Rows: ${rowCounts.join(', ')}`);
console.log(`Wrote ${jsonPath}`);
