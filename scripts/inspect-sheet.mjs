import fs from 'node:fs';
import { PNG } from 'pngjs';

const file = process.argv[2];
const png = PNG.sync.read(fs.readFileSync(file));
const { width: W, height: H, data } = png;
console.log(`size: ${W} x ${H}`);

function px(x, y) {
  const i = (y * W + x) * 4;
  return [data[i], data[i + 1], data[i + 2], data[i + 3]];
}

// histogram of colors (quantized) to find dominant background
const hist = new Map();
for (let y = 0; y < H; y += 2) {
  for (let x = 0; x < W; x += 2) {
    const [r, g, b] = px(x, y);
    const key = `${r >> 4},${g >> 4},${b >> 4}`;
    hist.set(key, (hist.get(key) || 0) + 1);
  }
}
const top = [...hist.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
console.log('top colors (r,g,b /16):');
top.forEach(([k, c]) => console.log(`  ${k} -> ${c}`));

// corner + center samples
console.log('corners:', px(1, 1), px(W - 2, 1), px(1, H - 2), px(W - 2, H - 2));
console.log('center:', px(W >> 1, H >> 1));

// detect gridline rows/cols: rows where most pixels are close to a single dark line color
function lineScore(vals) {
  // count how "uniform + darkish" a line is
  return vals;
}
// Report vertical profile: for each 1/20 column, sample color
console.log('row luminance profile (every 5% of height):');
for (let f = 0; f <= 20; f += 1) {
  const y = Math.min(H - 1, Math.round((f / 20) * H));
  let sum = 0;
  for (let x = 0; x < W; x += 3) {
    const [r, g, b] = px(x, y);
    sum += 0.299 * r + 0.587 * g + 0.114 * b;
  }
  const avg = sum / (W / 3);
  console.log(`  y=${y} (${f * 5}%): avg luma ${avg.toFixed(1)}`);
}
