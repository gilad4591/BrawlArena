import fs from 'node:fs';
import { PNG } from 'pngjs';

// [spriteFile, idleFrame, weight, sizeMul, defScale]  — mirrors Fighter + SPRITE_DEFS
const CH = {
  blaze: ['fire', 0, 1.1, 1, 0.95],
  frost: ['frost', 0, 1.0, 1, 0.95],
  tide: ['tide', 0, 1.05, 1, 0.95],
  volt: ['volt', 0, 0.88, 1, 0.95],
  sylva: ['sylva', 0, 0.95, 1, 0.95],
  shade: ['shade', 0, 0.9, 1, 0.95],
  nox: ['nox', 0, 1.6, 0.95, 0.95],
  golem: ['golem', 0, 1.8, 0.96, 0.98],
  aurex: ['aurex', 0, 1.2, 1, 0.95],
  sage: ['sage', 0, 1.0, 1, 0.95],
};
const order = Object.keys(CH);
const CW = 132; const Hpx = 230; const cols = order.length;
const out = new PNG({ width: cols * CW, height: Hpx });
out.data.fill(24); for (let i = 3; i < out.data.length; i += 4) out.data[i] = 255;
const baseline = Hpx - 16;

const results = [];
order.forEach((key, col) => {
  const [file, fi, w, sm, ds] = CH[key];
  const p = PNG.sync.read(fs.readFileSync(`public/sprites/${file}.png`));
  const meta = JSON.parse(fs.readFileSync(`public/sprites/${file}.frames.json`, 'utf8'));
  const f = meta.frames[fi];
  const onscreen = (98 + (w - 1) * 14) * sm * ds; // scaled frame-bbox height (game logic)
  const scale = onscreen / f.h;
  const drawW = f.w * scale;
  const cx = col * CW + CW / 2;
  const ox = cx - drawW / 2; const oy = baseline - onscreen;

  // measure the actual opaque body extent inside the frame
  let minY = f.h; let maxY = 0; let minX = f.w; let maxX = 0;
  for (let y = 0; y < f.h; y += 1) {
    for (let x = 0; x < f.w; x += 1) {
      const si = ((f.y + y) * p.width + (f.x + x)) * 4;
      if (p.data[si + 3] > 40) {
        if (y < minY) minY = y; if (y > maxY) maxY = y;
        if (x < minX) minX = x; if (x > maxX) maxX = x;
      }
    }
  }
  const bodyPxH = (maxY - minY + 1) * scale; // visible body height on screen
  const bodyPxW = (maxX - minX + 1) * scale;
  results.push({ key, onscreen: Math.round(onscreen), bodyH: Math.round(bodyPxH), bodyW: Math.round(bodyPxW) });

  for (let y = 0; y < onscreen; y += 1) {
    for (let x = 0; x < drawW; x += 1) {
      const sx = f.x + Math.floor(x / scale); const sy = f.y + Math.floor(y / scale);
      const si = (sy * p.width + sx) * 4;
      if (p.data[si + 3] <= 40) continue;
      const X = Math.round(ox + x); const Y = Math.round(oy + y);
      if (X < 0 || Y < 0 || X >= out.width || Y >= out.height) continue;
      const di = (Y * out.width + X) * 4;
      out.data[di] = p.data[si]; out.data[di + 1] = p.data[si + 1]; out.data[di + 2] = p.data[si + 2]; out.data[di + 3] = 255;
    }
  }
  for (let x = col * CW; x < (col + 1) * CW; x += 1) {
    const di = (baseline * out.width + x) * 4; out.data[di] = 100; out.data[di + 1] = 100; out.data[di + 2] = 120;
  }
});
fs.writeFileSync('art-src/size_audit.png', PNG.sync.write(out));
const med = [...results].map((r) => r.bodyH).sort((a, b) => a - b)[Math.floor(results.length / 2)];
console.log('median visible body height:', med);
results.forEach((r) => {
  const corr = (med / r.bodyH);
  console.log(`${r.key.padEnd(7)} frameH=${String(r.onscreen).padStart(3)}  bodyH=${String(r.bodyH).padStart(3)}  bodyW=${String(r.bodyW).padStart(3)}  ->scale*=${corr.toFixed(3)}`);
});
console.log('wrote art-src/size_audit.png');
