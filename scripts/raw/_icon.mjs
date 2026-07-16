import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const RES = 'android/app/src/main/res';

// ---------------------------------------------------------------- artwork ---
// A bold clenched fist emblem on the brand orange->amber gradient. Drawn from
// simple rounded primitives so it stays crisp and readable from 16px to 512px.
function fist(scale, cx, cy) {
  // fist authored in a ~200x210 box, then scaled/translated to (cx,cy) center.
  const g = (body) => `<g transform="translate(${cx},${cy}) scale(${scale}) translate(-100,-108)">${body}</g>`;
  const knuckle = (x) =>
    `<rect x="${x}" y="34" width="30" height="56" rx="14" fill="url(#hand)"/>`;
  return g(`
    <!-- back of hand -->
    <rect x="34" y="70" width="132" height="108" rx="30" fill="url(#hand)"/>
    <!-- four fingers / knuckles -->
    ${knuckle(40)}${knuckle(74)}${knuckle(108)}${knuckle(142)}
    <!-- knuckle shadow line -->
    <rect x="40" y="86" width="132" height="10" rx="5" fill="#000" opacity="0.18"/>
    <!-- thumb wrapping across the front -->
    <rect x="26" y="120" width="88" height="44" rx="22" fill="url(#thumb)"/>
    <!-- thumb tip -->
    <rect x="86" y="120" width="46" height="44" rx="22" fill="url(#thumb)"/>
    <!-- soft top highlight -->
    <rect x="44" y="40" width="120" height="20" rx="10" fill="#fff" opacity="0.12"/>
  `);
}

const DEFS = `
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#ff7a33"/>
      <stop offset="0.5" stop-color="#ff5d3b"/>
      <stop offset="1" stop-color="#ffb03b"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.5" cy="0.36" r="0.72">
      <stop offset="0" stop-color="#ffe0a0" stop-opacity="0.9"/>
      <stop offset="1" stop-color="#ffe0a0" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="vig" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0.55" stop-color="#000" stop-opacity="0"/>
      <stop offset="1" stop-color="#3a0f00" stop-opacity="0.42"/>
    </linearGradient>
    <linearGradient id="hand" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#2a3350"/>
      <stop offset="1" stop-color="#0c1120"/>
    </linearGradient>
    <linearGradient id="thumb" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#323b5e"/>
      <stop offset="1" stop-color="#141a2c"/>
    </linearGradient>
    <filter id="ds" x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="0" dy="8" stdDeviation="12" flood-color="#000" flood-opacity="0.35"/>
    </filter>
  </defs>`;

// Impact spark lines behind the fist for energy.
function sparks(cx, cy, r) {
  let s = '';
  const n = 12;
  for (let i = 0; i < n; i += 1) {
    const a = (i / n) * Math.PI * 2 + 0.26;
    const x1 = cx + Math.cos(a) * r * 0.72;
    const y1 = cy + Math.sin(a) * r * 0.72;
    const x2 = cx + Math.cos(a) * r;
    const y2 = cy + Math.sin(a) * r;
    s += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#fff" stroke-opacity="0.18" stroke-width="7" stroke-linecap="round"/>`;
  }
  return s;
}

// Full app icon (background + emblem). `round` clips to a circle, `bleed`
// fills the whole square (for the Play Store product icon, which Google masks).
function svgFull({ round = false, bleed = false, rx = 108 } = {}) {
  const clip = round
    ? '<clipPath id="c"><circle cx="256" cy="256" r="256"/></clipPath>'
    : `<clipPath id="c"><rect x="0" y="0" width="512" height="512" rx="${bleed ? 0 : rx}"/></clipPath>`;
  const ring = round
    ? '<circle cx="256" cy="256" r="248" fill="none" stroke="#fff" stroke-opacity="0.16" stroke-width="8"/>'
    : `<rect x="10" y="10" width="492" height="492" rx="${Math.max(0, rx - 10)}" fill="none" stroke="#fff" stroke-opacity="0.16" stroke-width="8"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
    ${DEFS}${clip}
    <g clip-path="url(#c)">
      <rect width="512" height="512" fill="url(#bg)"/>
      <rect width="512" height="512" fill="url(#glow)"/>
      ${sparks(256, 250, 210)}
      <ellipse cx="256" cy="410" rx="120" ry="26" fill="#000" opacity="0.22"/>
      <g filter="url(#ds)">${fist(1.52, 256, 258)}</g>
      <rect width="512" height="512" fill="url(#vig)"/>
      ${ring}
    </g>
  </svg>`;
}

// Adaptive foreground: emblem only, transparent, kept inside the safe zone
// (~66% center of a 108dp canvas), so system masks never clip it.
function svgForeground() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
    ${DEFS}
    ${sparks(256, 250, 150)}
    <g filter="url(#ds)">${fist(1.15, 256, 262)}</g>
  </svg>`;
}

// Horizontal logo lockup: emblem badge + BRAWL ARENA wordmark on a self-
// contained dark plaque, so it reads on any background (social / share image).
function svgLockup() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="320" viewBox="0 0 1024 320">
    ${DEFS}
    <defs>
      <linearGradient id="plaque" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#161d33"/>
        <stop offset="1" stop-color="#0b0e1a"/>
      </linearGradient>
    </defs>
    <rect x="0" y="0" width="1024" height="320" rx="56" fill="url(#plaque)"/>
    <g transform="translate(40,35)">
      <rect x="0" y="0" width="250" height="250" rx="54" fill="url(#bg)"/>
      <rect x="0" y="0" width="250" height="250" rx="54" fill="url(#glow)"/>
      <g transform="translate(-131,-133)">${sparks(256, 250, 200)}</g>
      <g transform="translate(-131,-131)"><g filter="url(#ds)">${fist(1.05, 256, 262)}</g></g>
      <rect x="6" y="6" width="238" height="238" rx="48" fill="none" stroke="#fff" stroke-opacity="0.16" stroke-width="6"/>
    </g>
    <g font-family="Arial Black, Impact, system-ui, sans-serif" font-weight="900">
      <text x="332" y="152" font-size="118" fill="#eef1ff" letter-spacing="2">BRAWL</text>
      <text x="334" y="256" font-size="84" fill="url(#bg)" letter-spacing="16">ARENA</text>
    </g>
  </svg>`;
}

// ---------------------------------------------------------------- render ----
const legacy = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 };
const fore = { mdpi: 108, hdpi: 162, xhdpi: 216, xxhdpi: 324, xxxhdpi: 432 };

async function render(page, svg, w, h, out, transparent) {
  const html = `<!doctype html><html><head><meta charset="utf-8">
    <style>html,body{margin:0;padding:0;background:${transparent ? 'transparent' : 'transparent'}}
    svg{display:block;width:${w}px;height:${h}px}</style></head>
    <body>${svg
      .replace('width="512" height="512"', `width="${w}" height="${h}"`)
      .replace('width="1024" height="320"', `width="${w}" height="${h}"`)}</body></html>`;
  await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
  await page.setContent(html, { waitUntil: 'load' });
  const buf = await page.screenshot({ omitBackground: transparent, type: 'png' });
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, buf);
  console.log('wrote', out, `${w}x${h}`);
}

setTimeout(() => { console.error('TIMEOUT'); process.exit(2); }, 120000);
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox', '--disable-gpu'] });
const page = await browser.newPage();

// preview montage for quick visual check
await render(page, svgFull(), 512, 512, 'scripts/raw/shots/icon-full.png', false);
await render(page, svgFull({ round: true }), 512, 512, 'scripts/raw/shots/icon-round.png', false);
await render(page, svgLockup(), 1024, 320, 'scripts/raw/shots/icon-lockup.png', true);

if (process.env.ICON_APPLY === '1') {
  // Android launcher icons
  for (const [dpi, s] of Object.entries(legacy)) {
    await render(page, svgFull(), s, s, `${RES}/mipmap-${dpi}/ic_launcher.png`, false);
    await render(page, svgFull({ round: true }), s, s, `${RES}/mipmap-${dpi}/ic_launcher_round.png`, false);
  }
  for (const [dpi, s] of Object.entries(fore)) {
    await render(page, svgForeground(), s, s, `${RES}/mipmap-${dpi}/ic_launcher_foreground.png`, true);
  }
  // Play Store product icon (full-bleed, Google applies the mask)
  await render(page, svgFull({ bleed: true }), 512, 512, 'store-assets/icon-512.png', false);

  // Web favicons / PWA icons (rounded-square, small radius reads better in a tab)
  await render(page, svgFull({ rx: 96 }), 512, 512, 'public/icons/icon-512.png', false);
  await render(page, svgFull({ rx: 96 }), 192, 192, 'public/icons/icon-192.png', false);
  await render(page, svgFull({ rx: 40 }), 180, 180, 'public/icons/apple-touch-icon.png', false);
  await render(page, svgFull({ rx: 14 }), 32, 32, 'public/icons/favicon-32.png', false);
  await render(page, svgLockup(), 1024, 320, 'public/logo.png', true);
  fs.writeFileSync('public/favicon.svg', svgFull({ rx: 96 }).trim() + '\n');
}

await browser.close();
console.log('done');
process.exit(0);
