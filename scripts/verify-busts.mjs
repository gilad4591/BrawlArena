import fs from 'node:fs';
import { PNG } from 'pngjs';

const IDS = ['blaze', 'frost', 'shade', 'volt', 'golem', 'tide', 'nox', 'aurex', 'sylva', 'sage'];
const S = 128; const cols = 5; const rows = 2;
const mont = new PNG({ width: cols * S, height: rows * S });
mont.data.fill(11); for (let i = 3; i < mont.data.length; i += 4) mont.data[i] = 255;

IDS.forEach((id, idx) => {
  const src = PNG.sync.read(fs.readFileSync(`public/portraits/${id}.png`));
  const scale = Math.max(S / src.width, S / src.height);
  const dw = src.width * scale; const dh = src.height * scale;
  const ox = (S - dw) / 2; const oy = (S - dh) / 2;
  const gx = (idx % cols) * S; const gy = Math.floor(idx / cols) * S;
  for (let y = 0; y < S; y += 1) {
    for (let x = 0; x < S; x += 1) {
      const sx = Math.floor((x - ox) / scale); const sy = Math.floor((y - oy) / scale);
      if (sx < 0 || sy < 0 || sx >= src.width || sy >= src.height) continue;
      const si = (sy * src.width + sx) * 4; const di = ((gy + y) * mont.width + (gx + x)) * 4;
      mont.data[di] = src.data[si]; mont.data[di + 1] = src.data[si + 1];
      mont.data[di + 2] = src.data[si + 2]; mont.data[di + 3] = 255;
    }
  }
});
fs.writeFileSync('art-src/busts_verify.png', PNG.sync.write(mont));
console.log('wrote art-src/busts_verify.png');
