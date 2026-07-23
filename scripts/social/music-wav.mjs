// Renders a short background-music bed to a WAV file for the promo video, in
// plain Node (no Web Audio / browser needed). Mirrors the "Arena Anthem"
// track from src/services/AudioService.js — same chord progression, same
// detuned-unison-per-note idea — just synthesized sample-by-sample instead of
// through AudioContext nodes.
import fs from 'node:fs';
import path from 'node:path';

const SR = 44100;
const OUT = process.argv[2] || 'social-kit/video/music.wav';
const DURATION = Number(process.argv[3] || 27);

const N = {
  A2: 110.0, C3: 130.81, D3: 146.83, E3: 164.81, F3: 174.61,
  G3: 196.0, A3: 220.0, B3: 246.94, C4: 261.63, D4: 293.66, E4: 329.63,
  F4: 349.23, G4: 392.0, A4: 440.0, B4: 493.88, C5: 523.25, D5: 587.33, E5: 659.25,
};

// Same shape as AudioService.MUSIC_TRACKS.anthem.
const TRACK = {
  bpm: 128, segSteps: 8, leadType: 'triangle', bassType: 'sine', pad: true,
  leadOffsets: [0, 2, 4, 6], bassOffsets: [0, 4],
  chords: [
    { root: N.A3, arp: [N.A4, N.C5, N.E5, N.C5] },
    { root: N.F3, arp: [N.F4, N.A4, N.C5, N.A4] },
    { root: N.C3, arp: [N.C4, N.E4, N.G4, N.E4] },
    { root: N.G3, arp: [N.G4, N.B4, N.D5, N.B4] },
  ],
};

function waveSample(type, phase) {
  const p = phase - Math.floor(phase);
  if (type === 'sine') return Math.sin(p * Math.PI * 2);
  if (type === 'square') return p < 0.5 ? 1 : -1;
  if (type === 'sawtooth') return 2 * p - 1;
  return p < 0.5 ? 4 * p - 1 : 3 - 4 * p; // triangle
}

const totalSamples = Math.ceil(DURATION * SR);
const buf = new Float64Array(totalSamples);

/** Two slightly-detuned voices (unison) with a soft attack/decay envelope. */
function addNote(startTime, freq, duration, type, gain, detuneCents = 7) {
  const startSample = Math.floor(startTime * SR);
  const nSamples = Math.floor((duration + 0.08) * SR);
  const attackSamples = Math.floor(0.03 * SR);
  for (const cents of [-detuneCents, detuneCents]) {
    const f = freq * 2 ** (cents / 1200);
    let phase = Math.random(); // random start phase avoids a locked-in-phase "buzz"
    for (let i = 0; i < nSamples; i += 1) {
      const idx = startSample + i;
      if (idx >= totalSamples || idx < 0) continue;
      const tt = i / SR;
      const env = i < attackSamples
        ? i / attackSamples
        : Math.exp((-3 * (tt - attackSamples / SR)) / duration);
      phase += f / SR;
      buf[idx] += waveSample(type, phase) * env * gain * 0.5;
    }
  }
}

function addPad(startTime, freqs, duration, gain) {
  for (const f of freqs) addNote(startTime, f, duration, 'sine', gain / freqs.length, 5);
}

const stepDur = 60 / TRACK.bpm / 4;
const totalSteps = TRACK.chords.length * TRACK.segSteps;
let t = 0.15;
let step = 0;
while (t < DURATION - 0.3) {
  const s = step % totalSteps;
  const chordIdx = Math.floor(s / TRACK.segSteps) % TRACK.chords.length;
  const local = s % TRACK.segSteps;
  const chord = TRACK.chords[chordIdx];
  const jitter = () => (Math.random() * 2 - 1) * 0.004;

  if (TRACK.bassOffsets.includes(local)) addNote(t + jitter(), chord.root, stepDur * 1.8, TRACK.bassType, 0.12);
  if (TRACK.leadOffsets.includes(local)) {
    const idx = TRACK.leadOffsets.indexOf(local) % chord.arp.length;
    addNote(t + jitter(), chord.arp[idx], stepDur * 1.5, TRACK.leadType, 0.1);
  }
  if (TRACK.pad && local === 0) addPad(t, chord.arp, stepDur * TRACK.segSteps * 0.95, 0.06);

  t += stepDur;
  step += 1;
}

// Fade out the last 1.5s so an ffmpeg `-shortest` trim never clips abruptly.
const fadeSamples = Math.floor(1.5 * SR);
for (let i = 0; i < fadeSamples; i += 1) {
  const idx = totalSamples - fadeSamples + i;
  if (idx >= 0) buf[idx] *= 1 - i / fadeSamples;
}

let peak = 0;
for (let i = 0; i < totalSamples; i += 1) peak = Math.max(peak, Math.abs(buf[i]));
const norm = peak > 0.9 ? 0.9 / peak : 1;

// Stereo interleaved 16-bit PCM (identical L/R — a simple mono-in-stereo bed).
const pcm = new Int16Array(totalSamples * 2);
for (let i = 0; i < totalSamples; i += 1) {
  const v = Math.max(-1, Math.min(1, buf[i] * norm));
  const s16 = Math.round(v * 32767);
  pcm[i * 2] = s16;
  pcm[i * 2 + 1] = s16;
}

const dataSize = pcm.length * 2;
const header = Buffer.alloc(44);
header.write('RIFF', 0);
header.writeUInt32LE(36 + dataSize, 4);
header.write('WAVE', 8);
header.write('fmt ', 12);
header.writeUInt32LE(16, 16);
header.writeUInt16LE(1, 20); // PCM
header.writeUInt16LE(2, 22); // stereo
header.writeUInt32LE(SR, 24);
header.writeUInt32LE(SR * 4, 28); // byte rate = SR * blockAlign
header.writeUInt16LE(4, 32); // blockAlign = channels * bytesPerSample
header.writeUInt16LE(16, 34);
header.write('data', 36);
header.writeUInt32LE(dataSize, 40);

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, Buffer.concat([header, Buffer.from(pcm.buffer)]));
console.log('Wrote', OUT, `(${DURATION}s)`);
