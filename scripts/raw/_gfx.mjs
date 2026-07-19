// Extract 6 asset sheets:
//  - glow sheets (black bg): alpha = luminance, optional per-cell text-band crop
//  - chroma sheets (magenta bg): key out magenta, trim
import { PNG } from 'pngjs';
import fs from 'node:fs';
import path from 'node:path';

const RAW = path.join(process.cwd(), 'scripts', 'raw');

const SHEETS = [
  { file: 'vfx_status_src.png', cols: 4, rows: 2, mode: 'glow', out: 'public/ui/vfx', prefix: 'status_',
    names: ['rage', 'frozen', 'burn', 'dizzy', 'poison', 'shield', 'powerup', 'levelup'], skipTop: 0.30 },
  { file: 'vfx_slashes_src.png', cols: 3, rows: 2, mode: 'glow', out: 'public/ui/vfx', prefix: 'slash_',
    names: ['white', 'red', 'blue', 'fire', 'void', 'green'] },
  { file: 'vfx_dust_src.png', cols: 3, rows: 2, mode: 'glow', out: 'public/ui/vfx', prefix: 'dust_',
    names: ['run', 'land', 'jump', 'smoke', 'dash', 'impact'], skipBot: 0.30 },
  { file: 'ui_kit_src.png', cols: 3, rows: 2, mode: 'chroma', out: 'public/ui/hud', prefix: 'ui_',
    names: ['hpframe', 'mpframe', 'portraitring', 'button', 'vs', 'banner'] },
  { file: 'ui_banners_src.png', cols: 2, rows: 2, mode: 'chroma', out: 'public/ui/banners', prefix: 'banner_',
    names: ['fight', 'ko', 'perfect', 'combo'] },
  { file: 'fx_rewards_src.png', cols: 7, rows: 1, mode: 'chroma', out: 'public/ui/rewards', prefix: 'reward_',
    names: ['coin', 'coins', 'star', 'trophy', 'silver', 'bronze', 'gem'] },
];

const CUTOFF = 14, ATRIM = 26, PAD = 8;
// Soft magenta key: score high when R&B >> G (magenta/pink), alpha = 1 - score.
// This feathers anti-aliased edges and removes pink fringe automatically.
const MAG_T0 = 6, MAG_T1 = 40;
function magentaAlpha(r, g, b) {
  const score = (Math.min(r, b) - g - MAG_T0) / (MAG_T1 - MAG_T0);
  if (score >= 1) return 0;
  if (score <= 0) return 255;
  const a = Math.round(255 * (1 - score));
  return a < 45 ? 0 : a; // snap faint edge fringe to fully transparent
}
// Pull residual pink spill toward neutral on kept pixels.
function despill(r, g, b) {
  const m = (r + b) / 2;
  if (m > g) { const o = Math.round((m - g) * 0.9); return [Math.max(0, r - o), g, Math.max(0, b - o)]; }
  return [r, g, b];
}

for (const s of SHEETS) {
  const png = PNG.sync.read(fs.readFileSync(path.join(RAW, s.file)));
  const { width: W, height: H, data } = png;
  const cw = Math.floor(W / s.cols);
  const ch = Math.floor(H / s.rows);
  const px = (x, y) => { const i = (y * W + x) * 4; return [data[i], data[i + 1], data[i + 2]]; };
  const outDir = path.join(process.cwd(), s.out);
  fs.mkdirSync(outDir, { recursive: true });
  const y0 = Math.floor((s.skipTop ?? 0) * ch);
  const y1 = ch - Math.floor((s.skipBot ?? 0) * ch);

  for (let idx = 0; idx < s.names.length; idx++) {
    const cx = (idx % s.cols) * cw;
    const cy = Math.floor(idx / s.cols) * ch;
    const alpha = new Uint16Array(cw * ch);
    let minX = cw, minY = ch, maxX = 0, maxY = 0, found = false;
    for (let y = y0; y < y1; y++) {
      for (let x = 0; x < cw; x++) {
        const [r, g, b] = px(cx + x, cy + y);
        let a;
        if (s.mode === 'glow') {
          a = Math.max(r, g, b);
          a = a < CUTOFF ? 0 : Math.min(255, Math.round(a * 1.12));
        } else {
          a = magentaAlpha(r, g, b);
        }
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
    if (!found) { console.log(`skip ${s.prefix}${s.names[idx]}`); continue; }
    const ow = maxX - minX + 1 + PAD * 2;
    const oh = maxY - minY + 1 + PAD * 2;
    const out = new PNG({ width: ow, height: oh });
    out.data.fill(0);
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const a = alpha[y * cw + x];
        if (!a) continue;
        let [r, g, b] = px(cx + x, cy + y);
        if (s.mode === 'chroma') [r, g, b] = despill(r, g, b);
        const oi = ((y - minY + PAD) * ow + (x - minX + PAD)) * 4;
        out.data[oi] = r; out.data[oi + 1] = g; out.data[oi + 2] = b; out.data[oi + 3] = a;
      }
    }
    fs.writeFileSync(path.join(outDir, `${s.prefix}${s.names[idx]}.png`), PNG.sync.write(out));
    console.log(`${s.out}/${s.prefix}${s.names[idx]}.png: ${ow}x${oh}`);
  }
}
console.log('done');
