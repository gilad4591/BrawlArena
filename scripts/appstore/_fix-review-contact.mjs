// One-off: creates the App Store review contact info for the 4.10.9
// version. Apple blocked "Add for Review" with "You must complete the
// Contact Information section" until this existed.
import { asc } from './asc-api.mjs';

const APP_STORE_VERSION_ID = '1e55f8cb-4e27-4b63-88a5-334e56c1dcf4'; // 4.10.9

try {
  const res = await asc('POST', '/v1/appStoreReviewDetails', {
    data: {
      type: 'appStoreReviewDetails',
      attributes: {
        contactFirstName: 'Gilad',
        contactLastName: 'Cohen',
        contactPhone: '+972524567416',
        contactEmail: 'gilad4591@gmail.com',
        demoAccountRequired: false,
        notes: 'No login/account is required to play Brawl Arena -- all gameplay, characters, and modes are available immediately. In-app purchases (cosmetics/character unlocks) and rewarded/interstitial ads via Google AdMob are used.',
      },
      relationships: {
        appStoreVersion: { data: { type: 'appStoreVersions', id: APP_STORE_VERSION_ID } },
      },
    },
  });
  console.log('REVIEW DETAIL CREATED', JSON.stringify(res.data.attributes, null, 2));
} catch (e) {
  console.error('ERROR', e.status, JSON.stringify(e.body, null, 2));
}
