// Cleanup: moves old finished things out of the notebook into archive/cleaned-YYYY-MM/.
// Never deletes. Every move is logged in archive/cleanup-log.jsonl so it can be restored.
//
//   node scripts/cleanup.js                       dry run: lists, changes nothing
//   node scripts/cleanup.js --run [--commit]      moves what the dry run listed
//   node scripts/cleanup.js --restore <date>      moves back everything cleaned on that date (YYYY-MM-DD)
//   node scripts/cleanup.js --bring-back <slug>   moves back status/<slug>.md and the project's run logs
//   --except <path>   (repeatable) leaves the path or folder where it is
//   --all             lists all paths, not just the first ones
//   --commit          commits the move (only the cleaner's own paths)
//
// The notebook root comes from scripts/root.js (ROOFLOW_ROOT or the nearest rooflow.json).

'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const fmt = require('./format');
const { requireRoot } = require('./root');

// The rules (days before something is moved).
const REGLER = {
  status: { dagar: 14 },
  logg: { dagar: 14 },
  briefs: { dagar: 30 },
  skisser: { dagar: 60, anteckningarDagar: 30 },
  inbox: { dagar: 30 },
};
const RADBUDGET = 36;
const DAG_MS = 86400000;

function pad2(n) { return String(n).padStart(2, '0'); }
function datumStr(d) { return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; }
function tidNu() {
  const d = new Date();
  return `${datumStr(d)} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}
function las(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return ''; } }
function skriv(p, text) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, text, 'utf8');
}
function fram(p) { return p.replace(/\\/g, '/'); }
function datumMs(s) { return new Date(s + 'T12:00:00').getTime(); }

function git(rot, args) {
  return execFileSync('git', ['-C', rot, ...args], { encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024 });
}

function arGitRepo(rot) {
  try { return fram(git(rot, ['rev-parse', '--show-toplevel']).trim()).toLowerCase() === fram(rot).toLowerCase(); } catch { return false; }
}

function sparadeFiler(rot, anvandGit) {
  if (!anvandGit) return new Set();
  try { return new Set(git(rot, ['ls-files', '-z']).split('\0').filter(Boolean)); } catch { return new Set(); }
}

// All files under a folder, relative to the root, with forward slashes.
function gaIgenom(rot, rel) {
  const ut = [];
  const rek = (r) => {
    let poster;
    try { poster = fs.readdirSync(path.join(rot, r), { withFileTypes: true }); } catch { return; }
    for (const p of poster) {
      const rr = r + '/' + p.name;
      if (p.isDirectory()) rek(rr);
      else if (p.isFile()) ut.push(rr);
    }
  };
  rek(rel);
  return ut;
}

function mtime(rot, rel) { try { return fs.statSync(path.join(rot, rel)).mtimeMs; } catch { return 0; } }

// The file's date in ms: the date at the start of the name if there is one, otherwise mtime.
function filDatumMs(rot, rel) {
  const m = path.basename(rel).match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? datumMs(m[1]) : mtime(rot, rel);
}

function normalisera(s) {
  return String(s).toLowerCase().replace(/å/g, 'a').replace(/ä/g, 'a').replace(/ö/g, 'o').replace(/[^a-z0-9]/g, '');
}

function projektSlugs(rot) {
  const slugs = new Set();
  for (const rad of las(path.join(rot, fmt.filnamn(rot, 'projektregister'))).split(/\r?\n/)) {
    const m = rad.match(/^\|\s*([^|]+?)\s*\|/);
    if (!m || /^-+$/.test(m[1])) continue;
    slugs.add(normalisera(m[1]));
  }
  return slugs;
}

// The text under "## Open" up to the next decided heading in decisions.md.
function oppnaBeslut(rot) {
  const rader = las(path.join(rot, fmt.filnamn(rot, 'beslut'))).split(/\r?\n/);
  const ut = [];
  let inne = false;
  for (const r of rader) {
    const m = r.match(/^## (.+?)\s*$/);
    if (m) {
      if (fmt.arRubrik(m[1], 'oppna')) { inne = true; continue; }
      if (fmt.arRubrik(m[1], 'tagna')) { inne = false; continue; }
    }
    if (inne) ut.push(r);
  }
  return ut.join('\n');
}

// The status file header: { lage (kör|frågar|klar|fast), uppdaterad (ms) }, or null if there is no header.
function statusHuvud(rot, rel) {
  const rader = las(path.join(rot, rel)).split(/\r?\n/).slice(0, 6);
  let lage = null;
  let uppd = null;
  for (const r of rader) {
    let m = r.match(fmt.statusRadRe('lage'));
    if (m) lage = fmt.normaliseraLage(m[1]);
    m = r.match(fmt.statusRadRe('uppdaterad'));
    if (m) { const d = m[1].match(/\d{4}-\d{2}-\d{2}/); if (d) uppd = datumMs(d[0]); }
  }
  if (!lage) return null;
  return { lage, uppdaterad: uppd || mtime(rot, rel) };
}

function statusFiler(rot) {
  let namn = [];
  try { namn = fs.readdirSync(path.join(rot, 'status')); } catch { /* no status/ */ }
  return namn.filter((n) => /\.md$/i.test(n)).map((n) => 'status/' + n);
}

function planera(rot, nu, sparade) {
  const plan = [];
  const slugs = projektSlugs(rot);
  const oppna = oppnaBeslut(rot);
  const overlamning = las(path.join(rot, fmt.filnamn(rot, 'overlamning')));
  const idag = las(path.join(rot, fmt.filnamn(rot, 'idag')));
  const alla = statusFiler(rot);
  const huvuden = {};
  for (const rel of alla) huvuden[rel] = statusHuvud(rot, rel);
  const aktivaStatus = alla.filter((r) => huvuden[r] && ['kör', 'frågar'].includes(huvuden[r].lage)).map((r) => las(path.join(rot, r))).join('\n');

  // status: finished status files nobody is waiting for
  for (const rel of alla) {
    const n = path.basename(rel);
    const h = huvuden[rel];
    if (n.startsWith('_') || !h || h.lage !== 'klar') continue;
    if (nu - h.uppdaterad <= REGLER.status.dagar * DAG_MS) continue;
    if (slugs.has(normalisera(n.replace(/\.md$/i, '')))) continue;
    if (oppna.includes(n) || overlamning.includes(n)) continue;
    plan.push({ regel: 'status', fran: rel });
  }

  // logg: finished run logs whose project is not running
  let loggar = [];
  try { loggar = fs.readdirSync(path.join(rot, 'status', 'logg')); } catch { /* no logs */ }
  for (const n of loggar) {
    if (!/\.jsonl$/i.test(n)) continue;
    const rel = 'status/logg/' + n;
    if (nu - filDatumMs(rot, rel) <= REGLER.logg.dagar * DAG_MS) continue;
    if (!las(path.join(rot, rel)).includes('total_cost_usd')) continue;
    const slug = n.replace(/\.jsonl$/i, '').replace(/^\d{4}-\d{2}-\d{2}-/, '');
    const h = huvuden['status/' + slug + '.md'];
    if (h && h.lage === 'kör') continue;
    plan.push({ regel: 'logg', fran: rel });
  }

  // briefs: old task briefs nothing refers to any more
  const briefMapp = fmt.filnamn(rot, 'agenter');
  let briefs = [];
  try { briefs = fs.readdirSync(path.join(rot, briefMapp)); } catch { /* no briefs */ }
  const briefText = oppna + '\n' + overlamning + '\n' + idag + '\n' + aktivaStatus;
  for (const n of briefs) {
    if (!/\.md$/i.test(n)) continue;
    const rel = briefMapp + '/' + n;
    if (nu - filDatumMs(rot, rel) <= REGLER.briefs.dagar * DAG_MS) continue;
    if (briefText.includes(n)) continue;
    plan.push({ regel: 'briefs', fran: rel });
  }

  // skisser: old sketches nothing mentions
  const nyaAnteckningar = [];
  const anteckningsMapp = fmt.filnamn(rot, 'tankar');
  for (const rel of gaIgenom(rot, anteckningsMapp)) {
    if (nu - filDatumMs(rot, rel) <= REGLER.skisser.anteckningarDagar * DAG_MS) nyaAnteckningar.push(las(path.join(rot, rel)));
  }
  const skissText = oppna + '\n' + overlamning + '\n' + nyaAnteckningar.join('\n') + '\n' + las(path.join(rot, fmt.filnamn(rot, 'projektregister')));
  for (const rel of gaIgenom(rot, 'skisser')) {
    if (nu - mtime(rot, rel) <= REGLER.skisser.dagar * DAG_MS) continue;
    const delar = rel.split('/');
    const namnas = [rel, path.basename(rel)];
    for (let i = 2; i < delar.length; i++) namnas.push(delar.slice(0, i).join('/'));
    if (namnas.some((s) => skissText.includes(s))) continue;
    plan.push({ regel: 'skisser', fran: rel });
  }

  // inbox: finished rows under Done that are older than 30 days
  const inboxRel = fmt.filnamn(rot, 'inkorg');
  const inboxText = las(path.join(rot, inboxRel));
  if (inboxText) {
    const rader = inboxText.split(/\r?\n/);
    let inne = false;
    let aktuell = null;
    for (let i = 0; i < rader.length; i++) {
      const m = rader[i].match(/^## (.+?)\s*$/);
      if (m) { inne = fmt.arKlartRubrik(m[1]); aktuell = null; continue; }
      if (!inne) continue;
      const d = rader[i].match(/^\s*[-*]\s*(\d{4}-\d{2}-\d{2})/);
      if (d) {
        aktuell = { regel: 'inbox', fran: inboxRel, datum: d[1], text: rader[i], rader: [i] };
        if (nu - datumMs(d[1]) > REGLER.inbox.dagar * DAG_MS) plan.push(aktuell); else aktuell = null;
      } else if (aktuell && /^\s+\S/.test(rader[i])) {
        aktuell.text += '\n' + rader[i];
        aktuell.rader.push(i);
      } else {
        aktuell = null;
      }
    }
  }
  return plan;
}

function arUtom(post, utom) {
  const f = post.fran;
  return utom.some((u) => f === u || f.startsWith(u.replace(/\/$/, '') + '/'));
}

function manadsmapp(rot, manad) { return `${fmt.filnamn(rot, 'arkiv')}/cleaned-${manad}`; }

function lasLogg(rot) {
  return las(path.join(rot, fmt.filnamn(rot, 'arkiv'), 'cleanup-log.jsonl')).split('\n').filter(Boolean)
    .map((r) => { try { return JSON.parse(r); } catch { return null; } }).filter(Boolean);
}

function laggTillLogg(rot, poster) {
  if (!poster.length) return;
  const p = path.join(rot, fmt.filnamn(rot, 'arkiv'), 'cleanup-log.jsonl');
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.appendFileSync(p, poster.map((x) => JSON.stringify(x)).join('\n') + '\n', 'utf8');
}

function flyttaFil(rot, fran, till, sparade, anvandGit) {
  const a = path.join(rot, fran);
  const b = path.join(rot, till);
  if (!fs.existsSync(a)) throw new Error('does not exist: ' + fran);
  if (fs.existsSync(b)) throw new Error('target already exists: ' + till);
  fs.mkdirSync(path.dirname(b), { recursive: true });
  const spar = anvandGit && sparade.has(fran);
  if (spar) git(rot, ['mv', '--', fran, till]);
  else fs.renameSync(a, b);
  return spar;
}

function eolAv(text) { return text.includes('\r\n') ? '\r\n' : '\n'; }

function flyttaInboxRader(rot, poster, till) {
  const inboxRel = poster[0].fran;
  const p = path.join(rot, inboxRel);
  const text = las(p);
  const eol = eolAv(text);
  const rader = text.split(/\r?\n/);
  const bort = new Set();
  for (const x of poster) x.rader.forEach((i) => bort.add(i));
  const kvar = rader.filter((_, i) => !bort.has(i));
  const mal = path.join(rot, till);
  const fore = las(mal);
  const huvud = fore ? '' : `# Finished from inbox.md ${path.basename(till).replace(/^inbox-|\.md$/g, '')}${eol}${eol}`;
  const ny = poster.map((x) => x.text.split('\n').join(eol)).join(eol) + eol;
  skriv(mal, (fore ? fore.replace(/\s*$/, eol) : huvud) + ny);
  skriv(p, kvar.join(eol));
}

function kor(rot, plan, anvandGit, sparade) {
  const tid = tidNu();
  const manad = tid.slice(0, 7);
  const gjort = [];
  const rorda = [];
  const inboxPerManad = {};
  for (const f of plan) {
    if (f.regel === 'inbox') {
      const m = f.datum.slice(0, 7);
      (inboxPerManad[m] = inboxPerManad[m] || []).push(f);
      continue;
    }
    const till = manadsmapp(rot, manad) + '/' + f.fran;
    try {
      const spar = flyttaFil(rot, f.fran, till, sparade, anvandGit);
      gjort.push({ time: tid, from: f.fran, to: till, rule: f.regel });
      if (spar) rorda.push(f.fran, till);
    } catch (e) {
      console.error('skipped ' + f.fran + ': ' + e.message);
    }
  }
  for (const [m, poster] of Object.entries(inboxPerManad)) {
    const till = `${fmt.filnamn(rot, 'arkiv')}/inbox-${m}.md`;
    try {
      flyttaInboxRader(rot, poster, till);
      for (const x of poster) gjort.push({ time: tid, from: x.fran, to: till, rule: 'inbox', line: x.text });
      rorda.push(poster[0].fran, till);
    } catch (e) {
      console.error('skipped inbox rows: ' + e.message);
    }
  }
  laggTillLogg(rot, gjort);
  if (gjort.length) rorda.push(fmt.filnamn(rot, 'arkiv') + '/cleanup-log.jsonl');
  return { gjort, rorda, manad };
}

function restore(rot, datum, anvandGit, sparade) {
  return aterstallDar(rot, (p) => String(p.time).startsWith(datum), anvandGit, sparade);
}

// A project that is taken up again: the status file and the project's run logs come back, whenever they were cleaned.
// /agent runs this before starting an agent, so the next agent finds where the last one stopped.
function bringBack(rot, slug, anvandGit, sparade) {
  const status = `status/${slug}.md`;
  const arLogg = (p) => p.startsWith('status/logg/') && p.endsWith('.jsonl') && path.basename(p).includes(slug);
  return aterstallDar(rot, (p) => p.from === status || arLogg(p.from), anvandGit, sparade);
}

function aterstallDar(rot, villkor, anvandGit, sparade) {
  const logg = lasLogg(rot);
  const restored = logg.filter((p) => p.rule === 'restore');
  const kvar = [];
  for (const p of logg) {
    if (p.rule === 'restore' || !villkor(p)) continue;
    const i = restored.findIndex((r) => r.from === p.to && r.to === p.from && (!p.line || r.line === p.line) && r.of === p.time);
    if (i >= 0) { restored.splice(i, 1); continue; }
    kvar.push(p);
  }
  const tid = tidNu();
  const gjort = [];
  const rorda = [];
  for (const p of kvar.reverse()) {
    try {
      if (p.rule === 'inbox') {
        restoreInboxRow(rot, p);
        gjort.push({ time: tid, from: p.to, to: p.from, rule: 'restore', of: p.time, line: p.line });
        rorda.push(p.from, p.to);
        continue;
      }
      const spar = flyttaFil(rot, p.to, p.from, sparade, anvandGit);
      gjort.push({ time: tid, from: p.to, to: p.from, rule: 'restore', of: p.time });
      if (spar) rorda.push(p.to, p.from);
    } catch (e) {
      console.error('skipped ' + p.to + ': ' + e.message);
    }
  }
  laggTillLogg(rot, gjort);
  if (gjort.length) rorda.push(fmt.filnamn(rot, 'arkiv') + '/cleanup-log.jsonl');
  return { gjort, rorda };
}

// Takes an inbox row back from the monthly archive and puts it last under Done in inbox.md.
function restoreInboxRow(rot, p) {
  const arkiv = path.join(rot, p.to);
  const arkText = las(arkiv);
  const eol = eolAv(arkText || '\n');
  const blockRader = p.line.split('\n');
  const rader = arkText.split(/\r?\n/);
  const start = rader.findIndex((r, i) => r === blockRader[0] && blockRader.every((b, k) => rader[i + k] === b));
  if (start < 0) throw new Error('the row is not in ' + p.to);
  rader.splice(start, blockRader.length);
  skriv(arkiv, rader.join(eol));
  const ip = path.join(rot, p.from);
  const itext = las(ip);
  const ieol = eolAv(itext);
  const irader = itext.split(/\r?\n/);
  let doneStart = -1;
  for (let i = 0; i < irader.length; i++) {
    const m = irader[i].match(/^## (.+?)\s*$/);
    if (m && fmt.arKlartRubrik(m[1])) { doneStart = i; break; }
  }
  if (doneStart < 0) { irader.push('', '## Done', ''); doneStart = irader.length - 3; }
  let slut = irader.length;
  for (let i = doneStart + 1; i < irader.length; i++) if (/^## /.test(irader[i])) { slut = i; break; }
  while (slut - 1 > doneStart && irader[slut - 1].trim() === '') slut--;
  irader.splice(slut, 0, ...blockRader);
  skriv(ip, irader.join(ieol));
}

function committa(rot, rorda, meddelande) {
  const unika = [...new Set(rorda)].filter((p) => fs.existsSync(path.join(rot, p)) || git(rot, ['ls-tree', 'HEAD', '--', p]).trim() !== '');
  // New or changed files the cleaner wrote itself (inbox, archive files, the log) must be staged first.
  const ejIndex = unika.filter((p) => fs.existsSync(path.join(rot, p)) && /(^|\/)(inbox[^/]*\.md|cleanup-log\.jsonl)$/.test(p));
  if (ejIndex.length) git(rot, ['add', '--', ...ejIndex]);
  git(rot, ['commit', '-q', '-m', meddelande, '--', ...unika]);
}

const RUBRIK = {
  status: 'status/*.md, finished and untouched',
  logg: 'status/logg, finished runs',
  briefs: 'briefs, old tasks',
  skisser: 'skisser, old and unmentioned',
  inbox: 'inbox.md, finished rows',
};

function visa(plan, allt) {
  if (!plan.length) { console.log('Nothing to move.'); return; }
  const grupper = {};
  for (const f of plan) (grupper[f.regel] = grupper[f.regel] || []).push(f);
  const namn = Object.keys(grupper);
  const perRegel = allt ? Infinity : Math.max(3, Math.floor((RADBUDGET - namn.length * 2) / namn.length));
  console.log(`The cleaner has ${plan.length} things to move:`);
  for (const r of namn) {
    const lista = grupper[r];
    console.log(`${RUBRIK[r]} (${lista.length}):`);
    lista.slice(0, perRegel).forEach((f) => console.log('  ' + (f.regel === 'inbox' ? f.text.split('\n')[0].trim().slice(0, 70) : f.fran)));
    if (lista.length > perRegel) console.log(`  … and ${lista.length - perRegel} more`);
  }
}

function main() {
  const args = process.argv.slice(2);
  const varde = (flagga) => { const i = args.indexOf(flagga); return i >= 0 ? args[i + 1] : undefined; };
  const utom = [];
  args.forEach((a, i) => { if (a === '--except' && args[i + 1]) utom.push(fram(args[i + 1]).replace(/^\.\//, '')); });
  const rot = requireRoot();
  const anvandGit = arGitRepo(rot);
  const sparade = sparadeFiler(rot, anvandGit);
  const datum = varde('--restore');

  if (args.includes('--bring-back')) {
    const slug = varde('--bring-back');
    if (!slug) { console.error('Give a project: --bring-back <slug>'); process.exit(2); }
    const r = bringBack(rot, slug, anvandGit, sparade);
    console.log(r.gjort.length ? `${r.gjort.length} brought back for ${slug}.` : `Nothing archived for ${slug}.`);
    if (args.includes('--commit') && r.gjort.length && anvandGit) committa(rot, r.rorda, `Cleanup: ${slug} brought back from the archive`);
    return;
  }

  if (args.includes('--restore')) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(datum || '')) { console.error('Give a date: --restore YYYY-MM-DD'); process.exit(2); }
    const r = restore(rot, datum, anvandGit, sparade);
    console.log(`${r.gjort.length} restored.`);
    if (args.includes('--commit') && r.gjort.length && anvandGit) committa(rot, r.rorda, `Restore cleanup ${datum}: ${r.gjort.length} files`);
    return;
  }

  const plan = planera(rot, Date.now(), sparade).filter((f) => !arUtom(f, utom));
  if (!args.includes('--run')) { visa(plan, args.includes('--all')); return; }
  const r = kor(rot, plan, anvandGit, sparade);
  console.log(`${r.gjort.length} moved to ${manadsmapp(rot, r.manad)}.`);
  if (args.includes('--commit') && r.gjort.length && anvandGit) {
    committa(rot, r.rorda, `Cleanup ${datumStr(new Date())}: ${r.gjort.length} files to ${manadsmapp(rot, r.manad)}`);
  }
}

main();
