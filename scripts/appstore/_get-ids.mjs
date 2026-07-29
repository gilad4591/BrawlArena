import { asc } from './asc-api.mjs';

const APP_INFO_ID = '7d9c7d47-c7b0-4cf7-b126-ec951b896445';

const infoLoc = await asc('GET', `/v1/appInfos/${APP_INFO_ID}/appInfoLocalizations`);
console.log('APP INFO LOC IDS', JSON.stringify(infoLoc.data.map((l) => ({ id: l.id, locale: l.attributes.locale })), null, 2));

const cats = await asc('GET', `/v1/appCategories?filter[platforms]=IOS&limit=50&fields[appCategories]=platforms`);
console.log('TOP CATEGORIES', cats.data.map((c) => c.id).filter((id) => id.startsWith('GAMES') || id === 'GAMES'));
