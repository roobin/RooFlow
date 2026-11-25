// Test for scripts/doctor.js in a temporary root (tests/_tmp/doctor, removed afterwards).
// Run: node tests/test-doctor.js
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');

const rot = path.join(__dirname, '_tmp', 'doctor');
const skript = path.join(__dirname, '..', 'scripts', 'doctor.js');
let fel = 0;
const ok = (v, t) => { console.log((v ? 'OK   ' : 'FAIL ') + t); if (!v) fel++; };
const skriv = (rel, text) => { fs.mkdirSync(path.dirname(path.join(rot, rel)), { recursive: true }); fs.writeFileSync(path.join(rot, rel), text); };
const tid = (msSedan) => {
  const d = new Date(Date.now() - msSedan);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
};
const DAG = 86400000;
// The plugin check reads ~/.claude/plugins; the tests point it at a folder of their own so the machine's install never counts.
let pluginsDir = path.join(__dirname, '_tmp', 'doctor-plugins');

function doctor() {
  const r = spawnSync('node', [skript], { encoding: 'utf8', env: { ...process.env, ROOFLOW_ROOT: rot, ROOFLOW_PLUGINS_DIR: pluginsDir } });
  return { kod: r.status, ut: r.stdout };
}
const rad = (ut, niva, ord) => ut.split('\n').some((r) => r.startsWith(niva) && r.includes(ord));

fs.rmSync(rot, { recursive: true, force: true });
fs.mkdirSync(rot, { recursive: true });
execFileSync('git', ['init', '-q', rot]);

const FRISK = {
  'status/radar.json': JSON.stringify({ format: 1 }),
  // claudeCli names a file in the root, so that the healthy root does not depend on the machine's own CLI.
  'rooflow.json': JSON.stringify({ format: 1, claudeCli: 'tools/claude', projects: { demo: { restart: 'x', url: 'http://localhost:1/', folder: '.' } } }),
  'tools/claude': 'a stand-in, never run',
  'decisions.md': '# Decisions\n\nNext Id: B5\n\n## Open\n\n## A question\n- Id: B3\n- Project: demo\n- Decision:\n',
  'archive/decisions-2026-11.md': '## Old\n- Id: B1\n- Decision: a\n\n## Older\n- Id: B2\n- Decision: b\n',
  'status/demo-ok.md': `State: running\nDoing: x\nUpdated: ${tid(60000)}\n`,
  'status/journal.jsonl': JSON.stringify({ time: tid(DAG), id: 'x', project: 'demo', report: 'REPORT demo' }) + '\n',
  'notes/clean.md': '# Clean\nåäö\n',
};
for (const [rel, text] of Object.entries(FRISK)) skriv(rel, text);
execFileSync('git', ['-C', rot, 'add', '-A'], { stdio: 'ignore' });

let r = doctor();
ok(r.kod === 0 && !/^(WARNING|ERROR)/m.test(r.ut), 'healthy root: only OK, exit code 0');
ok(/scheduled jobs/.test(r.ut), 'the line about scheduled jobs exists (the skill checks them)');
ok(/^Total: \d+ OK, 0 WARNING, 0 ERROR$/m.test(r.ut), 'English by default, with the Total line');
{
  const sv = bryt('language sv: the lines are Swedish', { 'rooflow.json': JSON.stringify({ ...JSON.parse(FRISK['rooflow.json']), language: 'sv' }) }, 'OK', 'ingen BOM i .md-filer');
  ok(/^-  schemalagda jobb/m.test(sv) && /^Summa: \d+ OK, 0 WARNING, 0 ERROR$/m.test(sv), 'language sv: the scheduled-jobs line and the total are Swedish, the level words stay English');
  ok(!/no BOM in|scheduled jobs/.test(sv), 'language sv: no English check lines left');
  const okant = bryt('an unknown language falls back to English', { 'rooflow.json': JSON.stringify({ ...JSON.parse(FRISK['rooflow.json']), language: 'fr' }) }, 'OK', 'no BOM in .md files');
  ok(/^Total:/m.test(okant), 'an unknown language gives the English total');
}

// One fault at a time against a healthy root.
function bryt(namn, andra, niva, ord) {
  const original = {};
  for (const [rel, text] of Object.entries(andra)) {
    const fil = path.join(rot, rel);
    original[rel] = fs.existsSync(fil) ? fs.readFileSync(fil) : null;
    if (text === null) fs.rmSync(fil, { force: true }); else skriv(rel, text);
  }
  execFileSync('git', ['-C', rot, 'add', '-A'], { stdio: 'ignore' });
  const ut = doctor().ut;
  ok(rad(ut, niva, ord), namn);
  for (const [rel, buf] of Object.entries(original)) {
    if (buf === null) fs.rmSync(path.join(rot, rel), { force: true }); else fs.writeFileSync(path.join(rot, rel), buf);
  }
  execFileSync('git', ['-C', rot, 'add', '-A'], { stdio: 'ignore' });
  return ut;
}

bryt('radar.json missing', { 'status/radar.json': null }, 'ERROR', 'radar.json is missing');
bryt('radar.json wrong format', { 'status/radar.json': JSON.stringify({ format: 2 }) }, 'WARNING', 'format 2');
fs.utimesSync(path.join(rot, 'status/radar.json'), new Date(Date.now() - 30 * 60000), new Date(Date.now() - 30 * 60000));
ok(rad(doctor().ut, 'WARNING', 'min old'), 'radar.json older than 15 min warns');
fs.utimesSync(path.join(rot, 'status/radar.json'), new Date(), new Date());
bryt('running for over 24 h', { 'status/demo-old.md': `State: running\nDoing: x\nUpdated: ${tid(2 * DAG)}\n` }, 'WARNING', 'demo-old');
bryt('asking for over 7 days without Needs and B-id', { 'status/demo-ask.md': `State: asking\nDoing: x\nUpdated: ${tid(8 * DAG)}\n` }, 'WARNING', 'demo-ask');
const medNeeds = bryt('asking with Needs does not warn', { 'status/demo-ask2.md': `State: asking\nDoing: x\nUpdated: ${tid(8 * DAG)}\nNeeds: deploy\n` }, 'OK', 'no old asking');
ok(!/demo-ask2/.test(medNeeds), 'asking with Needs is not mentioned');
bryt('asking with an open B-id (Task) does not warn', { 'status/demo-ask3.md': `State: asking\nDoing: x\nUpdated: ${tid(8 * DAG)}\nTask: demo-ask3\n`, 'decisions.md': FRISK['decisions.md'] + '- Task: demo-ask3\n' }, 'OK', 'no old asking');
bryt('unreported run', { 'status/journal.jsonl': JSON.stringify({ time: tid(DAG), id: 'unrep-1', project: 'demo', report: 'unreported' }) + '\n' }, 'WARNING', 'unrep-1');
bryt('Next Id too low', { 'decisions.md': FRISK['decisions.md'].replace('B5', 'B3') }, 'ERROR', 'Next Id is B3');
bryt('duplicate Id', { 'archive/decisions-2026-10.md': '## Duplicate\n- Id: B2\n' }, 'ERROR', 'duplicate');
bryt('BOM', { 'notes/bom.md': '﻿# Hi\n' }, 'ERROR', 'BOM');
bryt('mojibake', { 'notes/moj.md': 'anvÃ¤nder\n' }, 'ERROR', 'mojibake');
const lank = bryt('password in a tracked log, the text is not shown', { 'status/logg/a.jsonl': '{"x":"password=Zq81xKp20mWv"}\n' }, 'WARNING', 'password-like');
ok(!/Zq81xKp20mWv/.test(lank), 'what matched is never printed');
bryt('invalid rooflow.json', { 'rooflow.json': '{ nope' }, 'ERROR', 'rooflow.json');
{
  const reg = '| Folder | Category | Own repo | Remote | State | Comment |\n|---|---|---|---|---|---|\n| Ghost-Project | private | yes | no | now | |\n';
  const ut = bryt('a project in projects.md without a folder warns, with its slug', { 'projects.md': reg }, 'WARNING', 'ghost-project');
  ok(/projects\.<slug>\.folder/.test(ut), 'the warning says which setting to add');
  bryt('a project whose folder is set in rooflow.json does not warn', {
    'projects.md': reg,
    'rooflow.json': JSON.stringify({ format: 1, projects: { 'ghost-project': { folder: 'notes' } } }),
  }, 'OK', 'every project in state now in projects.md has a folder');
  // The folder rule: only state now, not machine or hidden categories; a project without a repo still counts.
  const tabell = (...rader) => '| Folder | Category | Own repo | Remote | State | Comment |\n|---|---|---|---|---|---|\n' + rader.map((r) => `| ${r.join(' | ')} |`).join('\n') + '\n';
  const kategorier = { work: { label: 'jobb' }, home: { label: 'hemma', machine: 'Other-PC', private: true }, archive: { label: 'arkiv', hidden: true } };
  const medKat = (extra) => JSON.stringify({ format: 1, claudeCli: 'tools/claude', categories: kategorier, ...extra });
  const regel = bryt('only projects in state now are checked for a folder', {
    'projects.md': tabell(['Next-One', 'jobb', 'yes', 'no', 'next', ''], ['Wait-One', 'jobb', 'yes', 'no', 'waiting', ''], ['Park-One', 'jobb', 'yes', 'no', 'parked', ''], ['Dash-One', 'jobb', 'yes', 'no', '–', ''], ['No-Repo', 'Jobb', 'no', '–', 'now', '']),
    'rooflow.json': medKat({}),
  }, 'WARNING', 'no-repo');
  ok(!/next-one|wait-one|park-one|dash-one/.test(regel), 'next, waiting, parked and a dash are not checked for a folder');
  ok(/1 project\(s\) in state now/.test(regel), 'a project without a repo is checked like any other (repo and folder are different things)');
  const andra = bryt('machine and hidden categories are not checked for a folder', {
    'projects.md': tabell(['Far-One', 'Hemma', 'yes', 'no', 'now', ''], ['Old-One', 'arkiv', 'yes', 'no', 'now', '']),
    'rooflow.json': medKat({}),
  }, 'OK', 'every project in state now in projects.md has a folder (0 projects)');
  ok(!/far-one|old-one/.test(andra), 'machine and hidden projects are not named');
  const okand = bryt('a category that is not in rooflow.json categories warns', {
    'projects.md': tabell(['Demo', 'jobb', 'yes', 'no', 'parked', ''], ['Odd-One', 'Kontor', 'yes', 'no', 'parked', ''], ['Gone', '–', '–', '–', '–', '']),
    'rooflow.json': medKat({}),
  }, 'WARNING', 'not in rooflow.json categories: Kontor');
  ok(!/categories: .*(–|jobb)/.test(okand.split('\n').find((r) => r.includes('not in rooflow.json categories')) || ''), 'a dash and a known label are not unknown');
  const tom = bryt('an empty projects.md says there are no projects yet and names the categories', {
    'projects.md': tabell(),
    'rooflow.json': medKat({}),
  }, 'OK', 'no projects in projects.md yet; 3 categories defined: jobb, hemma, arkiv');
  ok(!/every category in projects\.md/.test(tom), 'an empty projects.md does not claim every category is known');
  bryt('an empty projects.md in Swedish', {
    'projects.md': tabell(),
    'rooflow.json': medKat({ language: 'sv' }),
  }, 'OK', 'inga projekt i projects.md än; 3 kategorier definierade: jobb, hemma, arkiv');
  bryt('without categories in rooflow.json the category check says the default applies', {
    'projects.md': tabell(['Odd-One', 'Kontor', 'yes', 'no', 'parked', '']),
  }, 'OK', 'the default applies');
  bryt('a private project in team.sharedRepos warns', {
    'projects.md': tabell(['Far-One', 'hemma', 'yes', 'no', 'parked', '']),
    'rooflow.json': medKat({ team: { enabled: true, sharedRepos: ['far-one'] } }),
  }, 'WARNING', 'private project(s) in rooflow.json team.sharedRepos: far-one');
  bryt('projects.<slug>.run without run.json warns', {
    'rooflow.json': JSON.stringify({ format: 1, projects: { demo: { folder: '.', run: 'notes' } } }),
  }, 'WARNING', 'no run.json: demo');
}
bryt('claudeCli that does not exist warns', { 'rooflow.json': JSON.stringify({ format: 1, claudeCli: 'tools/gone' }) }, 'WARNING', "claudeCli 'tools/gone' does not exist");
bryt('claudeCli that is the desktop app warns', { 'rooflow.json': JSON.stringify({ format: 1, claudeCli: 'apps/AppData/Local/AnthropicClaude/claude.exe' }), 'apps/AppData/Local/AnthropicClaude/claude.exe': 'x' }, 'WARNING', 'looks like the desktop app');
ok(rad(doctor().ut, 'OK', 'Claude Code CLI: tools/claude'), 'the CLI that was found is named');
fs.writeFileSync(path.join(rot, 'decisions.md.lock'), '{}');
fs.utimesSync(path.join(rot, 'decisions.md.lock'), new Date(Date.now() - 120000), new Date(Date.now() - 120000));
ok(rad(doctor().ut, 'WARNING', 'lock file'), 'lock file older than 60 s warns');
fs.rmSync(path.join(rot, 'decisions.md.lock'));

// The plugin install against a local source repo. No plugins folder: no line at all.
ok(!/plugin rooflow@/.test(doctor().ut), 'without installed_plugins.json the plugin check prints nothing');
{
  const kalla = path.join(__dirname, '_tmp', 'doctor-source');
  fs.rmSync(kalla, { recursive: true, force: true });
  fs.mkdirSync(kalla, { recursive: true });
  const g = (...a) => execFileSync('git', ['-C', kalla, '-c', 'user.name=Test', '-c', 'user.email=test@example.com', ...a], { encoding: 'utf8' }).trim();
  g('init', '-q');
  fs.writeFileSync(path.join(kalla, 'a.txt'), '1'); g('add', '-A'); g('commit', '-q', '-m', 'one');
  const forsta = g('rev-parse', 'HEAD');
  fs.writeFileSync(path.join(kalla, 'a.txt'), '2'); g('add', '-A'); g('commit', '-q', '-m', 'two');
  fs.mkdirSync(pluginsDir, { recursive: true });
  const installera = (sha) => fs.writeFileSync(path.join(pluginsDir, 'installed_plugins.json'),
    JSON.stringify({ version: 2, plugins: { 'rooflow@demo': [{ scope: 'local', projectPath: rot, gitCommitSha: sha }] } }));
  fs.writeFileSync(path.join(pluginsDir, 'known_marketplaces.json'), JSON.stringify({ demo: { source: { source: 'directory', path: kalla } } }));
  installera(forsta);
  const ut = doctor().ut;
  ok(rad(ut, 'WARNING', '1 commit(s) older than HEAD'), 'an install older than the local source warns');
  ok(ut.includes('claude plugin uninstall rooflow@demo --scope local --keep-data') && ut.includes('claude plugin install rooflow@demo --scope local'), 'the warning gives the two commands');
  installera(g('rev-parse', 'HEAD'));
  ok(rad(doctor().ut, 'OK', 'installed at the source'), 'an install at HEAD is OK');
  fs.rmSync(pluginsDir, { recursive: true, force: true });
  fs.rmSync(kalla, { recursive: true, force: true });
}

// Doctor changes nothing.
const fore = execFileSync('git', ['-C', rot, 'status', '--porcelain'], { encoding: 'utf8' });
doctor();
ok(execFileSync('git', ['-C', rot, 'status', '--porcelain'], { encoding: 'utf8' }) === fore, 'doctor changes no files');

// A notebook that is not a git repo. tests/_tmp lies inside the framework's own repo, so GIT_CEILING_DIRECTORIES stops git
// from finding it; otherwise ls-files would succeed and the no-repo branch would never run.
{
  const utanGit = path.join(__dirname, '_tmp', 'doctor-nogit');
  const nb = path.join(utanGit, 'nb');
  fs.rmSync(utanGit, { recursive: true, force: true });
  fs.mkdirSync(path.join(nb, 'status'), { recursive: true });
  fs.writeFileSync(path.join(nb, 'status', 'radar.json'), JSON.stringify({ format: 1 }));
  fs.writeFileSync(path.join(nb, 'decisions.md'), FRISK['decisions.md']);
  const kor = (backup) => {
    fs.writeFileSync(path.join(nb, 'rooflow.json'), JSON.stringify({ format: 1, claudeCli: 'tools/claude', backup: { type: backup, target: '', when: '' } }));
    fs.mkdirSync(path.join(nb, 'tools'), { recursive: true });
    fs.writeFileSync(path.join(nb, 'tools', 'claude'), 'x');
    return spawnSync('node', [skript], { encoding: 'utf8', env: { ...process.env, ROOFLOW_ROOT: nb, ROOFLOW_PLUGINS_DIR: pluginsDir, GIT_CEILING_DIRECTORIES: utanGit.replace(/\\/g, '/') } });
  };
  let u = kor('none');
  ok(u.stderr === '', 'no repo: git\'s own error never reaches stderr');
  ok(rad(u.stdout, 'OK', 'not a git repo (backup none') && !/^WARNING/m.test(u.stdout), 'no repo and backup none: OK, no warning');
  ok(rad(kor('folder').stdout, 'OK', 'backup folder'), 'no repo and backup folder: OK');
  ok(rad(kor('git').stdout, 'WARNING', 'backup git, but the notebook is not a git repo'), 'no repo but backup git: a warning');
  ok(rad(kor('').stdout, 'WARNING', 'not a git repo'), 'no repo and backup not chosen yet: a warning');
  fs.rmSync(utanGit, { recursive: true, force: true });
}

fs.rmSync(rot, { recursive: true, force: true });
console.log(fel ? `${fel} FAILED` : 'All tests OK');
process.exit(fel ? 1 : 0);
