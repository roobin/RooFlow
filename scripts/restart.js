#!/usr/bin/env node
// /restart <project>: runs the project's restart command, waits until the url answers and lists the agents
// that are on "Needs: restart" (the status file's Needs/Behöver) with their latest log. The skill continues them.
//
//   node scripts/restart.js <project>              runs the restart, waits, lists
//   node scripts/restart.js <project> --dry        runs nothing, only shows what would happen and which agents wait
//   --wait-ms <n>      longest wait for the url (default 300000 = 5 min)
//
// Command, url and folder are in rooflow.json under projects.<p> (restart, url, folder). No restart set: nothing is done.
// The last lines are machine-readable: "AGENT <slug>, log file and folder (tab-separated)" and "NO_LOG <slug>".
'use strict';

const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const { spawn } = require('child_process');
const fmt = require('./format');
const { requireRoot, loadConfig, projectMatches } = require('./root');

function args(argv) {
  const a = { projekt: '', torr: false, vantaMs: 300000 };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--dry') a.torr = true;
    else if (argv[i] === '--wait-ms') a.vantaMs = Number(argv[++i]);
    else if (!a.projekt) a.projekt = argv[i];
  }
  return a;
}

// Status files with Needs: restart that belong to the project.
function vantandeAgenter(rot, projekt) {
  const mapp = path.join(rot, 'status');
  let filer = [];
  try { filer = fs.readdirSync(mapp).filter((f) => f.endsWith('.md') && !f.startsWith('_')); } catch { return []; }
  const ut = [];
  for (const f of filer) {
    const slug = f.slice(0, -3);
    const rader = fs.readFileSync(path.join(mapp, f), 'utf8').split(/\r?\n/).slice(0, 10);
    let lage = '';
    let behover = '';
    let proj = '';
    for (const rad of rader) {
      let m = rad.match(fmt.statusRadRe('lage'));
      if (m) { lage = fmt.normaliseraLage(m[1]); continue; }
      m = rad.match(fmt.statusRadRe('behover'));
      if (m) { behover = m[1].trim().toLowerCase(); continue; }
      m = rad.match(fmt.statusRadRe('projekt'));
      if (m) proj = m[1].trim();
    }
    if (behover !== 'restart' && behover !== 'omstart') continue;
    if (!['kör', 'frågar', 'fast'].includes(lage)) continue;
    if (!projectMatches(slug, projekt, proj)) continue;
    ut.push(slug);
  }
  return ut.sort();
}

// The latest log file for the task: status/logg/<date>-<slug>.jsonl.
function senasteLogg(rot, slug) {
  const mapp = path.join(rot, 'status', 'logg');
  let filer = [];
  try { filer = fs.readdirSync(mapp); } catch { return ''; }
  const traffar = filer.filter((f) => f.endsWith('.jsonl') && f.replace(/^\d{4}-\d{2}-\d{2}-/, '').slice(0, -6) === slug).sort();
  return traffar.length ? path.join(mapp, traffar[traffar.length - 1]) : '';
}

function svarar(url, timeoutMs) {
  return new Promise((resolve) => {
    const lib = url.startsWith('https:') ? https : http;
    const req = lib.get(url, { rejectUnauthorized: false, timeout: Math.min(5000, timeoutMs) }, (res) => {
      res.resume();
      resolve(res.statusCode < 500);
    });
    req.on('timeout', () => { req.destroy(); resolve(false); });
    req.on('error', () => resolve(false));
  });
}

async function vantaPaUrl(url, maxMs) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    if (await svarar(url, maxMs)) return Math.round((Date.now() - start) / 1000);
    await new Promise((r) => setTimeout(r, 1000));
  }
  return -1;
}

function kor(kommando, rot) {
  return new Promise((resolve) => {
    const p = spawn(kommando, { shell: true, cwd: rot, stdio: 'inherit' });
    p.on('close', (kod) => resolve(kod));
    p.on('error', () => resolve(-1));
  });
}

async function main() {
  const a = args(process.argv.slice(2));
  if (!a.projekt) { console.error('Usage: node scripts/restart.js <project> [--dry]'); process.exit(2); }
  const rot = requireRoot();
  const { config, error } = loadConfig(rot);
  if (error) console.log(`WARNING rooflow.json: ${error}`);
  const p = config.projects[a.projekt];
  if (!p || !p.restart) {
    console.log(`No restart configured for "${a.projekt}": add projects.${a.projekt}.restart (and url) to rooflow.json. Nothing done.`);
    process.exit(0);
  }
  const url = p.url || '';
  const mapp = p.folder ? path.resolve(rot, p.folder) : '';
  const agenter = vantandeAgenter(rot, a.projekt);

  if (a.torr) {
    console.log(`DRY RUN: would run "${p.restart}" in ${rot}, wait for ${url || '(no url: no wait)'}.`);
  } else {
    console.log(`Restarting ${a.projekt}: ${p.restart}`);
    const kod = await kor(p.restart, rot);
    if (kod !== 0) {
      // The command exits with 1 e.g. when another instance already runs: the old process would answer on the url and look like a successful restart.
      console.log(`ERROR: the restart command exited with code ${kod}. Not waiting for the url and not continuing any agent.`);
      process.exit(1);
    }
    if (url) {
      const s = await vantaPaUrl(url, a.vantaMs);
      if (s < 0) {
        console.log(`ERROR: ${url} did not answer within ${Math.round(a.vantaMs / 1000)} s. Not continuing any agent.`);
        process.exit(1);
      }
      console.log(`${a.projekt} answers on ${url} after ${s} s.`);
    } else {
      console.log('No url configured: not waiting for an answer.');
    }
  }

  if (!mapp) console.log(`WARNING: projects.${a.projekt}.folder is missing in rooflow.json, the agents cannot be continued.`);
  console.log(`Agents waiting for a restart: ${agenter.length}`);
  for (const slug of agenter) {
    const logg = senasteLogg(rot, slug);
    if (!logg || !mapp) console.log(`NO_LOG ${slug}`);
    else console.log(`AGENT ${slug}\t${logg}\t${mapp}`);
  }
}

main();
