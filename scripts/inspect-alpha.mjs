import fs from 'node:fs';
import { PNG } from 'pngjs';

for (const f of process.argv.slice(2)) {
  const p = PNG.sync.read(fs.readFileSync(f));
  let transparent = 0;
  let opaque = 0;
  for (let i = 3; i < p.data.length; i += 4) {
    if (p.data[i] < 40) transparent += 1; else if (p.data[i] > 220) opaque += 1;
  }
  const total = p.width * p.height;
  console.log(`${f}: ${p.width}x${p.height}  transparent=${((transparent / total) * 100).toFixed(1)}%  opaque=${((opaque / total) * 100).toFixed(1)}%`);
}
