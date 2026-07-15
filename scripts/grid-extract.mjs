/**
 * Grid-extracts a cleaned (transparent-bg) character sheet into per-character
 * animation frames. Columns carry action semantics; rows are animation frames.
 * Each cell is trimmed to its content bbox for clean bottom-center anchoring.
 *
 * Also writes <out>.debug.png with red cell borders so geometry can be verified.
 *
 * Usage: node scripts/grid-extract.mjs art-src/gem1_clean.png public/sprites/roster
 */
import fs from 'node:fs';
import { PNG } from 'pngjs';

const [, , inFile, outBase] = process.argv;
if (!inFile || !outBase) {
  console.error('Usage: node scripts/grid-extract.mjs <cleaned.png> <outBase>');
  process.exit(1);
}

const png = PNG.sync.read(fs.readFileSync(inFile));
const { width: W, height: H, data } = png;
const A = (x, y) => data[(y * W + x) * 4 + 3];

// Layout for the gem1 sheet (1408x768): 4 characters per macro-row, 2 macro-rows.
const COLS = ['idle', 'idleBack', 'punch', 'kick', 'jump'];
const blockXs = [4, 356, 708, 1060];
const colW = 69;
const cellPadX = 2;
// Only the top row of each block aligns reliably across all 8 characters, so we
// take one clean pose per column (liveliness is added in code via a bob).
const macros = [
  { yStart: 45, rowH: 90, rows: 1, names: ['darryl', 'kaito', 'rico', 'zara'] },
  { yStart: 422, rowH: 88, rows: 1, names: ['leon', 'maya', 'eliza', 'ranger'] },
];

const frames = [];
const chars = {};

/**
 * Finds the largest 4-connected blob of opaque pixels inside a cell window and
 * returns its bbox. Ignores small separate blobs such as "Idle/Punch" label
 * text that sits above the sprite.
 */
// Horizontal slack (px) the flood may grow past the seeding cell, so a
// character's extended arm / leg / weapon is captured instead of being clipped
// at the cell edge — but not so far that neighbouring poses get merged in.
const X_MARGIN = 16;

function trim(cx, cy, cw, ch) {
  // Seeds are taken from the cell itself (picks the right pose)...
  const seedX0 = Math.max(0, cx);
  const seedY0 = Math.max(0, cy);
  const seedX1 = Math.min(W, cx + cw);
  const seedY1 = Math.min(H, cy + ch);
  // ...but the blob may spread this far horizontally.
  const fx0 = Math.max(0, cx - X_MARGIN);
  const fx1 = Math.min(W, cx + cw + X_MARGIN);
  const fw = fx1 - fx0;
  const fh = seedY1 - seedY0;
  const seen = new Uint8Array(fw * fh);
  const li = (x, y) => (y - seedY0) * fw + (x - fx0);
  let best = null;
  const stack = [];
  for (let sy = seedY0; sy < seedY1; sy += 1) {
    for (let sx = seedX0; sx < seedX1; sx += 1) {
      if (seen[li(sx, sy)] || A(sx, sy) <= 40) continue;
      let minX = sx;
      let minY = sy;
      let maxX = sx;
      let maxY = sy;
      let count = 0;
      stack.length = 0;
      stack.push(sx, sy);
      seen[li(sx, sy)] = 1;
      while (stack.length) {
        const y = stack.pop();
        const x = stack.pop();
        count += 1;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
        const nb = [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]];
        for (const [nx, ny] of nb) {
          if (nx < fx0 || nx >= fx1 || ny < seedY0 || ny >= seedY1) continue;
          const idx = li(nx, ny);
          if (seen[idx] || A(nx, ny) <= 40) continue;
          seen[idx] = 1;
          stack.push(nx, ny);
        }
      }
      if (!best || count > best.count) {
        best = { count, x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
      }
    }
  }
  if (!best || best.count < 150) return null;
  return { x: best.x, y: best.y, w: best.w, h: best.h };
}

for (const macro of macros) {
  macro.names.forEach((name, bi) => {
    const bx = blockXs[bi];
    const anim = { idle: [], idleBack: [], punch: [], kick: [], jump: [] };
    for (let col = 0; col < COLS.length; col += 1) {
      for (let row = 0; row < macro.rows; row += 1) {
        const cx = bx + col * colW + cellPadX;
        const cy = macro.yStart + row * macro.rowH;
        const box = trim(cx, cy, colW - cellPadX * 2, macro.rowH - 2);
        if (!box) continue;
        const index = frames.length;
        frames.push(box);
        anim[COLS[col]].push(index);
      }
    }
    chars[name] = anim;
  });
}

// debug overlay
const dbg = new PNG({ width: W, height: H });
data.copy(dbg.data);
frames.forEach((f) => {
  for (let x = f.x; x < f.x + f.w; x += 1) {
    for (const yy of [f.y, f.y + f.h - 1]) {
      const i = (yy * W + x) * 4;
      dbg.data[i] = 255; dbg.data[i + 1] = 0; dbg.data[i + 2] = 0; dbg.data[i + 3] = 255;
    }
  }
  for (let y = f.y; y < f.y + f.h; y += 1) {
    for (const xx of [f.x, f.x + f.w - 1]) {
      const i = (y * W + xx) * 4;
      dbg.data[i] = 255; dbg.data[i + 1] = 0; dbg.data[i + 2] = 0; dbg.data[i + 3] = 255;
    }
  }
});
fs.writeFileSync('art-src/grid-debug.png', PNG.sync.write(dbg));

// copy cleaned image to output png
fs.copyFileSync(inFile, `${outBase}.png`);
fs.writeFileSync(
  `${outBase}.frames.json`,
  JSON.stringify({ image: `${outBase.split('/').pop()}.png`, sheetW: W, sheetH: H, frames, chars }, null, 2),
);
console.log(`Extracted ${frames.length} frames for ${Object.keys(chars).length} characters.`);
Object.entries(chars).forEach(([n, a]) =>
  console.log(`  ${n}: idle ${a.idle.length}, punch ${a.punch.length}, kick ${a.kick.length}, jump ${a.jump.length}`),
);
