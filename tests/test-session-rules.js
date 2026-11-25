// Test for scripts/session-rules.js: the rules are added as SessionStart context only inside a notebook.
// Runs the script directly with the hook's JSON on stdin, in a temporary tree under tests/_tmp (removed afterwards).
// The "without" case needs a folder with no notebook above it, so it lives under the operating system's temp folder.
// Run: node tests/test-session-rules.js
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const skript = path.join(__dirname, '..', 'scripts', 'session-rules.js');
const regler = fs.readFileSync(path.join(__dirname, '..', 'rules', 'rooflow.md'), 'utf8');
const med = path.join(__dirname, '_tmp', 'rules-with');
const utan = fs.mkdtempSync(path.join(os.tmpdir(), 'rooflow-rules-without-'));
let fel = 0;
const ok = (v, t) => { console.log((v ? 'OK   ' : 'FAIL ') + t); if (!v) fel++; };

function kor(cwd, env = {}, stdin) {
  const e = { ...process.env, ...env };
  delete e.ROOFLOW_ROOT;
  if (env.ROOFLOW_ROOT) e.ROOFLOW_ROOT = env.ROOFLOW_ROOT;
  const r = spawnSync('node', [skript], { cwd, env: e, input: stdin === undefined ? JSON.stringify({ cwd }) : stdin, encoding: 'utf8' });
  return { kod: r.status, ut: r.stdout, err: r.stderr };
}

try {
  fs.rmSync(med, { recursive: true, force: true });
  fs.mkdirSync(path.join(med, 'status', 'deep'), { recursive: true });
  fs.writeFileSync(path.join(med, 'rooflow.json'), '{"format":1}');

  // Inside a notebook: the rules, as SessionStart additional context.
  let r = kor(med);
  const o = r.ut ? JSON.parse(r.ut) : null;
  ok(r.kod === 0 && o && o.hookSpecificOutput.hookEventName === 'SessionStart', 'in a notebook: one JSON line with hookEventName SessionStart');
  ok(o && o.hookSpecificOutput.additionalContext.includes(regler.trim().split('\n')[0]) && o.hookSpecificOutput.additionalContext.includes(`RooFlow notebook: ${med}`), 'in a notebook: the text of rules/rooflow.md and the notebook folder');
  ok(o && /decisions\.md/.test(o.hookSpecificOutput.additionalContext) && /State: running/.test(o.hookSpecificOutput.additionalContext), 'the rules use the English file names and keys');
  ok(o && o.hookSpecificOutput.additionalContext.includes('Visibility (rooflow.json visibility): routine hidden, agents hidden, build hidden'), 'the Visibility line, hidden by default');

  // A subfolder counts; so does the cwd given on stdin when the process runs elsewhere.
  r = kor(path.join(med, 'status', 'deep'));
  ok(r.kod === 0 && r.ut.includes('RooFlow notebook'), 'in a subfolder of a notebook: the rules');
  r = kor(utan, {}, JSON.stringify({ cwd: path.join(med, 'status') }));
  ok(r.kod === 0 && r.ut.includes('RooFlow notebook'), 'the cwd on stdin decides, not the process cwd');

  // Without a notebook: nothing at all.
  r = kor(utan);
  ok(r.kod === 0 && r.ut === '' && r.err === '', 'outside a notebook: no output, exit 0');
  r = kor(utan, {}, '');
  ok(r.kod === 0 && r.ut === '', 'no stdin and no notebook: no output');
  r = kor(utan, {}, 'not json');
  ok(r.kod === 0 && r.ut === '', 'unusable stdin and no notebook: no output');

  // ROOFLOW_ROOT does not switch the rules on outside a notebook, but names the notebook once inside one.
  r = kor(utan, { ROOFLOW_ROOT: med });
  ok(r.kod === 0 && r.ut === '', 'ROOFLOW_ROOT alone does not add the rules outside a notebook');
  const andra = path.join(__dirname, '_tmp', 'rules-other');
  fs.mkdirSync(andra, { recursive: true });
  r = kor(med, { ROOFLOW_ROOT: andra });
  ok(r.kod === 0 && JSON.parse(r.ut).hookSpecificOutput.additionalContext.includes(`RooFlow notebook: ${andra}`),'inside a notebook, ROOFLOW_ROOT names the notebook folder');
} finally {
  fs.rmSync(path.join(__dirname, '_tmp', 'rules-with'), { recursive: true, force: true });
  fs.rmSync(path.join(__dirname, '_tmp', 'rules-other'), { recursive: true, force: true });
  fs.rmSync(utan, { recursive: true, force: true });
}
process.exit(fel ? 1 : 0);
