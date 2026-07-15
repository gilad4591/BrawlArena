/**
 * Builds a character reference pack for redesigning the select-screen art:
 *   - character-reference/<id>_idle.png   (transparent, 2x, trimmed idle pose)
 *   - character-reference/<id>_action.png  (transparent, 2x, an attack/cast pose)
 *   - character-reference/index.html       (labelled overview to screenshot/use)
 *
 * Run: node scripts/make-reference.mjs
 */
import fs from 'node:fs';
import { PNG } from 'pngjs';

const OUT = 'character-reference';
fs.mkdirSync(OUT, { recursive: true });

// id -> sprite file, display name, tagline, element, colour, [idle, action] frames
const CHARS = [
  ['blaze', 'fire', 'Blaze', 'Flame Knight', 'Fire', '#ff4d2a', 0, 16],
  ['frost', 'frost', 'Frost', 'Glacial Sentinel', 'Ice', '#7ad0ff', 0, 24],
  ['tide', 'tide', 'Tide', 'Water Blade', 'Water', '#2f6fd6', 0, 17],
  ['volt', 'volt', 'Volt', 'Storm Ninja', 'Lightning', '#8b5cff', 0, 14],
  ['sylva', 'sylva', 'Sylva', 'Wood Archer', 'Nature', '#6faf4b', 0, 18],
  ['shade', 'shade', 'Shade', 'Venom Assassin', 'Poison', '#2e8b46', 0, 18],
  ['nox', 'nox', 'Nox', 'Void Knight', 'Dark', '#6a4a9c', 0, 18],
  ['golem', 'golem', 'Golem', 'Stone Titan', 'Earth', '#7a8a4a', 0, 17],
  ['aurex', 'aurex', 'Aurex', 'Golden Dragon', 'Gold', '#e0a020', 0, 18],
  ['sage', 'sage', 'Sage', 'Arcane Elder', 'Arcane', '#7a4fc8', 0, 31],
];

const SCALE = 2;

function exportFrame(file, frameIdx, outName) {
  const sheet = PNG.sync.read(fs.readFileSync(`public/sprites/${file}.png`));
  const meta = JSON.parse(fs.readFileSync(`public/sprites/${file}.frames.json`, 'utf8'));
  const f = meta.frames[frameIdx] || meta.frames[0];
  // tighten: find the alpha bbox inside the frame box
  let x0 = f.w; let y0 = f.h; let x1 = 0; let y1 = 0;
  for (let y = 0; y < f.h; y += 1) {
    for (let x = 0; x < f.w; x += 1) {
      const a = sheet.data[((f.y + y) * sheet.width + (f.x + x)) * 4 + 3];
      if (a > 40) { if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y; }
    }
  }
  if (x1 < x0) { x0 = 0; y0 = 0; x1 = f.w - 1; y1 = f.h - 1; }
  const cw = x1 - x0 + 1; const ch = y1 - y0 + 1;
  const out = new PNG({ width: cw * SCALE, height: ch * SCALE });
  for (let y = 0; y < out.height; y += 1) {
    for (let x = 0; x < out.width; x += 1) {
      const sx = f.x + x0 + Math.floor(x / SCALE);
      const sy = f.y + y0 + Math.floor(y / SCALE);
      const si = (sy * sheet.width + sx) * 4; const di = (y * out.width + x) * 4;
      out.data[di] = sheet.data[si]; out.data[di + 1] = sheet.data[si + 1];
      out.data[di + 2] = sheet.data[si + 2]; out.data[di + 3] = sheet.data[si + 3];
    }
  }
  fs.writeFileSync(`${OUT}/${outName}`, PNG.sync.write(out));
  return { w: out.width, h: out.height };
}

const cards = CHARS.map(([id, file, name, tag, el, color, idle, action]) => {
  exportFrame(file, idle, `${id}_idle.png`);
  exportFrame(file, action, `${id}_action.png`);
  return `
    <figure class="card" style="--c:${color}">
      <div class="poses">
        <img src="${id}_idle.png" alt="${name} idle">
        <img src="${id}_action.png" alt="${name} action">
      </div>
      <figcaption>
        <span class="name">${name}</span>
        <span class="tag">${tag}</span>
        <span class="el">${el}</span>
      </figcaption>
    </figure>`;
}).join('');

const html = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Elements of War — Character Reference</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body { margin: 0; background: #0b0e18; color: #eef1ff; font-family: system-ui, Segoe UI, Roboto, sans-serif; padding: 28px; }
  h1 { text-align: center; letter-spacing: .04em; margin: 0 0 6px; }
  p.sub { text-align: center; color: #93a0c8; margin: 0 0 26px; }
  .grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 16px; max-width: 1180px; margin: 0 auto; }
  .card { margin: 0; background: linear-gradient(180deg, color-mix(in srgb, var(--c) 24%, #141a2c), #10131f);
    border: 2px solid color-mix(in srgb, var(--c) 55%, transparent); border-radius: 16px; padding: 12px;
    box-shadow: 0 6px 20px color-mix(in srgb, var(--c) 30%, transparent); }
  .poses { display: flex; gap: 6px; align-items: flex-end; justify-content: center; height: 190px; }
  .poses img { max-height: 185px; width: auto; image-rendering: auto; filter: drop-shadow(0 3px 6px rgba(0,0,0,.5)); }
  figcaption { text-align: center; margin-top: 10px; display: flex; flex-direction: column; gap: 2px; }
  .name { font-weight: 800; font-size: 1.15rem; }
  .tag { color: #c7d0ee; font-size: .82rem; }
  .el { justify-self: center; margin: 4px auto 0; font-size: .7rem; text-transform: uppercase; letter-spacing: .08em;
    background: color-mix(in srgb, var(--c) 40%, #0b0e18); border: 1px solid color-mix(in srgb, var(--c) 60%, transparent);
    padding: 2px 10px; border-radius: 999px; width: fit-content; }
  @media (max-width: 900px) { .grid { grid-template-columns: repeat(2, 1fr); } }
</style></head><body>
  <h1>Little Fighter — Elements of War</h1>
  <p class="sub">In-game character reference · use these looks when designing the select-screen portraits</p>
  <div class="grid">${cards}</div>
</body></html>`;

fs.writeFileSync(`${OUT}/index.html`, html);
console.log(`Wrote ${OUT}/index.html + ${CHARS.length * 2} sprite PNGs`);
