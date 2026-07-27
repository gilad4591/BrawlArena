// Records a ~35-40s landscape (16:9 — the game's native orientation; it
// locks to landscape on native mobile via @capacitor/screen-orientation)
// gameplay promo directly from the real running game: main menu ->
// character/cosmetics ("skin") pick -> live fight -> K.O. -> victory
// screen. A plain instrumental music bed is muxed in so the clip isn't
// silent on socials — voiceover/captions are added afterwards by
// narrate.mjs, which needs to know exactly when each of these beats
// actually happened on screen.
//
// NOTE ON CAPTURE METHOD: Puppeteer's experimental `page.screencast()` (a
// thin wrapper that pipes CDP screencast frames into an ffmpeg child) reliably
// stalls partway through longer/heavier recordings on this machine — the raw
// file keeps growing in bytes but the *decodable* video track silently
// truncates to just the first several seconds. A plain `page.screenshot()`
// polling loop fixed the truncation but only managed ~9fps (each call is a
// full request/response round trip), which looks choppy. This script instead
// talks to the same underlying CDP `Page.startScreencast` API directly and
// writes each pushed frame straight to a JPEG file (no ffmpeg pipe in the
// hot path — that pipe was the actual stall culprit), acking immediately so
// Chrome keeps streaming frames as fast as it renders them. The JPEG
// sequence is assembled into the final video afterwards.
//
// TIMING: every `mark()` call below is written, with its *real* elapsed
// time (measured from the same t0 the final video's frame 0 corresponds
// to), into a `<outName>.timeline.json` sidecar next to the output video.
// narrate.mjs reads that file to place captions/voiceover lines exactly
// when each beat actually happened — NOT from the scripted sleep()
// durations below, which don't account for real page-load/render/
// screencast-startup latency and drift from the actual video by several
// seconds (this is what caused voiceover lines to land on the wrong
// screen in earlier takes).
//
// Usage: node scripts/social/record-gameplay.mjs [devServerPort] [outName] [character] [arena]
// Example: node scripts/social/record-gameplay.mjs 5175 duel-frost-volt frost volcano
import puppeteer from 'puppeteer-core';
import ffmpegPath from 'ffmpeg-static';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const CHROME = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = process.argv[2] || '5175';
const OUT_NAME = process.argv[3] || 'brawl-arena-promo';
const CHARACTER = process.argv[4] || 'solaris';
const ARENA = process.argv[5] || 'forest';

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, 'social-kit', 'video');
fs.mkdirSync(OUT_DIR, { recursive: true });
const FRAMES_DIR = path.join(OUT_DIR, `frames_tmp_${OUT_NAME}`);
const MUSIC = path.join(OUT_DIR, `${OUT_NAME}_music.wav`);
const FINAL = path.join(OUT_DIR, `${OUT_NAME}.mp4`);
const TIMELINE = path.join(OUT_DIR, `${OUT_NAME}.timeline.json`);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  console.log(`recording "${OUT_NAME}": character=${CHARACTER} arena=${ARENA}`);

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
    args: [
      '--no-sandbox',
      '--autoplay-policy=no-user-gesture-required',
      // THE FIX for "video looks stuck"/VO-desync: Chrome treats a headless
      // (no real window) tab as an occluded/backgrounded renderer and, per
      // spec, throttles its requestAnimationFrame loop down to ~1fps to save
      // power — UNLESS real synthetic input events are landing (which is
      // exactly why the fight portion, driven by page.keyboard.down/up,
      // captured near-full framerate while the static menu/character-select/
      // cosmetics screens before it — driven by page.evaluate() JS calls,
      // not real input — got compressed to a single frame for ~12 real
      // seconds). These flags turn that whole throttling subsystem off so
      // every screen renders at its true framerate regardless of "focus".
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding',
      '--disable-background-timer-throttling',
      '--disable-ipc-flooding-protection',
    ],
  });
  const page = await browser.newPage();
  // 16:9 landscape, matching the game's actual (locked) native orientation.
  await page.setViewport({ width: 1280, height: 720, deviceScaleFactor: 1 });

  page.on('pageerror', (e) => console.warn('[page error]', e.message));
  await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'networkidle0' });
  await sleep(1200);

  // App.js only assigns window.__app once its constructor finishes (dev-mode
  // only, see App.js's `this._dev` check) — on a cold dev-server request
  // (first hit after the Vite server has been idle a while) that can take
  // noticeably longer than the fixed 1200ms above, so poll for it instead of
  // assuming it's ready; this is what "Cannot set properties of undefined
  // (setting 'coins')" below actually means when it happens.
  for (let i = 0; i < 40 && !(await page.evaluate(() => !!window.__app)); i++) {
    await sleep(250);
  }

  // Dismiss the first-run daily-reward modal so it never appears on camera.
  await page.evaluate(() => {
    document.querySelector('[data-action="daily-close"]')?.click();
  });
  await sleep(300);

  // This recording runs against the local dev server, which auto-grants
  // 999999 coins in dev mode (see App.js's `this._dev` check) so cosmetics/
  // store flows can be tested without grinding. Handy for testing, but it
  // shows an implausible balance in real marketing footage / App Store
  // screenshots (real players never see this) — pin it to a normal,
  // plausible mid-game balance for this recording session only, before
  // anything that renders the coin badge (goMenu/buildCosmetics) runs.
  // Never persisted to the actual dev profile on disk.
  await page.evaluate(() => {
    window.__app.coins = 240;
  });

  console.log('capturing frames ->', FRAMES_DIR);
  const t0 = Date.now();
  const timeline = [];
  // Wall-clock elapsed seconds since t0 — this now maps DIRECTLY onto the
  // final video's timeline (see the concat-demuxer note below), so
  // narrate.mjs can place captions/VO at this exact second.
  const mark = (label) => {
    const t = (Date.now() - t0) / 1000;
    console.log(`  [${t.toFixed(1)}s] ${label} (frame ${frameIdx})`);
    timeline.push({ label, t });
  };

  // Manual CDP screencast: Chrome pushes a 'Page.screencastFrame' event
  // whenever the page actually repaints — NOT at a fixed video framerate.
  // Static screens (the menu, character-select, cosmetics showcase are all
  // single canvas draws with no animation loop — see drawMenuScene()/
  // buildCosmetics(), which only redraw once per call) legitimately produce
  // just ONE frame for several real seconds of screen time, while the live
  // fight (driven by real synthetic keyboard input, which keeps the game's
  // own render loop repainting every tick) produces near-fps-rate frames.
  // frameTimestamps records the real Date.now() each frame arrived at, so
  // the video can later be assembled with each frame *held* for its true
  // real-world duration — assembling this as a fixed-fps sequence (the old
  // approach) squashed every static screen down to a single 1/fps-second
  // flash and let the fight play in real time, which is exactly why the
  // resulting video looked "stuck"/jump-cut and voiceover could never line
  // up with what was on screen.
  const client = await page.createCDPSession();
  let frameIdx = 0;
  const frameTimestamps = [];
  const pendingWrites = [];
  client.on('Page.screencastFrame', (frame) => {
    const idx = frameIdx++;
    frameTimestamps.push(Date.now());
    pendingWrites.push(
      fs.promises
        .writeFile(path.join(FRAMES_DIR, `f${String(idx).padStart(6, '0')}.jpg`), Buffer.from(frame.data, 'base64'))
        .catch((e) => console.warn('frame write failed', idx, e.message))
    );
    client.send('Page.screencastFrameAck', { sessionId: frame.sessionId }).catch(() => {});
  });
  await client.send('Page.startScreencast', {
    format: 'jpeg',
    quality: 80,
    maxWidth: 1280,
    maxHeight: 720,
    // Pushing every single rendered frame (30-60/s) makes Chrome spend so much
    // of the tab's own main thread JPEG/base64-encoding screencast frames that
    // it started starving the page's *own* game-logic thread under load —
    // occasionally stalling the actual fight for a second or more (looks like
    // freezing in the output) and even letting scripted actions land later
    // than intended. Skipping every other frame roughly halves that overhead
    // while still giving a smooth ~18-20fps capture.
    everyNthFrame: 2,
  });

  try {
    // ---- 1) Branded main menu ------------------------------------------------
    mark('menu');
    await page.evaluate(() => window.__app.goMenu());
    await sleep(4800);

    // ---- 2) Character select -------------------------------------------------
    mark('character select');
    await page.evaluate((character, arena) => {
      const app = window.__app;
      app.selection.character = character;
      app.selection.arena = arena;
      app.selection.mode = 'oneVsOne';
      app.selection.opponents = 1;
      app.selection.difficulty = 1;
      app.buildSetup();
      app.showScreen('setup');
    }, CHARACTER, ARENA);
    await sleep(2500);

    // ---- 3) Cosmetics — the "skin change" showcase ---------------------------
    mark('cosmetics: aura equip');
    await page.evaluate((character) => {
      const app = window.__app;
      app._toggleEquip(character, 'aura', true);
      app._toggleEquip(character, 'sp', true);
      app._cosStep = 'detail';
      app._cosChar = character;
      app._cosTab = 'aura';
      app.showScreen('cosmetics');
      app.buildCosmetics();
    }, CHARACTER);
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
      // startGame() silently resets a premium arena back to 'forest' unless
      // the arena pack is actually owned — fine for real players, but this
      // recording just wants to *show off* the requested arena, so force it
      // for this in-memory session only (never persisted).
      app.purchases.ownsArenas = () => true;
      app.showScreen('setup');
      app.buildSetup();
    });
    await sleep(800);
    await page.evaluate(() => window.__app.startGame());
    await sleep(1500);

    // ---- 5) Live, keyboard-driven fight --------------------------------------
    mark('fight');
    // Real CPU fights are unpredictable — keep the human topped up during the
    // scripted button-mashing so a lucky CPU combo can't KO the *player*. The
    // CPU's health ceiling is also ramped smoothly downward over the fight
    // (not snapped instantly — that would look like an unexplained jump on
    // the health bar) so it's reliably on the ropes by the finishing flurry,
    // without ever needing a fake mega-damage number to force the KO.
    await page.evaluate(() => {
      let cpuCeiling = 0.92; // fraction of max HP; ramps down each tick below
      window.__promoGuard = setInterval(() => {
        const eng = window.__app.engine;
        const h = eng?.human;
        if (h && h.alive) h.hp = h.maxHp;
        const cpu = eng?.fighters.find((f) => !f.isHuman && f.alive);
        if (cpu) {
          cpuCeiling = Math.max(0.08, cpuCeiling - 0.012);
          cpu.hp = Math.min(cpu.hp, cpu.maxHp * cpuCeiling);
        }
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
    mark('special (1)');
    await tap('KeyS'); await sleep(750); // special — shows the equipped SP FX
    await hold('ArrowLeft', 400); // back off a step
    await sleep(300);
    await hold('KeyD', 800); // block an incoming hit
    await sleep(250);
    await hold('ArrowRight', 500); // close in again
    await tap('KeyW'); await sleep(300); // jump
    await tap('KeyA'); await sleep(350);
    await tap('KeyA'); await sleep(280);
    mark('special (2)');
    await tap('KeyS'); await sleep(750); // special again
    await hold('ArrowRight', 350);
    await tap('KeyT'); await sleep(400); // grab/throw
    await hold('KeyD', 600); // block
    await sleep(250);
    await tap('KeyA'); await sleep(280);
    await tap('KeyA'); await sleep(280);
    await tap('KeyA'); await sleep(280);
    mark('special (3)');
    await tap('KeyS'); await sleep(750); // one more special for the finish
    await hold('ArrowRight', 350);
    await tap('KeyA'); await sleep(300);
    await tap('KeyA'); await sleep(300);

    // ---- 6) Guaranteed, but realistic, finish ---------------------------------
    // Real CPU fights are inherently a little unpredictable (dodges/blocks),
    // which is fine for a highlight reel but risky for a scripted-length promo
    // clip. Rather than injecting one absurd mega-damage hit (which shows an
    // obviously fake number on screen — "999" — and gives the game away), the
    // CPU's health was already capped low throughout the fight (above), so a
    // couple of normal, plausible-damage attacks land the KO for real through
    // the engine's own combat pipeline — same numbers a real hit would show.
    mark('finishing blow');
    await tap('KeyA'); await sleep(280);
    await tap('KeyA'); await sleep(280);
    await tap('KeyS'); await sleep(500);
    // Safety net: if the CPU is still standing (e.g. it blocked every swing,
    // or the tab was briefly busy and a keypress didn't land in time), finish
    // it off with one modest, plausible-sized hit — never a cheat-code number
    // — and retry a couple of times so the promo can't end mid-fight.
    for (let attempt = 0; attempt < 3; attempt++) {
      const stillAlive = await page.evaluate(() => {
        const eng = window.__app.engine;
        const cpu = eng?.fighters.find((f) => !f.isHuman && f.alive);
        if (eng && cpu) eng._applyHit(eng.human, cpu, Math.min(28, cpu.hp + 4), { dir: eng.human.facing });
        return !!eng?.fighters.find((f) => !f.isHuman && f.alive);
      });
      if (!stillAlive) break;
      console.log(`  finishing blow attempt ${attempt + 1} didn't land — retrying`);
      await sleep(400);
    }
    await page.evaluate(() => clearInterval(window.__promoGuard));

    // ---- 7) Hold on K.O. + victory screen -------------------------------------
    mark('victory hold');
    await sleep(6800);
    mark('end');
  } finally {
    await client.send('Page.stopScreencast').catch(() => {});
    await Promise.allSettled(pendingWrites);
  }

  const duration = (Date.now() - t0) / 1000;
  // browser.close() has been observed to hang occasionally on Windows — give
  // it a short grace period, then hard-kill the underlying Chrome process.
  await Promise.race([browser.close(), sleep(5000)]).catch(() => {});
  if (browser.process() && !browser.process().killed) {
    browser.process().kill('SIGKILL');
  }
  clearTimeout(watchdog);

  const meanFps = frameIdx / duration;
  console.log(`captured ${frameIdx} frames over ${duration.toFixed(1)}s (~${meanFps.toFixed(2)} fps mean, held at real per-frame duration)`);

  fs.writeFileSync(TIMELINE, JSON.stringify({ outName: OUT_NAME, character: CHARACTER, arena: ARENA, duration, marks: timeline }, null, 2));
  console.log('✓ timeline ->', TIMELINE);

  // ---- Post-process: add an instrumental music bed ---------------------------
  execFileSync('node', [path.join(ROOT, 'scripts', 'social', 'music-wav.mjs'), MUSIC, String(duration + 0.5)], { stdio: 'inherit' });

  // Assemble the JPEGs with a ffmpeg concat-demuxer list that holds each
  // frame for its own *real, measured* duration (the gap until the next
  // frame actually arrived) instead of a fixed 1/fps slot for every frame.
  // This is what actually fixes the sync: a static screen that only
  // produced 1 screencast frame over 4.8 real seconds now correctly shows
  // for 4.8 seconds in the output (repeated by the encoder as needed),
  // rather than being squashed into a single 1/fps-second flash. See the
  // frameTimestamps comment above for why frame counts are so uneven.
  const listPath = path.join(OUT_DIR, `${OUT_NAME}.concat.txt`);
  const lines = [];
  for (let i = 0; i < frameIdx; i++) {
    const framePath = path.join(FRAMES_DIR, `f${String(i).padStart(6, '0')}.jpg`).replace(/\\/g, '/');
    const next = i + 1 < frameIdx ? frameTimestamps[i + 1] : t0 + duration * 1000;
    const dur = Math.max(0.02, (next - frameTimestamps[i]) / 1000);
    lines.push(`file '${framePath}'`, `duration ${dur.toFixed(3)}`);
  }
  // ffmpeg's concat demuxer documents that the very last file's "duration"
  // is otherwise ignored unless the file is listed once more afterwards.
  if (frameIdx > 0) {
    lines.push(`file '${path.join(FRAMES_DIR, `f${String(frameIdx - 1).padStart(6, '0')}.jpg`).replace(/\\/g, '/')}'`);
  }
  fs.writeFileSync(listPath, lines.join('\n'));

  execFileSync(ffmpegPath, [
    '-y',
    '-f', 'concat', '-safe', '0',
    '-i', listPath,
    '-i', MUSIC,
    // Re-quantize the variable-duration concat stream to a standard constant
    // 30fps output (duplicating/dropping as needed) — plays back correctly
    // and predictably everywhere (browsers, TikTok/IG uploaders, etc.).
    '-r', '30', '-vsync', 'cfr',
    '-filter:a', 'afade=t=in:st=0:d=0.6,afade=t=out:st=' + Math.max(0, duration - 1) + ':d=1',
    '-shortest',
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '192k',
    '-movflags', '+faststart',
    FINAL,
  ], { stdio: 'inherit' });

  fs.rmSync(FRAMES_DIR, { recursive: true, force: true });
  fs.rmSync(listPath, { force: true });

  console.log('\n✓ Done ->', FINAL);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
