#!/usr/bin/env node
// Decides a decision without a model turn. The panel's answer buttons run this through $.process.run.
//
//   node scripts/decide.js <Id> <letter or free text>
//   flags: --idag YYYY-MM-DD (tests)   --utan-radar (skip scripts/radar.js)
//   The notebook root comes from scripts/root.js; the owner's name from rooflow.json "name" (default "owner").
//
// 1. Writes "Decision: <answer>, <name> <date>" and moves the block to the monthly archive (scripts/archive-decision.cjs, with lock).
// 2. If an agent asked (the block's Task, otherwise Project if the status file exists): a line under "## Beslut" in
//    status/<task>.md, "B<n> <answer> <date>", and Needs: B<n> is removed from the status header.
// 3. Runs scripts/radar.js so that the band is updated.
//
// The last stdout line is JSON: {"ok":true,"id","svar","task","radar"} or {"fel":"..."} (and exit 1).
// task is the status file's slug if an agent asked, otherwise "". The panel then fills in "B<n> <answer>: continue <task>".

'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const fmt = require('./format');
const rad = require('./lines');
const { loadConfig } = require('./root');
const { arkivera } = require('./archive-decision.cjs');

const BOKSTAV_RE = /^[a-h]$/i;

// The block's Task (Uppdrag) and Project (Projekt) from the archived block.
function blockFalt(blk, begrepp) {
  const m = blk.match(new RegExp('^- ' + fmt.alt(fmt.BESLUT[begrepp]) + ':[ \\t]*(.*)$', 'm'));
  return m ? m[1].trim() : '';
}

// The status file's slug for the question: Task if the file exists, otherwise Project if the file exists (older blocks have no Task).
// Tower itself (project "rooflow") is not an agent that gets continued, so it gets no line.
function statusSlug(rot, blk) {
  const finns = (s) => s && /^[\w.-]+$/.test(s) && fs.existsSync(path.join(rot, 'status', s + '.md'));
  const task = blockFalt(blk, 'uppdrag');
  if (finns(task)) return task;
  const projekt = blockFalt(blk, 'projekt').toLowerCase();
  if (projekt !== 'rooflow' && finns(projekt)) return projekt;
  return '';
}

// Adds "- B<n> <answer> <date>" last under "## Beslut" (created at the end of the file if missing) and removes B<n> from Needs.
function skrivStatus(text, id, svar, datum) {
  const eol = rad.eolAv(text);
  const rader = text.split(/\r?\n/);
  const ny = `- ${id} ${svar.replace(/\s+/g, ' ')} ${datum}`;
  const rub = rader.findIndex((r) => /^##\s+Beslut\s*$/.test(r));
  if (rub < 0) {
    while (rader.length && rader[rader.length - 1].trim() === '') rader.pop();
    rader.push('', '## Beslut', '', ny, '');
  } else {
    let slut = rub + 1;
    while (slut < rader.length && !/^##\s/.test(rader[slut])) slut++;
    while (slut > rub + 1 && rader[slut - 1].trim() === '') slut--;
    rader.splice(slut, 0, ny);
  }
  // Needs: B9 -> the line disappears; Needs: B9, B4 -> B4 stays. Only the header (the first ten lines) is touched.
  const behoverRe = fmt.statusRadRe('behover');
  for (let i = 0; i < Math.min(10, rader.length); i++) {
    const m = rader[i].match(behoverRe);
    if (!m) continue;
    const nyckel = rader[i].slice(0, rader[i].indexOf(':'));
    const kvar = m[1].split(/[\s,;|]+/).filter((v) => v && v.toUpperCase() !== id.toUpperCase());
    if (kvar.length === m[1].split(/[\s,;|]+/).filter(Boolean).length) break;
    if (kvar.length) rader[i] = `${nyckel}: ${kvar.join(', ')}`;
    else rader.splice(i, 1);
    break;
  }
  return rader.join(eol);
}

// The owner's name for the Decision line: rooflow.json "name", otherwise "owner".
function ownerName(rot) {
  return loadConfig(rot).config.name.trim() || 'owner';
}

function avgor(rot, id, svarText, datum, utanRadar, agare) {
  if (!/^B\d+$/.test(id)) throw new Error('the Id must look like B14');
  const svar = String(svarText || '').trim();
  if (!svar) throw new Error('answer missing: a letter or free text');
  const kort = BOKSTAV_RE.test(svar) ? svar.toLowerCase() : svar;
  const blk = arkivera(rot, id, `${kort}, ${agare || ownerName(rot)} ${datum}`);
  const task = statusSlug(rot, blk);
  if (task) {
    const p = path.join(rot, 'status', task + '.md');
    rad.skriv(p, skrivStatus(fs.readFileSync(p, 'utf8'), id, kort, datum));
  }
  let radar = false;
  if (!utanRadar) {
    const r = spawnSync(process.execPath, [path.join(__dirname, 'radar.js'), '--tyst'], {
      cwd: rot,
      env: { ...process.env, ROOFLOW_ROOT: rot },
      timeout: 60_000,
    });
    radar = r.status === 0;
  }
  return { ok: true, id, svar: kort, task, radar };
}

function main(argv) {
  const utanRadar = argv.includes('--utan-radar');
  const { rot, idag, args } = rad.flaggor(argv.filter((a) => a !== '--utan-radar'));
  const [id, ...resten] = args;
  try {
    console.log(JSON.stringify(avgor(rot, id || '', resten.join(' '), idag, utanRadar)));
  } catch (e) {
    console.log(JSON.stringify({ fel: e.message }));
    process.exitCode = 1;
  }
}

module.exports = { avgor, skrivStatus, statusSlug };

if (require.main === module) main(process.argv.slice(2));
