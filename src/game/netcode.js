/**
 * Netcode helpers for Brawl Arena online play.
 *
 * Model: HOST-AUTHORITATIVE. The room host runs the full simulation and
 * broadcasts compact snapshots (~20 Hz). Guests do not simulate — they render
 * the latest snapshot (smoothed toward it) and stream their own input to the
 * host, which drives their fighter. This keeps every client perfectly in sync
 * regardless of device, at the cost of a little input latency for guests.
 *
 * All payloads travel inside MultiplayerService.sendState(state), delivered to
 * peers via the 'state' event.
 */

/** Build a compact snapshot of the whole match (host side). */
export function buildSnapshot(engine) {
  return {
    k: 'snap',
    t: engine.elapsed,
    fighters: engine.fighters.map((f, i) => ({
      i,
      x: Math.round(f.x * 10) / 10,
      y: Math.round(f.y * 10) / 10,
      z: Math.round(f.z * 10) / 10,
      fa: f.facing,
      s: f.state,
      st: Math.round(f.stateTime * 100) / 100,
      hp: Math.round(f.hp),
      mp: Math.round(f.mp),
      al: f.alive ? 1 : 0,
      dt: Math.round(f.deathTime * 100) / 100,
      pt: Math.round(f.powerTimer * 10) / 10,
      sh: Math.round(f.shieldTimer * 10) / 10,
      cb: f._combo || 0,
      it: f.heldItem ? { id: f.heldItem.def.id, u: f.heldItem.uses } : null,
    })),
    proj: engine.projectiles.map((p) => ({
      x: Math.round(p.x),
      y: Math.round(p.y),
      z: Math.round(p.z),
      c: p.color || p.spec?.color || '#fff',
      r: p.radius || 10,
    })),
    items: engine.items.map((it) => ({
      x: Math.round(it.x),
      y: Math.round(it.y),
      z: Math.round(it.z),
      g: it.def.glyph || '?',
      c: it.def.color || '#fff',
    })),
    over: engine.roundOver ? (engine._winnerTeam ?? -1) : null,
  };
}

/** Read the local controller into a wire input message (guest side). */
export function readInput(controller, netId) {
  const presses = [];
  for (const action of ['jump', 'attack', 'special', 'throw']) {
    if (controller.consume(action)) presses.push(action);
  }
  return {
    k: 'input',
    id: netId,
    dx: controller.state.dirX,
    dz: controller.state.dirZ,
    df: controller.state.defend ? 1 : 0,
    p: presses,
  };
}

/** Apply a received input message to a remote fighter's controller (host). */
export function applyInput(controller, msg) {
  controller.state.dirX = msg.dx || 0;
  controller.state.dirZ = msg.dz || 0;
  controller.state.defend = !!msg.df;
  if (msg.p) for (const action of msg.p) controller.press(action);
}

/** Lightweight guest-side render proxies (drawn by the engine's depth sort). */
export class ProjProxy {
  constructor(d) {
    this.z = d.z;
    this.update(d);
  }

  update(d) {
    this.x = d.x;
    this.y = d.y;
    this.z = d.z;
    this.color = d.c;
    this.radius = d.r;
  }

  render(ctx, view) {
    const sx = view.screenX(this.x);
    const sy = view.screenY(this.x, this.z, this.y);
    const r = this.radius * view.scale(this.z);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, r * 1.6);
    g.addColorStop(0, this.color);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(sx, sy, r * 1.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

export class ItemProxy {
  constructor(d) {
    this.z = d.z - 0.1;
    this.update(d);
  }

  update(d) {
    this.x = d.x;
    this.y = d.y;
    this.z = d.z;
    this.glyph = d.g;
    this.color = d.c;
  }

  render(ctx, view) {
    const sx = view.screenX(this.x);
    const sy = view.screenY(this.x, this.z, this.y);
    const s = 20 * view.scale(this.z);
    ctx.save();
    ctx.font = `${Math.round(s)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.glyph, sx, sy - s * 0.5);
    ctx.restore();
  }
}
