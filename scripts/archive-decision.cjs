// Moves a decided decision block from decisions.md (or beslut.md) to the monthly archive.
// Usage: node scripts/archive-decision.cjs B12 "a, alice 2026-11-24"
// The notebook root comes from scripts/root.js. Lock file (scripts/lock.cjs) so two writers never change decisions.md at once.
// scripts/decide.js uses arkivera() directly.
const fs = require('fs');
const fmt = require('./format.js');
const { medLas } = require('./lock.cjs');
const { requireRoot } = require('./root.js');

// Writes the decision on the block's Decision line and moves the block to the monthly archive. Returns the archived block.
function arkivera(rot, id, beslut) {
  const fil = fmt.filnamn(rot, 'beslut');
  const arkivMapp = fmt.filnamn(rot, 'arkiv');
  const filSok = require('path').join(rot, fil);
  return medLas(filSok, () => {
    const crlf = fs.readFileSync(filSok, 'utf8').includes('\r\n');
    const s = fs.readFileSync(filSok, 'utf8').replace(/\r\n/g, '\n');
    const delar = s.split(/\n(?=## )/);
    const i = delar.findIndex((d) => d.includes('\n- Id: ' + id + '\n'));
    const nyckel = fmt.alt(fmt.BESLUT.beslut);
    if (i < 0 || !new RegExp('- ' + nyckel + ':\\s*$').test(delar[i].trim() + ' ')) throw new Error('not open');
    const blk = delar[i].trim().replace(new RegExp('- (' + nyckel + '):.*$'), (x, k) => '- ' + k + ': ' + beslut);
    delar.splice(i, 1);
    const ny = delar.join('\n');
    fs.writeFileSync(filSok, crlf ? ny.replace(/\n/g, '\r\n') : ny);

    // The month comes from the block's date (Date/Datum), otherwise the current one. New month files are named
    // decisions-YYYY-MM.md; an old beslut-YYYY-MM.md for the same month is reused.
    const datum = blk.match(new RegExp('^- ' + fmt.alt(fmt.BESLUT.datum) + ':\\s*(\\d{4}-\\d{2})', 'm'));
    const manad = datum ? datum[1] : new Date().toISOString().slice(0, 7);
    const funna = fmt.beslutArkivFiler(rot, manad);
    const arkivRel = funna.length ? funna[0] : arkivMapp + '/decisions-' + manad + '.md';
    const arkivFil = require('path').join(rot, arkivRel);
    const a = fs.existsSync(arkivFil) ? fs.readFileSync(arkivFil, 'utf8') : '# Decisions, decided ' + manad + '\n';
    fs.writeFileSync(arkivFil, a.replace(/\n*$/, '\n') + '\n' + blk + '\n');
    return blk;
  });
}

module.exports = { arkivera };

if (require.main === module) {
  const [id, beslut] = process.argv.slice(2);
  arkivera(requireRoot(), id, beslut);
}
