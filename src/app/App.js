import { GameEngine } from '../game/GameEngine.js';
import { bindHumanControls } from '../game/input.js';
import {
  CHARACTERS,
  getCharacter,
  SPECIAL_SLOTS,
  STARTER_IDS,
  LOCKED_CHARACTERS,
  PREMIUM_CHARACTERS,
} from '../game/characters.js';
import { IAP, REMOVE_ADS_ID, ALL_CHARACTERS_ID, ARENA_PACK_ID } from '../services/purchasesConfig.js';
import { STAGES } from '../game/enemies.js';
import { MODES, DIFFICULTY, TEAM_COLORS } from '../game/constants.js';
import { ARENAS, ARENA_MAP, loadArenaImages, isPremiumArena } from '../game/arenas.js';
import { makePortraitCanvas } from '../game/portraits.js';
import {
  loadAllSprites,
  loadPortraits,
  getSpriteSet,
  drawSpritePortrait,
  drawPaintedPortrait,
  getPortraitImage,
  getLockedPortraitImage,
} from '../game/sprites.js';
import { StorageService } from '../services/StorageService.js';
import { MultiplayerService } from '../services/MultiplayerService.js';
import { t, tpl, getLang, setLang, attachTranslator, retranslate } from '../i18n.js';

export class App {
  constructor(root, { audio, haptics, ads, purchases }) {
    this.root = root;
    this.audio = audio;
    this.haptics = haptics;
    this.ads = ads || { showBanner() {}, hideBanner() {}, onMatchFinished() {} };
    this.purchases = purchases || {
      owns: () => false,
      ownsRemoveAds: () => false,
      ownsCharacter: () => true,
      ownedCharacterIds: () => [],
      priceFor: () => '',
      buy: async () => ({ ok: false, error: 'unavailable' }),
      restore: async () => ({ ok: true, restored: 0 }),
      onChange: () => () => {},
      storeAvailable: true,
    };
    this.settings = null;
    this.stats = null;
    this.profile = null;
    this.engine = null;
    this.state = 'menu';
    this.unbindControls = null;
    this.mp = null;

    this.selection = {
      character: 'blaze',
      mode: 'oneVsOne',
      difficulty: 2,
      opponents: 1,
      arena: 'forest',
      teamAssign: [0, 1], // per-fighter team index (index 0 = player)
    };
  }

  async init() {
    this.settings = await StorageService.getSettings();
    this.stats = await StorageService.getStats();
    this.profile = await StorageService.getProfile();
    await loadAllSprites();
    await loadPortraits();
    await loadArenaImages();
    // XP / unlocked roster (merge starters + purchased premium fighters).
    this.xp = this.profile.xp || 0;
    this.unlocked = new Set([
      ...(this.profile.unlocked || []),
      ...STARTER_IDS,
      ...this.purchases.ownedCharacterIds(),
    ]);
    // Re-sync unlocks + refresh the storefront whenever an entitlement changes
    // (e.g. a restore resolves after launch).
    this.purchases.onChange?.(() => {
      for (const id of this.purchases.ownedCharacterIds()) this.unlocked.add(id);
      if (this.state === 'store') this.buildStore();
      if (this.state === 'setup') this.buildSetup();
    });
    const lastOk =
      CHARACTERS.some((c) => c.id === this.profile.lastCharacter) &&
      this.unlocked.has(this.profile.lastCharacter);
    this.selection.character = lastOk ? this.profile.lastCharacter : 'blaze';
    // On web there is no Store/IAP, so premium fighters must never be playable —
    // reset a stale premium pick that an old profile may still carry.
    if (!this._premiumEnabled() && PREMIUM_CHARACTERS.some((c) => c.id === this.selection.character)) {
      this.selection.character = 'blaze';
    }
    this.selection.mode = this.profile.lastMode || 'oneVsOne';
    this.selection.difficulty = this.profile.lastDifficulty || 2;
    this.selection.arena = this.profile.lastArena || 'forest';

    this.audio.setEnabled(this.settings.sound, this.settings.music);
    this.audio.setVolume(this.settings.volume ?? 0.8);
    this.haptics.setEnabled(this.settings.haptics);

    // Language must be set before the first render so the observer can translate it.
    setLang(this.profile.lang || 'en');
    attachTranslator(this.root);

    this.render();
    retranslate(this.root);
    this.showScreen('menu');
    if (this.settings.music) this.audio.startMusic();

    window.addEventListener('brawl-back', () => this.handleBack());
    this._bindLifecycle();
    window.addEventListener('resize', () => {
      if (this.state === 'game') this.engine?.resize();
      else if (this.state === 'menu') this.drawMenuScene();
    });
  }

  // ------------------------------------------------------------------ render
  render() {
    this.root.innerHTML = `
      <div id="screen-menu" class="screen menu">
        <canvas id="menu-canvas" class="menu-canvas"></canvas>
        <div class="menu-scrim"></div>
        <div class="menu-content">
          <img class="menu-badge" src="/icons/icon-192.png?v=3" alt="" width="88" height="88" />
          <h1 class="logo">BRAWL<span>ARENA</span></h1>
          <p class="tagline">Pick a fighter. Own the arena.</p>
          <div class="btn-row col menu-buttons">
            <button class="btn btn-primary" data-action="campaign">Solo Campaign</button>
            <button class="btn btn-secondary" data-action="setup">Arcade</button>
            <button class="btn btn-secondary" data-action="multiplayer">Multiplayer</button>
            ${this._premiumEnabled() ? '<button class="btn btn-ghost" data-action="store">Store</button>' : ''}
            <button class="btn btn-ghost" data-action="howto">How to Play</button>
            <button class="btn btn-ghost" data-action="settings">Settings</button>
          </div>
        </div>
        <p class="footer-note">${
          this._isNative()
            ? ''
            : '<a href="/about.html" class="foot-link" target="_blank" rel="noopener">About</a> · <a href="/privacy.html" class="foot-link" target="_blank" rel="noopener">Privacy</a>'
        }</p>
      </div>

      <div id="screen-setup" class="screen setup hidden">
        <div class="setup-head">
          <button class="icon-btn" data-action="menu">‹</button>
          <h2>Choose Your Fighter</h2>
        </div>
        <div class="xp-bar" id="xp-bar"></div>
        <div class="char-grid" id="char-grid"></div>
        <div class="char-detail" id="char-detail"></div>
        <div class="opt-block">
          <label class="opt-label">Mode</label>
          <div class="chip-row" id="mode-row"></div>
        </div>
        <div class="opt-block" id="opponents-block">
          <label class="opt-label">Opponents</label>
          <div class="chip-row" id="opponents-row"></div>
        </div>
        <div class="opt-block" id="teams-block">
          <label class="opt-label">Teams <span class="opt-hint">tap a colour per fighter</span>
            <button class="chip chip-sm" id="teams-random" type="button">🎲 Random</button>
          </label>
          <div class="team-assign" id="team-assign"></div>
        </div>
        <div class="opt-block">
          <label class="opt-label">Difficulty</label>
          <div class="chip-row" id="diff-row"></div>
        </div>
        <div class="opt-block">
          <label class="opt-label">Arena</label>
          <div class="chip-row" id="arena-row"></div>
        </div>
        <button class="btn btn-primary btn-fight" data-action="fight">FIGHT!</button>
      </div>

      <div id="screen-campaign" class="screen setup hidden">
        <div class="setup-head">
          <button class="icon-btn" data-action="menu">‹</button>
          <h2>Solo Campaign</h2>
        </div>
        <p class="camp-intro">Fight through 5 stages of Bruisers and Mages to the Gang Leader's throne.</p>
        <div class="opt-block">
          <label class="opt-label">Fighter</label>
          <div class="camp-fighters" id="camp-fighters"></div>
        </div>
        <div class="opt-block">
          <label class="opt-label">Difficulty</label>
          <div class="chip-row" id="camp-diff"></div>
        </div>
        <div class="opt-block">
          <label class="opt-label">Stages</label>
          <div class="stage-list" id="stage-list"></div>
        </div>
      </div>

      <div id="screen-game" class="screen game-screen hidden">
        <canvas id="game-canvas" class="game-canvas"></canvas>
        <div class="hud" id="hud"></div>
        <div class="stage-indicator hidden" id="stage-indicator"></div>
        <div class="announce" id="announce"></div>
        <button class="pause-btn" data-action="pause">❚❚</button>

        <div class="controls" id="controls">
          <div class="joystick" id="joystick">
            <div class="joystick-knob" id="joystick-knob"></div>
          </div>
          <div class="action-cluster">
            <button class="act-btn act-special" data-btn="special">SP</button>
            <button class="act-btn act-jump" data-btn="jump">▲</button>
            <button class="act-btn act-defend" data-btn="defend">DEF</button>
            <button class="act-btn act-attack" data-btn="attack">HIT</button>
            <button class="act-btn act-throw hidden" data-btn="throw" id="throw-btn">THROW</button>
          </div>
        </div>

        <div id="pause-overlay" class="overlay hidden">
          <h2 class="overlay-title">Paused</h2>
          <div class="btn-row col">
            <button class="btn btn-primary" data-action="resume">Resume</button>
            <button class="btn btn-ghost" data-action="quit">Quit to Menu</button>
          </div>
        </div>

        <div id="result-overlay" class="overlay hidden">
          <h2 class="overlay-title" id="result-title">Victory</h2>
          <p class="overlay-meta" id="result-meta"></p>
          <div class="result-xp" id="result-xp"></div>
          <div class="podium" id="result-podium"></div>
          <div class="btn-row col">
            <button class="btn btn-primary" data-action="rematch">Rematch</button>
            <button class="btn btn-secondary" data-action="setup">Change Fighter</button>
            <button class="btn btn-ghost" data-action="quit">Main Menu</button>
          </div>
        </div>
      </div>

      <div id="screen-multiplayer" class="screen mp hidden">
        <div class="setup-head">
          <button class="icon-btn" data-action="menu">‹</button>
          <h2>Multiplayer</h2>
        </div>
        <div id="mp-body"></div>
      </div>

      <div id="screen-howto" class="screen howto hidden">
        <div class="setup-head">
          <button class="icon-btn" data-action="menu">‹</button>
          <h2>How to Play</h2>
        </div>
        <div class="howto-body">
          <div class="howto-card"><b>Move</b><span>Left joystick — up/down also shifts depth on the floor.</span></div>
          <div class="howto-card"><b>HIT</b><span>Light melee combo. Chain them and back off.</span></div>
          <div class="howto-card"><b>▲ Jump</b><span>Hop over projectiles and juggle airborne foes.</span></div>
          <div class="howto-card"><b>DEF</b><span>Guard to soak hits — you can't move while blocking.</span></div>
          <div class="howto-card special"><b>SP · Neutral</b><span>Tap <b>SP</b> for your signature move (costs the blue energy bar).</span></div>
          <div class="howto-card special"><b>SP · Dash</b><span>Double-tap <b>forward</b>, then <b>SP</b> — a charging attack.</span></div>
          <div class="howto-card special"><b>SP · Air</b><span>Press <b>Jump</b>, then <b>SP</b> in the air for a launcher.</span></div>
          <div class="howto-card"><b>Weapons</b><span>Stand over an item and press <b>HIT</b> to pick it up. <b>THROW</b> hurls it; each weapon has limited swings.</span></div>
          <div class="howto-card" id="howto-desktop"><b>Keyboard</b><span>Arrows move · <b>Enter</b> or <b>.</b> hit · <b>/</b> special · Space jump · Right-Shift block · <b>,</b> throw. (Left hand: WASD + J/K/L/T also work.)</span></div>
        </div>
        <button class="btn btn-secondary" data-action="menu">Got it</button>
      </div>

      <div id="screen-store" class="screen store hidden">
        <div class="setup-head">
          <button class="icon-btn" data-action="menu">‹</button>
          <h2>Store</h2>
        </div>
        <div class="store-body" id="store-body"></div>
        <button class="btn btn-ghost btn-restore" data-action="restore">Restore Purchases</button>
      </div>

      <div id="screen-settings" class="screen settings hidden">
        <div class="setup-head">
          <button class="icon-btn" data-action="menu">‹</button>
          <h2>Settings</h2>
        </div>
        <div class="settings-group">
          <div class="setting-row"><span>Fighter Name</span>
            <input id="player-name" class="name-input" maxlength="12"
              value="${(this.profile?.name || 'Player').replace(/"/g, '')}" /></div>
          <div class="setting-row"><span>Master Volume</span>
            <input id="volume-slider" class="slider" type="range" min="0" max="100"
              value="${Math.round((this.settings?.volume ?? 0.8) * 100)}" /></div>
          <div class="setting-row"><span>Sound Effects</span>
            <button class="toggle ${this.settings?.sound ? 'on' : ''}" data-toggle="sound"></button></div>
          <div class="setting-row"><span>Music</span>
            <button class="toggle ${this.settings?.music ? 'on' : ''}" data-toggle="music"></button></div>
          <div class="setting-row"><span>Haptics</span>
            <button class="toggle ${this.settings?.haptics ? 'on' : ''}" data-toggle="haptics"></button></div>
          <div class="setting-row"><span>Reduce Motion<small>Turns off screen shake</small></span>
            <button class="toggle ${this.settings?.reduceMotion ? 'on' : ''}" data-toggle="reduceMotion"></button></div>
          <div class="setting-row"><span>Language</span>
            <div class="seg lang-seg">
              <button data-lang="en" class="${getLang() === 'en' ? 'on' : ''}">EN</button>
              <button data-lang="he" class="${getLang() === 'he' ? 'on' : ''}">עברית</button>
            </div></div>
        </div>
        <div class="stats-block" id="stats-block"></div>
        <button class="btn btn-secondary" data-action="menu">Back</button>
        <button class="btn btn-danger" id="reset-progress">Reset Progress</button>
      </div>
    `;

    this.bindEvents();
    this.buildSetup();
  }

  bindEvents() {
    this.root.addEventListener('click', (e) => {
      const action = e.target.closest('[data-action]')?.dataset.action;
      if (action) this.handleAction(action);
      const toggle = e.target.closest('[data-toggle]')?.dataset.toggle;
      if (toggle) this.toggleSetting(toggle, e.target.closest('[data-toggle]'));
      const langBtn = e.target.closest('[data-lang]')?.dataset.lang;
      if (langBtn) this.switchLanguage(langBtn);
    });

    const volume = this.root.querySelector('#volume-slider');
    volume?.addEventListener('input', (e) => {
      const v = Number(e.target.value) / 100;
      this.audio.setVolume(v);
      this.settings.volume = v;
    });
    volume?.addEventListener('change', () => {
      this.audio.select?.();
      StorageService.saveSettings(this.settings);
    });

    const name = this.root.querySelector('#player-name');
    const commitName = () => {
      const val = (name.value || '').trim().slice(0, 12) || 'Player';
      name.value = val;
      if (val !== this.profile.name) {
        this.profile.name = val;
        StorageService.saveProfile({ name: val });
      }
    };
    name?.addEventListener('change', commitName);
    name?.addEventListener('blur', commitName);

    this.root.querySelector('#reset-progress')?.addEventListener('click', () => this.confirmReset());
  }

  handleAction(action) {
    this.audio.select?.();
    this.haptics.tap();
    switch (action) {
      case 'setup': this.showScreen('setup'); break;
      case 'campaign': this.showCampaign(); break;
      case 'menu': this.goMenu(); break;
      case 'multiplayer': this.showMultiplayer(); break;
      case 'store': this.showStore(); break;
      case 'restore': this.restorePurchases(); break;
      case 'howto': this.showHowto(); break;
      case 'settings': this.showSettings(); break;
      case 'fight': this.startGame(); break;
      case 'pause': this.pauseGame(); break;
      case 'resume': this.resumeGame(); break;
      case 'rematch':
        this._maybeInterstitial();
        if (this._mode === 'campaign') this.startCampaign(this.campaignStartStage || 0);
        else if (this._mode === 'multiplayer') this.quitGame(); // no local rematch online
        else this.startGame();
        break;
      case 'quit':
        this._maybeInterstitial();
        this.quitGame();
        break;
      default: break;
    }
  }

  showScreen(name) {
    this.state = name;
    this.root.querySelectorAll('.screen').forEach((el) => el.classList.add('hidden'));
    this.root.querySelector(`#screen-${name}`)?.classList.remove('hidden');
    if (name === 'menu') requestAnimationFrame(() => this.drawMenuScene());
  }

  /**
   * Paints the main-menu backdrop: a real arena scene with two of our fighters
   * posed on pedestals, then a scrim (via CSS) keeps the buttons readable.
   */
  drawMenuScene() {
    const canvas = this.root.querySelector('#menu-canvas');
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    if (!w || !h) return;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Hand-painted "Elements of War" splash as the opening backdrop.
    const splash = this._menuSplashImg;
    if (splash && splash.complete && splash.naturalWidth) {
      const s = Math.max(w / splash.naturalWidth, h / splash.naturalHeight);
      const dw = splash.naturalWidth * s;
      const dh = splash.naturalHeight * s;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(splash, (w - dw) / 2, (h - dh) / 2, dw, dh);
      // Darken the lower half so the logo + buttons stay readable.
      const grad = ctx.createLinearGradient(0, h * 0.4, 0, h);
      grad.addColorStop(0, 'rgba(6,8,20,0)');
      grad.addColorStop(1, 'rgba(6,8,20,0.85)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, h * 0.4, w, h * 0.6);
      return;
    }
    if (!this._menuSplashImg) {
      const im = new Image();
      im.onload = () => { if (this.state === 'menu') this.drawMenuScene(); };
      im.src = `${import.meta.env.BASE_URL || '/'}ui/menu-splash.png?v=9`;
      this._menuSplashImg = im;
    }

    const floorTopY = h * 0.5;
    const floorBottomY = h * 0.98;
    const DEPTH = 200;
    const floorLine = (z) => floorTopY + (floorBottomY - floorTopY) * (z / DEPTH);
    // Dedicated warm dusk backdrop so the menu always looks its best,
    // independent of which arena is selected for a match.
    this._drawMenuBackdrop(ctx, w, h, floorTopY);

    // A small lineup of fighters posed along the floor (kept modest in size so
    // the sprites stay crisp rather than blown up and pixelated). Two per side
    // leaves the centre clear for the logo + buttons.
    const roster = this._menuRoster();
    // x fraction, facing, depth (0..1 back->front → size), for up to 4 slots.
    const slots = [
      { x: 0.1, face: 1, depth: 1.0 },
      { x: 0.28, face: 1, depth: 0.82 },
      { x: 0.72, face: -1, depth: 0.82 },
      { x: 0.9, face: -1, depth: 1.0 },
    ];
    roster.forEach((id, i) => {
      const s = slots[i];
      if (!s) return;
      const z = 120 + (1 - s.depth) * 70;
      const targetH = h * 0.19 * (0.82 + s.depth * 0.18);
      this._drawShowcase(ctx, id, w * s.x, floorLine(z), targetH, s.face);
    });
  }

  /** Warm dusk scene: sky gradient, layered mountains, embers, contour ground. */
  _drawMenuBackdrop(ctx, w, h, horizon) {
    ctx.fillStyle = '#140a10';
    ctx.fillRect(0, 0, w, h);
    const g = ctx.createLinearGradient(0, 0, 0, horizon + h * 0.15);
    g.addColorStop(0, '#140a10');
    g.addColorStop(0.55, '#40201a');
    g.addColorStop(0.85, '#8a4020');
    g.addColorStop(1, '#b5561f');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, horizon + h * 0.15);

    // distant mountain layers
    const mountains = (baseY, height, color, count) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(0, baseY);
      const step = w / count;
      for (let i = 0; i <= count; i += 1) {
        const peak = baseY - height * (0.5 + ((i * 37) % 10) / 10);
        ctx.lineTo(i * step - step / 2, baseY);
        ctx.lineTo(i * step, peak);
        ctx.lineTo(i * step + step / 2, baseY);
      }
      ctx.lineTo(w, baseY);
      ctx.closePath();
      ctx.fill();
    };
    mountains(horizon, h * 0.16, 'rgba(30,14,16,0.65)', 5);
    mountains(horizon + 4, h * 0.1, 'rgba(20,10,12,0.85)', 7);

    // ground
    const ground = ctx.createLinearGradient(0, horizon, 0, h);
    ground.addColorStop(0, '#2a1510');
    ground.addColorStop(1, '#0e0708');
    ctx.fillStyle = ground;
    ctx.fillRect(0, horizon, w, h - horizon);

    // topographic contour curves on the ground
    ctx.strokeStyle = 'rgba(255,150,80,0.06)';
    ctx.lineWidth = 2;
    for (let i = 1; i <= 6; i += 1) {
      const y = horizon + ((h - horizon) * i) / 7;
      ctx.beginPath();
      for (let x = 0; x <= w; x += 12) {
        const yy = y + Math.sin((x / w) * Math.PI * 3 + i) * 6;
        if (x === 0) ctx.moveTo(x, yy);
        else ctx.lineTo(x, yy);
      }
      ctx.stroke();
    }

    // floating embers (static seeded positions, redrawn only on show/resize)
    for (let i = 0; i < 42; i += 1) {
      const ex = (Math.sin(i * 12.9898) * 43758.5453) % 1;
      const ey = (Math.sin(i * 78.233) * 12543.322) % 1;
      const x = Math.abs(ex) * w;
      const y = Math.abs(ey) * h * 0.85;
      const r = 0.8 + (Math.abs(ex) * 2.2);
      ctx.fillStyle = `rgba(255,${140 + Math.floor(Math.abs(ey) * 80)},60,${0.25 + Math.abs(ex) * 0.4})`;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /**
   * A curated, visually-distinct hero lineup for the menu (blue caster, ninja,
   * green mage, knight). Every pick must have a real full-body sprite so we
   * never fall back to the cropped portrait bust (which looked "halved").
   */
  _menuRoster() {
    const preferred = ['onyx', 'kaito', 'maya', 'leon'];
    const hasSprite = (id) => !!getSpriteSet(getCharacter(id).spriteBase || id);
    const lineup = preferred.filter(hasSprite);
    // Backfill with any other sprite-backed character if a preferred one is missing.
    for (const c of CHARACTERS) {
      if (lineup.length >= 4) break;
      if (!lineup.includes(c.id) && hasSprite(c.id)) lineup.push(c.id);
    }
    return lineup.slice(0, 4);
  }

  _drawShowcase(ctx, charId, cx, groundY, targetH, facing) {
    const char = getCharacter(charId);
    const set = getSpriteSet(char.spriteBase || char.id);
    // No full-body sprite → skip rather than drawing a cropped bust that reads
    // as a "halved" figure in a dark box.
    if (!set) return;
    const idle = set.def.animations.idle.frames[0];
    const frame = set.frame(idle);
    // Never upscale past native resolution — upscaling pixel-art sprites is
    // exactly what makes them look blocky/pixelated. We render at 1:1 (or
    // smaller) so the art stays crisp, and size the pedestal to match.
    const k = Math.min(targetH / frame.h, 1);
    const actualH = frame.h * k;
    this._drawPedestal(ctx, cx, groundY, actualH * 0.4);
    const flip = set.def.faceRight ? facing < 0 : facing > 0;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    if (char.tint) ctx.filter = `hue-rotate(${char.tint}deg) saturate(1.25)`;
    set.drawScaled(ctx, idle, cx, groundY - 4, k, flip);
    if (char.tint) ctx.filter = 'none';
  }

  /** A small rocky platform under a showcase fighter (menu). */
  _drawPedestal(ctx, cx, groundY, r) {
    ctx.save();
    // soft shadow
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(cx, groundY + r * 0.18, r * 1.15, r * 0.32, 0, 0, Math.PI * 2);
    ctx.fill();
    // rock body (trapezoid)
    const top = groundY - r * 0.16;
    const bot = groundY + r * 0.26;
    const rockL = ctx.createLinearGradient(0, top, 0, bot);
    rockL.addColorStop(0, '#6b4a30');
    rockL.addColorStop(1, '#38251a');
    ctx.fillStyle = rockL;
    ctx.beginPath();
    ctx.moveTo(cx - r, top);
    ctx.lineTo(cx + r, top);
    ctx.lineTo(cx + r * 0.78, bot);
    ctx.lineTo(cx - r * 0.78, bot);
    ctx.closePath();
    ctx.fill();
    // lit top face
    ctx.fillStyle = '#8a6440';
    ctx.beginPath();
    ctx.ellipse(cx, top, r, r * 0.24, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,190,120,0.25)';
    ctx.beginPath();
    ctx.ellipse(cx, top, r * 0.82, r * 0.17, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  goMenu() {
    if (this.mp) {
      this.mp.leave();
      this.mp = null;
    }
    this.showScreen('menu');
    if (this.settings.music) this.audio.startMusic();
  }

  handleBack() {
    if (this.state === 'game') {
      const paused = !this.root.querySelector('#pause-overlay')?.classList.contains('hidden');
      const over = !this.root.querySelector('#result-overlay')?.classList.contains('hidden');
      if (over) this.quitGame();
      else if (paused) this.resumeGame();
      else this.pauseGame();
    } else if (this.state !== 'menu') {
      this.goMenu();
    }
  }

  // -------------------------------------------------------------- app lifecycle
  // Auto-pause the match and silence audio whenever the app loses focus (phone
  // call, app switch, screen lock, tab hidden). Prevents "I died while answering
  // a call" complaints and stops audio from playing in the background.
  _bindLifecycle() {
    window.addEventListener('brawl-appstate', (e) => {
      if (e.detail?.active) this._onForeground();
      else this._onBackground();
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this._onBackground();
      else this._onForeground();
    });
    window.addEventListener('pagehide', () => this._onBackground());
  }

  _onBackground() {
    if (this.state === 'game') this.pauseGame();
    this.audio.suspend();
  }

  _onForeground() {
    this.audio.resume();
    // Resume the menu/lobby soundtrack, but keep the match paused so the player
    // chooses when to jump back in.
    if (this.settings.music && this.state !== 'game') this.audio.startMusic();
  }

  // ------------------------------------------------------------- setup screen
  isUnlocked(id) {
    return this.unlocked?.has(id);
  }

  /**
   * Fighters the player may actually pick on this screen: unlocked AND — on the
   * web build, where the Store/IAP doesn't exist — never premium. This guards
   * every roster (arcade, campaign, multiplayer) even if a stale saved profile
   * still lists premium ids as "unlocked".
   */
  _pickableRoster() {
    return CHARACTERS.filter(
      (c) => this.isUnlocked(c.id) && (this._premiumEnabled() || !c.premium),
    );
  }

  _buildXpBar() {
    const el = this.root.querySelector('#xp-bar');
    if (!el) return;
    const next = LOCKED_CHARACTERS.find((c) => !this.isUnlocked(c.id));
    if (!next) {
      // Nothing is locked — hide the XP bar entirely (no note).
      el.innerHTML = '';
      el.classList.add('hidden');
      return;
    }
    el.classList.remove('hidden');
    const prev = [...LOCKED_CHARACTERS].reverse().find((c) => c.unlockXp <= next.unlockXp && this.isUnlocked(c.id));
    const base = prev ? prev.unlockXp : 0;
    const pct = Math.max(0, Math.min(100, ((this.xp - base) / (next.unlockXp - base)) * 100));
    el.innerHTML = `<div class="xp-info"><span class="xp-total">★ ${this.xp} XP</span>
      <span class="xp-next">Next: <b>${next.name}</b> at ${next.unlockXp} XP</span></div>
      <div class="xp-track"><b style="width:${pct}%"></b></div>`;
  }

  buildSetup() {
    const grid = this.root.querySelector('#char-grid');
    if (grid) {
      // Premium (purchasable) fighters only exist on native builds where the
      // Store / in-app billing is available. On web they're hidden entirely.
      const roster = CHARACTERS.filter((c) => this._premiumEnabled() || !c.premium);
      grid.innerHTML = roster.map((c) => {
        const locked = !this.isUnlocked(c.id);
        // Premium fighters show their portrait + price and open the Store on tap;
        // XP fighters stay hidden behind the classic "??? / 🔒 XP" tease.
        const premiumLocked = locked && c.premium;
        const lockAttr = premiumLocked ? 'data-premium="1"' : locked ? 'data-locked="1"' : '';
        // Show the real store price only if Google Play provided one; otherwise
        // just a premium star (no placeholder price shown up front).
        const premiumPrice = this.purchases.priceFor(c.productId);
        const lockTag = premiumLocked
          ? `<span class="char-lock premium">${premiumPrice ? `★ ${premiumPrice}` : '★'}</span>`
          : locked
            ? `<span class="char-lock">🔒 ${c.unlockXp} XP</span>`
            : '';
        return `
        <button class="char-card ${c.id === this.selection.character ? 'active' : ''} ${locked ? 'locked' : ''} ${premiumLocked ? 'premium' : ''}"
          data-char="${c.id}" ${lockAttr} style="--c:${c.color};--a:${c.accent}">
          <span class="char-portrait" data-portrait="${c.id}"></span>
          <span class="char-name">${locked && !c.premium ? '???' : c.name}</span>
          ${lockTag}
        </button>`;
      }).join('');
      grid.querySelectorAll('[data-portrait]').forEach((holder) => {
        const c = getCharacter(holder.dataset.portrait);
        // Premium fighters that aren't owned yet show their dark "locked" bust.
        const showLocked = c.premium && !this.isUnlocked(c.id);
        holder.appendChild(this.portraitCanvas(c, 160, showLocked));
        // If a purpose-made (already dark) locked bust is used, mark the card so
        // CSS skips the extra darken filter that would crush it to a black void.
        if (showLocked && getLockedPortraitImage(c.id)) {
          holder.closest('.char-card')?.classList.add('has-locked-art');
        }
      });
      grid.querySelectorAll('[data-char]').forEach((btn) => {
        btn.addEventListener('click', () => {
          if (btn.dataset.premium) {
            // Locked premium fighter — send the player to the Store.
            this.audio.select?.();
            this.haptics.tap();
            this.showStore();
            return;
          }
          if (btn.dataset.locked) {
            this.audio.block?.();
            this.haptics.tap();
            btn.classList.remove('shake');
            void btn.offsetWidth; // restart animation
            btn.classList.add('shake');
            return;
          }
          this.selection.character = btn.dataset.char;
          this.audio.select?.();
          this.haptics.tap();
          this.buildSetup();
        });
      });
    }

    this._buildXpBar();

    const detail = this.root.querySelector('#char-detail');
    if (detail) {
      const c = getCharacter(this.selection.character);
      detail.style.setProperty('--c', c.color);
      const moves = (c.specials || [c.special])
        .map((s) => {
          const slot = SPECIAL_SLOTS[s.slot] || SPECIAL_SLOTS.neutral;
          return `<div class="move-row">
            <span class="move-combo">${slot.label}</span>
            <span class="move-name">${s.name}</span>
            <span class="move-type">${s.type}</span>
          </div>`;
        })
        .join('');
      detail.innerHTML = `
        <div class="detail-main">
          <div class="detail-head"><b>${c.name}</b> <span>${c.tagline}</span></div>
          <p class="detail-arch">${c.archetype}</p>
          <div class="stat-bars">
            ${this.statBar('Health', c.maxHp, 200)}
            ${this.statBar('Speed', c.speed, 340)}
            ${this.statBar('Power', c.attackPower, 14)}
          </div>
          <div class="move-list"><span class="move-list-title">★ Special Moves</span>${moves}</div>
        </div>
        <span class="detail-portrait" data-portrait="${c.id}"></span>
      `;
      detail.querySelector('[data-portrait]')?.appendChild(this.portraitCanvas(c, 112));
    }

    this.buildChips('#mode-row', Object.values(MODES), this.selection.mode, (m) => {
      this.selection.mode = m.key;
      this.buildSetup();
    }, (m) => m.key, (m) => m.label);

    const mode = MODES[this.selection.mode];
    const oppBlock = this.root.querySelector('#opponents-block');
    if (oppBlock) {
      if (mode.maxOpponents > 1) {
        oppBlock.classList.remove('hidden');
        const max = mode.maxOpponents;
        this.selection.opponents = Math.min(this.selection.opponents, max);
        const counts = Array.from({ length: max }, (_, i) => ({ key: i + 1, label: `${i + 1} CPU` }));
        this.buildChips('#opponents-row', counts, this.selection.opponents, (o) => {
          this.selection.opponents = o.key;
          this.buildSetup();
        }, (o) => o.key, (o) => o.label);
      } else {
        oppBlock.classList.add('hidden');
      }
    }

    this._buildTeamAssign(mode);

    this.buildChips('#diff-row', [1, 2, 3].map((d) => DIFFICULTY[d]), this.selection.difficulty,
      (d) => { this.selection.difficulty = d.n; this.buildSetup(); },
      (d) => d.n, (d) => d.label,
      [1, 2, 3]);

    const arenaRow = this.root.querySelector('#arena-row');
    if (arenaRow) {
      // Premium arenas exist only on native (where the Store lives). On web
      // they're hidden entirely; on native, locked ones open the Store on tap.
      const arenas = ARENAS.filter((a) => this._premiumEnabled() || !a.premium);
      arenaRow.innerHTML = arenas
        .map((a) => {
          const arenaLocked = a.premium && !this.purchases.ownsArenas();
          return `<button class="chip arena-chip ${a.id === this.selection.arena ? 'active' : ''} ${arenaLocked ? 'locked' : ''}"
          data-arena="${a.id}" ${arenaLocked ? 'data-arena-premium="1"' : ''}><canvas class="arena-thumb" data-arena-thumb="${a.id}" width="96" height="58"></canvas>${a.name}${arenaLocked ? ' ★' : ''}</button>`;
        })
        .join('');
      // Paint a mini preview into each chip: the real painted art for premium
      // arenas, or a shrunk render of the procedural scene for the rest.
      arenaRow.querySelectorAll('[data-arena-thumb]').forEach((cv) => {
        const arena = ARENA_MAP[cv.dataset.arenaThumb];
        if (arena) this._renderArenaThumb(cv, arena);
      });
      arenaRow.querySelectorAll('[data-arena]').forEach((btn) => {
        btn.addEventListener('click', () => {
          if (btn.dataset.arenaPremium) {
            this.audio.select?.();
            this.haptics.tap();
            this.showStore();
            return;
          }
          this.selection.arena = btn.dataset.arena;
          this.audio.select?.();
          this.haptics.tap();
          this.buildSetup();
        });
      });
    }
  }

  /** Render a small arena preview into a chip canvas (image or procedural). */
  _renderArenaThumb(canvas, arena) {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    if (arena.bgImage) {
      // cover-fit the painted background into the thumbnail
      const img = arena.bgImage;
      const scale = Math.max(w / img.width, h / img.height);
      const dw = img.width * scale;
      const dh = img.height * scale;
      ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
    } else {
      // draw the procedural scene at thumbnail scale (horizon ~60%)
      try {
        arena.draw(ctx, { w, h, floorTopY: Math.round(h * 0.6), time: 0 });
      } catch {
        ctx.fillStyle = arena.swatch || '#444';
        ctx.fillRect(0, 0, w, h);
      }
    }
  }

  _buildTeamAssign(mode) {
    const block = this.root.querySelector('#teams-block');
    const wrap = this.root.querySelector('#team-assign');
    if (!block || !wrap) return;
    if (!mode.teams) {
      block.classList.add('hidden');
      return;
    }
    block.classList.remove('hidden');

    const total = this.selection.opponents + 1; // player + CPUs
    const maxTeams = total; // up to one team per fighter
    // Normalise the assignment array to the current fighter count.
    const assign = this.selection.teamAssign.slice(0, total);
    while (assign.length < total) assign.push(assign.length % 2);
    for (let i = 0; i < assign.length; i += 1) {
      if (assign[i] == null || assign[i] >= maxTeams) assign[i] = i % maxTeams;
    }
    this.selection.teamAssign = assign;

    const label = (i) => (i === 0 ? 'You' : `CPU ${i}`);
    const swatches = (p) =>
      Array.from({ length: maxTeams }, (_, t) => {
        const on = assign[p] === t ? 'on' : '';
        return `<button class="team-dot ${on}" data-p="${p}" data-t="${t}"
          style="--tc:${TEAM_COLORS[t % TEAM_COLORS.length]}" aria-label="Team ${t + 1}">${t + 1}</button>`;
      }).join('');

    wrap.innerHTML = Array.from({ length: total }, (_, p) => {
      const char = p === 0 ? getCharacter(this.selection.character) : null;
      const who = char ? `${label(p)} · ${char.name}` : label(p);
      return `<div class="team-row"><span class="team-who">${who}</span>
        <span class="team-dots">${swatches(p)}</span></div>`;
    }).join('');

    wrap.querySelectorAll('.team-dot').forEach((btn) => {
      btn.addEventListener('click', () => {
        const p = Number(btn.dataset.p);
        const t = Number(btn.dataset.t);
        this.selection.teamAssign[p] = t;
        this.audio.select?.();
        this.haptics.tap();
        this._buildTeamAssign(mode);
      });
    });

    const rnd = this.root.querySelector('#teams-random');
    if (rnd && !rnd._wired) {
      rnd._wired = true;
      rnd.addEventListener('click', () => {
        this._randomizeArcadeTeams();
        this.audio.select?.();
        this.haptics.tap();
        this._buildTeamAssign(MODES[this.selection.mode]);
      });
    }
  }

  /**
   * Shuffle Arcade fighters into a RANDOM number of balanced teams. The team
   * count is picked between 2 and the participant count (so 4 fighters can be
   * split into 2, 3 or 4 teams — never more teams than fighters). Round-robin
   * over a shuffled order keeps the teams balanced and guarantees every team
   * has at least one member.
   */
  _randomizeArcadeTeams() {
    const total = this.selection.opponents + 1;
    const maxTeams = Math.min(total, TEAM_COLORS.length);
    const numTeams = 2 + Math.floor(Math.random() * Math.max(1, maxTeams - 1));
    const idx = Array.from({ length: total }, (_, i) => i);
    for (let i = idx.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [idx[i], idx[j]] = [idx[j], idx[i]];
    }
    const assign = new Array(total);
    idx.forEach((p, k) => {
      assign[p] = k % numTeams;
    });
    this.selection.teamAssign = assign;
  }

  portraitCanvas(char, size, locked = false) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const c = document.createElement('canvas');
    c.width = size * dpr;
    c.height = size * dpr;
    c.style.width = `${size}px`;
    c.style.height = `${size}px`;
    const ctx = c.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.fillStyle = '#0b0e1a';
    ctx.fillRect(0, 0, size, size);
    // Prefer the high-quality painted bust; if this character reuses another's
    // sprites (e.g. Glacia -> Zara) borrow that painted bust with a hue tint so
    // it stays crisp instead of falling back to a blocky sprite crop.
    if (drawPaintedPortrait(ctx, char.id, size, locked)) return c;
    if (char.spriteBase && char.spriteBase !== char.id && getPortraitImage(char.spriteBase)) {
      if (char.tint) ctx.filter = `hue-rotate(${char.tint}deg) saturate(1.2)`;
      const drew = drawPaintedPortrait(ctx, char.spriteBase, size);
      if (char.tint) ctx.filter = 'none';
      if (drew) return c;
    }
    const set = getSpriteSet(char.spriteBase || char.id);
    if (set) {
      if (char.tint) ctx.filter = `hue-rotate(${char.tint}deg) saturate(1.25)`;
      drawSpritePortrait(ctx, set, size);
      if (char.tint) ctx.filter = 'none';
      return c;
    }
    return makePortraitCanvas(char, size);
  }

  statBar(label, value, max) {
    const pct = Math.min(100, (value / max) * 100);
    return `<div class="stat-bar"><span>${label}</span><i><b style="width:${pct}%"></b></i></div>`;
  }

  buildChips(sel, items, active, onPick, keyOf, labelOf, keys) {
    const row = this.root.querySelector(sel);
    if (!row) return;
    row.innerHTML = items
      .map((it, i) => {
        const key = keys ? keys[i] : keyOf(it);
        const isActive = key === active;
        return `<button class="chip ${isActive ? 'active' : ''}" data-k="${i}">${labelOf(it)}</button>`;
      })
      .join('');
    row.querySelectorAll('[data-k]').forEach((btn, i) => {
      btn.addEventListener('click', () => {
        const it = items[i];
        if (keys) it.n = keys[i];
        this.audio.select?.();
        this.haptics.tap();
        onPick(it);
      });
    });
  }

  // ------------------------------------------------------------------- game
  async startGame() {
    // Never launch into a premium arena that isn't owned (e.g. stale profile).
    if (isPremiumArena(this.selection.arena) && !this.purchases.ownsArenas()) {
      this.selection.arena = 'forest';
    }
    // Teams mode needs at least two populated teams.
    if (MODES[this.selection.mode]?.teams) {
      const total = this.selection.opponents + 1;
      const teams = new Set(this.selection.teamAssign.slice(0, total));
      if (teams.size < 2) {
        this.toast('Teams mode needs at least two teams');
        return;
      }
    }
    await StorageService.saveProfile({
      lastCharacter: this.selection.character,
      lastMode: this.selection.mode,
      lastDifficulty: this.selection.difficulty,
      lastArena: this.selection.arena,
    });
    this.audio.stopMusic();
    this.showScreen('game');
    this.root.querySelector('#pause-overlay')?.classList.add('hidden');
    this.root.querySelector('#result-overlay')?.classList.add('hidden');

    this._mode = 'arcade';
    const si = this.root.querySelector('#stage-indicator');
    if (si) {
      si.classList.add('hidden');
      si.innerHTML = '';
    }
    this._ensureEngine();
    this.engine.resize();

    this.engine.start({
      playerCharacter: this.selection.character,
      mode: this.selection.mode,
      difficulty: this.selection.difficulty,
      opponents: this.selection.opponents,
      teamAssign: this.selection.teamAssign,
      arena: this.selection.arena,
      playerName: this.profile.name,
      reduceMotion: this.settings.reduceMotion,
      excludePremium: !this._premiumEnabled(),
    });

    this._afterStart();
  }

  _ensureEngine() {
    const canvas = this.root.querySelector('#game-canvas');
    if (this.engine) return;
    this.engine = new GameEngine(canvas, {
      audio: this.audio,
      haptics: this.haptics,
      onHud: (list) => this.updateHud(list),
      onRoundOver: (r) => this.handleRoundOver(r),
      onAnnounce: (text, kind) => this.showAnnounce(text, kind),
      onRoster: (fighters) => this.buildHud(fighters),
      onCampaign: (info) => this.updateStageIndicator(info),
      onStageClear: (idx) => this.saveCampaignProgress(idx),
    });
  }

  _afterStart() {
    this.buildHud(this.engine.fighters);
    this.unbindControls?.();
    this.unbindControls = bindHumanControls(this.engine.humanController, this.root, {
      haptics: this.haptics,
    });
  }

  // --------------------------------------------------------------- campaign
  showCampaign() {
    this.showScreen('campaign');
    this.buildCampaign();
  }

  buildCampaign() {
    const progress = this.profile?.campaignProgress || 0;

    const fighters = this.root.querySelector('#camp-fighters');
    if (fighters) {
      const unlocked = this._pickableRoster();
      fighters.innerHTML = unlocked
        .map(
          (c) => `<button class="camp-fighter ${c.id === this.selection.character ? 'active' : ''}"
            data-char="${c.id}" style="--c:${c.color}"><span data-portrait="${c.id}"></span></button>`,
        )
        .join('');
      fighters.querySelectorAll('[data-portrait]').forEach((h) => {
        h.appendChild(this.portraitCanvas(getCharacter(h.dataset.portrait), 52));
      });
      fighters.querySelectorAll('[data-char]').forEach((btn) => {
        btn.addEventListener('click', () => {
          this.selection.character = btn.dataset.char;
          this.audio.select?.();
          this.haptics.tap();
          this.buildCampaign();
        });
      });
    }

    this.buildChips('#camp-diff', [1, 2, 3].map((d) => DIFFICULTY[d]), this.selection.difficulty,
      (d) => { this.selection.difficulty = d.n; this.buildCampaign(); },
      (d) => d.n, (d) => d.label, [1, 2, 3]);

    const list = this.root.querySelector('#stage-list');
    if (list) {
      list.innerHTML = STAGES.map((s, i) => {
        const locked = i > progress;
        const done = i < progress;
        return `<button class="stage-card ${locked ? 'locked' : ''}" data-stage="${i}" ${locked ? 'disabled' : ''}>
          <div class="stage-num">${done ? '✓' : i + 1}</div>
          <div class="stage-info"><b>${s.name}</b><span>${locked ? 'Locked — clear the previous stage' : s.blurb}</span></div>
          ${locked ? '<span class="stage-lock">🔒</span>' : '<span class="stage-go">▶</span>'}
        </button>`;
      }).join('');
      list.querySelectorAll('[data-stage]').forEach((btn) => {
        if (btn.disabled) return;
        btn.addEventListener('click', () => {
          this.audio.select?.();
          this.haptics.tap();
          this.startCampaign(Number(btn.dataset.stage));
        });
      });
    }
  }

  async startCampaign(startStage = 0) {
    await StorageService.saveProfile({
      lastCharacter: this.selection.character,
      lastDifficulty: this.selection.difficulty,
    });
    this._mode = 'campaign';
    this.campaignStartStage = startStage;
    this.audio.stopMusic();
    this.showScreen('game');
    this.root.querySelector('#pause-overlay')?.classList.add('hidden');
    this.root.querySelector('#result-overlay')?.classList.add('hidden');

    this._ensureEngine();
    this.engine.resize();
    this.engine.start({
      playerCharacter: this.selection.character,
      difficulty: this.selection.difficulty,
      campaign: { stages: STAGES, startStage },
      playerName: this.profile.name,
      reduceMotion: this.settings.reduceMotion,
    });
    this._afterStart();
  }

  updateStageIndicator(info) {
    const el = this.root.querySelector('#stage-indicator');
    if (!el || !info) return;
    el.classList.remove('hidden');
    el.innerHTML = `<b>${tpl('Stage {s}/{total}', { s: info.stage, total: info.totalStages })}</b> · ${t(
      info.stageName,
    )}
      <span>${tpl('Wave {w}/{total}', { w: info.wave, total: info.totalWaves })}${
      info.boss ? ` · ${t('BOSS')}` : ''
    }</span>`;
  }

  async saveCampaignProgress(clearedStageIndex) {
    // clearedStageIndex is the index the player just advanced INTO, so the
    // previous stage is cleared and this one is now unlocked.
    const progress = Math.max(this.profile?.campaignProgress || 0, clearedStageIndex);
    this.profile = await StorageService.saveProfile({ campaignProgress: progress });
  }

  buildHud(fighters) {
    const hud = this.root.querySelector('#hud');
    if (!hud) return;
    // Shrink the bars (and drop portraits) once the arena gets crowded.
    const compact = fighters.length > 4;
    hud.classList.toggle('compact', compact);
    this._hudChars = {};
    hud.innerHTML = fighters
      .map((f) => {
        this._hudChars[f.id] = f.char;
        return `
      <div class="hud-fighter ${f.isHuman ? 'human' : ''} ${f.char.isBoss ? 'boss' : ''}" data-id="${f.id}"
        style="border-left:3px solid ${f.teamColor}">
        ${compact ? '' : `<span class="hud-portrait" data-portrait="${f.id}"></span>`}
        <div class="hud-bars">
          <div class="hud-name" style="color:${f.teamColor}">${f.displayName}</div>
          <div class="hud-hp"><b data-hp></b></div>
          <div class="hud-mp"><b data-mp></b></div>
        </div>
      </div>`;
      })
      .join('');
    this.hudEls = {};
    hud.querySelectorAll('.hud-fighter').forEach((el) => {
      const holder = el.querySelector('[data-portrait]');
      const char = this._hudChars[el.dataset.id];
      if (holder && char) holder.appendChild(this.portraitCanvas(char, 30));
      this.hudEls[el.dataset.id] = {
        root: el,
        hp: el.querySelector('[data-hp]'),
        mp: el.querySelector('[data-mp]'),
      };
    });
  }

  showAnnounce(text, kind = 'go') {
    const el = this.root.querySelector('#announce');
    if (!el) return;
    el.textContent = text;
    el.className = `announce show ${kind}`;
    clearTimeout(this._announceT);
    this._announceT = setTimeout(() => {
      el.className = 'announce';
    }, kind === 'ko' ? 1200 : 850);
  }

  updateHud(list) {
    if (!this.hudEls) return;
    for (const f of list) {
      const el = this.hudEls[f.id];
      if (!el) continue;
      el.hp.style.width = `${(f.hp / f.maxHp) * 100}%`;
      el.mp.style.width = `${(f.mp / f.maxMp) * 100}%`;
      el.root.classList.toggle('ko', !f.alive);
      el.root.classList.toggle('rage', !!f.rage);
    }
    // Show the THROW button (with the held glyph + uses) while carrying an item.
    const throwBtn = this.root.querySelector('#throw-btn');
    const held = this.engine?.human?.heldItem;
    if (throwBtn) {
      throwBtn.classList.toggle('hidden', !held);
      if (held) {
        throwBtn.textContent = held.def.category === 'heal' ? held.def.glyph : `${held.def.glyph} ${held.uses}`;
      }
    }
  }

  pauseGame() {
    if (!this.engine?.running || this.engine.roundOver) return;
    this.engine.pause();
    this.root.querySelector('#pause-overlay')?.classList.remove('hidden');
  }

  resumeGame() {
    this.root.querySelector('#pause-overlay')?.classList.add('hidden');
    this.engine?.resume();
  }

  quitGame() {
    this.engine?.stop();
    this.unbindControls?.();
    this.unbindControls = null;
    this.goMenu();
  }

  /** Fire an interstitial once per finished match (frequency-gated in AdService). */
  _maybeInterstitial() {
    if (!this._matchResulted) return;
    this._matchResulted = false;
    this.ads.onMatchFinished();
  }

  async handleRoundOver(result) {
    if (result.campaign) {
      await this.handleCampaignOver(result);
      return;
    }
    const overlay = this.root.querySelector('#result-overlay');
    const title = this.root.querySelector('#result-title');
    const meta = this.root.querySelector('#result-meta');
    const ranking = result.ranking || [];
    const you = ranking.find((r) => r.containsHuman ?? r.isHuman);
    if (title) {
      title.textContent = t(result.win ? 'VICTORY!' : 'DEFEATED');
      title.classList.toggle('lose', !result.win);
    }
    if (meta) {
      const tmpl = result.teams
        ? 'Your team placed #{place} of {count} · {time}s'
        : 'You placed #{place} of {count} · {time}s';
      meta.textContent = you
        ? tpl(tmpl, { place: you.place, count: ranking.length, time: Math.floor(result.time) })
        : tpl('KO in {time}s', { time: Math.floor(result.time) });
    }
    this.buildPodium(ranking);

    // Award XP + check unlocks, then show the XP line.
    const award = this._awardXp(result, you, ranking.length);
    this._renderResultXp(award);
    overlay?.classList.remove('hidden');
    if (award.unlocked.length) {
      this.showAnnounce('UNLOCKED!', 'go');
      this.audio.select?.();
    }

    this.stats = await StorageService.updateStats(this._statsDelta(result));
    await StorageService.saveProfile({ xp: this.xp, unlocked: [...this.unlocked] });
    this._matchResulted = true;
  }

  async handleCampaignOver(result) {
    const overlay = this.root.querySelector('#result-overlay');
    const title = this.root.querySelector('#result-title');
    const meta = this.root.querySelector('#result-meta');
    this.root.querySelector('#stage-indicator')?.classList.add('hidden');

    if (title) {
      title.textContent = t(result.win ? 'CHAMPION!' : 'DEFEATED');
      title.classList.toggle('lose', !result.win);
    }
    if (meta) {
      meta.textContent = result.win
        ? tpl('You cleared all {n} stages! · {time}s', { n: STAGES.length, time: Math.floor(result.time) })
        : tpl('Fell at {stage} · {n} stages cleared', {
            stage: t(result.stageName),
            n: result.stagesCleared,
          });
    }
    // No survival podium in the campaign.
    const podium = this.root.querySelector('#result-podium');
    if (podium) podium.innerHTML = '';

    // XP: reward per stage cleared, big bonus for finishing the campaign.
    let gained = 30 + (result.stagesCleared || 0) * 55;
    if (result.win) gained += 200;
    this.xp += gained;
    const unlocked = [];
    for (const c of LOCKED_CHARACTERS) {
      if (!this.unlocked.has(c.id) && this.xp >= c.unlockXp) {
        this.unlocked.add(c.id);
        unlocked.push(c);
      }
    }
    this._renderResultXp({ gained, unlocked });
    overlay?.classList.remove('hidden');
    if (unlocked.length) this.showAnnounce('UNLOCKED!', 'go');

    // Persist: progress unlock + XP. A full win unlocks every stage.
    const progress = result.win ? STAGES.length - 1 : this.profile?.campaignProgress || 0;
    this.stats = await StorageService.updateStats(this._statsDelta(result));
    this.profile = await StorageService.saveProfile({
      xp: this.xp,
      unlocked: [...this.unlocked],
      campaignProgress: progress,
    });
    this._matchResulted = true;
  }

  /** Merge a finished match into the persisted lifetime stats. */
  _statsDelta(result) {
    const win = !!result.win;
    const streak = win ? (this.stats.streak || 0) + 1 : 0;
    return {
      matchesPlayed: (this.stats.matchesPlayed || 0) + 1,
      wins: (this.stats.wins || 0) + (win ? 1 : 0),
      losses: (this.stats.losses || 0) + (win ? 0 : 1),
      koDealt: (this.stats.koDealt || 0) + (result.koDealt || 0),
      bestCombo: Math.max(this.stats.bestCombo || 0, result.bestCombo || 0),
      streak,
      bestStreak: Math.max(this.stats.bestStreak || 0, streak),
    };
  }

  _awardXp(result, you, count) {
    let gained = 40; // participation
    if (result.win) gained += 80;
    if (you) gained += Math.max(0, count - you.place) * 12;
    if (you && you.alive) gained += 25; // survival bonus
    this.xp += gained;

    const unlocked = [];
    for (const c of LOCKED_CHARACTERS) {
      if (!this.unlocked.has(c.id) && this.xp >= c.unlockXp) {
        this.unlocked.add(c.id);
        unlocked.push(c);
      }
    }
    return { gained, unlocked };
  }

  _renderResultXp(award) {
    const el = this.root.querySelector('#result-xp');
    if (!el) return;
    const unlocks = award.unlocked
      .map(
        (c) => `<span class="xp-unlock" data-portrait="${c.id}"><b>${c.name}</b> ${t('unlocked!')}</span>`,
      )
      .join('');
    el.innerHTML = `<div class="xp-gain">${tpl('+{gained} XP · Total {xp}', {
      gained: award.gained,
      xp: this.xp,
    })}</div>${unlocks}`;
    el.querySelectorAll('[data-portrait]').forEach((holder) => {
      holder.prepend(this.portraitCanvas(getCharacter(holder.dataset.portrait), 40));
    });
  }

  buildPodium(ranking) {
    const el = this.root.querySelector('#result-podium');
    if (!el) return;
    if (!ranking.length) {
      el.innerHTML = '';
      return;
    }
    const medal = { 1: '🥇', 2: '🥈', 3: '🥉' };
    const byPlace = (p) => ranking.find((r) => r.place === p);
    const isYou = (r) => r.containsHuman ?? r.isHuman;
    const portraits = (r, size) =>
      r.members.map((m) => `<span class="pod-portrait" data-char="${m.char}" data-size="${size}"></span>`).join('');

    // Visual order on the podium: 2nd, 1st, 3rd.
    const topSlots = [2, 1, 3]
      .map((p) => ({ p, r: byPlace(p) }))
      .filter((s) => s.r)
      .map(
        ({ p, r }) => `
        <div class="pod pod-${p} ${isYou(r) ? 'you' : ''}">
          <div class="pod-portraits ${r.members.length > 1 ? 'team' : ''}">${portraits(r, r.members.length > 1 ? 34 : 44)}</div>
          <span class="pod-name" style="color:${r.teamColor}">${r.name}</span>
          <div class="pod-stand"><span class="pod-medal">${medal[p]}</span><b>${p}</b></div>
        </div>`,
      )
      .join('');

    const rest = ranking
      .filter((r) => r.place > 3)
      .map(
        (r) => `<li class="${isYou(r) ? 'you' : ''}"><span class="rest-place">#${r.place}</span>
          <div class="pod-portraits small">${portraits(r, 24)}</div>
          <span class="rest-name" style="color:${r.teamColor}">${r.name}</span>
          <span class="rest-char">${r.members.map((m) => m.charName).join(', ')}</span></li>`,
      )
      .join('');

    el.innerHTML = `
      <div class="podium-top">${topSlots}</div>
      ${rest ? `<ol class="podium-rest">${rest}</ol>` : ''}`;

    el.querySelectorAll('[data-char]').forEach((holder) => {
      holder.appendChild(this.portraitCanvas(getCharacter(holder.dataset.char), Number(holder.dataset.size) || 40));
    });
  }

  // ------------------------------------------------------------- settings
  showSettings() {
    const block = this.root.querySelector('#stats-block');
    if (block) {
      const s = this.stats;
      const played = s.matchesPlayed || 0;
      const winRate = played ? Math.round((s.wins / played) * 100) : 0;
      block.innerHTML = `
        <div class="stat-pill"><span>${played}</span>Matches</div>
        <div class="stat-pill"><span>${s.wins}</span>Wins</div>
        <div class="stat-pill"><span>${winRate}%</span>Win Rate</div>
        <div class="stat-pill"><span>${s.koDealt || 0}</span>KOs</div>
        <div class="stat-pill"><span>${s.bestCombo || 0}</span>Best Combo</div>
        <div class="stat-pill"><span>${s.bestStreak || 0}</span>Best Streak</div>`;
    }
    const nameEl = this.root.querySelector('#player-name');
    if (nameEl) nameEl.value = this.profile?.name || 'Player';
    const volEl = this.root.querySelector('#volume-slider');
    if (volEl) volEl.value = Math.round((this.settings?.volume ?? 0.8) * 100);
    this.showScreen('settings');
  }

  // ------------------------------------------------------------------- store
  showStore() {
    // The Store is native-only AND gated behind `_storeEnabled()`; ignore any
    // stray trigger while in-app purchases are switched off.
    if (!this._premiumEnabled()) return;
    this.buildStore();
    this.showScreen('store');
  }

  buildStore() {
    const body = this.root.querySelector('#store-body');
    if (!body) return;

    const ownRemoveAds = this.purchases.ownsRemoveAds();
    const ownAll = this.purchases.owns(ALL_CHARACTERS_ID);

    // Price shows ONLY when the store reported a real localized price; before
    // that (or if billing isn't wired) we show a neutral "Unlock" CTA instead
    // of a made-up placeholder price.
    const priceLabel = (id) => this.purchases.priceFor(id) || t('Unlock');
    const bigCard = (id, title, desc, owned) => `
      <button class="store-card store-feature ${owned ? 'owned' : ''}" data-buy="${id}" ${owned ? 'disabled' : ''}>
        <div class="store-info"><b>${title}</b><span>${desc}</span></div>
        <span class="store-price">${owned ? '✓ Owned' : priceLabel(id)}</span>
      </button>`;

    const charCard = (c) => {
      const owned = this.purchases.ownsCharacter(c.id);
      return `
      <button class="store-card store-char ${owned ? 'owned' : ''}" data-buy="${c.productId}"
        ${owned ? 'disabled' : ''} style="--c:${c.color};--a:${c.accent}">
        <span class="store-portrait" data-portrait="${c.id}"></span>
        <div class="store-info"><b>${c.name}</b><span>${c.tagline}</span></div>
        <span class="store-price">${owned ? '✓ Owned' : priceLabel(c.productId)}</span>
      </button>`;
    };

    body.innerHTML = `
      <div class="store-section">
        ${bigCard(REMOVE_ADS_ID, IAP.removeAds.title, IAP.removeAds.desc, ownRemoveAds)}
        ${bigCard(ALL_CHARACTERS_ID, IAP.allCharacters.title, IAP.allCharacters.desc, ownAll)}
        ${bigCard(ARENA_PACK_ID, IAP.arenaPack.title, IAP.arenaPack.desc, this.purchases.ownsArenas())}
      </div>
      <div class="store-label">Premium Fighters</div>
      <div class="store-grid">
        ${PREMIUM_CHARACTERS.map(charCard).join('')}
      </div>`;

    body.querySelectorAll('[data-portrait]').forEach((holder) => {
      holder.appendChild(this.portraitCanvas(getCharacter(holder.dataset.portrait), 96));
    });
    body.querySelectorAll('[data-buy]').forEach((btn) => {
      btn.addEventListener('click', () => this.buyProduct(btn.dataset.buy));
    });
  }

  async buyProduct(productId) {
    this.audio.select?.();
    this.haptics.tap();
    if (this.purchases.owns(productId)) return;
    if (this.purchases.native && !this.purchases.storeAvailable) {
      this.toast('Store not available on this build');
      return;
    }
    const res = await this.purchases.buy(productId);
    if (res.ok) {
      for (const id of this.purchases.ownedCharacterIds()) this.unlocked.add(id);
      this.audio.select?.();
      this.haptics.impact?.('Medium');
      this.toast('Purchase complete — thank you!');
      this.buildStore();
    } else {
      this.toast(res.error || 'Purchase failed');
    }
  }

  async restorePurchases() {
    this.audio.select?.();
    this.haptics.tap();
    const res = await this.purchases.restore();
    for (const id of this.purchases.ownedCharacterIds()) this.unlocked.add(id);
    this.buildStore();
    this.toast(res.ok ? tpl('Restored {n} purchase(s)', { n: res.restored }) : 'Restore failed');
  }

  async confirmReset() {
    this.haptics.tap();
    // eslint-disable-next-line no-alert
    const ok = window.confirm(t('Reset all progress? This clears your stats, XP and unlocks.'));
    if (!ok) return;
    const { stats, profile } = await StorageService.resetProgress();
    this.stats = stats;
    this.profile = profile;
    this.xp = 0;
    this.unlocked = new Set(STARTER_IDS);
    this.toast('Progress reset');
    this.showSettings();
  }

  switchLanguage(l) {
    if (getLang() === l) return;
    setLang(l);
    this.profile.lang = l;
    StorageService.saveProfile({ lang: l });
    this.audio.select?.();
    this.haptics.tap();
    // Rebuild the whole UI in the base (English) language, then let the
    // observer/retranslate re-apply Hebrew, and reopen the settings screen.
    this.render();
    retranslate(this.root);
    this.showSettings();
  }

  async toggleSetting(key, el) {
    this.settings[key] = !this.settings[key];
    el.classList.toggle('on', this.settings[key]);
    await StorageService.saveSettings(this.settings);
    this.audio.setEnabled(this.settings.sound, this.settings.music);
    this.haptics.setEnabled(this.settings.haptics);
    if (key === 'music') {
      if (this.settings.music) this.audio.startMusic();
      else this.audio.stopMusic();
    }
    this.haptics.tap();
  }

  // ---------------------------------------------------------- multiplayer
  showMultiplayer() {
    this.showScreen('multiplayer');
    this.renderMpLanding();
  }

  /** True on Android/iOS (Capacitor injects a global) — no physical keyboard. */
  _isNative() {
    return !!(typeof window !== 'undefined' && window.Capacitor?.isNativePlatform?.());
  }

  // In-app purchases aren't live yet, so the Store is switched off everywhere:
  // no Store button, no navigation into it, and premium fighters/arenas stay
  // hidden (rather than showing as permanently-locked dead-ends). Flip this to
  // `true` once billing is verified on a real device.
  _storeEnabled() {
    return true;
  }

  // Premium content is only offered where it can actually be bought.
  _premiumEnabled() {
    return this._isNative() && this._storeEnabled();
  }

  showHowto() {
    // The keyboard card is only relevant on desktop/web builds.
    const kb = this.root.querySelector('#howto-desktop');
    if (kb) kb.classList.toggle('hidden', this._isNative());
    this.showScreen('howto');
  }

  _relayConfigured() {
    try {
      return !!(import.meta.env?.VITE_MP_RELAY_URL || (typeof window !== 'undefined' && window.__MP_RELAY_URL));
    } catch {
      return false;
    }
  }

  renderMpLanding() {
    const body = this.root.querySelector('#mp-body');
    if (!body) return;
    body.innerHTML = `
      <p class="mp-intro">Play with a friend via a private invite code. Codes are
      6 digits and expire fast for safety.</p>
      <div class="mp-cards">
        <button class="mp-card" id="mp-create">
          <span class="mp-ico">＋</span><b>Create Room</b>
          <small>Generate an invite code</small>
        </button>
        <button class="mp-card" id="mp-join">
          <span class="mp-ico">→</span><b>Join Room</b>
          <small>Enter a friend's code</small>
        </button>
      </div>
      <p class="mp-note">${this.mp?.online || this._relayConfigured()
        ? 'Cross-device play is live via the relay server.'
        : 'Same-device play works out of the box. Set a relay URL (VITE_MP_RELAY_URL) for cross-device.'}</p>
    `;
    body.querySelector('#mp-create').addEventListener('click', () => this.mpCreate());
    body.querySelector('#mp-join').addEventListener('click', () => this.mpJoinPrompt());
  }

  _ensureMp() {
    if (!this.mp) {
      this.mp = new MultiplayerService();
      this.mp.on('players', () => this.renderLobby());
      this.mp.on('tick', () => this.updateLobbyTimer());
      this.mp.on('expired', () => {
        this.renderMpLanding();
        this.toast('Invite expired');
      });
      this.mp.on('start', (config) => this.startFromLobby(config));
      // In-match traffic (snapshots from host / input from guests).
      this.mp.on('state', (s) => this.engine?.ingestNet(s));
    }
  }

  mpCreate() {
    this._ensureMp();
    const code = this.mp.createRoom({
      name: this.profile.name || 'Host',
      character: null, // must be picked in the lobby
    });
    this.audio.select?.();
    this.renderLobby(code);
  }

  mpJoinPrompt() {
    const body = this.root.querySelector('#mp-body');
    body.innerHTML = `
      <div class="join-box">
        <label>Enter invite code</label>
        <input id="join-code" class="code-input" inputmode="numeric" maxlength="6"
          placeholder="000000" />
        <button class="btn btn-primary" id="join-go">Join</button>
        <button class="btn btn-ghost" id="join-back">Back</button>
      </div>`;
    const input = body.querySelector('#join-code');
    input.focus();
    body.querySelector('#join-go').addEventListener('click', () => {
      const code = input.value.trim();
      if (!/^\d{6}$/.test(code)) {
        this.toast('Code must be 6 digits');
        return;
      }
      this._ensureMp();
      try {
        this.mp.joinRoom(code, {
          name: this.profile.name || 'Guest',
          character: null, // must be picked in the lobby
        });
        this.renderLobby(code);
      } catch (err) {
        this.toast(err.message);
      }
    });
    body.querySelector('#join-back').addEventListener('click', () => this.renderMpLanding());
  }

  renderLobby(code) {
    const body = this.root.querySelector('#mp-body');
    if (!body || !this.mp?.connected) return;
    const roomCode = code || this.mp.room.code;
    const players = this.mp.players;
    const isHost = this.mp.isHost;
    if (!this._mpTeamType) this._mpTeamType = 'ffa';
    const canTeams = players.length > 2;

    const teamCtrls = isHost && canTeams
      ? `<div class="mp-teamctl">
           <div class="seg" id="mp-modeseg">
             <button data-t="ffa" class="${this._mpTeamType === 'ffa' ? 'on' : ''}">Free-for-all</button>
             <button data-t="teams" class="${this._mpTeamType === 'teams' ? 'on' : ''}">Teams</button>
           </div>
           ${this._mpTeamType === 'teams' ? '<button class="btn btn-ghost btn-sm" id="mp-shuffle">🎲 Shuffle Teams</button>' : ''}
         </div>`
      : '';

    const hasChar = !!this.mp.self?.character;
    body.innerHTML = `
      <div class="lobby">
        <div class="code-display">
          <label>Invite Code</label>
          <div class="code-big" id="code-big">${roomCode}</div>
          <div class="code-timer" id="code-timer"></div>
        </div>
        <div class="mp-charpick" id="mp-charpick"></div>
        ${teamCtrls}
        <div class="roster" id="roster"></div>
        <div class="lobby-actions">
          <button class="btn btn-secondary ${hasChar ? '' : 'btn-disabled'}" id="lobby-ready">Ready</button>
          ${isHost ? '<button class="btn btn-primary" id="lobby-start">Start Match</button>' : '<p class="wait-host">Waiting for host to start…</p>'}
          <button class="btn btn-ghost" id="lobby-leave">Leave</button>
        </div>
      </div>`;

    this._renderMpCharPick();
    this.renderRoster();
    this.updateLobbyTimer();

    body.querySelector('#code-big').addEventListener('click', () => {
      navigator.clipboard?.writeText(roomCode).then(() => this.toast('Code copied'));
    });
    body.querySelector('#lobby-ready').addEventListener('click', (e) => {
      if (!this.mp.self?.character) {
        this.toast('Pick a fighter first');
        return;
      }
      this.mp.toggleReady();
      e.target.classList.toggle('on', this.mp.self.ready);
    });
    body.querySelector('#mp-modeseg')?.querySelectorAll('button').forEach((b) => {
      b.addEventListener('click', () => {
        this._mpTeamType = b.dataset.t;
        if (this._mpTeamType === 'teams') this._shuffleMpTeams();
        this.renderLobby();
      });
    });
    body.querySelector('#mp-shuffle')?.addEventListener('click', () => {
      this._shuffleMpTeams();
      this.renderRoster();
    });
    body.querySelector('#lobby-start')?.addEventListener('click', () => {
      const cfg = this._buildMpStartConfig();
      if (cfg.netPlayers.length < 2) {
        this.toast('Need at least 2 players to start');
        return;
      }
      if (cfg.netPlayers.some((p) => !p.character)) {
        this.toast('Everyone must pick a fighter first');
        return;
      }
      if (cfg.teamsMode && new Set(cfg.netPlayers.map((p) => p.team)).size < 2) {
        this.toast('Teams mode needs at least two teams');
        return;
      }
      this.mp.startMatch(cfg);
    });
    body.querySelector('#lobby-leave').addEventListener('click', () => {
      this.mp.leave();
      this.mp = null;
      this.renderMpLanding();
    });
  }

  /**
   * Randomly split the current lobby into a random number of balanced teams
   * (2 up to the player count), host only.
   */
  _shuffleMpTeams() {
    const ids = this.mp.players.map((p) => p.id);
    const maxTeams = Math.min(ids.length, TEAM_COLORS.length);
    const numTeams = 2 + Math.floor(Math.random() * Math.max(1, maxTeams - 1));
    for (let i = ids.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [ids[i], ids[j]] = [ids[j], ids[i]];
    }
    this._mpTeamMap = {};
    ids.forEach((id, i) => {
      this._mpTeamMap[id] = i % numTeams;
    });
  }

  /** Host: assemble the agreed match config broadcast to every client. */
  _buildMpStartConfig() {
    const players = this.mp.players;
    const teams = this._mpTeamType === 'teams' && players.length > 2;
    if (teams && !this._mpTeamMap) this._shuffleMpTeams();
    const netPlayers = players.map((p, i) => ({
      character: p.character,
      name: p.name,
      netId: p.id,
      team: teams ? this._mpTeamMap[p.id] ?? i % 2 : i, // FFA: everyone their own team
    }));
    return {
      network: true,
      teamsMode: teams,
      mode: players.length === 2 ? 'oneVsOne' : teams ? 'teams' : 'freeForAll',
      arena: this.selection.arena,
      netPlayers,
    };
  }

  /** Compact fighter picker inside the multiplayer lobby. */
  _renderMpCharPick() {
    const wrap = this.root.querySelector('#mp-charpick');
    if (!wrap || !this.mp?.self) return;
    const chosen = this.mp.self.character;
    const roster = this._pickableRoster();
    wrap.innerHTML = `
      <label class="opt-label">Your fighter${chosen ? '' : ' <span class="opt-hint">tap to pick</span>'}</label>
      <div class="mp-charrow">
        ${roster
          .map(
            (c) => `<button class="mp-charcell ${c.id === chosen ? 'active' : ''}" data-char="${c.id}"
              style="--c:${c.color};--a:${c.accent}">
              <span class="char-portrait" data-portrait="${c.id}"></span>
              <span class="mp-charname">${c.name}</span>
            </button>`,
          )
          .join('')}
      </div>`;
    wrap.querySelectorAll('[data-portrait]').forEach((holder) => {
      holder.appendChild(this.portraitCanvas(getCharacter(holder.dataset.portrait), 72));
    });
    wrap.querySelectorAll('[data-char]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.mp.setCharacter(btn.dataset.char);
        this.selection.character = btn.dataset.char;
        this.audio.select?.();
        this.haptics.tap();
        this.renderLobby();
      });
    });
  }

  renderRoster() {
    const roster = this.root.querySelector('#roster');
    if (!roster || !this.mp) return;
    const showTeams = this._mpTeamType === 'teams' && this.mp.players.length > 2 && this._mpTeamMap;
    const teamColors = ['#4da3ff', '#ff6b6b'];
    roster.innerHTML = this.mp.players
      .map((p) => {
        const c = p.character ? getCharacter(p.character) : null;
        const dotColor = c ? c.color : '#4a4f66';
        const charName = c ? c.name : 'Choosing…';
        const tm = showTeams ? this._mpTeamMap[p.id] ?? 0 : null;
        const teamTag = showTeams
          ? `<span class="team-tag" style="background:${teamColors[tm % 2]}">Team ${tm + 1}</span>`
          : '';
        return `<div class="roster-row">
          <span class="roster-dot" style="background:${dotColor}"></span>
          <b>${p.name}</b><span class="roster-char">${charName}</span>
          ${teamTag}
          <span class="roster-ready ${p.ready ? 'on' : ''}">${p.ready ? 'READY' : '…'}</span>
          ${p.isHost ? '<span class="host-tag">HOST</span>' : ''}
        </div>`;
      })
      .join('');
  }

  updateLobbyTimer() {
    const el = this.root.querySelector('#code-timer');
    if (!el || !this.mp?.connected) return;
    const s = Math.ceil(this.mp.expiresInMs / 1000);
    el.textContent = `expires in ${s}s`;
    el.classList.toggle('urgent', s <= 20);
  }

  startFromLobby(config) {
    // Real host-authoritative online match. The host authored `netPlayers`
    // (identical roster on every client); we just find ourselves in it and
    // wire the transport into the engine.
    const players = config.netPlayers || [];
    const localIndex = Math.max(0, players.findIndex((p) => p.netId === this.mp.playerId));
    const role = this.mp.isHost ? 'host' : 'guest';
    const net = {
      role,
      localNetId: this.mp.playerId,
      send: (state) => this.mp.sendState(state),
    };

    this.audio.stopMusic();
    this.showScreen('game');
    this.root.querySelector('#pause-overlay')?.classList.add('hidden');
    this.root.querySelector('#result-overlay')?.classList.add('hidden');
    this._mode = 'multiplayer';
    const si = this.root.querySelector('#stage-indicator');
    if (si) {
      si.classList.add('hidden');
      si.innerHTML = '';
    }

    this._ensureEngine();
    this.engine.resize();
    this.engine.start({
      network: true,
      net,
      netPlayers: players,
      localIndex,
      teamsMode: !!config.teamsMode,
      mode: config.mode || 'freeForAll',
      arena: config.arena || this.selection.arena,
      playerCharacter: players[localIndex]?.character || this.selection.character,
      playerName: players[localIndex]?.name || this.profile.name,
      reduceMotion: this.settings.reduceMotion,
    });
    this._afterStart();
  }

  toast(msg) {
    let el = this.root.querySelector('.toast');
    if (!el) {
      el = document.createElement('div');
      el.className = 'toast';
      this.root.appendChild(el);
    }
    el.textContent = t(msg);
    el.classList.add('show');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => el.classList.remove('show'), 1800);
  }
}
