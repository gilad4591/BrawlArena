import { asc } from './asc-api.mjs';

const LOC_ID = 'b3c8881b-7b68-44d7-b704-1cbc336de5f1';
const sets = await asc('GET', `/v1/appStoreVersionLocalizations/${LOC_ID}/appScreenshotSets`);

for (const set of sets.data) {
  const shots = await asc('GET', `/v1/appScreenshotSets/${set.id}/appScreenshots?fields[appScreenshots]=fileName,assetDeliveryState`);
  console.log(`--- ${set.attributes.screenshotDisplayType} (${shots.data.length}) ---`);
  for (const s of shots.data) {
    const st = s.attributes.assetDeliveryState;
    console.log(' ', s.attributes.fileName, '->', st.state, st.errors ? JSON.stringify(st.errors) : '');
  }
}
