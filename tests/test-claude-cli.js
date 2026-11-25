// Tests for scripts/claude-cli.js: which claude agent.sh starts, told by the path only. Nothing is started.
// Run: node tests/test-claude-cli.js
'use strict';
const path = require('path').win32;
const { slag, hittaClaude, windowsSokvag } = require('../scripts/claude-cli');
let fel = 0;
const ok = (v, t) => { console.log((v ? 'OK   ' : 'FAIL ') + t); if (!v) fel++; };

// A made-up Windows machine: the files that "exist". The paths are joined so that no profile path stands in the source.
const APPDATA = path.join('C:\\', 'Users', 'someone', 'AppData', 'Roaming');
const HOME = path.join('C:\\', 'Users', 'someone');
const APP_DIR = path.join(HOME, 'AppData', 'Local', 'AnthropicClaude');
const NPM = path.join(APPDATA, 'npm', 'claude');
const NPM_CMD = path.join(APPDATA, 'npm', 'claude.cmd');
const NATIV = path.join(HOME, '.local', 'bin', 'claude.exe');
const APP = path.join(APP_DIR, 'claude.exe');
const env = { APPDATA, PATH: `C:\\Windows;${APP_DIR}` };
const med = (...filer) => (p) => filer.includes(p);

ok(slag(NPM) === 'cli' && slag(NPM_CMD) === 'cli' && slag(NATIV) === 'cli', 'kind: the npm CLI and ~/.local/bin are the CLI');
ok(slag(APP) === 'app' && slag(path.join(HOME, 'AppData', 'Local', 'Programs', 'Claude', 'Claude.exe')) === 'app' && slag('/Applications/Claude.app/Contents/MacOS/claude') === 'app', 'kind: the desktop app is the app');
ok(slag(path.join(APPDATA, 'Claude', 'claude-code', '2.1.331', 'abc', 'claude.exe')) === 'cli', 'kind: the CLI the desktop app downloads is the CLI');
ok(slag('/opt/tools/claude') === 'unknown' && slag('') === 'missing', 'kind: anything else is unknown, nothing is missing');

let r = hittaClaude({ claudeCli: 'D:/tools/claude', platform: 'win32', env, home: HOME, finns: med(NPM, APP) });
ok(r.source === 'config' && r.path === 'D:/tools/claude', '1. rooflow.json claudeCli wins');
r = hittaClaude({ platform: 'win32', env, home: HOME, finns: med(NPM, NPM_CMD, APP) });
ok(r.source === 'npm' && r.kind === 'cli' && r.path === NPM.replace(/\\/g, '/'), '2. Windows: the npm CLI before PATH, forward slashes for bash');
r = hittaClaude({ platform: 'win32', env, home: HOME, finns: med(NPM_CMD, APP) });
ok(r.source === 'npm' && r.path.endsWith('npm/claude.cmd'), '2. Windows: claude.cmd when the shell shim is missing');
r = hittaClaude({ platform: 'win32', env, home: HOME, finns: med(NATIV, APP) });
ok(r.source === 'native' && r.kind === 'cli', '3. a native installation under ~/.local/bin');
r = hittaClaude({ platform: 'win32', env, home: HOME, finns: med(APP) });
ok(r.source === 'path' && r.kind === 'app', '4. only the desktop app on PATH: found, and told apart as the app');
r = hittaClaude({ platform: 'win32', env, home: HOME, finns: med() });
ok(r.source === 'missing' && r.path === '' && r.kind === 'missing', 'nothing found: missing');
r = hittaClaude({ platform: 'linux', env: { PATH: '/usr/bin:/opt/tools' }, home: '/home/x', finns: med('/opt/tools/claude') });
ok(r.source === 'path' && r.path === '/opt/tools/claude' && r.kind === 'unknown', 'Linux: claude on PATH, no npm step');

ok(windowsSokvag('/c/tools/claude', 'win32') === 'C:/tools/claude' && windowsSokvag('/c/tools/claude', 'linux') === '/c/tools/claude' && windowsSokvag('D:/x', 'win32') === 'D:/x', 'a Git Bash path is read as a Windows path on Windows only');

console.log(fel ? `${fel} FAILED` : 'All OK');
process.exit(fel ? 1 : 0);
