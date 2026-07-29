import { asc } from './asc-api.mjs';

const vId = '1e55f8cb-4e27-4b63-88a5-334e56c1dcf4';

// The ASC "App Store Version" record was left at the default "1.0", but the
// actual Xcode project (and the already-built/signed IPA) reports
// MARKETING_VERSION 4.10.9 — these must match exactly for the build to be
// assignable to this version. Also declare IDFA usage (the app ships
// AdMob + NSUserTrackingUsageDescription, so it does use IDFA for ads).
try {
  const result = await asc('PATCH', `/v1/appStoreVersions/${vId}`, {
    data: {
      type: 'appStoreVersions',
      id: vId,
      attributes: { versionString: '4.10.9', usesIdfa: true },
    },
  });
  console.log('OK', JSON.stringify(result.data.attributes, null, 2));
} catch (e) {
  console.log('FAIL', e.status, JSON.stringify(e.body, null, 2));
}
