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

const ROT = requireRoot();
const NU = Date.now();

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
  try { st = fs.statSync(fil); } catch { return fel('status/radar.json is missing (the mod or `node scripts/radar.js` writes it)'); }
  const min = Math.round((NU - st.mtimeMs) / MIN);
  let o = null;
  try { o = JSON.parse(fs.readFileSync(fil, 'utf8')); } catch { return fel('status/radar.json is not valid JSON'); }
  if (o.format !== 1) return varna(`status/radar.json has format ${JSON.stringify(o.format)}, expected 1`);
  if (min > 15) return varna(`status/radar.json is ${min} min old (limit 15). The mod is not running or has stopped`);
  ok(`status/radar.json is ${min} min old, format 1`);
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
  if (fastKor.length) varna(`${fastKor.length} status file(s) say running but are untouched for over 24 h: ${fastKor.join(', ')}`);
  else ok(`no status files stuck on running for over 24 h (${antal} status files with a header)`);
  if (gammalFraga.length) varna(`${gammalFraga.length} status file(s) say asking for over 7 days with no Needs and no open B-id: ${gammalFraga.join(', ')}`);
  else ok('no old asking states without Needs or an open B-id');
}

// 4. journal
function journal() {
  const text = las(path.join('status', 'journal.jsonl'));
  if (text === null) return ok('no status/journal.jsonl yet (no runs to check)');
  const gamla = [];
  for (const rad of text.split(/\r?\n/)) {
    if (!rad.trim()) continue;
    let o;
    try { o = JSON.parse(rad); } catch { continue; }
    const j = fmt.journalRad(o);
    const t = lokaltDatum(j.tid);
    if (t && NU - t <= 7 * DAG && fmt.arOrapporterad(j.rapport)) gamla.push(j.id || '(no id)');
  }
  if (gamla.length) varna(`${gamla.length} unreported runs in the last 7 days: ${gamla.slice(0, 5).join(', ')}${gamla.length > 5 ? ' …' : ''}`);
  else ok('no unreported runs in the last 7 days');
}

// 5. Next Id
function nastaId() {
  const fil = fmt.filnamn(ROT, 'beslut');
  const text = las(fil);
  if (text === null) return varna(`${fil} is missing`);
  const m = text.match(fmt.nastaIdRe());
  const alla = beslutsblock(text).map((b) => b.id);
  for (const rel of lista(fmt.filnamn(ROT, 'arkiv'), '.md')) {
    if (/(^|[\\/])(beslut|decisions)-\d{4}-\d{2}\.md$/.test(rel)) alla.push(...beslutsblock(las(rel) || '').map((b) => b.id));
  }
  if (!m) return fel(`${fil} has no "Next Id"/"Nästa Id" line`);
  const nasta = Number(m[1]);
  const max = alla.length ? Math.max(...alla) : 0;
  const dubbletter = [...new Set(alla.filter((id, i) => alla.indexOf(id) !== i))];
  if (nasta <= max) fel(`Next Id is B${nasta} but the highest Id in ${fil} and the archive is B${max}`);
  else ok(`Next Id B${nasta} is greater than the highest Id B${max}`);
  if (dubbletter.length) fel(`duplicate Ids: ${dubbletter.slice(0, 8).map((i) => 'B' + i).join(', ')}`);
  else ok('no duplicate B-ids');
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
  if (bom.length) fel(`BOM in ${bom.length} file(s): ${bom.slice(0, 5).join(', ')}`);
  else ok(`no BOM in .md files (${sedda.size} files)`);
  if (mojibake.length) fel(`mojibake in ${mojibake.length} file(s): ${mojibake.slice(0, 5).join(', ')}`);
  else ok('no mojibake in .md files');
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
    spårade = execFileSync('git', ['-C', ROT, 'ls-files', '-z'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).split('\0').filter(Boolean);
  } catch {
    return varna('not a git repo, cannot check tracked files for passwords');
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
  if (traffar.length) varna(`password-like content in ${traffar.length} tracked file(s) (no text shown, review yourself): ${traffar.slice(0, 6).join(', ')}${traffar.length > 6 ? ' …' : ''}`);
  else ok(`no password-like rows in ${kand.length} tracked logs and jsonl files`);
}

// 8. rooflow.json
function installningar() {
  const r = loadConfig(ROT);
  if (!r.exists) return varna('rooflow.json is missing (defaults apply; /rooflow-setup creates it)');
  if (r.error) return fel(`rooflow.json: ${r.error}`);
  const utanRestart = Object.entries(r.config.projects).filter(([, v]) => v.restart && !v.url).map(([k]) => k);
  if (utanRestart.length) return varna(`rooflow.json: projects with restart but no url (no wait for a response): ${utanRestart.join(', ')}`);
  ok(`rooflow.json is valid (${Object.keys(r.config.projects).length} projects with settings)`);
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
    ok('no projects.md, no project folders to check');
  } else if (saknas.length) {
    varna(`${saknas.length} project(s) in state now in projects.md have no folder on disk: ${saknas.join(', ')}. Set rooflow.json projects.<slug>.folder (the slug is the Folder column in lower case)`);
  } else {
    ok(`every project in state now in projects.md has a folder (${granskas.length} projects)`);
  }
  kategorier(text, config, rader);
  const utanRunJson = Object.entries(config.projects)
    .filter(([, v]) => v.run && !fs.existsSync(path.join(path.resolve(ROT, v.run), 'run.json')))
    .map(([k]) => k);
  if (utanRunJson.length) varna(`rooflow.json: projects whose run folder has no run.json: ${utanRunJson.join(', ')}`);
}

// 9b. Categories: every category in projects.md should be in rooflow.json "categories" (key or label). Only checked when the
// key is set: without it only the default archive is known, and older notebooks would warn on every row.
// A private project must never be in team.sharedRepos.
function kategorier(text, config, rader) {
  if (text === null) return;
  const delade = new Set(config.team.sharedRepos.map((s) => s.toLowerCase()));
  const privataDelade = rader.filter((p) => p.kategori.private && delade.has(p.slug)).map((p) => p.slug);
  if (privataDelade.length) varna(`private project(s) in rooflow.json team.sharedRepos: ${privataDelade.join(', ')}. A private category is never shared; remove them from sharedRepos`);
  if (!config.categoriesSet) return ok('rooflow.json has no "categories": the default applies (archive is hidden). /rooflow-setup proposes a set');
  const okanda = [...new Set(rader.filter((p) => !p.kategori.blank && !p.kategori.known).map((p) => p.kategori.label))];
  if (okanda.length) varna(`projects.md has categories that are not in rooflow.json categories: ${okanda.join(', ')}. Add them (key or label) or rename them in projects.md`);
  else ok(`every category in projects.md is in rooflow.json categories (${Object.keys(config.categories).length} categories)`);
}

// 10. The Claude Code CLI that agent.sh starts. On Windows `claude` on PATH is often the desktop app, and an agent started
// with it dies at once without an answer. Told by the path only (scripts/claude-cli.js); nothing is started.
function claudeCli() {
  const config = loadConfig(ROT).config;
  const r = hittaClaude({ claudeCli: config.claudeCli });
  if (r.kind === 'missing') return varna('no Claude Code CLI found (npm, ~/.local/bin or PATH): agents cannot start. Install the CLI or set claudeCli in rooflow.json');
  if (r.source === 'config' && /[\\/]/.test(r.path) && !fs.existsSync(path.resolve(ROT, windowsSokvag(r.path)))) return varna(`rooflow.json claudeCli '${r.path}' does not exist`);
  if (r.kind === 'app') return varna(`'${r.path}' (${r.source}) looks like the desktop app, not the Claude Code CLI: agents would die without an answer. Install the CLI or set claudeCli in rooflow.json`);
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
  if (gamla.length) varna(`stale lock file: ${gamla.join(', ')}. Writers remove locks older than 60 s by themselves on the next write`);
  else ok('no lock file older than 60 s');
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
  if (r.kind === 'same') return ok(`plugin ${r.nyckel} is installed at the source's HEAD (${kort(r.head)})`);
  const hur = r.kind === 'older'
    ? `is ${r.antal === null ? 'some' : r.antal} commit(s) older than HEAD ${kort(r.head)} in its local source`
    : `differs from HEAD ${kort(r.head)} in its local source`;
  const [av, pa] = pluginInstall.kommandon(r);
  varna(`plugin ${r.nyckel} (${r.scope}) is installed at ${kort(r.sha)}, which ${hur}. "claude plugin update" does nothing while the version in plugin.json is unchanged. From the notebook folder run: ${av}, then: ${pa}, and start a new session`);
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
  console.log('-  scheduled jobs: cannot be read by a script, the skill checks them separately');
  for (const [niva, text] of rader) console.log(`${niva.padEnd(8)} ${text}`);
  const antalFel = rader.filter((r) => r[0] === 'ERROR').length;
  const antalVarn = rader.filter((r) => r[0] === 'WARNING').length;
  console.log(`Total: ${rader.length - antalFel - antalVarn} OK, ${antalVarn} WARNING, ${antalFel} ERROR`);
  process.exit(antalFel ? 1 : 0);
}

main();
