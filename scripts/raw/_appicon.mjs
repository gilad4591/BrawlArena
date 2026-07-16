import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';

// Turns the AI-generated icon (orange rounded badge with a fist on a grey
// backdrop) into every asset the app needs:
//   - a clean full-bleed square (Play Store 512 + Android legacy launcher)
//   - the fist alone on transparency (Android adaptive foreground)
//   - rounded-square web favicons / PWA icons
// Pure pixel work via pngjs (no browser).

const SRC = 'scripts/raw/appicon-src.png';
const RES = 'android/app/src/main/res';

const read = (p) => {
  const png = PNG.sync.read(fs.readFileSync(p));
  return { w: png.width, h: png.height, d: png.data };
};
const write = (p, img) => {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  const png = new PNG({ width: img.w, height: img.h });
  img.d.copy(png.data);
  fs.writeFileSync(p, PNG.sync.write(png));
  console.log('wrote', p, `${img.w}x${img.h}`);
};
const mk = (w, h) => ({ w, h, d: Buffer.alloc(w * h * 4) });
const at = (img, x, y) => (y * img.w + x) * 4;

const isGrey = (r, g, b) => {
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  return mx - mn < 22 && mx >= 178 && mx <= 246;
};

// ---- 1. auto-crop the orange badge (drop the grey backdrop) ----------------
function autocrop(src) {
  let x0 = src.w, y0 = src.h, x1 = 0, y1 = 0;
  for (let y = 0; y < src.h; y += 1) {
    for (let x = 0; x < src.w; x += 1) {
      const i = at(src, x, y);
      const r = src.d[i], g = src.d[i + 1], b = src.d[i + 2], a = src.d[i + 3];
      if (a > 20 && !isGrey(r, g, b)) {
        if (x < x0) x0 = x;
        if (y < y0) y0 = y;
        if (x > x1) x1 = x;
        if (y > y1) y1 = y;
      }
    }
  }
  const bw = x1 - x0 + 1;
  const bh = y1 - y0 + 1;
  const out = mk(bw, bh);
  for (let y = 0; y < bh; y += 1)
    for (let x = 0; x < bw; x += 1)
      src.d.copy(out.d, at(out, x, y), at(src, x0 + x, y0 + y), at(src, x0 + x, y0 + y) + 4);
  return out;
}

const sample = (img, fx, fy) => {
  const x = Math.min(img.w - 1, Math.max(0, Math.round(fx)));
  const y = Math.min(img.h - 1, Math.max(0, Math.round(fy)));
  const i = at(img, x, y);
  return [img.d[i], img.d[i + 1], img.d[i + 2]];
};

// ---- 2. full-bleed square: gradient-fill corners, overlay badge (skip grey) --
function bleed(badge, zoom = 1.05) {
  const S = Math.round(Math.max(badge.w, badge.h));
  const out = mk(S, S);
  const tl = sample(badge, badge.w * 0.16, badge.h * 0.16);
  const br = sample(badge, badge.w * 0.84, badge.h * 0.84);
  for (let y = 0; y < S; y += 1) {
    for (let x = 0; x < S; x += 1) {
      const t = (x / S + y / S) / 2;
      const o = at(out, x, y);
      // base = diagonal gradient sampled from the badge's own orange
      out.d[o] = tl[0] + (br[0] - tl[0]) * t;
      out.d[o + 1] = tl[1] + (br[1] - tl[1]) * t;
      out.d[o + 2] = tl[2] + (br[2] - tl[2]) * t;
      out.d[o + 3] = 255;
      // overlay the badge (zoomed a touch so its rounded edge overshoots)
      const bx = Math.round((x - S / 2) / zoom + badge.w / 2);
      const by = Math.round((y - S / 2) / zoom + badge.h / 2);
      if (bx >= 0 && by >= 0 && bx < badge.w && by < badge.h) {
        const bi = at(badge, bx, by);
        const r = badge.d[bi], g = badge.d[bi + 1], b = badge.d[bi + 2];
        if (!(isGrey(r, g, b) || badge.d[bi + 3] < 20)) {
          out.d[o] = r; out.d[o + 1] = g; out.d[o + 2] = b; out.d[o + 3] = 255;
        }
      }
    }
  }
  return out;
}

// ---- 3. extract the fist (key out orange) for the adaptive foreground -------
function extractFist(badge) {
  const out = mk(badge.w, badge.h);
  const W = badge.w, H = badge.h;
  for (let y = 0; y < H; y += 1) {
    for (let x = 0; x < W; x += 1) {
      const i = at(badge, x, y);
      const r = badge.d[i], g = badge.d[i + 1], b = badge.d[i + 2];
      let a;
      if (isGrey(r, g, b)) a = 0;
      else {
        const orange = r - b; // orange bg & sparks: R >> B; navy/blue fist: R <= B
        if (orange > 60) a = 0;
        else if (orange < 20) a = 255;
        else a = Math.round((255 * (60 - orange)) / 40);
      }
      out.d[i] = r; out.d[i + 1] = g; out.d[i + 2] = b; out.d[i + 3] = a;
    }
  }

  // Keep only the LARGEST connected blob of opaque pixels — this is the fist,
  // and it drops the thin rounded-badge outline the key also caught.
  const seen = new Uint8Array(W * H);
  const solid = (idx) => out.d[idx * 4 + 3] > 128;
  let best = null, bestN = 0;
  const stack = new Int32Array(W * H);
  for (let p = 0; p < W * H; p += 1) {
    if (seen[p] || !solid(p)) continue;
    let sp = 0, n = 0;
    const comp = [];
    stack[sp++] = p; seen[p] = 1;
    while (sp) {
      const cur = stack[--sp];
      comp.push(cur); n += 1;
      const cx = cur % W, cy = (cur / W) | 0;
      const nb = [cx > 0 ? cur - 1 : -1, cx < W - 1 ? cur + 1 : -1, cy > 0 ? cur - W : -1, cy < H - 1 ? cur + W : -1];
      for (const q of nb) if (q >= 0 && !seen[q] && solid(q)) { seen[q] = 1; stack[sp++] = q; }
    }
    if (n > bestN) { bestN = n; best = comp; }
  }
  let keep = new Uint8Array(W * H);
  if (best) for (const q of best) keep[q] = 1;
  // Dilate a couple px so the blob's anti-aliased edge pixels survive too.
  for (let pass = 0; pass < 2; pass += 1) {
    const nk = keep.slice();
    for (let y = 0; y < H; y += 1)
      for (let x = 0; x < W; x += 1) {
        const p = y * W + x;
        if (keep[p]) continue;
        if ((x > 0 && keep[p - 1]) || (x < W - 1 && keep[p + 1]) ||
            (y > 0 && keep[p - W]) || (y < H - 1 && keep[p + W])) nk[p] = 1;
      }
    keep = nk;
  }
  let x0 = W, y0 = H, x1 = 0, y1 = 0;
  for (let y = 0; y < H; y += 1) {
    for (let x = 0; x < W; x += 1) {
      const p = y * W + x;
      if (!keep[p]) { out.d[p * 4 + 3] = 0; continue; }
      if (x < x0) x0 = x; if (y < y0) y0 = y;
      if (x > x1) x1 = x; if (y > y1) y1 = y;
    }
  }
  // crop to the fist bbox
  const fw = x1 - x0 + 1, fh = y1 - y0 + 1;
  const cr = mk(fw, fh);
  for (let y = 0; y < fh; y += 1)
    for (let x = 0; x < fw; x += 1)
      out.d.copy(cr.d, at(cr, x, y), at(out, x0 + x, y0 + y), at(out, x0 + x, y0 + y) + 4);
  return cr;
}

// ---- area-average resample (great for downscaling) -------------------------
function resize(src, dw, dh) {
  const out = mk(dw, dh);
  const sx = src.w / dw, sy = src.h / dh;
  for (let y = 0; y < dh; y += 1) {
    for (let x = 0; x < dw; x += 1) {
      const x0 = Math.floor(x * sx), x1 = Math.max(x0 + 1, Math.floor((x + 1) * sx));
      const y0 = Math.floor(y * sy), y1 = Math.max(y0 + 1, Math.floor((y + 1) * sy));
      let r = 0, g = 0, b = 0, a = 0, n = 0;
      for (let yy = y0; yy < y1 && yy < src.h; yy += 1) {
        for (let xx = x0; xx < x1 && xx < src.w; xx += 1) {
          const i = at(src, xx, yy);
          const al = src.d[i + 3];
          r += src.d[i] * al; g += src.d[i + 1] * al; b += src.d[i + 2] * al;
          a += al; n += 1;
        }
      }
      const o = at(out, x, y);
      if (a > 0) { out.d[o] = r / a; out.d[o + 1] = g / a; out.d[o + 2] = b / a; }
      out.d[o + 3] = n ? Math.round(a / n) : 0;
    }
  }
  return out;
}

// place a (transparent) sprite centered on a square canvas at `fill` fraction
function centerOn(sprite, size, fill) {
  const scale = (size * fill) / Math.max(sprite.w, sprite.h);
  const rw = Math.round(sprite.w * scale), rh = Math.round(sprite.h * scale);
  const small = resize(sprite, rw, rh);
  const out = mk(size, size);
  const ox = Math.round((size - rw) / 2), oy = Math.round((size - rh) / 2);
  for (let y = 0; y < rh; y += 1)
    for (let x = 0; x < rw; x += 1)
      small.d.copy(out.d, at(out, ox + x, oy + y), at(small, x, y), at(small, x, y) + 4);
  return out;
}

// round the corners (alpha) of an opaque square
function rounded(src, radiusFrac) {
  const out = mk(src.w, src.h);
  src.d.copy(out.d);
  const r = src.w * radiusFrac;
  for (let y = 0; y < src.h; y += 1) {
    for (let x = 0; x < src.w; x += 1) {
      let dx = 0, dy = 0;
      if (x < r) dx = r - x; else if (x >= src.w - r) dx = x - (src.w - r) + 1;
      if (y < r) dy = r - y; else if (y >= src.h - r) dy = y - (src.h - r) + 1;
      if (dx > 0 && dy > 0) {
        const dist = Math.hypot(dx, dy);
        const a = Math.max(0, Math.min(1, r - dist + 0.5));
        out.d[at(out, x, y) + 3] = Math.round(255 * a);
      }
    }
  }
  return out;
}

// ---------------------------------------------------------------- run -------
const src = read(SRC);
const badge = autocrop(src);
console.log('badge', badge.w, badge.h);
const full = bleed(badge, 1.05);
const fist = extractFist(badge);
console.log('fist', fist.w, fist.h);

// previews
write('scripts/raw/shots/appicon-bleed.png', full);
write('scripts/raw/shots/appicon-fist.png', fist);

if (process.env.ICON_APPLY === '1') {
  const legacy = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 };
  const fore = { mdpi: 108, hdpi: 162, xhdpi: 216, xxhdpi: 324, xxxhdpi: 432 };
  for (const [dpi, s] of Object.entries(legacy)) {
    write(`${RES}/mipmap-${dpi}/ic_launcher.png`, resize(full, s, s));
    write(`${RES}/mipmap-${dpi}/ic_launcher_round.png`, resize(full, s, s));
  }
  for (const [dpi, s] of Object.entries(fore)) {
    // foreground: fist centered at ~58% (launchers zoom the safe zone ~1.5x)
    write(`${RES}/mipmap-${dpi}/ic_launcher_foreground.png`, centerOn(fist, s, 0.58));
  }
  write('store-assets/icon-512.png', resize(full, 512, 512)); // Play product icon (opaque)
  write('public/icons/icon-512.png', rounded(resize(full, 512, 512), 0.18));
  write('public/icons/icon-192.png', rounded(resize(full, 192, 192), 0.18));
  write('public/icons/apple-touch-icon.png', resize(full, 180, 180)); // iOS rounds itself
  write('public/icons/favicon-32.png', rounded(resize(full, 32, 32), 0.2));
}
console.log('done');
