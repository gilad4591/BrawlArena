/**
 * Cosmetics are ELEMENT-LOCKED and bought PER CHARACTER.
 *
 * Every fighter has a fixed signature element (characters.js `element`), and can
 * own+equip up to three cosmetics, each shown in that element's colour:
 *   - frame : ornate portrait border (character-select + HUD)
 *   - aura  : animated elemental energy ring around the fighter in battle
 *   - sp    : upgraded special-attack projectile look (glow + comet trail)
 *
 * There is no free theme choice — the element is decided by the character, so
 * you never get "fire on an ice fighter". Items are bought once per character
 * per slot with Coins.
 *
 * Storage:
 *   profile.cosmeticsOwned    = ['blaze:aura', 'frost:frame', ...]  ("charId:slot")
 *   profile.cosmeticsEquipped = { blaze: { aura:true }, frost:{ frame:true } }
 */

// The six elements (matches aura_/frame_ sheets + orb sprites).
export const ELEMENTS = {
  inferno: { name: 'Inferno', color: '#ff7a2b', orb: 'fire' },
  frost: { name: 'Frost', color: '#8fdcff', orb: 'ice' },
  storm: { name: 'Storm', color: '#a9c8ff', orb: 'lightning' },
  toxic: { name: 'Toxic', color: '#9dff45', orb: 'toxic' },
  divine: { name: 'Divine', color: '#ffe08a', orb: 'holy' },
  void: { name: 'Void', color: '#c06bff', orb: 'void' },
};

// Slots + flat per-character prices (frame cheapest, SP FX priciest).
export const COSMETIC_SLOTS = [
  { key: 'frame', name: 'Frame', price: 300 },
  { key: 'aura', name: 'Aura', price: 500 },
  { key: 'sp', name: 'Special FX', price: 700 },
];

export const SLOT_MAP = Object.fromEntries(COSMETIC_SLOTS.map((s) => [s.key, s]));

// Special-attack theme -> painted orb + trail colour, keyed by element so the
// Projectile renderer can recolour/re-orb a player's specials.
export const SP_THEME = Object.fromEntries(
  Object.entries(ELEMENTS).map(([k, v]) => [k, { orb: v.orb, color: v.color }]),
);

/** Signature element for a character (accepts the character object or an id). */
export function charElement(char) {
  if (!char) return 'inferno';
  return (typeof char === 'string' ? null : char.element) || 'inferno';
}

/** Storage id for a cosmetic (one per character per slot). */
export function cosmeticId(charId, slot) {
  return `${charId}:${slot}`;
}

/** Flat coin price for a slot. */
export function cosmeticPrice(slot) {
  return SLOT_MAP[slot]?.price || 0;
}

/** Does the profile own this character's cosmetic for the slot? */
export function ownsCosmetic(owned, charId, slot) {
  return (owned || []).includes(cosmeticId(charId, slot));
}

/** Is this character's slot cosmetic currently equipped? */
export function isEquipped(equipped, charId, slot) {
  return !!equipped?.[charId]?.[slot];
}
