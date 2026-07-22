import {
  GRAVITY,
  JUMP_VELOCITY,
  FRICTION,
  ARENA_DEPTH,
  HITSTUN,
  KNOCKBACK_X,
  KNOCKBACK_UP,
  BLOCK_DAMAGE_MULT,
  MP_REGEN,
  TEAM_COLORS,
} from './constants.js';
import { getSpriteSet, frameForState } from './sprites.js';
import { STATUS_IMAGES, drawVfx, drawAura } from './vfx.js';

// Melee combo timing (seconds)
const ATTACK = { windup: 0.07, active: 0.11, recover: 0.16 };
const SPECIAL_TIME = 0.42;

// A defeated fighter lies on the floor for DEATH_LINGER seconds, then fades out
// over DEATH_FADE and stops being drawn.
const DEATH_LINGER = 2.6;
const DEATH_FADE = 0.7;
const DEATH_TOTAL = DEATH_LINGER + DEATH_FADE;

function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, ((n >> 16) & 255) + amt));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 255) + amt));
  const b = Math.max(0, Math.min(255, (n & 255) + amt));
  return `rgb(${r},${g},${b})`;
}

function limb(ctx, a, ctrl, b, width, color) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.quadraticCurveTo(ctrl.x, ctrl.y, b.x, b.y);
  ctx.stroke();
}

export class Fighter {
  constructor({ id, character, team, isHuman, control, x, z, facing, difficultyMods, teamsMode }) {
    this.id = id;
    this.char = character;
    this.team = team;
    this.isHuman = isHuman;
    this.teamsMode = !!teamsMode;
    this.control = control;
    this.mods = difficultyMods || { moveSpeedMult: 1, damageTaken: 1, damageDealt: 1 };

    // Body-size multiplier (campaign enemies scale up/down from the roster base).
    this.sizeMul = character.sizeMul || 1;
    // Bumped ~16% over the original 44/98 base so fighters read bigger on screen
    // (the sprite and its hitbox scale together, preserving relative sizes).
    this.width = (50 + (character.weight - 1) * 11) * this.sizeMul;
    this.height = (114 + (character.weight - 1) * 16) * this.sizeMul;

    this.x = x;
    this.z = z;
    this.y = 0;
    this.vx = 0;
    this.vy = 0;
    this.facing = facing ?? 1;

    this.maxHp = character.maxHp;
    this.hp = character.maxHp;
    this.maxMp = character.maxMp;
    this.mp = character.maxMp;

    this.state = 'idle';
    this.stateTime = 0;
    this.attackHits = new Set();
    this.invuln = 0;
    this.alive = true;
    this.walkPhase = 0;
    this.flashTime = 0;
    this.comboFlash = 0;
    this.powerTimer = 0; // +Power buff seconds remaining
    this.powerMult = 1.4;
    this.shieldTimer = 0; // invincibility seconds remaining
    this.frozenTimer = 0; // ice-hit visual (encasement)
    this.pendingSpecial = null; // consumed by engine
    this.animClock = 0;
    this.deathTime = 0; // time since KO
    this.koDir = 1; // which way the body tips over
    // Combo input tracking (for directional specials).
    this._prevMoveDir = 0;
    this._lastTapDir = 0;
    this._lastTapT = -1;
    this._dashWindow = 0; // >0 means a fresh double-tap-forward is buffered
    // Attack input buffering + melee combo chain.
    this._atkBuffer = 0; // seconds a pressed attack stays "live" to fire
    this._spBuffer = 0; // same idea for special...
    this._jumpBuffer = 0; // ...and jump
    this._comboChain = 0; // 1..3 consecutive melee hits
    this._comboChainT = -1; // animClock of the last chained attack
    this._isFinisher = false; // current swing is the 3rd (knockback) hit
    // Held prop / weapon.
    this.heldItem = null; // { def, uses }
    this._throwPending = false;
    this._swingConsumed = false;
    // Locked "variant" fighters borrow a base fighter's sprite sheet and are
    // recoloured with a hue shift (character.tint, in degrees).
    this.spriteSet = getSpriteSet(character.spriteBase || character.id);
    this.tint = character.tint || 0;
    this.skinAura = null; // elemental aura theme from the player's equipped skin
    this.spTheme = null; // special-attack fx theme from the player's equipped skin
  }

  /** True once the corpse has fully faded and should no longer be drawn. */
  get gone() {
    return !this.alive && this.deathTime > DEATH_TOTAL;
  }

  get grounded() {
    return this.y <= 0.001;
  }

  get busy() {
    return this.state === 'attack' || this.state === 'special' || this.state === 'hit' || this.state === 'ko';
  }

  get teamColor() {
    // Only real "Teams" mode uses shared team colours. In 1v1 / free-for-all
    // there are no teams, so each fighter shows their own identity colour.
    if (this.teamsMode) return TEAM_COLORS[this.team % TEAM_COLORS.length];
    return this.char.accent || this.char.color;
  }

  /** Low-HP "last stand": boosts damage (engine-side) and move speed. */
  get rage() {
    return this.alive && this.hp > 0 && this.hp / this.maxHp < 0.28;
  }

  update(dt, engine) {
    this.animClock += dt;
    if (!this.alive) {
      this.stateTime += dt;
      this.deathTime += dt;
      this._physics(dt);
      return;
    }

    this.flashTime = Math.max(0, this.flashTime - dt);
    this.comboFlash = Math.max(0, this.comboFlash - dt);
    this.invuln = Math.max(0, this.invuln - dt);
    this.powerTimer = Math.max(0, (this.powerTimer || 0) - dt);
    this.shieldTimer = Math.max(0, (this.shieldTimer || 0) - dt);
    this.frozenTimer = Math.max(0, (this.frozenTimer || 0) - dt);
    this.mp = Math.min(this.maxMp, this.mp + MP_REGEN * dt);
    this.stateTime += dt;

    const c = this.control;
    const canAct = !this.busy;

    // ---- double-tap forward detection (for the dash special) ----
    this._dashWindow = Math.max(0, this._dashWindow - dt);
    const dirX = c.state.dirX;
    if (dirX !== 0 && dirX !== this._prevMoveDir) {
      if (dirX === this._lastTapDir && this.animClock - this._lastTapT < 0.32) {
        this._dashWindow = 0.35;
      }
      this._lastTapDir = dirX;
      this._lastTapT = this.animClock;
    }
    this._prevMoveDir = dirX;

    // ---- action inputs (all edge-triggered AND buffered) ----
    // Every action press is latched into a short time window instead of being
    // acted on only if the fighter happens to be free THIS frame. That's what
    // stops presses from feeling "swallowed": tap attack/jump/special a hair
    // early (mid-swing, just before landing, during hitstun) and it still fires
    // the instant the fighter can act. Stale presses expire so nothing fires
    // seconds late.
    if (c.consume('attack')) this._atkBuffer = 0.18;
    if (c.consume('special')) this._spBuffer = 0.22;
    if (c.consume('jump')) this._jumpBuffer = 0.16;
    this._atkBuffer = Math.max(0, this._atkBuffer - dt);
    this._spBuffer = Math.max(0, this._spBuffer - dt);
    this._jumpBuffer = Math.max(0, this._jumpBuffer - dt);

    // Special: fire as soon as we're free; keep buffering if it's momentarily
    // unaffordable so a press right before the meter fills still lands.
    if (this._spBuffer > 0 && canAct && this._trySpecial(engine)) {
      this._spBuffer = 0;
    }
    // Attack buffer also cancels the recover tail of the current swing so
    // chains flow (jab-jab-finisher).
    const inRecover = this.state === 'attack' && this.stateTime >= ATTACK.windup + ATTACK.active;
    if (this._atkBuffer > 0 && (!this.busy || inRecover)) {
      this._startAttack();
      this._atkBuffer = 0;
    }
    if (c.consume('throw') && this.heldItem) this._throwPending = true;
    // Jump buffer lets a press just before touchdown pop the instant we land.
    if (this._jumpBuffer > 0 && canAct && this.grounded) {
      this.vy = JUMP_VELOCITY;
      this.state = 'jump';
      this._jumpBuffer = 0;
      engine.audio?.jump();
    }

    // ---- movement ----
    // Frame-rate-independent friction: decays the same amount per real second
    // regardless of FPS, so a lag spike can't make the fighter keep gliding in
    // the old direction after you let go / switch directions.
    const fr = Math.pow(FRICTION, dt * 60);
    const defending = c.state.defend && this.grounded && !this.busy;
    if (defending) {
      this.state = 'defend';
      this.vx *= fr;
    } else if (!this.busy) {
      const speed = this.char.speed * this.mods.moveSpeedMult * (this.rage ? 1.14 : 1);
      let moving = false;
      if (c.state.dirX) {
        this.vx = c.state.dirX * speed;
        this.facing = c.state.dirX > 0 ? 1 : -1;
        moving = true;
      } else {
        this.vx *= fr;
      }
      if (c.state.dirZ && this.grounded) {
        this.z += c.state.dirZ * speed * 0.62 * dt;
        moving = true;
      }
      if (this.grounded) {
        this.state = moving ? 'walk' : 'idle';
        if (moving) this.walkPhase += dt * 10;
      }
    }

    // ---- state timers ----
    this._advanceState(engine);
    this._physics(dt);
  }

  _advanceState(engine) {
    if (this.state === 'attack') {
      const total = ATTACK.windup + ATTACK.active + ATTACK.recover;
      if (this.stateTime >= total) {
        this.state = this.grounded ? 'idle' : 'jump';
      }
    } else if (this.state === 'special') {
      if (this.stateTime >= SPECIAL_TIME) {
        this.state = this.grounded ? 'idle' : 'jump';
      }
    } else if (this.state === 'hit') {
      if (this.stateTime >= this.hitDuration) {
        this.state = this.grounded ? 'idle' : 'jump';
      }
    }
  }

  _physics(dt) {
    // gravity / vertical
    if (!this.grounded || this.vy > 0) {
      this.vy -= GRAVITY * dt;
      this.y += this.vy * dt;
      if (this.y <= 0) {
        this.y = 0;
        this.vy = 0;
        if (this.state === 'jump') this.state = 'idle';
      }
    }
    // horizontal
    this.x += this.vx * dt;
    // Kill the low-speed tail quickly so stopping/turning feels crisp.
    if (Math.abs(this.vx) < 12) this.vx = 0;

    // clamp to arena
    const halfW = this.width / 2;
    this.x = Math.max(halfW, Math.min(this._arenaWidth - halfW, this.x));
    this.z = Math.max(0, Math.min(ARENA_DEPTH, this.z));
  }

  _startAttack() {
    // Chain consecutive swings: 1 -> 2 -> 3 (finisher), resetting if too slow.
    if (this._comboChainT >= 0 && this.animClock - this._comboChainT < 0.6) {
      this._comboChain = (this._comboChain % 3) + 1;
    } else {
      this._comboChain = 1;
    }
    this._comboChainT = this.animClock;
    this._isFinisher = this._comboChain === 3;
    this.state = 'attack';
    this.stateTime = 0;
    this.attackHits.clear();
    this._swingConsumed = false;
    // The finisher steps in a touch further for reach; jabs barely slow you.
    this.vx *= this._isFinisher ? 0.5 : 0.3;
  }

  _trySpecial(engine) {
    const specials = this.char.specials || [this.char.special];
    // Slot selection: airborne -> air move, fresh double-tap forward -> dash
    // move, otherwise the neutral signature move.
    let idx = 0;
    if (!this.grounded) idx = 2;
    else if (this._dashWindow > 0) idx = 1;
    let s = specials[idx] || specials[0];
    // Fall back to the neutral move if the chosen one is unaffordable.
    if (this.mp < s.mpCost) {
      s = specials[0];
      idx = 0;
    }
    if (this.mp < s.mpCost) return false;
    this._dashWindow = 0;
    this.mp -= s.mpCost;
    this.state = 'special';
    this.stateTime = 0;
    this.attackHits.clear();
    this.pendingSpecial = s;
    engine.audio?.special();
    return true;
  }

  /** Melee hitbox during active frames, else null. */
  getMeleeHitbox() {
    if (this.state !== 'attack') return null;
    if (this.stateTime < ATTACK.windup) return null;
    if (this.stateTime > ATTACK.windup + ATTACK.active) return null;
    const weaponBonus = this.heldItem ? this.heldItem.def.bonus || 0 : 0;
    const weaponReach = this.heldItem ? 12 : 0;
    // The 3rd combo hit is a knockback finisher: extra damage + launch.
    const fin = this._isFinisher;
    return {
      reach: this.char.reach + weaponReach + (fin ? 8 : 0),
      zTol: 34,
      damage: (this.char.attackPower * (fin ? 1.55 : 1)) * this.mods.damageDealt + weaponBonus,
      knockback: (this.heldItem ? 1.2 : 1) * (fin ? 2.1 : 1),
      finisher: fin,
      weapon: !!this.heldItem,
    };
  }

  containsHit(hb, defender) {
    if (!defender.alive || defender.team === this.team || defender.id === this.id) return false;
    const dx = (defender.x - this.x) * this.facing; // >0 means in front
    const maxReach = hb.reach + defender.width / 2;
    if (dx < -defender.width / 2 || dx > maxReach) return false;
    if (Math.abs(defender.z - this.z) > hb.zTol) return false;
    if (Math.abs(defender.y - this.y) > 90) return false;
    return true;
  }

  takeHit(damage, dir, opts = {}, engine) {
    if (!this.alive || this.invuln > 0) return false;
    const blocking = this.state === 'defend' && dir !== this.facing;
    let dmg = damage * this.mods.damageTaken;
    if (blocking) {
      dmg *= BLOCK_DAMAGE_MULT;
      engine?.audio?.block();
      engine?.onBlock?.(this);
    } else {
      engine?.audio?.hitLand();
    }

    this.hp = Math.max(0, this.hp - dmg);
    this.flashTime = 0.12;

    if (!blocking) {
      const kb = opts.knockback ?? 1;
      this.vx = dir * KNOCKBACK_X * kb / this.char.weight;
      if (opts.launch) {
        this.vy = opts.launch;
      } else if (kb > 1.2) {
        this.vy = KNOCKBACK_UP * 0.7;
      }
      this.state = 'hit';
      this.stateTime = 0;
      this.hitDuration = HITSTUN + (opts.freeze ?? 0);
      if (opts.freeze) this.frozenTimer = 0.45 + opts.freeze;
      this.facing = -dir;
    }

    if (this.hp <= 0) {
      this._ko(dir, engine);
    }
    return { blocked: blocking, damage: dmg };
  }

  _ko(dir, engine) {
    this.alive = false;
    this.state = 'ko';
    this.stateTime = 0;
    this.deathTime = 0;
    this.koDir = dir >= 0 ? 1 : -1;
    this.vx = dir * 220;
    this.vy = 360;
    engine?.audio?.ko();
    engine?._onFighterKO?.(this);
  }

  setArenaWidth(w) {
    this._arenaWidth = w;
  }

  // ---------------------------------------------------------------- rendering
  render(ctx, view) {
    if (this.gone) return; // corpse fully faded
    const scale = view.scale(this.z);
    const sx = view.screenX(this.x);
    const groundY = view.floorLine(this.z);
    const h = this.height * scale;
    const w = this.width * scale;
    const bodyBottom = groundY - this.y * scale;
    const crestColor = this.char.special.color || this.char.accent;

    // soft radial ground shadow that shrinks as the fighter leaves the floor
    const jf = 1 / (1 + this.y / 150);
    const shW = w * 0.66 * jf;
    const shH = Math.max(2, w * 0.22 * jf);
    ctx.save();
    ctx.translate(sx, groundY);
    ctx.scale(1, shH / shW);
    const shg = ctx.createRadialGradient(0, 0, 0, 0, 0, shW);
    shg.addColorStop(0, `rgba(0,0,0,${0.4 * jf})`);
    shg.addColorStop(0.65, `rgba(0,0,0,${0.22 * jf})`);
    shg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = shg;
    ctx.beginPath();
    ctx.arc(0, 0, shW, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // equipped-skin elemental aura (animated, additive) drawn BEHIND the body
    if (this.alive && this.skinAura) {
      drawAura(ctx, this.skinAura, sx, bodyBottom, h * 1.72, Date.now() / 1000, {
        alpha: 0.9,
      });
    }

    // power-up aura (player buff) — golden rays behind the fighter
    if (this.alive && this.powerTimer > 0) {
      const cy = bodyBottom - h * 0.5;
      const pulse = 0.55 + Math.sin(Date.now() / 80) * 0.18;
      if (STATUS_IMAGES.powerup) {
        drawVfx(ctx, STATUS_IMAGES.powerup, sx, cy, h * 1.7, { additive: true, alpha: pulse });
      } else {
        ctx.save();
        ctx.globalAlpha = pulse * 0.5;
        const g = ctx.createRadialGradient(sx, cy, 2, sx, cy, w * 2);
        g.addColorStop(0, 'rgba(255,171,61,0.9)');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(sx, cy, w * 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }

    // rage aura (low-HP last stand) — red flame swirl
    if (this.rage && this.alive) {
      const cy = bodyBottom - h * 0.5;
      const pulse = 0.6 + Math.sin(Date.now() / 90) * 0.2;
      if (STATUS_IMAGES.rage) {
        drawVfx(ctx, STATUS_IMAGES.rage, sx, cy, h * 1.85, { additive: true, alpha: pulse });
      } else {
        ctx.save();
        ctx.globalAlpha = pulse * 0.5;
        const g = ctx.createRadialGradient(sx, cy, 2, sx, cy, w * 2.2);
        g.addColorStop(0, 'rgba(255,80,40,0.9)');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(sx, cy, w * 2.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }

    // special charge aura
    if (this.state === 'special') {
      const glow = Math.sin(Math.min(1, this.stateTime / SPECIAL_TIME) * Math.PI);
      ctx.globalAlpha = 0.45 * glow;
      const cx = sx;
      const cy = bodyBottom - h * 0.5;
      const g = ctx.createRadialGradient(cx, cy, 2, cx, cy, w * 2.4);
      g.addColorStop(0, crestColor);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx, cy, w * 2.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // dash afterimages
    if (this._dash) {
      for (let i = 3; i >= 1; i -= 1) {
        ctx.globalAlpha = 0.14 * i;
        if (this.spriteSet) this._drawSprite(ctx, sx - this.facing * i * 15, bodyBottom, h);
        else this._renderRig(ctx, sx - this.facing * i * 15, bodyBottom, w, h, crestColor);
      }
      ctx.globalAlpha = 1;
    }

    if (this.spriteSet) this._drawSprite(ctx, sx, bodyBottom, h);
    else this._renderRig(ctx, sx, bodyBottom, w, h, crestColor);

    // --- status overlays drawn OVER the body ---
    const midY = bodyBottom - h * 0.5;
    // frozen encasement (ice hits)
    if (this.alive && this.frozenTimer > 0 && STATUS_IMAGES.frozen) {
      drawVfx(ctx, STATUS_IMAGES.frozen, sx, bodyBottom - h * 0.42, h * 1.25, { additive: true, alpha: 0.85 });
    }
    // invincibility shield bubble
    if (this.alive && this.shieldTimer > 0) {
      const flicker = this.shieldTimer < 1.2 ? (Math.floor(Date.now() / 100) % 2 ? 0.45 : 0.85) : 0.7;
      if (STATUS_IMAGES.shield) {
        drawVfx(ctx, STATUS_IMAGES.shield, sx, midY, h * 1.5, { additive: true, alpha: flicker });
      } else {
        ctx.save();
        ctx.globalAlpha = flicker;
        ctx.strokeStyle = '#5fe6ff';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.ellipse(sx, midY, w * 1.15, h * 0.62, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    }
    // dizzy stars while launched/staggered
    if (this.alive && this.state === 'hit' && !this.grounded && STATUS_IMAGES.dizzy) {
      drawVfx(ctx, STATUS_IMAGES.dizzy, sx, bodyBottom - h * 1.02, h * 0.55, { additive: true, alpha: 0.9 });
    }

    // held prop / weapon near the hand
    if (this.heldItem && this.alive) {
      const swing = this.state === 'attack' ? this.facing * w * 0.5 : 0;
      const hx = sx + this.facing * w * 0.55 + swing;
      const hy = bodyBottom - h * 0.55;
      ctx.save();
      ctx.font = `${Math.round(22 * scale)}px system-ui`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(this.heldItem.def.glyph, hx, hy);
      ctx.restore();
    }

    // block guard shield
    if (this.state === 'defend' && this.alive) {
      ctx.globalAlpha = 0.32 + Math.sin(Date.now() / 90) * 0.1;
      ctx.strokeStyle = '#a9dcff';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(sx + this.facing * w * 0.35, bodyBottom - h * 0.5, w * 0.9, -Math.PI * 0.55, Math.PI * 0.55);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // name tag under the feet (LF2-style)
    if (this.displayName && this.alive) {
      const fs = Math.max(9, Math.round(11 * scale));
      ctx.save();
      ctx.font = `800 ${fs}px system-ui, "Segoe UI", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(0,0,0,0.75)';
      ctx.fillStyle = this.teamColor;
      const ty = groundY + 4 * scale;
      ctx.strokeText(this.displayName, sx, ty);
      ctx.fillText(this.displayName, sx, ty);
      ctx.restore();
    }
  }

  _animState() {
    return this.alive ? this.state : 'ko';
  }

  _drawSprite(ctx, sx, bodyBottom, h) {
    const set = this.spriteSet;
    // Target height of the idle pose, then a shared pixel->world scale so every
    // frame keeps the same body size (no per-pose stretching / clipping).
    const idleTargetH = h * (set.def.scale || 1.5);
    const k = idleTargetH / set.refH;
    let flip = set.def.faceRight ? this.facing < 0 : this.facing > 0;
    const state = this._animState();
    // Some sheets have a pose drawn facing the opposite way from the rest (e.g.
    // Sage's walk frames face left while idle/cast face right). Invert the flip
    // just for those states so the character faces its movement direction.
    if (set.def.flipStates && set.def.flipStates.includes(state)) flip = !flip;
    const idx = frameForState(set, state, this.stateTime, this.animClock);
    // Single-pose sprites: add a small code-driven bob so idle/walk feel alive.
    let bob = 0;
    if (this.alive && this.grounded) {
      if (state === 'idle') bob = Math.sin(Date.now() / 420) * h * 0.02;
      else if (state === 'walk') bob = Math.abs(Math.sin(this.animClock * 9)) * -h * 0.05;
    }
    // A forward lunge on attack/special so the hit reads even when a character
    // falls back to its idle pose (bad punch frames get rejected upstream).
    let lunge = 0;
    if (this.alive && (state === 'attack' || state === 'special')) {
      const p = Math.sin(Math.min(1, this.stateTime / 0.22) * Math.PI);
      lunge = this.facing * p * h * 0.14;
    }
    // Anchor the frame by the idle BODY width instead of the (much wider)
    // effect frame, so casting/attacking doesn't shove the character backwards.
    // The effect overhang grows in the facing direction, so shift the opposite
    // way by half the overhang to keep the body planted.
    const f = set.frame(idx);
    const overhang = (f.w - set.refW) * k;
    const bodyShift = overhang > 0 ? -this.facing * overhang * 0.5 : 0;
    // KO: tip the body over and fade it out before it disappears.
    let rot = 0;
    let alpha = 1;
    if (!this.alive) {
      rot = Math.min(1, this.deathTime / 0.45) * 1.45 * this.koDir;
      if (this.deathTime > DEATH_LINGER) {
        alpha = Math.max(0, 1 - (this.deathTime - DEATH_LINGER) / DEATH_FADE);
      }
    }
    const flash = this.alive && this.flashTime > 0 && Math.floor(this.flashTime * 40) % 2 === 0;
    let filter = '';
    if (this.tint) filter += `hue-rotate(${this.tint}deg) saturate(1.25) `;
    if (flash) filter += 'brightness(2.2)';
    if (filter) ctx.filter = filter.trim();
    if (alpha < 1) ctx.globalAlpha = alpha;
    set.drawScaled(ctx, idx, sx + lunge + bodyShift, bodyBottom + bob, k, flip, rot);
    if (alpha < 1) ctx.globalAlpha = 1;
    if (filter) ctx.filter = 'none';
  }

  _renderRig(ctx, sx, bodyBottom, w, h, crestColor) {
    ctx.save();
    ctx.translate(sx, bodyBottom);
    ctx.scale(this.facing, 1);
    if (!this.alive) {
      ctx.translate(0, -h * 0.08);
      ctx.rotate(Math.min(1, this.stateTime * 2) * 1.45);
    }
    this._drawRig(ctx, this._computePose(h, w), w, h, crestColor);
    ctx.restore();
  }

  _computePose(h, w) {
    const t = this.stateTime;
    let hipY = -0.44 * h;
    let bob = 0;
    let leanX = 0;
    let headFwd = 0.02 * h;
    let backFoot = { x: -0.13 * h, y: 0 };
    let frontFoot = { x: 0.14 * h, y: 0 };
    let frontHand = { x: 0.16 * h, y: -0.62 * h };
    let backHand = { x: -0.12 * h, y: -0.62 * h };

    switch (this.state) {
      case 'idle': {
        bob = Math.sin(Date.now() / 480) * 0.012 * h;
        frontHand.y += bob;
        backHand.y += bob;
        break;
      }
      case 'walk': {
        const s = Math.sin(this.walkPhase);
        frontFoot = { x: 0.04 * h + s * 0.2 * h, y: -Math.max(0, s) * 0.06 * h };
        backFoot = { x: 0.04 * h - s * 0.2 * h, y: -Math.max(0, -s) * 0.06 * h };
        frontHand = { x: 0.1 * h - s * 0.14 * h, y: -0.6 * h };
        backHand = { x: -0.08 * h + s * 0.14 * h, y: -0.6 * h };
        bob = Math.abs(Math.cos(this.walkPhase)) * 0.02 * h;
        hipY -= bob;
        break;
      }
      case 'jump': {
        const rising = this.vy > 0;
        backFoot = { x: -0.1 * h, y: -0.16 * h };
        frontFoot = { x: 0.12 * h, y: -0.1 * h };
        frontHand = { x: 0.14 * h, y: rising ? -0.82 * h : -0.55 * h };
        backHand = { x: -0.1 * h, y: rising ? -0.84 * h : -0.55 * h };
        hipY = -0.5 * h;
        break;
      }
      case 'attack': {
        let strike;
        if (t < ATTACK.windup) strike = -0.5 * (t / ATTACK.windup);
        else if (t < ATTACK.windup + ATTACK.active) strike = -0.5 + 1.5 * ((t - ATTACK.windup) / ATTACK.active);
        else strike = Math.max(0, 1 - (t - ATTACK.windup - ATTACK.active) / ATTACK.recover);
        leanX = strike * 0.05 * h;
        frontHand = { x: (0.2 + strike * 0.62) * h, y: -0.62 * h - strike * 0.02 * h };
        backHand = { x: (-0.15 - strike * 0.05) * h, y: -0.6 * h };
        frontFoot = { x: (0.14 + Math.max(0, strike) * 0.12) * h, y: 0 };
        backFoot = { x: -0.16 * h, y: 0 };
        break;
      }
      case 'special': {
        const reach = Math.sin(Math.min(1, t / SPECIAL_TIME) * Math.PI);
        leanX = reach * 0.04 * h;
        if (this.char.special.type === 'uppercut') {
          frontHand = { x: 0.14 * h, y: -0.62 * h - reach * 0.5 * h };
          backHand = { x: -0.05 * h, y: -0.62 * h - reach * 0.2 * h };
        } else {
          frontHand = { x: (0.2 + reach * 0.5) * h, y: -0.58 * h };
          backHand = { x: (0.05 + reach * 0.3) * h, y: -0.6 * h };
        }
        frontFoot = { x: 0.16 * h, y: 0 };
        backFoot = { x: -0.18 * h, y: 0 };
        break;
      }
      case 'hit': {
        const r = Math.max(0, 1 - t / (this.hitDuration || HITSTUN));
        leanX = -0.14 * h * r;
        headFwd = -0.06 * h * r;
        frontHand = { x: 0.05 * h, y: -0.6 * h - r * 0.05 * h };
        backHand = { x: -0.2 * h, y: -0.58 * h };
        backFoot = { x: -0.2 * h, y: 0 };
        break;
      }
      case 'defend': {
        hipY = -0.4 * h;
        frontHand = { x: 0.18 * h, y: -0.58 * h };
        backHand = { x: 0.12 * h, y: -0.5 * h };
        backFoot = { x: -0.16 * h, y: 0 };
        frontFoot = { x: 0.1 * h, y: 0 };
        break;
      }
      default: {
        if (!this.alive) {
          frontHand = { x: 0.22 * h, y: -0.5 * h };
          backHand = { x: -0.22 * h, y: -0.5 * h };
          backFoot = { x: -0.2 * h, y: 0 };
          frontFoot = { x: 0.2 * h, y: 0 };
        }
        break;
      }
    }

    const pelvis = { x: leanX * 0.4, y: hipY + bob };
    const chest = { x: leanX, y: hipY - 0.26 * h + bob };
    const neck = { x: leanX * 1.1 + headFwd * 0.4, y: chest.y - 0.05 * h };
    const head = { x: leanX * 1.1 + headFwd, y: neck.y - 0.12 * h, r: 0.13 * h };
    return { pelvis, chest, neck, head, backFoot, frontFoot, frontHand, backHand };
  }

  _drawRig(ctx, pose, w, h, crestColor) {
    const st = this.char.style;
    const flash = this.flashTime > 0 && Math.floor(this.flashTime * 40) % 2 === 0;
    const cloth = flash ? '#ffffff' : this.char.color;
    const clothDark = flash ? '#ffffff' : shade(this.char.color, -45);
    const skin = flash ? '#ffffff' : st.skin;
    const skinDark = flash ? '#ffffff' : shade(st.skin, -30);
    const hair = flash ? '#ffffff' : st.hair;
    const { pelvis, chest, neck, head, backFoot, frontFoot, frontHand, backHand } = pose;
    const legW = w * 0.32;
    const armW = w * 0.2;

    const mid = (a, b, dx = 0, dy = 0) => ({ x: (a.x + b.x) / 2 + dx, y: (a.y + b.y) / 2 + dy });

    // cape for hooded fighters (behind everything)
    if (st.hairStyle === 'hood' || st.hairStyle === 'cloak') {
      const sway = Math.sin(Date.now() / 260) * 0.03 * h - this.vx * 0.0004 * h;
      ctx.fillStyle = st.hairStyle === 'cloak' ? shade(cloth, -55) : shade(cloth, -25);
      ctx.beginPath();
      ctx.moveTo(chest.x - w * 0.2, chest.y);
      ctx.quadraticCurveTo(-w * 0.5 + sway, chest.y + h * 0.3, -w * 0.35 + sway * 1.5, pelvis.y + h * 0.5);
      ctx.lineTo(0, pelvis.y + h * 0.4);
      ctx.quadraticCurveTo(chest.x - w * 0.1, chest.y + h * 0.2, chest.x + w * 0.1, chest.y);
      ctx.closePath();
      ctx.fill();
    }

    // back leg + back arm (darker for depth)
    limb(ctx, pelvis, mid(pelvis, backFoot, w * 0.06, 0), backFoot, legW, shade(this.char.color, -70));
    limb(ctx, chest, mid(chest, backHand, -w * 0.03, h * 0.02), backHand, armW, skinDark);

    // torso (clothing) with gradient + belt
    const pw = w * 0.42;
    const cw = w * 0.54;
    const grad = ctx.createLinearGradient(0, chest.y, 0, pelvis.y);
    grad.addColorStop(0, cloth);
    grad.addColorStop(1, clothDark);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(pelvis.x - pw / 2, pelvis.y);
    ctx.lineTo(chest.x - cw / 2, chest.y);
    ctx.quadraticCurveTo(chest.x, chest.y - h * 0.04, chest.x + cw / 2, chest.y);
    ctx.lineTo(pelvis.x + pw / 2, pelvis.y);
    ctx.quadraticCurveTo(pelvis.x, pelvis.y + h * 0.03, pelvis.x - pw / 2, pelvis.y);
    ctx.closePath();
    ctx.fill();
    // belt accent
    ctx.strokeStyle = this.char.accent;
    ctx.lineWidth = h * 0.04;
    ctx.beginPath();
    ctx.moveTo(pelvis.x - pw / 2, pelvis.y - h * 0.01);
    ctx.lineTo(pelvis.x + pw / 2, pelvis.y - h * 0.01);
    ctx.stroke();

    // front leg (pants) + front foot
    limb(ctx, pelvis, mid(pelvis, frontFoot, w * 0.06, 0), frontFoot, legW, clothDark);

    // head
    this._drawHead(ctx, head, skin, skinDark, hair, st, crestColor);

    // front arm (skin) over torso + hand
    limb(ctx, chest, mid(chest, frontHand, w * 0.03, h * 0.02), frontHand, armW, skin);
    ctx.fillStyle = skin;
    ctx.beginPath();
    ctx.arc(frontHand.x, frontHand.y, armW * 0.55, 0, Math.PI * 2);
    ctx.fill();

    // melee slash arc during active frames
    if (this.state === 'attack') {
      const at = this.stateTime;
      if (at > ATTACK.windup && at < ATTACK.windup + ATTACK.active) {
        ctx.strokeStyle = this.char.accent;
        ctx.globalAlpha = 0.8;
        ctx.lineWidth = w * 0.14;
        ctx.beginPath();
        ctx.arc(chest.x + w * 0.1, chest.y + h * 0.06, this.char.reach * 0.7, -0.9, 0.5);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }

    // charge orb at casting hand
    if (this.state === 'special') {
      const reach = Math.sin(Math.min(1, this.stateTime / SPECIAL_TIME) * Math.PI);
      ctx.globalAlpha = reach;
      const g = ctx.createRadialGradient(frontHand.x, frontHand.y, 1, frontHand.x, frontHand.y, w * 0.5 * reach + 2);
      g.addColorStop(0, '#fff');
      g.addColorStop(0.5, crestColor);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(frontHand.x, frontHand.y, w * 0.5 * reach + 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  _drawHead(ctx, head, skin, skinDark, hair, st, crestColor) {
    const { x, y, r } = head;
    // neck
    ctx.fillStyle = skinDark;
    ctx.fillRect(x - r * 0.3, y + r * 0.5, r * 0.6, r * 0.7);

    // face
    const fg = ctx.createLinearGradient(x - r, 0, x + r, 0);
    fg.addColorStop(0, skinDark);
    fg.addColorStop(0.5, skin);
    fg.addColorStop(1, skin);
    ctx.fillStyle = fg;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();

    // eye (facing forward = +x)
    ctx.fillStyle = 'rgba(20,15,30,0.9)';
    ctx.beginPath();
    ctx.ellipse(x + r * 0.42, y - r * 0.05, r * 0.13, r * 0.26, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = st.eye;
    ctx.beginPath();
    ctx.ellipse(x + r * 0.44, y - r * 0.08, r * 0.06, r * 0.14, 0, 0, Math.PI * 2);
    ctx.fill();
    // brow
    ctx.strokeStyle = shade(hair, -20);
    ctx.lineWidth = r * 0.14;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x + r * 0.2, y - r * 0.42);
    ctx.lineTo(x + r * 0.66, y - r * 0.3);
    ctx.stroke();

    this._drawHair(ctx, head, hair, st, crestColor);
  }

  _drawHair(ctx, head, hair, st, crestColor) {
    const { x, y, r } = head;
    const hl = shade(hair, 34);
    ctx.fillStyle = hair;

    switch (st.hairStyle) {
      case 'spiky': {
        ctx.fillStyle = hair;
        ctx.beginPath();
        ctx.moveTo(x - r, y);
        for (let i = 0; i <= 6; i += 1) {
          const t = i / 6;
          const px = x - r + t * 2 * r;
          const spike = r * (0.9 + (i % 2) * 0.5);
          ctx.lineTo(px - r * 0.15, y - spike);
          ctx.lineTo(px + r * 0.12, y - r * 0.4);
        }
        ctx.lineTo(x + r, y);
        ctx.quadraticCurveTo(x, y - r * 0.5, x - r, y);
        ctx.fill();
        break;
      }
      case 'slick': {
        ctx.beginPath();
        ctx.moveTo(x + r * 0.9, y - r * 0.2);
        ctx.quadraticCurveTo(x - r * 0.2, y - r * 1.5, x - r * 1.2, y - r * 0.1);
        ctx.quadraticCurveTo(x - r * 0.9, y - r * 0.5, x - r * 0.2, y - r * 0.6);
        ctx.quadraticCurveTo(x + r * 0.6, y - r * 0.7, x + r * 0.9, y - r * 0.2);
        ctx.fill();
        break;
      }
      case 'mohawk': {
        ctx.beginPath();
        ctx.moveTo(x - r * 0.2, y - r * 0.4);
        ctx.lineTo(x - r * 0.25, y - r * 1.7);
        ctx.lineTo(x + r * 0.1, y - r * 1.3);
        ctx.lineTo(x + r * 0.2, y - r * 1.75);
        ctx.lineTo(x + r * 0.35, y - r * 0.4);
        ctx.closePath();
        ctx.fill();
        // shaved side hint
        ctx.fillStyle = shade(hair, -30);
        ctx.beginPath();
        ctx.arc(x - r * 0.4, y - r * 0.4, r * 0.35, Math.PI, Math.PI * 1.6);
        ctx.fill();
        break;
      }
      case 'rugged': {
        ctx.beginPath();
        ctx.moveTo(x - r * 1.05, y + r * 0.1);
        for (let i = 0; i <= 5; i += 1) {
          const t = i / 5;
          const px = x - r + t * 2 * r;
          ctx.quadraticCurveTo(px, y - r * 1.3, px + r * 0.2, y - r * 0.5);
        }
        ctx.lineTo(x + r * 1.0, y + r * 0.1);
        ctx.quadraticCurveTo(x, y - r * 0.4, x - r * 1.05, y + r * 0.1);
        ctx.fill();
        break;
      }
      case 'hood':
      case 'cloak': {
        const cloth = st.hairStyle === 'cloak' ? shade(this.char.color, -35) : this.char.color;
        ctx.fillStyle = cloth;
        ctx.beginPath();
        ctx.arc(x - r * 0.1, y - r * 0.1, r * 1.28, Math.PI * 0.15, Math.PI * 1.75);
        ctx.quadraticCurveTo(x - r * 1.3, y - r * 1.6, x + r * 0.3, y - r * 1.4);
        ctx.fill();
        if (st.hairStyle === 'cloak') {
          ctx.fillStyle = 'rgba(8,4,16,0.5)';
          ctx.beginPath();
          ctx.arc(x + r * 0.1, y - r * 0.15, r * 0.7, 0, Math.PI * 2);
          ctx.fill();
          // glowing eye through shadow
          ctx.fillStyle = crestColor;
          ctx.shadowColor = crestColor;
          ctx.shadowBlur = r * 0.6;
          ctx.beginPath();
          ctx.arc(x + r * 0.42, y - r * 0.05, r * 0.1, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;
        }
        break;
      }
      default:
        break;
    }

    // flame crest tuft
    if (st.crest === 'flame') {
      ctx.fillStyle = crestColor;
      ctx.beginPath();
      ctx.moveTo(x, y - r * 1.3);
      ctx.quadraticCurveTo(x + r * 0.3, y - r * 0.6, x, y - r * 0.4);
      ctx.quadraticCurveTo(x - r * 0.3, y - r * 0.6, x, y - r * 1.3);
      ctx.fill();
    }
    // subtle hair highlight
    ctx.strokeStyle = hl;
    ctx.lineWidth = r * 0.12;
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    ctx.arc(x - r * 0.2, y - r * 0.4, r * 0.6, Math.PI * 1.1, Math.PI * 1.5);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
}
