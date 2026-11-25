// RooFlow file format: Swedish and English keys and file names in one place.
// Readers must handle both. Internally the Swedish values are used (kör, frågar, klar, fast), so that
// radar.md and radar.json look the same whichever language the files are written in.
// The Radar mod's format.ts has a copy of this table: keep them equal.
'use strict';

const fs = require('fs');
const path = require('path');

// Files and folders relative to the notebook root. sv = old names, en = current names.
const FILER = {
  beslut: { sv: 'beslut.md', en: 'decisions.md' },
  loften: { sv: 'loften.md', en: 'promises.md' },
  inkorg: { sv: 'inkorg.md', en: 'inbox.md' },
  idag: { sv: 'idag.md', en: 'today.md' },
  overlamning: { sv: 'overlamning.md', en: 'handover.md' },
  projektregister: { sv: 'projektregister.md', en: 'projects.md' },
  tankar: { sv: 'tankar', en: 'notes' },
  arkiv: { sv: 'arkiv', en: 'archive' },
  agenter: { sv: 'agenter', en: 'briefs' },
  underagenter: { sv: 'status/underagenter.jsonl', en: 'status/subagents.jsonl' },
};

// Keys in a status file's header (three lines without bullet).
const STATUS = {
  lage: ['Läge', 'State'],
  gorNu: ['Gör nu', 'Doing'],
  uppdaterad: ['Uppdaterad', 'Updated'],
  // Optional lines after Doing: what the agent waits for, the task's slug and the project in projects.md.
  behover: ['Behöver', 'Needs'],
  uppdrag: ['Uppdrag', 'Task'],
  projekt: ['Projekt', 'Project'],
};

// Column headers in the project register (projects.md / projektregister.md).
const REGISTER = {
  mapp: ['Mapp', 'Folder'],
  kategori: ['Kategori', 'Category'],
  lage: ['Läge', 'State'],
  eget: ['Eget repo', 'Own repo'],
  remote: ['Remote'],
  kommentar: ['Kommentar', 'Comment'],
};

// The project's state in the register (State). The key is the internal (Swedish) value.
// Categories are not here: they come from rooflow.json "categories" (scripts/categories.js).
const PROJEKTLAGEN = {
  'nu': ['nu', 'now'],
  'nästa': ['nästa', 'next'],
  'väntar': ['väntar', 'waiting'],
  'parkerat': ['parkerat', 'parked'],
};

// The values of Läge/State. The key is the internal (Swedish) value.
const LAGEN = {
  'kör': ['kör', 'running'],
  'frågar': ['frågar', 'asking'],
  'klar': ['klar', 'done'],
  'fast': ['fast', 'stuck'],
};

// Fields in a decision block ("- Key: value"). The Id line is the same in both languages.
const BESLUT = {
  datum: ['Datum', 'Date'],
  projekt: ['Projekt', 'Project'],
  // The status file's slug. If missing, the decision is linked to the agent through Project.
  uppdrag: ['Uppdrag', 'Task'],
  blockerar: ['Blockerar', 'Blocks'],
  fragar: ['Frågar', 'Asked by'],
  fraga: ['Fråga', 'Question'],
  varfor: ['Varför det spelar roll', 'Why it matters'],
  alternativ: ['Alternativ', 'Options'],
  beslut: ['Beslut', 'Decision'],
};

// Headings (##) in decisions.md. Taken and Decided are both accepted for "Tagna".
const RUBRIKER = {
  oppna: ['Öppna', 'Open'],
  tagna: ['Tagna', 'Taken', 'Decided'],
  nastaId: ['Nästa Id', 'Next Id'],
  // promises.md and inbox.md: finished lines. Readers skip the section.
  klart: ['Klara', 'Klart', 'Done'],
  // today.md: "# Idag YYYY-MM-DD" / "# Today YYYY-MM-DD".
  idag: ['Idag', 'Today'],
};

// Keys in a line in status/journal.jsonl. The key is the internal (Swedish) name.
const JOURNAL = {
  tid: ['tid', 'time'],
  id: ['id'],
  projekt: ['projekt', 'project'],
  rapport: ['rapport', 'report'],
};
// The value of report when the run had no final report. Written in English, read in both.
const ORAPPORTERAD = ['orapporterad', 'unreported'];

// Fields in the final report (the REPORT line and the lines below it).
const RAPPORT = {
  rapport: ['RAPPORT', 'REPORT'],
  gjort: ['Gjort', 'Done'],
  owner: ['Owner'],
  loften: ['Löften', 'Promises'],
  blockerat: ['Blockerat', 'Blocked'],
  nasta: ['Nästa', 'Next'],
  lage: ['Läge', 'Branch'],
  provat: ['Prövat', 'Tested'],
};

// Fields in a line in underagenter.jsonl / subagents.jsonl. The key is the internal (Swedish) name.
const UNDERAGENT = {
  handelse: ['handelse', 'event'],
  uppdrag: ['uppdrag', 'task'],
  modell: ['modell', 'model'],
  tid: ['tid', 'time'],
  projekt: ['projekt', 'project'],
};
const HANDELSER = { start: ['start'], klar: ['klar', 'done'] };

// A journal line (Swedish or English keys) -> { tid, id, projekt, rapport }, undefined where the key is missing.
function journalRad(o) {
  const ut = {};
  for (const [internt, par] of Object.entries(JOURNAL)) ut[internt] = varde(o, par);
  return ut;
}

function arOrapporterad(v) {
  return ORAPPORTERAD.includes(v);
}

// Is the section heading (without ##) a done section: first word Klara, Klart or Done (case does not matter)?
function arKlartRubrik(rubrik) {
  const ord = String(rubrik).trim().toLowerCase().split(/\s+/)[0];
  return RUBRIKER.klart.some((k) => k.toLowerCase() === ord);
}

// The heading line in today.md: "# Idag 2026-11-19" or "# Today 2026-11-19". Group 1 is the date.
function idagRubrikRe() {
  return new RegExp('^#\\s*' + alt(RUBRIKER.idag) + '\\s+(\\d{4}-\\d{2}-\\d{2})', 'm');
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// The alternatives as a non-capturing regex group, longest first.
function alt(par) {
  return '(?:' + [...par].sort((a, b) => b.length - a.length).map(escapeRe).join('|') + ')';
}

// The value of the first key in par that exists in the object, otherwise undefined.
function varde(obj, par) {
  for (const k of par) {
    if (obj && Object.prototype.hasOwnProperty.call(obj, k)) return obj[k];
  }
  return undefined;
}

// The decision archive's month files: the old ones are named beslut-YYYY-MM.md, the new ones decisions-YYYY-MM.md.
// Returns those that exist, relative to the root.
function beslutArkivFiler(rot, manad) {
  const mapp = filnamn(rot, 'arkiv');
  return ['decisions-' + manad + '.md', 'beslut-' + manad + '.md'].map((n) => mapp + '/' + n).filter((rel) => fs.existsSync(path.join(rot, rel)));
}

// Relative path for a concept: the English file if it exists in the root, otherwise the Swedish one.
function filnamn(rot, begrepp) {
  const f = FILER[begrepp];
  if (!f) throw new Error('unknown file: ' + begrepp);
  return fs.existsSync(path.join(rot, f.en)) ? f.en : f.sv;
}

// "kör", "running", "Running (part 2)" -> "kör". An unknown value becomes the lower-case first word.
function normaliseraLage(v) {
  const ord = String(v || '').trim().toLowerCase().split(/[\s,.(]/)[0];
  for (const [internt, par] of Object.entries(LAGEN)) {
    if (par.includes(ord)) return internt;
  }
  return ord;
}

// "now", "nu" -> "nu" and so on. An unknown value (e.g. "–") is left as it is, in lower case.
function normaliseraProjektlage(v) {
  const s = String(v || '').trim().toLowerCase();
  for (const [internt, par] of Object.entries(PROJEKTLAGEN)) {
    if (par.includes(s)) return internt;
  }
  return s;
}

function normaliseraHandelse(v) {
  const h = String(v || '').trim().toLowerCase();
  for (const [internt, par] of Object.entries(HANDELSER)) {
    if (par.includes(h)) return internt;
  }
  return h;
}

// A line from the subagents jsonl -> { id, handelse (start|klar), uppdrag, modell, tid, projekt }, Swedish or English fields.
function underagentRad(o) {
  const ut = { id: o.id };
  for (const [internt, par] of Object.entries(UNDERAGENT)) ut[internt] = varde(o, par);
  ut.handelse = normaliseraHandelse(ut.handelse);
  return ut;
}

// The field in a bullet-field object ({ "Frågar": "x" }) for a concept in BESLUT, in either language.
function beslutFalt(falt, begrepp) {
  return varde(falt, BESLUT[begrepp]);
}

// The key "Beslut" or "Beslut 2026-10-21" (Decision in English).
function beslutNyckelRe() {
  return new RegExp('^' + alt(BESLUT.beslut) + '(\\s+\\d{4}-\\d{2}-\\d{2})?$');
}

// Status line "Key: value" with the key in either language. Group 1 is the value.
function statusRadRe(begrepp) {
  return new RegExp('^' + alt(STATUS[begrepp]) + ':\\s*(.+)$');
}

// Is the heading (without ##) one of the languages for the concept in RUBRIKER?
function arRubrik(rubrik, begrepp) {
  return RUBRIKER[begrepp].includes(String(rubrik).trim());
}

// "Nästa Id: B12" / "Next Id: B12". Group 1 is the digits.
function nastaIdRe() {
  return new RegExp(alt(RUBRIKER.nastaId) + ':\\s*B(\\d+)');
}

// The line where the final report starts, RAPPORT or REPORT.
function rapportStartRe() {
  return new RegExp('^' + alt(RAPPORT.rapport) + '\\s', 'm');
}

// The verbs of inbox.js, today.js and promise.js. English is canonical; the Swedish ones still work as aliases.
const VERBS = { lista: 'list', klar: 'done', 'ta-bort': 'remove', flytta: 'move', angra: 'undo' };

function normalizeVerb(v) {
  const s = String(v || '').trim().toLowerCase();
  return VERBS[s] || s;
}

module.exports = {
  VERBS, normalizeVerb,
  FILER, STATUS, REGISTER, LAGEN, PROJEKTLAGEN, BESLUT, RUBRIKER, RAPPORT, UNDERAGENT, HANDELSER, JOURNAL, ORAPPORTERAD,
  journalRad, arOrapporterad, arKlartRubrik, idagRubrikRe,
  alt, varde, filnamn, beslutArkivFiler, normaliseraLage, normaliseraProjektlage, normaliseraHandelse, underagentRad,
  beslutFalt, beslutNyckelRe, statusRadRe, arRubrik, nastaIdRe, rapportStartRe,
};
