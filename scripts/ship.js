#!/usr/bin/env node
// /ship <project>: collects the facts before a release. Read-only; never pushes (the skill pushes after your yes).
//
//   node scripts/ship.js <project> [--days <n>]
//
// 1. Open B-ids for the project (decisions.md: Task or Project)
// 2. What the reports say they have NOT tested (status/journal.jsonl, last 14 days)
// 3. Unpushed commits in the project's repo (folder from rooflow.json projects.<p>.folder, otherwise projects.md)
// 4. The project's after-release list (after-release.md: the section "## <project>", otherwise the heading on top).
//    If the file or the section is missing: "no after-release list for <project> yet".
// First a line with the project's category (scripts/categories.js): a private project is never sent to the team space,
// and a project whose category has machine lives on another computer, so its folder is not looked for here.
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const fmt = require('./format');
const { requireRoot, loadConfig, projectMatches } = require('./root');
const { projectFolder, registerRows } = require('./register');

function arg(namn, standard) {
  const i = process.argv.indexOf(namn);
  return i > 0 ? process.argv[i + 1] : standard;
}

function lasFil(rot, rel) {
  try { return fs.readFileSync(path.join(rot, rel), 'utf8'); } catch { return null; }
}

function git(mapp, args) {
  try { return execFileSync('git', ['-C', mapp, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch { return null; }
}

// The project folder: rooflow.json first, otherwise the Folder column of projects.md (under projectsDir).
function projektMapp(rot, p, config) {
  return projectFolder(rot, config, p, lasFil(rot, fmt.filnamn(rot, 'projektregister')) || '');
}

// The project's category from projects.md (scripts/categories.js), hidden projects included.
function projektKategori(rot, p, config) {
  const rows = registerRows(lasFil(rot, fmt.filnamn(rot, 'projektregister')) || '', config.categories);
  const row = rows.find((r) => r.slug === String(p).toLowerCase());
  return row ? row.kategori : null;
}

function oppnaBeslut(rot, p) {
  const text = lasFil(rot, fmt.filnamn(rot, 'beslut')) || '';
  const ut = [];
  let nu = null;
  for (const rad of text.split(/\r?\n/)) {
    if (rad.startsWith('## ')) { nu = { rubrik: rad.slice(3).trim(), id: '', projekt: '', uppdrag: '', blockerar: '' }; continue; }
    if (!nu) continue;
    const id = rad.match(/^- Id:\s*(B\d+)/);
    if (id) { nu.id = id[1]; ut.push(nu); continue; }
    for (const k of ['projekt', 'uppdrag', 'blockerar']) {
      const m = rad.match(new RegExp('^- (' + fmt.BESLUT[k].join('|') + '):\\s*(.+)$'));
      if (m) nu[k] = m[2].trim();
    }
  }
  const ord = (s) => s.toLowerCase().split(/[\s,/]+/);
  return ut.filter((b) => (b.uppdrag && projectMatches(b.uppdrag, p, '')) || ord(b.projekt).some((w) => w === p.toLowerCase() || w.startsWith(p.toLowerCase() + '-')));
}

const INTE_PROVAT = /(INTE\s+(?:prövat|provat|testat)|Inte\s+(?:prövat|provat|testat)|Not\s+tested|NOT\s+tested)\b[^\n]*(?:\n[ \t]+[^\n]*)*/;

// The report's "NOT tested ..." from the marker to the end of the line, with indented continuation lines.
function inteProvat(rapport) {
  const m = String(rapport || '').match(INTE_PROVAT);
  return m ? m[0].replace(/[*]{2}/g, '').replace(/\s+/g, ' ').trim().slice(0, 500) : '';
}

function ejProvat(rot, p, dagar) {
  const text = lasFil(rot, path.join('status', 'journal.jsonl')) || '';
  const grans = Date.now() - dagar * 86400000;
  const ut = [];
  for (const rad of text.split(/\r?\n/)) {
    if (!rad.trim()) continue;
    let o;
    try { o = JSON.parse(rad); } catch { continue; }
    const j = fmt.journalRad(o);
    const m = String(j.tid || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m || new Date(+m[1], +m[2] - 1, +m[3]).getTime() < grans) continue;
    const slug = String(j.id || '').replace(/^\d{4}-\d{2}-\d{2}-/, '');
    if (!(projectMatches(slug, p, '') || String(j.projekt || '').toLowerCase() === p.toLowerCase())) continue;
    const t = inteProvat(j.rapport);
    if (t) ut.push({ id: j.id, tid: j.tid, text: t });
  }
  return ut;
}

function efterPublicering(rot, p) {
  const filnamn = fs.existsSync(path.join(rot, 'after-release.md')) ? 'after-release.md' : fs.existsSync(path.join(rot, 'efter-publicering.md')) ? 'efter-publicering.md' : '';
  if (!filnamn) return { fil: '', rader: [] };
  const rader = (lasFil(rot, filnamn) || '').split(/\r?\n/);
  const pn = p.toLowerCase();
  const ordIn = (s) => s.toLowerCase().split(/[^a-z0-9åäö]+/).includes(pn);
  // A section "## <project>" first; otherwise the whole file applies if the heading on top (# ...) mentions the project.
  let start = rader.findIndex((r) => /^##\s/.test(r) && ordIn(r));
  let urval = [];
  if (start >= 0) {
    for (let i = start + 1; i < rader.length && !/^#{1,2}\s/.test(rader[i]); i++) urval.push(rader[i]);
  } else {
    const h1 = rader.find((r) => /^#\s/.test(r));
    if (h1 && ordIn(h1.replace(/-?\d+(\.\d+)*/g, ' '))) urval = rader.slice(rader.indexOf(h1) + 1);
  }
  return { fil: filnamn, rader: urval.filter((r) => /^\s*-\s+\[[ xX]\]/.test(r)) };
}

function main() {
  const p = process.argv[2];
  if (!p || p.startsWith('--')) { console.error('Usage: node scripts/ship.js <project> [--days <n>]'); process.exit(2); }
  const rot = requireRoot();
  const dagar = Number(arg('--days', 14));
  const { config } = loadConfig(rot);

  console.log(`SHIP ${p}`);
  const kat = projektKategori(rot, p, config);
  if (kat && kat.known) {
    const om = [];
    if (kat.private) om.push('private: never to the team space or anything shared');
    if (kat.machine) om.push(`lives on ${kat.machine}: push and publish from there`);
    console.log(`category: ${kat.label}${om.length ? ` (${om.join('; ')})` : ''}`);
  }
  if (kat && kat.private && config.team.sharedRepos.some((s) => s.toLowerCase() === p.toLowerCase())) {
    console.log(`WARNING: ${p} is private but listed in rooflow.json team.sharedRepos. Nothing from it goes to the team space; remove it from sharedRepos.`);
  }

  const beslut = oppnaBeslut(rot, p);
  console.log(`\n== 1. Open decisions (${beslut.length})`);
  for (const b of beslut) console.log(`${b.id} ${b.rubrik}${b.blockerar ? ` | blocks: ${b.blockerar}` : ''}`);

  const ej = ejProvat(rot, p, dagar);
  console.log(`\n== 2. Not tested according to the reports, last ${dagar} days (${ej.length})`);
  for (const e of ej) console.log(`[${e.id}] ${e.text}`);

  const mapp = projektMapp(rot, p, config);
  console.log('\n== 3. Unpushed commits');
  if (kat && kat.machine) {
    console.log(`not checked here: ${p} lives on ${kat.machine}`);
  } else if (!mapp || !fs.existsSync(mapp)) {
    console.log(`project folder missing (projects.${p}.folder in rooflow.json or a row in projects.md)`);
  } else {
    const gren = git(mapp, ['rev-parse', '--abbrev-ref', 'HEAD']);
    if (gren === null) {
      console.log(`${mapp} is not a git repo`);
    } else {
      const upstream = git(mapp, ['rev-parse', '--abbrev-ref', '@{u}']);
      const origin = git(mapp, ['remote', 'get-url', 'origin']);
      console.log(`folder: ${mapp}\nbranch: ${gren}\nupstream: ${upstream === null ? 'none' : upstream}\norigin: ${origin === null ? 'none' : origin.replace(/\/\/[^@/]+@/, '//')}`);
      if (upstream === null) {
        console.log('No upstream: cannot count unpushed commits. The first push needs `git push -u origin <branch>` and your yes.');
      } else {
        const antal = git(mapp, ['rev-list', '--count', '@{u}..HEAD']);
        console.log(`unpushed commits: ${antal}`);
        const lista = git(mapp, ['log', '--oneline', '@{u}..HEAD']);
        if (lista) console.log(lista);
        const skit = git(mapp, ['status', '--porcelain']);
        if (skit) console.log(`NOTE: ${skit.split('\n').length} uncommitted changes in the working directory`);
      }
    }
  }

  const ef = efterPublicering(rot, p);
  console.log('\n== 4. After release');
  if (!ef.fil || !ef.rader.length) {
    console.log(`no after-release list for ${p} yet`);
  } else {
    const kvar = ef.rader.filter((r) => /\[ \]/.test(r));
    console.log(`${ef.fil}: ${kvar.length} left, ${ef.rader.length - kvar.length} checked off`);
    for (const r of kvar) console.log(r.trim());
  }
}

if (require.main === module) main();
module.exports = { inteProvat, efterPublicering, oppnaBeslut, ejProvat, projektKategori };
