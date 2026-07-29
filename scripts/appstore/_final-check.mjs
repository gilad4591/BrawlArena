import { asc } from './asc-api.mjs';

const APP_ID = '6795069080';
const vId = '1e55f8cb-4e27-4b63-88a5-334e56c1dcf4';
const APP_INFO_ID = '7d9c7d47-c7b0-4cf7-b126-ec951b896445';

const v = await asc('GET', `/v1/appStoreVersions/${vId}`);
console.log('version:', v.data.attributes.versionString, '| state:', v.data.attributes.appStoreState, '| usesIdfa:', v.data.attributes.usesIdfa);

const cat = await asc('GET', `/v1/appInfos/${APP_INFO_ID}/primaryCategory`);
console.log('category:', cat.data?.id);

const price = await asc('GET', `/v1/appPriceSchedules/${APP_ID}/manualPrices`);
console.log('app price set:', price.data.length > 0 ? 'YES (free)' : 'NO');

const age = await asc('GET', `/v1/appInfos/${APP_INFO_ID}/ageRatingDeclaration`);
const ageFilled = Object.entries(age.data.attributes).filter(([k, v]) => v !== null && !['ageRatingOverride', 'ageRatingOverrideV2', 'koreaAgeRatingOverride'].includes(k));
console.log('age rating fields filled:', ageFilled.length);

const build = await asc('GET', `/v1/appStoreVersions/${vId}/build`);
console.log('build attached:', build.data ? build.data.id : 'NONE — still needs upload via Transporter');

const iaps = await asc('GET', `/v1/apps/${APP_ID}/inAppPurchasesV2?fields[inAppPurchases]=state&limit=200`);
const notReady = iaps.data.filter((i) => i.attributes.state !== 'READY_TO_SUBMIT');
console.log('IAPs ready:', iaps.data.length - notReady.length, '/', iaps.data.length);
