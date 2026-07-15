/**
 * Sprite pipeline. Loads sprite sheets + auto-sliced frame boxes and exposes
 * per-character animation sets. Fighters render these frames instead of the
 * procedural rig when a sprite set is available.
 *
 * To add a character:
 *   1. Drop <name>.png into public/sprites/
 *   2. Run: node scripts/slice-sheet.mjs public/sprites/<name>.png
 *   3. Add a SPRITE_DEFS entry mapping animations -> frame indices.
 *      (Open /sprites/preview.html to see each frame's index.)
 */

const BASE = import.meta.env.BASE_URL || '/';
// Bump this whenever portrait/sprite PNGs are re-exported. Vite does NOT hash
// files under public/, so browsers (and the dev server) can serve a stale
// cached copy after art updates — the version query forces a fresh fetch.
const ASSET_VERSION = '17';
const v = (url) => `${url}${url.includes('?') ? '&' : '?'}v=${ASSET_VERSION}`;

/**
 * Shared roster atlas produced by scripts/grid-extract.mjs. A single PNG holds
 * every fighter; roster.frames.json lists all frame boxes plus a per-character
 * map of action -> frame index (idle/idleBack/punch/kick/jump).
 */
const ROSTER = {
  sheet: 'sprites/roster.png',
  frames: 'sprites/roster.frames.json',
  scale: 0.95,
};

/** Build a fighter animation def from the extracted per-action frame indices. */
function buildRosterDef(anim, frames) {
  const first = (arr, fallback) => (arr && arr.length ? arr[0] : fallback);
  const idle = first(anim.idle, 0);
  const idleBox = frames[idle] || { w: 1, h: 1 };
  const overlaps = (a, b) =>
    a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
  // A frame is a real full-body pose (not a sliver, stray projectile, weapon
  // swipe, dust cloud, or merged crop) only if its box is close to the idle
  // silhouette: near-equal height, a plausible width, and it must NOT overlap
  // the idle box (overlap => the extractor split/merged neighbouring art).
  // Anything failing these checks falls back to the clean idle pose, which is
  // what prevents the "halved / cut in half" look during punches and kicks.
  const bodyLike = (i) => {
    if (i == null || !frames[i]) return false;
    const f = frames[i];
    const hr = f.h / idleBox.h;
    const wr = f.w / idleBox.w;
    if (hr < 0.82 || hr > 1.18) return false;
    if (wr < 0.5 || wr > 1.75) return false;
    if (i !== idle && overlaps(f, idleBox)) return false;
    return true;
  };
  const orIdle = (i) => (bodyLike(i) ? i : idle);

  const back = orIdle(first(anim.idleBack, idle));
  const punch = orIdle(first(anim.punch, idle));
  const kick = first(anim.kick, punch);
  const jump = orIdle(first(anim.jump, idle));

  const attackFrames = [punch];
  if (bodyLike(kick) && kick !== punch) attackFrames.push(kick);

  return {
    sheet: ROSTER.sheet,
    scale: ROSTER.scale,
    faceRight: true,
    portraitFrame: idle,
    portraitZoom: 1.08,
    animations: {
      idle: { frames: [idle], fps: 2, loop: true },
      walk: { frames: [idle], fps: 2, loop: true },
      jump: { frames: [jump], loop: false },
      attack: { frames: attackFrames, fps: 9, loop: false },
      special: { frames: [punch], loop: false },
      hit: { frames: [back], loop: false },
      defend: { frames: [back], loop: false },
      ko: { frames: [idle], loop: false },
    },
  };
}

/**
 * Standalone per-character sheets (name -> def). Used for the dedicated
 * campaign-enemy art (Bruiser, Mage) which lives on its own sheet rather than
 * the shared roster atlas. Frame indices map into <name>.frames.json.
 *   0 idle · 1 idle/back · 2 punch · 3 kick|cast · 4 jump|special
 */
export const SPRITE_DEFS = {
  bruiser: {
    sheet: 'sprites/bruiser.png',
    frames: 'sprites/bruiser.frames.json',
    scale: 0.95,
    faceRight: true,
    portraitFrame: 0,
    portraitZoom: 1.12,
    animations: {
      idle: { frames: [0], fps: 2, loop: true },
      walk: { frames: [0], fps: 2, loop: true },
      jump: { frames: [4], loop: false },
      attack: { frames: [2, 3], fps: 9, loop: false },
      special: { frames: [2], loop: false },
      hit: { frames: [1], loop: false },
      defend: { frames: [1], loop: false },
      ko: { frames: [0], loop: false },
    },
  },
  mage: {
    sheet: 'sprites/mage.png',
    frames: 'sprites/mage.frames.json',
    scale: 0.98,
    faceRight: true,
    portraitFrame: 0,
    portraitZoom: 1.12,
    animations: {
      idle: { frames: [0], fps: 2, loop: true },
      walk: { frames: [0], fps: 2, loop: true },
      jump: { frames: [3], loop: false },
      attack: { frames: [2], fps: 8, loop: false },
      // The purple cast pose doubles as the Magic Bolt special.
      special: { frames: [4], loop: false },
      hit: { frames: [1], loop: false },
      defend: { frames: [1], loop: false },
      ko: { frames: [0], loop: false },
    },
  },
  // Blaze — clean 4x2 = 8-pose chroma sheet (grid-sheet.mjs).
  //   0 idle · 1 walk · 2 jump · 3 attack · 4 special · 5 hit · 6 defend · 7 ko
  blaze: {
    sheet: 'sprites/blaze.png', frames: 'sprites/blaze.frames.json', scale: 1.0,
    faceRight: true, portraitFrame: 0, portraitZoom: 1.15,
    animations: {
      idle: { frames: [0], fps: 2, loop: true },
      walk: { frames: [1, 0], fps: 6, loop: true },
      jump: { frames: [2], loop: false },
      attack: { frames: [3], fps: 9, loop: false },
      special: { frames: [4], loop: false },
      hit: { frames: [5], loop: false },
      defend: { frames: [6], loop: false },
      ko: { frames: [7], loop: false },
    },
  },
  // ---- Elemental roster ----
  // Frost/Tide/Sage were regenerated as clean 4x2 = 8-pose chroma sheets
  // (grid-sheet.mjs). Frame order per cell (reading L->R, top->bottom):
  //   0 idle · 1 walk · 2 jump · 3 attack · 4 special · 5 hit · 6 defend · 7 ko
  frost: {
    sheet: 'sprites/frost.png', frames: 'sprites/frost.frames.json', scale: 1.0,
    faceRight: true, portraitFrame: 0, portraitZoom: 1.14,
    animations: {
      idle: { frames: [0], fps: 2, loop: true },
      walk: { frames: [1, 0], fps: 6, loop: true },
      jump: { frames: [2], loop: false },
      attack: { frames: [3], fps: 9, loop: false },
      special: { frames: [4], loop: false },
      hit: { frames: [5], loop: false },
      defend: { frames: [6], loop: false },
      ko: { frames: [7], loop: false },
    },
  },
  aurex: {
    sheet: 'sprites/aurex.png', frames: 'sprites/aurex.frames.json', scale: 1.0,
    faceRight: true, portraitFrame: 0, portraitZoom: 1.12,
    animations: {
      idle: { frames: [0], fps: 2, loop: true },
      walk: { frames: [1, 0], fps: 6, loop: true },
      jump: { frames: [2], loop: false },
      attack: { frames: [3], fps: 9, loop: false },
      special: { frames: [4], loop: false },
      hit: { frames: [5], loop: false },
      defend: { frames: [6], loop: false },
      ko: { frames: [7], loop: false },
    },
  },
  shade: {
    sheet: 'sprites/shade.png', frames: 'sprites/shade.frames.json', scale: 1.0,
    faceRight: true, portraitFrame: 0, portraitZoom: 1.12,
    animations: {
      idle: { frames: [0], fps: 2, loop: true },
      walk: { frames: [1, 0], fps: 6, loop: true },
      jump: { frames: [2], loop: false },
      attack: { frames: [3], fps: 9, loop: false },
      special: { frames: [4], loop: false },
      hit: { frames: [5], loop: false },
      defend: { frames: [6], loop: false },
      ko: { frames: [7], loop: false },
    },
  },
  golem: {
    sheet: 'sprites/golem.png', frames: 'sprites/golem.frames.json', scale: 1.0,
    faceRight: true, portraitFrame: 0, portraitZoom: 1.05,
    animations: {
      idle: { frames: [0], fps: 2, loop: true },
      walk: { frames: [1, 0], fps: 6, loop: true },
      jump: { frames: [2], loop: false },
      attack: { frames: [3], fps: 8, loop: false },
      special: { frames: [4], loop: false },
      hit: { frames: [5], loop: false },
      defend: { frames: [6], loop: false },
      ko: { frames: [7], loop: false },
    },
  },
  tide: {
    sheet: 'sprites/tide.png', frames: 'sprites/tide.frames.json', scale: 1.0,
    faceRight: true, portraitFrame: 0, portraitZoom: 1.14,
    animations: {
      idle: { frames: [0], fps: 2, loop: true },
      walk: { frames: [1, 0], fps: 6, loop: true },
      jump: { frames: [2], loop: false },
      attack: { frames: [3], fps: 9, loop: false },
      special: { frames: [4], loop: false },
      hit: { frames: [5], loop: false },
      defend: { frames: [6], loop: false },
      ko: { frames: [7], loop: false },
    },
  },
  nox: {
    sheet: 'sprites/nox.png', frames: 'sprites/nox.frames.json', scale: 1.0,
    faceRight: true, portraitFrame: 0, portraitZoom: 1.12,
    animations: {
      idle: { frames: [0], fps: 2, loop: true },
      walk: { frames: [1, 0], fps: 6, loop: true },
      jump: { frames: [2], loop: false },
      attack: { frames: [3], fps: 9, loop: false },
      special: { frames: [4], loop: false },
      hit: { frames: [5], loop: false },
      defend: { frames: [6], loop: false },
      ko: { frames: [7], loop: false },
    },
  },
  volt: {
    sheet: 'sprites/volt.png', frames: 'sprites/volt.frames.json', scale: 1.0,
    faceRight: true, portraitFrame: 0, portraitZoom: 1.12,
    animations: {
      idle: { frames: [0], fps: 2, loop: true },
      walk: { frames: [1, 0], fps: 6, loop: true },
      jump: { frames: [2], loop: false },
      attack: { frames: [3], fps: 9, loop: false },
      special: { frames: [4], loop: false },
      hit: { frames: [5], loop: false },
      defend: { frames: [6], loop: false },
      ko: { frames: [7], loop: false },
    },
  },
  sylva: {
    sheet: 'sprites/sylva.png', frames: 'sprites/sylva.frames.json', scale: 1.0,
    faceRight: true, portraitFrame: 0, portraitZoom: 1.12,
    animations: {
      idle: { frames: [0], fps: 2, loop: true },
      walk: { frames: [1, 0], fps: 6, loop: true },
      jump: { frames: [2], loop: false },
      attack: { frames: [3], fps: 9, loop: false },
      special: { frames: [4], loop: false },
      hit: { frames: [5], loop: false },
      defend: { frames: [6], loop: false },
      ko: { frames: [7], loop: false },
    },
  },
  sage: {
    sheet: 'sprites/sage.png', frames: 'sprites/sage.frames.json', scale: 1.02,
    faceRight: true, portraitFrame: 0, portraitZoom: 1.12,
    animations: {
      idle: { frames: [0], fps: 2, loop: true },
      walk: { frames: [1, 0], fps: 6, loop: true },
      jump: { frames: [2], loop: false },
      attack: { frames: [3], fps: 9, loop: false },
      special: { frames: [4], loop: false },
      hit: { frames: [5], loop: false },
      defend: { frames: [6], loop: false },
      ko: { frames: [7], loop: false },
    },
  },
  // ---- Campaign enemies (1024x575 labelled sheets) ----
  grunt: {
    sheet: 'sprites/grunt.png', frames: 'sprites/grunt.frames.json', scale: 0.95,
    faceRight: true, portraitFrame: 0, portraitZoom: 1.14,
    animations: {
      idle: { frames: [0, 1, 2], fps: 4, loop: true },
      walk: { frames: [3, 4, 5, 6], fps: 10, loop: true },
      jump: { frames: [8], loop: false },
      attack: { frames: [9, 10], fps: 11, loop: false },
      special: { frames: [11], loop: false },
      hit: { frames: [16], loop: false },
      defend: { frames: [0], loop: false },
      ko: { frames: [18], loop: false },
    },
  },
  darkmage: {
    sheet: 'sprites/darkmage.png', frames: 'sprites/darkmage.frames.json', scale: 0.95,
    faceRight: true, portraitFrame: 0, portraitZoom: 1.14,
    animations: {
      idle: { frames: [0, 1, 2, 3], fps: 4, loop: true },
      walk: { frames: [4, 5, 6, 7], fps: 9, loop: true },
      jump: { frames: [11], loop: false },
      attack: { frames: [10, 13], fps: 10, loop: false },
      special: { frames: [19], loop: false },
      hit: { frames: [24], loop: false },
      defend: { frames: [0], loop: false },
      ko: { frames: [28], loop: false },
    },
  },
  darkknight: {
    sheet: 'sprites/darkknight.png', frames: 'sprites/darkknight.frames.json', scale: 1.0,
    faceRight: true, portraitFrame: 1, portraitZoom: 1.1,
    animations: {
      idle: { frames: [1, 2], fps: 3, loop: true },
      walk: { frames: [4, 5, 6, 7], fps: 8, loop: true },
      jump: { frames: [3], loop: false },
      attack: { frames: [10, 8], fps: 8, loop: false },
      special: { frames: [16], loop: false },
      hit: { frames: [18], loop: false },
      defend: { frames: [1], loop: false },
      ko: { frames: [19], loop: false },
    },
  },
};

// High-quality painted busts (public/portraits/<id>.png) used on the character
// select screen, HUD and results podium. Falls back to the sprite crop.
//
// Only busts that actually MATCH the character's in-game sprite are listed here.
// Deliberately excluded (their painted art depicts a different design than the
// sprite, so they'd look mismatched):
//   leon  -> bust is a casual man, sprite is an armoured swordsman -> sprite crop
//   eliza -> bust is a witch, sprite is a musketeer -> sprite crop
//   onyx  -> reuses Darryl's sprite; borrows Darryl's bust tinted (exact match)
//   rex   -> reuses Leon's swordsman sprite; falls back to that sprite crop
// Painted busts (cropped from the "Character Select Screen 2" mockup) mapped to
// each fighter by element. Sylva (archer) and Sage (wizard) have no matching
// bust, so they fall back to their crisp 1024px sprite crops.
// Full painted-bust roster. All 10 busts were regenerated as a matching set
// (crop-busts.mjs) from flat-magenta reference sheets, so the select/HUD
// portrait now matches each in-game character across the whole roster.
const PORTRAIT_IDS = ['blaze', 'frost', 'tide', 'volt', 'sylva', 'shade', 'nox', 'golem', 'aurex', 'sage'];
const portraits = new Map();

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

export async function loadPortraits() {
  await Promise.all(
    PORTRAIT_IDS.map(async (id) => {
      try {
        portraits.set(id, await loadImage(v(`${BASE}portraits/${id}.png`)));
      } catch {
        /* fall back to sprite crop */
      }
    }),
  );
}

export function getPortraitImage(charId) {
  return portraits.get(charId) || null;
}

/** Draw a painted portrait bust, cover-fit into a square box. Returns false if none. */
export function drawPaintedPortrait(ctx, charId, size) {
  const img = portraits.get(charId);
  if (!img) return false;
  const scale = Math.max(size / img.width, size / img.height);
  const dw = img.width * scale;
  const dh = img.height * scale;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, (size - dw) / 2, (size - dh) / 2, dw, dh);
  return true;
}

export class SpriteSheet {
  constructor(image, frames, def) {
    this.image = image;
    this.frames = frames; // [{x,y,w,h}]
    this.def = def;
    // Reference height (the idle pose). Every frame is scaled by the SAME
    // pixel->world factor derived from this, so poses whose trimmed bounding
    // box is a different height (punch/kick) don't get vertically stretched.
    const ref = this.frame(def.portraitFrame ?? 0);
    this.refH = ref ? ref.h : 1;
    // Reference width of the idle body. Attack/special frames are much wider
    // (they include the beam/effect), so we anchor by this width to stop the
    // body from sliding backwards when a wide frame is centered.
    this.refW = ref ? ref.w : 1;
  }

  frame(index) {
    return this.frames[index] || this.frames[0];
  }

  /**
   * Draw a frame anchored by bottom-center at (dx, dy) using a shared
   * pixel->world scale `k`. Keeps every pose the same body size.
   */
  drawScaled(ctx, index, dx, dy, k, flip, rot = 0) {
    const f = this.frame(index);
    if (!f) return;
    const w = f.w * k;
    const h = f.h * k;
    ctx.save();
    ctx.translate(dx, dy);
    if (rot) ctx.rotate(rot); // pivot at the feet (dx, dy)
    if (flip) ctx.scale(-1, 1);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(this.image, f.x, f.y, f.w, f.h, -w / 2, -h, w, h);
    ctx.restore();
  }
}

const registry = new Map();

export function getSpriteSet(charId) {
  return registry.get(charId) || null;
}

export async function loadAllSprites() {
  // Shared roster atlas: one image, many characters.
  try {
    const [img, meta] = await Promise.all([
      loadImage(v(BASE + ROSTER.sheet)),
      fetch(v(BASE + ROSTER.frames)).then((r) => r.json()),
    ]);
    Object.entries(meta.chars || {}).forEach(([id, anim]) => {
      const def = buildRosterDef(anim, meta.frames);
      registry.set(id, new SpriteSheet(img, meta.frames, def));
    });
  } catch (err) {
    console.warn('[sprites] failed to load roster atlas:', err);
  }

  // Any standalone per-character sheets.
  await Promise.all(
    Object.entries(SPRITE_DEFS).map(async ([id, def]) => {
      try {
        const img = await loadImage(v(BASE + def.sheet));
        const meta = await fetch(v(BASE + def.frames)).then((r) => r.json());
        registry.set(id, new SpriteSheet(img, meta.frames, def));
      } catch (err) {
        console.warn(`[sprites] failed to load ${id}:`, err);
      }
    }),
  );
}

/** Pick the frame index for a fighter state + progress. Returns integer index. */
export function frameForState(set, state, stateTime, walkClock) {
  const map = {
    idle: 'idle',
    walk: 'walk',
    jump: 'jump',
    attack: 'attack',
    special: 'special',
    hit: 'hit',
    defend: 'defend',
    ko: 'ko',
  };
  const anim = set.def.animations[map[state]] || set.def.animations.idle;
  if (!anim) return 0;
  if (anim.loop) {
    const fps = anim.fps || 8;
    const i = Math.floor((walkClock * fps)) % anim.frames.length;
    return anim.frames[i];
  }
  // one-shot: spread frames across the state's own timeline
  const fps = anim.fps || 12;
  const i = Math.min(anim.frames.length - 1, Math.floor(stateTime * fps));
  return anim.frames[i];
}

/** Render a portrait (upper body crop of a frame) into a 2d context box. */
export function drawSpritePortrait(ctx, set, size) {
  const def = set.def;
  const f = set.frame(def.portraitFrame ?? 0);
  if (!f) return false;
  const zoom = def.portraitZoom || 1;
  // crop the head+torso: top ~62% of the frame
  const cropH = f.h * 0.62;
  const cropW = Math.min(f.w, cropH); // squareish
  const cropX = f.x + (f.w - cropW) / 2;
  const cropY = f.y;
  const s = size * zoom;
  const off = (size - s) / 2;
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(set.image, cropX, cropY, cropW, cropH, off, off, s, s);
  return true;
}
