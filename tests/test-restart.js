// Test for scripts/restart.js in a temporary root (tests/_tmp/restart, removed afterwards). No real restart:
// the command is a small node script and the url a local http server.
// Run: node tests/test-restart.js
'use strict';
const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');

const rot = path.join(__dirname, '_tmp', 'restart');
const skript = path.join(__dirname, '..', 'scripts', 'restart.js');
let fel = 0;
const ok = (v, t) => { console.log((v ? 'OK   ' : 'FAIL ') + t); if (!v) fel++; };
const skriv = (rel, text) => { fs.mkdirSync(path.dirname(path.join(rot, rel)), { recursive: true }); fs.writeFileSync(path.join(rot, rel), text); };

function kor(args) {
  return new Promise((resolve) => {
    const p = spawn('node', [skript, ...args], { stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, ROOFLOW_ROOT: rot } });
    let ut = '';
    p.stdout.on('data', (d) => { ut += d; });
    p.stderr.on('data', (d) => { ut += d; });
    p.on('close', (kod) => resolve({ kod, ut }));
  });
}

function lediHamn() {
  return new Promise((resolve) => {
    const s = http.createServer();
    s.listen(0, '127.0.0.1', () => { const port = s.address().port; s.close(() => resolve(port)); });
  });
}

(async () => {
  fs.rmSync(rot, { recursive: true, force: true });
  const port = await lediHamn();
  const url = `http://127.0.0.1:${port}/`;
  const mark = path.join(rot, 'ran.txt');

  skriv('fake-ok.js', `require('fs').writeFileSync(${JSON.stringify(mark)}, 'ja'); process.exit(0)`);
  skriv('fake-fail.js', 'process.exit(1)');
  skriv('rooflow.json', JSON.stringify({
    format: 1,
    projects: {
      demo: { restart: 'node fake-ok.js', url, folder: rot },
      broken: { restart: 'node fake-fail.js', url, folder: rot },
      norestart: { url },
    },
  }));
  const huvud = (lage, extra) => `State: ${lage}\nDoing: x\nUpdated: 2026-11-24 10:00\n${extra}\n`;
  skriv('status/demo-a.md', huvud('running', 'Needs: restart\nProject: demo'));
  skriv('status/demo-b.md', huvud('running', 'Needs: deploy\nProject: demo'));
  skriv('status/demoplus.md', huvud('running', 'Needs: restart'));
  skriv('status/demo-c.md', huvud('running', 'Needs: restart'));
  skriv('status/demo-done.md', huvud('done', 'Needs: restart\nProject: demo'));
  skriv('status/other-x.md', huvud('running', 'Needs: restart\nProject: other'));
  skriv('status/logg/2026-11-23-demo-a.jsonl', '{}\n');
  skriv('status/logg/2026-11-24-demo-a.jsonl', '{}\n');

  // Dry run: nothing runs, but the agents are listed.
  let r = await kor(['demo', '--dry']);
  ok(r.kod === 0 && /DRY RUN/.test(r.ut), 'dry run ends without error');
  ok(!fs.existsSync(mark), 'dry run does not run the command');
  ok(/AGENT demo-a\t.*2026-11-24-demo-a\.jsonl/.test(r.ut), 'the newest log is chosen for demo-a');
  ok(/NO_LOG demo-c/.test(r.ut), 'an agent without a log gets NO_LOG instead of a guessed log');
  ok(!/demo-b|demoplus|demo-done|other-x/.test(r.ut), 'Needs: deploy, a foreign slug, a finished agent and another project are not included');

  // Real run: the server comes up only after 1.5 s, so the script must wait.
  const server = http.createServer((q, s) => { s.end('ok'); });
  setTimeout(() => server.listen(port, '127.0.0.1'), 1500);
  r = await kor(['demo']);
  ok(r.kod === 0 && fs.existsSync(mark), 'the command ran and the script ended without error');
  ok(/answers on .* after [0-9]+ s/.test(r.ut), 'the time to answer is reported');
  ok(/AGENT demo-a/.test(r.ut), 'the agent is listed after the restart');
  server.close();

  // The command fails: no waiting, no agent (an old process could otherwise answer on the url).
  const server2 = http.createServer((q, s) => { s.end('ok'); }).listen(port, '127.0.0.1');
  r = await kor(['broken']);
  ok(r.kod === 1 && /ERROR: the restart command/.test(r.ut) && !/AGENT /.test(r.ut), 'a failed command stops without continuing agents');
  server2.close();

  // The url never answers.
  fs.rmSync(mark, { force: true });
  r = await kor(['demo', '--wait-ms', '1500']);
  ok(r.kod === 1 && /did not answer/.test(r.ut) && !/AGENT /.test(r.ut), 'a url that does not answer gives ERROR and no agents');

  // Missing entry in rooflow.json.
  r = await kor(['unknown']);
  ok(r.kod === 0 && /No restart configured/.test(r.ut) && !/AGENT /.test(r.ut), 'a project without an entry: says so and does nothing');
  r = await kor(['norestart']);
  ok(/No restart configured/.test(r.ut), 'a project with url but no restart: does nothing');

  fs.rmSync(rot, { recursive: true, force: true });
  console.log(fel ? `${fel} FAILED` : 'All tests OK');
  process.exit(fel ? 1 : 0);
})();
