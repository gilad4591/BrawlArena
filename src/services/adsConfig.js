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
  useTestAds: true,

  // Show an interstitial after every N finished matches.
  interstitialEveryMatches: 3,

  android: {
    // Test App ID (also referenced in AndroidManifest for local testing):
    appId: 'ca-app-pub-3940256099942544~3347511713',
    banner: 'ca-app-pub-3940256099942544/6300978111',
    interstitial: 'ca-app-pub-3940256099942544/1033173712',
    rewarded: 'ca-app-pub-3940256099942544/5224354917',
  },

  ios: {
    appId: 'ca-app-pub-3940256099942544~1458002511',
    banner: 'ca-app-pub-3940256099942544/2934735716',
    interstitial: 'ca-app-pub-3940256099942544/4411468910',
    rewarded: 'ca-app-pub-3940256099942544/1712485313',
  },

  // AdSense (browser build). Leave empty to render a placeholder instead.
  web: {
    adClient: '', // e.g. 'ca-pub-1234567890123456'
    adSlot: '', // e.g. '1234567890'
  },
};
