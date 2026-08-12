// Uploads a signed .ipa directly to App Store Connect via the new (WWDC25)
// pure-REST build-upload API -- no Xcode, no Mac, no Transporter, no CI
// required. Same JWT auth (.p8 key) already used by every other script in
// this directory. Steps: POST /v1/buildUploads -> POST /v1/buildUploadFiles
// -> PUT each byte-range operation Apple returns -> PATCH uploaded:true ->
// poll /v1/builds until processingState settles.
//
// Usage: node scripts/appstore/upload-build.mjs <path-to.ipa>
// Env (same as asc-api.mjs): ASC_KEY_ID, ASC_ISSUER_ID, ASC_KEY_PATH
import fs from 'node:fs';
import path from 'node:path';
import { asc } from './asc-api.mjs';

const APP_ID = '6795069080'; // Brawl Arena
const BUNDLE_VERSION = '55'; // CFBundleVersion (must match the IPA's Info.plist)
const BUNDLE_SHORT_VERSION = '4.10.9';

const ipaPath = process.argv[2];
if (!ipaPath || !fs.existsSync(ipaPath)) {
  throw new Error('Usage: node upload-build.mjs <path-to.ipa> (file not found)');
}

const fileName = path.basename(ipaPath);
const fileSize = fs.statSync(ipaPath).size;
const ipaBuffer = fs.readFileSync(ipaPath);

console.log(`Uploading ${fileName} (${(fileSize / 1024 / 1024).toFixed(1)} MB), build ${BUNDLE_VERSION} / v${BUNDLE_SHORT_VERSION}`);

// Step 1: create the BuildUpload (or reuse one from a previous partial run,
// via RESUME_BUILD_UPLOAD_ID, so retries don't litter Apple's side with
// abandoned AWAITING_UPLOAD containers)
let buildUploadId = process.env.RESUME_BUILD_UPLOAD_ID;
if (buildUploadId) {
  console.log(`\n[1/4] Reusing existing buildUploadId ${buildUploadId} (RESUME_BUILD_UPLOAD_ID set)`);
} else {
  console.log('\n[1/4] POST /v1/buildUploads ...');
  const buildUpload = await asc('POST', '/v1/buildUploads', {
    data: {
      type: 'buildUploads',
      attributes: {
        cfBundleVersion: BUNDLE_VERSION,
        cfBundleShortVersionString: BUNDLE_SHORT_VERSION,
        platform: 'IOS',
      },
      relationships: { app: { data: { id: APP_ID, type: 'apps' } } },
    },
  });
  buildUploadId = buildUpload.data.id;
  console.log('  buildUploadId =', buildUploadId, '| state =', JSON.stringify(buildUpload.data.attributes.state));
}

// Step 2: create the BuildUploadFile, get pre-signed upload operations
console.log('\n[2/4] POST /v1/buildUploadFiles ...');
const buildUploadFile = await asc('POST', '/v1/buildUploadFiles', {
  data: {
    type: 'buildUploadFiles',
    attributes: { fileName, fileSize, assetType: 'ASSET', uti: 'com.apple.ipa' },
    relationships: { buildUpload: { data: { id: buildUploadId, type: 'buildUploads' } } },
  },
});
const buildUploadFileId = buildUploadFile.data.id;
const ops = buildUploadFile.data.attributes.uploadOperations;
console.log(`  buildUploadFileId = ${buildUploadFileId} | got ${ops.length} upload operation(s)`);

// Step 3: PUT each chunk to its pre-signed URL (no Authorization header --
// these URLs carry their own signed credentials)
console.log('\n[3/4] Uploading bytes ...');
for (const [i, op] of ops.entries()) {
  const chunk = ipaBuffer.subarray(op.offset, op.offset + op.length);
  const headers = Object.fromEntries((op.requestHeaders || []).map((h) => [h.name, h.value]));
  const res = await fetch(op.url, { method: op.method, headers, body: chunk });
  if (!res.ok) {
    throw new Error(`Chunk ${i + 1}/${ops.length} failed: ${res.status} ${await res.text()}`);
  }
  console.log(`  chunk ${i + 1}/${ops.length} -> ${res.status} OK (${chunk.length} bytes)`);
}

// Step 4: mark the upload complete -- this is a PATCH on the *file* resource
// (buildUploadFiles), not the buildUploads container itself (which only
// allows CREATE / DELETE / GET_INSTANCE).
console.log('\n[4/4] PATCH /v1/buildUploadFiles/{id} { uploaded: true } ...');
const done = await asc('PATCH', `/v1/buildUploadFiles/${buildUploadFileId}`, {
  data: { type: 'buildUploadFiles', id: buildUploadFileId, attributes: { uploaded: true } },
});
console.log('  assetDeliveryState =', JSON.stringify(done.data.attributes.assetDeliveryState));

console.log('\nDone. Apple is now processing the build (usually 5-30 min).');
console.log('Poll with: GET /v1/builds?filter[app]=' + APP_ID + '&filter[version]=' + BUNDLE_VERSION);
