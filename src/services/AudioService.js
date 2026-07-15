export class AudioService {
  constructor() {
    this.enabled = true;
    this.musicEnabled = true;
    this.ctx = null;
    this.musicInterval = null;
    this.volume = 0.8;
    this.master = null;
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

  startMusic() {
    if (!this.musicEnabled || !this.ctx || this.musicInterval) return;
    this.resume();
    const bass = [55, 55, 73, 65];
    const lead = [220, 277, 330, 294, 262, 220, 196, 247];
    let i = 0;
    this.musicInterval = setInterval(() => {
      if (!this.musicEnabled) return;
      this.tone(bass[i % bass.length], 0.22, 'triangle', 0.03);
      this.tone(lead[i % lead.length], 0.16, 'sine', 0.012);
      i += 1;
    }, 300);
  }

  stopMusic() {
    if (this.musicInterval) {
      clearInterval(this.musicInterval);
      this.musicInterval = null;
    }
  }
}
