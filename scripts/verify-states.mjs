import fs from 'node:fs';
import { PNG } from 'pngjs';

// Usage: node scripts/verify-states.mjs <sheet.png> <frames.json> <out.png> "idle:0,walk:8,..."
const [, , sheetF, framesF, outF, spec] = process.argv;
const sheet = PNG.sync.read(fs.readFileSync(sheetF));
const meta = JSON.parse(fs.readFileSync(framesF, 'utf8'));
const items = spec.split(',').map((s) => { const [label, idx] = s.split(':'); return { label, idx: Number(idx) }; });

const CW = 150; const CH = 190; const S = 0.95;
const cols = items.length;
const out = new PNG({ width: cols * CW, height: CH });
out.data.fill(22);
for (let p = 3; p < out.data.length; p += 4) out.data[p] = 255;
const A = (x, y) => sheet.data[(y * sheet.width + x) * 4 + 3];
const put = (X, Y, r, g, b) => {
  if (X < 0 || Y < 0 || X >= out.width || Y >= out.height) return;
  const i = (Y * out.width + X) * 4; out.data[i] = r; out.data[i + 1] = g; out.data[i + 2] = b; out.data[i + 3] = 255;
};
const FONT = { 0:['111','101','101','101','111'],1:['010','110','010','010','111'],2:['111','001','111','100','111'],3:['111','001','111','001','111'],4:['101','101','111','001','001'],5:['111','100','111','001','111'],6:['111','100','111','101','111'],7:['111','001','010','010','010'],8:['111','101','111','101','111'],9:['111','101','111','001','111'] };
const drawNum = (n, X, Y) => String(n).split('').forEach((ch, k) => { const g = FONT[ch]; for (let ry=0;ry<5;ry++) for (let rx=0;rx<3;rx++) if (g[ry][rx]==='1') for(let dy=0;dy<2;dy++) for(let dx=0;dx<2;dx++) put(X+k*8+rx*2+dx, Y+ry*2+dy, 255,220,60); });

items.forEach((it, col) => {
  const f = meta.frames[it.idx];
  if (!f) return;
  const cx = col * CW + CW / 2; const baseline = CH - 20;
  const dw = f.w * S; const dh = f.h * S;
  const ox = Math.round(cx - dw / 2); const oy = Math.round(baseline - dh);
  for (let y = 0; y < dh; y += 1) for (let x = 0; x < dw; x += 1) {
    const sx = f.x + Math.floor(x / S); const sy = f.y + Math.floor(y / S);
    if (A(sx, sy) <= 60) continue;
    const si = (sy * sheet.width + sx) * 4;
    put(ox + x, oy + y, sheet.data[si], sheet.data[si + 1], sheet.data[si + 2]);
  }
  for (let x = col * CW + 6; x < col * CW + CW - 6; x += 1) put(x, baseline, 70, 70, 80);
  drawNum(it.idx, col * CW + 4, 4);
});
fs.writeFileSync(outF, PNG.sync.write(out));
console.log('wrote', outF, '  states:', items.map((i) => `${i.label}=${i.idx}`).join(' '));
