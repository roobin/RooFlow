#!/usr/bin/env node
// /doctor: checks the RooFlow installation. Read-only, changes nothing. One line per check:
// "OK", "WARNING" or "ERROR" followed by the check and what deviates. Exits with code 1 if anything is an ERROR.
//
//   node scripts/doctor.js
//
// Scheduled jobs cannot be read by a script: the skill checks them separately.
// The password check prints only file and line number, never what matched.
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');
const fmt = require('./format');
const register = require('./register');
const { hittaClaude, windowsSokvag } = require('./claude-cli');
const { requireRoot, loadConfig } = require('./root');
const pluginInstall = require('./plugin-install');

const MIN = 60 * 1000;
const DAG = 24 * 60 * MIN;

// The text follows "language" in rooflow.json, like radar.md (scripts/radar.js). The level words OK, WARNING and ERROR stay
// English in every language: the skill and the tests read them. Error texts from root.js and categories.js stay English.
const TEXT = {
  en: {
    radarMissing: 'status/radar.json is missing (the mod or `node scripts/radar.js` writes it)',
    radarInvalid: 'status/radar.json is not valid JSON',
    radarFormat: (f) => `status/radar.json has format ${f}, expected 1`,
    radarOld: (min) => `status/radar.json is ${min} min old (limit 15). The mod is not running or has stopped`,
    radarOk: (min) => `status/radar.json is ${min} min old, format 1`,
    stuck: (n, lista) => `${n} status file(s) say running but are untouched for over 24 h: ${lista}`,
    notStuck: (n) => `no status files stuck on running for over 24 h (${n} status files with a header)`,
    oldAsking: (n, lista) => `${n} status file(s) say asking for over 7 days with no Needs and no open B-id: ${lista}`,
    noOldAsking: 'no old asking states without Needs or an open B-id',
    noJournal: 'no status/journal.jsonl yet (no runs to check)',
    noId: '(no id)',
    unreported: (n, lista) => `${n} unreported runs in the last 7 days: ${lista}`,
    noUnreported: 'no unreported runs in the last 7 days',
    fileMissing: (f) => `${f} is missing`,
    noNextId: (f) => `${f} has no "Next Id"/"Nästa Id" line`,
    nextIdLow: (n, f, max) => `Next Id is B${n} but the highest Id in ${f} and the archive is B${max}`,
    nextIdOk: (n, max) => `Next Id B${n} is greater than the highest Id B${max}`,
    duplicates: (lista) => `duplicate Ids: ${lista}`,
    noDuplicates: 'no duplicate B-ids',
    bom: (n, lista) => `BOM in ${n} file(s): ${lista}`,
    noBom: (n) => `no BOM in .md files (${n} files)`,
    mojibake: (n, lista) => `mojibake in ${n} file(s): ${lista}`,
    noMojibake: 'no mojibake in .md files',
    noRepoChosen: (b) => `not a git repo (backup ${b}, no local history chosen): no tracked files to check for passwords`,
    noRepoBackupGit: 'rooflow.json says backup git, but the notebook is not a git repo: nothing is backed up. Run /rooflow-setup again',
    noRepo: 'not a git repo, cannot check tracked files for passwords',
    passwords: (n, lista) => `password-like content in ${n} tracked file(s) (no text shown, review yourself): ${lista}`,
    noPasswords: (n) => `no password-like rows in ${n} tracked logs and jsonl files`,
    configMissing: 'rooflow.json is missing (defaults apply; /rooflow-setup creates it)',
    restartNoUrl: (lista) => `rooflow.json: projects with restart but no url (no wait for a response): ${lista}`,
    configOk: (n) => `rooflow.json is valid (${n} projects with settings)`,
    noRegister: 'no projects.md, no project folders to check',
    noFolder: (n, lista) => `${n} project(s) in state now in projects.md have no folder on disk: ${lista}. Set rooflow.json projects.<slug>.folder (the slug is the Folder column in lower case)`,
    foldersOk: (n) => `every project in state now in projects.md has a folder (${n} projects)`,
    noRunJson: (lista) => `rooflow.json: projects whose run folder has no run.json: ${lista}`,
    privateShared: (lista) => `private project(s) in rooflow.json team.sharedRepos: ${lista}. A private category is never shared; remove them from sharedRepos`,
    noCategories: 'rooflow.json has no "categories": the default applies (archive is hidden). /rooflow-setup proposes a set',
    unknownCategories: (lista) => `projects.md has categories that are not in rooflow.json categories: ${lista}. Add them (key or label) or rename them in projects.md`,
    categoriesOk: (n) => `every category in projects.md is in rooflow.json categories (${n} categories)`,
    noProjects: (n, etiketter) => `no projects in projects.md yet; ${n} categories defined: ${etiketter}`,
    cliMissing: 'no Claude Code CLI found (npm, ~/.local/bin or PATH): agents cannot start. Install the CLI or set claudeCli in rooflow.json',
    cliGone: (p) => `rooflow.json claudeCli '${p}' does not exist`,
    cliApp: (p, kalla) => `'${p}' (${kalla}) looks like the desktop app, not the Claude Code CLI: agents would die without an answer. Install the CLI or set claudeCli in rooflow.json`,
    staleLock: (lista) => `stale lock file: ${lista}. Writers remove locks older than 60 s by themselves on the next write`,
    noLock: 'no lock file older than 60 s',
    pluginSame: (k, h) => `plugin ${k} is installed at the source's HEAD (${h})`,
    pluginOlder: (n, h) => `is ${n === null ? 'some' : n} commit(s) older than HEAD ${h} in its local source`,
    pluginDiffers: (h) => `differs from HEAD ${h} in its local source`,
    pluginOld: (k, scope, sha, hur, av, pa) => `plugin ${k} (${scope}) is installed at ${sha}, which ${hur}. "claude plugin update" does nothing while the version in plugin.json is unchanged. From the notebook folder run: ${av}, then: ${pa}, and start a new session`,
    scheduled: '-  scheduled jobs: cannot be read by a script, the skill checks them separately',
    total: (o, w, e) => `Total: ${o} OK, ${w} WARNING, ${e} ERROR`,
  },
  sv: {
    radarMissing: 'status/radar.json saknas (modden eller `node scripts/radar.js` skriver den)',
    radarInvalid: 'status/radar.json är inte giltig JSON',
    radarFormat: (f) => `status/radar.json har format ${f}, väntat 1`,
    radarOld: (min) => `status/radar.json är ${min} min gammal (gräns 15). Modden kör inte eller har stannat`,
    radarOk: (min) => `status/radar.json är ${min} min gammal, format 1`,
    stuck: (n, lista) => `${n} statusfil(er) säger running men är orörda i över 24 h: ${lista}`,
    notStuck: (n) => `inga statusfiler har fastnat på running i över 24 h (${n} statusfiler med huvud)`,
    oldAsking: (n, lista) => `${n} statusfil(er) säger asking i över 7 dagar utan Needs och utan öppet B-id: ${lista}`,
    noOldAsking: 'inga gamla asking-lägen utan Needs eller öppet B-id',
    noJournal: 'ingen status/journal.jsonl än (inga körningar att kontrollera)',
    noId: '(inget id)',
    unreported: (n, lista) => `${n} orapporterade körningar de senaste 7 dagarna: ${lista}`,
    noUnreported: 'inga orapporterade körningar de senaste 7 dagarna',
    fileMissing: (f) => `${f} saknas`,
    noNextId: (f) => `${f} har ingen rad "Next Id"/"Nästa Id"`,
    nextIdLow: (n, f, max) => `Next Id är B${n} men högsta Id i ${f} och arkivet är B${max}`,
    nextIdOk: (n, max) => `Next Id B${n} är större än högsta Id B${max}`,
    duplicates: (lista) => `dubblerade Id: ${lista}`,
    noDuplicates: 'inga dubblerade B-id',
    bom: (n, lista) => `BOM i ${n} fil(er): ${lista}`,
    noBom: (n) => `ingen BOM i .md-filer (${n} filer)`,
    mojibake: (n, lista) => `mojibake i ${n} fil(er): ${lista}`,
    noMojibake: 'ingen mojibake i .md-filer',
    noRepoChosen: (b) => `inget git-repo (backup ${b}, lokal historik valdes bort): inga spårade filer att söka lösenord i`,
    noRepoBackupGit: 'rooflow.json säger backup git, men anteckningsboken är inget git-repo: inget säkerhetskopieras. Kör /rooflow-setup igen',
    noRepo: 'inget git-repo, kan inte söka lösenord i spårade filer',
    passwords: (n, lista) => `lösenordsliknande innehåll i ${n} spårad(e) fil(er) (ingen text visas, granska själv): ${lista}`,
    noPasswords: (n) => `inga lösenordsliknande rader i ${n} spårade loggar och jsonl-filer`,
    configMissing: 'rooflow.json saknas (standardvärden gäller; /rooflow-setup skapar den)',
    restartNoUrl: (lista) => `rooflow.json: projekt med restart men utan url (ingen väntan på svar): ${lista}`,
    configOk: (n) => `rooflow.json är giltig (${n} projekt med inställningar)`,
    noRegister: 'ingen projects.md, inga projektmappar att kontrollera',
    noFolder: (n, lista) => `${n} projekt i läget now i projects.md saknar mapp på disk: ${lista}. Sätt rooflow.json projects.<slug>.folder (sluggen är kolumnen Folder med gemener)`,
    foldersOk: (n) => `alla projekt i läget now i projects.md har en mapp (${n} projekt)`,
    noRunJson: (lista) => `rooflow.json: projekt vars run-mapp saknar run.json: ${lista}`,
    privateShared: (lista) => `privata projekt i rooflow.json team.sharedRepos: ${lista}. En privat kategori delas aldrig; ta bort dem ur sharedRepos`,
    noCategories: 'rooflow.json har inga "categories": standarden gäller (archive är dold). /rooflow-setup föreslår en uppsättning',
    unknownCategories: (lista) => `projects.md har kategorier som saknas i rooflow.json categories: ${lista}. Lägg till dem (nyckel eller etikett) eller byt namn i projects.md`,
    categoriesOk: (n) => `alla kategorier i projects.md finns i rooflow.json categories (${n} kategorier)`,
    noProjects: (n, etiketter) => `inga projekt i projects.md än; ${n} kategorier definierade: ${etiketter}`,
    cliMissing: 'ingen Claude Code CLI hittad (npm, ~/.local/bin eller PATH): agenter kan inte starta. Installera CLI:t eller sätt claudeCli i rooflow.json',
    cliGone: (p) => `rooflow.json claudeCli '${p}' finns inte`,
    cliApp: (p, kalla) => `'${p}' (${kalla}) ser ut som skrivbordsappen, inte Claude Code CLI: agenter skulle dö utan svar. Installera CLI:t eller sätt claudeCli i rooflow.json`,
    staleLock: (lista) => `kvarglömd låsfil: ${lista}. Skrivare tar själva bort lås äldre än 60 s vid nästa skrivning`,
    noLock: 'ingen låsfil äldre än 60 s',
    pluginSame: (k, h) => `pluginet ${k} är installerat på källans HEAD (${h})`,
    pluginOlder: (n, h) => `är ${n === null ? 'några' : n} commit(s) äldre än HEAD ${h} i sin lokala källa`,
    pluginDiffers: (h) => `skiljer sig från HEAD ${h} i sin lokala källa`,
    pluginOld: (k, scope, sha, hur, av, pa) => `pluginet ${k} (${scope}) är installerat på ${sha}, som ${hur}. "claude plugin update" gör ingenting så länge versionen i plugin.json är oförändrad. Kör från anteckningsboksmappen: ${av}, sedan: ${pa}, och starta en ny session`,
    scheduled: '-  schemalagda jobb: kan inte läsas av ett skript, skillen kontrollerar dem separat',
    total: (o, w, e) => `Summa: ${o} OK, ${w} WARNING, ${e} ERROR`,
  },
};

const ROT = requireRoot();
const NU = Date.now();
const T = TEXT[loadConfig(ROT).config.language] || TEXT.en;

const rader = [];
const ok = (t) => rader.push(['OK', t]);
const varna = (t) => rader.push(['WARNING', t]);
const fel = (t) => rader.push(['ERROR', t]);

function las(rel) {
  try { return fs.readFileSync(path.join(ROT, rel), 'utf8'); } catch { return null; }
}

function lista(rel, slutar) {
  try { return fs.readdirSync(path.join(ROT, rel)).filter((f) => f.endsWith(slutar)).map((f) => path.join(rel, f)); } catch { return []; }
}

function lokaltDatum(s) {
  const m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/);
  if (!m) return null;
  return new Date(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0)).getTime();
}

function huvud(text) {
  const ut = { lage: '', gorNu: '', uppdaterad: '', behover: '', uppdrag: '', projekt: '' };
  for (const rad of text.split(/\r?\n/).slice(0, 10)) {
    let m = rad.match(fmt.statusRadRe('lage'));
    if (m) { ut.lage = fmt.normaliseraLage(m[1]); continue; }
    for (const k of ['gorNu', 'uppdaterad', 'behover', 'uppdrag', 'projekt']) {
      m = rad.match(fmt.statusRadRe(k));
      if (m) { ut[k] = m[1].trim(); break; }
    }
  }
  return ut;
}

// Decision blocks from a file: [{ id, uppdrag, projekt }]. The Id line is "- Id: B<n>" in both languages.
function beslutsblock(text) {
  const ut = [];
  let nu = null;
  for (const rad of text.split(/\r?\n/)) {
    const id = rad.match(/^- Id:\s*B(\d+)/);
    if (id) { nu = { id: Number(id[1]), uppdrag: '', projekt: '' }; ut.push(nu); continue; }
    if (rad.startsWith('## ')) { nu = null; continue; }
    if (!nu) continue;
    for (const k of ['uppdrag', 'projekt']) {
      const m = rad.match(new RegExp('^- (' + fmt.BESLUT[k].join('|') + '):\\s*(.+)$'));
      if (m) nu[k] = m[2].trim();
    }
  }
  return ut;
}

// 1. radar.json
function radarJson() {
  const fil = path.join(ROT, 'status', 'radar.json');
  let st;
  try { st = fs.statSync(fil); } catch { return fel(T.radarMissing); }
  const min = Math.round((NU - st.mtimeMs) / MIN);
  let o = null;
  try { o = JSON.parse(fs.readFileSync(fil, 'utf8')); } catch { return fel(T.radarInvalid); }
  if (o.format !== 1) return varna(T.radarFormat(JSON.stringify(o.format)));
  if (min > 15) return varna(T.radarOld(min));
  ok(T.radarOk(min));
}

// 2 och 3. statusfiler
function statusfiler(besluten) {
  const oppna = besluten.oppna;
  let fastKor = [];
  let gammalFraga = [];
  let antal = 0;
  for (const rel of lista('status', '.md')) {
    const slug = path.basename(rel, '.md');
    if (slug.startsWith('_')) continue;
    const h = huvud(las(rel) || '');
    if (!h.lage) continue;
    antal++;
    const upp = lokaltDatum(h.uppdaterad);
    if (h.lage === 'kör' && upp && NU - upp > DAG) fastKor.push(`${slug} (${Math.round((NU - upp) / DAG * 10) / 10} d)`);
    if (h.lage === 'frågar' && upp && NU - upp > 7 * DAG && !h.behover) {
      const harB = oppna.some((b) => (b.uppdrag && b.uppdrag.toLowerCase() === slug) || (!b.uppdrag && b.projekt && b.projekt.toLowerCase().includes(slug)));
      if (!harB) gammalFraga.push(slug);
    }
  }
  if (fastKor.length) varna(T.stuck(fastKor.length, fastKor.join(', ')));
  else ok(T.notStuck(antal));
  if (gammalFraga.length) varna(T.oldAsking(gammalFraga.length, gammalFraga.join(', ')));
  else ok(T.noOldAsking);
}

// 4. journal
function journal() {
  const text = las(path.join('status', 'journal.jsonl'));
  if (text === null) return ok(T.noJournal);
  const gamla = [];
  for (const rad of text.split(/\r?\n/)) {
    if (!rad.trim()) continue;
    let o;
    try { o = JSON.parse(rad); } catch { continue; }
    const j = fmt.journalRad(o);
    const t = lokaltDatum(j.tid);
    if (t && NU - t <= 7 * DAG && fmt.arOrapporterad(j.rapport)) gamla.push(j.id || T.noId);
  }
  if (gamla.length) varna(T.unreported(gamla.length, gamla.slice(0, 5).join(', ') + (gamla.length > 5 ? ' …' : '')));
  else ok(T.noUnreported);
}

// 5. Next Id
function nastaId() {
  const fil = fmt.filnamn(ROT, 'beslut');
  const text = las(fil);
  if (text === null) return varna(T.fileMissing(fil));
  const m = text.match(fmt.nastaIdRe());
  const alla = beslutsblock(text).map((b) => b.id);
  for (const rel of lista(fmt.filnamn(ROT, 'arkiv'), '.md')) {
    if (/(^|[\\/])(beslut|decisions)-\d{4}-\d{2}\.md$/.test(rel)) alla.push(...beslutsblock(las(rel) || '').map((b) => b.id));
  }
  if (!m) return fel(T.noNextId(fil));
  const nasta = Number(m[1]);
  const max = alla.length ? Math.max(...alla) : 0;
  const dubbletter = [...new Set(alla.filter((id, i) => alla.indexOf(id) !== i))];
  if (nasta <= max) fel(T.nextIdLow(nasta, fil, max));
  else ok(T.nextIdOk(nasta, max));
  if (dubbletter.length) fel(T.duplicates(dubbletter.slice(0, 8).map((i) => 'B' + i).join(', ')));
  else ok(T.noDuplicates);
}

// 6. BOM and mojibake in .md files in the root, status/ and notes/
const MOJIBAKE = new RegExp(['\u00c3\u00a4', '\u00c3\u00b6', '\u00c3\u00a5', '\u00c3\u201e', '\u00c3\u2013', '\u00e2\u20ac'].join('|'));
function kodning() {
  const bom = [];
  const mojibake = [];
  const mappar = ['.', 'status', fmt.filnamn(ROT, 'tankar'), 'notes'];
  const sedda = new Set();
  for (const mapp of mappar) {
    for (const rel of lista(mapp, '.md')) {
      const norm = path.normalize(rel);
      if (sedda.has(norm)) continue;
      sedda.add(norm);
      let buf;
      try { buf = fs.readFileSync(path.join(ROT, rel)); } catch { continue; }
      if (buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) bom.push(rel);
      const rad = buf.toString('utf8').split(/\r?\n/).findIndex((r) => MOJIBAKE.test(r));
      if (rad >= 0) mojibake.push(`${rel}:${rad + 1}`);
    }
  }
  if (bom.length) fel(T.bom(bom.length, bom.slice(0, 5).join(', ')));
  else ok(T.noBom(sedda.size));
  if (mojibake.length) fel(T.mojibake(mojibake.length, mojibake.slice(0, 5).join(', ')));
  else ok(T.noMojibake);
}

// 7. Password-like content in tracked logs and jsonl. Never prints what matched.
const HEMLIGT = /(password|passwd|pwd|lösenord|secret|apikey|api_key|accountkey|sharedaccesskey)\\*["']?\s*[:=]\s*\\*["']?([^\s"'\\;,<>{}()$%*`]{8,})/i;
const PLATSHALLARE = /^(xxx|\*{3}|\.\.\.|…|<|\[|\$|%|your|example|exempel|secret|password|lösenord|null|true|false|undefined|encrypted:|krypterad:)/i;
// The value must look random: at least 10 characters with both a digit and a letter, and not a code name (dots, underscores).
function ser_hemlig_ut(v) {
  return v.length >= 10 && /[0-9]/.test(v) && /[A-Za-z]/.test(v) && !/[._]/.test(v);
}
function hemligheter() {
  let spårade;
  try {
    spårade = execFileSync('git', ['-C', ROT, 'ls-files', '-z'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] }).split('\0').filter(Boolean);
  } catch {
    // Backup none or folder means setup asked about local history and the owner said no: no repo is a choice, not a fault.
    const backup = loadConfig(ROT).config.backup.type;
    if (backup === 'none' || backup === 'folder') return ok(T.noRepoChosen(backup));
    if (backup === 'git') return varna(T.noRepoBackupGit);
    return varna(T.noRepo);
  }
  const kand = spårade.filter((f) => /^status\/logg\//.test(f) || f.endsWith('.jsonl') || f === 'rooflow.json');
  const traffar = [];
  for (const rel of kand) {
    let text;
    try { text = fs.readFileSync(path.join(ROT, rel), 'utf8'); } catch { continue; }
    const r = text.split(/\r?\n/);
    for (let i = 0; i < r.length; i++) {
      const m = r[i].match(HEMLIGT);
      if (m && !PLATSHALLARE.test(m[2]) && ser_hemlig_ut(m[2])) { traffar.push(`${rel}:${i + 1}`); break; }
    }
  }
  if (traffar.length) varna(T.passwords(traffar.length, traffar.slice(0, 6).join(', ') + (traffar.length > 6 ? ' …' : '')));
  else ok(T.noPasswords(kand.length));
}

// 8. rooflow.json
function installningar() {
  const r = loadConfig(ROT);
  if (!r.exists) return varna(T.configMissing);
  if (r.error) return fel(`rooflow.json: ${r.error}`);
  const utanRestart = Object.entries(r.config.projects).filter(([, v]) => v.restart && !v.url).map(([k]) => k);
  if (utanRestart.length) return varna(T.restartNoUrl(utanRestart.join(', ')));
  ok(T.configOk(Object.keys(r.config.projects).length));
}

// 9. Project folders: every project in state now should have a folder that exists (rooflow.json projects.<slug>.folder,
// otherwise <projectsDir>/<Folder>). A missing folder means no git log, no files and no Servers in the panel.
// Projects in next, waiting, parked or a dash may lack one, and so may projects whose category has machine (they live on
// another computer) or hidden. The Own repo column does not matter: a folder and a repository are different things.
function projektmappar() {
  const text = las(fmt.filnamn(ROT, 'projektregister'));
  const config = loadConfig(ROT).config;
  const rader = register.registerRows(text || '', config.categories);
  const granskas = rader.filter((p) => p.lage === 'nu' && !p.kategori.machine && !p.kategori.hidden);
  const saknas = granskas.filter((p) => !register.repoFinns(ROT, config, p.mapp)).map((p) => p.slug);
  if (text === null) {
    ok(T.noRegister);
  } else if (saknas.length) {
    varna(T.noFolder(saknas.length, saknas.join(', ')));
  } else {
    ok(T.foldersOk(granskas.length));
  }
  kategorier(text, config, rader);
  const utanRunJson = Object.entries(config.projects)
    .filter(([, v]) => v.run && !fs.existsSync(path.join(path.resolve(ROT, v.run), 'run.json')))
    .map(([k]) => k);
  if (utanRunJson.length) varna(T.noRunJson(utanRunJson.join(', ')));
}

// 9b. Categories: every category in projects.md should be in rooflow.json "categories" (key or label). Only checked when the
// key is set: without it only the default archive is known, and older notebooks would warn on every row.
// A private project must never be in team.sharedRepos.
function kategorier(text, config, rader) {
  if (text === null) return;
  const delade = new Set(config.team.sharedRepos.map((s) => s.toLowerCase()));
  const privataDelade = rader.filter((p) => p.kategori.private && delade.has(p.slug)).map((p) => p.slug);
  if (privataDelade.length) varna(T.privateShared(privataDelade.join(', ')));
  if (!config.categoriesSet) return ok(T.noCategories);
  if (!rader.length) {
    const etiketter = Object.values(config.categories).map((k) => k.label);
    return ok(T.noProjects(etiketter.length, etiketter.join(', ')));
  }
  const okanda = [...new Set(rader.filter((p) => !p.kategori.blank && !p.kategori.known).map((p) => p.kategori.label))];
  if (okanda.length) varna(T.unknownCategories(okanda.join(', ')));
  else ok(T.categoriesOk(Object.keys(config.categories).length));
}

// 10. The Claude Code CLI that agent.sh starts. On Windows `claude` on PATH is often the desktop app, and an agent started
// with it dies at once without an answer. Told by the path only (scripts/claude-cli.js); nothing is started.
function claudeCli() {
  const config = loadConfig(ROT).config;
  const r = hittaClaude({ claudeCli: config.claudeCli });
  if (r.kind === 'missing') return varna(T.cliMissing);
  if (r.source === 'config' && /[\\/]/.test(r.path) && !fs.existsSync(path.resolve(ROT, windowsSokvag(r.path)))) return varna(T.cliGone(r.path));
  if (r.kind === 'app') return varna(T.cliApp(r.path, r.source));
  ok(`Claude Code CLI: ${r.path} (${r.source === 'config' ? 'rooflow.json claudeCli' : r.source})`);
}

// 11. lock files
function las_() {
  const gamla = [];
  for (const rel of ['.', 'status']) {
    for (const f of lista(rel, '.lock')) {
      try {
        const alder = NU - fs.statSync(path.join(ROT, f)).mtimeMs;
        if (alder > 60 * 1000) gamla.push(`${f} (${Math.round(alder / 1000)} s)`);
      } catch { /* gone in the meantime */ }
    }
  }
  if (gamla.length) varna(T.staleLock(gamla.join(', ')));
  else ok(T.noLock);
}

// 12. The installed plugin against its local source repo. Only for someone who develops the plugin from a local folder;
// everyone else gets no line at all. ROOFLOW_PLUGINS_DIR replaces ~/.claude/plugins in the tests.
function pluginVersion() {
  const pluginsDir = process.env.ROOFLOW_PLUGINS_DIR || path.join(os.homedir(), '.claude', 'plugins');
  let namn = 'rooflow';
  try { namn = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '.claude-plugin', 'plugin.json'), 'utf8')).name || namn; } catch { /* default */ }
  const r = pluginInstall.kontrollera({ pluginsDir, rot: ROT, pluginNamn: namn });
  if (r.kind === 'skip') return;
  const kort = (sha) => sha.slice(0, 7);
  if (r.kind === 'same') return ok(T.pluginSame(r.nyckel, kort(r.head)));
  const hur = r.kind === 'older'
    ? T.pluginOlder(r.antal, kort(r.head))
    : T.pluginDiffers(kort(r.head));
  const [av, pa] = pluginInstall.kommandon(r);
  varna(T.pluginOld(r.nyckel, r.scope, kort(r.sha), hur, av, pa));
}

function main() {
  const filBeslut = las(fmt.filnamn(ROT, 'beslut')) || '';
  const oppna = beslutsblock(filBeslut);
  radarJson();
  statusfiler({ oppna });
  journal();
  nastaId();
  kodning();
  hemligheter();
  installningar();
  projektmappar();
  claudeCli();
  las_();
  pluginVersion();
  console.log(T.scheduled);
  for (const [niva, text] of rader) console.log(`${niva.padEnd(8)} ${text}`);
  const antalFel = rader.filter((r) => r[0] === 'ERROR').length;
  const antalVarn = rader.filter((r) => r[0] === 'WARNING').length;
  console.log(T.total(rader.length - antalFel - antalVarn, antalVarn, antalFel));
  process.exit(antalFel ? 1 : 0);
}

main();
