#!/usr/bin/env node
// Promises and waiting lines: checks off a line in promises.md (promises.md or loften.md) and moves it to the
// Done section. Never deletes. Zero tokens. The panel's Today tab runs this.
//
//   node scripts/promise.js done <hash>      (klar is a Swedish alias) the line becomes "- [x] ... · klar YYYY-MM-DD" at the top under Done
//   flags: --idag YYYY-MM-DD (tests). The notebook root comes from scripts/root.js.
//
// The hash is the sha1 of the line's text after "- [ ] " (scripts/lines.js). The last stdout line is JSON: {"ok":true,...} or
// {"fel":"..."} (and exit 1).

'use strict';

const fs = require('fs');
const path = require('path');
const fmt = require('./format');
const rad = require('./lines');

const OPPEN_RE = /^- \[ \]\s*(.+?)\s*$/;

// Open lines outside Done: [{ index, text, hash }].
function oppnaRader(text) {
  const ut = [];
  let iKlara = false;
  text.split(/\r?\n/).forEach((r, index) => {
    const h = r.match(/^##\s+(.+?)\s*$/);
    if (h) { iKlara = fmt.arKlartRubrik(h[1]); return; }
    if (iKlara) return;
    const m = r.match(OPPEN_RE);
    if (m) ut.push({ index, text: m[1], hash: rad.hashRad(m[1]) });
  });
  return ut;
}

function klar(text, hash, idag) {
  const eol = rad.eolAv(text);
  const rader = text.split(/\r?\n/);
  const f = oppnaRader(text).find((r) => r.hash === hash);
  if (!f) throw new Error(`no open line with hash ${hash}`);
  const ny = `- [x] ${f.text} · klar ${idag}`;
  rader.splice(f.index, 1);
  // A blank line that becomes doubled is dropped.
  if (f.index > 0 && f.index < rader.length && rader[f.index - 1].trim() === '' && rader[f.index].trim() === '') rader.splice(f.index, 1);
  const done = rader.findIndex((r) => {
    const h = r.match(/^##\s+(.+?)\s*$/);
    return h && fmt.arKlartRubrik(h[1]);
  });
  if (done < 0) {
    while (rader.length && rader[rader.length - 1].trim() === '') rader.pop();
    rader.push('', '## Done', '', ny, '');
    return rader.join(eol);
  }
  let i = done + 1;
  if (i < rader.length && rader[i].trim() === '') i++;
  if (i >= rader.length) {
    if (i === done + 1) rader.push('');
    rader.push(ny, '');
  } else {
    rader.splice(i, 0, ny, '');
  }
  return rader.join(eol);
}

function kor(rot, verb, args, idag) {
  const handling = fmt.normalizeVerb(verb);
  const rel = fmt.filnamn(rot, 'loften');
  const p = path.join(rot, rel);
  if (!fs.existsSync(p)) throw new Error(`${rel} is missing`);
  const text = fs.readFileSync(p, 'utf8');
  if (handling === 'list') return { ok: true, rader: oppnaRader(text) };
  if (handling === 'done') {
    if (!args[0]) throw new Error('hash missing');
    rad.skriv(p, klar(text, args[0], idag));
    return { ok: true, klar: args[0] };
  }
  throw new Error(`unknown action "${handling}": list or done`);
}

function main(argv) {
  const { rot, idag, args } = rad.flaggor(argv);
  const handling = args.shift() || '';
  try {
    console.log(JSON.stringify(kor(rot, handling, args, idag)));
  } catch (e) {
    console.log(JSON.stringify({ fel: e.message }));
    process.exitCode = 1;
  }
}

module.exports = { oppnaRader, klar };

if (require.main === module) main(process.argv.slice(2));
