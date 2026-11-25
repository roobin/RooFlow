#!/usr/bin/env node
// Inbox: parses inbox.md into sections and entries, and moves one entry at a time. Zero tokens.
// The panel's Inbox tab runs this through $.process.run; scripts/radar.js uses tolka() for radar.json.
//
//   node scripts/inbox.js list                       read only: sections and entries with hashes, as JSON
//   node scripts/inbox.js done <hash>                the entry at the top of Done, with today's date if it has none
//   node scripts/inbox.js remove <hash>              the entry to archive/inbox-YYYY-MM.md (never deleted)
//   node scripts/inbox.js move <hash> <section>      the entry last in another section
//   node scripts/inbox.js undo                       undoes the last change (done, move, remove), one level
//   flags: --idag YYYY-MM-DD (tests)
// The Swedish verbs (lista, klar, ta-bort, flytta, angra) are aliases.
// The notebook root comes from scripts/root.js (ROOFLOW_ROOT or the nearest rooflow.json).
//
// An entry is a line that starts with "- " in column 0 plus the indented lines after it. The hash is the first eight
// characters of the sha1 of the entry's text (without line endings and trailing whitespace): it follows the text, not
// the line number, so a change in the file between reading and clicking never hits the wrong entry. If no entry has
// the hash, an error is written and nothing changes. The last stdout line is always JSON: {"ok":true,...} or
// {"fel":"..."} (and exit 1).

'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const fmt = require('./format');
const { requireRoot } = require('./root');

const POST_MAX = 600;
// The last change is saved here (status/kor/ is ignored by git) so that undo can restore it.
const ANGRA_FIL = path.join('status', 'kor', 'inbox-angra.json');

function eolAv(text) { return text.includes('\r\n') ? '\r\n' : '\n'; }

function hashAv(rader) {
  const t = rader.map((r) => r.replace(/\s+$/, '')).join('\n');
  return crypto.createHash('sha1').update(t, 'utf8').digest('hex').slice(0, 8);
}

// text -> { rader, eol, sektioner: [{ namn, rubrikRad, klar, poster: [{ hash, fran, till, rader }] }] }
// fran/till are line numbers (till is exclusive). Entries before the first "##" go in a section without a name.
function tolka(text) {
  const eol = eolAv(text);
  const rader = text.split(/\r?\n/);
  const sektioner = [];
  let sek = null;
  let post = null;
  const slutaPost = () => {
    if (!post) return;
    let till = post.till;
    while (till > post.fran + 1 && rader[till - 1].trim() === '') till--;
    post.till = till;
    post.rader = rader.slice(post.fran, till);
    post.hash = hashAv(post.rader);
    sek.poster.push(post);
    post = null;
  };
  for (let i = 0; i < rader.length; i++) {
    const rad = rader[i];
    const h = rad.match(/^##\s+(.+?)\s*$/);
    if (h) {
      slutaPost();
      sek = { namn: h[1], rubrikRad: i, klar: fmt.arKlartRubrik(h[1]), poster: [] };
      sektioner.push(sek);
      continue;
    }
    if (/^#\s/.test(rad)) { slutaPost(); sek = null; continue; }
    if (/^- /.test(rad)) {
      slutaPost();
      if (!sek) { sek = { namn: '', rubrikRad: -1, klar: false, poster: [] }; sektioner.push(sek); }
      post = { fran: i, till: i + 1 };
      continue;
    }
    if (post && /^\s+\S/.test(rad)) { post.till = i + 1; continue; }
    slutaPost();
  }
  slutaPost();
  return { rader, eol, sektioner };
}

function hitta(t, hash) {
  for (const s of t.sektioner) {
    for (const p of s.poster) if (p.hash === hash) return { sek: s, post: p };
  }
  return null;
}

function kapa(s, n) {
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

// What the panel gets: sections except Done, each entry with hash and text (cut to POST_MAX characters).
function tillPanel(text) {
  const t = tolka(text);
  return t.sektioner.filter((s) => !s.klar).map((s) => ({
    namn: s.namn,
    poster: s.poster.map((p) => ({ hash: p.hash, text: kapa(p.rader.map((r, i) => (i === 0 ? r.replace(/^- /, '') : r.trim())).join('\n'), POST_MAX) })),
  }));
}

function skriv(p, text) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, text, 'utf8');
}

function las(p) {
  try { return fs.readFileSync(p, 'utf8'); } catch { return ''; }
}

function dagensDatum() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function medDatum(rader, idag) {
  if (/^- \d{4}-\d{2}-\d{2}/.test(rader[0])) return rader;
  return [`- ${idag} · ${rader[0].slice(2)}`, ...rader.slice(1)];
}

// Removes post.fran..post.till; a blank line that becomes doubled is dropped.
function tabort(rader, post) {
  const kvar = rader.slice(0, post.fran).concat(rader.slice(post.till));
  const i = post.fran;
  if (i > 0 && i < kvar.length && kvar[i - 1].trim() === '' && kvar[i].trim() === '') kvar.splice(i, 1);
  return kvar;
}

// The index where an entry is placed last in a section: after the section's last non-empty line.
function slutAvSektion(rader, t, sek) {
  const nasta = t.sektioner.find((s) => s.rubrikRad > sek.rubrikRad && s.rubrikRad >= 0);
  const slut = nasta ? nasta.rubrikRad : rader.length;
  let i = slut;
  while (i > sek.rubrikRad + 1 && rader[i - 1].trim() === '') i--;
  return i;
}

function klar(text, hash, idag) {
  const t = tolka(text);
  const f = hitta(t, hash);
  if (!f) throw new Error(`no entry with hash ${hash}`);
  if (f.sek.klar) throw new Error('the entry is already done');
  const post = medDatum(f.post.rader, idag);
  const utan = tabort(t.rader, f.post);
  const u = tolka(utan.join(t.eol));
  const done = u.sektioner.find((s) => s.klar);
  if (!done) {
    while (utan.length && utan[utan.length - 1].trim() === '') utan.pop();
    utan.push('', '## Done', '', ...post, '');
    return utan.join(t.eol);
  }
  let i = done.rubrikRad + 1;
  if (i < utan.length && utan[i].trim() === '') i++;
  if (i >= utan.length) {
    if (i === done.rubrikRad + 1) utan.push('');
    utan.push(...post, '');
  } else {
    utan.splice(i, 0, ...post);
  }
  return utan.join(t.eol);
}

function flytta(text, hash, mal) {
  const t = tolka(text);
  const f = hitta(t, hash);
  if (!f) throw new Error(`no entry with hash ${hash}`);
  const namn = String(mal || '').trim().toLowerCase();
  if (!namn) throw new Error('section missing');
  const till = t.sektioner.find((s) => s.rubrikRad >= 0 && s.namn.toLowerCase() === namn);
  if (!till) throw new Error(`no section "${mal}"`);
  if (till.klar) throw new Error('use klar to move to Done');
  if (till === f.sek) throw new Error('the entry is already in that section');
  const utan = tabort(t.rader, f.post);
  const u = tolka(utan.join(t.eol));
  const sek = u.sektioner.find((s) => s.rubrikRad >= 0 && s.namn === till.namn);
  const i = slutAvSektion(utan, u, sek);
  utan.splice(i, 0, ...(i === sek.rubrikRad + 1 ? [''] : []), ...f.post.rader);
  return utan.join(t.eol);
}

// Takes the entry out of inbox.md and writes it to the archive file (same format as scripts/cleanup.js writes).
function taBort(rot, inboxRel, text, hash, manad) {
  const t = tolka(text);
  const f = hitta(t, hash);
  if (!f) throw new Error(`no entry with hash ${hash}`);
  const arkivRel = `${fmt.filnamn(rot, 'arkiv')}/inbox-${manad}.md`;
  const mal = path.join(rot, arkivRel);
  const fore = las(mal);
  const arkivFinns = fs.existsSync(mal);
  const eol = fore ? eolAv(fore) : t.eol;
  const huvud = `# Done from inbox.md ${manad}${eol}${eol}`;
  const ny = f.post.rader.join(eol) + eol;
  // The archive is written first: if it goes wrong the entry is still in the inbox.
  const arkivEfter = (fore ? fore.replace(/\s*$/, eol) : huvud) + ny;
  skriv(mal, arkivEfter);
  return { text: tabort(t.rader, f.post).join(t.eol), arkiv: arkivRel, arkivFore: arkivFinns ? fore : null, arkivEfter };
}

function sparaAngra(rot, post) {
  skriv(path.join(rot, ANGRA_FIL), JSON.stringify(post));
}

function lasAngra(rot) {
  try { return JSON.parse(fs.readFileSync(path.join(rot, ANGRA_FIL), 'utf8')); } catch { return null; }
}

// The name of the action undo would revert, or '' if nothing can be undone (no record, or the inbox has changed since).
function senasteAngra(rot) {
  const a = lasAngra(rot);
  if (!a) return '';
  return las(path.join(rot, a.inboxRel)) === a.efter ? fmt.normalizeVerb(a.handling) : '';
}

function angra(rot) {
  const a = lasAngra(rot);
  if (!a) throw new Error('nothing to undo');
  const p = path.join(rot, a.inboxRel);
  if (las(p) !== a.efter) throw new Error('the inbox has changed since, undo failed');
  skriv(p, a.fore);
  if (a.arkivRel && las(path.join(rot, a.arkivRel)) === a.arkivEfter) {
    const mal = path.join(rot, a.arkivRel);
    if (a.arkivFore === null) fs.rmSync(mal, { force: true });
    else skriv(mal, a.arkivFore);
  }
  fs.rmSync(path.join(rot, ANGRA_FIL), { force: true });
  return { ok: true, angrad: fmt.normalizeVerb(a.handling) };
}

function kor(rot, verb, args, idag) {
  const handling = fmt.normalizeVerb(verb);
  const inboxRel = fmt.filnamn(rot, 'inkorg');
  const p = path.join(rot, inboxRel);
  if (!fs.existsSync(p)) throw new Error(`${inboxRel} is missing`);
  const text = fs.readFileSync(p, 'utf8');
  if (handling === 'list') return { ok: true, sektioner: tillPanel(text), angra: senasteAngra(rot) };
  if (handling === 'undo') return angra(rot);
  const hash = args[0];
  if (!hash) throw new Error('hash missing');
  if (handling === 'done') {
    const efter = klar(text, hash, idag);
    skriv(p, efter);
    sparaAngra(rot, { handling, inboxRel, fore: text, efter });
    return { ok: true, klar: hash };
  }
  if (handling === 'move') {
    const efter = flytta(text, hash, args.slice(1).join(' '));
    skriv(p, efter);
    sparaAngra(rot, { handling, inboxRel, fore: text, efter });
    return { ok: true, flyttad: hash, till: args.slice(1).join(' ') };
  }
  if (handling === 'remove') {
    const r = taBort(rot, inboxRel, text, hash, idag.slice(0, 7));
    skriv(p, r.text);
    sparaAngra(rot, { handling, inboxRel, fore: text, efter: r.text, arkivRel: r.arkiv, arkivFore: r.arkivFore, arkivEfter: r.arkivEfter });
    return { ok: true, borta: hash, arkiv: r.arkiv };
  }
  throw new Error(`unknown action "${handling}": list, done, remove, move or undo`);
}

function main(argv) {
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
  const handling = args.shift() || '';
  try {
    console.log(JSON.stringify(kor(rot, handling, args, idag)));
  } catch (e) {
    console.log(JSON.stringify({ fel: e.message }));
    process.exitCode = 1;
  }
}

module.exports = { tolka, tillPanel, hashAv, klar, flytta, senasteAngra, POST_MAX };

if (require.main === module) main(process.argv.slice(2));
