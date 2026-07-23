// BrawlArena promo video generator.
// Turns the static social-kit cards (already produced by gen.mjs) into a
// short Ken Burns-style slideshow with music, exported as a square (feed)
// and a vertical (Reels/Shorts/Stories) MP4. No screen-recording of live
// gameplay needed — this is a fast, repeatable "trailer" from the same
// branded assets used for the image posts.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import ffmpegPath from 'ffmpeg-static';

const ROOT = process.cwd();
const KIT = path.join(ROOT, process.env.OUT_DIR || 'social-kit');
const OUT = path.join(KIT, 'video');
const TMP = path.join(OUT, 'tmp');
fs.mkdirSync(TMP, { recursive: true });

const FPS = 25;
const SEG = 2.4; // seconds each character card is on screen
const HOLD_LAST = 3.4; // the "meet the roster" card is the finale, held longer

// Order of cards in the reel — hero opener, a spread of fighters, roster closer.
const ORDER = ['hero', 'blaze', 'frost', 'volt', 'sylva', 'nox', 'golem', 'aurex', 'sage', 'solaris', 'roster'];

function run(args) {
  execFileSync(ffmpegPath, args, { stdio: 'inherit' });
}

function buildClip(size, imgFile, dur, outFile, { fadeInFrom = 0.3 } = {}) {
  const frames = Math.max(2, Math.round(dur * FPS));
  const zoomInc = (0.1 / frames).toFixed(6);
  const fadeOutStart = Math.max(0, dur - 0.3).toFixed(3);
  const vf = [
    `zoompan=z='min(zoom+${zoomInc},1.1)':d=${frames}:s=${size}:fps=${FPS}`,
    `fade=t=in:st=0:d=${fadeInFrom}`,
    `fade=t=out:st=${fadeOutStart}:d=0.3`,
  ].join(',');
  run([
    '-y', '-loop', '1', '-i', imgFile,
    '-t', String(dur),
    '-vf', vf,
    '-r', String(FPS),
    '-pix_fmt', 'yuv420p',
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18',
    outFile,
  ]);
}

function buildFormat(tag, size) {
  console.log(`\n--- ${tag} (${size}) ---`);
  const clips = [];
  let totalDur = 0;
  for (const name of ORDER) {
    const img = path.join(KIT, `${name}_${tag}.png`);
    if (!fs.existsSync(img)) {
      console.warn('  (skip, missing)', img);
      continue;
    }
    const dur = name === 'roster' ? HOLD_LAST : SEG;
    const clipFile = path.join(TMP, `${tag}_${name}.mp4`);
    console.log('  clip:', name);
    buildClip(size, img, dur, clipFile);
    clips.push(clipFile);
    totalDur += dur;
  }
  if (!clips.length) {
    console.warn(`  no cards found for ${tag}, skipping`);
    return;
  }

  const listFile = path.join(TMP, `${tag}_list.txt`);
  fs.writeFileSync(listFile, clips.map((c) => `file '${c.split('\\').join('/')}'`).join('\n'));
  const combined = path.join(TMP, `${tag}_combined.mp4`);
  run(['-y', '-f', 'concat', '-safe', '0', '-i', listFile, '-c', 'copy', combined]);

  const musicFile = path.join(OUT, `_music_${tag}.wav`);
  console.log('  music bed:', totalDur.toFixed(1) + 's');
  execFileSync('node', [path.join(ROOT, 'scripts', 'social', 'music-wav.mjs'), musicFile, String(totalDur)], { stdio: 'inherit' });

  const finalFile = path.join(OUT, `promo_${tag}.mp4`);
  run([
    '-y', '-i', combined, '-i', musicFile,
    '-shortest', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k',
    '-movflags', '+faststart',
    finalFile,
  ]);
  console.log('✓', finalFile);
}

buildFormat('square', '1080x1080');
buildFormat('story', '1080x1920');

fs.rmSync(TMP, { recursive: true, force: true });
console.log('\nDone →', OUT);
