import fs from 'node:fs';
import { PNG } from 'pngjs';

const CW = 150; const CH = 200; const cols = 5; const rows = 2;
const mont = new PNG({ width: cols * CW, height: rows * CH });
mont.data.fill(20); for (let i = 3; i < mont.data.length; i += 4) mont.data[i] = 255;

for (let n = 1; n <= 10; n += 1) {
  const src = PNG.sync.read(fs.readFileSync(`art-src/incard/${n}.png`));
  const scale = Math.min(CW / src.width, CH / src.height);
  const dw = src.width * scale; const dh = src.height * scale;
  const gx = ((n - 1) % cols) * CW + (CW - dw) / 2;
  const gy = Math.floor((n - 1) / cols) * CH + (CH - dh) / 2;
  for (let y = 0; y < dh; y += 1) {
    for (let x = 0; x < dw; x += 1) {
      const sx = Math.floor(x / scale); const sy = Math.floor(y / scale);
      const si = (sy * src.width + sx) * 4;
      const di = (Math.round(gy + y) * mont.width + Math.round(gx + x)) * 4;
      mont.data[di] = src.data[si]; mont.data[di + 1] = src.data[si + 1];
      mont.data[di + 2] = src.data[si + 2]; mont.data[di + 3] = 255;
    }
  }
}
fs.writeFileSync('art-src/incard_montage.png', PNG.sync.write(mont));
console.log('wrote art-src/incard_montage.png (cells 1-5 top, 6-10 bottom)');
