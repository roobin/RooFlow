// Reads projects.md and status fields.
'use strict';

const fs = require('fs');
const fmt = require('./format');
const categoriesModule = require('./categories');
const { windowsSokvag } = require('./claude-cli');
const path = require('path');

// Bullet fields of the form "- Field: value", where the value may continue on indented
// following lines until the next "- " or end of file.

function parseBulletFields(text) {
  const lines = text.split('\n');
  const fields = {};
  let currentKey = null;

  for (const line of lines) {
    const m = line.match(/^- ([^:]+):\s*(.*)$/);
    if (m) {
      currentKey = m[1].trim();
      fields[currentKey] = m[2].trim();
    } else if (currentKey && /^\s+\S/.test(line)) {
      // continuation line (indented, not a new bullet, not empty)
      fields[currentKey] += ' ' + line.trim();
    } else if (line.trim() === '') {
      currentKey = null;
    }
  }
  return fields;
}


// --- projects.md: the table Folder | Category | Own repo | Remote | State | Comment (or the Swedish headings Mapp | Kategori | Eget repo | Remote | Läge | Kommentar) ---

// The short name (slug) agents and status files use for a project: the folder name in lower case.
function slugFor(folder) {
  return folder.toLowerCase();
}

// Every row of the table, hidden and dash-state rows included: [{ mapp, slug, kategori, lage, kommentar }].
// kategori is the resolved category (scripts/categories.js): { key, label, machine, private, hidden, known, blank }.
function registerRows(text, categories) {
  const lines = String(text || '').split('\n');
  const rows = [];
  let header = null;
  for (const line of lines) {
    const t = line.trim();
    if (!t.startsWith('|')) {
      if (header) break; // the end of the table
      continue;
    }
    const cells = t.split('|').slice(1, -1).map((c) => c.trim());
    if (!header) {
      if (fmt.REGISTER.mapp.includes(cells[0])) header = cells;
      continue;
    }
    if (/^-+$/.test(cells[0].replace(/\s/g, '')) || cells[0].startsWith('---')) continue;
    const rad = {};
    header.forEach((h, i) => {
      rad[h] = cells[i] || '';
    });
    const mapp = fmt.varde(rad, fmt.REGISTER.mapp);
    rows.push({
      mapp,
      slug: slugFor(mapp),
      kategori: categoriesModule.resolve(categories, fmt.varde(rad, fmt.REGISTER.kategori)),
      lage: fmt.normaliseraProjektlage(fmt.varde(rad, fmt.REGISTER.lage)),
      kommentar: fmt.varde(rad, fmt.REGISTER.kommentar) || '',
    });
  }
  return rows;
}

// The projects Radar and the panel show: not in a hidden category, and with a state (not empty or a dash).
// categories: config.categories from scripts/root.js loadConfig.
function parseProjektregister(text, categories) {
  return registerRows(text, categories)
    .filter((p) => !p.kategori.hidden)
    .filter((p) => !(p.lage === '' || p.lage === '–' || p.lage === '-'));
}

// --- project folders ---

// Where a project's folder may be: rooflow.json projects.<slug>.folder first, then <projectsDir>/<Folder>
// (projectsDir defaults to the directory that holds the notebook).
function repoKandidater(root, config, folder) {
  const list = [];
  const own = config.projects[slugFor(folder)];
  if (own && own.folder) list.push(path.resolve(root, own.folder));
  list.push(path.join(config.projectsDir ? path.resolve(root, config.projectsDir) : path.dirname(root), folder));
  return list;
}

// First candidate folder that exists on disk, with or without git.
function repoFinns(root, config, folder) {
  for (const dir of repoKandidater(root, config, folder)) {
    if (fs.existsSync(dir)) return dir;
  }
  return null;
}

// True when rooflow.json names the project's folder itself (projects.<slug>.folder). Such a folder may sit inside a
// larger repository, so git is asked there even without a .git folder of its own.
function folderFromConfig(config, folder) {
  const own = config.projects[slugFor(folder)];
  return !!(own && own.folder);
}

// The folder that holds the project's run.json: projects.<slug>.run when set (relative to the notebook), otherwise the
// project's own folder. '' when neither is known.
function runFolder(root, config, slug, projectDir) {
  const own = config.projects[String(slug).toLowerCase()];
  if (own && own.run) return path.resolve(root, own.run);
  return projectDir || '';
}

// Folder of the project with this slug (config first, then the Folder column of projects.md). '' if unknown.
function projectFolder(root, config, slug, registerText) {
  const own = config.projects[slug];
  if (own && own.folder) return path.resolve(root, own.folder);
  const row = parseProjektregister(registerText || '', config.categories).find((p) => p.slug === String(slug).toLowerCase());
  return row ? repoKandidater(root, config, row.mapp)[0] : '';
}

// A folder as a comparable key: absolute, a Git Bash path (/c/x) as C:/x, no trailing slash, lower case.
function folderKey(root, dir) {
  return path.resolve(root, windowsSokvag(String(dir || ''))).replace(/[\\/]+$/, '').toLowerCase();
}

// The register row a folder belongs to: projects.<slug>.folder pointing at it, otherwise the Folder column equal to the
// folder's last path segment (case-insensitive). null when none matches.
function rowForFolder(root, config, rows, dir) {
  const want = folderKey(root, dir);
  for (const row of rows) {
    const own = config.projects[row.slug];
    if (own && own.folder && folderKey(root, own.folder) === want) return row;
  }
  const last = path.basename(want);
  return rows.find((row) => row.mapp.toLowerCase() === last) || null;
}

module.exports = { parseBulletFields, registerRows, rowForFolder, parseProjektregister, slugFor, repoKandidater, repoFinns, folderFromConfig, runFolder, projectFolder };
