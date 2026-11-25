#!/usr/bin/env node
// SessionStart hook: adds rules/rooflow.md to the session as additional context, but only when the session's folder
// is inside a RooFlow notebook (a folder with rooflow.json, found upwards from the session's cwd by scripts/root.js).
// Outside a notebook it prints nothing and exits 0, so other projects are not touched.
//
// Called by hooks/hooks.json as: node "${CLAUDE_PLUGIN_ROOT}/scripts/session-rules.js"
// The hook input (JSON on stdin) has the session's cwd; without it the process's own cwd is used.
// ROOFLOW_ROOT does not make the rules apply everywhere: it only names the notebook once the session is inside one
// (the same rule as the Radar mod).
'use strict';

const fs = require('fs');
const path = require('path');
const { findRoot, loadConfig } = require('./root');

function lasStdin() {
  if (process.stdin.isTTY) return '';
  try { return fs.readFileSync(0, 'utf8'); } catch { return ''; }
}

function sessionCwd() {
  try {
    const o = JSON.parse(lasStdin() || '{}');
    if (o && typeof o.cwd === 'string' && o.cwd) return o.cwd;
  } catch {
    // No usable input: the process's own cwd.
  }
  return process.cwd();
}

function main() {
  const cwd = sessionCwd();
  // The walk upwards only: ROOFLOW_ROOT is not allowed to switch the rules on outside a notebook.
  const funnen = findRoot(cwd, {});
  if (!funnen) return;
  const rot = process.env.ROOFLOW_ROOT ? path.resolve(process.env.ROOFLOW_ROOT) : funnen;
  let regler;
  try {
    regler = fs.readFileSync(path.join(__dirname, '..', 'rules', 'rooflow.md'), 'utf8').replace(/^﻿/, '');
  } catch {
    return;
  }
  const config = loadConfig(rot).config;
  const m = config.models;
  const v = config.visibility;
  const text = `RooFlow notebook: ${rot}\nModels (rooflow.json models): routine ${m.routine}, agents ${m.agents}, build ${m.build}\n`
    + `Visibility (rooflow.json visibility): routine ${v.routine}, agents ${v.agents}, build ${v.build}\n\n${regler}`;
  process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: text } }) + '\n');
}

main();
