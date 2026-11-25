// Test: the real `node scripts/radar.js` against a temporary notebook, and its output (status/radar.json) through the
// panel mod's own parser (hooks/las.ts, tolkaRadarJson).
// Catches the script and the mod drifting apart (the korNu crash):
//   - every field the mod's types (types/index.d.ts) require exists in the output, on each level the test has data for,
//   - tolkaRadarJson accepts the output and gives the same format number the script writes, and formatVarning is empty.
// Also: --dry-run writes nothing, and outside a notebook the script stops with a clear error.
// Run: node tests/test-radar-format.js   (temporary notebook under tests/_tmp, removed afterwards)
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { pathToFileURL } = require('url');

const repo = path.join(__dirname, '..');
const rot = path.join(__dirname, '_tmp', 'formattest');
const modHooks = path.join(repo, 'hooks');
const typer = fs.readFileSync(path.join(repo, 'types', 'index.d.ts'), 'utf8');
let fel = 0;
const ok = (v, t) => { console.log((v ? 'OK   ' : 'FEL  ') + t); if (!v) fel++; };

// The keys of a type in types/index.d.ts: { namn, valfri }. Comments and deeper levels are skipped.
function typNycklar(namn) {
  const m = typer.match(new RegExp(`export type ${namn} = \\{`));
  if (!m) throw new Error(`type ${namn} is not in types/index.d.ts`);
  let i = m.index + m[0].length;
  let djup = 1;
  let nu = '';
  const delar = [];
  for (; djup > 0 && i < typer.length; i++) {
    const c = typer[i];
    if ('{[(<'.includes(c)) djup++;
    else if ('}])>'.includes(c)) djup--;
    if (djup === 0) break;
    if (djup === 1 && (c === ';' || c === '\n')) { delar.push(nu); nu = ''; } else nu += c;
  }
  delar.push(nu);
  const ut = [];
  for (const d of delar) {
    const t = d.replace(/\/\/.*$/gm, '').trim();
    const k = t.match(/^(\w+)(\?)?\s*:/);
    if (k) ut.push({ namn: k[1], valfri: !!k[2] });
  }
  return ut;
}

function fattas(objekt, typ) {
  return typNycklar(typ).filter((k) => !k.valfri).map((k) => k.namn).filter((k) => !(objekt && Object.prototype.hasOwnProperty.call(objekt, k)));
}

function saknas(objekt, typ, var_) {
  const f = fattas(objekt, typ);
  ok(f.length === 0, `${var_} has all fields of ${typ}${f.length ? ` (missing: ${f.join(', ')})` : ''}`);
}

const w = (rel, text) => { const p = path.join(rot, rel); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, text); };

function kor(rotMapp, ...flaggor) {
  return execFileSync('node', [path.join(repo, 'scripts', 'radar.js'), '--tyst', ...flaggor], { env: { ...process.env, ROOFLOW_ROOT: rotMapp }, stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8' });
}

function lasJson(rotMapp) {
  return fs.readFileSync(path.join(rotMapp, 'status', 'radar.json'), 'utf8');
}

// las.ts, format.ts and strings.ts run as they are (Node strips the types), with ./format -> ./format.ts in a copy.
async function laddaTolkning() {
  const tmp = path.join(rot, '_mod');
  fs.mkdirSync(tmp, { recursive: true });
  fs.writeFileSync(path.join(tmp, 'format.ts'), fs.readFileSync(path.join(modHooks, 'format.ts'), 'utf8'));
  fs.writeFileSync(path.join(tmp, 'strings.ts'), fs.readFileSync(path.join(modHooks, 'strings.ts'), 'utf8'));
  fs.writeFileSync(path.join(tmp, 'las.ts'), fs.readFileSync(path.join(modHooks, 'las.ts'), 'utf8').replace(/from '\.\/format'/g, "from './format.ts'").replace(/from '\.\/strings'/g, "from './strings.ts'"));
  const strings = await import(pathToFileURL(path.join(tmp, 'strings.ts')).href);
  const las = await import(pathToFileURL(path.join(tmp, 'las.ts')).href);
  return { ...las, strings };
}

function kontrollera(text, namn, las, strikt) {
  const raw = JSON.parse(text);
  const d = las.tolkaRadarJson(text);
  ok(d !== null, `${namn}: tolkaRadarJson accepts radar.json`);
  if (!d) return;
  ok(raw.format === las.FORMAT && las.formatVarning(d, las.strings.en) === '', `${namn}: format ${raw.format} is what the mod reads`);
  // Every field the mod reads on the top level exists in the file (not only replaced by a default value).
  const utanFalt = Object.keys(d).filter((k) => !(k in raw));
  ok(utanFalt.length === 0, `${namn}: all top-level fields are in the file${utanFalt.length ? ` (missing: ${utanFalt.join(', ')})` : ''}`);
  saknas(raw, 'RadarData', `${namn}: radar.json`);
  const rader = (lista, typ, var_) => {
    if (!Array.isArray(lista) || lista.length === 0) {
      if (strikt) ok(false, `${var_}: the test has no data here`);
      return;
    }
    lista.slice(0, 3).forEach((x, i) => saknas(x, typ, `${namn}: ${var_}[${i}]`));
  };
  rader(raw.beslut, 'RadarBeslut', 'beslut');
  rader(raw.loften, 'RadarLofte', 'loften');
  rader(raw.vantar, 'RadarVantar', 'vantar');
  rader(raw.rorSig, 'RadarAgent', 'rorSig');
  rader(raw.projekt, 'RadarProjekt', 'projekt');
  rader(raw.skills, 'RadarSkill', 'skills');
  rader(raw.agenter && raw.agenter.rapporter, 'RadarRapport', 'agenter.rapporter');
  rader(raw.agenter && raw.agenter.underagenter, 'RadarUnderagent', 'agenter.underagenter');
  rader(raw.inkorg && raw.inkorg.sektioner, 'RadarInkorgSektion', 'inkorg.sektioner');
  const poster = ((raw.inkorg && raw.inkorg.sektioner) || []).flatMap((s) => s.poster);
  rader(poster, 'RadarInkorgPost', 'inkorg.sektioner[].poster');
  rader((raw.projekt || []).flatMap((p) => p.rapporter || []), 'RadarRapport', 'projekt[].rapporter');
}

function skrivTestrot() {
  w('rooflow.json', JSON.stringify({ format: 1, name: 'alice' }) + '\n');
  w('decisions.md', [
    '# Decisions', '', 'Next Id: B5', '', '## Open', '',
    '## Question about the test', '- Id: B4', '- Date: 2026-11-24', '- Asked by: agent test', '- Project: project-a', '- Blocks: the test agent',
    '- Question: Does it work?', '- Options: a) **(förslag)** yes. b) no.', '- Decision:', '',
  ].join('\n'));
  w('promises.md', ['# Promises', '', '## Open', '', '- [ ] 2099-01-01 (some day) · till bob · send the file · source', '', '- [ ] 2099-01-02 (later) · väntar på acme · answer · source', '', '## Done', ''].join('\n'));
  w('today.md', '# Today 2026-11-24\n\n- [ ] First\n- [x] Second\n');
  w('inbox.md', '# Inbox\n\n## Now\n\n- 2026-11-24 · a post\n  continued\n\n## Later\n\n- 2026-11-01 · a later post\n\n## Done\n');
  w('projects.md', ['# Projects', '', '| Folder | Category | Own repo | Remote | State | Comment |', '|---|---|---|---|---|---|', '| project-a | private | yes | yes | now | test |', ''].join('\n'));
  w('commands.md', '| `/radar` | Shows Radar | x |\n');
  w('status/project-a.md', 'State: running\nDoing: testing the format\nUpdated: 2099-01-01 10:00\n\n- Next step: more\n');
  w('status/subagents.jsonl', [
    JSON.stringify({ time: '2026-11-24 09:00', event: 'start', id: 'u1', project: 'project-a', task: 'task', model: 'haiku' }),
    JSON.stringify({ time: '2026-11-24 09:05', event: 'done', id: 'u1', project: 'project-a', task: 'done' }),
  ].join('\n') + '\n');
  w('status/journal.jsonl', [
    JSON.stringify({ time: '2026-11-24 10:00', id: '2026-11-24-project-a-a', project: 'project-a', report: 'REPORT project-a 2026-11-24\n- **Owner:** B4\nBlocked: the server' }),
    JSON.stringify({ time: '2026-11-24 11:00', id: '2026-11-24-project-a-b', project: 'project-a', report: 'unreported' }),
  ].join('\n') + '\n');
  fs.mkdirSync(path.join(rot, 'archive'), { recursive: true });
}

(async () => {
  try {
    fs.rmSync(rot, { recursive: true, force: true });
    skrivTestrot();

    // --dry-run: prints radar.md, writes nothing at all.
    const dryRun = execFileSync('node', [path.join(repo, 'scripts', 'radar.js'), '--dry-run'], { env: { ...process.env, ROOFLOW_ROOT: rot }, encoding: 'utf8' });
    ok(!fs.existsSync(path.join(rot, 'radar.md')) && !fs.existsSync(path.join(rot, 'status', 'radar.json')) && !fs.existsSync(path.join(rot, 'status', 'radar-forra.json')), '--dry-run writes no file');
    ok(/^RADAR /.test(dryRun) && dryRun.includes('NEEDS YOU (1)') && dryRun.includes('B4'), '--dry-run prints radar.md to stdout');

    const originalConfig = fs.readFileSync(path.join(rot, 'rooflow.json'), 'utf8');
    fs.writeFileSync(path.join(rot, 'rooflow.json'), JSON.stringify({ format: 1, name: 'alice', language: 'sv' }) + '\n', 'utf8');
    const svensk = execFileSync('node', [path.join(repo, 'scripts', 'radar.js'), '--dry-run'], { env: { ...process.env, ROOFLOW_ROOT: rot }, encoding: 'utf8' });
    ok(svensk.includes('BEHÖVER DIG (1)') && svensk.includes('INKORG') && !svensk.includes('NEEDS YOU'), 'language sv gives Swedish headings in radar.md');
    fs.writeFileSync(path.join(rot, 'rooflow.json'), originalConfig, 'utf8');

    kor(rot);
    ok(fs.existsSync(path.join(rot, 'radar.md')), 'a normal run writes radar.md');
    const raw = JSON.parse(lasJson(rot));
    ok(raw.format === 1 && Array.isArray(raw.beslut) && Array.isArray(raw.rorSig) && Array.isArray(raw.projekt) && raw.inkorg && typeof raw.inkorg.angra === 'string', 'radar.json: format 1 and the main lists');
    ok(raw.agenter.rapporter.every((x) => 'owner' in x), 'radar.json: reports carry the owner field');
    ok(raw.agenter.rapporter.some((x) => x.owner === 'B4' && x.blockerat === 'the server'), 'radar.json: Owner and Blocked are read from the report text');
    if (raw.idag.saker.length) ok(raw.idag.saker.every((s) => typeof s.hash === 'string' && s.hash.length === 8), 'every today line has a hash');
    ok(raw.loften.length > 0 && raw.loften.every((l) => typeof l.hash === 'string' && l.hash.length === 8), 'every promise has a hash');

    // Outside any notebook (no ROOFLOW_ROOT, no rooflow.json above): a clear error.
    const ute = path.join(__dirname, '_tmp', 'formattest-outside');
    fs.mkdirSync(ute, { recursive: true });
    const env = { ...process.env };
    delete env.ROOFLOW_ROOT;
    let kod = 0;
    let err = '';
    try { execFileSync('node', [path.join(repo, 'scripts', 'radar.js'), '--dry-run'], { env, cwd: ute, stdio: ['ignore', 'pipe', 'pipe'] }); } catch (e) { kod = e.status; err = String(e.stderr); }
    ok(kod !== 0 && err.includes('No RooFlow notebook found'), 'no notebook: a clear error and a non-zero exit code');
    fs.rmSync(ute, { recursive: true, force: true });

    {
      const las = await laddaTolkning();
      // The test must be able to find a missing field: with korNu or a hash removed it has to show.
      ok(fattas({ genererad: '' }, 'RadarData').includes('korNu'), 'self-test: a missing korNu is detected');
      ok(fattas({ datum: 'x', vem: 'y', vad: 'z', nar: '' }, 'RadarLofte').length === 0, 'self-test: hash is optional in RadarLofte (older files)');
      kontrollera(lasJson(rot), 'test notebook', las, true);

      // The mod's copy of the format tables (hooks/format.ts) must equal scripts/format.js.
      const skriptFormat = require('../scripts/format');
      const modFormat = await import(pathToFileURL(path.join(rot, '_mod', 'format.ts')).href);
      for (const namn of ['FILER', 'STATUS', 'REGISTER', 'PROJEKTLAGEN', 'LAGEN', 'BESLUT', 'RUBRIKER', 'RAPPORT', 'UNDERAGENT', 'JOURNAL']) {
        ok(JSON.stringify(modFormat[namn]) === JSON.stringify(skriptFormat[namn]), `format table ${namn}: hooks/format.ts equals scripts/format.js`);
      }
    }
  } finally {
    fs.rmSync(rot, { recursive: true, force: true });
  }
  console.log(fel ? `\n${fel} checks failed` : '\nAll OK');
  process.exit(fel ? 1 : 0);
})();
