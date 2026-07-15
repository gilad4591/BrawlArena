import fs from 'node:fs';
import { PNG } from 'pngjs';

// index (1-10 in art-src/incard) -> character id
const MAP = {
  1: 'blaze', 2: 'frost', 3: 'tide', 4: 'volt', 5: 'shade',
  6: 'nox', 7: 'golem', 8: 'aurex', 9: 'sage', 10: 'sylva',
};
const install = process.argv.includes('--install');
const INSET = 8; // trims the thin outer card frame

function cropSquare(src) {
  const side = src.width - INSET * 2; // square that fits within the portrait, above the name plate
  const ox = INSET;
  const oy = INSET;
  const out = new PNG({ width: side, height: side });
  for (let y = 0; y < side; y += 1) {
    for (let x = 0; x < side; x += 1) {
      const sx = Math.min(src.width - 1, ox + x);
      const sy = Math.min(src.height - 1, oy + y);
      const si = (sy * src.width + sx) * 4; const di = (y * side + x) * 4;
      out.data[di] = src.data[si]; out.data[di + 1] = src.data[si + 1];
      out.data[di + 2] = src.data[si + 2]; out.data[di + 3] = 255;
    }
  }
  return out;
}

const CELL = 150; const cols = 5; const mont = new PNG({ width: cols * CELL, height: 2 * CELL });
mont.data.fill(12); for (let i = 3; i < mont.data.length; i += 4) mont.data[i] = 255;

for (let n = 1; n <= 10; n += 1) {
  const id = MAP[n];
  const src = PNG.sync.read(fs.readFileSync(`art-src/incard/${n}.png`));
  const png = cropSquare(src);
  if (install) {
    fs.writeFileSync(`public/portraits/${id}.png`, PNG.sync.write(png));
    console.log(`wrote public/portraits/${id}.png (${png.width}px)`);
  }
  const cx = ((n - 1) % cols) * CELL; const cy = Math.floor((n - 1) / cols) * CELL;
  for (let y = 0; y < CELL; y += 1) {
    for (let x = 0; x < CELL; x += 1) {
      const sx = Math.floor((x / CELL) * png.width); const sy = Math.floor((y / CELL) * png.height);
      const si = (sy * png.width + sx) * 4; const di = ((cy + y) * mont.width + (cx + x)) * 4;
      mont.data[di] = png.data[si]; mont.data[di + 1] = png.data[si + 1];
      mont.data[di + 2] = png.data[si + 2]; mont.data[di + 3] = 255;
    }
  }
}
fs.writeFileSync('art-src/cards_contact.png', PNG.sync.write(mont));
console.log(install ? 'installed 10 busts + wrote art-src/cards_contact.png' : 'preview only -> art-src/cards_contact.png');
