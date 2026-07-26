// Adds an English voiceover + burned-in captions to the existing promo
// videos (social-kit/video), ducking the instrumental music bed under the
// narration so the voice stays clear — for sharing on TikTok/Instagram/
// Shorts with actual (natural-sounding) speech + on-screen subtitles.
//
// Voice: Microsoft Edge's free neural "Read Aloud" voices (same Azure
// Neural TTS engine used in real commercial products — genuinely natural,
// not the robotic classic SAPI/OneCore voices) via the `msedge-tts` npm
// package. No API key/account needed; it's the same free service Edge
// itself uses. Requires network access to speech.platform.bing.com.
//
// Captions use ffmpeg's `drawtext` (NOT the `subtitles`/libass filter) so
// each cue can be placed at an exact pixel position. libass's `MarginV`
// turned out to silently scale against an assumed (and wrong) internal
// script resolution when styling a plain SRT — margins came out ~4x
// smaller/larger than specified depending on the video's real resolution,
// which is a well-known libass/ffmpeg gotcha. drawtext has no such
// ambiguity: position is a literal pixel expression.
//
// NOTE: on a network with TLS-inspecting corporate proxies (Zscaler etc.)
// the proxy's own re-signed certificate isn't in Node's trust store, so
// the WebSocket handshake fails with SELF_SIGNED_CERT_IN_CHAIN. This is a
// local dev/build-time tool talking only to Microsoft's public TTS
// endpoint with non-sensitive marketing copy, so we relax TLS verification
// for this process only rather than requiring the proxy's root CA to be
// installed into Node's trust store.
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import ffmpegPath from 'ffmpeg-static';
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';

const ROOT = process.cwd();
const VIDEO_DIR = path.join(ROOT, 'social-kit', 'video');
const TMP = path.join(VIDEO_DIR, 'tts_tmp');
fs.mkdirSync(TMP, { recursive: true });

// en-US-GuyNeural: energetic, deep male voice — reads well as a game-trailer
// announcer. Swap to e.g. 'en-US-AriaNeural' (female) or
// 'en-US-ChristopherNeural' (deeper, more serious) to try a different tone.
const VOICE = 'en-US-GuyNeural';
const FONT = 'C:/Windows/Fonts/arialbd.ttf';

function run(args) {
  execFileSync(ffmpegPath, args, { stdio: 'inherit' });
}

async function synthLine(text, outMp3) {
  const tts = new MsEdgeTTS();
  await tts.setMetadata(VOICE, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
  const { audioStream } = tts.toStream(text, { rate: '+4%' });
  const chunks = [];
  for await (const chunk of audioStream) chunks.push(chunk);
  fs.writeFileSync(outMp3, Buffer.concat(chunks));
  tts.close();
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

// Escapes a Windows path for use inside an ffmpeg filter argument, where
// both the drive-letter colon and backslashes need escaping.
function escapeFilterPath(p) {
  return p.replace(/\\/g, '/').replace(/:/g, '\\:');
}

// Escapes literal text for ffmpeg's own filtergraph value syntax (distinct
// from shell escaping — no shell is involved, execFileSync passes argv
// directly — this is ffmpeg's *own* `:`/`'`/`\` special characters inside a
// filter option value).
function escapeDrawtext(text) {
  return text.replace(/\\/g, '\\\\').replace(/:/g, '\\:').replace(/'/g, "\\'").replace(/%/g, '\\%');
}

// Synthesizes every cue, returning each with its *actual* spoken duration
// (Edge TTS doesn't speak at a perfectly predictable rate, so the caption/
// mix timing is built from the real rendered audio, not an estimate). Each
// cue's on-screen end time is clamped just before the next cue starts, so
// captions never visually overlap even if speech runs a bit long.
async function synthLines(lines, tag) {
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const file = path.join(TMP, `${tag}_line_${i}.mp3`);
    await synthLine(lines[i].text, file);
    out.push({ ...lines[i], file, dur: probeDuration(file) });
  }
  out.forEach((line, i) => {
    const hardEnd = line.at + line.dur + 0.4;
    const nextStart = i + 1 < out.length ? out[i + 1].at - 0.1 : Infinity;
    line.captionEnd = Math.min(hardEnd, nextStart);
  });
  return out;
}

function buildNarrationTrack(synthed, totalDuration, outWav) {
  const inputs = [];
  const delayParts = [];
  synthed.forEach((line, i) => {
    inputs.push('-i', line.file);
    const ms = Math.max(0, Math.round(line.at * 1000));
    delayParts.push(`[${i}:a]adelay=${ms}|${ms}[d${i}]`);
  });
  const mixIn = synthed.map((_, i) => `[d${i}]`).join('');
  const filter = `${delayParts.join(';')};${mixIn}amix=inputs=${synthed.length}:duration=longest:dropout_transition=0:normalize=0,apad=whole_dur=${totalDuration}[aout]`;
  run(['-y', ...inputs, '-filter_complex', filter, '-map', '[aout]', '-t', String(totalDuration), outWav]);
}

// Per-cue caption with its own semi-opaque box (drawtext's box=1) — used for
// the gameplay clip, where the game's own HUD occupies the bottom two-
// thirds, leaving the top clear enough that a per-line floating box reads
// fine on its own.
function drawtextChain(synthed, fontSize, yExpr) {
  return synthed
    .map((line) => {
      const text = escapeDrawtext(line.text);
      return `drawtext=fontfile='${FONT}':text='${text}':fontsize=${fontSize}:fontcolor=white:box=1:boxcolor=black@0.88:boxborderw=12:x=(w-text_w)/2:y=${yExpr}:enable='between(t\\,${line.at.toFixed(2)}\\,${line.captionEnd.toFixed(2)})'`;
    })
    .join(',');
}

// Roster-card montage: every card already has a logo/ribbon up top and
// name/CTA/handle text packed into the bottom two-thirds, so a per-line
// *floating* box (semi-transparent) still let that existing text show
// through underneath (0.85 alpha only dims it, doesn't hide it). Instead,
// paint one FULLY opaque bar across the whole bottom edge for the entire
// clip (tall enough to fully cover that existing bottom text) and lay the
// per-cue captions on top of it, boxless.
function drawtextOnBarChain(synthed, fontSize, barHeight) {
  const bar = `drawbox=x=0:y=ih-${barHeight}:w=iw:h=${barHeight}:color=black@1.0:t=fill`;
  const textY = `h-${barHeight}+${Math.round((barHeight - fontSize) / 2)}`;
  const lines = synthed
    .map((line) => {
      const text = escapeDrawtext(line.text);
      return `drawtext=fontfile='${FONT}':text='${text}':fontsize=${fontSize}:fontcolor=white:x=(w-text_w)/2:y=${textY}:enable='between(t\\,${line.at.toFixed(2)}\\,${line.captionEnd.toFixed(2)})'`;
    })
    .join(',');
  return `${bar},${lines}`;
}

function muxWithDuckedMusicAndCaptions(videoFile, narrationWav, duration, captionFilter, outFile) {
  const musicWav = path.join(TMP, path.basename(videoFile) + '.music.wav');
  execFileSync('node', [path.join(ROOT, 'scripts', 'social', 'music-wav.mjs'), musicWav, String(duration + 0.5)], { stdio: 'inherit' });
  const filter = [
    `[0:v]${captionFilter}[vout]`,
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
    '-map', '[vout]', '-map', '[aout]',
    // Captions require re-encoding the video (can no longer use -c:v copy
    // once a video filter is applied).
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '192k',
    '-shortest',
    '-movflags', '+faststart',
    outFile,
  ]);
}

async function processVideo({ file, lines, tag, captionFilter }) {
  if (!fs.existsSync(file)) return;
  const dur = probeDuration(file);
  console.log(`\n${tag}: ${dur.toFixed(2)}s — synthesizing ${lines.length} lines…`);
  const synthed = await synthLines(lines, tag);
  const narrationWav = path.join(TMP, `${tag}_narration.wav`);
  buildNarrationTrack(synthed, dur, narrationWav);
  const out = path.join(VIDEO_DIR, `${path.basename(file, '.mp4')}-voiceover.mp4`);
  muxWithDuckedMusicAndCaptions(file, narrationWav, dur, captionFilter(synthed), out);
  console.log('✓', out);
}

// Reads the `<outName>.timeline.json` sidecar that record-gameplay.mjs
// writes next to each raw capture — the REAL wall-clock second each named
// beat (menu / character select / fight / K.O. / …) actually happened on
// screen, measured live during capture rather than guessed from the
// recording script's sleep() calls. Lines below are scheduled at
// `tl.at('label') + small offset` so captions/VO always land on the beat
// they describe, regardless of any run-to-run timing drift in the capture
// itself (network/render jitter etc.) — this is the fix for VO/captions
// not matching what's on screen.
function loadTimeline(outName) {
  const file = path.join(VIDEO_DIR, `${outName}.timeline.json`);
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  const byLabel = {};
  data.marks.forEach((m) => { byLabel[m.label] = m.t; });
  return { ...data, at: (label) => byLabel[label] };
}

// ---- 1) Gameplay trailers (16:9) — each timed to its OWN recording's real
// timeline (see loadTimeline above). Captions sit near the TOP of the frame
// — the game's own HUD (health bars, on-screen joystick/buttons, floating
// combo/damage numbers) already occupies the bottom two-thirds of this
// footage. The health-bar row is only ~40px tall, so y=48 clears it.
const tl1 = loadTimeline('brawl-arena-promo');
const GAMEPLAY_LINES = [
  { at: tl1.at('menu') + 0.3, text: 'This is Brawl Arena.' },
  { at: tl1.at('character select') + 0.3, text: 'Fourteen heroes. Choose yours.' },
  { at: tl1.at('cosmetics: aura equip') + 0.3, text: 'Gear up with elemental auras' },
  { at: tl1.at('cosmetics: frame tab') + 0.3, text: 'and rare portrait frames.' },
  { at: tl1.at('start match') + 0.3, text: 'Solaris steps into the arena.' },
  { at: tl1.at('fight') + 0.3, text: 'The fight begins!' },
  { at: tl1.at('special (1)') + 0.3, text: 'Unleash devastating special attacks' },
  { at: tl1.at('special (2)') + 0.3, text: 'chain combos without mercy' },
  { at: tl1.at('special (3)') + 0.3, text: 'and finish strong.' },
  { at: tl1.at('victory hold') + 0.3, text: 'K.O.! Victory! Brawl Arena — download free today.' },
];

// Second scenario: Volt in the Neon City arena — same beat structure, fresh
// character/arena/copy for variety (posting the same fight twice looks
// repetitive on a feed).
const tl2 = loadTimeline('duel-volt-neon');
const GAMEPLAY_LINES_2 = [
  { at: tl2.at('menu') + 0.3, text: 'Brawl Arena — pick your fighter.' },
  { at: tl2.at('character select') + 0.3, text: 'Meet Volt, master of storms.' },
  { at: tl2.at('cosmetics: aura equip') + 0.3, text: 'Equip a crackling storm aura' },
  { at: tl2.at('cosmetics: frame tab') + 0.3, text: 'and an electrified frame.' },
  { at: tl2.at('start match') + 0.3, text: 'Into the Neon City arena.' },
  { at: tl2.at('fight') + 0.3, text: 'Sparks fly fast.' },
  { at: tl2.at('special (1)') + 0.3, text: 'Special attacks light up the night' },
  { at: tl2.at('special (2)') + 0.3, text: 'combo after combo' },
  { at: tl2.at('special (3)') + 0.3, text: 'no escape.' },
  { at: tl2.at('victory hold') + 0.3, text: 'K.O.! Victory! Brawl Arena — free on iOS and Android.' },
];

// ---- 2) Roster montage (square + story) — same slideshow timeline; every
// card already has its own logo/ribbon at the top and name/CTA/handle text
// packed into the bottom two-thirds, so the one genuinely clear strip on
// every card is a thin band right at the very bottom edge, below the
// "@brawlarenagame" handle line.
const ROSTER_LINES = [
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

await processVideo({
  file: path.join(VIDEO_DIR, 'brawl-arena-promo.mp4'), lines: GAMEPLAY_LINES, tag: 'gameplay',
  captionFilter: (synthed) => drawtextChain(synthed, 26, '48'),
});
await processVideo({
  file: path.join(VIDEO_DIR, 'duel-volt-neon.mp4'), lines: GAMEPLAY_LINES_2, tag: 'gameplay2',
  captionFilter: (synthed) => drawtextChain(synthed, 26, '48'),
});
await processVideo({
  file: path.join(VIDEO_DIR, 'promo_square.mp4'), lines: ROSTER_LINES, tag: 'square',
  captionFilter: (synthed) => drawtextOnBarChain(synthed, 30, 130),
});
await processVideo({
  file: path.join(VIDEO_DIR, 'promo_story.mp4'), lines: ROSTER_LINES, tag: 'story',
  captionFilter: (synthed) => drawtextOnBarChain(synthed, 36, 180),
});

fs.rmSync(TMP, { recursive: true, force: true });
console.log('\nAll done ->', VIDEO_DIR);
