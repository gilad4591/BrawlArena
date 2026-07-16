import { StorageService } from './StorageService.js';
import {
  ALL_PRODUCT_IDS,
  ALL_CHARACTERS_ID,
  REMOVE_ADS_ID,
  PRODUCT_TO_CHARACTER,
  IAP,
} from './purchasesConfig.js';
import { PREMIUM_CHARACTERS } from '../game/characters.js';

/**
 * Cross-platform in-app purchases.
 *
 * Entitlements are NON-CONSUMABLE and are owned by the user's STORE ACCOUNT
 * (Google / Apple), not by an in-app login. So the flow is:
 *   - On launch we load the locally-cached owned set, then (native) ask the
 *     store which products this account already owns and merge them in.
 *   - "Restore Purchases" re-runs that query — required by the stores and enough
 *     for reinstalls / new devices on the same account. No backend needed.
 *
 * Runtime modes:
 *   - NATIVE + billing plugin installed  -> real purchases (adapter below).
 *   - WEB / dev (no store)               -> SIMULATED purchases so the whole UI
 *       and unlock flow can be exercised locally. Persisted the same way.
 *   - NATIVE without a billing plugin     -> purchases report "unavailable"
 *       (never grants for free), so shipping without the plugin is safe.
 *
 * To go live on Android:
 *   1. `npm i @capacitor-community/in-app-purchases` (or wire cordova-plugin-purchase),
 *      then `npx cap sync android`.
 *   2. Create the product IDs from purchasesConfig.js in Play Console.
 *   3. Implement the two TODO calls in `_loadNativeAdapter()` for your plugin.
 */
export class PurchaseService {
  constructor() {
    this.platform = 'web';
    this.native = false;
    this.owned = new Set();
    this.prices = {}; // productId -> localized price string (native)
    this.adapter = null; // native billing adapter, or null
    this._listeners = new Set();
  }

  async init() {
    try {
      const { Capacitor } = await import('@capacitor/core');
      this.platform = Capacitor.getPlatform();
      this.native = Capacitor.isNativePlatform();
    } catch {
      this.native = false;
    }

    // Locally-cached entitlements first (instant, offline-friendly).
    for (const id of await StorageService.getPurchases()) this.owned.add(id);

    if (this.native) {
      this.adapter = await this._loadNativeAdapter();
      if (this.adapter) {
        try {
          await this.adapter.init(ALL_PRODUCT_IDS);
          Object.assign(this.prices, await this.adapter.getPrices());
          for (const id of await this.adapter.getOwned()) this.owned.add(id);
          await this._persist();
        } catch (err) {
          console.warn('[iap] native init failed:', err);
        }
      }
    }
    this._emit();
  }

  // ------------------------------------------------------------- entitlements
  owns(productId) {
    return this.owned.has(productId);
  }

  ownsRemoveAds() {
    return this.owns(REMOVE_ADS_ID);
  }

  /** True if a specific premium character is unlocked (directly or via bundle). */
  ownsCharacter(charId) {
    if (this.owns(ALL_CHARACTERS_ID)) return true;
    const c = PREMIUM_CHARACTERS.find((p) => p.id === charId);
    return c ? this.owns(c.productId) : true; // non-premium chars are always "owned"
  }

  /** Character ids the player has actually purchased (for merging into unlocks). */
  ownedCharacterIds() {
    const all = this.owns(ALL_CHARACTERS_ID);
    return PREMIUM_CHARACTERS.filter((c) => all || this.owns(c.productId)).map((c) => c.id);
  }

  /** Localized (or fallback) price label for a product id. */
  priceFor(productId) {
    if (this.prices[productId]) return this.prices[productId];
    if (productId === REMOVE_ADS_ID) return IAP.removeAds.price;
    if (productId === ALL_CHARACTERS_ID) return IAP.allCharacters.price;
    return IAP.characterPrice;
  }

  /** Is real billing available on this platform? (false -> simulated on web). */
  get storeAvailable() {
    return !this.native || !!this.adapter;
  }

  // --------------------------------------------------------------- purchasing
  /** Returns { ok, error?, granted?: [ids] }. */
  async buy(productId) {
    if (this.owns(productId)) return { ok: true, granted: [] };

    if (this.native && !this.adapter) {
      return { ok: false, error: 'Billing is not available on this build.' };
    }

    if (this.native && this.adapter) {
      try {
        const res = await this.adapter.buy(productId);
        if (!res?.ok) return { ok: false, error: res?.error || 'Purchase cancelled.' };
      } catch (err) {
        return { ok: false, error: String(err?.message || err) };
      }
    }
    // Web/dev: simulated purchase (local only). Native success falls through here
    // to record the entitlement locally too.
    return this._grant(productId);
  }

  async restore() {
    if (this.native && this.adapter) {
      try {
        const ids = await this.adapter.restore();
        let added = 0;
        for (const id of ids) if (!this.owned.has(id)) { this.owned.add(id); added += 1; }
        await this._persist();
        this._emit();
        return { ok: true, restored: added };
      } catch (err) {
        return { ok: false, error: String(err?.message || err) };
      }
    }
    // Web/dev: nothing to restore beyond what's already local.
    this._emit();
    return { ok: true, restored: 0 };
  }

  async _grant(productId) {
    this.owned.add(productId);
    await this._persist();
    this._emit();
    const granted = [productId];
    if (productId === ALL_CHARACTERS_ID) {
      granted.push(...PREMIUM_CHARACTERS.map((c) => c.productId));
    }
    return { ok: true, granted };
  }

  async _persist() {
    await StorageService.savePurchases([...this.owned]);
  }

  // -------------------------------------------------------------- change feed
  onChange(fn) {
    this._listeners.add(fn);
    return () => this._listeners.delete(fn);
  }

  _emit() {
    for (const fn of this._listeners) {
      try {
        fn(this);
      } catch {
        /* ignore */
      }
    }
  }

  // ------------------------------------------------------------- native glue
  /**
   * Attempt to load a native billing plugin and return an adapter, or null if
   * none is installed. The adapter shape is:
   *   { init(ids), getPrices()->{id:price}, getOwned()->[ids], buy(id)->{ok,error?}, restore()->[ids] }
   */
  async _loadNativeAdapter() {
    try {
      // The specifier is assembled at runtime + marked @vite-ignore so the
      // bundler doesn't try to resolve (and fail on) a plugin that isn't
      // installed yet. Once you `npm i @capacitor-community/in-app-purchases`
      // this import resolves and real billing activates automatically.
      const specifier = ['@capacitor-community', 'in-app-purchases'].join('/');
      const mod = await import(/* @vite-ignore */ specifier).catch(() => null);
      if (!mod) return null;
      const IAP_PLUGIN = mod.InAppPurchases || mod.default || mod;
      const cache = { products: {}, owned: new Set() };
      return {
        async init(ids) {
          // TODO(store): confirm this matches your installed plugin's API.
          const { products } = await IAP_PLUGIN.getProducts({ productIds: ids });
          for (const p of products || []) cache.products[p.id || p.productId] = p;
        },
        async getPrices() {
          const out = {};
          for (const [id, p] of Object.entries(cache.products)) {
            out[id] = p.price || p.priceString || p.localizedPrice;
          }
          return out;
        },
        async getOwned() {
          const { purchases } = await IAP_PLUGIN.restorePurchases?.() || {};
          const ids = (purchases || []).map((x) => x.productId || x.id);
          ids.forEach((i) => cache.owned.add(i));
          return ids;
        },
        async buy(productId) {
          const res = await IAP_PLUGIN.purchaseProduct({ productId });
          const ok = !!(res && (res.transactionId || res.purchase || res.success));
          if (ok) cache.owned.add(productId);
          return { ok, error: ok ? undefined : 'cancelled' };
        },
        async restore() {
          const { purchases } = await IAP_PLUGIN.restorePurchases?.() || {};
          return (purchases || []).map((x) => x.productId || x.id);
        },
      };
    } catch (err) {
      console.warn('[iap] no native billing plugin:', err);
      return null;
    }
  }
}
