// Is the installed plugin older than its local source repo? Only for someone who develops the plugin and installs it from a
// local marketplace (a folder). `claude plugin update` says "already at the latest version" while the version in plugin.json
// is unchanged, so new commits are never installed. Used by scripts/doctor.js. Read-only: reads two files and asks git.
//
// Everything that is not a local folder source with a git repo is a silent skip: an ordinary user who installed from the
// catalogue must never be warned. A GitHub or git marketplace is also cloned locally, and its clone can move ahead of the
// install, which is why only source "directory" counts.
//
//   const { kontrollera } = require('./plugin-install');
//   const r = kontrollera({ pluginsDir, rot, pluginNamn: 'rooflow' });
//   r.kind: 'skip' | 'same' | 'older' | 'differs'
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

function lasJson(fil) {
  try { return JSON.parse(fs.readFileSync(fil, 'utf8')); } catch { return null; }
}

function sammaSokvag(a, b) {
  const x = path.resolve(a);
  const y = path.resolve(b);
  if (process.platform === 'win32') return x.toLowerCase() === y.toLowerCase();
  return x === y;
}

// git, with stderr silenced. Returns the trimmed output, or null on any failure (not a repo, git missing, unknown commit).
function git(dir, args) {
  try {
    return execFileSync('git', ['-C', dir, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return null;
  }
}

const riktigGit = {
  head: (dir) => git(dir, ['rev-parse', 'HEAD']),
  // true when sha is an ancestor of HEAD, that is: the install is older than the source.
  arForfader: (dir, sha) => git(dir, ['merge-base', '--is-ancestor', sha, 'HEAD']) !== null,
  antalEfter: (dir, sha) => {
    const n = git(dir, ['rev-list', '--count', `${sha}..HEAD`]);
    return n === null ? null : Number(n);
  },
};

// Picks the install that counts for this notebook: the one whose projectPath is the notebook root, otherwise the user-scope one.
// installed: the parsed installed_plugins.json. Returns { nyckel, post } or null.
function valjInstallation(installed, rot, pluginNamn) {
  if (!installed || typeof installed !== 'object') return null;
  const plugins = installed.plugins && typeof installed.plugins === 'object' ? installed.plugins : installed;
  const kandidater = [];
  for (const [nyckel, varde] of Object.entries(plugins)) {
    if (!nyckel.startsWith(pluginNamn + '@')) continue;
    const poster = Array.isArray(varde) ? varde : [varde];
    for (const post of poster) {
      if (post && typeof post === 'object') kandidater.push({ nyckel, post });
    }
  }
  const projekt = kandidater.find((k) => typeof k.post.projectPath === 'string' && sammaSokvag(k.post.projectPath, rot));
  if (projekt) return projekt;
  const anvandare = kandidater.find((k) => k.post.scope === 'user');
  return anvandare || null;
}

// The local source folder of a marketplace, or null when the source is not a folder.
function kallmapp(marketplaces, marknad) {
  if (!marketplaces || typeof marketplaces !== 'object') return null;
  const m = marketplaces[marknad];
  if (!m || !m.source || m.source.source !== 'directory') return null;
  return typeof m.source.path === 'string' && m.source.path ? m.source.path : null;
}

// The pure comparison. installed and marketplaces are parsed JSON (or null), gitFn has head, arForfader and antalEfter.
function jamfor({ installed, marketplaces, rot, pluginNamn, gitFn = riktigGit }) {
  const vald = valjInstallation(installed, rot, pluginNamn);
  if (!vald) return { kind: 'skip', varfor: 'no install entry' };
  const sha = vald.post.gitCommitSha;
  if (typeof sha !== 'string' || !sha) return { kind: 'skip', varfor: 'no gitCommitSha' };
  const marknad = vald.nyckel.slice(vald.nyckel.indexOf('@') + 1);
  const kalla = kallmapp(marketplaces, marknad);
  if (!kalla) return { kind: 'skip', varfor: 'no local source folder' };
  const head = gitFn.head(kalla);
  if (!head) return { kind: 'skip', varfor: 'the source folder is not a git repo' };
  const scope = typeof vald.post.scope === 'string' && vald.post.scope ? vald.post.scope : 'user';
  const bas = { nyckel: vald.nyckel, scope, sha, head, kalla };
  if (head === sha) return { kind: 'same', ...bas };
  if (gitFn.arForfader(kalla, sha)) return { kind: 'older', antal: gitFn.antalEfter(kalla, sha), ...bas };
  return { kind: 'differs', ...bas };
}

// Reads the two files from pluginsDir (normally ~/.claude/plugins) and compares.
function kontrollera({ pluginsDir, rot, pluginNamn, gitFn = riktigGit }) {
  const installed = lasJson(path.join(pluginsDir, 'installed_plugins.json'));
  if (!installed) return { kind: 'skip', varfor: 'no installed_plugins.json' };
  const marketplaces = lasJson(path.join(pluginsDir, 'known_marketplaces.json'));
  return jamfor({ installed, marketplaces, rot, pluginNamn, gitFn });
}

// The two commands that install the source's HEAD. --keep-data keeps the plugin's data folder.
function kommandon(r) {
  return [
    `claude plugin uninstall ${r.nyckel} --scope ${r.scope} --keep-data`,
    `claude plugin install ${r.nyckel} --scope ${r.scope}`,
  ];
}

module.exports = { jamfor, kontrollera, kommandon, valjInstallation, kallmapp };
