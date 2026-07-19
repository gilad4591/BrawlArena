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
  ]);
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
