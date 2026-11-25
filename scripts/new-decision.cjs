// Adds a new decision block at the top under Open in decisions.md (or beslut.md) and increments Next Id.
// Usage: node scripts/new-decision.cjs <blockfile>   (B? in the block becomes the new Id; prints the Id on stdout)
// The notebook root comes from scripts/root.js. Lock file (scripts/lock.cjs) so two writers never get the same Id.
const fs = require('fs');
const path = require('path');
const { requireRoot } = require('./root');
const fmt = require('./format.js');
const { medLas } = require('./lock.cjs');
const rot = requireRoot();
const fil = path.join(rot, fmt.filnamn(rot, 'beslut'));
const blk = fs.readFileSync(process.argv[2], 'utf8').replace(/\r\n/g, '\n').trim();
medLas(fil, () => {
  let s = fs.readFileSync(fil, 'utf8');
  const crlf = s.includes('\r\n');
  s = s.replace(/\r\n/g, '\n');
  const m = s.match(fmt.nastaIdRe());
  const id = +m[1];
  const oppna = new RegExp('(## ' + fmt.alt(fmt.RUBRIKER.oppna) + '\\n\\n)');
  s = s.replace(m[0], m[0].replace(/B\d+/, 'B' + (id + 1))).replace(oppna, (x) => x + blk.replace('B?', 'B' + id) + '\n\n');
  fs.writeFileSync(fil, crlf ? s.replace(/\n/g, '\r\n') : s);
  console.log('B' + id);
});
