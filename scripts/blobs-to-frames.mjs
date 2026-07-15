import fs from 'node:fs';

// Convert a blob-scan .blobs.json into the {frames:[{x,y,w,h}]} format the game
// loads, preserving reading order.
const [, , inF, outF] = process.argv;
const blobs = JSON.parse(fs.readFileSync(inF, 'utf8'));
const frames = blobs.map((b) => ({ x: b.x, y: b.y, w: b.w, h: b.h }));
fs.writeFileSync(outF, JSON.stringify({ frames }));
console.log(`${outF}: ${frames.length} frames`);
