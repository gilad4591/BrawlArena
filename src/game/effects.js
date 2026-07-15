export class Particle {
  constructor(x, y, opts = {}) {
    this.x = x;
    this.y = y;
    this.vx = opts.vx ?? (Math.random() - 0.5) * 300;
    this.vy = opts.vy ?? -Math.random() * 240;
    this.gravity = opts.gravity ?? 900;
    this.life = opts.life ?? 0.5;
    this.maxLife = this.life;
    this.size = opts.size ?? 4;
    this.color = opts.color ?? '#fff';
    this.dead = false;
  }

  update(dt) {
    this.life -= dt;
    if (this.life <= 0) {
      this.dead = true;
      return;
    }
    this.vy += this.gravity * dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
  }

  render(ctx) {
    const a = Math.max(0, this.life / this.maxLife);
    ctx.globalAlpha = a;
    ctx.fillStyle = this.color;
    const s = this.size * (0.4 + a * 0.6);
    ctx.fillRect(this.x - s / 2, this.y - s / 2, s, s);
    ctx.globalAlpha = 1;
  }
}

export class FloatingText {
  constructor(x, y, text, color = '#fff', size = 20, opts = {}) {
    this.x = x;
    this.y = y;
    this.text = text;
    this.color = color;
    this.size = size;
    this.life = opts.life ?? 0.8;
    this.maxLife = this.life;
    this.rise = opts.rise ?? 60;
    this.pop = opts.pop ?? false; // scale-bounce for combo pops
    this.dead = false;
  }

  update(dt) {
    this.life -= dt;
    this.y -= this.rise * dt;
    if (this.life <= 0) this.dead = true;
  }

  render(ctx) {
    const a = Math.max(0, this.life / this.maxLife);
    const t = 1 - a; // 0 -> 1 over lifetime
    let scale = 1;
    if (this.pop) {
      // quick overshoot then settle
      scale = t < 0.2 ? 0.6 + (t / 0.2) * 0.7 : 1.3 - Math.min(1, (t - 0.2) / 0.3) * 0.3;
    }
    ctx.save();
    ctx.globalAlpha = a;
    ctx.translate(this.x, this.y);
    ctx.scale(scale, scale);
    ctx.fillStyle = this.color;
    ctx.font = `900 ${this.size}px "Arial Black", system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(0,0,0,0.65)';
    ctx.lineWidth = this.pop ? 6 : 4;
    ctx.strokeText(this.text, 0, 0);
    ctx.fillText(this.text, 0, 0);
    ctx.restore();
    ctx.globalAlpha = 1;
  }
}

/** Bright, fast impact spark used when a hit connects. */
export function spark(list, x, y, color = '#fff') {
  list.push(new Particle(x, y, { color: '#ffffff', size: 10, vx: 0, vy: 0, gravity: 0, life: 0.12 }));
  for (let i = 0; i < 8; i += 1) {
    const ang = (i / 8) * Math.PI * 2;
    list.push(
      new Particle(x, y, {
        color,
        size: 3 + Math.random() * 3,
        vx: Math.cos(ang) * (260 + Math.random() * 140),
        vy: Math.sin(ang) * (260 + Math.random() * 140),
        gravity: 200,
        life: 0.22 + Math.random() * 0.12,
      }),
    );
  }
}

/** Low, spreading dust puff for dashes, jumps and hard landings. */
export function dust(list, x, y, amount = 8) {
  for (let i = 0; i < amount; i += 1) {
    list.push(
      new Particle(x, y, {
        color: i % 2 ? '#d9cbb0' : '#b7a888',
        size: 4 + Math.random() * 5,
        vx: (Math.random() - 0.5) * 220,
        vy: -Math.random() * 90 - 10,
        gravity: 260,
        life: 0.3 + Math.random() * 0.3,
      }),
    );
  }
}

export function burst(list, x, y, color, count = 10, opts = {}) {
  for (let i = 0; i < count; i += 1) {
    list.push(
      new Particle(x, y, {
        color,
        size: opts.size ?? 4 + Math.random() * 4,
        vx: (Math.random() - 0.5) * (opts.spread ?? 360),
        vy: -Math.random() * (opts.up ?? 300) - 40,
        life: 0.3 + Math.random() * (opts.life ?? 0.4),
        gravity: opts.gravity ?? 900,
      }),
    );
  }
}
