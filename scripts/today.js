#!/usr/bin/env node
// Today's picks: checks off a line in today.md (today.md or idag.md). Zero tokens.
// The panel's Today tab runs this through $.process.run.
//
//   node scripts/today.js done <hash>      "- [ ] text" becomes "- [x] text"
//   (klar and lista are Swedish aliases of done and list)
//   The notebook root comes from scripts/root.js.
//
// The hash is the sha1 of the line's text after the checkbox (scripts/lines.js). If no open line has the hash an error
// is written and nothing changes. The last stdout line is JSON: {"ok":true,...} or {"fel":"..."} (and exit 1).

'use strict';

const fs = require('fs');
const path = require('path');
const fmt = require('./format');
const rad = require('./lines');

const RAD_RE = /^- \[( |x|X)\]\s*(.+?)\s*$/;

// The lines with a checkbox: [{ index, klar, text, hash }]. index is the line number in the file.
function tolkaRader(text) {
  const ut = [];
  text.split(/\r?\n/).forEach((r, index) => {
    const m = r.match(RAD_RE);
    if (m) ut.push({ index, klar: m[1] !== ' ', text: m[2], hash: rad.hashRad(m[2]) });
  });
  return ut;
}

function klar(text, hash) {
  const rader = text.split(/\r?\n/);
  const eol = rad.eolAv(text);
  const f = tolkaRader(text).find((r) => r.hash === hash && !r.klar);
  if (!f) {
    if (tolkaRader(text).some((r) => r.hash === hash)) throw new Error('the line is already done');
    throw new Error(`no line with hash ${hash}`);
  }
  rader[f.index] = rader[f.index].replace(/^- \[ \]/, '- [x]');
  return rader.join(eol);
}

function kor(rot, verb, args) {
  const handling = fmt.normalizeVerb(verb);
  const rel = fmt.filnamn(rot, 'idag');
  const p = path.join(rot, rel);
  if (!fs.existsSync(p)) throw new Error(`${rel} is missing`);
  const text = fs.readFileSync(p, 'utf8');
  if (handling === 'list') return { ok: true, rader: tolkaRader(text) };
  if (handling === 'done') {
    if (!args[0]) throw new Error('hash missing');
    rad.skriv(p, klar(text, args[0]));
    return { ok: true, klar: args[0] };
  }
  throw new Error(`unknown action "${handling}": list or done`);
}

function main(argv) {
  const { rot, args } = rad.flaggor(argv);
  const handling = args.shift() || '';
  try {
    console.log(JSON.stringify(kor(rot, handling, args)));
  } catch (e) {
    console.log(JSON.stringify({ fel: e.message }));
    process.exitCode = 1;
  }
}

module.exports = { tolkaRader, klar };

if (require.main === module) main(process.argv.slice(2));
