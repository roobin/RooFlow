// Test for scripts/promise.js against a temporary root under tests/_tmp/promise (removed afterwards).
// Run: node tests/test-promise.js
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const rot = path.join(__dirname, '_tmp', 'promise');
const skript = path.join(__dirname, '..', 'scripts', 'promise.js');
const promise = require('../scripts/promise');
let fel = 0;
const ok = (v, t) => { console.log((v ? 'OK   ' : 'FAIL ') + t); if (!v) fel++; };
const lasf = () => fs.readFileSync(path.join(rot, 'promises.md'), 'utf8');
function kor(...a) {
  try {
    const out = execFileSync('node', [skript, '--idag', '2026-11-24', ...a], { encoding: 'utf8', cwd: rot, env: { ...process.env, ROOFLOW_ROOT: rot } });
    return { kod: 0, svar: JSON.parse(out.trim().split('\n').pop()) };
  } catch (e) {
    return { kod: e.status, svar: JSON.parse(String(e.stdout).trim().split('\n').pop()) };
  }
}

const START = [
  '# Promises', '', '## Open', '',
  '- [ ] 2026-11-25 (friday) · to alice · fix åäö · source', '',
  '- [ ] 2026-11-20 (since) · waiting for IT · answer about SQL · source', '',
  '## Done', '',
  '- [x] 2026-10-01 · to bob · old · klar 2026-10-02', '',
].join('\n');

try {
  fs.rmSync(rot, { recursive: true, force: true });
  fs.mkdirSync(rot, { recursive: true });
  fs.writeFileSync(path.join(rot, 'promises.md'), START);

  const rader = promise.oppnaRader(START);
  ok(rader.length === 2 && rader[0].hash !== rader[1].hash, 'open lines: two, different hashes, Done is not counted');

  ok(kor('lista').svar.rader.length === 2 && kor('list').svar.rader.length === 2, 'list and the alias lista agree');
  const f1 = kor('done', 'deadbeef');
  ok(f1.kod === 1 && /no open line/.test(f1.svar.fel) && lasf() === START, 'wrong hash: error and the file untouched');

  ok(kor('done', rader[0].hash).svar.ok, 'klar: ok');
  const efter = lasf();
  ok(!/^- \[ \] 2026-11-25/m.test(efter), 'klar: the line is gone from Open');
  ok(/## Done\n\n- \[x\] 2026-11-25 \(friday\) · to alice · fix åäö · source · klar 2026-11-24\n\n- \[x\] 2026-10-01/.test(efter), 'klar: checked at the top under Done, with date, old ones below');
  ok(efter.split('\n').filter((r) => r.includes('waiting for IT')).length === 1, 'other lines untouched');
  ok(kor('done', rader[0].hash).kod === 1, 'second click: error, nothing is duplicated');

  ok(kor('done', rader[1].hash).svar.ok && /klar 2026-11-24/.test(lasf()) && !/^- \[ \]/m.test(lasf()), 'a waiting line can be checked off too');
  ok((lasf().match(/^- \[x\]/gm) || []).length === 3, 'nothing deleted: three checked lines');

  // Without a Done section it is created, and CRLF is kept.
  const crlf = '# Promises\r\n\r\n## Open\r\n\r\n- [ ] 2026-11-25 · to A · b · c\r\n';
  fs.writeFileSync(path.join(rot, 'promises.md'), crlf);
  ok(kor('done', promise.oppnaRader(crlf)[0].hash).svar.ok, 'without Done: ok');
  const s = lasf();
  ok(/## Done\r\n\r\n- \[x\] 2026-11-25 · to A · b · c · klar 2026-11-24\r\n/.test(s) && !/[^\r]\n/.test(s), 'without Done: the section is created, CRLF kept');
} finally {
  fs.rmSync(rot, { recursive: true, force: true });
}
console.log(fel ? `\n${fel} test(s) failed` : '\nAll OK');
process.exit(fel ? 1 : 0);
