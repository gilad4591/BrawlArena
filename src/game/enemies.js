/**
 * Solo-campaign enemies. These are shaped like roster characters so the engine
 * can build Fighters from them directly. They reuse existing sprite sheets
 * (spriteBase) recoloured with a hue shift (tint) and resized (sizeMul) so the
 * hulking Bruiser, tiny Mage and towering Boss read differently on screen.
 *
 * `behavior` drives the campaign AI:
 *   brawler – marches in and swings (Bruiser / Super Bruiser)
 *   zoner   – keeps its distance and casts (Junior Mage)
 *   boss    – fast, aggressive, uses the full special kit (Gang Leader)
 *
 * `ai` is the behaviour profile fed to AIController (reaction / aggression /
 * blockChance / specialChance).
 */

export const ENEMY_DEFS = {
  bruiser: {
    id: 'bruiser',
    name: 'Bruiser',
    color: '#8a3a2a',
    accent: '#e05a4a',
    // Dedicated dagger-fighter grunt art (public/sprites/grunt.png).
    spriteBase: 'grunt',
    tint: 0,
    sizeMul: 0.9,
    behavior: 'brawler',
    maxHp: 52,
    maxMp: 1,
    speed: 116,
    weight: 1.5,
    attackPower: 9,
    reach: 62,
    style: { build: 'heavy', skin: '#c99e77', hair: '#3a2a18', hairStyle: 'rugged', eye: '#e0c07a', crest: 'rock' },
    specials: [
      { name: 'Haymaker', slot: 'neutral', type: 'uppercut', mpCost: 999, damage: 11, launch: 240, color: '#d8b981', knockback: 1.0 },
    ],
    ai: { reaction: 0.72, aggression: 0.5, blockChance: 0.02, specialChance: 0 },
  },

  mage: {
    id: 'mage',
    name: 'Mage',
    color: '#4a2f7a',
    accent: '#b78bff',
    // Dedicated dark-mage art (public/sprites/darkmage.png).
    spriteBase: 'darkmage',
    tint: 0,
    sizeMul: 0.9,
    behavior: 'zoner',
    maxHp: 32,
    maxMp: 70,
    speed: 146,
    weight: 0.8,
    attackPower: 5,
    reach: 48,
    style: { build: 'slim', skin: '#e6d3bd', hair: '#241a3a', hairStyle: 'hood', eye: '#c9a3ff', crest: 'shadow' },
    specials: [
      { name: 'Magic Bolt', slot: 'neutral', type: 'projectile', mpCost: 14, damage: 6, speed: 420, radius: 12, color: '#b78bff', knockback: 0.6 },
    ],
    ai: { reaction: 0.85, aggression: 0.2, blockChance: 0.2, specialChance: 0.5 },
  },

  superbruiser: {
    id: 'superbruiser',
    name: 'Super Bruiser',
    color: '#3a5a9a',
    accent: '#6ab0ff',
    // A bigger, steel-tinted variant of the grunt to read as a mini-boss.
    spriteBase: 'grunt',
    tint: 205,
    sizeMul: 1.05,
    behavior: 'brawler',
    maxHp: 120,
    maxMp: 1,
    speed: 108,
    weight: 1.8,
    attackPower: 12,
    reach: 70,
    style: { build: 'heavy', skin: '#c98a6a', hair: '#2a1a10', hairStyle: 'mohawk', eye: '#ff9a6a', crest: 'flame' },
    specials: [
      { name: 'Ground Smash', slot: 'neutral', type: 'uppercut', mpCost: 999, damage: 15, launch: 360, color: '#ff9a6a', knockback: 1.3 },
    ],
    ai: { reaction: 0.65, aggression: 0.55, blockChance: 0.05, specialChance: 0 },
  },

  leader: {
    id: 'leader',
    name: 'Dark Overlord',
    color: '#3a2450',
    accent: '#b78bff',
    // Towering armoured boss with a dark spear (public/sprites/darkknight.png).
    spriteBase: 'darkknight',
    tint: 0,
    sizeMul: 1.2,
    behavior: 'boss',
    maxHp: 210,
    maxMp: 120,
    speed: 206,
    weight: 1.9,
    attackPower: 10,
    reach: 76,
    isBoss: true,
    style: { build: 'heavy', skin: '#caa07a', hair: '#20181c', hairStyle: 'spiky', eye: '#b78bff', crest: 'shadow' },
    specials: [
      { name: 'Dark Cleave', slot: 'neutral', type: 'uppercut', mpCost: 30, damage: 12, launch: 320, color: '#b78bff', knockback: 1.0 },
      { name: 'Dark Spear Rush', slot: 'dash', type: 'rush', mpCost: 26, damage: 15, speed: 1150, color: '#c9a0ff', knockback: 1.3 },
      { name: 'Dark Cataclysm', slot: 'air', type: 'aoe', mpCost: 34, damage: 15, radius: 100, color: '#a05aff', knockback: 1.4 },
    ],
    ai: { reaction: 0.5, aggression: 0.68, blockChance: 0.14, specialChance: 0.3 },
  },
};

// Back-compat: Fighter reads `char.special.color` when rendering.
for (const def of Object.values(ENEMY_DEFS)) {
  def.special = def.specials[0];
}

export function getEnemy(id) {
  return ENEMY_DEFS[id] || ENEMY_DEFS.bruiser;
}

/**
 * Five hand-authored stages. Each stage is a series of waves; a wave is a list
 * of enemy ids that spawn together. The player's HP carries across the whole
 * stage, topping up between stages.
 */
export const STAGES = [
  {
    id: 1,
    name: 'The Outskirts',
    arena: 'dojo',
    blurb: 'Learn the ropes against slow Bruisers.',
    waves: [['bruiser'], ['bruiser', 'bruiser'], ['bruiser', 'bruiser', 'bruiser']],
  },
  {
    id: 2,
    name: 'The Fortress Gate',
    arena: 'forest',
    blurb: 'Mages hang back and pelt you with bolts.',
    waves: [['bruiser', 'mage'], ['bruiser', 'bruiser', 'mage'], ['bruiser', 'mage', 'bruiser', 'mage']],
  },
  {
    id: 3,
    name: 'The Narrow Gorge',
    arena: 'frozen',
    blurb: 'Foes close in from both sides. A Super Bruiser guards the exit.',
    waves: [['bruiser', 'mage', 'bruiser'], ['bruiser', 'bruiser', 'mage', 'mage'], ['superbruiser']],
  },
  {
    id: 4,
    name: 'The Burning Citadel',
    arena: 'volcano',
    blurb: 'Upgraded packs and shielding Mages. Use the props!',
    waves: [['bruiser', 'mage'], ['bruiser', 'bruiser', 'mage'], ['bruiser', 'mage', 'bruiser', 'mage']],
  },
  {
    id: 5,
    name: 'The Throne Room',
    arena: 'volcano',
    blurb: 'The Gang Leader and his guard. Survive his enraged phase.',
    waves: [['leader', 'bruiser', 'mage', 'bruiser']],
  },
];

export function getStage(index) {
  return STAGES[Math.max(0, Math.min(STAGES.length - 1, index))];
}
