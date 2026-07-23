// ---------------------------------------------------------------------------
// Background music — a handful of small procedural loops (no audio files).
// Each track is a chord progression split into equal-length segments; a bass
// note pulses the root, a lead plays a broken-chord (arpeggio) riff over it,
// and (optionally) a soft pad sustains the full chord underneath. Everything
// is scheduled on the AudioContext clock with a short lookahead so the loop
// stays tight instead of drifting like a naive setInterval melody would.
const N = { // equal-tempered note table (Hz), just what these tracks need
  A2: 110.0, Bb2: 116.54, C3: 130.81, D3: 146.83, E3: 164.81, F3: 174.61,
  G3: 196.0, A3: 220.0, B3: 246.94, C4: 261.63, D4: 293.66, E4: 329.63,
  F4: 349.23, Fs4: 369.99, G4: 392.0, A4: 440.0, Bb4: 466.16, B4: 493.88,
  C5: 523.25, Cs5: 554.37, D5: 587.33, E5: 659.25, F5: 698.46, G5: 783.99,
};

export const MUSIC_TRACKS = {
  anthem: {
    name: 'Arena Anthem',
    desc: 'Warm & heroic',
    bpm: 128, segSteps: 8, leadType: 'triangle', bassType: 'sine', pad: true,
    leadOffsets: [0, 2, 4, 6], bassOffsets: [0, 4],
    chords: [
      { root: N.A3, arp: [N.A4, N.C5, N.E5, N.C5] },
      { root: N.F3, arp: [N.F4, N.A4, N.C5, N.A4] },
      { root: N.C3, arp: [N.C4, N.E4, N.G4, N.E4] },
      { root: N.G3, arp: [N.G4, N.B4, N.D5, N.B4] },
    ],
  },
  drift: {
    name: 'Neon Drift',
    desc: 'Energetic & driving',
    bpm: 140, segSteps: 8, leadType: 'sawtooth', bassType: 'square', pad: false,
    leadOffsets: [0, 2, 3, 5], bassOffsets: [0, 4],
    chords: [
      { root: N.E3, arp: [N.E4, N.G4, N.B4, N.G4] },
      { root: N.C3, arp: [N.C4, N.E4, N.G4, N.E4] },
      { root: N.D3, arp: [N.D4, N.Fs4, N.A4, N.Fs4] },
      { root: N.G3, arp: [N.G4, N.B4, N.D5, N.B4] },
    ],
  },
  shadow: {
    name: 'Shadow Pulse',
    desc: 'Dark & tense',
    bpm: 100, segSteps: 8, leadType: 'square', bassType: 'sine', pad: true,
    leadOffsets: [0, 4], bassOffsets: [0],
    chords: [
      { root: N.D3, arp: [N.D4, N.F4, N.A4, N.F4] },
      { root: N.Bb2, arp: [N.Bb4, N.D4, N.F4, N.D4] },
      { root: N.G3, arp: [N.G4, N.Bb4, N.D5, N.Bb4] },
      { root: N.A3, arp: [N.A4, N.Cs5, N.E5, N.Cs5] },
    ],
  },
};
export const DEFAULT_MUSIC_TRACK = 'anthem';

export class AudioService {
  constructor() {
    this.enabled = true;
    this.musicEnabled = true;
    this.ctx = null;
    this.musicInterval = null;
    this.volume = 0.8;
    this.master = null;
    this.musicTrack = DEFAULT_MUSIC_TRACK;
  }

  async init() {
    if (typeof window === 'undefined') return;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    this.ctx = new AudioContext();
    // Master bus: every sound routes through here so one gain node controls
    // the overall volume (and lets us duck/mute on app background).
    this.master = this.ctx.createGain();
    this.master.gain.value = this.volume;
    this.master.connect(this.ctx.destination);

    // A small synthesized-impulse reverb send. Music notes route a little of
    // their signal through this — it's the single biggest thing that turns a
    // dry oscillator into something that sounds like a "song" rather than a
    // beeping test tone. SFX skip it entirely (they stay punchy/dry).
    this.reverb = this.ctx.createConvolver();
    this.reverb.buffer = this._impulse(1.8, 2.6);
    this.reverbGain = this.ctx.createGain();
    this.reverbGain.gain.value = 0.4;
    this.reverb.connect(this.reverbGain);
    this.reverbGain.connect(this.master);
  }

  /** Synthesize a soft-decay noise impulse response (no reverb IR file needed). */
  _impulse(duration, decay) {
    const rate = this.ctx.sampleRate;
    const length = Math.floor(rate * duration);
    const buf = this.ctx.createBuffer(2, length, rate);
    for (let c = 0; c < 2; c += 1) {
      const data = buf.getChannelData(c);
      for (let i = 0; i < length; i += 1) {
        data[i] = (Math.random() * 2 - 1) * (1 - i / length) ** decay;
      }
    }
    return buf;
  }

  /** Route to the master bus (falls back to destination pre-init). */
  get out() {
    return this.master || this.ctx?.destination;
  }

  setVolume(v) {
    this.volume = Math.max(0, Math.min(1, v));
    if (this.master) this.master.gain.value = this.volume;
  }

  setEnabled(sound, music) {
    this.enabled = sound;
    this.musicEnabled = music;
    if (!music) this.stopMusic();
  }

  /** Suspend the whole audio context (used when the app is backgrounded). */
  suspend() {
    this.stopMusic();
    if (this.ctx?.state === 'running') this.ctx.suspend();
  }

  resume() {
    if (this.ctx?.state === 'suspended') this.ctx.resume();
  }

  tone(freq, duration = 0.08, type = 'sine', gain = 0.08, when = 0) {
    if (!this.enabled || !this.ctx) return;
    this.resume();
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    osc.connect(g);
    g.connect(this.out);
    const t = this.ctx.currentTime + when;
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + duration);
    osc.start(t);
    osc.stop(t + duration);
  }

  noise(duration = 0.15, gain = 0.12) {
    if (!this.enabled || !this.ctx) return;
    this.resume();
    const bufferSize = Math.floor(this.ctx.sampleRate * duration);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i += 1) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const g = this.ctx.createGain();
    g.gain.value = gain;
    src.connect(g);
    g.connect(this.out);
    src.start();
  }

  punch() {
    this.tone(160, 0.09, 'square', 0.07);
    this.noise(0.06, 0.05);
  }

  hitLand() {
    this.tone(90, 0.18, 'sawtooth', 0.12);
    this.noise(0.1, 0.08);
  }

  special() {
    this.tone(520, 0.12, 'triangle', 0.08);
    this.tone(780, 0.14, 'triangle', 0.06, 0.05);
  }

  jump() {
    this.tone(420, 0.1, 'sine', 0.05);
    this.tone(640, 0.08, 'sine', 0.04, 0.05);
  }

  block() {
    this.tone(300, 0.1, 'triangle', 0.06);
  }

  ko() {
    this.tone(200, 0.3, 'sawtooth', 0.12);
    this.tone(120, 0.4, 'square', 0.1, 0.08);
  }

  select() {
    this.tone(660, 0.06, 'sine', 0.06);
    this.tone(990, 0.06, 'sine', 0.05, 0.05);
  }

  pickup() {
    this.tone(720, 0.06, 'square', 0.05);
    this.tone(1040, 0.07, 'square', 0.04, 0.05);
  }

  throw() {
    this.tone(300, 0.1, 'sawtooth', 0.06);
    this.noise(0.08, 0.05);
  }

  weaponBreak() {
    this.noise(0.16, 0.1);
    this.tone(140, 0.14, 'square', 0.06);
  }

  rage() {
    this.tone(110, 0.28, 'sawtooth', 0.09);
    this.tone(220, 0.3, 'square', 0.06, 0.04);
    this.tone(330, 0.24, 'triangle', 0.04, 0.08);
  }

  /**
   * Play one music note at an ABSOLUTE AudioContext time. This is the piece
   * that makes the loops sound like an instrument instead of a beeping test
   * tone: two slightly-detuned oscillators (unison, like a real synth voice)
   * feed a lowpass filter that sweeps closed over the note's life (a "pluck"
   * rather than a flat buzz), a touch of vibrato on sustained lead notes, and
   * a reverb send for space. `opts.vibrato` (cents) and `opts.detune` (cents)
   * are optional; humanization (micro-timing/velocity) is applied by the
   * caller before this is invoked.
   */
  _noteAt(time, freq, duration, type, gain, opts = {}) {
    const detune = opts.detune ?? 7;
    const vibrato = opts.vibrato ?? 0;

    const bus = this.ctx.createGain();
    bus.gain.setValueAtTime(0.0001, time);
    bus.gain.exponentialRampToValueAtTime(gain, time + 0.03);
    bus.gain.exponentialRampToValueAtTime(0.0001, time + duration);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.Q.value = 0.6;
    filter.frequency.setValueAtTime(Math.min(9000, freq * 9), time);
    filter.frequency.exponentialRampToValueAtTime(Math.max(320, freq * 1.7), time + duration * 0.85);
    filter.connect(bus);

    let lfo = null;
    let lfoGain = null;
    if (vibrato > 0) {
      lfo = this.ctx.createOscillator();
      lfoGain = this.ctx.createGain();
      lfo.frequency.value = 5.4;
      lfoGain.gain.value = vibrato;
      lfo.connect(lfoGain);
      lfo.start(time + duration * 0.15); // let the note settle before it wobbles
      lfo.stop(time + duration + 0.05);
    }

    const voices = [-detune, detune];
    for (const cents of voices) {
      const osc = this.ctx.createOscillator();
      osc.type = type;
      osc.frequency.value = freq;
      osc.detune.value = cents;
      if (lfoGain) lfoGain.connect(osc.detune);
      osc.connect(filter);
      osc.start(time);
      osc.stop(time + duration + 0.05);
    }

    bus.connect(this.out); // dry
    bus.connect(this.reverb || this.out); // wet send (space/warmth)
  }

  /** Change the selected loop; if music is already playing, hot-swap it. */
  setMusicTrack(id) {
    this.musicTrack = MUSIC_TRACKS[id] ? id : DEFAULT_MUSIC_TRACK;
    if (this.musicInterval) this.startMusic();
  }

  startMusic() {
    this.stopMusic();
    if (!this.musicEnabled || !this.ctx) return;
    this.resume();
    const track = MUSIC_TRACKS[this.musicTrack] || MUSIC_TRACKS[DEFAULT_MUSIC_TRACK];
    const stepDur = 60 / track.bpm / 4; // one 16th note, in seconds
    const totalSteps = track.chords.length * track.segSteps;
    const lookahead = 0.15; // schedule this far ahead of "now" each tick
    let step = 0;
    let nextTime = this.ctx.currentTime + 0.05;

    // Small humanization helpers — a hair of timing/velocity variance is the
    // difference between "sequenced" and "robotic". Bass stays tight (it's
    // the rhythmic anchor); the lead gets a little more push and pull.
    const jitter = (maxMs) => (Math.random() * 2 - 1) * (maxMs / 1000);
    const vel = (base, spread) => base * (1 - spread / 2 + Math.random() * spread);

    const scheduleStep = (time) => {
      const s = step % totalSteps;
      const chordIdx = Math.floor(s / track.segSteps) % track.chords.length;
      const local = s % track.segSteps;
      const chord = track.chords[chordIdx];

      if (track.bassOffsets.includes(local)) {
        this._noteAt(time + jitter(4), chord.root, stepDur * 1.8, track.bassType, vel(0.05, 0.12), { detune: 4 });
      }
      if (track.leadOffsets.includes(local)) {
        const idx = track.leadOffsets.indexOf(local) % chord.arp.length;
        this._noteAt(time + jitter(14), chord.arp[idx], stepDur * 1.5, track.leadType, vel(0.04, 0.3), { detune: 8, vibrato: 5 });
      }
      if (track.pad && local === 0) {
        for (const f of chord.arp) this._noteAt(time, f, stepDur * track.segSteps * 0.95, 'sine', 0.011, { detune: 5 });
      }
      step += 1;
    };

    this.musicInterval = setInterval(() => {
      if (!this.musicEnabled) return;
      while (nextTime < this.ctx.currentTime + lookahead) {
        scheduleStep(nextTime);
        nextTime += stepDur;
      }
    }, 40);
  }

  stopMusic() {
    if (this.musicInterval) {
      clearInterval(this.musicInterval);
      this.musicInterval = null;
    }
  }
}
