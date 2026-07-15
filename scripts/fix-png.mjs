import fs from 'node:fs';
import { PNG } from 'pngjs';

// Some AI exporters append junk after the PNG IEND chunk, which makes strict
// decoders (pngjs) throw "unrecognised content at end of stream". Truncate the
// file right after IEND + its 4-byte CRC, then re-encode a clean RGBA PNG.
const [, , inF, outF] = process.argv;
let buf = fs.readFileSync(inF);
const idx = buf.indexOf(Buffer.from('IEND'));
if (idx >= 0) buf = buf.subarray(0, idx + 8);
const p = PNG.sync.read(buf);
fs.writeFileSync(outF, PNG.sync.write(p));
let transparent = 0;
for (let i = 3; i < p.data.length; i += 4) if (p.data[i] < 40) transparent += 1;
console.log(`${outF}: ${p.width}x${p.height} transparent=${((transparent / (p.width * p.height)) * 100).toFixed(1)}%`);
