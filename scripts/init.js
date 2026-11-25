#!/usr/bin/env node
// Creates a notebook from templates/ in a folder. Never overwrites a file that already exists: it prints "kept" for it.
//
//   node scripts/init.js [--root <folder>] [--name <name>] [--language en|sv] [--no-radar]
//
//   --root       the notebook folder (default: the current directory). Created if it does not exist.
//   --name       the owner's name, written to rooflow.json only when that file is created
//   --language   en (default) or sv, written to rooflow.json only when that file is created. With sv each file is taken from
//                templates/sv/ when it is there (Swedish headings and prose; the keys the scripts read stay English),
//                otherwise from templates/.
//   --no-radar   do not run scripts/radar.js afterwards (it writes status/radar.json, which scripts/doctor.js wants)
//
// Files made: rooflow.json, decisions.md, promises.md, inbox.md, today.md, handover.md, projects.md, commands.md, CLAUDE.md,
// status/_template.md and the folders status/, notes/, archive/, briefs/. after-release.md is not made here: the ship skill
// creates it when something is first added to it. {{DATE}} in a template becomes today's date.
// The overview run writes radar.md, status/radar.json and status/radar-forra.json; those it made are listed as "overview".
// The last stdout line is JSON: {"ok":true,"root":"...","created":[...],"kept":[...],"overview":[...]} or {"fel":"..."} (and exit 1).
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const fmt = require('./format');
const categories = require('./categories');

const TEMPLATES = path.join(__dirname, '..', 'templates');
const FILES = [
  'rooflow.json', 'decisions.md', 'promises.md', 'inbox.md', 'today.md', 'handover.md', 'projects.md', 'commands.md', 'CLAUDE.md',
  'status/_template.md',
];
const FOLDERS = ['status', 'notes', 'archive', 'briefs'];
const OVERVIEW_FILES = ['radar.md', 'status/radar.json', 'status/radar-forra.json'];
// Names an older (Swedish) notebook may already use for the same file. A template is not created when one of them exists,
// so that two files never answer for the same thing. Files that format.js knows (beslut.md ...) are added below.
const OLD_NAMES = {
  'commands.md': ['kommandon.md'],
  'status/_template.md': ['status/_mall.md'],
};
for (const [key, names] of Object.entries(fmt.FILER)) {
  const en = names.en;
  if (en.endsWith('.md')) OLD_NAMES[en] = [...(OLD_NAMES[en] || []), names.sv];
}

function arg(name, standard) {
  const i = process.argv.indexOf(name);
  return i > 0 && i + 1 < process.argv.length ? process.argv[i + 1] : standard;
}

function fail(text) {
  console.log(JSON.stringify({ fel: text }));
  process.exit(1);
}

// The template for a file in the owner's language: templates/<language>/<rel> if it exists, otherwise templates/<rel>.
function templateFor(rel, language) {
  if (language !== 'en') {
    const own = path.join(TEMPLATES, language, rel);
    if (fs.existsSync(own)) return own;
  }
  return path.join(TEMPLATES, rel);
}

function today() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function main() {
  const root = path.resolve(arg('--root', process.cwd()));
  const name = arg('--name', '');
  const language = arg('--language', 'en');
  if (!['en', 'sv'].includes(language)) fail(`language must be en or sv, not "${language}"`);

  fs.mkdirSync(root, { recursive: true });
  const created = [];
  const kept = [];

  for (const rel of FILES) {
    const target = path.join(root, rel);
    if (fs.existsSync(target)) { kept.push(rel); continue; }
    const old = (OLD_NAMES[rel] || []).find((n) => fs.existsSync(path.join(root, n)));
    if (old) { kept.push(rel + ' (' + old + ' exists)'); continue; }
    let text = fs.readFileSync(templateFor(rel, language), 'utf8').replace(/^﻿/, '');
    if (rel === 'rooflow.json') {
      const o = JSON.parse(text);
      o.name = name;
      o.language = language;
      // The template's category labels are English; the owner's language gets its own (scripts/categories.js).
      const labels = categories.labelsFor(language);
      for (const [key, c] of Object.entries(o.categories || {})) {
        if (labels[key]) c.label = labels[key];
      }
      text = JSON.stringify(o, null, 2) + '\n';
    } else {
      text = text.replace(/\{\{DATE\}\}/g, today());
    }
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, text, 'utf8');
    created.push(rel);
  }
  const oldFolder = { notes: fmt.FILER.tankar.sv, archive: fmt.FILER.arkiv.sv, briefs: fmt.FILER.agenter.sv };
  for (const f of FOLDERS) {
    if (oldFolder[f] && fs.existsSync(path.join(root, oldFolder[f]))) continue;
    fs.mkdirSync(path.join(root, f), { recursive: true });
  }

  const overview = [];
  if (!process.argv.includes('--no-radar')) {
    const before = new Set(OVERVIEW_FILES.filter((rel) => fs.existsSync(path.join(root, rel))));
    const r = spawnSync(process.execPath, [path.join(__dirname, 'radar.js'), '--quiet'], {
      cwd: root, env: { ...process.env, ROOFLOW_ROOT: root }, encoding: 'utf8',
    });
    if (r.status !== 0) console.error('Note: scripts/radar.js did not run cleanly: ' + (r.stderr || '').trim());
    for (const rel of OVERVIEW_FILES) if (!before.has(rel) && fs.existsSync(path.join(root, rel))) overview.push(rel);
  }

  for (const rel of created) console.log('created ' + rel);
  for (const rel of kept) console.log('kept    ' + rel);
  for (const rel of overview) console.log('created ' + rel + ' (by the overview)');
  console.log(JSON.stringify({ ok: true, root, created, kept, overview }));
}

main();
