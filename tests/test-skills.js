// Test of the skills, the notebook templates and the strings the mod sends to the session.
//  - every skills/*/SKILL.md has name (= its folder) and description
//  - every command the mod sends (PROMPTS, COMMANDS_FIRST in hooks/strings.ts), every command in commands.md and every name in
//    radar.js's SKILL_ORDNING is a skill (the mod's own /rooflow and the app's /usage excepted)
//  - skills hold no drive path and none of the product words that only an addon file may use
//  - every script a skill calls exists
//  - init.js builds a notebook from templates/ that scripts/doctor.js approves, and never overwrites a file
// Creates tests/_tmp/skills and removes it afterwards. Run: node tests/test-skills.js
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');

const repo = path.join(__dirname, '..');
const rot = path.join(__dirname, '_tmp', 'skills');
let fel = 0;
const ok = (v, t) => { console.log((v ? 'OK   ' : 'FAIL ') + t); if (!v) fel++; };
const las = (rel) => fs.readFileSync(path.join(repo, rel), 'utf8');

// --- the skills ---
const skillNamn = fs.readdirSync(path.join(repo, 'skills'), { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort();
const EXPECTED = ['agent', 'cleanup', 'decisions', 'friday', 'handover', 'inbox', 'morning', 'promise', 'radar', 'restart', 'rooflow-doctor', 'rooflow-setup', 'ship', 'start'];
ok(JSON.stringify(skillNamn) === JSON.stringify(EXPECTED), `the skills are ${EXPECTED.join(', ')} (found ${skillNamn.join(', ')})`);

const skillText = {};
for (const namn of skillNamn) {
  const fil = path.join('skills', namn, 'SKILL.md');
  const text = fs.existsSync(path.join(repo, fil)) ? las(fil) : '';
  skillText[namn] = text;
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
  const rubrik = m ? m[1] : '';
  const n = (rubrik.match(/^name:\s*(.+)$/m) || [])[1];
  const d = (rubrik.match(/^description:\s*(.+)$/m) || [])[1];
  ok(m !== null && n && n.trim() === namn, `${fil}: name is "${namn}"`);
  ok(!!d && d.trim().length > 30, `${fil}: has a description`);
  ok(!text.startsWith('﻿'), `${fil}: no BOM`);
}

// --- the commands ---
const EJ_SKILL = new Set(['/rooflow', '/usage']);
const strings = las('hooks/strings.ts');
const forsta = (strings.match(/COMMANDS_FIRST\s*=\s*\[([^\]]*)\]/) || [])[1] || '';
const commandsFirst = [...forsta.matchAll(/'(\/[a-z-]+)'/g)].map((m) => m[1]);
const prompter = [...(strings.match(/export const PROMPTS = \{([\s\S]*?)\} as const/) || [])[1].matchAll(/'(\/[a-z-]+)[ :]/g)].map((m) => m[1]);
const commandsMd = [...las('templates/commands.md').matchAll(/^\|\s*`(\/[a-z-]+)/gm)].map((m) => m[1]);
const ordning = [...((las('scripts/radar.js').match(/SKILL_ORDNING\s*=\s*\[([^\]]*)\]/) || [])[1] || '').matchAll(/'(\/[a-z-]+)'/g)].map((m) => m[1]);

const ärSkill = (c) => EJ_SKILL.has(c) || skillNamn.includes(c.slice(1));
ok(commandsFirst.length >= 5 && commandsFirst.every(ärSkill), `COMMANDS_FIRST are skills: ${commandsFirst.join(' ')}`);
ok(prompter.length >= 4 && prompter.every(ärSkill), `PROMPTS commands are skills: ${[...new Set(prompter)].join(' ')}`);
ok(commandsMd.length >= 15 && commandsMd.every(ärSkill), `commands.md commands are skills: ${[...new Set(commandsMd)].join(' ')}`);
ok(ordning.length >= 10 && ordning.every(ärSkill), `radar.js SKILL_ORDNING are skills: ${ordning.join(' ')}`);
ok(['/morning', '/decisions', '/inbox', '/promise', '/friday', '/handover', '/restart', '/cleanup', '/rooflow-doctor', '/ship'].every((c) => ordning.includes(c)), 'SKILL_ORDNING lists the new names');
ok(!/(?<![\w/])\/(morgon|beslut|inkorg|lova|fredag|overlamning)\b/.test(strings.replace(/\/\/.*$/gm, '')), 'strings.ts has no Swedish skill names');
const kommandon = require('../scripts/radar.js').tolkaKommandon(las('templates/commands.md'));
ok(kommandon.every((k) => k.besk.length > 5), 'every command in SKILL_ORDNING has a description in commands.md');
const prompterDecision = strings.includes("decisionNew: '/decisions new: '") && strings.includes('Fortsätt ${task}: ${id} är avgjort med svaret') && strings.includes('Continue ${task}: ${id} is decided with the answer');
ok(prompterDecision, 'the panel prompt "Continue <task>: B<n> is decided with the answer ..." exists in both languages');
ok(/Continue <task>: B14 is decided with the answer/.test(skillText.decisions), 'the decisions skill handles the continue prompt from the panel');
ok(/new: <question>/.test(skillText.decisions), 'the decisions skill handles "/decisions new: <text>"');
ok(/autoContinue/.test(skillText.decisions) && /undoSeconds/.test(skillText.decisions) && /Continue the agent/.test(skillText.decisions), 'the decisions skill describes the automatic continue, Undo and the button');
ok(/autoContinue/.test(skillText['rooflow-setup']), 'rooflow-setup asks about decisions.autoContinue');
ok(JSON.parse(las('templates/rooflow.json')).decisions.autoContinue === true && JSON.parse(las('templates/rooflow.json')).decisions.undoSeconds === 4, 'the template has decisions.autoContinue true and undoSeconds 4');

// --- nothing personal or local ---
const FORBJUDET = [
  [/[A-Za-z]:[\\/]/, 'a drive path'],
  [/\/c\/Code/i, 'a path under /c/Code'], // legacy-ok
  [/Outlook/, 'Outlook (only the addon file may name it)'],
  [/\bbin\//, 'the old bin/ folder'],
];
for (const namn of skillNamn) {
  const text = skillText[namn];
  for (const [re, vad] of FORBJUDET) ok((namn === 'rooflow-setup' && re.source === 'Outlook') || !re.test(text), `skills/${namn}/SKILL.md has no ${vad}`);
}
ok(/Outlook/.test(las('skills/morning/calendar-outlook.md')) && /addons.calendar|"calendar": "outlook"/.test(las('skills/morning/calendar-outlook.md')), 'the Outlook command lives in the addon file only');
ok(/addons\.calendar/.test(skillText.morning), 'the morning skill runs the calendar only when addons.calendar is on');
for (const rel of ['rules/agent-contract.md', ...EXPECTED.map((n) => `skills/${n}/SKILL.md`)]) {
  ok(!/[åäö]/i.test(las(rel).replace(/väntar på|`till`|fortsätt/g, '')), `${rel}: English prose (no Swedish letters)`);
}

// --- every script a skill calls exists ---
const anropade = new Set();
for (const text of [...Object.values(skillText), las('rules/agent-contract.md')]) {
  for (const m of text.matchAll(/scripts\/([A-Za-z0-9_-]+\.(?:js|cjs|sh))/g)) anropade.add(m[1]);
}
const saknas = [...anropade].filter((s) => !fs.existsSync(path.join(repo, 'scripts', s)));
ok(anropade.size >= 10 && saknas.length === 0, `scripts called by the skills exist (${anropade.size} of them${saknas.length ? '; missing ' + saknas.join(', ') : ''})`);

// --- the agent skill and the contract ---
ok(/`---`/.test(skillText.agent) && /heading/.test(skillText.agent), 'agent: the brief format (heading, line, ---, prompt)');
ok(/pipe/.test(skillText.agent) && /exit code/.test(skillText.agent), 'agent: never agent.sh behind a pipe');
ok(/--bring-back/.test(skillText.agent) && skillText.agent.indexOf('--bring-back') < skillText.agent.indexOf('agent.sh briefs'), 'agent: bring back before start');
ok(/Needs/.test(las('rules/agent-contract.md')) && /Task:/.test(las('rules/agent-contract.md')), 'contract: Needs and Task in the status header');
ok(/new-decision\.cjs/.test(las('rules/agent-contract.md')), 'contract: B-ids through scripts/new-decision.cjs');
for (const k of ['Done:', 'Owner:', 'Promises:', 'Blocked:', 'Next:', 'Branch:', 'Tested:', 'REPORT <project> <date>']) ok(las('rules/agent-contract.md').includes(k), `contract: report field ${k}`);
ok(/subagents\.jsonl/.test(skillText.agent) && /`routine` model/.test(skillText.agent), 'agent: routine subagent and the subagent log');
ok(/rules\/agent-contract\.md/.test(skillText.agent), 'agent: the brief is built on rules/agent-contract.md');

// --- the setup: templates -> a notebook that doctor approves ---
const setup = skillText['rooflow-setup'];
for (const ord of ['name', 'language', 'calendar', 'outlook', 'Scheduled morning', 'Run /morning.', 'Backup', 'private', 'Team mode', 'settings.local.json', 'agent contract', 'init.js', 'never overwrites']) {
  ok(setup.toLowerCase().includes(ord.toLowerCase()), `rooflow-setup mentions "${ord}"`);
}
const MALLAR = ['rooflow.json', 'decisions.md', 'promises.md', 'inbox.md', 'today.md', 'handover.md', 'projects.md', 'commands.md', 'CLAUDE.md', 'status/_template.md', 'after-release.md'];
for (const rel of MALLAR) ok(fs.existsSync(path.join(repo, 'templates', rel)), `templates/${rel} exists`);
const mall = JSON.parse(las('templates/rooflow.json'));
ok(mall.format === 1 && mall.language === 'en' && mall.team.enabled === false && 'backup' in mall && 'addons' in mall && 'name' in mall, 'templates/rooflow.json: format 1, language en, team off, backup, addons, name');
ok(Object.keys(mall.categories).join(',') === 'work,private,home,archive' && mall.categories.archive.hidden === true && mall.categories.home.private === true && !('machine' in mall.categories.home), 'templates/rooflow.json: categories work, private, home, archive; archive hidden; no machine');
ok(/## \d+\. Categories/.test(setup) && /machine/.test(setup) && /categories\.js suggest/.test(setup), 'rooflow-setup has a Categories step that uses scripts/categories.js suggest and asks about machine');
ok(/Next Id: B1\b/.test(las('templates/decisions.md')) && /^## Open/m.test(las('templates/decisions.md')) && /^## Decided/m.test(las('templates/decisions.md')), 'templates/decisions.md: Next Id B1, ## Open, ## Decided');
ok(['## Now', '## Agent', '## Waiting', '## Later', '## Done'].every((h) => las('templates/inbox.md').includes(h)), 'templates/inbox.md: Now, Agent, Waiting, Later, Done');
ok(/Folder \| Category \| Own repo \| Remote \| State \| Comment/.test(las('templates/projects.md')), 'templates/projects.md: Folder/Category/Own repo/Remote/State/Comment');
ok(['State:', 'Doing:', 'Needs:', 'Task:', 'Project:', 'Updated:'].every((k) => las('templates/status/_template.md').includes(k)), 'templates/status/_template.md: State, Doing, Needs, Task, Project, Updated');
ok(/rooflow plugin/.test(las('templates/CLAUDE.md')), 'templates/CLAUDE.md: the rules come from the plugin');

fs.rmSync(rot, { recursive: true, force: true });
fs.mkdirSync(rot, { recursive: true });
execFileSync('git', ['init', '-q', rot]);
const init = (...extra) => spawnSync(process.execPath, [path.join(repo, 'scripts', 'init.js'), '--root', rot, ...extra], { encoding: 'utf8' });
let r = init('--name', 'Sam', '--language', 'sv');
const sistaRad = r.stdout.trim().split('\n').pop();
const ut = JSON.parse(sistaRad);
ok(r.status === 0 && ut.ok && ut.created.length === 10 && ut.kept.length === 0, 'init.js creates ten files in an empty folder');
ok(MALLAR.filter((f) => f !== 'after-release.md').every((f) => fs.existsSync(path.join(rot, f))) && !fs.existsSync(path.join(rot, 'after-release.md')), 'init.js makes every file except after-release.md');
ok(['status', 'notes', 'archive', 'briefs'].every((d) => fs.statSync(path.join(rot, d)).isDirectory()), 'init.js makes status/, notes/, archive/, briefs/');
const cfg = JSON.parse(fs.readFileSync(path.join(rot, 'rooflow.json'), 'utf8'));
ok(cfg.name === 'Sam' && cfg.language === 'sv' && cfg.format === 1, 'init.js writes name and language to rooflow.json');
ok(Object.entries(cfg.categories).map(([k, c]) => `${k}=${c.label}`).join(',') === 'work=jobb,private=privat,home=hemma,archive=arkiv' && cfg.categories.archive.hidden && cfg.categories.private.private, 'init.js gives the template categories Swedish labels on sv');
ok(/^# Today \d{4}-\d{2}-\d{2}/.test(fs.readFileSync(path.join(rot, 'today.md'), 'utf8')), 'init.js puts today\'s date in today.md');
ok(fs.readdirSync(rot).concat(fs.readdirSync(path.join(rot, 'status'))).every((f) => !f.endsWith('.tmp')), 'no stray files');
for (const f of MALLAR.filter((x) => x !== 'after-release.md')) {
  const buf = fs.readFileSync(path.join(rot, f));
  ok(!(buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf), `${f}: no BOM`);
}

const doctor = spawnSync(process.execPath, [path.join(repo, 'scripts', 'doctor.js')], { encoding: 'utf8', env: { ...process.env, ROOFLOW_ROOT: rot, ROOFLOW_PLUGINS_DIR: path.join(rot, 'no-plugins') } });
ok(doctor.status === 0 && !/^(WARNING|ERROR)/m.test(doctor.stdout), 'doctor approves the new notebook: only OK, exit code 0');
if (doctor.status !== 0 || /^(WARNING|ERROR)/m.test(doctor.stdout)) console.log(doctor.stdout);

fs.writeFileSync(path.join(rot, 'decisions.md'), 'my own text\n');
fs.writeFileSync(path.join(rot, 'rooflow.json'), '{"format":1,"name":"Own","language":"en"}\n');
r = init('--name', 'Other', '--language', 'en');
const ut2 = JSON.parse(r.stdout.trim().split('\n').pop());
ok(ut2.created.length === 0 && ut2.kept.length === 10, 'a second run keeps every file');
ok(fs.readFileSync(path.join(rot, 'decisions.md'), 'utf8') === 'my own text\n' && JSON.parse(fs.readFileSync(path.join(rot, 'rooflow.json'), 'utf8')).name === 'Own', 'a second run overwrites nothing');
fs.rmSync(path.join(rot, 'promises.md'));
r = init('--no-radar');
ok(JSON.parse(r.stdout.trim().split('\n').pop()).created.join() === 'promises.md', 'a second run fills in only what is missing');
ok(init('--language', 'fr').status === 1, 'init.js refuses an unknown language');

// --- the language of the templates ---
ok(Array.isArray(ut.overview) && ['radar.md', 'status/radar.json'].every((f) => ut.overview.includes(f)) && !ut.created.includes('radar.md'), 'init.js lists the overview\'s files as "overview", not as "created"');
const svMallar = [];
(function samla(dir) {
  for (const e of fs.readdirSync(path.join(repo, 'templates', 'sv', dir), { withFileTypes: true })) {
    const rel = dir ? dir + '/' + e.name : e.name;
    if (e.isDirectory()) samla(rel); else svMallar.push(rel);
  }
})('');
ok(svMallar.length >= 8 && svMallar.every((f) => fs.existsSync(path.join(repo, 'templates', f))), `every templates/sv file has an English template (${svMallar.join(', ')})`);
const rubriker = (text) => text.split(/\r?\n/).filter((l) => /^## /.test(l) && !/^## </.test(l)).join('|');
for (const f of ['decisions.md', 'inbox.md', 'promises.md']) {
  ok(rubriker(las('templates/sv/' + f)) === rubriker(las('templates/' + f)), `templates/sv/${f} keeps the English ## headings the scripts read`);
}
ok(/^Next Id: B1$/m.test(las('templates/sv/decisions.md')) && /^## Open\n\n/m.test(las('templates/sv/decisions.md')), 'templates/sv/decisions.md: Next Id B1 and "## Open" followed by an empty line (new-decision.cjs)');
for (const k of ['- Id:', '- Date:', '- Project:', '- Task:', '- Blocks:', '- Asked by:', '- Question:', '- Why it matters:', '- Options:', '- Decision:']) {
  ok(las('templates/sv/decisions.md').includes(k), `templates/sv/decisions.md: the block key "${k}" is English`);
}
ok(/Folder \| Category \| Own repo \| Remote \| State \| Comment/.test(las('templates/sv/projects.md')), 'templates/sv/projects.md: the English column headers');
ok(las('templates/sv/status/_template.md').split('\n').slice(0, 6).map((l) => l.split(':')[0]).join(',') === 'State,Doing,Needs,Task,Project,Updated', 'templates/sv/status/_template.md: the English header keys in order');
const kommandonSv = require('../scripts/radar.js').tolkaKommandon(las('templates/sv/commands.md'));
ok(kommandonSv.every((k) => k.besk.length > 5), 'templates/sv/commands.md: every command has a description');

const rotSv = path.join(__dirname, '_tmp', 'skills-sv');
const rotEn = path.join(__dirname, '_tmp', 'skills-en');
for (const d of [rotSv, rotEn]) fs.rmSync(d, { recursive: true, force: true });
const initI = (dir, ...extra) => spawnSync(process.execPath, [path.join(repo, 'scripts', 'init.js'), '--root', dir, ...extra], { encoding: 'utf8' });
ok(initI(rotSv, '--language', 'sv').status === 0 && initI(rotEn, '--language', 'en').status === 0, 'init.js runs with --language sv and en');
const svText = (f) => fs.readFileSync(path.join(rotSv, f), 'utf8');
const enText = (f) => fs.readFileSync(path.join(rotEn, f), 'utf8');
ok(/^# Beslut som väntar på dig/.test(svText('decisions.md')) && /^# Inkorg/.test(svText('inbox.md')) && /^## Egna regler/m.test(svText('CLAUDE.md')), 'sv: Swedish headings from templates/sv/');
ok(/^# Decisions waiting for you/.test(enText('decisions.md')) && /^# Inbox/.test(enText('inbox.md')) && /^## Own rules/m.test(enText('CLAUDE.md')), 'en: the English templates');
ok(/^# Today \d{4}-\d{2}-\d{2}/.test(svText('today.md')) && JSON.parse(svText('rooflow.json')).language === 'sv', 'sv: a file without a Swedish template falls back to templates/ (today.md, rooflow.json)');
const blockFil = path.join(rotSv, 'block.txt');
fs.writeFileSync(blockFil, '## Prov\n- Id: B?\n- Date: 2026-11-25\n- Asked by: prov\n- Question: Fungerar det?\n- Options: a) ja b) **(förslag)** nej\n- Decision:\n');
const nyttB = spawnSync(process.execPath, [path.join(repo, 'scripts', 'new-decision.cjs'), blockFil], { encoding: 'utf8', env: { ...process.env, ROOFLOW_ROOT: rotSv } });
ok(nyttB.status === 0 && nyttB.stdout.trim() === 'B1' && /^Next Id: B2$/m.test(svText('decisions.md')), 'sv: new-decision.cjs adds B1 under ## Open and counts Next Id up');
fs.rmSync(blockFil);
const radarSv = spawnSync(process.execPath, [path.join(repo, 'scripts', 'radar.js'), '--quiet'], { encoding: 'utf8', env: { ...process.env, ROOFLOW_ROOT: rotSv } });
const radarJson = JSON.parse(fs.readFileSync(path.join(rotSv, 'status', 'radar.json'), 'utf8'));
ok(radarSv.status === 0 && JSON.stringify(radarJson).includes('Fungerar det?'), 'sv: radar.js reads the decision from the Swedish decisions.md');
for (const d of [rotSv, rotEn]) {
  const doc = spawnSync(process.execPath, [path.join(repo, 'scripts', 'doctor.js')], { encoding: 'utf8', env: { ...process.env, ROOFLOW_ROOT: d, ROOFLOW_PLUGINS_DIR: path.join(d, 'no-plugins') } });
  ok(doc.status === 0 && !/^(WARNING|ERROR)/m.test(doc.stdout), `doctor approves the ${path.basename(d)} notebook`);
  if (doc.status !== 0 || /^(WARNING|ERROR)/m.test(doc.stdout)) console.log(doc.stdout);
  fs.rmSync(d, { recursive: true, force: true });
}

fs.rmSync(rot, { recursive: true, force: true });
fs.mkdirSync(path.join(rot, 'status'), { recursive: true });
fs.mkdirSync(path.join(rot, 'tankar'));
for (const f of ['beslut.md', 'loften.md', 'kommandon.md', 'status/_mall.md']) fs.writeFileSync(path.join(rot, f), 'old\n');
r = init('--no-radar');
const ut3 = JSON.parse(r.stdout.trim().split('\n').pop());
ok(!['decisions.md', 'promises.md', 'commands.md', 'status/_template.md'].some((f) => fs.existsSync(path.join(rot, f))), 'init.js does not shadow the Swedish file names of an older notebook');
ok(!fs.existsSync(path.join(rot, 'notes')) && ut3.created.includes('inbox.md'), 'init.js does not make notes/ next to tankar/, and still makes the files that are missing');

fs.rmSync(rot, { recursive: true, force: true });
console.log(fel ? `\n${fel} FAILED` : '\nAll OK');
process.exit(fel ? 1 : 0);
