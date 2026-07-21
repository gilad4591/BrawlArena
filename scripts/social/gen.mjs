// BrawlArena social kit generator.
// Composes Instagram-ready cards (arena bg + character bust + logo + name/CTA)
// with headless Chrome and screenshots them at 1080x1080 and 1080x1920.
// Assets are inlined as data URIs so page.setContent needs no file access.
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';

const CHROME = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ROOT = process.cwd();
const PUB = path.join(ROOT, 'public');
const OUT = path.join(ROOT, 'social-kit');
fs.mkdirSync(OUT, { recursive: true });

const dataUri = (p) => {
  const buf = fs.readFileSync(p);
  return `data:image/png;base64,${buf.toString('base64')}`;
};
const portrait = (id) => dataUri(path.join(PUB, 'portraits', `${id}.png`));
const arena = (id) => dataUri(path.join(PUB, 'arenas', `${id}.png`));
const LOGO = dataUri(path.join(PUB, 'icons', 'icon-512.png'));

// Pre-launch teaser vs. live CTA. Switch to '▶ Free on Android' once it's public.
const CTA = process.env.CTA_TEXT || '⏳ Coming Soon';

// id, display name, tagline, base color, accent, paired arena
const ROSTER = [
  ['blaze', 'BLAZE', 'The Flame Fighter', '#ff4d2a', '#ffb03b', 'volcano'],
  ['frost', 'FROST', 'The Ice Warrior', '#7ad0ff', '#dff4ff', 'frozen'],
  ['tide', 'TIDE', 'The Wave Bender', '#2f6fd6', '#8fd0ff', 'sky_temple'],
  ['volt', 'VOLT', 'The Storm Striker', '#8b5cff', '#c3b0ff', 'neon_rooftop'],
  ['sylva', 'SYLVA', 'The Wild Hunter', '#6faf4b', '#cfe0a3', 'forest'],
  ['shade', 'SHADE', 'The Venom Assassin', '#2e8b46', '#9fe08a', 'shadow_graveyard'],
  ['nox', 'NOX', 'The Void Bringer', '#6a4a9c', '#b78bff', 'shadow_graveyard'],
  ['golem', 'GOLEM', 'The Living Stone', '#7a8a4a', '#b6e05a', 'colosseum'],
  ['aurex', 'AUREX', 'The Golden Dragon', '#e0a020', '#ffe08a', 'sky_temple'],
  ['sage', 'SAGE', 'The Arcane Master', '#7a4fc8', '#c9a0ff', 'shadow_graveyard'],
];
const PREMIUM = [
  ['solaris', 'SOLARIS', 'Sun Warden', '#ffa028', '#ffe08a', 'volcano'],
  ['tempest', 'TEMPEST', 'Storm Lord', '#4aa0ff', '#d0f0ff', 'neon_rooftop'],
  ['umbra', 'UMBRA', 'Night Reaper', '#7a3fb0', '#c98bff', 'shadow_graveyard'],
  ['titania', 'TITANIA', 'Nature Queen', '#3fb07a', '#b0ff9a', 'forest'],
];

const FONTS = `
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Oswald:wght@500;700&family=Montserrat:wght@600;800&display=swap" rel="stylesheet">`;

const baseCss = (accent, color) => `
  * { margin:0; padding:0; box-sizing:border-box; }
  :root { --a:${accent}; --c:${color}; }
  body { font-family:'Montserrat','Arial Black',sans-serif; color:#fff; overflow:hidden; }
  .stage { position:relative; width:100%; height:100%; overflow:hidden; background:#0b0d12; }
  .bg { position:absolute; inset:0; background-size:cover; background-position:center;
        transform:scale(1.08); filter:saturate(1.05); }
  .bg::after { content:''; position:absolute; inset:0;
        background:
          radial-gradient(60% 45% at 50% 42%, color-mix(in srgb, var(--a) 34%, transparent), transparent 70%),
          linear-gradient(180deg, rgba(6,8,12,.55) 0%, rgba(6,8,12,.15) 32%, rgba(6,8,12,.72) 78%, rgba(6,8,12,.94) 100%); }
  .glow { position:absolute; left:50%; top:46%; width:78%; height:78%; transform:translate(-50%,-50%);
        background:radial-gradient(circle, color-mix(in srgb, var(--a) 55%, transparent), transparent 62%);
        filter:blur(20px); }
  .brand { position:absolute; display:flex; align-items:center; gap:16px; z-index:5; }
  .brand img { filter:drop-shadow(0 4px 10px rgba(0,0,0,.6)); }
  .brand .wm { font-family:'Bebas Neue','Arial Black',sans-serif; line-height:.9; letter-spacing:2px; }
  .brand .wm b { color:#fff; } .brand .wm i { color:var(--a); font-style:normal; }
  .card { position:absolute; left:50%; transform:translateX(-50%); border-radius:32px; overflow:hidden;
        border:5px solid transparent;
        background:
          linear-gradient(#0b0d12,#0b0d12) padding-box,
          linear-gradient(160deg, var(--a), color-mix(in srgb, var(--c) 70%, #000)) border-box;
        box-shadow:0 24px 70px rgba(0,0,0,.6), 0 0 60px color-mix(in srgb, var(--a) 45%, transparent); }
  .card img { display:block; width:100%; height:100%; object-fit:cover; }
  .name { position:absolute; left:50%; transform:translateX(-50%); text-align:center;
        font-family:'Bebas Neue','Arial Black',sans-serif; line-height:.86;
        background:linear-gradient(180deg,#fff, var(--a)); -webkit-background-clip:text; background-clip:text;
        color:transparent; filter:drop-shadow(0 6px 14px rgba(0,0,0,.85)); }
  .tag { position:absolute; left:50%; transform:translateX(-50%); text-align:center;
        font-family:'Oswald','Arial',sans-serif; font-weight:500; text-transform:uppercase;
        color:#e9eef7; text-shadow:0 3px 10px rgba(0,0,0,.8); }
  .cta { position:absolute; left:50%; transform:translateX(-50%); display:flex; align-items:center; gap:18px; z-index:5; }
  .pill { font-family:'Oswald',sans-serif; font-weight:700; text-transform:uppercase; letter-spacing:1px;
        color:#0b0d12; background:linear-gradient(180deg,#fff,var(--a)); border-radius:999px; white-space:nowrap;
        box-shadow:0 10px 26px color-mix(in srgb, var(--a) 45%, transparent); }
  .handle { font-family:'Oswald',sans-serif; font-weight:500; color:#cdd6e6; letter-spacing:1px; }
`;

function characterHtml({ id, name, tagline, color, accent, arenaId, w, h }) {
  const story = h > w;
  const cardW = story ? 780 : 560;
  const cardH = story ? 780 : 560;
  const cardTop = story ? 380 : 150;
  const nameSize = story ? 210 : 130;
  const nameTop = story ? 1210 : 706;
  const tagTop = Math.round(nameTop + nameSize * 0.86 + (story ? 8 : 6));
  return `<!doctype html><html><head><meta charset="utf-8">${FONTS}<style>
    html,body{width:${w}px;height:${h}px;} ${baseCss(accent, color)}
    .brand{ top:${story ? 56 : 44}px; left:${story ? 56 : 44}px; }
    .brand img{ width:${story ? 74 : 60}px; height:${story ? 74 : 60}px; }
    .brand .wm{ font-size:${story ? 46 : 38}px; }
    .card{ top:${cardTop}px; width:${cardW}px; height:${cardH}px; }
    .name{ top:${nameTop}px; font-size:${nameSize}px; letter-spacing:3px; }
    .tag{ top:${tagTop}px; font-size:${story ? 44 : 34}px; letter-spacing:${story ? 8 : 6}px; }
    .cta{ bottom:${story ? 120 : 56}px; }
    .pill{ font-size:${story ? 40 : 32}px; padding:${story ? '16px 34px' : '13px 28px'}; }
    .handle{ font-size:${story ? 36 : 28}px; }
  </style></head><body>
    <div class="stage">
      <div class="bg" style="background-image:url('${arena(arenaId)}')"></div>
      <div class="glow"></div>
      <div class="brand"><img src="${LOGO}"><div class="wm"><b>BRAWL</b><i>ARENA</i></div></div>
      <div class="card"><img src="${portrait(id)}"></div>
      <div class="name">${name}</div>
      <div class="tag">${tagline}</div>
      <div class="cta"><span class="pill">${CTA}</span><span class="handle">@brawlarenagame</span></div>
    </div>
  </body></html>`;
}

function heroHtml({ w, h }) {
  const story = h > w;
  const strip = ROSTER.slice(0, story ? 4 : 5)
    .map(([id, , , , acc]) => `<div class="mini" style="--a:${acc}"><img src="${portrait(id)}"></div>`)
    .join('');
  return `<!doctype html><html><head><meta charset="utf-8">${FONTS}<style>
    html,body{width:${w}px;height:${h}px;} ${baseCss('#ff7a2f', '#ff4d2a')}
    .logo{ position:absolute; left:50%; transform:translateX(-50%); top:${story ? 360 : 190}px;
      width:${story ? 300 : 260}px; height:${story ? 300 : 260}px;
      filter:drop-shadow(0 18px 50px rgba(0,0,0,.7)); }
    .title{ position:absolute; left:50%; transform:translateX(-50%); top:${story ? 690 : 470}px;
      font-family:'Bebas Neue','Arial Black',sans-serif; line-height:.86; text-align:center;
      font-size:${story ? 230 : 190}px; letter-spacing:4px; filter:drop-shadow(0 8px 20px rgba(0,0,0,.85)); }
    .title b{color:#fff;} .title i{color:var(--a); font-style:normal;}
    .sub{ position:absolute; left:50%; transform:translateX(-50%); top:${story ? 990 : 690}px;
      font-family:'Oswald',sans-serif; font-weight:500; text-transform:uppercase; letter-spacing:${story ? 12 : 9}px;
      font-size:${story ? 46 : 40}px; color:#e9eef7; text-shadow:0 3px 10px rgba(0,0,0,.85); white-space:nowrap; }
    .strip{ position:absolute; left:0; right:0; bottom:${story ? 300 : 190}px; display:flex; justify-content:center; gap:${story ? 22 : 26}px; }
    .mini{ width:150px; height:150px; border-radius:20px; overflow:hidden;
      border:4px solid var(--a); box-shadow:0 12px 30px rgba(0,0,0,.55), 0 0 26px color-mix(in srgb, var(--a) 40%, transparent); }
    .mini img{ width:100%; height:100%; object-fit:cover; }
    .cta{ bottom:${story ? 120 : 60}px; }
    .pill{ font-size:${story ? 44 : 36}px; padding:${story ? '18px 40px' : '15px 32px'}; white-space:nowrap;
      font-family:'Oswald',sans-serif; font-weight:700; text-transform:uppercase; letter-spacing:1px; color:#0b0d12;
      background:linear-gradient(180deg,#fff,var(--a)); border-radius:999px; box-shadow:0 12px 30px color-mix(in srgb, var(--a) 45%, transparent); }
    .handle{ font-size:${story ? 38 : 32}px; font-family:'Oswald',sans-serif; color:#cdd6e6; letter-spacing:1px; }
  </style></head><body>
    <div class="stage">
      <div class="bg" style="background-image:url('${arena('colosseum')}')"></div>
      <div class="glow"></div>
      <img class="logo" src="${LOGO}">
      <div class="title"><b>BRAWL</b><i>ARENA</i></div>
      <div class="sub">Pick a fighter · Own the arena</div>
      <div class="strip">${strip}</div>
      <div class="cta"><span class="pill">${CTA}</span><span class="handle">@brawlarenagame</span></div>
    </div>
  </body></html>`;
}

const SIZES = { square: [1080, 1080], story: [1080, 1920] };

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--no-sandbox', '--hide-scrollbars', '--disable-gpu'],
});

async function render(html, w, h, file) {
  const page = await browser.newPage();
  await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
  await page.setContent(html, { waitUntil: 'networkidle0' });
  try { await page.evaluate(() => document.fonts.ready); } catch { /* offline: fallback fonts */ }
  await new Promise((r) => setTimeout(r, 250));
  await page.screenshot({ path: path.join(OUT, file), type: 'png' });
  await page.close();
  console.log('  ✓', file);
}

console.log('Hero cards…');
await render(heroHtml({ w: 1080, h: 1080 }), 1080, 1080, 'hero_square.png');
await render(heroHtml({ w: 1080, h: 1920 }), 1080, 1920, 'hero_story.png');

for (const list of [ROSTER, PREMIUM]) {
  for (const [id, name, tagline, color, accent, arenaId] of list) {
    console.log(`${name}…`);
    for (const [tag, [w, h]] of Object.entries(SIZES)) {
      const html = characterHtml({ id, name, tagline, color, accent, arenaId, w, h });
      await render(html, w, h, `${id}_${tag}.png`);
    }
  }
}

await browser.close();
console.log('\nDone →', OUT);
