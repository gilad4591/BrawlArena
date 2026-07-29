// Uploads one App Store screenshot into an existing appScreenshotSet
// (public, shown on the App Store — different resource family than the
// IAP review screenshots in upload-iap-screenshot.mjs).
import { asc } from './asc-api.mjs';
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';

export async function uploadAppScreenshot(setId, imagePath) {
  const fileBuf = fs.readFileSync(imagePath);
  const fileName = path.basename(imagePath);
  const fileSize = fileBuf.length;

  const created = await asc('POST', '/v1/appScreenshots', {
    data: {
      type: 'appScreenshots',
      attributes: { fileName, fileSize },
      relationships: { appScreenshotSet: { data: { type: 'appScreenshotSets', id: setId } } },
    },
  });

  const assetId = created.data.id;
  const ops = created.data.attributes.uploadOperations || [];

  for (const op of ops) {
    const start = op.offset ?? 0;
    const end = op.length != null ? start + op.length : fileBuf.length;
    const chunk = fileBuf.subarray(start, end);
    const headers = Object.fromEntries((op.requestHeaders || []).map((h) => [h.name, h.value]));
    const res = await fetch(op.url, { method: op.method || 'PUT', headers, body: chunk });
    if (!res.ok) throw new Error(`Upload chunk failed: ${res.status} ${await res.text()}`);
  }

  const checksum = crypto.createHash('md5').update(fileBuf).digest('hex');
  return asc('PATCH', `/v1/appScreenshots/${assetId}`, {
    data: { type: 'appScreenshots', id: assetId, attributes: { uploaded: true, sourceFileChecksum: checksum } },
  });
}
