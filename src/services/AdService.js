import { ADS } from './adsConfig.js';

/**
 * Cross-platform ad wrapper.
 *   - Native (Android/iOS via Capacitor): Google AdMob banner + interstitial.
 *   - Web (browser build): Google AdSense unit, or a neutral placeholder when
 *     no publisher ID is configured yet.
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
    this.enums = null;
    this._bannerVisible = false;
    this._matchCount = 0;
    this._interstitialReady = false;
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
      this.enums = {
        BannerAdSize: mod.BannerAdSize,
        BannerAdPosition: mod.BannerAdPosition,
      };
      await this.AdMob.initialize({
        initializeForTesting: ADS.useTestAds,
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
    this.container = document.getElementById('ad-banner');
    if (!this.container) return;
    const { adClient, adSlot } = ADS.web;
    if (adClient && adSlot) {
      // Inject the AdSense loader once.
      if (!document.getElementById('adsense-lib')) {
        const s = document.createElement('script');
        s.id = 'adsense-lib';
        s.async = true;
        s.crossOrigin = 'anonymous';
        s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${adClient}`;
        document.head.appendChild(s);
      }
      this.container.innerHTML = `
        <ins class="adsbygoogle" style="display:block;width:100%;height:100%"
          data-ad-client="${adClient}" data-ad-slot="${adSlot}"
          data-ad-format="horizontal" data-full-width-responsive="true"></ins>`;
      try {
        (window.adsbygoogle = window.adsbygoogle || []).push({});
      } catch {
        /* ignore */
      }
    } else {
      // No publisher configured yet — show a neutral, non-clickable slot.
      this.container.classList.add('placeholder');
      this.container.innerHTML = '<span>Advertisement</span>';
    }
    this.ready = true;
  }

  // ------------------------------------------------------------- public API
  /** Show the persistent banner (menus/lobbies). Safe to call repeatedly. */
  async showBanner() {
    if (this._bannerVisible) return;
    this._bannerVisible = true;
    if (this.native && this.AdMob) {
      try {
        await this.AdMob.showBanner({
          adId: this.cfg.banner,
          adSize: this.enums.BannerAdSize.ADAPTIVE_BANNER,
          position: this.enums.BannerAdPosition.BOTTOM_CENTER,
          margin: 0,
          isTesting: ADS.useTestAds,
        });
      } catch (err) {
        console.warn('[ads] showBanner failed:', err);
      }
    } else if (this.container) {
      this.container.classList.remove('hidden');
      document.body.classList.add('has-web-ad');
    }
  }

  /** Hide the banner (during a match, for a clean fighting screen). */
  async hideBanner() {
    if (!this._bannerVisible) return;
    this._bannerVisible = false;
    if (this.native && this.AdMob) {
      try {
        await this.AdMob.hideBanner();
      } catch {
        /* ignore */
      }
    } else if (this.container) {
      this.container.classList.add('hidden');
      document.body.classList.remove('has-web-ad');
    }
  }

  /**
   * Called when a match ends. Shows a full-screen interstitial every
   * `interstitialEveryMatches` matches (native only; web relies on the banner).
   */
  async onMatchFinished() {
    this._matchCount += 1;
    if (this._matchCount % ADS.interstitialEveryMatches !== 0) return;
    if (this.native && this.AdMob && this._interstitialReady) {
      try {
        await this.AdMob.showInterstitial();
      } catch (err) {
        console.warn('[ads] showInterstitial failed:', err);
      } finally {
        this._interstitialReady = false;
        this._prepareInterstitial(); // preload the next one
      }
    }
  }
}
