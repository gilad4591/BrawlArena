import { asc } from './asc-api.mjs';

const APP_ID = '6795069080';
const APP_INFO_ID = '7d9c7d47-c7b0-4cf7-b126-ec951b896445';

try {
  const info = await asc('GET', `/v1/appInfos/${APP_INFO_ID}`);
  console.log('APP INFO RELATIONSHIPS', Object.keys(info.data.relationships));
} catch (e) { console.log('INFO ERR', e.status, JSON.stringify(e.body)); }

try {
  const age = await asc('GET', `/v1/appInfos/${APP_INFO_ID}/ageRatingDeclaration`);
  console.log('AGE RATING (via appInfo)', JSON.stringify(age.data?.attributes, null, 2));
} catch (e) { console.log('AGE ERR', e.status, JSON.stringify(e.body)); }

try {
  const price = await asc('GET', `/v1/apps/${APP_ID}/appPriceSchedule`);
  console.log('APP PRICE SCHEDULE v1', JSON.stringify(price.data, null, 2));
} catch (e) { console.log('PRICE ERR v1', e.status, JSON.stringify(e.body)); }

try {
  const avail = await asc('GET', `/v1/apps/${APP_ID}/availableTerritories?limit=5`);
  console.log('APP AVAIL TERRITORIES total', avail.meta?.paging?.total);
} catch (e) { console.log('AVAIL ERR', e.status, JSON.stringify(e.body)); }
