// Test for the lock file around decisions.md (scripts/lock.cjs, new-decision.cjs, archive-decision.cjs) in tests/_tmp/lock (removed afterwards).
// Run: node tests/test-lock.js
'use strict';
const fs = require('fs');
const path = require('path');
const { spawn, execFileSync } = require('child_process');
const { medLas, tagLas } = require('../scripts/lock.cjs');

const rot = path.join(__dirname, '_tmp', 'lock');
const nytt = path.join(__dirname, '..', 'scripts', 'new-decision.cjs');
const arkivera = path.join(__dirname, '..', 'scripts', 'archive-decision.cjs');
let fel = 0;
const ok = (v, t) => { console.log((v ? 'OK   ' : 'FAIL ') + t); if (!v) fel++; };
const lasf = (rel) => fs.readFileSync(path.join(rot, rel), 'utf8');

const START = ['# Decisions', '', 'Next Id: B10', '', '## Open', '', '## Decided', ''].join('\n');
const block = (n) => [`## Question ${n}`, '- Id: B?', '- Date: 2026-11-24', '- Asked by: test', '- Decision:'].join('\n');

function kor(skript, args) {
  return new Promise((resolve) => {
    const p = spawn('node', [skript, ...args], { cwd: rot, env: { ...process.env, ROOFLOW_ROOT: rot }, stdio: ['ignore', 'pipe', 'pipe'] });
    let ut = '';
    let err = '';
    p.stdout.on('data', (d) => { ut += d; });
    p.stderr.on('data', (d) => { err += d; });
    p.on('close', (kod) => resolve({ kod, ut: ut.trim(), err }));
  });
}

(async () => {
  try {
    fs.rmSync(rot, { recursive: true, force: true });
    fs.mkdirSync(path.join(rot, 'archive'), { recursive: true });
    fs.writeFileSync(path.join(rot, 'decisions.md'), START);

    // Eight writers at once: eight different Ids and Next Id incremented eight times.
    const filer = [];
    for (let i = 0; i < 8; i++) {
      const f = path.join(rot, `block${i}.md`);
      fs.writeFileSync(f, block(i));
      filer.push(f);
    }
    const svar = await Promise.all(filer.map((f) => kor(nytt, [f])));
    const ider = svar.map((r) => r.ut).sort();
    ok(svar.every((r) => r.kod === 0), 'eight concurrent new-decision runs succeeded');
    ok(new Set(ider).size === 8 && ider[0] === 'B10' && ider[7] === 'B17', 'eight different Ids, B10 to B17');
    const d = lasf('decisions.md');
    ok(/Next Id: B18/.test(d) && (d.match(/^- Id: B1\d$/gm) || []).length === 8, 'Next Id is B18 and all eight blocks are there');
    ok(!fs.existsSync(path.join(rot, 'decisions.md.lock')), 'the lock file is gone afterwards');

    // Archive two blocks at once: both end up in the archive, nothing is lost.
    const [a, b] = await Promise.all([kor(arkivera, ['B10', 'a, alice 2026-11-24']), kor(arkivera, ['B11', 'b, alice 2026-11-24'])]);
    ok(a.kod === 0 && b.kod === 0, 'two concurrent archive-decision runs succeeded');
    const ark = lasf('archive/decisions-2026-11.md');
    ok(/- Id: B10/.test(ark) && /- Id: B11/.test(ark) && /- Decision: a, alice/.test(ark), 'both blocks in the archive with Decision');
    ok(!/- Id: B10\n/.test(lasf('decisions.md')) && !/- Id: B11\n/.test(lasf('decisions.md')), 'both gone from decisions.md');

    // A forgotten lock (older than a minute) is removed.
    const lock = path.join(rot, 'decisions.md.lock');
    fs.writeFileSync(lock, JSON.stringify({ pid: 1, tid: Date.now() - 120_000 }));
    const gammal = await kor(nytt, [filer[0]]);
    ok(gammal.kod === 0 && /^B18$/.test(gammal.ut), 'forgotten lock (2 minutes) is removed and the writer gets through');

    // A fresh lock that is never released gives a clear error after waiting (here 300 ms).
    fs.writeFileSync(lock, JSON.stringify({ pid: 1, tid: Date.now() }));
    let msg = '';
    const t0 = Date.now();
    try { tagLas(path.join(rot, 'decisions.md'), 300); } catch (e) { msg = e.message; }
    ok(/locked by another writer/.test(msg) && Date.now() - t0 >= 280, 'fresh lock: waits and then fails');
    ok(fs.existsSync(lock), 'a fresh lock is left alone');
    fs.rmSync(lock);

    // The lock is also released when the function throws.
    try { medLas(path.join(rot, 'decisions.md'), () => { throw new Error('x'); }); } catch { /* expected */ }
    ok(!fs.existsSync(lock), 'the lock is released when the function throws');

    // A waiting writer gets the lock when another process releases it (another process holds it for 1.5 s).
    const halls = spawn('node', ['-e', `const { medLas } = require('../scripts/lock.cjs'); medLas(process.argv[1], () => { require('../scripts/lock.cjs'); Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1500); });`, path.join(rot, 'decisions.md')], { cwd: __dirname, stdio: 'ignore' });
    for (let i = 0; i < 60 && !fs.existsSync(lock); i++) await new Promise((r) => setTimeout(r, 50));
    ok(fs.existsSync(lock), 'another process holds the lock');
    const t0b = Date.now();
    const t2 = tagLas(path.join(rot, 'decisions.md'), 3000);
    ok(Date.now() - t0b >= 300 && fs.existsSync(t2), 'the waiting writer gets the lock when it is released');
    fs.rmSync(t2);
    halls.kill();
  } finally {
    fs.rmSync(rot, { recursive: true, force: true });
  }
  console.log(fel ? `\n${fel} test(s) failed` : '\nAll OK');
  process.exit(fel ? 1 : 0);
})();
