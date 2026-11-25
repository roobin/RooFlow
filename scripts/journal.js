#!/usr/bin/env node
// Appends a line to status/journal.jsonl after an agent run: {"time","id","project","report"}.
// report = the agent's final report verbatim (from "REPORT " in the last answer), otherwise "unreported".
// Run by scripts/agent.sh after claude -p: `node scripts/journal.js <log.jsonl> <promptname>`.
// Reads only the last result line of the log. Radar shows unreported runs under moving agents.
// A session in the tree has no log: Tower saves its final answer to a file and runs
// `node scripts/journal.js --text <answer.txt> <promptname>`.

'use strict';

const fs = require('fs');
const path = require('path');
const fmt = require('./format');
const { requireRoot } = require('./root');

const MAX_RADER = 20;

function pad2(n) {
  return String(n).padStart(2, '0');
}

function tidNu(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

// The last "result" line in the stream-json log.
function sistaResultat(loggText) {
  const rader = loggText.split(/\r?\n/);
  for (let i = rader.length - 1; i >= 0; i--) {
    const rad = rader[i].trim();
    if (!rad.startsWith('{')) continue;
    try {
      const o = JSON.parse(rad);
      if (o && o.type === 'result') return typeof o.result === 'string' ? o.result : '';
    } catch {
      continue;
    }
  }
  return '';
}

// The report starts on the line "REPORT <project> <date>" and takes at most MAX_RADER lines.
function plockaRapport(svar) {
  const start = svar.search(fmt.rapportStartRe());
  if (start < 0) return '';
  return svar.slice(start).replace(/```\s*$/m, '').split(/\r?\n/).slice(0, MAX_RADER).join('\n').trim();
}

// A field from the final report ("Owner:", "**Owner:**", "- **Owner:** …"). Reports vary in form,
// so bold and bullets are stripped before matching. Values that say "none" give ''.
const INGET = /^(inget|ingen|inga|none|nothing|nil|n\/a|-|–|—)\.?$/i;

function faltUrRapport(rapport) {
  const ut = { owner: '', blockerat: '' };
  const nycklar = { owner: fmt.RAPPORT.owner, blockerat: fmt.RAPPORT.blockerat };
  for (const rad of String(rapport || '').split(/\r?\n/)) {
    const ren = rad.replace(/\*\*/g, '').replace(/^\s*[-*•]\s+/, '').trim();
    for (const [internt, par] of Object.entries(nycklar)) {
      if (ut[internt]) continue;
      const m = ren.match(new RegExp(`^${fmt.alt(par)}\\s*:\\s*(.*)$`, 'i'));
      if (m && m[1].trim() && !INGET.test(m[1].trim())) ut[internt] = m[1].trim();
    }
  }
  return ut;
}

// <date>-<project>-<subject>, the date is the first three segments.
function projektUrNamn(namn) {
  return namn.split('-')[3] || namn;
}

// arText: the text is the final answer itself (a session in the tree, whose answer Tower saved to a file), not a stream-json log.
function journalRad(loggText, namn, nu, arText = false) {
  const rapport = plockaRapport(arText ? loggText : sistaResultat(loggText));
  const rad = { time: tidNu(nu), id: namn, project: projektUrNamn(namn), report: rapport || 'unreported' };
  if (rapport) {
    const f = faltUrRapport(rapport);
    rad.owner = f.owner;
    rad.blocked = f.blockerat;
  }
  return rad;
}

function main() {
  const arText = process.argv.includes('--text');
  const [logg, namn] = process.argv.slice(2).filter((a) => a !== '--text');
  if (!logg || !namn) {
    console.error('Usage: node scripts/journal.js [--text] <log.jsonl | answer.txt> <promptname>');
    process.exit(1);
  }
  let text = '';
  try {
    text = fs.readFileSync(logg, 'utf8');
  } catch {
    text = '';
  }
  const rad = journalRad(text, namn, new Date(), arText);
  const statusDir = path.join(requireRoot(), 'status');
  fs.mkdirSync(statusDir, { recursive: true });
  fs.appendFileSync(path.join(statusDir, 'journal.jsonl'), JSON.stringify(rad) + '\n', 'utf8');
  console.log(rad.report === 'unreported' ? `Journal: ${namn} UNREPORTED (no REPORT in the final answer)` : `Journal: ${namn} report saved`);
}

module.exports = { sistaResultat, plockaRapport, projektUrNamn, journalRad, faltUrRapport };

if (require.main === module) main();
