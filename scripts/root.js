// The single place that decides where the notebook lives, and that reads its settings (rooflow.json).
//
// Root rule (no other fallback exists, on purpose):
//   1. the environment variable ROOFLOW_ROOT, if set
//   2. otherwise the nearest parent of the current directory (itself included) that contains rooflow.json
//   3. otherwise: stop with a clear error
//
//   const { requireRoot, loadConfig, projectMatches } = require('./root');
//   const root = requireRoot();
//   const { config, error, exists } = loadConfig(root);
//
// From shell scripts:  ROOT="$(node "$DIR/root.js")"   and   node "$DIR/root.js" config claudeCli
'use strict';

const fs = require('fs');
const path = require('path');
const categoriesModule = require('./categories');

const NO_ROOT_MESSAGE = 'No RooFlow notebook found: run /rooflow-setup or set ROOFLOW_ROOT';

const DEFAULTS = {
  format: 1,
  name: '',
  language: 'en',
  // '' = found by scripts/claude-cli.js; a value is an override.
  claudeCli: '',
  trustAgentFolders: false,
  projectsDir: '',
  models: { routine: 'haiku', agents: 'sonnet', build: 'sonnet' },
  // Where work runs, per kind: "hidden" (a subagent or scripts/agent.sh) or "tree" (a session in the app's session tree).
  visibility: { routine: 'hidden', agents: 'hidden', build: 'hidden' },
  // Project categories (scripts/categories.js). Without the key in rooflow.json the default for the language applies.
  categories: null,
  team: { enabled: false, sharedRepos: [] },
  projects: {},
};

const SYNLIGHET = ['hidden', 'tree'];

// Returns the notebook root, or null when there is none.
function findRoot(cwd = process.cwd(), env = process.env) {
  if (env.ROOFLOW_ROOT) return path.resolve(env.ROOFLOW_ROOT);
  let dir = path.resolve(cwd);
  for (;;) {
    if (fs.existsSync(path.join(dir, 'rooflow.json'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

// Returns the notebook root, or prints the error and exits with code 2.
function requireRoot() {
  const root = findRoot();
  if (!root) {
    process.stderr.write(NO_ROOT_MESSAGE + '\n');
    process.exit(2);
  }
  return root;
}

// Reads <root>/rooflow.json. A missing file or field gives the default value.
// Older files with Swedish keys (namn, sprak, projekt, mapp) are still understood.
// Returns { config, error, exists }; error is '' when the file is missing or valid.
function loadConfig(root) {
  const file = path.join(root, 'rooflow.json');
  let text;
  try { text = fs.readFileSync(file, 'utf8').replace(/^﻿/, ''); } catch { return { config: standard(), error: '', exists: false }; }
  let o;
  try { o = JSON.parse(text); } catch (e) { return { config: standard(), error: 'invalid JSON: ' + e.message, exists: true }; }
  if (!o || typeof o !== 'object' || Array.isArray(o)) return { config: standard(), error: 'the root must be an object', exists: true };

  const str = (v, d) => (typeof v === 'string' ? v : d);
  const rawProjects = o.projects ?? o.projekt;
  const config = {
    format: Number.isInteger(o.format) ? o.format : DEFAULTS.format,
    name: str(o.name ?? o.namn, DEFAULTS.name),
    language: str(o.language ?? o.sprak, DEFAULTS.language),
    claudeCli: str(o.claudeCli, DEFAULTS.claudeCli).trim(),
    trustAgentFolders: o.trustAgentFolders === true,
    projectsDir: str(o.projectsDir, DEFAULTS.projectsDir),
    models: {
      routine: str(o.models?.routine, DEFAULTS.models.routine) || DEFAULTS.models.routine,
      agents: str(o.models?.agents, DEFAULTS.models.agents) || DEFAULTS.models.agents,
      build: str(o.models?.build, DEFAULTS.models.build) || DEFAULTS.models.build,
    },
    visibility: {
      routine: SYNLIGHET.includes(o.visibility?.routine) ? o.visibility.routine : DEFAULTS.visibility.routine,
      agents: SYNLIGHET.includes(o.visibility?.agents) ? o.visibility.agents : DEFAULTS.visibility.agents,
      build: SYNLIGHET.includes(o.visibility?.build) ? o.visibility.build : DEFAULTS.visibility.build,
    },
    categories: null,
    categoriesSet: o.categories !== undefined,
    team: {
      enabled: o.team?.enabled === true,
      sharedRepos: Array.isArray(o.team?.sharedRepos) ? o.team.sharedRepos.filter((s) => typeof s === 'string') : [],
    },
    projects: {},
  };
  let error = '';
  const cat = categoriesModule.fromConfig(o.categories, config.language);
  config.categories = cat.categories;
  if (cat.error) error = cat.error;
  if (o.format !== undefined && o.format !== 1) error = error || `unknown format ${JSON.stringify(o.format)} (expected 1)`;
  if (rawProjects && typeof rawProjects === 'object' && !Array.isArray(rawProjects)) {
    for (const [slug, v] of Object.entries(rawProjects)) {
      if (!v || typeof v !== 'object') { error = error || `projects.${slug} must be an object`; continue; }
      // run: the folder that holds run.json, when it is not the project's folder.
      config.projects[slug] = { ...v, folder: str(v.folder ?? v.mapp, ''), run: str(v.run, '') };
    }
  }
  return { config, error, exists: true };
}

// The defaults with the category default filled in (English, since there is no language without a file).
function standard() {
  const c = clone(DEFAULTS);
  c.categories = categoriesModule.defaults(c.language);
  c.categoriesSet = false;
  return c;
}

function clone(o) {
  return JSON.parse(JSON.stringify(o));
}

// Does a status file (its slug and its Project: line) belong to project p? Project: goes first; otherwise
// slug === p or p-... . No bare startsWith: "alpha-web" is not "alpha".
function projectMatches(slug, p, projectLine) {
  const pn = String(p).toLowerCase();
  const line = String(projectLine || '').trim().toLowerCase();
  if (line) return line === pn || line.startsWith(pn + '-') || line.startsWith(pn + ' ');
  const s = String(slug).toLowerCase();
  return s === pn || s.startsWith(pn + '-');
}

module.exports = { NO_ROOT_MESSAGE, DEFAULTS, findRoot, requireRoot, loadConfig, projectMatches };

if (require.main === module) {
  const args = process.argv.slice(2);
  const root = requireRoot();
  if (args[0] === 'config') {
    const v = loadConfig(root).config[args[1]];
    process.stdout.write((v === undefined ? '' : String(v)) + '\n');
  } else {
    process.stdout.write(root + '\n');
  }
}
