import { asc } from './asc-api.mjs';
import { uploadIapScreenshot } from './upload-iap-screenshot.mjs';

const APP_ID = '6795069080';
const SHOT = 'scripts/appstore/_iap-review-shot.jpg';

const list = await asc('GET', `/v1/apps/${APP_ID}/inAppPurchasesV2?fields[inAppPurchases]=productId,state&limit=200`);

for (const iap of list.data) {
  try {
    const result = await uploadIapScreenshot(iap.id, SHOT);
    const delivery = result.data.attributes.assetDeliveryState;
    console.log(`SHOT ${iap.attributes.productId} -> ${delivery.state} ${delivery.errors ? JSON.stringify(delivery.errors) : ''}`);
  } catch (e) {
    console.log(`SHOT-FAIL ${iap.attributes.productId} -> ${e.status} ${JSON.stringify(e.body)}`);
  }
}

console.log('\n--- final states ---');
const after = await asc('GET', `/v1/apps/${APP_ID}/inAppPurchasesV2?fields[inAppPurchases]=productId,state&limit=200`);
for (const iap of after.data) console.log(iap.attributes.productId, '->', iap.attributes.state);
