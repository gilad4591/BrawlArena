import fs from 'node:fs';
import { PNG } from 'pngjs';

// Special/attack frame indices — the effect/weapon direction reveals true facing.
const WALK = {
  blaze: 19, frost: 24, aurex: 19, shade: 28, golem: 19, tide: 20,
  nox: 27, volt: 15, sylva: 20, sage: 31,
  grunt: 11, darkmage: 19, darkknight: 16,
};
const FILE = { blaze: 'fire' };
const ids = Object.keys(WALK);
const CW = 210; const CH = 230; const S = 1.25;
const cols = 3; const rows = Math.ceil(ids.length / cols);
const out = new PNG({ width: cols * CW, height: rows * CH });
out.data.fill(20);
for (let p = 3; p < out.data.length; p += 4) out.data[p] = 255;
const put = (X, Y, r, g, b) => {
  if (X < 0 || Y < 0 || X >= out.width || Y >= out.height) return;
  const i = (Y * out.width + X) * 4; out.data[i] = r; out.data[i + 1] = g; out.data[i + 2] = b; out.data[i + 3] = 255;
};

ids.forEach((id, n) => {
  const fn = FILE[id] || id;
  const sheet = PNG.sync.read(fs.readFileSync(`public/sprites/${fn}.png`));
  const meta = JSON.parse(fs.readFileSync(`public/sprites/${fn}.frames.json`, 'utf8'));
  const f = meta.frames[WALK[id]];
  if (!f) return;
  const col = n % cols; const row = Math.floor(n / cols);
  const cx = col * CW + CW / 2; const baseline = row * CH + CH - 24;
  const dw = f.w * S; const dh = f.h * S;
  const ox = Math.round(cx - dw / 2); const oy = Math.round(baseline - dh);
  for (let y = 0; y < dh; y += 1) {
    for (let x = 0; x < dw; x += 1) {
      const sx = f.x + Math.floor(x / S); const sy = f.y + Math.floor(y / S);
      const si = (sy * sheet.width + sx) * 4;
      if (sheet.data[si + 3] <= 60) continue;
      put(ox + x, oy + y, sheet.data[si], sheet.data[si + 1], sheet.data[si + 2]);
    }
  }
  // baseline + a right-pointing arrow (this is the frame drawn when moving RIGHT)
  for (let x = col * CW + 10; x < col * CW + CW - 10; x += 1) put(x, baseline, 80, 80, 90);
  for (let x = 0; x < 40; x += 1) { put(col * CW + 20 + x, row * CH + 18, 90, 220, 90); put(col * CW + 20 + x, row * CH + 19, 90, 220, 90); }
  for (let k = 0; k < 8; k += 1) { put(col * CW + 60 - k, row * CH + 18 - k, 90, 220, 90); put(col * CW + 60 - k, row * CH + 18 + k, 90, 220, 90); }
});
fs.writeFileSync('art-src/facing_check.png', PNG.sync.write(out));
console.log('wrote art-src/facing_check.png (order:', ids.join(', ') + ')');
