import { asc } from './asc-api.mjs';

const APP_ID = '6795069080';
const NOTE = 'This purchase is verified purely by the platform store (Capacitor In App Purchases plugin) — no custom backend/account needed. To test: open the app, go to the Shop from the main menu, and select this item; the platform purchase sheet will appear. Non-consumable purchases restore automatically via "Restore Purchases" in Settings.';

const list = await asc('GET', `/v1/apps/${APP_ID}/inAppPurchasesV2?fields[inAppPurchases]=productId&limit=200`);

for (const iap of list.data) {
  try {
    await asc('PATCH', `/v2/inAppPurchases/${iap.id}`, {
      data: { type: 'inAppPurchases', id: iap.id, attributes: { reviewNote: NOTE } },
    });
    console.log(`OK ${iap.attributes.productId}`);
  } catch (e) {
    console.log(`FAIL ${iap.attributes.productId} -> ${e.status} ${JSON.stringify(e.body)}`);
  }
}
