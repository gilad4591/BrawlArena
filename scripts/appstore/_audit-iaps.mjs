import { asc } from './asc-api.mjs';

const APP_ID = '6795069080';

const list = await asc('GET', `/v1/apps/${APP_ID}/inAppPurchasesV2?fields[inAppPurchases]=name,productId,inAppPurchaseType,state&limit=200`);

const rows = [];
for (const iap of list.data) {
  const id = iap.id;
  let loc = 'none';
  let price = 'none';
  let shot = 'missing';
  try {
    const l = await asc('GET', `/v2/inAppPurchases/${id}/inAppPurchaseLocalizations`);
    if (l.data.length) loc = l.data.map((x) => x.attributes.locale).join(',');
  } catch { /* ignore */ }
  try {
    const p = await asc('GET', `/v1/inAppPurchasePriceSchedules/${id}/manualPrices`);
    price = p.data.length ? `set (${p.data.length} tier(s))` : 'NOT SET';
  } catch (e) { price = `err ${e.status}`; }
  try {
    const s = await asc('GET', `/v2/inAppPurchases/${id}/appStoreReviewScreenshot`);
    shot = s.data ? 'present' : 'missing';
  } catch (e) { shot = `err ${e.status}`; }
  rows.push({ id, productId: iap.attributes.productId, name: iap.attributes.name, type: iap.attributes.inAppPurchaseType, state: iap.attributes.state, loc, price, shot });
}

console.table(rows);
