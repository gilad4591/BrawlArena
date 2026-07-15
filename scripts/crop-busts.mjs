import fs from 'node:fs';
import jpeg from 'jpeg-js';
import { PNG } from 'pngjs';

const src = process.argv[2];
const raw = jpeg.decode(fs.readFileSync(src), { useTArray: true });
const { width: W, data } = raw;
// remaining args: id x y w h  (repeatable in groups of 5)
const N = 200;
for (let i = 3; i < process.argv.length; i += 5) {
  const id = process.argv[i];
  const rx = Number(process.argv[i + 1]); const ry = Number(process.argv[i + 2]);
  const rw = Number(process.argv[i + 3]); const rh = Number(process.argv[i + 4]);
  const out = new PNG({ width: N, height: N });
  const scale = Math.max(N / rw, N / rh);
  const dw = rw * scale; const dh = rh * scale;
  const ox = (N - dw) / 2; const oy = (N - dh) / 2;
  for (let y = 0; y < N; y += 1) {
    for (let x = 0; x < N; x += 1) {
      const sx = Math.round(rx + (x - ox) / scale);
      const sy = Math.round(ry + (y - oy) / scale);
      const si = (sy * W + sx) * 4;
      const di = (y * N + x) * 4;
      out.data[di] = data[si]; out.data[di + 1] = data[si + 1]; out.data[di + 2] = data[si + 2]; out.data[di + 3] = 255;
    }
  }
  fs.writeFileSync(`public/portraits/${id}.png`, PNG.sync.write(out));
  console.log(`wrote public/portraits/${id}.png from [${rx},${ry},${rw},${rh}]`);
}
