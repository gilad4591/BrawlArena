/**
 * Cosmetic skins: per-fighter palette swaps built on the engine's existing
 * hue-rotate tint (see Fighter.tint). A skin is purely visual — bought with
 * Coins, equipped per character, and applied to the player fighter in-world.
 *
 * Skin id = `${charId}_${variant.key}`. The "default" variant is always owned
 * and free (tint 0 = the fighter's original colours).
 */
export const SKIN_VARIANTS = [
  { key: 'default', name: 'Original', tint: 0, price: 0 },
  { key: 'crimson', name: 'Crimson', tint: 330, price: 150 },
  { key: 'emerald', name: 'Emerald', tint: 110, price: 150 },
  { key: 'azure', name: 'Azure', tint: 210, price: 200 },
  { key: 'gold', name: 'Golden', tint: 45, price: 250 },
  { key: 'shadow', name: 'Shadow', tint: 270, price: 300 },
];

export const VARIANT_MAP = Object.fromEntries(SKIN_VARIANTS.map((v) => [v.key, v]));

export function skinId(charId, key) {
  return `${charId}_${key}`;
}

/** Split a stored skin id back into { charId, key }. */
export function parseSkinId(id) {
  const i = id.lastIndexOf('_');
  return { charId: id.slice(0, i), key: id.slice(i + 1) };
}

/** Hue-rotate degrees for a character's equipped skin (0 if none/default). */
export function equippedTint(charId, equippedSkins = {}) {
  const id = equippedSkins[charId];
  if (!id) return 0;
  const { key } = parseSkinId(id);
  return VARIANT_MAP[key]?.tint || 0;
}

/** Is a skin owned? "default" is always owned for free. */
export function ownsSkin(charId, key, ownedSkins = []) {
  return key === 'default' || ownedSkins.includes(skinId(charId, key));
}
