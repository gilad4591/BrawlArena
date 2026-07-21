import { ADS } from './adsConfig.js';

/**
 * Cross-platform ad wrapper.
 *   - Native (Android/iOS via Capacitor): Google AdMob interstitial.
 *   - Web (browser build): a full-screen interstitial overlay hosting a Google
 *     AdSense unit (or a neutral placeholder until a slot is configured).
 *
 * We intentionally DON'T draw a persistent banner: it eats scarce vertical
 * space on phones in landscape and covers UI. Instead an interstitial pops up
 * every few finished matches, which reads cleaner on mobile.
 *
 * The rest of the app talks to this one class and never touches AdMob/AdSense
 * directly, so the game keeps working even when ads fail to load or a platform
 * has no ad SDK.
 */
export class AdService {
  constructor() {
    this.ready = false;
    this.native = false;
    this.platform = 'web';
    this.AdMob = null;
    this._matchCount = 0;
    this._interstitialReady = false;
    this._overlay = null;
    this._closeTimer = null;
    this.purchases = null;
  }

  /** Wire the purchase service so we can honor the "Remove Ads" entitlement. */
  setPurchases(purchases) {
    this.purchases = purchases;
  }

  async init() {
    try {
      const { Capacitor } = await import('@capacitor/core');
      this.platform = Capacitor.getPlatform();
      this.native = Capacitor.isNativePlatform();
    } catch {
      this.native = false;
    }

    if (this.native) {
      await this._initNative();
    } else {
      this._initWeb();
    }
  }

  get cfg() {
    return ADS[this.platform] || ADS.android;
  }

  // ----------------------------------------------------------------- native
  async _initNative() {
    try {
      const mod = await import('@capacitor-community/admob');
      this.AdMob = mod.AdMob;
      await this.AdMob.initialize({
        initializeForTesting: ADS.useTestAds,
        testingDevices: ADS.testDeviceIds || [],
      });
      this.ready = true;
      this._prepareInterstitial();
    } catch (err) {
      console.warn('[ads] AdMob init failed:', err);
    }
  }

  async _prepareInterstitial() {
    if (!this.native || !this.AdMob) return;
    try {
      await this.AdMob.prepareInterstitial({
        adId: this.cfg.interstitial,
        isTesting: ADS.useTestAds,
      });
      this._interstitialReady = true;
    } catch (err) {
      this._interstitialReady = false;
      console.warn('[ads] prepareInterstitial failed:', err);
    }
  }

  // -------------------------------------------------------------------- web
  _initWeb() {
    // Make sure the AdSense loader is present (index.html includes it, but keep
    // this resilient for standalone embeds). The unit itself is created lazily
    // inside the interstitial overlay.
    const { adClient } = ADS.web;
    if (adClient && !document.getElementById('adsense-lib')) {
      const s = document.createElement('script');
      s.id = 'adsense-lib';
      s.async = true;
      s.crossOrigin = 'anonymous';
      s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${adClient}`;
      document.head.appendChild(s);
    }
    // Ask Google's H5 Games Ads to preload interstitials so the between-matches
    // adBreak() can show instantly. Safe no-op if the API isn't available.
    try {
      window.adConfig?.({ preloadAdBreaks: 'on', sound: 'on' });
    } catch {
      /* ignore */
    }
    this.ready = true;
  }

  // ------------------------------------------------------------- public API
  // Banners are gone; keep these as no-ops so existing callers stay happy.
  async showBanner() {}
  async hideBanner() {}

  /**
   * Called when a match ends. Shows a full-screen interstitial every
   * `interstitialEveryMatches` matches.
   */
  async onMatchFinished() {
    if (this.purchases?.ownsRemoveAds()) return; // paid to remove ads
    this._matchCount += 1;
    if (this._matchCount % ADS.interstitialEveryMatches !== 0) return;
    if (this.native) {
      await this._showNativeInterstitial();
    } else {
      this._showWebInterstitial();
    }
  }

  async _showNativeInterstitial() {
    if (!this.AdMob || !this._interstitialReady) return;
    try {
      await this.AdMob.showInterstitial();
    } catch (err) {
      console.warn('[ads] showInterstitial failed:', err);
    } finally {
      this._interstitialReady = false;
      this._prepareInterstitial(); // preload the next one
    }
  }

  /**
   * Web interstitial between matches. Prefers Google's built-in H5 Games Ads
   * (adBreak) — a full-screen ad managed entirely by Google, shown only between
   * gameplay, with no ad-unit slot to configure.
   *
   * Crucially it FALLS BACK to our own overlay whenever Google doesn't actually
   * render an ad: the script is blocked by an ad-blocker (very common), the SDK
   * hasn't loaded yet, or there's simply no fill. Without this the player would
   * just see nothing. We detect "no ad shown" via the adBreakDone status and a
   * short watchdog timer (adBreakDone never fires when the SDK is blocked).
   */
  _showWebInterstitial() {
    if (this._overlay) return; // manual overlay already open

    if (typeof window.adBreak === 'function') {
      let adShown = false;
      let settled = false;
      const finish = (showFallback) => {
        if (settled) return;
        settled = true;
        clearTimeout(watchdog);
        this._muteForAd?.(false);
        if (showFallback && !adShown) this._showOverlayInterstitial();
      };
      // If the SDK is blocked/not loaded, adBreakDone never fires — so after a
      // beat with nothing shown we surface our own overlay instead.
      const watchdog = setTimeout(() => finish(true), 1800);
      try {
        window.adBreak({
          type: 'next', // an ad "between levels" — here, between matches
          name: 'match_end',
          beforeAd: () => {
            adShown = true;
            clearTimeout(watchdog);
            this._muteForAd?.(true);
          },
          afterAd: () => this._muteForAd?.(false),
          adBreakDone: (info) => {
            const st = info && info.breakStatus;
            // 'viewed'/'dismissed' => a real ad played; anything else (noAd*,
            // frequencyCapped, error, notReady…) => show our fallback overlay.
            finish(st !== 'viewed' && st !== 'dismissed');
          },
        });
        return;
      } catch {
        clearTimeout(watchdog);
        /* fall through to the manual overlay */
      }
    }
    this._showOverlayInterstitial();
  }

  // ---- fallback web interstitial: a dismissible full-screen modal ----
  _showOverlayInterstitial() {
    if (this._overlay) return; // already open
    const { adClient, adSlot } = ADS.web;
    const overlay = document.createElement('div');
    overlay.className = 'ad-interstitial';
    overlay.innerHTML = `
      <div class="adi-card">
        <div class="adi-label">Advertisement</div>
        <div class="adi-slot" id="adi-slot">${
          adClient && adSlot
            ? `<ins class="adsbygoogle" style="display:inline-block;width:300px;height:250px"
                 data-ad-client="${adClient}" data-ad-slot="${adSlot}"></ins>`
            : '<span class="adi-placeholder">Your ad could be here</span>'
        }</div>
        <button class="adi-close" id="adi-close" disabled>Skip in <b>5</b></button>
      </div>`;
    document.body.appendChild(overlay);
    this._overlay = overlay;

    if (adClient && adSlot) {
      try {
        (window.adsbygoogle = window.adsbygoogle || []).push({});
      } catch {
        /* ignore */
      }
      // AdSense on a fresh account (and inside an auto-popup) very often returns
      // "unfilled" → a blank box. Watch for that and swap in a branded house
      // promo so the player never stares at an empty "Advertisement" card.
      const ins = overlay.querySelector('ins.adsbygoogle');
      const checkFill = () => {
        if (this._overlay !== overlay) return;
        const unfilled = ins?.getAttribute('data-ad-status') === 'unfilled';
        const empty = !ins || ins.offsetHeight < 40 || ins.childElementCount === 0;
        if (unfilled || empty) this._renderHouseAd(overlay);
      };
      setTimeout(checkFill, 1600);
    } else {
      this._renderHouseAd(overlay);
    }

    const btn = overlay.querySelector('#adi-close');
    const num = btn.querySelector('b');
    let left = 5;
    this._closeTimer = setInterval(() => {
      left -= 1;
      if (left <= 0) {
        clearInterval(this._closeTimer);
        this._closeTimer = null;
        btn.disabled = false;
        btn.textContent = 'Continue ✕';
      } else if (num) {
        num.textContent = String(left);
      }
    }, 1000);

    const close = () => this._closeWebInterstitial();
    btn.addEventListener('click', () => { if (!btn.disabled) close(); });
    // Fallback auto-dismiss so the overlay can never trap the player.
    setTimeout(() => { if (this._overlay === overlay) { btn.disabled = false; close(); } }, 15000);
  }

  /**
   * Swap the interstitial slot for a branded house promo. Used when no real ad
   * fills (blocked, no fill, or no slot configured) so the popup always looks
   * intentional instead of an empty "Advertisement" box.
   */
  _renderHouseAd(overlay) {
    if (!overlay || this._overlay !== overlay) return;
    const slot = overlay.querySelector('#adi-slot');
    if (!slot || slot.dataset.house === '1') return;
    slot.dataset.house = '1';
    const label = overlay.querySelector('.adi-label');
    if (label) label.style.display = 'none';
    slot.innerHTML = `
      <div class="adi-house">
        <img src="/icons/icon-192.png?v=3" alt="" width="72" height="72" />
        <div class="adi-house-title">BRAWL <span>ARENA</span></div>
        <div class="adi-house-sub">More fighters &amp; arenas coming soon</div>
      </div>`;
  }

  _closeWebInterstitial() {
    if (this._closeTimer) { clearInterval(this._closeTimer); this._closeTimer = null; }
    if (this._overlay) {
      this._overlay.classList.add('closing');
      const el = this._overlay;
      this._overlay = null;
      setTimeout(() => el.remove(), 220);
    }
  }
}
