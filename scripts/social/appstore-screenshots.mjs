// App Store Connect screenshot generator — same idea as screenshots.mjs
// (real captured gameplay frames from the plain, no-caption base videos,
// NOT the -voiceover/-localdub ones), but sized to Apple's required
// landscape pixel dimensions instead of social-media aspect ratios.
//
// Brawl Arena locks to landscape orientation at runtime (see
// ScreenOrientation.lock() in src/main.js), so these are landscape shots.
// Apple buckets screenshots by "display size class" rather than exact
// device model, and currently accepts any of a device family's native
// resolutions for a given class — the values below are the most commonly
// used exact pixel sizes per class as of this writing. Double-check the
// current exact requirements in App Store Connect's Media Manager before
// uploading (Apple updates these every year or two as new device sizes
// ship), and drop the iPad set entirely if you end up restricting the
// app's TARGETED_DEVICE_FAMILY to iPhone-only.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import ffmpegPath from 'ffmpeg-static';

const ROOT = process.cwd();
const VIDEO_DIR = path.join(ROOT, 'social-kit', 'video');
const OUT_DIR = path.join(ROOT, 'social-kit', 'appstore');
fs.mkdirSync(OUT_DIR, { recursive: true });
const FONT = 'C:/Windows/Fonts/arialbd.ttf';

// [device size class, width, height] — all landscape (width > height).
const SIZES = {
  'iphone-6.9-6.7': [2796, 1290], // iPhone 15/16 Pro Max family
  'iphone-6.5': [2688, 1242], // iPhone 11 Pro Max / XS Max family
  'ipad-13-12.9': [2732, 2048], // iPad Pro 12.9"/13" family
};

// Same curated beats as screenshots.mjs's SHOTS — reused here so the App
// Store set and the social-media set always show the same moments.
// [source video, real timestamp (from the matching *.timeline.json — see
// record-gameplay.mjs), output label, caption to burn in]
// character-select and cosmetics-aura deliberately pass null here (unlike
// screenshots.mjs's social-media version of this same SHOTS list) — at App
// Store sizes the in-game screen already renders its own "Choose Your
// Fighter" / "Cosmetics" header text in roughly the same top-center spot a
// burned-in caption would use, so adding one there just doubles up two
// overlapping strings instead of adding information.
const SHOTS = [
  ['brawl-arena-promo.mp4', 2.5, 'menu', null],
  ['brawl-arena-promo.mp4', 6.0, 'character-select', null],
  ['brawl-arena-promo.mp4', 9.0, 'cosmetics-aura', null],
  ['brawl-arena-promo.mp4', 18.5, 'fight-forest', 'SPECIAL ATTACKS'],
  ['brawl-arena-promo.mp4', 32.0, 'victory-forest', 'VICTORY!'],
  ['duel-volt-neon.mp4', 19.0, 'fight-neon', 'NEON CITY ARENA'],
  ['duel-volt-neon.mp4', 33.0, 'victory-neon', 'VICTORY!'],
];

function run(args) {
  execFileSync(ffmpegPath, args, { stdio: 'inherit' });
}

function escapeDrawtext(text) {
  return text.replace(/\\/g, '\\\\').replace(/:/g, '\\:').replace(/'/g, "\\'").replace(/%/g, '\\%');
}

const TMP = path.join(OUT_DIR, '_tmp');
fs.mkdirSync(TMP, { recursive: true });

for (const [video, t, label, caption] of SHOTS) {
  const src = path.join(VIDEO_DIR, video);
  if (!fs.existsSync(src)) {
    console.warn('skip (missing video):', video);
    continue;
  }
  console.log(`\n${label} @ ${t}s from ${video}`);
  const frame = path.join(TMP, `${label}.png`);
  run(['-y', '-ss', String(t), '-i', src, '-frames:v', '1', '-q:v', '2', frame]);

  for (const [tag, [w, h]] of Object.entries(SIZES)) {
    const out = path.join(OUT_DIR, `${label}_${tag}.png`);
    // Frame source is 1280x720 (16:9); every target class here is WIDER
    // than 16:9, so the sharp foreground copy is centered with a softly
    // blurred, darkened copy of the same frame filling the side margins —
    // the same "blurred pad" technique screenshots.mjs uses for square/
    // story crops, just applied to the opposite (wider) direction.
    const captionDraw = caption
      ? `,drawtext=fontfile='${FONT}':text='${escapeDrawtext(caption)}':fontsize=${Math.round(h * 0.05)}:fontcolor=white:box=1:boxcolor=black@0.55:boxborderw=${Math.round(h * 0.02)}:x=(w-text_w)/2:y=${Math.round(h * 0.05)}`
      : '';
    const watermark = `drawtext=fontfile='${FONT}':text='BRAWL ARENA':fontsize=${Math.round(h * 0.035)}:fontcolor=white@0.85:x=${Math.round(w * 0.025)}:y=h-${Math.round(h * 0.06)}`;
    const filter =
      `[0:v]scale=${w}:${h},gblur=sigma=30,eq=brightness=-0.15[bg];` +
      `[0:v]scale=${w}:${h}:force_original_aspect_ratio=decrease[fg];` +
      `[bg][fg]overlay=(W-w)/2:(H-h)/2[comp];` +
      `[comp]${watermark}${captionDraw}[out]`;
    // PNG output (not JPG) — App Store Connect requires PNG or JPEG, and
    // PNG avoids any extra compression artifacts on the sharp foreground.
    run(['-y', '-i', frame, '-filter_complex', filter, '-map', '[out]', '-frames:v', '1', out]);
    console.log('  ✓', path.basename(out));
  }
}

fs.rmSync(TMP, { recursive: true, force: true });
console.log('\nDone ->', OUT_DIR);
console.log('Upload the "iphone-6.9-6.7" set (and "iphone-6.5" if ASC still asks for it separately)');
console.log('under App Store Connect > your app > App Store > [version] > iPhone screenshots.');
console.log('Upload "ipad-13-12.9" under iPad screenshots only if you keep iPad in TARGETED_DEVICE_FAMILY.');
