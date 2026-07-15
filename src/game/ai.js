/**
 * CPU brain. Reads the world and drives a Controller for one fighter.
 * Behaviour scales with the difficulty config (see constants.DIFFICULTY).
 */
export class AIController {
  constructor(fighter, controller, difficulty) {
    this.fighter = fighter;
    this.control = controller;
    this.diff = difficulty;
    this.decisionTimer = Math.random() * difficulty.reaction;
    this.defendTimer = 0;
    this.repositionTimer = 0;
    this.preferredZOffset = (Math.random() - 0.5) * 40;
    this.airSpecialTimer = 0; // >0 while waiting to fire an air special
    // Campaign enemies carry a behaviour tag (brawler / zoner / boss).
    this.behavior = fighter.char.behavior || 'melee';
    this._enraged = false;
  }

  _incomingProjectile(engine) {
    const me = this.fighter;
    if (!engine?.projectiles) return null;
    for (const p of engine.projectiles) {
      if (p.team === me.team) continue;
      const dx = p.x - me.x;
      if (Math.abs(p.z - me.z) > 46) continue;
      // heading toward me and close
      if (Math.sign(p.vx) === Math.sign(-dx) && Math.abs(dx) < 190) return p;
    }
    return null;
  }

  _nearestItem(engine) {
    const me = this.fighter;
    if (me.heldItem || !engine?.items) return null;
    let best = null;
    let bestD = 260;
    for (const it of engine.items) {
      if (it.dead) continue;
      if (it.def.playerOnly) continue; // power-ups are for the human only
      const d = Math.hypot(it.x - me.x, (it.z - me.z) * 1.2);
      if (d < bestD) {
        bestD = d;
        best = it;
      }
    }
    return best;
  }

  _nearestEnemy(fighters) {
    let best = null;
    let bestDist = Infinity;
    for (const f of fighters) {
      if (!f.alive || f.team === this.fighter.team || f.id === this.fighter.id) continue;
      const d = Math.hypot(f.x - this.fighter.x, (f.z - this.fighter.z) * 1.2);
      if (d < bestDist) {
        bestDist = d;
        best = f;
      }
    }
    return { enemy: best, dist: bestDist };
  }

  update(dt, fighters, engine) {
    const me = this.fighter;
    const c = this.control;
    if (!me.alive) {
      c.reset();
      return;
    }

    const { enemy } = this._nearestEnemy(fighters);
    if (!enemy) {
      c.state.dirX = 0;
      c.state.dirZ = 0;
      return;
    }

    const dx = enemy.x - me.x;
    const dz = enemy.z - me.z + this.preferredZOffset;
    const absDx = Math.abs(dx);
    const reach = me.char.reach;
    const inRange = absDx < reach + me.width * 0.4 && Math.abs(enemy.z - me.z) < 40;

    this.defendTimer = Math.max(0, this.defendTimer - dt);
    this.decisionTimer -= dt;
    this.airSpecialTimer = Math.max(0, this.airSpecialTimer - dt);

    // Face the target
    me.facing = dx >= 0 ? 1 : -1;

    const specials = me.char.specials || [me.char.special];

    // ---- boss enrage at half health: faster, more shockwaves ----
    if (me.char.isBoss && !this._enraged && me.hp / me.maxHp < 0.5) {
      this._enraged = true;
      this.diff = {
        ...this.diff,
        aggression: Math.min(1, this.diff.aggression + 0.12),
        specialChance: Math.min(0.9, this.diff.specialChance + 0.35),
        reaction: this.diff.reaction * 0.7,
      };
      engine?.cb?.onAnnounce?.('ENRAGED!', 'ko');
    }

    // ---- zoner (Mage): keep distance and cast bolts ----
    if (this.behavior === 'zoner') {
      this.defendTimer = Math.max(0, this.defendTimer - dt);
      // shield when a melee attacker is right on top of it
      if (absDx < 90 && (enemy.state === 'attack' || enemy.state === 'special')) {
        c.state.defend = true;
        c.state.dirX = 0;
        c.state.dirZ = 0;
        return;
      }
      c.state.defend = false;
      c.state.dirZ = Math.abs(enemy.z - me.z) > 16 ? (enemy.z > me.z ? 1 : -1) : 0;
      const want = 190;
      if (absDx < want - 40) c.state.dirX = dx > 0 ? -1 : 1; // back away
      else if (absDx > want + 70) c.state.dirX = dx > 0 ? 1 : -1; // close in
      else c.state.dirX = 0;
      const spec = specials[0];
      const aligned = Math.abs(enemy.z - me.z) < 48;
      if (aligned && spec.type === 'projectile' && me.mp >= spec.mpCost && this.decisionTimer <= 0) {
        this.decisionTimer = this.diff.reaction + Math.random() * this.diff.reaction;
        c.state.dirX = 0;
        c.press('special');
      }
      return;
    }

    // ---- dodge incoming projectiles by hopping ----
    if (me.grounded) {
      const proj = this._incomingProjectile(engine);
      if (proj && Math.random() < 0.4 + this.diff.aggression * 0.4) {
        c.press('jump');
      }
    }

    // ---- fire a queued air special once airborne ----
    if (this.airSpecialTimer > 0 && !me.grounded && me.vy > -50) {
      const air = me.char.specials?.[2];
      if (air && me.mp >= air.mpCost) c.press('special');
      this.airSpecialTimer = 0;
    }

    // ---- grab a nearby weapon when it's safe ----
    if (!me.heldItem && !inRange && absDx > 120) {
      const item = this._nearestItem(engine);
      if (item) {
        c.state.dirX = item.x > me.x ? 1 : -1;
        c.state.dirZ = Math.abs(item.z - me.z) > 16 ? (item.z > me.z ? 1 : -1) : 0;
        return;
      }
    }

    // ---- defensive reaction ----
    const enemyThreat =
      (enemy.state === 'attack' || enemy.state === 'special') && absDx < reach + 40;
    if (enemyThreat && this.defendTimer <= 0 && Math.random() < this.diff.blockChance * dt * 10) {
      this.defendTimer = 0.35;
    }
    if (this.defendTimer > 0) {
      c.state.defend = true;
      c.state.dirX = 0;
      c.state.dirZ = 0;
      return;
    }
    c.state.defend = false;

    // ---- movement ----
    // depth alignment
    if (Math.abs(dz) > 16) {
      c.state.dirZ = dz > 0 ? 1 : -1;
    } else {
      c.state.dirZ = 0;
    }

    if (!inRange) {
      // approach, moderated by aggression (sometimes hesitate)
      if (Math.random() < 0.15 + this.diff.aggression * 0.85) {
        c.state.dirX = dx > 0 ? 1 : -1;
      } else {
        c.state.dirX = 0;
      }
      // jump toward airborne targets or to close gaps
      if (enemy.y > 55 && absDx < reach + 60 && me.grounded && Math.random() < this.diff.aggression * dt * 4) {
        c.press('jump');
      }
    } else {
      c.state.dirX = 0;
      // occasionally back off (spacing) for higher skill
      if (Math.random() < (1 - this.diff.aggression) * dt * 2) {
        c.state.dirX = -me.facing;
      }
    }

    // ---- offense (gated by reaction) ----
    if (inRange && this.decisionTimer <= 0) {
      this.decisionTimer = this.diff.reaction + Math.random() * this.diff.reaction;
      if (Math.random() < this.diff.specialChance) {
        // Choose a special variant the AI can afford.
        const roll = Math.random();
        const air = specials[2];
        const dash = specials[1];
        const neutral = specials[0];
        if (roll < 0.3 && air && me.mp >= air.mpCost) {
          c.press('jump'); // then fire once airborne
          this.airSpecialTimer = 0.4;
        } else if (roll < 0.6 && dash && me.mp >= dash.mpCost) {
          me._dashWindow = 0.35; // buffer the dash input
          c.press('special');
        } else if (me.mp >= neutral.mpCost) {
          c.press('special');
        } else {
          c.press('attack');
        }
      } else {
        c.press('attack');
      }
    }

    // ranged pressure: zoners fire the neutral projectile from afar
    if (!inRange && specials[0].type === 'projectile' && this.decisionTimer <= 0) {
      const aligned = Math.abs(enemy.z - me.z) < 44;
      if (aligned && me.mp >= specials[0].mpCost && Math.random() < this.diff.specialChance * 0.7) {
        this.decisionTimer = this.diff.reaction * 1.5;
        c.press('special');
      }
    }
  }
}
