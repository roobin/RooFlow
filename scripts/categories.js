#!/usr/bin/env node
// Project categories: the Category column of projects.md matched against rooflow.json "categories".
//
//   "categories": {
//     "work":    { "label": "work" },
//     "private": { "label": "private", "private": true },
//     "home":    { "label": "home", "machine": "Other-PC", "private": true },
//     "archive": { "label": "archive", "hidden": true }
//   }
//
// The keys are stable English words; the label is the owner's own name for the category. The framework only knows the
// properties, never the names:
//   machine  the project lives on another computer: no folder check in doctor, agent.sh and agent-resume.sh refuse it,
//            no Servers, /agent says it is run from that computer
//   private  never goes to the team space or into anything that is shared
//   hidden   not shown in Radar and the panel
//
// A cell matches a category by its key or its label, trimmed and case-insensitive. An empty cell or a dash is "no category".
// Without "categories" in rooflow.json the default applies: only "archive" (label "arkiv" in Swedish), hidden.
//
//   node scripts/categories.js project <slug>      the project's category as JSON (key '' when it has none or it is unknown)
//   node scripts/categories.js check-folder <dir>  exit 3 with a message when the folder belongs to a machine project
//   node scripts/categories.js suggest <en|sv>     the suggested set for /rooflow-setup as JSON
'use strict';

// Labels for the suggested set and the default, per language. Other languages get the English labels.
const LABELS = {
  en: { work: 'work', private: 'private', home: 'home', archive: 'archive' },
  sv: { work: 'jobb', private: 'privat', home: 'hemma', archive: 'arkiv' },
};

function labelsFor(language) {
  return LABELS[language] || LABELS.en;
}

// What applies when rooflow.json has no "categories": the archive is hidden, nothing else is known.
function defaults(language) {
  return { archive: { label: labelsFor(language).archive, machine: '', private: false, hidden: true } };
}

// The set /rooflow-setup proposes (machine is only asked for when a category lives on another computer).
function suggested(language) {
  const l = labelsFor(language);
  return {
    work: { label: l.work, machine: '', private: false, hidden: false },
    private: { label: l.private, machine: '', private: true, hidden: false },
    home: { label: l.home, machine: '', private: true, hidden: false },
    archive: { label: l.archive, machine: '', private: false, hidden: true },
  };
}

// rooflow.json "categories" -> { categories, error }. Missing gives the default for the language.
function fromConfig(raw, language) {
  if (raw === undefined || raw === null) return { categories: defaults(language), error: '' };
  if (typeof raw !== 'object' || Array.isArray(raw)) return { categories: defaults(language), error: 'categories must be an object' };
  const categories = {};
  let error = '';
  for (const [key, v] of Object.entries(raw)) {
    if (!v || typeof v !== 'object' || Array.isArray(v)) {
      error = error || `categories.${key} must be an object`;
      continue;
    }
    if (v.machine !== undefined && typeof v.machine !== 'string') error = error || `categories.${key}.machine must be a text`;
    categories[key] = {
      label: typeof v.label === 'string' && v.label.trim() ? v.label.trim() : key,
      machine: typeof v.machine === 'string' ? v.machine.trim() : '',
      private: v.private === true,
      hidden: v.hidden === true,
    };
  }
  return { categories, error };
}

function isBlank(cell) {
  const s = String(cell || '').trim();
  return s === '' || s === '–' || s === '-' || s === '—';
}

// A projects.md cell -> { key, label, machine, private, hidden, known, blank }. The key goes before the label.
function resolve(categories, cell) {
  const text = String(cell || '').trim();
  const none = { key: '', label: text, machine: '', private: false, hidden: false, known: false, blank: isBlank(text) };
  if (none.blank) return none;
  const s = text.toLowerCase();
  const entries = Object.entries(categories || {});
  let hit = entries.find(([key]) => key.toLowerCase() === s);
  if (!hit) hit = entries.find(([, c]) => c.label.toLowerCase() === s);
  if (!hit) return none;
  const [key, c] = hit;
  return { key, label: c.label, machine: c.machine, private: c.private, hidden: c.hidden, known: true, blank: false };
}

module.exports = { LABELS, labelsFor, defaults, suggested, fromConfig, resolve, isBlank };

if (require.main === module) {
  // Loaded here only: root.js and register.js load this module themselves.
  const fs = require('fs');
  const path = require('path');
  const { requireRoot, loadConfig } = require('./root');
  const register = require('./register');
  const fmt = require('./format');
  const [verb, value] = process.argv.slice(2);

  if (verb === 'suggest') {
    process.stdout.write(JSON.stringify(suggested(value || 'en')) + '\n');
    process.exit(0);
  }
  const root = requireRoot();
  const { config } = loadConfig(root);
  let text = '';
  try { text = fs.readFileSync(path.join(root, fmt.filnamn(root, 'projektregister')), 'utf8'); } catch { /* no register */ }
  const rows = register.registerRows(text, config.categories);

  if (verb === 'project') {
    const row = rows.find((r) => r.slug === String(value || '').toLowerCase());
    const c = row ? row.kategori : resolve(config.categories, '');
    process.stdout.write(JSON.stringify({ project: row ? row.mapp : '', ...c }) + '\n');
    process.exit(0);
  }
  if (verb === 'check-folder') {
    const row = register.rowForFolder(root, config, rows, value || '');
    if (row && row.kategori.machine) {
      process.stderr.write(`ERROR: ${row.mapp} lives on ${row.kategori.machine} (category ${row.kategori.label}): start its agents from there.\n`);
      process.exit(3);
    }
    process.exit(0);
  }
  process.stderr.write('Usage: node scripts/categories.js project <slug> | check-folder <dir> | suggest <en|sv>\n');
  process.exit(2);
}
