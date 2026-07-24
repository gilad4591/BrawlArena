import { StorageService } from './StorageService.js';
import {
  ALL_PRODUCT_IDS,
  ALL_STORE_IDS,
  COIN_PACK_IDS,
  ALL_CHARACTERS_ID,
  ARENA_PACK_ID,
  REMOVE_ADS_ID,
  PRODUCT_TO_CHARACTER,
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
 * To go live on Android (no backend / no third-party account needed):
 *   1. `npm i @capgo/native-purchases` then `npx cap sync android`.
 *      (@capgo/native-purchases talks directly to Google Play Billing.)
 *   2. Create the product IDs from purchasesConfig.js in Play Console as
 *      one-time (managed) products, then activate them.
 *   3. Nothing else — `_loadNativeAdapter()` below already wires the plugin.
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
          await this.adapter.init(ALL_STORE_IDS);
          Object.assign(this.prices, await this.adapter.getPrices());
          // Only NON-consumable entitlements are restored as "owned"; coin packs
          // are consumables and must never be treated as a permanent unlock.
          for (const id of await this.adapter.getOwned()) {
            if (!COIN_PACK_IDS.includes(id)) this.owned.add(id);
          }
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

  /** True if the premium arena pack has been purchased. */
  ownsArenas() {
    return this.owns(ARENA_PACK_ID);
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

  /**
   * Localized price label for a product id — ONLY when the store (Google Play /
   * App Store) has actually reported one. Returns '' otherwise, so we never
   * show a made-up placeholder price before the real store price is available.
   */
  priceFor(productId) {
    return this.prices[productId] || '';
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

  /**
   * Buy a CONSUMABLE coin pack (mobile only). Coins are granted by the caller
   * on { ok:true }; nothing is added to the owned entitlement set. On web/dev
   * there is no store, so this reports unavailable (web stays coins-only).
   */
  async buyCoins(packId) {
    if (!this.native || !this.adapter) {
      return { ok: false, error: 'Coin packs are only available in the app.' };
    }
    try {
      const res = await this.adapter.buyConsumable(packId);
      return res?.ok ? { ok: true } : { ok: false, error: res?.error || 'Purchase cancelled.' };
    } catch (err) {
      return { ok: false, error: String(err?.message || err) };
    }
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
      // Import normally so Vite BUNDLES the plugin's JS bridge into the app —
      // inside the native WebView a bare specifier can't be resolved at runtime,
      // so the previous @vite-ignore approach left the adapter null ("Store not
      // available"). The plugin is a dependency now, so this builds cleanly and
      // is only ever *called* on native (guarded by `this.native`).
      const mod = await import('@capgo/native-purchases').catch(() => null);
      if (!mod) return null;
      const NativePurchases = mod.NativePurchases || mod.default || mod;
      // All our products are one-time (managed) in-app products, not subs.
      const INAPP = (mod.PURCHASE_TYPE && mod.PURCHASE_TYPE.INAPP) || 'inapp';

      // Bail out cleanly on emulators / devices without Play billing.
      if (NativePurchases.isBillingSupported) {
        const s = await NativePurchases.isBillingSupported().catch(() => ({}));
        if (!s?.isBillingSupported) return null;
      }

      const idOf = (x) => x?.productIdentifier || x?.productId || x?.identifier;
      const cache = { products: {} };
      return {
        async init(ids) {
          const { products } = await NativePurchases.getProducts({
            productIdentifiers: ids,
            productType: INAPP,
          });
          for (const p of products || []) cache.products[p.identifier || p.id] = p;
        },
        async getPrices() {
          const out = {};
          for (const [id, p] of Object.entries(cache.products)) {
            out[id] = p.priceString || p.displayPrice || p.price || '';
          }
          return out;
        },
        async getOwned() {
          const { purchases } = (await NativePurchases.getPurchases({ productType: INAPP }).catch(
            () => ({ purchases: [] }),
          )) || { purchases: [] };
          return (purchases || []).map(idOf).filter(Boolean);
        },
        async buy(productId) {
          try {
            const res = await NativePurchases.purchaseProduct({
              productIdentifier: productId,
              productType: INAPP,
            });
            const ok = !!(res && res.transactionId);
            return { ok, error: ok ? undefined : 'Purchase cancelled.' };
          } catch (err) {
            return { ok: false, error: String(err?.message || err) };
          }
        },
        async buyConsumable(productId) {
          try {
            const res = await NativePurchases.purchaseProduct({
              productIdentifier: productId,
              productType: INAPP,
              // This is the actual documented flag for @capgo/native-purchases
              // (Android): without it the purchase is left as a normal owned
              // in-app item, and Google Play blocks buying the SAME coin pack
              // again ("item already owned") until it's consumed. `quantity`
              // (previously used here) does nothing for this — it only
              // affects iOS.
              isConsumable: true,
            });
            const ok = !!(res && (res.transactionId || res.purchaseToken));
            // Belt-and-suspenders: also explicitly consume via the purchase
            // token. Redundant when isConsumable already handled it, but a
            // harmless no-op/soft-fail in that case (caught below) — and a
            // real safety net if a plugin/platform quirk didn't auto-consume.
            const token = res?.purchaseToken || res?.transactionId;
            if (ok && token) {
              try {
                await NativePurchases.consumePurchase?.({ purchaseToken: token });
              } catch { /* ignore — already consumed, or verified on next query */ }
            }
            return { ok, error: ok ? undefined : 'Purchase cancelled.' };
          } catch (err) {
            return { ok: false, error: String(err?.message || err) };
          }
        },
        async restore() {
          try {
            await NativePurchases.restorePurchases?.();
          } catch {
            /* ignore — we re-query owned state below */
          }
          const { purchases } = (await NativePurchases.getPurchases({ productType: INAPP }).catch(
            () => ({ purchases: [] }),
          )) || { purchases: [] };
          return (purchases || []).map(idOf).filter(Boolean);
        },
      };
    } catch (err) {
      console.warn('[iap] no native billing plugin:', err);
      return null;
    }
  }
}
