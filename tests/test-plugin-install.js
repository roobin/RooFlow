// Test for scripts/plugin-install.js: is the installed plugin older than its local source repo?
// The comparison is tested with a stand-in for git; one case at the end uses a real git repo in tests/_tmp/plugin-install.
// Run: node tests/test-plugin-install.js
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { jamfor, kontrollera, kommandon } = require('../scripts/plugin-install');

let fel = 0;
const ok = (v, t) => { console.log((v ? 'OK   ' : 'FAIL ') + t); if (!v) fel++; };

const tmp = path.join(__dirname, '_tmp', 'plugin-install');
const ROT = path.join(tmp, 'notebook');
const KALLA = path.join(tmp, 'source');
const SHA_GAMMAL = 'a'.repeat(40);
const SHA_HEAD = 'b'.repeat(40);
const SHA_ANNAN = 'c'.repeat(40);

// A stand-in for git: the source folder has HEAD SHA_HEAD, and SHA_GAMMAL is 3 commits behind it.
const falskGit = {
  head: (dir) => (dir === KALLA ? SHA_HEAD : null),
  arForfader: (dir, sha) => dir === KALLA && sha === SHA_GAMMAL,
  antalEfter: (dir, sha) => (sha === SHA_GAMMAL ? 3 : null),
};

const marknader = { demo: { source: { source: 'directory', path: KALLA }, installLocation: KALLA } };
const installerad = (poster) => ({ version: 2, plugins: { 'rooflow@demo': poster } });
const lokal = (sha, projektmapp = ROT) => ({ scope: 'local', projectPath: projektmapp, version: '0.1.0', gitCommitSha: sha });
const kor = (installed, mp = marknader) => jamfor({ installed, marketplaces: mp, rot: ROT, pluginNamn: 'rooflow', gitFn: falskGit });

let r = kor(installerad([lokal(SHA_GAMMAL)]));
ok(r.kind === 'older' && r.antal === 3 && r.nyckel === 'rooflow@demo' && r.scope === 'local', 'older install: kind older, 3 commits, key and scope from the entry');
const [av, pa] = kommandon(r);
ok(av === 'claude plugin uninstall rooflow@demo --scope local --keep-data' && pa === 'claude plugin install rooflow@demo --scope local', 'the two commands are built from the entry');

r = kor(installerad([lokal(SHA_HEAD)]));
ok(r.kind === 'same', 'same commit as HEAD: kind same');

r = kor(installerad([lokal(SHA_ANNAN)]));
ok(r.kind === 'differs', 'a commit that is not an ancestor of HEAD: kind differs, not older');

ok(kor(installerad([lokal(SHA_GAMMAL, path.join(tmp, 'other'))])).kind === 'skip', 'an install for another project folder is skipped');
ok(kor({ version: 2, plugins: {} }).kind === 'skip', 'no entry for the plugin: skip');
ok(kor({ version: 2, plugins: { 'other@demo': [lokal(SHA_GAMMAL)] } }).kind === 'skip', 'only another plugin installed: skip');
ok(kor(installerad([{ scope: 'local', projectPath: ROT }])).kind === 'skip', 'an entry without gitCommitSha: skip');
ok(kor(null).kind === 'skip', 'no parsed file: skip');

r = kor(installerad([lokal(SHA_HEAD, path.join(tmp, 'other')), { scope: 'user', gitCommitSha: SHA_GAMMAL }]));
ok(r.kind === 'older' && r.scope === 'user', 'without a project entry the user-scope entry counts');
ok(kommandon(r)[0].includes('--scope user'), 'a user-scope install gets --scope user');

r = kor(installerad([{ scope: 'user', gitCommitSha: SHA_HEAD }, lokal(SHA_GAMMAL)]));
ok(r.kind === 'older' && r.scope === 'local', 'the entry for the notebook folder wins over the user-scope entry');

ok(kor(installerad([lokal(SHA_GAMMAL)]), { demo: { source: { source: 'github', repo: 'someone/rooflow' }, installLocation: KALLA } }).kind === 'skip',
  'a catalogue (non-folder) marketplace is skipped even when its clone is a git repo');
ok(kor(installerad([lokal(SHA_GAMMAL)]), {}).kind === 'skip', 'an unknown marketplace: skip');
ok(kor(installerad([lokal(SHA_GAMMAL)]), null).kind === 'skip', 'no known_marketplaces.json: skip');
ok(kor(installerad([lokal(SHA_GAMMAL)]), { demo: { source: { source: 'directory', path: path.join(tmp, 'not-a-repo') } } }).kind === 'skip',
  'a source folder that is not a git repo: skip');

// From files: a missing installed_plugins.json and broken JSON are silent skips.
fs.rmSync(tmp, { recursive: true, force: true });
fs.mkdirSync(path.join(tmp, 'plugins'), { recursive: true });
const pluginsDir = path.join(tmp, 'plugins');
ok(kontrollera({ pluginsDir, rot: ROT, pluginNamn: 'rooflow', gitFn: falskGit }).kind === 'skip', 'missing installed_plugins.json: skip');
fs.writeFileSync(path.join(pluginsDir, 'installed_plugins.json'), '{ broken');
ok(kontrollera({ pluginsDir, rot: ROT, pluginNamn: 'rooflow', gitFn: falskGit }).kind === 'skip', 'broken installed_plugins.json: skip');

// With real git: a source repo with two commits, installed at the first.
fs.mkdirSync(KALLA, { recursive: true });
const g = (...a) => execFileSync('git', ['-C', KALLA, '-c', 'user.name=Test', '-c', 'user.email=test@example.com', ...a], { encoding: 'utf8' }).trim();
g('init', '-q');
fs.writeFileSync(path.join(KALLA, 'a.txt'), '1');
g('add', '-A'); g('commit', '-q', '-m', 'one');
const forsta = g('rev-parse', 'HEAD');
fs.writeFileSync(path.join(KALLA, 'a.txt'), '2');
g('add', '-A'); g('commit', '-q', '-m', 'two');
fs.writeFileSync(path.join(pluginsDir, 'installed_plugins.json'), JSON.stringify(installerad([lokal(forsta)])));
fs.writeFileSync(path.join(pluginsDir, 'known_marketplaces.json'), JSON.stringify(marknader));
r = kontrollera({ pluginsDir, rot: ROT, pluginNamn: 'rooflow' });
ok(r.kind === 'older' && r.antal === 1, 'real git: an install one commit behind is older by 1');
fs.writeFileSync(path.join(pluginsDir, 'installed_plugins.json'), JSON.stringify(installerad([lokal(g('rev-parse', 'HEAD'))])));
ok(kontrollera({ pluginsDir, rot: ROT, pluginNamn: 'rooflow' }).kind === 'same', 'real git: an install at HEAD is the same');
fs.writeFileSync(path.join(pluginsDir, 'installed_plugins.json'), JSON.stringify(installerad([lokal(SHA_ANNAN)])));
ok(kontrollera({ pluginsDir, rot: ROT, pluginNamn: 'rooflow' }).kind === 'differs', 'real git: an unknown commit differs');

fs.rmSync(tmp, { recursive: true, force: true });
console.log(fel ? `${fel} FAILED` : 'All tests OK');
process.exit(fel ? 1 : 0);
