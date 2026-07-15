/**
 * Crops a rectangle out of a JPEG and writes it as a PNG.
 * Usage: node scripts/crop-jpeg.mjs <in.jpg> <out.png> x y w h
 */
import fs from 'node:fs';
import jpeg from 'jpeg-js';
import { PNG } from 'pngjs';

const [, , inFile, outFile, xs, ys, ws, hs] = process.argv;
const raw = jpeg.decode(fs.readFileSync(inFile), { useTArray: true });
const X = +xs;
const Y = +ys;
const W = +ws;
const H = +hs;
const out = new PNG({ width: W, height: H });
for (let y = 0; y < H; y += 1) {
  for (let x = 0; x < W; x += 1) {
    const si = ((Y + y) * raw.width + (X + x)) * 4;
    const di = (y * W + x) * 4;
    out.data[di] = raw.data[si];
    out.data[di + 1] = raw.data[si + 1];
    out.data[di + 2] = raw.data[si + 2];
    out.data[di + 3] = 255;
  }
}
fs.writeFileSync(outFile, PNG.sync.write(out));
console.log(`Wrote ${outFile} (${W}x${H}) from ${raw.width}x${raw.height}`);
