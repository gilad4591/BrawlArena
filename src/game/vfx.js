/**
 * Painted VFX sprites (glowing energy orbs for projectiles + impact bursts for
 * hits/AoE). Extracted from black-background sheets so they render great with
 * additive blending. Any missing image falls back to the procedural drawing.
 */
export const ORB_IMAGES = {};
export const IMPACT_IMAGES = {};
const VFX_VERSION = '1';

const ORB_NAMES = ['fire', 'ice', 'lightning', 'toxic', 'void', 'holy', 'water', 'blood'];
const IMPACT_NAMES = ['starburst', 'slash', 'streak', 'shockwave', 'fireblast', 'spiral'];

export async function loadVfxImages() {
  const base = import.meta.env.BASE_URL || '/';
  const load = (map, prefix, name) =>
    new Promise((res) => {
      const img = new Image();
      img.onload = () => { map[name] = img; res(); };
      img.onerror = () => res();
      img.src = `${base}ui/vfx/${prefix}${name}.png?v=${VFX_VERSION}`;
    });
  await Promise.all([
    ...ORB_NAMES.map((n) => load(ORB_IMAGES, 'orb_', n)),
    ...IMPACT_NAMES.map((n) => load(IMPACT_IMAGES, 'impact_', n)),
  ]);
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
    this.dead = false;
  }

  update(dt) {
    this.life -= dt;
    this.rot += this.spin * dt;
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
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = Math.max(0, a);
    ctx.translate(this.x, this.y);
    if (this.rot) ctx.rotate(this.rot);
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
