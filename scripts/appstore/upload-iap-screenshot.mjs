// Uploads the "App Review Screenshot" for one or more In-App Purchases.
// This is review-only (never shown on the public App Store) — Apple just
// requires ANY screenshot matching a spec the app already supports, so we
// reuse the existing character-select App Store screenshot for every
// product unless a more specific one is passed.
//
// Usage: node scripts/appstore/upload-iap-screenshot.mjs <iapId> [imagePath]
import { asc } from './asc-api.mjs';
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';

const DEFAULT_IMAGE = path.resolve('social-kit/appstore/character-select_iphone-6.9-6.7.png');

export async function uploadIapScreenshot(iapId, imagePath = DEFAULT_IMAGE) {
  const fileBuf = fs.readFileSync(imagePath);
  const fileName = path.basename(imagePath);
  const fileSize = fileBuf.length;

  // A screenshot asset can't be replaced in place (PATCH rejects
  // fileName/fileSize on update) — if a previous attempt exists (e.g. a
  // FAILED one from a dimension mismatch) it has to be deleted first, then
  // recreated fresh via POST.
  try {
    const existing = await asc('GET', `/v2/inAppPurchases/${iapId}/appStoreReviewScreenshot`);
    if (existing.data) {
      await asc('DELETE', `/v1/inAppPurchaseAppStoreReviewScreenshots/${existing.data.id}`);
    }
  } catch { /* ignore — nothing to delete */ }

  const created = await asc('POST', '/v1/inAppPurchaseAppStoreReviewScreenshots', {
    data: {
      type: 'inAppPurchaseAppStoreReviewScreenshots',
      attributes: { fileName, fileSize },
      relationships: { inAppPurchaseV2: { data: { type: 'inAppPurchases', id: iapId } } },
    },
  });

  const assetId = created.data.id;
  const ops = created.data.attributes.uploadOperations || [];

  // 2. Upload the bytes (per the offset/length ranges Apple asks for)
  for (const op of ops) {
    const start = op.offset ?? 0;
    const end = op.length != null ? start + op.length : fileBuf.length;
    const chunk = fileBuf.subarray(start, end);
    const headers = Object.fromEntries((op.requestHeaders || []).map((h) => [h.name, h.value]));
    const res = await fetch(op.url, { method: op.method || 'PUT', headers, body: chunk });
    if (!res.ok) {
      throw new Error(`Upload chunk failed: ${res.status} ${await res.text()}`);
    }
  }

  // 3. Commit — mark uploaded + checksum
  const checksum = crypto.createHash('md5').update(fileBuf).digest('hex');
  const patched = await asc('PATCH', `/v1/inAppPurchaseAppStoreReviewScreenshots/${assetId}`, {
    data: {
      type: 'inAppPurchaseAppStoreReviewScreenshots',
      id: assetId,
      attributes: { uploaded: true, sourceFileChecksum: checksum },
    },
  });

  return patched;
}

// CLI mode (always runs when this file is the one Node was invoked with —
// avoided the import.meta.url === file://argv[1] comparison since Windows
// path separators/slash-encoding make that never match).
const isMain = path.resolve(process.argv[1] || '') === path.resolve(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
if (isMain) {
  const [, , iapId, imagePath] = process.argv;
  if (!iapId) throw new Error('Usage: node upload-iap-screenshot.mjs <iapId> [imagePath]');
  const result = await uploadIapScreenshot(iapId, imagePath || DEFAULT_IMAGE);
  console.log(JSON.stringify(result, null, 2));
}
