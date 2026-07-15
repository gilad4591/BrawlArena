import fs from 'node:fs';
import { PNG } from 'pngjs';

const FILE = { blaze: 'fire' };
const items = [
  ['blaze', 0], ['frost', 0], ['tide', 0], ['sylva', 0], ['aurex', 0],
  ['grunt', 0], ['darkmage', 0], ['darkknight', 1],
];
const CELL = 170; const cols = 4; const rows = Math.ceil(items.length / cols);
const out = new PNG({ width: cols * CELL, height: rows * CELL });
// magenta background
for (let i = 0; i < out.data.length; i += 4) { out.data[i] = 255; out.data[i + 1] = 0; out.data[i + 2] = 255; out.data[i + 3] = 255; }

items.forEach(([id, fi], idx) => {
  const fn = FILE[id] || id;
  const p = PNG.sync.read(fs.readFileSync(`public/sprites/${fn}.png`));
  const meta = JSON.parse(fs.readFileSync(`public/sprites/${fn}.frames.json`, 'utf8'));
  const f = meta.frames[fi];
  const r = Math.floor(idx / cols); const c = idx % cols;
  const S = Math.max(f.w, f.h);
  const scale = (CELL - 12) / S;
  const ox = c * CELL + (CELL - f.w * scale) / 2;
  const oy = r * CELL + (CELL - f.h * scale) / 2;
  for (let y = 0; y < f.h * scale; y += 1) {
    for (let x = 0; x < f.w * scale; x += 1) {
      const sx = f.x + Math.floor(x / scale); const sy = f.y + Math.floor(y / scale);
      const si = (sy * p.width + sx) * 4;
      const a = p.data[si + 3];
      if (a < 20) continue; // transparent -> keep magenta
      const X = Math.round(ox + x); const Y = Math.round(oy + y);
      if (X < 0 || Y < 0 || X >= out.width || Y >= out.height) continue;
      const di = (Y * out.width + X) * 4;
      out.data[di] = p.data[si]; out.data[di + 1] = p.data[si + 1]; out.data[di + 2] = p.data[si + 2]; out.data[di + 3] = 255;
    }
  }
});
fs.writeFileSync('art-src/diag_bg.png', PNG.sync.write(out));
console.log('wrote art-src/diag_bg.png');
