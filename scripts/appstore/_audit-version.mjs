import { asc } from './asc-api.mjs';

const vId = process.argv[2] || '1e55f8cb-4e27-4b63-88a5-334e56c1dcf4';

try {
  const v = await asc('GET', `/v1/appStoreVersions/${vId}`);
  console.log('VERSION', JSON.stringify(v.data.attributes, null, 2));
} catch (e) { console.log('VERSION ERR', e.status, JSON.stringify(e.body)); }

try {
  const loc = await asc('GET', `/v1/appStoreVersions/${vId}/appStoreVersionLocalizations`);
  console.log('LOCALIZATIONS', JSON.stringify(loc.data.map((l) => ({
    id: l.id, locale: l.attributes.locale,
    descLen: l.attributes.description?.length ?? 0,
    keywords: l.attributes.keywords,
    promo: l.attributes.promotionalText,
    whatsNew: l.attributes.whatsNew,
  })), null, 2));
} catch (e) { console.log('LOC ERR', e.status, JSON.stringify(e.body)); }

try {
  const build = await asc('GET', `/v1/appStoreVersions/${vId}/build`);
  console.log('BUILD', JSON.stringify(build.data, null, 2));
} catch (e) { console.log('BUILD ERR', e.status, JSON.stringify(e.body)); }

try {
  const age = await asc('GET', `/v1/appStoreVersions/${vId}/ageRatingDeclaration`);
  console.log('AGE RATING', JSON.stringify(age.data?.attributes, null, 2));
} catch (e) { console.log('AGE ERR', e.status, JSON.stringify(e.body)); }

try {
  const rel = await asc('GET', `/v1/appStoreVersions/${vId}/appStoreVersionSubmission`);
  console.log('SUBMISSION', JSON.stringify(rel.data, null, 2));
} catch (e) { console.log('SUBMISSION ERR', e.status, JSON.stringify(e.body)); }
