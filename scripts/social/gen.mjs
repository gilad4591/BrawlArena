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

// Launch-day copy. Override any of these via env for a pre-launch teaser run
// (e.g. CTA_TEXT="⏳ Coming Soon" RIBBON_TEXT="Soon").
const CTA = process.env.CTA_TEXT || '▶ PLAY FREE';
// Clean branded domain reads far better than a raw shortener. Set LINK_TEXT=''
// to drop the link line entirely (rely on "link in bio").
const LINK = process.env.LINK_TEXT ?? 'brawl-arena.com';
const HANDLE = process.env.HANDLE_TEXT || '@brawlarenagame';
const RIBBON = process.env.RIBBON_TEXT || 'OUT NOW';
const LINK_SPAN = LINK ? `<span class="link">${LINK}</span>` : '';

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
const ALL = [...ROSTER, ...PREMIUM];
const FEATURES = [`${ALL.length} FIGHTERS`, '8 ARENAS', 'SOLO · MULTIPLAYER'];

// Embed the web fonts as base64 @font-face so rendering has ZERO network
// dependency at screenshot time. Google Fonts over the network proved flaky
// here — the first cards would fall back to a wide system font and overflow.
// Fetched once, then cached to disk for subsequent offline runs.
const FONT_CSS_URL =
  'https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Oswald:wght@500;700&family=Montserrat:wght@600;800&display=swap';
const FONT_CACHE = path.join(ROOT, 'scripts', 'social', '_fonts_embedded.css');

async function buildFontCss() {
  if (fs.existsSync(FONT_CACHE)) return fs.readFileSync(FONT_CACHE, 'utf8');
  // A Chrome UA makes Google return woff2 (smaller, well-supported by headless).
  const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';
  let css = await (await fetch(FONT_CSS_URL, { headers: { 'user-agent': ua } })).text();
  const urls = [...css.matchAll(/url\((https:\/\/[^)]+\.woff2)\)/g)].map((m) => m[1]);
  for (const u of [...new Set(urls)]) {
    const buf = Buffer.from(await (await fetch(u)).arrayBuffer());
    css = css.split(u).join(`data:font/woff2;base64,${buf.toString('base64')}`);
  }
  fs.writeFileSync(FONT_CACHE, css);
  return css;
}

let FONTS;
try {
  FONTS = `<style>${await buildFontCss()}</style>`;
} catch (e) {
  console.warn('Font embed failed, using <link> fallback:', e.message);
  FONTS = `<link href="${FONT_CSS_URL}" rel="stylesheet">`;
}

const baseCss = (accent, color) => `
  * { margin:0; padding:0; box-sizing:border-box; }
  :root { --a:${accent}; --c:${color}; }
  body { font-family:'Montserrat','Arial Black',sans-serif; color:#fff; overflow:hidden; }
  .stage { position:relative; width:100%; height:100%; overflow:hidden; background:#0b0d12; }
  .bg { position:absolute; inset:0; background-size:cover; background-position:center;
        transform:scale(1.08); filter:saturate(1.08) contrast(1.04); }
  .bg::after { content:''; position:absolute; inset:0;
        background:
          radial-gradient(62% 46% at 50% 40%, color-mix(in srgb, var(--a) 36%, transparent), transparent 70%),
          linear-gradient(180deg, rgba(6,8,12,.55) 0%, rgba(6,8,12,.12) 30%, rgba(6,8,12,.74) 76%, rgba(6,8,12,.96) 100%); }
  /* Cinematic corner vignette + accent rim for a more "poster" feel. */
  .vig { position:absolute; inset:0; pointer-events:none;
        box-shadow: inset 0 0 200px rgba(0,0,0,.85), inset 0 0 40px color-mix(in srgb, var(--a) 30%, transparent); }
  .glow { position:absolute; left:50%; top:44%; width:80%; height:80%; transform:translate(-50%,-50%);
        background:radial-gradient(circle, color-mix(in srgb, var(--a) 58%, transparent), transparent 62%);
        filter:blur(22px); }
  .brand { position:absolute; display:flex; align-items:center; gap:16px; z-index:6; }
  .brand img { filter:drop-shadow(0 4px 10px rgba(0,0,0,.6)); }
  .brand .wm { font-family:'Bebas Neue','Arial Black',sans-serif; line-height:.9; letter-spacing:2px; }
  .brand .wm b { color:#fff; } .brand .wm i { color:var(--a); font-style:normal; }
  /* Diagonal "OUT NOW" corner ribbon (top-right). */
  .ribbon { position:absolute; z-index:7; text-align:center; transform:rotate(45deg);
        font-family:'Bebas Neue','Arial Black',sans-serif; color:#fff; font-weight:400;
        background:linear-gradient(90deg,#ff3b3b,#ff8a2f);
        box-shadow:0 8px 22px rgba(0,0,0,.55); text-shadow:0 2px 4px rgba(0,0,0,.4); }
  .card { position:absolute; left:50%; transform:translateX(-50%); border-radius:32px; overflow:hidden;
        border:5px solid transparent;
        background:
          linear-gradient(#0b0d12,#0b0d12) padding-box,
          linear-gradient(160deg, var(--a), color-mix(in srgb, var(--c) 70%, #000)) border-box;
        box-shadow:0 24px 70px rgba(0,0,0,.6), 0 0 60px color-mix(in srgb, var(--a) 45%, transparent); }
  .card::after { content:''; position:absolute; inset:0; border-radius:28px; pointer-events:none;
        background:linear-gradient(180deg, rgba(255,255,255,.16), transparent 34%); }
  .card img { display:block; width:100%; height:100%; object-fit:cover; }
  .name { position:absolute; left:50%; transform:translateX(-50%); text-align:center;
        font-family:'Bebas Neue','Arial Black',sans-serif; line-height:.86;
        background:linear-gradient(180deg,#fff, var(--a)); -webkit-background-clip:text; background-clip:text;
        color:transparent; filter:drop-shadow(0 6px 14px rgba(0,0,0,.85)); }
  .accentbar { position:absolute; left:50%; transform:translateX(-50%); height:7px; border-radius:999px;
        background:linear-gradient(90deg, transparent, var(--a), transparent);
        box-shadow:0 0 18px color-mix(in srgb, var(--a) 60%, transparent); }
  .tag { position:absolute; left:50%; transform:translateX(-50%); text-align:center;
        font-family:'Oswald','Arial',sans-serif; font-weight:500; text-transform:uppercase;
        color:#e9eef7; text-shadow:0 3px 10px rgba(0,0,0,.8); }
  .cta { position:absolute; left:50%; transform:translateX(-50%); display:flex; flex-direction:column;
        align-items:center; gap:12px; z-index:6; }
  .pill { font-family:'Oswald',sans-serif; font-weight:700; text-transform:uppercase; letter-spacing:1px;
        color:#0b0d12; background:linear-gradient(180deg,#fff,var(--a)); border-radius:999px; white-space:nowrap;
        box-shadow:0 12px 30px color-mix(in srgb, var(--a) 50%, transparent); }
  .link { font-family:'Oswald',sans-serif; font-weight:700; color:#fff; letter-spacing:1px; white-space:nowrap;
        text-shadow:0 2px 8px rgba(0,0,0,.8); }
  .handle { font-family:'Oswald',sans-serif; font-weight:500; color:#cdd6e6; letter-spacing:1px; }
`;

function characterHtml({ id, name, tagline, color, accent, arenaId, w, h }) {
  const story = h > w;
  const cardW = story ? 780 : 520;
  const cardH = story ? 780 : 520;
  const cardTop = story ? 360 : 118;
  const nameSize = story ? 210 : 118;
  const nameTop = story ? 1200 : 648;
  const barTop = Math.round(nameTop + nameSize * 0.9);
  const tagTop = barTop + (story ? 26 : 18);
  return `<!doctype html><html><head><meta charset="utf-8">${FONTS}<style>
    html,body{width:${w}px;height:${h}px;} ${baseCss(accent, color)}
    .brand{ top:${story ? 56 : 44}px; left:${story ? 56 : 44}px; }
    .brand img{ width:${story ? 74 : 60}px; height:${story ? 74 : 60}px; }
    .brand .wm{ font-size:${story ? 46 : 38}px; }
    .ribbon{ top:${story ? 56 : 40}px; right:${story ? -68 : -60}px; width:${story ? 268 : 232}px;
      font-size:${story ? 30 : 24}px; letter-spacing:2px; padding:${story ? '10px 0' : '8px 0'}; }
    .card{ top:${cardTop}px; width:${cardW}px; height:${cardH}px; }
    .name{ top:${nameTop}px; font-size:${nameSize}px; letter-spacing:3px; }
    .accentbar{ top:${barTop}px; width:${story ? 360 : 220}px; }
    .tag{ top:${tagTop}px; font-size:${story ? 44 : 30}px; letter-spacing:${story ? 8 : 5}px; max-width:${story ? 900 : 720}px; }
    .cta{ bottom:${story ? 118 : 46}px; }
    .pill{ font-size:${story ? 44 : 34}px; padding:${story ? '17px 40px' : '13px 30px'}; }
    .link{ font-size:${story ? 38 : 30}px; }
    .handle{ font-size:${story ? 34 : 26}px; }
  </style></head><body>
    <div class="stage">
      <div class="bg" style="background-image:url('${arena(arenaId)}')"></div>
      <div class="glow"></div>
      <div class="vig"></div>
      <div class="ribbon">${RIBBON}</div>
      <div class="brand"><img src="${LOGO}"><div class="wm"><b>BRAWL</b><i>ARENA</i></div></div>
      <div class="card"><img src="${portrait(id)}"></div>
      <div class="name">${name}</div>
      <div class="accentbar"></div>
      <div class="tag">${tagline}</div>
      <div class="cta">
        <span class="pill">${CTA}</span>
        ${LINK_SPAN}
        <span class="handle">${HANDLE}</span>
      </div>
    </div>
  </body></html>`;
}

function heroHtml({ w, h }) {
  const story = h > w;
  const strip = ROSTER.slice(0, story ? 4 : 5)
    .map(([id, , , , acc]) => `<div class="mini" style="--a:${acc}"><img src="${portrait(id)}"></div>`)
    .join('');
  const badges = FEATURES.map((f) => `<span class="badge">${f}</span>`).join('');
  return `<!doctype html><html><head><meta charset="utf-8">${FONTS}<style>
    html,body{width:${w}px;height:${h}px;} ${baseCss('#ff7a2f', '#ff4d2a')}
    .ribbon{ top:${story ? 66 : 48}px; right:${story ? -74 : -66}px; width:${story ? 300 : 260}px;
      font-size:${story ? 40 : 34}px; letter-spacing:3px; padding:${story ? '14px 0' : '11px 0'}; }
    .logo{ position:absolute; left:50%; transform:translateX(-50%); top:${story ? 320 : 150}px;
      width:${story ? 300 : 250}px; height:${story ? 300 : 250}px;
      filter:drop-shadow(0 18px 50px rgba(0,0,0,.7)); }
    .title{ position:absolute; left:50%; transform:translateX(-50%); top:${story ? 650 : 430}px;
      font-family:'Bebas Neue','Arial Black',sans-serif; line-height:.86; text-align:center;
      font-size:${story ? 230 : 190}px; letter-spacing:4px; filter:drop-shadow(0 8px 20px rgba(0,0,0,.85)); }
    .title b{color:#fff;} .title i{color:var(--a); font-style:normal;}
    .sub{ position:absolute; left:50%; transform:translateX(-50%); top:${story ? 950 : 650}px;
      font-family:'Oswald',sans-serif; font-weight:500; text-transform:uppercase; letter-spacing:${story ? 12 : 9}px;
      font-size:${story ? 46 : 40}px; color:#e9eef7; text-shadow:0 3px 10px rgba(0,0,0,.85); white-space:nowrap; }
    .badges{ position:absolute; left:0; right:0; top:${story ? 1030 : 720}px; display:flex; justify-content:center;
      gap:${story ? 16 : 14}px; z-index:5; }
    .badge{ font-family:'Oswald',sans-serif; font-weight:700; text-transform:uppercase; letter-spacing:1px;
      font-size:${story ? 30 : 26}px; color:#fff; padding:${story ? '9px 20px' : '8px 16px'}; border-radius:999px;
      background:rgba(255,255,255,.08); border:2px solid color-mix(in srgb, var(--a) 60%, transparent);
      backdrop-filter:blur(4px); white-space:nowrap; }
    .strip{ position:absolute; left:0; right:0; bottom:${story ? 320 : 210}px; display:flex; justify-content:center; gap:${story ? 22 : 26}px; }
    .mini{ width:150px; height:150px; border-radius:20px; overflow:hidden;
      border:4px solid var(--a); box-shadow:0 12px 30px rgba(0,0,0,.55), 0 0 26px color-mix(in srgb, var(--a) 40%, transparent); }
    .mini img{ width:100%; height:100%; object-fit:cover; }
    .cta{ bottom:${story ? 110 : 54}px; }
    .pill{ font-size:${story ? 46 : 38}px; padding:${story ? '18px 44px' : '15px 34px'}; }
    .link{ font-size:${story ? 40 : 32}px; }
    .handle{ font-size:${story ? 36 : 28}px; }
  </style></head><body>
    <div class="stage">
      <div class="bg" style="background-image:url('${arena('colosseum')}')"></div>
      <div class="glow"></div>
      <div class="vig"></div>
      <div class="ribbon">${RIBBON}</div>
      <img class="logo" src="${LOGO}">
      <div class="title"><b>BRAWL</b><i>ARENA</i></div>
      <div class="sub">Pick a fighter · Own the arena</div>
      <div class="badges">${badges}</div>
      <div class="strip">${strip}</div>
      <div class="cta">
        <span class="pill">${CTA}</span>
        ${LINK_SPAN}
        <span class="handle">${HANDLE}</span>
      </div>
    </div>
  </body></html>`;
}

// Full-roster showcase: every fighter in a tidy grid — great "meet the cast" post.
function rosterHtml({ w, h }) {
  const story = h > w;
  const cols = story ? 3 : 5;
  const tile = story ? 236 : 172;
  const gap = story ? 20 : 18;
  const gridW = cols * tile + (cols - 1) * gap;
  const tiles = ALL.map(([id, name, , , acc]) => `
    <div class="rtile" style="--a:${acc}">
      <img src="${portrait(id)}"><b>${name}</b>
    </div>`).join('');
  return `<!doctype html><html><head><meta charset="utf-8">${FONTS}<style>
    html,body{width:${w}px;height:${h}px;} ${baseCss('#ff7a2f', '#ff4d2a')}
    .brand{ top:${story ? 56 : 44}px; left:${story ? 56 : 44}px; }
    .brand img{ width:${story ? 74 : 60}px; height:${story ? 74 : 60}px; }
    .brand .wm{ font-size:${story ? 46 : 38}px; }
    .ribbon{ top:${story ? 66 : 48}px; right:${story ? -74 : -66}px; width:${story ? 300 : 260}px;
      font-size:${story ? 40 : 34}px; letter-spacing:3px; padding:${story ? '14px 0' : '11px 0'}; }
    .heading{ position:absolute; left:50%; transform:translateX(-50%); top:${story ? 150 : 128}px; text-align:center;
      font-family:'Bebas Neue','Arial Black',sans-serif; font-size:${story ? 150 : 120}px; letter-spacing:3px;
      line-height:.9; filter:drop-shadow(0 6px 16px rgba(0,0,0,.85)); }
    .heading b{color:#fff;} .heading i{color:var(--a); font-style:normal;}
    .grid{ position:absolute; left:50%; transform:translateX(-50%); top:${story ? 330 : 296}px;
      width:${gridW}px; display:flex; flex-wrap:wrap; justify-content:center; gap:${gap}px; }
    .rtile{ width:${tile}px; height:${tile}px; border-radius:18px; overflow:hidden; position:relative;
      border:3px solid var(--a); box-shadow:0 10px 24px rgba(0,0,0,.5); }
    .rtile img{ width:100%; height:100%; object-fit:cover; }
    .rtile b{ position:absolute; left:0; right:0; bottom:0; text-align:center; font-family:'Bebas Neue',sans-serif;
      font-weight:400; letter-spacing:1px; font-size:${story ? 34 : 26}px; color:#fff; padding:${story ? '20px 4px 6px' : '16px 4px 5px'};
      background:linear-gradient(transparent, rgba(0,0,0,.82)); }
    .cta{ bottom:${story ? 110 : 54}px; }
    .pill{ font-size:${story ? 46 : 38}px; padding:${story ? '18px 44px' : '15px 34px'}; }
    .link{ font-size:${story ? 40 : 32}px; }
    .handle{ font-size:${story ? 36 : 28}px; }
  </style></head><body>
    <div class="stage">
      <div class="bg" style="background-image:url('${arena('colosseum')}')"></div>
      <div class="glow"></div>
      <div class="vig"></div>
      <div class="ribbon">${RIBBON}</div>
      <div class="brand"><img src="${LOGO}"><div class="wm"><b>BRAWL</b><i>ARENA</i></div></div>
      <div class="heading"><b>MEET THE </b><i>ROSTER</i></div>
      <div class="grid">${tiles}</div>
      <div class="cta">
        <span class="pill">${CTA}</span>
        ${LINK_SPAN}
        <span class="handle">${HANDLE}</span>
      </div>
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
  // Images are inlined data URIs; only the web fonts are remote. Don't gate on
  // networkidle0 (a slow Google Fonts fetch can blow the 30s nav timeout) —
  // wait for DOM, then race font readiness against a short cap.
  await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await Promise.race([
    page.evaluate(() => document.fonts.ready).catch(() => {}),
    new Promise((r) => setTimeout(r, 12000)),
  ]);
  await new Promise((r) => setTimeout(r, 300));
  await page.screenshot({ path: path.join(OUT, file), type: 'png' });
  await page.close();
  console.log('  ✓', file);
}

// Prime Chrome's disk cache with the web fonts BEFORE the first screenshot,
// otherwise the earliest cards fall back to a much wider system font and the
// big display titles overflow the canvas.
async function warmFonts() {
  const page = await browser.newPage();
  await page.setContent(`<!doctype html><html><head>${FONTS}</head><body>
    <span style="font-family:'Bebas Neue'">.</span>
    <span style="font-family:'Oswald';font-weight:700">.</span>
    <span style="font-family:'Montserrat';font-weight:800">.</span></body></html>`,
    { waitUntil: 'domcontentloaded', timeout: 60000 });
  await Promise.race([
    page.evaluate(async () => {
      await Promise.all([
        document.fonts.load("400 40px 'Bebas Neue'"),
        document.fonts.load("700 40px 'Oswald'"),
        document.fonts.load("800 40px 'Montserrat'"),
      ]);
      await document.fonts.ready;
    }).catch(() => {}),
    new Promise((r) => setTimeout(r, 30000)),
  ]);
  await page.close();
}

console.log('Warming fonts…');
await warmFonts();

console.log('Hero cards…');
await render(heroHtml({ w: 1080, h: 1080 }), 1080, 1080, 'hero_square.png');
await render(heroHtml({ w: 1080, h: 1920 }), 1080, 1920, 'hero_story.png');

console.log('Roster cards…');
await render(rosterHtml({ w: 1080, h: 1080 }), 1080, 1080, 'roster_square.png');
await render(rosterHtml({ w: 1080, h: 1920 }), 1080, 1920, 'roster_story.png');

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
