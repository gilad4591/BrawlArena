import { asc } from './asc-api.mjs';

const APP_INFO_ID = '7d9c7d47-c7b0-4cf7-b126-ec951b896445';
const LOC_ID = '3eb669af-0e9c-47f0-ac30-18d9f5fe2cf9';

try {
  const cat = await asc('PATCH', `/v1/appInfos/${APP_INFO_ID}`, {
    data: {
      type: 'appInfos',
      id: APP_INFO_ID,
      relationships: {
        primaryCategory: { data: { type: 'appCategories', id: 'GAMES' } },
        primarySubcategoryOne: { data: { type: 'appCategories', id: 'GAMES_ACTION' } },
      },
    },
  });
  console.log('CATEGORY OK');
} catch (e) { console.log('CATEGORY FAIL', e.status, JSON.stringify(e.body)); }

try {
  const loc = await asc('PATCH', `/v1/appInfoLocalizations/${LOC_ID}`, {
    data: {
      type: 'appInfoLocalizations',
      id: LOC_ID,
      attributes: {
        privacyPolicyUrl: 'https://brawl-arena.com/privacy.html',
        subtitle: 'Pick a fighter. Own the arena.',
      },
    },
  });
  console.log('PRIVACY URL + SUBTITLE OK', JSON.stringify(loc.data.attributes, null, 2));
} catch (e) { console.log('PRIVACY FAIL', e.status, JSON.stringify(e.body)); }
