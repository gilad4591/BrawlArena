// Builds vertical (1080x1920) TikTok/Instagram Reels clips from FRESH
// gameplay recordings (3 new character/arena matchups, distinct from the
// two landscape promos already in social-kit/video/).
//
// Unlike the landscape promos, these:
//   - are reformatted to 9:16 (blurred-pad technique, same trick already
//     used for stills in screenshots.mjs, applied per-frame to video)
//   - SPEED-RAMP the repetitive/lower-interest beats (character select,
//     cosmetics browsing, the long victory-screen hold) while keeping the
//     actual fight at real-time speed, so a ~37s raw recording tightens up
//     to a punchier ~30s clip without losing any of the good parts
//   - end on a short "DOWNLOAD NOW" outro card
//   - get a REAL royalty-free music bed — social-kit/music/8bit-dungeon-
//     boss.mp3 ("8bit Dungeon Boss" by Kevin MacLeod, incompetech.com, CC
//     BY 3.0 — see social-kit/music/CREDIT.txt for the required
//     attribution text to paste into each post's caption) — instead of the
//     synthesized placeholder bed music-wav.mjs generates for the other
//     promos in this kit.
//
// NO voiceover is baked in here on purpose — narrate.mjs's ElevenLabs
// script pack (social-kit/voiceover-scripts.md, Scripts D-F) is timed
// against THIS script's own output (each clip's
// `<outName>.tiktok-timeline.json` sidecar has the real post-speed-ramp
// timestamp of every beat). Once real VO audio comes back from
// ElevenLabs, duck it under the `<outName>_music.wav` sidecar this script
// also writes out (kept around on purpose, same idea as narrate.mjs's
// sidechaincompress mix) instead of re-generating the music.
//
// Usage: node scripts/social/tiktok-clips.mjs [devServerPort]
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import ffmpegPath from 'ffmpeg-static';

const ROOT = process.cwd();
const VIDEO_DIR = path.join(ROOT, 'social-kit', 'video');
const OUT_DIR = path.join(VIDEO_DIR, 'tiktok');
fs.mkdirSync(OUT_DIR, { recursive: true });
const TMP = path.join(OUT_DIR, '_tmp');
fs.mkdirSync(TMP, { recursive: true });

const FONT = 'C:/Windows/Fonts/arialbd.ttf';
const MUSIC_SRC = path.join(ROOT, 'social-kit', 'music', '8bit-dungeon-boss.mp3');
const PORT = process.argv[2] || '5180';
const OUTRO_DUR = 2.8;
const CREDIT = 'Music: Kevin MacLeod (incompetech.com)';

// Three fresh matchups, distinct from the two already recorded
// (brawl-arena-promo.mp4 = Solaris/Forest, duel-volt-neon.mp4 = Volt/Neon
// City) so the feed doesn't look repetitive.
const SCENARIOS = [
  { outName: 'duel-umbra-graveyard', character: 'umbra', arena: 'shadow_graveyard', display: 'Umbra - Shadow Graveyard' },
  { outName: 'duel-titania-skytemple', character: 'titania', arena: 'sky_temple', display: 'Titania - Sky Temple' },
  { outName: 'duel-golem-volcano', character: 'golem', arena: 'volcano', display: 'Golem - Volcano' },
];

// Speed multiplier applied to each beat of the raw recording (matched by
// record-gameplay.mjs's mark() labels). >1 = faster (repetitive/lower-
// interest beats); 1.0 = real-time (the actual fight, so combos/specials
// still read clearly frame-by-frame).
const SPEED_MAP = {
  menu: 1.15,
  'character select': 1.6,
  'cosmetics: aura equip': 1.7,
  'cosmetics: frame tab': 1.8,
  'start match': 1.0,
  fight: 1.0,
  'special (1)': 1.0,
  'special (2)': 1.0,
  'special (3)': 1.0,
  'finishing blow': 1.0,
  'victory hold': 1.6,
};

function run(args) {
  execFileSync(ffmpegPath, args, { stdio: 'inherit' });
}

function escapeDrawtext(text) {
  return text.replace(/\\/g, '\\\\').replace(/:/g, '\\:').replace(/'/g, "\\'").replace(/%/g, '\\%');
}

function probeDuration(file) {
  try {
    execFileSync(ffmpegPath, ['-i', file], { stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (e) {
    const m = e.stderr.toString().match(/Duration: (\d+):(\d\d):(\d\d\.\d+)/);
    if (m) return (+m[1]) * 3600 + (+m[2]) * 60 + parseFloat(m[3]);
  }
  throw new Error(`could not probe duration of ${file}`);
}

function loadMarks(outName) {
  const file = path.join(VIDEO_DIR, `${outName}.timeline.json`);
  return JSON.parse(fs.readFileSync(file, 'utf8')).marks; // [{label, t}]
}

function concatDemuxer(files, outFile, extraArgs = []) {
  const listFile = path.join(TMP, `_list_${Math.random().toString(36).slice(2)}.txt`);
  fs.writeFileSync(listFile, files.map((f) => `file '${f.replace(/\\/g, '/')}'`).join('\n'));
  run(['-y', '-f', 'concat', '-safe', '0', '-i', listFile, ...extraArgs, outFile]);
}

async function buildScenario({ outName, character, arena, display }) {
  console.log(`\n=== ${outName} (${character} @ ${arena}) ===`);

  const raw = path.join(VIDEO_DIR, `${outName}.mp4`);
  const timelineFile = path.join(VIDEO_DIR, `${outName}.timeline.json`);
  const canSkipRecord = process.env.TIKTOK_SKIP_RECORD && fs.existsSync(raw) && fs.existsSync(timelineFile);
  if (canSkipRecord) {
    console.log('  (TIKTOK_SKIP_RECORD set — reusing existing raw recording)');
  } else {
    // 1) Record fresh footage (landscape, real timeline captured live).
    execFileSync(
      'node',
      [path.join(ROOT, 'scripts', 'social', 'record-gameplay.mjs'), PORT, outName, character, arena],
      { stdio: 'inherit' },
    );
  }
  const marks = loadMarks(outName);
  const rawDuration = probeDuration(raw);

  // 2) Cut + speed-ramp each beat (video-only — the raw file's own baked-in
  // synthesized music bed is dropped here; a fresh, real royalty-free
  // track is added later so it never itself gets sped up/broken by the
  // ramp). -ss/-t are given as OUTPUT options (after -i) for frame-accurate
  // cuts — input-seeking here would drift the very timestamps this whole
  // exercise is trying to get right.
  const segFiles = [];
  const newMarks = [];
  let newT = 0;
  for (let i = 0; i < marks.length; i++) {
    const start = marks[i].t;
    const end = i + 1 < marks.length ? marks[i + 1].t : rawDuration;
    const dur = Math.max(0.05, end - start);
    const speed = SPEED_MAP[marks[i].label] ?? 1.0;
    newMarks.push({ label: marks[i].label, t: Math.round(newT * 100) / 100 });
    newT += dur / speed;

    const segFile = path.join(TMP, `${outName}_seg${i}.mp4`);
    const vf = speed === 1 ? 'null' : `setpts=PTS/${speed}`;
    run([
      '-y', '-i', raw, '-ss', String(start), '-t', String(dur), '-an',
      '-vf', vf, '-r', '30',
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-pix_fmt', 'yuv420p',
      segFile,
    ]);
    segFiles.push(segFile);
  }
  newMarks.push({ label: 'end', t: Math.round(newT * 100) / 100 });

  const sped = path.join(TMP, `${outName}_sped.mp4`);
  concatDemuxer(segFiles, sped, ['-c', 'copy']);

  // 3) Vertical reformat (blurred-pad — same technique as screenshots.mjs's
  // still-image version) + a small permanent attribution credit burned in
  // for the whole clip (required by the music's CC BY license; a caption
  // credit alone can get truncated by the platform).
  const vertical = path.join(TMP, `${outName}_vertical.mp4`);
  const creditDraw = `drawtext=fontfile='${FONT}':text='${escapeDrawtext(CREDIT)}':fontsize=22:fontcolor=white@0.65:x=24:y=h-46`;
  // setsar=1 is required here: without it ffmpeg carries forward a stale
  // pixel-aspect-ratio value from upstream (the concat-demuxer'd JPEG
  // frames), which left the 1080x1920 output tagged with a DAR that still
  // read as 16:9 in ffprobe/strict players (i.e. squished vertical video)
  // even though the actual pixel canvas was correctly 1080x1920 — forcing
  // square pixels makes the container's own aspect metadata match reality.
  const filter =
    `[0:v]scale=1080:1920,gblur=sigma=25,eq=brightness=-0.12,setsar=1[bg];` +
    `[0:v]scale=1080:1920:force_original_aspect_ratio=decrease,setsar=1[fg];` +
    `[bg][fg]overlay=(W-w)/2:(H-h)/2,setsar=1,${creditDraw}[out]`;
  run([
    '-y', '-i', sped, '-filter_complex', filter, '-map', '[out]',
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-pix_fmt', 'yuv420p',
    vertical,
  ]);

  // 4) Outro card — freeze the final frame and lay a "DOWNLOAD NOW" card
  // over it (same -loop 1 -i <still> pattern video.mjs already uses for
  // its Ken-Burns slideshow clips).
  const lastFrame = path.join(TMP, `${outName}_lastframe.png`);
  run(['-y', '-sseof', '-0.1', '-i', vertical, '-frames:v', '1', '-q:v', '2', lastFrame]);

  // Fully opaque and tall enough to blot out the busy victory-screen UI
  // (placement/XP/coin toasts, Share/Change Fighter/Main Menu buttons)
  // underneath — a merely semi-transparent/shorter bar (tried first) let
  // those bleed through around the CTA text, which read as messy/cluttered.
  const bar = 'drawbox=x=0:y=(ih/2)-280:w=iw:h=560:color=black@0.94:t=fill';
  const line3 = `drawtext=fontfile='${FONT}':text='BRAWL ARENA':fontsize=40:fontcolor=white@0.9:x=(w-text_w)/2:y=(h/2)-190`;
  const line1 = `drawtext=fontfile='${FONT}':text='DOWNLOAD NOW':fontsize=80:fontcolor=white:x=(w-text_w)/2:y=(h/2)-90`;
  const line2 = `drawtext=fontfile='${FONT}':text='App Store  |  Google Play':fontsize=46:fontcolor=#ffd24a:x=(w-text_w)/2:y=(h/2)+30`;
  const outro = path.join(TMP, `${outName}_outro.mp4`);
  run([
    '-y', '-loop', '1', '-i', lastFrame, '-t', String(OUTRO_DUR),
    '-vf', `${bar},${line1},${line2},${line3},${creditDraw}`, '-r', '30',
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-pix_fmt', 'yuv420p',
    outro,
  ]);

  // 5) Concat main + outro (still silent), then add the real music bed.
  const silent = path.join(TMP, `${outName}_silent.mp4`);
  concatDemuxer([vertical, outro], silent, [
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-pix_fmt', 'yuv420p',
  ]);
  const totalDur = probeDuration(silent);

  const musicOut = path.join(OUT_DIR, `${outName}_music.wav`);
  run([
    '-y', '-i', MUSIC_SRC, '-t', String(totalDur),
    '-af', `afade=t=in:st=0:d=0.6,afade=t=out:st=${Math.max(0, totalDur - 1.2).toFixed(2)}:d=1.2,volume=0.85`,
    musicOut,
  ]);

  const final = path.join(OUT_DIR, `${outName}.mp4`);
  run([
    '-y', '-i', silent, '-i', musicOut, '-shortest',
    '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart',
    final,
  ]);

  fs.writeFileSync(
    path.join(OUT_DIR, `${outName}.tiktok-timeline.json`),
    JSON.stringify({ outName, character, arena, display, duration: Math.round(totalDur * 100) / 100, marks: newMarks }, null, 2),
  );

  console.log(`✓ ${final} (${totalDur.toFixed(1)}s, was ${rawDuration.toFixed(1)}s raw)`);
  return { outName, display, rawDuration, duration: totalDur };
}

const results = [];
for (const s of SCENARIOS) {
  results.push(await buildScenario(s));
}

fs.rmSync(TMP, { recursive: true, force: true });
console.log('\nAll done ->', OUT_DIR);
for (const r of results) {
  console.log(`  ${r.outName}: ${r.rawDuration.toFixed(1)}s raw -> ${r.duration.toFixed(1)}s final`);
}
