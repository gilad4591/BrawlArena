/**
 * Cosmetics = three INDEPENDENT, account-wide slots the player can "wear"
 * together and swap freely:
 *   - frame : an ornate portrait border (UI only)
 *   - aura  : an animated elemental aura around the fighter in-world
 *   - sp    : recolours/re-themes the fighter's special-attack projectiles
 *
 * Each slot offers the same 6 elemental THEMES. Items are bought once with Coins
 * (account-wide, not per character) and are intentionally pricey. An equipped
 * theme also gives the body a matching hue-rotate tint (via the aura slot).
 *
 * Storage:
 *   profile.cosmeticsOwned    = ['aura:void', 'frame:divine', ...]
 *   profile.cosmeticsEquipped = { frame:'divine'|null, aura:'void'|null, sp:null }
 */
export const COSMETIC_THEMES = [
  { key: 'inferno', name: 'Inferno', tint: 8, color: '#ff6a2b', tier: 1 },
  { key: 'frost', name: 'Frost', tint: 195, color: '#8fdcff', tier: 1 },
  { key: 'storm', name: 'Storm', tint: 215, color: '#8ab6ff', tier: 2 },
  { key: 'toxic', name: 'Toxic', tint: 110, color: '#9dff45', tier: 2 },
  { key: 'divine', name: 'Divine', tint: 45, color: '#ffd76a', tier: 3 },
  { key: 'void', name: 'Void', tint: 285, color: '#c06bff', tier: 4 },
];

export const COSMETIC_SLOTS = [
  { key: 'frame', name: 'Frame', base: 350 },
  { key: 'aura', name: 'Aura', base: 550 },
  { key: 'sp', name: 'Special FX', base: 800 },
];

const TIER_MULT = { 1: 1, 2: 1.4, 3: 1.9, 4: 2.5 };

export const THEME_MAP = Object.fromEntries(COSMETIC_THEMES.map((t) => [t.key, t]));
export const SLOT_MAP = Object.fromEntries(COSMETIC_SLOTS.map((s) => [s.key, s]));

// Special-attack theme -> which painted orb sprite + trail colour to use.
export const SP_THEME = {
  inferno: { orb: 'fire', color: '#ff7a2b' },
  frost: { orb: 'ice', color: '#8fdcff' },
  storm: { orb: 'lightning', color: '#a9c8ff' },
  toxic: { orb: 'toxic', color: '#9dff45' },
  divine: { orb: 'holy', color: '#ffe08a' },
  void: { orb: 'void', color: '#c06bff' },
};

export function cosmeticId(slot, theme) {
  return `${slot}:${theme}`;
}

export function cosmeticPrice(slot, theme) {
  const s = SLOT_MAP[slot];
  const t = THEME_MAP[theme];
  if (!s || !t) return 0;
  return Math.round((s.base * TIER_MULT[t.tier]) / 10) * 10;
}

export function ownsCosmetic(slot, theme, owned = []) {
  return owned.includes(cosmeticId(slot, theme));
}

/** Theme key equipped in a slot (null if none). */
export function equippedTheme(slot, equipped = {}) {
  return equipped?.[slot] || null;
}

/** Body hue-rotate for the player: follows the equipped AURA theme. */
export function equippedTint(equipped = {}) {
  const t = THEME_MAP[equipped?.aura];
  return t ? t.tint : 0;
}

/** Equipped aura theme id (null if none). */
export function equippedAura(equipped = {}) {
  return equipped?.aura || null;
}

/** Equipped special-fx theme id (null if none). */
export function equippedSp(equipped = {}) {
  return equipped?.sp || null;
}
