// Unit tests for the parsing in scripts/radar.js. Pure functions, no files are written (except the last block, in a temporary notebook).
// Run: node tests/test-radar.js
const path = require('path');
const fsx = require('fs');
// Parsing a notebook-dependent part (inbox undo) needs a root; an empty temporary one is enough.
const tomRot = path.join(__dirname, '_tmp', 'radartest-empty');
fsx.mkdirSync(tomRot, { recursive: true });
process.env.ROOFLOW_ROOT = tomRot;
const r = require('../scripts/radar');
let fel = 0;
const ok = (v, t) => { console.log((v ? 'OK   ' : 'FEL  ') + t); if (!v) fel++; };

// --- decisions: id, status, options, blocks ---
const beslutText = [
  '# Decisions', '', '```', '## <short heading>', '- Id: B<n>', '- Datum: YYYY-MM-DD', '- Frågar: x', '- Beslut: (tomt tills taget)', '```', '',
  '## Öppna', '',
  '## Project A: build the start page?', '- Id: B14', '- Datum: 2026-10-16', '- Frågar: agent project-a', '- Projekt: project-a',
  '- Blockerar: the project-a agent', '- Fråga: Shall we?', '- Alternativ: a) **(förslag)** now. b) after Friday.', '- Beslut: (tomt tills taget)', '',
  '## Parked thing', '- Id: B3', '- Datum: 2026-10-08', '- Frågar: RooFlow', '- Förslag: a) do. b) leave.', '- Beslut: bordlagt 2026-10-09', '',
  '## Already decided', '- Id: B15', '- Datum: 2026-10-20', '- Frågar: RooFlow', '- Beslut: a, alice 2026-10-21', '',
  '## Tagna', '',
  '## Old', '- Datum: 2026-09-01', '- Frågar: x', '- Beslut: (tomt tills taget)', '',
].join('\n');
const b = r.tolkaBeslut(beslutText);
ok(b.length === 3, 'three blocks under Open; the template and Taken do not count');
ok(b[0].id === 'B14' && b[0].status === 'oppen', 'B14 is open with an id');
ok(b[0].blockerar === 'the project-a agent' && b[0].projekt === 'project-a', 'Blocks and Project are read');
ok(b[0].alternativ.length === 2 && b[0].alternativ[0].forslag && b[0].alternativ[0].text === 'now', 'option a is the suggestion, without markdown');
ok(b[1].status === 'bordlagd' && b[1].alternativ.length === 2, 'parked decision, the Förslag line as options');
ok(b[2].status === 'avgjord', 'a filled-in Decision = decided');

// --- age ---
const nu = new Date(2026, 9, 21, 14, 5);
ok(r.alder('2026-10-16', nu) === '5 d', 'age in days for a date without time');
ok(r.alder('2026-10-21', nu) === 'today', 'same day = today');
ok(r.alder('2026-10-21 14:02', nu) === '3 min', 'age in minutes with a time');
ok(r.alder('2026-10-21T11:05:00', nu) === '3 h', 'age in hours for an ISO time');

// --- promises and waiting ---
const loftenText = [
  '# Promises', '', '## Open', '',
  '- [ ] 2026-10-22 (Thursday) · till bob (acme) · fix the winter list · alice 2026-10-19',
  '- [ ] 2026-10-23 · till (who? alice fills in) · page types done · chat',
  '- [ ] 2026-10-20 · till carol · send the file · mail',
  '- [ ] 2026-10-15 · väntar på IT · answer about the SQL login · alice',
  '', '## Klara', '', '- [x] 2026-10-01 · till X · done', '- [ ] 2026-10-01 · till Y · misplaced in Done',
].join('\n');
const l = r.tolkaLoften(loftenText, '2026-10-21');
ok(l.loften.length === 3, 'three promises; the waiting line and Done do not count');
ok(l.loften[0].nar === 'FÖRSENAT' && l.loften[0].vem === 'carol', 'the overdue promise first');
ok(l.loften[1].nar === 'IMORGON' && l.loften[1].vad === 'fix the winter list', 'tomorrow, what without the source');
ok(l.loften[2].mottagareSaknas, 'a missing recipient is recognised');
ok(l.vantar.length === 1 && l.vantar[0].vem === 'IT' && l.vantar[0].vad === 'answer about the SQL login', 'waiting for IT');

// --- today.md ---
const idag = r.tolkaIdag('# Idag 2026-10-22\n\n- [ ] test steps 1-32\n- [x] reply to bob\n- [ ] three\n- [ ] four\n');
ok(idag.datum === '2026-10-22' && idag.saker.length === 3 && idag.saker[1].klar, 'today: date, at most three, [x] done');

// --- the status file header ---
const h = r.tolkaStatusHuvud('Läge: frågar\nGör nu: waiting for B16\nUppdaterad: 2026-10-21 14:00\n\n# Status\n- Läge: old\n');
ok(h && h.lage === 'frågar' && h.gorNu === 'waiting for B16' && h.uppdaterad === '2026-10-21 14:00', 'Läge/Gör nu/Uppdaterad at the top');
ok(r.tolkaStatusHuvud('# Status\n\n- Läge: old bullet\n') === null, 'an old status file without a header gives null');
ok(r.tolkaStatusHuvud('Läge: kör (del 2)\n').lage === 'kör', 'the state is the first word');

// --- subagents, sessions, journal ---
const ua = r.tolkaUnderagenter('{"tid":"t1","handelse":"start","id":"a","projekt":"p"}\n{"handelse":"start","id":"b"}\nbroken\n{"handelse":"klar","id":"a"}\n');
ok(ua.length === 1 && ua[0].id === 'b' && ua[0].projekt === 'rooflow', 'start without done = running, project rooflow by default');
const s = r.tolkaSessioner('{"genererad":"x","sessioner":[{"id":"1","mapp":"C:\\work\\x","projekt":"x","kor":true},{"id":"2","kor":false}]}');
ok(s.length === 1 && s[0].projekt === 'x', 'sessions with unescaped backslashes are parsed, only kor:true');
const j = r.tolkaJournal('{"tid":"2026-10-21 15:00","id":"x","projekt":"project-a","rapport":"orapporterad"}\n{"tid":"t","id":"y","projekt":"in","rapport":"RAPPORT in"}\n');
ok(j.length === 2 && j[0].orapporterad && !j[1].orapporterad, 'journal: unreported is flagged');
ok(j[0].rapport === '' && j[1].rapport === 'RAPPORT in', 'journal: the report text follows, not for an unreported one');
const j2 = r.tolkaJournal(JSON.stringify({ tid: 't', id: 'z', projekt: 'in', rapport: 'RAPPORT in\r\nGjort:  a' }) + '\n');
ok(j2[0].rapport === 'RAPPORT in\nGjort:  a', 'journal: line breaks and spaces are kept');
ok(b[0].text.startsWith('- Id: B14') && b[0].text.includes('\n- Fråga: Shall we?') && !b[0].text.includes('## '), 'decisions: the block text without heading, with line breaks');

// --- inbox and usage ---
const ink = r.tolkaInkorg('# Inbox\n- 2026-10-13 · a\n## Now\n- 2026-10-15 · b\n1. c\n## Klart\n- [x] 2026-09-01 · d\n');
ok(ink.antal === 3 && ink.aldsta === '2026-10-13', 'inbox: count without Done, oldest date');
const usageText = '| Datum | Tid | 5h % | Vecka alla % | Week model % |\n|---|---|---|---|---|\n| 2026-10-20 | 08 | 1 | 9 | 2 |\n| 2026-10-21 | 14 | 3 | 11 | 4 |\n\n| Datum | Agent |\n';
ok(r.tolkaUsage(usageText, '2026-10-21').vecka === '11', 'usage: the last row of today');
ok(r.tolkaUsage(usageText, '2026-10-22') === null, 'usage: an old row gives nothing');
const senast = r.tolkaUsageSenast(usageText);
ok(senast.datum === '2026-10-21' && senast.tid === '14' && senast.femh === '3' && senast.weekModel === '4', 'usage: the last row whatever the date, with time and model week');
ok(ink.rader.length === 3 && ink.rader[0].text === '2026-10-13 · a' && ink.rader[1].rubrik === 'Now' && ink.rader[2].text === 'c', 'inbox: lines oldest first, undated last, with heading');
const ink2 = r.tolkaInkorg('## A\n- 2026-10-20 · new\n- 2026-10-01 · old\n');
ok(ink2.rader[0].text === '2026-10-01 · old', 'inbox: an older date first even if it is later in the file');

// --- git log and subagents with history ---
const gl = r.tolkaGitLogg('abc1234\t2026-10-26 09:55:01 +0200\tfeat: x\n\n');
ok(gl.length === 1 && gl[0].hash === 'abc1234' && gl[0].tid === '2026-10-26 09:55' && gl[0].text === 'feat: x', 'git log: hash, time to the minute, subject line');
const uh = r.tolkaUnderagentHistorik('{"tid":"t1","handelse":"start","id":"a","projekt":"p","uppdrag":"do"}\n{"tid":"t2","handelse":"start","id":"b"}\n{"tid":"t3","handelse":"klar","id":"a","uppdrag":"done, abc"}\n');
ok(uh.length === 2 && uh[0].klar === 't3' && uh[0].resultat === 'done, abc' && uh[1].klar === '' && uh[1].projekt === 'rooflow', 'subagents: start joined with done, one without done');

// --- agents running now (the band) ---
const nuK = new Date(2026, 10, 23, 18, 0);
const huvudK = new Map([
  ['a-new', r.tolkaStatusHuvud('Läge: kör\nGör nu: x\nUppdaterad: 2026-11-23 17:30\n')],
  ['b-old', r.tolkaStatusHuvud('Läge: kör\nGör nu: x\nUppdaterad: 2026-11-23 15:00\n')],
  ['c-asking', r.tolkaStatusHuvud('Läge: frågar\nGör nu: B1\nUppdaterad: 2026-11-23 17:55\n')],
  ['d-new', r.tolkaStatusHuvud('Läge: kör (del 2)\nGör nu: x\nUppdaterad: 2026-11-23 17:59\n')],
]);
ok(JSON.stringify(r.korNuNamn(huvudK, nuK)) === '["a-new","d-new"]', 'korNu: only state running and updated within 2 hours');
ok(JSON.stringify(r.korNuNamn(huvudK, nuK, new Set(['d-new']))) === '["a-new"]', 'korNu: an agent that waits (Needs) is not counted as running');

// --- delta ---
const antal = { behover: 3, idag: 1, lovat: 2, vantar: 0, rorsig: 2, starstill: 1, inkorg: 30 };
const forra = { datum: '2026-10-21', tid: '07:30', antal: { behover: 2, idag: 1, lovat: 3, vantar: 0, rorsig: 1, starstill: 1, inkorg: 30 } };
const d = r.raknaDelta(antal, forra, '2026-10-21', false);
ok(d.plus === 2 && d.minus === 1 && d.sedan === '07:30', 'delta +2 -1 since 07:30');
ok(r.raknaDelta(antal, forra, '2026-10-22', false).sedan === null, 'a new day = a new baseline');
ok(r.raknaDelta(antal, forra, '2026-10-21', true).sedan === null, '--nollstall = a new baseline');

// --- project mentioned, commands ---
ok(r.namnerProjekt('IN net10: smoke test', { mapp: 'IN', slug: 'in' }) && !r.namnerProjekt('answer in a day', { mapp: 'IN', slug: 'in' }), 'a short project name needs capitals');
ok(r.namnerProjekt('pa: RSS', { mapp: 'ProjectA', slug: 'pa' }), 'the slug matches');
const k = r.tolkaKommandon('| Type | What |\n|---|---|\n| `/radar` | Shows Radar | radar.md |\n| `/promise <what>` | Registers | promises.md |\n| `/promise done` | Ticks off | x |\n');
ok(k[0].namn === '/radar' && k[0].besk === 'Shows Radar' && k.find((x) => x.namn === '/promise').besk === 'Registers', 'commands.md: the first line per command');

// --- English keys and file names: the same data gives the same result ---
const fmt = require('../scripts/format');
const beslutEn = [
  '# Decisions', '', 'Next Id: B20', '', '## Open', '',
  '## Project A: build the start page?', '- Id: B14', '- Date: 2026-10-16', '- Asked by: agent project-a', '- Project: project-a',
  '- Blocks: the project-a agent', '- Question: Shall we?', '- Why it matters: x', '- Options: a) **(förslag)** now. b) after Friday.', '- Decision: (tomt tills taget)', '',
  '## Parked thing', '- Id: B3', '- Date: 2026-10-08', '- Asked by: RooFlow', '- Options: a) do. b) leave.', '- Decision: bordlagt 2026-10-09', '',
  '## Already decided', '- Id: B15', '- Date: 2026-10-20', '- Asked by: RooFlow', '- Decision: a, alice 2026-10-21', '',
  '## Taken', '', '## Old', '- Date: 2026-09-01', '- Asked by: x', '- Decision: (tomt tills taget)', '',
].join('\n');
const be = r.tolkaBeslut(beslutEn);
ok(be.length === 3 && be[0].id === 'B14' && be[0].status === 'oppen', 'English decisions: three blocks under Open, B14 open');
ok(be[0].blockerar === 'the project-a agent' && be[0].projekt === 'project-a' && be[0].datum === '2026-10-16' && be[0].fragar === 'agent project-a', 'English decisions: Blocks, Project, Date, Asked by');
ok(be[0].alternativ.length === 2 && be[0].alternativ[0].forslag && be[1].status === 'bordlagd' && be[2].status === 'avgjord', 'English decisions: Options, Decision (parked, decided)');
ok(JSON.stringify(be.map((x) => [x.id, x.status, x.alternativ])) === JSON.stringify(b.map((x) => [x.id, x.status, x.alternativ])), 'English and Swedish decisions give the same id, status and options');
{
  const en2 = r.tolkaBeslut('## Open\n\n## Q\n- Id: B1\n- Asked by: x\n- Options: a) first. b) **(suggestion)** second.\n- Decision:\n\n## P\n- Id: B2\n- Asked by: x\n- Decision: parked 2026-11-24\n');
  ok(en2[0].alternativ[1].forslag === true && en2[0].alternativ[1].text === 'second', 'English decisions: the **(suggestion)** marker marks the proposed option');
  ok(en2[1].status === 'bordlagd', 'English decisions: "Decision: parked <date>" is parked, not decided');
  ok(r.tolkaKommandon('| `/morning` | Morning overview | `x` |\n').find((k) => k.namn === '/morning').besk === 'Morning overview', 'commands.md: the English command table is read');
}
const he = r.tolkaStatusHuvud('State: asking\nDoing: waiting for B16\nUpdated: 2026-10-21 14:00\n\n# Status\n');
ok(he && he.lage === 'frågar' && he.gorNu === 'waiting for B16' && he.uppdaterad === '2026-10-21 14:00', 'English status header: State/Doing/Updated, the value is normalised to frågar');
ok(r.tolkaStatusHuvud('State: running (part 2)\n').lage === 'kör' && r.tolkaStatusHuvud('State: done\n').lage === 'klar' && r.tolkaStatusHuvud('State: stuck\n').lage === 'fast', 'State: running, done and stuck become kör, klar, fast');
const uaEn = r.tolkaUnderagenter('{"time":"t1","event":"start","id":"a","project":"p","task":"do","model":"haiku"}\n{"event":"start","id":"b"}\n{"event":"done","id":"a"}\n');
ok(uaEn.length === 1 && uaEn[0].id === 'b' && uaEn[0].projekt === 'rooflow', 'subagents: start/done with English fields, start without done = running');
const uhEn = r.tolkaUnderagentHistorik('{"time":"t1","event":"start","id":"a","project":"p","task":"do","model":"haiku"}\n{"time":"t3","event":"done","id":"a","task":"done, abc"}\n');
ok(uhEn.length === 1 && uhEn[0].projekt === 'p' && uhEn[0].modell === 'haiku' && uhEn[0].start === 't1' && uhEn[0].klar === 't3' && uhEn[0].resultat === 'done, abc', 'subagents: history with English fields');
ok(r.tolkaUnderagenter('{"tid":"t1","handelse":"start","id":"a"}\n{"event":"done","id":"a"}\n').length === 0, 'a Swedish start and an English done in the same file');
const j3 = r.tolkaJournal('{"time":"2026-11-24 10:00","id":"x","project":"project-a","report":"orapporterad"}\n{"time":"t","id":"y","project":"in","report":"REPORT in"}\n{"time":"t","id":"z","project":"in","report":"unreported"}\n');
ok(j3.length === 3 && j3[0].orapporterad && j3[0].tid === '2026-11-24 10:00' && j3[0].projekt === 'project-a' && !j3[1].orapporterad && j3[1].rapport === 'REPORT in' && j3[2].orapporterad, 'journal: English keys (time/project/report)');
ok(r.tolkaInkorg('# Inbox\n- 2026-10-13 · a\n## Now\n- 2026-10-15 · b\n## Waiting\n- c\n## Done\n- [x] d\n').antal === 3, 'inbox.md: the sections Now/Waiting count, Done does not');
ok(r.tolkaInkorg('# Inbox\n## Later\n- a\n## Klart\n- b\n').antal === 1, 'inbox.md: Klart is still accepted');
ok(r.tolkaLoften('## Open\n- [ ] 2026-10-22 · till bob · x · y\n## Klara\n- [ ] 2026-10-01 · till Y · z\n', '2026-10-21').loften.length === 1, 'promises.md: the Klara heading does not count');
ok(r.tolkaIdag('# Today 2026-10-22\n\n- [ ] a\n- [x] b\n').saker.length === 2, 'today.md: the heading Today');
ok(r.tolkaLoften('## Open\n- [ ] 2026-10-22 · till bob · x · y\n## Done\n- [ ] 2026-10-01 · till Y · z\n', '2026-10-21').loften.length === 1, 'promises.md: the Done heading does not count');
{
  const en = r.tolkaLoften('## Open\n- [ ] 2026-10-22 (deadline) · to Bob · send the form · chat\n- [ ] 2026-10-15 (since) · waiting for IT · answer · chat\n', '2026-10-21');
  ok(en.loften.length === 1 && en.loften[0].vem === 'Bob' && en.loften[0].vad === 'send the form', 'promises.md: English keyword "to"');
  ok(en.vantar.length === 1 && en.vantar[0].vem === 'IT' && en.vantar[0].vad === 'answer', 'promises.md: English keyword "waiting for"');
}
ok(r.tolkaInkorg('# Inbox\n- 2026-10-13 · a\n## Done\n- 2026-09-01 · d\n').antal === 1, 'inbox.md: the Done heading does not count');
ok(fmt.rapportStartRe().test('text\nREPORT x 2026-11-24\nDone: a') && fmt.rapportStartRe().test('RAPPORT x') && !fmt.rapportStartRe().test('RAPPORTEN x'), 'the report line: REPORT or RAPPORT');
ok(fmt.nastaIdRe().exec('Next Id: B20')[1] === '20' && fmt.nastaIdRe().exec('Nästa Id: B7')[1] === '7', 'Next Id and Nästa Id');
{
  const os = require('os'), fs = require('fs'), path = require('path');
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'rooflow-format-'));
  ok(fmt.filnamn(d, 'beslut') === 'beslut.md' && fmt.filnamn(d, 'underagenter') === 'status/underagenter.jsonl', 'file names: Swedish when nothing exists');
  fs.writeFileSync(path.join(d, 'decisions.md'), '');
  fs.mkdirSync(path.join(d, 'status'));
  fs.writeFileSync(path.join(d, 'status', 'subagents.jsonl'), '');
  ok(fmt.filnamn(d, 'beslut') === 'decisions.md' && fmt.filnamn(d, 'underagenter') === 'status/subagents.jsonl' && fmt.filnamn(d, 'loften') === 'loften.md', 'file names: English when it exists, otherwise Swedish');
  fs.rmSync(d, { recursive: true, force: true });
}

// --- the project register: Mapp/Kategori/Läge and Folder/Category/State, with the default categories ---
{
  const reg = require('../scripts/register');
  const cat = require('../scripts/categories');
  const rader = (a, b, c) => ['| ' + a + ' | ' + b + ' | Eget repo | Remote | ' + c + ' | Kommentar |', '|---|---|---|---|---|---|', '| Project-A | privat | ja | nej | nu | k |', '| Old | arkiv | ja | nej | nu | k |', '| Resting | privat | ja | nej | – | k |'].join(String.fromCharCode(10));
  for (const [namn, text] of [['Swedish headings', rader('Mapp', 'Kategori', 'Läge')], ['English headings', rader('Folder', 'Category', 'State')]]) {
    const p = reg.parseProjektregister(text, cat.defaults('sv'));
    ok(p.length === 1 && p[0].mapp === 'Project-A' && p[0].slug === 'project-a' && p[0].lage === 'nu', 'project register, ' + namn + ': the default archive (sv) and a dash state are skipped');
  }
}

// --- categories: key or label, case-insensitive; the default without "categories" hides the archive ---
{
  const reg = require('../scripts/register');
  const cat = require('../scripts/categories');
  const nl = String.fromCharCode(10);
  const text = ['| Folder | Category | Own repo | Remote | State | Comment |', '|---|---|---|---|---|---|', '| A | Jobb | yes | no | now | ka |', '| B | home | yes | no | next | kb |', '| C | PRIVAT | no | – | waiting | kc |', '| D | private | yes | no | parked | kd |', '| E | archive | no | – | now | ke |', '| F | privat | no | – | – | kf |', '| G | Arkiv | no | – | now | kg |', '| H | – | no | – | now | kh |', '| I | odd | no | – | now | ki |'].join(nl);
  const egna = cat.fromConfig({ work: { label: 'jobb' }, private: { label: 'privat', private: true }, home: { label: 'hemma', machine: 'Other-PC', private: true }, archive: { label: 'arkiv', hidden: true } }, 'sv').categories;
  const p = reg.parseProjektregister(text, egna);
  ok(p.map((x) => x.mapp + ':' + x.lage).join(',') === 'A:nu,B:nästa,C:väntar,D:parkerat,H:nu,I:nu', 'project register: states are normalised; the hidden category (by key and by label) and a dash state are skipped');
  ok(p[0].kategori.key === 'work' && p[0].kommentar === 'ka', 'categories: a label matches whatever its case (Jobb -> work)');
  ok(p[1].kategori.key === 'home' && p[1].kategori.machine === 'Other-PC' && p[1].kategori.private, 'categories: a key matches (home) and carries machine and private');
  ok(p[2].kategori.key === 'private' && p[3].kategori.key === 'private', 'categories: PRIVAT (label) and private (key) are the same category');
  ok(p[4].kategori.blank && !p[4].kategori.known && p[5].kategori.label === 'odd' && !p[5].kategori.known && !p[5].kategori.blank, 'categories: a dash is no category, an unknown name is unknown');
  const svDef = reg.parseProjektregister(text, cat.defaults('sv')).map((x) => x.mapp).join(',');
  ok(svDef === 'A,B,C,D,H,I', 'default (sv): archive and arkiv are hidden, nothing else is');
  const enDef = reg.parseProjektregister(text, cat.defaults('en')).map((x) => x.mapp).join(',');
  ok(enDef === 'A,B,C,D,G,H,I', 'default (en): archive is hidden; arkiv is not an English label');
  ok(cat.resolve(egna, '  HEMMA ').key === 'home' && cat.resolve(egna, 'home').key === 'home', 'categories: trimmed, key and label');
  // A key goes before another category's label with the same text.
  const krock = cat.fromConfig({ a: { label: 'b' }, b: { label: 'x' } }, 'en').categories;
  ok(cat.resolve(krock, 'b').key === 'b', 'categories: a key wins over a label of another category');
  ok(cat.fromConfig({ x: 'nope' }, 'en').error.includes('categories.x') && cat.fromConfig([], 'en').error.includes('object'), 'categories: a broken entry is an error');
  const s = cat.suggested('sv');
  ok(Object.keys(s).join(',') === 'work,private,home,archive' && s.work.label === 'jobb' && s.home.private && s.archive.hidden && !s.home.machine, 'suggested set (sv): jobb, privat, hemma, arkiv; no machine by itself');
  ok(cat.suggested('en').archive.label === 'archive' && cat.suggested('xx').work.label === 'work', 'suggested set (en and other languages): English labels');
}

// --- rooflow.json categories through loadConfig: missing gives the default for the language ---
{
  const fs = require('fs');
  const { loadConfig } = require('../scripts/root');
  const d = path.join(__dirname, '_tmp', 'radartest-categories');
  fs.mkdirSync(d, { recursive: true });
  try {
    fs.writeFileSync(path.join(d, 'rooflow.json'), JSON.stringify({ format: 1, language: 'sv' }));
    let c = loadConfig(d).config;
    ok(JSON.stringify(Object.keys(c.categories)) === '["archive"]' && c.categories.archive.label === 'arkiv' && c.categories.archive.hidden && !c.categoriesSet, 'loadConfig: no categories gives archive (arkiv on sv), hidden');
    fs.writeFileSync(path.join(d, 'rooflow.json'), JSON.stringify({ format: 1 }));
    ok(loadConfig(d).config.categories.archive.label === 'archive', 'loadConfig: the default label is archive on en');
    fs.writeFileSync(path.join(d, 'rooflow.json'), JSON.stringify({ format: 1, categories: { home: { label: 'hemma', machine: 'Other-PC', private: true } }, team: { enabled: true, sharedRepos: ['a', 3] } }));
    const r = loadConfig(d);
    c = r.config;
    ok(r.error === '' && c.categoriesSet && c.categories.home.machine === 'Other-PC' && !c.categories.archive, 'loadConfig: categories are read as written, no default added');
    ok(JSON.stringify(c.team.sharedRepos) === '["a"]' && c.team.enabled, 'loadConfig: team.sharedRepos is read');
    fs.writeFileSync(path.join(d, 'rooflow.json'), JSON.stringify({ format: 1, categories: 'x' }));
    ok(loadConfig(d).error.includes('categories'), 'loadConfig: categories that are not an object is an error');
  } finally {
    fs.rmSync(d, { recursive: true, force: true });
  }
}

// --- project folders: rooflow.json first, then <projectsDir>/<Folder> ---
{
  const reg = require('../scripts/register');
  const pa = path.join(__dirname, '_tmp', 'radartest-folders');
  fsx.rmSync(pa, { recursive: true, force: true });
  const rotF = path.join(pa, 'notebook');
  fsx.mkdirSync(path.join(pa, 'Project-A'), { recursive: true });
  fsx.mkdirSync(path.join(pa, 'elsewhere'), { recursive: true });
  fsx.mkdirSync(rotF, { recursive: true });
  const cfg0 = { projectsDir: '', projects: {} };
  ok(reg.repoFinns(rotF, cfg0, 'Project-A') === path.join(pa, 'Project-A'), 'folder: <notebook parent>/<Folder> by default');
  ok(reg.repoFinns(rotF, cfg0, 'Missing') === null, 'folder: null when it does not exist');
  const cfg1 = { projectsDir: '', projects: { 'project-a': { folder: '../elsewhere' } } };
  ok(reg.repoFinns(rotF, cfg1, 'Project-A') === path.join(pa, 'elsewhere'), 'folder: rooflow.json projects.<slug>.folder wins');
  const cfg2 = { projectsDir: '..', projects: {} };
  ok(reg.repoKandidater(rotF, cfg2, 'Project-A').includes(path.join(pa, 'Project-A')), 'folder: projectsDir is relative to the notebook');
  fsx.rmSync(pa, { recursive: true, force: true });
}

// --- hash per line, report fields, format ---
{
  const { hashRad } = require('../scripts/lines');
  const t = r.tolkaIdag('# Today 2026-10-22\n\n- [ ] a\n- [x] b\n');
  ok(t.saker[0].hash === hashRad('a') && t.saker[1].hash === hashRad('b') && t.saker[0].hash !== t.saker[1].hash, 'today: a hash per line');
  const ll = r.tolkaLoften('## Open\n- [ ] 2026-10-22 · till bob · x · y\n- [ ] 2026-10-15 · väntar på IT · answer\n', '2026-10-21');
  ok(ll.loften[0].hash === hashRad('2026-10-22 · till bob · x · y') && ll.vantar[0].hash === hashRad('2026-10-15 · väntar på IT · answer'), 'promises and waiting: a hash of the text after "- [ ] "');
  const jj = r.tolkaJournal(JSON.stringify({ time: 't', id: 'a', project: 'project-a', report: 'REPORT project-a\n- **Owner:** B9\nBlocked: the server' }) + '\n'
    + JSON.stringify({ time: 't', id: 'b', project: 'project-a', report: 'REPORT project-a\nOwner: B1', owner: 'B2', blocked: '' }) + '\n');
  ok(jj[0].owner === 'B9' && jj[0].blockerat === 'the server', 'journal: Owner and Blocked from the report text (older lines)');
  ok(jj[1].owner === 'B2', 'journal: the journal line\'s own field wins');
  ok(r.FORMAT === 1, 'radar.json has format number 1');
}

// --- Needs, Task and Project in the status header; Task in the decision block ---
{
  const h = r.tolkaStatusHuvud('State: asking\nDoing: waiting\nNeeds: restart\nTask: pa-cookies\nProject: project-a\nUpdated: 2026-11-24 10:00\n\n- Goal: x\n');
  ok(h.lage === 'frågar' && h.behover === 'restart' && h.uppdrag === 'pa-cookies' && h.projekt === 'project-a' && h.uppdaterad === '2026-11-24 10:00', 'status header: Needs, Task and Project after Doing');
  const sv = r.tolkaStatusHuvud('Läge: frågar\nGör nu: x\nBehöver: B9\nUppdrag: u\nProjekt: p\nUppdaterad: 2026-11-24 10:00\n');
  ok(sv.behover === 'B9' && sv.uppdrag === 'u' && sv.projekt === 'p', 'status header: the Swedish keys Behöver, Uppdrag, Projekt');
  const utan = r.tolkaStatusHuvud('State: running\nDoing: x\nUpdated: 2026-11-24 10:00\n');
  ok(utan.behover === '' && utan.uppdrag === '' && utan.projekt === '', 'a status header without the optional lines gives empty fields');
  ok(r.vantarKategori('restart') === 'restart' && r.vantarKategori('Deploy') === 'deploy' && r.vantarKategori('B9') === 'beslut' && r.vantarKategori('python') === 'annat' && r.vantarKategori('free text') === 'annat', 'Needs values are grouped: restart, deploy, beslut (B<n>), annat');
  const per = r.vantarPer([{ slug: 'a', behover: 'restart', vantarPa: 'restart', sedan: 's', gorNu: 'g' }, { slug: 'b' }, { slug: 'c', behover: 'B1', vantarPa: 'beslut', sedan: '', gorNu: '' }]);
  ok(per.restart.length === 1 && per.beslut.length === 1 && per.deploy.length === 0 && per.annat.length === 0 && per.restart[0].namn === 'a', 'vantarPer: groups only lines with Needs');
  const bb = r.tolkaBeslut('## Öppna\n\n## With task\n- Id: B50\n- Datum: 2026-11-24\n- Projekt: project-a\n- Task: pa-cookies\n- Frågar: x\n- Beslut:\n\n## Without task\n- Id: B51\n- Datum: 2026-11-24\n- Projekt: project-a\n- Frågar: x\n- Beslut:\n');
  ok(bb[0].uppdrag === 'pa-cookies' && bb[1].uppdrag === '', 'decision block: Task is read, empty when missing');
}

// --- a full run in a temporary notebook: Needs shown whether or not there is a B-id, hidden without Needs, link through Task, vantarPa in radar.json ---
{
  const fs = require('fs');
  const { spawnSync } = require('child_process');
  const rot = path.join(__dirname, '_tmp', 'radartest');
  const skriv = (rel, text) => { fs.mkdirSync(path.dirname(path.join(rot, rel)), { recursive: true }); fs.writeFileSync(path.join(rot, rel), text); };
  try {
    fs.rmSync(rot, { recursive: true, force: true });
    const nu = new Date();
    const p2 = (n) => String(n).padStart(2, '0');
    const tid = `${nu.getFullYear()}-${p2(nu.getMonth() + 1)}-${p2(nu.getDate())} ${p2(nu.getHours())}:${p2(nu.getMinutes())}`;
    skriv('rooflow.json', '{ "format": 1, "name": "alice" }\n');
    skriv('decisions.md', ['# Decisions', '', 'Next Id: B60', '', '## Open', '',
      '## Via Task', '- Id: B50', '- Date: 2026-11-24', '- Project: project-a', '- Task: pa-question', '- Asked by: x', '- Decision:', '',
      '## Via Project', '- Id: B51', '- Date: 2026-11-24', '- Project: old', '- Asked by: x', '- Decision:', ''].join('\n'));
    skriv('projects.md', '| Folder | Category | Own repo | Remote | State | Comment |\n|---|---|---|---|---|---|\n');
    skriv('status/pa-restart.md', `State: asking\nDoing: waiting for restart\nNeeds: restart\nUpdated: ${tid}\n`);
    skriv('status/pa-question.md', `State: asking\nDoing: waiting\nTask: pa-question\nUpdated: ${tid}\n`);
    skriv('status/old.md', `State: asking\nDoing: old question\nUpdated: ${tid}\n`);
    skriv('status/decided.md', `State: asking\nDoing: made the decision\nNeeds: B77\nUpdated: ${tid}\n`);
    skriv('status/hidden.md', `State: asking\nDoing: nothing to wait for\nUpdated: ${tid}\n`);
    skriv('status/bnr.md', `State: asking\nDoing: waiting for B50\nNeeds: B50\nUpdated: ${tid}\n`);
    skriv('status/run-ok.md', `State: running\nDoing: building\nUpdated: ${tid}\n`);
    skriv('status/run-wait.md', `State: running\nDoing: built, waits\nNeeds: deploy\nUpdated: ${tid}\n`);
    const k = spawnSync('node', [path.join(__dirname, '..', 'scripts', 'radar.js'), '--tyst'], { env: { ...process.env, ROOFLOW_ROOT: rot }, encoding: 'utf8' });
    ok(k.status === 0, 'scripts/radar.js runs in an empty test notebook' + (k.status ? ': ' + k.stderr.slice(0, 200) : ''));
    const j = JSON.parse(fs.readFileSync(path.join(rot, 'status', 'radar.json'), 'utf8'));
    const rs = Object.fromEntries(j.rorSig.map((x) => [x.slug, x]));
    ok(rs['pa-restart'] && rs['pa-restart'].lage === 'väntar: restart' && rs['pa-restart'].vantarPa === 'restart', 'Needs: restart is shown as "väntar: restart" without any B-id');
    ok(rs['pa-question'] && rs['pa-question'].lage === 'frågar B50', 'asking is linked to the open B-id through Task');
    ok(rs['old'] && rs['old'].lage === 'frågar B51', 'asking is linked through Project when the block has no Task');
    ok(!rs['hidden'], 'asking without Needs and without an open B-id is hidden');
    ok(!rs['decided'], 'Needs: B77 where B77 is no longer open does not count');
    ok(rs['bnr'] && rs['bnr'].lage === 'väntar: B50' && rs['bnr'].vantarPa === 'beslut', 'Needs: B50 with B50 open is a wait for a decision');
    ok(j.vantarPa.restart.length === 1 && j.vantarPa.beslut.length === 1 && j.vantarPa.deploy.length === 1 && j.vantarPa.restart[0].slug === 'pa-restart', 'radar.json has vantarPa per group');
    ok(JSON.stringify(j.korNu) === '["run-ok"]', 'korNu: State running counts, State running with Needs counts as waiting only');
    ok(j.format === 1, 'the format number is still 1 (the fields are additions)');
  } finally {
    fs.rmSync(rot, { recursive: true, force: true });
  }
}

// --- rooflow.json: visibility per kind, and projects.<slug>.run ---
{
  const fs = require('fs');
  const { loadConfig } = require('../scripts/root');
  const d = path.join(__dirname, '_tmp', 'radartest-config');
  fs.mkdirSync(d, { recursive: true });
  try {
    fs.writeFileSync(path.join(d, 'rooflow.json'), JSON.stringify({ format: 1, visibility: { agents: 'tree', build: 'loud' }, projects: { a: { folder: 'x', run: 'y' } } }));
    const c = loadConfig(d).config;
    ok(c.visibility.agents === 'tree' && c.visibility.routine === 'hidden' && c.visibility.build === 'hidden', 'visibility: tree is kept, a missing or unknown value is hidden');
    ok(c.projects.a.run === 'y' && c.projects.a.folder === 'x', 'projects.<slug>.run is read');
    fs.writeFileSync(path.join(d, 'rooflow.json'), '{ "format": 1 }');
    ok(JSON.stringify(loadConfig(d).config.visibility) === '{"routine":"hidden","agents":"hidden","build":"hidden"}', 'visibility: hidden for every kind by default');
  } finally {
    fs.rmSync(d, { recursive: true, force: true });
  }
}

// --- project folders from rooflow.json and run.json in another folder (projects.<slug>.run) ---
{
  const fs = require('fs');
  const { spawnSync, execFileSync } = require('child_process');
  const bas = path.join(__dirname, '_tmp', 'radartest-run');
  const rot = path.join(bas, 'notebook');
  const skriv = (rel, text) => { fs.mkdirSync(path.dirname(path.join(bas, rel)), { recursive: true }); fs.writeFileSync(path.join(bas, rel), text); };
  const korJson = (namn) => JSON.stringify([{ namn, cmd: 'echo ' + namn }]);
  try {
    fs.rmSync(bas, { recursive: true, force: true });
    // Like a real setup: the repository root holds run.json, the project folder is a subfolder of it; a stale folder
    // with the register's name exists beside the one in use; a third project's folder is spelled without "ä".
    skriv('Repo/run.json', korJson('web'));
    skriv('Repo/Sub.Project/readme.md', 'x');
    skriv('Short/readme.md', 'stale folder without run.json');
    skriv('Short-net10/run.json', korJson('site'));
    skriv('Narings/run.json', korJson('tool'));
    // A machine project whose folder happens to exist here too: still no Servers, no folder, no git.
    skriv('Faraway/run.json', korJson('far'));
    execFileSync('git', ['init', '-q', path.join(bas, 'Repo')]);
    execFileSync('git', ['-C', path.join(bas, 'Repo'), '-c', 'user.name=t', '-c', 'user.email=t@example.com', 'add', '-A']);
    execFileSync('git', ['-C', path.join(bas, 'Repo'), '-c', 'user.name=t', '-c', 'user.email=t@example.com', 'commit', '-q', '-m', 'first']);
    skriv('notebook/projects.md', [
      '| Folder | Category | Own repo | Remote | State | Comment |', '|---|---|---|---|---|---|',
      '| Sub.Project | private | yes | no | now | |', '| Short | private | yes | no | now | |', '| Näringar | private | no | no | now | |', '| Faraway | Hemma | yes | no | now | |', '| Gone | Arkiv | yes | no | now | |', '',
    ].join('\n'));
    skriv('notebook/rooflow.json', JSON.stringify({
      format: 1,
      categories: { private: { label: 'private' }, home: { label: 'hemma', machine: 'Other-PC' }, archive: { label: 'arkiv', hidden: true } },
      projects: {
        'sub.project': { folder: '../Repo/Sub.Project', run: '../Repo' },
        short: { folder: '../Short-net10' },
        'näringar': { folder: '../Narings' },
      },
    }));
    const k = spawnSync('node', [path.join(__dirname, '..', 'scripts', 'radar.js'), '--tyst'], { env: { ...process.env, ROOFLOW_ROOT: rot }, encoding: 'utf8' });
    ok(k.status === 0, 'radar.js runs with project folders from rooflow.json' + (k.status ? ': ' + k.stderr.slice(0, 200) : ''));
    const j = JSON.parse(fs.readFileSync(path.join(rot, 'status', 'radar.json'), 'utf8'));
    const p = Object.fromEntries(j.projekt.map((x) => [x.slug, x]));
    ok(p['sub.project'].dir === path.join(bas, 'Repo', 'Sub.Project'), 'folder: projects.<slug>.folder is the project folder');
    ok(p['sub.project'].kor.length === 1 && p['sub.project'].kor[0].namn === 'web' && p['sub.project'].kor[0].cwd === path.join(bas, 'Repo'), 'run: run.json is read from projects.<slug>.run, cwd is that folder');
    ok(p['sub.project'].gitLogg.length === 1 && p['sub.project'].gitLogg[0].text === 'first', 'git: a configured subfolder of a repository gets the repository log');
    ok(p['short'].dir === path.join(bas, 'Short-net10') && p['short'].kor[0].namn === 'site', 'folder: the configured folder wins over a stale folder with the register name');
    ok(p['näringar'].kor.length === 1 && p['näringar'].kor[0].namn === 'tool', 'a slug with "ä" finds its configured folder');
    ok(p['faraway'] && p['faraway'].kor.length === 0 && p['faraway'].dir === '' && p['faraway'].gitLogg.length === 0, 'machine: a project on another computer has no Servers, no folder and no git here');
    ok(!p['gone'], 'hidden: a project in a hidden category is not in radar.json');
  } finally {
    fs.rmSync(bas, { recursive: true, force: true });
  }
}

fsx.rmSync(tomRot, { recursive: true, force: true });
console.log(fel ? 'FEL: ' + fel : 'All OK');
process.exit(fel ? 1 : 0);
