/**
 * Painted VFX sprites (glowing energy orbs for projectiles + impact bursts for
 * hits/AoE). Extracted from black-background sheets so they render great with
 * additive blending. Any missing image falls back to the procedural drawing.
 */
export const ORB_IMAGES = {};
export const IMPACT_IMAGES = {};
export const STATUS_IMAGES = {};
export const SLASH_IMAGES = {};
export const DUST_IMAGES = {};
export const BANNER_IMAGES = {};
// Elemental skin auras: black-background 4x2 (8-frame) loops drawn additively
// around a fighter. AURA_IMAGES[theme] = HTMLImageElement.
export const AURA_IMAGES = {};
export const AURA_COLS = 4;
export const AURA_ROWS = 2;
export const AURA_FRAMES = AURA_COLS * AURA_ROWS;
const AURA_NAMES = ['inferno', 'frost', 'storm', 'toxic', 'divine', 'void'];
const VFX_VERSION = '2';

const ORB_NAMES = ['fire', 'ice', 'lightning', 'toxic', 'void', 'holy', 'water', 'blood'];
const IMPACT_NAMES = ['starburst', 'slash', 'streak', 'shockwave', 'fireblast', 'spiral'];
const STATUS_NAMES = ['rage', 'frozen', 'burn', 'dizzy', 'poison', 'shield', 'powerup', 'levelup'];
const SLASH_NAMES = ['white', 'red', 'blue', 'fire', 'void', 'green'];
const DUST_NAMES = ['run', 'land', 'jump', 'smoke', 'dash', 'impact'];
const BANNER_NAMES = ['fight', 'ko', 'perfect', 'combo'];

export async function loadVfxImages() {
  const base = import.meta.env.BASE_URL || '/';
  const load = (map, dir, prefix, name) =>
    new Promise((res) => {
      const img = new Image();
      img.onload = () => { map[name] = img; res(); };
      img.onerror = () => res();
      img.src = `${base}ui/${dir}/${prefix}${name}.png?v=${VFX_VERSION}`;
    });
  await Promise.all([
    ...ORB_NAMES.map((n) => load(ORB_IMAGES, 'vfx', 'orb_', n)),
    ...IMPACT_NAMES.map((n) => load(IMPACT_IMAGES, 'vfx', 'impact_', n)),
    ...STATUS_NAMES.map((n) => load(STATUS_IMAGES, 'vfx', 'status_', n)),
    ...SLASH_NAMES.map((n) => load(SLASH_IMAGES, 'vfx', 'slash_', n)),
    ...DUST_NAMES.map((n) => load(DUST_IMAGES, 'vfx', 'dust_', n)),
    ...BANNER_NAMES.map((n) => load(BANNER_IMAGES, 'banners', 'banner_', n)),
    ...AURA_NAMES.map((n) => load(AURA_IMAGES, 'vfx', 'aura_', n)),
  ]);
}

// Elemental aura colours (procedural energy field — no baked silhouette).
const AURA_COLORS = {
  inferno: '#ff6a2b',
  frost: '#7fd4ff',
  storm: '#8ab6ff',
  toxic: '#9dff45',
  divine: '#ffd76a',
  void: '#c06bff',
};

function _hexRgb(hex) {
  const m = hex.replace('#', '');
  const s = m.length === 3 ? m.split('').map((c) => c + c).join('') : m;
  const n = parseInt(s, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/**
 * Draw a procedural elemental aura that wraps the fighter: a soft glow halo,
 * a ground pool and rising sparks — all additive and theme-tinted. There is no
 * baked silhouette, so it reads as an energy field around ANY fighter rather
 * than a ghost body behind them. `targetH` follows the caller's fighter height
 * convention (~1.72 x sprite height); `t` is seconds.
 */
export function drawAura(ctx, theme, cx, feetY, targetH, t, opts = {}) {
  const color = AURA_COLORS[theme];
  if (!color) return;
  const alpha = opts.alpha ?? 0.9;
  const fh = targetH / 1.72;            // approx fighter body height
  const [r, g, b] = _hexRgb(color);
  const rgba = (a) => `rgba(${r},${g},${b},${Math.max(0, a)})`;
  const pulse = 0.9 + 0.1 * Math.sin(t * 5);

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';

  // 1) body halo — a vertical glow the fighter's body sits inside of.
  ctx.save();
  ctx.translate(cx, feetY - fh * 0.46);
  const rh = fh * 0.62 * pulse;
  ctx.scale((fh * 0.34 * pulse) / rh, 1); // squash into a vertical ellipse
  const halo = ctx.createRadialGradient(0, 0, rh * 0.12, 0, 0, rh);
  halo.addColorStop(0, rgba(0.32 * alpha));
  halo.addColorStop(0.55, rgba(0.2 * alpha));
  halo.addColorStop(1, rgba(0));
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(0, 0, rh, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // 2) ground pool at the feet.
  ctx.save();
  ctx.translate(cx, feetY);
  ctx.scale(1, 0.3);
  const gr = fh * 0.36 * pulse;
  const pool = ctx.createRadialGradient(0, 0, 0, 0, 0, gr);
  pool.addColorStop(0, rgba(0.42 * alpha));
  pool.addColorStop(1, rgba(0));
  ctx.fillStyle = pool;
  ctx.beginPath();
  ctx.arc(0, 0, gr, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // 3) rising sparks that swirl up around the body.
  const N = 14;
  for (let i = 0; i < N; i++) {
    const rnd = (n) => { const s = Math.sin(i * 12.9898 + n) * 43758.5453; return s - Math.floor(s); };
    const life = (t * (0.35 + rnd(1) * 0.4) + rnd(2)) % 1;
    const px = cx + (rnd(3) - 0.5) * fh * 0.44 + Math.sin(t * 2 + i) * fh * 0.05;
    const py = feetY - life * fh * 0.98;
    const pr = Math.max(0.6, (0.5 + rnd(4) * 1.5) * (fh / 180) * 2.4);
    ctx.globalAlpha = Math.sin(life * Math.PI) * alpha;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(px, py, pr, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
}

/** Draw a centered VFX sprite scaled to a target height. */
export function drawVfx(ctx, img, cx, cy, targetH, opts = {}) {
  if (!img || !img.complete || !img.naturalWidth) return;
  const h = targetH;
  const w = h * (img.naturalWidth / img.naturalHeight);
  ctx.save();
  if (opts.additive) ctx.globalCompositeOperation = 'lighter';
  if (opts.alpha != null) ctx.globalAlpha = opts.alpha;
  ctx.translate(cx, cy);
  if (opts.rot) ctx.rotate(opts.rot);
  if (opts.flip) ctx.scale(-1, 1);
  ctx.drawImage(img, -w / 2, -h / 2, w, h);
  ctx.restore();
}

/**
 * Screen-space impact sprite: scales up while fading out, drawn additively.
 * Lives in the same particle list as Particle (shares update/render/dead API).
 */
export class ImpactFx {
  constructor(x, y, img, opts = {}) {
    this.x = x;
    this.y = y;
    this.img = img;
    this.size = opts.size ?? 54;
    this.life = opts.life ?? 0.28;
    this.maxLife = this.life;
    this.rot = opts.rot ?? (Math.random() - 0.5) * 0.5;
    this.spin = opts.spin ?? 0;
    this.grow = opts.grow ?? 0.6; // extra scale gained over lifetime
    this.startScale = opts.startScale ?? 0.55;
    this.additive = opts.additive ?? true;
    this.flip = opts.flip ?? false;
    this.rise = opts.rise ?? 0; // upward drift (px/s), for dust/smoke
    this.dead = false;
  }

  update(dt) {
    this.life -= dt;
    this.rot += this.spin * dt;
    this.y -= this.rise * dt;
    if (this.life <= 0) this.dead = true;
  }

  render(ctx) {
    const img = this.img;
    if (!img || !img.complete || !img.naturalWidth) return;
    const t = 1 - Math.max(0, this.life / this.maxLife); // 0 -> 1
    const scale = this.startScale + this.grow * t;
    const a = 1 - t * t; // fade out, front-loaded brightness
    const h = this.size * scale;
    const w = h * (img.naturalWidth / img.naturalHeight);
    ctx.save();
    if (this.additive) ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = Math.max(0, a);
    ctx.translate(this.x, this.y);
    if (this.rot) ctx.rotate(this.rot);
    if (this.flip) ctx.scale(-1, 1);
    ctx.drawImage(img, -w / 2, -h / 2, w, h);
    ctx.restore();
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }
}

/** Push an impact sprite by name into an effects list. */
export function impactFx(list, x, y, name, opts = {}) {
  const img = IMPACT_IMAGES[name];
  if (img) list.push(new ImpactFx(x, y, img, opts));
}

/** Push a melee slash arc (additive) by color name. */
export function slashFx(list, x, y, name = 'white', opts = {}) {
  const img = SLASH_IMAGES[name];
  if (img) list.push(new ImpactFx(x, y, img, { life: 0.18, startScale: 0.7, grow: 0.5, spin: 0, ...opts }));
}

/** Push a dust/smoke puff (normal blend, drifts up, no spin). */
export function dustFx(list, x, y, name = 'run', opts = {}) {
  const img = DUST_IMAGES[name];
  if (img) list.push(new ImpactFx(x, y, img, { additive: false, life: 0.4, startScale: 0.6, grow: 0.5, spin: 0, rot: 0, rise: 30, ...opts }));
}
