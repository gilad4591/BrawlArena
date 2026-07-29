import { asc } from './asc-api.mjs';

const APP_ID = '6795069080';

// App-level pricing uses a different resource family (appPricePoints /
// appPriceSchedules) than IAP pricing. Find the $0.00 (Free) price point
// for the base territory (USA), then create a manual price schedule with it.
const points = await asc('GET', `/v1/apps/${APP_ID}/appPricePoints?filter[territory]=USA&limit=5`);
console.log('sample price points', JSON.stringify(points.data.map((p) => p.attributes), null, 2));

const free = points.data.find((p) => p.attributes.customerPrice === '0.0' || p.attributes.customerPrice === '0.00');
if (!free) throw new Error('Could not find a free price point');
console.log('free price point id:', free.id);

try {
  const result = await asc('POST', '/v1/appPriceSchedules', {
    data: {
      type: 'appPriceSchedules',
      relationships: {
        app: { data: { type: 'apps', id: APP_ID } },
        baseTerritory: { data: { type: 'territories', id: 'USA' } },
        manualPrices: {
          data: [{ type: 'appPrices', id: '${new-price}' }],
        },
      },
    },
    included: [
      {
        type: 'appPrices',
        id: '${new-price}',
        attributes: { startDate: null },
        relationships: {
          appPricePoint: { data: { type: 'appPricePoints', id: free.id } },
        },
      },
    ],
  });
  console.log('OK', JSON.stringify(result.data, null, 2));
} catch (e) {
  console.log('FAIL', e.status, JSON.stringify(e.body, null, 2));
}
