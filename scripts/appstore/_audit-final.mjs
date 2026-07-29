import { asc } from './asc-api.mjs';

const APP_ID = '6795069080';
const APP_INFO_ID = '7d9c7d47-c7b0-4cf7-b126-ec951b896445';

try {
  const mp = await asc('GET', `/v1/appPriceSchedules/${APP_ID}/manualPrices`);
  console.log('APP MANUAL PRICES', JSON.stringify(mp.data, null, 2));
} catch (e) { console.log('PRICE ERR', e.status, JSON.stringify(e.body)); }

try {
  const cat = await asc('GET', `/v1/appInfos/${APP_INFO_ID}/primaryCategory`);
  console.log('PRIMARY CATEGORY', JSON.stringify(cat.data?.attributes ?? cat.data, null, 2));
} catch (e) { console.log('CAT ERR', e.status, JSON.stringify(e.body)); }

try {
  const infoLoc = await asc('GET', `/v1/appInfos/${APP_INFO_ID}/appInfoLocalizations`);
  console.log('APP INFO LOCALIZATIONS', JSON.stringify(infoLoc.data.map((l) => ({ locale: l.attributes.locale, name: l.attributes.name, subtitle: l.attributes.subtitle, privacyPolicyUrl: l.attributes.privacyPolicyUrl })), null, 2));
} catch (e) { console.log('INFOLOC ERR', e.status, JSON.stringify(e.body)); }
