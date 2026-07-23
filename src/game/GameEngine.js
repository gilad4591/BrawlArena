import { ARENA_DEPTH, DIFFICULTY, MODES } from './constants.js';
import { getCharacter, CHARACTERS, isPremium } from './characters.js';
import { getArena } from './arenas.js';
import { Fighter } from './Fighter.js';
import { Controller } from './input.js';
import { AIController } from './ai.js';
import { Projectile } from './Projectile.js';
import { Item, ITEM_DEFS, ITEM_IDS, STRONG_ITEM_IDS, POWERUP_DEFS, POWERUP_IDS } from './items.js';
import { Particle, FloatingText, burst, spark, dust } from './effects.js';
import { impactFx, slashFx, dustFx } from './vfx.js';
import { getEnemy } from './enemies.js';
import { buildSnapshot, readInput, applyInput, ProjProxy, ItemProxy } from './netcode.js';
import { t, tpl } from '../i18n.js';

const SNAPSHOT_HZ = 22; // host broadcast rate

const NEUTRAL_MODS = { moveSpeedMult: 1, damageTaken: 1, damageDealt: 1 };

export class GameEngine {
  constructor(canvas, callbacks = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.cb = callbacks;
    this.audio = callbacks.audio;
    this.haptics = callbacks.haptics;
    this.onBlock = callbacks.onBlock;

    this.fighters = [];
    this.projectiles = [];
    this.effects = [];
    this.items = [];
    this.ais = [];
    this.humanController = null;
    this.human = null;

    // --- Networking (host-authoritative). null for local/offline play. ---
    this.net = null; // { role:'host'|'guest', localNetId, send(state) }
    this.remoteControllers = new Map(); // netId -> Controller (host side)
    this._netTarget = null; // latest snapshot to interpolate toward (guest)
    this._snapAccum = 0; // host snapshot throttle
    this._inputAccum = 0; // guest input throttle

    this.running = false;
    this.paused = false;
    this.roundOver = false;
    this.overTimer = 0;
    this.elapsed = 0;
    this.lastTime = 0;
    this._raf = null;

    // Game-feel state.
    this.shake = 0; // screen-shake magnitude in px
    this.hitStop = 0; // seconds of frozen simulation
    this.timeScale = 1; // <1 during slow-motion finishes
    this._slowmo = 0; // seconds of slow-motion remaining
    this._rawDt = 0;

    this.vw = 0;
    this.vh = 0;
    this.resize();
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.canvas.width = Math.floor(w * dpr);
    this.canvas.height = Math.floor(h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.vw = w;
    this.vh = h;

    // Extra headroom above the back row so jump kicks/uppercuts/specials have
    // room to read fully instead of nearing the top edge (or the HUD strip).
    this.floorTopY = h * 0.57;
    this.floorBottomY = h * 0.94;
    this._arenaCache = null; // size changed -> rebuild the cached background
    this._vignette = null;
    this.fighters.forEach((f) => f.setArenaWidth(w));
  }

  // ---- projection helpers (2.5D) ----
  scale(z) {
    return 0.72 + 0.34 * (z / ARENA_DEPTH);
  }

  floorLine(z) {
    return this.floorTopY + (this.floorBottomY - this.floorTopY) * (z / ARENA_DEPTH);
  }

  get view() {
    return {
      screenX: (x) => x,
      screenY: (x, z, y) => this.floorLine(z) - y * this.scale(z),
      floorLine: (z) => this.floorLine(z),
      scale: (z) => this.scale(z),
    };
  }

  /**
   * config: { playerCharacter, mode, difficulty, opponents, opponentChars? }
   */
  start(config) {
    this.config = config;
    this.fighters = [];
    this.projectiles = [];
    this.effects = [];
    this.items = [];
    this.ais = [];
    this.remoteControllers = new Map();
    this.net = config.net || null;
    this._netTarget = null;
    this._snapAccum = 0;
    this._inputAccum = 0;
    this.roundOver = false;
    this.overTimer = 0;
    this.elapsed = 0;
    this._reported = false;
    this._winnerTeam = null;
    this.reduceMotion = !!config.reduceMotion;
    this._humanBestCombo = 0; // best combo the player landed this match
    this._humanKOs = 0; // enemies the player personally knocked out
    this.eliminationOrder = []; // fighters in the order they were KO'd

    this._fid = 0;
    this.boss = null;
    this.campaign = null;
    this.survival = null;
    // Timed drop waves: nothing drops at the start of the fight. The first wave
    // arrives after ~10s, then a fresh wave every ~30s. Each wave drops a few
    // player-only power-ups plus one rare, high-power weapon.
    this._powerupTimer = 10;

    this.arena = getArena(config.arena);
    const mode = config.campaign ? { key: 'campaign', teams: false } : MODES[config.mode] || MODES.oneVsOne;
    this._teamsMode = config.campaign ? false : !!mode.teams;
    const diff = DIFFICULTY[config.difficulty] || DIFFICULTY[2];
    this._diff = diff;
    this.diffMods = {
      moveSpeedMult: diff.moveSpeedMult,
      damageTaken: diff.damageTaken,
      damageDealt: diff.damageDealt,
    };
    const w = this.vw;

    if (config.campaign) {
      this._startCampaign(config);
    } else if (config.survival) {
      this._startSurvival(config);
    } else if (config.network) {
      this._startNetworkMatch(config);
    } else {
      // Build the participant list: teams + characters.
      const participants = this._buildParticipants(config, mode);
      participants.forEach((p, i) => {
        const spawnX = w * (0.16 + 0.68 * (participants.length === 1 ? 0.5 : i / (participants.length - 1)));
        this._addFighter({
          character: p.character,
          team: p.team,
          isHuman: p.isHuman,
          name: p.name,
          x: spawnX,
          z: ARENA_DEPTH * (0.4 + Math.random() * 0.3),
          facing: spawnX < w / 2 ? 1 : -1,
        });
      });
      this._spawnItems();
      this._humanTookDamage = false;
      this.cb.onAnnounce?.('FIGHT!', 'go');
    }

    // Apply the player's equipped cosmetics: body hue, elemental aura, SP theme.
    if (this.human && config.playerTint) this.human.tint = config.playerTint;
    if (this.human) {
      this.human.skinAura = config.playerAura || null;
      this.human.spFx = config.playerSpFx || null;
    }

    this.shake = 0;
    this.hitStop = 0;
    this.timeScale = 1;
    this._slowmo = 0;

    this.running = true;
    this.paused = false;
    this.lastTime = performance.now();
    this._emitHud();
    cancelAnimationFrame(this._raf);
    this._raf = requestAnimationFrame((t) => this._loop(t));
  }

  /** Create a fighter (+ controller and AI) and register it. */
  _addFighter({ character, team, isHuman, name, x, z, facing, aiDiff, remote, netId, neutral }) {
    const controller = new Controller();
    const char = typeof character === 'string' ? getCharacter(character) : character;
    const fighter = new Fighter({
      id: `f${this._fid++}`,
      character: char,
      team,
      isHuman,
      control: controller,
      x,
      z,
      facing: facing ?? 1,
      // Human players (local or remote) never get the AI difficulty handicap.
      difficultyMods: isHuman || remote || neutral ? NEUTRAL_MODS : this.diffMods,
      teamsMode: this._teamsMode,
    });
    fighter.displayName = name;
    fighter.netId = netId || null;
    fighter.setArenaWidth(this.vw);
    this.fighters.push(fighter);
    if (isHuman) {
      this.human = fighter;
      this.humanController = controller;
    } else if (remote) {
      // Driven over the network (another human). No local AI.
      this.remoteControllers.set(netId, controller);
    } else {
      this.ais.push(new AIController(fighter, controller, aiDiff || this._diff));
    }
    return fighter;
  }

  /**
   * Build a networked match. `config.netPlayers` is the agreed roster (same on
   * every client) as [{ character, name, team, netId }]. `config.localIndex`
   * marks which of those is the local human; the rest are remote (host) or
   * puppets (guest). Only the HOST actually simulates.
   */
  _startNetworkMatch(config) {
    const w = this.vw;
    const players = config.netPlayers || [];
    this._teamsMode = !!config.teamsMode;
    const isHost = this.net?.role === 'host';
    players.forEach((p, i) => {
      const spawnX = w * (0.16 + 0.68 * (players.length === 1 ? 0.5 : i / (players.length - 1)));
      const local = i === config.localIndex;
      this._addFighter({
        character: p.character,
        team: p.team,
        isHuman: local,
        // Non-local players are never AI: on the host they're driven by remote
        // input; on a guest they're puppets that just render host snapshots.
        remote: !local,
        neutral: !local,
        netId: p.netId,
        name: p.name,
        x: spawnX,
        z: ARENA_DEPTH * (0.45 + 0.1 * (i / Math.max(1, players.length - 1))),
        facing: spawnX < w / 2 ? 1 : -1,
      });
    });
    // Only the host spawns items (they're part of the authoritative sim).
    if (isHost) this._spawnItems();
    this._humanTookDamage = false;
    this.cb.onAnnounce?.('FIGHT!', 'go');
  }

  /** Route an incoming network payload (snapshot from host / input from guest). */
  ingestNet(state) {
    if (!state || !this.net) return;
    if (state.k === 'input' && this.net.role === 'host') {
      const ctrl = this.remoteControllers.get(state.id);
      if (ctrl) applyInput(ctrl, state);
    } else if (state.k === 'snap' && this.net.role === 'guest') {
      this._netTarget = state;
    }
  }

  _buildParticipants(config, mode) {
    const list = [];
    const pool = CHARACTERS.map((c) => c.id)
      .filter((id) => id !== config.playerCharacter)
      // On web, premium fighters don't exist at all — keep them out of the CPU pool.
      .filter((id) => !(config.excludePremium && isPremium(id)));
    const pick = () => {
      if (!pool.length) return CHARACTERS[Math.floor(Math.random() * CHARACTERS.length)].id;
      const i = Math.floor(Math.random() * pool.length);
      return pool.splice(i, 1)[0];
    };

    const opponents =
      mode.key === 'oneVsOne'
        ? 1
        : Math.max(1, Math.min(mode.maxOpponents, config.opponents || 1));
    const assign = config.teamAssign || [];

    // Index 0 is always the human player.
    list.push({
      character: config.playerCharacter,
      team: mode.teams ? assign[0] ?? 0 : 0,
      isHuman: true,
      name: config.playerName || 'You',
    });

    for (let i = 0; i < opponents; i += 1) {
      let team;
      if (mode.teams) team = assign[i + 1] ?? (i + 1) % 2;
      else if (mode.key === 'freeForAll') team = i + 1; // everyone on their own team
      else team = 1; // 1 vs 1
      list.push({ character: pick(), team, isHuman: false, name: `CPU ${i + 1}` });
    }
    return list;
  }

  // ---- Solo campaign ---------------------------------------------------
  _startCampaign(config) {
    const stages = config.campaign.stages;
    const startStage = Math.max(0, Math.min(stages.length - 1, config.campaign.startStage || 0));
    this.arena = getArena(stages[startStage].arena);
    // The player starts alone in the middle; waves spawn from the edges.
    this._addFighter({
      character: config.playerCharacter,
      team: 0,
      isHuman: true,
      name: config.playerName || 'You',
      x: this.vw * 0.5,
      z: ARENA_DEPTH * 0.5,
      facing: 1,
    });
    this.campaign = {
      stages,
      stageIndex: startStage,
      waveIndex: -1,
      state: 'between',
      betweenTimer: 1.1,
      stagesCleared: 0,
    };
    this._spawnItems();
  }

  _addEnemy(def, x, z, facing) {
    return this._addFighter({
      character: def,
      team: 1,
      isHuman: false,
      name: def.name,
      x,
      z,
      facing,
      aiDiff: { ...def.ai },
    });
  }

  // ---- Endless Survival ------------------------------------------------
  _startSurvival(config) {
    // A rotating arena keeps the endless mode visually fresh.
    this._survivalArenas = ['dojo', 'forest', 'frozen', 'volcano'];
    this.arena = getArena(this._survivalArenas[0]);
    this._addFighter({
      character: config.playerCharacter,
      team: 0,
      isHuman: true,
      name: config.playerName || 'You',
      x: this.vw * 0.5,
      z: ARENA_DEPTH * 0.5,
      facing: 1,
    });
    this.survival = {
      wave: 0,
      wavesCleared: 0,
      kills: 0,
      score: 0,
      state: 'between',
      betweenTimer: 1.1,
    };
    this._spawnItems();
  }

  _survivalInfo() {
    const sv = this.survival;
    return {
      survival: true,
      wave: sv.wave,
      score: sv.score,
      enemies: this.fighters.filter((f) => f.team !== 0 && f.alive).length,
      boss: !!(this.boss && this.boss.alive),
    };
  }

  /** Enemy id list for a given wave, escalating in size and toughness. */
  _survivalWaveComposition(wave) {
    // Every 10th wave is a boss fight; every 5th brings a mini-boss.
    if (wave % 10 === 0) {
      const guards = 1 + Math.floor(wave / 20);
      return ['leader', ...Array(guards).fill('bruiser'), 'mage'];
    }
    const list = [];
    const total = Math.min(6, 2 + Math.floor(wave / 2));
    const mageChance = wave >= 3 ? Math.min(0.45, 0.15 + wave * 0.03) : 0;
    for (let i = 0; i < total; i += 1) {
      list.push(Math.random() < mageChance ? 'mage' : 'bruiser');
    }
    if (wave % 5 === 0) list.push('superbruiser');
    return list;
  }

  _spawnSurvivalWave() {
    const sv = this.survival;
    sv.wave += 1;
    // Rotate the backdrop every few waves.
    const arenaId = this._survivalArenas[Math.floor((sv.wave - 1) / 3) % this._survivalArenas.length];
    this.arena = getArena(arenaId);
    const w = this.vw;
    // Enemies get tougher/stronger the deeper you go.
    const hpMul = 1 + (sv.wave - 1) * 0.09;
    const powMul = 1 + (sv.wave - 1) * 0.04;
    const types = this._survivalWaveComposition(sv.wave);
    types.forEach((type, i) => {
      const base = getEnemy(type);
      const def = {
        ...base,
        maxHp: Math.round(base.maxHp * hpMul),
        attackPower: +(base.attackPower * powMul).toFixed(1),
      };
      const fromLeft = i % 2 === 0;
      const x = fromLeft ? w * 0.06 - i * 8 : w * 0.94 + i * 8;
      const z = ARENA_DEPTH * (0.28 + Math.random() * 0.44);
      const f = this._addEnemy(def, Math.max(24, Math.min(w - 24, x)), z, fromLeft ? 1 : -1);
      if (def.isBoss) this.boss = f;
    });
    sv.state = 'fighting';
    this.cb.onAnnounce?.(`WAVE ${sv.wave}`, 'go');
    this.cb.onRoster?.(this.fighters);
    this.cb.onSurvival?.(this._survivalInfo());
    this._emitHud();
  }

  _updateSurvival(dt) {
    const sv = this.survival;

    // Score every fresh enemy KO (scaled by the wave it happened on).
    for (const f of this.fighters) {
      if (f.team !== 0 && !f.alive && !f._svCounted) {
        f._svCounted = true;
        sv.kills += 1;
        sv.score += 10 * sv.wave;
      }
    }

    // Drop faded corpses so the fighter/AI lists stay tidy across waves.
    if (this.fighters.some((f) => !f.isHuman && f.gone)) {
      const goneIds = new Set(this.fighters.filter((f) => !f.isHuman && f.gone).map((f) => f.id));
      this.fighters = this.fighters.filter((f) => !goneIds.has(f.id));
      this.ais = this.ais.filter((a) => !goneIds.has(a.fighter.id));
    }

    if (sv.state === 'lost') {
      this.overTimer -= dt;
      if (this.overTimer <= 0 && !this._reported) {
        this._reported = true;
        this.cb.onRoundOver?.({
          survival: true,
          win: false,
          wave: sv.wave,
          wavesCleared: sv.wavesCleared,
          score: sv.score,
          time: this.elapsed,
          bestCombo: this._humanBestCombo,
          koDealt: this._humanKOs,
        });
      }
      return;
    }

    if (!this.human.alive) {
      sv.state = 'lost';
      this.overTimer = 1.8;
      this._slowmo = 1.2;
      this.addShake(14);
      this.cb.onAnnounce?.('DEFEATED', 'ko');
      return;
    }

    if (sv.state === 'between') {
      sv.betweenTimer -= dt;
      if (sv.betweenTimer <= 0) this._spawnSurvivalWave();
      return;
    }

    if (sv.state === 'fighting') {
      const enemiesLeft = this.fighters.some((f) => f.team !== 0 && f.alive);
      if (enemiesLeft) return;
      // Wave cleared: heal a little, refresh props, cue the next wave.
      sv.wavesCleared += 1;
      this.human.hp = Math.min(this.human.maxHp, this.human.hp + this.human.maxHp * 0.18);
      this.boss = null;
      this._spawnItems();
      sv.state = 'between';
      sv.betweenTimer = 1.8;
      this.cb.onSurvival?.(this._survivalInfo());
    }
  }

  _campaignInfo() {
    const cmp = this.campaign;
    const stage = cmp.stages[cmp.stageIndex];
    return {
      stage: cmp.stageIndex + 1,
      totalStages: cmp.stages.length,
      stageName: stage.name,
      wave: Math.max(1, cmp.waveIndex + 1),
      totalWaves: stage.waves.length,
      boss: !!(this.boss && this.boss.alive),
      enemies: this.fighters.filter((f) => f.team !== 0 && f.alive).length,
    };
  }

  _spawnWave() {
    const cmp = this.campaign;
    cmp.waveIndex += 1;
    const stage = cmp.stages[cmp.stageIndex];
    const wave = stage.waves[cmp.waveIndex] || [];
    const w = this.vw;
    wave.forEach((type, i) => {
      const def = getEnemy(type);
      const fromLeft = i % 2 === 0;
      const x = fromLeft ? w * 0.06 - i * 8 : w * 0.94 + i * 8;
      const z = ARENA_DEPTH * (0.28 + Math.random() * 0.44);
      const f = this._addEnemy(def, Math.max(24, Math.min(w - 24, x)), z, fromLeft ? 1 : -1);
      if (def.isBoss) this.boss = f;
    });
    cmp.state = 'fighting';
    this.cb.onAnnounce?.(cmp.waveIndex === 0 ? stage.name : `WAVE ${cmp.waveIndex + 1}`, 'go');
    this.cb.onRoster?.(this.fighters);
    this.cb.onCampaign?.(this._campaignInfo());
    this._emitHud();
  }

  _updateCampaign(dt) {
    const cmp = this.campaign;

    // Drop faded enemy corpses (and their AIs) so lists stay tidy across waves.
    if (this.fighters.some((f) => !f.isHuman && f.gone)) {
      const goneIds = new Set(this.fighters.filter((f) => !f.isHuman && f.gone).map((f) => f.id));
      this.fighters = this.fighters.filter((f) => !goneIds.has(f.id));
      this.ais = this.ais.filter((a) => !goneIds.has(a.fighter.id));
    }

    // Resolving a finished campaign (victory / defeat) after a short beat.
    if (cmp.state === 'won' || cmp.state === 'lost') {
      this.overTimer -= dt;
      if (this.overTimer <= 0 && !this._reported) {
        this._reported = true;
        this.cb.onRoundOver?.({
          win: cmp.state === 'won',
          campaign: true,
          stage: cmp.stageIndex + 1,
          stageName: cmp.stages[cmp.stageIndex].name,
          stagesCleared: cmp.stagesCleared,
          time: this.elapsed,
          bestCombo: this._humanBestCombo,
          koDealt: this._humanKOs,
        });
      }
      return;
    }

    // Player down → defeat.
    if (!this.human.alive) {
      cmp.state = 'lost';
      this.overTimer = 1.8;
      this._slowmo = 1.2;
      this.addShake(14);
      this.cb.onAnnounce?.('DEFEATED', 'ko');
      return;
    }

    if (cmp.state === 'between') {
      cmp.betweenTimer -= dt;
      if (cmp.betweenTimer <= 0) this._spawnWave();
      return;
    }

    if (cmp.state === 'fighting') {
      const enemiesLeft = this.fighters.some((f) => f.team !== 0 && f.alive);
      if (enemiesLeft) return;
      const stage = cmp.stages[cmp.stageIndex];
      if (cmp.waveIndex < stage.waves.length - 1) {
        // More waves in this stage.
        cmp.state = 'between';
        cmp.betweenTimer = 1.5;
        this.cb.onCampaign?.(this._campaignInfo());
      } else {
        // Stage cleared.
        cmp.stagesCleared += 1;
        if (cmp.stageIndex >= cmp.stages.length - 1) {
          cmp.state = 'won';
          this.overTimer = 2.2;
          this._slowmo = 1.2;
          this.addShake(14);
          this.cb.onAnnounce?.('VICTORY!', 'go');
        } else {
          cmp.stageIndex += 1;
          cmp.waveIndex = -1;
          cmp.state = 'between';
          cmp.betweenTimer = 2.2;
          this.boss = null;
          this.arena = getArena(cmp.stages[cmp.stageIndex].arena);
          // Patch the player up a little and refresh props between stages.
          this.human.hp = Math.min(this.human.maxHp, this.human.hp + this.human.maxHp * 0.35);
          this._spawnItems();
          this.cb.onAnnounce?.(`STAGE ${cmp.stageIndex + 1}`, 'go');
          this.cb.onCampaign?.(this._campaignInfo());
          this.cb.onStageClear?.(cmp.stageIndex);
        }
      }
    }
  }

  _spawnItems() {
    this.items = [];
    const count = 3 + Math.floor(Math.random() * 3); // 3-5 props
    for (let i = 0; i < count; i += 1) {
      const def = ITEM_DEFS[ITEM_IDS[Math.floor(Math.random() * ITEM_IDS.length)]];
      const x = this.vw * (0.15 + Math.random() * 0.7);
      const z = ARENA_DEPTH * (0.2 + Math.random() * 0.7);
      this.items.push(new Item(def, x, z));
    }
  }

  /**
   * A timed supply drop: 2-4 player-only power-ups (HP / Power / Shield) plus one
   * rare, high-power weapon that out-damages any SPECIAL. Everything falls in from
   * above so it reads as an event. Skipped if the field is already crowded.
   */
  _spawnDropWave() {
    const liveBuffs = this.items.filter((it) => it.def.category === 'buff' && !it.dead).length;
    if (liveBuffs >= 6) return;
    const count = 2 + Math.floor(Math.random() * 3); // 2-4 power-ups
    for (let i = 0; i < count; i += 1) {
      const def = POWERUP_DEFS[POWERUP_IDS[Math.floor(Math.random() * POWERUP_IDS.length)]];
      this._dropItem(def, i, count, def.label, 220 + i * 24);
    }
    // One rare, high-power weapon (harder-hitting than a special move).
    if (STRONG_ITEM_IDS.length) {
      const wdef = ITEM_DEFS[STRONG_ITEM_IDS[Math.floor(Math.random() * STRONG_ITEM_IDS.length)]];
      this._dropItem(wdef, count, count + 1, wdef.name.toUpperCase(), 260);
    }
    this.audio?.pickup?.();
  }

  /** Drop a single item/power-up in from above, biased toward the human. */
  _dropItem(def, index, total, label, dropY = 220) {
    const base = this.human ? this.human.x : this.vw * 0.5;
    const spread = this.vw * (0.14 + (index / Math.max(1, total)) * 0.22);
    const dir = index % 2 === 0 ? -1 : 1;
    const x = Math.max(this.vw * 0.1, Math.min(this.vw * 0.9, base + dir * spread));
    const z = ARENA_DEPTH * (0.28 + Math.random() * 0.44);
    const it = new Item(def, x, z, dropY);
    it.vy = 40;
    this.items.push(it);
    const sx = this.view.screenX(x);
    this.effects.push(new FloatingText(sx, this.view.floorLine(z) - dropY + 10, label, def.color, 20, { pop: true, life: 1.1, rise: 20 }));
  }

  _throwItem(f) {
    const held = f.heldItem;
    if (!held) return;
    this.projectiles.push(
      new Projectile(f, {
        type: 'projectile',
        speed: 720,
        damage: held.def.throwDamage || 14,
        radius: 12,
        color: held.def.color,
        knockback: 1.3,
      }),
    );
    this.audio?.throw?.();
    f.heldItem = null;
  }

  _tryPickup(f) {
    if (!f.alive || !f.grounded || f.y > 6) return;
    for (const it of this.items) {
      if (it.dead || it.y > 6) continue;
      // Timed power-ups are for the human player only — CPU foes ignore them.
      if (it.def.playerOnly && !f.isHuman) continue;
      if (Math.abs(it.x - f.x) > 30 || Math.abs(it.z - f.z) > 28) continue;
      if (it.def.category === 'buff') {
        this._applyPowerup(f, it.def);
        it.dead = true;
        return;
      }
      if (it.def.category === 'heal') {
        if (it.def.healHp) f.hp = Math.min(f.maxHp, f.hp + it.def.healHp);
        if (it.def.healMp) f.mp = Math.min(f.maxMp, f.mp + it.def.healMp);
        it.dead = true;
        const sx = this.view.screenX(f.x);
        const sy = this.view.screenY(f.x, f.z, f.height * 0.6 + f.y);
        this.effects.push(
          new FloatingText(sx, sy, t(it.def.healMp ? '+MP' : '+HP'), it.def.color, 20, { pop: true }),
        );
        burst(this.effects, sx, sy, it.def.color, 10, { spread: 160, up: 160 });
        this.audio?.pickup?.();
        return;
      }
      // weapon: only if hands are free
      if (!f.heldItem) {
        f.heldItem = { def: it.def, uses: it.def.uses || 1 };
        it.dead = true;
        this.audio?.pickup?.();
        return;
      }
    }
  }

  /** Apply a timed power-up's effect to a fighter (heal / power buff / shield). */
  _applyPowerup(f, def) {
    if (def.effect === 'hp') {
      f.hp = Math.min(f.maxHp, f.hp + (def.healHp || 80));
    } else if (def.effect === 'power') {
      f.powerTimer = def.duration || 10;
      f.powerMult = def.mult || 1.4;
    } else if (def.effect === 'shield') {
      f.shieldTimer = def.duration || 5;
    }
    const sx = this.view.screenX(f.x);
    const sy = this.view.screenY(f.x, f.z, f.height * 0.6 + f.y);
    this.effects.push(new FloatingText(sx, sy, def.label || def.name, def.color, 22, { pop: true, life: 0.9, rise: 24 }));
    burst(this.effects, sx, sy, def.color, 16, { spread: 240, up: 220 });
    this.audio?.rage?.();
    this.haptics?.hit?.();
  }

  _loop(now) {
    if (!this.running) return;
    let raw = (now - this.lastTime) / 1000;
    this.lastTime = now;
    if (raw > 0.05) raw = 0.05; // clamp big frame gaps
    this._rawDt = raw;

    if (!this.paused) {
      if (this.net?.role === 'guest') {
        // Guests never simulate; they render the host's snapshot and stream input.
        this._guestTick(raw);
      } else if (this.hitStop > 0) {
        // Freeze the sim for a beat (impact punch), but keep drawing.
        this.hitStop -= raw;
      } else {
        this._slowmo = Math.max(0, this._slowmo - raw);
        this.timeScale = this._slowmo > 0 ? 0.4 : 1;
        this._update(raw * this.timeScale);
      }
      this._render();
      if (this.net?.role === 'host') this._maybeSendSnapshot(raw);
    }
    this._raf = requestAnimationFrame((t) => this._loop(t));
  }

  /** Host: broadcast a compact snapshot at a fixed rate. */
  _maybeSendSnapshot(dt) {
    this._snapAccum += dt;
    if (this._snapAccum < 1 / SNAPSHOT_HZ) return;
    this._snapAccum = 0;
    this.net.send(buildSnapshot(this));
  }

  /**
   * Guest per-frame: smooth fighters toward the latest snapshot, keep cosmetic
   * animation/effects ticking, forward local input, and mirror round-over.
   */
  _guestTick(dt) {
    this.elapsed += dt;
    this.shake = Math.max(0, this.shake - dt * 48);

    // Stream our own input to the host (throttled a touch above snapshot rate).
    this._inputAccum += dt;
    if (this.humanController && this._inputAccum >= 1 / 30) {
      this._inputAccum = 0;
      this.net.send(readInput(this.humanController, this.net.localNetId));
    }

    const snap = this._netTarget;
    if (snap) {
      const a = Math.min(1, dt * 16); // exponential smoothing toward the target
      for (const fs of snap.fighters) {
        const f = this.fighters[fs.i];
        if (!f) continue;
        f.x += (fs.x - f.x) * a;
        f.y += (fs.y - f.y) * a;
        f.z += (fs.z - f.z) * a;
        f.facing = fs.fa;
        f.state = fs.s;
        f.stateTime = fs.st;
        f.hp = fs.hp;
        f.mp = fs.mp;
        f.alive = !!fs.al;
        f.deathTime = fs.dt;
        f.powerTimer = fs.pt;
        f.shieldTimer = fs.sh;
        f._combo = fs.cb;
        f.heldItem = fs.it ? { def: ITEM_DEFS[fs.it.id], uses: fs.it.u } : null;
      }
      // Rebuild render proxies for projectiles / items.
      this.projectiles = snap.proj.map((d) => new ProjProxy(d));
      this.items = snap.items.map((d) => new ItemProxy(d));

      if (snap.over != null && !this.roundOver) {
        this.roundOver = true;
        this.overTimer = 1.6;
        this._winnerTeam = snap.over < 0 ? null : snap.over;
        this._slowmo = 1.0;
        this.cb.onAnnounce?.('K.O.!', 'ko');
      }
    }

    // Advance cosmetic-only clocks so animations still play on the guest.
    for (const f of this.fighters) {
      f.animClock += dt;
      if (f.flashTime > 0) f.flashTime = Math.max(0, f.flashTime - dt);
    }
    for (const e of this.effects) e.update(dt);
    this.effects = this.effects.filter((e) => !e.dead);

    this._emitHud();

    if (this.roundOver) {
      this.overTimer -= dt;
      if (this.overTimer <= 0 && !this._reported) {
        this._reported = true;
        this._reportResult();
      }
    }
  }

  addShake(mag) {
    if (this.reduceMotion) return; // accessibility: no camera shake
    this.shake = Math.min(16, Math.max(this.shake, mag));
  }

  _update(dt) {
    this.elapsed += dt;
    this.shake = Math.max(0, this.shake - this._rawDt * 48);

    // AI decisions
    for (const ai of this.ais) ai.update(dt, this.fighters, this);

    // Fighters
    for (const f of this.fighters) {
      const wasAir = f._wasAir === true;
      f.update(dt, this);
      if (f.pendingSpecial) {
        this._castSpecial(f, f.pendingSpecial);
        f.pendingSpecial = null;
      }
      if (f._throwPending) {
        this._throwItem(f);
        f._throwPending = false;
      }
      this._tryPickup(f);
      if (f._dash) this._processDash(f, dt);
      // Hard-landing dust when returning to the ground.
      if (wasAir && f.grounded && f.alive) {
        const lx = this.view.screenX(f.x);
        const ly = this.view.screenY(f.x, f.z, f.y);
        dustFx(this.effects, lx, ly, 'land', { size: f.width * 2.4, life: 0.5, rise: 12 });
        dust(this.effects, lx, ly, 6);
      }
      // Takeoff puff on the first airborne frame of a jump.
      if (!wasAir && !f.grounded && f.vy > 0 && f.alive) {
        dustFx(this.effects, this.view.screenX(f.x), this.view.screenY(f.x, f.z, f.y), 'jump', { size: f.width * 2, life: 0.4, rise: 8 });
      }
      f._wasAir = !f.grounded;
      // Combo decay.
      if (f._comboTimer > 0) {
        f._comboTimer -= dt;
        if (f._comboTimer <= 0) f._combo = 0;
      }
      // Rage entry cue.
      const raging = f.rage;
      if (raging && !f._wasRaging) {
        this.audio?.rage?.();
        const rx = this.view.screenX(f.x);
        const ry = this.view.screenY(f.x, f.z, f.height * 0.6 + f.y);
        burst(this.effects, rx, ry, '#ff5230', 14, { spread: 240, up: 220 });
      }
      f._wasRaging = raging;
    }

    // Melee resolution
    for (const attacker of this.fighters) {
      const hb = attacker.getMeleeHitbox();
      if (!hb) continue;
      for (const def of this.fighters) {
        if (attacker.attackHits.has(def.id)) continue;
        if (attacker.containsHit(hb, def)) {
          attacker.attackHits.add(def.id);
          this._applyHit(attacker, def, hb.damage, { knockback: hb.knockback, launch: hb.finisher });
          // Melee slash arc at the strike point (melee-only, so it stays readable).
          if (def.alive && def.shieldTimer <= 0) {
            const slx = this.view.screenX(def.x);
            const sly = this.view.screenY(def.x, def.z, def.height * 0.5 + def.y);
            slashFx(this.effects, slx, sly, this._slashName(attacker), {
              flip: attacker.facing < 0,
              size: 60 + (hb.finisher ? 24 : 0),
              rot: (Math.random() - 0.5) * 0.3,
            });
          }
          // Weapon swings wear out and eventually break.
          if (hb.weapon && attacker.heldItem && !attacker._swingConsumed) {
            attacker._swingConsumed = true;
            attacker.heldItem.uses -= 1;
            if (attacker.heldItem.uses <= 0) {
              const bx = this.view.screenX(attacker.x);
              const by = this.view.screenY(attacker.x, attacker.z, attacker.height * 0.6);
              burst(this.effects, bx, by, attacker.heldItem.def.color, 10, { spread: 200, up: 160 });
              this.audio?.weaponBreak?.();
              attacker.heldItem = null;
            }
          }
        }
      }
    }

    // Projectiles
    for (const p of this.projectiles) {
      p.update(dt, this.fighters);
      if (p.dead) continue;
      for (const def of this.fighters) {
        if (p.hitIds.has(def.id) || def.team === p.team || !def.alive) continue;
        if (this._projectileHits(p, def)) {
          p.hitIds.add(def.id);
          const dir = p.vx >= 0 ? 1 : -1;
          this._applyHit(p.owner, def, p.damage, {
            knockback: p.knockback,
            freeze: p.freeze,
            dir,
          });
          p.dead = true;
          break;
        }
      }
    }
    this.projectiles = this.projectiles.filter((p) => !p.dead);

    // Items
    for (const it of this.items) it.update(dt);
    this.items = this.items.filter((it) => !it.dead);

    // Timed drop waves: first at ~10s, then every ~30s.
    this._powerupTimer -= dt;
    if (this._powerupTimer <= 0) {
      this._spawnDropWave();
      this._powerupTimer = 28 + Math.random() * 4;
    }

    // Effects
    for (const e of this.effects) e.update(dt);
    this.effects = this.effects.filter((e) => !e.dead);

    this._emitHud();
    if (this.campaign) this._updateCampaign(dt);
    else if (this.survival) this._updateSurvival(dt);
    else this._checkRoundOver(dt);
  }

  _projectileHits(p, def) {
    const dx = Math.abs(def.x - p.x);
    const dz = Math.abs(def.z - p.z);
    if (dx > def.width * 0.6 + p.radius || dz > 34) return false;
    const top = def.y + def.height;
    return p.y >= def.y - 12 && p.y <= top + 12;
  }

  _applyHit(attacker, def, damage, opts = {}) {
    const dir = opts.dir ?? attacker.facing;
    // Invincibility power-up: absorb the hit entirely.
    if (def.shieldTimer > 0 && def.alive) {
      const bx = this.view.screenX(def.x);
      const by = this.view.screenY(def.x, def.z, def.height * 0.5 + def.y);
      this.effects.push(new FloatingText(bx, by - 18, t('SHIELD'), '#5fe6ff', 16, { pop: true }));
      spark(this.effects, bx, by, '#5fe6ff');
      return;
    }
    // Power power-up boosts the attacker's damage for its duration.
    const powerMult = attacker?.powerTimer > 0 ? (attacker.powerMult || 1.4) : 1;
    const dmg = damage * (attacker?.rage ? 1.3 : 1) * powerMult;
    const wasAlive = def.alive;
    const result = def.takeHit(dmg, dir, opts, this);
    if (!result) return;
    // Track flawless rounds for the "PERFECT" bonus.
    if (def === this.human && !result.blocked && result.damage > 0) this._humanTookDamage = true;
    // Credit the player for KOs they personally landed.
    if (wasAlive && !def.alive && attacker === this.human) this._humanKOs += 1;
    const view = this.view;
    if (!result.blocked) {
      // Impact juice scales with damage dealt.
      this.addShake(2 + Math.min(8, result.damage * 0.35));
      if (result.damage >= 15) this.hitStop = Math.max(this.hitStop, 0.05);
    } else {
      this.addShake(2);
    }
    const sx = view.screenX(def.x);
    const sy = view.screenY(def.x, def.z, def.height * 0.5 + def.y);
    if (result.blocked) {
      this.effects.push(new FloatingText(sx, sy - 20, t('BLOCK'), '#8fd0ff', 16));
      burst(this.effects, sx, sy, '#8fd0ff', 6, { spread: 160, up: 120, life: 0.3 });
    } else {
      this.effects.push(new FloatingText(sx, sy - 24, `${Math.round(result.damage)}`, '#fff', 20));
      // Normalise the hit's damage into a 0-1 "power" so finishers/specials
      // visibly hit harder than a jab, instead of every hit looking the same.
      const power = Math.max(0, Math.min(1, (result.damage - 4) / 26));
      spark(this.effects, sx, sy, attacker.char.accent, power);
      burst(this.effects, sx, sy, attacker.char.accent, 8 + Math.round(power * 6), { spread: 260, up: 200 });

      // Combo tracking on the attacker.
      attacker._combo = (attacker._combo || 0) + 1;
      attacker._comboTimer = 1.3;
      if (attacker === this.human && attacker._combo > this._humanBestCombo) {
        this._humanBestCombo = attacker._combo;
      }
      // Big-combo banner for the player (fires once per milestone).
      if (attacker === this.human && !this.roundOver && (attacker._combo === 5 || attacker._combo === 8 || attacker._combo === 12)) {
        this.cb.onAnnounce?.('COMBO', 'go');
      }
      if (attacker._combo >= 2) {
        const cx = view.screenX(attacker.x);
        const cy = view.screenY(attacker.x, attacker.z, attacker.height + attacker.y) - 40;
        this.effects.push(
          new FloatingText(cx, cy, tpl('{n} Hits!', { n: attacker._combo }), attacker.char.accent, 26, {
            pop: true,
            life: 0.75,
            rise: 26,
          }),
        );
      }
      if (def === this.human || attacker === this.human) this.haptics?.hit();
    }
  }

  // ---- Specials --------------------------------------------------------
  _castSpecial(f, spec) {
    switch (spec.type) {
      case 'projectile':
        this.projectiles.push(new Projectile(f, spec));
        break;
      case 'multishot': {
        // Fan of arrows spread across depth.
        for (const dz of [-90, 0, 90]) {
          const p = new Projectile(f, spec);
          p.vz = dz;
          this.projectiles.push(p);
        }
        break;
      }
      case 'aoe':
        this._doAOE(f, spec);
        break;
      case 'uppercut':
        this._doUppercut(f, spec);
        break;
      case 'rush':
        f._dash = { time: 0.22, spec, hits: new Set() };
        f.invuln = 0.25;
        f.vx = f.facing * spec.speed;
        dustFx(this.effects, this.view.screenX(f.x), this.view.screenY(f.x, f.z, f.y), 'dash', { size: f.width * 3, life: 0.35, flip: f.facing < 0, rise: 4 });
        dust(this.effects, this.view.screenX(f.x), this.view.screenY(f.x, f.z, f.y), 6);
        break;
      default:
        break;
    }
  }

  // Pick a slash-arc color from the attacker's accent hue.
  _slashName(f) {
    const hex = (f.char?.accent || '#ffffff').replace('#', '');
    const r = parseInt(hex.slice(0, 2), 16) || 255;
    const g = parseInt(hex.slice(2, 4), 16) || 255;
    const b = parseInt(hex.slice(4, 6), 16) || 255;
    if (Math.max(r, g, b) - Math.min(r, g, b) < 42) return 'white';
    if (r >= g && r >= b) return b > 150 ? 'void' : 'fire';
    if (g >= r && g >= b) return 'green';
    return b > 150 && r > 120 ? 'void' : 'blue';
  }

  _doAOE(f, spec) {
    const view = this.view;
    const sx = view.screenX(f.x);
    const sy = view.floorLine(f.z);
    // painted shockwave ring on the ground + spark particles
    impactFx(this.effects, sx, sy - 6, 'shockwave', { size: spec.radius * 2.6, life: 0.34, startScale: 0.4, grow: 0.9 });
    // shockwave visual
    for (let i = 0; i < 22; i += 1) {
      const ang = (i / 22) * Math.PI * 2;
      this.effects.push(
        new Particle(sx, sy, {
          color: spec.color,
          vx: Math.cos(ang) * spec.radius * 2.2,
          vy: -Math.abs(Math.sin(ang)) * 200 - 60,
          gravity: 800,
          size: 6,
          life: 0.5,
        }),
      );
    }
    for (const def of this.fighters) {
      if (def.team === f.team || !def.alive) continue;
      const d = Math.hypot(def.x - f.x, (def.z - f.z) * 1.4);
      if (d < spec.radius && def.grounded) {
        const dir = def.x >= f.x ? 1 : -1;
        this._applyHit(f, def, spec.damage, { knockback: spec.knockback, dir });
      }
    }
  }

  _doUppercut(f, spec) {
    f.vy = 420; // hop with the attack
    for (const def of this.fighters) {
      if (def.team === f.team || !def.alive) continue;
      const dx = (def.x - f.x) * f.facing;
      if (dx > -def.width * 0.5 && dx < f.char.reach + 30 && Math.abs(def.z - f.z) < 40) {
        this._applyHit(f, def, spec.damage, { knockback: spec.knockback, launch: spec.launch, dir: f.facing });
      }
    }
  }

  _processDash(f, dt) {
    f._dash.time -= dt;
    for (const def of this.fighters) {
      if (def.team === f.team || !def.alive || f._dash.hits.has(def.id)) continue;
      if (Math.abs(def.x - f.x) < def.width * 0.6 + f.width * 0.6 && Math.abs(def.z - f.z) < 36) {
        f._dash.hits.add(def.id);
        this._applyHit(f, def, f._dash.spec.damage, {
          knockback: f._dash.spec.knockback,
          dir: f.facing,
        });
      }
    }
    if (f._dash.time <= 0) {
      f.vx *= 0.3;
      f._dash = null;
    }
  }

  // ---- Round flow ------------------------------------------------------
  _checkRoundOver(dt) {
    if (this.roundOver) {
      this.overTimer -= dt;
      if (this.overTimer <= 0 && !this._reported) {
        this._reported = true;
        this._reportResult();
      }
      return;
    }
    const teamsAlive = new Set();
    for (const f of this.fighters) if (f.alive) teamsAlive.add(f.team);
    if (teamsAlive.size <= 1) {
      this.roundOver = true;
      this.overTimer = 1.6;
      this._winnerTeam = teamsAlive.values().next().value ?? null;
      // Cinematic finish: brief slow-motion + banner.
      this._slowmo = 1.0;
      this.addShake(14);
      const flawless = this._winnerTeam != null && this._winnerTeam === this.human?.team && this.human?.alive && !this._humanTookDamage;
      this.cb.onAnnounce?.(flawless ? 'PERFECT' : 'K.O.!', 'ko');
    }
  }

  _onFighterKO(f) {
    if (!this.eliminationOrder.includes(f)) this.eliminationOrder.push(f);
    this.addShake(12);
    this.hitStop = Math.max(this.hitStop, 0.08);
    // impact burst: a ring of sparks around the body + a dust kick at the feet
    const sx = this.view.screenX(f.x);
    const gy = this.view.floorLine(f.z);
    const cy = gy - f.height * this.view.scale(f.z) * 0.5;
    const color = (f.char.special && f.char.special.color) || f.char.accent || '#ffd23b';
    for (let i = 0; i < 10; i += 1) {
      const a = (i / 10) * Math.PI * 2;
      spark(this.effects, sx + Math.cos(a) * 8, cy + Math.sin(a) * 8, color);
    }
    dust(this.effects, sx, gy, 14);
  }

  _reportResult() {
    const humanTeam = this.human?.team ?? 0;
    const playerWon = this._winnerTeam === humanTeam && this.human?.alive;
    const ranking = this._teamsMode ? this._buildTeamRanking() : this._buildSoloRanking();

    this.cb.onRoundOver?.({
      win: !!playerWon,
      winnerTeam: this._winnerTeam,
      time: this.elapsed,
      teams: this._teamsMode,
      ranking,
      bestCombo: this._humanBestCombo,
      koDealt: this._humanKOs,
    });
  }

  // Fighters, best-first: survivors, then the fallen in reverse KO order.
  _survivalOrder() {
    const survivors = this.fighters.filter((f) => f.alive);
    const ordered = [...survivors, ...[...this.eliminationOrder].reverse()];
    const seen = new Set();
    const out = [];
    for (const f of ordered) {
      if (seen.has(f.id)) continue;
      seen.add(f.id);
      out.push(f);
    }
    // any fighter never referenced (safety)
    for (const f of this.fighters) if (!seen.has(f.id)) out.push(f);
    return out;
  }

  _buildSoloRanking() {
    return this._survivalOrder().map((f, i) => ({
      place: i + 1,
      isTeam: false,
      name: f.displayName,
      members: [{ name: f.displayName, char: f.char.id, charName: f.char.name, isHuman: f.isHuman }],
      char: f.char.id,
      charName: f.char.name,
      teamColor: f.teamColor,
      isHuman: f.isHuman,
      containsHuman: f.isHuman,
      alive: f.alive,
    }));
  }

  _buildTeamRanking() {
    const order = this._survivalOrder(); // best-first fighters
    // Group into teams, keeping members in survival order. A team's rank is
    // decided by its best-placed member (last team standing wins).
    const teams = new Map();
    order.forEach((f, i) => {
      if (!teams.has(f.team)) {
        teams.set(f.team, { team: f.team, teamColor: f.teamColor, rankKey: i, members: [] });
      }
      teams.get(f.team).members.push(f);
    });

    const sorted = [...teams.values()].sort((a, b) => a.rankKey - b.rankKey);
    return sorted.map((t, i) => ({
      place: i + 1,
      isTeam: true,
      team: t.team,
      teamColor: t.teamColor,
      name: `Team ${t.team + 1}`,
      alive: t.members.some((f) => f.alive),
      containsHuman: t.members.some((f) => f.isHuman),
      members: t.members.map((f) => ({
        name: f.displayName,
        char: f.char.id,
        charName: f.char.name,
        isHuman: f.isHuman,
        alive: f.alive,
      })),
    }));
  }

  _emitHud() {
    if (!this.cb.onHud) return;
    this.cb.onHud(
      this.fighters.map((f) => ({
        id: f.id,
        name: f.displayName,
        char: f.char.name,
        color: f.char.color,
        team: f.team,
        teamColor: f.teamColor,
        hp: f.hp,
        maxHp: f.maxHp,
        mp: f.mp,
        maxMp: f.maxMp,
        alive: f.alive,
        isHuman: f.isHuman,
        rage: f.rage,
      })),
    );
  }

  // ---- Rendering -------------------------------------------------------
  _render() {
    const ctx = this.ctx;
    const w = this.vw;
    const h = this.vh;

    const shaking = this.shake > 0.4;
    if (shaking) {
      // dark backing so the shifted scene never reveals stale pixels at edges
      ctx.fillStyle = '#05060c';
      ctx.fillRect(0, 0, w, h);
      ctx.save();
      ctx.translate((Math.random() * 2 - 1) * this.shake, (Math.random() * 2 - 1) * this.shake);
    }
    this._drawArena(ctx, w, h);

    // depth sort fighters + projectiles
    const drawables = [
      ...this.fighters.map((f) => ({ z: f.z, r: (c) => f.render(c, this.view) })),
      ...this.projectiles.map((p) => ({ z: p.z, r: (c) => p.render(c, this.view) })),
      ...this.items.map((it) => ({ z: it.z - 0.1, r: (c) => it.render(c, this.view) })),
    ].sort((a, b) => a.z - b.z);
    for (const d of drawables) d.r(ctx);

    for (const e of this.effects) e.render(ctx);
    if (shaking) ctx.restore();

    // depth vignette: gently darkens the screen edges to focus on the action
    if (!this._vignette || this._vignette.w !== w || this._vignette.h !== h) {
      const vg = ctx.createRadialGradient(
        w / 2, h * 0.52, Math.min(w, h) * 0.32,
        w / 2, h * 0.52, Math.max(w, h) * 0.72,
      );
      vg.addColorStop(0, 'rgba(0,0,0,0)');
      vg.addColorStop(1, 'rgba(4,6,14,0.36)');
      this._vignette = { grad: vg, w, h };
    }
    ctx.fillStyle = this._vignette.grad;
    ctx.fillRect(0, 0, w, h);
  }

  _drawArena(ctx, w, h) {
    const arena = this.arena || getArena('forest');
    if (arena.bgImage) {
      ctx.drawImage(arena.bgImage, 0, 0, w, h);
      return;
    }
    // The procedural arenas fill a dozen gradients per draw. Render the scene
    // ONCE into an offscreen canvas and just blit it every frame — this was the
    // biggest per-frame cost and the main cause of stutter on slower machines.
    const cache = this._arenaCache;
    if (!cache || cache.w !== w || cache.h !== h || cache.id !== arena.id) {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const off = (cache && cache.canvas) || document.createElement('canvas');
      off.width = Math.max(1, Math.floor(w * dpr));
      off.height = Math.max(1, Math.floor(h * dpr));
      const octx = off.getContext('2d');
      octx.setTransform(dpr, 0, 0, dpr, 0, 0);
      arena.draw(octx, {
        w,
        h,
        floorTopY: this.floorTopY,
        floorBottomY: this.floorBottomY,
        floorLine: (z) => this.floorLine(z),
        ARENA_DEPTH,
        time: this.elapsed,
      });
      this._arenaCache = { canvas: off, w, h, id: arena.id };
    }
    ctx.drawImage(this._arenaCache.canvas, 0, 0, w, h);
  }

  // ---- Controls --------------------------------------------------------
  pause() {
    this.paused = true;
  }

  resume() {
    if (!this.running) return;
    this.paused = false;
    this.lastTime = performance.now();
  }

  stop() {
    this.running = false;
    this.paused = false;
    cancelAnimationFrame(this._raf);
    this._reported = false;
  }
}
