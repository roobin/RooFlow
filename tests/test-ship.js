// Test for scripts/ship.js in a temporary root (tests/_tmp/ship, removed afterwards): a repo with unpushed commits,
// decisions, journal and after-release.md. The test also checks that the script never pushes.
// Run: node tests/test-ship.js
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');

const rot = path.join(__dirname, '_tmp', 'ship');
const skript = path.join(__dirname, '..', 'scripts', 'ship.js');
let fel = 0;
const ok = (v, t) => { console.log((v ? 'OK   ' : 'FAIL ') + t); if (!v) fel++; };
const skriv = (rel, text) => { fs.mkdirSync(path.dirname(path.join(rot, rel)), { recursive: true }); fs.writeFileSync(path.join(rot, rel), text); };
const g = (mapp, ...a) => execFileSync('git', ['-C', mapp, '-c', 'user.name=t', '-c', 'user.email=t@t', '-c', 'commit.gpgsign=false', ...a], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
const ship = (p, extra = []) => spawnSync('node', [skript, p, ...extra], { encoding: 'utf8', env: { ...process.env, ROOFLOW_ROOT: rot } }).stdout;
const dagar = (n) => {
  const d = new Date(Date.now() - n * 86400000);
  const p = (x) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} 12:00`;
};

fs.rmSync(rot, { recursive: true, force: true });
const remote = path.join(rot, 'remote.git');
const work = path.join(rot, 'work');
fs.mkdirSync(rot, { recursive: true });
execFileSync('git', ['init', '-q', '--bare', remote]);
execFileSync('git', ['init', '-q', '-b', 'main', work]);
g(work, 'remote', 'add', 'origin', remote);
fs.writeFileSync(path.join(work, 'a.txt'), '1');
g(work, 'add', '-A'); g(work, 'commit', '-q', '-m', 'first');
g(work, 'push', '-q', '-u', 'origin', 'main');
for (const n of ['second', 'third']) { fs.writeFileSync(path.join(work, 'a.txt'), n); g(work, 'commit', '-q', '-am', n); }
const remoteFore = g(remote, 'rev-parse', 'main');

skriv('rooflow.json', JSON.stringify({ format: 1, projects: { demo: { folder: work }, nyupstream: { folder: path.join(rot, 'ny') } } }));
skriv('decisions.md', [
  '# Decisions', '', 'Next Id: B9', '', '## Open', '',
  '## Question about demo', '- Id: B5', '- Project: demo', '- Blocks: the release', '- Decision:', '',
  '## Question via task', '- Id: B6', '- Project: other', '- Task: demo-build', '- Decision:', '',
  '## Question about other', '- Id: B7', '- Project: other', '- Decision:', '',
].join('\n'));
const rapport = (extra) => `REPORT demo\nDone: x\nTested: went fine. ${extra}\nNext: y`;
skriv('status/journal.jsonl', [
  { time: dagar(2), id: '2026-11-22-demo-build', project: 'demo', report: rapport('NOT tested: screen reader\n  and mobile.') },
  { time: dagar(30), id: '2026-10-25-demo-old', project: 'demo', report: rapport('NOT tested: old thing') },
  { time: dagar(1), id: '2026-11-23-other-x', project: 'other', report: rapport('NOT tested: other project thing') },
  { time: dagar(1), id: '2026-11-23-demoplus-x', project: 'demoplus', report: rapport('NOT tested: foreign slug') },
  { time: dagar(1), id: '2026-11-23-demo-clean', project: 'demo', report: 'REPORT demo\nTested: allt' },
].map((o) => JSON.stringify(o)).join('\n') + '\n');

// 1. Facts
let ut = ship('demo');
ok(/unpushed commits: 2/.test(ut) && /third/.test(ut) && /second/.test(ut), 'two unpushed commits are listed');
ok(/B5 Question about demo/.test(ut) && /B6 Question via task/.test(ut) && !/B7/.test(ut), 'open B-ids via Project and Task, not other projects');
ok(/NOT tested: screen reader and mobile/.test(ut), 'NOT tested is picked from the middle of the Tested field, with continuation line');
ok(!/old thing/.test(ut), 'reports older than 14 days are not included');
ok(!/other project thing|foreign slug/.test(ut), 'other projects reports and a foreign slug are not included');
ok(/origin: .*remote\.git/.test(ut) && /upstream: origin\/main/.test(ut), 'branch, upstream and origin are shown');
ok(/no after-release list for demo yet/.test(ut), 'after-release.md missing: "no after-release list for demo yet"');

// 2. after-release.md: section, H1 and missing project
skriv('after-release.md', '# After release\n\n## demo\n\n- [ ] Try on staging (why)\n- [x] Done thing\n\n## other\n\n- [ ] Other project thing\n');
ut = ship('demo');
ok(/1 left, 1 checked off/.test(ut) && /Try on staging/.test(ut) && !/Other project thing/.test(ut), 'the section "## demo" gives only demo rows');
ut = ship('does-not-exist');
ok(/no after-release list for does-not-exist yet/.test(ut), 'project without a section: no list, no error');
skriv('after-release.md', '# After release of Demo-13\n\n- [ ] The whole file applies\n');
ut = ship('demo');
ok(/The whole file applies/.test(ut), 'the heading on top mentions the project: the whole file applies');
skriv('after-release.md', '# After release\n\n## <project>\n\n- [ ] <what> (<why>)\n');
ok(/no after-release list for demo yet/.test(ship('demo')), 'the template example section does not count as the project list');

// 3. Without upstream and without folder
ut = ship('nyupstream');
ok(/project folder missing/.test(ut), 'a project folder that does not exist: says so');
fs.mkdirSync(path.join(rot, 'ny'));
execFileSync('git', ['init', '-q', '-b', 'main', path.join(rot, 'ny')]);
fs.writeFileSync(path.join(rot, 'ny', 'x.txt'), 'x');
g(path.join(rot, 'ny'), 'add', '-A'); g(path.join(rot, 'ny'), 'commit', '-q', '-m', 'x');
ut = ship('nyupstream');
ok(/upstream: none/.test(ut) && /No upstream/.test(ut), 'repo without upstream: a clear message instead of an error');

// 4. Never pushes
ok(g(remote, 'rev-parse', 'main') === remoteFore, 'the remote repo is unchanged after all runs');
ok(g(work, 'rev-list', '--count', '@{u}..HEAD') === '2', 'the two commits are still unpushed');
ok(!/['"]push['"]/.test(fs.readFileSync(skript, 'utf8')), 'scripts/ship.js contains no git push call');

// 5. Categories: private is named and checked against team.sharedRepos; a machine project is not checked here.
skriv('projects.md', '| Folder | Category | Own repo | Remote | State | Comment |\n|---|---|---|---|---|---|\n| demo | Privat | yes | no | now | |\n| far | hemma | yes | no | now | |\n');
skriv('rooflow.json', JSON.stringify({
  format: 1,
  categories: { private: { label: 'privat', private: true }, home: { label: 'hemma', machine: 'Other-PC', private: true } },
  team: { enabled: true, sharedRepos: ['demo'] },
  projects: { demo: { folder: work } },
}));
ut = ship('demo');
ok(/category: privat \(private: never to the team space/.test(ut), 'ship names a private category');
ok(/WARNING: demo is private but listed in rooflow.json team.sharedRepos/.test(ut), 'ship warns when a private project is in team.sharedRepos');
ut = ship('far');
ok(/lives on Other-PC/.test(ut) && /not checked here: far lives on Other-PC/.test(ut), 'ship does not look for the folder of a machine project');

fs.rmSync(rot, { recursive: true, force: true });
console.log(fel ? `${fel} FAILED` : 'All tests OK');
process.exit(fel ? 1 : 0);
