// Records a ~35s vertical (TikTok/Reels/Shorts) gameplay promo directly from
// the real running game: main menu -> character/cosmetics ("skin") pick ->
// live fight -> K.O. -> victory screen. No narration is added here (by
// design — the user is adding voiceover separately); a plain instrumental
// music bed is muxed in so the clip isn't silent on socials.
//
// Usage: node scripts/social/record-gameplay.mjs [devServerPort]
import puppeteer from 'puppeteer-core';
import ffmpegPath from 'ffmpeg-static';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const CHROME = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = process.argv[2] || '5175';
const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, 'social-kit', 'video');
fs.mkdirSync(OUT_DIR, { recursive: true });
const RAW = path.join(OUT_DIR, 'gameplay_raw.webm');
const MUSIC = path.join(OUT_DIR, 'gameplay_music.wav');
const FINAL = path.join(OUT_DIR, 'brawl-arena-promo.mp4');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'],
  });
  const page = await browser.newPage();
  // Chrome's screencast captures at the CSS viewport size regardless of
  // deviceScaleFactor, so set the viewport directly to the vertical target
  // resolution (9:16 — Reels/TikTok/Shorts) instead of relying on DPR upscaling.
  await page.setViewport({ width: 1080, height: 1920, deviceScaleFactor: 1 });

  page.on('pageerror', (e) => console.warn('[page error]', e.message));
  await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'networkidle0' });
  await sleep(1200);

  // Dismiss the first-run daily-reward modal so it never appears on camera.
  await page.evaluate(() => {
    document.querySelector('[data-action="daily-close"]')?.click();
  });
  await sleep(300);

  console.log('recording ->', RAW);
  const recorder = await page.screencast({ path: RAW, ffmpegPath, format: 'webm', fps: 30 });
  const t0 = Date.now();
  const mark = (label) => console.log(`  [${((Date.now() - t0) / 1000).toFixed(1)}s] ${label}`);

  try {
    // ---- 1) Branded main menu ------------------------------------------------
    mark('menu');
    await page.evaluate(() => window.__app.goMenu());
    await sleep(4800);

    // ---- 2) Character select -------------------------------------------------
    mark('character select');
    await page.evaluate(() => {
      const app = window.__app;
      app.selection.character = 'solaris';
      app.selection.mode = 'oneVsOne';
      app.selection.opponents = 1;
      app.selection.difficulty = 1;
      app.buildSetup();
      app.showScreen('setup');
    });
    await sleep(2500);

    // ---- 3) Cosmetics — the "skin change" showcase ---------------------------
    mark('cosmetics: aura equip');
    await page.evaluate(() => {
      const app = window.__app;
      app._toggleEquip('solaris', 'aura', true);
      app._toggleEquip('solaris', 'sp', true);
      app._cosStep = 'detail';
      app._cosChar = 'solaris';
      app._cosTab = 'aura';
      app.showScreen('cosmetics');
      app.buildCosmetics();
    });
    await sleep(3000);
    mark('cosmetics: frame tab');
    await page.evaluate(() => {
      const app = window.__app;
      app._cosTab = 'frame';
      app.buildCosmetics();
    });
    await sleep(1800);

    // ---- 4) Back to setup, launch the match ----------------------------------
    mark('start match');
    await page.evaluate(() => {
      const app = window.__app;
      app.showScreen('setup');
      app.buildSetup();
    });
    await sleep(800);
    await page.evaluate(() => window.__app.startGame());
    await sleep(1500);

    // ---- 5) Live, keyboard-driven fight --------------------------------------
    mark('fight');
    const tap = async (key, ms = 140) => {
      await page.keyboard.down(key);
      await sleep(ms);
      await page.keyboard.up(key);
    };
    const hold = tap; // same shape, just named for readability at call sites

    await hold('ArrowRight', 900); // close the distance
    await tap('KeyA'); await sleep(280);
    await tap('KeyA'); await sleep(280);
    await tap('KeyA'); await sleep(280);
    await tap('KeyS'); await sleep(750); // special — shows the equipped SP FX
    await hold('ArrowLeft', 400); // back off a step
    await sleep(300);
    await hold('KeyD', 800); // block an incoming hit
    await sleep(250);
    await hold('ArrowRight', 500); // close in again
    await tap('KeyW'); await sleep(300); // jump
    await tap('KeyA'); await sleep(350);
    await tap('KeyA'); await sleep(280);
    await tap('KeyS'); await sleep(750); // special again
    await hold('ArrowRight', 350);
    await tap('KeyT'); await sleep(400); // grab/throw
    await hold('KeyD', 600); // block
    await sleep(250);
    await tap('KeyA'); await sleep(280);
    await tap('KeyA'); await sleep(280);
    await tap('KeyA'); await sleep(280);
    await tap('KeyS'); await sleep(750); // one more special for the finish
    await hold('ArrowRight', 350);
    await tap('KeyA'); await sleep(300);
    await tap('KeyA'); await sleep(300);

    // ---- 6) Guaranteed, cinematic finish -------------------------------------
    // Real CPU fights are inherently a little unpredictable (dodges/blocks),
    // which is fine for a highlight reel but risky for a scripted-length promo
    // clip — so the actual finishing blow is delivered through the engine's own
    // hit pipeline (same VFX/knockback/K.O. logic a real hit would trigger),
    // guaranteeing the KO/victory beats land inside the recording window.
    mark('finishing blow');
    await page.evaluate(() => {
      const app = window.__app;
      const eng = app.engine;
      const cpu = eng?.fighters.find((f) => !f.isHuman && f.alive);
      if (eng && cpu) eng._applyHit(eng.human, cpu, 999, { dir: eng.human.facing });
    });

    // ---- 7) Hold on K.O. + victory screen -------------------------------------
    mark('victory hold');
    await sleep(6800);
  } finally {
    // The experimental ScreenRecorder's stop() occasionally never observes the
    // ffmpeg child's 'close' event on Windows and hangs forever — race it
    // against a timeout so the script always finishes; closing the browser
    // right after forces the CDP session (and thus ffmpeg's stdin) closed.
    await Promise.race([recorder.stop(), sleep(8000)]).catch((err) => {
      console.warn('recorder.stop() did not resolve cleanly:', err?.message || err);
    });
  }

  const duration = (Date.now() - t0) / 1000;
  await browser.close();
  console.log('raw capture done:', RAW, `(${duration.toFixed(1)}s)`);

  // ---- Post-process: add an instrumental music bed ---------------------------
  console.log('music bed:', duration.toFixed(1) + 's');
  execFileSync('node', [path.join(ROOT, 'scripts', 'social', 'music-wav.mjs'), MUSIC, String(duration + 0.5)], { stdio: 'inherit' });

  // Re-encode to H.264 (the raw capture is VP9-in-webm, which many phones/apps
  // don't scrub/preview reliably) while muxing in the music bed.
  execFileSync(ffmpegPath, [
    '-y', '-i', RAW, '-i', MUSIC,
    '-filter:a', 'afade=t=in:st=0:d=0.6,afade=t=out:st=' + Math.max(0, duration - 1) + ':d=1',
    '-shortest',
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '192k',
    '-movflags', '+faststart',
    FINAL,
  ], { stdio: 'inherit' });

  console.log('\n✓ Done ->', FINAL);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
