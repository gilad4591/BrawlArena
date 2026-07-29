import { asc } from './asc-api.mjs';

const APP_ID = '6795069080';
const LOC_ID = 'b3c8881b-7b68-44d7-b704-1cbc336de5f1';

try {
  const age = await asc('GET', `/v1/apps/${APP_ID}/ageRatingDeclaration`);
  console.log('AGE RATING', JSON.stringify(age.data?.attributes, null, 2));
} catch (e) { console.log('AGE ERR', e.status, JSON.stringify(e.body)); }

try {
  const price = await asc('GET', `/v2/apps/${APP_ID}/appPriceSchedule`);
  console.log('APP PRICE SCHEDULE', JSON.stringify(price.data, null, 2));
} catch (e) { console.log('PRICE ERR', e.status, JSON.stringify(e.body)); }

try {
  const shots = await asc('GET', `/v1/appStoreVersionLocalizations/${LOC_ID}/appScreenshotSets`);
  console.log('SCREENSHOT SETS', JSON.stringify(shots.data.map((s) => ({ id: s.id, type: s.attributes.screenshotDisplayType })), null, 2));
  for (const set of shots.data) {
    const shots2 = await asc('GET', `/v1/appScreenshotSets/${set.id}/appScreenshots`);
    console.log(`  ${set.attributes.screenshotDisplayType}: ${shots2.data.length} screenshot(s)`);
  }
} catch (e) { console.log('SHOTS ERR', e.status, JSON.stringify(e.body)); }

try {
  const priv = await asc('GET', `/v1/apps/${APP_ID}/appInfos?fields[appInfos]=appStoreState`);
  console.log('APP INFOS', JSON.stringify(priv.data, null, 2));
} catch (e) { console.log('APPINFO ERR', e.status, JSON.stringify(e.body)); }
