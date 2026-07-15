/**
 * Process an AI sprite sheet that uses a FLAT chroma background (magenta or
 * green) laid out as a regular cols x rows grid of poses.
 *
 * Steps:
 *   1. Chroma-key the background with de-spill + feathered edges. Keying on a
 *      saturated colour the character never uses (magenta for cool/blue chars,
 *      green for purple chars) is far cleaner than the old white flood-fill —
 *      no white body parts get eaten and no white halo is left behind.
 *   2. Split into cols*rows cells and tight-crop each pose to its bounding box.
 *   3. Write public/sprites/<name>.png (clean RGBA) + <name>.frames.json.
 *   4. Write scripts/raw/<name>_check.png montage for eyeballing the result.
 *
 * Usage: node scripts/grid-sheet.mjs <src.png> <name> <cols> <rows> <magenta|green>
 */
import fs from 'node:fs';
import { PNG } from 'pngjs';

const [, , src, name, colsA, rowsA, keyA] = process.argv;
if (!src || !name) {
  console.error('Usage: node scripts/grid-sheet.mjs <src.png> <name> <cols> <rows> <magenta|green>');
  process.exit(1);
}
const COLS = Number(colsA) || 4;
const ROWS = Number(rowsA) || 2;
const KEY = (keyA || 'magenta').toLowerCase();

const KEY_HIGH = 100; // metric above this -> fully background
const KEY_LOW = 32; //   metric below this -> fully foreground
const ALPHA_MIN = 40; // opacity considered "solid" for bbox scan

const p = PNG.sync.read(fs.readFileSync(src));
const { width: W, height: H, data } = p;

// "How much like the key colour" — requires the two key channels to BOTH be
// strong so we never mistake a blue (low-red) body pixel for magenta.
const metric = (r, g, b) =>
  KEY === 'green' ? g - Math.max(r, b) : Math.min(r, b) - g;

let cleared = 0;
for (let i = 0; i < data.length; i += 4) {
  const r = data[i];
  const g = data[i + 1];
  const b = data[i + 2];
  const m = metric(r, g, b);
  if (m >= KEY_HIGH) {
    data[i + 3] = 0;
    cleared += 1;
    continue;
  }
  if (m > KEY_LOW) {
    // Feathered edge: partial alpha across the transition band.
    data[i + 3] = Math.round(255 * (1 - (m - KEY_LOW) / (KEY_HIGH - KEY_LOW)));
  }
  // De-spill: pull the leftover chroma tint out of kept/edge pixels.
  if (m > 0) {
    if (KEY === 'green') {
      data[i + 1] = Math.max(0, g - m * 0.9);
    } else {
      data[i] = Math.max(0, r - m * 0.9);
      data[i + 2] = Math.max(0, b - m * 0.9);
    }
  }
}

const A = (x, y) => data[(y * W + x) * 4 + 3];

// De-speckle: strip 1-2px stray lines (cell dividers) and lone specks left by
// the key. A solid pixel with too few solid neighbours can't be real art.
for (let pass = 0; pass < 2; pass += 1) {
  const kill = [];
  for (let y = 0; y < H; y += 1) {
    for (let x = 0; x < W; x += 1) {
      if (A(x, y) <= ALPHA_MIN) continue;
      let n = 0;
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          if ((dx || dy) && x + dx >= 0 && x + dx < W && y + dy >= 0 && y + dy < H && A(x + dx, y + dy) > ALPHA_MIN) n += 1;
        }
      }
      if (n < 3) kill.push((y * W + x) * 4 + 3);
    }
  }
  kill.forEach((i) => { data[i] = 0; });
}

// Per-cell extraction via connected components. The character body is the
// largest component (always kept); nearby effects (fireballs, auras) are kept
// too. Small blobs living in the bottom band of the cell are the baked-in pose
// LABEL text (IDLE/WALK/...) and are dropped, so they never enter the frame.
const cellW = W / COLS;
const cellH = H / ROWS;

// Some sheets draw thin grid/divider lines ON the cell boundaries. Clear a
// narrow band along every internal boundary so a line can't merge with the
// body (characters always sit inside their cell with a margin).
const CLEAR = 3;
for (let c = 1; c < COLS; c += 1) {
  const bx = Math.round(c * cellW);
  for (let y = 0; y < H; y += 1) for (let d = -CLEAR; d <= CLEAR; d += 1) {
    const x = bx + d; if (x >= 0 && x < W) data[(y * W + x) * 4 + 3] = 0;
  }
}
for (let r = 1; r < ROWS; r += 1) {
  const by = Math.round(r * cellH);
  for (let x = 0; x < W; x += 1) for (let d = -CLEAR; d <= CLEAR; d += 1) {
    const y = by + d; if (y >= 0 && y < H) data[(y * W + x) * 4 + 3] = 0;
  }
}

const frames = [];
for (let row = 0; row < ROWS; row += 1) {
  for (let col = 0; col < COLS; col += 1) {
    const x0 = Math.floor(col * cellW);
    const y0 = Math.floor(row * cellH);
    const x1 = Math.floor((col + 1) * cellW);
    const y1 = Math.floor((row + 1) * cellH);
    // Label zone: bottom 26% of the cell (where the text sits).
    const textTop = y0 + cellH * 0.74;
    const seen = new Set();
    const comps = [];
    for (let sy = y0; sy < y1; sy += 1) {
      for (let sx = x0; sx < x1; sx += 1) {
        const k0 = sy * W + sx;
        if (seen.has(k0) || A(sx, sy) <= ALPHA_MIN) continue;
        const stack = [k0];
        seen.add(k0);
        let n = 0;
        let cminX = sx;
        let cmaxX = sx;
        let cminY = sy;
        let cmaxY = sy;
        while (stack.length) {
          const k = stack.pop();
          const x = k % W;
          const y = (k - x) / W;
          n += 1;
          if (x < cminX) cminX = x;
          if (x > cmaxX) cmaxX = x;
          if (y < cminY) cminY = y;
          if (y > cmaxY) cmaxY = y;
          const nb = [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]];
          for (const [nx, ny] of nb) {
            if (nx < x0 || nx >= x1 || ny < y0 || ny >= y1) continue;
            const nk = ny * W + nx;
            if (seen.has(nk) || A(nx, ny) <= ALPHA_MIN) continue;
            seen.add(nk);
            stack.push(nk);
          }
        }
        comps.push({ n, minX: cminX, maxX: cmaxX, minY: cminY, maxY: cmaxY });
      }
    }
    if (!comps.length) { frames.push({ x: x0, y: y0, w: 4, h: 4 }); continue; }
    comps.sort((a, b) => b.n - a.n);
    const body = comps[0];
    // A component is label text if it lives entirely in the bottom band and is
    // short (letter height). Keep everything else (body + effects).
    const isText = (c) => c.minY >= textTop && (c.maxY - c.minY) < cellH * 0.2;
    let minX = body.minX;
    let maxX = body.maxX;
    let minY = body.minY;
    let maxY = body.maxY;
    // A near-full-cell but sparse component is a leftover divider outline.
    const isFrame = (c) =>
      c.maxX - c.minX > cellW * 0.92 && c.maxY - c.minY > cellH * 0.92 &&
      c.n / ((c.maxX - c.minX + 1) * (c.maxY - c.minY + 1)) < 0.2;
    for (const c of comps) {
      if (c === body || isText(c) || isFrame(c) || c.n < 24) continue;
      if (c.minX < minX) minX = c.minX;
      if (c.maxX > maxX) maxX = c.maxX;
      if (c.minY < minY) minY = c.minY;
      if (c.maxY > maxY) maxY = c.maxY;
    }
    frames.push({ x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 });
  }
}

fs.writeFileSync(`public/sprites/${name}.png`, PNG.sync.write(p));
fs.writeFileSync(`public/sprites/${name}.frames.json`, JSON.stringify({ frames }));

// Verification montage: each cropped pose on a dark checkerboard with its index.
const CW = 150;
const CH = 200;
const mont = new PNG({ width: CW * frames.length, height: CH });
for (let i = 0; i < mont.data.length; i += 4) {
  const px = (i / 4) % mont.width;
  const py = Math.floor((i / 4) / mont.width);
  const c = ((px >> 4) + (py >> 4)) & 1 ? 40 : 28;
  mont.data[i] = c; mont.data[i + 1] = c; mont.data[i + 2] = c + 6; mont.data[i + 3] = 255;
}
frames.forEach((f, idx) => {
  const s = Math.min((CW - 12) / f.w, (CH - 24) / f.h);
  const dw = f.w * s;
  const dh = f.h * s;
  const ox = idx * CW + (CW - dw) / 2;
  const oy = CH - 8 - dh;
  for (let y = 0; y < dh; y += 1) {
    for (let x = 0; x < dw; x += 1) {
      const sx = f.x + Math.floor(x / s);
      const sy = f.y + Math.floor(y / s);
      const a = A(sx, sy);
      if (a <= ALPHA_MIN) continue;
      const si = (sy * W + sx) * 4;
      const di = (Math.floor(oy + y) * mont.width + Math.floor(ox + x)) * 4;
      mont.data[di] = data[si];
      mont.data[di + 1] = data[si + 1];
      mont.data[di + 2] = data[si + 2];
      mont.data[di + 3] = 255;
    }
  }
});
fs.writeFileSync(`scripts/raw/${name}_check.png`, PNG.sync.write(mont));

const pct = ((cleared / (W * H)) * 100).toFixed(1);
console.log(`${name}: ${W}x${H} key=${KEY} cleared=${pct}%  frames=${frames.length}`);
console.log('  sizes: ' + frames.map((f) => `${f.w}x${f.h}`).join('  '));
