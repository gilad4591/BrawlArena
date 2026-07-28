// One-off utility: Gemini's "transparent PNG" output didn't actually have an
// alpha channel — it just painted a literal light/dark-gray checkerboard
// pattern (the classic "this represents transparency" convention editors
// use) as real opaque pixels (confirmed via ffprobe: pix_fmt was rgb24, no
// alpha at all). ffmpeg's lumakey filter keys a NARROW band around one
// specific luma value, not "everything below a cutoff" (its actual
// semantics, confirmed by testing) — the checkerboard has two different
// gray tones, so a single lumakey pass only ever caught one of them.
// This does a direct per-pixel threshold instead: any pixel that is both
// near-perfectly neutral (R≈G≈B, not tinted like the colorful artwork) AND
// dark (below `maxAvg`) is assumed to be a checkerboard square and becomes
// fully transparent; everything else (the colorful fire/ice/gold artwork,
// and the bright white text highlights, which are neutral but far too
// bright to be a checker square) is left untouched.
//
// Usage: node scripts/social/_dechecker.mjs <in.png> <out.png> [maxAvg] [maxDiff]
import { PNG } from 'pngjs';
import fs from 'node:fs';

const [, , inFile, outFile, maxAvgArg, maxDiffArg] = process.argv;
const maxAvg = Number(maxAvgArg ?? 90);
const maxDiff = Number(maxDiffArg ?? 8);

const src = PNG.sync.read(fs.readFileSync(inFile));
const out = new PNG({ width: src.width, height: src.height });

let cleared = 0;
for (let i = 0; i < src.data.length; i += 4) {
  const r = src.data[i];
  const g = src.data[i + 1];
  const b = src.data[i + 2];
  const avg = (r + g + b) / 3;
  const diff = Math.max(r, g, b) - Math.min(r, g, b);
  const isChecker = diff <= maxDiff && avg <= maxAvg;
  out.data[i] = r;
  out.data[i + 1] = g;
  out.data[i + 2] = b;
  out.data[i + 3] = isChecker ? 0 : 255;
  if (isChecker) cleared++;
}

fs.writeFileSync(outFile, PNG.sync.write(out));
console.log(`cleared ${cleared} / ${src.width * src.height} px (${(100 * cleared / (src.width * src.height)).toFixed(1)}%) ->`, outFile);
