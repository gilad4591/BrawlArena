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
const OUT = path.join(ROOT, process.env.OUT_DIR || 'social-kit');
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
// Clean branded domain reads far better than a raw shortener. Set LINK_TEXT=none
// to drop the link line entirely (e.g. the Play Store set relies on "link in bio").
const LINK_RAW = process.env.LINK_TEXT ?? 'brawl-arena.com';
const LINK = LINK_RAW === 'none' ? '' : LINK_RAW;
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
  // The non-story branch was originally tuned for a 1080x1080 square; the
  // new 1200x630 Facebook-feed size shares that branch (h <= w) but is only
  // 630px tall, so every absolute pixel value below is scaled by the actual
  // height vs. the 1080 baseline — keeps the same poster-crop composition
  // (character card + name + CTA), just proportionally smaller, with more
  // of the arena backdrop visible on the sides for the wider canvas.
  const s = story ? 1 : h / 1080;
  const cardW = story ? 780 : Math.round(520 * s);
  const cardH = story ? 780 : Math.round(520 * s);
  const cardTop = story ? 360 : Math.round(118 * s);
  const nameSize = story ? 210 : Math.round(118 * s);
  const nameTop = story ? 1200 : Math.round(648 * s);
  const barTop = Math.round(nameTop + nameSize * 0.9);
  const tagTop = barTop + (story ? 26 : Math.round(18 * s));
  return `<!doctype html><html><head><meta charset="utf-8">${FONTS}<style>
    html,body{width:${w}px;height:${h}px;} ${baseCss(accent, color)}
    .brand{ top:${story ? 56 : Math.round(44 * s)}px; left:${story ? 56 : Math.round(44 * s)}px; }
    .brand img{ width:${story ? 74 : Math.round(60 * s)}px; height:${story ? 74 : Math.round(60 * s)}px; }
    .brand .wm{ font-size:${story ? 46 : Math.round(38 * s)}px; }
    .ribbon{ top:${story ? 56 : Math.round(40 * s)}px; right:${story ? -68 : Math.round(-60 * s)}px; width:${story ? 268 : Math.round(232 * s)}px;
      font-size:${story ? 30 : Math.round(24 * s)}px; letter-spacing:2px; padding:${story ? '10px 0' : `${Math.round(8 * s)}px 0`}; }
    .card{ top:${cardTop}px; width:${cardW}px; height:${cardH}px; }
    .name{ top:${nameTop}px; font-size:${nameSize}px; letter-spacing:3px; }
    .accentbar{ top:${barTop}px; width:${story ? 360 : Math.round(220 * s)}px; }
    .tag{ top:${tagTop}px; font-size:${story ? 44 : Math.round(30 * s)}px; letter-spacing:${story ? 8 : Math.round(5 * s)}px; max-width:${story ? 900 : Math.round(720 * s)}px; }
    .cta{ bottom:${story ? 118 : Math.round(46 * s)}px; }
    .pill{ font-size:${story ? 44 : Math.round(34 * s)}px; padding:${story ? '17px 40px' : `${Math.round(13 * s)}px ${Math.round(30 * s)}px`}; }
    .link{ font-size:${story ? 38 : Math.round(30 * s)}px; }
    .handle{ font-size:${story ? 34 : Math.round(26 * s)}px; }
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
  // See characterHtml's `s` comment — same reasoning for the 1200x630 FB size.
  const s = story ? 1 : h / 1080;
  const strip = ROSTER.slice(0, story ? 4 : 5)
    .map(([id, , , , acc]) => `<div class="mini" style="--a:${acc}"><img src="${portrait(id)}"></div>`)
    .join('');
  const badges = FEATURES.map((f) => `<span class="badge">${f}</span>`).join('');
  return `<!doctype html><html><head><meta charset="utf-8">${FONTS}<style>
    html,body{width:${w}px;height:${h}px;} ${baseCss('#ff7a2f', '#ff4d2a')}
    .ribbon{ top:${story ? 56 : Math.round(40 * s)}px; right:${story ? -68 : Math.round(-60 * s)}px; width:${story ? 268 : Math.round(232 * s)}px;
      font-size:${story ? 30 : Math.round(24 * s)}px; letter-spacing:2px; padding:${story ? '10px 0' : `${Math.round(8 * s)}px 0`}; }
    .logo{ position:absolute; left:50%; transform:translateX(-50%); top:${story ? 320 : Math.round(96 * s)}px;
      width:${story ? 300 : Math.round(210 * s)}px; height:${story ? 300 : Math.round(210 * s)}px;
      filter:drop-shadow(0 18px 50px rgba(0,0,0,.7)); }
    .title{ position:absolute; left:50%; transform:translateX(-50%); top:${story ? 650 : Math.round(320 * s)}px;
      font-family:'Bebas Neue','Arial Black',sans-serif; line-height:.86; text-align:center;
      font-size:${story ? 230 : Math.round(170 * s)}px; letter-spacing:4px; filter:drop-shadow(0 8px 20px rgba(0,0,0,.85)); }
    .title b{color:#fff;} .title i{color:var(--a); font-style:normal;}
    .sub{ position:absolute; left:50%; transform:translateX(-50%); top:${story ? 950 : Math.round(512 * s)}px;
      font-family:'Oswald',sans-serif; font-weight:500; text-transform:uppercase; letter-spacing:${story ? 12 : Math.round(9 * s)}px;
      font-size:${story ? 46 : Math.round(38 * s)}px; color:#e9eef7; text-shadow:0 3px 10px rgba(0,0,0,.85); white-space:nowrap; }
    .badges{ position:absolute; left:0; right:0; top:${story ? 1030 : Math.round(588 * s)}px; display:flex; justify-content:center;
      gap:${story ? 16 : Math.round(14 * s)}px; z-index:5; }
    .badge{ font-family:'Oswald',sans-serif; font-weight:700; text-transform:uppercase; letter-spacing:1px;
      font-size:${story ? 30 : Math.round(26 * s)}px; color:#fff; padding:${story ? '9px 20px' : `${Math.round(8 * s)}px ${Math.round(16 * s)}px`}; border-radius:999px;
      background:rgba(255,255,255,.08); border:2px solid color-mix(in srgb, var(--a) 60%, transparent);
      backdrop-filter:blur(4px); white-space:nowrap; }
    .strip{ position:absolute; left:0; right:0; bottom:${story ? 320 : Math.round(252 * s)}px; display:flex; justify-content:center; gap:${story ? 22 : Math.round(26 * s)}px; }
    .mini{ width:${story ? 150 : Math.round(140 * s)}px; height:${story ? 150 : Math.round(140 * s)}px; border-radius:20px; overflow:hidden;
      border:4px solid var(--a); box-shadow:0 12px 30px rgba(0,0,0,.55), 0 0 26px color-mix(in srgb, var(--a) 40%, transparent); }
    .mini img{ width:100%; height:100%; object-fit:cover; }
    .cta{ bottom:${story ? 110 : Math.round(44 * s)}px; }
    .pill{ font-size:${story ? 46 : Math.round(38 * s)}px; padding:${story ? '18px 44px' : `${Math.round(15 * s)}px ${Math.round(34 * s)}px`}; }
    .link{ font-size:${story ? 40 : Math.round(32 * s)}px; }
    .handle{ font-size:${story ? 36 : Math.round(28 * s)}px; }
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
  // See characterHtml's `s` comment — same reasoning for the 1200x630 FB size.
  const s = story ? 1 : h / 1080;
  const cols = story ? 3 : 5;
  const tile = story ? 236 : Math.round(150 * s);
  const gap = story ? 20 : Math.round(18 * s);
  const gridW = cols * tile + (cols - 1) * gap;
  const tiles = ALL.map(([id, name, , , acc]) => `
    <div class="rtile" style="--a:${acc}">
      <img src="${portrait(id)}"><b>${name}</b>
    </div>`).join('');
  return `<!doctype html><html><head><meta charset="utf-8">${FONTS}<style>
    html,body{width:${w}px;height:${h}px;} ${baseCss('#ff7a2f', '#ff4d2a')}
    .brand{ top:${story ? 56 : Math.round(44 * s)}px; left:${story ? 56 : Math.round(44 * s)}px; }
    .brand img{ width:${story ? 74 : Math.round(60 * s)}px; height:${story ? 74 : Math.round(60 * s)}px; }
    .brand .wm{ font-size:${story ? 46 : Math.round(38 * s)}px; }
    .ribbon{ top:${story ? 56 : Math.round(40 * s)}px; right:${story ? -68 : Math.round(-60 * s)}px; width:${story ? 268 : Math.round(232 * s)}px;
      font-size:${story ? 30 : Math.round(24 * s)}px; letter-spacing:2px; padding:${story ? '10px 0' : `${Math.round(8 * s)}px 0`}; }
    .heading{ position:absolute; left:50%; transform:translateX(-50%); top:${story ? 170 : Math.round(128 * s)}px; text-align:center;
      font-family:'Bebas Neue','Arial Black',sans-serif; font-size:${story ? 128 : Math.round(94 * s)}px; letter-spacing:2px;
      line-height:.9; white-space:nowrap; filter:drop-shadow(0 6px 16px rgba(0,0,0,.85)); }
    .heading b{color:#fff;} .heading i{color:var(--a); font-style:normal;}
    .grid{ position:absolute; left:50%; transform:translateX(-50%); top:${story ? 330 : Math.round(260 * s)}px;
      width:${gridW}px; display:flex; flex-wrap:wrap; justify-content:center; gap:${gap}px; }
    .rtile{ width:${tile}px; height:${tile}px; border-radius:18px; overflow:hidden; position:relative;
      border:3px solid var(--a); box-shadow:0 10px 24px rgba(0,0,0,.5); }
    .rtile img{ width:100%; height:100%; object-fit:cover; }
    .rtile b{ position:absolute; left:0; right:0; bottom:0; text-align:center; font-family:'Bebas Neue',sans-serif;
      font-weight:400; letter-spacing:1px; font-size:${story ? 34 : Math.round(22 * s)}px; color:#fff; padding:${story ? '20px 4px 6px' : `${Math.round(14 * s)}px 4px ${Math.round(4 * s)}px`};
      background:linear-gradient(transparent, rgba(0,0,0,.82)); }
    .cta{ bottom:${story ? 110 : Math.round(78 * s)}px; }
    .pill{ font-size:${story ? 46 : Math.round(38 * s)}px; padding:${story ? '18px 44px' : `${Math.round(15 * s)}px ${Math.round(34 * s)}px`}; }
    .link{ font-size:${story ? 40 : Math.round(32 * s)}px; }
    .handle{ font-size:${story ? 36 : Math.round(28 * s)}px; }
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

// Feature-highlight card: sells the cosmetics system (auras / frames /
// special FX) rather than a specific fighter — a different marketing angle
// from the roster/character cards above, good for a "did you know" style post.
function featuresHtml({ w, h }) {
  const story = h > w;
  const s = story ? 1 : h / 1080;
  const rows = [
    ['⚡', 'ELEMENTAL AURAS', 'A glowing energy field, unique to every element'],
    ['🖼️', 'RARE PORTRAIT FRAMES', 'Show off your rank in every menu'],
    ['💥', 'SIGNATURE SPECIAL FX', 'Make your finishing blow unforgettable'],
  ];
  const rowsHtml = rows
    .map(
      ([icon, title, sub], i) => `
    <div class="frow" style="top:${(story ? 1020 : Math.round(555 * s)) + i * (story ? 175 : Math.round(95 * s))}px">
      <span class="ficon">${icon}</span>
      <span class="ftext"><b>${title}</b><i>${sub}</i></span>
    </div>`
    )
    .join('');
  return `<!doctype html><html><head><meta charset="utf-8">${FONTS}<style>
    html,body{width:${w}px;height:${h}px;} ${baseCss('#c06bff', '#7a3fb0')}
    .brand{ top:${story ? 56 : Math.round(44 * s)}px; left:${story ? 56 : Math.round(44 * s)}px; }
    .brand img{ width:${story ? 74 : Math.round(60 * s)}px; height:${story ? 74 : Math.round(60 * s)}px; }
    .brand .wm{ font-size:${story ? 46 : Math.round(38 * s)}px; }
    .card{ top:${story ? 300 : Math.round(120 * s)}px; left:50%; transform:translateX(-50%); width:${story ? 620 : Math.round(360 * s)}px; height:${story ? 620 : Math.round(360 * s)}px; }
    .heading{ position:absolute; left:50%; transform:translateX(-50%); top:${story ? 170 : Math.round(36 * s)}px; text-align:center;
      font-family:'Bebas Neue','Arial Black',sans-serif; font-size:${story ? 100 : Math.round(66 * s)}px; letter-spacing:3px;
      line-height:.9; white-space:nowrap; filter:drop-shadow(0 6px 16px rgba(0,0,0,.85)); }
    .heading b{color:#fff;} .heading i{color:var(--a); font-style:normal;}
    .frow{ position:absolute; left:50%; transform:translateX(-50%); display:flex; align-items:center;
      gap:${story ? 22 : Math.round(14 * s)}px; width:${story ? 880 : Math.round(880 * s)}px; }
    .ficon{ font-size:${story ? 64 : Math.round(38 * s)}px; filter:drop-shadow(0 4px 10px rgba(0,0,0,.6)); flex-shrink:0; }
    .ftext{ display:flex; flex-direction:column; gap:${story ? 4 : Math.round(2 * s)}px; }
    .ftext b{ font-family:'Oswald',sans-serif; font-weight:700; letter-spacing:1px; font-size:${story ? 40 : Math.round(26 * s)}px;
      color:#fff; text-shadow:0 2px 8px rgba(0,0,0,.8); }
    .ftext i{ font-style:normal; font-family:'Montserrat',sans-serif; font-weight:600; font-size:${story ? 28 : Math.round(18 * s)}px;
      color:#cdd6e6; text-shadow:0 2px 6px rgba(0,0,0,.8); }
    .cta{ bottom:${story ? 118 : Math.round(40 * s)}px; }
    .pill{ font-size:${story ? 44 : Math.round(34 * s)}px; padding:${story ? '17px 40px' : `${Math.round(13 * s)}px ${Math.round(30 * s)}px`}; }
    .link{ font-size:${story ? 38 : Math.round(30 * s)}px; }
    .handle{ font-size:${story ? 34 : Math.round(26 * s)}px; }
  </style></head><body>
    <div class="stage">
      <div class="bg" style="background-image:url('${arena('sky_temple')}')"></div>
      <div class="glow"></div>
      <div class="vig"></div>
      <div class="brand"><img src="${LOGO}"><div class="wm"><b>BRAWL</b><i>ARENA</i></div></div>
      <div class="card"><img src="${portrait('solaris')}"></div>
      <div class="heading"><b>MAKE IT </b><i>YOURS</i></div>
      ${rowsHtml}
      <div class="cta">
        <span class="pill">${CTA}</span>
        ${LINK_SPAN}
        <span class="handle">${HANDLE}</span>
      </div>
    </div>
  </body></html>`;
}

// "Now available" platform card — plain text pills instead of official
// App Store/Play Store badge artwork (avoids any trademarked-badge asset
// requirement) while still communicating cross-platform availability.
function platformsHtml({ w, h }) {
  const story = h > w;
  const s = story ? 1 : h / 1080;
  const strip = [...ROSTER.slice(0, 3), ...PREMIUM.slice(0, 2)]
    .map(([id, , , , acc]) => `<div class="mini" style="--a:${acc}"><img src="${portrait(id)}"></div>`)
    .join('');
  return `<!doctype html><html><head><meta charset="utf-8">${FONTS}<style>
    html,body{width:${w}px;height:${h}px;} ${baseCss('#4fd6ff', '#2f6fd6')}
    .logo{ position:absolute; left:50%; transform:translateX(-50%); top:${story ? 260 : Math.round(80 * s)}px;
      width:${story ? 220 : Math.round(150 * s)}px; height:${story ? 220 : Math.round(150 * s)}px;
      filter:drop-shadow(0 18px 50px rgba(0,0,0,.7)); }
    .title{ position:absolute; left:50%; transform:translateX(-50%); top:${story ? 520 : Math.round(240 * s)}px;
      font-family:'Bebas Neue','Arial Black',sans-serif; line-height:.86; text-align:center;
      font-size:${story ? 150 : Math.round(108 * s)}px; letter-spacing:4px; filter:drop-shadow(0 8px 20px rgba(0,0,0,.85)); }
    .title b{color:#fff;} .title i{color:var(--a); font-style:normal;}
    .sub{ position:absolute; left:50%; transform:translateX(-50%); top:${story ? 700 : Math.round(360 * s)}px;
      font-family:'Oswald',sans-serif; font-weight:500; text-transform:uppercase; letter-spacing:${story ? 10 : Math.round(7 * s)}px;
      font-size:${story ? 40 : Math.round(30 * s)}px; color:#e9eef7; text-shadow:0 3px 10px rgba(0,0,0,.85); white-space:nowrap; }
    .plats{ position:absolute; left:0; right:0; top:${story ? 800 : Math.round(420 * s)}px; display:flex; justify-content:center;
      gap:${story ? 20 : Math.round(16 * s)}px; z-index:5; }
    .plat{ font-family:'Oswald',sans-serif; font-weight:700; text-transform:uppercase; letter-spacing:1px;
      font-size:${story ? 34 : Math.round(26 * s)}px; color:#0b0d12; padding:${story ? '16px 32px' : `${Math.round(12 * s)}px ${Math.round(24 * s)}px`};
      border-radius:16px; background:linear-gradient(180deg,#fff,var(--a));
      box-shadow:0 12px 30px color-mix(in srgb, var(--a) 50%, transparent); white-space:nowrap; }
    .strip{ position:absolute; left:0; right:0; bottom:${story ? 400 : Math.round(260 * s)}px; display:flex; justify-content:center; gap:${story ? 22 : Math.round(20 * s)}px; }
    .mini{ width:${story ? 150 : Math.round(120 * s)}px; height:${story ? 150 : Math.round(120 * s)}px; border-radius:20px; overflow:hidden;
      border:4px solid var(--a); box-shadow:0 12px 30px rgba(0,0,0,.55), 0 0 26px color-mix(in srgb, var(--a) 40%, transparent); }
    .mini img{ width:100%; height:100%; object-fit:cover; }
    .cta{ bottom:${story ? 110 : Math.round(44 * s)}px; }
    .pill{ font-size:${story ? 46 : Math.round(38 * s)}px; padding:${story ? '18px 44px' : `${Math.round(15 * s)}px ${Math.round(34 * s)}px`}; }
    .link{ font-size:${story ? 40 : Math.round(32 * s)}px; }
    .handle{ font-size:${story ? 36 : Math.round(28 * s)}px; }
  </style></head><body>
    <div class="stage">
      <div class="bg" style="background-image:url('${arena('neon_rooftop')}')"></div>
      <div class="glow"></div>
      <div class="vig"></div>
      <img class="logo" src="${LOGO}">
      <div class="title"><b>BRAWL</b><i>ARENA</i></div>
      <div class="sub">Now available — everywhere</div>
      <div class="plats">
        <span class="plat">📱 iOS</span>
        <span class="plat">🤖 Android</span>
        <span class="plat">🌐 Web</span>
      </div>
      <div class="strip">${strip}</div>
      <div class="cta">
        <span class="pill">${CTA}</span>
        ${LINK_SPAN}
        <span class="handle">${HANDLE}</span>
      </div>
    </div>
  </body></html>`;
}

// `fb`: Facebook's standard landscape link/feed image (1200x630) — also
// works fine for a Twitter/X card or a wide website hero. Shares the
// non-story ("square") branch of each template (h <= w), just wider — the
// centered layout reads as a poster crop with more visible background on
// the sides, which still looks intentional rather than broken.
const SIZES = { square: [1080, 1080], story: [1080, 1920], fb: [1200, 630] };

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
for (const [tag, [w, h]] of Object.entries(SIZES)) {
  await render(heroHtml({ w, h }), w, h, `hero_${tag}.png`);
}

console.log('Roster cards…');
for (const [tag, [w, h]] of Object.entries(SIZES)) {
  await render(rosterHtml({ w, h }), w, h, `roster_${tag}.png`);
}

console.log('Features card…');
for (const [tag, [w, h]] of Object.entries(SIZES)) {
  await render(featuresHtml({ w, h }), w, h, `features_${tag}.png`);
}

console.log('Platforms card…');
for (const [tag, [w, h]] of Object.entries(SIZES)) {
  await render(platformsHtml({ w, h }), w, h, `platforms_${tag}.png`);
}

// SKIP_CHARS=1 lets a quick layout-tuning iteration re-render just the
// hero/roster/features/platforms cards above without redoing all ~40
// per-character renders (each is a fresh Puppeteer page navigation).
if (!process.env.SKIP_CHARS) {
  for (const list of [ROSTER, PREMIUM]) {
    for (const [id, name, tagline, color, accent, arenaId] of list) {
      console.log(`${name}…`);
      for (const [tag, [w, h]] of Object.entries(SIZES)) {
        const html = characterHtml({ id, name, tagline, color, accent, arenaId, w, h });
        await render(html, w, h, `${id}_${tag}.png`);
      }
    }
  }
}

await browser.close();
console.log('\nDone →', OUT);
