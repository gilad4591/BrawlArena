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
 * `price` here is only a FALLBACK label; when the native billing plugin is
 * wired the real localized price from the store replaces it.
 */
export const REMOVE_ADS_ID = 'remove_ads';
export const ALL_CHARACTERS_ID = 'all_characters';

export const IAP = {
  removeAds: {
    id: REMOVE_ADS_ID,
    title: 'Remove Ads',
    desc: 'No more interstitials — ever.',
    price: '$2.99',
  },
  allCharacters: {
    id: ALL_CHARACTERS_ID,
    title: 'All Premium Fighters',
    desc: 'Unlock every premium fighter at once.',
    price: '$5.99',
  },
  // Default per-character price (store price overrides on native).
  characterPrice: '$1.99',
};

// Product id -> the character id it unlocks (built from the roster).
export const PRODUCT_TO_CHARACTER = Object.fromEntries(
  PREMIUM_CHARACTERS.map((c) => [c.productId, c.id]),
);

// Every product id the game knows about (used to query/restore the store).
export const ALL_PRODUCT_IDS = [
  REMOVE_ADS_ID,
  ALL_CHARACTERS_ID,
  ...PREMIUM_CHARACTERS.map((c) => c.productId),
];
