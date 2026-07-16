import { PREMIUM_CHARACTERS } from '../game/characters.js';

/**
 * In-app purchase catalog.
 *
 * These IDs must EXACTLY match the product IDs you create in the store consoles:
 *   - Google Play Console  -> Monetize -> Products -> In-app products
 *   - App Store Connect     -> your app -> In-App Purchases
 *
 * All of these are NON-CONSUMABLE (bought once, owned forever, restorable via
 * the user's store account). No custom login/backend is required for that —
 * the store account IS the identity. See PurchaseService for details.
 *
 * Prices are intentionally NOT defined here — they are shown ONLY when the real
 * store (Google Play / App Store) reports a localized price for the account's
 * region. Until then the UI shows a neutral "Unlock" CTA, never a placeholder.
 */
export const REMOVE_ADS_ID = 'remove_ads';
export const ALL_CHARACTERS_ID = 'all_characters';
export const ARENA_PACK_ID = 'arena_pack';

export const IAP = {
  removeAds: {
    id: REMOVE_ADS_ID,
    title: 'Remove Ads',
    desc: 'No more interstitials — ever.',
  },
  allCharacters: {
    id: ALL_CHARACTERS_ID,
    title: 'All Premium Fighters',
    desc: 'Unlock every premium fighter at once.',
  },
  arenaPack: {
    id: ARENA_PACK_ID,
    title: 'Premium Arenas',
    desc: 'Unlock every premium battle arena.',
  },
};

// Product id -> the character id it unlocks (built from the roster).
export const PRODUCT_TO_CHARACTER = Object.fromEntries(
  PREMIUM_CHARACTERS.map((c) => [c.productId, c.id]),
);

// Every product id the game knows about (used to query/restore the store).
export const ALL_PRODUCT_IDS = [
  REMOVE_ADS_ID,
  ALL_CHARACTERS_ID,
  ARENA_PACK_ID,
  ...PREMIUM_CHARACTERS.map((c) => c.productId),
];
