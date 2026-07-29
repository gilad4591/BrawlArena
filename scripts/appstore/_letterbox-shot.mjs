// Letterboxes a landscape screenshot into a portrait canvas matching one of
// Apple's exact accepted App Store screenshot pixel dimensions, since the
// In-App Purchase review screenshot endpoint validates against that fixed
// enum even for landscape-only apps (unlike the main App Store screenshots
// endpoint, which accepts the rotated/landscape tuple).
import { execFileSync } from 'node:child_process';
import ffmpegPath from 'ffmpeg-static';

const [, , inFile, outFile, w, h] = process.argv;
if (!inFile || !outFile || !w || !h) {
  throw new Error('Usage: node _letterbox-shot.mjs <in> <out> <width> <height>');
}

execFileSync(ffmpegPath, [
  '-y', '-i', inFile,
  '-vf', `scale=${w}:-2:force_original_aspect_ratio=decrease,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2:color=black,format=rgb24`,
  outFile,
], { stdio: 'inherit' });

console.log('wrote', outFile);
