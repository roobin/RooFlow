// Test for the pure parts of scripts/servers.js (the Servers addon): no window is opened and no process is killed.
// Run: node tests/test-servers.js
'use strict';
const s = require('../scripts/servers');

let fel = 0;
const ok = (v, t) => { console.log((v ? 'OK   ' : 'FAIL ') + t); if (!v) fel++; };

const radarJson = JSON.stringify({ projekt: [{ slug: 'alpha', mapp: 'Alpha', kor: [{ namn: 'web', cmd: 'dotnet run', cwd: 'C:\\work\\alpha', konto: '' }] }] });
ok(s.hittaKommando(radarJson, 'alpha', 'web')?.mapp === 'Alpha', 'hittaKommando: the command comes from radar.json, with the project folder name');
ok(s.hittaKommando(radarJson, 'alpha', 'nope') === null && s.hittaKommando(radarJson, 'beta', 'web') === null && s.hittaKommando('{', 'a', 'b') === null, 'hittaKommando: unknown or broken gives null');
ok(s.kommandorad('T', 'C:\\w', 'x y') === '/k title T&& cd /d "C:\\w" && x y', 'kommandorad: title first, then cd and the command');

const netstat = [
  '  Proto  Local Address          Foreign Address        State           PID',
  '  TCP    0.0.0.0:5000           0.0.0.0:0              LISTENING       4242',
  '  TCP    127.0.0.1:5001         127.0.0.1:60000        ESTABLISHED     4242',
  '  TCP    [::]:5002              [::]:0                 LISTENING       4243',
].join('\r\n');
const uttag = s.tolkaNetstat(netstat);
ok(uttag.length === 2 && uttag[0].port === 5000 && uttag[0].pid === 4242 && uttag[1].port === 5002, 'tolkaNetstat: only listening sockets, port and pid');

const processer = s.tolkaProcesser('100 1 1000 cmd.exe\r\n101 100 1100 dotnet.exe\r\n102 101 1200 node.exe\r\n200 1 1300 cmd.exe\r\ngarbage');
ok(processer.size === 4 && processer.get(101).foralder === 100, 'tolkaProcesser: pid, parent, created, name');
ok([...s.processTrad(processer, 100)].sort().join() === '100,101,102', 'processTrad: the pid and all its descendants');
ok(s.arVar({ pid: 100, startMs: 1010 }, processer) && !s.arVar({ pid: 100, startMs: 99999 }, processer) && !s.arVar({ pid: 101, startMs: 1100 }, processer) && !s.arVar({ pid: 999, startMs: 1 }, processer),
  'arVar: a cmd.exe that started near the saved time; another process or a reused pid does not count');
ok(s.portarFor(100, processer, [{ port: 5002, pid: 102 }, { port: 5000, pid: 101 }, { port: 6000, pid: 200 }]).join() === '5000,5002', 'portarFor: ports of the whole tree, sorted, not other trees');
ok(s.nyckel('alpha', 'web') === 'alpha-web', 'nyckel: slug-name');

process.exit(fel ? 1 : 0);
