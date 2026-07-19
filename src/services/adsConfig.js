/**
 * Ad configuration for both platforms.
 *
 * The values below are Google's OFFICIAL TEST ad units — they show real "Test
 * Ad" placements and are safe to ship while you wait for your own AdMob /
 * AdSense accounts. Replace them with your production IDs before release and
 * flip `useTestAds` to false.
 *
 *  ANDROID (AdMob):
 *    1. Create an app at https://admob.google.com  ->  copy the App ID.
 *    2. Put the App ID in android/app/src/main/AndroidManifest.xml as
 *       <meta-data android:name="com.google.android.gms.ads.APPLICATION_ID"
 *                  android:value="ca-app-pub-XXXX~YYYY"/>
 *    3. Paste your banner / interstitial ad-unit IDs below.
 *
 *  WEB (AdSense):
 *    1. Get approved at https://adsense.google.com
 *    2. Set web.adClient = "ca-pub-XXXXXXXXXXXXXXXX" and web.adSlot = "123...".
 *    When these are empty the game shows a neutral "sponsored" placeholder so
 *    the layout still reserves the space.
 */
export const ADS = {
  // Global switch: while true, all placements use Google's test units.
  useTestAds: false,

  // Show an interstitial after every N finished matches.
  interstitialEveryMatches: 2,

  android: {
    // Production AdMob IDs for "Brawl Arena" (must match AndroidManifest).
    appId: 'ca-app-pub-9834744561471352~7947465285',
    banner: 'ca-app-pub-3940256099942544/6300978111', // unused (test)
    interstitial: 'ca-app-pub-9834744561471352/8169986248',
    rewarded: 'ca-app-pub-3940256099942544/5224354917', // unused (test)
  },

  ios: {
    appId: 'ca-app-pub-3940256099942544~1458002511',
    banner: 'ca-app-pub-3940256099942544/2934735716',
    interstitial: 'ca-app-pub-3940256099942544/4411468910',
    rewarded: 'ca-app-pub-3940256099942544/1712485313',
  },

  // AdSense (browser build). adClient is your publisher ID. adSlot is filled in
  // AFTER approval, once you create a Display ad unit (see notes at top of file).
  // Until adSlot is set, the interstitial shows a neutral placeholder card.
  web: {
    adClient: 'ca-pub-9834744561471352',
    adSlot: '', // paste the ad-unit slot id here after AdSense approves the site
  },
};
