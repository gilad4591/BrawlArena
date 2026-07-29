import { asc } from './asc-api.mjs';
import { uploadAppScreenshot } from './upload-app-screenshot.mjs';
import path from 'node:path';

const LOC_ID = 'b3c8881b-7b68-44d7-b704-1cbc336de5f1'; // en-US appStoreVersionLocalization
const DIR = path.resolve('social-kit/appstore');

// Same curated order as appstore-screenshots.mjs's SHOTS list.
const ORDER = ['menu', 'character-select', 'cosmetics-aura', 'fight-forest', 'victory-forest', 'fight-neon', 'victory-neon'];

const SET_FILES = {
  'iphone-6.5': 'APP_IPHONE_65',
  'ipad-13-12.9': 'APP_IPAD_PRO_3GEN_129',
};

const sets = await asc('GET', `/v1/appStoreVersionLocalizations/${LOC_ID}/appScreenshotSets`);

for (const [tag, displayType] of Object.entries(SET_FILES)) {
  let set = sets.data.find((s) => s.attributes.screenshotDisplayType === displayType);
  if (!set) {
    console.log(`creating missing screenshot set ${displayType}`);
    const created = await asc('POST', '/v1/appScreenshotSets', {
      data: {
        type: 'appScreenshotSets',
        attributes: { screenshotDisplayType: displayType },
        relationships: { appStoreVersionLocalization: { data: { type: 'appStoreVersionLocalizations', id: LOC_ID } } },
      },
    });
    set = created.data;
  }

  // Delete existing (broken/alpha) screenshots in this set first.
  const existing = await asc('GET', `/v1/appScreenshotSets/${set.id}/appScreenshots`);
  for (const shot of existing.data) {
    await asc('DELETE', `/v1/appScreenshots/${shot.id}`);
    console.log(`  deleted old ${displayType} screenshot ${shot.id}`);
  }

  // Upload the flattened (no-alpha) versions, in the curated order.
  for (const label of ORDER) {
    const file = path.join(DIR, `${label}_${tag}.png`);
    try {
      const result = await uploadAppScreenshot(set.id, file);
      console.log(`  OK ${displayType} ${label} -> ${result.data.attributes.assetDeliveryState.state}`);
    } catch (e) {
      console.log(`  FAIL ${displayType} ${label} -> ${e.status} ${JSON.stringify(e.body)}`);
    }
  }
}
