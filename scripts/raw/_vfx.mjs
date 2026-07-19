// Extract glowing VFX from black-background sheets into transparent PNGs.
// alpha = luminance (black -> transparent), so they work with normal OR additive blend.
import { PNG } from 'pngjs';
import fs from 'node:fs';
import path from 'node:path';

const RAW = path.join(process.cwd(), 'scripts', 'raw');
const OUT = path.join(process.cwd(), 'public', 'ui', 'vfx');
fs.mkdirSync(OUT, { recursive: true });

const SHEETS = [
  {
    file: 'vfx_orbs_src.png', cols: 4, rows: 2, prefix: 'orb_',
    names: ['fire', 'ice', 'lightning', 'toxic', 'void', 'holy', 'water', 'blood'],
  },
  {
    file: 'vfx_impacts_src.png', cols: 3, rows: 2, prefix: 'impact_',
    names: ['starburst', 'slash', 'streak', 'shockwave', 'fireblast', 'spiral'],
  },
];

const CUTOFF = 14;   // below this luminance -> fully transparent (kills black noise)
const ATRIM = 26;    // bbox threshold
const PAD = 8;

for (const sheet of SHEETS) {
  const png = PNG.sync.read(fs.readFileSync(path.join(RAW, sheet.file)));
  const { width: W, height: H, data } = png;
  const cw = Math.floor(W / sheet.cols);
  const ch = Math.floor(H / sheet.rows);
  const px = (x, y) => { const i = (y * W + x) * 4; return [data[i], data[i + 1], data[i + 2]]; };

  for (let idx = 0; idx < sheet.names.length; idx++) {
    const cx = (idx % sheet.cols) * cw;
    const cy = Math.floor(idx / sheet.cols) * ch;
    const alpha = new Uint16Array(cw * ch);
    let minX = cw, minY = ch, maxX = 0, maxY = 0, found = false;
    for (let y = 0; y < ch; y++) {
      for (let x = 0; x < cw; x++) {
        const [r, g, b] = px(cx + x, cy + y);
        let a = Math.max(r, g, b);
        if (a < CUTOFF) a = 0;
        else a = Math.min(255, Math.round(a * 1.12));
        alpha[y * cw + x] = a;
        if (a > ATRIM) {
          found = true;
          if (x < minX) minX = x;
          if (y < minY) minY = y;
          if (x > maxX) maxX = x;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (!found) { console.log(`skip ${sheet.prefix}${sheet.names[idx]}`); continue; }
    const ow = maxX - minX + 1 + PAD * 2;
    const oh = maxY - minY + 1 + PAD * 2;
    const out = new PNG({ width: ow, height: oh });
    out.data.fill(0);
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const a = alpha[y * cw + x];
        if (!a) continue;
        const [r, g, b] = px(cx + x, cy + y);
        const oi = ((y - minY + PAD) * ow + (x - minX + PAD)) * 4;
        out.data[oi] = r;
        out.data[oi + 1] = g;
        out.data[oi + 2] = b;
        out.data[oi + 3] = a;
      }
    }
    const name = `${sheet.prefix}${sheet.names[idx]}.png`;
    fs.writeFileSync(path.join(OUT, name), PNG.sync.write(out));
    console.log(`${name}: ${ow}x${oh}`);
  }
}
console.log('done ->', OUT);
