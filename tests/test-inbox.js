// Test for scripts/inbox.js against a temporary root under tests/_tmp/inbox (removed afterwards).
// Run: node tests/test-inbox.js
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const rot = path.join(__dirname, '_tmp', 'inbox');
const skript = path.join(__dirname, '..', 'scripts', 'inbox.js');
const inbox = require('../scripts/inbox');
let fel = 0;
const ok = (v, t) => { console.log((v ? 'OK   ' : 'FAIL ') + t); if (!v) fel++; };
const w = (rel, text) => { const p = path.join(rot, rel); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, text); };
const lasf = (rel) => fs.readFileSync(path.join(rot, rel), 'utf8');
const finns = (rel) => fs.existsSync(path.join(rot, rel));
function kor(...a) {
  try {
    const out = execFileSync('node', [skript, '--idag', '2026-11-24', ...a], { encoding: 'utf8', cwd: rot, env: { ...process.env, ROOFLOW_ROOT: rot } });
    return { kod: 0, svar: JSON.parse(out.trim().split('\n').pop()) };
  } catch (e) {
    return { kod: e.status, svar: JSON.parse(String(e.stdout).trim().split('\n').pop()) };
  }
}
const hashDar = (text, startsWith) => {
  const t = inbox.tolka(text);
  for (const s of t.sektioner) for (const p of s.poster) if (p.rader[0].startsWith(startsWith)) return p.hash;
  return '';
};

const START = [
  '# Inbox', '', 'Intro.', '', '## Now', '',
  '- 2026-11-01 · A · first', '',
  '- no date · second', '  continuation one', '  - subpoint', '',
  '## Agent', '', '- 2026-11-02 · B · third', '',
  '## Waiting', '', '## Later', '', '- 2026-11-03 · C · fourth', '',
  '## Done', '', '- 2026-10-01 · already done', '',
].join('\n');

try {
  fs.rmSync(rot, { recursive: true, force: true });
  w('inbox.md', START);
  w('archive/.keep', '');

  const lista = kor('list');
  ok(lista.svar.ok && lista.svar.sektioner.map((s) => s.namn).join() === 'Now,Agent,Waiting,Later', 'list: the sections except Done');
  const now = lista.svar.sektioner[0].poster;
  ok(now.length === 2 && now[1].text === 'no date · second\ncontinuation one\n- subpoint', 'lista: continuation lines belong to the entry');
  ok(lasf('inbox.md') === START, 'lista changes nothing');

  const hA = hashDar(START, '- 2026-11-01');
  const hB = hashDar(START, '- no date');
  ok(/^[0-9a-f]{8}$/.test(hA) && hA !== hB, 'hash: eight hex characters, different per entry');

  // wrong hash
  ok(kor('lista').svar.sektioner.length === kor('list').svar.sektioner.length, 'alias: lista works like list');
  const f1 = kor('done', 'deadbeef');
  ok(f1.kod === 1 && /no entry/.test(f1.svar.fel) && lasf('inbox.md') === START, 'wrong hash: error and the file untouched');
  ok(kor('move', 'deadbeef', 'Later').kod === 1 && kor('remove', 'deadbeef').kod === 1, 'wrong hash: flytta and ta-bort refuse too');

  // klar: with date, at the top under Done
  ok(kor('done', hA).svar.ok, 'klar: ok');
  let t = lasf('inbox.md');
  ok(t.includes('## Done\n\n- 2026-11-01 · A · first\n- 2026-10-01 · already done'), 'klar: at the top under Done, before the old ones');
  ok(!/## Now\n\n- 2026-11-01/.test(t), 'klar: gone from Now');
  // klar without date: today's date is added first, continuation lines follow
  ok(kor('done', hB).svar.ok, 'klar: entry without date');
  t = lasf('inbox.md');
  ok(t.includes('## Done\n\n- 2026-11-24 · no date · second\n  continuation one\n  - subpoint\n- 2026-11-01 · A'), 'klar: the current date first, continuation lines included');
  ok(!/\n\n\n/.test(t), 'klar: no doubled blank lines');
  ok(kor('done', hashDar(t, '- 2026-11-01')).kod === 1, 'klar: an entry under Done cannot be completed again');

  // flytta
  const hB2 = hashDar(t, '- 2026-11-02');
  ok(kor('move', hB2, 'waiting').svar.ok, 'flytta: the section name is case-insensitive');
  t = lasf('inbox.md');
  ok(t.includes('## Waiting\n\n- 2026-11-02 · B · third\n\n## Later'), 'flytta: last in the target section');
  ok(!/## Agent\n\n- 2026-11-02/.test(t), 'flytta: gone from Agent');
  ok(kor('move', hashDar(t, '- 2026-11-03'), 'Finnsinte').kod === 1, 'flytta: unknown section refused');
  ok(kor('move', hashDar(t, '- 2026-11-03'), 'Done').kod === 1, 'flytta: to Done refused (use klar)');
  ok(kor('move', hashDar(t, '- 2026-11-03'), 'Later').kod === 1, 'flytta: to the same section refused');

  // ta-bort: to the archive, never deleted
  const hC = hashDar(t, '- 2026-11-03');
  const r = kor('remove', hC);
  ok(r.svar.ok && r.svar.arkiv === 'archive/inbox-2026-11.md', 'ta-bort: archive file per month');
  ok(lasf('archive/inbox-2026-11.md') === '# Done from inbox.md 2026-11\n\n- 2026-11-03 · C · fourth\n', 'ta-bort: the archive file gets a heading and the entry');
  ok(!lasf('inbox.md').includes('fourth'), 'ta-bort: gone from the inbox');
  const hW = hashDar(lasf('inbox.md'), '- 2026-11-02');
  kor('remove', hW);
  ok(lasf('archive/inbox-2026-11.md').endsWith('- 2026-11-03 · C · fourth\n- 2026-11-02 · B · third\n'), 'ta-bort: the next entry is appended to the same archive file');

  // CRLF is kept, in the archive too
  const crlf = START.replace(/\n/g, '\r\n');
  w('inbox.md', crlf);
  fs.rmSync(path.join(rot, 'archive/inbox-2026-11.md'));
  const hCr = hashDar(crlf, '- no date');
  ok(hCr === hB, 'CRLF: same hash as with LF');
  kor('done', hCr);
  t = lasf('inbox.md');
  ok(!/[^\r]\n/.test(t) && t.includes('## Done\r\n\r\n- 2026-11-24 · no date · second\r\n  continuation one'), 'CRLF: klar keeps line endings');
  kor('move', hashDar(t, '- 2026-11-02'), 'Later');
  ok(!/[^\r]\n/.test(lasf('inbox.md')), 'CRLF: flytta keeps line endings');
  kor('remove', hashDar(lasf('inbox.md'), '- 2026-11-03'));
  ok(!/[^\r]\n/.test(lasf('inbox.md')), 'CRLF: ta-bort keeps line endings');
  ok(lasf('archive/inbox-2026-11.md').includes('\r\n'), 'CRLF: the archive file follows the inbox line endings');

  // angra: one level, only if the inbox is as it was after the change
  w('inbox.md', START);
  const fore0 = lasf('inbox.md');
  fs.rmSync(path.join(rot, 'status'), { recursive: true, force: true });
  ok(kor('undo').kod === 1 && /nothing to undo/.test(kor('undo').svar.fel), 'angra: an error without a record');
  kor('done', hA);
  ok(lasf('inbox.md') !== fore0 && kor('list').svar.angra === 'done', 'angra: lista says what can be undone');
  ok(kor('undo').svar.angrad === 'done' && lasf('inbox.md') === fore0, 'angra: klar restored byte for byte');
  ok(kor('undo').kod === 1 && kor('list').svar.angra === '', 'angra: the record is used up');
  kor('move', hA, 'later');
  ok(kor('undo').svar.ok && lasf('inbox.md') === fore0, 'angra: flytta restored');
  fs.rmSync(path.join(rot, 'archive/inbox-2026-11.md'), { force: true });
  kor('remove', hA);
  ok(finns('archive/inbox-2026-11.md') && !lasf('inbox.md').includes('first'), 'angra: ta-bort put the entry in the archive');
  ok(kor('undo').svar.ok && lasf('inbox.md') === fore0 && !finns('archive/inbox-2026-11.md'), 'angra: ta-bort restored, newly created archive file gone');
  kor('done', hA);
  w('inbox.md', lasf('inbox.md') + '\n- 2026-11-24 · new entry that arrived in between\n');
  ok(kor('undo').kod === 1 && /changed/.test(kor('undo').svar.fel) && lasf('inbox.md').includes('new entry that arrived in between'), 'angra: refuses when the inbox changed in between, nothing is lost');
  w('inbox.md', START);
  fs.rmSync(path.join(rot, 'status'), { recursive: true, force: true });

  // a missing Done section is created
  w('inbox.md', '# Inbox\n\n## Now\n\n- 2026-11-01 · alone\n');
  kor('done', hashDar(lasf('inbox.md'), '- 2026-11-01'));
  ok(lasf('inbox.md') === '# Inbox\n\n## Now\n\n## Done\n\n- 2026-11-01 · alone\n', 'klar: Done is created if missing');

  // English/Swedish file name: inkorg.md is used if inbox.md is missing
  fs.rmSync(path.join(rot, 'inbox.md'));
  w('inkorg.md', '# Inkorg\n\n## Nu\n\n- x\n\n## Klart\n');
  ok(kor('list').svar.sektioner.length === 1, 'file name: inkorg.md if inbox.md is missing, Klart counts as Done');
} finally {
  fs.rmSync(rot, { recursive: true, force: true });
}
console.log(fel ? `\n${fel} failed` : '\nAll OK');
process.exit(fel ? 1 : 0);
