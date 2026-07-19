/**
 * Character roster — "Elements of War".
 *
 * Every fighter has its own hand-authored 1024x1024 animation sheet (registered
 * in sprites.js under the same id). Stats are balanced around a 200 HP baseline
 * so the combined Health/Speed/Power rating stays within a narrow band.
 *
 * Each `specials` entry (neutral / dash / air) drives the engine. Supported
 * `type` values: projectile | aoe | rush | uppercut | multishot
 */
export const CHARACTERS = [
  {
    id: 'blaze',
    name: 'Blaze',
    tagline: 'Flame Knight',
    archetype: 'Fire brawler',
    color: '#ff4d2a',
    accent: '#ffb03b',
    style: { build: 'normal', skin: '#e8b48a', hair: '#3a2418', hairStyle: 'spiky', eye: '#ffd23b', crest: 'flame' },
    unlockXp: 0,
    maxHp: 200,
    maxMp: 100,
    speed: 252,
    weight: 1.1,
    attackPower: 11,
    reach: 64,
    specials: [
      { name: 'Inferno Bolt', slot: 'neutral', type: 'projectile', mpCost: 22, damage: 16, speed: 470, radius: 17, color: '#ff7a2f', knockback: 1.1, orb: 'fire' },
      { name: 'Blazing Charge', slot: 'dash', type: 'rush', mpCost: 24, damage: 19, speed: 1320, color: '#ffb03b', knockback: 1.3 },
      { name: 'Rising Flame', slot: 'air', type: 'uppercut', mpCost: 26, damage: 17, launch: 620, color: '#ff7a2f', knockback: 0.8 },
    ],
  },
  {
    id: 'frost',
    name: 'Frost',
    tagline: 'Glacial Sentinel',
    archetype: 'Keep-away zoner',
    color: '#7ad0ff',
    accent: '#dff4ff',
    style: { build: 'normal', skin: '#e6d2c4', hair: '#dfe8ff', hairStyle: 'spiky', eye: '#8be8ff', crest: 'ice' },
    unlockXp: 0,
    maxHp: 200,
    maxMp: 110,
    speed: 264,
    weight: 1.0,
    attackPower: 10,
    reach: 62,
    specials: [
      { name: 'Frost Bolt', slot: 'neutral', type: 'projectile', mpCost: 22, damage: 15, speed: 460, radius: 16, color: '#bfefff', knockback: 0.9, freeze: 0.4, orb: 'ice' },
      { name: 'Glacier Rush', slot: 'dash', type: 'rush', mpCost: 24, damage: 17, speed: 1260, color: '#7ad0ff', knockback: 1.2 },
      { name: 'Ice Fall', slot: 'air', type: 'multishot', mpCost: 26, damage: 10, speed: 600, radius: 10, color: '#dff4ff', knockback: 0.6, orb: 'ice' },
    ],
  },
  {
    id: 'tide',
    name: 'Tide',
    tagline: 'Water Blade',
    archetype: 'Balanced swordsman',
    color: '#2f6fd6',
    accent: '#8fd0ff',
    style: { build: 'normal', skin: '#e2c2a0', hair: '#2a4fb0', hairStyle: 'slick', eye: '#8fd0ff', crest: 'wave' },
    unlockXp: 0,
    maxHp: 200,
    maxMp: 102,
    speed: 260,
    weight: 1.05,
    attackPower: 10,
    reach: 66,
    specials: [
      { name: 'Water Slash', slot: 'neutral', type: 'projectile', mpCost: 22, damage: 15, speed: 500, radius: 15, color: '#67c8ff', knockback: 1.0, orb: 'water' },
      { name: 'Tidal Rush', slot: 'dash', type: 'rush', mpCost: 24, damage: 18, speed: 1320, color: '#8fd0ff', knockback: 1.2 },
      { name: 'Rising Wave', slot: 'air', type: 'uppercut', mpCost: 26, damage: 16, launch: 600, color: '#67c8ff', knockback: 0.8 },
    ],
  },
  {
    id: 'volt',
    name: 'Volt',
    tagline: 'Storm Ninja',
    archetype: 'Fast rushdown',
    color: '#8b5cff',
    accent: '#c3b0ff',
    style: { build: 'slim', skin: '#dcc0a4', hair: '#3a2a5a', hairStyle: 'spiky', eye: '#bcd6ff', crest: 'spark' },
    unlockXp: 0,
    maxHp: 200,
    maxMp: 98,
    speed: 304,
    weight: 0.88,
    attackPower: 9,
    reach: 58,
    specials: [
      { name: 'Spark Bolt', slot: 'neutral', type: 'projectile', mpCost: 18, damage: 12, speed: 700, radius: 10, color: '#bcd6ff', knockback: 0.7, orb: 'lightning' },
      { name: 'Thunder Dash', slot: 'dash', type: 'rush', mpCost: 22, damage: 18, speed: 1500, color: '#c3b0ff', knockback: 1.0 },
      { name: 'Bolt Uppercut', slot: 'air', type: 'uppercut', mpCost: 24, damage: 15, launch: 580, color: '#bcd6ff', knockback: 0.6 },
    ],
  },
  {
    id: 'sylva',
    name: 'Sylva',
    tagline: 'Wood Archer',
    archetype: 'Long-range control',
    color: '#6faf4b',
    accent: '#cfe0a3',
    style: { build: 'slim', skin: '#e6c6a2', hair: '#5a3a1f', hairStyle: 'hood', eye: '#cfe0a3', crest: 'wind' },
    unlockXp: 0,
    maxHp: 200,
    maxMp: 106,
    speed: 276,
    weight: 0.95,
    attackPower: 9,
    reach: 60,
    specials: [
      { name: 'Hunter Arrow', slot: 'neutral', type: 'projectile', mpCost: 20, damage: 15, speed: 620, radius: 12, color: '#d6f0a3', knockback: 0.9, homing: 0.8, orb: 'toxic' },
      { name: 'Spread Shot', slot: 'dash', type: 'multishot', mpCost: 24, damage: 10, speed: 620, radius: 10, color: '#cfe0a3', knockback: 0.6, orb: 'toxic' },
      { name: 'Sky Arrow', slot: 'air', type: 'uppercut', mpCost: 24, damage: 14, launch: 560, color: '#cfe0a3', knockback: 0.7 },
    ],
  },
  {
    id: 'shade',
    name: 'Shade',
    tagline: 'Venom Assassin',
    archetype: 'Agile striker',
    color: '#2e8b46',
    accent: '#9fe08a',
    style: { build: 'slim', skin: '#d9b88c', hair: '#141414', hairStyle: 'spiky', eye: '#9fe08a', crest: 'shadow' },
    unlockXp: 0,
    maxHp: 200,
    maxMp: 98,
    speed: 300,
    weight: 0.9,
    attackPower: 9,
    reach: 60,
    specials: [
      { name: 'Toxic Fang', slot: 'neutral', type: 'projectile', mpCost: 18, damage: 13, speed: 620, radius: 11, color: '#9fe08a', knockback: 0.7, orb: 'toxic' },
      { name: 'Shadow Rush', slot: 'dash', type: 'rush', mpCost: 22, damage: 18, speed: 1440, color: '#6fd06f', knockback: 1.0 },
      { name: 'Rising Fang', slot: 'air', type: 'uppercut', mpCost: 24, damage: 15, launch: 560, color: '#9fe08a', knockback: 0.6 },
    ],
  },
  {
    id: 'nox',
    name: 'Nox',
    tagline: 'Void Knight',
    archetype: 'Heavy tank',
    color: '#6a4a9c',
    accent: '#b78bff',
    style: { build: 'heavy', skin: '#c9c2d6', hair: '#1a1030', hairStyle: 'rugged', eye: '#b78bff', crest: 'shadow' },
    unlockXp: 0,
    maxHp: 200,
    maxMp: 88,
    speed: 212,
    weight: 1.6,
    attackPower: 12,
    reach: 70,
    sizeMul: 0.95,
    specials: [
      { name: 'Void Blast', slot: 'neutral', type: 'projectile', mpCost: 26, damage: 17, speed: 440, radius: 18, color: '#b78bff', knockback: 1.3, orb: 'void' },
      { name: 'Dark Charge', slot: 'dash', type: 'rush', mpCost: 28, damage: 20, speed: 1120, color: '#8b5cff', knockback: 1.7 },
      { name: 'Doom Splitter', slot: 'air', type: 'uppercut', mpCost: 30, damage: 19, launch: 600, color: '#b78bff', knockback: 1.0 },
    ],
  },
  {
    id: 'golem',
    name: 'Golem',
    tagline: 'Stone Titan',
    archetype: 'Immovable bruiser',
    color: '#7a8a4a',
    accent: '#b6e05a',
    style: { build: 'heavy', skin: '#8a8a6a', hair: '#5a6a2a', hairStyle: 'rugged', eye: '#b6e05a', crest: 'rock' },
    unlockXp: 0,
    maxHp: 200,
    maxMp: 84,
    speed: 192,
    weight: 1.8,
    attackPower: 13,
    reach: 68,
    sizeMul: 0.96,
    specials: [
      { name: 'Boulder Throw', slot: 'neutral', type: 'projectile', mpCost: 26, damage: 18, speed: 400, radius: 20, color: '#b6e05a', knockback: 1.4, orb: 'toxic' },
      { name: 'Bull Rush', slot: 'dash', type: 'rush', mpCost: 28, damage: 21, speed: 1080, color: '#9ab04a', knockback: 1.8 },
      { name: 'Quake Slam', slot: 'air', type: 'aoe', mpCost: 30, damage: 20, radius: 150, color: '#b6e05a', knockback: 1.6 },
    ],
  },
  {
    id: 'aurex',
    name: 'Aurex',
    tagline: 'Golden Dragon',
    archetype: 'All-rounder',
    color: '#e0a020',
    accent: '#ffe08a',
    style: { build: 'normal', skin: '#e8c48a', hair: '#3a2418', hairStyle: 'spiky', eye: '#ffe08a', crest: 'flame' },
    unlockXp: 0,
    maxHp: 200,
    maxMp: 100,
    speed: 248,
    weight: 1.2,
    attackPower: 11,
    reach: 64,
    specials: [
      { name: 'Dragon Bolt', slot: 'neutral', type: 'projectile', mpCost: 22, damage: 16, speed: 470, radius: 17, color: '#ffcf5e', knockback: 1.1, orb: 'holy' },
      { name: 'Golden Charge', slot: 'dash', type: 'rush', mpCost: 24, damage: 19, speed: 1300, color: '#ffe08a', knockback: 1.3 },
      { name: 'Rising Dragon', slot: 'air', type: 'uppercut', mpCost: 26, damage: 17, launch: 620, color: '#ffcf5e', knockback: 0.9 },
    ],
  },
  {
    id: 'sage',
    name: 'Sage',
    tagline: 'Arcane Elder',
    archetype: 'Spellcaster zoner',
    color: '#7a4fc8',
    accent: '#c9a0ff',
    style: { build: 'normal', skin: '#e6d2c0', hair: '#e8e8f0', hairStyle: 'hood', eye: '#c9a0ff', crest: 'ice' },
    unlockXp: 0,
    maxHp: 200,
    maxMp: 120,
    speed: 236,
    weight: 1.0,
    attackPower: 11,
    reach: 62,
    specials: [
      { name: 'Arcane Bolt', slot: 'neutral', type: 'projectile', mpCost: 22, damage: 15, speed: 420, radius: 18, color: '#c9a0ff', knockback: 0.9, homing: 0.6, orb: 'void' },
      { name: 'Meteor', slot: 'dash', type: 'aoe', mpCost: 32, damage: 20, radius: 150, color: '#ff8a3a', knockback: 1.4 },
      { name: 'Void Pillar', slot: 'air', type: 'aoe', mpCost: 30, damage: 16, radius: 130, color: '#c9a0ff', knockback: 1.2 },
    ],
  },

  // ------------------------------------------------------------------------
  // Premium (purchasable) fighters. All four ship dedicated 12-pose sheets and
  // painted busts (+ dark "locked" busts). Native-only: hidden on web where
  // there's no Store / billing. Tuned ~5% above the standard roster's
  // TOTAL rating — the HP baseline stays 200 (so bars match), and the edge
  // comes from a little extra speed + power.
  {
    id: 'solaris',
    name: 'Solaris',
    tagline: 'Sun Champion',
    archetype: 'Radiant all-rounder',
    color: '#ffb020',
    accent: '#fff0a0',
    style: { build: 'normal', skin: '#f0c890', hair: '#ffd24a', hairStyle: 'spiky', eye: '#fff0a0', crest: 'flame' },
    premium: true,
    productId: 'char_solaris',
    unlockXp: 0,
    maxHp: 200,
    maxMp: 108,
    speed: 266,
    weight: 1.15,
    attackPower: 12,
    reach: 66,
    specials: [
      { name: 'Solar Flare', slot: 'neutral', type: 'projectile', mpCost: 22, damage: 18, speed: 490, radius: 18, color: '#ffd24a', knockback: 1.2, orb: 'holy' },
      { name: 'Radiant Charge', slot: 'dash', type: 'rush', mpCost: 24, damage: 21, speed: 1340, color: '#fff0a0', knockback: 1.4 },
      { name: 'Sunrise', slot: 'air', type: 'uppercut', mpCost: 26, damage: 19, launch: 640, color: '#ffd24a', knockback: 1.0 },
    ],
  },
  {
    id: 'tempest',
    name: 'Tempest',
    tagline: 'Storm Lord',
    archetype: 'Lightning rushdown',
    color: '#4aa0ff',
    accent: '#d0f0ff',
    style: { build: 'slim', skin: '#dcc0a4', hair: '#2a4faa', hairStyle: 'spiky', eye: '#d0f0ff', crest: 'spark' },
    premium: true,
    productId: 'char_tempest',
    unlockXp: 0,
    maxHp: 200,
    maxMp: 100,
    speed: 318,
    weight: 0.88,
    attackPower: 10,
    reach: 58,
    specials: [
      { name: 'Storm Bolt', slot: 'neutral', type: 'projectile', mpCost: 18, damage: 13, speed: 720, radius: 10, color: '#d0f0ff', knockback: 0.8, orb: 'lightning' },
      { name: 'Gale Dash', slot: 'dash', type: 'rush', mpCost: 22, damage: 20, speed: 1540, color: '#8fd0ff', knockback: 1.1 },
      { name: 'Tempest Rise', slot: 'air', type: 'uppercut', mpCost: 24, damage: 17, launch: 600, color: '#d0f0ff', knockback: 0.7 },
    ],
  },
  {
    id: 'umbra',
    name: 'Umbra',
    tagline: 'Night Reaper',
    archetype: 'Shadow striker',
    color: '#7a3fb0',
    accent: '#c98bff',
    style: { build: 'slim', skin: '#d0b088', hair: '#140a24', hairStyle: 'spiky', eye: '#c98bff', crest: 'shadow' },
    premium: true,
    productId: 'char_umbra',
    unlockXp: 0,
    maxHp: 200,
    maxMp: 100,
    speed: 315,
    weight: 0.9,
    attackPower: 10,
    reach: 60,
    specials: [
      { name: 'Shadow Fang', slot: 'neutral', type: 'projectile', mpCost: 18, damage: 15, speed: 640, radius: 11, color: '#c98bff', knockback: 0.8, orb: 'void' },
      { name: 'Reaper Rush', slot: 'dash', type: 'rush', mpCost: 22, damage: 20, speed: 1480, color: '#9a5fd0', knockback: 1.1 },
      { name: 'Night Rise', slot: 'air', type: 'uppercut', mpCost: 24, damage: 17, launch: 580, color: '#c98bff', knockback: 0.7 },
    ],
  },
  {
    id: 'titania',
    name: 'Titania',
    tagline: 'Nature Queen',
    archetype: 'Long-range control',
    color: '#3fb07a',
    accent: '#b0ff9a',
    style: { build: 'slim', skin: '#e6c6a2', hair: '#2f7a3a', hairStyle: 'hood', eye: '#b0ff9a', crest: 'wind' },
    premium: true,
    productId: 'char_titania',
    unlockXp: 0,
    maxHp: 200,
    maxMp: 110,
    speed: 292,
    weight: 0.95,
    attackPower: 10,
    reach: 62,
    specials: [
      { name: 'Thorn Arrow', slot: 'neutral', type: 'projectile', mpCost: 20, damage: 16, speed: 640, radius: 12, color: '#b0ff9a', knockback: 1.0, homing: 0.9, orb: 'toxic' },
      { name: 'Bloom Volley', slot: 'dash', type: 'multishot', mpCost: 24, damage: 11, speed: 640, radius: 10, color: '#b0ff9a', knockback: 0.7, orb: 'toxic' },
      { name: 'Sky Bloom', slot: 'air', type: 'uppercut', mpCost: 24, damage: 15, launch: 580, color: '#b0ff9a', knockback: 0.8 },
    ],
  },
];

// Combo hint per slot (how the player triggers each special). Shared across the
// roster so the control scheme stays consistent and teachable.
export const SPECIAL_SLOTS = {
  neutral: { label: 'SP', hint: 'Tap SP' },
  dash: { label: '→→ SP', hint: 'Double-tap forward, then SP' },
  air: { label: 'Jump + SP', hint: 'Jump, then SP in the air' },
};

// Back-compat: keep `.special` pointing at the neutral special.
for (const c of CHARACTERS) {
  c.special = c.specials[0];
}

export const CHARACTER_MAP = Object.fromEntries(CHARACTERS.map((c) => [c.id, c]));

export function getCharacter(id) {
  return CHARACTER_MAP[id] || CHARACTERS[0];
}

// Fighters unlocked from the start (no XP required). Premium fighters are
// excluded — they only unlock through a purchase.
export const STARTER_IDS = CHARACTERS.filter((c) => !c.premium && (c.unlockXp || 0) === 0).map(
  (c) => c.id,
);

// Locked fighters ordered by the XP needed to unlock them (premium excluded).
export const LOCKED_CHARACTERS = CHARACTERS.filter((c) => !c.premium && (c.unlockXp || 0) > 0).sort(
  (a, b) => a.unlockXp - b.unlockXp,
);

// Purchasable fighters (shown in the Store, locked until bought).
export const PREMIUM_CHARACTERS = CHARACTERS.filter((c) => c.premium);

export function isPremium(id) {
  return !!CHARACTER_MAP[id]?.premium;
}

/**
 * Rough overall "fighter rating" combining the three visible stats on the same
 * scale as the detail bars (Health / Speed / Power). All fighters are tuned to
 * land within a narrow band so no pick is strictly stronger.
 */
export function powerRating(c) {
  return Math.round(((c.maxHp / 200) * 0.9 + c.speed / 340 + c.attackPower / 14) * 100) / 100;
}
