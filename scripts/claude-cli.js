#!/usr/bin/env node
// Finds the Claude Code CLI that scripts/agent.sh and scripts/agent-resume.sh start, without starting anything.
//
// On Windows `claude` on PATH is often the desktop app, not the CLI: an agent started with it dies at once with no answer.
// The order, first hit wins:
//   1. rooflow.json "claudeCli" (an override; not needed in the normal case)
//   2. Windows: the npm CLI, %APPDATA%/npm/claude (or claude.cmd)
//   3. a native installation, ~/.local/bin/claude (claude.exe on Windows)
//   4. claude on PATH
// The kind is told by the path only: running `claude --version` could start the desktop app.
//
//   node scripts/claude-cli.js          prints the path (forward slashes), exit 1 and nothing when none is found
//   node scripts/claude-cli.js --kind   prints cli | app | unknown | missing
//   node scripts/claude-cli.js --json   prints { path, source, kind }
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

// cli: a known place of the Claude Code CLI. app: a known place of the desktop app. unknown: anything else.
function slag(p) {
  const s = String(p || '').replace(/\\/g, '/').toLowerCase();
  if (!s) return 'missing';
  if (/\/appdata\/roaming\/npm\/claude(\.cmd|\.ps1)?$/.test(s)) return 'cli';
  if (/\/node_modules\/@anthropic-ai\/claude-code\//.test(s)) return 'cli';
  if (/\/\.local\/bin\/claude(\.exe)?$/.test(s)) return 'cli';
  // The CLI the desktop app downloads for its own use (AppData/Roaming/Claude/claude-code/<version>/<build>/claude.exe).
  if (/\/appdata\/roaming\/claude\/claude-code\/[^/]+\/[^/]+\/claude\.exe$/.test(s)) return 'cli';
  if (/\/appdata\/local\/anthropicclaude\//.test(s)) return 'app';
  if (/\/appdata\/local\/programs\/claude\//.test(s)) return 'app';
  if (/\/program files( \(x86\))?\/(anthropic\/)?claude\//.test(s)) return 'app';
  if (/\/windowsapps\/claude/.test(s)) return 'app';
  if (/\/applications\/claude\.app\//.test(s)) return 'app';
  return 'unknown';
}

// A Git Bash path (/c/tools/...) as Windows knows it (C:/tools/...), so that node can look for the file. Other paths as they are.
function windowsSokvag(p, platform = process.platform) {
  const m = String(p || '').match(/^\/([a-zA-Z])\/(.*)$/);
  return platform === 'win32' && m ? `${m[1].toUpperCase()}:/${m[2]}` : String(p || '');
}

// The first file named claude on PATH, as the shell would find it.
function paPath(env, platform, finns) {
  const sep = platform === 'win32' ? ';' : ':';
  const sti = platform === 'win32' ? path.win32 : path.posix;
  const namn = platform === 'win32' ? ['claude.exe', 'claude.cmd', 'claude.bat', 'claude'] : ['claude'];
  for (const mapp of String(env.PATH || env.Path || '').split(sep)) {
    if (!mapp) continue;
    for (const n of namn) {
      const p = sti.join(mapp, n);
      if (finns(p)) return p;
    }
  }
  return '';
}

// { path, source, kind }. claudeCli: the value from rooflow.json ('' when not set).
function hittaClaude({ claudeCli = '', platform = process.platform, env = process.env, home = os.homedir(), finns = fs.existsSync } = {}) {
  const sti = platform === 'win32' ? path.win32 : path.posix;
  const svar = (p, source) => ({ path: p ? p.replace(/\\/g, '/') : '', source, kind: p ? slag(p) : 'missing' });
  if (claudeCli) return svar(claudeCli, 'config');
  if (platform === 'win32' && env.APPDATA) {
    for (const n of ['claude', 'claude.cmd']) {
      const p = sti.join(env.APPDATA, 'npm', n);
      if (finns(p)) return svar(p, 'npm');
    }
  }
  const nativ = sti.join(home, '.local', 'bin', platform === 'win32' ? 'claude.exe' : 'claude');
  if (finns(nativ)) return svar(nativ, 'native');
  const p = paPath(env, platform, finns);
  return p ? svar(p, 'path') : svar('', 'missing');
}

module.exports = { slag, hittaClaude, windowsSokvag };

if (require.main === module) {
  const { requireRoot, loadConfig } = require('./root');
  const r = hittaClaude({ claudeCli: loadConfig(requireRoot()).config.claudeCli });
  if (process.argv.includes('--json')) {
    process.stdout.write(JSON.stringify(r) + '\n');
  } else if (process.argv.includes('--kind')) {
    process.stdout.write(r.kind + '\n');
  } else {
    if (!r.path) process.exit(1);
    process.stdout.write(r.path + '\n');
  }
}
