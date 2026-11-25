#!/usr/bin/env node
// Radar: reads the notebook's files and writes radar.md (at most 40 lines), status/radar.json (structured copy
// for the panel) and status/radar-forra.json (delta baseline). Zero tokens.
//
// Run from anywhere inside the notebook (or set ROOFLOW_ROOT):
//   node scripts/radar.js [--nollstall|--reset] [--tyst|--quiet] [--dry-run]   (--reset and --quiet are English aliases)
//   --nollstall  count the delta from now (otherwise from the first run of the day)
//   --tyst       write the files but do not print radar.md to stdout
//   --dry-run    read-only: print radar.md to stdout, write no file at all
//
// Never reads status/logg/*.jsonl (agent logs), appsettings*, secrets.json or anything that looks like a secret.

'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const lasRegister = require('./register');
const fmt = require('./format');
const inbox = require('./inbox');
const { hashRad } = require('./lines');
const { faltUrRapport } = require('./journal');
const { requireRoot, loadConfig } = require('./root');

// Version of status/radar.json. Raise it when a field changes shape; the panel mod warns about an unknown number.
const FORMAT = 1;

// Resolved on every call (not at load), so that tests can require this file and set ROOFLOW_ROOT later.
function root() {
  return requireRoot();
}
const MAX_RADER = 40;
const STILL_DAGAR = 5;
// An agent whose status file says "kör" (running) but has not been updated for this long is shown as quiet.
const TYST_MS = 2 * 60 * 60 * 1000;
const KOR_NU_MS = 2 * 60 * 60 * 1000;
// A quiet agent drops out of IN MOTION after a day; it is still listed under projects.
const TYST_BORT_MS = 24 * 60 * 60 * 1000;
// Subagents with a start but no "done" after this long count as dead, not running.
const UNDERAGENT_DOD_MS = 12 * 60 * 60 * 1000;

// Caps for what radar.json carries for the panel, to keep the file small.
const BLOCK_MAX = 3000;
const RAPPORT_MAX = 2000;
const RAPPORTER_PER_PROJEKT = 3;
const DOCS_MAX = 20;
const GIT_LOGG = 10;
const INKORG_RADER = 60;
const INKORG_RAD_MAX = 300;
const AGENTER_SENASTE = 12;
// radar.md follows "language" in rooflow.json. radar.json keeps its keys; the mod translates on its own.
const TEXT = {
  en: {
    weekdays: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    week: 'week', since: 'since', suggested: 'suggested', more: 'more', today: 'today',
    needsYou: 'NEEDS YOU', nothingWaits: 'nothing waits for you', blocks: 'blocks',
    todayHead: 'TODAY', doneOf: (klara, alla) => `${klara} of ${alla} done`, written: 'written',
    nothingChosen: 'nothing chosen: write "today: X; Y; Z" in the chat',
    promised: 'PROMISED', recipientMissing: '(recipient missing)', noPromises: 'no open promises',
    waiting: 'WAITING', inMotion: 'IN MOTION', unreported: 'unreported', noAgent: 'no agent running',
    dead: (n) => `(${n} subagent${n === 1 ? '' : 's'} without "done" for over 12 h not counted)`,
    stalled: 'STALLED', lastTouched: 'last touched', status: 'status',
    inbox: 'INBOX', oldest: 'oldest', parked: 'parked', cut: '(cut at 40 lines)',
  },
  sv: {
    weekdays: ['sön', 'mån', 'tis', 'ons', 'tor', 'fre', 'lör'],
    week: 'vecka', since: 'sedan', suggested: 'förslag', more: 'till', today: 'i dag',
    needsYou: 'BEHÖVER DIG', nothingWaits: 'inget väntar på dig', blocks: 'blockerar',
    todayHead: 'IDAG', doneOf: (klara, alla) => `${klara} av ${alla} klara`, written: 'skriven',
    nothingChosen: 'inget valt: skriv "idag: X; Y; Z" i chatten',
    promised: 'LOVAT', recipientMissing: '(mottagare saknas)', noPromises: 'inga öppna löften',
    waiting: 'VÄNTAR', inMotion: 'RÖR SIG', unreported: 'orapporterad', noAgent: 'ingen agent kör',
    dead: (n) => `(${n} underagent${n === 1 ? '' : 'er'} utan "done" i över 12 h räknas inte)`,
    stalled: 'STÅR STILL', lastTouched: 'senast rörd', status: 'status',
    inbox: 'INKORG', oldest: 'äldsta', parked: 'bordlagda', cut: '(kapad vid 40 rader)',
  },
};
let T = TEXT.en;
const VECKODAGAR = () => T.weekdays;

// --- helpers ---

function pad2(n) {
  return String(n).padStart(2, '0');
}

function isoDatum(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function klockslag(d) {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

// "2026-10-15" -> "15/10"
function kortDatum(iso) {
  const m = String(iso || '').match(/^\d{4}-(\d{2})-(\d{2})/);
  return m ? `${Number(m[2])}/${Number(m[1])}` : String(iso || '');
}

function veckodagDatum(iso) {
  const d = lokaltDatum(iso);
  return d ? `${VECKODAGAR()[d.getDay()]} ${kortDatum(iso)}` : iso;
}

// "2026-10-15", "2026-10-15 14:05" or ISO with time zone. A date without time is read as local midnight.
function lokaltDatum(s) {
  const t = String(s || '').trim();
  let m = t.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  m = t.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})$/);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]));
  const d = new Date(t);
  return isNaN(d) ? null : d;
}

function dagarMellan(franIso, tillIso) {
  const a = lokaltDatum(franIso);
  const b = lokaltDatum(tillIso);
  if (!a || !b) return null;
  return Math.round((b - a) / 86400000);
}

// Age in plain text. A source with only a date gives days, otherwise minutes/hours.
function alder(fran, nu) {
  const s = String(fran || '').trim();
  const d = lokaltDatum(s);
  if (!d) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const dagar = dagarMellan(s, isoDatum(nu));
    return dagar <= 0 ? T.today : `${dagar} d`;
  }
  const min = Math.max(0, Math.round((nu - d) / 60000));
  if (min < 60) return `${min} min`;
  if (min < 24 * 60) return `${Math.floor(min / 60)} h`;
  return `${Math.floor(min / (24 * 60))} d`;
}

function las(rel) {
  const p = path.join(root(), rel);
  try {
    return fs.readFileSync(p, 'utf8').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
  } catch {
    return '';
  }
}

function kapa(s, n) {
  const t = String(s || '').replace(/\s+/g, ' ').trim();
  return t.length > n ? t.slice(0, n - 1) + '…' : t;
}

// Like kapa, but line breaks are kept (Markdown and final reports).
function kapaBlock(s, n) {
  const t = String(s || '').replace(/\r\n/g, '\n').trim();
  return t.length > n ? t.slice(0, n - 1) + '…' : t;
}

function kolumn(s, n) {
  return kapa(s, n).padEnd(n);
}

// --- decisions.md ---

// "- Key: value" with indented continuation lines.
function punktFalt(block) {
  const falt = {};
  let nyckel = null;
  for (const rad of block.split('\n')) {
    const m = rad.match(/^- ([^:]{1,60}):\s*(.*)$/);
    if (m) {
      nyckel = m[1].trim();
      falt[nyckel] = m[2].trim();
    } else if (nyckel && /^\s+\S/.test(rad)) {
      falt[nyckel] += ' ' + rad.trim();
    } else if (rad.trim() === '') {
      nyckel = null;
    }
  }
  return falt;
}

// "a) kör. b) **(förslag)** vänta." -> [{bokstav, text, forslag}]
function tolkaAlternativ(text) {
  const delar = String(text || '').split(/(?:^|\s)(?=[a-h]\)\s)/).map((d) => d.trim()).filter(Boolean);
  const ut = [];
  for (const del of delar) {
    const m = del.match(/^([a-h])\)\s*([\s\S]+)$/);
    if (!m) continue;
    const forslag = /\((?:förslag|suggestion)[^)]*\)/i.test(m[2]);
    const ren = m[2].replace(/\*\*/g, '').replace(/\((?:förslag|suggestion)[^)]*\)\s*/i, '').replace(/[.;,]\s*$/, '').trim();
    ut.push({ bokstav: m[1], text: ren, forslag });
  }
  return ut;
}

function beslutVarde(falt) {
  const re = fmt.beslutNyckelRe();
  const nyckel = Object.keys(falt).find((k) => re.test(k));
  if (!nyckel) return '';
  const v = falt[nyckel].trim();
  return /^\(tomt/i.test(v) ? '' : v;
}

// All blocks under "## Open" (Swedish: "## Öppna"). status: "oppen" (waits for the owner), "bordlagd" (parked), "avgjord" (Decision filled in).
function tolkaBeslut(text) {
  const block = text.split(/\n(?=## )/);
  let iOppna = false;
  const ut = [];
  for (const b of block) {
    const rubrikM = b.match(/^## (.+)$/m);
    const rubrik = rubrikM ? rubrikM[1].trim() : '';
    if (fmt.arRubrik(rubrik, 'oppna')) { iOppna = true; continue; }
    if (fmt.arRubrik(rubrik, 'tagna')) { iOppna = false; continue; }
    if (!iOppna) continue;
    const falt = punktFalt(b);
    if (!fmt.beslutFalt(falt, 'fragar')) continue;
    const beslut = beslutVarde(falt);
    let status = 'oppen';
    if (/^(bordlag|parked)/i.test(beslut)) status = 'bordlagd';
    else if (beslut) status = 'avgjord';
    ut.push({
      id: (falt['Id'] || '').trim(),
      rubrik,
      datum: (fmt.beslutFalt(falt, 'datum') || '').trim(),
      fragar: fmt.beslutFalt(falt, 'fragar') || '',
      projekt: fmt.beslutFalt(falt, 'projekt') || '',
      uppdrag: (fmt.beslutFalt(falt, 'uppdrag') || '').trim(),
      blockerar: fmt.beslutFalt(falt, 'blockerar') || '',
      alternativ: tolkaAlternativ(fmt.beslutFalt(falt, 'alternativ') || falt['Förslag'] || ''),
      status,
      // The whole block without the heading, which the panel shows as Markdown.
      text: kapaBlock(b.replace(/^## .+$/m, '').trim(), BLOCK_MAX),
    });
  }
  return ut;
}

// --- promises.md ---

// Promise: "- [ ] YYYY-MM-DD (comment) · till WHOM · WHAT · source".
// Waiting: an open line with "· väntar på WHOM ·", e.g. "- [ ] 2026-10-15 · väntar på IT · answer about X · source".
// (The words "till"/"to" and "väntar på"/"waiting for" are keywords of the file format.)
const TILL_RE = /^(?:till|to)\s+/i;
const VANTAR_RE = /^(?:väntar på|waiting for)\s+/i;
function tolkaLoften(text, idagIso) {
  const loften = [];
  const vantar = [];
  let iKlara = false;
  for (const rad1 of text.split('\n')) {
    const h = rad1.match(/^## (.+)$/);
    if (h) { iKlara = fmt.arKlartRubrik(h[1]); continue; }
    if (iKlara) continue;
    const m = rad1.match(/^- \[ \]\s*(\d{4}-\d{2}-\d{2})([^·]*)·\s*(.+)$/);
    if (!m) continue;
    const datum = m[1];
    // The same text that scripts/promise.js hashes: everything after "- [ ] ".
    const radText = rad1.replace(/^- \[ \]\s*/, '');
    const delar = m[3].split(/\s+·\s+/).map((d) => d.trim()).filter(Boolean);
    const vantarDel = delar.find((d) => VANTAR_RE.test(d));
    if (vantarDel || /·\s*(?:väntar på|waiting for)\s/i.test(rad1)) {
      const vem = vantarDel ? vantarDel.replace(VANTAR_RE, '') : '';
      const vad = delar.find((d) => d !== vantarDel && !TILL_RE.test(d)) || '';
      vantar.push({ datum, vem, vad, hash: hashRad(radText) });
      continue;
    }
    const tillDel = delar.find((d) => TILL_RE.test(d));
    if (!tillDel) continue;
    const vem = tillDel.replace(TILL_RE, '').trim();
    const efter = delar.slice(delar.indexOf(tillDel) + 1);
    const vad = efter[0] || '';
    const dagar = dagarMellan(idagIso, datum);
    let nar = '';
    if (dagar < 0) nar = 'FÖRSENAT';
    else if (dagar === 0) nar = 'IDAG';
    else if (dagar === 1) nar = 'IMORGON';
    loften.push({ datum, vem, vad, nar, mottagareSaknas: /\?|fyller i/i.test(vem), hash: hashRad(radText) });
  }
  loften.sort((a, b) => a.datum.localeCompare(b.datum));
  vantar.sort((a, b) => a.datum.localeCompare(b.datum));
  return { loften, vantar };
}

// --- today.md: "# Today YYYY-MM-DD" and at most three "- [ ]"/"- [x]" ---

function tolkaIdag(text) {
  const m = text.match(fmt.idagRubrikRe());
  const saker = [];
  for (const rad of text.split('\n')) {
    const r = rad.match(/^- \[( |x|X)\]\s*(.+)$/);
    if (r) saker.push({ klar: r[1] !== ' ', text: r[2].trim(), hash: hashRad(r[2].trim()) });
  }
  return { datum: m ? m[1] : '', saker: saker.slice(0, 3) };
}

// --- status/<project>.md: "State:", "Doing:", "Updated:" at the top (the agent contract) ---
// Swedish keys (Läge, Gör nu, Uppdaterad) are read too. lage is always normalised to the internal value (kör, frågar, klar, fast).

// Optional lines: "Needs:" restart | deploy | B<n> | free text, "Task:" and "Project:".
function tolkaStatusHuvud(text) {
  const ut = { lage: '', gorNu: '', uppdaterad: '', behover: '', uppdrag: '', projekt: '' };
  const rader = text.split('\n').slice(0, 10);
  for (const rad of rader) {
    let m = rad.match(fmt.statusRadRe('lage'));
    if (m) { ut.lage = fmt.normaliseraLage(m[1]); continue; }
    m = rad.match(fmt.statusRadRe('gorNu'));
    if (m) { ut.gorNu = m[1].trim(); continue; }
    m = rad.match(fmt.statusRadRe('uppdaterad'));
    if (m) { ut.uppdaterad = m[1].trim(); continue; }
    m = rad.match(fmt.statusRadRe('behover'));
    if (m) { ut.behover = m[1].trim(); continue; }
    m = rad.match(fmt.statusRadRe('uppdrag'));
    if (m) { ut.uppdrag = m[1].trim(); continue; }
    m = rad.match(fmt.statusRadRe('projekt'));
    if (m) ut.projekt = m[1].trim();
  }
  return ut.lage ? ut : null;
}

// Old status files: "- State: …" as a bullet. Only used as a text line under STALLED.
function statusText(text) {
  const huvud = tolkaStatusHuvud(text);
  if (huvud && huvud.gorNu) return huvud.gorNu;
  const falt = lasRegister.parseBulletFields(text);
  return falt['Nästa steg'] || falt['Next step'] || falt['Läge'] || falt['State'] || '';
}

// --- status/subagents.jsonl: start without done = running ---

function tolkaUnderagenter(text) {
  const kor = new Map();
  for (const rad of text.split('\n')) {
    if (!rad.trim()) continue;
    let o;
    try { o = JSON.parse(rad); } catch { continue; }
    if (!o || !o.id) continue;
    o = fmt.underagentRad(o);
    if (o.handelse === 'start') kor.set(o.id, { id: o.id, projekt: o.projekt || 'rooflow', uppdrag: o.uppdrag || '', modell: o.modell || '', start: o.tid || '' });
    else if (o.handelse === 'klar') kor.delete(o.id);
  }
  return [...kor.values()];
}

// All subagents, start joined with done, in start order. klar is '' for one that has not reported done.
function tolkaUnderagentHistorik(text) {
  const per = new Map();
  for (const rad of text.split('\n')) {
    if (!rad.trim()) continue;
    let o;
    try { o = JSON.parse(rad); } catch { continue; }
    if (!o || !o.id) continue;
    o = fmt.underagentRad(o);
    if (o.handelse === 'start') {
      per.delete(o.id);
      per.set(o.id, { id: o.id, projekt: o.projekt || 'rooflow', uppdrag: kapa(o.uppdrag || '', 200), modell: o.modell || '', start: o.tid || '', klar: '', resultat: '' });
    } else if (o.handelse === 'klar' && per.has(o.id)) {
      const u = per.get(o.id);
      u.klar = o.tid || '';
      u.resultat = kapa(o.uppdrag || '', 200);
    }
  }
  return [...per.values()];
}

// status/sessioner.json may have unescaped backslashes in Windows paths. Repair them before parsing.
function tolkaSessioner(text) {
  if (!text.trim()) return [];
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    try { data = JSON.parse(text.replace(/\\(?!["\\/bfnrtu])/g, '\\\\')); } catch { return []; }
  }
  if (!data || !Array.isArray(data.sessioner)) return [];
  return data.sessioner.filter((s) => s && s.kor).map((s) => ({ projekt: s.projekt || '', titel: s.titel || '', senast: s.senast || data.genererad || '' }));
}

// status/journal.jsonl: {"time","id","project","report"} (older lines: tid, projekt, rapport); "unreported" (or "orapporterad") is flagged.
function tolkaJournal(text) {
  const ut = [];
  for (const rad of text.split('\n')) {
    if (!rad.trim()) continue;
    let o;
    try { o = JSON.parse(rad); } catch { continue; }
    if (!o) continue;
    const j = fmt.journalRad(o);
    if (!j.projekt) continue;
    const orapporterad = fmt.arOrapporterad(j.rapport) || o.orapporterad === true;
    // The Owner: and Blocked: lines are picked from the report text (older lines have no fields of their own).
    const falt = orapporterad ? { owner: '', blockerat: '' } : faltUrRapport(j.rapport);
    ut.push({
      tid: j.tid || '', id: j.id || '', projekt: j.projekt, orapporterad, rapport: orapporterad ? '' : kapaBlock(String(j.rapport || ''), RAPPORT_MAX),
      owner: typeof o.owner === 'string' ? o.owner : falt.owner,
      blockerat: typeof o.blocked === 'string' ? o.blocked : falt.blockerat,
    });
  }
  return ut;
}

// CLAUDE.md and docs/*.md in the project folder, full paths. Only names, no content is read.
function projektDocs(dir) {
  const ut = [];
  if (fs.existsSync(path.join(dir, 'CLAUDE.md'))) ut.push(path.join(dir, 'CLAUDE.md'));
  try {
    for (const f of fs.readdirSync(path.join(dir, 'docs')).sort()) if (f.endsWith('.md')) ut.push(path.join(dir, 'docs', f));
  } catch { /* no docs folder */ }
  return ut.slice(0, DOCS_MAX);
}

// --- inbox.md: number of list lines outside the done section, oldest date ---

function tolkaInkorg(text) {
  let iKlart = false;
  let rubrik = '';
  let antal = 0;
  let aldsta = '';
  const rader = [];
  for (const rad of text.split('\n')) {
    const h = rad.match(/^##\s+(.+)$/);
    if (h) { rubrik = h[1].trim(); iKlart = fmt.arKlartRubrik(rubrik); continue; }
    if (iKlart) continue;
    const t = rad.trimStart();
    if (!(t.startsWith('- ') || /^\d+\.\s/.test(t))) continue;
    antal++;
    const d = t.match(/(\d{4}-\d{2}-\d{2})/);
    if (d && (!aldsta || d[1] < aldsta)) aldsta = d[1];
    rader.push({ datum: d ? d[1] : '', rubrik, text: kapa(t.replace(/^(-|\d+\.)\s+/, ''), INKORG_RAD_MAX) });
  }
  // Oldest first. Lines without a date keep the file order, after the dated ones.
  const ordnade = rader.map((r, i) => ({ r, i })).sort((a, b) => {
    if (a.r.datum && b.r.datum && a.r.datum !== b.r.datum) return a.r.datum < b.r.datum ? -1 : 1;
    if (!!a.r.datum !== !!b.r.datum) return a.r.datum ? -1 : 1;
    return a.i - b.i;
  }).map((x) => x.r);
  return { antal, aldsta, rader: ordnade.slice(0, INKORG_RADER), sektioner: inbox.tillPanel(text), angra: inbox.senasteAngra(root()) };
}

// --- usage.md: the last row of the first table, only if it is from today ---

function tolkaUsage(text, idagIso) {
  const sista = tolkaUsageSenast(text);
  if (!sista || sista.datum !== idagIso) return null;
  return { datum: sista.datum, tid: sista.tid, femh: sista.femh, vecka: sista.vecka };
}

// The last row whatever its date, for the panel's usage box (which says when it was measured).
function tolkaUsageSenast(text) {
  let iTabell = false;
  let sista = null;
  for (const rad of text.split('\n')) {
    const t = rad.trim();
    if (!iTabell && /^\|\s*(?:Datum|Date)\s*\|\s*(?:Tid|Time)/.test(t)) { iTabell = true; continue; }
    if (!iTabell) continue;
    if (/^\|\s*---/.test(t)) continue;
    if (!t.startsWith('|')) break;
    const c = t.split('|').slice(1, -1).map((x) => x.trim());
    if (c.length >= 4) sista = { datum: c[0], tid: c[1], femh: c[2], vecka: c[3], weekModel: c[4] || '', kommentar: c[5] || '' };
  }
  return sista;
}

// --- git ---

// The latest GIT_LOGG commits, newest first. Empty list when there is no git repository here.
function gitLogg(mapp, config) {
  const kandidater = lasRegister.repoKandidater(root(), config, mapp);
  for (const [i, dir] of kandidater.entries()) {
    // A folder named in rooflow.json may be a subfolder of a repository; a guessed folder must be a repository itself.
    const angiven = i === 0 && lasRegister.folderFromConfig(config, mapp);
    if (angiven ? !fs.existsSync(dir) : !fs.existsSync(path.join(dir, '.git'))) continue;
    try {
      const out = execFileSync('git', ['-C', dir, 'log', `-${GIT_LOGG}`, '--format=%h%x09%ci%x09%s'], {
        encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'], timeout: 5000,
      });
      const logg = tolkaGitLogg(out);
      if (logg.length) return logg;
    } catch {
      continue;
    }
  }
  return [];
}

function tolkaGitLogg(text) {
  return text.split('\n').filter((r) => r.trim()).map((r) => {
    const [hash, tid, ...rest] = r.split('\t');
    return { hash, tid: String(tid || '').slice(0, 16), text: kapa(rest.join('\t'), 120) };
  });
}

// The project name or slug as a word of its own. Short names such as "IN" need capitals, otherwise "in" matches everywhere.
function namnerProjekt(s, p) {
  const esc = (x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (p.mapp.length <= 3) return new RegExp(`\\b${esc(p.mapp)}\\b`).test(s);
  return new RegExp(`\\b(${esc(p.mapp)}|${esc(p.slug)})\\b`, 'i').test(s);
}

// <project folder>/run.json: [{ namn, cmd, cwd?, konto? }] (run commands the panel can offer).
function lasKorJson(dir) {
  let lista;
  try {
    lista = JSON.parse(fs.readFileSync(path.join(dir, 'run.json'), 'utf8').replace(/^﻿/, ''));
  } catch {
    return [];
  }
  if (!Array.isArray(lista)) return [];
  return lista
    .filter((k) => k && typeof k.namn === 'string' && /^[\wåäöÅÄÖ-]{1,40}$/.test(k.namn) && typeof k.cmd === 'string' && k.cmd.trim() && k.cmd.length <= 400)
    .map((k) => ({
      namn: k.namn,
      cmd: k.cmd.trim(),
      cwd: typeof k.cwd === 'string' && k.cwd ? path.resolve(dir, k.cwd) : dir,
      konto: typeof k.konto === 'string' && /^[\w.-]{1,40}$/.test(k.konto) ? k.konto : '',
    }));
}

// commands.md: table lines "| `/name …` | description | file |". The first line per command wins.
const SKILL_ORDNING = ['/radar', '/morning', '/inbox', '/promise', '/decisions', '/agent', '/restart', '/ship', '/rooflow-doctor', '/cleanup', '/friday', '/handover', '/start'];
function tolkaKommandon(text) {
  const besk = {};
  for (const rad of text.split('\n')) {
    const m = rad.match(/^\|\s*`(\/[a-zåäö-]+)[^`]*`\s*\|\s*([^|]+)\|/);
    if (m && !besk[m[1]]) besk[m[1]] = m[2].trim();
  }
  return SKILL_ORDNING.map((namn) => ({ namn, besk: besk[namn] || '' }));
}

// The Needs value to a group: restart | deploy | beslut (B<n>, a decision) | annat (anything else).
function vantarKategori(behover) {
  const v = String(behover || '').trim().toLowerCase();
  if (v === 'restart' || v === 'omstart') return 'restart';
  if (v === 'deploy') return 'deploy';
  if (/^b\d+$/.test(v)) return 'beslut';
  return 'annat';
}

// The waiting agents per group: { restart: [...], deploy: [...], beslut: [...], annat: [...] }. Read from rorSig.
function vantarPer(rorSig) {
  const ut = { restart: [], deploy: [], beslut: [], annat: [] };
  for (const r of rorSig) {
    if (!r.behover) continue;
    ut[r.vantarPa].push({ slug: r.slug, namn: r.namn || r.slug, projekt: r.projekt || '', behover: r.behover, sedan: r.sedan, gorNu: r.gorNu });
  }
  return ut;
}

// Agents running now, for the band: the status file's state is running and Updated is within the last KOR_NU_MS.
// Quiet agents (older) do not count, but stay in IN MOTION. An agent that waits for something (Needs) counts as waiting,
// not running: `vantande` holds their slugs, so the band and the panel never count one agent twice.
function korNuNamn(statusHuvud, nu, vantande = new Set()) {
  const namn = [];
  for (const [slug, h] of statusHuvud) {
    if (h.lage !== 'kör') continue;
    if (vantande.has(slug)) continue;
    const upp = lokaltDatum(h.uppdaterad);
    if (upp && nu - upp <= KOR_NU_MS) namn.push(slug);
  }
  return namn.sort();
}

// --- collecting ---

function projektNamn(slug, register) {
  const p = register.find((r) => r.slug === slug);
  return p ? p.mapp : slug;
}

function samla(nu) {
  const ROOT = root();
  const config = loadConfig(ROOT).config;
  const idagIso = isoDatum(nu);
  const register = lasRegister.parseProjektregister(las(fmt.filnamn(ROOT, 'projektregister')), config.categories);
  const besluten = tolkaBeslut(las(fmt.filnamn(ROOT, 'beslut')));
  const { loften, vantar } = tolkaLoften(las(fmt.filnamn(ROOT, 'loften')), idagIso);
  const idag = tolkaIdag(las(fmt.filnamn(ROOT, 'idag')));
  const inkorg = tolkaInkorg(las(fmt.filnamn(ROOT, 'inkorg')));
  const usage = tolkaUsage(las('usage.md'), idagIso);

  // Status files with the agent contract header.
  const statusHuvud = new Map();
  let statusFiler = [];
  try { statusFiler = fs.readdirSync(path.join(ROOT, 'status')).filter((f) => f.endsWith('.md') && !f.startsWith('_')); } catch { /* no folder */ }
  for (const f of statusFiler) {
    const h = tolkaStatusHuvud(las(path.join('status', f)));
    if (h) statusHuvud.set(f.slice(0, -3), h);
  }

  // IN MOTION: one line per project. The status file's state wins; subagents and sessions fill in.
  const rorSig = new Map();
  for (const [slug, h] of statusHuvud) {
    if (!['kör', 'frågar', 'fast'].includes(h.lage)) continue;
    const upp = lokaltDatum(h.uppdaterad);
    const tyst = h.lage === 'kör' && upp && nu - upp > TYST_MS;
    if (tyst && nu - upp > TYST_BORT_MS) continue;
    // The decision is tied to the agent through Task (the status file's slug), otherwise through Project.
    const oppna = besluten.filter((b) => b.status === 'oppen');
    const fragaId = h.lage === 'frågar'
      ? (oppna.find((b) => b.uppdrag && b.uppdrag.toLowerCase() === slug)
        || oppna.find((b) => !b.uppdrag && b.projekt && b.projekt.toLowerCase().includes(slug)) || {}).id
      : '';
    // Needs: waiting for something, whether or not a B-id exists. A B-id that is no longer open is decided and does not count.
    let behover = h.behover;
    if (behover && vantarKategori(behover) === 'beslut' && !oppna.some((b) => b.id.toUpperCase() === behover.toUpperCase())) behover = '';
    // Agents rarely rewrite the state once the decision is made; with no Needs and no open B-id they wait for nothing.
    if (h.lage === 'frågar' && !fragaId && !behover) continue;
    rorSig.set(slug, {
      slug,
      vad: h.gorNu,
      lage: behover ? `väntar: ${behover}` : tyst ? `tyst ${alder(h.uppdaterad, nu)}` : h.lage === 'frågar' ? `frågar ${fragaId || ''}`.trim() : h.lage,
      sedan: h.uppdaterad,
      gorNu: h.gorNu,
      modell: '',
      // The project key (rooflow.json) for the /restart <project> button: the Project: line, otherwise the slug's first part.
      projekt: String(h.projekt || slug).trim().toLowerCase().split(/[\s-]/)[0],
      ...(behover ? { behover, vantarPa: vantarKategori(behover) } : {}),
    });
  }
  const underagenter = tolkaUnderagenter(las(fmt.filnamn(ROOT, 'underagenter')));
  let doda = 0;
  for (const u of underagenter) {
    const start = lokaltDatum(u.start);
    if (!start || nu - start > UNDERAGENT_DOD_MS) { doda++; continue; }
    const finns = rorSig.get(u.projekt);
    if (finns) {
      finns.modell = finns.modell || u.modell;
      if (!finns.vad) finns.vad = u.uppdrag;
      if (finns.lage === 'kör') finns.lage = `kör ${alder(u.start, nu)}`;
      continue;
    }
    rorSig.set(u.projekt, { slug: u.projekt, vad: u.uppdrag, lage: `kör ${alder(u.start, nu)}`, sedan: u.start, gorNu: '', modell: u.modell });
  }
  for (const s of tolkaSessioner(las(path.join('status', 'sessioner.json')))) {
    if (rorSig.has(s.projekt)) continue;
    rorSig.set(s.projekt, { slug: s.projekt, vad: s.titel, lage: 'session', sedan: s.senast, gorNu: '', modell: '' });
  }
  const journal = tolkaJournal(las(path.join('status', 'journal.jsonl')));
  const orapporterade = journal.filter((j) => j.orapporterad && String(j.tid).slice(0, 10) === idagIso);
  for (const j of orapporterade) {
    const finns = rorSig.get(j.projekt);
    if (finns) { finns.orapporterad = true; continue; }
    rorSig.set(j.projekt, { slug: j.projekt, vad: 'run without a final report', lage: 'orapporterad', sedan: j.tid, gorNu: '', modell: '', orapporterad: true });
  }

  // Git once per project, used by STALLED and the project list in radar.json.
  // A project whose category has machine lives on another computer: no git, no folder, no Servers here.
  const loggPer = new Map(register.map((p) => [p.slug, p.kategori.machine ? [] : gitLogg(p.mapp, config)]));
  const gitPer = new Map([...loggPer].map(([slug, logg]) => [slug, logg.length ? logg[0].tid.slice(0, 10) : '']));

  // STALLED: state now/next, git older than STILL_DAGAR. Projects without git here (no folder) are skipped.
  const starStill = [];
  for (const p of register) {
    if (!['nu', 'nästa'].includes(p.lage)) continue;
    if (rorSig.has(p.slug)) continue;
    const senast = gitPer.get(p.slug);
    if (!senast) continue;
    const dagar = dagarMellan(senast, idagIso);
    if (dagar === null || dagar <= STILL_DAGAR) continue;
    starStill.push({ mapp: p.mapp, slug: p.slug, senast, dagar, status: statusText(las(path.join('status', `${p.slug}.md`))) });
  }
  starStill.sort((a, b) => b.dagar - a.dagar);

  const oppnaBeslut = besluten.filter((b) => b.status === 'oppen');
  const projekt = register.map((p) => {
    const text = las(path.join('status', `${p.slug}.md`));
    const huvud = tolkaStatusHuvud(text);
    const falt = lasRegister.parseBulletFields(text);
    // rooflow.json projects.<slug>.folder first, then <projectsDir>/<Folder>.
    const annanDator = !!p.kategori.machine;
    const dir = annanDator ? '' : lasRegister.repoFinns(ROOT, config, p.mapp) || '';
    const korMapp = annanDator ? '' : lasRegister.runFolder(ROOT, config, p.slug, dir);
    const namner = (s) => namnerProjekt(s, p);
    return {
      mapp: p.mapp,
      slug: p.slug,
      lage: p.lage,
      dir,
      statusFil: text ? path.join(ROOT, 'status', `${p.slug}.md`) : '',
      agentLage: huvud ? huvud.lage : '',
      lageText: huvud ? '' : falt['Läge'] || falt['State'] || '',
      gorNu: huvud ? huvud.gorNu : '',
      nastaSteg: falt['Nästa steg'] || falt['Next step'] || '',
      uppdaterad: huvud ? huvud.uppdaterad : falt['Uppdaterad'] || falt['Updated'] || '',
      sistRort: gitPer.get(p.slug) || '',
      gitLogg: loggPer.get(p.slug) || [],
      beslut: oppnaBeslut.filter((b) => (b.projekt && b.projekt.toLowerCase() === p.slug) || namner(b.rubrik)).map((b) => b.id || b.rubrik),
      loften: loften.filter((l) => namner(`${l.vem} ${l.vad}`)).map((l) => `${kortDatum(l.datum)} ${l.vem}: ${l.vad}`),
      kor: korMapp ? lasKorJson(korMapp) : [],
      rapporter: journal.filter((j) => j.projekt === p.slug).slice(-RAPPORTER_PER_PROJEKT).reverse()
        .map((j) => ({ tid: j.tid, id: j.id, rapport: j.rapport, orapporterad: j.orapporterad, owner: j.owner, blockerat: j.blockerat })),
      docs: dir ? projektDocs(dir) : [],
    };
  });

  return {
    nu,
    idagIso,
    usage,
    forbrukning: tolkaUsageSenast(las('usage.md')),
    beslut: oppnaBeslut,
    bordlagda: besluten.filter((b) => b.status === 'bordlagd'),
    idag,
    loften,
    vantar,
    rorSig: [...rorSig.values()].map((r) => ({ ...r, namn: projektNamn(r.slug, register) })),
    korNu: korNuNamn(statusHuvud, nu, new Set([...rorSig.values()].filter((r) => r.behover).map((r) => r.slug))),
    doda,
    starStill,
    inkorg,
    filnamn: { inkorg: fmt.filnamn(ROOT, 'inkorg') },
    projekt,
    skills: tolkaKommandon(las('commands.md')),
    agenter: {
      underagenter: tolkaUnderagentHistorik(las(fmt.filnamn(ROOT, 'underagenter'))).slice(-AGENTER_SENASTE).reverse(),
      rapporter: journal.slice(-AGENTER_SENASTE).reverse().map((j) => ({
        tid: j.tid, id: j.id, projekt: j.projekt, rapport: j.rapport, orapporterad: j.orapporterad, owner: j.owner, blockerat: j.blockerat,
      })),
    },
  };
}

// --- delta ---

function antalPerSektion(d) {
  return {
    behover: d.beslut.length,
    idag: d.idag.saker.filter((s) => !s.klar).length,
    lovat: d.loften.length,
    vantar: d.vantar.length,
    rorsig: d.rorSig.length,
    starstill: d.starStill.length,
    inkorg: d.inkorg.antal,
  };
}

// The baseline is the first run of the day (or the latest --nollstall). Plus = sum of increases, minus = decreases.
function raknaDelta(antal, forra, idagIso, nollstall) {
  if (!forra || forra.datum !== idagIso || nollstall || !forra.antal) {
    return { plus: 0, minus: 0, sedan: null };
  }
  let plus = 0;
  let minus = 0;
  for (const k of Object.keys(antal)) {
    const diff = antal[k] - (forra.antal[k] || 0);
    if (diff > 0) plus += diff;
    else minus -= diff;
  }
  return { plus, minus, sedan: forra.tid };
}

// --- rendering ---

function alternativKort(b) {
  if (!b.alternativ.length) return '';
  const delar = b.alternativ.slice(0, 3).map((a) => `${a.bokstav}) ${kapa(a.text, 14)}`);
  const forslag = b.alternativ.find((a) => a.forslag);
  return delar.join('  ') + (forslag ? `  → ${T.suggested} ${forslag.bokstav}` : '');
}

function rendera(d, delta) {
  const rader = [];
  const nu = d.nu;
  const usageText = d.usage ? `${T.week} ${d.usage.vecka} % · 5h ${d.usage.femh} %` : '';
  const deltaText = delta.sedan ? `${T.since} ${delta.sedan}: +${delta.plus} −${delta.minus}` : '';
  rader.push((`RADAR ${VECKODAGAR()[nu.getDay()]} ${kortDatum(d.idagIso)} ${klockslag(nu)}`.padEnd(29) + usageText.padEnd(27) + deltaText).trimEnd());
  rader.push('');

  const sektion = (rubrik, lista, maxRader, rad, tomText) => {
    rader.push(`${rubrik} (${lista.length})`);
    if (!lista.length) {
      if (tomText) rader.push(`  ${tomText}`);
      return;
    }
    for (const x of lista.slice(0, maxRader)) rader.push('  ' + rad(x).replace(/\s+$/, ''));
    if (lista.length > maxRader) rader.push(`  … ${T.more} ${lista.length - maxRader}`);
  };

  sektion(T.needsYou, d.beslut, 8, (b) => {
    const vem = b.blockerar ? `${T.blocks} ${b.blockerar}` : b.fragar;
    return `${(b.id || 'B?').padEnd(4)} ${kolumn(b.rubrik, 40)} ${alder(b.datum, nu).padEnd(6)} ${kolumn(vem, 24)} ${alternativKort(b)}`;
  }, T.nothingWaits);

  const idagRubrik = d.idag.saker.length
    ? `${T.todayHead} (${T.doneOf(d.idag.saker.filter((s) => s.klar).length, d.idag.saker.length)}${d.idag.datum && d.idag.datum !== d.idagIso ? `, ${T.written} ${kortDatum(d.idag.datum)}` : ''})`
    : `${T.todayHead} (0)`;
  rader.push(idagRubrik);
  if (!d.idag.saker.length) rader.push(`  ${T.nothingChosen}`);
  for (const s of d.idag.saker) rader.push(`  [${s.klar ? 'x' : ' '}] ${kapa(s.text, 90)}`);

  sektion(T.promised, d.loften, 6, (l) => {
    const mark = l.nar ? '!' : '.';
    const vem = l.mottagareSaknas ? T.recipientMissing : `${l.vem}:`;
    return `${mark} ${kolumn(`${vem} ${l.vad}`, 52)} ${veckodagDatum(l.datum).padEnd(10)} ${l.nar}`;
  }, T.noPromises);

  sektion(T.waiting, d.vantar, 4, (v) => `${kolumn(`${v.vem}: ${v.vad}`, 52)} ${T.since} ${kortDatum(v.datum)}`, '');

  sektion(T.inMotion, d.rorSig, 8, (r) => {
    const flagga = r.orapporterad && r.lage !== 'orapporterad' ? ` · ${T.unreported}` : '';
    return `${kolumn(r.namn, 16)} ${kolumn(r.vad, 40)} ${kolumn(r.lage + flagga, 22)}${r.modell ? ' ' + r.modell : ''}`;
  }, T.noAgent);
  if (d.doda) rader.push(`  ${T.dead(d.doda)}`);

  sektion(T.stalled, d.starStill, 5, (s) => `${kolumn(s.mapp, 16)} ${T.lastTouched} ${kortDatum(s.senast).padEnd(6)} ${s.status ? T.status + ': ' + kapa(s.status, 50) : ''}`, '');

  const fot = [`${T.inbox} ${d.inkorg.antal}`];
  if (d.inkorg.aldsta) fot.push(`${T.oldest} ${kortDatum(d.inkorg.aldsta)}`);
  if (d.bordlagda.length) fot.push(`${T.parked} ${d.bordlagda.map((b) => b.id || 'B?').join(' ')}`);
  rader.push(fot.join(' · '));

  if (rader.length > MAX_RADER) {
    rader.length = MAX_RADER - 1;
    rader.push(T.cut);
  }
  return rader.join('\n') + '\n';
}

function main() {
  const ROOT = root();
  T = TEXT[loadConfig(ROOT).config.language] || TEXT.en;
  const dryRun = process.argv.includes('--dry-run');
  const nu = new Date();
  const nollstall = process.argv.includes('--nollstall') || process.argv.includes('--reset');
  const d = samla(nu);
  const antal = antalPerSektion(d);
  const forraFil = path.join(ROOT, 'status', 'radar-forra.json');
  let forra = null;
  try { forra = JSON.parse(fs.readFileSync(forraFil, 'utf8')); } catch { forra = null; }
  const delta = raknaDelta(antal, forra, d.idagIso, nollstall);
  const text = rendera(d, delta);
  if (dryRun) {
    process.stdout.write(text);
    return;
  }
  fs.writeFileSync(path.join(ROOT, 'radar.md'), text, 'utf8');
  fs.mkdirSync(path.join(ROOT, 'status'), { recursive: true });
  if (!delta.sedan) {
    fs.writeFileSync(forraFil, JSON.stringify({ datum: d.idagIso, tid: klockslag(nu), antal }, null, 2) + '\n', 'utf8');
  }
  // Structured copy for the panel mod, so that it does not have to parse the source files itself.
  const json = {
    format: FORMAT,
    genererad: `${d.idagIso} ${klockslag(nu)}`,
    antal,
    delta,
    usage: d.usage,
    forbrukning: d.forbrukning,
    beslut: d.beslut.map((b) => ({ ...b, alder: alder(b.datum, nu) })),
    bordlagda: d.bordlagda.map((b) => b.id || b.rubrik),
    idag: d.idag,
    loften: d.loften,
    vantar: d.vantar,
    rorSig: d.rorSig,
    vantarPa: vantarPer(d.rorSig),
    korNu: d.korNu,
    starStill: d.starStill,
    inkorg: d.inkorg,
    filnamn: d.filnamn,
    projekt: d.projekt,
    skills: d.skills,
    agenter: d.agenter,
  };
  fs.mkdirSync(path.join(ROOT, 'status'), { recursive: true });
  fs.writeFileSync(path.join(ROOT, 'status', 'radar.json'), JSON.stringify(json, null, 2) + '\n', 'utf8');
  if (!process.argv.includes('--tyst') && !process.argv.includes('--quiet')) process.stdout.write(text);
}

module.exports = {
  FORMAT,
  tolkaBeslut,
  tolkaAlternativ,
  tolkaLoften,
  tolkaIdag,
  tolkaStatusHuvud,
  korNuNamn,
  vantarKategori,
  vantarPer,
  tolkaUnderagenter,
  tolkaSessioner,
  tolkaJournal,
  tolkaInkorg,
  tolkaUsage,
  tolkaUsageSenast,
  tolkaGitLogg,
  tolkaUnderagentHistorik,
  tolkaKommandon,
  namnerProjekt,
  alder,
  raknaDelta,
  antalPerSektion,
  rendera,
  samla,
};

if (require.main === module) main();
