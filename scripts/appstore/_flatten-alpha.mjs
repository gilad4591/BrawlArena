// One-off fix: the existing social-kit/appstore/*.png files were generated
// before format=rgb24 was added to appstore-screenshots.mjs, so they carry
// an (unused, fully-opaque) alpha channel that App Store Connect rejects.
// Re-encode each in place to strip it, keeping exact pixel dimensions.
import { execFileSync } from 'node:child_process';
import ffmpegPath from 'ffmpeg-static';
import fs from 'node:fs';
import path from 'node:path';

const DIR = path.resolve('social-kit/appstore');
const files = fs.readdirSync(DIR).filter((f) => f.endsWith('.png'));

for (const f of files) {
  const p = path.join(DIR, f);
  const tmp = p + '.tmp.png';
  execFileSync(ffmpegPath, ['-y', '-i', p, '-vf', 'format=rgb24', tmp], { stdio: 'ignore' });
  fs.renameSync(tmp, p);
  console.log('flattened', f);
}
