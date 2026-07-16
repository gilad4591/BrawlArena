/**
 * Themed arenas. Each arena draws the full background + floor given the
 * engine's projection geometry. Deterministic scenery is cached per width so
 * nothing flickers between frames.
 */

function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function cache(arena, key, build) {
  arena._cache ||= {};
  if (arena._cache._key !== key) {
    arena._cache = { _key: key };
  }
  if (!arena._cache[key + '_data']) {
    arena._cache[key + '_data'] = build();
  }
  return arena._cache[key + '_data'];
}

function roundedFoliage(ctx, x, y, r, color, dark) {
  const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.2, x, y, r);
  g.addColorStop(0, color);
  g.addColorStop(1, dark);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

// ---------------------------------------------------------------- Forest
const forest = {
  id: 'forest',
  name: 'Forest',
  swatch: '#4a8c3f',
  draw(ctx, info) {
    const { w, h, floorTopY, time } = info;

    // sky
    const sky = ctx.createLinearGradient(0, 0, 0, floorTopY + 40);
    sky.addColorStop(0, '#8fd0ea');
    sky.addColorStop(0.6, '#bfe6ea');
    sky.addColorStop(1, '#e8f3df');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, floorTopY + 40);

    // soft sun
    const sun = ctx.createRadialGradient(w * 0.78, floorTopY * 0.35, 10, w * 0.78, floorTopY * 0.35, w * 0.4);
    sun.addColorStop(0, 'rgba(255,250,220,0.9)');
    sun.addColorStop(1, 'rgba(255,250,220,0)');
    ctx.fillStyle = sun;
    ctx.fillRect(0, 0, w, floorTopY);

    // distant mountains
    const mts = cache(this, `mt${Math.round(w)}`, () => {
      const r = rng(11);
      const arr = [];
      let x = -40;
      while (x < w + 80) {
        arr.push({ x, wdt: 120 + r() * 160, hgt: 60 + r() * 90 });
        x += 90 + r() * 120;
      }
      return arr;
    });
    ctx.fillStyle = '#7fa8b8';
    mts.forEach((m) => {
      ctx.beginPath();
      ctx.moveTo(m.x, floorTopY);
      ctx.lineTo(m.x + m.wdt / 2, floorTopY - m.hgt);
      ctx.lineTo(m.x + m.wdt, floorTopY);
      ctx.fill();
    });
    ctx.fillStyle = 'rgba(120,168,150,0.55)';
    ctx.fillRect(0, floorTopY - 26, w, 30);

    // tree line behind the stage
    const trees = cache(this, `tr${Math.round(w)}`, () => {
      const r = rng(37);
      const arr = [];
      for (let x = -20; x < w + 40; x += 46 + r() * 26) {
        arr.push({ x, r: 26 + r() * 20, hue: r() });
      }
      return arr;
    });
    trees.forEach((t) => {
      const baseY = floorTopY + 8;
      ctx.fillStyle = '#5b3d24';
      ctx.fillRect(t.x - 4, baseY - t.r * 0.4, 8, t.r * 1.1);
      const light = t.hue > 0.5 ? '#5aa845' : '#4f9a3d';
      roundedFoliage(ctx, t.x, baseY - t.r * 0.9, t.r, light, '#2f6b2a');
      roundedFoliage(ctx, t.x - t.r * 0.5, baseY - t.r * 0.6, t.r * 0.7, light, '#2f6b2a');
      roundedFoliage(ctx, t.x + t.r * 0.5, baseY - t.r * 0.6, t.r * 0.7, light, '#2f6b2a');
    });

    // grass floor
    const grass = ctx.createLinearGradient(0, floorTopY, 0, h);
    grass.addColorStop(0, '#5fae4a');
    grass.addColorStop(0.5, '#4f9a3d');
    grass.addColorStop(1, '#3c7d30');
    ctx.fillStyle = grass;
    ctx.fillRect(0, floorTopY, w, h - floorTopY);

    // grass texture streaks
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 2;
    for (let i = 1; i <= 6; i += 1) {
      const y = floorTopY + ((h - floorTopY) * i) / 7;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.bezierCurveTo(w * 0.3, y - 6, w * 0.7, y + 6, w, y);
      ctx.stroke();
    }

    // floating pollen
    ctx.fillStyle = 'rgba(255,255,240,0.5)';
    for (let i = 0; i < 18; i += 1) {
      const px = (i * 137.5 + time * 12) % w;
      const py = floorTopY + 30 + ((i * 53) % (h - floorTopY - 40)) + Math.sin(time + i) * 6;
      ctx.beginPath();
      ctx.arc(px, py, 1.6, 0, Math.PI * 2);
      ctx.fill();
    }
  },
};

// ---------------------------------------------------------------- Dojo
const dojo = {
  id: 'dojo',
  name: 'Dojo',
  swatch: '#c98a4b',
  draw(ctx, info) {
    const { w, h, floorTopY } = info;
    const wall = ctx.createLinearGradient(0, 0, 0, floorTopY);
    wall.addColorStop(0, '#3a2c22');
    wall.addColorStop(1, '#5a4433');
    ctx.fillStyle = wall;
    ctx.fillRect(0, 0, w, floorTopY);

    // shoji paper panels
    ctx.fillStyle = '#e9dcc0';
    const panelW = w / 6;
    for (let i = 0; i < 6; i += 1) {
      ctx.fillStyle = i % 2 ? '#e4d5b7' : '#efe2c6';
      ctx.fillRect(i * panelW + 6, floorTopY * 0.28, panelW - 12, floorTopY * 0.55);
    }
    ctx.strokeStyle = '#6b4f36';
    ctx.lineWidth = 4;
    for (let i = 0; i <= 6; i += 1) {
      ctx.beginPath();
      ctx.moveTo(i * panelW, floorTopY * 0.28);
      ctx.lineTo(i * panelW, floorTopY * 0.83);
      ctx.stroke();
    }
    ctx.fillStyle = '#2a1c12';
    ctx.fillRect(0, floorTopY * 0.83, w, floorTopY * 0.17);

    // lanterns
    [0.2, 0.8].forEach((fx) => {
      const lx = w * fx;
      ctx.fillStyle = '#d64b3b';
      ctx.beginPath();
      ctx.ellipse(lx, floorTopY * 0.2, 20, 26, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,200,120,0.5)';
      ctx.beginPath();
      ctx.ellipse(lx, floorTopY * 0.2, 12, 16, 0, 0, Math.PI * 2);
      ctx.fill();
    });

    // wooden floor
    const floor = ctx.createLinearGradient(0, floorTopY, 0, h);
    floor.addColorStop(0, '#8a5f3a');
    floor.addColorStop(1, '#5c3d24');
    ctx.fillStyle = floor;
    ctx.fillRect(0, floorTopY, w, h - floorTopY);
    ctx.strokeStyle = 'rgba(0,0,0,0.18)';
    ctx.lineWidth = 2;
    for (let i = 1; i <= 6; i += 1) {
      const y = floorTopY + ((h - floorTopY) * i) / 7;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
  },
};

// ---------------------------------------------------------------- Volcano
const volcano = {
  id: 'volcano',
  name: 'Volcano',
  swatch: '#e0532a',
  draw(ctx, info) {
    const { w, h, floorTopY, time } = info;
    const sky = ctx.createLinearGradient(0, 0, 0, floorTopY);
    sky.addColorStop(0, '#1a0d12');
    sky.addColorStop(1, '#5a1e14');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, floorTopY);

    const glow = ctx.createRadialGradient(w * 0.5, floorTopY, 10, w * 0.5, floorTopY, w * 0.6);
    glow.addColorStop(0, 'rgba(255,110,40,0.5)');
    glow.addColorStop(1, 'rgba(255,110,40,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, floorTopY + 60);

    // jagged rock silhouette
    ctx.fillStyle = '#20120e';
    ctx.beginPath();
    ctx.moveTo(0, floorTopY);
    const r = rng(5);
    for (let x = 0; x <= w; x += w / 10) {
      ctx.lineTo(x, floorTopY - 30 - r() * 70);
    }
    ctx.lineTo(w, floorTopY);
    ctx.fill();

    const floor = ctx.createLinearGradient(0, floorTopY, 0, h);
    floor.addColorStop(0, '#3a1c14');
    floor.addColorStop(1, '#160a08');
    ctx.fillStyle = floor;
    ctx.fillRect(0, floorTopY, w, h - floorTopY);

    // lava cracks
    ctx.strokeStyle = 'rgba(255,120,40,0.5)';
    ctx.lineWidth = 3;
    for (let i = 1; i <= 4; i += 1) {
      const y = floorTopY + ((h - floorTopY) * i) / 5;
      ctx.beginPath();
      ctx.moveTo(0, y);
      for (let x = 0; x <= w; x += 40) {
        ctx.lineTo(x, y + Math.sin(x * 0.05 + i) * 4);
      }
      ctx.stroke();
    }

    // embers
    ctx.fillStyle = 'rgba(255,160,60,0.8)';
    for (let i = 0; i < 24; i += 1) {
      const px = (i * 97 + Math.sin(time + i) * 20) % w;
      const py = h - ((time * 40 + i * 60) % h);
      ctx.fillRect(px, py, 2, 3);
    }
  },
};

// ---------------------------------------------------------------- Frozen Peak
const frozen = {
  id: 'frozen',
  name: 'Frozen Peak',
  swatch: '#7fd4ff',
  draw(ctx, info) {
    const { w, h, floorTopY, time } = info;
    const sky = ctx.createLinearGradient(0, 0, 0, floorTopY);
    sky.addColorStop(0, '#0d1b3a');
    sky.addColorStop(0.6, '#1e3a66');
    sky.addColorStop(1, '#3a6a99');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, floorTopY);

    // aurora
    ctx.globalAlpha = 0.3;
    for (let i = 0; i < 3; i += 1) {
      const g = ctx.createLinearGradient(0, floorTopY * 0.2, 0, floorTopY * 0.7);
      g.addColorStop(0, ['#4fe0a0', '#4fd6ff', '#a56bff'][i]);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(0, floorTopY * (0.3 + i * 0.08));
      for (let x = 0; x <= w; x += 30) {
        ctx.lineTo(x, floorTopY * (0.3 + i * 0.08) + Math.sin(x * 0.02 + time + i) * 22);
      }
      ctx.lineTo(w, floorTopY);
      ctx.lineTo(0, floorTopY);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // ice mountains
    ctx.fillStyle = '#c8e6f5';
    const peaks = cache(this, `pk${Math.round(w)}`, () => {
      const r = rng(9);
      const a = [];
      let x = -30;
      while (x < w + 60) {
        a.push({ x, wdt: 140 + r() * 120, hgt: 80 + r() * 80 });
        x += 110 + r() * 90;
      }
      return a;
    });
    peaks.forEach((p) => {
      ctx.beginPath();
      ctx.moveTo(p.x, floorTopY);
      ctx.lineTo(p.x + p.wdt / 2, floorTopY - p.hgt);
      ctx.lineTo(p.x + p.wdt, floorTopY);
      ctx.fill();
    });

    const floor = ctx.createLinearGradient(0, floorTopY, 0, h);
    floor.addColorStop(0, '#dff1fb');
    floor.addColorStop(1, '#9cc2d9');
    ctx.fillStyle = floor;
    ctx.fillRect(0, floorTopY, w, h - floorTopY);
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 1;
    for (let i = 1; i <= 6; i += 1) {
      const y = floorTopY + ((h - floorTopY) * i) / 7;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // snow
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    for (let i = 0; i < 40; i += 1) {
      const px = (i * 61 + Math.sin(time * 0.5 + i) * 30) % w;
      const py = ((time * 30 + i * 40) % h);
      ctx.beginPath();
      ctx.arc(px, py, 1.8, 0, Math.PI * 2);
      ctx.fill();
    }
  },
};

// ---------------------------------------------------------------- Premium arenas
// Painted background images (public/arenas/<id>.png). `bg` makes the engine draw
// the image instead of the procedural scene; the `draw` below is only a themed
// two-band fallback used if the image ever fails to load. Marked premium: true
// so they're gated behind the Store (native only), like premium fighters.
function imageArena({ id, name, swatch, bg, skyTop, skyBot, floorTop, floorBot }) {
  return {
    id,
    name,
    swatch,
    bg,
    premium: true,
    draw(ctx, info) {
      const { w, h, floorTopY } = info;
      const sky = ctx.createLinearGradient(0, 0, 0, floorTopY);
      sky.addColorStop(0, skyTop);
      sky.addColorStop(1, skyBot);
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, w, floorTopY);
      const floor = ctx.createLinearGradient(0, floorTopY, 0, h);
      floor.addColorStop(0, floorTop);
      floor.addColorStop(1, floorBot);
      ctx.fillStyle = floor;
      ctx.fillRect(0, floorTopY, w, h - floorTopY);
    },
  };
}

const colosseum = imageArena({
  id: 'colosseum', name: 'Colosseum', swatch: '#d9b87a', bg: 'arenas/colosseum.png',
  skyTop: '#f6d99b', skyBot: '#c99a63', floorTop: '#e9dcc0', floorBot: '#c9b58f',
});
const neonCity = imageArena({
  id: 'neon_rooftop', name: 'Neon City', swatch: '#4fd6ff', bg: 'arenas/neon_rooftop.png',
  skyTop: '#0d1630', skyBot: '#243a6a', floorTop: '#3a4560', floorBot: '#1a2236',
});
const graveyard = imageArena({
  id: 'shadow_graveyard', name: 'Shadow Graveyard', swatch: '#8f6bd0', bg: 'arenas/shadow_graveyard.png',
  skyTop: '#20143a', skyBot: '#3a2f66', floorTop: '#7a6a5a', floorBot: '#3a3040',
});
const skyTemple = imageArena({
  id: 'sky_temple', name: 'Sky Temple', swatch: '#ffd98a', bg: 'arenas/sky_temple.png',
  skyTop: '#ffe3d0', skyBot: '#f6c9a0', floorTop: '#f3ead8', floorBot: '#d9c7a8',
});

export const ARENAS = [forest, dojo, volcano, frozen, colosseum, neonCity, graveyard, skyTemple];
export const ARENA_MAP = Object.fromEntries(ARENAS.map((a) => [a.id, a]));
export const PREMIUM_ARENAS = ARENAS.filter((a) => a.premium);
export function isPremiumArena(id) {
  return !!ARENA_MAP[id]?.premium;
}
export function getArena(id) {
  return ARENA_MAP[id] || forest;
}

/**
 * Optional real background art. Give any arena a `bg` (e.g. bg: 'arenas/forest.jpg'),
 * drop the file in public/arenas/, and it will be used instead of the drawn
 * scene. If no `bg` is set (or it fails to load) the procedural arena is used.
 */
export async function loadArenaImages() {
  const base = import.meta.env.BASE_URL || '/';
  await Promise.all(
    ARENAS.filter((a) => a.bg).map(
      (a) =>
        new Promise((res) => {
          const img = new Image();
          img.onload = () => {
            a.bgImage = img;
            res();
          };
          img.onerror = () => res();
          img.src = base + a.bg;
        }),
    ),
  );
}
