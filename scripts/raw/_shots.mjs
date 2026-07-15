import puppeteer from 'puppeteer-core';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const URL = process.env.SHOT_URL || 'http://localhost:4599/';
const TAG = process.env.SHOT_TAG || 'base';
const OUT = 'scripts/raw/shots';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function shot(page, name) {
  await page.screenshot({ path: `${OUT}/${TAG}-${name}.png` });
  console.log('shot', `${TAG}-${name}`);
}

setTimeout(() => { console.error('TIMEOUT'); process.exit(2); }, 40000);
console.log('launching chrome...');
const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--no-sandbox', '--hide-scrollbars', '--disable-gpu'],
});
console.log('launched');
const page = await browser.newPage();
// Typical phone in landscape (e.g. Pixel-ish) — short height is the pain point.
await page.setViewport({ width: 780, height: 360, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await page.goto(URL, { waitUntil: 'domcontentloaded' });
await sleep(2500); // boot splash + menu paint
await shot(page, '1-menu');

// Enter Arcade setup.
await page.evaluate(() => document.querySelector('[data-action="setup"]')?.click());
await sleep(1200);
await shot(page, '2-setup');

// Start the fight (first char is preselected).
await page.evaluate(() => document.querySelector('[data-action="fight"]')?.click());
await sleep(2600); // FIGHT! banner + a few frames
await shot(page, '3-game');

// Interstitial overlay preview (mirrors AdService markup) to check landscape fit.
await page.evaluate(() => {
  const o = document.createElement('div');
  o.className = 'ad-interstitial';
  o.innerHTML = `<div class="adi-card"><div class="adi-label">Advertisement</div>
    <div class="adi-slot"><span class="adi-placeholder">Your ad could be here</span></div>
    <button class="adi-close" disabled>Skip in <b>5</b></button></div>`;
  document.body.appendChild(o);
});
await sleep(400);
await shot(page, '4-interstitial');

await browser.close();
console.log('done');
process.exit(0);
