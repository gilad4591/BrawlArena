import fs from 'node:fs';
import { PNG } from 'pngjs';

// [spriteFile, idleFrame, weight, sizeMul, defScale]  — mirrors enemies.js + SPRITE_DEFS
const CH = {
  'player(tide)': ['tide', 0, 1.05, 1, 0.95],
  bruiser: ['grunt', 0, 1.5, 0.9, 0.95],
  mage: ['darkmage', 0, 0.8, 0.9, 0.95],
  superbruiser: ['grunt', 0, 1.8, 1.05, 0.95],
  leader: ['darkknight', 1, 1.9, 1.2, 1.0],
};
for (const [key, [file, fi, w, sm, ds]] of Object.entries(CH)) {
  const p = PNG.sync.read(fs.readFileSync(`public/sprites/${file}.png`));
  const meta = JSON.parse(fs.readFileSync(`public/sprites/${file}.frames.json`, 'utf8'));
  const f = meta.frames[fi];
  const onscreen = (98 + (w - 1) * 14) * sm * ds;
  const scale = onscreen / f.h;
  let minY = f.h; let maxY = 0; let minX = f.w; let maxX = 0;
  for (let y = 0; y < f.h; y += 1) {
    for (let x = 0; x < f.w; x += 1) {
      const si = ((f.y + y) * p.width + (f.x + x)) * 4;
      if (p.data[si + 3] > 40) { if (y < minY) minY = y; if (y > maxY) maxY = y; if (x < minX) minX = x; if (x > maxX) maxX = x; }
    }
  }
  const bodyH = Math.round((maxY - minY + 1) * scale);
  const bodyW = Math.round((maxX - minX + 1) * scale);
  console.log(`${key.padEnd(14)} bodyH=${String(bodyH).padStart(3)}  bodyW=${String(bodyW).padStart(3)}`);
}
