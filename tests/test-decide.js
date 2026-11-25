// Test for scripts/decide.js in tests/_tmp/decide (removed afterwards). Never touches a real decisions.md.
// Run: node tests/test-decide.js
'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const rot = path.join(__dirname, '_tmp', 'decide');
const decide = path.join(__dirname, '..', 'scripts', 'decide.js');
let fel = 0;
const ok = (v, t) => { console.log((v ? 'OK   ' : 'FAIL ') + t); if (!v) fel++; };
const lasf = (rel) => fs.readFileSync(path.join(rot, rel), 'utf8');
const skriv = (rel, text) => { fs.mkdirSync(path.dirname(path.join(rot, rel)), { recursive: true }); fs.writeFileSync(path.join(rot, rel), text); };

function kor(...args) {
  const r = spawnSync('node', [decide, '--idag', '2026-11-24', ...args], { encoding: 'utf8', cwd: rot, env: { ...process.env, ROOFLOW_ROOT: rot } });
  const sista = r.stdout.trim().split('\n').pop();
  return { kod: r.status, json: JSON.parse(sista), ut: r.stdout };
}

const BESLUT = [
  '# Decisions', '', 'Next Id: B50', '', '## Open', '',
  '## Question with Task', '- Id: B40', '- Date: 2026-11-24', '- Project: project-a', '- Task: project-a-cookies', '- Asked by: project-a-cookies', '- Question: x', '- Options: a) yes. b) no.', '- Decision:', '',
  '## Question with only Project', '- Id: B41', '- Date: 2026-11-24', '- Project: project-b', '- Asked by: project-b', '- Decision:', '',
  '## Question from the session', '- Id: B42', '- Date: 2026-11-24', '- Project: rooflow', '- Asked by: rooflow', '- Decision:', '',
  '## Question without agent', '- Id: B43', '- Date: 2026-11-24', '- Asked by: alice', '- Decision:', '',
  '## Two Needs', '- Id: B44', '- Date: 2026-11-24', '- Task: tva', '- Asked by: tva', '- Decision:', '',
].join('\n');

try {
  fs.rmSync(rot, { recursive: true, force: true });
  skriv('decisions.md', BESLUT);
  skriv('rooflow.json', JSON.stringify({ format: 1, name: 'alice' }));
  skriv('archive/.keep', '');
  skriv('status/project-a-cookies.md', 'State: asking\nDoing: waiting for B40\nNeeds: B40\nTask: project-a-cookies\nUpdated: 2026-11-24 10:00\n\n- Goal: x\n');
  skriv('status/project-b.md', 'State: asking\nDoing: y\nUpdated: 2026-11-24 10:00\n\n## Beslut\n\n- B1 a 2026-11-01\n\n## Annat\n\n- z\n');
  skriv('status/rooflow.md', 'State: running\nDoing: z\nUpdated: 2026-11-24 10:00\n');
  skriv('status/tva.md', 'State: asking\r\nDoing: q\r\nNeeds: B44, B99\r\nUpdated: 2026-11-24 10:00\r\n');

  // B40: a letter, Task exists. Decision on the block, archived, the status line, Needs gone.
  let r = kor('B40', 'a', '--utan-radar');
  ok(r.kod === 0 && r.json.ok && r.json.task === 'project-a-cookies' && r.json.svar === 'a', 'B40 a: ok with task project-a-cookies');
  ok(!/- Id: B40/.test(lasf('decisions.md')), 'B40 gone from decisions.md');
  const ark = lasf('archive/decisions-2026-11.md');
  ok(/- Id: B40/.test(ark) && /- Decision: a, alice 2026-11-24/.test(ark), 'the archive has B40 with "a, alice 2026-11-24"');
  const st = lasf('status/project-a-cookies.md');
  ok(/## Beslut\n\n- B40 a 2026-11-24/.test(st), 'the status file has the heading Beslut and the line B40 a 2026-11-24');
  ok(!/^Needs:/m.test(st) && /^State: asking/.test(st) && /^Task: project-a-cookies/m.test(st), 'Needs: B40 removed, State and Task untouched');

  // B41: only Project, and the status file exists: the line goes last in an existing Beslut section.
  r = kor('B41', 'free answer with spaces', '--utan-radar');
  ok(r.json.ok && r.json.task === 'project-b', 'B41: Project is used when Task is missing');
  const v = lasf('status/project-b.md');
  ok(/## Beslut\n\n- B1 a 2026-11-01\n- B41 free answer with spaces 2026-11-24\n\n## Annat/.test(v), 'the line goes last in the existing Beslut section');
  ok(/- Decision: free answer with spaces, alice 2026-11-24/.test(lasf('archive/decisions-2026-11.md')), 'free text in Decision');

  // B42: the session itself is no agent. B43: no Task or Project.
  r = kor('B42', 'b', '--utan-radar');
  ok(r.json.ok && r.json.task === '' && !/## Beslut/.test(lasf('status/rooflow.md')), 'B42 (Project rooflow): no task and no line in status/rooflow.md');
  r = kor('B43', 'A', '--utan-radar');
  ok(r.json.ok && r.json.task === '' && r.json.svar === 'a', 'B43 without agent: empty task, capital letter becomes lower case');

  // Two Needs: only the decided one is removed, CRLF is kept.
  r = kor('B44', 'a', '--utan-radar');
  const tva = lasf('status/tva.md');
  ok(r.json.ok && tva.includes('\r\nNeeds: B99\r\n') && !tva.includes('B44,') && tva.includes('- B44 a 2026-11-24'), 'Needs: B44, B99 becomes Needs: B99, CRLF kept, line written');

  // Errors: already decided, unknown Id, empty answer, wrong format. Nothing changes.
  const fore = lasf('decisions.md');
  r = kor('B40', 'a', '--utan-radar');
  ok(r.kod === 1 && /not open/.test(r.json.fel), 'already decided gives an error and exit 1');
  r = kor('B99', 'a', '--utan-radar');
  ok(r.kod === 1 && r.json.fel, 'unknown Id gives an error');
  r = kor('B43', '', '--utan-radar');
  ok(r.kod === 1 && /answer missing/.test(r.json.fel), 'empty answer gives an error');
  r = kor('X1', 'a', '--utan-radar');
  ok(r.kod === 1 && /Id/.test(r.json.fel), 'wrong Id form gives an error');
  ok(lasf('decisions.md') === fore, 'the errors change nothing');
  ok(!fs.existsSync(path.join(rot, 'decisions.md.lock')), 'the lock file is gone afterwards');

  // Radar runs by default against the root's own files and writes status/radar.json there.
  skriv('decisions.md', BESLUT.replace('- Decision:', '- Decision: a, alice 2026-11-01'));
  skriv('decisions.md', fs.readFileSync(path.join(rot, 'decisions.md'), 'utf8') + '\n## Sist\n- Id: B45\n- Date: 2026-11-24\n- Asked by: x\n- Decision:\n');
  r = kor('B45', 'a');
  ok(r.json.ok && r.json.radar === true && fs.existsSync(path.join(rot, 'status', 'radar.json')), 'scripts/radar.js runs afterwards (radar: true) and writes status/radar.json in the test root');
} finally {
  fs.rmSync(rot, { recursive: true, force: true });
}
console.log(fel ? 'FAIL: ' + fel : 'All OK');
process.exit(fel ? 1 : 0);
