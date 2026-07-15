import fs from 'node:fs';
import { PNG } from 'pngjs';

// args: id xFrac yFrac wFrac hFrac  (fractions of the idle frame box)
const [, , id, xf, yf, wf, hf] = process.argv;
const p = PNG.sync.read(fs.readFileSync(`public/sprites/${id}.png`));
const m = JSON.parse(fs.readFileSync(`public/sprites/${id}.frames.json`, 'utf8'));
const f = m.frames[0];
const cx = f.x + f.w * Number(xf);
const cy = f.y + f.h * Number(yf);
const cw = f.w * Number(wf);
const ch = f.h * Number(hf);

const N = 180;
const out = new PNG({ width: N, height: N });
// dark background similar to the painted busts
for (let i = 0; i < out.data.length; i += 4) { out.data[i] = 14; out.data[i + 1] = 17; out.data[i + 2] = 30; out.data[i + 3] = 255; }
const scale = Math.max(N / cw, N / ch); // cover-fit
const dw = cw * scale; const dh = ch * scale;
const ox = (N - dw) / 2; const oy = (N - dh) / 2;
for (let y = 0; y < N; y += 1) {
  for (let x = 0; x < N; x += 1) {
    const sx = Math.floor(cx + (x - ox) / scale);
    const sy = Math.floor(cy + (y - oy) / scale);
    if (sx < 0 || sy < 0 || sx >= p.width || sy >= p.height) continue;
    const si = (sy * p.width + sx) * 4;
    if (p.data[si + 3] <= 30) continue; // keep dark bg
    const di = (y * N + x) * 4;
    out.data[di] = p.data[si]; out.data[di + 1] = p.data[si + 1]; out.data[di + 2] = p.data[si + 2]; out.data[di + 3] = 255;
  }
}
fs.writeFileSync(`public/portraits/${id}.png`, PNG.sync.write(out));
console.log(`wrote public/portraits/${id}.png from frame0 [${cx.toFixed(0)},${cy.toFixed(0)},${cw.toFixed(0)},${ch.toFixed(0)}]`);
