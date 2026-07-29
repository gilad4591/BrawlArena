import { asc } from './asc-api.mjs';

const APP_ID = '6795069080';

const territories = await asc('GET', '/v1/territories?limit=200');
const allTerritories = territories.data.map((t) => ({ type: 'territories', id: t.id }));
console.log(`Using ${allTerritories.length} territories`);

const list = await asc('GET', `/v1/apps/${APP_ID}/inAppPurchasesV2?fields[inAppPurchases]=productId&limit=200`);

for (const iap of list.data) {
  try {
    await asc('POST', '/v1/inAppPurchaseAvailabilities', {
      data: {
        type: 'inAppPurchaseAvailabilities',
        attributes: { availableInNewTerritories: true },
        relationships: {
          inAppPurchase: { data: { type: 'inAppPurchases', id: iap.id } },
          availableTerritories: { data: allTerritories },
        },
      },
    });
    console.log(`OK ${iap.attributes.productId}`);
  } catch (e) {
    console.log(`FAIL ${iap.attributes.productId} -> ${e.status} ${JSON.stringify(e.body)}`);
  }
}
