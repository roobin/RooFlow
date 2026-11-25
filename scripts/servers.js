#!/usr/bin/env node
// Servers addon (rooflow.json: "addons": { "servers": true }). Windows only.
// Starts a command from a project's run.json in a console window of its own and keeps track of it.
// The window is not the Radar mod's child, so it survives the mod being reloaded.
// The Radar mod runs this script through $.process.run and reads the JSON answer from stdout.
//
//   node scripts/servers.js start <slug> <name>   opens the window, writes status/kor/<slug>-<name>.json
//   node scripts/servers.js stop <slug> <name>    ends the window and everything it started (taskkill /T)
//   node scripts/servers.js status                which ones are alive, their pid and the ports they listen on
//   (stopp is a Swedish alias of stop)
//
// The command is taken from status/radar.json (which scripts/radar.js writes from run.json), never from the caller.
// The notebook root comes from scripts/root.js (ROOFLOW_ROOT or the nearest rooflow.json).
// Never reads appsettings*, secrets.json or any secrets folder.
// The answer is one JSON line: the result, or {"fel": "..."} with exit code 1 (the key is Swedish for "error", as in the other scripts).
'use strict';

const fs = require('fs');
const path = require('path');
const { spawn, execFileSync } = require('child_process');

// A pid only counts as ours if the process started this close to the time we saved. Guards against Windows having
// reused the pid for something else after a restart, so that Stop never kills the wrong process.
const START_TOLERANS_MS = 15_000;
const NAMN_MONSTER = /^[\wåäöÅÄÖ-]{1,40}$/;

function nyckel(slug, namn) {
  return `${slug}-${namn}`;
}

function klockslag(d) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function hittaKommando(radarJson, slug, namn) {
  let d;
  try { d = JSON.parse(radarJson); } catch { return null; }
  const p = (d.projekt || []).find((x) => x.slug === slug);
  if (!p) return null;
  const k = (p.kor || []).find((x) => x.namn === namn);
  return k ? { ...k, mapp: p.mapp } : null;
}

// The command line for cmd.exe. The title first so that the window can be recognised in the taskbar.
function kommandorad(titel, cwd, cmd) {
  return `/k title ${titel}&& cd /d "${cwd}" && ${cmd}`;
}

// `netstat -ano` -> [{ port, pid }] for listening TCP sockets.
function tolkaNetstat(text) {
  const ut = [];
  for (const rad of text.split(/\r?\n/)) {
    const c = rad.trim().split(/\s+/);
    if (c.length < 5 || c[0] !== 'TCP' || c[3] !== 'LISTENING') continue;
    const m = c[1].match(/:(\d+)$/);
    if (m) ut.push({ port: Number(m[1]), pid: Number(c[4]) });
  }
  return ut;
}

// Lines "pid parent created-ms name" (from the PowerShell command below) -> Map pid -> { foralder, skapad, namn }.
function tolkaProcesser(text) {
  const ut = new Map();
  for (const rad of text.split(/\r?\n/)) {
    const m = rad.trim().match(/^(\d+)\s+(\d+)\s+(\d+)\s+(.+)$/);
    if (m) ut.set(Number(m[1]), { foralder: Number(m[2]), skapad: Number(m[3]), namn: m[4] });
  }
  return ut;
}

// A pid and all its descendants.
function processTrad(processer, rot) {
  const trad = new Set([rot]);
  let vaxte = true;
  while (vaxte) {
    vaxte = false;
    for (const [pid, p] of processer) {
      if (!trad.has(pid) && trad.has(p.foralder)) {
        trad.add(pid);
        vaxte = true;
      }
    }
  }
  return trad;
}

function arVar(post, processer) {
  const p = processer.get(post.pid);
  return !!p && /^cmd\.exe$/i.test(p.namn) && Math.abs(p.skapad - post.startMs) <= START_TOLERANS_MS;
}

function portarFor(pid, processer, uttag) {
  const trad = processTrad(processer, pid);
  return [...new Set(uttag.filter((u) => trad.has(u.pid)).map((u) => u.port))].sort((a, b) => a - b);
}

// --- io ---

function lasProcesser() {
  // An inline command, no .ps1 file (the execution policy may be locked for script files, not for -Command).
  const ps = "Get-CimInstance Win32_Process | ForEach-Object { '{0} {1} {2} {3}' -f $_.ProcessId, $_.ParentProcessId, " +
    "[DateTimeOffset]::new($_.CreationDate).ToUnixTimeMilliseconds(), $_.Name }";
  const out = execFileSync('powershell', ['-NoProfile', '-NonInteractive', '-Command', ps], {
    encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'], timeout: 20_000,
  });
  return tolkaProcesser(out);
}

function lasUttag() {
  const out = execFileSync('netstat', ['-ano', '-p', 'TCP'], {
    encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'], timeout: 10_000,
  });
  const ut = tolkaNetstat(out);
  try {
    const v6 = execFileSync('netstat', ['-ano', '-p', 'TCPv6'], {
      encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'], timeout: 10_000,
    });
    ut.push(...tolkaNetstat(v6.replace(/TCPv6|TCP/g, 'TCP')));
  } catch {
    // Without IPv6, IPv4 is enough.
  }
  return ut;
}

function korMapp(rot) {
  return path.join(rot, 'status', 'kor');
}

function postFil(rot, n) {
  return path.join(korMapp(rot), `${n}.json`);
}

function lasPoster(rot) {
  let filer = [];
  try { filer = fs.readdirSync(korMapp(rot)).filter((f) => f.endsWith('.json')); } catch { return []; }
  const ut = [];
  for (const f of filer) {
    try {
      const p = JSON.parse(fs.readFileSync(path.join(korMapp(rot), f), 'utf8'));
      if (p && Number.isInteger(p.pid) && p.nyckel) ut.push(p);
    } catch {
      // A broken file is skipped.
    }
  }
  return ut;
}

function status(rot) {
  const poster = lasPoster(rot);
  if (!poster.length) return {};
  const processer = lasProcesser();
  const uttag = lasUttag();
  const ut = {};
  for (const p of poster) {
    const lever = arVar(p, processer);
    ut[p.nyckel] = { ...p, lever, portar: lever ? portarFor(p.pid, processer, uttag) : [] };
  }
  return ut;
}

function starta(rot, slug, namn) {
  const k = hittaKommando(fs.readFileSync(path.join(rot, 'status', 'radar.json'), 'utf8'), slug, namn);
  if (!k) throw new Error(`${slug} ${namn} is not in status/radar.json (run.json)`);
  if (k.konto) throw new Error(`${namn} runs as ${k.konto}: it is started with runas, not here`);
  const n = nyckel(slug, namn);
  const finns = status(rot)[n];
  if (finns && finns.lever) return { ...finns, redan: true };
  const titel = `RooFlow ${k.mapp} ${namn}`;
  const barn = spawn('cmd.exe', [kommandorad(titel, k.cwd, k.cmd)], {
    cwd: k.cwd,
    detached: true,
    stdio: 'ignore',
    windowsVerbatimArguments: true,
  });
  barn.unref();
  const nu = new Date();
  const post = { nyckel: n, slug, namn, titel, cmd: k.cmd, cwd: k.cwd, pid: barn.pid, startMs: nu.getTime(), startad: klockslag(nu) };
  fs.mkdirSync(korMapp(rot), { recursive: true });
  fs.writeFileSync(postFil(rot, n), JSON.stringify(post, null, 2) + '\n', 'utf8');
  return { ...post, lever: true, portar: [] };
}

function stoppa(rot, slug, namn) {
  const n = nyckel(slug, namn);
  const post = lasPoster(rot).find((p) => p.nyckel === n);
  if (!post) return { nyckel: n, stoppad: false, skal: 'not started from here' };
  const processer = lasProcesser();
  let stoppad = false;
  if (arVar(post, processer)) {
    execFileSync('taskkill', ['/PID', String(post.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore', timeout: 15_000 });
    stoppad = true;
  }
  fs.rmSync(postFil(rot, n), { force: true });
  return { nyckel: n, stoppad, skal: stoppad ? '' : 'the window was already closed' };
}

function main() {
  const [verb, slug, namn] = process.argv.slice(2);
  const handling = verb === 'stopp' ? 'stop' : verb;
  let svar;
  try {
    if (process.platform !== 'win32') throw new Error('the servers addon needs Windows');
    const { requireRoot } = require('./root');
    const rot = requireRoot();
    if (handling === 'status') svar = status(rot);
    else if ((handling === 'start' || handling === 'stop') && NAMN_MONSTER.test(slug || '') && NAMN_MONSTER.test(namn || '')) {
      svar = handling === 'start' ? starta(rot, slug, namn) : stoppa(rot, slug, namn);
    } else {
      throw new Error('usage: node scripts/servers.js start|stop <slug> <name> | status');
    }
  } catch (err) {
    process.stdout.write(JSON.stringify({ fel: String(err.message || err) }) + '\n');
    process.exit(1);
  }
  process.stdout.write(JSON.stringify(svar) + '\n');
}

module.exports = { hittaKommando, kommandorad, tolkaNetstat, tolkaProcesser, processTrad, arVar, portarFor, nyckel };

if (require.main === module) main();
