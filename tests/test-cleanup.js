// Test for scripts/cleanup.js against a temporary notebook root under tests/_tmp/cleanup (removed afterwards).
// Run: node tests/test-cleanup.js
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const rot = path.join(__dirname, '_tmp', 'cleanup');
const skript = path.join(__dirname, '..', 'scripts', 'cleanup.js');
let fel = 0;
const ok = (v, t) => { console.log((v ? 'OK   ' : 'FAIL ') + t); if (!v) fel++; };
const finns = (rel) => fs.existsSync(path.join(rot, rel));
const lasf = (rel) => fs.readFileSync(path.join(rot, rel), 'utf8');
const clean = (...a) => execFileSync('node', [skript, ...a], { encoding: 'utf8', env: { ...process.env, ROOFLOW_ROOT: rot } });
const w = (rel, text, dagar) => {
  const p = path.join(rot, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, text);
  if (dagar) { const t = new Date(Date.now() - dagar * 86400000); fs.utimesSync(p, t, t); }
};
const dagStr = (dagar) => new Date(Date.now() - dagar * 86400000).toISOString().slice(0, 10);
const sh = (...a) => execFileSync('git', ['-C', rot, '-c', 'user.name=t', '-c', 'user.email=t@t', '-c', 'commit.gpgsign=false', '-c', 'core.autocrlf=false', ...a], { encoding: 'utf8' });

try {
  fs.rmSync(rot, { recursive: true, force: true });
  fs.mkdirSync(path.join(rot, 'archive'), { recursive: true });
  const huvud = (lage, dagar) => `State: ${lage}\nDoing: x\nUpdated: ${dagStr(dagar)} 10:00\n\nText\n`;
  w('rooflow.json', '{"format":1}');
  w('projects.md', '| Folder | Category |\n|---|---|\n| Project-a | private |\n');
  w('decisions.md', '# Decisions\n\n## Open\n\n## Question mentions status/named.md\n\n## Decided\n\n## Old\n- status/decided-named.md\n');
  w('handover.md', 'See status/named-handover.md and briefs/2026-01-01-named-brief.md\n');
  w('today.md', '# Today\n');
  w('inbox.md', `# Inbox\n\n## Now\n\n- ${dagStr(100)} · old but not done\n\n## Done\n\n- ${dagStr(60)} · old done\n  continuation\n- ${dagStr(3)} · new done\n`);

  w('status/old.md', huvud('done', 20));
  w('status/old-sv.md', `Läge: klar\nGör nu: x\nUppdaterad: ${dagStr(20)} 10:00\n`);
  w('status/new.md', huvud('done', 2));
  w('status/project-a.md', huvud('done', 40));
  w('status/named.md', huvud('done', 40));
  w('status/decided-named.md', huvud('done', 40));
  w('status/named-handover.md', huvud('done', 40));
  w('status/no-header.md', '# Just text\n');
  w('status/_template.md', huvud('done', 40));
  w('status/running.md', huvud('running', 1) + 'task: briefs/2026-01-01-active.md\n');
  w('status/logg/2026-01-01-finished.jsonl', '{"total_cost_usd":1}\n', 40);
  w('status/logg/2026-01-02-unfinished.jsonl', '{"type":"system"}\n', 40);
  w('status/logg/2026-01-03-running.jsonl', '{"total_cost_usd":1}\n', 40);
  w('status/logg/' + dagStr(2) + '-fresh.jsonl', '{"total_cost_usd":1}\n', 2);
  w('briefs/2026-01-01-old.md', 'b');
  w('briefs/' + dagStr(2) + '-fresh.md', 'b');
  w('briefs/2026-01-01-named-brief.md', 'b');
  w('briefs/2026-01-01-active.md', 'b');
  w('briefs/no-date.md', 'b', 40);
  w('skisser/old.html', 's', 90);
  w('skisser/fresh.html', 's', 5);
  w('skisser/named/a.png', 's', 90);
  w('skisser/named/b.png', 's', 90);
  w('notes/' + dagStr(5) + '-note.md', 'We use skisser/named and skisser/other.html');
  w('skisser/other.html', 's', 90);
  w('skisser/named-in-old-note.html', 's', 90);
  w('notes/2026-01-01-old-note.md', 'skisser/named-in-old-note.html', 90);
  w('notes/2026-01-01-untouched.md', 'n', 200);
  w('leveranser/old.pdf', 'l', 200);
  w('promises.md', 'p', 200);

  sh('init', '-q');
  sh('add', '-A');
  sh('commit', '-q', '-m', 'start');

  const torr = clean();
  ['status/old.md', 'status/old-sv.md', 'status/decided-named.md', 'status/logg/2026-01-01-finished.jsonl', 'briefs/2026-01-01-old.md',
    'briefs/no-date.md', 'skisser/old.html', 'skisser/named-in-old-note.html', 'old done'].forEach((t) => ok(torr.includes(t), 'dry run lists ' + t));
  ['status/new.md', 'status/running.md', 'status/project-a.md', 'status/named.md', 'status/named-handover.md', 'status/no-header.md', 'status/_template.md',
    'unfinished', '2026-01-03-running', '-fresh.', 'named-brief', 'active', 'skisser/fresh.html', 'named/a.png', 'other.html', 'old but not done', 'new done',
    'untouched.md', 'old.pdf'].forEach((t) => ok(!torr.includes(t), 'dry run does not list ' + t));
  ok(torr.split('\n').length <= 45, 'the dry run is short (' + torr.split('\n').length + ' lines)');
  ok(finns('status/old.md') && lasf('inbox.md').includes('old done'), 'dry run changes nothing');
  ok(!finns('archive/cleanup-log.jsonl'), 'dry run logs nothing');

  const manad = new Date().toISOString().slice(0, 7);
  const mapp = `archive/cleaned-${manad}`;
  const idag = new Date().toISOString().slice(0, 10);
  clean('--run', '--except', 'skisser', '--except', 'briefs/no-date.md');
  ok(!finns('status/old.md') && finns(mapp + '/status/old.md'), '--run moves status to the cleaned folder');
  ok(finns(mapp + '/status/logg/2026-01-01-finished.jsonl'), '--run moves the log');
  ok(finns(mapp + '/briefs/2026-01-01-old.md'), '--run moves the brief');
  ok(finns('skisser/old.html'), '--except folder leaves the sketches in place');
  ok(finns('briefs/no-date.md'), '--except file leaves the file in place');
  ok(finns('status/new.md') && finns('status/no-header.md') && finns('leveranser/old.pdf') && finns('promises.md'), 'exceptions untouched');
  const inbox = lasf('inbox.md');
  ok(!inbox.includes('old done') && !inbox.includes('continuation') && inbox.includes('new done') && inbox.includes('old but not done'), 'inbox: only old Done rows (with continuation line) are moved');
  const inboxArk = lasf(`archive/inbox-${dagStr(60).slice(0, 7)}.md`);
  ok(inboxArk.includes('old done') && inboxArk.includes('continuation'), 'the inbox row lands in the monthly archive');
  const logg = lasf('archive/cleanup-log.jsonl').trim().split('\n').map((r) => JSON.parse(r));
  ok(logg.length === 6 && logg.every((p) => p.time && p.from && p.to && p.rule), 'the log has one row per move (' + logg.length + ')');
  ok(sh('ls-files', mapp).includes('status/old.md'), 'tracked file moved with git mv');

  clean('--bring-back', 'old');
  ok(finns('status/old.md') && !finns(mapp + '/status/old.md'), '--bring-back restores the project status file');
  ok(finns(mapp + '/briefs/2026-01-01-old.md'), '--bring-back does not touch briefs');

  clean('--restore', idag);
  ok(finns('status/old.md') && !finns(mapp + '/status/old.md'), '--restore moves status back');
  ok(finns('status/logg/2026-01-01-finished.jsonl') && finns('briefs/2026-01-01-old.md'), '--restore moves log and brief back');
  const inbox2 = lasf('inbox.md');
  ok(inbox2.includes('old done\n  continuation') && inbox2.indexOf('old done') > inbox2.indexOf('## Done'), '--restore puts the inbox row under Done');
  ok(!lasf(`archive/inbox-${dagStr(60).slice(0, 7)}.md`).includes('old done'), 'the inbox row is gone from the monthly archive');
  ok(clean().includes('status/old.md'), 'after a restore the things are listed again');
  clean('--restore', idag);
  ok(finns('status/old.md'), 'a double restore does no harm');

  clean('--run', '--commit', '--except', 'skisser');
  ok(/^Cleanup \d{4}-\d{2}-\d{2}: \d+ files to archive\/cleaned-/.test(sh('log', '-1', '--format=%s')), 'commit message with count');
  ok(sh('status', '--porcelain').trim() === '', 'working copy clean after --commit: [' + sh('status', '--porcelain').trim() + ']');
} finally {
  fs.rmSync(rot, { recursive: true, force: true });
}
console.log(fel ? `\n${fel} failed` : '\nAll tests passed');
process.exit(fel ? 1 : 0);
