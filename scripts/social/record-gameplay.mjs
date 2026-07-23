// Records a ~35s landscape (16:9 — the game's native orientation; it locks to
// landscape on native mobile via @capacitor/screen-orientation) gameplay
// promo directly from the real running game: main menu -> character/cosmetics
// ("skin") pick -> live fight -> K.O. -> victory screen. No narration is
// added here (by design — the user is adding voiceover separately); a plain
// instrumental music bed is muxed in so the clip isn't silent on socials.
//
// NOTE ON CAPTURE METHOD: Puppeteer's experimental `page.screencast()` (a
// thin wrapper that pipes CDP screencast frames into an ffmpeg child) was
// tried first but reliably stalls partway through longer/heavier recordings
// on this machine — the raw file keeps growing in bytes but the *decodable*
// video track silently truncates to just the first several seconds, with no
// error. Lowering fps only delayed the stall, so it isn't a resolution/fps
// issue but a backpressure bug in that pipe on Windows. This script instead
// drives capture manually via `page.screenshot()` on a timed loop and
// assembles the resulting JPEG sequence with ffmpeg — slower, but reliable.
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
const FRAMES_DIR = path.join(OUT_DIR, 'frames_tmp');
const MUSIC = path.join(OUT_DIR, 'gameplay_music.wav');
const FINAL = path.join(OUT_DIR, 'brawl-arena-promo.mp4');
const CAPTURE_FPS = 20;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  // Hard ceiling on the whole capture phase (menu -> fight -> KO -> victory
  // hold) so a stuck browser/CDP session can never hang the script forever.
  const watchdog = setTimeout(() => {
    console.error('watchdog: capture phase exceeded time budget — forcing exit');
    process.exit(1);
  }, 120_000);

  fs.rmSync(FRAMES_DIR, { recursive: true, force: true });
  fs.mkdirSync(FRAMES_DIR, { recursive: true });

  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'],
  });
  const page = await browser.newPage();
  // 16:9 landscape, matching the game's actual (locked) native orientation.
  await page.setViewport({ width: 1280, height: 720, deviceScaleFactor: 1 });

  page.on('pageerror', (e) => console.warn('[page error]', e.message));
  await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'networkidle0' });
  await sleep(1200);

  // Dismiss the first-run daily-reward modal so it never appears on camera.
  await page.evaluate(() => {
    document.querySelector('[data-action="daily-close"]')?.click();
  });
  await sleep(300);

  console.log('capturing frames ->', FRAMES_DIR);
  const t0 = Date.now();
  const mark = (label) => console.log(`  [${((Date.now() - t0) / 1000).toFixed(1)}s] ${label}`);

  let frameIdx = 0;
  let capturing = true;
  const captureLoop = (async () => {
    while (capturing) {
      const shotStart = Date.now();
      const idx = frameIdx++;
      try {
        await page.screenshot({
          path: path.join(FRAMES_DIR, `f${String(idx).padStart(6, '0')}.jpg`),
          type: 'jpeg',
          quality: 70,
          optimizeForSpeed: true,
        });
      } catch (e) {
        console.warn('frame capture failed', idx, e.message);
      }
      const elapsed = Date.now() - shotStart;
      const wait = 1000 / CAPTURE_FPS - elapsed;
      if (wait > 0) await sleep(wait);
    }
  })();

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
    // Real CPU fights are unpredictable — keep the human topped up during the
    // scripted button-mashing so a lucky CPU combo can't KO the *player*
    // before the guaranteed finishing blow (below) ends the match as a win.
    await page.evaluate(() => {
      window.__promoGuard = setInterval(() => {
        const h = window.__app.engine?.human;
        if (h && h.alive) h.hp = h.maxHp;
      }, 200);
    });
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
      clearInterval(window.__promoGuard);
      const app = window.__app;
      const eng = app.engine;
      const cpu = eng?.fighters.find((f) => !f.isHuman && f.alive);
      if (eng && cpu) eng._applyHit(eng.human, cpu, 999, { dir: eng.human.facing });
    });

    // ---- 7) Hold on K.O. + victory screen -------------------------------------
    mark('victory hold');
    await sleep(6800);
  } finally {
    capturing = false;
    await captureLoop;
  }

  const duration = (Date.now() - t0) / 1000;
  // browser.close() has been observed to hang occasionally on Windows — give
  // it a short grace period, then hard-kill the underlying Chrome process.
  await Promise.race([browser.close(), sleep(5000)]).catch(() => {});
  if (browser.process() && !browser.process().killed) {
    browser.process().kill('SIGKILL');
  }
  clearTimeout(watchdog);

  const actualFps = frameIdx / duration;
  console.log(`captured ${frameIdx} frames over ${duration.toFixed(1)}s (~${actualFps.toFixed(2)} fps effective)`);

  // ---- Post-process: add an instrumental music bed ---------------------------
  execFileSync('node', [path.join(ROOT, 'scripts', 'social', 'music-wav.mjs'), MUSIC, String(duration + 0.5)], { stdio: 'inherit' });

  // Assemble the JPEG sequence into H.264 (matching the effective capture
  // rate so playback speed lines up with real elapsed time) with the music
  // bed muxed in.
  execFileSync(ffmpegPath, [
    '-y',
    '-framerate', actualFps.toFixed(3),
    '-i', path.join(FRAMES_DIR, 'f%06d.jpg'),
    '-i', MUSIC,
    '-filter:a', 'afade=t=in:st=0:d=0.6,afade=t=out:st=' + Math.max(0, duration - 1) + ':d=1',
    '-shortest',
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '192k',
    '-movflags', '+faststart',
    FINAL,
  ], { stdio: 'inherit' });

  fs.rmSync(FRAMES_DIR, { recursive: true, force: true });

  console.log('\n✓ Done ->', FINAL);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
