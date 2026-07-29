import { asc } from './asc-api.mjs';

const id = process.argv[2] || '6795826764'; // remove_ads default

try {
  const loc = await asc('GET', `/v2/inAppPurchases/${id}/inAppPurchaseLocalizations`);
  console.log('LOCALIZATIONS', JSON.stringify(loc, null, 2));
} catch (e) { console.error('LOC ERROR', e.status, JSON.stringify(e.body)); }

try {
  const price = await asc('GET', `/v2/inAppPurchases/${id}/pricePoints?filter[territory]=USA&limit=5`);
  console.log('PRICEPOINTS sample', JSON.stringify(price, null, 2));
} catch (e) { console.error('PRICE ERROR', e.status, JSON.stringify(e.body)); }

try {
  const sched = await asc('GET', `/v2/inAppPurchases/${id}/iapPriceSchedule`);
  console.log('SCHEDULE', JSON.stringify(sched, null, 2));
} catch (e) { console.error('SCHED ERROR', e.status, JSON.stringify(e.body)); }

try {
  const shots = await asc('GET', `/v2/inAppPurchases/${id}/appStoreReviewScreenshot`);
  console.log('SCREENSHOT', JSON.stringify(shots, null, 2));
} catch (e) { console.error('SCREENSHOT ERROR', e.status, JSON.stringify(e.body)); }
