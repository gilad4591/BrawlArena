import { ARENA_DEPTH } from './constants.js';
import { ORB_IMAGES } from './vfx.js';
import { SP_THEME } from './cosmetics.js';

export class Projectile {
  constructor(owner, spec) {
    this.owner = owner;
    this.team = owner.team;
    this.spec = spec;
    this.x = owner.x + owner.facing * 40;
    this.z = owner.z;
    this.y = owner.height * 0.55;
    this.vx = spec.speed * owner.facing;
    this.vz = 0;
    this.radius = spec.radius;
    this.damage = spec.damage;
    this.color = spec.color;
    // Cosmetic SP theme (player only): recolour + re-orb the projectile.
    this.orbName = spec.orb;
    const th = owner.spTheme && SP_THEME[owner.spTheme];
    if (th) {
      this.color = th.color;
      this.orbName = th.orb;
    }
    this.knockback = spec.knockback ?? 1;
    this.freeze = spec.freeze ?? 0;
    this.homing = spec.homing ?? 0;
    this.life = 1.6;
    this.dead = false;
    this.hitIds = new Set();
    this.trail = [];
  }

  update(dt, fighters) {
    this.life -= dt;
    if (this.life <= 0) {
      this.dead = true;
      return;
    }

    if (this.homing) {
      let nearest = null;
      let best = Infinity;
      for (const f of fighters) {
        if (f.team === this.team || !f.alive) continue;
        const d = Math.abs(f.x - this.x) + Math.abs(f.z - this.z);
        if (d < best) {
          best = d;
          nearest = f;
        }
      }
      if (nearest) {
        this.vz += (nearest.z - this.z) * this.homing * dt * 6;
        this.vz = Math.max(-140, Math.min(140, this.vz));
      }
    }

    this.x += this.vx * dt;
    this.z += this.vz * dt;
    this.z = Math.max(0, Math.min(ARENA_DEPTH, this.z));

    this.trail.unshift({ x: this.x, z: this.z, y: this.y });
    if (this.trail.length > 6) this.trail.pop();
  }

  render(ctx, view) {
    const scale = view.scale(this.z);
    // additive blend makes energy orbs + trails glow against the arena
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    // trail
    for (let i = this.trail.length - 1; i >= 0; i -= 1) {
      const t = this.trail[i];
      const sx = view.screenX(t.x);
      const sy = view.screenY(t.x, t.z, t.y);
      const a = (1 - i / this.trail.length) * 0.4;
      ctx.globalAlpha = a;
      ctx.fillStyle = this.color;
      ctx.beginPath();
      ctx.arc(sx, sy, this.radius * scale * (0.6 + a), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    const sx = view.screenX(this.x);
    const sy = view.screenY(this.x, this.z, this.y);
    const r = this.radius * scale;

    // Painted orb sprite (glowing energy ball) if this spec has one.
    const img = this.orbName && ORB_IMAGES[this.orbName];
    if (img && img.complete && img.naturalWidth) {
      const h = r * 3.6;
      const w = h * (img.naturalWidth / img.naturalHeight);
      ctx.translate(sx, sy);
      // sheet orbs point left; flip so the tail trails behind travel direction
      if (this.vx > 0) ctx.scale(-1, 1);
      ctx.drawImage(img, -w / 2, -h / 2, w, h);
      ctx.restore();
      return;
    }

    const grad = ctx.createRadialGradient(sx, sy, 1, sx, sy, r * 1.6);
    grad.addColorStop(0, '#fff');
    grad.addColorStop(0.4, this.color);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(sx, sy, r * 1.6, 0, Math.PI * 2);
    ctx.fill();
    // bright solid core
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(sx, sy, r * 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}
