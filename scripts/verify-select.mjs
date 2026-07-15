import fs from 'node:fs';
import { PNG } from 'pngjs';

const PAINTED = ['blaze', 'frost', 'shade', 'volt', 'golem', 'tide', 'nox', 'aurex', 'sylva', 'sage'];
const FILE = { blaze: 'fire' };
const order = ['blaze', 'frost', 'tide', 'volt', 'sylva', 'shade', 'nox', 'golem', 'aurex', 'sage'];

const CELL = 150; const cols = 5; const rows = 2;
const out = new PNG({ width: cols * CELL, height: rows * CELL });
out.data.fill(24); for (let i = 3; i < out.data.length; i += 4) out.data[i] = 255;
const put = (X, Y, r, g, b) => { if (X < 0 || Y < 0 || X >= out.width || Y >= out.height) return; const i = (Y * out.width + X) * 4; out.data[i] = r; out.data[i + 1] = g; out.data[i + 2] = b; out.data[i + 3] = 255; };

function portraitSrc(id) {
  if (PAINTED.includes(id)) {
    const p = PNG.sync.read(fs.readFileSync(`public/portraits/${id}.png`));
    return { png: p, box: { x: 0, y: 0, w: p.width, h: p.height } };
  }
  const fn = FILE[id] || id;
  const p = PNG.sync.read(fs.readFileSync(`public/sprites/${fn}.png`));
  const meta = JSON.parse(fs.readFileSync(`public/sprites/${fn}.frames.json`, 'utf8'));
  const f = meta.frames[0];
  // upper ~72% of the idle frame = head + torso bust
  return { png: p, box: { x: f.x, y: f.y, w: f.w, h: Math.round(f.h * 0.72) } };
}

order.forEach((id, idx) => {
  const r = Math.floor(idx / cols); const c = idx % cols;
  const { png, box } = portraitSrc(id);
  const S = 122; const ox = c * CELL + (CELL - S) / 2; const oy = r * CELL + 8;
  const scale = Math.max(S / box.w, S / box.h);
  for (let y = 0; y < S; y += 1) {
    for (let x = 0; x < S; x += 1) {
      const sx = box.x + Math.floor((x - (S - box.w * scale) / 2) / scale);
      const sy = box.y + Math.floor((y - (S - box.h * scale) / 2) / scale);
      if (sx < box.x || sy < box.y || sx >= box.x + box.w || sy >= box.y + box.h) continue;
      const si = (sy * png.width + sx) * 4;
      if (png.data[si + 3] <= 40) { put(ox + x, oy + y, 12, 15, 28); continue; }
      put(ox + x, oy + y, png.data[si], png.data[si + 1], png.data[si + 2]);
    }
  }
});
fs.writeFileSync('art-src/select_verify.png', PNG.sync.write(out));
console.log('wrote art-src/select_verify.png  order:', order.join(', '));
