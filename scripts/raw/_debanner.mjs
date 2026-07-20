// Remove the leftover white "card" frame around the announcement banners.
// The source art had a light rounded panel behind the letters that the magenta
// key didn't touch. We flood-fill inward from the borders through transparent
// AND bright-white pixels, stopping at the letters' dark outline, then trim.
import { PNG } from 'pngjs';
import fs from 'node:fs';
import path from 'node:path';

const DIR = path.join(process.cwd(), 'public', 'ui', 'banners');
const FILES = ['banner_fight.png', 'banner_ko.png', 'banner_perfect.png', 'banner_combo.png'];

const LIGHT = 150; // min channel value considered "white card" background
const PAD = 8;

for (const file of FILES) {
  const p = path.join(DIR, file);
  if (!fs.existsSync(p)) { console.log(`skip (missing) ${file}`); continue; }
  const png = PNG.sync.read(fs.readFileSync(p));
  const { width: W, height: H, data } = png;
  const idx = (x, y) => (y * W + x) * 4;
  const isBg = (x, y) => {
    const i = idx(x, y);
    if (data[i + 3] === 0) return true; // already transparent
    const r = data[i], g = data[i + 1], b = data[i + 2];
    return Math.min(r, g, b) >= LIGHT; // bright/white card pixel
  };

  // BFS flood from every border pixel through background-like pixels.
  const seen = new Uint8Array(W * H);
  const stack = [];
  const push = (x, y) => {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    if (seen[y * W + x]) return;
    seen[y * W + x] = 1;
    stack.push(x, y);
  };
  for (let x = 0; x < W; x++) { push(x, 0); push(x, H - 1); }
  for (let y = 0; y < H; y++) { push(0, y); push(W - 1, y); }
  while (stack.length) {
    const y = stack.pop();
    const x = stack.pop();
    if (!isBg(x, y)) continue; // wall: keep this pixel, don't cross it
    data[idx(x, y) + 3] = 0; // erase background
    push(x + 1, y); push(x - 1, y); push(x, y + 1); push(x, y - 1);
  }

  // Feather: soften any bright pixel that now borders transparency so the cut
  // edge doesn't alias into a hard line.
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = idx(x, y);
      if (data[i + 3] === 0) continue;
      const min = Math.min(data[i], data[i + 1], data[i + 2]);
      if (min < LIGHT) continue;
      let edge = false;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H || data[idx(nx, ny) + 3] === 0) { edge = true; break; }
      }
      if (edge) data[i + 3] = Math.min(data[i + 3], 90);
    }
  }

  // Trim to remaining content and re-pad.
  let minX = W, minY = H, maxX = 0, maxY = 0, found = false;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (data[idx(x, y) + 3] > 16) { found = true; if (x < minX) minX = x; if (y < minY) minY = y; if (x > maxX) maxX = x; if (y > maxY) maxY = y; }
  }
  if (!found) { console.log(`skip (empty) ${file}`); continue; }
  const ow = maxX - minX + 1 + PAD * 2;
  const oh = maxY - minY + 1 + PAD * 2;
  const out = new PNG({ width: ow, height: oh });
  out.data.fill(0);
  for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
    const si = idx(x, y);
    const oi = ((y - minY + PAD) * ow + (x - minX + PAD)) * 4;
    out.data[oi] = data[si]; out.data[oi + 1] = data[si + 1]; out.data[oi + 2] = data[si + 2]; out.data[oi + 3] = data[si + 3];
  }
  fs.writeFileSync(p, PNG.sync.write(out));
  console.log(`${file}: ${W}x${H} -> ${ow}x${oh}`);
}
console.log('done');
