import fs from 'node:fs';

for (const f of process.argv.slice(2)) {
  const buf = fs.readFileSync(f);
  const sig = buf.subarray(0, 8).toString('hex');
  const head = buf.subarray(0, 16).toString('hex');
  const findAll = (tag) => {
    const out = [];
    let i = buf.indexOf(tag);
    while (i >= 0) { out.push(i); i = buf.indexOf(tag, i + 1); }
    return out;
  };
  console.log(`\n${f}  size=${buf.length}`);
  console.log(`  sig=${sig}  head=${head}`);
  console.log(`  isPNG=${sig.startsWith('89504e470d0a1a0a')}`);
  console.log(`  IHDR@ ${findAll(Buffer.from('IHDR'))}`);
  console.log(`  IDAT count=${findAll(Buffer.from('IDAT')).length}`);
  const iend = findAll(Buffer.from('IEND'));
  console.log(`  IEND@ ${iend}  (last+8=${iend.length ? iend[iend.length - 1] + 8 : '-'})`);
}
