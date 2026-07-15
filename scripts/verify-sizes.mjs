import fs from 'node:fs';
import { PNG } from 'pngjs';

// Mirrors Fighter sizing: h = (98 + (weight-1)*14) * sizeMul; onscreen = h * defScale
const CH = { // [file, frameIdx, weight, sizeMul, defScale, label]
  tide: ['tide', 0, 1.05, 1.0, 0.95, 'You(Tide)'],
  grunt: ['grunt', 0, 1.5, 0.9, 0.95, 'Bruiser'],
  mage: ['darkmage', 0, 0.8, 0.9, 0.95, 'Mage'],
  super: ['grunt', 0, 1.8, 1.05, 0.95, 'SuperBruiser'],
  boss: ['darkknight', 1, 1.9, 1.2, 1.0, 'Boss'],
};
const order = ['tide', 'grunt', 'mage', 'super', 'boss'];
const CW = 150; const Hpx = 200; const cols = order.length;
const out = new PNG({ width: cols * CW, height: Hpx });
out.data.fill(26); for (let i = 3; i < out.data.length; i += 4) out.data[i] = 255;
const baseline = Hpx - 12;

order.forEach((key, col) => {
  const [file, fi, w, sm, ds] = CH[key];
  const p = PNG.sync.read(fs.readFileSync(`public/sprites/${file}.png`));
  const meta = JSON.parse(fs.readFileSync(`public/sprites/${file}.frames.json`, 'utf8'));
  const f = meta.frames[fi];
  const onscreen = (98 + (w - 1) * 14) * sm * ds; // px height of idle body
  const scale = onscreen / f.h;
  const cx = col * CW + CW / 2;
  const ox = cx - (f.w * scale) / 2; const oy = baseline - onscreen;
  for (let y = 0; y < onscreen; y += 1) {
    for (let x = 0; x < f.w * scale; x += 1) {
      const sx = f.x + Math.floor(x / scale); const sy = f.y + Math.floor(y / scale);
      const si = (sy * p.width + sx) * 4;
      if (p.data[si + 3] <= 30) continue;
      const X = Math.round(ox + x); const Y = Math.round(oy + y);
      if (X < 0 || Y < 0 || X >= out.width || Y >= out.height) continue;
      const di = (Y * out.width + X) * 4;
      out.data[di] = p.data[si]; out.data[di + 1] = p.data[si + 1]; out.data[di + 2] = p.data[si + 2]; out.data[di + 3] = 255;
    }
  }
  for (let x = col * CW; x < (col + 1) * CW; x += 1) { const di = (baseline * out.width + x) * 4; out.data[di] = 90; out.data[di + 1] = 90; out.data[di + 2] = 100; }
});
fs.writeFileSync('art-src/size_check.png', PNG.sync.write(out));
console.log('wrote art-src/size_check.png  (', order.join(' '), ')');
