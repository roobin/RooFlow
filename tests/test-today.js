// Test for scripts/today.js against a temporary root under tests/_tmp/today (removed afterwards).
// Run: node tests/test-today.js
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const rot = path.join(__dirname, '_tmp', 'today');
const skript = path.join(__dirname, '..', 'scripts', 'today.js');
const today = require('../scripts/today');
let fel = 0;
const ok = (v, t) => { console.log((v ? 'OK   ' : 'FAIL ') + t); if (!v) fel++; };
const lasf = () => fs.readFileSync(path.join(rot, 'today.md'), 'utf8');
function kor(...a) {
  try {
    const out = execFileSync('node', [skript, ...a], { encoding: 'utf8', cwd: rot, env: { ...process.env, ROOFLOW_ROOT: rot } });
    return { kod: 0, svar: JSON.parse(out.trim().split('\n').pop()) };
  } catch (e) {
    return { kod: e.status, svar: JSON.parse(String(e.stdout).trim().split('\n').pop()) };
  }
}

const START = '# Today 2026-11-24\r\n\r\n- [ ] First item åäö\r\n- [x] Already done\r\n- [ ] Third item\r\n';

try {
  fs.rmSync(rot, { recursive: true, force: true });
  fs.mkdirSync(rot, { recursive: true });
  fs.writeFileSync(path.join(rot, 'today.md'), START);

  const rader = today.tolkaRader(START);
  ok(rader.length === 3 && rader.every((r) => /^[0-9a-f]{8}$/.test(r.hash)), 'hash: eight hex characters per line');
  ok(kor('list').svar.rader.length === 3, 'list only reads');
  ok(lasf() === START, 'list changes nothing');
  ok(kor('lista').svar.rader.length === 3, 'alias: the Swedish verb lista works');

  const f1 = kor('done', 'deadbeef');
  ok(f1.kod === 1 && /no line/.test(f1.svar.fel) && lasf() === START, 'wrong hash: error and the file untouched');
  ok(kor('done', rader[1].hash).kod === 1, 'already done: error');

  const r1 = kor('done', rader[0].hash);
  ok(r1.kod === 0 && r1.svar.ok, 'klar: ok');
  ok(lasf() === START.replace('- [ ] First', '- [x] First'), 'klar: only that line changed, CRLF kept, åäö untouched');
  ok(kor('done', rader[0].hash).kod === 1, 'second click on the same line: error');
  ok(kor('done').kod === 1 && /hash missing/.test(kor('done').svar.fel), 'without hash: error');
  ok(kor('foo').kod === 1, 'unknown action: error');

  fs.rmSync(path.join(rot, 'today.md'));
  ok(kor('done', 'aaaa1111').kod === 1, 'missing file: error');
} finally {
  fs.rmSync(rot, { recursive: true, force: true });
}
console.log(fel ? `\n${fel} test(s) failed` : '\nAll OK');
process.exit(fel ? 1 : 0);
