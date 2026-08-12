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
    this._interstitialsShown = 0; // how many interstitials actually displayed
    this._overlay = null;
    this._closeTimer = null;
    this.purchases = null;
  }

  /** How many interstitials we've actually shown this session (for nudges). */
  get interstitialsShown() {
    return this._interstitialsShown;
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

  /**
   * Ad diagnostics — answers "why did I get the fallback instead of a real
   * ad?" without needing devtools/remote-debugging on a phone. Always logs
   * to the console; ALSO keeps an on-screen, scrollable LOG (not a single
   * message that flashes and vanishes) when debug mode is on, since a phone
   * browser usually has no console visible and a single fading toast is too
   * easy to miss/impossible to re-read. Enable with `?addebug=1` in the URL
   * once — it's remembered via localStorage after that. Disable the same
   * way with `?addebug=0`. Tap the badge's "✕" to dismiss it; it reappears
   * on the next ad event.
   */
  _adDebug(msg) {
    console.info('[ads]', msg);
    try {
      const params = new URLSearchParams(location.search);
      if (params.has('addebug')) localStorage.setItem('adDebug', params.get('addebug'));
      if (localStorage.getItem('adDebug') !== '1') return;
    } catch {
      return;
    }
    this._adDebugLog = this._adDebugLog || [];
    const time = new Date().toLocaleTimeString();
    this._adDebugLog.push(`[${time}] ${msg}`);
    if (this._adDebugLog.length > 10) this._adDebugLog.shift();

    let el = document.getElementById('ad-debug-badge');
    if (!el) {
      el = document.createElement('div');
      el.id = 'ad-debug-badge';
      el.style.cssText = 'position:fixed;left:8px;bottom:8px;right:8px;z-index:99999;'
        + 'max-height:40vh;overflow-y:auto;padding:8px 10px;border-radius:10px;'
        + 'font:11px/1.5 monospace;background:rgba(0,0,0,0.92);color:#7ee0ff;'
        + 'border:1px solid rgba(255,255,255,0.25);white-space:pre-wrap;'
        + '-webkit-overflow-scrolling:touch;';
      const close = document.createElement('button');
      close.textContent = '✕ close log';
      close.style.cssText = 'display:block;margin-bottom:6px;padding:4px 10px;'
        + 'border-radius:6px;border:1px solid rgba(255,255,255,0.3);background:rgba(255,255,255,0.08);'
        + 'color:#fff;font:11px/1 monospace;';
      close.addEventListener('click', () => { el.classList.add('hidden-ad-debug'); el.style.display = 'none'; });
      const list = document.createElement('div');
      list.id = 'ad-debug-list';
      el.appendChild(close);
      el.appendChild(list);
      document.body.appendChild(el);
    }
    el.style.display = 'block';
    el.querySelector('#ad-debug-list').textContent = this._adDebugLog.join('\n\n');
    el.scrollTop = el.scrollHeight;
  }

  // ----------------------------------------------------------------- native
  async _initNative() {
    try {
      const mod = await import('@capacitor-community/admob');
      this.AdMob = mod.AdMob;
      // iOS App Tracking Transparency FIRST, before the Mobile Ads SDK starts
      // (Apple/Google's documented order — see _requestTrackingAuthorization).
      await this._requestTrackingAuthorization();
      await this.AdMob.initialize({
        initializeForTesting: ADS.useTestAds,
        testingDevices: ADS.testDeviceIds || [],
      });
      this.ready = true;
      await this._requestConsentForm();
      this._prepareInterstitial();
    } catch (err) {
      console.warn('[ads] AdMob init failed:', err);
    }
  }

  /**
   * iOS App Tracking Transparency. Two things matter here, both learned from
   * an App Review rejection (Guideline 2.1 — "unable to locate the App
   * Tracking Transparency permission request"):
   *   1. Order: request it BEFORE initializing the Mobile Ads SDK, not after
   *      — Apple requires the prompt to appear before any tracking-eligible
   *      data collection starts, and Google's own docs recommend the same
   *      order.
   *   2. Timing: this fires during `bootstrap()`, within milliseconds of the
   *      WKWebView's JS starting — often before the app is genuinely
   *      foregrounded/`.active` on a cold launch (still mid-transition from
   *      the launch screen). Requesting ATT in that window makes iOS
   *      silently skip showing the system dialog at all (no error — the
   *      completion handler still resolves) instead of queuing it, which is
   *      exactly the symptom App Review reported. A short settle delay gives
   *      the launch transition time to finish first.
   */
  async _requestTrackingAuthorization() {
    if (this.platform !== 'ios' || !this.AdMob?.trackingAuthorizationStatus) return;
    try {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const tracking = await this.AdMob.trackingAuthorizationStatus();
      if (tracking?.status === 'notDetermined') {
        await this.AdMob.requestTrackingAuthorization();
      }
    } catch (err) {
      console.warn('[ads] ATT request failed:', err);
    }
  }

  /** GDPR (UMP) consent form — best-effort, never blocks ads entirely. */
  async _requestConsentForm() {
    if (!this.AdMob) return;
    try {
      const consentInfo = await this.AdMob.requestConsentInfo();
      if (consentInfo?.isConsentFormAvailable && !consentInfo.canRequestAds) {
        await this.AdMob.showConsentForm();
      }
    } catch (err) {
      console.warn('[ads] consent info failed:', err);
    }
  }

  /** Re-open the privacy/consent choices (for a "Privacy Options" settings link). */
  async showPrivacyOptions() {
    if (!this.native || !this.AdMob?.showPrivacyOptionsForm) return;
    try {
      await this.AdMob.showPrivacyOptionsForm();
    } catch (err) {
      console.warn('[ads] showPrivacyOptionsForm failed:', err);
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
    this._interstitialsShown += 1;
    if (this.native) {
      await this._showNativeInterstitial();
    } else {
      await this._showWebInterstitial();
    }
  }

  /**
   * Show a rewarded ad. Resolves `true` only if the reward was earned (ad fully
   * watched), `false` otherwise. On web we prefer H5 rewarded adBreak and fall
   * back to our dismissible overlay (granting on close, since there's no real
   * reward SDK to verify). Callers grant the bonus only on `true`.
   */
  async showRewarded() {
    if (this.native) return this._showNativeRewarded();
    return this._showWebRewarded();
  }

  async _showNativeRewarded() {
    if (!this.AdMob) return false;
    try {
      await this.AdMob.prepareRewardVideoAd({
        adId: this.cfg.rewarded,
        isTesting: ADS.useTestAds,
      });
      const item = await this.AdMob.showRewardVideoAd();
      return !!item; // reward item present => reward earned
    } catch (err) {
      console.warn('[ads] rewarded failed:', err);
      return false;
    }
  }

  _showWebRewarded() {
    if (this._overlay) return Promise.resolve(false);
    return new Promise((resolve) => {
      if (typeof window.adBreak === 'function') {
        let granted = false;
        let settled = false;
        const finish = (ok) => {
          if (settled) return;
          settled = true;
          clearTimeout(watchdog);
          this._muteForAd?.(false);
          if (!ok && !granted) {
            this._adDebug('rewarded: no real ad filled -> fallback overlay (reward still granted on close)');
            // No real rewarded ad filled — offer the fallback overlay and grant
            // on close so the player still gets the reward they opted into.
            this._showOverlayInterstitial(() => resolve(true));
          } else {
            this._adDebug('rewarded: real ad viewed');
            resolve(true);
          }
        };
        const watchdog = setTimeout(() => finish(false), 1800);
        try {
          window.adBreak({
            type: 'reward',
            name: 'reward',
            beforeReward: (showAdFn) => {
              clearTimeout(watchdog);
              this._muteForAd?.(true);
              showAdFn();
            },
            afterAd: () => this._muteForAd?.(false),
            adViewed: () => {
              granted = true;
            },
            adDismissed: () => finish(granted),
            adBreakDone: () => finish(granted),
          });
          return;
        } catch (err) {
          clearTimeout(watchdog);
          this._adDebug(`rewarded: adBreak() threw (${err?.message}) -> fallback`);
        }
      } else {
        this._adDebug('rewarded: window.adBreak is not a function (script blocked/not loaded) -> fallback');
      }
      this._showOverlayInterstitial(() => resolve(true));
    });
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
  /**
   * Resolves only once the interstitial is fully done (ad viewed/dismissed, or
   * the fallback overlay closed, or immediately if nothing can be shown). The
   * caller (game) awaits this before starting a rematch, so an ad can never
   * pop up on top of the next match.
   */
  _showWebInterstitial() {
    if (this._overlay) return Promise.resolve(); // manual overlay already open

    return new Promise((resolve) => {
      if (typeof window.adBreak === 'function') {
        let adShown = false;
        let settled = false;
        const finish = (showFallback, reason) => {
          if (settled) return;
          settled = true;
          clearTimeout(watchdog);
          this._muteForAd?.(false);
          if (showFallback && !adShown) {
            this._adDebug(`interstitial: no real ad (${reason}) -> showing fallback`);
            this._showOverlayInterstitial(resolve);
          } else {
            this._adDebug(`interstitial: real ad shown (${reason})`);
            resolve();
          }
        };
        // If the SDK is blocked/not loaded, adBreakDone never fires — so after a
        // beat with nothing shown we surface our own overlay instead.
        const watchdog = setTimeout(() => finish(true, 'timeout — adBreak never called beforeAd, likely blocked or still loading'), 1800);
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
              finish(st !== 'viewed' && st !== 'dismissed', `breakStatus=${st}`);
            },
          });
          return;
        } catch (err) {
          clearTimeout(watchdog);
          this._adDebug(`interstitial: adBreak() threw (${err?.message}) -> fallback`);
          /* fall through to the manual overlay */
        }
      } else {
        this._adDebug('interstitial: window.adBreak is not a function (script blocked/not loaded) -> fallback');
      }
      this._showOverlayInterstitial(resolve);
    });
  }

  // ---- fallback web interstitial: a dismissible full-screen modal ----
  _showOverlayInterstitial(onDone) {
    if (this._overlay) { onDone?.(); return; } // already open
    this._onOverlayDone = onDone || null;
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
        const status = ins?.getAttribute('data-ad-status');
        const unfilled = status === 'unfilled';
        const empty = !ins || ins.offsetHeight < 40 || ins.childElementCount === 0;
        if (unfilled || empty) {
          this._adDebug(`display unit: data-ad-status=${status ?? '(none)'}, height=${ins?.offsetHeight ?? 0}px -> house promo`);
          this._renderHouseAd(overlay);
        } else {
          this._adDebug(`display unit filled: data-ad-status=${status}`);
        }
      };
      setTimeout(checkFill, 1600);
    } else {
      this._adDebug('display unit: no adClient/adSlot configured -> house promo');
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
    const done = this._onOverlayDone;
    this._onOverlayDone = null;
    done?.();
  }
}
