// Turns real captured gameplay (the plain, no-caption base videos from
// record-gameplay.mjs — NOT the -voiceover ones, so no burned-in captions
// leak into the screenshot) into a set of ready-to-post screenshot images,
// sized for Instagram/Facebook feed (1080x1080), Instagram/TikTok/FB
// Stories & Reels (1080x1920), and Facebook/X link-card (1200x630).
//
// Each source frame is only 1280x720, so rather than a hard crop (which
// would lose part of the action) every output uses a "blurred pad" —
// the same technique Spotify Canvas / IG use when you post a horizontal
// clip to a square/vertical slot: a softly blurred, darkened copy of the
// same frame fills the canvas edge-to-edge, and the full, un-cropped frame
// sits centered on top. A small "BRAWL ARENA" wordmark watermark is burned
// into the bottom-left corner for brand attribution wherever these get
// reposted/screenshotted further.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import ffmpegPath from 'ffmpeg-static';

const ROOT = process.cwd();
const VIDEO_DIR = path.join(ROOT, 'social-kit', 'video');
const OUT_DIR = path.join(ROOT, 'social-kit', 'screenshots');
fs.mkdirSync(OUT_DIR, { recursive: true });
const FONT = 'C:/Windows/Fonts/arialbd.ttf';

const SIZES = { square: [1080, 1080], story: [1080, 1920], fb: [1200, 630] };

// [source video, real timestamp (from the matching *.timeline.json — see
// record-gameplay.mjs), output label, caption to burn in]
const SHOTS = [
  ['brawl-arena-promo.mp4', 2.5, 'menu', null],
  ['brawl-arena-promo.mp4', 6.0, 'character-select', 'CHOOSE YOUR FIGHTER'],
  ['brawl-arena-promo.mp4', 9.0, 'cosmetics-aura', 'ELEMENTAL AURAS'],
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
    const out = path.join(OUT_DIR, `${label}_${tag}.jpg`);
    const captionDraw = caption
      ? `,drawtext=fontfile='${FONT}':text='${escapeDrawtext(caption)}':fontsize=${Math.round(h * 0.045)}:fontcolor=white:box=1:boxcolor=black@0.55:boxborderw=${Math.round(h * 0.015)}:x=(w-text_w)/2:y=${Math.round(h * 0.06)}`
      : '';
    const watermark = `drawtext=fontfile='${FONT}':text='BRAWL ARENA':fontsize=${Math.round(h * 0.03)}:fontcolor=white@0.85:x=${Math.round(w * 0.03)}:y=h-${Math.round(h * 0.06)}`;
    const filter =
      `[0:v]scale=${w}:${h},gblur=sigma=25,eq=brightness=-0.12[bg];` +
      `[0:v]scale=${w}:${h}:force_original_aspect_ratio=decrease[fg];` +
      `[bg][fg]overlay=(W-w)/2:(H-h)/2[comp];` +
      `[comp]${watermark}${captionDraw}[out]`;
    run(['-y', '-i', frame, '-filter_complex', filter, '-map', '[out]', '-frames:v', '1', '-q:v', '2', out]);
    console.log('  ✓', path.basename(out));
  }
}

fs.rmSync(TMP, { recursive: true, force: true });
console.log('\nDone ->', OUT_DIR);
