// World / physics constants. World units == CSS pixels on the canvas.
export const GRAVITY = 2600; // px/s^2
export const JUMP_VELOCITY = 880;
export const FRICTION = 0.82;

// The playfield uses a light "2.5D" depth model like classic beat-em-ups:
//   x  -> horizontal position
//   z  -> depth on the floor (0 = far/back, DEPTH = near/front)
//   y  -> height above the floor (jump)
export const ARENA_DEPTH = 220;

// Combat tuning
export const HITSTUN = 0.28; // seconds a fighter is stunned when hit
export const KNOCKBACK_X = 240;
export const KNOCKBACK_UP = 320;
export const BLOCK_DAMAGE_MULT = 0.2;
export const MP_REGEN = 7; // per second

export const DIFFICULTY = {
  1: {
    key: 'beginner',
    label: 'Beginner',
    reaction: 0.55, // seconds of decision delay
    aggression: 0.45,
    blockChance: 0.12,
    specialChance: 0.15,
    moveSpeedMult: 0.85,
    damageTaken: 0.85,
    damageDealt: 0.8,
  },
  2: {
    key: 'pro',
    label: 'Pro',
    reaction: 0.28,
    aggression: 0.7,
    blockChance: 0.35,
    specialChance: 0.4,
    moveSpeedMult: 1.0,
    damageTaken: 1.0,
    damageDealt: 1.0,
  },
  3: {
    key: 'expert',
    label: 'Expert',
    reaction: 0.12,
    aggression: 0.9,
    blockChance: 0.6,
    specialChance: 0.65,
    moveSpeedMult: 1.15,
    damageTaken: 1.1,
    damageDealt: 1.2,
  },
};

// maxOpponents caps the number of CPU fighters the player can add.
export const MODES = {
  oneVsOne: { key: 'oneVsOne', label: '1 vs 1', maxOpponents: 1, teams: false },
  freeForAll: { key: 'freeForAll', label: 'Free-for-all', maxOpponents: 8, teams: false },
  teams: { key: 'teams', label: 'Teams', maxOpponents: 8, teams: true },
};

// Up to 9 distinct team colours (1 player + 8 CPUs, each on their own team).
export const TEAM_COLORS = [
  '#ff5d3b',
  '#3b9bff',
  '#54e07a',
  '#c86bff',
  '#ffd23b',
  '#ff6fb5',
  '#26d7c4',
  '#ff9f43',
  '#9b8cff',
];

export const MAX_OPPONENTS = 8;
