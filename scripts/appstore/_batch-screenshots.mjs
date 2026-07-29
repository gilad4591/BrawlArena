import { asc } from './asc-api.mjs';
import { uploadIapScreenshot } from './upload-iap-screenshot.mjs';

const APP_ID = '6795069080';
const list = await asc('GET', `/v1/apps/${APP_ID}/inAppPurchasesV2?fields[inAppPurchases]=name,productId,state&limit=200`);

for (const iap of list.data) {
  try {
    const existing = await asc('GET', `/v2/inAppPurchases/${iap.id}/appStoreReviewScreenshot`);
    if (existing.data) {
      console.log(`SKIP ${iap.attributes.productId} — already has a screenshot`);
      continue;
    }
    const result = await uploadIapScreenshot(iap.id);
    console.log(`OK   ${iap.attributes.productId} -> ${result.data.attributes.assetDeliveryState.state}`);
  } catch (e) {
    console.log(`FAIL ${iap.attributes.productId} -> ${e.status} ${JSON.stringify(e.body)}`);
  }
}
