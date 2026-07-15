import fs from 'node:fs';
import { PNG } from 'pngjs';

const PICKS = process.argv[2] === 'enemies' ? {
  grunt: [0, 4, 9, 11, 18], darkmage: [0, 5, 13, 19, 28], darkknight: [1, 5, 10, 16, 19],
} : {
  blaze: [0, 4, 16, 19, 29], frost: [0, 8, 23, 24, 39], aurex: [0, 8, 15, 19, 38],
  shade: [0, 8, 16, 28, 34], golem: [0, 8, 16, 19, 34], tide: [0, 8, 16, 20, 44],
  nox: [0, 8, 16, 27, 34], volt: [0, 3, 12, 15, 26], sylva: [0, 8, 16, 20, 30],
  sage: [0, 7, 23, 31, 32],
};
const LABELS = ['idle', 'walk', 'attack', 'special', 'ko'];
const FILE = { blaze: 'fire' };
const ids = Object.keys(PICKS);
const CW = 150; const CH = 180; const S = 0.85;
const cols = 5; const rows = ids.length;
const out = new PNG({ width: (cols + 0.6) * CW, height: rows * CH });
out.data.fill(18);
for (let p = 3; p < out.data.length; p += 4) out.data[p] = 255;
const put = (X, Y, r, g, b) => {
  if (X < 0 || Y < 0 || X >= out.width || Y >= out.height) return;
  const i = (Y * out.width + X) * 4; out.data[i] = r; out.data[i + 1] = g; out.data[i + 2] = b; out.data[i + 3] = 255;
};

ids.forEach((id, row) => {
  const fn = FILE[id] || id;
  const sheet = PNG.sync.read(fs.readFileSync(`public/sprites/${fn}.png`));
  const meta = JSON.parse(fs.readFileSync(`public/sprites/${fn}.frames.json`, 'utf8'));
  const rowY = row * CH;
  PICKS[id].forEach((idx, col) => {
    const f = meta.frames[idx];
    if (!f) return;
    const cx = (col + 0.6) * CW + CW / 2;
    const baseline = rowY + CH - 16;
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
    for (let x = Math.round((col + 0.6) * CW); x < Math.round((col + 1.6) * CW); x += 1) put(x, baseline, 70, 70, 80);
  });
});
const outName = process.argv[2] === 'enemies' ? 'art-src/enemy_verify.png' : 'art-src/roster_verify.png';
fs.writeFileSync(outName, PNG.sync.write(out));
console.log('wrote', outName, ' (rows:', ids.join(', ') + ')');
console.log('cols:', LABELS.join(', '));
