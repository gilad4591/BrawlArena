/**
 * Crops the painted busts the user supplied for the new unlockable fighters
 * into square portrait PNGs (public/portraits/<id>.png) and writes a montage
 * for visual verification.
 *
 *   node scripts/crop-new-portraits.mjs
 */
import fs from 'node:fs';
import { PNG } from 'pngjs';

const ASSETS =
  'C:/Users/giladcoh/.cursor/projects/c-Git-Ziggo-SVA/assets/c__Users_giladcoh_AppData_Roaming_Cursor_User_workspaceStorage_b943acfec778fb7a252f5c20f9c84e85_images_';
const SRC_ONYX = `${ASSETS}image-419bd1aa-00f3-468b-ad68-498a57a3e249.png`;
const SRC_TRIO = `${ASSETS}image-d7a9d807-b545-471a-8af1-c7630c8239ee.png`;

const read = (p) => PNG.sync.read(fs.readFileSync(p));

function crop(src, x, y, w, h) {
  const out = new PNG({ width: w, height: h });
  for (let yy = 0; yy < h; yy += 1) {
    for (let xx = 0; xx < w; xx += 1) {
      const si = ((y + yy) * src.width + (x + xx)) * 4;
      const di = (yy * w + xx) * 4;
      out.data[di] = src.data[si];
      out.data[di + 1] = src.data[si + 1];
      out.data[di + 2] = src.data[si + 2];
      out.data[di + 3] = src.data[si + 3];
    }
  }
  return out;
}

function place(dst, img, ox, oy) {
  for (let yy = 0; yy < img.height; yy += 1) {
    for (let xx = 0; xx < img.width; xx += 1) {
      const si = (yy * img.width + xx) * 4;
      const di = ((oy + yy) * dst.width + (ox + xx)) * 4;
      dst.data[di] = img.data[si];
      dst.data[di + 1] = img.data[si + 1];
      dst.data[di + 2] = img.data[si + 2];
      dst.data[di + 3] = img.data[si + 3];
    }
  }
}

const onyxImg = read(SRC_ONYX);
const trioImg = read(SRC_TRIO);

// Crop rectangles (tuned against the 1024x673 sources).
const crops = {
  onyx: crop(onyxImg, 388, 120, 262, 276),
  kira: crop(trioImg, 60, 128, 268, 292),
  zara: crop(trioImg, 378, 128, 272, 292),
  rex: crop(trioImg, 700, 128, 266, 292),
};

fs.mkdirSync('public/portraits', { recursive: true });
for (const [id, img] of Object.entries(crops)) {
  fs.writeFileSync(`public/portraits/${id}.png`, PNG.sync.write(img));
  console.log(`wrote public/portraits/${id}.png (${img.width}x${img.height})`);
}

// Montage for a quick eyeball check.
const size = 300;
const ids = Object.keys(crops);
const montage = new PNG({ width: size * ids.length, height: size });
ids.forEach((id, i) => {
  const img = crops[id];
  const scaled = new PNG({ width: size, height: size });
  // nearest-neighbour scale into the montage cell
  for (let yy = 0; yy < size; yy += 1) {
    for (let xx = 0; xx < size; xx += 1) {
      const sx = Math.floor((xx / size) * img.width);
      const sy = Math.floor((yy / size) * img.height);
      const si = (sy * img.width + sx) * 4;
      const di = (yy * size + xx) * 4;
      scaled.data[di] = img.data[si];
      scaled.data[di + 1] = img.data[si + 1];
      scaled.data[di + 2] = img.data[si + 2];
      scaled.data[di + 3] = img.data[si + 3];
    }
  }
  place(montage, scaled, i * size, 0);
});
fs.mkdirSync('art-src', { recursive: true });
fs.writeFileSync('art-src/new_portraits_check.png', PNG.sync.write(montage));
console.log('wrote art-src/new_portraits_check.png');
