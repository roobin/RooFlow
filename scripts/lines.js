// Small shared helpers for the scripts that change a line in today.md and promises.md (scripts/today.js, scripts/promise.js).
// A line is identified by a hash of its text, not by line number: a change in the file between reading and
// clicking never hits the wrong line.
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { requireRoot } = require('./root');

function hashRad(text) {
  return crypto.createHash('sha1').update(String(text).replace(/\s+$/, ''), 'utf8').digest('hex').slice(0, 8);
}

function eolAv(text) {
  return text.includes('\r\n') ? '\r\n' : '\n';
}

function dagensDatum() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function skriv(p, text) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, text, 'utf8');
}

// Flags (--idag) from the arguments; the rest is returned as args. The root comes from scripts/root.js.
function flaggor(argv) {
  const args = argv.slice();
  const tag = (namn) => {
    const i = args.indexOf(namn);
    if (i < 0) return '';
    const v = args[i + 1] || '';
    args.splice(i, 2);
    return v;
  };
  const rot = requireRoot();
  const idag = tag('--idag') || dagensDatum();
  return { rot, idag, args };
}

module.exports = { hashRad, eolAv, dagensDatum, skriv, flaggor };
