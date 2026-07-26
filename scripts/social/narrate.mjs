// Adds an English voiceover to the existing promo videos (social-kit/video),
// ducking the instrumental music bed under the narration so the voice stays
// clear — for sharing on TikTok/Instagram/Shorts with actual speech instead
// of a silent/music-only clip.
//
// Voice: Windows' built-in OneCore TTS ("Microsoft Mark", offline, no API
// key/network needed) via scripts/social/tts.ps1 (WinRT SpeechSynthesizer —
// noticeably less robotic than the classic SAPI "Desktop" voices).
//
// Usage: node scripts/social/narrate.mjs
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import ffmpegPath from 'ffmpeg-static';

const ROOT = process.cwd();
const VIDEO_DIR = path.join(ROOT, 'social-kit', 'video');
const TMP = path.join(VIDEO_DIR, 'tts_tmp');
fs.mkdirSync(TMP, { recursive: true });

const VOICE = 'Microsoft Mark';

function run(args) {
  execFileSync(ffmpegPath, args, { stdio: 'inherit' });
}

function tts(text, outFile, rate = 1.0) {
  execFileSync('powershell', [
    '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File',
    path.join(ROOT, 'scripts', 'social', 'tts.ps1'),
    '-Text', text, '-OutFile', outFile, '-VoiceName', VOICE, '-Rate', String(rate),
  ], { stdio: 'inherit' });
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

// Renders each cue's line to its own WAV, delays it to its cue time, and
// mixes everything into one narration track spanning the full video length.
function buildNarrationTrack(lines, totalDuration, outWav, tag) {
  const files = lines.map((line, i) => {
    const raw = path.join(TMP, `${tag}_line_${i}.wav`);
    tts(line.text, raw, line.rate || 1.0);
    return raw;
  });
  const inputs = [];
  const delayParts = [];
  files.forEach((f, i) => {
    inputs.push('-i', f);
    const ms = Math.max(0, Math.round(lines[i].at * 1000));
    delayParts.push(`[${i}:a]adelay=${ms}|${ms}[d${i}]`);
  });
  const mixIn = files.map((_, i) => `[d${i}]`).join('');
  const filter = `${delayParts.join(';')};${mixIn}amix=inputs=${files.length}:duration=longest:dropout_transition=0:normalize=0,apad=whole_dur=${totalDuration}[aout]`;
  run(['-y', ...inputs, '-filter_complex', filter, '-map', '[aout]', '-t', String(totalDuration), outWav]);
}

function muxWithDuckedMusic(videoFile, narrationWav, duration, outFile) {
  const musicWav = path.join(TMP, path.basename(videoFile) + '.music.wav');
  execFileSync('node', [path.join(ROOT, 'scripts', 'social', 'music-wav.mjs'), musicWav, String(duration + 0.5)], { stdio: 'inherit' });
  const filter = [
    '[2:a]volume=0.5[music]',
    // A labeled pad can only be consumed once downstream — asplit duplicates
    // the voice track so it can feed both the sidechain-duck trigger AND the
    // final mix.
    '[1:a]volume=1.3,asplit=2[voice0][voice1]',
    '[music][voice0]sidechaincompress=threshold=0.05:ratio=8:attack=5:release=350[duckedmusic]',
    '[duckedmusic][voice1]amix=inputs=2:duration=first:dropout_transition=0:normalize=0,alimiter=limit=0.95[aout]',
  ].join(';');
  run([
    '-y',
    '-i', videoFile,
    '-i', narrationWav,
    '-i', musicWav,
    '-filter_complex', filter,
    '-map', '0:v', '-map', '[aout]',
    '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k',
    '-shortest',
    '-movflags', '+faststart',
    outFile,
  ]);
}

// ---- 1) Gameplay trailer (16:9) — timed to record-gameplay.mjs's own beats.
const GAMEPLAY = path.join(VIDEO_DIR, 'brawl-arena-promo.mp4');
if (fs.existsSync(GAMEPLAY)) {
  const dur = probeDuration(GAMEPLAY);
  console.log(`gameplay trailer: ${dur.toFixed(2)}s`);
  const lines = [
    { at: 0.3, text: 'This is Brawl Arena.' },
    { at: 5.0, text: 'Choose your fighter.' },
    { at: 7.6, text: 'Unlock auras, frames, and devastating effects.' },
    { at: 12.6, text: "Then... it's on." },
    { at: 15.2, text: 'Combos. Specials. Clutch counters.' },
    { at: 19.2, text: 'No mercy in the arena.' },
    { at: 27.6, text: 'One hit...' },
    { at: 30.4, text: 'K.O.! Victory!', rate: 1.1 },
    { at: 33.0, text: 'Brawl Arena. Free to play. Download now.' },
  ];
  const narrationWav = path.join(TMP, 'gameplay_narration.wav');
  buildNarrationTrack(lines, dur, narrationWav, 'gameplay');
  const out = path.join(VIDEO_DIR, 'brawl-arena-promo-voiceover.mp4');
  muxWithDuckedMusic(GAMEPLAY, narrationWav, dur, out);
  console.log('✓', out);
}

// ---- 2) Roster montage (square + story) — same slideshow timeline for both.
const ROSTER_LINES_BASE = [
  { at: 0.2, text: 'Meet the roster of Brawl Arena.' },
  { at: 2.6, text: 'Blaze.' },
  { at: 5.0, text: 'Frost.' },
  { at: 7.4, text: 'Volt.' },
  { at: 9.8, text: 'Sylva.' },
  { at: 12.2, text: 'Nox.' },
  { at: 14.6, text: 'Golem.' },
  { at: 17.0, text: 'Aurex.' },
  { at: 19.4, text: 'Sage.' },
  { at: 21.8, text: 'Solaris.' },
  { at: 24.3, text: 'Ten heroes. One arena. Download Brawl Arena free today.' },
];

for (const tag of ['square', 'story']) {
  const file = path.join(VIDEO_DIR, `promo_${tag}.mp4`);
  if (!fs.existsSync(file)) continue;
  const dur = probeDuration(file);
  console.log(`${tag} montage: ${dur.toFixed(2)}s`);
  const narrationWav = path.join(TMP, `${tag}_narration.wav`);
  buildNarrationTrack(ROSTER_LINES_BASE, dur, narrationWav, tag);
  const out = path.join(VIDEO_DIR, `promo_${tag}-voiceover.mp4`);
  muxWithDuckedMusic(file, narrationWav, dur, out);
  console.log('✓', out);
}

fs.rmSync(TMP, { recursive: true, force: true });
console.log('\nAll done ->', VIDEO_DIR);
